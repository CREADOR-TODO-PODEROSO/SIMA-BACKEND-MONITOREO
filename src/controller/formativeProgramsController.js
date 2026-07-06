const { FormativeProgram, EducationalArea } = require('../models');
const { successResponse, errorResponse } = require('../helpers/response');
const { getCoordinatorAreaIds } = require('../helpers/coordinatorAuth');

const getProgramsByArea = async (req, res) => {
  try {
    const { idArea } = req.params;
    const areaId = Number(idArea);

    if (!Number.isInteger(areaId) || areaId <= 0) {
      return errorResponse(res, 'El id del area debe ser un entero valido', 400);
    }

    const area = await EducationalArea.findByPk(areaId);
    if (!area) {
      return errorResponse(res, 'Area de formacion no encontrada', 404);
    }

    const areaIds = await getCoordinatorAreaIds(req.user.id_usuario);
    if (!areaIds.includes(areaId)) {
      return errorResponse(res, 'No tienes permisos para consultar programas de esta area', 403);
    }

    const programs = await FormativeProgram.findAll({
      where: { id_area: areaId },
      attributes: ['id_programa', 'nombre_programa'],
      include: [
        {
          model: EducationalArea,
          as: 'area',
          attributes: ['id_area', 'nombre_area'],
        },
      ],
      order: [['nombre_programa', 'ASC']],
    });

    return successResponse(res, 'Programas obtenidos correctamente', programs);
  } catch (error) {
    return errorResponse(res, 'Error al obtener programas de formacion', 500, error.message);
  }
};

module.exports = {
  getProgramsByArea,
};
