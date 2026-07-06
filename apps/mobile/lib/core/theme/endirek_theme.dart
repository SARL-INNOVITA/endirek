import 'package:flutter/material.dart';

/// Palette Endirek provisoire (étape 3).
///
/// Thème clair minimal : bleu Endirek #1173D4, fond blanc, surfaces #F6F7F8,
/// cartes arrondies 16, boutons pleins bleus arrondis. Il sera raffiné à
/// l'étape 7 sur la base des mockups (typographie Sora, ombres légères…).
abstract final class EndirekColors {
  /// Bleu principal de la marque.
  static const Color bleu = Color(0xFF1173D4);

  /// Fond des surfaces secondaires (champs, cartes, encarts).
  static const Color surface = Color(0xFFF6F7F8);

  /// Couleur d'encre principale (textes).
  static const Color encre = Color(0xFF101922);

  /// Textes secondaires (sous-titres, libellés discrets).
  static const Color encreSecondaire = Color(0xFF5E6B7A);

  /// Bordures et séparateurs discrets.
  static const Color bordure = Color(0xFFE3E7EB);
}

/// Construit le thème clair provisoire de l'application Endirek.
ThemeData buildEndirekTheme() {
  final ColorScheme scheme = ColorScheme.fromSeed(
    seedColor: EndirekColors.bleu,
  ).copyWith(
    primary: EndirekColors.bleu,
    surface: Colors.white,
    onSurface: EndirekColors.encre,
  );

  const OutlineInputBorder bordureChamp = OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(12)),
    borderSide: BorderSide.none,
  );

  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: Colors.white,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: EndirekColors.encre,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: EndirekColors.encre,
        fontSize: 18,
        fontWeight: FontWeight.w700,
      ),
    ),
    // Cartes arrondies 16, posées à plat sur le fond blanc.
    cardTheme: const CardThemeData(
      color: EndirekColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(16)),
      ),
    ),
    // Boutons pleins bleus arrondis.
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: EndirekColors.bleu,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
        ),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: EndirekColors.encre,
        minimumSize: const Size.fromHeight(52),
        side: const BorderSide(color: EndirekColors.bordure),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
        ),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: EndirekColors.bleu,
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    // Champs de saisie sur fond gris clair, sans bordure au repos.
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: EndirekColors.surface,
      border: bordureChamp,
      enabledBorder: bordureChamp,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: EndirekColors.bleu, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: Colors.redAccent),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        borderSide: BorderSide(color: Colors.redAccent, width: 1.5),
      ),
      hintStyle: TextStyle(color: EndirekColors.encreSecondaire),
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    dividerTheme: const DividerThemeData(
      color: EndirekColors.bordure,
      thickness: 1,
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: EndirekColors.encre,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: EndirekColors.bleu,
    ),
  );
}
