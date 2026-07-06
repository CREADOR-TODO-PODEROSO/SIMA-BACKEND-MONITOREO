const { Op } = require('sequelize');

const {
  Apprentice,
  ApprenticeGroup,
  Alert,
  Attendance,
  ClassCompetency,
  EducationalSession,
  Environment,
  FormativeProgram,
  Group,
  GroupTrimester,
  Instructor,
  JourneyBlock,
  Notification,
  Observation,
  Person,
  Role,
  User,
} = require('../models');
const { toEp05AttendanceState } = require('../helpers/attendanceStateMapper');

const ATTENDANCE_STATES = ['PRESENTE', 'TARDE', 'INASISTENCIA', 'JUSTIFICADO'];

class ApprenticePortalService {
  static _toDateOnly(value) {
    return new Date(value).toISOString().slice(0, 10);
  }

  static _todayDateOnly() {
    return this._toDateOnly(new Date());
  }

  static _weekRange(reference = new Date()) {
    const date = new Date(`${this._toDateOnly(reference)}T00:00:00-05:00`);
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    const start = this._toDateOnly(date);
    date.setDate(date.getDate() + 6);
    return { start, end: this._toDateOnly(date) };
  }

  static _buildDateRange(filters = {}) {
    if (filters.fecha_desde || filters.fecha_hasta) {
      return {
        start: filters.fecha_desde || this._todayDateOnly(),
        end: filters.fecha_hasta || filters.fecha_desde || this._todayDateOnly(),
      };
    }

    return this._weekRange(filters.fecha_referencia || new Date());
  }

  static _fullName(person) {
    if (!person) return null;
    return [person.nombres, person.apellidos].filter(Boolean).join(' ').trim() || null;
  }

  static _serializeInstructor(instructor) {
    if (!instructor) {
      return {
        registrado: false,
        mensaje: 'No hay instructor lider registrado',
      };
    }

    return {
      registrado: true,
      id_instructor: instructor.id_instructor,
      codigo_instructor: instructor.codigo_instructor,
      nombre_completo: this._fullName(instructor.usuario?.persona),
      rol: 'instructor',
    };
  }

  static _serializeGroup(group) {
    if (!group) return null;
    return {
      id_grupo: group.id_grupo,
      numero_ficha: group.numero_ficha,
      jornada: group.jornada,
      estado: group.estado,
      programa: group.programa_formacion
        ? {
            id_programa: group.programa_formacion.id_programa,
            nombre_programa: group.programa_formacion.nombre_programa,
          }
        : null,
      instructor_lider: this._serializeInstructor(group.instructor_lider),
    };
  }

  static _serializeTrimester(trimester) {
    if (!trimester) {
      return {
        registrado: false,
        mensaje: 'No hay trimestre activo registrado para la ficha seleccionada',
      };
    }

    return {
      registrado: true,
      id_grupo_trimestre: trimester.id_grupo_trimestre,
      numero_trimestre: trimester.numero_trimestre,
      fecha_inicio: trimester.fecha_inicio,
      fecha_fin: trimester.fecha_fin,
      estado: trimester.estado,
    };
  }

  static _serializeSession(session) {
    const instructorPerson = session.instructor?.usuario?.persona;
    return {
      id_sesion_formacion: session.id_sesion_formacion,
      fecha_clase: session.fecha_clase,
      hora_inicio: session.hora_inicio_programada,
      hora_fin: session.hora_fin_programada,
      estado: session.estado,
      competencia: session.competencia
        ? {
            id_clase_competencia: session.competencia.id_clase_competencia,
            nombre_competencia: session.competencia.nombre_competencia,
          }
        : null,
      instructor: session.instructor
        ? {
            id_instructor: session.instructor.id_instructor,
            codigo_instructor: session.instructor.codigo_instructor,
            nombre_completo: this._fullName(instructorPerson),
            rol: 'instructor',
          }
        : null,
      ambiente: session.ambiente
        ? {
            id_ambiente: session.ambiente.id_ambiente,
            nombre_ambiente: session.ambiente.nombre_ambiente,
            ubicacion: session.ambiente.ubicacion,
          }
        : null,
      bloque_jornada: session.bloque_jornada
        ? {
            id_bloque_jornada: session.bloque_jornada.id_bloque_jornada,
            nombre_bloque: session.bloque_jornada.nombre_bloque,
            hora_inicio: session.bloque_jornada.hora_inicio,
            hora_fin: session.bloque_jornada.hora_fin,
          }
        : null,
    };
  }

