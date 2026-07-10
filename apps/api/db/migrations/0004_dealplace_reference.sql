-- ============================================================================
-- ENDIREK — Lot 2 — CP2.1 — Migration 0004 : données de référence Dealplace
-- ============================================================================
-- Peuple la taxonomie Dealplace (familles Biens/Services du PRD MVP) :
--   - 20 catégories (10 biens + 10 services) ;
--   - 2 à 3 sous-catégories plausibles par catégorie + une sous-catégorie de
--     repli « autres-<cat> » (label « Autres ») pour CHAQUE catégorie ;
--   - ~10 tags transversaux.
--
-- REJOUABLE : tous les INSERT utilisent ON CONFLICT (slug) DO NOTHING, donc
-- relancer ce fichier ne duplique rien et n'écrase pas les ajustements faits
-- ensuite depuis le backoffice (libellés, positions, activation, niveau de
-- modération).
--
-- Le mock TypeScript (MockDatabaseService) embarque ces mêmes lignes en dur,
-- miroir exact de ce fichier (parité mock/postgres).
--
-- Fichier à enregistrer/exécuter en UTF-8 (accents dans les libellés).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Catégories — famille BIENS ('good'). Positions 1..10.
-- moderation_level : 'standard' partout SAUF Véhicules/mobilité ('sensitive').
-- ----------------------------------------------------------------------------
INSERT INTO listing_categories (slug, family, label_fr, position, moderation_level) VALUES
  ('maison-mobilier-electromenager', 'good', 'Maison, mobilier & électroménager', 1, 'standard'),
  ('electronique-multimedia',        'good', 'Électronique & multimédia',         2, 'standard'),
  ('mode-accessoires',               'good', 'Mode & accessoires',                3, 'standard'),
  ('bebe-enfant',                    'good', 'Bébé & enfant',                     4, 'standard'),
  ('sport-loisirs-culture',          'good', 'Sport, loisirs & culture',          5, 'standard'),
  ('vehicules-mobilite',             'good', 'Véhicules & mobilité',              6, 'sensitive'),
  ('bricolage-jardin-agriculture',   'good', 'Bricolage, jardin & agriculture',   7, 'standard'),
  ('produits-locaux-artisanat',      'good', 'Produits locaux & artisanat',       8, 'standard'),
  ('materiel-pro-espaces',           'good', 'Matériel pro & espaces',            9, 'standard'),
  ('dons-autres-biens',              'good', 'Dons & autres biens',              10, 'standard')
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Catégories — famille SERVICES ('service'). Positions 11..20.
-- moderation_level : 'standard' partout SAUF Bien-être/beauté/forme
-- ('sensitive', prestations à la personne).
-- ----------------------------------------------------------------------------
INSERT INTO listing_categories (slug, family, label_fr, position, moderation_level) VALUES
  ('travaux-entretien-reparation',        'service', 'Travaux, entretien & réparation',          11, 'standard'),
  ('transport-livraison',                 'service', 'Transport & livraison',                    12, 'standard'),
  ('numerique-informatique',              'service', 'Numérique & informatique',                 13, 'standard'),
  ('communication-creation',              'service', 'Communication & création',                 14, 'standard'),
  ('cours-formation',                     'service', 'Cours & formation',                        15, 'standard'),
  ('bien-etre-beaute-forme',              'service', 'Bien-être, beauté & forme',                16, 'sensitive'),
  ('evenementiel-restauration',           'service', 'Événementiel & restauration',              17, 'standard'),
  ('services-personnes-animaux',          'service', 'Services aux personnes & animaux',         18, 'standard'),
  ('business-administratif-comptabilite', 'service', 'Business, administratif & comptabilité',   19, 'standard'),
  ('tourisme-loisirs-experiences',        'service', 'Tourisme, loisirs & expériences',          20, 'standard')
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Sous-catégories. Pour chaque catégorie : 2-3 sous-catégories plausibles
-- (positions 1..n) PUIS la sous-catégorie de repli « autres-<cat> » (label
-- « Autres », position 99) — repli garanti pour toute catégorie.
-- ----------------------------------------------------------------------------

-- Biens : Maison, mobilier & électroménager.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('meubles',            'maison-mobilier-electromenager', 'Meubles',                        1),
  ('electromenager',     'maison-mobilier-electromenager', 'Électroménager',                 2),
  ('decoration-linge',   'maison-mobilier-electromenager', 'Décoration & linge de maison',   3),
  ('autres-maison-mobilier-electromenager', 'maison-mobilier-electromenager', 'Autres',    99)
