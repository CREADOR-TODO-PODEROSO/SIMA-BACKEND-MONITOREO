const crypto = require('crypto');
const env = require('../config/env');

const ALLOWED_MOBILE_BIOMETRIC_METHODS = ['FACIAL_SIMA', 'BIOMETRIA_MOVIL'];

const base64url = (value) => Buffer.from(value).toString('base64url');

const fromBase64url = (value) => Buffer.from(value, 'base64url').toString('utf8');

const signPayload = (encodedPayload) =>
  crypto
    .createHmac('sha256', env.SIMA_MOBILE_BIOMETRIC_CHALLENGE_SECRET)
    .update(encodedPayload)
    .digest('base64url');

const createMobileBiometricChallenge = ({
  id_usuario,
  id_aprendiz,
  id_sesion_formacion,
  qr_token_hash,
  device_uuid,
  metodo_solicitado,
}) => {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + env.SIMA_MOBILE_BIOMETRIC_CHALLENGE_TTL_SECONDS * 1000
  );

  const payload = {
    typ: 'SIMA_MOBILE_BIOMETRIC_CHALLENGE',
    iss: 'SIMA',
    nonce: crypto.randomUUID(),
    iat: now.toISOString(),
    exp: expiresAt.toISOString(),
    id_usuario: Number(id_usuario),
    id_aprendiz: Number(id_aprendiz),
    id_sesion_formacion: Number(id_sesion_formacion),
    qr_token_hash,
    device_uuid: String(device_uuid || '').trim(),
    metodo_solicitado,
    metodos_permitidos: ALLOWED_MOBILE_BIOMETRIC_METHODS,
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return {
    challenge_token: `${encodedPayload}.${signature}`,
    nonce: payload.nonce,
    expira_en: payload.exp,
    metodos_permitidos: payload.metodos_permitidos,
  };
};

const verifyMobileBiometricChallenge = (token) => {
  const [encodedPayload, signature, unexpected] = String(token || '').split('.');

  if (!encodedPayload || !signature || unexpected) {
    throw { status: 400, message: 'Reto biometrico movil invalido' };
  }

  const expectedSignature = signPayload(encodedPayload);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    throw { status: 401, message: 'Reto biometrico movil manipulado' };
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64url(encodedPayload));
  } catch {
    throw { status: 400, message: 'Reto biometrico movil ilegible' };
  }

  if (payload.typ !== 'SIMA_MOBILE_BIOMETRIC_CHALLENGE') {
    throw { status: 400, message: 'Tipo de reto biometrico movil invalido' };
  }

  if (new Date(payload.exp).getTime() <= Date.now()) {
    throw { status: 401, message: 'Reto biometrico movil vencido' };
  }

  return payload;
};

module.exports = {
  ALLOWED_MOBILE_BIOMETRIC_METHODS,
  createMobileBiometricChallenge,
  verifyMobileBiometricChallenge,
};
