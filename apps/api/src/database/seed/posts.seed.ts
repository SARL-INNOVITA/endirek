/**
 * Seed publications — 42 posts réalistes La Réunion + médias associés.
 *
 * Répartition : 9 weather, 8 traffic, 5 danger, 12 free, 8 question.
 * Chacune des 12 communes du référentiel apparaît dans au moins un post.
 *
 * Règles carte (miroir de la règle métier documentée sur `Post`) :
 * - weather/traffic/danger AVEC location → mapExpiresAt = createdAt + 120 min
 *   (durée par défaut de ces types dans post_types) ; environ un tiers sont
 *   volontairement déjà EXPIRÉS de la carte (créés il y a plus de 2 h) mais
 *   restent dans le feed ;
 * - 2 posts météo/trafic SANS location : cas « feed-only » légal (l'auteur
 *   n'a pas partagé de position → jamais sur la carte) ;
 * - free/question : jamais de mapExpiresAt, location facultative rare.
 */

import { PostMedia } from '../domain/entities';
import { SeedPost } from './index';
import { communeByName } from './communes';
import { minutesAgo, pointNear, seedUuid } from './seed-utils';

/** Types éligibles carte — miroir de post_types.shows_on_map. */
const MAP_TYPE_SLUGS = new Set(['weather', 'traffic', 'danger']);

/** Durée de vie carte par défaut (minutes) des types weather/traffic/danger —
 * miroir de post_types.default_map_duration_minutes (migration 0002). */
const MAP_DURATION_MINUTES = 120;

/** Spécification déclarative d'un post seed (le reste est dérivé). */
interface PostSpec {
  n: number;
  authorN: number;
  type: 'weather' | 'traffic' | 'danger' | 'free' | 'question';
  title: string | null;
  body: string;
  /** Commune affichée (champ `city`) — null pour un post « toute l'île ». */
  commune: string | null;
  /** Ancienneté en minutes (createdAt = minutesAgo(n)). */
  ageMinutes: number;
  /** Slug public unique et lisible de la future URL web. */
  slug: string;
  /** Défaut : true pour weather/traffic/danger, false pour free/question. */
  withLocation?: boolean;
  /** Rayon de jitter du point (mètres) — défaut 1200 m. */
  jitterMeters?: number;
  status?: 'active' | 'hidden';
}

