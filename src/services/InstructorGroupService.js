const {
  Group,
  Instructor,
  InstructorGroup,
  User,
  Person,
  sequelize,
} = require('../models');
const { assertRequesterCanAccessGroup, normalizeRole } = require('../helpers/coordinatorAuth');

class InstructorGroupService {
  static async _findActiveInstructor(id_instructor, transaction) {
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
      transaction,
    });

    if (!instructor) {
      throw { status: 404, message: 'El instructor no existe o no esta activo' };
    }

    return instructor;
  }

  static async _findGroupForLeader(id_grupo, requester) {
    const group = await Group.findByPk(id_grupo);
    if (!group) throw { status: 404, message: 'Grupo formativo no encontrado' };

    const role = normalizeRole(requester);
    const isLeader = role === 'instructor'
      && Number(group.id_instructor_lider) === Number(requester.id_instructor);

    if (role === 'coordinador') {
      await assertRequesterCanAccessGroup(
        requester,
        id_grupo,
        'No tienes permisos para gestionar instructores de apoyo de este grupo'
      );
    } else if (role !== 'super_admin' && !isLeader) {
      throw { status: 403, message: 'Solo el instructor lider puede gestionar instructores de apoyo de este grupo' };
    }

    if (group.estado === 'FINALIZADO') {
      throw { status: 409, message: 'No se pueden gestionar instructores de apoyo en un grupo finalizado' };
    }

    return group;
  }

  static async listByGroup(id_grupo, requester) {
    await this._findGroupForLeader(id_grupo, requester);

    return InstructorGroup.findAll({
      where: { id_grupo },
      include: [
        {
          model: Instructor,
          as: 'instructor',
          attributes: ['id_instructor', 'codigo_instructor', 'especialidad', 'estado'],
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
      order: [['estado', 'ASC'], ['id_instructor_grupo', 'ASC']],
    });
  }

  static async assignSupportInstructor(id_grupo, id_instructor, requester) {
    const transaction = await sequelize.transaction();

    try {
      const group = await this._findGroupForLeader(id_grupo, requester);

      if (Number(group.id_instructor_lider) === Number(id_instructor)) {
        throw { status: 400, message: 'El instructor lider no puede asignarse como instructor de apoyo' };
      }

      await this._findActiveInstructor(id_instructor, transaction);

      const existing = await InstructorGroup.findOne({
        where: { id_instructor, id_grupo },
        transaction,
      });

      let assignment;

      if (existing) {
        assignment = await existing.update({
          estado: 'ACTIVO',
          fecha_fin: null,
          asignado_por: requester.id_usuario,
        }, { transaction });
      } else {
        assignment = await InstructorGroup.create({
          id_instructor,
          id_grupo,
          estado: 'ACTIVO',
          asignado_por: requester.id_usuario,
        }, { transaction });
      }

      await transaction.commit();

      return InstructorGroup.findByPk(assignment.id_instructor_grupo, {
        include: [{ model: Instructor, as: 'instructor', include: [{ model: User, as: 'usuario' }] }],
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async changeAssignmentStatus(id_grupo, id_instructor, estado, requester) {
    if (!['ACTIVO', 'INACTIVO'].includes(estado)) {
      throw { status: 400, message: 'El estado debe ser ACTIVO o INACTIVO' };
    }

    const transaction = await sequelize.transaction();

    try {
      const group = await this._findGroupForLeader(id_grupo, requester);

      if (Number(group.id_instructor_lider) === Number(id_instructor)) {
        throw { status: 400, message: 'La relacion del instructor lider no se gestiona como apoyo' };
      }

      const assignment = await InstructorGroup.findOne({
        where: { id_grupo, id_instructor },
        transaction,
      });

      if (!assignment) {
        throw { status: 404, message: 'El instructor no tiene asignacion registrada en este grupo' };
      }

      await assignment.update({
        estado,
        fecha_fin: estado === 'INACTIVO' ? new Date() : null,
      }, { transaction });

      await transaction.commit();
      return assignment;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = InstructorGroupService;