ON CONFLICT (slug) DO NOTHING;

-- Biens : Électronique & multimédia.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('telephonie',           'electronique-multimedia', 'Téléphonie',                    1),
  ('informatique',         'electronique-multimedia', 'Informatique',                  2),
  ('image-son',            'electronique-multimedia', 'Image & son',                   3),
  ('autres-electronique-multimedia', 'electronique-multimedia', 'Autres',            99)
ON CONFLICT (slug) DO NOTHING;

-- Biens : Mode & accessoires.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('vetements',        'mode-accessoires', 'Vêtements',                   1),
  ('chaussures',       'mode-accessoires', 'Chaussures',                  2),
  ('sacs-accessoires', 'mode-accessoires', 'Sacs & accessoires',          3),
  ('autres-mode-accessoires', 'mode-accessoires', 'Autres',             99)
ON CONFLICT (slug) DO NOTHING;

-- Biens : Bébé & enfant.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('puericulture',        'bebe-enfant', 'Puériculture',              1),
  ('vetements-enfant',    'bebe-enfant', 'Vêtements enfant',          2),
  ('jouets',              'bebe-enfant', 'Jouets',                    3),
  ('autres-bebe-enfant',  'bebe-enfant', 'Autres',                   99)
ON CONFLICT (slug) DO NOTHING;

-- Biens : Sport, loisirs & culture.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('sport-fitness',           'sport-loisirs-culture', 'Sport & fitness',        1),
  ('instruments-musique',     'sport-loisirs-culture', 'Instruments de musique', 2),
  ('livres-jeux',             'sport-loisirs-culture', 'Livres & jeux',          3),
  ('autres-sport-loisirs-culture', 'sport-loisirs-culture', 'Autres',          99)
ON CONFLICT (slug) DO NOTHING;

-- Biens : Véhicules & mobilité.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('voitures',                 'vehicules-mobilite', 'Voitures',                    1),
  ('deux-roues',               'vehicules-mobilite', 'Deux-roues',                  2),
  ('velos-trottinettes',       'vehicules-mobilite', 'Vélos & trottinettes',        3),
  ('autres-vehicules-mobilite', 'vehicules-mobilite', 'Autres',                   99)
ON CONFLICT (slug) DO NOTHING;

-- Biens : Bricolage, jardin & agriculture.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('outillage',            'bricolage-jardin-agriculture', 'Outillage',                 1),
  ('jardin-plantes',       'bricolage-jardin-agriculture', 'Jardin & plantes',          2),
  ('materiaux',            'bricolage-jardin-agriculture', 'Matériaux',                 3),
  ('autres-bricolage-jardin-agriculture', 'bricolage-jardin-agriculture', 'Autres',   99)
ON CONFLICT (slug) DO NOTHING;

-- Biens : Produits locaux & artisanat.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('produits-fermiers',    'produits-locaux-artisanat', 'Produits fermiers',      1),
  ('artisanat-pei',        'produits-locaux-artisanat', 'Artisanat péi',          2),
  ('epices-preparations',  'produits-locaux-artisanat', 'Épices & préparations',  3),
  ('autres-produits-locaux-artisanat', 'produits-locaux-artisanat', 'Autres',    99)
ON CONFLICT (slug) DO NOTHING;

-- Biens : Matériel pro & espaces.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('materiel-professionnel', 'materiel-pro-espaces', 'Matériel professionnel',    1),
  ('mobilier-pro',           'materiel-pro-espaces', 'Mobilier professionnel',    2),
  ('locaux-espaces',         'materiel-pro-espaces', 'Locaux & espaces',          3),
  ('autres-materiel-pro-espaces', 'materiel-pro-espaces', 'Autres',             99)
ON CONFLICT (slug) DO NOTHING;

