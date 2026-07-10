const crypto = require('crypto');
const env = require('../config/env');

const TOKEN_TYPE = 'SIMA_FACE_CHALLENGE';
const RESULT_TYPE = 'SIMA_FACE_VALIDATION_RESULT';

const base64url = (value) => Buffer.from(value).toString('base64url');
const fromBase64url = (value) => Buffer.from(value, 'base64url').toString('utf8');

const signPayload = (encodedPayload) =>
  crypto
    .createHmac('sha256', env.SIMA_FACE_CHALLENGE_SECRET)
    .update(encodedPayload)
    .digest('base64url');

const createSignedToken = (payload) => {
  const encodedPayload = base64url(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
};

const verifySignedToken = (token, expectedType) => {
  const [encodedPayload, signature, unexpected] = String(token || '').split('.');
  if (!encodedPayload || !signature || unexpected) {
    throw { status: 400, message: 'Token facial invalido' };
  }

  const expectedSignature = signPayload(encodedPayload);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    throw { status: 401, message: 'Token facial manipulado' };
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64url(encodedPayload));
  } catch {
    throw { status: 400, message: 'Token facial ilegible' };
  }

  if (payload.typ !== expectedType) {
    throw { status: 400, message: 'Tipo de token facial invalido' };
  }

  if (new Date(payload.exp).getTime() <= Date.now()) {
    throw { status: 401, message: 'Token facial vencido' };
  }

  return payload;
};

const createFaceChallenge = ({
  purpose,
  id_usuario,
  id_aprendiz,
  id_sesion_formacion = null,
  device_uuid,
}) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.SIMA_FACE_CHALLENGE_TTL_SECONDS * 1000);
  const payload = {
    typ: TOKEN_TYPE,
    iss: 'SIMA',
    purpose,
    nonce: crypto.randomUUID(),
    iat: now.toISOString(),
    exp: expiresAt.toISOString(),
    id_usuario: Number(id_usuario),
    id_aprendiz: Number(id_aprendiz),
    id_sesion_formacion: id_sesion_formacion ? Number(id_sesion_formacion) : null,
    device_uuid: String(device_uuid || '').trim(),
  };

  return {
    challenge_token: createSignedToken(payload),
    nonce: payload.nonce,
    expira_en: payload.exp,
  };
};

const verifyFaceChallenge = (token, expectedPurpose) => {
  const payload = verifySignedToken(token, TOKEN_TYPE);
  if (payload.purpose !== expectedPurpose) {
    throw { status: 400, message: 'El reto facial no corresponde a esta operacion' };
  }
  return payload;
};

const createFaceValidationResult = ({
  id_usuario,
  id_aprendiz,
  id_sesion_formacion,
  id_intento_facial,
  id_enrolamiento_facial,
  device_uuid,
  challenge_nonce,
  score_match,
  liveness_result,
}) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.SIMA_FACE_RESULT_TTL_SECONDS * 1000);
  const payload = {
    typ: RESULT_TYPE,
    iss: 'SIMA',
    nonce: crypto.randomUUID(),
    iat: now.toISOString(),
    exp: expiresAt.toISOString(),
    id_usuario: Number(id_usuario),
    id_aprendiz: Number(id_aprendiz),
    id_sesion_formacion: Number(id_sesion_formacion),
    id_intento_facial: Number(id_intento_facial),
    id_enrolamiento_facial: Number(id_enrolamiento_facial),
    device_uuid: String(device_uuid || '').trim(),
    challenge_nonce,
    score_match: Number(score_match || 0),
    liveness_result,
    resultado: 'APROBADO',
  };

  return createSignedToken(payload);
};

const verifyFaceValidationResult = (token) => verifySignedToken(token, RESULT_TYPE);

module.exports = {
  createFaceChallenge,
  createFaceValidationResult,
  verifyFaceChallenge,
  verifyFaceValidationResult,
};
