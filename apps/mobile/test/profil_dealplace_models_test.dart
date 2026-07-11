import 'package:endirek_mobile/core/api/models/user_profile.dart';
import 'package:endirek_mobile/features/dealplace/domain/profil_public.dart';
import 'package:flutter_test/flutter_test.dart';

/// Modèles du volet « Profil Dealplace » (CP2.2) : parsing du champ
/// `dealplaceSeeking` (profil complet + profil public) et initiales du
/// profil public (repli visuel sans avatar).
void main() {
  group('UserProfile.dealplaceSeeking', () {
    test('présent → conservé, absent → null', () {
      final avec = UserProfile.fromJson({
        'id': 'u1',
        'displayName': 'Kévin Dijoux',
        'dealplaceSeeking': 'Je recherche du matériel de rando.',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });
      expect(avec.dealplaceSeeking, 'Je recherche du matériel de rando.');

      final sans = UserProfile.fromJson({
        'id': 'u2',
        'displayName': 'Marie Hoarau',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });
      expect(sans.dealplaceSeeking, isNull);
    });
  });

  group('ProfilPublic', () {
    test('parse la forme PROFIL PUBLIC (sans email) avec dealplaceSeeking',
        () {
      final profil = ProfilPublic.fromJson({
        'id': 'u3',
        'displayName': 'Valérie Grondin',
        'avatarUrl': null,
        'bio': 'Maman de deux marmailles.',
        'city': 'Saint-Paul',
        'dealplaceSeeking': 'Ouverte au troc !',
        'followersCount': 3,
        'followingCount': 2,
        'postsCount': 5,
        'createdAt': '2026-01-01T00:00:00.000Z',
      });
      expect(profil.displayName, 'Valérie Grondin');
      expect(profil.city, 'Saint-Paul');
      expect(profil.dealplaceSeeking, 'Ouverte au troc !');
      expect(profil.followersCount, 3);
    });

    test('initiales : deux mots → 2 lettres, un mot → 1, vide → « ? »', () {
      ProfilPublic construire(String nom) => ProfilPublic.fromJson({
            'id': 'x',
            'displayName': nom,
            'createdAt': '2026-01-01T00:00:00.000Z',
          });
      expect(construire('Valérie Grondin').initiales, 'VG');
      expect(construire('Kévin').initiales, 'K');
      expect(construire('  ').initiales, '?');
    });
  });
}