-- Biens : Dons & autres biens.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('dons',                 'dons-autres-biens', 'Dons',              1),
  ('a-recuperer',          'dons-autres-biens', 'À récupérer',       2),
  ('autres-dons-autres-biens', 'dons-autres-biens', 'Autres',       99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Travaux, entretien & réparation.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('renovation-batiment',  'travaux-entretien-reparation', 'Rénovation & bâtiment',      1),
  ('plomberie-electricite','travaux-entretien-reparation', 'Plomberie & électricité',    2),
  ('menage-entretien',     'travaux-entretien-reparation', 'Ménage & entretien',         3),
  ('autres-travaux-entretien-reparation', 'travaux-entretien-reparation', 'Autres',     99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Transport & livraison.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('demenagement',         'transport-livraison', 'Déménagement',           1),
  ('livraison-coursier',   'transport-livraison', 'Livraison & coursier',   2),
  ('covoiturage',          'transport-livraison', 'Covoiturage',            3),
  ('autres-transport-livraison', 'transport-livraison', 'Autres',          99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Numérique & informatique.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('depannage-info',       'numerique-informatique', 'Dépannage informatique', 1),
  ('developpement-web',    'numerique-informatique', 'Développement web',      2),
  ('reseaux-installation', 'numerique-informatique', 'Réseaux & installation', 3),
  ('autres-numerique-informatique', 'numerique-informatique', 'Autres',       99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Communication & création.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('graphisme-design',     'communication-creation', 'Graphisme & design',      1),
  ('photo-video',          'communication-creation', 'Photo & vidéo',           2),
  ('redaction-traduction', 'communication-creation', 'Rédaction & traduction',  3),
  ('autres-communication-creation', 'communication-creation', 'Autres',        99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Cours & formation.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('soutien-scolaire',     'cours-formation', 'Soutien scolaire',      1),
  ('cours-langues',        'cours-formation', 'Cours de langues',      2),
  ('cours-musique-art',    'cours-formation', 'Cours de musique & art', 3),
  ('autres-cours-formation', 'cours-formation', 'Autres',             99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Bien-être, beauté & forme.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('coiffure-esthetique',  'bien-etre-beaute-forme', 'Coiffure & esthétique',   1),
  ('massage-detente',      'bien-etre-beaute-forme', 'Massage & détente',       2),
  ('coaching-sportif',     'bien-etre-beaute-forme', 'Coaching sportif',        3),
  ('autres-bien-etre-beaute-forme', 'bien-etre-beaute-forme', 'Autres',        99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Événementiel & restauration.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('traiteur',             'evenementiel-restauration', 'Traiteur',                 1),
  ('animation-dj',         'evenementiel-restauration', 'Animation & DJ',           2),
  ('location-materiel-evenement', 'evenementiel-restauration', 'Location de matériel', 3),
  ('autres-evenementiel-restauration', 'evenementiel-restauration', 'Autres',      99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Services aux personnes & animaux.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('garde-enfants',        'services-personnes-animaux', 'Garde d''enfants',        1),
  ('aide-domicile',        'services-personnes-animaux', 'Aide à domicile',         2),
  ('garde-animaux',        'services-personnes-animaux', 'Garde d''animaux',        3),
  ('autres-services-personnes-animaux', 'services-personnes-animaux', 'Autres',    99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Business, administratif & comptabilité.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('comptabilite-gestion', 'business-administratif-comptabilite', 'Comptabilité & gestion',  1),
  ('conseil-juridique',    'business-administratif-comptabilite', 'Conseil juridique',       2),
  ('secretariat',          'business-administratif-comptabilite', 'Secrétariat',             3),
  ('autres-business-administratif-comptabilite', 'business-administratif-comptabilite', 'Autres', 99)
ON CONFLICT (slug) DO NOTHING;

-- Services : Tourisme, loisirs & expériences.
INSERT INTO listing_subcategories (slug, category_slug, label_fr, position) VALUES
  ('guides-randonnee',     'tourisme-loisirs-experiences', 'Guides & randonnée',      1),
  ('hebergement-insolite', 'tourisme-loisirs-experiences', 'Hébergement insolite',    2),
  ('activites-nautiques',  'tourisme-loisirs-experiences', 'Activités nautiques',     3),
  ('autres-tourisme-loisirs-experiences', 'tourisme-loisirs-experiences', 'Autres',  99)
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Tags transversaux (~10).
-- ----------------------------------------------------------------------------
INSERT INTO listing_tags (slug, label_fr) VALUES
  ('urgent',      'Urgent'),
  ('gratuit',     'Gratuit'),
  ('pro',         'Pro'),
  ('occasion',    'Occasion'),
  ('neuf',        'Neuf'),
  ('local',       'Local'),
  ('livraison',   'Livraison possible'),
  ('echange-ok',  'Échange OK'),
  ('negociable',  'Négociable'),
  ('fait-main',   'Fait main')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
