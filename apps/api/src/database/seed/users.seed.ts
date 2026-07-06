/**
 * Seed utilisateurs — 15 profils réunionnais FICTIFS.
 *
 * Les identités sont INVENTÉES : patronymes courants de La Réunion (Hoarau,
 * Payet, Grondin, Fontaine, Técher, Boyer, Rivière, Maillot, Lebon, Dijoux)
 * mélangés à des prénoms variés — toute ressemblance avec des personnes
 * réelles serait fortuite. Emails fictifs en @endirek.invalid : le TLD
 * .invalid est réservé par la RFC 2606, garanti jamais enregistrable ni
 * routable (contrairement à un domaine « fantaisie » qui pourrait être
 * déposé par un tiers).
 *
 * Répartition : 1 super_admin (« Équipe Endirek »), 1 moderator, 13 users,
 * villes étalées sur les 12 communes du référentiel seed.
 */

import { Follow } from '../domain/entities';
import { SeedUser } from './index';
import { communeByName } from './communes';
import { daysAgo, pointNear, seedUuid } from './seed-utils';

/**
 * PLACEHOLDER de développement — ce n'est PAS un hash et PAS un secret :
 * l'authentification n'existe pas encore au Lot 1 étape 2. À l'étape 3
 * (auth), cette valeur sera remplacée par de vrais hash bcrypt générés au
 * chargement du seed (jamais de mot de passe en clair en base réelle).
 */
const DEV_PASSWORD_HASH = 'dev$endirek974';

/** Spécification déclarative d'un utilisateur seed (le reste est dérivé). */
interface UserSpec {
  n: number;
  displayName: string;
  email: string;
  bio: string;
  city: string;
  /** Ancienneté d'inscription en jours (createdAt = daysAgo(n)). */
  signupDaysAgo: number;
  role?: 'user' | 'moderator' | 'super_admin';
  /** false : profil sans position publique (choix utilisateur). */
  hasLocation?: boolean;
  /** false : profil sans photo de couverture. */
  hasCover?: boolean;
}

const USER_SPECS: UserSpec[] = [
  {
    n: 1,
    displayName: 'Équipe Endirek',
    email: 'equipe@endirek.invalid',
    bio: 'Compte officiel Endirek. Annonces, infos pratiques et vie du réseau péi.',
    city: 'Saint-Denis',
    signupDaysAgo: 180,
    role: 'super_admin',
  },
  {
    n: 2,
    displayName: 'Marie Hoarau',
    email: 'marie.hoarau@endirek.invalid',
    bio: 'Modératrice Endirek. Randonnées le week-end, bichiques en saison.',
    city: 'Saint-Pierre',
    signupDaysAgo: 150,
    role: 'moderator',
  },
  {
    n: 3,
    displayName: 'Jean-Yves Payet',
    email: 'jean-yves.payet@endirek.invalid',
    bio: 'Chauffeur de bus sur la RN3. Je connais chaque virage du Tampon.',
    city: 'Le Tampon',
    signupDaysAgo: 140,
  },
  {
    n: 4,
    displayName: 'Valérie Grondin',
    email: 'valerie.grondin@endirek.invalid',
    bio: 'Maman de deux marmailles, plage de l’Ermitage le dimanche.',
    city: 'Saint-Paul',
    signupDaysAgo: 130,
  },
  {
    n: 5,
    displayName: 'Didier Fontaine',
    email: 'didier.fontaine@endirek.invalid',
    bio: 'Planteur de cannes à Saint-André. La terre lé bon, faut la respecter.',
    city: 'Saint-André',
    signupDaysAgo: 120,
    hasCover: false,
  },
  {
    n: 6,
    displayName: 'Émilie Técher',
    email: 'emilie.techer@endirek.invalid',
    bio: 'Infirmière à Saint-Benoît. Amoureuse de l’Est, même sous la pluie.',
    city: 'Saint-Benoît',
    signupDaysAgo: 110,
  },
  {
    n: 7,
    displayName: 'Sully Boyer',
    email: 'sully.boyer@endirek.invalid',
    bio: 'Surfeur et parapentiste à Saint-Leu. Je poste la houle du matin.',
    city: 'Saint-Leu',
    signupDaysAgo: 100,
  },
  {
    n: 8,
    displayName: 'Nadia Rivière',
    email: 'nadia.riviere@endirek.invalid',
    bio: 'Prof de maths à Saint-Louis. Adepte du covoiturage dans le Sud.',
    city: 'Saint-Louis',
    signupDaysAgo: 90,
    hasCover: false,
  },
  {
    n: 9,
    displayName: 'Thierry Maillot',
    email: 'thierry.maillot@endirek.invalid',
    bio: 'Je fais la Route du Littoral deux fois par jour. Courage à nous.',
    city: 'La Possession',
    signupDaysAgo: 80,
  },
  {
    n: 10,
    displayName: 'Laurence Lebon',
    email: 'laurence.lebon@endirek.invalid',
    bio: 'Docker au Port Est, rugby le week-end. Fière de ma ville.',
    city: 'Le Port',
    signupDaysAgo: 70,
    hasCover: false,
  },
  {
    n: 11,
    displayName: 'Kévin Dijoux',
    email: 'kevin.dijoux@endirek.invalid',
    bio: 'Guide péi dans le cirque de Cilaos. Sentiers, lentilles et vin doux.',
    city: 'Cilaos',
    signupDaysAgo: 60,
  },
  {
    n: 12,
    displayName: 'Florence Hoarau',
    email: 'florence.hoarau@endirek.invalid',
    bio: 'Gîte à Hell-Bourg. Je partage mes photos de cascades de Salazie.',
    city: 'Salazie',
    signupDaysAgo: 50,
  },
  {
    n: 13,
    displayName: 'David Payet',
    email: 'david.payet@endirek.invalid',
    bio: 'Étudiant au Moufia. Bons plans et snacks de Saint-Denis.',
    city: 'Saint-Denis',
    signupDaysAgo: 40,
    hasCover: false,
  },
  {
    n: 14,
    displayName: 'Chloé Grondin',
    email: 'chloe.grondin@endirek.invalid',
    bio: 'Serveuse à la Ravine Blanche. Couchers de soleil de Saint-Pierre.',
    city: 'Saint-Pierre',
    signupDaysAgo: 30,
  },
  {
    n: 15,
    displayName: 'Marcel Técher',
    email: 'marcel.techer@endirek.invalid',
    bio: 'Retraité à Saint-Paul. Pas trop la technologie, mais j’essaie !',
    city: 'Saint-Paul',
    signupDaysAgo: 20,
    hasLocation: false,
    hasCover: false,
  },
];

