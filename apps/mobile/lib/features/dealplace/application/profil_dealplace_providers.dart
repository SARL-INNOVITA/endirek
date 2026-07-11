import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/dealplace_repository.dart';
import '../domain/profil_public.dart';

/// Providers du volet « Profil Dealplace » (CP2.2).
///
/// Deux surfaces partagent ces providers :
/// - l'onglet « Profil Dealplace » de MON profil (userId null → mes annonces
///   'active' + 'hidden', cartes avec statut) ;
/// - l'écran public du profil Dealplace d'un TIERS (userId fourni → annonces
///   'active' seulement).
///
/// `autoDispose` : les données sont rechargées à chaque (ré)ouverture — un
/// profil ou une annonce a pu changer entre deux visites.

/// Clé d'une section d'annonces du profil : propriétaire (null = moi) +
/// famille ('good' = Biens, 'service' = Services).
typedef SectionAnnoncesArgs = ({String? userId, String family});

/// Profil PUBLIC d'un tiers (en-tête de l'écran public).
final profilPublicProvider = FutureProvider.autoDispose
    .family<ProfilPublic, String>((ref, userId) {
  return ref.watch(dealplaceRepositoryProvider).chargerProfilPublic(userId);
});

/// Annonces d'une section du profil (Services OU Biens, jusqu'à 50 — au-delà,
/// pagination à prévoir avec la croissance réelle des profils).
final sectionAnnoncesProvider = FutureProvider.autoDispose
    .family<ListingsPage, SectionAnnoncesArgs>((ref, args) {
  final repo = ref.watch(dealplaceRepositoryProvider);
  if (args.userId == null) {
    return repo.chargerMesAnnonces(family: args.family, limit: 50);
  }
  return repo.chargerAnnoncesDeProfil(
    args.userId!,
    family: args.family,
    limit: 50,
  );
});
