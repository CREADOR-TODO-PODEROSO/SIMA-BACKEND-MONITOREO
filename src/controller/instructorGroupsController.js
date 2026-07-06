const InstructorGroupService = require('../services/InstructorGroupService');
const { successResponse, errorResponse } = require('../helpers/response');

const listGroupInstructors = async (req, res) => {
  try {
    const result = await InstructorGroupService.listByGroup(req.params.idGrupo, req.user);
    return successResponse(res, 'Instructores del grupo obtenidos correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener instructores del grupo', error.status || 500);
  }
};

const assignSupportInstructor = async (req, res) => {
  try {
    const result = await InstructorGroupService.assignSupportInstructor(
      req.params.idGrupo,
      req.body.id_instructor,
      req.user
    );
    return successResponse(res, 'Instructor de apoyo asignado correctamente', result, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al asignar instructor de apoyo', error.status || 500);
  }
};

const changeSupportInstructorStatus = async (req, res) => {
  try {
    const result = await InstructorGroupService.changeAssignmentStatus(
      req.params.idGrupo,
      req.params.idInstructor,
      req.body.estado,
      req.user
    );
    return successResponse(res, 'Estado de instructor de apoyo actualizado correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al actualizar instructor de apoyo', error.status || 500);
  }
};

module.exports = {
  listGroupInstructors,
  assignSupportInstructor,
  changeSupportInstructorStatus,
};
