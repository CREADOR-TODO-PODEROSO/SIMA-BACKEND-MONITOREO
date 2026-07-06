const { Op } = require('sequelize');

const {
  sequelize,
  Group,
  GroupTrimester,
  FormativeProgram,
  EducationalArea,
  Environment,
  Instructor,
  InstructorGroup,
  User,
  Person,
} = require('../models');
const { getPagination } = require('../helpers/pagination');
const {
  getCoordinatorAreaIds,
  checkCoordinatorProgramAccess,
  checkCoordinatorGroupAccess,
  getAccessibleGroupIdsForRequester,
  assertRequesterCanAccessGroup,
} = require('../helpers/coordinatorAuth');

class GroupService {
  static get GROUP_STATES() {
    return ['EN_FORMACION', 'PRACTICAS', 'FINALIZADO'];
  }

  static _calculateEndDate(startDate, trimesters) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + trimesters * 3);
    return date.toISOString().split('T')[0];
  }

  static _addMonthsDateOnly(dateValue, months) {
    const date = new Date(`${String(dateValue).split('T')[0]}T00:00:00`);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
  }

  static _buildTrimesterRows(id_grupo, fecha_inicio, trimestres) {
    const totalTrimesters = Number.parseInt(trimestres, 10);
    if (!Number.isInteger(totalTrimesters) || totalTrimesters < 1) {
      throw { status: 400, message: 'La cantidad de trimestres debe ser un entero positivo' };
    }

    return Array.from({ length: totalTrimesters }, (_, index) => {
      const numero_trimestre = index + 1;
      return {
        id_grupo,
        numero_trimestre,
        fecha_inicio: this._addMonthsDateOnly(fecha_inicio, index * 3),
        fecha_fin: this._addMonthsDateOnly(fecha_inicio, numero_trimestre * 3),
        estado: numero_trimestre === 1 ? 'ACTIVO' : 'PROGRAMADO',
      };
    });
  }

  static async _createInitialTrimesters(id_grupo, fecha_inicio, trimestres, transaction) {
    const rows = this._buildTrimesterRows(id_grupo, fecha_inicio, trimestres);
    await GroupTrimester.bulkCreate(rows, { transaction });
    return rows;
  }

  static _todayDateOnly() {
    return new Date().toISOString().split('T')[0];
  }

  static async _calculateFunctionalState(group, transaction) {
    const today = this._todayDateOnly();

    if (group.fecha_fin && String(group.fecha_fin) <= today) {
      return 'FINALIZADO';
    }

    const lastTrimester = await GroupTrimester.findOne({
      where: { id_grupo: group.id_grupo },
      order: [['numero_trimestre', 'DESC'], ['fecha_fin', 'DESC']],
      attributes: ['fecha_fin'],
      transaction,
    });

    if (lastTrimester?.fecha_fin && String(lastTrimester.fecha_fin) < today) {
      return 'PRACTICAS';
    }

    return 'EN_FORMACION';
  }

  static async _syncGroupStateByDates(group, transaction) {
    const nextState = await this._calculateFunctionalState(group, transaction);

    if (group.estado !== nextState) {
      await group.update({ estado: nextState }, { transaction });
      group.estado = nextState;
    }

    return group;
  }

  static async _ensureInstructorGroupAssignment(id_instructor, id_grupo, id_usuario_asignador, transaction) {
    const existing = await InstructorGroup.findOne({
      where: { id_instructor, id_grupo },
      transaction,
    });

    if (existing) {
      await existing.update({
        estado: 'ACTIVO',
        fecha_fin: null,
        asignado_por: id_usuario_asignador || existing.asignado_por,
      }, { transaction });
      return existing;
    }

    return InstructorGroup.create({
      id_instructor,
      id_grupo,
      estado: 'ACTIVO',
      asignado_por: id_usuario_asignador || null,
    }, { transaction });
  }

  static get _includeRelations() {
    return [
      {
        model: FormativeProgram,
        as: 'programa_formacion',
        attributes: ['id_programa', 'nombre_programa'],
        include: [{ model: EducationalArea, as: 'area', attributes: ['id_area', 'nombre_area'] }],
      },
      { model: Environment, as: 'ambiente', attributes: ['id_ambiente', 'nombre_ambiente', 'ubicacion'] },
      {
        model: Instructor,
        as: 'instructor_lider',
        attributes: ['id_instructor', 'codigo_instructor', 'especialidad'],
        include: [
          {
            model: User,
            as: 'usuario',
            attributes: ['id_usuario', 'email'],
            include: [{ model: Person, as: 'persona', attributes: ['nombres', 'apellidos'] }],
          },
        ],
      },
    ];
  }

  static async _getAccessibleGroupIdsForRequester(requester) {
    return getAccessibleGroupIdsForRequester(requester);
  }

  static _role(requester) {
    return String(requester?.rol || '').toLowerCase().trim();
  }

  static async _assertRequesterCanAccessGroup(requester, id_grupo) {
    return assertRequesterCanAccessGroup(
      requester,
      id_grupo,
      'No tienes permisos para consultar este grupo'
    );
  }

  static async _assertCoordinatorCanManageProgram(
    requester,
    id_programa,
    message = 'No tienes permisos para crear grupos en el area asociada a este programa de formacion'
  ) {
    if (this._role(requester) === 'super_admin') {
      return true;
    }

    const tieneAcceso = await checkCoordinatorProgramAccess(requester.id_usuario, id_programa);
    if (!tieneAcceso) {
      throw { status: 403, message };
    }
  }

  static async _assertCoordinatorCanManageGroup(requester, id_grupo, message) {
    if (this._role(requester) === 'super_admin') {
      return true;
    }

    const tieneAcceso = await checkCoordinatorGroupAccess(requester.id_usuario, id_grupo);
    if (!tieneAcceso) {
      throw { status: 403, message };
    }
  }

  static async _findGroupOrFail(id) {
    const group = await Group.findByPk(id);
    if (!group) throw { status: 404, message: 'Grupo formativo no encontrado' };
    return group;
  }

  static async _findProgramOrFail(id_programa) {
    const program = await FormativeProgram.findByPk(id_programa);
    if (!program) throw { status: 404, message: 'El programa de formacion no existe' };
    return program;
  }

  static async _findEnvironmentOrFail(id_ambiente) {
    const environment = await Environment.findByPk(id_ambiente);
    if (!environment) throw { status: 404, message: 'El ambiente seleccionado no existe' };
    return environment;
  }

  static async _findActiveInstructorOrFail(id_instructor) {
    const instructor = await Instructor.findOne({
      where: { id_instructor, estado: 'ACTIVO' },
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id_usuario', 'email'],
          include: [{ model: Person, as: 'persona', attributes: ['nombres', 'apellidos'] }],
        },
      ],
    });

    if (!instructor) throw { status: 404, message: 'El instructor no existe o no esta activo' };
    return instructor;
  }

  static async getGroups(filters, requester) {
    const { page, limit, estado, jornada, numero_ficha, id_programa, id_area } = filters;
    const { limit: take, offset } = getPagination(page, limit);

    const whereGrupo = {};
    if (estado) whereGrupo.estado = estado;
    if (jornada) whereGrupo.jornada = jornada;
    if (numero_ficha) whereGrupo.numero_ficha = { [Op.like]: `%${numero_ficha}%` };

    const wherePrograma = {};
    if (id_programa) wherePrograma.id_programa = id_programa;

    const whereAreaPrograma = {};

    const requesterRole = this._role(requester);

    if (requesterRole === 'coordinador') {
      const areaIds = await getCoordinatorAreaIds(requester.id_usuario);

      if (!areaIds.length) {
        return { total: 0, pagina: Number(page) || 1, grupos: [] };
      }

      if (id_area) {
        if (!areaIds.includes(Number(id_area))) {
          throw { status: 403, message: 'No tienes permisos para consultar grupos de esa area' };
        }
        whereAreaPrograma.id_area = Number(id_area);
      } else {
        whereAreaPrograma.id_area = { [Op.in]: areaIds };
      }
    } else if (id_area) {
      whereAreaPrograma.id_area = Number(id_area);
    }

    if (requesterRole === 'instructor') {
      const allGroupIds = await this._getAccessibleGroupIdsForRequester(requester);

      if (!allGroupIds.length) {
        return { total: 0, pagina: Number(page) || 1, grupos: [] };
      }

      whereGrupo.id_grupo = { [Op.in]: allGroupIds };
    }

    const includeFormativeProgram = {
      model: FormativeProgram,
      as: 'programa_formacion',
      attributes: ['id_programa', 'nombre_programa'],
      required: true,
      include: [
        {
          model: EducationalArea,
          as: 'area',
          attributes: ['id_area', 'nombre_area'],
          ...(Object.keys(whereAreaPrograma).length ? { where: whereAreaPrograma } : {}),
        },
      ],
      ...(Object.keys(wherePrograma).length ? { where: wherePrograma } : {}),
    };

    const { count, rows } = await Group.findAndCountAll({
      where: whereGrupo,
      include: [
        includeFormativeProgram,
        { model: Environment, as: 'ambiente', attributes: ['id_ambiente', 'nombre_ambiente'] },
        {
          model: Instructor,
          as: 'instructor_lider',
          attributes: ['id_instructor', 'codigo_instructor'],
          include: [
            {
              model: User,
              as: 'usuario',
              attributes: ['id_usuario'],
              include: [{ model: Person, as: 'persona', attributes: ['nombres', 'apellidos'] }],
            },
          ],
        },
      ],
      order: [['numero_ficha', 'ASC']],
      limit: take,
      offset,
      distinct: true,
    });

    return { total: count, pagina: Number(page) || 1, grupos: rows };
  }

  static async getGroupById(id, requester) {
    const group = await Group.findByPk(id, { include: this._includeRelations });
    if (!group) throw { status: 404, message: 'Grupo formativo no encontrado' };

    if (['coordinador', 'instructor'].includes(this._role(requester))) {
      await this._assertRequesterCanAccessGroup(requester, id);
    }

    return group;
  }

  static async verifyFichaNumber(numero_ficha) {
    const existingFicha = await Group.findOne({
      where: { numero_ficha },
      attributes: ['id_grupo', 'numero_ficha'],
    });

    return { disponible: !existingFicha };
  }

  static async createGroup(data, requester) {
    const { numero_ficha, id_programa, jornada, trimestres, fecha_inicio, id_ambiente, id_instructor_lider } = data;

    await this._assertCoordinatorCanManageProgram(requester, id_programa);
    await this._findProgramOrFail(id_programa);

    const existingFicha = await Group.findOne({ where: { numero_ficha } });
    if (existingFicha) throw { status: 409, message: 'El numero de ficha ya esta registrado' };

    if (!id_ambiente) {
      throw { status: 400, message: 'El ambiente es obligatorio para crear un grupo formativo' };
    }
    await this._findEnvironmentOrFail(id_ambiente);

    if (id_instructor_lider) {
      await this._findActiveInstructorOrFail(id_instructor_lider);
    }

    const fecha_fin = this._calculateEndDate(fecha_inicio, trimestres);

    const transaction = await sequelize.transaction();

    try {
      const newGroup = await Group.create({
        numero_ficha,
        id_programa,
        jornada,
        trimestres,
        fecha_inicio,
        fecha_fin,
        id_ambiente,
        id_instructor_lider: id_instructor_lider || null,
        estado: 'EN_FORMACION',
      }, { transaction });

      await this._createInitialTrimesters(
        newGroup.id_grupo,
        fecha_inicio,
        trimestres,
        transaction
      );

      if (id_instructor_lider) {
        await this._ensureInstructorGroupAssignment(
          id_instructor_lider,
          newGroup.id_grupo,
          requester.id_usuario,
          transaction
        );
      }

      await transaction.commit();

      return Group.findByPk(newGroup.id_grupo, { include: this._includeRelations });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async updateGroup(id, data, requester) {
    const { numero_ficha, id_programa, jornada, trimestres, fecha_inicio, id_ambiente } = data;

    const group = await this._findGroupOrFail(id);
    await this._assertCoordinatorCanManageGroup(requester, id, 'No tienes permisos para actualizar este grupo');

    await this._syncGroupStateByDates(group);

    if (group.estado === 'FINALIZADO') {
      throw { status: 409, message: 'No se pueden actualizar datos basicos de un grupo finalizado' };
    }

    if (id_programa !== undefined) {
      await this._assertCoordinatorCanManageProgram(
        requester,
        id_programa,
        'No tienes permisos para actualizar este grupo con el programa seleccionado'
      );
      await this._findProgramOrFail(id_programa);
    }

    if (numero_ficha !== undefined && numero_ficha !== group.numero_ficha) {
      const existingFicha = await Group.findOne({ where: { numero_ficha } });
      if (existingFicha) throw { status: 409, message: 'El numero de ficha ya esta registrado' };
    }

    if (id_ambiente !== undefined && id_ambiente !== null) {
      await this._findEnvironmentOrFail(id_ambiente);
    }

    const finalStartDate = fecha_inicio !== undefined ? fecha_inicio : group.fecha_inicio;
    const finalTrimesters = trimestres !== undefined ? trimestres : group.trimestres;
    const updatedEndDate =
      fecha_inicio !== undefined || trimestres !== undefined
        ? this._calculateEndDate(finalStartDate, finalTrimesters)
        : group.fecha_fin;

    await group.update({
      ...(numero_ficha !== undefined && { numero_ficha }),
      ...(id_programa !== undefined && { id_programa }),
      ...(jornada !== undefined && { jornada }),
      ...(trimestres !== undefined && { trimestres }),
      ...(fecha_inicio !== undefined && { fecha_inicio }),
      fecha_fin: updatedEndDate,
      ...(id_ambiente !== undefined && { id_ambiente }),
    });

    return Group.findByPk(id, { include: this._includeRelations });
  }

  static async changeGroupStatus(id, estado, requester) {
    if (!estado || !this.GROUP_STATES.includes(estado)) {
      throw { status: 400, message: 'El estado es obligatorio y debe ser EN_FORMACION, PRACTICAS o FINALIZADO' };
    }

    const group = await this._findGroupOrFail(id);
    await this._assertCoordinatorCanManageGroup(requester, id, 'No tienes permisos para actualizar este grupo');

    await this._syncGroupStateByDates(group);

    if (group.estado === 'FINALIZADO' && estado !== 'FINALIZADO') {
      throw { status: 409, message: 'Un grupo finalizado no puede reabrirse' };
    }

    await group.update({ estado });
    return group;
  }

  static async assignInstructorLeader(id, id_instructor, requester) {
    await this._assertCoordinatorCanManageGroup(requester, id, 'No tienes permisos para asignar lider a este grupo');

    const group = await this._findGroupOrFail(id);
    await this._findActiveInstructorOrFail(id_instructor);

    await this._syncGroupStateByDates(group);

    if (group.estado === 'FINALIZADO') {
      throw { status: 409, message: 'No se puede cambiar el instructor lider de un grupo finalizado' };
    }

    const transaction = await sequelize.transaction();

    try {
      if (group.id_instructor_lider && Number(group.id_instructor_lider) !== Number(id_instructor)) {
        await InstructorGroup.update(
          { estado: 'INACTIVO', fecha_fin: new Date() },
          {
            where: {
              id_instructor: group.id_instructor_lider,
              id_grupo: id,
              estado: 'ACTIVO',
            },
            transaction,
          }
        );
      }

      await group.update({ id_instructor_lider: id_instructor }, { transaction });
      await this._ensureInstructorGroupAssignment(id_instructor, id, requester.id_usuario, transaction);

      await transaction.commit();

      return Group.findByPk(id, { include: this._includeRelations });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getAvailableInstructors() {
    return Instructor.findAll({
      where: { estado: 'ACTIVO' },
      attributes: ['id_instructor', 'codigo_instructor', 'especialidad'],
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id_usuario', 'email'],
          include: [{ model: Person, as: 'persona', attributes: ['nombres', 'apellidos'] }],
        },
      ],
      order: [['id_instructor', 'ASC']],
    });
  }
}

module.exports = GroupService;