const POST_SPECS: PostSpec[] = [
  // ── Météo (9) ─────────────────────────────────────────────────────────────
  {
    n: 1,
    authorN: 12,
    type: 'weather',
    title: 'Gros la pluie sur Salazie 🌧️',
    body: 'Ça tombe fort depuis ce matin à Hell-Bourg, les cascades sont impressionnantes. Prudence sur la route du cirque.',
    commune: 'Salazie',
    ageMinutes: 30,
    slug: 'pluie-salazie-h3b2',
  },
  {
    n: 2,
    authorN: 11,
    type: 'weather',
    title: 'Brouillard dans le cirque de Cilaos',
    body: 'Le brouillard est rentré d’un coup sur Cilaos, on n’y voit pas à 50 mètres du côté du Pavillon.',
    commune: 'Cilaos',
    ageMinutes: 45,
    slug: 'brouillard-cilaos-k9d4',
  },
  {
    n: 3,
    authorN: 3,
    type: 'weather',
    title: 'Brouillard épais à la Plaine des Cafres',
    body: 'Visibilité très réduite sur la RN3 entre le 23e et le 27e km. Allumez vos feux ⚠️',
    commune: 'Le Tampon',
    ageMinutes: 60,
    slug: 'brouillard-plaine-cafres-t5m1',
  },
  {
    n: 4,
    authorN: 7,
    type: 'weather',
    title: 'Belle houle à Saint-Leu 🌊',
    body: 'Séries de 2,5 m à la Gauche de Saint-Leu ce matin. Le spot envoie, mais restez prudents.',
    commune: 'Saint-Leu',
    ageMinutes: 90,
    slug: 'houle-saint-leu-s2w8',
  },
  {
    n: 5,
    authorN: 6,
    type: 'weather',
    title: 'Grosses averses sur l’Est',
    body: 'Ça n’arrête pas de tomber sur Saint-Benoît depuis midi. Les ravines commencent à monter.',
    commune: 'Saint-Benoît',
    ageMinutes: 180, // expiré de la carte (> 120 min)
    slug: 'averses-saint-benoit-e4r7',
  },
  {
    n: 6,
    authorN: 13,
    type: 'weather',
    title: 'Plein soleil sur le Barachois ☀️',
    body: 'Grand bleu sur Saint-Denis, pas un nuage. Profitez avant les averses annoncées cet après-midi !',
    commune: 'Saint-Denis',
    ageMinutes: 240, // expiré de la carte
    slug: 'soleil-barachois-d8s3',
  },
  {
    n: 7,
    authorN: 4,
    type: 'weather',
    title: 'Vent fort sur le front de mer de Saint-Paul',
    body: 'Grosses rafales sur la baie, les filaos plient sur la plage. Attention aux parasols 😅',
    commune: 'Saint-Paul',
    ageMinutes: 20,
    slug: 'vent-saint-paul-v6t2',
  },
  {
    n: 8,
    authorN: 14,
    type: 'weather',
    title: 'Ciel menaçant sur le Sud',
    body: 'Gros nuages noirs qui arrivent sur Saint-Pierre, gardez un œil si vous avez du linge dehors 😄',
    commune: 'Saint-Pierre',
    ageMinutes: 75,
    slug: 'ciel-menacant-sud-c1n9',
    withLocation: false, // cas feed-only : météo sans position partagée
  },
  {
    n: 9,
    authorN: 10,
    type: 'weather',
    title: 'Rafales au Port',
    body: 'Le vent s’est levé d’un coup, poussière partout du côté du chantier. Fermez les fenêtres.',
    commune: 'Le Port',
    ageMinutes: 300, // expiré de la carte
    slug: 'rafales-le-port-l7p5',
  },
  // ── Trafic (8) ────────────────────────────────────────────────────────────
  {
    n: 10,
    authorN: 9,
    type: 'traffic',
    title: 'Route du Littoral basculée',
    body: 'La Route du Littoral passe en basculement côté montagne suite aux pluies. Ça bouchonne déjà avant le tunnel.',
    commune: 'La Possession',
    ageMinutes: 5,
    slug: 'littoral-bascule-r4l1',
    jitterMeters: 600,
  },
  {
    n: 11,
    authorN: 13,
    type: 'traffic',
    title: 'Gros bouchon à l’entrée ouest de Saint-Denis',
    body: 'Comptez 45 minutes entre La Possession et le Barachois, c’est complètement bloqué à la Grande Chaloupe.',
    commune: 'Saint-Denis',
    ageMinutes: 25,
    slug: 'bouchon-entree-ouest-b2g6',
    jitterMeters: 600,
  },
  {
    n: 12,
    authorN: 10,
    type: 'traffic',
    title: 'Échangeur du Sacré-Cœur saturé',
    body: 'Accrochage à l’échangeur, une voie neutralisée. Passez par le centre-ville du Port si vous pouvez.',
    commune: 'Le Port',
    ageMinutes: 40,
    slug: 'echangeur-sacre-coeur-p9e3',
    jitterMeters: 600,
  },
  {
    n: 13,
    authorN: 15,
    type: 'traffic',
    title: 'Ralentissements sur la RN1 à Saint-Paul',
    body: 'Ça roule au pas dans le sens nord-sud à hauteur de Savanna, travaux sur la voie de droite.',
    commune: 'Saint-Paul',
    ageMinutes: 55,
    slug: 'ralentissements-rn1-m3s7',
    jitterMeters: 600,
  },
  {
    n: 14,
    authorN: 14,
    type: 'traffic',
    title: 'RN2 : accident dégagé, bouchon résiduel',
    body: 'L’accident au niveau de Grands Bois est dégagé, mais ça reste chargé en direction de Saint-Pierre.',
    commune: 'Saint-Pierre',
    ageMinutes: 150, // expiré de la carte
    slug: 'rn2-grands-bois-a5c2',
    jitterMeters: 600,
  },
  {
    n: 15,
    authorN: 5,
    type: 'traffic',
    title: 'Travaux sur la RN2 à Saint-André',
    body: 'Circulation alternée au niveau de la Cressonnière jusqu’à 17 h, prévoyez 10 minutes de plus.',
    commune: 'Saint-André',
    ageMinutes: 200, // expiré de la carte
    slug: 'travaux-rn2-saint-andre-d1t8',
    jitterMeters: 600,
  },
  {
    n: 16,
    authorN: 8,
    type: 'traffic',
    title: 'Bouchon RN1 au Ouaki',
    body: 'Comme tous les soirs, ça bloque direction Saint-Pierre. Prenez la route de la côte si vous êtes pressés.',
    commune: 'Saint-Louis',
    ageMinutes: 70,
    slug: 'bouchon-ouaki-n6o4',
    jitterMeters: 600,
  },
  {
    n: 17,
    authorN: 1,
    type: 'traffic',
    title: 'Grève des transporteurs demain matin',
    body: 'Des barrages filtrants sont annoncés demain sur la RN1 et la RN2. Prévoyez vos déplacements et privilégiez le covoiturage.',
    commune: null, // annonce « toute l'île »
    ageMinutes: 600,
    slug: 'greve-transporteurs-e9g1',
    withLocation: false, // cas feed-only : trafic sans position
  },
  // ── Danger (5) ────────────────────────────────────────────────────────────
  {
    n: 18,
    authorN: 6,
    type: 'danger',
    title: 'Radier submergé à Saint-Benoît ⚠️',
    body: 'Le radier de la Rivière des Roches est submergé, ne tentez pas le passage, même en 4x4 !',
    commune: 'Saint-Benoît',
    ageMinutes: 35,
    slug: 'radier-riviere-des-roches-r8d2',
    jitterMeters: 800,
  },
  {
    n: 19,
    authorN: 12,
    type: 'danger',
    title: 'Chute de pierres sur la route de Salazie',
    body: 'Des pierres sur la chaussée entre l’Escalier et Salazie village. Roulez doucement, les agents sont prévenus.',
    commune: 'Salazie',
    ageMinutes: 50,
    slug: 'chute-pierres-salazie-f2c5',
    jitterMeters: 800,
  },
  {
    n: 20,
    authorN: 7,
    type: 'danger',
    title: 'Baignade dangereuse à Saint-Leu',
    body: 'Drapeau rouge à la plage de Saint-Leu : forte houle et courants. On ne se met pas à l’eau aujourd’hui 🙏',
    commune: 'Saint-Leu',
    ageMinutes: 110,
    slug: 'baignade-drapeau-rouge-s4b9',
    jitterMeters: 800,
  },
  {
    n: 21,
    authorN: 3,
    type: 'danger',
    title: 'Accident sur la RN3 au Tampon',
    body: 'Collision entre deux voitures à hauteur de Trois-Mares, circulation alternée. Les secours sont sur place.',
    commune: 'Le Tampon',
    ageMinutes: 400, // expiré de la carte
    slug: 'accident-rn3-trois-mares-j7a3',
    jitterMeters: 800,
  },
  {
    n: 22,
    authorN: 11,
    type: 'danger',
    title: 'Éboulis dans les lacets de Cilaos',
    body: 'Petit éboulis au kilomètre 20 sur la RN5. Le passage se fait sur une voie, prudence dans les lacets.',
    commune: 'Cilaos',
    ageMinutes: 130, // expiré de la carte (de peu)
    slug: 'eboulis-rn5-cilaos-k1e6',
    jitterMeters: 800,
  },
  // ── Publications libres (12) ──────────────────────────────────────────────
  {
    n: 23,
    authorN: 13,
    type: 'free',
    title: 'Coucher de soleil sur le Barachois 😍',
    body: 'La vue de ce soir depuis les canons du Barachois... On ne s’en lasse pas.',
    commune: 'Saint-Denis',
    ageMinutes: 500,
    slug: 'coucher-soleil-barachois-d3f7',
  },
  {
    n: 24,
    authorN: 14,
    type: 'free',
    title: 'Marché forain de Saint-Pierre samedi',
    body: 'Le marché du front de mer sera bien ouvert samedi matin. Les ananas Victoria sont arrivés 🍍',
    commune: 'Saint-Pierre',
    ageMinutes: 700,
    slug: 'marche-forain-saint-pierre-c8m2',
  },
  {
    n: 25,
    authorN: 4,
    type: 'free',
    title: 'Dimanche plage à l’Ermitage',
    body: 'Pique-nique en famille sous les filaos, l’eau du lagon était parfaite. Les marmailles ont adoré !',
    commune: 'Saint-Paul',
    ageMinutes: 900,
    slug: 'dimanche-ermitage-v2p4',
  },
  {
    n: 26,
    authorN: 1,
    type: 'free',
    title: 'Coupure d’eau au Tampon jeudi',
    body: 'Une coupure d’eau est prévue jeudi de 8 h à 16 h sur les secteurs de la Châtoire et de Trois-Mares pour travaux sur le réseau.',
    commune: 'Le Tampon',
    ageMinutes: 350,
    slug: 'coupure-eau-tampon-e5c8',
  },
  {
    n: 27,
    authorN: 5,
    type: 'free',
    title: 'La campagne sucrière est lancée 🚜',
    body: 'Premiers camions de cannes sur la route de la balance à Bois-Rouge. Respect pour nos planteurs 💪',
    commune: 'Saint-André',
    ageMinutes: 1100,
    slug: 'campagne-sucriere-d6c1',
  },
  {
    n: 28,
    authorN: 9,
    type: 'free',
    title: 'Rando au Cap Noir ce matin',
    body: 'Petite montée depuis Dos d’Âne au lever du soleil, la vue sur Mafate est incroyable. Sentier en bon état.',
    commune: 'La Possession',
    ageMinutes: 1300,
    slug: 'rando-cap-noir-t4r9',
    withLocation: true, // rare post libre géolocalisé (départ du sentier)
    jitterMeters: 2000,
  },
  {
    n: 29,
    authorN: 11,
    type: 'free',
    title: 'Marché de Cilaos ce dimanche',
    body: 'Les producteurs du cirque seront au rendez-vous : lentilles, vin de Cilaos et miel. Venez tôt, ça part vite !',
    commune: 'Cilaos',
    ageMinutes: 1600,
    slug: 'marche-lentilles-cilaos-k5l3',
  },
  {
    n: 30,
    authorN: 12,
    type: 'free',
    title: 'Le Voile de la Mariée majestueux',
    body: 'Avec les pluies de la semaine, la cascade est magnifique. Arrêt photo obligatoire en montant sur Salazie 📸',
    commune: 'Salazie',
    ageMinutes: 1900,
    slug: 'voile-mariee-salazie-f9v2',
  },
  {
    n: 31,
    authorN: 10,
    type: 'free',
    title: 'Nouveau camion-bar au Port',
    body: 'Un camion-bar s’est installé près du stade Lambrakis le midi. Le sandwich sarcives vaut le détour 😋',
    commune: 'Le Port',
    ageMinutes: 2200,
    slug: 'camion-bar-le-port-l3f6',
  },
  {
    n: 32,
    authorN: 7,
    type: 'free',
    title: 'Session parapente au top',
    body: 'Décollage des Colimaçons parfait ce matin, thermiques au rendez-vous. Atterrissage tranquille sur la plage.',
    commune: 'Saint-Leu',
    ageMinutes: 2500,
    slug: 'parapente-colimacons-s7g4',
    withLocation: true, // rare post libre géolocalisé (site de décollage)
    jitterMeters: 2000,
  },
  {
    n: 33,
    authorN: 6,
    type: 'free',
    title: 'Pique-nique au bord de la Rivière des Marsouins',
    body: 'Dimanche en famille à Bethléem, carri poulet au feu de bois. Lé bon même !',
    commune: 'Saint-Benoît',
    ageMinutes: 2900,
    slug: 'pique-nique-bethleem-e2b7',
  },
  {
    n: 34,
    authorN: 15,
    type: 'free',
    title: 'Gagnez de l’argent facilement 💰',
    body: 'J’ai trouvé un site pour gagner 500 € par semaine sans rien faire, envoyez-moi un message pour avoir le lien !',
    commune: 'Saint-Paul',
    ageMinutes: 800,
    slug: 'gagnez-argent-facile-x0s9',
    // Masqué par la modération — correspond au signalement 'action_taken'
    // du seed interactions (arnaque confirmée, auteur averti).
    status: 'hidden',
  },
  // ── Questions / aide (8) ──────────────────────────────────────────────────
  {
    n: 35,
    authorN: 8,
    type: 'question',
    title: 'La route de Cilaos est-elle ouverte ?',
    body: 'Je dois monter à Cilaos demain matin avec des amis : quelqu’un sait si la RN5 est bien rouverte après l’éboulis ?',
    commune: 'Cilaos',
    ageMinutes: 65,
    slug: 'route-cilaos-ouverte-n2q1',
  },
  {
    n: 36,
    authorN: 14,
    type: 'question',
    title: 'Covoiturage Saint-Pierre → Saint-Denis',
    body: 'Je cherche un covoiturage lundi matin, départ vers 6 h de la Ravine Blanche, participation aux frais 🙂',
    commune: 'Saint-Pierre',
    ageMinutes: 480,
    slug: 'covoiturage-sud-nord-c4v8',
  },
  {
    n: 37,
    authorN: 3,
    type: 'question',
    title: 'Bon garagiste au Tampon ?',
    body: 'Ma clim auto a lâché. Vous connaissez un garagiste sérieux et pas trop cher sur le Tampon ?',
    commune: 'Le Tampon',
    ageMinutes: 1000,
    slug: 'garagiste-tampon-j9g2',
  },
  {
    n: 38,
    authorN: 4,
    type: 'question',
    title: 'Où voir les baleines en ce moment ? 🐋',
    body: 'Les premières baleines sont arrivées ! Vous les avez vues depuis quel spot ? Saint-Paul ? Saint-Leu ?',
    commune: 'Saint-Paul',
    ageMinutes: 1400,
    slug: 'baleines-spots-v7b1',
  },
  {
    n: 39,
    authorN: 5,
    type: 'question',
    title: 'Eau rétablie à Saint-André ?',
    body: 'La coupure d’eau du centre-ville est-elle terminée chez vous ? Toujours rien au robinet du côté de Cambuston...',
    commune: 'Saint-André',
    ageMinutes: 250,
    slug: 'eau-saint-andre-d4e9',
  },
  {
    n: 40,
    authorN: 15,
    type: 'question',
    title: 'Plage tranquille pour les marmailles ?',
    body: 'On cherche un coin de lagon calme pour le week-end avec des petits de 3 et 5 ans. Saint-Leu ? L’Ermitage ?',
    commune: 'Saint-Leu',
    ageMinutes: 1700,
    slug: 'plage-marmailles-m8p3',
  },
  {
    n: 41,
    authorN: 6,
    type: 'question',
    title: 'Vétérinaire de garde vers Saint-Benoît ?',
    body: 'Mon chien s’est blessé à la patte ce soir. Vous connaissez un vétérinaire de garde dans l’Est ?',
    commune: 'Saint-Benoît',
    ageMinutes: 2100,
    slug: 'veterinaire-garde-est-e7v5',
  },
  {
    n: 42,
    authorN: 13,
    type: 'question',
    title: 'Meilleur snack pour les bouchons gratinés ?',
    body: 'Débat du jour à la fac : c’est où les meilleurs bouchons gratinés de Saint-Denis ? 😄',
    commune: 'Saint-Denis',
    ageMinutes: 4320, // le plus ancien du seed (3 jours)
    slug: 'bouchons-gratines-d2s5',
  },
];

