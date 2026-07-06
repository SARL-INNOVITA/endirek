import 'package:dio/dio.dart';

/// Erreur d'API prête à être AFFICHÉE : `message` est toujours une phrase en
/// français, sans détail technique, utilisable telle quelle dans l'UI.
///
/// Le backend NestJS renvoie ses erreurs métier au format
/// `{ statusCode, message, error }` avec des messages déjà rédigés en
/// français (ex. « Identifiants invalides ») : quand ce champ est présent,
/// il est repris tel quel ; sinon un message générique par famille d'erreur
/// est utilisé.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  /// Message en français, affichable directement à l'utilisateur.
  final String message;

  /// Code HTTP de la réponse, s'il y en a une (null pour une panne réseau).
  final int? statusCode;

  /// Convertit une erreur Dio en [ApiException] affichable.
  factory ApiException.fromDioException(DioException erreur) {
    switch (erreur.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const ApiException(
          'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
        );
      case DioExceptionType.connectionError:
        return const ApiException(
          'Impossible de joindre le serveur. Vérifiez votre connexion internet.',
        );
      case DioExceptionType.badCertificate:
        return const ApiException(
          'La connexion au serveur n\'est pas sécurisée.',
        );
      case DioExceptionType.cancel:
        return const ApiException('La requête a été annulée.');
      case DioExceptionType.badResponse:
      case DioExceptionType.unknown:
        final Response<dynamic>? reponse = erreur.response;
        if (reponse == null) {
          return const ApiException(
            'Impossible de joindre le serveur. Vérifiez votre connexion internet.',
          );
        }
        return ApiException(
          _messageDepuisReponse(reponse) ?? _messageParStatut(reponse.statusCode),
          statusCode: reponse.statusCode,
        );
    }
  }

  /// Extrait le champ `message` du corps d'erreur NestJS quand il existe.
  /// Il peut être une chaîne (erreur métier) ou une liste de chaînes
  /// (erreurs de validation `class-validator`).
  static String? _messageDepuisReponse(Response<dynamic> reponse) {
    final dynamic data = reponse.data;
    if (data is! Map) {
      return null;
    }
    final dynamic message = data['message'];
    if (message is String && message.trim().isNotEmpty) {
      return message;
    }
    if (message is List && message.isNotEmpty) {
      return message.whereType<String>().join('\n');
    }
    return null;
  }

  /// Message générique par famille de statut HTTP (repli quand le corps
  /// d'erreur ne fournit pas de message exploitable).
  static String _messageParStatut(int? statut) {
    return switch (statut ?? 0) {
      400 => 'Les informations envoyées sont invalides.',
      401 => 'Vous devez vous reconnecter.',
      403 => 'Vous n\'avez pas les droits nécessaires pour cette action.',
      404 => 'La ressource demandée est introuvable.',
      409 => 'Cette action entre en conflit avec des données existantes.',
      >= 500 => 'Une erreur est survenue côté serveur. Réessayez plus tard.',
      _ => 'Une erreur inattendue est survenue. Réessayez plus tard.',
    };
  }

  @override
  String toString() => message;
}
