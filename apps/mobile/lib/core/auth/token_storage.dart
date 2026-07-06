import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Abstraction du stockage des jetons JWT (access + refresh).
///
/// Permet de substituer une implémentation en mémoire dans les tests
/// (aucun accès au trousseau natif ni au réseau).
abstract interface class TokenStorage {
  Future<String?> readAccessToken();

  Future<String?> readRefreshToken();

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  });

  /// Purge locale des jetons (déconnexion, session expirée).
  Future<void> clear();
}

/// Stockage des jetons via `flutter_secure_storage` :
/// - Android : Android Keystore (clés chiffrées au niveau matériel quand
///   disponible) ;
/// - iOS/macOS : Keychain.
///
/// TODO(web) : sur le web, `flutter_secure_storage` retombe sur le
/// `localStorage` du navigateur, qui n'est PAS un stockage sécurisé
/// (lisible par tout script de la page — XSS). Acceptable pour le
/// développement uniquement ; avant une mise en production web, migrer vers
/// des cookies httpOnly posés par le backend ou une session côté serveur.
class SecureTokenStorage implements TokenStorage {
  static const String _cleAccessToken = 'endirek_access_token';
  static const String _cleRefreshToken = 'endirek_refresh_token';

  static const FlutterSecureStorage _stockage = FlutterSecureStorage();

  @override
  Future<String?> readAccessToken() => _lire(_cleAccessToken);

  @override
  Future<String?> readRefreshToken() => _lire(_cleRefreshToken);

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _stockage.write(key: _cleAccessToken, value: accessToken);
    await _stockage.write(key: _cleRefreshToken, value: refreshToken);
  }

  @override
  Future<void> clear() async {
    await _stockage.delete(key: _cleAccessToken);
    await _stockage.delete(key: _cleRefreshToken);
  }

  /// Une entrée illisible (trousseau corrompu, migration d'OS…) est traitée
  /// comme absente : l'utilisateur devra simplement se reconnecter.
  Future<String?> _lire(String cle) async {
    try {
      return await _stockage.read(key: cle);
    } catch (_) {
      return null;
    }
  }
}

/// Implémentation en mémoire, destinée aux tests (widget tests) et aux
/// environnements sans plugin natif. Rien n'est persisté.
class InMemoryTokenStorage implements TokenStorage {
  String? _accessToken;
  String? _refreshToken;

  @override
  Future<String?> readAccessToken() async => _accessToken;

  @override
  Future<String?> readRefreshToken() async => _refreshToken;

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  @override
  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
  }
}
