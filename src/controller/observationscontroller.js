const ObservationService = require('../services/ObservationService');
const { successResponse, errorResponse } = require('../helpers/response');

const createObservation = async (req, res) => {
  try {
    const result = await ObservationService.createObservation(req.body, req.user);
    return successResponse(res, 'Observacion registrada correctamente', result, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al registrar observacion', error.status || 500);
  }
};

const getObservationsByGroup = async (req, res) => {
  try {
    const result = await ObservationService.getByGroup(req.params.idGrupo, req.query, req.user);
    return successResponse(res, 'Observaciones del grupo obtenidas correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener observaciones del grupo', error.status || 500);
  }
};

const getObservationsByApprentice = async (req, res) => {
  try {
    const result = await ObservationService.getByApprentice(req.params.idAprendiz, req.query, req.user);
    return successResponse(res, 'Historial de observaciones obtenido correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener historial de observaciones', error.status || 500);
  }
};

const getMyObservations = async (req, res) => {
  try {
    const result = await ObservationService.getMyObservations(req.query, req.user);
    return successResponse(res, 'Mis observaciones obtenidas correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener mis observaciones', error.status || 500);
  }
};

const getObservationById = async (req, res) => {
  try {
    const result = await ObservationService.getById(req.params.id, req.user);
    return successResponse(res, 'Observacion obtenida correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener observacion', error.status || 500);
  }
};

const updateObservation = async (req, res) => {
  try {
    const allowedFields = ['tipo_observacion', 'severidad', 'descripcion'];
    const hasEditableField = allowedFields.some((field) => req.body[field] !== undefined);

    if (!hasEditableField) {
      return errorResponse(res, 'Debe enviar al menos un campo editable', 400);
    }

    const result = await ObservationService.updateObservation(req.params.id, req.body, req.user);
    return successResponse(res, 'Observacion actualizada correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al actualizar observacion', error.status || 500);
  }
};

const updateObservationStatus = async (req, res) => {
  try {
    const result = await ObservationService.updateObservationStatus(req.params.id, req.body.estado, req.user);
    return successResponse(res, 'Estado de observacion actualizado correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al actualizar estado de observacion', error.status || 500);
  }
};

const deleteObservation = async (req, res) => {
  try {
    const result = await ObservationService.deleteObservation(req.params.id, req.user);
    return successResponse(res, 'Observacion eliminada correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al eliminar observacion', error.status || 500);
  }
};

module.exports = {
  createObservation,
  getObservationsByGroup,
  getObservationsByApprentice,
  getMyObservations,
  getObservationById,
  updateObservation,
  updateObservationStatus,
  deleteObservation,
};