  static _serializeUserResponsible(user, fallbackRole = null) {
    if (!user) return null;
    return {
      id_usuario: user.id_usuario,
      nombre_completo: this._fullName(user.persona),
      rol: user.rol?.nombre || fallbackRole,
    };
  }

  static _buildDateFilter(field, filters) {
    if (!filters.fecha_desde && !filters.fecha_hasta) return {};
    const range = {};
    if (filters.fecha_desde) range[Op.gte] = filters.fecha_desde;
    if (filters.fecha_hasta) range[Op.lte] = filters.fecha_hasta;
    return { [field]: range };
  }

  static _sessionIncludes() {
    return [
      { model: ClassCompetency, as: 'competencia', attributes: ['id_clase_competencia', 'nombre_competencia'] },
      {
        model: Instructor,
        as: 'instructor',
        attributes: ['id_instructor', 'codigo_instructor'],
        include: [{ model: User, as: 'usuario', attributes: ['id_usuario'], include: [{ model: Person, as: 'persona' }] }],
      },
      { model: Environment, as: 'ambiente', attributes: ['id_ambiente', 'nombre_ambiente', 'ubicacion'] },
      { model: JourneyBlock, as: 'bloque_jornada', attributes: ['id_bloque_jornada', 'nombre_bloque', 'hora_inicio', 'hora_fin'] },
    ];
  }

  static async _findActiveGroups(id_aprendiz) {
    const links = await ApprenticeGroup.findAll({
      where: { id_aprendiz, estado: 'ACTIVO' },
      include: [
        {
          model: Group,
          as: 'grupo',
          include: [
            { model: FormativeProgram, as: 'programa_formacion', attributes: ['id_programa', 'nombre_programa'] },
            {
              model: Instructor,
              as: 'instructor_lider',
              attributes: ['id_instructor', 'codigo_instructor'],
              required: false,
              include: [{ model: User, as: 'usuario', attributes: ['id_usuario'], include: [{ model: Person, as: 'persona' }] }],
            },
          ],
        },
      ],
      order: [[{ model: Group, as: 'grupo' }, 'numero_ficha', 'ASC']],
    });

    return links.map((link) => link.grupo).filter(Boolean);
  }

  static async resolveApprenticeGroupContext(user, idGrupo = null) {
    if (user.rol !== 'aprendiz' || !user.id_aprendiz) {
      throw { status: 403, message: 'Solo un aprendiz activo puede consultar el portal movil' };
    }

    const groups = await this._findActiveGroups(user.id_aprendiz);
    if (!groups.length) {
      throw { status: 404, message: 'El aprendiz no tiene fichas activas asociadas' };
    }

    let selectedGroup = null;
    if (idGrupo) {
      selectedGroup = groups.find((group) => Number(group.id_grupo) === Number(idGrupo));
      if (!selectedGroup) {
        throw { status: 403, message: 'La ficha seleccionada no pertenece al aprendiz autenticado' };
      }
    } else if (groups.length === 1) {
      selectedGroup = groups[0];
    } else {
      throw { status: 400, message: 'Debe seleccionar una ficha activa para consultar el portal' };
    }

    const activeTrimester = await GroupTrimester.findOne({
      where: { id_grupo: selectedGroup.id_grupo, estado: 'ACTIVO' },
      order: [['numero_trimestre', 'ASC']],
    });

    return {
      id_aprendiz: user.id_aprendiz,
      id_usuario: user.id_usuario,
      fichas_activas: groups.map((group) => this._serializeGroup(group)),
      ficha_seleccionada: this._serializeGroup(selectedGroup),
      trimestre_activo: this._serializeTrimester(activeTrimester),
      activeTrimester,
      selectedGroup,
    };
  }

  static async getContext(filters, user) {
    const context = await this.resolveApprenticeGroupContext(user, filters.id_grupo);
    const apprentice = await Apprentice.findByPk(user.id_aprendiz, {
      attributes: ['id_aprendiz', 'estado_formativo', 'estado'],
    });

    return {
      aprendiz: {
        id_aprendiz: user.id_aprendiz,
        id_usuario: user.id_usuario,
        email: user.email,
        estado: apprentice?.estado || null,
        estado_formativo: apprentice?.estado_formativo || null,
      },
      fichas_activas: context.fichas_activas,
      ficha_seleccionada: context.ficha_seleccionada,
      trimestre_activo: context.trimestre_activo,
    };
  }

