import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/endirek_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: EndirekApp()));
}

/// Racine de l'application Endirek : thème clair provisoire, locale
/// française et navigation `go_router` pilotée par l'état d'authentification.
class EndirekApp extends ConsumerWidget {
  const EndirekApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Endirek',
      debugShowCheckedModeBanner: false,
      theme: buildEndirekTheme(),
      // Tous les textes de l'app sont rédigés en français.
      // TODO(étape 7) : brancher `flutter_localizations` (SDK) pour traduire
      // aussi les libellés internes de Material (dialogues, tooltips…).
      locale: const Locale('fr'),
      supportedLocales: const [Locale('fr')],
      routerConfig: ref.watch(routerProvider),
    );
  }
}
