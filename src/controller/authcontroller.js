const AuthService = require('../services/AuthService');
const { successResponse, errorResponse } = require('../helpers/response');

const login = async (req, res) => {
  try {
    const result = await AuthService.login(req.body);
    return successResponse(res, 'Inicio de sesión exitoso', result);
  } catch (error) {
    console.error('Error en login:', error);
    return errorResponse(res, error.message || 'Error en el servidor. Intente de nuevo más tarde.', error.status || 500);
  }
};

const me = async (req, res) => {
  try {
    const result = await AuthService.me(req.user.id_usuario);
    return successResponse(res, 'Usuario autenticado obtenido correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener usuario', error.status || 500);
  }
};

module.exports = {
  login,
  me,
};