/** Ancienneté d'inscription (jours) d'un utilisateur seed — sert aussi aux
 * entités « créées à l'inscription » (collection « Général », follows...). */
export function userSignupDaysAgo(n: number): number {
  const spec = USER_SPECS.find((s) => s.n === n);
  if (!spec) {
    throw new Error(`Seed users : utilisateur n°${n} inconnu.`);
  }
  return spec.signupDaysAgo;
}

function buildUser(spec: UserSpec): SeedUser {
  const createdAt = daysAgo(spec.signupDaysAgo);
  const pad = String(spec.n).padStart(2, '0');
  return {
    id: seedUuid('user', spec.n),
    email: spec.email,
    passwordHash: DEV_PASSWORD_HASH,
    displayName: spec.displayName,
    // Images picsum.photos : placeholders de DÉMO uniquement (aucune photo
    // de personne réelle) — remplacés par de vrais uploads au Lot 1 étape médias.
    avatarUrl: `https://picsum.photos/seed/endirek-avatar-${pad}/400/400`,
    coverUrl:
      spec.hasCover === false
        ? null
        : `https://picsum.photos/seed/endirek-cover-${pad}/400/400`,
    bio: spec.bio,
    city: spec.city,
    // Position publique APPROXIMATIVE (jitter ~1,2 km autour du centre-ville),
    // jamais une adresse exacte — posture vie privée assumée dès le seed.
    location:
      spec.hasLocation === false
        ? null
        : pointNear(communeByName(spec.city), 1200, spec.n),
    settings: {},
    role: spec.role ?? 'user',
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
}

/** Les 15 utilisateurs de démonstration — reconstruits À CHAQUE appel :
 * les dates relatives (daysAgo) sont recalculées et les objets sont neufs
 * (aucun partage entre deux instanciations du seed dans un même process). */
export function buildSeedUsers(): SeedUser[] {
  return USER_SPECS.map(buildUser);
}

// ────────────────────────────────────────────────────────────────────────────
// Follows — ~30 relations cohérentes (tout le monde suit le compte officiel,
// puis affinités géographiques et d'intérêt). Pas d'auto-suivi, pas de doublon
// (vérifié à la construction).
// ────────────────────────────────────────────────────────────────────────────

/** Paires (follower → followed) déclarées par numéro d'utilisateur seed. */
const FOLLOW_PAIRS: Array<[follower: number, followed: number]> = [
  // Tout le monde suit le compte officiel « Équipe Endirek ».
  [2, 1],
  [3, 1],
  [4, 1],
  [5, 1],
  [6, 1],
  [7, 1],
  [8, 1],
  [9, 1],
  [10, 1],
  [11, 1],
  [12, 1],
  [13, 1],
  [14, 1],
  [15, 1],
  // Voisinages : La Possession ↔ Le Port (trajets du Littoral).
  [9, 10],
  [10, 9],
  // Sud : Le Tampon ↔ Saint-Louis (covoiturage RN1/RN3).
  [3, 8],
  [8, 3],
  // Ouest : les deux Saint-Paulois se suivent.
  [4, 15],
  [15, 4],
  // Cirques : Cilaos ↔ Salazie (guides et gîtes).
  [11, 12],
  [12, 11],
  // Est : Saint-André ↔ Saint-Benoît.
  [5, 6],
  [6, 5],
  // Affinités diverses (photos, spots, trajets).
  [13, 14],
  [14, 2],
  [2, 14],
  [7, 11],
  [12, 6],
  [13, 9],
  [4, 12],
  [10, 7],
];

/** ~30 relations de suivi de démonstration — reconstruites à chaque appel
 * (dates relatives recalculées, objets neufs). */
export function buildSeedFollows(): Follow[] {
  const seen = new Set<string>();
  return FOLLOW_PAIRS.map(([follower, followed]) => {
    if (follower === followed) {
      throw new Error(`Seed follows : auto-suivi interdit (n°${follower}).`);
    }
    const key = `${follower}->${followed}`;
    if (seen.has(key)) {
      throw new Error(`Seed follows : doublon détecté (${key}).`);
    }
    seen.add(key);
    // Le suivi ne peut être antérieur à l'inscription du plus récent des deux.
    const minSignup = Math.min(
      userSignupDaysAgo(follower),
      userSignupDaysAgo(followed),
    );
    return {
      followerId: seedUuid('user', follower),
      followedId: seedUuid('user', followed),
      createdAt: daysAgo(Math.max(1, minSignup - 2)),
    };
  });
}
