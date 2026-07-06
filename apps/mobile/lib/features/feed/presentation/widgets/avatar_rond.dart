import 'package:flutter/material.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/theme/endirek_theme.dart';

/// Avatar rond réutilisable (fil, commentaires, composer) : photo si
/// disponible, sinon initiales sur fond bleu — même repli visuel que
/// l'écran profil.
class AvatarRond extends StatelessWidget {
  const AvatarRond({
    super.key,
    required this.initiales,
    this.avatarUrl,
    this.rayon = 20,
  });

  final String initiales;
  final String? avatarUrl;
  final double rayon;

  @override
  Widget build(BuildContext context) {
    final bool aUnePhoto = avatarUrl != null && avatarUrl!.isNotEmpty;
    return CircleAvatar(
      radius: rayon,
      backgroundColor: EndirekColors.bleu,
      foregroundImage: aUnePhoto
          ? NetworkImage(ApiConfig.resolveMediaUrl(avatarUrl!))
          : null,
      // Si la photo ne charge pas, les initiales restent visibles dessous.
      onForegroundImageError: aUnePhoto ? (_, _) {} : null,
      child: Text(
        initiales,
        style: TextStyle(
          color: Colors.white,
          fontSize: rayon * 0.72,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
