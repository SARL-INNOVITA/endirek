import '../../../core/api/models/post_author.dart';

/// Modèles du contrat deals (CP2.4 — D64). Les badges d'éléments, l'étape du
/// stepper et la note globale d'un avis sont calculés PAR LE SERVEUR : le
/// mobile les affiche tels quels (chaînes libres, repli sûr sur l'inconnu).

/// Référence légère de l'annonce d'un deal.
class DealListingRef {
  const DealListingRef({
    required this.id,
    required this.title,
    required this.urlSlug,
    required this.status,
  });

  final String id;
  final String title;
  final String urlSlug;
  final String status;

  bool get estActive => status == 'active';

  factory DealListingRef.fromJson(Map<String, dynamic> json) {
    return DealListingRef(
      id: json['id'] as String,
      title: (json['title'] as String?) ?? '',
      urlSlug: (json['urlSlug'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'active',
    );
  }
}

/// Sous-élément validable d'un élément de deal.
class DealStep {
  const DealStep({
    required this.id,
    required this.label,
    required this.position,
    required this.honoredAt,
    required this.validatedAt,
  });

  final String id;
  final String label;
  final int position;
  final DateTime? honoredAt;
  final DateTime? validatedAt;

  bool get honore => honoredAt != null;
  bool get valide => validatedAt != null;

  factory DealStep.fromJson(Map<String, dynamic> json) {
    return DealStep(
      id: json['id'] as String,
      label: (json['label'] as String?) ?? '',
      position: (json['position'] as num?)?.toInt() ?? 0,
      honoredAt: json['honoredAt'] == null
          ? null
          : DateTime.parse(json['honoredAt'] as String),
      validatedAt: json['validatedAt'] == null
          ? null
          : DateTime.parse(json['validatedAt'] as String),
    );
  }
}

/// Élément d'un deal (« Ce que j'offre » / « Ce que mon deal-partner offre »).
class DealItem {
  const DealItem({
    required this.id,
    required this.providerId,
    required this.kind,
    required this.title,
    required this.description,
    required this.value,
    required this.badge,
    required this.steps,
  });

  final String id;
  final String providerId;

  /// 'service' | 'good' | 'money'.
  final String kind;
  final String title;
  final String description;
  final int value;

  /// Badge dérivé serveur : to_provide | partial | awaiting_validation |
  /// honored.
  final String badge;
  final List<DealStep> steps;

  factory DealItem.fromJson(Map<String, dynamic> json) {
    return DealItem(
      id: json['id'] as String,
      providerId: (json['providerId'] as String?) ?? '',
      kind: (json['kind'] as String?) ?? 'service',
      title: (json['title'] as String?) ?? '',
      description: (json['description'] as String?) ?? '',
      value: (json['value'] as num?)?.toInt() ?? 0,
      badge: (json['badge'] as String?) ?? 'to_provide',
      steps: ((json['steps'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DealStep.fromJson)
          .toList(),
    );
  }
}

/// Ajustement proposé en cours de deal.
class DealAdjustment {
  const DealAdjustment({
    required this.id,
    required this.proposedBy,
    required this.kind,
    required this.description,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String proposedBy;

  /// 'add' | 'modify' | 'remove'.
  final String kind;
  final String description;

  /// 'pending' | 'accepted' | 'rejected'.
  final String status;
  final DateTime createdAt;

  bool get enAttente => status == 'pending';

  factory DealAdjustment.fromJson(Map<String, dynamic> json) {
    return DealAdjustment(
      id: json['id'] as String,
      proposedBy: (json['proposedBy'] as String?) ?? '',
      kind: (json['kind'] as String?) ?? 'add',
      description: (json['description'] as String?) ?? '',
      status: (json['status'] as String?) ?? 'pending',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Note de la timeline « Suivi du deal ».
class DealNote {
  const DealNote({
    required this.id,
    required this.author,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final PostAuthor author;
  final String body;
  final DateTime createdAt;

  factory DealNote.fromJson(Map<String, dynamic> json) {
    return DealNote(
      id: json['id'] as String,
      author: PostAuthor.fromJson(json['author'] as Map<String, dynamic>),
      body: (json['body'] as String?) ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Avis détaillé (3 critères + note globale calculée serveur).
class DealReview {
  const DealReview({
    required this.id,
    required this.reviewer,
    required this.revieweeId,
    required this.ratingHonesty,
    required this.ratingConformity,
    required this.ratingKindness,
    required this.overall,
    required this.comment,
    required this.createdAt,
  });

  final String id;
  final PostAuthor reviewer;
  final String revieweeId;
  final int ratingHonesty;
  final int ratingConformity;
  final int ratingKindness;
  final double overall;
  final String? comment;
  final DateTime createdAt;

  factory DealReview.fromJson(Map<String, dynamic> json) {
    return DealReview(
      id: json['id'] as String,
      reviewer: PostAuthor.fromJson(json['reviewer'] as Map<String, dynamic>),
      revieweeId: (json['revieweeId'] as String?) ?? '',
      ratingHonesty: (json['ratingHonesty'] as num?)?.toInt() ?? 0,
      ratingConformity: (json['ratingConformity'] as num?)?.toInt() ?? 0,
      ratingKindness: (json['ratingKindness'] as num?)?.toInt() ?? 0,
      overall: (json['overall'] as num?)?.toDouble() ?? 0,
      comment: json['comment'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Carte de la liste « Mes deals » (et bandeau de conversation).
class DealCard {
  const DealCard({
    required this.id,
    required this.dealNumber,
    required this.status,
    required this.stage,
    required this.otherParticipant,
    required this.listing,
    required this.myOfferSummary,
    required this.theirOfferSummary,
    required this.updatedAt,
  });

  final String id;
  final int dealNumber;
  final String status;
  final String stage;
  final PostAuthor otherParticipant;
  final DealListingRef listing;
  final String myOfferSummary;
  final String theirOfferSummary;
  final DateTime updatedAt;

  factory DealCard.fromJson(Map<String, dynamic> json) {
    return DealCard(
      id: json['id'] as String,
      dealNumber: (json['dealNumber'] as num?)?.toInt() ?? 0,
      status: (json['status'] as String?) ?? 'proposed',
      stage: (json['stage'] as String?) ?? 'discussion',
      otherParticipant: PostAuthor.fromJson(
        json['otherParticipant'] as Map<String, dynamic>,
      ),
      listing: DealListingRef.fromJson(
        json['listing'] as Map<String, dynamic>,
      ),
      myOfferSummary: (json['myOfferSummary'] as String?) ?? '—',
      theirOfferSummary: (json['theirOfferSummary'] as String?) ?? '—',
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}

/// Page de deal complète (mockup 07).
class Deal {
  const Deal({
    required this.id,
    required this.dealNumber,
    required this.status,
    required this.stage,
    required this.listing,
    required this.conversationId,
    required this.proposerId,
    required this.recipientId,
    required this.otherParticipant,
    required this.dueDate,
    required this.cancellationRequestedBy,
    required this.disputedBy,
    required this.disputeReason,
    required this.items,
    required this.adjustments,
    required this.notes,
    required this.reviews,
    required this.myReviewSubmitted,
    required this.createdAt,
  });

  final String id;
  final int dealNumber;

  /// proposed | active | completed | declined | cancelled | disputed.
  final String status;

  /// discussion | agreement | in_progress | validations | concluded | closed.
  final String stage;
  final DealListingRef listing;
  final String? conversationId;
  final String proposerId;
  final String recipientId;
  final PostAuthor otherParticipant;
  final DateTime? dueDate;
  final String? cancellationRequestedBy;
  final String? disputedBy;
  final String? disputeReason;
  final List<DealItem> items;
  final List<DealAdjustment> adjustments;
  final List<DealNote> notes;
  final List<DealReview> reviews;
  final bool myReviewSubmitted;
  final DateTime createdAt;

  factory Deal.fromJson(Map<String, dynamic> json) {
    return Deal(
      id: json['id'] as String,
      dealNumber: (json['dealNumber'] as num?)?.toInt() ?? 0,
      status: (json['status'] as String?) ?? 'proposed',
      stage: (json['stage'] as String?) ?? 'discussion',
      listing: DealListingRef.fromJson(
        json['listing'] as Map<String, dynamic>,
      ),
      conversationId: json['conversationId'] as String?,
      proposerId: (json['proposerId'] as String?) ?? '',
      recipientId: (json['recipientId'] as String?) ?? '',
      otherParticipant: PostAuthor.fromJson(
        json['otherParticipant'] as Map<String, dynamic>,
      ),
      dueDate: json['dueDate'] == null
          ? null
          : DateTime.parse(json['dueDate'] as String),
      cancellationRequestedBy: json['cancellationRequestedBy'] as String?,
      disputedBy: json['disputedBy'] as String?,
      disputeReason: json['disputeReason'] as String?,
      items: ((json['items'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DealItem.fromJson)
          .toList(),
      adjustments: ((json['adjustments'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DealAdjustment.fromJson)
          .toList(),
      notes: ((json['notes'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DealNote.fromJson)
          .toList(),
      reviews: ((json['reviews'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DealReview.fromJson)
          .toList(),
      myReviewSubmitted: (json['myReviewSubmitted'] as bool?) ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Stats Dealplace d'un profil (mockup 05 — active les placeholders CP2.2).
class DealProfile {
  const DealProfile({
    required this.dealsCompleted,
    required this.reviewsCount,
    required this.avgHonesty,
    required this.avgConformity,
    required this.avgKindness,
    required this.overall,
    required this.latestReviews,
    required this.concludedDeals,
  });

  final int dealsCompleted;
  final int reviewsCount;
  final double? avgHonesty;
  final double? avgConformity;
  final double? avgKindness;
  final double? overall;
  final List<DealReview> latestReviews;
  final List<ConcludedDealRef> concludedDeals;

  factory DealProfile.fromJson(Map<String, dynamic> json) {
    final reviews = (json['reviews'] as Map?)?.cast<String, dynamic>() ?? {};
    return DealProfile(
      dealsCompleted: (json['dealsCompleted'] as num?)?.toInt() ?? 0,
      reviewsCount: (reviews['count'] as num?)?.toInt() ?? 0,
      avgHonesty: (reviews['avgHonesty'] as num?)?.toDouble(),
      avgConformity: (reviews['avgConformity'] as num?)?.toDouble(),
      avgKindness: (reviews['avgKindness'] as num?)?.toDouble(),
      overall: (reviews['overall'] as num?)?.toDouble(),
      latestReviews: ((reviews['latest'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DealReview.fromJson)
          .toList(),
      concludedDeals: ((json['concludedDeals'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ConcludedDealRef.fromJson)
          .toList(),
    );
  }
}

/// Résumé d'un deal conclu du profil (« J'ai offert ⇄ En échange de »).
class ConcludedDealRef {
  const ConcludedDealRef({
    required this.dealNumber,
    required this.offeredByUser,
    required this.receivedByUser,
    required this.completedAt,
  });

  final int dealNumber;
  final String offeredByUser;
  final String receivedByUser;
  final DateTime? completedAt;

  factory ConcludedDealRef.fromJson(Map<String, dynamic> json) {
    return ConcludedDealRef(
      dealNumber: (json['dealNumber'] as num?)?.toInt() ?? 0,
      offeredByUser: (json['offeredByUser'] as String?) ?? '—',
      receivedByUser: (json['receivedByUser'] as String?) ?? '—',
      completedAt: json['completedAt'] == null
          ? null
          : DateTime.parse(json['completedAt'] as String),
    );
  }
}
