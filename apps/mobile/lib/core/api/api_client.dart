import 'package:dio/dio.dart';

import '../auth/token_storage.dart';
import '../config/api_config.dart';
import 'api_exception.dart';

/// Client HTTP de l'application, construit sur Dio.
///
/// Responsabilités :
/// - préfixe toutes les requêtes par `<baseUrl>/api/v1` ;
/// - ajoute automatiquement l'en-tête `Authorization: Bearer <accessToken>` ;
/// - sur une réponse 401 (access token expiré), tente UNE SEULE fois
///   `POST /auth/refresh` puis rejoue la requête d'origine ; si le
///   rafraîchissement échoue, purge les jetons et signale l'expiration de
///   session via [onSessionExpired] (l'AuthController déconnecte alors
///   l'utilisateur) ;
/// - sur une réponse 403 « Compte suspendu » (le compte a été suspendu par la
///   modération en cours de session), traite le cas comme une FIN DE SESSION :
///   purge les jetons et signale l'expiration via [onSessionExpired] avec le
///   drapeau « suspendu ». Les AUTRES 403 (droits insuffisants) ne déconnectent
///   PAS et ressortent en [ApiException] affichable ;
/// - convertit toutes les erreurs Dio en [ApiException] portant un message
///   en français affichable tel quel.
class ApiClient {
  ApiClient({
    required this._tokenStorage,
    required this._onSessionExpired,
  }) {
    _dio = Dio(_optionsDeBase());
    // Client dédié au rafraîchissement : SANS intercepteur, pour qu'un 401
    // sur /auth/refresh ne déclenche jamais de boucle de rafraîchissement.
    _refreshDio = Dio(_optionsDeBase());
    _dio.interceptors.add(
      InterceptorsWrapper(onRequest: _ajouterJeton, onError: _intercepterFinDeSession),
    );
  }

  final TokenStorage _tokenStorage;

  /// Notifie la fin de session (expiration ou suspension). Le drapeau
  /// [suspendu] vaut vrai pour un 403 « Compte suspendu » afin d'afficher un
  /// message dédié plutôt que le message générique d'expiration.
  final void Function({required bool suspendu}) _onSessionExpired;

  late final Dio _dio;
  late final Dio _refreshDio;

  /// Rafraîchissement en cours, partagé entre les requêtes concurrentes qui
  /// reçoivent un 401 en même temps (un seul POST /auth/refresh à la fois).
  Future<bool>? _rafraichissementEnCours;

  /// Clé posée dans `RequestOptions.extra` pour marquer une requête déjà
  /// rejouée après rafraîchissement (garantit UNE seule tentative).
  static const String _cleDejaRejouee = 'endirek_deja_rejouee';

  /// Routes d'authentification publiques : un 401 sur ces routes est une
  /// erreur métier (mauvais identifiants, refresh token invalide…), pas une
  /// expiration de session — on ne tente pas de rafraîchissement.
  ///
  /// `/auth/logout` y figure : son échec est sans conséquence (l'API est
  /// stateless, la déconnexion effective est la purge locale), inutile donc
  /// de déclencher un cycle de rafraîchissement sur un 401.
  static const Set<String> _routesAuthPubliques = {
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/logout',
  };

  /// Message exact renvoyé par le backend (ForbiddenException) quand le compte
  /// a été suspendu : un 403 portant ce message est une FIN DE SESSION, pas un
  /// simple refus de droits.
  static const String _messageCompteSuspendu = 'Compte suspendu';

  static BaseOptions _optionsDeBase() {
    return BaseOptions(
      baseUrl: ApiConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      headers: const {'Accept': 'application/json'},
    );
  }

  // --------------------------------------------------------------------- //
  // Méthodes HTTP : toute erreur Dio ressort en ApiException affichable.   //
  // --------------------------------------------------------------------- //

  Future<Response<dynamic>> get(
    String chemin, {
    Map<String, dynamic>? queryParameters,
  }) {
    return _executer(() => _dio.get<dynamic>(chemin, queryParameters: queryParameters));
  }

  Future<Response<dynamic>> post(String chemin, {Object? data}) {
    return _executer(() => _dio.post<dynamic>(chemin, data: data));
  }

  Future<Response<dynamic>> patch(String chemin, {Object? data}) {
    return _executer(() => _dio.patch<dynamic>(chemin, data: data));
  }

  Future<Response<dynamic>> delete(String chemin, {Object? data}) {
    return _executer(() => _dio.delete<dynamic>(chemin, data: data));
  }

