const { Op } = require('sequelize');
const {
  User,
  Role,
  Person,
  Instructor,
  Apprentice,
  Group,
  ApprenticeGroup,
  InstructorGroup,
  Alert,
  CoordinatorArea,
  EducationalArea,
  sequelize,
} = require('../models');
const { hashPassword } = require('../helpers/bcrypt');
const { getPagination } = require('../helpers/pagination');
const { assertRequesterCanAccessGroup } = require('../helpers/coordinatorAuth');

class UserService {
  static _roleName(value) {
    return String(value || '').toLowerCase().trim();
  }

  static _assertCoordinatorCanManageRole(requester, targetRoleName, action = 'gestionar') {
    if (this._roleName(requester?.rol) !== 'coordinador') return;

    const allowedRoles = ['aprendiz', 'instructor'];
    if (!allowedRoles.includes(this._roleName(targetRoleName))) {
      throw {
        status: 403,
        message: `El coordinador solo puede ${action} usuarios con rol aprendiz o instructor`,
      };
    }
  }

  /**
   * Obtiene todos los usuarios
   */
  static async getAllUsers(filters = {}) {
    const {
      page,
      limit,
      rol,
      estado,
      q,
      search,
      documento,
      nombre,
      email,
    } = filters;
    const { limit: take, offset } = getPagination(page, limit);

    const whereUser = {};
    if (estado) whereUser.estado = estado;
    if (email) whereUser.email = { [Op.like]: `%${email}%` };

    const whereRole = {};
    if (rol) whereRole.nombre = rol;

    const wherePerson = {};
    if (documento) wherePerson.numero_documento = { [Op.like]: `%${documento}%` };
    if (nombre) {
      wherePerson[Op.or] = [
        { nombres: { [Op.like]: `%${nombre}%` } },
        { apellidos: { [Op.like]: `%${nombre}%` } },
      ];
    }

    const searchTerm = q || search;
    if (searchTerm) {
      const likeSearch = { [Op.like]: `%${searchTerm}%` };
      whereUser[Op.or] = [
        ...(whereUser[Op.or] || []),
        { email: likeSearch },
        { '$persona.numero_documento$': likeSearch },
        { '$persona.nombres$': likeSearch },
        { '$persona.apellidos$': likeSearch },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereUser,
      attributes: ['id_usuario', 'email', 'estado', 'debe_cambiar_password', 'created_at'],
      include: [
        {
          model: Role,
          as: 'rol',
          attributes: ['id_rol', 'nombre'],
          ...(Object.keys(whereRole).length ? { where: whereRole, required: true } : {}),
        },
        {
          model: Person,
          as: 'persona',
          attributes: ['id_persona', 'tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'],
          ...(Object.keys(wherePerson).length ? { where: wherePerson, required: true } : {}),
        },
        { model: Instructor, as: 'instructor', required: false, attributes: ['id_instructor', 'estado'] },
        { model: Apprentice, as: 'aprendiz', required: false, attributes: ['id_aprendiz', 'estado', 'estado_formativo'] },
      ],
      order: [['id_usuario', 'ASC']],
      limit: take,
      offset,
      distinct: true,
      subQuery: false,
    });

    return { total: count, pagina: Number(page) || 1, usuarios: rows };
  }

