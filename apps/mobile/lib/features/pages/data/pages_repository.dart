import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/feed_post.dart';
import '../../../core/api/models/post_media.dart';
import '../../../core/auth/auth_controller.dart' show apiClientProvider;
import '../../feed/data/posts_repository.dart' show PostsPage;
import '../domain/page_models.dart';

/// Marqueur « champ absent » pour le PATCH partiel : seul un champ EXPLICITE
/// est transmis au serveur (les autres restent inchangés). PUBLIC pour que
/// les écrans puissent OMETTRE un champ non modifié — indispensable pour
/// avatar/couverture, dont la garde de provenance serveur (D16/D77) rejette
/// une URL hors upload Endirek renvoyée telle quelle (cas du seed picsum).
const Object champAbsent = Object();

/// Accès aux endpoints PAGES du contrat Lot 3 (pages restaurants &
/// entreprises : fiche, horaires, plats, menus, documents, offres,
/// événements, abonnement, publications, signalement).
final pagesRepositoryProvider = Provider<PagesRepository>((ref) {
  return PagesRepository(ref.watch(apiClientProvider));
});

class PagesRepository {
  const PagesRepository(this._api);

  final ApiClient _api;

  // ─────────────────────────────────────────────────────────────────────────
  // Fiche de page
  // ─────────────────────────────────────────────────────────────────────────

