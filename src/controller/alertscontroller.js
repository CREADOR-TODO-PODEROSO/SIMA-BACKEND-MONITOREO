const AlertService = require('../services/AlertService');
const { successResponse, errorResponse } = require('../helpers/response');

const createAlertFromObservationsController = async (req, res) => {
  try {
    const alert = await AlertService.createFromObservations(req.body, req.user);
    return successResponse(res, 'Alerta creada desde observaciones correctamente', alert, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al crear alerta desde observaciones', error.status || 500);
  }
};

const createManualAlertController = async (req, res) => {
  try {
    const alert = await AlertService.createManualAlert(req.body, req.user);
    return successResponse(res, 'Alerta manual creada/actualizada correctamente', alert, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al crear alerta manual', error.status || 500);
  }
};

const reevaluateAttendanceAlertController = async (req, res) => {
  try {
    const { idAprendiz } = req.params;
    const result = await AlertService.evaluateInattendanceAlert(idAprendiz);
    return successResponse(res, 'Evaluación de alerta por inasistencia completada', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al evaluar alerta por inasistencia', error.status || 500);
  }
};

const reevaluateObservationAlertController = async (req, res) => {
  try {
    const { idAprendiz } = req.params;
    const result = await AlertService.evaluateObservationAlert(idAprendiz);
    return successResponse(res, 'Evaluación de alerta por observaciones completada', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al evaluar alerta por observaciones', error.status || 500);
  }
};

const getAlerts = async (req, res) => {
  try {
    const alerts = await AlertService.getAlerts(req.query, req.user);
    return successResponse(res, 'Alertas obtenidas correctamente', alerts);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener alertas', error.status || 500);
  }
};

const getAlertById = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await AlertService.getAlertById(id, req.user);
    return successResponse(res, 'Alerta obtenida correctamente', alert);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener alerta', error.status || 500);
  }
};

const getAlertObservationsController = async (req, res) => {
  try {
    const { id } = req.params;
    const observations = await AlertService.getAlertObservations(id, req.user);
    return successResponse(res, 'Observaciones asociadas a la alerta obtenidas correctamente', observations);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener observaciones de la alerta', error.status || 500);
  }
};

const updateAlertStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, justificacion_cierre, justificacion_reapertura } = req.body;
    const alert = await AlertService.updateAlertStatus(
      id,
      estado,
      req.user,
      justificacion_cierre,
      justificacion_reapertura
    );
    return successResponse(res, 'Estado de alerta actualizado correctamente', alert);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al actualizar el estado de la alerta', error.status || 500);
  }
};

const deleteAlert = async (req, res) => {
  try {
    const result = await AlertService.deleteAlert(req.params.id, req.user);
    return successResponse(res, 'Alerta eliminada correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al eliminar alerta', error.status || 500);
  }
};

module.exports = {
  createAlertFromObservationsController,
  createManualAlertController,
  reevaluateAttendanceAlertController,
  reevaluateObservationAlertController,
  getAlerts,
  getAlertById,
  getAlertObservationsController,
  updateAlertStatus,
  deleteAlert,
};
