/**
 * Configuration typée de l'API Endirek.
 *
 * Chaque groupe reflète exactement les variables du fichier .env.example.
 * Les valeurs par défaut sont sûres pour le développement local (mocks,
 * localhost) — en production, TOUT doit être fourni via l'environnement.
 * Aucune clé ni secret n'est hardcodé ici.
 */

export interface AppConfig {
  /** Environnement d'exécution : development | production | test. */
  env: string;
  /** Port HTTP d'écoute de l'API. */
  port: number;
  /** URL publique de l'API (utilisée pour construire des liens absolus). */
  publicUrl: string;
  /** Origines autorisées pour le CORS (déjà découpées et nettoyées). */
  corsOrigins: CorsOrigin[];
}

export type CorsOrigin = string | RegExp;

export interface DatabaseConfig {
  /** Driver de persistance : 'mock' (sans Docker) ou 'postgres' (cible PostGIS). */
  driver: string;
  /** URL de connexion complète (prioritaire sur les champs individuels). */
  url: string;
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  /** Driver mock uniquement : charger le seed de démonstration La Réunion
   * au démarrage (DB_MOCK_SEED, défaut true). */
  mockSeed: boolean;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
  /** OAuth social — placeholders tant que les clés ne sont pas fournies. */
  googleClientId: string;
  googleClientSecret: string;
  appleClientId: string;
}

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicUrl: string;
}

export interface MediaConfig {
  /** Adapter de stockage : 'local' en dev, 's3' pour Hetzner en production. */
  driver: string;
  uploadDir: string;
  /** Taille maximale d'un fichier uploadé, en mégaoctets (défaut 8). */
  maxFileSizeMb: number;
  s3: S3Config;
}

export interface MapConfig {
  provider: string;
  tileUrl: string;
  apiKey: string;
  /** Géocodage : 'mock' tant qu'aucune API réelle n'est configurée. */
  geocodingProvider: string;
  geocodingApiKey: string;
}

export interface FirebaseConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  fcmServerKey: string;
}

export interface PushConfig {
  /** Adapter push : 'mock' tant que Firebase/APNs ne sont pas disponibles. */
  driver: string;
  firebase: FirebaseConfig;
}

export interface BrevoConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

export interface EmailConfig {
  /** Adapter email : 'mock' tant que Brevo n'est pas configuré. */
  driver: string;
  brevo: BrevoConfig;
}

export interface EndirekConfig {
  app: AppConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  media: MediaConfig;
  map: MapConfig;
  push: PushConfig;
  email: EmailConfig;
}

/** Lit une variable d'environnement avec valeur de repli. */
function env(name: string, fallback = ''): string {
  const value = process.env[name];
  return value !== undefined && value !== '' ? value : fallback;
}

/** Lit une variable d'environnement entière avec valeur de repli. */
function envInt(name: string, fallback: number): number {
  const parsed = parseInt(env(name, String(fallback)), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Lit une variable d'environnement booléenne avec valeur de repli.
 * Acceptés (insensible à la casse) : true/false, 1/0, yes/no, on/off.
 * Toute autre valeur (ou l'absence) retombe sur le repli.
 */
function envBool(name: string, fallback: boolean): boolean {
  const raw = env(name).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(raw)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(raw)) {
    return false;
  }
  return fallback;
}

function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function uniqueCorsOrigins(origins: CorsOrigin[]): CorsOrigin[] {
  const seen = new Set<string>();
  return origins.filter((origin) => {
    const key = origin instanceof RegExp ? origin.toString() : origin;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildCorsOrigins(appEnv: string): CorsOrigin[] {
  const configuredOrigins = parseCorsOrigins(env('CORS_ORIGINS'));
  if (appEnv === 'production') {
    return configuredOrigins;
  }

  return uniqueCorsOrigins([
    ...configuredOrigins,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ]);
}

/**
 * Factory de configuration chargée par ConfigModule.forRoot({ load: [configuration] }).
 * Accès dans les services : configService.get<AppConfig>('app'), etc.
 */
export default (): EndirekConfig => ({
  app: {
    env: env('NODE_ENV', 'development'),
    port: envInt('PORT', 3001),
    publicUrl: env('API_PUBLIC_URL', 'http://localhost:3001'),
    corsOrigins: buildCorsOrigins(env('NODE_ENV', 'development')),
  },
  database: {
    driver: env('DB_DRIVER', 'mock'),
    url: env(
      'DATABASE_URL',
      'postgresql://endirek:endirek@localhost:5432/endirek',
    ),
    host: env('POSTGRES_HOST', 'localhost'),
    port: envInt('POSTGRES_PORT', 5432),
    name: env('POSTGRES_DB', 'endirek'),
    user: env('POSTGRES_USER', 'endirek'),
    password: env('POSTGRES_PASSWORD', 'endirek'),
    mockSeed: envBool('DB_MOCK_SEED', true),
  },
  auth: {
    jwtSecret: env('JWT_SECRET', 'change-me-in-production'),
    jwtExpiresIn: env('JWT_EXPIRES_IN', '15m'),
    refreshSecret: env('JWT_REFRESH_SECRET', 'change-me-too-in-production'),
    refreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN', '30d'),
    googleClientId: env('GOOGLE_CLIENT_ID'),
    googleClientSecret: env('GOOGLE_CLIENT_SECRET'),
    appleClientId: env('APPLE_CLIENT_ID'),
  },
  media: {
    driver: env('MEDIA_STORAGE_DRIVER', 'local'),
    uploadDir: env('UPLOAD_DIR', './uploads'),
    maxFileSizeMb: envInt('MEDIA_MAX_FILE_SIZE_MB', 8),
    s3: {
      endpoint: env('S3_ENDPOINT'),
      bucket: env('S3_BUCKET'),
      accessKey: env('S3_ACCESS_KEY'),
      secretKey: env('S3_SECRET_KEY'),
      publicUrl: env('S3_PUBLIC_URL'),
    },
  },
  map: {
    provider: env('MAP_PROVIDER', 'osm'),
    tileUrl: env(
      'MAP_TILE_URL',
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    ),
    apiKey: env('MAP_API_KEY'),
    geocodingProvider: env('GEOCODING_PROVIDER', 'mock'),
    geocodingApiKey: env('GEOCODING_API_KEY'),
  },
  push: {
    driver: env('PUSH_DRIVER', 'mock'),
    firebase: {
      projectId: env('FIREBASE_PROJECT_ID'),
      clientEmail: env('FIREBASE_CLIENT_EMAIL'),
      privateKey: env('FIREBASE_PRIVATE_KEY'),
      fcmServerKey: env('FCM_SERVER_KEY'),
    },
  },
  email: {
    driver: env('EMAIL_DRIVER', 'mock'),
    brevo: {
      apiKey: env('BREVO_API_KEY'),
      senderEmail: env('BREVO_SENDER_EMAIL'),
      senderName: env('BREVO_SENDER_NAME', 'Endirek'),
    },
  },
});
