const ApprenticePortalService = require('../services/ApprenticePortalService');
const { successResponse, errorResponse } = require('../helpers/response');

const getContext = async (req, res) => {
  try {
    const context = await ApprenticePortalService.getContext(req.query, req.user);
    return successResponse(res, 'Contexto academico del aprendiz obtenido correctamente', context);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar el contexto academico', error.status || 500);
  }
};

const getDashboard = async (req, res) => {
  try {
    const dashboard = await ApprenticePortalService.getDashboard(req.query, req.user);
    return successResponse(res, 'Dashboard del aprendiz obtenido correctamente', dashboard);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar el dashboard del aprendiz', error.status || 500);
  }
};

const getSchedule = async (req, res) => {
  try {
    const schedule = await ApprenticePortalService.getSchedule(req.query, req.user);
    return successResponse(res, 'Horario semanal del aprendiz obtenido correctamente', schedule);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar el horario del aprendiz', error.status || 500);
  }
};

const getSessions = async (req, res) => {
  try {
    const sessions = await ApprenticePortalService.getSessions(req.query, req.user);
    return successResponse(res, 'Sesiones del aprendiz obtenidas correctamente', sessions);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar las sesiones del aprendiz', error.status || 500);
  }
};

const getObservatoryObservations = async (req, res) => {
  try {
    const observations = await ApprenticePortalService.getObservatoryObservations(req.query, req.user);
    return successResponse(res, 'Observaciones del aprendiz obtenidas correctamente', observations);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar observaciones del aprendiz', error.status || 500);
  }
};

const getObservatoryAlerts = async (req, res) => {
  try {
    const alerts = await ApprenticePortalService.getObservatoryAlerts(req.query, req.user);
    return successResponse(res, 'Alertas del aprendiz obtenidas correctamente', alerts);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar alertas del aprendiz', error.status || 500);
  }
};

module.exports = {
  getContext,
  getDashboard,
  getSchedule,
  getSessions,
  getObservatoryObservations,
  getObservatoryAlerts,
};