/** Nombre de posts du seed (partagé avec le seed interactions). */
export const POST_COUNT = POST_SPECS.length;

function specByN(n: number): PostSpec {
  const spec = POST_SPECS.find((s) => s.n === n);
  if (!spec) {
    throw new Error(`Seed posts : post n°${n} inconnu.`);
  }
  return spec;
}

/** Ancienneté (minutes) d'un post seed — permet aux commentaires/réactions
 * du seed interactions d'être toujours POSTÉRIEURS à leur post. */
export function postAgeMinutes(n: number): number {
  return specByN(n).ageMinutes;
}

/** Numéro d'auteur d'un post seed — permet au seed interactions d'éviter
 * les réactions d'un auteur sur son propre contenu. */
export function postAuthorN(n: number): number {
  return specByN(n).authorN;
}

function buildPost(spec: PostSpec): SeedPost {
  const createdAt = minutesAgo(spec.ageMinutes);
  const isMapType = MAP_TYPE_SLUGS.has(spec.type);
  const hasLocation = spec.withLocation ?? isMapType;
  const location =
    hasLocation && spec.commune !== null
      ? pointNear(communeByName(spec.commune), spec.jitterMeters ?? 1200, 100 + spec.n)
      : null;
  return {
    id: seedUuid('post', spec.n),
    authorId: seedUuid('user', spec.authorN),
    pageId: null, // les posts DE PAGE du seed vivent dans pages.seed.ts (Lot 3)
    typeSlug: spec.type,
    title: spec.title,
    body: spec.body,
    location,
    city: spec.commune,
    visibility: 'public',
    status: spec.status ?? 'active',
    urlSlug: spec.slug,
    // Le service posera cette date à la création : reproduit ici à l'identique.
    mapExpiresAt:
      isMapType && location !== null
        ? new Date(createdAt.getTime() + MAP_DURATION_MINUTES * 60_000)
        : null,
    mapVisibleFrom: null, // visibilité différée réservée aux événements de page (D73)
    createdAt,
    updatedAt: createdAt,
  };
}

