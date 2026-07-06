import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/models/user_profile.dart';
import '../../../core/auth/auth_controller.dart';

/// Accès aux endpoints « users » pour la feature profil.
final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(ref.watch(apiClientProvider));
});

/// Marqueur « champ absent » pour les paramètres nullables de [ProfileRepository.updateMyProfile].
///
/// Les champs nullables du contrat (ville, avatar, couverture) acceptent DEUX
/// valeurs distinctes : `null` EFFACE la valeur côté serveur, une absence la
/// laisse INCHANGÉE (sémantique PATCH). Un simple `String?` ne peut pas
/// distinguer « non fourni » de « fourni à null » ; ce sentinel le permet.
const Object _champAbsent = Object();

class ProfileRepository {
  const ProfileRepository(this._api);

  final ApiClient _api;

  /// Met à jour le profil du user courant (`PATCH /users/me/profile`).
  ///
  /// Sémantique PATCH alignée sur le DTO backend :
  /// - un champ NON fourni est absent du corps → colonne inchangée ;
  /// - `displayName` et `bio` sont NOT NULL côté contrat : ils ne sont envoyés
  ///   que s'ils sont non nuls (un null les omet simplement) ;
  /// - `city`, `avatarUrl`, `coverUrl` sont NULLABLES : passer explicitement
  ///   `null` envoie `null` au serveur pour EFFACER la colonne (une chaîne vide
  ///   stockerait '' au lieu de vider). Ne pas passer le paramètre laisse la
  ///   colonne inchangée.
  ///
  /// Retourne le PROFIL COMPLET à jour renvoyé par l'API.
  Future<UserProfile> updateMyProfile({
    String? displayName,
    String? bio,
    Object? city = _champAbsent,
    Object? avatarUrl = _champAbsent,
    Object? coverUrl = _champAbsent,
  }) async {
    final Map<String, dynamic> donnees = {
      // Champs NOT NULL : envoyés seulement si non nuls.
      'displayName': ?displayName,
      'bio': ?bio,
    };
    // Champs NULLABLES : un null EXPLICITE est transmis (efface la colonne) ;
    // seul le sentinel « absent » retire la clé du corps.
    if (!identical(city, _champAbsent)) {
      donnees['city'] = city;
    }
    if (!identical(avatarUrl, _champAbsent)) {
      donnees['avatarUrl'] = avatarUrl;
    }
    if (!identical(coverUrl, _champAbsent)) {
      donnees['coverUrl'] = coverUrl;
    }
    final reponse = await _api.patch('/users/me/profile', data: donnees);
    return UserProfile.fromJson(reponse.data as Map<String, dynamic>);
  }
}
