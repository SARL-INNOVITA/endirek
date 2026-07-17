// Test du bottom sheet de contenu d'un cluster indivisible (features/map) :
// titre au pluriel, une ligne par marqueur avec identité de PAGE (Lot 3),
// et renvoi du marqueur choisi au tap.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

import 'package:endirek_mobile/core/api/models/geo_point.dart';
import 'package:endirek_mobile/core/api/models/map_post_item.dart';
import 'package:endirek_mobile/core/api/models/post_author.dart';
import 'package:endirek_mobile/core/api/models/post_page_ref.dart';
import 'package:endirek_mobile/features/map/domain/map_marker.dart';
import 'package:endirek_mobile/features/map/presentation/widgets/contenu_cluster_sheet.dart';

const _auteur = PostAuthor(
  id: 'u1',
  displayName: 'David',
  avatarUrl: null,
  city: 'Saint-Denis',
);

const _page = PostPageRef(
  id: 'p1',
  name: 'Bon Goût',
  avatarUrl: null,
  pageType: 'restaurant',
  verified: true,
);

MapMarker _postDePage(String id, String slug, String titre) {
  final item = MapPostItem(
    id: id,
    typeSlug: slug,
    title: titre,
    location: const GeoPoint(lat: -20.8825, lng: 55.4501),
    city: 'Saint-Denis',
    mapExpiresAt: null,
    createdAt: DateTime(2026, 1, 1),
    urlSlug: 'p-$id',
    author: _auteur,
    page: _page,
  );
  return MapMarker.depuisPost(item, const LatLng(-20.8825, 55.4501));
}

void main() {
  testWidgets(
      'le sheet liste les publications confondues et renvoie le choix',
      (tester) async {
    final marqueurs = [
      _postDePage('1', 'menu', 'Le cari du mercredi'),
      _postDePage('2', 'offer', 'Offre du midi −10 %'),
    ];
    MapMarker? choisi;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () async {
                  choisi = await montrerContenuCluster(context, marqueurs);
                },
                child: const Text('ouvrir'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();

    // Titre au pluriel + une ligne par publication + identité de page.
    expect(find.text('2 publications à cet endroit'), findsOneWidget);
    expect(find.text('Le cari du mercredi'), findsOneWidget);
    expect(find.text('Offre du midi −10 %'), findsOneWidget);
    expect(find.text('Bon Goût'), findsNWidgets(2));
    expect(find.byIcon(Icons.verified), findsNWidgets(2));

    // Le tap d'une ligne renvoie le marqueur correspondant.
    await tester.tap(find.text('Offre du midi −10 %'));
    await tester.pumpAndSettle();
    expect(choisi, isNotNull);
    expect(choisi!.post!.id, '2');
  });

  testWidgets('fermer sans choisir renvoie null', (tester) async {
    final marqueurs = [
      _postDePage('1', 'menu', 'Menu du jour'),
      _postDePage('2', 'offer', 'Offre du midi −10 %'),
    ];
    MapMarker? choisi = _postDePage('x', 'menu', 'sentinelle');

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () async {
                  choisi = await montrerContenuCluster(context, marqueurs);
                },
                child: const Text('ouvrir'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('ouvrir'));
    await tester.pumpAndSettle();
    // Tap hors du sheet → fermeture sans sélection.
    await tester.tapAt(const Offset(200, 40));
    await tester.pumpAndSettle();
    expect(choisi, isNull);
  });
}
