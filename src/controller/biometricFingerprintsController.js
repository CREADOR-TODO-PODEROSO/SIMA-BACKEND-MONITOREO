const BiometricFingerprintService = require('../services/BiometricFingerprintService');
const { successResponse, errorResponse } = require('../helpers/response');

const listFingerprints = async (req, res) => {
  try {
    const result = await BiometricFingerprintService.listFingerprints(req.query, req.user);
    return successResponse(res, 'Huellas biometricas obtenidas correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar huellas biometricas', error.status || 500);
  }
};

const enrollFingerprint = async (req, res) => {
  try {
    const result = await BiometricFingerprintService.enroll(req.body, req.user);
    return successResponse(res, 'Huella biometrica enrolada correctamente', result, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al enrolar huella biometrica', error.status || 500);
  }
};

const revokeFingerprint = async (req, res) => {
  try {
    const result = await BiometricFingerprintService.revoke(req.params.id, req.body, req.user);
    return successResponse(res, 'Huella biometrica revocada correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al revocar huella biometrica', error.status || 500);
  }
};

const replaceFingerprint = async (req, res) => {
  try {
    const result = await BiometricFingerprintService.replace(req.params.id, req.body, req.user);
    return successResponse(res, 'Huella biometrica reemplazada correctamente', result, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al reemplazar huella biometrica', error.status || 500);
  }
};

const buildMatchingPackage = async (req, res) => {
  try {
    const result = await BiometricFingerprintService.buildMatchingPackage(req.body);
    return successResponse(res, 'Paquete de matching generado correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al generar paquete de matching', error.status || 500);
  }
};

module.exports = {
  buildMatchingPackage,
  enrollFingerprint,
  listFingerprints,
  replaceFingerprint,
  revokeFingerprint,
};