  /**
   * Obtiene un usuario por ID con comprobación de permisos
   */
  static async getUserById(id, requester) {
    const targetUser = await User.findByPk(id, {
      attributes: ['id_usuario', 'email', 'estado', 'debe_cambiar_password', 'created_at'],
      include: [
        { model: Role, as: 'rol', attributes: ['id_rol', 'nombre'] },
        { model: Person, as: 'persona', attributes: ['id_persona', 'tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'] },
        { model: Instructor, as: 'instructor', required: false, attributes: ['id_instructor', 'estado'] },
        { model: Apprentice, as: 'aprendiz', required: false, attributes: ['id_aprendiz', 'estado', 'estado_formativo'] },
      ],
    });

    if (!targetUser) {
      throw { status: 404, message: 'Usuario no encontrado' };
    }

    const requesterRole = String(requester.rol || '').toLowerCase();

    if (requesterRole === 'super_admin' || requesterRole === 'coordinador') {
      return targetUser;
    }

    if (requesterRole === 'aprendiz') {
      if (Number(requester.id_usuario) !== Number(id)) {
        throw { status: 403, message: 'No tienes permisos para consultar los datos de otro usuario' };
      }
      return targetUser;
    }

    if (requesterRole === 'instructor') {
      if (!targetUser.aprendiz) {
        throw { status: 403, message: 'Un instructor solo puede consultar aprendices relacionados' };
      }

      const requesterInstructor = await Instructor.findOne({
        where: { id_usuario: requester.id_usuario, estado: 'ACTIVO' },
        attributes: ['id_instructor'],
      });

      if (!requesterInstructor) {
        throw { status: 403, message: 'El usuario instructor no tiene perfil activo de instructor' };
      }

      const apprenticeGroupLinks = await ApprenticeGroup.findAll({
        where: { id_aprendiz: targetUser.aprendiz.id_aprendiz, estado: 'ACTIVO' },
        attributes: ['id_grupo'],
      });

      if (!apprenticeGroupLinks.length) {
        throw { status: 403, message: 'El aprendiz no pertenece a grupos formativos activos' };
      }

      const groupIds = apprenticeGroupLinks.map((item) => item.id_grupo);

      const leaderGroup = await Group.findOne({
        where: {
          id_grupo: { [Op.in]: groupIds },
          id_instructor_lider: requesterInstructor.id_instructor,
        },
        attributes: ['id_grupo'],
      });

      if (leaderGroup) {
        return {
          id_usuario: targetUser.id_usuario,
          email: targetUser.email,
          persona: {
            nombres: targetUser.persona?.nombres || null,
            apellidos: targetUser.persona?.apellidos || null,
            numero_documento: targetUser.persona?.numero_documento || null,
          },
        };
      }

      const assignedGroup = await InstructorGroup.findOne({
        where: {
          id_instructor: requesterInstructor.id_instructor,
          id_grupo: { [Op.in]: groupIds },
          estado: 'ACTIVO',
        },
        attributes: ['id_grupo'],
      });

      if (assignedGroup) {
        return {
          id_usuario: targetUser.id_usuario,
          email: targetUser.email,
          persona: {
            nombres: targetUser.persona?.nombres || null,
            apellidos: targetUser.persona?.apellidos || null,
            telefono: targetUser.persona?.telefono || null,
          },
        };
      }

      throw { status: 403, message: 'No tienes permisos para consultar este aprendiz' };
    }

    throw { status: 403, message: 'Rol no autorizado para esta operación' };
  }

