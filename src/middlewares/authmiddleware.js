const { verifyToken } = require('../helpers/jwt');
const { errorResponse } = require('../helpers/response');
const { User, Role, Instructor, Apprentice } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return errorResponse(res, 'Token no proporcionado', 401);
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return errorResponse(res, 'Formato de token invalido', 401);
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded.id_usuario) {
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

    if (!user) {
      return errorResponse(res, 'Usuario no encontrado', 401);
    }

    if (user.estado !== 'ACTIVO') {
      return errorResponse(res, 'Usuario sin acceso al sistema', 403);
    }

    const roleName = user.rol?.nombre || null;
    if (!roleName) {
      return errorResponse(res, 'El usuario no tiene rol asociado', 403);
    }

    let id_instructor = null;
    let id_aprendiz = null;

    if (roleName === 'instructor') {
      if (!user.instructor || user.instructor.estado !== 'ACTIVO') {
        return errorResponse(res, 'El usuario instructor no tiene perfil activo', 403);
      }
      id_instructor = user.instructor.id_instructor;
    }

    if (roleName === 'aprendiz') {
      if (!user.aprendiz || user.aprendiz.estado !== 'ACTIVO') {
        return errorResponse(res, 'El usuario aprendiz no tiene perfil activo', 403);
      }
      id_aprendiz = user.aprendiz.id_aprendiz;
    }

    req.user = {
      id_usuario: user.id_usuario,
      email: user.email,
      estado: user.estado,
      debe_cambiar_password: Boolean(user.debe_cambiar_password),
      id_rol: user.id_rol,
      rol: roleName,
      rol_detalle: user.rol,
      id_instructor,
      id_aprendiz,
    };

    next();
  } catch (error) {
    console.error('Error en authMiddleware:', error.message);
    return errorResponse(res, 'No autorizado', 401);
  }
};

module.exports = authMiddleware;
