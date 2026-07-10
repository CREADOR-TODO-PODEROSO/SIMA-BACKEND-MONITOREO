require('dotenv').config();

const isRailway = Boolean(
  process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_SERVICE_ID
);
const isProduction = process.env.NODE_ENV === 'production' || isRailway;

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  return String(value).toLowerCase() === 'true';
};

const parseJsonObject = (value, fallback = {}) => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : fallback;
  } catch {
    return fallback;
  }
};

const firstDefined = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== '') {
      return value;
    }
  }
  return undefined;
};

const parseDatabaseUrl = (value) => {
  if (!value) return {};

  try {
    const url = new URL(value);

    return {
      host: url.hostname,
      port: url.port,
      name: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
    };
  } catch {
    return {};
  }
};

const databaseUrl = parseDatabaseUrl(
  firstDefined('DATABASE_URL', 'MYSQL_URL')
);

const databaseVariables = {
  host: firstDefined('DB_HOST', 'MYSQLHOST') || databaseUrl.host,
  port: firstDefined('DB_PORT', 'MYSQLPORT') || databaseUrl.port,
  name: firstDefined('DB_NAME', 'MYSQLDATABASE') || databaseUrl.name,
  user: firstDefined('DB_USER', 'MYSQLUSER') || databaseUrl.user,
  password: firstDefined('DB_PASSWORD', 'MYSQLPASSWORD') || databaseUrl.password,
};

const jwtSecret = firstDefined('JWT_SECRET') || (isProduction ? null : 'clave_desarrollo_sima');

if (isProduction) {
  const missingVariables = [];

  if (!jwtSecret) {
    missingVariables.push('JWT_SECRET');
  }
  if (!process.env.SIMA_IOT_DEVICE_SECRETS) {
    missingVariables.push('SIMA_IOT_DEVICE_SECRETS');
  }
  if (!process.env.SIMA_BIOMETRIC_ENCRYPTION_KEY) {
    missingVariables.push('SIMA_BIOMETRIC_ENCRYPTION_KEY');
  }
  if (!process.env.SIMA_BIOMETRIC_HASH_PEPPER) {
    missingVariables.push('SIMA_BIOMETRIC_HASH_PEPPER');
  }
  if (!process.env.SIMA_MOBILE_BIOMETRIC_CHALLENGE_SECRET) {
    missingVariables.push('SIMA_MOBILE_BIOMETRIC_CHALLENGE_SECRET');
  }
  if (!process.env.SIMA_FACE_ENCRYPTION_KEY) {
    missingVariables.push('SIMA_FACE_ENCRYPTION_KEY');
  }
  if (!process.env.SIMA_FACE_HASH_PEPPER) {
    missingVariables.push('SIMA_FACE_HASH_PEPPER');
  }
  if (!process.env.SIMA_FACE_CHALLENGE_SECRET) {
    missingVariables.push('SIMA_FACE_CHALLENGE_SECRET');
  }

  const missingDatabaseVariables = [
    ['DB_HOST', 'MYSQLHOST', databaseVariables.host],
    ['DB_NAME', 'MYSQLDATABASE', databaseVariables.name],
    ['DB_USER', 'MYSQLUSER', databaseVariables.user],
    ['DB_PASSWORD', 'MYSQLPASSWORD', databaseVariables.password],
  ]
    .filter(([, , value]) => !value)
    .map(([dbKey, mysqlKey]) => `${dbKey}, ${mysqlKey}, DATABASE_URL o MYSQL_URL`);

  missingVariables.push(...missingDatabaseVariables);

  if (missingVariables.length > 0) {
    throw new Error(
      `Configuracion de produccion incompleta. Faltan: ${missingVariables.join('; ')}`
    );
  }
}

const database = {
  host: databaseVariables.host || '127.0.0.1',
  port: databaseVariables.port || 3306,
  name: databaseVariables.name || 'sigma_mvp',
  user: databaseVariables.user || 'root',
  password: databaseVariables.password || '9090',
};

