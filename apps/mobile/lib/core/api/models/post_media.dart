/// Forme MEDIA du contrat d'API étape 4 :
/// `{ url, thumbnailUrl, width, height, mediaType ('image'), position }`.
///
/// Sert à la fois en LECTURE (médias d'un FEED_POST) et en ÉCRITURE
/// (tableau `media` de POST /posts, construit depuis les réponses de
/// POST /media/upload).
class PostMedia {
  const PostMedia({
    required this.url,
    required this.thumbnailUrl,
    required this.width,
    required this.height,
    required this.mediaType,
    required this.position,
  });

  final String url;
  final String? thumbnailUrl;
  final int? width;
  final int? height;

  /// 'image' uniquement au Lot 1 (vidéos : lot ultérieur).
  final String mediaType;

  final int position;

  factory PostMedia.fromJson(Map<String, dynamic> json) {
    return PostMedia(
      url: json['url'] as String,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      width: (json['width'] as num?)?.toInt(),
      height: (json['height'] as num?)?.toInt(),
      mediaType: (json['mediaType'] as String?) ?? 'image',
      position: (json['position'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'thumbnailUrl': ?thumbnailUrl,
      'width': ?width,
      'height': ?height,
      'mediaType': mediaType,
      'position': position,
    };
  }

  /// Copie avec une nouvelle position (ré-ordonnancement dans le composer).
  PostMedia avecPosition(int nouvellePosition) {
    return PostMedia(
      url: url,
      thumbnailUrl: thumbnailUrl,
      width: width,
      height: height,
      mediaType: mediaType,
      position: nouvellePosition,
    );
  }
}
