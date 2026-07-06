const {
  User,
  Role,
  EducationalArea,
  CoordinatorArea,
} = require('../models');
const { successResponse, errorResponse } = require('../helpers/response');

const assignAreaToCoordinator = async (req, res) => {
  try {
    const { id_usuario, id_area } = req.body;

    if (!id_usuario || !id_area) {
      return errorResponse(res, 'id_usuario e id_area son obligatorios', 400);
    }

    const user = await User.findByPk(id_usuario, {
      include: [
        {
          model: Role,
          as: 'rol',
          attributes: ['nombre'],
        },
      ],
    });

    if (!user) {
      return errorResponse(res, 'Usuario no encontrado', 404);
    }

    if (user.rol?.nombre !== 'coordinador') {
      return errorResponse(res, 'El usuario no tiene rol coordinador', 400);
    }

    const area = await EducationalArea.findByPk(id_area);

    if (!area) {
      return errorResponse(res, 'Área no encontrada', 404);
    }

    const existing = await CoordinatorArea.findOne({
      where: { id_usuario, id_area },
    });

    if (existing) {
      await existing.update({ estado: 'ACTIVO' });
      return successResponse(res, 'Área reactivada para el coordinador', existing);
    }

    const assignment = await CoordinatorArea.create({
      id_usuario,
      id_area,
      estado: 'ACTIVO',
    });

    return successResponse(res, 'Área asignada correctamente', assignment, 201);
  } catch (error) {
    return errorResponse(res, 'Error al asignar área al coordinador', 500, error.message);
  }
};

const getAreas = async (_req, res) => {
  try {
    const areas = await EducationalArea.findAll({
      attributes: ['id_area', 'nombre_area'],
      order: [['nombre_area', 'ASC']],
    });

    return successResponse(res, 'Areas de formacion obtenidas correctamente', { areas });
  } catch (error) {
    return errorResponse(res, 'Error al obtener areas de formacion', 500, error.message);
  }
};

const removeAreaFromCoordinator = async (req, res) => {
  try {
    const { idUsuario, idArea } = req.params;

    const assignment = await CoordinatorArea.findOne({
      where: {
        id_usuario: idUsuario,
        id_area: idArea,
      },
    });

    if (!assignment) {
      return errorResponse(res, 'Asignación no encontrada', 404);
    }

    await assignment.update({ estado: 'INACTIVO' });

    return successResponse(res, 'Asignación desactivada correctamente', assignment);
  } catch (error) {
    return errorResponse(res, 'Error al desactivar asignación', 500, error.message);
  }
};

const getCoordinatorAreas = async (req, res) => {
  try {
    const { idUsuario } = req.params;

    const assignments = await CoordinatorArea.findAll({
      where: {
        id_usuario: idUsuario,
        estado: 'ACTIVO',
      },
      include: [
        {
          model: EducationalArea,
          as: 'area',
          attributes: ['id_area', 'nombre_area'],
        },
      ],
      order: [[{ model: EducationalArea, as: 'area' }, 'nombre_area', 'ASC']],
    });

    return successResponse(res, 'Áreas del coordinador obtenidas correctamente', assignments);
  } catch (error) {
    return errorResponse(res, 'Error al obtener áreas del coordinador', 500, error.message);
  }
};

module.exports = {
  assignAreaToCoordinator,
  getAreas,
  removeAreaFromCoordinator,
  getCoordinatorAreas,
};
