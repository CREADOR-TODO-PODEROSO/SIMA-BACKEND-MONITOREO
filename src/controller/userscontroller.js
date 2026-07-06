const UserService = require('../services/UserService');
const { successResponse, errorResponse } = require('../helpers/response');

const getUsers = async (req, res) => {
  try {
    const users = await UserService.getAllUsers(req.query);
    return successResponse(res, 'Usuarios obtenidos correctamente', users);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener usuarios', error.status || 500);
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    const user = await UserService.getUserById(id, requester);
    return successResponse(res, 'Usuario obtenido correctamente', user);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener usuario', error.status || 500);
  }
};

const createUser = async (req, res) => {
  try {
    const { email, id_rol, tipo_documento, numero_documento, nombres, apellidos } = req.body;
    if (!email || !id_rol || !tipo_documento || !numero_documento || !nombres || !apellidos) {
      return errorResponse(res, 'Faltan campos obligatorios', 400);
    }
    const createdUser = await UserService.createUser(req.body, req.user);
    return successResponse(res, 'Usuario creado correctamente', createdUser, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al crear usuario', error.status || 500);
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requester = req.user;
    const updatedUser = await UserService.updateUser(id, req.body, requester);
    return successResponse(res, 'Usuario actualizado correctamente', updatedUser);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al actualizar usuario', error.status || 500);
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await UserService.deleteUser(id, req.user);
    return successResponse(res, 'Usuario deshabilitado correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al deshabilitar usuario', error.status || 500);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
