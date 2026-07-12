/// Forme MESSAGE du contrat CP2.3 (liste d'un fil, envoi, event temps réel
/// 'message.created'). `estDeMoi` se calcule à l'affichage en comparant
/// `senderId` à l'utilisateur courant.
class MessageChat {
  const MessageChat({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.body,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String body;

  /// Statut de modération (CP2.5) : 'active' | 'hidden'. Pour un message
  /// 'hidden', le serveur remplace déjà le corps par le placeholder — le
  /// client style d'après ce statut, pas d'après le texte.
  final String status;
  final DateTime createdAt;

  /// Message masqué par la modération → placeholder en italique gris.
  bool get estMasque => status == 'hidden';

  factory MessageChat.fromJson(Map<String, dynamic> json) {
    return MessageChat(
      id: json['id'] as String,
      conversationId: (json['conversationId'] as String?) ?? '',
      senderId: (json['senderId'] as String?) ?? '',
      body: (json['body'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'active',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