  static async getSchedule(filters, user) {
    const context = await this.resolveApprenticeGroupContext(user, filters.id_grupo);
    const { start, end } = this._buildDateRange(filters);

    const sessions = await EducationalSession.findAll({
      where: {
        id_grupo: context.selectedGroup.id_grupo,
        fecha_clase: { [Op.between]: [start, end] },
        estado: { [Op.ne]: 'CANCELADA' },
      },
      include: this._sessionIncludes(),
      order: [['fecha_clase', 'ASC'], ['hora_inicio_programada', 'ASC']],
    });

    return {
      ficha: context.ficha_seleccionada,
      rango: { fecha_desde: start, fecha_hasta: end },
      sesiones: sessions.map((session) => this._serializeSession(session)),
      mensaje: sessions.length ? null : 'No hay horario disponible para la ficha seleccionada',
    };
  }

  static async getSessions(filters, user) {
    const context = await this.resolveApprenticeGroupContext(user, filters.id_grupo);
    const today = this._todayDateOnly();

    const [activeSession, upcomingSessions] = await Promise.all([
      EducationalSession.findOne({
        where: {
          id_grupo: context.selectedGroup.id_grupo,
          estado: 'ABIERTA',
        },
        include: this._sessionIncludes(),
        order: [['fecha_clase', 'ASC'], ['hora_inicio_programada', 'ASC']],
      }),
      EducationalSession.findAll({
        where: {
          id_grupo: context.selectedGroup.id_grupo,
          estado: 'PROGRAMADA',
          fecha_clase: { [Op.gte]: today },
        },
        include: this._sessionIncludes(),
        order: [['fecha_clase', 'ASC'], ['hora_inicio_programada', 'ASC']],
        limit: 10,
      }),
    ]);

    return {
      ficha: context.ficha_seleccionada,
      sesion_activa: activeSession ? this._serializeSession(activeSession) : null,
      proximas_sesiones: upcomingSessions.map((session) => this._serializeSession(session)),
      mensaje_sesion_activa: activeSession ? null : 'No tienes una sesion activa en este momento',
      mensaje_proximas_sesiones: upcomingSessions.length ? null : 'No tienes proximas sesiones programadas',
    };
  }

  static async _attendanceSummary(context) {
    const summary = ATTENDANCE_STATES.reduce((acc, state) => {
      acc[state] = { estado: state, cantidad: 0, porcentaje: 0 };
      return acc;
    }, {});

    if (!context.activeTrimester) {
      return {
        total: 0,
        estados: Object.values(summary),
        mensaje: 'No hay trimestre activo para calcular la asistencia',
      };
    }

    const rows = await Attendance.findAll({
      where: { id_aprendiz: context.id_aprendiz },
      include: [
        {
          model: EducationalSession,
          as: 'sesion',
          required: true,
          where: {
            id_grupo: context.selectedGroup.id_grupo,
            id_grupo_trimestre: context.activeTrimester.id_grupo_trimestre,
          },
        },
      ],
    });

    for (const attendance of rows) {
      const state = toEp05AttendanceState(attendance.estado_asistencia);
      if (summary[state]) summary[state].cantidad += 1;
    }

    const total = Object.values(summary).reduce((acc, item) => acc + item.cantidad, 0);
    if (total > 0) {
      for (const item of Object.values(summary)) {
        item.porcentaje = Number(((item.cantidad / total) * 100).toFixed(2));
      }
    }

    return {
      total,
      estados: Object.values(summary),
      mensaje: total ? null : 'Aun no tienes registros de asistencia en el trimestre activo',
    };
  }

  static async getDashboard(filters, user) {
    const context = await this.resolveApprenticeGroupContext(user, filters.id_grupo);
    const { start, end } = this._weekRange(new Date());

    const [asistencia, horario, notifications] = await Promise.all([
      this._attendanceSummary(context),
      this.getSchedule({ id_grupo: context.selectedGroup.id_grupo, fecha_desde: start, fecha_hasta: end }, user),
      Notification.findAll({
        where: { id_usuario: user.id_usuario },
        order: [['fecha_envio', 'DESC']],
        limit: 5,
      }),
    ]);

    return {
      ficha: context.ficha_seleccionada,
      trimestre_activo: context.trimestre_activo,
      asistencia_trimestre: asistencia,
      horario_semanal: {
        rango: horario.rango,
        sesiones: horario.sesiones.slice(0, 7),
        mensaje: horario.mensaje,
      },
      novedades: {
        notificaciones: notifications.map((notification) => ({
          id_notificacion: notification.id_notificacion,
          titulo: notification.titulo,
          mensaje: notification.mensaje,
          tipo: notification.tipo,
          leida: Boolean(notification.leida),
          fecha_envio: notification.fecha_envio,
        })),
        mensaje: notifications.length ? null : 'No tienes novedades recientes',
      },
    };
  }

