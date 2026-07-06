import { randomInt } from 'crypto';

/**
 * Génération des `url_slug` publics des publications (future URL web
 * partageable) : slugify du titre — ou des premiers mots du corps — puis
 * suffixe aléatoire de 4 caractères. L'unicité est GARANTIE par le service
 * (vérification + retry avec un nouveau suffixe), pas par ce helper pur.
 */

/** Longueur maximale de la base lisible du slug (hors suffixe). */
const SLUG_BASE_MAX_LENGTH = 60;

/** Nombre de mots du corps utilisés quand le post n'a pas de titre. */
const SLUG_BODY_WORDS = 8;

/** Alphabet du suffixe aléatoire (minuscules + chiffres, sans ambiguïté URL). */
const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Longueur du suffixe aléatoire. */
export const SLUG_SUFFIX_LENGTH = 4;

/**
 * Transforme un texte libre en slug URL : minuscules, accents retirés
 * (décomposition Unicode NFD), tout caractère non alphanumérique → tiret,
 * tirets de bord retirés, tronqué à 60 caractères. Texte vide ou fait
 * uniquement d'emojis → repli « post ».
 */
export function slugify(text: string): string {
  const base = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marques diacritiques (é → e, ï → i...)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_BASE_MAX_LENGTH)
    .replace(/-+$/, '');
  return base.length > 0 ? base : 'post';
}

/** Base lisible du slug d'un post : le titre s'il existe, sinon les premiers
 * mots du corps. */
export function slugSource(title: string | null | undefined, body: string): string {
  if (title && title.trim().length > 0) {
    return title;
  }
  return body.split(/\s+/).slice(0, SLUG_BODY_WORDS).join(' ');
}

/** Suffixe aléatoire de 4 caractères (crypto.randomInt — pas Math.random). */
export function randomSlugSuffix(): string {
  let suffix = '';
  for (let i = 0; i < SLUG_SUFFIX_LENGTH; i++) {
    suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  }
  return suffix;
}
