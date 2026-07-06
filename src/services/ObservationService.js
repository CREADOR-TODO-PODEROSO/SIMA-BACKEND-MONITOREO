const { Op } = require('sequelize');
const {
  sequelize,
  AlertObservation,
  Apprentice,
  ApprenticeGroup,
  Group,
  Instructor,
  InstructorGroup,
  Notification,
  Observation,
  Person,
  User,
} = require('../models');
const { getPagination } = require('../helpers/pagination');
const { assertRequesterCanAccessGroup } = require('../helpers/coordinatorAuth');

const OBSERVATION_TYPES = ['ACADEMICA', 'CONVIVENCIAL'];
const OBSERVATION_SEVERITIES = ['LEVE', 'MODERADA', 'GRAVE'];
const OBSERVATION_STATES = ['ABIERTA', 'CERRADA'];

class ObservationService {
  static _role(requester) {
    return String(requester?.rol || '').toLowerCase().trim();
  }

  static _isSuperAdmin(requester) {
    return this._role(requester) === 'super_admin';
  }

  static _isCoordinator(requester) {
    return this._role(requester) === 'coordinador';
  }

  static _ensureInstructorRequester(requester) {
    if (!requester || this._role(requester) !== 'instructor' || !requester.id_instructor) {
      throw { status: 403, message: 'Solo un instructor activo puede gestionar observaciones' };
    }
  }

  static _ensureInstructorOrSuperAdmin(requester) {
    if (this._isSuperAdmin(requester)) return;
    this._ensureInstructorRequester(requester);
  }

  static _ensureObservationReadRequester(requester) {
    if (this._isSuperAdmin(requester) || this._isCoordinator(requester)) return;
    this._ensureInstructorRequester(requester);
  }

  static _ensureApprenticeRequester(requester) {
    if (!requester || requester.rol !== 'aprendiz' || !requester.id_aprendiz) {
      throw { status: 403, message: 'Solo un aprendiz activo puede consultar sus observaciones' };
    }
  }

  static async _getGroupAccessForInstructor(id_grupo, id_instructor, transaction) {
    const group = await Group.findByPk(id_grupo, {
      attributes: ['id_grupo', 'numero_ficha', 'estado', 'id_instructor_lider'],
      transaction,
    });

    if (!group) throw { status: 404, message: 'Grupo formativo no encontrado' };
    if (group.estado === 'FINALIZADO') throw { status: 409, message: 'El grupo formativo se encuentra finalizado' };

    const isLeader = Number(group.id_instructor_lider) === Number(id_instructor);
    const assigned = await InstructorGroup.findOne({
      where: { id_grupo, id_instructor, estado: 'ACTIVO' },
      transaction,
    });

    if (!isLeader && !assigned) {
      throw { status: 403, message: 'No tienes permisos sobre este grupo formativo' };
    }

    return { group, isLeader, isAssigned: !!assigned };
  }

  static async _assertApprenticeActiveInGroup(id_aprendiz, id_grupo, transaction) {
    const apprentice = await Apprentice.findByPk(id_aprendiz, {
      attributes: ['id_aprendiz', 'id_usuario', 'estado', 'estado_formativo'],
      transaction,
    });

    if (!apprentice) throw { status: 404, message: 'Aprendiz no encontrado' };
    if (apprentice.estado !== 'ACTIVO') throw { status: 409, message: 'El aprendiz no se encuentra activo' };

    const activeLink = await ApprenticeGroup.findOne({
      where: { id_aprendiz, id_grupo, estado: 'ACTIVO' },
      transaction,
    });

    if (!activeLink) {
      throw { status: 409, message: 'El aprendiz no tiene una matricula activa en el grupo indicado' };
    }

    return apprentice;
  }

  static _applyFilters(where, filters = {}) {
    const {
      id_aprendiz,
      tipo_observacion,
      severidad,
      estado,
      fecha_desde,
      fecha_hasta,
    } = filters;

    if (id_aprendiz) where.id_aprendiz = Number(id_aprendiz);
    if (tipo_observacion) where.tipo_observacion = tipo_observacion;
    if (severidad) where.severidad = severidad;
    if (estado) where.estado = estado;

    if (fecha_desde || fecha_hasta) {
      where.fecha_observacion = {};
      if (fecha_desde) where.fecha_observacion[Op.gte] = fecha_desde;
      if (fecha_hasta) where.fecha_observacion[Op.lte] = fecha_hasta;
    }

    return where;
  }

