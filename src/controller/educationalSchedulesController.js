const EducationalScheduleService = require('../services/EducationalScheduleService');
const { successResponse, errorResponse } = require('../helpers/response');

const getCatalogs = async (req, res) => {
  try {
    const catalogs = await EducationalScheduleService.getCatalogs(req.query, req.user);
    return successResponse(res, 'Catalogos de horarios obtenidos correctamente', catalogs);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener catalogos de horarios', error.status || 500);
  }
};

const createSchedule = async (req, res) => {
  try {
    const schedule = await EducationalScheduleService.createSchedule(req.body, req.user);
    return successResponse(res, 'Horario formativo creado correctamente', schedule, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al crear horario formativo', error.status || 500);
  }
};

const getSchedulesByGroup = async (req, res) => {
  try {
    const schedules = await EducationalScheduleService.getByGroup(req.params.idGrupo, req.query, req.user);
    return successResponse(res, 'Horarios del grupo obtenidos correctamente', schedules);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener horarios del grupo', error.status || 500);
  }
};

const getMySchedules = async (req, res) => {
  try {
    const schedules = await EducationalScheduleService.getMySchedules(req.query, req.user);
    return successResponse(res, 'Horarios del instructor obtenidos correctamente', schedules);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener horarios del instructor', error.status || 500);
  }
};

const getScheduleById = async (req, res) => {
  try {
    const schedule = await EducationalScheduleService.getById(req.params.id, req.user);
    return successResponse(res, 'Horario formativo obtenido correctamente', schedule);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener horario formativo', error.status || 500);
  }
};

const updateSchedule = async (req, res) => {
  try {
    const schedule = await EducationalScheduleService.updateSchedule(req.params.id, req.body, req.user);
    return successResponse(res, 'Horario formativo actualizado correctamente', schedule);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al actualizar horario formativo', error.status || 500);
  }
};

const deactivateSchedule = async (req, res) => {
  try {
    const schedule = await EducationalScheduleService.deactivateSchedule(req.params.id, req.user);
    return successResponse(res, 'Horario formativo desactivado correctamente', schedule);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al desactivar horario formativo', error.status || 500);
  }
};

module.exports = {
  getCatalogs,
  createSchedule,
  getSchedulesByGroup,
  getMySchedules,
  getScheduleById,
  updateSchedule,
  deactivateSchedule,
};
