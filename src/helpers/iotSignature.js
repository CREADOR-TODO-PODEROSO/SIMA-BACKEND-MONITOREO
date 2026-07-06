const crypto = require('crypto');
const env = require('../config/env');

const FORBIDDEN_BIOMETRIC_FIELDS = new Set([
  'plantilla',
  'plantilla_biometrica',
  'plantilla_biometrica_cifrada',
  'raw',
  'imagen',
  'image',
  'embedding',
  'template',
  'template_data',
]);

const getDeviceSecret = (deviceIdentifier) => {
  if (deviceIdentifier === undefined || deviceIdentifier === null || deviceIdentifier === '') {
    return null;
  }
  return env.SIMA_IOT_DEVICE_SECRETS[String(deviceIdentifier)] || null;
};

const canonicalJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const buildSignedPayload = (payload) => {
  const unsignedPayload = { ...payload };
  delete unsignedPayload.firma_evento;
  return unsignedPayload;
};

const signPayload = (payload, secret) => {
  return crypto
    .createHmac('sha256', secret)
    .update(canonicalJson(buildSignedPayload(payload)), 'utf8')
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const hasForbiddenBiometricFields = (payload) => {
  return Object.keys(payload || {}).filter((key) => FORBIDDEN_BIOMETRIC_FIELDS.has(String(key).toLowerCase()));
};

const isValidSignature = (payload, secret) => {
  if (!payload?.firma_evento || !secret) return false;
  const expected = signPayload(payload, secret);
  const actual = String(payload.firma_evento);

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
};

module.exports = {
  canonicalJson,
  getDeviceSecret,
  hasForbiddenBiometricFields,
  isValidSignature,
  signPayload,
};
