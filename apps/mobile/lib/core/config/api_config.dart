import 'package:flutter/foundation.dart';

/// Configuration d'accès à l'API Endirek (NestJS, port 3001).
///
/// L'URL de base peut être forcée à la compilation :
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.20:3001
///
/// Sans `--dart-define`, un défaut « intelligent » est appliqué :
/// - Web            → http://localhost:3001 (le navigateur tourne sur la
///   machine de dev, comme l'API) ;
/// - Émulateur Android → http://10.0.2.2:3001 (alias spécial de l'émulateur
///   vers le localhost de la machine hôte — `localhost` désignerait
///   l'émulateur lui-même) ;
/// - Autres plateformes (simulateur iOS, desktop) → http://localhost:3001.
///
/// Pour un appareil PHYSIQUE, utilisez `--dart-define` avec l'adresse IP
/// locale de la machine qui héberge l'API.
abstract final class ApiConfig {
  /// Valeur injectée à la compilation via `--dart-define=API_BASE_URL=...`.
  static const String _fromEnvironment = String.fromEnvironment('API_BASE_URL');

  /// URL de base du serveur (sans le préfixe d'API).
  static String get baseUrl {
    if (_fromEnvironment.isNotEmpty) {
      return _fromEnvironment;
    }
    if (kIsWeb) {
      return 'http://localhost:3001';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3001';
    }
    return 'http://localhost:3001';
  }

  /// URL de base des endpoints REST (préfixe global `api/v1` du backend).
  static String get apiBaseUrl => '$baseUrl/api/v1';

  /// Origines « localhost » que l'API peut renvoyer dans les URLs de médias
  /// (API_PUBLIC_URL par défaut = http://localhost:3001).
  static const List<String> _originesLocales = [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];

  /// Réécrit l'origine d'une URL de média quand elle pointe vers le
  /// localhost de la machine de dev alors que l'app y accède par une autre
  /// adresse (émulateur Android → 10.0.2.2, appareil physique → IP locale).
  ///
  /// Sans cette réécriture, les images uploadées (servies sur /uploads/ par
  /// l'API avec son URL publique par défaut http://localhost:3001) seraient
  /// injoignables depuis l'émulateur. Les URLs externes (seed picsum...)
  /// sont laissées telles quelles.
  static String resolveMediaUrl(String url) {
    for (final String origine in _originesLocales) {
      if (url.startsWith(origine) && baseUrl != origine) {
        return baseUrl + url.substring(origine.length);
      }
    }
    return url;
  }
}
