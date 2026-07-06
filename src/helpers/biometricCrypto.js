const crypto = require('crypto');

const env = require('../config/env');

const CIPHER_ALGORITHM = 'aes-256-gcm';
const ENVELOPE_VERSION = 1;

const getEncryptionKey = () => {
  const keyMaterial = env.SIMA_BIOMETRIC_ENCRYPTION_KEY;
  if (!keyMaterial || String(keyMaterial).length < 16) {
    throw { status: 500, message: 'Llave biometrica no configurada correctamente' };
  }
  return crypto.createHash('sha256').update(String(keyMaterial), 'utf8').digest();
};

const assertTemplateBuffer = (template) => {
  const buffer = Buffer.isBuffer(template) ? Buffer.from(template) : Buffer.from(String(template || ''), 'base64');
  if (!buffer.length || buffer.length > 4096) {
    throw { status: 400, message: 'La plantilla biometrica debe ser base64 y no superar 4096 bytes' };
  }
  return buffer;
};

const encryptTemplate = (template) => {
  const plain = assertTemplateBuffer(template);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope = {
    v: ENVELOPE_VERSION,
    alg: CIPHER_ALGORITHM,
    key_id: env.SIMA_BIOMETRIC_ENCRYPTION_KEY_ID,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ciphertext.toString('base64'),
  };
  plain.fill(0);
  const packedEnvelope = Buffer.from(JSON.stringify(envelope), 'utf8');
  if (packedEnvelope.length > 4096) {
    throw { status: 400, message: 'La plantilla cifrada supera el tamano maximo permitido' };
  }
  return packedEnvelope;
};

const decryptTemplate = (encryptedTemplate) => {
  const raw = Buffer.isBuffer(encryptedTemplate)
    ? encryptedTemplate.toString('utf8')
    : Buffer.from(encryptedTemplate).toString('utf8');
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw { status: 500, message: 'La plantilla biometrica almacenada no usa el sobre cifrado vigente' };
  }
  if (envelope.alg !== CIPHER_ALGORITHM || envelope.v !== ENVELOPE_VERSION) {
    throw { status: 500, message: 'Version de cifrado biometrico no soportada' };
  }

  const decipher = crypto.createDecipheriv(
    CIPHER_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ct, 'base64')),
    decipher.final(),
  ]);
};

const buildTemplateHash = (template) => {
  const plain = assertTemplateBuffer(template);
  const digest = crypto
    .createHmac('sha256', String(env.SIMA_BIOMETRIC_HASH_PEPPER || ''))
    .update(plain)
    .digest('hex');
  plain.fill(0);
  return digest;
};

module.exports = {
  buildTemplateHash,
  decryptTemplate,
  encryptTemplate,
};
