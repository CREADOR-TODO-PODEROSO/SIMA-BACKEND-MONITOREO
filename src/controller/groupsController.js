const GroupService = require('../services/GroupService');
const { successResponse, errorResponse } = require('../helpers/response');

const getGroups = async (req, res) => {
  try {
    const result = await GroupService.getGroups(req.query, req.user);
    return successResponse(res, 'Grupos obtenidos correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener grupos', error.status || 500);
  }
};

const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await GroupService.getGroupById(id, req.user);
    return successResponse(res, 'Grupo obtenido correctamente', group);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener grupo', error.status || 500);
  }
};

const verifyFichaNumber = async (req, res) => {
  try {
    const { numero_ficha } = req.params;
    const result = await GroupService.verifyFichaNumber(numero_ficha);
    return successResponse(res, 'Verificación completada', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al verificar número de ficha', error.status || 500);
  }
};

const createGroup = async (req, res) => {
  try {
    const createdGroup = await GroupService.createGroup(req.body, req.user);
    return successResponse(res, 'Grupo formativo creado correctamente', createdGroup, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al crear grupo formativo', error.status || 500);
  }
};

const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedGroup = await GroupService.updateGroup(id, req.body, req.user);
    return successResponse(res, 'Grupo formativo actualizado correctamente', updatedGroup);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al actualizar grupo formativo', error.status || 500);
  }
};

const changeGroupStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const group = await GroupService.changeGroupStatus(id, estado, req.user);
    return successResponse(res, 'Estado del grupo actualizado correctamente', group);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al cambiar estado del grupo', error.status || 500);
  }
};

const assignInstructorLeader = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_instructor } = req.body;
    const updatedGroup = await GroupService.assignInstructorLeader(id, id_instructor, req.user);
    return successResponse(res, 'Instructor líder asignado correctamente', updatedGroup);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al asignar instructor líder', error.status || 500);
  }
};

const getAvailableInstructors = async (_req, res) => {
  try {
    const instructors = await GroupService.getAvailableInstructors();
    return successResponse(res, 'Instructores disponibles obtenidos correctamente', instructors);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener instructores disponibles', error.status || 500);
  }
};

module.exports = {
  getGroups,
  getGroupById,
  verifyFichaNumber,
  createGroup,
  updateGroup,
  changeGroupStatus,
  assignInstructorLeader,
  getAvailableInstructors,
};
