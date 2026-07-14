import '../../../core/api/models/geo_point.dart';
import '../../../core/api/models/post_author.dart';

/// Modèles des PAGES restaurants & entreprises (Lot 3) — formes exactes du
/// contrat d'API (PAGE_CARD, OwnerPageCard, PAGE, DISH, MENU_DAY, OFFER,
/// EVENT), écrits à la main comme le reste du code mobile.

/// Statut d'ouverture DÉRIVÉ côté serveur (horaires + congés) :
/// `{ state: 'open'|'closed'|'vacation', vacationUntil, vacationMessage }`.
class PageOpenStatus {
  const PageOpenStatus({
    required this.state,
    required this.vacationUntil,
    required this.vacationMessage,
  });

  /// 'open' | 'closed' | 'vacation'.
  final String state;

  /// Fin des congés (non nulle quand [state] == 'vacation').
  final DateTime? vacationUntil;

  /// Message de congés facultatif (« Réouverture le 15 août ! »...).
  final String? vacationMessage;

  bool get estOuverte => state == 'open';
  bool get enConges => state == 'vacation';

  factory PageOpenStatus.fromJson(Map<String, dynamic> json) {
    return PageOpenStatus(
      state: (json['state'] as String?) ?? 'closed',
      vacationUntil: json['vacationUntil'] == null
          ? null
          : DateTime.parse(json['vacationUntil'] as String),
      vacationMessage: json['vacationMessage'] as String?,
    );
  }
}

/// Une plage horaire d'ouverture :
/// `{ weekday: 0..6 (0 = lundi), opensAt: 'HH:MM', closesAt: 'HH:MM' }`.
class PageHourView {
  const PageHourView({
    required this.weekday,
    required this.opensAt,
    required this.closesAt,
  });

  /// 0 = lundi … 6 = dimanche.
  final int weekday;

  /// 'HH:MM' (heure locale Réunion).
  final String opensAt;
  final String closesAt;

