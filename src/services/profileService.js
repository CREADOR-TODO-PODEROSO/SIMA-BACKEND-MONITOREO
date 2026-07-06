const { Op } = require('sequelize');
const {
  User,
  Person,
  Role,
  CoordinatorArea,
  EducationalArea,
  Apprentice,
  ApprenticeGroup,
  Group,
  Instructor,
  InstructorGroup,
  sequelize,
} = require('../models');
const bcrypt = require('bcrypt');

class ProfileService {
  static async getOverview(userContext) {
    const { id_usuario, rol, id_instructor, id_aprendiz } = userContext;

    // Obtener información base (excluyendo password)
    const user = await User.findByPk(id_usuario, {
      attributes: ['id_usuario', 'email', 'estado', 'debe_cambiar_password'],
      include: [
        {
          model: Role,
          as: 'rol',
          attributes: ['nombre', 'descripcion'],
        },
        {
          model: Person,
          as: 'persona',
          attributes: ['tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'],
        },
      ],
    });

    if (!user) throw { status: 404, message: 'Usuario no encontrado' };

    const profileData = {
      id_usuario: user.id_usuario,
      email: user.email,
      estado: user.estado,
      debe_cambiar_password: Boolean(user.debe_cambiar_password),
      rol: user.rol?.nombre,
      persona: user.persona,
      informacion_rol: {},
    };

    // Agregar inteligencia según el rol
    if (rol === 'coordinador') {
      const areas = await CoordinatorArea.findAll({
        where: { id_usuario, estado: 'ACTIVO' },
        include: [
          {
            model: EducationalArea,
            as: 'area',
            attributes: ['nombre_area'],
          },
        ],
      });
      profileData.informacion_rol.areas_asignadas = areas.map((a) => a.area?.nombre_area).filter(Boolean);
    } 
    else if (rol === 'aprendiz' && id_aprendiz) {
      const activeGroups = await ApprenticeGroup.findAll({
        where: { id_aprendiz, estado: 'ACTIVO' },
        include: [
          {
            model: Group,
            as: 'grupo',
            attributes: ['numero_ficha'],
          },
        ],
      });
      profileData.informacion_rol.fichas_activas = activeGroups.map((ag) => ag.grupo?.numero_ficha).filter(Boolean);
    } 
    else if (rol === 'instructor' && id_instructor) {
      // Grupos donde lidera
      const ledGroups = await Group.findAll({
        where: { id_instructor_lider: id_instructor, estado: { [Op.ne]: 'FINALIZADO' } },
        attributes: ['numero_ficha'],
      });
      
      // Grupos donde está asignado
      const assignedGroups = await InstructorGroup.findAll({
        where: { id_instructor, estado: 'ACTIVO' },
        include: [
          {
            model: Group,
            as: 'grupo',
            attributes: ['numero_ficha'],
          },
        ],
      });

      profileData.informacion_rol.fichas_lideradas = ledGroups.map((g) => g.numero_ficha);
      profileData.informacion_rol.fichas_asignadas = assignedGroups.map((ig) => ig.grupo?.numero_ficha).filter(Boolean);
    }

    return profileData;
  }

  static async updateProfile(id_usuario, data) {
    const { email, telefono, password_actual, password_nuevo } = data;

    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(id_usuario, {
        include: [{ model: Person, as: 'persona' }],
        transaction,
      });

      if (!user) throw { status: 404, message: 'Usuario no encontrado' };

      const userUpdateData = {};
      const personUpdateData = {};

      // Actualizar Email
      if (email && email !== user.email) {
        const emailExists = await User.findOne({ where: { email }, transaction });
        if (emailExists) throw { status: 409, message: 'El correo electrónico ya está en uso' };
        userUpdateData.email = email;
      }

      // Actualizar Teléfono
      if (telefono !== undefined && user.persona) {
        personUpdateData.telefono = telefono;
      }

      // Actualizar Password
      if (password_nuevo) {
        if (!password_actual) {
          throw { status: 400, message: 'Debe proporcionar la contraseña actual para establecer una nueva' };
        }
        
        const passwordMatch = await bcrypt.compare(password_actual, user.password);
        if (!passwordMatch) {
          throw { status: 401, message: 'La contraseña actual es incorrecta' };
        }

        userUpdateData.password = await bcrypt.hash(password_nuevo, 10);
        userUpdateData.debe_cambiar_password = false;
      }

      if (Object.keys(userUpdateData).length > 0) {
        await user.update(userUpdateData, { transaction });
      }

      if (user.persona && Object.keys(personUpdateData).length > 0) {
        await user.persona.update(personUpdateData, { transaction });
      }

      await transaction.commit();

      return { message: 'Perfil actualizado exitosamente' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = ProfileService;
