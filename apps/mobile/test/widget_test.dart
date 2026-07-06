// Smoke test de l'écran de connexion : vérifie que l'écran se construit et
// affiche ses éléments clés, SANS aucun accès réseau ni plugin natif
// (le stockage des jetons est remplacé par une implémentation en mémoire).

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:endirek_mobile/core/auth/auth_controller.dart';
import 'package:endirek_mobile/core/auth/token_storage.dart';
import 'package:endirek_mobile/core/theme/endirek_theme.dart';
import 'package:endirek_mobile/features/auth/presentation/login_screen.dart';

void main() {
  testWidgets('L\'écran de connexion s\'affiche (smoke test)', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // Stockage en mémoire : pas de trousseau natif dans les tests, et
          // aucun jeton présent → la restauration de session se termine en
          // « déconnecté » sans requête réseau.
          tokenStorageProvider.overrideWith((ref) => InMemoryTokenStorage()),
        ],
        child: MaterialApp(
          theme: buildEndirekTheme(),
          home: const LoginScreen(),
        ),
      ),
    );

    // Laisse la restauration de session (sans jeton) se terminer.
    await tester.pump();
    await tester.pump();

    // Logo texte et actions principales.
    expect(find.text('ENDIREK'), findsOneWidget);
    expect(find.text('Se connecter'), findsOneWidget);
    expect(find.text('Créer un compte'), findsOneWidget);

    // Champs email + mot de passe.
    expect(find.byType(TextFormField), findsNWidgets(2));

    // Placeholders OAuth désactivés, avec la mention « bientôt disponible ».
    expect(find.text('Continuer avec Google'), findsOneWidget);
    expect(find.text('Continuer avec Apple'), findsOneWidget);
    expect(find.text('bientôt disponible'), findsNWidgets(2));

    // La validation locale fonctionne sans réseau : soumettre le formulaire
    // vide affiche les messages d'erreur des champs.
    await tester.tap(find.text('Se connecter'));
    await tester.pump();
    expect(find.text('Veuillez saisir votre email.'), findsOneWidget);
    expect(find.text('Veuillez saisir votre mot de passe.'), findsOneWidget);
  });
}