  Future<Response<dynamic>> _executer(
    Future<Response<dynamic>> Function() requete,
  ) async {
    try {
      return await requete();
    } on DioException catch (erreur) {
      throw ApiException.fromDioException(erreur);
    }
  }

  // --------------------------------------------------------------------- //
  // Intercepteurs                                                          //
  // --------------------------------------------------------------------- //

  /// Ajoute le jeton d'accès courant sur chaque requête sortante.
  Future<void> _ajouterJeton(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final String? accessToken = await _tokenStorage.readAccessToken();
    if (accessToken != null && accessToken.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }
    handler.next(options);
  }

  /// Gère les réponses qui mettent fin à la session :
  /// - 403 « Compte suspendu » : le compte a été suspendu par la modération en
  ///   cours de session → purge locale + bascule déconnecté (drapeau suspendu) ;
  /// - 401 : tente une fois le rafraîchissement, puis rejoue la requête ; si le
  ///   rafraîchissement échoue, purge locale + bascule déconnecté (expiration).
  ///
  /// Les autres 403 (droits insuffisants) sont laissés remonter tels quels.
  Future<void> _intercepterFinDeSession(
    DioException erreur,
    ErrorInterceptorHandler handler,
  ) async {
    final RequestOptions requete = erreur.requestOptions;
    final bool estRoutePublique = _routesAuthPubliques.contains(requete.path) ||
        requete.path.startsWith('/auth/oauth');
    final int? statut = erreur.response?.statusCode;

    // 403 « Compte suspendu » : suspension en cours de session. On termine la
    // session immédiatement (aucun rafraîchissement ne peut la rétablir).
    // Un 403 sur une route d'auth publique n'a pas de sens (aucun jeton en
    // jeu) : on le laisse remonter comme une simple erreur métier.
    if (statut == 403 && !estRoutePublique && _estCompteSuspendu(erreur.response)) {
      await _tokenStorage.clear();
      _onSessionExpired(suspendu: true);
      handler.next(erreur);
      return;
    }

    final bool dejaRejouee = requete.extra[_cleDejaRejouee] == true;
    if (statut != 401 || estRoutePublique || dejaRejouee) {
      handler.next(erreur);
      return;
    }

    final bool rafraichi = await _rafraichirJetons();
    if (rafraichi) {
      try {
        // Rejoue la requête d'origine : l'intercepteur de requête posera le
        // nouveau jeton d'accès, et le marqueur interdit toute 2e tentative.
        requete.extra[_cleDejaRejouee] = true;
        final Response<dynamic> reponse = await _dio.fetch<dynamic>(requete);
        handler.resolve(reponse);
        return;
      } on DioException catch (erreurRejeu) {
        handler.next(erreurRejeu);
        return;
      }
    }

    // Rafraîchissement impossible : la session est terminée. Purge locale
    // puis notification (l'AuthController bascule l'app sur l'écran de
    // connexion via le routeur).
    await _tokenStorage.clear();
    _onSessionExpired(suspendu: false);
    handler.next(erreur);
  }

  /// Vrai si le corps d'une réponse 403 porte le message backend
  /// « Compte suspendu » (NestJS : `{ statusCode, message, error }`).
  static bool _estCompteSuspendu(Response<dynamic>? reponse) {
    final dynamic data = reponse?.data;
    if (data is! Map) {
      return false;
    }
    final dynamic message = data['message'];
    return message is String && message.trim() == _messageCompteSuspendu;
  }

  /// Un seul rafraîchissement à la fois : les 401 concurrents attendent le
  /// même résultat.
  Future<bool> _rafraichirJetons() {
    return _rafraichissementEnCours ??=
        _appelerAuthRefresh().whenComplete(() => _rafraichissementEnCours = null);
  }

  Future<bool> _appelerAuthRefresh() async {
    final String? refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      return false;
    }
    try {
      final Response<dynamic> reponse = await _refreshDio.post<dynamic>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final dynamic data = reponse.data;
      if (data is! Map) {
        return false;
      }
      final dynamic nouvelAccess = data['accessToken'];
      final dynamic nouveauRefresh = data['refreshToken'];
      if (nouvelAccess is! String || nouveauRefresh is! String) {
        return false;
      }
      await _tokenStorage.saveTokens(
        accessToken: nouvelAccess,
        refreshToken: nouveauRefresh,
      );
      return true;
    } on DioException {
      // Refresh token invalide/expiré, ou compte plus actif : session finie.
      return false;
    }
  }
}
