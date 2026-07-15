// Test widget de la CARTE DE POST du fil, avec des données factices et
// SANS aucun accès réseau : le référentiel des types est surchargé et le
// post factice n'a ni média ni avatar (pas d'Image.network).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:endirek_mobile/core/api/models/feed_post.dart';
import 'package:endirek_mobile/core/api/models/post_author.dart';
import 'package:endirek_mobile/core/api/models/post_page_ref.dart';
import 'package:endirek_mobile/core/api/models/post_type.dart';
import 'package:endirek_mobile/core/auth/auth_controller.dart';
import 'package:endirek_mobile/core/auth/token_storage.dart';
import 'package:endirek_mobile/core/theme/endirek_theme.dart';
import 'package:endirek_mobile/features/feed/application/referentiels_providers.dart';
import 'package:endirek_mobile/features/feed/presentation/widgets/post_card.dart';

/// Publication factice conforme au contrat FEED_POST (sans média).
FeedPost postFactice({PostPageRef? page}) {
  final DateTime maintenant = DateTime.now();
  return FeedPost(
    id: 'post-test-1',
    typeSlug: page == null ? 'traffic' : 'menu',
    title: page == null
        ? 'Embouteillage route du littoral'
        : 'Menu du jour',
    body: page == null
        ? 'Circulation très dense en direction de Saint-Denis, comptez '
            '45 minutes de plus.'
        : '• Rougail saucisses — 7,00 € à emporter',
    city: 'Saint-Denis',
    location: null,
    mapExpiresAt: null,
    urlSlug: 'embouteillage-route-du-littoral-a1b2',
    status: 'active',
    createdAt: maintenant.subtract(const Duration(minutes: 37)),
    updatedAt: maintenant.subtract(const Duration(minutes: 37)),
    reactionCount: 6,
    commentCount: 3,
    shareCount: 0,
    saveCount: 1,
    page: page,
    author: const PostAuthor(
      id: 'user-test-1',
      displayName: 'Maya Hoarau',
      avatarUrl: null,
      city: 'Saint-Denis',
    ),
    media: const [],
    viewerReaction: null,
    viewerSaved: false,
    reactionsTop: const [
      EmojiCount(emoji: '👍', count: 4),
      EmojiCount(emoji: '😮', count: 2),
    ],
  );
}

void main() {
  testWidgets('La carte de post affiche ses éléments clés', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // Aucun accès au trousseau natif ni au réseau dans les tests.
          tokenStorageProvider.overrideWith((ref) => InMemoryTokenStorage()),
          // Référentiel des types figé (sinon GET /posts/types).
          postTypesProvider.overrideWith(
            (ref) async => const [
              PostType(
                slug: 'traffic',
                labelFr: 'Point trafic',
                icon: 'car',
                color: '#F97316',
                requiresLocationForMap: true,
                showsOnMap: true,
                defaultMapDurationMinutes: 120,
                position: 3,
              ),
            ],
          ),
        ],
        child: MaterialApp(
          theme: buildEndirekTheme(),
          home: Scaffold(
            body: SingleChildScrollView(child: PostCard(post: postFactice())),
          ),
        ),
      ),
    );
    // Laisse le FutureProvider des types se résoudre.
    await tester.pump();

    // En-tête : auteur, temps relatif « il y a 37 min » et ville.
    expect(find.text('Maya Hoarau'), findsOneWidget);
    expect(find.text('il y a 37 min · Saint-Denis'), findsOneWidget);

    // Titre gras et corps.
    expect(find.text('Embouteillage route du littoral'), findsOneWidget);
    expect(find.textContaining('Circulation très dense'), findsOneWidget);

    // Ligne des compteurs : emojis reactionsTop + total, « N commentaires ».
    expect(find.text('👍😮'), findsOneWidget);
    expect(find.text('6'), findsOneWidget);
    expect(find.text('3 commentaires'), findsOneWidget);

    // Barre d'actions complète.
    expect(find.text("J'aime"), findsOneWidget);
    expect(find.text('Commenter'), findsOneWidget);
    expect(find.text('Partager'), findsOneWidget);
    expect(find.text('Enregistrer'), findsOneWidget);

    // Icône du type « traffic » (référentiel surchargé) : voiture.
    expect(find.byIcon(Icons.directions_car_outlined), findsOneWidget);

    // Le tap « Partager » affiche le placeholder (aucun réseau).
    await tester.tap(find.text('Partager'));
    await tester.pump();
    expect(find.text('Partage disponible prochainement'), findsOneWidget);
  });

  testWidgets(
      'Publication DE PAGE (Lot 3) : identité de page, coche vérifiée et '
      'type menu résolu localement', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStorageProvider.overrideWith((ref) => InMemoryTokenStorage()),
          // Référentiel VIDE : les slugs de page (menu/offer/event) sont
          // absents de GET /posts/types — résolution par la table locale.
          postTypesProvider.overrideWith((ref) async => const <PostType>[]),
        ],
        child: MaterialApp(
          theme: buildEndirekTheme(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: PostCard(
                post: postFactice(
                  page: const PostPageRef(
                    id: 'page-test-1',
                    name: 'Bon Goût',
                    avatarUrl: null,
                    pageType: 'restaurant',
                    verified: true,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    // L'identité de la PAGE remplace l'auteur humain.
    expect(find.text('Bon Goût'), findsOneWidget);
    expect(find.text('Maya Hoarau'), findsNothing);
    expect(find.byIcon(Icons.verified), findsOneWidget);

    // Type « menu » résolu par la table locale : icône restaurant.
    expect(find.byIcon(Icons.restaurant_outlined), findsOneWidget);

    // Le sous-titre temps · ville reste inchangé.
    expect(find.text('il y a 37 min · Saint-Denis'), findsOneWidget);
  });
}
