import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../api/models/user_profile.dart';
import 'auth_state.dart';
import 'token_storage.dart';

/// Stockage des jetons — surchargez ce provider avec [InMemoryTokenStorage]
/// dans les tests pour éviter tout accès au trousseau natif.
final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return SecureTokenStorage();
});

/// Client HTTP unique de l'application. En cas d'échec définitif du
/// rafraîchissement de session (401 + refresh invalide) OU de suspension du
/// compte en cours de session (403 « Compte suspendu »), il notifie
/// l'[AuthController] qui bascule l'app en état déconnecté.
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    tokenStorage: ref.watch(tokenStorageProvider),
    // Lecture différée : le contrôleur existe déjà quand une session expire.
    onSessionExpired: ({required bool suspendu}) =>
        ref.read(authControllerProvider.notifier).onSessionExpired(
              suspendu: suspendu,
            ),
  );
});

/// Contrôleur d'authentification global (connexion, inscription,
/// déconnexion, restauration de session au démarrage).
final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    // La restauration démarre dès la première écoute (le routeur écoute cet
    // état au lancement de l'app). Microtask : pas de mutation d'état
    // pendant le build du provider.
    Future.microtask(_restaurerSession);
    return const AuthUnknown();
  }

  ApiClient get _api => ref.read(apiClientProvider);

  TokenStorage get _jetons => ref.read(tokenStorageProvider);

  // --------------------------------------------------------------------- //
  // Cycle de vie de la session                                             //
  // --------------------------------------------------------------------- //

  /// Restauration de session au démarrage : si des jetons existent en local,
  /// `GET /auth/me` valide la session (l'intercepteur rafraîchit l'access
  /// token expiré si besoin) et recharge le profil complet.
  ///
  /// Gestion des échecs (choix documenté) — on distingue un REJET D'IDENTITÉ
  /// d'une simple PANNE RÉSEAU pour ne pas déconnecter à tort un utilisateur
  /// valide :
  /// - 401 : l'intercepteur a déjà tenté le rafraîchissement, purgé les jetons
  ///   et basculé l'état (via [onSessionExpired]) ; on ne repurge pas ici ;
  /// - 403 « Compte suspendu » : idem, l'intercepteur a purgé et basculé ;
  /// - panne réseau (statusCode == null : serveur injoignable, timeout) : on ne
  ///   PURGE PAS les jetons — ils restent valides. On repasse simplement
  ///   `AuthSignedOut` (sans effacer le stockage) pour ne pas bloquer l'app :
  ///   les jetons conservés permettront une nouvelle tentative (relance de
  ///   l'app ou reconnexion) une fois le réseau rétabli ;
  /// - autres erreurs serveur (5xx…) : même prudence, on ne purge pas.
  Future<void> _restaurerSession() async {
    final String? accessToken = await _jetons.readAccessToken();
    final String? refreshToken = await _jetons.readRefreshToken();
    if ((accessToken == null || accessToken.isEmpty) &&
        (refreshToken == null || refreshToken.isEmpty)) {
      state = const AuthSignedOut();
      return;
    }
    try {
      final reponse = await _api.get('/auth/me');
      state = AuthSignedIn(
        UserProfile.fromJson(reponse.data as Map<String, dynamic>),
      );
    } on ApiException {
      // 401 (rafraîchissement impossible) et 403 suspension sont déjà gérés par
      // l'intercepteur, qui a purgé les jetons et basculé l'état. Si l'état a
      // déjà changé, on ne le réécrase pas.
      if (state is! AuthUnknown) {
        return;
      }
      // Panne réseau (statusCode == null) ou erreur serveur : les jetons NE
      // SONT PAS un rejet d'identité, on les CONSERVE pour retenter plus tard.
      // On repasse déconnecté sans effacer le stockage.
      state = const AuthSignedOut();
    }
  }

  /// Connexion email + mot de passe. Lève une [ApiException] avec un message
  /// affichable en cas d'échec (« Identifiants invalides », etc.).
  Future<void> login({required String email, required String password}) async {
    final reponse = await _api.post(
      '/auth/login',
      data: {'email': email.trim(), 'password': password},
    );
    await _ouvrirSession(reponse.data as Map<String, dynamic>);
  }

  /// Inscription. Le backend normalise l'email et crée la collection
  /// d'enregistrements par défaut « Général ».
  Future<void> register({
    required String displayName,
    required String email,
    required String password,
  }) async {
    final reponse = await _api.post(
      '/auth/register',
      data: {
        'email': email.trim(),
        'password': password,
        'displayName': displayName.trim(),
      },
    );
    await _ouvrirSession(reponse.data as Map<String, dynamic>);
  }

  /// Déconnexion : appelle `POST /auth/logout` (stateless côté serveur — il
  /// ne révoque rien, limite documentée du backend) puis purge les jetons
  /// locaux. La purge locale a lieu même si l'appel réseau échoue.
  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } on ApiException {
      // Peu importe : la déconnexion effective est la purge locale.
    }
    await _jetons.clear();
    state = const AuthSignedOut();
  }

  /// Recharge le profil courant depuis `GET /auth/me` (tirer-pour-rafraîchir
  /// sur l'écran profil). Silencieux en cas d'échec réseau.
  Future<void> refreshProfile() async {
    if (state is! AuthSignedIn) {
      return;
    }
    try {
      final reponse = await _api.get('/auth/me');
      state = AuthSignedIn(
        UserProfile.fromJson(reponse.data as Map<String, dynamic>),
      );
    } on ApiException {
      // On conserve le profil déjà affiché.
    }
  }

  /// Remplace le profil en mémoire (après un PATCH /users/me/profile réussi).
  void setProfile(UserProfile profile) {
    if (state is AuthSignedIn) {
      state = AuthSignedIn(profile);
    }
  }

  /// Appelé par l'ApiClient quand la session prend fin sans que l'utilisateur
  /// l'ait demandé : soit le rafraîchissement a échoué (jetons expirés), soit
  /// le compte a été suspendu en cours de session ([suspendu] vrai). Les jetons
  /// ont déjà été purgés par l'ApiClient ; on bascule l'app en état déconnecté
  /// (le routeur redirige alors vers /login) avec, si pertinent, un message.
  void onSessionExpired({bool suspendu = false}) {
    state = AuthSignedOut(
      raison: suspendu
          ? 'Votre compte a été suspendu. Contactez le support pour en savoir plus.'
          : null,
    );
  }

  /// Enregistre les jetons puis publie le profil connecté — forme commune
  /// aux réponses de /auth/login et /auth/register :
  /// `{ user, accessToken, refreshToken }`.
  Future<void> _ouvrirSession(Map<String, dynamic> data) async {
    await _jetons.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
    state = AuthSignedIn(
      UserProfile.fromJson(data['user'] as Map<String, dynamic>),
    );
  }
}
