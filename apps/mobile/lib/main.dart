import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/realtime/realtime_bridge.dart';
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
    // Garde le pont temps réel en vie pour toute la durée de l'app : il ouvre
    // le socket socket.io à la connexion, écoute les notifications et les
    // rafraîchissements carte, et assure le polling de repli du badge.
    ref.watch(realtimeBridgeProvider);
    return MaterialApp.router(
      title: 'Endirek',
      debugShowCheckedModeBanner: false,
      theme: buildEndirekTheme(),
      // Tous les textes de l'app, y compris les libelles Material, sont en francais.
      locale: const Locale('fr'),
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      supportedLocales: const [Locale('fr')],
      routerConfig: ref.watch(routerProvider),
    );
  }
}
