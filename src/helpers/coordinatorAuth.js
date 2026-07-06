const { Op } = require('sequelize');
const {
  CoordinatorArea,
  FormativeProgram,
  Group,
  Instructor,
  InstructorGroup,
} = require('../models');

const getCoordinatorAreaIds = async (id_usuario) => {
  const areasAsignadas = await CoordinatorArea.findAll({
    where: { id_usuario, estado: 'ACTIVO' },
    attributes: ['id_area'],
  });

  return areasAsignadas.map((item) => Number(item.id_area));
};

const checkCoordinatorProgramAccess = async (id_usuario, id_programa) => {
  try {
    const areaIds = await getCoordinatorAreaIds(id_usuario);

    if (areaIds.length === 0) return false;

    const program = await FormativeProgram.findByPk(id_programa, {
      attributes: ['id_area'],
    });

    if (!program) return false;

    return areaIds.includes(program.id_area);
  } catch (error) {
    console.error('Error en checkCoordinatorProgramAccess:', error);
    return false;
  }
};

const getCoordinatorAccessibleGroupIds = async (id_usuario) => {
  try {
    const areaIds = await getCoordinatorAreaIds(id_usuario);

    if (areaIds.length === 0) return [];

    const groups = await Group.findAll({
      attributes: ['id_grupo'],
      include: [
        {
          model: FormativeProgram,
          as: 'programa_formacion',
          attributes: [],
          required: true,
          where: {
            id_area: { [Op.in]: areaIds },
          },
        },
      ],
    });

    return groups.map((group) => group.id_grupo);
  } catch (error) {
    console.error('Error en getCoordinatorAccessibleGroupIds:', error);
    return [];
  }
};

const checkCoordinatorGroupAccess = async (id_usuario, id_grupo) => {
  try {
    const group = await Group.findByPk(id_grupo, {
      attributes: ['id_programa'],
    });

    if (!group) return false;

    return await checkCoordinatorProgramAccess(id_usuario, group.id_programa);
  } catch (error) {
    console.error('Error en checkCoordinatorGroupAccess:', error);
    return false;
  }
};

const getInstructorAccessibleGroupIds = async (id_usuario) => {
  try {
    const instructor = await Instructor.findOne({
      where: { id_usuario, estado: 'ACTIVO' },
      attributes: ['id_instructor'],
    });

    if (!instructor) return [];

    const leaderGroupIds = (await Group.findAll({
      where: { id_instructor_lider: instructor.id_instructor },
      attributes: ['id_grupo'],
    })).map((group) => group.id_grupo);

    const assignedGroupIds = (await InstructorGroup.findAll({
      where: { id_instructor: instructor.id_instructor, estado: 'ACTIVO' },
      attributes: ['id_grupo'],
    })).map((group) => group.id_grupo);

    return [...new Set([...leaderGroupIds, ...assignedGroupIds])];
  } catch (error) {
    console.error('Error en getInstructorAccessibleGroupIds:', error);
    return [];
  }
};

const normalizeRole = (requester) => String(requester?.rol || '').toLowerCase().trim();

const getAllGroupIds = async () => {
  const groups = await Group.findAll({ attributes: ['id_grupo'] });
  return groups.map((group) => Number(group.id_grupo));
};

const checkInstructorGroupAccess = async (id_usuario, id_grupo) => {
  try {
    const groupIds = await getInstructorAccessibleGroupIds(id_usuario);
    return groupIds.includes(Number(id_grupo));
  } catch (error) {
    console.error('Error en checkInstructorGroupAccess:', error);
    return false;
  }
};

const getAccessibleGroupIdsForRequester = async (requester) => {
  if (!requester || !requester.rol) return [];
  const role = normalizeRole(requester);

  if (role === 'super_admin') {
    return getAllGroupIds();
  }

  if (role === 'coordinador') {
    return getCoordinatorAccessibleGroupIds(requester.id_usuario);
  }

  if (role === 'instructor') {
    return getInstructorAccessibleGroupIds(requester.id_usuario);
  }

  return [];
};

const assertRequesterCanAccessGroup = async (
  requester,
  id_grupo,
  message = 'No tienes permisos para acceder a este grupo'
) => {
  if (normalizeRole(requester) === 'super_admin') {
    return true;
  }

  const groupIds = await getAccessibleGroupIdsForRequester(requester);

  if (!groupIds.includes(Number(id_grupo))) {
    throw { status: 403, message };
  }

  return true;
};

const assertRequesterCanRegisterApprenticeInGroup = async (requester, grupo, transaction) => {
  const role = normalizeRole(requester);

  if (role === 'super_admin') {
    return true;
  }

  if (role === 'coordinador') {
    const hasAccess = await checkCoordinatorGroupAccess(requester.id_usuario, grupo.id_grupo);
    if (!hasAccess) {
      throw {
        status: 403,
        message: 'Solo puedes gestionar aprendices de grupos formativos pertenecientes a tus areas asignadas',
      };
    }
    return true;
  }

  if (role !== 'instructor') {
    throw { status: 403, message: 'No tienes permisos para registrar aprendices' };
  }

  let idInstructor = requester.id_instructor;

  if (!idInstructor) {
    const instructor = await Instructor.findOne({
      where: { id_usuario: requester.id_usuario, estado: 'ACTIVO' },
      attributes: ['id_instructor'],
      transaction,
    });

    if (!instructor) {
      throw { status: 403, message: 'No existe perfil activo de instructor' };
    }

    idInstructor = instructor.id_instructor;
  }

  if (Number(grupo.id_instructor_lider) !== Number(idInstructor)) {
    throw {
      status: 403,
      message: 'Solo el coordinador o el instructor lider de la ficha puede registrar aprendices en esta ficha',
    };
  }

  return true;
};

module.exports = {
  getCoordinatorAreaIds,
  checkCoordinatorProgramAccess,
  checkCoordinatorGroupAccess,
  getCoordinatorAccessibleGroupIds,
  getInstructorAccessibleGroupIds,
  checkInstructorGroupAccess,
  getAccessibleGroupIdsForRequester,
  assertRequesterCanAccessGroup,
  assertRequesterCanRegisterApprenticeInGroup,
  normalizeRole,
};
