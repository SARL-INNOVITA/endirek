/// Forme MESSAGE du contrat CP2.3 (liste d'un fil, envoi, event temps réel
/// 'message.created'). `estDeMoi` se calcule à l'affichage en comparant
/// `senderId` à l'utilisateur courant.
class MessageChat {
  const MessageChat({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String body;
  final DateTime createdAt;

  factory MessageChat.fromJson(Map<String, dynamic> json) {
    return MessageChat(
      id: json['id'] as String,
      conversationId: (json['conversationId'] as String?) ?? '',
      senderId: (json['senderId'] as String?) ?? '',
      body: (json['body'] as String?) ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
