/**
 * Données de référence de la taxonomie Dealplace — MIROIR EXACT de la migration
 * db/migrations/0004_dealplace_reference.sql.
 *
 * Comme POST_TYPE_ROWS / REACTION_TYPE_ROWS (mock-database.service.ts), ces
 * lignes sont chargées EN DUR par le driver mock au boot : les repositories en
 * dépendent (comme les FK côté SQL). Pilotables ensuite via le backoffice
 * (ListingTaxonomyRepository.updateCategory/...).
 *
 * Toute évolution ici DOIT rester synchronisée avec 0004 (parité mock/postgres).
 */

import {
  ListingCategory,
  ListingSubcategory,
  ListingTag,
} from '../domain/entities';

/** Ligne catégorie sans horodatages (posés au chargement). */
export type ListingCategoryRow = Omit<
  ListingCategory,
  'createdAt' | 'updatedAt'
>;

/** Ligne sous-catégorie sans horodatages. */
export type ListingSubcategoryRow = Omit<
  ListingSubcategory,
  'createdAt' | 'updatedAt'
>;

/** Ligne tag sans horodatages. */
export type ListingTagRow = Omit<ListingTag, 'createdAt' | 'updatedAt'>;

// ────────────────────────────────────────────────────────────────────────────
// Catégories — 10 Biens (positions 1..10) + 10 Services (positions 11..20).
// moderation_level : 'sensitive' pour Véhicules/mobilité et Bien-être/beauté ;
// 'standard' partout ailleurs (miroir 0004).
// ────────────────────────────────────────────────────────────────────────────

export const LISTING_CATEGORY_ROWS: ListingCategoryRow[] = [
  // Biens.
  { slug: 'maison-mobilier-electromenager', family: 'good', labelFr: 'Maison, mobilier & électroménager', position: 1, moderationLevel: 'standard', isActive: true },
  { slug: 'electronique-multimedia', family: 'good', labelFr: 'Électronique & multimédia', position: 2, moderationLevel: 'standard', isActive: true },
  { slug: 'mode-accessoires', family: 'good', labelFr: 'Mode & accessoires', position: 3, moderationLevel: 'standard', isActive: true },
  { slug: 'bebe-enfant', family: 'good', labelFr: 'Bébé & enfant', position: 4, moderationLevel: 'standard', isActive: true },
  { slug: 'sport-loisirs-culture', family: 'good', labelFr: 'Sport, loisirs & culture', position: 5, moderationLevel: 'standard', isActive: true },
  { slug: 'vehicules-mobilite', family: 'good', labelFr: 'Véhicules & mobilité', position: 6, moderationLevel: 'sensitive', isActive: true },
  { slug: 'bricolage-jardin-agriculture', family: 'good', labelFr: 'Bricolage, jardin & agriculture', position: 7, moderationLevel: 'standard', isActive: true },
  { slug: 'produits-locaux-artisanat', family: 'good', labelFr: 'Produits locaux & artisanat', position: 8, moderationLevel: 'standard', isActive: true },
  { slug: 'materiel-pro-espaces', family: 'good', labelFr: 'Matériel pro & espaces', position: 9, moderationLevel: 'standard', isActive: true },
  { slug: 'dons-autres-biens', family: 'good', labelFr: 'Dons & autres biens', position: 10, moderationLevel: 'standard', isActive: true },
  // Services.
  { slug: 'travaux-entretien-reparation', family: 'service', labelFr: 'Travaux, entretien & réparation', position: 11, moderationLevel: 'standard', isActive: true },
  { slug: 'transport-livraison', family: 'service', labelFr: 'Transport & livraison', position: 12, moderationLevel: 'standard', isActive: true },
  { slug: 'numerique-informatique', family: 'service', labelFr: 'Numérique & informatique', position: 13, moderationLevel: 'standard', isActive: true },
  { slug: 'communication-creation', family: 'service', labelFr: 'Communication & création', position: 14, moderationLevel: 'standard', isActive: true },
  { slug: 'cours-formation', family: 'service', labelFr: 'Cours & formation', position: 15, moderationLevel: 'standard', isActive: true },
  { slug: 'bien-etre-beaute-forme', family: 'service', labelFr: 'Bien-être, beauté & forme', position: 16, moderationLevel: 'sensitive', isActive: true },
  { slug: 'evenementiel-restauration', family: 'service', labelFr: 'Événementiel & restauration', position: 17, moderationLevel: 'standard', isActive: true },
  { slug: 'services-personnes-animaux', family: 'service', labelFr: 'Services aux personnes & animaux', position: 18, moderationLevel: 'standard', isActive: true },
  { slug: 'business-administratif-comptabilite', family: 'service', labelFr: 'Business, administratif & comptabilité', position: 19, moderationLevel: 'standard', isActive: true },
  { slug: 'tourisme-loisirs-experiences', family: 'service', labelFr: 'Tourisme, loisirs & expériences', position: 20, moderationLevel: 'standard', isActive: true },
];