  /**
   * Crea un usuario y sus perfiles asociados usando transacción
   */
  static async createUser(data, requester) {
    const {
      email,
      password,
      id_rol,
      tipo_documento,
      numero_documento,
      nombres,
      apellidos,
      telefono,
      id_grupo,
      id_area,
    } = data;
    const transaction = await sequelize.transaction();

    try {
      const existingUser = await User.findOne({ where: { email }, transaction });
      if (existingUser) throw { status: 409, message: 'El correo ya está registrado' };

      const existingPerson = await Person.findOne({ where: { numero_documento }, transaction });
      if (existingPerson) throw { status: 409, message: 'Ya existe una persona registrada con ese número de documento' };

      const role = await Role.findByPk(id_rol, { transaction });
      if (!role) throw { status: 404, message: 'Rol no encontrado' };

      const roleName = this._roleName(role.nombre);
      this._assertCoordinatorCanManageRole(requester, roleName, 'crear');
      let selectedGroup = null;
      let selectedArea = null;

      if (roleName === 'aprendiz') {
        if (!id_grupo) {
          throw { status: 400, message: 'La ficha activa es obligatoria para registrar un aprendiz' };
        }

        selectedGroup = await Group.findByPk(id_grupo, { transaction });
        if (!selectedGroup) throw { status: 404, message: 'Ficha formativa no encontrada' };
        if (selectedGroup.estado !== 'EN_FORMACION') {
          throw { status: 400, message: 'El aprendiz solo puede vincularse a una ficha en formacion' };
        }

        if (requester) {
          await assertRequesterCanAccessGroup(
            requester,
            id_grupo,
            'No tienes permisos para registrar aprendices en esta ficha'
          );
        }
      }

      if (roleName === 'coordinador') {
        if (!id_area) {
          throw { status: 400, message: 'El area es obligatoria para registrar un coordinador' };
        }

        selectedArea = await EducationalArea.findByPk(id_area, { transaction });
        if (!selectedArea) throw { status: 404, message: 'Area de formacion no encontrada' };

        const activeAreaCoordinator = await CoordinatorArea.findOne({
          where: { id_area, estado: 'ACTIVO' },
          transaction,
        });
        if (activeAreaCoordinator) {
          throw { status: 409, message: 'El area seleccionada ya tiene un coordinador activo' };
        }
      }

      const plainPassword = password && String(password).trim() !== '' ? String(password) : String(numero_documento);
      const hashedPassword = await hashPassword(plainPassword);

      const user = await User.create({
        email,
        password: hashedPassword,
        id_rol,
        estado: 'ACTIVO',
        debe_cambiar_password: roleName === 'aprendiz',
      }, { transaction });

      await Person.create({
        id_usuario: user.id_usuario,
        tipo_documento,
        numero_documento,
        nombres,
        apellidos,
        telefono: telefono || null,
      }, { transaction });

      await this._syncUserProfile(user.id_usuario, roleName, transaction);

      if (selectedGroup) {
        const apprentice = await Apprentice.findOne({
          where: { id_usuario: user.id_usuario },
          transaction,
        });

        if (!apprentice) {
          throw { status: 500, message: 'No se pudo crear el perfil de aprendiz' };
        }

        await ApprenticeGroup.create({
          id_aprendiz: apprentice.id_aprendiz,
          id_grupo: selectedGroup.id_grupo,
          estado: 'ACTIVO',
        }, { transaction });
      }

      if (selectedArea) {
        await CoordinatorArea.create({
          id_usuario: user.id_usuario,
          id_area: selectedArea.id_area,
          estado: 'ACTIVO',
          asignado_por: requester?.id_usuario || null,
        }, { transaction });
      }

      await transaction.commit();

      return User.findByPk(user.id_usuario, {
        attributes: ['id_usuario', 'email', 'estado', 'debe_cambiar_password', 'created_at'],
        include: [
          { model: Role, as: 'rol', attributes: ['id_rol', 'nombre'] },
          { model: Person, as: 'persona', attributes: ['id_persona', 'tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'] },
          { model: Instructor, as: 'instructor', required: false, attributes: ['id_instructor', 'codigo_instructor', 'especialidad', 'estado'] },
          { model: Apprentice, as: 'aprendiz', required: false, attributes: ['id_aprendiz', 'estado_formativo', 'estado'] },
        ],
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Actualiza un usuario
   */
  static async _instructorCanAccessApprentice(requester, idAprendiz, transaction) {
    if (this._roleName(requester.rol) !== 'instructor' || !requester.id_instructor || !idAprendiz) {
      return false;
    }

    const apprenticeGroupLinks = await ApprenticeGroup.findAll({
      where: { id_aprendiz: idAprendiz, estado: 'ACTIVO' },
      attributes: ['id_grupo'],
      transaction,
    });

    if (!apprenticeGroupLinks.length) return false;

    const groupIds = apprenticeGroupLinks.map((item) => item.id_grupo);

    const leaderGroup = await Group.findOne({
      where: {
        id_grupo: { [Op.in]: groupIds },
        id_instructor_lider: requester.id_instructor,
      },
      attributes: ['id_grupo'],
      transaction,
    });

    if (leaderGroup) return true;

    const assignedGroup = await InstructorGroup.findOne({
      where: {
        id_instructor: requester.id_instructor,
        id_grupo: { [Op.in]: groupIds },
        estado: 'ACTIVO',
      },
      attributes: ['id_grupo'],
      transaction,
    });

    return Boolean(assignedGroup);
  }

  static async updateUser(id, data, requester) {
    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(id, {
        include: [
          { model: Role, as: 'rol' },
          { model: Person, as: 'persona' },
          { model: Apprentice, as: 'aprendiz', required: false },
        ],
        transaction,
      });
      if (!user) throw { status: 404, message: 'Usuario no encontrado' };

      const requesterRole = this._roleName(requester.rol);
      const isAdminManager = ['super_admin', 'coordinador'].includes(requesterRole);
      const isSelfUpdate = Number(requester.id_usuario) === Number(id);

      if (!isAdminManager && !isSelfUpdate) {
        throw { status: 403, message: 'No tienes permisos para modificar los datos de otro usuario' };
      }

      if (data.email && data.email !== user.email) {
        const emailExists = await User.findOne({ where: { email: data.email }, transaction });
        if (emailExists) throw { status: 409, message: 'El correo ya está registrado' };
      }

      const userUpdateData = {};
      const personUpdateData = {};

      if (requesterRole === 'coordinador') {
        this._assertCoordinatorCanManageRole(requester, user.rol?.nombre, 'actualizar');
      }

      if (isAdminManager) {
        if (data.email !== undefined) userUpdateData.email = data.email;
        if (data.id_rol !== undefined) {
          const requestedRole = await Role.findByPk(data.id_rol, { transaction });
          if (!requestedRole) throw { status: 404, message: 'Rol no encontrado' };
          this._assertCoordinatorCanManageRole(requester, requestedRole.nombre, 'actualizar');
          userUpdateData.id_rol = data.id_rol;
        }
        if (data.estado !== undefined) userUpdateData.estado = data.estado;

        if (data.password && String(data.password).trim() !== '') {
          userUpdateData.password = await hashPassword(String(data.password));
          userUpdateData.debe_cambiar_password = false;
        }

        if (user.persona) {
          if (data.numero_documento && data.numero_documento !== user.persona.numero_documento) {
            const documentExists = await Person.findOne({ where: { numero_documento: data.numero_documento }, transaction });
            if (documentExists) throw { status: 409, message: 'Ya existe una persona registrada con ese número de documento' };
          }
          if (data.tipo_documento !== undefined) personUpdateData.tipo_documento = data.tipo_documento;
          if (data.numero_documento !== undefined) personUpdateData.numero_documento = data.numero_documento;
          if (data.nombres !== undefined) personUpdateData.nombres = data.nombres;
          if (data.apellidos !== undefined) personUpdateData.apellidos = data.apellidos;
          if (data.telefono !== undefined) personUpdateData.telefono = data.telefono;
        }
      } else {
        if (data.id_rol !== undefined || data.estado !== undefined) {
          throw { status: 403, message: 'No tienes permisos para modificar rol o estado' };
        }
        if (data.tipo_documento !== undefined || data.numero_documento !== undefined || data.nombres !== undefined || data.apellidos !== undefined) {
          throw { status: 403, message: 'No tienes permisos para modificar tipo de documento, número de documento, nombres o apellidos' };
        }

        if (data.email !== undefined) userUpdateData.email = data.email;
        if (data.password && String(data.password).trim() !== '') {
          userUpdateData.password = await hashPassword(String(data.password));
          userUpdateData.debe_cambiar_password = false;
        }
        if (user.persona && data.telefono !== undefined) {
          personUpdateData.telefono = data.telefono;
        }
      }

      if (Object.keys(userUpdateData).length > 0) {
        await user.update(userUpdateData, { transaction });
      }
      if (user.persona && Object.keys(personUpdateData).length > 0) {
        await user.persona.update(personUpdateData, { transaction });
      }

      if (isAdminManager && data.id_rol !== undefined) {
        const newRole = await Role.findByPk(data.id_rol, { transaction });
        if (!newRole) throw { status: 404, message: 'Rol no encontrado' };
        await this._syncUserProfile(user.id_usuario, this._roleName(newRole.nombre), transaction);
      }

      await transaction.commit();

      return User.findByPk(id, {
        attributes: ['id_usuario', 'email', 'estado', 'debe_cambiar_password', 'created_at'],
        include: [
          { model: Role, as: 'rol', attributes: ['id_rol', 'nombre'] },
          { model: Person, as: 'persona', attributes: ['id_persona', 'tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'] },
        ],
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Elimina/Deshabilita usuario
   */
  static async deleteUser(id, requester) {
    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(id, {
        include: [{ model: Apprentice, as: 'aprendiz', required: false }],
        transaction,
      });
      if (!user) throw { status: 404, message: 'Usuario no encontrado' };

      if (user.aprendiz && this._roleName(requester?.rol) === 'coordinador') {
        const activeLinks = await ApprenticeGroup.findAll({
          where: { id_aprendiz: user.aprendiz.id_aprendiz, estado: 'ACTIVO' },
          attributes: ['id_grupo'],
          transaction,
        });

        if (!activeLinks.length) {
          throw { status: 403, message: 'El aprendiz no tiene vinculos activos en grupos gestionables' };
        }

        await Promise.all(activeLinks.map((link) => assertRequesterCanAccessGroup(
          requester,
          link.id_grupo,
          'No tienes permisos para desactivar este aprendiz'
        )));
      }

      await user.update({ estado: 'INACTIVO' }, { transaction });

      if (user.aprendiz) {
        await user.aprendiz.update({ estado: 'INACTIVO' }, { transaction });
        await Alert.update(
          {
            estado: 'CERRADA',
            justificacion_cierre: 'Cierre automatico por desactivacion del aprendiz.',
            fecha_cierre: new Date(),
            cerrada_por: requester?.id_usuario || null,
          },
          {
            where: { id_aprendiz: user.aprendiz.id_aprendiz, estado: 'ABIERTA' },
            transaction,
          }
        );
      }

      await transaction.commit();
      return {
        id_usuario: user.id_usuario,
        estado: 'INACTIVO',
        aprendiz: user.aprendiz ? { id_aprendiz: user.aprendiz.id_aprendiz, estado: 'INACTIVO' } : null,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Cambia el rol de un usuario y sincroniza su perfil (Instructor/Aprendiz)
   */
  static async changeUserRole(idUsuario, id_rol) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findByPk(idUsuario, { transaction });
      if (!user) throw { status: 404, message: 'Usuario no encontrado' };

      const role = await Role.findByPk(id_rol, { transaction });
      if (!role) throw { status: 404, message: 'Rol no encontrado' };

      await user.update({ id_rol }, { transaction });
      await this._syncUserProfile(user.id_usuario, this._roleName(role.nombre), transaction);

      await transaction.commit();

      return User.findByPk(idUsuario, {
        attributes: ['id_usuario', 'email', 'estado', 'id_rol'],
        include: [{ model: Role, as: 'rol', attributes: ['id_rol', 'nombre', 'descripcion'] }],
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Método interno para sincronizar los perfiles (Instructor/Aprendiz) 
   * según el rol del usuario, resolviendo la duplicación de código.
   */
  static async _syncUserProfile(id_usuario, roleName, transaction) {
    roleName = this._roleName(roleName);
    const apprenticeProfile = await Apprentice.findOne({ where: { id_usuario }, transaction });
    const instructorProfile = await Instructor.findOne({ where: { id_usuario }, transaction });

    if (roleName === 'aprendiz') {
      if (apprenticeProfile) {
        await apprenticeProfile.update({ estado: 'ACTIVO' }, { transaction });
      } else {
        await Apprentice.create({ id_usuario, estado_formativo: 'EN_FORMACION', estado: 'ACTIVO' }, { transaction });
      }
      if (instructorProfile) await instructorProfile.update({ estado: 'INACTIVO' }, { transaction });
    } else if (roleName === 'instructor') {
      if (instructorProfile) {
        await instructorProfile.update({ estado: 'ACTIVO' }, { transaction });
      } else {
        await Instructor.create({ id_usuario, estado: 'ACTIVO' }, { transaction });
      }
      if (apprenticeProfile) await apprenticeProfile.update({ estado: 'INACTIVO' }, { transaction });
    } else if (roleName === 'coordinador') {
      if (instructorProfile) await instructorProfile.update({ estado: 'INACTIVO' }, { transaction });
      if (apprenticeProfile) await apprenticeProfile.update({ estado: 'INACTIVO' }, { transaction });
    }
  }
}

module.exports = UserService;