  static async getObservatoryObservations(filters, user) {
    const context = await this.resolveApprenticeGroupContext(user, filters.id_grupo);
    const where = {
      id_aprendiz: user.id_aprendiz,
      id_grupo: context.selectedGroup.id_grupo,
      ...this._buildDateFilter('fecha_observacion', filters),
    };

    if (filters.severidad) where.severidad = filters.severidad;
    if (filters.tipo) where.tipo_observacion = filters.tipo;
    if (filters.estado) where.estado = filters.estado;

    const observations = await Observation.findAll({
      where,
      include: [
        {
          model: Instructor,
          as: 'instructor',
          attributes: ['id_instructor', 'codigo_instructor'],
          include: [{ model: User, as: 'usuario', attributes: ['id_usuario'], include: [{ model: Person, as: 'persona' }] }],
        },
      ],
      order: [['fecha_observacion', 'DESC']],
    });

    const metricas = observations.reduce((acc, item) => {
      acc.total += 1;
      acc.por_estado[item.estado] = (acc.por_estado[item.estado] || 0) + 1;
      acc.por_severidad[item.severidad] = (acc.por_severidad[item.severidad] || 0) + 1;
      acc.por_tipo[item.tipo_observacion] = (acc.por_tipo[item.tipo_observacion] || 0) + 1;
      return acc;
    }, { total: 0, por_estado: {}, por_severidad: {}, por_tipo: {} });

    return {
      ficha: context.ficha_seleccionada,
      metricas,
      observaciones: observations.map((item) => ({
        id_observacion: item.id_observacion,
        fecha: item.fecha_observacion,
        tipo: item.tipo_observacion,
        severidad: item.severidad,
        estado: item.estado,
        descripcion: item.descripcion,
        responsable: item.instructor
          ? {
              id_instructor: item.instructor.id_instructor,
              nombre_completo: this._fullName(item.instructor.usuario?.persona),
              rol: 'instructor',
            }
          : null,
      })),
      mensaje: observations.length ? null : 'No tienes observaciones por el momento',
    };
  }

  static async getObservatoryAlerts(filters, user) {
    const context = await this.resolveApprenticeGroupContext(user, filters.id_grupo);
    const where = {
      id_aprendiz: user.id_aprendiz,
      id_grupo: context.selectedGroup.id_grupo,
      ...this._buildDateFilter('fecha_alerta', filters),
    };

    if (filters.severidad) where.severidad = filters.severidad;
    if (filters.tipo) where.tipo_alerta = filters.tipo;
    if (filters.estado) where.estado = filters.estado;

    const buildUserInclude = (as) => ({
      model: User,
      as,
      required: false,
      attributes: ['id_usuario'],
      include: [
        { model: Person, as: 'persona' },
        { model: Role, as: 'rol', attributes: ['nombre'] },
      ],
    });

    const alerts = await Alert.findAll({
      where,
      include: [
        buildUserInclude('usuario_creador'),
        buildUserInclude('usuario_cierre'),
        buildUserInclude('usuario_reapertura'),
      ],
      order: [['fecha_alerta', 'DESC']],
    });

    const metricas = alerts.reduce((acc, item) => {
      acc.total += 1;
      acc.por_estado[item.estado] = (acc.por_estado[item.estado] || 0) + 1;
      acc.por_severidad[item.severidad] = (acc.por_severidad[item.severidad] || 0) + 1;
      acc.por_tipo[item.tipo_alerta] = (acc.por_tipo[item.tipo_alerta] || 0) + 1;
      return acc;
    }, { total: 0, por_estado: {}, por_severidad: {}, por_tipo: {} });

    return {
      ficha: context.ficha_seleccionada,
      metricas,
      alertas: alerts.map((item) => ({
        id_alerta: item.id_alerta,
        tipo: item.tipo_alerta,
        severidad: item.severidad,
        estado: item.estado,
        origen: item.origen,
        regla_disparo: item.regla_disparo,
        descripcion: item.descripcion,
        fecha_alerta: item.fecha_alerta,
        fecha_cierre: item.fecha_cierre,
        justificacion_cierre: item.justificacion_cierre,
        fecha_reapertura: item.fecha_reapertura,
        justificacion_reapertura: item.justificacion_reapertura,
        responsable: this._serializeUserResponsible(item.usuario_creador, 'responsable'),
        responsable_cierre: this._serializeUserResponsible(item.usuario_cierre, 'responsable'),
        responsable_reapertura: this._serializeUserResponsible(item.usuario_reapertura, 'responsable'),
      })),
      mensaje: alerts.length ? null : 'No tienes alertas por el momento',
    };
  }
}

module.exports = ApprenticePortalService;
