const EducationalSessionService = require('../services/EducationalSessionService');
const { successResponse, errorResponse } = require('../helpers/response');

const generateSessions = async (req, res) => {
  try {
    const result = await EducationalSessionService.generateFromSchedule(req.body, req.user);
    return successResponse(res, 'Sesiones generadas correctamente', result, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al generar sesiones', error.status || 500);
  }
};

const openSession = async (req, res) => {
  try {
    const session = await EducationalSessionService.openSession(req.params.id, req.user);
    return successResponse(res, 'Sesion abierta correctamente', session);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al abrir sesion', error.status || 500);
  }
};

const generateQr = async (req, res) => {
  try {
    const result = await EducationalSessionService.generateQr(req.params.id, req.user);
    return successResponse(res, 'QR generado correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al generar QR', error.status || 500);
  }
};

const listSessions = async (req, res) => {
  try {
    const result = await EducationalSessionService.listSessions(req.query, req.user);
    return successResponse(res, 'Sesiones obtenidas correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar sesiones', error.status || 500);
  }
};

const getSessionAttendances = async (req, res) => {
  try {
    const result = await EducationalSessionService.getSessionAttendances(req.params.id, req.user);
    return successResponse(res, 'Asistencias de sesion obtenidas correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar asistencias de sesion', error.status || 500);
  }
};

const closeSession = async (req, res) => {
  try {
    const result = await EducationalSessionService.closeSession(req.params.id, req.user);
    return successResponse(res, 'Sesion cerrada correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al cerrar sesion', error.status || 500);
  }
};

const cancelSession = async (req, res) => {
  try {
    const session = await EducationalSessionService.cancelSession(req.params.id, req.user, req.body.motivo);
    return successResponse(res, 'Sesion cancelada correctamente', session);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al cancelar sesion', error.status || 500);
  }
};

module.exports = {
  generateSessions,
  openSession,
  generateQr,
  listSessions,
  getSessionAttendances,
  closeSession,
  cancelSession,
};