  /// Détail d'une page (GET /pages/:id) — 404 si invisible.
  Future<PageDetail> chargerPage(String id) async {
    final reponse = await _api.get('/pages/$id');
    return PageDetail.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// MES pages, avec leur statut (GET /users/me/pages).
  Future<List<OwnerPageCard>> chargerMesPages() async {
    final reponse = await _api.get('/users/me/pages');
    final data = reponse.data as Map<String, dynamic>;
    return ((data['items'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(OwnerPageCard.fromJson)
        .toList();
  }

  /// Crée une page (POST /pages → 201 PAGE).
  Future<PageDetail> creerPage({
    required String pageType,
    required String name,
    required String city,
    String? bio,
    String? phone,
    List<String> attributes = const [],
    String? avatarUrl,
    String? coverUrl,
  }) async {
    final reponse = await _api.post('/pages', data: {
      'pageType': pageType,
      'name': name,
      'city': city,
      'bio': ?bio,
      'phone': ?phone,
      if (attributes.isNotEmpty) 'attributes': attributes,
      'avatarUrl': ?avatarUrl,
      'coverUrl': ?coverUrl,
    });
    return PageDetail.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Modifie une page (PATCH /pages/:id — propriétaire). Seuls les champs
  /// EXPLICITEMENT fournis sont transmis ; les champs nullables du contrat
  /// (phone, vacationUntil, vacationMessage...) acceptent un null explicite
  /// pour EFFACER la valeur.
  Future<PageDetail> modifierPage(
    String id, {
    Object? name = champAbsent,
    Object? bio = champAbsent,
    Object? city = champAbsent,
    Object? phone = champAbsent,
    Object? attributes = champAbsent,
    Object? avatarUrl = champAbsent,
    Object? coverUrl = champAbsent,
    Object? vacationUntil = champAbsent,
    Object? vacationMessage = champAbsent,
  }) async {
    final Map<String, dynamic> donnees = {};
    if (!identical(name, champAbsent)) donnees['name'] = name;
    if (!identical(bio, champAbsent)) donnees['bio'] = bio;
    if (!identical(city, champAbsent)) donnees['city'] = city;
    if (!identical(phone, champAbsent)) donnees['phone'] = phone;
    if (!identical(attributes, champAbsent)) {
      donnees['attributes'] = attributes;
    }
    if (!identical(avatarUrl, champAbsent)) donnees['avatarUrl'] = avatarUrl;
    if (!identical(coverUrl, champAbsent)) donnees['coverUrl'] = coverUrl;
    if (!identical(vacationUntil, champAbsent)) {
      donnees['vacationUntil'] = vacationUntil;
    }
    if (!identical(vacationMessage, champAbsent)) {
      donnees['vacationMessage'] = vacationMessage;
    }
    final reponse = await _api.patch('/pages/$id', data: donnees);
    return PageDetail.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Remplace TOUTES les plages horaires (PUT /pages/:id/hours).
  Future<PageDetail> definirHoraires(
    String id,
    List<PageHourView> horaires,
  ) async {
    final reponse = await _api.put('/pages/$id/hours', data: {
      'hours': horaires.map((plage) => plage.toJson()).toList(),
    });
    return PageDetail.fromJson(reponse.data as Map<String, dynamic>);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Menus & plats (restaurants)
  // ─────────────────────────────────────────────────────────────────────────

  /// Menus de la semaine glissante (GET /pages/:id/menus — 7 jours à partir
  /// d'aujourd'hui, heure Réunion).
  Future<List<MenuDay>> chargerMenus(String id, {String? from}) async {
    final reponse = await _api.get('/pages/$id/menus', queryParameters: {
      'from': ?from,
    });
    final data = reponse.data as Map<String, dynamic>;
    return ((data['days'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(MenuDay.fromJson)
        .toList();
  }

  /// Remplace le menu d'UN jour (PUT /pages/:id/menus/:date — liste vide =
  /// suppression du menu du jour).
  Future<MenuDay> definirMenuDuJour(
    String id,
    String date,
    List<String> dishIds,
  ) async {
    final reponse = await _api.put('/pages/$id/menus/$date', data: {
      'dishIds': dishIds,
    });
    return MenuDay.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Plats de la page (GET /pages/:id/dishes — propriétaire/modérateur).
  Future<List<Dish>> chargerPlats(String id) async {
    final reponse = await _api.get('/pages/$id/dishes');
    final data = reponse.data as Map<String, dynamic>;
    return ((data['items'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(Dish.fromJson)
        .toList();
  }

  /// Crée un plat (POST /pages/:id/dishes → 201 DISH).
  Future<Dish> creerPlat(
    String id, {
    required String name,
    String? description,
    String? imageUrl,
    int? priceTakeawayCents,
    int? priceDineInCents,
  }) async {
    final reponse = await _api.post('/pages/$id/dishes', data: {
      'name': name,
      'description': ?description,
      'imageUrl': ?imageUrl,
      'priceTakeawayCents': ?priceTakeawayCents,
      'priceDineInCents': ?priceDineInCents,
    });
    return Dish.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Modifie un plat (PATCH /pages/:id/dishes/:dishId — champs nullables
  /// pour effacer image ou l'un des deux prix).
  Future<Dish> modifierPlat(
    String id,
    String dishId, {
    Object? name = champAbsent,
    Object? description = champAbsent,
    Object? imageUrl = champAbsent,
    Object? priceTakeawayCents = champAbsent,
    Object? priceDineInCents = champAbsent,
  }) async {
    final Map<String, dynamic> donnees = {};
    if (!identical(name, champAbsent)) donnees['name'] = name;
    if (!identical(description, champAbsent)) {
      donnees['description'] = description;
    }
    if (!identical(imageUrl, champAbsent)) donnees['imageUrl'] = imageUrl;
    if (!identical(priceTakeawayCents, champAbsent)) {
      donnees['priceTakeawayCents'] = priceTakeawayCents;
    }
    if (!identical(priceDineInCents, champAbsent)) {
      donnees['priceDineInCents'] = priceDineInCents;
    }
    final reponse = await _api.patch('/pages/$id/dishes/$dishId', data: donnees);
    return Dish.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Supprime un plat (DELETE → 204 — le retire aussi des menus).
  Future<void> supprimerPlat(String id, String dishId) async {
    await _api.delete('/pages/$id/dishes/$dishId');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Documents « Nos cartes »
  // ─────────────────────────────────────────────────────────────────────────

  /// Attache un document PDF déjà uploadé (POST /pages/:id/documents —
  /// ≤ 5 documents, url issue de POST /media/upload-document).
  Future<PageDetail> ajouterDocument(
    String id, {
    required String label,
    required String url,
    required int fileSizeBytes,
  }) async {
    final reponse = await _api.post('/pages/$id/documents', data: {
      'label': label,
      'url': url,
      'fileSizeBytes': fileSizeBytes,
    });
    return PageDetail.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Retire un document (DELETE /pages/:id/documents/:documentId → 204).
  Future<void> supprimerDocument(String id, String documentId) async {
    await _api.delete('/pages/$id/documents/$documentId');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Offres & événements
  // ─────────────────────────────────────────────────────────────────────────

  /// Offres de la page (GET /pages/:id/offers — public : non expirées ;
  /// [toutes] = true (propriétaire/modérateur) inclut tout l'actif).
  Future<List<PageOffer>> chargerOffres(String id, {bool toutes = false}) async {
    final reponse = await _api.get('/pages/$id/offers', queryParameters: {
      if (toutes) 'all': 'true',
    });
    final data = reponse.data as Map<String, dynamic>;
    return ((data['items'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(PageOffer.fromJson)
        .toList();
  }

  /// Crée une offre (POST /pages/:id/offers → 201 OFFER).
  Future<PageOffer> creerOffre(
    String id, {
    required String title,
    String? description,
    String? imageUrl,
    DateTime? startsAt,
    DateTime? endsAt,
  }) async {
    final reponse = await _api.post('/pages/$id/offers', data: {
      'title': title,
      'description': ?description,
      'imageUrl': ?imageUrl,
      'startsAt': ?startsAt?.toUtc().toIso8601String(),
      'endsAt': ?endsAt?.toUtc().toIso8601String(),
    });
    return PageOffer.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Modifie une offre (PATCH — champs nullables pour effacer la période).
  Future<PageOffer> modifierOffre(
    String id,
    String offerId, {
    Object? title = champAbsent,
    Object? description = champAbsent,
    Object? imageUrl = champAbsent,
    Object? startsAt = champAbsent,
    Object? endsAt = champAbsent,
  }) async {
    final Map<String, dynamic> donnees = {};
    if (!identical(title, champAbsent)) donnees['title'] = title;
    if (!identical(description, champAbsent)) {
      donnees['description'] = description;
    }
    if (!identical(imageUrl, champAbsent)) donnees['imageUrl'] = imageUrl;
    if (!identical(startsAt, champAbsent)) {
      donnees['startsAt'] =
          (startsAt as DateTime?)?.toUtc().toIso8601String();
    }
    if (!identical(endsAt, champAbsent)) {
      donnees['endsAt'] = (endsAt as DateTime?)?.toUtc().toIso8601String();
    }
    final reponse =
        await _api.patch('/pages/$id/offers/$offerId', data: donnees);
    return PageOffer.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Supprime une offre (DELETE → 204, soft).
  Future<void> supprimerOffre(String id, String offerId) async {
    await _api.delete('/pages/$id/offers/$offerId');
  }

  /// Événements de la page (GET /pages/:id/events — public : à venir/en
  /// cours triés par startsAt ; [tous] = true inclut les passés).
  Future<List<PageEvent>> chargerEvenements(
    String id, {
    bool tous = false,
  }) async {
    final reponse = await _api.get('/pages/$id/events', queryParameters: {
      if (tous) 'all': 'true',
    });
    final data = reponse.data as Map<String, dynamic>;
    return ((data['items'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(PageEvent.fromJson)
        .toList();
  }

  /// Crée un événement (POST /pages/:id/events — startsAt REQUIS).
  Future<PageEvent> creerEvenement(
    String id, {
    required String title,
    required DateTime startsAt,
    String? description,
    String? imageUrl,
    DateTime? endsAt,
  }) async {
    final reponse = await _api.post('/pages/$id/events', data: {
      'title': title,
      'startsAt': startsAt.toUtc().toIso8601String(),
      'description': ?description,
      'imageUrl': ?imageUrl,
      'endsAt': ?endsAt?.toUtc().toIso8601String(),
    });
    return PageEvent.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Modifie un événement (PATCH — endsAt nullable pour l'effacer).
  Future<PageEvent> modifierEvenement(
    String id,
    String eventId, {
    Object? title = champAbsent,
    Object? description = champAbsent,
    Object? imageUrl = champAbsent,
    Object? startsAt = champAbsent,
    Object? endsAt = champAbsent,
  }) async {
    final Map<String, dynamic> donnees = {};
    if (!identical(title, champAbsent)) donnees['title'] = title;
    if (!identical(description, champAbsent)) {
      donnees['description'] = description;
    }
    if (!identical(imageUrl, champAbsent)) donnees['imageUrl'] = imageUrl;
    if (!identical(startsAt, champAbsent)) {
      donnees['startsAt'] =
          (startsAt as DateTime?)?.toUtc().toIso8601String();
    }
    if (!identical(endsAt, champAbsent)) {
      donnees['endsAt'] = (endsAt as DateTime?)?.toUtc().toIso8601String();
    }
    final reponse =
        await _api.patch('/pages/$id/events/$eventId', data: donnees);
    return PageEvent.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Supprime un événement (DELETE → 204, soft).
  Future<void> supprimerEvenement(String id, String eventId) async {
    await _api.delete('/pages/$id/events/$eventId');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Abonnement, publications, signalement
  // ─────────────────────────────────────────────────────────────────────────

  /// S'abonne à la page (POST /pages/:id/follow → 204 — 400 sur sa propre
  /// page).
  Future<void> suivrePage(String id) async {
    await _api.post('/pages/$id/follow');
  }

  /// Se désabonne (DELETE /pages/:id/follow → 204, idempotent).
  Future<void> nePlusSuivrePage(String id) async {
    await _api.delete('/pages/$id/follow');
  }

  /// Publications de la page (GET /pages/:id/posts — FEED_POST paginés).
  Future<PostsPage> chargerPostsDePage(
    String id, {
    int limit = 20,
    int offset = 0,
  }) async {
    final reponse = await _api.get('/pages/$id/posts', queryParameters: {
      'limit': limit,
      'offset': offset,
    });
    final data = reponse.data as Map<String, dynamic>;
    return (
      items: ((data['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(FeedPost.fromJson)
          .toList(),
      total: (data['total'] as num?)?.toInt() ?? 0,
    );
  }

  /// Publie AU NOM de la page (POST /pages/:id/posts) :
  /// - kind 'free'  : [body] requis (1..2000), [title]/[media] optionnels ;
  /// - kind 'menu'  : auto-composé — 400 « Aucun menu programmé pour
  ///   aujourd'hui » si le menu du jour est vide ;
  /// - kind 'offer' : [offerId] requis (offre non expirée) ;
  /// - kind 'event' : [eventId] requis (événement non passé) ;
  /// - [body] optionnel sur menu/offer/event = intro ajoutée en tête.
  Future<FeedPost> publierPostDePage(
    String id, {
    required String kind,
    String? title,
    String? body,
    List<PostMedia> media = const [],
    String? offerId,
    String? eventId,
  }) async {
    final reponse = await _api.post('/pages/$id/posts', data: {
      'kind': kind,
      'title': ?title,
      'body': ?body,
      if (media.isNotEmpty)
        'media': media.map((element) => element.toJson()).toList(),
      'offerId': ?offerId,
      'eventId': ?eventId,
    });
    return FeedPost.fromJson(reponse.data as Map<String, dynamic>);
  }

  /// Signale une page (POST /pages/:id/report → 201 { id, status }) — même
  /// contrat que les posts/annonces : 400 sur sa propre page, 409 doublon.
  Future<void> signalerPage(
    String id, {
    required String reasonCode,
    String? message,
  }) async {
    await _api.post('/pages/$id/report', data: {
      'reasonCode': reasonCode,
      'message': ?message,
    });
  }
}
