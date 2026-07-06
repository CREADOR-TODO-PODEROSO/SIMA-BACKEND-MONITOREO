const { User, Role, Person, Instructor, Apprentice } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

class AuthService {
  static async login(data) {
    const { numero_documento, documento, password } = data;
    const documentValue = (numero_documento || documento || '').trim();

    if (!documentValue || !password) {
      throw { status: 400, message: 'Número de documento y contraseña son obligatorios' };
    }

    const user = await User.findOne({
      include: [
        { model: Role, as: 'rol', attributes: ['id_rol', 'nombre', 'descripcion'] },
        { model: Person, as: 'persona', where: { numero_documento: documentValue }, required: true, attributes: ['id_persona', 'tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'] },
        { model: Instructor, as: 'instructor', required: false, attributes: ['id_instructor', 'estado'] },
        { model: Apprentice, as: 'aprendiz', required: false, attributes: ['id_aprendiz', 'estado'] },
      ],
    });

    if (!user) throw { status: 401, message: 'Credenciales inválidas. Verifique su información.' };

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) throw { status: 401, message: 'Credenciales inválidas. Verifique su información.' };

    if (user.estado !== 'ACTIVO') throw { status: 403, message: 'Usuario inactivo. Contacta al administrador.' };

    const roleName = user.rol ? user.rol.nombre : null;

    let id_instructor = null;
    let id_aprendiz = null;

    if (roleName === 'instructor') {
      if (!user.instructor || user.instructor.estado !== 'ACTIVO') {
        throw { status: 403, message: 'El usuario tiene rol instructor pero no cuenta con perfil activo de instructor' };
      }
      id_instructor = user.instructor.id_instructor;
    }

    if (roleName === 'aprendiz') {
      if (!user.aprendiz || user.aprendiz.estado !== 'ACTIVO') {
        throw { status: 403, message: 'El usuario tiene rol aprendiz pero no cuenta con perfil activo de aprendiz' };
      }
      id_aprendiz = user.aprendiz.id_aprendiz;
    }

    // INYECCIÓN DE IDS EN EL JWT (Optimización de rendimiento)
    const payload = {
      id_usuario: user.id_usuario,
      id_rol: user.id_rol,
      rol: roleName,
      rol_detalle: user.rol,
      id_instructor,
      id_aprendiz,
      estado: user.estado,
      debe_cambiar_password: Boolean(user.debe_cambiar_password),
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '8h' });

    return {
      token,
      user: {
        id_usuario: user.id_usuario,
        email: user.email,
        estado: user.estado,
        debe_cambiar_password: Boolean(user.debe_cambiar_password),
        id_rol: user.id_rol,
        rol: roleName,
        id_instructor,
        id_aprendiz,
        rol_detalle: user.rol || null,
        persona: user.persona || null,
      },
    };
  }

  static async me(id_usuario) {
    const user = await User.findByPk(id_usuario, {
      include: [
        { model: Role, as: 'rol', attributes: ['id_rol', 'nombre', 'descripcion'] },
        { model: Person, as: 'persona', attributes: ['id_persona', 'tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'] },
        { model: Instructor, as: 'instructor', required: false, attributes: ['id_instructor', 'estado'] },
        { model: Apprentice, as: 'aprendiz', required: false, attributes: ['id_aprendiz', 'estado'] },
      ],
    });

    if (!user) throw { status: 404, message: 'Usuario no encontrado' };

    return {
      id_usuario: user.id_usuario,
      email: user.email,
      estado: user.estado,
      debe_cambiar_password: Boolean(user.debe_cambiar_password),
      id_rol: user.id_rol,
      rol: user.rol?.nombre || null,
      id_instructor: user.instructor?.estado === 'ACTIVO' ? user.instructor.id_instructor : null,
      id_aprendiz: user.aprendiz?.estado === 'ACTIVO' ? user.aprendiz.id_aprendiz : null,
      rol_detalle: user.rol || null,
      persona: user.persona || null,
    };
  }
}

module.exports = AuthService;
