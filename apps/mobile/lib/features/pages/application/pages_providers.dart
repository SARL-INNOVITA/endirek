import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../feed/data/posts_repository.dart' show PostsPage;
import '../data/pages_repository.dart';
import '../domain/page_models.dart';

/// Providers de la feature PAGES (Lot 3) — données éphémères rechargées à
/// chaque ouverture d'écran : FutureProvider.autoDispose(.family), comme
/// listingDetailProvider. Retry après erreur : `ref.invalidate(...)`.

/// Détail d'une page (/pages/:id) — écran public ET hub de gestion.
final pageDetailProvider =
    FutureProvider.autoDispose.family<PageDetail, String>((ref, id) {
  return ref.watch(pagesRepositoryProvider).chargerPage(id);
});

/// MES pages (section « Mes pages » du profil).
final mesPagesProvider =
    FutureProvider.autoDispose<List<OwnerPageCard>>((ref) {
  return ref.watch(pagesRepositoryProvider).chargerMesPages();
});

/// Menus de la semaine glissante d'un restaurant (7 jours dès aujourd'hui).
final menusDePageProvider =
    FutureProvider.autoDispose.family<List<MenuDay>, String>((ref, id) {
  return ref.watch(pagesRepositoryProvider).chargerMenus(id);
});

/// Plats ACTIFS d'un restaurant (gestion — propriétaire uniquement).
final platsDePageProvider =
    FutureProvider.autoDispose.family<List<Dish>, String>((ref, id) {
  return ref.watch(pagesRepositoryProvider).chargerPlats(id);
});

/// Offres EN COURS d'une page (section publique « Offres en cours » et
/// choix « Publier une offre »).
final offresDePageProvider =
    FutureProvider.autoDispose.family<List<PageOffer>, String>((ref, id) {
  return ref.watch(pagesRepositoryProvider).chargerOffres(id);
});

/// TOUTES les offres actives (gestion — inclut les expirées, all=true).
final offresGestionProvider =
    FutureProvider.autoDispose.family<List<PageOffer>, String>((ref, id) {
  return ref.watch(pagesRepositoryProvider).chargerOffres(id, toutes: true);
});

/// Événements À VENIR / EN COURS d'une page (section publique et choix
/// « Publier un événement »).
final evenementsDePageProvider =
    FutureProvider.autoDispose.family<List<PageEvent>, String>((ref, id) {
  return ref.watch(pagesRepositoryProvider).chargerEvenements(id);
});

/// TOUS les événements actifs (gestion — inclut les passés, all=true).
final evenementsGestionProvider =
    FutureProvider.autoDispose.family<List<PageEvent>, String>((ref, id) {
  return ref.watch(pagesRepositoryProvider).chargerEvenements(id, tous: true);
});

/// Les 3 dernières publications de la page (aperçu « Publications » de
/// l'écran public — la liste complète vit dans /pages/:id/posts).
final apercuPostsDePageProvider =
    FutureProvider.autoDispose.family<PostsPage, String>((ref, id) {
  return ref.watch(pagesRepositoryProvider).chargerPostsDePage(id, limit: 3);
});
