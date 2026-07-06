const { Op } = require('sequelize');
const {
  sequelize,
  Alert,
  AlertObservation,
  Notification,
  Observation,
  ValidAbsencesView,
  ApprenticeGroup,
  InstructorGroup,
  Group,
  FormativeProgram,
  Instructor,
  CoordinatorArea,
  Apprentice,
  User,
  Person,
} = require('../models');
const { getAccessibleGroupIdsForRequester } = require('../helpers/coordinatorAuth');
const ObservationService = require('./ObservationService');
const NotificationService = require('./NotificationService');

const ALERT_STATES_OPEN = ['ABIERTA'];
const ALERT_SEVERITIES = ['LEVE', 'MODERADA', 'GRAVE', 'CRITICA'];

class AlertService {
  static _normalizeDate(dateValue) {
    const d = new Date(dateValue);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  static _diffDays(a, b) {
    const ms = this._normalizeDate(a).getTime() - this._normalizeDate(b).getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
  }

  static _role(requester) {
    return String(requester?.rol || '').toLowerCase().trim();
  }

  static _dateBoundary(dateValue, endOfDay = false) {
    if (!dateValue) return null;

    const value = String(dateValue);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`;
    }

    return value;
  }

  static _alertIncludes({ includeObservationLinks = true, search = null } = {}) {
    const apprenticeInclude = {
      model: Apprentice,
      as: 'aprendiz',
      required: Boolean(search),
      attributes: ['id_aprendiz', 'id_usuario', 'estado', 'estado_formativo'],
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id_usuario', 'email', 'estado'],
          required: Boolean(search),
          include: [
            {
              model: Person,
              as: 'persona',
              attributes: ['tipo_documento', 'numero_documento', 'nombres', 'apellidos'],
              required: Boolean(search),
              where: search
                ? {
                    [Op.or]: [
                      { numero_documento: { [Op.like]: `%${search}%` } },
                      { nombres: { [Op.like]: `%${search}%` } },
                      { apellidos: { [Op.like]: `%${search}%` } },
                    ],
                  }
                : undefined,
            },
          ],
        },
      ],
    };

    const includes = [
      apprenticeInclude,
      { model: Group, as: 'grupo', attributes: ['id_grupo', 'numero_ficha', 'estado', 'id_instructor_lider'] },
      {
        model: User,
        as: 'usuario_creador',
        required: false,
        attributes: ['id_usuario', 'email'],
        include: [
          {
            model: Person,
            as: 'persona',
            attributes: ['nombres', 'apellidos', 'numero_documento'],
          },
        ],
      },
      {
        model: User,
        as: 'usuario_cierre',
        required: false,
        attributes: ['id_usuario', 'email'],
        include: [
          {
            model: Person,
            as: 'persona',
            attributes: ['nombres', 'apellidos', 'numero_documento'],
          },
        ],
      },
      {
        model: User,
        as: 'usuario_reapertura',
        required: false,
        attributes: ['id_usuario', 'email'],
        include: [
          {
            model: Person,
            as: 'persona',
            attributes: ['nombres', 'apellidos', 'numero_documento'],
          },
        ],
      },
    ];

    if (includeObservationLinks) {
      includes.push({
        model: AlertObservation,
        as: 'alerta_observaciones',
        required: false,
        attributes: ['id_alerta_observacion', 'id_alerta', 'id_observacion', 'asociada_por', 'fecha_asociacion'],
        include: [
          {
            model: Observation,
            as: 'observacion',
            attributes: [
              'id_observacion',
              'id_aprendiz',
              'id_grupo',
              'id_instructor',
              'tipo_observacion',
              'severidad',
              'estado',
              'fecha_observacion',
              'fecha_cierre',
              'descripcion',
            ],
          },
        ],
      });
    }

    return includes;
  }

  static async _getGroupWithProgram(id_grupo, transaction) {
    const group = await Group.findByPk(id_grupo, {
      include: [{ model: FormativeProgram, as: 'programa_formacion', attributes: ['id_programa', 'id_area'] }],
      transaction,
    });

    if (!group) throw { status: 404, message: 'Grupo formativo no encontrado' };
    if (group.estado === 'FINALIZADO') throw { status: 409, message: 'El grupo formativo se encuentra finalizado' };
    return group;
  }

  static async _assertApprenticeActiveInGroup(id_aprendiz, id_grupo, transaction) {
    const apprentice = await Apprentice.findByPk(id_aprendiz, { transaction });
    if (!apprentice) throw { status: 404, message: 'Aprendiz no encontrado' };
    if (apprentice.estado !== 'ACTIVO') throw { status: 409, message: 'El aprendiz no se encuentra activo' };

    const link = await ApprenticeGroup.findOne({
      where: { id_aprendiz, id_grupo, estado: 'ACTIVO' },
      transaction,
    });

    if (!link) {
      throw { status: 409, message: 'El aprendiz no tiene una matricula activa en el grupo indicado' };
    }

    return apprentice;
  }

  static async _assertRequesterCanAccessGroup(requester, id_grupo) {
    const accessibleGroupIds = await this.getAccessibleGroupIdsForUser(requester);
    if (!accessibleGroupIds.includes(Number(id_grupo))) {
      throw { status: 403, message: 'No tienes permisos sobre este grupo formativo' };
    }
    return accessibleGroupIds;
  }

  static async _getInstructorGroupScope(requester) {
    if (this._role(requester) !== 'instructor' || !requester.id_instructor) {
      return { leaderGroupIds: [], assignedGroupIds: [] };
    }

    const [leaderGroups, assignedGroups] = await Promise.all([
      Group.findAll({
        where: { id_instructor_lider: requester.id_instructor },
        attributes: ['id_grupo'],
      }),
      InstructorGroup.findAll({
        where: { id_instructor: requester.id_instructor, estado: 'ACTIVO' },
        attributes: ['id_grupo'],
      }),
    ]);

    return {
      leaderGroupIds: leaderGroups.map((group) => Number(group.id_grupo)),
      assignedGroupIds: assignedGroups.map((link) => Number(link.id_grupo)),
    };
  }

  static async _buildAlertAccessWhere(requester, filters = {}) {
    const accessibleGroupIds = await this.getAccessibleGroupIdsForUser(requester);
    if (!accessibleGroupIds.length) {
      return { accessibleGroupIds, where: null };
    }

    if (filters.id_grupo && !accessibleGroupIds.includes(Number(filters.id_grupo))) {
      throw { status: 403, message: 'No tienes permisos para consultar alertas de este grupo' };
    }

    const requestedGroupIds = filters.id_grupo ? [Number(filters.id_grupo)] : accessibleGroupIds;
    if (this._role(requester) !== 'instructor') {
      return { accessibleGroupIds, where: { id_grupo: { [Op.in]: requestedGroupIds } } };
    }

    const { leaderGroupIds, assignedGroupIds } = await this._getInstructorGroupScope(requester);
    const leaderVisible = requestedGroupIds.filter((id) => leaderGroupIds.includes(Number(id)));
    const assignedOnlyVisible = requestedGroupIds.filter(
      (id) => assignedGroupIds.includes(Number(id)) && !leaderGroupIds.includes(Number(id))
    );

    const or = [];
    if (leaderVisible.length) or.push({ id_grupo: { [Op.in]: leaderVisible } });
    if (assignedOnlyVisible.length) {
      or.push({
        id_grupo: { [Op.in]: assignedOnlyVisible },
        creada_por: requester.id_usuario,
      });
    }

    if (!or.length) return { accessibleGroupIds, where: { id_alerta: null } };
    return { accessibleGroupIds, where: or.length === 1 ? or[0] : { [Op.or]: or } };
  }

  static async _assertInstructorCanCreateForGroup(requester, id_grupo) {
    if (this._role(requester) !== 'instructor' || !requester.id_instructor) {
      throw { status: 403, message: 'Solo un instructor activo puede crear alertas desde observaciones' };
    }

    await this._assertRequesterCanAccessGroup(requester, id_grupo);
    return requester.id_instructor;
  }

  static async _createNotificationIfNotExists({ id_usuario, id_alerta, titulo, mensaje, tipo = 'ALERTA', transaction }) {
    return NotificationService.createForUser({ id_usuario, id_alerta, titulo, mensaje, tipo, transaction });
  }

  static async _notifyCoordinatorsForGroup({ alert, group, transaction }) {
    const areaId = group.programa_formacion?.id_area;
    if (!areaId) return;

    const coordinators = await CoordinatorArea.findAll({
      where: { id_area: areaId, estado: 'ACTIVO' },
      attributes: ['id_usuario'],
      transaction,
    });

    for (const coordinator of coordinators) {
      await this._createNotificationIfNotExists({
        id_usuario: coordinator.id_usuario,
        id_alerta: alert.id_alerta,
        titulo: 'Nueva alerta de aprendiz',
        mensaje: `Se registro una alerta ${alert.severidad} en un grupo de una de tus areas asignadas.`,
        transaction,
      });
    }
  }

  static async _notifyLeaderAndCreatorForStatusChange({ alert, group, titulo, mensaje }) {
    const notified = new Set();

    if (group?.id_instructor_lider) {
      const leader = await Instructor.findByPk(group.id_instructor_lider, { attributes: ['id_usuario'] });
      if (leader?.id_usuario) {
        await this._createNotificationIfNotExists({
          id_usuario: leader.id_usuario,
          id_alerta: alert.id_alerta,
          titulo,
          mensaje,
        });
        notified.add(String(leader.id_usuario));
      }
    }

    if (alert.creada_por && !notified.has(String(alert.creada_por))) {
      await this._createNotificationIfNotExists({
        id_usuario: alert.creada_por,
        id_alerta: alert.id_alerta,
        titulo,
        mensaje,
      });
    }
  }

  static async _notifyActorsForAlert({
    alert,
    group,
    idInstructorGenerador = null,
    notifyCoordinators = false,
    notifyCoordinatorsWhenSevere = true,
    transaction,
  }) {
    if (!group) return;
    const notified = new Set();

    if (group.id_instructor_lider) {
      const leader = await Instructor.findByPk(group.id_instructor_lider, {
        attributes: ['id_usuario'],
        transaction,
      });
      if (leader?.id_usuario && !notified.has(String(leader.id_usuario))) {
        await this._createNotificationIfNotExists({
          id_usuario: leader.id_usuario,
          id_alerta: alert.id_alerta,
          titulo: 'Nueva alerta de aprendiz',
          mensaje: `Se registro una alerta ${alert.tipo_alerta} para un aprendiz de la ficha ${group.numero_ficha}.`,
          transaction,
        });
        notified.add(String(leader.id_usuario));
      }
    }

    if (idInstructorGenerador) {
      const generator = await Instructor.findByPk(idInstructorGenerador, {
        attributes: ['id_usuario'],
        transaction,
      });
      if (generator?.id_usuario && !notified.has(String(generator.id_usuario))) {
        await this._createNotificationIfNotExists({
          id_usuario: generator.id_usuario,
          id_alerta: alert.id_alerta,
          titulo: 'Alerta registrada',
          mensaje: `La alerta ${alert.tipo_alerta} fue registrada correctamente para el aprendiz.`,
          transaction,
        });
        notified.add(String(generator.id_usuario));
      }
    }

    const shouldNotifyCoordinators = notifyCoordinators
      || (notifyCoordinatorsWhenSevere && ['GRAVE', 'CRITICA'].includes(alert.severidad));
    if (shouldNotifyCoordinators) {
      await this._notifyCoordinatorsForGroup({ alert, group, transaction });
    }
  }

  static async closeOpenAlertByType(id_aprendiz, tipo_alerta, id_grupo = null, transaction = null) {
    const where = {
      id_aprendiz,
      tipo_alerta,
      estado: { [Op.in]: ALERT_STATES_OPEN },
    };
    if (id_grupo) where.id_grupo = id_grupo;

    const alert = await Alert.findOne({
      where,
      order: [['id_alerta', 'DESC']],
      transaction,
    });
    if (!alert) return null;
    await alert.update({ estado: 'CERRADA' }, { transaction });
    return alert;
  }

  static async getAccessibleGroupIdsForUser(requester) {
    return getAccessibleGroupIdsForRequester(requester);
  }

  static async createOrUpdateAlert({
    id_aprendiz,
    id_grupo,
    tipo_alerta,
    regla_disparo,
    origen,
    severidad,
    descripcion,
    id_observacion = null,
    idInstructorGenerador = null,
    fechaInicio = null,
    fechaFin = null,
    creada_por = null,
    notifyCoordinators = false,
    notifyCoordinatorsWhenSevere = true,
    transaction = null,
  }) {
    const group = await this._getGroupWithProgram(id_grupo, transaction);
    await this._assertApprenticeActiveInGroup(id_aprendiz, id_grupo, transaction);

    let alert = await Alert.findOne({
      where: { id_aprendiz, id_grupo, tipo_alerta, estado: { [Op.in]: ALERT_STATES_OPEN } },
      order: [['id_alerta', 'DESC']],
      transaction,
    });

    const payload = {
      id_aprendiz,
      id_grupo,
      tipo_alerta,
      regla_disparo,
      origen,
      severidad,
      descripcion,
      fecha_inicio_evaluada: fechaInicio,
      fecha_fin_evaluada: fechaFin,
      fecha_ultima_evaluacion: new Date(),
      creada_por,
    };
    let created = false;

    if (alert) {
      await alert.update(payload, { transaction });
    } else {
      alert = await Alert.create({ ...payload, estado: 'ABIERTA' }, { transaction });
      created = true;
    }

    if (id_observacion) {
      const existingLink = await AlertObservation.findOne({
        where: { id_observacion },
        transaction,
      });
      if (existingLink && Number(existingLink.id_alerta) !== Number(alert.id_alerta)) {
        throw { status: 409, message: 'La observacion ya esta asociada a otra alerta' };
      }
      if (!existingLink) {
        await AlertObservation.create({
          id_alerta: alert.id_alerta,
          id_observacion,
          asociada_por: creada_por || 1,
        }, { transaction });
      }
    }

    if (created || ['GRAVE', 'CRITICA'].includes(alert.severidad) || notifyCoordinators) {
      await this._notifyActorsForAlert({
        alert,
        group,
        idInstructorGenerador,
        notifyCoordinators,
        notifyCoordinatorsWhenSevere,
        transaction,
      });
    }

    return alert;
  }

  static async createFromObservations(data, requester) {
    const {
      id_aprendiz,
      id_grupo,
      severidad,
      descripcion,
      observationIds,
    } = data;

    const idInstructorGenerador = await this._assertInstructorCanCreateForGroup(requester, id_grupo);
    const transaction = await sequelize.transaction();

    try {
      await this._getGroupWithProgram(id_grupo, transaction);
      await this._assertApprenticeActiveInGroup(id_aprendiz, id_grupo, transaction);

      const alert = await this.createOrUpdateAlert({
        id_aprendiz,
        id_grupo,
        tipo_alerta: data.tipo_alerta || 'CONVIVENCIAL',
        regla_disparo: 'MANUAL',
        origen: 'MANUAL',
        severidad,
        descripcion,
        idInstructorGenerador,
        creada_por: requester.id_usuario,
        notifyCoordinators: true,
        notifyCoordinatorsWhenSevere: false,
        transaction,
      });

      const closure = await ObservationService.closeObservationsForAlert({
        observationIds,
        id_alerta: alert.id_alerta,
        associatedBy: requester.id_usuario,
        transaction,
      });

      if (Number(closure.id_aprendiz) !== Number(id_aprendiz) || Number(closure.id_grupo) !== Number(id_grupo)) {
        throw { status: 400, message: 'Las observaciones no corresponden al aprendiz y grupo de la alerta' };
      }

      await transaction.commit();
      return this.getAlertById(alert.id_alerta, requester);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async createManualAlert(data, requester) {
    const { id_aprendiz, id_grupo, severidad, descripcion, tipo_alerta = 'CONVIVENCIAL' } = data;
    if (!id_grupo) throw { status: 400, message: 'id_grupo es obligatorio para crear alertas' };
    const requesterRole = this._role(requester);

    if (!['super_admin', 'coordinador', 'instructor'].includes(requesterRole)) {
      throw { status: 403, message: 'No tienes permisos para crear alertas' };
    }

    await this._assertRequesterCanAccessGroup(requester, id_grupo);

    let idInstructorGenerador = null;
    if (requesterRole === 'instructor') {
      idInstructorGenerador = requester.id_instructor;
    }

    const alert = await this.createOrUpdateAlert({
      id_aprendiz,
      id_grupo,
      tipo_alerta,
      regla_disparo: 'MANUAL',
      origen: 'MANUAL',
      severidad,
      descripcion,
      idInstructorGenerador,
      creada_por: requester.id_usuario,
      notifyCoordinators: true,
      notifyCoordinatorsWhenSevere: false,
    });

    return this.getAlertById(alert.id_alerta, requester);
  }

  static async evaluateInattendanceAlert(id_aprendiz) {
    const rows = await ValidAbsencesView.findAll({ where: { id_aprendiz }, order: [['fecha_clase', 'ASC']] });
    if (!rows.length) {
      await this.closeOpenAlertByType(id_aprendiz, 'ASISTENCIAL');
      return null;
    }

    const byGroupTrimester = rows.reduce((acc, row) => {
      const key = `${row.id_grupo}:${row.id_grupo_trimestre || 'sin_trimestre'}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});

