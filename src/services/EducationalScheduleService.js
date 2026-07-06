const { Op } = require('sequelize');

const {
  sequelize,
  EducationalSchedule,
  GroupTrimester,
  Group,
  InstructorGroup,
  Instructor,
  JourneyBlock,
  ClassCompetency,
  ProgramClassCompetency,
  EducationalSession,
  User,
  Person,
} = require('../models');
const { checkCoordinatorGroupAccess } = require('../helpers/coordinatorAuth');

class EducationalScheduleService {
  static get CLOSED_TRIMESTER_STATES() {
    return ['COMPLETADO', 'CANCELADO'];
  }

  static get GROUP_STATES_WITHOUT_NEW_SCHEDULES() {
    return ['FINALIZADO'];
  }

  static _normalizeTime(value) {
    if (!value) return null;
    const time = String(value).trim();
    return time.length === 5 ? `${time}:00` : time;
  }

  static _normalizeJourney(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/Ã‘|Ñ/g, 'N')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_');
  }

  static _serialize(schedule) {
    const data = typeof schedule?.toJSON === 'function' ? schedule.toJSON() : schedule;
    return data;
  }

  static async _findGroupOrFail(id_grupo, transaction) {
    const group = await Group.findByPk(id_grupo, { transaction });
    if (!group) throw { status: 404, message: 'Grupo formativo no encontrado' };
    return group;
  }

  static async _assertInstructorLeader(group, requester) {
    if (requester.rol !== 'instructor' || Number(group.id_instructor_lider) !== Number(requester.id_instructor)) {
      throw { status: 403, message: 'Solo el instructor lider vigente puede gestionar horarios de este grupo' };
    }
  }

  static async _assertRequesterCanReadGroup(group, requester) {
    if (requester.rol === 'coordinador') {
      const hasAccess = await checkCoordinatorGroupAccess(requester.id_usuario, group.id_grupo);
      if (!hasAccess) {
        throw { status: 403, message: 'No tienes permisos para consultar horarios de este grupo' };
      }
      return true;
    }

    if (requester.rol === 'instructor') {
      if (Number(group.id_instructor_lider) === Number(requester.id_instructor)) return true;

      const assignment = await InstructorGroup.findOne({
        where: {
          id_grupo: group.id_grupo,
          id_instructor: requester.id_instructor,
          estado: 'ACTIVO',
        },
      });

      if (assignment) return true;
    }

    throw { status: 403, message: 'No tienes permisos para consultar horarios de este grupo' };
  }

  static async _findScheduleOrFail(id, transaction) {
    const schedule = await EducationalSchedule.findByPk(id, {
      include: this._scheduleIncludes,
      transaction,
    });

    if (!schedule) throw { status: 404, message: 'Horario formativo no encontrado' };
    return schedule;
  }

  static get _scheduleIncludes() {
    return [
      {
        model: GroupTrimester,
        as: 'grupo_trimestre',
        include: [{ model: Group, as: 'grupo' }],
      },
      { model: ClassCompetency, as: 'competencia' },
      { model: JourneyBlock, as: 'bloque_jornada' },
      {
        model: InstructorGroup,
        as: 'instructor_grupo',
        include: [
          {
            model: Instructor,
            as: 'instructor',
            include: [
              {
                model: User,
                as: 'usuario',
                attributes: ['id_usuario', 'email'],
                include: [{ model: Person, as: 'persona', attributes: ['nombres', 'apellidos'] }],
              },
            ],
          },
        ],
      },
    ];
  }

  static async _assertEditableGroupAndTrimester(groupTrimester, group) {
    if (!groupTrimester) throw { status: 404, message: 'Grupo-trimestre no encontrado' };
    if (!group) throw { status: 404, message: 'Grupo formativo no encontrado' };

    if (this.GROUP_STATES_WITHOUT_NEW_SCHEDULES.includes(group.estado)) {
      throw { status: 409, message: 'No se pueden gestionar horarios de un grupo finalizado' };
    }

    if (this.CLOSED_TRIMESTER_STATES.includes(groupTrimester.estado)) {
      throw { status: 409, message: 'No se pueden gestionar horarios de un trimestre cerrado o cancelado' };
    }
  }

  static async _resolveBusinessContext(data, requester, transaction) {
    const groupTrimester = await GroupTrimester.findByPk(data.id_grupo_trimestre, {
      include: [{ model: Group, as: 'grupo' }],
      transaction,
    });
    const group = groupTrimester?.grupo || null;

    await this._assertEditableGroupAndTrimester(groupTrimester, group);
    await this._assertInstructorLeader(group, requester);

    const instructorGroup = await InstructorGroup.findByPk(data.id_instructor_grupo, {
      include: [{ model: Instructor, as: 'instructor' }],
      transaction,
    });
    if (!instructorGroup || instructorGroup.estado !== 'ACTIVO' || Number(instructorGroup.id_grupo) !== Number(group.id_grupo)) {
      throw { status: 409, message: 'El instructor responsable no esta vinculado activamente al grupo' };
    }

    const block = await JourneyBlock.findByPk(data.id_bloque_jornada, { transaction });
    if (!block || block.estado !== 'ACTIVO') {
      throw { status: 404, message: 'El bloque de jornada no existe o no esta activo' };
    }

    if (this._normalizeJourney(block.jornada) !== this._normalizeJourney(group.jornada)) {
      throw { status: 409, message: 'El bloque horario no corresponde a la jornada del grupo' };
    }

    const competency = await ClassCompetency.findByPk(data.id_clase_competencia, { transaction });
    if (!competency || competency.estado !== 'ACTIVA') {
      throw { status: 404, message: 'La competencia no existe o no esta activa' };
    }

    const allowedCompetency = await ProgramClassCompetency.findOne({
      where: {
        id_programa: group.id_programa,
        id_clase_competencia: data.id_clase_competencia,
        estado: 'ACTIVO',
      },
      transaction,
    });
    if (!allowedCompetency) {
      throw { status: 409, message: 'La competencia no pertenece al programa del grupo' };
    }

    const horaInicio = this._normalizeTime(data.hora_inicio || block.hora_inicio);
    const horaFin = this._normalizeTime(data.hora_fin || block.hora_fin);
    if (horaInicio >= horaFin) {
      throw { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio' };
    }

    if (!group.id_ambiente) {
      throw { status: 409, message: 'El grupo no tiene ambiente asignado para crear horarios' };
    }

    return { groupTrimester, group, instructorGroup, block, competency, horaInicio, horaFin };
  }

  static async _assertNoGeneratedSessions(id_horario, transaction) {
    const sessions = await EducationalSession.count({
      where: { id_horario },
      transaction,
    });

    if (sessions > 0) {
      throw { status: 409, message: 'No se puede modificar un horario que ya genero sesiones de formacion' };
    }
  }

  static async _assertScheduleConflicts(data, context, transaction, excludeScheduleId = null) {
    const baseWhere = {
      estado: 'ACTIVO',
      dia_semana: data.dia_semana,
      id_bloque_jornada: data.id_bloque_jornada,
    };

    if (excludeScheduleId) {
      baseWhere.id_horario = { [Op.ne]: excludeScheduleId };
    }

    const groupConflict = await EducationalSchedule.findOne({
      where: {
        ...baseWhere,
        id_grupo_trimestre: data.id_grupo_trimestre,
      },
      transaction,
    });
    if (groupConflict) {
      throw { status: 409, message: 'El grupo ya tiene programacion activa en ese dia y bloque' };
    }

    const instructorAssignments = await InstructorGroup.findAll({
      where: {
        id_instructor: context.instructorGroup.id_instructor,
        estado: 'ACTIVO',
      },
      attributes: ['id_instructor_grupo'],
      transaction,
    });
    const instructorAssignmentIds = instructorAssignments.map((item) => item.id_instructor_grupo);

    if (instructorAssignmentIds.length) {
      const instructorConflict = await EducationalSchedule.findOne({
        where: {
          ...baseWhere,
          id_instructor_grupo: { [Op.in]: instructorAssignmentIds },
        },
        transaction,
      });
      if (instructorConflict) {
        throw { status: 409, message: 'El instructor responsable ya tiene programacion activa en ese dia y bloque' };
      }
    }

    if (context.group.id_ambiente) {
      const trimesterRows = await GroupTrimester.findAll({
        attributes: ['id_grupo_trimestre'],
        include: [
          {
            model: Group,
            as: 'grupo',
            attributes: [],
            where: { id_ambiente: context.group.id_ambiente },
            required: true,
          },
        ],
        transaction,
      });
      const trimesterIds = trimesterRows.map((item) => item.id_grupo_trimestre);

      if (trimesterIds.length) {
        const environmentConflict = await EducationalSchedule.findOne({
          where: {
            ...baseWhere,
            id_grupo_trimestre: { [Op.in]: trimesterIds },
          },
          transaction,
        });
        if (environmentConflict) {
          throw { status: 409, message: 'El ambiente del grupo ya tiene programacion activa en ese dia y bloque' };
        }
      }
    }
  }

  static async getCatalogs(filters, requester) {
    const idGrupo = Number(filters.id_grupo);
    const group = await this._findGroupOrFail(idGrupo);
    await this._assertRequesterCanReadGroup(group, requester);

    const [trimesters, blocks, competencies, instructors] = await Promise.all([
      GroupTrimester.findAll({
        where: {
          id_grupo: idGrupo,
          estado: { [Op.notIn]: this.CLOSED_TRIMESTER_STATES },
        },
        order: [['numero_trimestre', 'ASC']],
      }),
      JourneyBlock.findAll({
        where: {
          jornada: this._normalizeJourney(group.jornada),
          estado: 'ACTIVO',
        },
        order: [['orden', 'ASC']],
      }),
      ProgramClassCompetency.findAll({
        where: { id_programa: group.id_programa, estado: 'ACTIVO' },
        include: [{ model: ClassCompetency, as: 'competencia', where: { estado: 'ACTIVA' }, required: true }],
        order: [[{ model: ClassCompetency, as: 'competencia' }, 'nombre_competencia', 'ASC']],
      }),
      InstructorGroup.findAll({
        where: { id_grupo: idGrupo, estado: 'ACTIVO' },
        include: [
          {
            model: Instructor,
            as: 'instructor',
            where: { estado: 'ACTIVO' },
            required: true,
            include: [
              {
                model: User,
                as: 'usuario',
                attributes: ['id_usuario', 'email'],
                include: [{ model: Person, as: 'persona', attributes: ['nombres', 'apellidos'] }],
              },
            ],
          },
        ],
      }),
    ]);

    return {
      grupo: group,
      trimestres: trimesters,
      bloques: blocks,
      competencias: competencies.map((item) => item.competencia),
      instructores_responsables: instructors,
    };
  }

  static async createSchedule(data, requester) {
    const transaction = await sequelize.transaction();

    try {
      const context = await this._resolveBusinessContext(data, requester, transaction);
      await this._assertScheduleConflicts(data, context, transaction);

      const schedule = await EducationalSchedule.create({
        id_grupo_trimestre: data.id_grupo_trimestre,
        id_clase_competencia: data.id_clase_competencia,
        id_instructor_grupo: data.id_instructor_grupo,
        id_bloque_jornada: data.id_bloque_jornada,
        id_ambiente: context.group.id_ambiente,
        dia_semana: data.dia_semana,
        hora_inicio: context.horaInicio,
        hora_fin: context.horaFin,
        tolerancia_minutos: data.tolerancia_minutos ?? undefined,
        estado: 'ACTIVO',
      }, { transaction });

      await transaction.commit();
      return this.getById(schedule.id_horario, requester);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getByGroup(idGrupo, filters, requester) {
    const group = await this._findGroupOrFail(idGrupo);
    await this._assertRequesterCanReadGroup(group, requester);

    const trimesters = await GroupTrimester.findAll({
      where: { id_grupo: idGrupo },
      attributes: ['id_grupo_trimestre'],
    });
    const trimesterIds = trimesters.map((item) => item.id_grupo_trimestre);

    if (!trimesterIds.length) return [];

    const where = { id_grupo_trimestre: { [Op.in]: trimesterIds } };
    if (filters.estado) where.estado = filters.estado;
    if (filters.id_grupo_trimestre) where.id_grupo_trimestre = Number(filters.id_grupo_trimestre);
    if (filters.dia_semana) where.dia_semana = Number(filters.dia_semana);

    return EducationalSchedule.findAll({
      where,
      include: this._scheduleIncludes,
      order: [['dia_semana', 'ASC'], [{ model: JourneyBlock, as: 'bloque_jornada' }, 'orden', 'ASC']],
    });
  }

  static async getMySchedules(filters, requester) {
    if (requester.rol !== 'instructor') {
      throw { status: 403, message: 'Solo instructores pueden consultar sus horarios' };
    }

    const assignments = await InstructorGroup.findAll({
      where: { id_instructor: requester.id_instructor, estado: 'ACTIVO' },
      attributes: ['id_instructor_grupo'],
    });
    const assignmentIds = assignments.map((item) => item.id_instructor_grupo);

    const leaderGroups = await Group.findAll({
      where: { id_instructor_lider: requester.id_instructor },
      attributes: ['id_grupo'],
    });
    const leaderGroupIds = leaderGroups.map((item) => item.id_grupo);

    const leaderTrimesters = leaderGroupIds.length
      ? await GroupTrimester.findAll({
        where: { id_grupo: { [Op.in]: leaderGroupIds } },
        attributes: ['id_grupo_trimestre'],
      })
      : [];
    const leaderTrimesterIds = leaderTrimesters.map((item) => item.id_grupo_trimestre);

    const where = {
      [Op.or]: [
        ...(assignmentIds.length ? [{ id_instructor_grupo: { [Op.in]: assignmentIds } }] : []),
        ...(leaderTrimesterIds.length ? [{ id_grupo_trimestre: { [Op.in]: leaderTrimesterIds } }] : []),
      ],
    };

    if (!where[Op.or].length) return [];
    if (filters.estado) where.estado = filters.estado;

    return EducationalSchedule.findAll({
      where,
      include: this._scheduleIncludes,
      order: [['dia_semana', 'ASC'], [{ model: JourneyBlock, as: 'bloque_jornada' }, 'orden', 'ASC']],
    });
  }

  static async getById(id, requester) {
    const schedule = await this._findScheduleOrFail(id);
    const group = schedule.grupo_trimestre?.grupo;
    if (!group) throw { status: 404, message: 'Grupo formativo no encontrado para el horario' };

    await this._assertRequesterCanReadGroup(group, requester);
    return this._serialize(schedule);
  }

  static async updateSchedule(id, data, requester) {
    const transaction = await sequelize.transaction();

    try {
      const schedule = await this._findScheduleOrFail(id, transaction);
      const currentGroup = schedule.grupo_trimestre?.grupo;
      if (!currentGroup) throw { status: 404, message: 'Grupo formativo no encontrado para el horario' };

      await this._assertInstructorLeader(currentGroup, requester);
      await this._assertNoGeneratedSessions(id, transaction);

      const nextData = {
        id_grupo_trimestre: data.id_grupo_trimestre ?? schedule.id_grupo_trimestre,
        id_clase_competencia: data.id_clase_competencia ?? schedule.id_clase_competencia,
        id_instructor_grupo: data.id_instructor_grupo ?? schedule.id_instructor_grupo,
        id_bloque_jornada: data.id_bloque_jornada ?? schedule.id_bloque_jornada,
        dia_semana: data.dia_semana ?? schedule.dia_semana,
        hora_inicio: data.hora_inicio ?? schedule.hora_inicio,
        hora_fin: data.hora_fin ?? schedule.hora_fin,
        tolerancia_minutos: data.tolerancia_minutos ?? schedule.tolerancia_minutos,
      };

      const context = await this._resolveBusinessContext(nextData, requester, transaction);
      await this._assertScheduleConflicts(nextData, context, transaction, Number(id));

      await schedule.update({
        ...nextData,
        id_ambiente: context.group.id_ambiente,
        hora_inicio: context.horaInicio,
        hora_fin: context.horaFin,
      }, { transaction });

      await transaction.commit();
      return this.getById(id, requester);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async deactivateSchedule(id, requester) {
    const transaction = await sequelize.transaction();

    try {
      const schedule = await this._findScheduleOrFail(id, transaction);
      const group = schedule.grupo_trimestre?.grupo;
      if (!group) throw { status: 404, message: 'Grupo formativo no encontrado para el horario' };

      await this._assertInstructorLeader(group, requester);

      if (schedule.estado === 'INACTIVO') {
        throw { status: 409, message: 'El horario ya se encuentra inactivo' };
      }

      await schedule.update({ estado: 'INACTIVO' }, { transaction });
      await transaction.commit();
      return this.getById(id, requester);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = EducationalScheduleService;