  factory PageHourView.fromJson(Map<String, dynamic> json) {
    return PageHourView(
      weekday: (json['weekday'] as num?)?.toInt() ?? 0,
      opensAt: (json['opensAt'] as String?) ?? '',
      closesAt: (json['closesAt'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {'weekday': weekday, 'opensAt': opensAt, 'closesAt': closesAt};
  }
}

/// Un document de la section « Nos cartes » (PDF) :
/// `{ id, label, url, fileSizeBytes, position, createdAt }`.
class PageDocumentView {
  const PageDocumentView({
    required this.id,
    required this.label,
    required this.url,
    required this.fileSizeBytes,
    required this.position,
    required this.createdAt,
  });

  final String id;
  final String label;
  final String url;
  final int fileSizeBytes;
  final int position;
  final DateTime createdAt;

  factory PageDocumentView.fromJson(Map<String, dynamic> json) {
    return PageDocumentView(
      id: json['id'] as String,
      label: (json['label'] as String?) ?? '',
      url: (json['url'] as String?) ?? '',
      fileSizeBytes: (json['fileSizeBytes'] as num?)?.toInt() ?? 0,
      position: (json['position'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Forme PAGE_CARD du contrat — carte légère d'une page dans les listes
/// (pages d'un profil public).
class PageCard {
  const PageCard({
    required this.id,
    required this.pageType,
    required this.name,
    required this.urlSlug,
    required this.avatarUrl,
    required this.city,
    required this.verified,
    required this.followersCount,
    required this.openStatus,
    required this.createdAt,
  });

  final String id;

  /// 'restaurant' | 'business'.
  final String pageType;

  final String name;
  final String urlSlug;
  final String? avatarUrl;
  final String city;
  final bool verified;
  final int followersCount;
  final PageOpenStatus openStatus;
  final DateTime createdAt;

  bool get estRestaurant => pageType == 'restaurant';

  /// Libellé français du type (« Restaurant » / « Entreprise »).
  String get libelleType => estRestaurant ? 'Restaurant' : 'Entreprise';

  factory PageCard.fromJson(Map<String, dynamic> json) {
    return PageCard(
      id: json['id'] as String,
      pageType: (json['pageType'] as String?) ?? 'business',
      name: (json['name'] as String?) ?? '',
      urlSlug: (json['urlSlug'] as String?) ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      city: (json['city'] as String?) ?? '',
      verified: (json['verified'] as bool?) ?? false,
      followersCount: (json['followersCount'] as num?)?.toInt() ?? 0,
      openStatus: PageOpenStatus.fromJson(
        (json['openStatus'] as Map<String, dynamic>?) ?? const {},
      ),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  /// Initiales du nom de la page (repli visuel sans avatar).
  String get initiales => initialesDeNom(name);
}

/// Forme OwnerPageCard — PAGE_CARD + `status` ('active' | 'hidden'), servie
/// par GET /users/me/pages (section « Mes pages » du profil).
class OwnerPageCard {
  const OwnerPageCard({required this.carte, required this.status});

  final PageCard carte;

  /// 'active' | 'hidden' — 'hidden' = masquée par la modération.
  final String status;

  bool get estMasquee => status == 'hidden';

  factory OwnerPageCard.fromJson(Map<String, dynamic> json) {
    return OwnerPageCard(
      carte: PageCard.fromJson(json),
      status: (json['status'] as String?) ?? 'active',
    );
  }
}

/// Forme PAGE complète du contrat — écran public et gestion.
class PageDetail {
  const PageDetail({
    required this.id,
    required this.pageType,
    required this.name,
    required this.urlSlug,
    required this.avatarUrl,
    required this.coverUrl,
    required this.city,
    required this.bio,
    required this.phone,
    required this.attributes,
    required this.location,
    required this.verified,
    required this.followersCount,
    required this.openStatus,
    required this.hours,
    required this.documents,
    required this.owner,
    required this.postsCount,
    required this.status,
    required this.isOwner,
    required this.myFollow,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;

  /// 'restaurant' | 'business'.
  final String pageType;

  final String name;
  final String urlSlug;
  final String? avatarUrl;
  final String? coverUrl;
  final String city;
  final String bio;
  final String? phone;
  final List<String> attributes;
  final GeoPoint? location;
  final bool verified;
  final int followersCount;
  final PageOpenStatus openStatus;
  final List<PageHourView> hours;
  final List<PageDocumentView> documents;
  final PostAuthor owner;
  final int postsCount;

  /// 'active' | 'hidden'.
  final String status;

  /// Le viewer est-il le propriétaire de la page ?
  final bool isOwner;

  /// Le viewer suit-il déjà la page ?
  final bool myFollow;

  final DateTime createdAt;
  final DateTime updatedAt;

  bool get estRestaurant => pageType == 'restaurant';
  String get libelleType => estRestaurant ? 'Restaurant' : 'Entreprise';
  String get initiales => initialesDeNom(name);

  factory PageDetail.fromJson(Map<String, dynamic> json) {
    return PageDetail(
      id: json['id'] as String,
      pageType: (json['pageType'] as String?) ?? 'business',
      name: (json['name'] as String?) ?? '',
      urlSlug: (json['urlSlug'] as String?) ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      coverUrl: json['coverUrl'] as String?,
      city: (json['city'] as String?) ?? '',
      bio: (json['bio'] as String?) ?? '',
      phone: json['phone'] as String?,
      attributes: ((json['attributes'] as List?) ?? const [])
          .whereType<String>()
          .toList(),
      location: json['location'] == null
          ? null
          : GeoPoint.fromJson(json['location'] as Map<String, dynamic>),
      verified: (json['verified'] as bool?) ?? false,
      followersCount: (json['followersCount'] as num?)?.toInt() ?? 0,
      openStatus: PageOpenStatus.fromJson(
        (json['openStatus'] as Map<String, dynamic>?) ?? const {},
      ),
      hours: ((json['hours'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PageHourView.fromJson)
          .toList(),
      documents: ((json['documents'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PageDocumentView.fromJson)
          .toList(),
      owner: PostAuthor.fromJson(json['owner'] as Map<String, dynamic>),
      postsCount: (json['postsCount'] as num?)?.toInt() ?? 0,
      status: (json['status'] as String?) ?? 'active',
      isOwner: (json['isOwner'] as bool?) ?? false,
      myFollow: (json['myFollow'] as bool?) ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}

/// Forme DISH du contrat — plat d'un restaurant. Les prix sont en CENTIMES
/// (1250 = 12,50 €), chacun nullable (un seul prix renseigné est légal).
class Dish {
  const Dish({
    required this.id,
    required this.name,
    required this.description,
    required this.imageUrl,
    required this.priceTakeawayCents,
    required this.priceDineInCents,
    required this.position,
  });

  final String id;
  final String name;
  final String description;
  final String? imageUrl;

  /// Prix « à emporter » en centimes, ou null si non proposé.
  final int? priceTakeawayCents;

  /// Prix « sur place » en centimes, ou null si non proposé.
  final int? priceDineInCents;

  final int position;

  factory Dish.fromJson(Map<String, dynamic> json) {
    return Dish(
      id: json['id'] as String,
      name: (json['name'] as String?) ?? '',
      description: (json['description'] as String?) ?? '',
      imageUrl: json['imageUrl'] as String?,
      priceTakeawayCents: (json['priceTakeawayCents'] as num?)?.toInt(),
      priceDineInCents: (json['priceDineInCents'] as num?)?.toInt(),
      position: (json['position'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Forme MENU_DAY du contrat — menu d'UN jour : `{ date: 'YYYY-MM-DD',
/// items: DISH[] }` (items vide = pas de menu ce jour-là).
class MenuDay {
  const MenuDay({required this.date, required this.items});

  /// 'YYYY-MM-DD' (jour local Réunion).
  final String date;

  final List<Dish> items;

  bool get estVide => items.isEmpty;

  /// Date parsée (minuit local) — pour dériver les libellés « Lun 14 ».
  DateTime get dateLocale => DateTime.parse(date);

  factory MenuDay.fromJson(Map<String, dynamic> json) {
    return MenuDay(
      date: (json['date'] as String?) ?? '',
      items: ((json['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(Dish.fromJson)
          .toList(),
    );
  }
}

/// Forme OFFER du contrat — offre d'une page, période optionnelle.
class PageOffer {
  const PageOffer({
    required this.id,
    required this.title,
    required this.description,
    required this.imageUrl,
    required this.startsAt,
    required this.endsAt,
    required this.isCurrent,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String description;
  final String? imageUrl;
  final DateTime? startsAt;
  final DateTime? endsAt;

  /// L'offre est-elle en cours (période) — calculé côté serveur.
  final bool isCurrent;

  final DateTime createdAt;

  factory PageOffer.fromJson(Map<String, dynamic> json) {
    return PageOffer(
      id: json['id'] as String,
      title: (json['title'] as String?) ?? '',
      description: (json['description'] as String?) ?? '',
      imageUrl: json['imageUrl'] as String?,
      startsAt: json['startsAt'] == null
          ? null
          : DateTime.parse(json['startsAt'] as String),
      endsAt: json['endsAt'] == null
          ? null
          : DateTime.parse(json['endsAt'] as String),
      isCurrent: (json['isCurrent'] as bool?) ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Forme EVENT du contrat — événement d'une page, `startsAt` obligatoire.
class PageEvent {
  const PageEvent({
    required this.id,
    required this.title,
    required this.description,
    required this.imageUrl,
    required this.startsAt,
    required this.endsAt,
    required this.timing,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String description;
  final String? imageUrl;
  final DateTime startsAt;
  final DateTime? endsAt;

  /// 'upcoming' | 'ongoing' | 'past' — calculé côté serveur.
  final String timing;

  final DateTime createdAt;

  bool get enCours => timing == 'ongoing';
  bool get estPasse => timing == 'past';

  factory PageEvent.fromJson(Map<String, dynamic> json) {
    return PageEvent(
      id: json['id'] as String,
      title: (json['title'] as String?) ?? '',
      description: (json['description'] as String?) ?? '',
      imageUrl: json['imageUrl'] as String?,
      startsAt: DateTime.parse(json['startsAt'] as String),
      endsAt: json['endsAt'] == null
          ? null
          : DateTime.parse(json['endsAt'] as String),
      timing: (json['timing'] as String?) ?? 'upcoming',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Initiales d'un nom de page (repli visuel des avatars — même règle que
/// PostAuthor.initiales).
String initialesDeNom(String nom) {
  final List<String> mots =
      nom.trim().split(RegExp(r'\s+')).where((mot) => mot.isNotEmpty).toList();
  if (mots.isEmpty) {
    return '?';
  }
  final String premiere = mots.first[0].toUpperCase();
  if (mots.length == 1) {
    return premiere;
  }
  return premiere + mots.last[0].toUpperCase();
}
