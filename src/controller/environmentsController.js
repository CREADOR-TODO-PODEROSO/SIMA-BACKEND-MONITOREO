const { Environment } = require('../models');
const { successResponse, errorResponse } = require('../helpers/response');

const getEnvironments = async (req, res) => {
  try {
    const where = {};
    if (req.query.estado) where.estado = req.query.estado;

    const environments = await Environment.findAll({
      where,
      attributes: ['id_ambiente', 'nombre_ambiente', 'ubicacion', 'capacidad', 'estado'],
      order: [['nombre_ambiente', 'ASC']],
    });

    return successResponse(res, 'Ambientes obtenidos correctamente', { ambientes: environments });
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener ambientes', error.status || 500);
  }
};

module.exports = {
  getEnvironments,
};
