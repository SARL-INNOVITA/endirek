import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models/user_profile.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_state.dart';
import '../data/profile_repository.dart';

/// Écran d'édition du profil : nom affiché, bio, ville
/// (`PATCH /users/me/profile`). Au succès, le profil en mémoire est
/// remplacé par la réponse de l'API et on revient sur l'écran profil.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final GlobalKey<FormState> _cleFormulaire = GlobalKey<FormState>();
  late final TextEditingController _nomController;
  late final TextEditingController _bioController;
  late final TextEditingController _villeController;

  bool _envoiEnCours = false;
  String? _erreurApi;

  @override
  void initState() {
    super.initState();
    // Pré-remplit avec le profil courant (l'écran n'est accessible que
    // connecté, mais on reste défensif si l'état a déjà basculé).
    final AuthState etatAuth = ref.read(authControllerProvider);
    final UserProfile? profil =
        etatAuth is AuthSignedIn ? etatAuth.profile : null;
    _nomController = TextEditingController(text: profil?.displayName ?? '');
    _bioController = TextEditingController(text: profil?.bio ?? '');
    _villeController = TextEditingController(text: profil?.city ?? '');
  }

  @override
  void dispose() {
    _nomController.dispose();
    _bioController.dispose();
    _villeController.dispose();
    super.dispose();
  }

  Future<void> _enregistrer() async {
    FocusScope.of(context).unfocus();
    if (!(_cleFormulaire.currentState?.validate() ?? false)) {
      return;
    }
    setState(() {
      _envoiEnCours = true;
      _erreurApi = null;
    });
    try {
      final String ville = _villeController.text.trim();
      final UserProfile profilAJour =
          await ref.read(profileRepositoryProvider).updateMyProfile(
                displayName: _nomController.text.trim(),
                bio: _bioController.text.trim(),
                // Ville nullable côté contrat : null EFFACE la valeur (une
                // chaîne vide stockerait '' au lieu de vider la colonne).
                city: ville.isEmpty ? null : ville,
              );
      ref.read(authControllerProvider.notifier).setProfile(profilAJour);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil mis à jour.')),
      );
      context.pop(); // Retour sur l'écran profil, déjà rafraîchi.
    } on ApiException catch (erreur) {
      if (mounted) {
        setState(() => _erreurApi = erreur.message);
      }
    } finally {
      if (mounted) {
        setState(() => _envoiEnCours = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Modifier le profil')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _cleFormulaire,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: _nomController,
                      textInputAction: TextInputAction.next,
                      maxLength: 50,
                      decoration: const InputDecoration(
                        labelText: 'Nom affiché',
                      ),
                      validator: (valeur) {
                        final String nom = valeur?.trim() ?? '';
                        if (nom.length < 2 || nom.length > 50) {
                          return 'Le nom affiché doit contenir entre 2 et 50 caractères.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _bioController,
                      minLines: 3,
                      maxLines: 6,
                      maxLength: 500,
                      decoration: const InputDecoration(
                        labelText: 'Bio',
                        hintText: 'Parlez de vous en quelques mots…',
                        alignLabelWithHint: true,
                      ),
                      validator: (valeur) {
                        if ((valeur ?? '').trim().length > 500) {
                          return 'La bio ne peut pas dépasser 500 caractères.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _villeController,
                      textInputAction: TextInputAction.done,
                      maxLength: 80,
                      onFieldSubmitted: (_) => _enregistrer(),
                      decoration: const InputDecoration(
                        labelText: 'Ville',
                        hintText: 'Ex. : Saint-Denis',
                        counterText: '',
                      ),
                      validator: (valeur) {
                        if ((valeur ?? '').trim().length > 80) {
                          return 'La ville ne peut pas dépasser 80 caractères.';
                        }
                        return null;
                      },
                    ),
                    if (_erreurApi != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFDECEC),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          _erreurApi!,
                          style: const TextStyle(
                            color: Color(0xFFB3261E),
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _envoiEnCours ? null : _enregistrer,
                      child: _envoiEnCours
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Enregistrer'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
