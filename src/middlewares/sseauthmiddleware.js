const { verifyToken } = require('../helpers/jwt');
const { errorResponse } = require('../helpers/response');
const { User, Role, Instructor, Apprentice } = require('../models');

const sseAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = req.query.token;

    if (!token && authHeader) {
      const [scheme, headerToken] = authHeader.split(' ');
      if (scheme === 'Bearer') token = headerToken;
    }

    if (!token) {
      return errorResponse(res, 'Token no proporcionado', 401);
    }

    const decoded = verifyToken(token);
    if (!decoded?.id_usuario) {
      return errorResponse(res, 'Token invalido: id_usuario no encontrado', 401);
    }

    const user = await User.findByPk(decoded.id_usuario, {
      attributes: ['id_usuario', 'email', 'estado', 'id_rol', 'debe_cambiar_password'],
      include: [
        { model: Role, as: 'rol', attributes: ['id_rol', 'nombre', 'descripcion'] },
        { model: Instructor, as: 'instructor', required: false, attributes: ['id_instructor', 'estado'] },
        { model: Apprentice, as: 'aprendiz', required: false, attributes: ['id_aprendiz', 'estado'] },
      ],
    });

    if (!user || user.estado !== 'ACTIVO' || !user.rol?.nombre) {
      return errorResponse(res, 'Usuario sin acceso al sistema', 403);
    }

    if (user.rol.nombre === 'instructor' && (!user.instructor || user.instructor.estado !== 'ACTIVO')) {
      return errorResponse(res, 'El usuario instructor no tiene perfil activo', 403);
    }

    if (user.rol.nombre === 'aprendiz' && (!user.aprendiz || user.aprendiz.estado !== 'ACTIVO')) {
      return errorResponse(res, 'El usuario aprendiz no tiene perfil activo', 403);
    }

    req.user = {
      id_usuario: user.id_usuario,
      email: user.email,
      estado: user.estado,
      debe_cambiar_password: Boolean(user.debe_cambiar_password),
      id_rol: user.id_rol,
      rol: user.rol.nombre,
      rol_detalle: user.rol,
      id_instructor: user.instructor?.estado === 'ACTIVO' ? user.instructor.id_instructor : null,
      id_aprendiz: user.aprendiz?.estado === 'ACTIVO' ? user.aprendiz.id_aprendiz : null,
    };

    return next();
  } catch (error) {
    console.error('Error en sseAuthMiddleware:', error.message);
    return errorResponse(res, 'No autorizado', 401);
  }
};

module.exports = sseAuthMiddleware;
