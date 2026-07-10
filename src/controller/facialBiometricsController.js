const FacialBiometricsService = require('../services/FacialBiometricsService');
const { successResponse, errorResponse } = require('../helpers/response');

const getMyFacialStatus = async (req, res) => {
  try {
    const status = await FacialBiometricsService.getMyStatus(req.user);
    return successResponse(res, 'Estado facial obtenido correctamente', status);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar estado facial', error.status || 500);
  }
};

const acceptFacialConsent = async (req, res) => {
  try {
    const consent = await FacialBiometricsService.acceptConsent(req.body, req.user, req);
    return successResponse(res, 'Consentimiento facial aceptado correctamente', consent, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al aceptar consentimiento facial', error.status || 500);
  }
};

const revokeFacialConsent = async (req, res) => {
  try {
    const consent = await FacialBiometricsService.revokeConsent(req.body, req.user);
    return successResponse(res, 'Consentimiento facial revocado correctamente', consent);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al revocar consentimiento facial', error.status || 500);
  }
};

const createEnrollmentChallenge = async (req, res) => {
  try {
    const challenge = await FacialBiometricsService.createEnrollmentChallenge(req.body, req.user);
    return successResponse(res, 'Reto de enrolamiento facial generado correctamente', challenge, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al generar reto de enrolamiento facial', error.status || 500);
  }
};

const enrollFace = async (req, res) => {
  try {
    const enrollment = await FacialBiometricsService.enroll(req.body, req.user);
    return successResponse(res, 'Rostro enrolado correctamente', enrollment, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al enrolar rostro', error.status || 500);
  }
};

const createValidationChallenge = async (req, res) => {
  try {
    const challenge = await FacialBiometricsService.createValidationChallenge(req.body, req.user);
    return successResponse(res, 'Reto de validacion facial generado correctamente', challenge, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al generar reto de validacion facial', error.status || 500);
  }
};

const validateFaceAttempt = async (req, res) => {
  try {
    const attempt = await FacialBiometricsService.validateAttempt(req.body, req.user);
    return successResponse(res, 'Intento de validacion facial procesado correctamente', attempt, attempt.aprobado ? 201 : 200);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al validar rostro', error.status || 500);
  }
};

module.exports = {
  acceptFacialConsent,
  createEnrollmentChallenge,
  createValidationChallenge,
  enrollFace,
  getMyFacialStatus,
  revokeFacialConsent,
  validateFaceAttempt,
};
