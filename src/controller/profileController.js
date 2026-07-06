const ProfileService = require('../services/profileService');
const { successResponse, errorResponse } = require('../helpers/response');

const getProfile = async (req, res) => {
  try {
    const profile = await ProfileService.getOverview(req.user);
    return successResponse(res, 'Perfil obtenido correctamente', profile);
  } catch (error) {
    return errorResponse(
      res,
      error.message || 'Error al obtener el perfil',
      error.status || 500
    );
  }
};

const updateProfile = async (req, res) => {
  try {
    const result = await ProfileService.updateProfile(req.user.id_usuario, req.body);
    return successResponse(res, result.message);
  } catch (error) {
    return errorResponse(
      res,
      error.message || 'Error al actualizar el perfil',
      error.status || 500
    );
  }
};

module.exports = {
  getProfile,
  updateProfile,
};