/** Les 42 publications de démonstration — reconstruites À CHAQUE appel :
 * les dates relatives (minutesAgo, mapExpiresAt) sont recalculées et les
 * objets sont neufs (aucun partage entre deux instanciations du seed). */
export function buildSeedPosts(): SeedPost[] {
  const slugs = new Set<string>();
  const ns = new Set<number>();
  for (const spec of POST_SPECS) {
    if (slugs.has(spec.slug)) {
      throw new Error(`Seed posts : url_slug en doublon (« ${spec.slug} »).`);
    }
    if (ns.has(spec.n)) {
      throw new Error(`Seed posts : numéro en doublon (n°${spec.n}).`);
    }
    slugs.add(spec.slug);
    ns.add(spec.n);
  }
  return POST_SPECS.map(buildPost);
}

// ────────────────────────────────────────────────────────────────────────────
// Médias — 8 posts illustrés (1 à 3 images chacun). URLs picsum.photos :
// placeholders de DÉMO uniquement, remplacés par de vrais uploads plus tard.
// ────────────────────────────────────────────────────────────────────────────

/** Spécification : quel post, combien d'images, base du slug picsum. */
const MEDIA_SPECS: Array<{ postN: number; slugBase: string; count: number }> = [
  { postN: 4, slugBase: 'houle-saint-leu', count: 1 },
  { postN: 19, slugBase: 'chute-pierres-salazie', count: 1 },
  { postN: 23, slugBase: 'coucher-soleil-barachois', count: 1 },
  { postN: 25, slugBase: 'dimanche-ermitage', count: 2 },
  { postN: 28, slugBase: 'rando-cap-noir', count: 2 },
  { postN: 29, slugBase: 'marche-cilaos', count: 1 },
  { postN: 30, slugBase: 'voile-mariee-salazie', count: 3 },
  { postN: 32, slugBase: 'parapente-colimacons', count: 1 },
];

/** Les 12 médias image de démonstration — reconstruits à chaque appel
 * (dates relatives recalculées, objets neufs). */
export function buildSeedPostMedia(): PostMedia[] {
  const media: PostMedia[] = [];
  let mediaN = 1;
  for (const spec of MEDIA_SPECS) {
    const createdAt = minutesAgo(postAgeMinutes(spec.postN));
    for (let position = 1; position <= spec.count; position++) {
      const slug = `${spec.slugBase}-${position}`;
      media.push({
        id: seedUuid('media', mediaN++),
        postId: seedUuid('post', spec.postN),
        mediaType: 'image',
        url: `https://picsum.photos/seed/${slug}/800/450`,
        thumbnailUrl: `https://picsum.photos/seed/${slug}/400/225`,
        width: 800,
        height: 450,
        position,
        createdAt,
      });
    }
  }
  return media;
}