module.exports = {
  NODE_ENV: process.env.NODE_ENV || (isRailway ? 'production' : 'development'),
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  DB_HOST: database.host,
  DB_PORT: database.port,
  DB_NAME: database.name,
  DB_USER: database.user,
  DB_PASSWORD: database.password,
  DB_SSL: parseBoolean(process.env.DB_SSL),
  DB_SSL_REJECT_UNAUTHORIZED: parseBoolean(
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
    true
  ),
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || null,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || null,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || null,
  CLOUDINARY_PROFILE_FOLDER: process.env.CLOUDINARY_PROFILE_FOLDER || 'sima/profile-photos',
  JWT_SECRET: jwtSecret,
  CORS_ORIGIN:
    process.env.CORS_ORIGIN ||
    (isProduction ? 'https://sima-frontend-orpin.vercel.app' : '*'),
  SIMA_QR_TTL_SECONDS: Number(process.env.SIMA_QR_TTL_SECONDS || 120),
  SIMA_GEO_LATITUD_CENTRO_CTPI: Number(process.env.SIMA_GEO_LATITUD_CENTRO_CTPI || 2.4832482),
  SIMA_GEO_LONGITUD_CENTRO_CTPI: Number(process.env.SIMA_GEO_LONGITUD_CENTRO_CTPI || -76.56177339999999),
  SIMA_GEO_RADIO_PERMITIDO_METROS: Number(process.env.SIMA_GEO_RADIO_PERMITIDO_METROS || 200),
  SIMA_GEO_PRECISION_MAXIMA_METROS: Number(process.env.SIMA_GEO_PRECISION_MAXIMA_METROS || 80),
  SIMA_IOT_MIN_QUALITY: Number(process.env.SIMA_IOT_MIN_QUALITY || 40),
  SIMA_IOT_MAX_FUTURE_SKEW_SECONDS: Number(process.env.SIMA_IOT_MAX_FUTURE_SKEW_SECONDS || 30),
  // Epica 8 - Analitica Predictiva e IA
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || (isProduction ? null : 'dev-gemini-key-mock'),
  SIMA_IOT_DEVICE_SECRETS: parseJsonObject(
    process.env.SIMA_IOT_DEVICE_SECRETS,
    isProduction ? {} : {
      'BIOMINI-LOCAL-001': 'dev-only-sima-biomini-mock-secret-change-me',
      'ESP32-LAB-001': 'dev-only-sima-biomini-mock-secret-change-me',
      'ESP32-TALLER-002': 'dev-only-sima-biomini-mock-secret-change-me',
    }
  ),
  SIMA_BIOMETRIC_ENCRYPTION_KEY:
    process.env.SIMA_BIOMETRIC_ENCRYPTION_KEY ||
    (isProduction ? null : 'dev-only-32-byte-biometric-key!!'),
  SIMA_BIOMETRIC_ENCRYPTION_KEY_ID:
    process.env.SIMA_BIOMETRIC_ENCRYPTION_KEY_ID || 'local-dev-v1',
  SIMA_BIOMETRIC_HASH_PEPPER:
    process.env.SIMA_BIOMETRIC_HASH_PEPPER ||
    (isProduction ? null : 'dev-only-biometric-hash-pepper-change-me'),
  SIMA_BIOMETRIC_MIN_ENROLL_QUALITY:
    Number(process.env.SIMA_BIOMETRIC_MIN_ENROLL_QUALITY || 40),
  SIMA_BIOMETRIC_MATCHING_PACKAGE_TTL_SECONDS:
    Number(process.env.SIMA_BIOMETRIC_MATCHING_PACKAGE_TTL_SECONDS || 60),
  SIMA_MOBILE_BIOMETRIC_CHALLENGE_SECRET:
    process.env.SIMA_MOBILE_BIOMETRIC_CHALLENGE_SECRET ||
    (isProduction ? null : 'dev-only-mobile-biometric-challenge-secret-change-me'),
  SIMA_MOBILE_BIOMETRIC_CHALLENGE_TTL_SECONDS:
    Number(process.env.SIMA_MOBILE_BIOMETRIC_CHALLENGE_TTL_SECONDS || 120),
  SIMA_FACE_ENCRYPTION_KEY:
    process.env.SIMA_FACE_ENCRYPTION_KEY ||
    (isProduction ? null : 'dev-only-face-encryption-key-change-me-32'),
  SIMA_FACE_ENCRYPTION_KEY_ID:
    process.env.SIMA_FACE_ENCRYPTION_KEY_ID || 'face-local-dev-v1',
  SIMA_FACE_HASH_PEPPER:
    process.env.SIMA_FACE_HASH_PEPPER ||
    (isProduction ? null : 'dev-only-face-hash-pepper-change-me'),
  SIMA_FACE_CHALLENGE_SECRET:
    process.env.SIMA_FACE_CHALLENGE_SECRET ||
    (isProduction ? null : 'dev-only-face-challenge-secret-change-me'),
  SIMA_FACE_CHALLENGE_TTL_SECONDS:
    Number(process.env.SIMA_FACE_CHALLENGE_TTL_SECONDS || 120),
  SIMA_FACE_RESULT_TTL_SECONDS:
    Number(process.env.SIMA_FACE_RESULT_TTL_SECONDS || 120),
  SIMA_FACE_MATCH_THRESHOLD:
    Number(process.env.SIMA_FACE_MATCH_THRESHOLD || 0.82),
  SIMA_FACE_MIN_ENROLL_QUALITY:
    Number(process.env.SIMA_FACE_MIN_ENROLL_QUALITY || 40),
  SIMA_FACE_CONSENT_POLICY_VERSION:
    process.env.SIMA_FACE_CONSENT_POLICY_VERSION || 'facial-sima-v1',
};