    const results = [];
    for (const groupRows of Object.values(byGroupTrimester)) {
      const dates = groupRows.map((r) => this._normalizeDate(r.fecha_clase));
      const uniqueDates = [...new Set(dates.map((d) => d.toISOString().slice(0, 10)))];

      let maxConsecutive = 1;
      let currentConsecutive = 1;
      for (let i = 1; i < dates.length; i++) {
        const diff = this._diffDays(dates[i], dates[i - 1]);
        if (diff === 1) {
          currentConsecutive += 1;
          if (currentConsecutive > maxConsecutive) maxConsecutive = currentConsecutive;
        } else if (diff > 1) {
          currentConsecutive = 1;
        }
      }

      const latest = groupRows[groupRows.length - 1];
      if (maxConsecutive >= 3) {
        results.push(await this.createOrUpdateAlert({
          id_aprendiz,
          id_grupo: latest.id_grupo,
          tipo_alerta: 'ASISTENCIAL',
          regla_disparo: '3_CONSECUTIVAS',
          origen: 'AUTOMATICA',
          severidad: 'GRAVE',
          descripcion: 'Se detectaron 3 o mas inasistencias consecutivas sin justificacion aprobada.',
          fechaInicio: groupRows[0].fecha_clase,
          fechaFin: latest.fecha_clase,
        }));
        continue;
      }

      if (uniqueDates.length >= 5) {
        results.push(await this.createOrUpdateAlert({
          id_aprendiz,
          id_grupo: latest.id_grupo,
          tipo_alerta: 'ASISTENCIAL',
          regla_disparo: '5_TRIMESTRE',
          origen: 'AUTOMATICA',
          severidad: 'CRITICA',
          descripcion: 'Se detectaron 5 o mas inasistencias en el mismo trimestre sin justificacion aprobada.',
          fechaInicio: groupRows[0].fecha_clase,
          fechaFin: latest.fecha_clase,
        }));
        continue;
      }

      await this.closeOpenAlertByType(id_aprendiz, 'ASISTENCIAL', latest.id_grupo);
    }