  static _observationIncludes() {
    return [
      {
        model: Apprentice,
        as: 'aprendiz',
        attributes: ['id_aprendiz', 'id_usuario', 'estado', 'estado_formativo'],
        include: [
          {
            model: User,
            as: 'usuario',
            attributes: ['id_usuario', 'email', 'estado'],
            include: [{ model: Person, as: 'persona', attributes: ['tipo_documento', 'numero_documento', 'nombres', 'apellidos'] }],
          },
        ],
      },
      {
        model: Instructor,
        as: 'instructor',
        attributes: ['id_instructor', 'id_usuario', 'estado'],
        include: [
          {
            model: User,
            as: 'usuario',
            attributes: ['id_usuario', 'email'],
            include: [{ model: Person, as: 'persona', attributes: ['nombres', 'apellidos'] }],
          },
        ],
      },
      { model: Group, as: 'grupo', attributes: ['id_grupo', 'numero_ficha', 'estado', 'id_instructor_lider'] },
    ];
  }

  static async _notifyGroupLeaderIfNeeded({ notificar_lider, group, requester }) {
    if (!notificar_lider || !group.id_instructor_lider) return null;

    if (Number(group.id_instructor_lider) === Number(requester.id_instructor)) {
      return null;
    }

    const leader = await Instructor.findByPk(group.id_instructor_lider, {
      attributes: ['id_instructor', 'id_usuario', 'estado'],
    });

    if (!leader || leader.estado !== 'ACTIVO' || !leader.id_usuario) {
      return null;
    }

    return Notification.create({
      id_usuario: leader.id_usuario,
      id_alerta: null,
      titulo: 'Nueva observacion formativa',
      mensaje: `Se registro una observacion en la ficha ${group.numero_ficha}.`,
      tipo: 'OBSERVACION',
      leida: false,
    });
  }

