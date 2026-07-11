import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/deals_repository.dart';
import '../domain/deal_models.dart';

/// Providers deals (CP2.4). `autoDispose` : rechargés à chaque (ré)ouverture
/// — un deal évolue à deux, l'état frais prime. La page de deal ouverte est
/// invalidée par le pont temps réel à chaque event `deal.updated`.

/// Page de deal complète.
final dealProvider =
    FutureProvider.autoDispose.family<Deal, String>((ref, dealId) {
  return ref.watch(dealsRepositoryProvider).chargerDeal(dealId);
});

/// Mes deals (liste).
final mesDealsProvider = FutureProvider.autoDispose<
    ({List<DealCard> items, int total})>((ref) {
  return ref.watch(dealsRepositoryProvider).chargerMesDeals();
});

/// Deal OUVERT d'une conversation (bandeau du fil) — null si aucun.
final dealDeConversationProvider = FutureProvider.autoDispose
    .family<DealCard?, String>((ref, conversationId) {
  return ref
      .watch(dealsRepositoryProvider)
      .chargerDealDeConversation(conversationId);
});

/// Stats Dealplace d'un profil (null = moi) — active les blocs du mockup 05.
final dealProfilProvider = FutureProvider.autoDispose
    .family<DealProfile, String?>((ref, userId) {
  return ref.watch(dealsRepositoryProvider).chargerProfilDeals(userId);
});