// ────────────────────────────────────────────────────────────────────────────
// Sous-catégories — 2 à 3 par catégorie + une sous-catégorie de repli
// « autres-<cat> » (label « Autres », position 99) pour CHAQUE catégorie.
// ────────────────────────────────────────────────────────────────────────────

export const LISTING_SUBCATEGORY_ROWS: ListingSubcategoryRow[] = [
  // Biens : Maison, mobilier & électroménager.
  { slug: 'meubles', categorySlug: 'maison-mobilier-electromenager', labelFr: 'Meubles', position: 1, isActive: true },
  { slug: 'electromenager', categorySlug: 'maison-mobilier-electromenager', labelFr: 'Électroménager', position: 2, isActive: true },
  { slug: 'decoration-linge', categorySlug: 'maison-mobilier-electromenager', labelFr: 'Décoration & linge de maison', position: 3, isActive: true },
  { slug: 'autres-maison-mobilier-electromenager', categorySlug: 'maison-mobilier-electromenager', labelFr: 'Autres', position: 99, isActive: true },
  // Biens : Électronique & multimédia.
  { slug: 'telephonie', categorySlug: 'electronique-multimedia', labelFr: 'Téléphonie', position: 1, isActive: true },
  { slug: 'informatique', categorySlug: 'electronique-multimedia', labelFr: 'Informatique', position: 2, isActive: true },
  { slug: 'image-son', categorySlug: 'electronique-multimedia', labelFr: 'Image & son', position: 3, isActive: true },
  { slug: 'autres-electronique-multimedia', categorySlug: 'electronique-multimedia', labelFr: 'Autres', position: 99, isActive: true },
  // Biens : Mode & accessoires.
  { slug: 'vetements', categorySlug: 'mode-accessoires', labelFr: 'Vêtements', position: 1, isActive: true },
  { slug: 'chaussures', categorySlug: 'mode-accessoires', labelFr: 'Chaussures', position: 2, isActive: true },
  { slug: 'sacs-accessoires', categorySlug: 'mode-accessoires', labelFr: 'Sacs & accessoires', position: 3, isActive: true },
  { slug: 'autres-mode-accessoires', categorySlug: 'mode-accessoires', labelFr: 'Autres', position: 99, isActive: true },
  // Biens : Bébé & enfant.
  { slug: 'puericulture', categorySlug: 'bebe-enfant', labelFr: 'Puériculture', position: 1, isActive: true },
  { slug: 'vetements-enfant', categorySlug: 'bebe-enfant', labelFr: 'Vêtements enfant', position: 2, isActive: true },
  { slug: 'jouets', categorySlug: 'bebe-enfant', labelFr: 'Jouets', position: 3, isActive: true },
  { slug: 'autres-bebe-enfant', categorySlug: 'bebe-enfant', labelFr: 'Autres', position: 99, isActive: true },
  // Biens : Sport, loisirs & culture.
  { slug: 'sport-fitness', categorySlug: 'sport-loisirs-culture', labelFr: 'Sport & fitness', position: 1, isActive: true },
  { slug: 'instruments-musique', categorySlug: 'sport-loisirs-culture', labelFr: 'Instruments de musique', position: 2, isActive: true },
  { slug: 'livres-jeux', categorySlug: 'sport-loisirs-culture', labelFr: 'Livres & jeux', position: 3, isActive: true },
  { slug: 'autres-sport-loisirs-culture', categorySlug: 'sport-loisirs-culture', labelFr: 'Autres', position: 99, isActive: true },
  // Biens : Véhicules & mobilité.
  { slug: 'voitures', categorySlug: 'vehicules-mobilite', labelFr: 'Voitures', position: 1, isActive: true },
  { slug: 'deux-roues', categorySlug: 'vehicules-mobilite', labelFr: 'Deux-roues', position: 2, isActive: true },
  { slug: 'velos-trottinettes', categorySlug: 'vehicules-mobilite', labelFr: 'Vélos & trottinettes', position: 3, isActive: true },
  { slug: 'autres-vehicules-mobilite', categorySlug: 'vehicules-mobilite', labelFr: 'Autres', position: 99, isActive: true },
  // Biens : Bricolage, jardin & agriculture.
  { slug: 'outillage', categorySlug: 'bricolage-jardin-agriculture', labelFr: 'Outillage', position: 1, isActive: true },
  { slug: 'jardin-plantes', categorySlug: 'bricolage-jardin-agriculture', labelFr: 'Jardin & plantes', position: 2, isActive: true },
  { slug: 'materiaux', categorySlug: 'bricolage-jardin-agriculture', labelFr: 'Matériaux', position: 3, isActive: true },
  { slug: 'autres-bricolage-jardin-agriculture', categorySlug: 'bricolage-jardin-agriculture', labelFr: 'Autres', position: 99, isActive: true },
  // Biens : Produits locaux & artisanat.
  { slug: 'produits-fermiers', categorySlug: 'produits-locaux-artisanat', labelFr: 'Produits fermiers', position: 1, isActive: true },
  { slug: 'artisanat-pei', categorySlug: 'produits-locaux-artisanat', labelFr: 'Artisanat péi', position: 2, isActive: true },
  { slug: 'epices-preparations', categorySlug: 'produits-locaux-artisanat', labelFr: 'Épices & préparations', position: 3, isActive: true },
  { slug: 'autres-produits-locaux-artisanat', categorySlug: 'produits-locaux-artisanat', labelFr: 'Autres', position: 99, isActive: true },
  // Biens : Matériel pro & espaces.
  { slug: 'materiel-professionnel', categorySlug: 'materiel-pro-espaces', labelFr: 'Matériel professionnel', position: 1, isActive: true },
  { slug: 'mobilier-pro', categorySlug: 'materiel-pro-espaces', labelFr: 'Mobilier professionnel', position: 2, isActive: true },
  { slug: 'locaux-espaces', categorySlug: 'materiel-pro-espaces', labelFr: 'Locaux & espaces', position: 3, isActive: true },
  { slug: 'autres-materiel-pro-espaces', categorySlug: 'materiel-pro-espaces', labelFr: 'Autres', position: 99, isActive: true },
  // Biens : Dons & autres biens.
  { slug: 'dons', categorySlug: 'dons-autres-biens', labelFr: 'Dons', position: 1, isActive: true },
  { slug: 'a-recuperer', categorySlug: 'dons-autres-biens', labelFr: 'À récupérer', position: 2, isActive: true },
  { slug: 'autres-dons-autres-biens', categorySlug: 'dons-autres-biens', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Travaux, entretien & réparation.
  { slug: 'renovation-batiment', categorySlug: 'travaux-entretien-reparation', labelFr: 'Rénovation & bâtiment', position: 1, isActive: true },
  { slug: 'plomberie-electricite', categorySlug: 'travaux-entretien-reparation', labelFr: 'Plomberie & électricité', position: 2, isActive: true },
  { slug: 'menage-entretien', categorySlug: 'travaux-entretien-reparation', labelFr: 'Ménage & entretien', position: 3, isActive: true },
  { slug: 'autres-travaux-entretien-reparation', categorySlug: 'travaux-entretien-reparation', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Transport & livraison.
  { slug: 'demenagement', categorySlug: 'transport-livraison', labelFr: 'Déménagement', position: 1, isActive: true },
  { slug: 'livraison-coursier', categorySlug: 'transport-livraison', labelFr: 'Livraison & coursier', position: 2, isActive: true },
  { slug: 'covoiturage', categorySlug: 'transport-livraison', labelFr: 'Covoiturage', position: 3, isActive: true },
  { slug: 'autres-transport-livraison', categorySlug: 'transport-livraison', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Numérique & informatique.
  { slug: 'depannage-info', categorySlug: 'numerique-informatique', labelFr: 'Dépannage informatique', position: 1, isActive: true },
  { slug: 'developpement-web', categorySlug: 'numerique-informatique', labelFr: 'Développement web', position: 2, isActive: true },
  { slug: 'reseaux-installation', categorySlug: 'numerique-informatique', labelFr: 'Réseaux & installation', position: 3, isActive: true },
  { slug: 'autres-numerique-informatique', categorySlug: 'numerique-informatique', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Communication & création.
  { slug: 'graphisme-design', categorySlug: 'communication-creation', labelFr: 'Graphisme & design', position: 1, isActive: true },
  { slug: 'photo-video', categorySlug: 'communication-creation', labelFr: 'Photo & vidéo', position: 2, isActive: true },
  { slug: 'redaction-traduction', categorySlug: 'communication-creation', labelFr: 'Rédaction & traduction', position: 3, isActive: true },
  { slug: 'autres-communication-creation', categorySlug: 'communication-creation', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Cours & formation.
  { slug: 'soutien-scolaire', categorySlug: 'cours-formation', labelFr: 'Soutien scolaire', position: 1, isActive: true },
  { slug: 'cours-langues', categorySlug: 'cours-formation', labelFr: 'Cours de langues', position: 2, isActive: true },
  { slug: 'cours-musique-art', categorySlug: 'cours-formation', labelFr: 'Cours de musique & art', position: 3, isActive: true },
  { slug: 'autres-cours-formation', categorySlug: 'cours-formation', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Bien-être, beauté & forme.
  { slug: 'coiffure-esthetique', categorySlug: 'bien-etre-beaute-forme', labelFr: 'Coiffure & esthétique', position: 1, isActive: true },
  { slug: 'massage-detente', categorySlug: 'bien-etre-beaute-forme', labelFr: 'Massage & détente', position: 2, isActive: true },
  { slug: 'coaching-sportif', categorySlug: 'bien-etre-beaute-forme', labelFr: 'Coaching sportif', position: 3, isActive: true },
  { slug: 'autres-bien-etre-beaute-forme', categorySlug: 'bien-etre-beaute-forme', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Événementiel & restauration.
  { slug: 'traiteur', categorySlug: 'evenementiel-restauration', labelFr: 'Traiteur', position: 1, isActive: true },
  { slug: 'animation-dj', categorySlug: 'evenementiel-restauration', labelFr: 'Animation & DJ', position: 2, isActive: true },
  { slug: 'location-materiel-evenement', categorySlug: 'evenementiel-restauration', labelFr: 'Location de matériel', position: 3, isActive: true },
  { slug: 'autres-evenementiel-restauration', categorySlug: 'evenementiel-restauration', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Services aux personnes & animaux.
  { slug: 'garde-enfants', categorySlug: 'services-personnes-animaux', labelFr: "Garde d'enfants", position: 1, isActive: true },
  { slug: 'aide-domicile', categorySlug: 'services-personnes-animaux', labelFr: 'Aide à domicile', position: 2, isActive: true },
  { slug: 'garde-animaux', categorySlug: 'services-personnes-animaux', labelFr: "Garde d'animaux", position: 3, isActive: true },
  { slug: 'autres-services-personnes-animaux', categorySlug: 'services-personnes-animaux', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Business, administratif & comptabilité.
  { slug: 'comptabilite-gestion', categorySlug: 'business-administratif-comptabilite', labelFr: 'Comptabilité & gestion', position: 1, isActive: true },
  { slug: 'conseil-juridique', categorySlug: 'business-administratif-comptabilite', labelFr: 'Conseil juridique', position: 2, isActive: true },
  { slug: 'secretariat', categorySlug: 'business-administratif-comptabilite', labelFr: 'Secrétariat', position: 3, isActive: true },
  { slug: 'autres-business-administratif-comptabilite', categorySlug: 'business-administratif-comptabilite', labelFr: 'Autres', position: 99, isActive: true },
  // Services : Tourisme, loisirs & expériences.
  { slug: 'guides-randonnee', categorySlug: 'tourisme-loisirs-experiences', labelFr: 'Guides & randonnée', position: 1, isActive: true },
  { slug: 'hebergement-insolite', categorySlug: 'tourisme-loisirs-experiences', labelFr: 'Hébergement insolite', position: 2, isActive: true },
  { slug: 'activites-nautiques', categorySlug: 'tourisme-loisirs-experiences', labelFr: 'Activités nautiques', position: 3, isActive: true },
  { slug: 'autres-tourisme-loisirs-experiences', categorySlug: 'tourisme-loisirs-experiences', labelFr: 'Autres', position: 99, isActive: true },
];

// ────────────────────────────────────────────────────────────────────────────
// Tags transversaux (~10).
// ────────────────────────────────────────────────────────────────────────────

export const LISTING_TAG_ROWS: ListingTagRow[] = [
  { slug: 'urgent', labelFr: 'Urgent', isActive: true },
  { slug: 'gratuit', labelFr: 'Gratuit', isActive: true },
  { slug: 'pro', labelFr: 'Pro', isActive: true },
  { slug: 'occasion', labelFr: 'Occasion', isActive: true },
  { slug: 'neuf', labelFr: 'Neuf', isActive: true },
  { slug: 'local', labelFr: 'Local', isActive: true },
  { slug: 'livraison', labelFr: 'Livraison possible', isActive: true },
  { slug: 'echange-ok', labelFr: 'Échange OK', isActive: true },
  { slug: 'negociable', labelFr: 'Négociable', isActive: true },
  { slug: 'fait-main', labelFr: 'Fait main', isActive: true },
];