    return results.length === 1 ? results[0] : results;
  }

  static async evaluateObservationAlert(id_aprendiz) {
    const today = new Date();
    const last30 = new Date();
    last30.setDate(today.getDate() - 30);

    const openObservations = await Observation.findAll({
      where: { id_aprendiz, estado: 'ABIERTA', fecha_observacion: { [Op.gte]: last30 } },
      order: [['fecha_observacion', 'DESC']],
    });

    if (!openObservations.length) {
      await this.closeOpenAlertByType(id_aprendiz, 'OBSERVACIONES_RECURRENTES');
      return null;
    }

    const byGroup = openObservations.reduce((acc, observation) => {
      const key = String(observation.id_grupo);
      if (!acc[key]) acc[key] = [];
      acc[key].push(observation);
      return acc;
    }, {});

    const results = [];
    for (const groupObservations of Object.values(byGroup)) {
      const graveObservation = groupObservations.find((o) => o.severidad === 'GRAVE');
      const selectedObservations = graveObservation ? [graveObservation] : groupObservations.slice(0, 3);

      if (!graveObservation && groupObservations.length < 3) {
        await this.closeOpenAlertByType(id_aprendiz, 'OBSERVACIONES_RECURRENTES', groupObservations[0].id_grupo);
        continue;
      }

      const transaction = await sequelize.transaction();
      try {
        const referenceObservation = selectedObservations[0];
        const generator = await Instructor.findByPk(referenceObservation.id_instructor, {
          attributes: ['id_instructor', 'id_usuario'],
          transaction,
        });
        if (!generator?.id_usuario) {
          throw { status: 409, message: 'No se encontro el usuario del instructor asociado a la observacion' };
        }

        const alert = await this.createOrUpdateAlert({
          id_aprendiz,
          id_grupo: referenceObservation.id_grupo,
          tipo_alerta: 'OBSERVACIONES_RECURRENTES',
          regla_disparo: 'OBSERVACIONES_RECURRENTES',
          origen: 'AUTOMATICA',
          severidad: graveObservation ? 'GRAVE' : 'MODERADA',
          descripcion: graveObservation
            ? 'Se detecto al menos una observacion grave abierta en los ultimos 30 dias.'
            : 'Se detectaron 3 o mas observaciones abiertas en los ultimos 30 dias.',
          idInstructorGenerador: referenceObservation.id_instructor,
          fechaInicio: last30,
          fechaFin: today,
          transaction,
        });

        await ObservationService.closeObservationsForAlert({
          observationIds: selectedObservations.map((item) => item.id_observacion),
          id_alerta: alert.id_alerta,
          associatedBy: generator.id_usuario,
          transaction,
        });

        await transaction.commit();
        results.push(alert);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

    return results.length === 1 ? results[0] : results;
  }

  static _applyAlertFilters(where, filters = {}) {
    const { estado, severidad, tipo_alerta, id_aprendiz, id_grupo, fecha_desde, fecha_hasta } = filters;

    if (estado) where.estado = estado;
    if (severidad) where.severidad = severidad;
    if (tipo_alerta) where.tipo_alerta = tipo_alerta;
    if (id_aprendiz) where.id_aprendiz = Number(id_aprendiz);
    if (id_grupo) where.id_grupo = Number(id_grupo);

    if (fecha_desde || fecha_hasta) {
      where.fecha_alerta = {};
      if (fecha_desde) where.fecha_alerta[Op.gte] = this._dateBoundary(fecha_desde);
      if (fecha_hasta) where.fecha_alerta[Op.lte] = this._dateBoundary(fecha_hasta, true);
    }

    return where;
  }

  static _getAlertPagination(filters = {}) {
    const requestedLimit = Number(filters.limit) > 0 ? Number(filters.limit) : 5;
    const limit = Math.min(requestedLimit, 50);
    const page = Number(filters.page) > 0 ? Number(filters.page) : 1;
    const offset = Number(filters.offset) >= 0 ? Number(filters.offset) : (page - 1) * limit;

    return { limit, offset, page };
  }

  static async getAlerts(filters, requester) {
    if (!['super_admin', 'coordinador', 'instructor'].includes(this._role(requester))) {
      throw { status: 403, message: 'No tienes permisos para consultar alertas' };
    }

    const { limit, offset, page } = this._getAlertPagination(filters);
    const access = await this._buildAlertAccessWhere(requester, filters);
    const accessibleGroupIds = access.accessibleGroupIds;
    if (!accessibleGroupIds.length) {
      return {
        total: 0,
        pagina: page,
        limit,
        offset,
        total_paginas: 0,
        alertas: [],
      };
    }

    const where = this._applyAlertFilters(access.where, filters);
    const search = typeof filters.q === 'string' && filters.q.trim() ? filters.q.trim() : null;

    const { count, rows } = await Alert.findAndCountAll({
      where,
      include: this._alertIncludes({ includeObservationLinks: true, search }),
      order: [['fecha_alerta', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return {
      total: count,
      pagina: page,
      limit,
      offset,
      total_paginas: Math.ceil(count / limit),
      alertas: rows,
    };
  }

  static async getAlertById(id, requester) {
    if (!['super_admin', 'coordinador', 'instructor'].includes(this._role(requester))) {
      throw { status: 403, message: 'No tienes permisos para consultar alertas' };
    }

    const alert = await Alert.findByPk(id, {
      include: this._alertIncludes({ includeObservationLinks: true }),
    });

    if (!alert) throw { status: 404, message: 'Alerta no encontrada' };

    const access = await this._buildAlertAccessWhere(requester, { id_grupo: alert.id_grupo });
    if (!access.where) {
      throw { status: 403, message: 'No tienes permisos para consultar esta alerta' };
    }
    const canSee = await Alert.count({
      where: {
        [Op.and]: [
          { id_alerta: alert.id_alerta },
          access.where,
        ],
      },
    });

    if (!canSee) {
      throw { status: 403, message: 'No tienes permisos para consultar esta alerta' };
    }

    return alert;
  }

  static async getAlertObservations(id, requester) {
    const alert = await this.getAlertById(id, requester);
    return alert.alerta_observaciones || [];
  }

  static async updateAlertStatus(id, estado, requester, justificacion_cierre, justificacion_reapertura) {
    if (!['super_admin', 'coordinador'].includes(this._role(requester))) {
      throw { status: 403, message: 'Solo el coordinador o superadministrador puede cerrar o reabrir alertas' };
    }

    const allowedStates = ['ABIERTA', 'CERRADA'];
    if (!estado || !allowedStates.includes(estado)) {
      throw { status: 400, message: 'El estado es obligatorio y debe ser ABIERTA o CERRADA' };
    }

    const alert = await Alert.findByPk(id, {
      include: [{ model: Group, as: 'grupo', attributes: ['id_grupo', 'numero_ficha', 'estado', 'id_instructor_lider'] }],
    });
    if (!alert) throw { status: 404, message: 'Alerta no encontrada' };

    if (estado === 'CERRADA' && alert.estado === 'CERRADA') {
      throw { status: 409, message: 'La alerta ya se encuentra cerrada' };
    }
    if (estado === 'ABIERTA' && alert.estado === 'ABIERTA') {
      throw { status: 409, message: 'La alerta ya se encuentra abierta' };
    }

    await this._assertRequesterCanAccessGroup(requester, alert.id_grupo);

    const updateData = { estado };

    if (estado === 'CERRADA') {
      const justificacionCierre = typeof justificacion_cierre === 'string' ? justificacion_cierre.trim() : '';

      if (justificacionCierre.length < 20 || justificacionCierre.length > 2000) {
        throw {
          status: 400,
          message: 'justificacion_cierre debe tener entre 20 y 2000 caracteres',
        };
      }

      updateData.justificacion_cierre = justificacionCierre;
      updateData.fecha_cierre = new Date();
      updateData.cerrada_por = requester.id_usuario;
    }

    if (estado === 'ABIERTA') {
      await this._getGroupWithProgram(alert.id_grupo);
      await this._assertApprenticeActiveInGroup(alert.id_aprendiz, alert.id_grupo);

      const justificacionReapertura = typeof justificacion_reapertura === 'string'
        ? justificacion_reapertura.trim()
        : '';

      if (justificacionReapertura.length < 20 || justificacionReapertura.length > 2000) {
        throw {
          status: 400,
          message: 'justificacion_reapertura debe tener entre 20 y 2000 caracteres',
        };
      }

      updateData.justificacion_reapertura = justificacionReapertura;
      updateData.fecha_reapertura = new Date();
      updateData.reabierta_por = requester.id_usuario;
    }

    await alert.update(updateData);
    const actionTitle = estado === 'CERRADA' ? 'Alerta cerrada' : 'Alerta reabierta';
    const actionMessage = estado === 'CERRADA'
      ? `La alerta ${alert.tipo_alerta} fue cerrada por coordinacion.`
      : `La alerta ${alert.tipo_alerta} fue reabierta por coordinacion.`;
    await this._notifyLeaderAndCreatorForStatusChange({
      alert,
      group: alert.grupo,
      titulo: actionTitle,
      mensaje: actionMessage,
    });

    return this.getAlertById(id, requester);
  }

  static async deleteAlert(id, requester) {
    if (this._role(requester) !== 'super_admin') {
      throw { status: 403, message: 'Solo el superadministrador puede eliminar alertas' };
    }

    const transaction = await sequelize.transaction();
    try {
      const alert = await Alert.findByPk(id, { transaction });
      if (!alert) throw { status: 404, message: 'Alerta no encontrada' };

      await Notification.destroy({ where: { id_alerta: id }, transaction });
      await AlertObservation.destroy({ where: { id_alerta: id }, transaction });
      await alert.destroy({ transaction });

      await transaction.commit();
      return { id_alerta: Number(id), eliminada: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

AlertService.ALERT_SEVERITIES = ALERT_SEVERITIES;

module.exports = AlertService;