  static async createObservation(data, requester) {
    this._ensureInstructorRequester(requester);

    const {
      id_aprendiz,
      id_grupo,
      tipo_observacion,
      severidad,
      descripcion,
      notificar_lider = false,
    } = data;

    const transaction = await sequelize.transaction();

    try {
      const { group } = await this._getGroupAccessForInstructor(id_grupo, requester.id_instructor, transaction);
      await this._assertApprenticeActiveInGroup(id_aprendiz, id_grupo, transaction);

      const observation = await Observation.create(
        {
          id_aprendiz,
          id_grupo,
          id_instructor: requester.id_instructor,
          tipo_observacion,
          severidad,
          descripcion,
          estado: 'ABIERTA',
        },
        { transaction }
      );

      await transaction.commit();

      let notification = null;
      try {
        notification = await this._notifyGroupLeaderIfNeeded({ notificar_lider, group, requester });
      } catch (notificationError) {
        console.error('Error al notificar al instructor lider:', notificationError.message);
      }

      return {
        observation,
        notificacion_lider: !!notification,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getByGroup(idGrupo, filters, requester) {
    this._ensureObservationReadRequester(requester);

    const { page, limit } = filters;
    const { limit: take, offset, page: currentPage } = getPagination(page, limit);
    let group = null;
    let isLeader = true;

    if (this._isSuperAdmin(requester) || this._isCoordinator(requester)) {
      if (this._isCoordinator(requester)) {
        await assertRequesterCanAccessGroup(
          requester,
          idGrupo,
          'No tienes permisos para consultar observaciones de este grupo'
        );
      }

      group = await Group.findByPk(idGrupo, {
        attributes: ['id_grupo', 'numero_ficha', 'estado', 'id_instructor_lider'],
      });
      if (!group) throw { status: 404, message: 'Grupo formativo no encontrado' };
    } else {
      const access = await this._getGroupAccessForInstructor(idGrupo, requester.id_instructor);
      group = access.group;
      isLeader = access.isLeader;
    }

    const where = this._applyFilters({ id_grupo: idGrupo }, filters);
    if (!isLeader) where.id_instructor = requester.id_instructor;

    const { count, rows } = await Observation.findAndCountAll({
      where,
      include: this._observationIncludes(),
      order: [['fecha_observacion', 'DESC']],
      limit: take,
      offset,
      distinct: true,
    });

    const openWhere = { id_grupo: idGrupo, estado: 'ABIERTA' };
    if (!isLeader) openWhere.id_instructor = requester.id_instructor;
    const observaciones_abiertas = await Observation.count({ where: openWhere });

    return {
      total: count,
      pagina: currentPage,
      observaciones_abiertas,
      grupo: group,
      observaciones: rows,
    };
  }

  static async getByApprentice(idAprendiz, filters, requester) {
    this._ensureObservationReadRequester(requester);

    const { id_grupo, page, limit } = filters;
    if (!id_grupo) {
      throw { status: 400, message: 'id_grupo es obligatorio para consultar el historial del aprendiz' };
    }

    const { limit: take, offset, page: currentPage } = getPagination(page, limit);
    let isLeader = true;
    if (this._isSuperAdmin(requester) || this._isCoordinator(requester)) {
      if (this._isCoordinator(requester)) {
        await assertRequesterCanAccessGroup(
          requester,
          id_grupo,
          'No tienes permisos para consultar observaciones de este grupo'
        );
      }

      const group = await Group.findByPk(id_grupo, { attributes: ['id_grupo'] });
      if (!group) throw { status: 404, message: 'Grupo formativo no encontrado' };
    } else {
      const access = await this._getGroupAccessForInstructor(id_grupo, requester.id_instructor);
      isLeader = access.isLeader;
    }
    await this._assertApprenticeActiveInGroup(idAprendiz, id_grupo);

    const where = this._applyFilters({ id_aprendiz: idAprendiz, id_grupo }, filters);
    if (!isLeader) where.id_instructor = requester.id_instructor;

    const { count, rows } = await Observation.findAndCountAll({
      where,
      include: this._observationIncludes(),
      order: [['fecha_observacion', 'DESC']],
      limit: take,
      offset,
      distinct: true,
    });

    return {
      total: count,
      pagina: currentPage,
      observaciones: rows,
    };
  }

  static async getMyObservations(filters, requester) {
    this._ensureApprenticeRequester(requester);

    const { page, limit } = filters;
    const { limit: take, offset, page: currentPage } = getPagination(page, limit);
    const where = this._applyFilters({ id_aprendiz: requester.id_aprendiz }, {
      ...filters,
      id_aprendiz: requester.id_aprendiz,
    });

    const { count, rows } = await Observation.findAndCountAll({
      where,
      include: this._observationIncludes(),
      order: [['fecha_observacion', 'DESC']],
      limit: take,
      offset,
      distinct: true,
    });

    const apprentice = await Apprentice.findByPk(requester.id_aprendiz, {
      attributes: ['id_aprendiz', 'id_usuario', 'estado', 'estado_formativo'],
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id_usuario', 'email', 'estado'],
          include: [
            {
              model: Person,
              as: 'persona',
              attributes: ['tipo_documento', 'numero_documento', 'nombres', 'apellidos'],
            },
          ],
        },
      ],
    });

    return {
      total: count,
      pagina: currentPage,
      aprendiz: apprentice,
      observaciones: rows,
    };
  }

  static async getById(id, requester) {
    this._ensureObservationReadRequester(requester);

    const observation = await Observation.findByPk(id, {
      include: this._observationIncludes(),
    });

    if (!observation) throw { status: 404, message: 'Observacion no encontrada' };

    if (this._isCoordinator(requester)) {
      await assertRequesterCanAccessGroup(
        requester,
        observation.id_grupo,
        'No tienes permisos para consultar esta observacion'
      );
    } else if (!this._isSuperAdmin(requester)) {
      const { isLeader } = await this._getGroupAccessForInstructor(observation.id_grupo, requester.id_instructor);
      if (!isLeader && Number(observation.id_instructor) !== Number(requester.id_instructor)) {
        throw { status: 403, message: 'No tienes permisos para consultar esta observacion' };
      }
    }

    return observation;
  }

  static async updateObservation(id, data, requester) {
    this._ensureInstructorOrSuperAdmin(requester);

    const observation = await Observation.findByPk(id);
    if (!observation) throw { status: 404, message: 'Observacion no encontrada' };

    if (!this._isSuperAdmin(requester)) {
      await this._getGroupAccessForInstructor(observation.id_grupo, requester.id_instructor);

      if (Number(observation.id_instructor) !== Number(requester.id_instructor)) {
        throw { status: 403, message: 'Solo el instructor que creo la observacion puede editarla' };
      }
    }

    if (!this._isSuperAdmin(requester) && observation.estado === 'CERRADA') {
      throw { status: 409, message: 'Las observaciones cerradas no pueden modificarse' };
    }

    const payload = {};
    if (data.tipo_observacion !== undefined) payload.tipo_observacion = data.tipo_observacion;
    if (data.severidad !== undefined) payload.severidad = data.severidad;
    if (data.descripcion !== undefined) payload.descripcion = data.descripcion;

    await observation.update(payload);
    return this.getById(id, requester);
  }

  static async updateObservationStatus(id, estado, requester) {
    if (!this._isSuperAdmin(requester)) {
      throw { status: 403, message: 'Solo el superadministrador puede cambiar el estado de observaciones' };
    }

    if (!OBSERVATION_STATES.includes(estado)) {
      throw { status: 400, message: 'El estado debe ser ABIERTA o CERRADA' };
    }

    const observation = await Observation.findByPk(id);
    if (!observation) throw { status: 404, message: 'Observacion no encontrada' };

    await observation.update({
      estado,
      fecha_cierre: estado === 'CERRADA' ? new Date() : null,
    });

    return this.getById(id, requester);
  }

  static async deleteObservation(id, requester) {
    if (!this._isSuperAdmin(requester)) {
      throw { status: 403, message: 'Solo el superadministrador puede eliminar observaciones' };
    }

    const transaction = await sequelize.transaction();
    try {
      const observation = await Observation.findByPk(id, { transaction });
      if (!observation) throw { status: 404, message: 'Observacion no encontrada' };

      await Notification.destroy({ where: { id_observacion: id }, transaction });
      await AlertObservation.destroy({ where: { id_observacion: id }, transaction });
      await observation.destroy({ transaction });

      await transaction.commit();
      return { id_observacion: Number(id), eliminada: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async closeObservationsForAlert({ observationIds, id_alerta, associatedBy, transaction }) {
    if (!Array.isArray(observationIds) || observationIds.length === 0) {
      throw { status: 400, message: 'Debe asociar al menos una observacion a la alerta' };
    }

    const uniqueIds = [...new Set(observationIds.map((id) => Number(id)))];
    const observations = await Observation.findAll({
      where: { id_observacion: { [Op.in]: uniqueIds } },
      transaction,
    });

    if (observations.length !== uniqueIds.length) {
      throw { status: 404, message: 'Una o mas observaciones no existen' };
    }

    const closedObservation = observations.find((item) => item.estado !== 'ABIERTA');
    if (closedObservation) {
      throw { status: 409, message: `La observacion ${closedObservation.id_observacion} no esta ABIERTA` };
    }

    const apprenticeIds = [...new Set(observations.map((item) => Number(item.id_aprendiz)))];
    const groupIds = [...new Set(observations.map((item) => Number(item.id_grupo)))];
    if (apprenticeIds.length !== 1 || groupIds.length !== 1) {
      throw { status: 400, message: 'Todas las observaciones deben pertenecer al mismo aprendiz y grupo' };
    }

    const existingLinks = await AlertObservation.findAll({
      where: { id_observacion: { [Op.in]: uniqueIds } },
      transaction,
    });
    if (existingLinks.length) {
      throw { status: 409, message: 'Una o mas observaciones ya fueron asociadas a una alerta' };
    }

    await AlertObservation.bulkCreate(
      uniqueIds.map((id_observacion) => ({
        id_alerta,
        id_observacion,
        asociada_por: associatedBy,
      })),
      { transaction }
    );

    await Observation.update(
      { estado: 'CERRADA', fecha_cierre: new Date() },
      { where: { id_observacion: { [Op.in]: uniqueIds } }, transaction }
    );

    return { cerradas: uniqueIds.length, id_aprendiz: apprenticeIds[0], id_grupo: groupIds[0] };
  }
}

ObservationService.OBSERVATION_TYPES = OBSERVATION_TYPES;
ObservationService.OBSERVATION_SEVERITIES = OBSERVATION_SEVERITIES;
ObservationService.OBSERVATION_STATES = OBSERVATION_STATES;

module.exports = ObservationService;
