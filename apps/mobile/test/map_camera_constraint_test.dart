// Test de NON-RÉGRESSION du crash de l'onglet Carte.
//
// La carte est bornée à l'emprise de La Réunion. flutter_map exécute une
// assertion interne (`constrain(newCamera) == newCamera`) à CHAQUE changement
// d'options de la carte. Avec `CameraConstraint.contain`, cette contrainte
// renvoie `null` dès que la vue est plus grande que l'emprise dans une
// dimension — ce qui arrive sur un écran de TÉLÉPHONE EN PORTRAIT (haut et
// étroit) à ces niveaux de zoom : `null != newCamera` → assertion → écran
// rouge. Avec `CameraConstraint.containCenter` (le centre reste dans
// l'emprise), la contrainte ne renvoie jamais `null` et l'assertion passe.
//
// Ce test reconstruit la carte avec de NOUVELLES options (fond différent, pris
// en compte par `MapOptions ==`) pour déclencher exactement ce chemin, sur un
// écran portrait, et vérifie qu'aucune exception n'est levée.

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:endirek_mobile/features/map/domain/map_constants.dart';

Widget _carte(Color fond) {
  return MaterialApp(
    home: Scaffold(
      body: FlutterMap(
        options: MapOptions(
          initialCenter: MapConstants.centreReunion,
          initialZoom: MapConstants.zoomInitial,
          minZoom: MapConstants.zoomMin,
          maxZoom: MapConstants.zoomMax,
          cameraConstraint: MapConstants.contrainteCamera,
          backgroundColor: fond,
        ),
        // Aucune TileLayer : pas d'accès réseau, l'assertion de contrainte de
        // caméra ne dépend pas des couches.
        children: const [],
      ),
    ),
  );
}

void main() {
  testWidgets(
    'La carte survit à un changement d\'options en portrait '
    '(pas d\'assertion cameraConstraint)',
    (tester) async {
      // Écran de téléphone en portrait — Pixel 3a : 1080×2220 @2.75 → 393×807
      // en pixels logiques. La hauteur de la vue dépasse celle de l'emprise de
      // l'île à ce zoom : c'est le cas qui faisait renvoyer `null` à `contain`.
      tester.view.physicalSize = const Size(1080, 2220);
      tester.view.devicePixelRatio = 2.75;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_carte(Colors.white));
      // Reconstruction AVEC des options différentes → chemin « option change »
      // de flutter_map, celui qui exécute l'assertion sur la contrainte.
      await tester.pumpWidget(_carte(Colors.black));

      expect(tester.takeException(), isNull);
    },
  );
}
