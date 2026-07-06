import '../api/models/user_profile.dart';

/// État d'authentification de l'application (machine à 3 états).
///
/// - [AuthUnknown]   : démarrage / restauration de session en cours ;
/// - [AuthSignedOut] : aucun utilisateur connecté ;
/// - [AuthSignedIn]  : utilisateur connecté, avec son PROFIL COMPLET.
sealed class AuthState {
  const AuthState();
}

/// État initial : la session locale est en cours de restauration
/// (lecture des jetons puis `GET /auth/me`).
class AuthUnknown extends AuthState {
  const AuthUnknown();
}

/// Aucun utilisateur connecté : l'app est cantonnée aux écrans d'auth.
///
/// [raison] porte, le cas échéant, un message à afficher expliquant une
/// déconnexion SUBIE (ex. « Votre compte a été suspendu. »). Elle est nulle
/// pour une déconnexion volontaire ou un simple démarrage sans session.
class AuthSignedOut extends AuthState {
  const AuthSignedOut({this.raison});

  final String? raison;
}

/// Utilisateur connecté, profil complet en mémoire.
class AuthSignedIn extends AuthState {
  const AuthSignedIn(this.profile);

  final UserProfile profile;
}
