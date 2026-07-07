const { Op } = require('sequelize');

const {
  sequelize,
  Apprentice,
  ApprenticeGroup,
  Attendance,
  AttendanceEvidence,
  ClassCompetency,
  EducationalArea,
  EducationalSchedule,
  EducationalSession,
  FormativeProgram,
  Group,
  GroupTrimester,
  Instructor,
  InstructorGroup,
  JourneyBlock,
  ProgramClassCompetency,
  User,
  Person,
} = require('../models');
const { getAccessibleGroupIdsForRequester } = require('../helpers/coordinatorAuth');
const { generateQrToken, hashQrToken } = require('../helpers/qrToken');
const { toEp05AttendanceState } = require('../helpers/attendanceStateMapper');
const AlertService = require('./AlertService');
const NotificationService = require('./NotificationService');

const SESSION_STATES = ['PROGRAMADA', 'ABIERTA', 'CERRADA', 'CANCELADA'];
const APP_TIME_ZONE = 'America/Bogota';

class EducationalSessionService {
  static _toDateOnly(value) {
    if (!value) return null;
    const stringValue = String(value);
    const dateOnly = stringValue.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateOnly) return dateOnly[0];
    return this._dateTimePartsInAppZone(new Date(value)).date;
  }

  static _dateTimePartsInAppZone(value = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(value).reduce((acc, part) => {
      if (part.type !== 'literal') acc[part.type] = part.value;
      return acc;
    }, {});

    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}:${parts.second}`,
      seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second),
    };
  }

  static _todayDateOnly() {
    return this._dateTimePartsInAppZone().date;
  }

  static _dateToScheduleDay(dateValue) {
    const day = new Date(`${dateValue}T00:00:00-05:00`).getDay();
    return day === 0 ? 7 : day;
  }

  static _dateRange(start, end) {
    const dates = [];
    const current = new Date(`${start}T00:00:00-05:00`);
    const limit = new Date(`${end}T00:00:00-05:00`);

    while (current <= limit) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  static _normalizeDateBoundary(value, fallback) {
    return value ? this._toDateOnly(value) : fallback;
  }

  static _timeToSeconds(value) {
    const [h, m, s = '0'] = String(value).split(':');
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }

  static _assertInstructor(requester) {
    if (requester.rol !== 'instructor' || !requester.id_instructor) {
      throw { status: 403, message: 'Solo un instructor activo puede realizar esta operacion' };
    }
  }

  static async _findSessionOrFail(id_sesion_formacion, transaction = null) {
    const session = await EducationalSession.findByPk(id_sesion_formacion, {
      include: [
        { model: EducationalSchedule, as: 'horario', include: [{ model: InstructorGroup, as: 'instructor_grupo' }] },
        { model: Group, as: 'grupo', include: [{ model: FormativeProgram, as: 'programa_formacion', include: [{ model: EducationalArea, as: 'area' }] }] },
        { model: JourneyBlock, as: 'bloque_jornada' },
        { model: ClassCompetency, as: 'competencia' },
      ],
      transaction,
    });

    if (!session) throw { status: 404, message: 'Sesion de formacion no encontrada' };
    return session;
  }

  static _assertResponsibleInstructor(session, requester) {
    if (requester?.isSystem) return;
    this._assertInstructor(requester);

    if (Number(session.id_instructor) !== Number(requester.id_instructor)) {
      throw { status: 403, message: 'No eres el instructor responsable de esta sesion' };
    }
  }

  static _assertSessionState(session, expected, message) {
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.includes(session.estado)) {
      throw { status: 409, message };
    }
  }

  static _assertOpenWindow(session) {
    const today = this._todayDateOnly();
    if (String(session.fecha_clase) !== today) {
      throw { status: 409, message: 'La sesion solo puede abrirse en la fecha programada' };
    }

    const nowSeconds = this._dateTimePartsInAppZone().seconds;
    const startSeconds = this._timeToSeconds(session.hora_inicio_programada);
    const endSeconds = this._timeToSeconds(session.hora_fin_programada);
    const tolerance = Number(session.horario?.tolerancia_minutos || 0) * 60;

    if (nowSeconds < startSeconds - tolerance || nowSeconds > endSeconds) {
      throw { status: 409, message: 'La sesion esta fuera de la hora programada o ventana permitida' };
    }
  }

  static _serializeSession(session) {
    const data = typeof session.toJSON === 'function' ? session.toJSON() : session;
    return data;
  }

  static _serializeAttendance(attendance) {
    const data = typeof attendance.toJSON === 'function' ? attendance.toJSON() : attendance;
    return {
      ...data,
      estado_ep05: toEp05AttendanceState(data.estado_asistencia),
    };
  }

  static async _ensureBaseAttendances(session, transaction) {
    const activeApprentices = await ApprenticeGroup.findAll({
      where: {
        id_grupo: session.id_grupo,
        estado: 'ACTIVO',
      },
      transaction,
    });

    if (!activeApprentices.length) return 0;

    const baseAttendanceRecords = activeApprentices.map((apprentice) => ({
      id_sesion_formacion: session.id_sesion_formacion,
      id_aprendiz: apprentice.id_aprendiz,
      estado_asistencia: 'PENDIENTE',
      origen: null,
    }));

    const created = await Attendance.bulkCreate(baseAttendanceRecords, {
      transaction,
      ignoreDuplicates: true,
    });

    return created.length;
  }

  static async _assertScheduleBusinessRules(schedule, transaction) {
    if (!schedule) throw { status: 404, message: 'Horario de formacion no encontrado' };
    if (schedule.estado !== 'ACTIVO') throw { status: 409, message: 'El horario no esta activo' };

    const groupTrimester = await GroupTrimester.findByPk(schedule.id_grupo_trimestre, {
      include: [{ model: Group, as: 'grupo' }],
      transaction,
    });
    if (!groupTrimester) throw { status: 404, message: 'Grupo-trimestre no encontrado' };
    if (!groupTrimester.grupo || groupTrimester.grupo.estado !== 'EN_FORMACION') {
      throw { status: 409, message: 'Solo se pueden generar sesiones para grupos en formacion' };
    }
    if (!groupTrimester.grupo.id_ambiente) {
      throw { status: 409, message: 'El grupo no tiene ambiente asignado para generar sesiones' };
    }

    const instructorGroup = await InstructorGroup.findOne({
      where: {
        id_instructor_grupo: schedule.id_instructor_grupo,
        id_grupo: groupTrimester.id_grupo,
        estado: 'ACTIVO',
      },
      transaction,
    });
    if (!instructorGroup) {
      throw { status: 409, message: 'El instructor del horario no esta vinculado activamente al grupo' };
    }

    const allowedCompetency = await ProgramClassCompetency.findOne({
      where: {
        id_programa: groupTrimester.grupo.id_programa,
        id_clase_competencia: schedule.id_clase_competencia,
        estado: 'ACTIVO',
      },
      transaction,
    });
    if (!allowedCompetency) {
      throw { status: 409, message: 'La competencia del bloque no es valida para el programa del grupo' };
    }

    return { groupTrimester, instructorGroup };
  }

  static async generateFromSchedule(data, requester) {
    this._assertInstructor(requester);

    const { id_grupo_trimestre, id_horario, fecha_desde, fecha_hasta } = data;
    const start = this._normalizeDateBoundary(fecha_desde, null);
    const end = this._normalizeDateBoundary(fecha_hasta, start);

    if (!start || !end || start > end) {
      throw { status: 400, message: 'Debe enviar un rango de fechas valido' };
    }

    const dates = this._dateRange(start, end);
    if (dates.length > 120) {
      throw { status: 400, message: 'El rango de generacion no puede superar 120 dias' };
    }

    const where = {
      id_grupo_trimestre,
      estado: 'ACTIVO',
    };
    if (id_horario) where.id_horario = id_horario;

    const schedules = await EducationalSchedule.findAll({ where });
    if (!schedules.length) {
      throw { status: 404, message: 'No se encontraron horarios activos para generar sesiones' };
    }

    const transaction = await sequelize.transaction();
    try {
      const created = [];
      const skipped = [];

      for (const schedule of schedules) {
        const { groupTrimester, instructorGroup } = await this._assertScheduleBusinessRules(schedule, transaction);

        if (Number(instructorGroup.id_instructor) !== Number(requester.id_instructor)) {
          skipped.push({ id_horario: schedule.id_horario, motivo: 'Instructor no responsable del horario' });
          continue;
        }

        for (const date of dates) {
          if (this._dateToScheduleDay(date) !== Number(schedule.dia_semana)) continue;

          const existing = await EducationalSession.findOne({
            where: { id_horario: schedule.id_horario, fecha_clase: date },
            transaction,
          });
          if (existing) {
            skipped.push({ id_horario: schedule.id_horario, fecha_clase: date, motivo: 'Sesion ya existente' });
            continue;
          }

          const session = await EducationalSession.create({
            id_horario: schedule.id_horario,
            id_grupo_trimestre: schedule.id_grupo_trimestre,
            id_clase_competencia: schedule.id_clase_competencia,
            id_bloque_jornada: schedule.id_bloque_jornada,
            id_grupo: groupTrimester.id_grupo,
            id_instructor: instructorGroup.id_instructor,
            id_ambiente: groupTrimester.grupo.id_ambiente,
            fecha_clase: date,
            hora_inicio_programada: schedule.hora_inicio,
            hora_fin_programada: schedule.hora_fin,
            estado: 'PROGRAMADA',
            origen_apertura: 'MANUAL_RESPALDO',
          }, { transaction });

          created.push(session);
        }
      }

      await transaction.commit();
      return { creadas: created.length, omitidas: skipped, sesiones: created };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async openSession(id, requester) {
    const transaction = await sequelize.transaction();
    try {
      const session = await this._findSessionOrFail(id, transaction);
      this._assertResponsibleInstructor(session, requester);
      this._assertSessionState(session, 'PROGRAMADA', 'Solo se pueden abrir sesiones PROGRAMADAS');
      if (!requester?.isSystem) {
        this._assertOpenWindow(session);
      }

      await session.update({
        estado: 'ABIERTA',
        hora_inicio_real: new Date(),
        fecha_apertura: new Date(),
        abierta_por: requester?.id_usuario || null,
        origen_apertura: requester?.isSystem ? 'AUTOMATICA_ACCESO' : 'MANUAL_RESPALDO',
      }, { transaction });

      // Congelar la lista base de aprendices activos del grupo.
      await this._ensureBaseAttendances(session, transaction);

      await transaction.commit();
      return this._findSessionOrFail(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async generateQr(id, requester) {
    const session = await this._findSessionOrFail(id);
    this._assertResponsibleInstructor(session, requester);
    this._assertSessionState(session, 'ABIERTA', 'Solo se puede generar QR para sesiones ABIERTAS');

    const token = generateQrToken();
    await session.update({
      qr_token_hash: hashQrToken(token),
    });

    return {
      id_sesion_formacion: session.id_sesion_formacion,
      qr_token: token,
      vigencia: 'Vigente mientras la sesion permanezca ABIERTA',
    };
  }

  static async _buildSessionWhereByRequester(requester, filters = {}) {
    const where = {};

    if (filters.estado) {
      if (!SESSION_STATES.includes(filters.estado)) {
        throw { status: 400, message: 'Estado de sesion invalido' };
      }
      where.estado = filters.estado;
    }
    if (filters.id_grupo) where.id_grupo = Number(filters.id_grupo);
    if (filters.id_grupo_trimestre) where.id_grupo_trimestre = Number(filters.id_grupo_trimestre);
    if (filters.id_instructor) where.id_instructor = Number(filters.id_instructor);
    if (filters.fecha) where.fecha_clase = filters.fecha;
    if (filters.fecha_desde || filters.fecha_hasta) {
      where.fecha_clase = {};
      if (filters.fecha_desde) where.fecha_clase[Op.gte] = filters.fecha_desde;
      if (filters.fecha_hasta) where.fecha_clase[Op.lte] = filters.fecha_hasta;
    }

    if (requester.rol === 'instructor') {
      const accessibleGroupIds = await getAccessibleGroupIdsForRequester(requester);
      if (!accessibleGroupIds.length) return null;

      where.id_grupo = where.id_grupo
        ? where.id_grupo
        : { [Op.in]: accessibleGroupIds };

      if (filters.solo_responsable === 'true') {
        where.id_instructor = requester.id_instructor;
      }
    } else if (requester.rol === 'coordinador') {
      const accessibleGroupIds = await getAccessibleGroupIdsForRequester(requester);
      if (!accessibleGroupIds.length) return null;

      if (where.id_grupo && !accessibleGroupIds.includes(Number(where.id_grupo))) {
        throw { status: 403, message: 'No tienes permisos para consultar sesiones de este grupo' };
      }
      if (!where.id_grupo) where.id_grupo = { [Op.in]: accessibleGroupIds };
    } else {
      throw { status: 403, message: 'No tienes permisos para consultar sesiones' };
    }

    return where;
  }

  static async listSessions(filters, requester) {
    const where = await this._buildSessionWhereByRequester(requester, filters);
    if (!where) return { total: 0, sesiones: [] };

    const limit = Math.min(Number(filters.limit) || 20, 100);
    const page = Math.max(Number(filters.page) || 1, 1);
    const offset = (page - 1) * limit;

    const { count, rows } = await EducationalSession.findAndCountAll({
      where,
      include: [
        { model: Group, as: 'grupo', attributes: ['id_grupo', 'numero_ficha', 'estado'] },
        { model: ClassCompetency, as: 'competencia', attributes: ['id_clase_competencia', 'nombre_competencia'] },
        { model: JourneyBlock, as: 'bloque_jornada', attributes: ['id_bloque_jornada', 'nombre_bloque', 'hora_inicio', 'hora_fin'] },
        { model: Instructor, as: 'instructor', attributes: ['id_instructor', 'codigo_instructor'] },
      ],
      order: [['fecha_clase', 'DESC'], ['hora_inicio_programada', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    return { total: count, pagina: page, limit, sesiones: rows.map((item) => this._serializeSession(item)) };
  }

  static async getSessionAttendances(id, requester) {
    const session = await this._findSessionOrFail(id);

    if (requester.rol === 'instructor') {
      const accessibleGroupIds = await getAccessibleGroupIdsForRequester(requester);
      if (!accessibleGroupIds.includes(Number(session.id_grupo))) {
        throw { status: 403, message: 'No tienes permisos para consultar esta sesion' };
      }
    } else if (requester.rol === 'coordinador') {
      const accessibleGroupIds = await getAccessibleGroupIdsForRequester(requester);
      if (!accessibleGroupIds.includes(Number(session.id_grupo))) {
        throw { status: 403, message: 'No tienes permisos para consultar esta sesion' };
      }
    } else {
      throw { status: 403, message: 'No tienes permisos para consultar esta sesion' };
    }

    if (session.estado === 'ABIERTA') {
      const transaction = await sequelize.transaction();
      try {
        await this._ensureBaseAttendances(session, transaction);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

    const attendances = await Attendance.findAll({
      where: { id_sesion_formacion: session.id_sesion_formacion },
      include: [
        {
          model: Apprentice,
          as: 'aprendiz',
          include: [{ model: User, as: 'usuario', include: [{ model: Person, as: 'persona' }] }],
        },
        { model: AttendanceEvidence, as: 'evidencias', required: false },
      ],
      order: [['id_asistencia', 'ASC']],
    });

    return {
      sesion: this._serializeSession(session),
      asistencias: attendances.map((item) => this._serializeAttendance(item)),
    };
  }

  static async closeSession(id, requester) {
    const transaction = await sequelize.transaction();
    try {
      const session = await this._findSessionOrFail(id, transaction);
      this._assertResponsibleInstructor(session, requester);
      this._assertSessionState(session, 'ABIERTA', 'Solo se pueden cerrar sesiones ABIERTAS');

      const pendingAttendances = await Attendance.findAll({
        where: {
          id_sesion_formacion: session.id_sesion_formacion,
          estado_asistencia: 'PENDIENTE',
        },
        include: [
          {
            model: Apprentice,
            as: 'aprendiz',
            include: [{ model: User, as: 'usuario', attributes: ['id_usuario'] }],
          },
        ],
        transaction,
      });

      // Actualizar todos los registros PENDIENTE a INASISTENCIA
      const [affectedCount] = await Attendance.update({
        estado_asistencia: 'INASISTENCIA',
        origen: 'AUTOMATICO_CIERRE',
        observacion: 'Inasistencia consolidada automaticamente al cerrar la sesion',
      }, {
        where: {
          id_sesion_formacion: session.id_sesion_formacion,
          estado_asistencia: 'PENDIENTE',
        },
        transaction,
        individualHooks: true,
      });

      await session.update({
        estado: 'CERRADA',
        hora_fin_real: new Date(),
        fecha_cierre: new Date(),
        cerrada_por: requester?.id_usuario || null,
        qr_token_hash: null,
      }, { transaction });

      for (const attendance of pendingAttendances) {
        const idUsuario = attendance.aprendiz?.usuario?.id_usuario;
        if (!idUsuario) continue;
        await NotificationService.createForUser({
          id_usuario: idUsuario,
          id_alerta: null,
          tipo: 'ASISTENCIA',
          titulo: 'Inasistencia disponible para justificar',
          mensaje: `Se registro una inasistencia en la sesion #${session.id_sesion_formacion} del ${session.fecha_clase}. Puedes justificarla si estas dentro del plazo permitido.`,
          transaction,
        });
      }

      await transaction.commit();

      return {
        sesion: await this._findSessionOrFail(id),
        ausentes_generados: affectedCount,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async cancelSession(id, requester, motivo) {
    const cleanReason = String(motivo || '').trim();
    if (!cleanReason) {
      throw { status: 400, message: 'El motivo de cancelacion es obligatorio' };
    }
    if (cleanReason.length > 255) {
      throw { status: 400, message: 'El motivo de cancelacion no puede superar 255 caracteres' };
    }

    const session = await this._findSessionOrFail(id);
    this._assertResponsibleInstructor(session, requester);
    this._assertSessionState(session, ['PROGRAMADA', 'ABIERTA'], 'Solo se pueden cancelar sesiones PROGRAMADAS o ABIERTAS');

    await session.update({
      estado: 'CANCELADA',
      cancelada_por: requester.id_usuario,
      fecha_cancelacion: new Date(),
      motivo_cancelacion: cleanReason,
      qr_token_hash: null,
    });

    return this._findSessionOrFail(id);
  }

  static async autoOpenSessions() {
    const today = this._todayDateOnly();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const tenMinutesAgoTime = this._dateTimePartsInAppZone(tenMinutesAgo).time;

    const sessions = await EducationalSession.findAll({
      where: {
        estado: 'PROGRAMADA',
        fecha_clase: today,
        hora_inicio_programada: { [Op.lte]: tenMinutesAgoTime },
      },
    });

    const systemUser = { isSystem: true, id_usuario: null };
    for (const session of sessions) {
      try {
        console.log(`Auto-abriendo sesion ${session.id_sesion_formacion}...`);
        await this.openSession(session.id_sesion_formacion, systemUser);
      } catch (err) {
        console.error(`Error al auto-abrir sesion ${session.id_sesion_formacion}:`, err.message);
      }
    }
  }

  static async autoCloseSessions() {
    const today = this._todayDateOnly();
    const currentTime = this._dateTimePartsInAppZone().time;

    const sessions = await EducationalSession.findAll({
      where: {
        estado: 'ABIERTA',
        [Op.or]: [
          { fecha_clase: { [Op.lt]: today } },
          {
            fecha_clase: today,
            hora_fin_programada: { [Op.lte]: currentTime },
          },
        ],
      },
    });

    const systemUser = { isSystem: true, id_usuario: null };
    for (const session of sessions) {
      try {
        console.log(`Auto-cerrando sesion ${session.id_sesion_formacion}...`);
        await this.closeSession(session.id_sesion_formacion, systemUser);
      } catch (err) {
        console.error(`Error al auto-cerrar sesion ${session.id_sesion_formacion}:`, err.message);
      }
    }
  }
}

module.exports = EducationalSessionService;
