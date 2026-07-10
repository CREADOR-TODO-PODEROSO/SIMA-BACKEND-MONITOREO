const crypto = require('crypto');
const env = require('../config/env');

const CIPHER_ALGORITHM = 'aes-256-gcm';
const ENVELOPE_VERSION = 1;
const MAX_EMBEDDING_BYTES = 16384;

const getFaceEncryptionKey = () => {
  const keyMaterial = env.SIMA_FACE_ENCRYPTION_KEY;
  if (!keyMaterial || String(keyMaterial).length < 32) {
    throw { status: 500, message: 'Llave de cifrado facial no configurada correctamente' };
  }
  return crypto.createHash('sha256').update(String(keyMaterial), 'utf8').digest();
};

const embeddingToBuffer = (embedding) => {
  if (Buffer.isBuffer(embedding)) {
    return Buffer.from(embedding);
  }

  if (Array.isArray(embedding)) {
    const values = embedding.map((value) => Number(value));
    if (!values.length || values.some((value) => !Number.isFinite(value))) {
      throw { status: 400, message: 'Embedding facial invalido' };
    }
    if (values.length * 4 > MAX_EMBEDDING_BYTES) {
      throw { status: 400, message: 'Embedding facial demasiado grande' };
    }
    return Buffer.from(new Float32Array(values).buffer);
  }

  throw { status: 400, message: 'Embedding facial debe enviarse como vector numerico; no se acepta base64' };
};

const encryptFaceEmbedding = (embedding) => {
  const plain = embeddingToBuffer(embedding);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, getFaceEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope = {
    v: ENVELOPE_VERSION,
    alg: CIPHER_ALGORITHM,
    key_id: env.SIMA_FACE_ENCRYPTION_KEY_ID,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ciphertext.toString('base64'),
  };
  plain.fill(0);
  return Buffer.from(JSON.stringify(envelope), 'utf8');
};

const decryptFaceEmbedding = (encryptedEmbedding) => {
  const raw = Buffer.isBuffer(encryptedEmbedding)
    ? encryptedEmbedding.toString('utf8')
    : Buffer.from(encryptedEmbedding).toString('utf8');

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw { status: 500, message: 'El embedding facial almacenado no usa el sobre cifrado vigente' };
  }

  if (envelope.alg !== CIPHER_ALGORITHM || envelope.v !== ENVELOPE_VERSION) {
    throw { status: 500, message: 'Version de cifrado facial no soportada' };
  }

  const decipher = crypto.createDecipheriv(
    CIPHER_ALGORITHM,
    getFaceEncryptionKey(),
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ct, 'base64')),
    decipher.final(),
  ]);
};

const buildFaceEmbeddingHash = (embedding) => {
  const plain = embeddingToBuffer(embedding);
  const digest = crypto
    .createHmac('sha256', String(env.SIMA_FACE_HASH_PEPPER || ''))
    .update(plain)
    .digest('hex');
  plain.fill(0);
  return digest;
};

const cosineSimilarity = (leftBuffer, rightBuffer) => {
  if (!Buffer.isBuffer(leftBuffer) || !Buffer.isBuffer(rightBuffer)) {
    throw { status: 400, message: 'Embeddings faciales invalidos' };
  }
  if (leftBuffer.length !== rightBuffer.length || leftBuffer.length % 4 !== 0) {
    return 0;
  }

  const left = new Float32Array(leftBuffer.buffer, leftBuffer.byteOffset, leftBuffer.length / 4);
  const right = new Float32Array(rightBuffer.buffer, rightBuffer.byteOffset, rightBuffer.length / 4);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

module.exports = {
  buildFaceEmbeddingHash,
  cosineSimilarity,
  decryptFaceEmbedding,
  embeddingToBuffer,
  encryptFaceEmbedding,
};
