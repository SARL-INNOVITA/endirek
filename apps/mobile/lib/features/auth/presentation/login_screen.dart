import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/theme/endirek_theme.dart';

/// Écran de connexion (email + mot de passe).
///
/// Les boutons Google / Apple sont présents mais DÉSACTIVÉS : le backend
/// expose des placeholders 501 « bientôt disponible » (clés OAuth absentes).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final GlobalKey<FormState> _cleFormulaire = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _motDePasseController = TextEditingController();

  bool _envoiEnCours = false;
  bool _masquerMotDePasse = true;
  String? _erreurApi;

  @override
  void dispose() {
    _emailController.dispose();
    _motDePasseController.dispose();
    super.dispose();
  }

  Future<void> _seConnecter() async {
    FocusScope.of(context).unfocus();
    if (!(_cleFormulaire.currentState?.validate() ?? false)) {
      return;
    }
    setState(() {
      _envoiEnCours = true;
      _erreurApi = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).login(
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
    final AuthState etatAuth = ref.watch(authControllerProvider);

    // Restauration de session en cours au démarrage : simple indicateur,
    // le routeur redirigera vers /profile si la session est encore valide.
    if (etatAuth is AuthUnknown) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // Message d'une déconnexion SUBIE (ex. suspension du compte en cours de
    // session) porté par l'état déconnecté. On l'affiche tant que l'utilisateur
    // n'a pas déclenché sa propre erreur de connexion.
    final String? raisonDeconnexion =
        etatAuth is AuthSignedOut ? etatAuth.raison : null;
    final String? messageBandeau = _erreurApi ?? raisonDeconnexion;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _cleFormulaire,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Logo texte provisoire (identité visuelle à l'étape 7).
                    const Text(
                      'ENDIREK',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: EndirekColors.bleu,
                        fontSize: 34,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 3,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Le réseau social lokal de La Réunion',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: EndirekColors.encreSecondaire,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 40),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        hintText: 'ou.adresse@exemple.re',
                      ),
                      validator: _validerEmail,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _motDePasseController,
                      obscureText: _masquerMotDePasse,
                      textInputAction: TextInputAction.done,
                      onFieldSubmitted: (_) => _seConnecter(),
                      decoration: InputDecoration(
                        labelText: 'Mot de passe',
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
                        if (valeur == null || valeur.isEmpty) {
                          return 'Veuillez saisir votre mot de passe.';
                        }
                        return null;
                      },
                    ),
                    if (messageBandeau != null) ...[
                      const SizedBox(height: 16),
                      _EncartErreur(message: messageBandeau),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _envoiEnCours ? null : _seConnecter,
                      child: _envoiEnCours
                          ? const SizedBox(
                              height: 22,
                              width: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Se connecter'),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed:
                          _envoiEnCours ? null : () => context.go('/register'),
                      child: const Text('Créer un compte'),
                    ),
                    const SizedBox(height: 16),
                    const Row(
                      children: [
                        Expanded(child: Divider()),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            'ou',
                            style: TextStyle(
                              color: EndirekColors.encreSecondaire,
                            ),
                          ),
                        ),
                        Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 16),
                    // Placeholders OAuth : boutons volontairement désactivés,
                    // le backend répond 501 « bientôt disponible ».
                    const _BoutonOAuthDesactive(
                      icone: Icons.g_mobiledata,
                      libelle: 'Continuer avec Google',
                    ),
                    const SizedBox(height: 12),
                    const _BoutonOAuthDesactive(
                      icone: Icons.apple,
                      libelle: 'Continuer avec Apple',
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

  static String? _validerEmail(String? valeur) {
    final String email = valeur?.trim() ?? '';
    if (email.isEmpty) {
      return 'Veuillez saisir votre email.';
    }
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      return 'Adresse email invalide.';
    }
    return null;
  }
}

/// Encart rouge affichant l'erreur renvoyée par l'API (message en français).
class _EncartErreur extends StatelessWidget {
  const _EncartErreur({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFDECEC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        message,
        style: const TextStyle(color: Color(0xFFB3261E), fontSize: 14),
      ),
    );
  }
}

/// Bouton OAuth désactivé avec la mention « bientôt disponible ».
class _BoutonOAuthDesactive extends StatelessWidget {
  const _BoutonOAuthDesactive({required this.icone, required this.libelle});

  final IconData icone;
  final String libelle;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: null, // Désactivé : OAuth non branché (placeholder 501).
      icon: Icon(icone, size: 24),
      label: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(libelle),
          const Text(
            'bientôt disponible',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400),
          ),
        ],
      ),
    );
  }
}
