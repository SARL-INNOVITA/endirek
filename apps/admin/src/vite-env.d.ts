/// <reference types="vite/client" />

/**
 * Typage des variables d'environnement exposées par Vite (préfixe VITE_).
 * Voir `.env.example` pour la liste et les valeurs par défaut.
 */
interface ImportMetaEnv {
  /** URL de base de l'API Endirek (ex. http://localhost:3001). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
