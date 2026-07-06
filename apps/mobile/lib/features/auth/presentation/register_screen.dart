import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/endirek_theme.dart';

/// Écran d'inscription : nom affiché (2-50), email, mot de passe (≥ 8
/// caractères) + confirmation. En cas de succès, l'utilisateur est
/// directement connecté (le backend renvoie les jetons à l'inscription).
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final GlobalKey<FormState> _cleFormulaire = GlobalKey<FormState>();
  final TextEditingController _nomController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _motDePasseController = TextEditingController();
  final TextEditingController _confirmationController = TextEditingController();

  bool _envoiEnCours = false;
  bool _masquerMotDePasse = true;
  String? _erreurApi;

  @override
  void dispose() {
    _nomController.dispose();
    _emailController.dispose();
    _motDePasseController.dispose();
    _confirmationController.dispose();
    super.dispose();
  }

  Future<void> _creerCompte() async {
    FocusScope.of(context).unfocus();
    if (!(_cleFormulaire.currentState?.validate() ?? false)) {
      return;
    }
    setState(() {
      _envoiEnCours = true;
      _erreurApi = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).register(
            displayName: _nomController.text,
            email: _emailController.text,
            password: _motDePasseController.text,
          );
      // Succès : la redirection vers /profile est gérée par le routeur.
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
      appBar: AppBar(
        title: const Text('Créer un compte'),
        leading: IconButton(
          tooltip: 'Retour à la connexion',
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _cleFormulaire,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Rejoignez Endirek',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: EndirekColors.encre,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Votre île, en direct.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 32),
                    TextFormField(
                      controller: _nomController,
                      textInputAction: TextInputAction.next,
                      maxLength: 50,
                      decoration: const InputDecoration(
                        labelText: 'Nom affiché',
                        hintText: 'Ex. : Maya Hoarau',
                        counterText: '',
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
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'Email'),
                      validator: (valeur) {
                        final String email = valeur?.trim() ?? '';
                        if (email.isEmpty) {
                          return 'Veuillez saisir votre email.';
                        }
                        if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                            .hasMatch(email)) {
                          return 'Adresse email invalide.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _motDePasseController,
                      obscureText: _masquerMotDePasse,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: 'Mot de passe',
                        helperText: 'Au moins 8 caractères.',
                        suffixIcon: IconButton(
                          tooltip: _masquerMotDePasse
                              ? 'Afficher le mot de passe'
                              : 'Masquer le mot de passe',
                          icon: Icon(
                            _masquerMotDePasse
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                          onPressed: () => setState(
                            () => _masquerMotDePasse = !_masquerMotDePasse,
                          ),
                        ),
                      ),
                      validator: (valeur) {
                        if (valeur == null || valeur.length < 8) {
                          return 'Le mot de passe doit contenir au moins 8 caractères.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _confirmationController,
                      obscureText: _masquerMotDePasse,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _creerCompte(),
                      decoration: const InputDecoration(
                        labelText: 'Confirmez le mot de passe',
                      ),
                      validator: (valeur) {
                        if (valeur != _motDePasseController.text) {
                          return 'Les mots de passe ne correspondent pas.';
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
                      onPressed: _envoiEnCours ? null : _creerCompte,
                      child: _envoiEnCours
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Créer mon compte'),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed:
                          _envoiEnCours ? null : () => context.go('/login'),
                      child: const Text('J\'ai déjà un compte — Se connecter'),
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
