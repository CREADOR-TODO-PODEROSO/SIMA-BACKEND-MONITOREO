const { Op, fn, col } = require('sequelize');
const {
  sequelize,
  CoordinatorArea,
  EducationalArea,
  FormativeProgram,
  Group,
  ApprenticeGroup,
  InstructorGroup,
  Apprentice,
  User,
  Role,
  Instructor,
  Environment,
  IoTDevice,
  IoTAttendanceAttempt,
  BiometricFingerprint,
  AttendanceJustification,
  Alert,
  Observation,
  ValidAbsencesView,
} = require('../models');
const { successResponse, errorResponse } = require('../helpers/response');

const getAssignedAreaIds = async (id_usuario) => {
  const assignments = await CoordinatorArea.findAll({
    where: {
      id_usuario,
      estado: 'ACTIVO',
    },
    attributes: ['id_area'],
  });

  return assignments.map((item) => item.id_area);
};

// Include reutilizable para filtrar grupos por áreas del coordinador
const includeFormativeProgramByAreas = (areaIds, extraAttrs = []) => ({
  model: FormativeProgram,
  as: 'programa_formacion',
  attributes: ['id_programa', 'nombre_programa', ...extraAttrs],
  required: true,
  include: [
    {
      model: EducationalArea,
      as: 'area',
      attributes: ['id_area', 'nombre_area'],
    },
  ],
  where: {
    id_area: { [Op.in]: areaIds },
  },
});

const getCoordinatorSummary = async (req, res) => {
  try {
    const id_usuario = req.user.id_usuario;

    const areaIds = await getAssignedAreaIds(id_usuario);

    if (!areaIds.length) {
      return successResponse(res, 'Resumen obtenido correctamente', {
        kpis: {
          total_areas: 0,
          total_programas: 0,
          total_grupos_activos: 0,
          total_aprendices_activos: 0,
          total_alertas_activas: 0,
          total_observaciones_abiertas: 0,
          total_inasistencias_validas: 0,
        },
        areas: [],
        programas: [],
      });
    }

    const totalAreas = areaIds.length;

    // Programas únicos con grupos activos en las áreas del coordinador
    const totalProgramsResult = await Group.count({
      distinct: true,
      col: 'id_programa',
      where: { estado: 'EN_FORMACION' },
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

    const totalActiveGroups = await Group.count({
      where: { estado: 'EN_FORMACION' },
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

    const activeGroups = await Group.findAll({
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

    const groupIds = activeGroups.map((g) => g.id_grupo);

    let totalActiveApprentices = 0;
    let totalActiveAlerts = 0;
    let totalOpenObservations = 0;
    let totalValidAbsences = 0;

    if (groupIds.length) {
      totalActiveApprentices = await ApprenticeGroup.count({
        where: {
          id_grupo: { [Op.in]: groupIds },
          estado: 'ACTIVO',
        },
        distinct: true,
        col: 'id_aprendiz',
      });

      totalActiveAlerts = await Alert.count({
        include: [
          {
            model: Apprentice,
            as: 'aprendiz',
            required: true,
            include: [
              {
                model: ApprenticeGroup,
                as: 'aprendiz_grupos',
                required: true,
                where: {
                  id_grupo: { [Op.in]: groupIds },
                  estado: 'ACTIVO',
                },
                attributes: [],
              },
            ],
            attributes: [],
          },
        ],
        where: {
          estado: 'ABIERTA',
        },
      });

      totalOpenObservations = await Observation.count({
        include: [
          {
            model: Apprentice,
            as: 'aprendiz',
            required: true,
            include: [
              {
                model: ApprenticeGroup,
                as: 'aprendiz_grupos',
                required: true,
                where: {
                  id_grupo: { [Op.in]: groupIds },
                  estado: 'ACTIVO',
                },
                attributes: [],
              },
            ],
            attributes: [],
          },
        ],
        where: {
          estado: 'ABIERTA',
        },
      });

      totalValidAbsences = await ValidAbsencesView.count({
        where: {
          id_grupo: { [Op.in]: groupIds },
        },
      });
    }

    // Resumen por área: contar grupos agrupados por área (vía programa)
    const areasSummary = await Group.findAll({
      attributes: [
        [fn('COUNT', col('Group.id_grupo')), 'total_grupos'],
      ],
      include: [
        {
          model: FormativeProgram,
          as: 'programa_formacion',
          attributes: [],
          required: true,
          where: {
            id_area: { [Op.in]: areaIds },
          },
          include: [
            {
              model: EducationalArea,
              as: 'area',
              attributes: ['id_area', 'nombre_area'],
            },
          ],
        },
      ],
      group: [
        'programa_formacion.area.id_area',
        'programa_formacion.area.nombre_area',
      ],
      raw: true,
      nest: true,
    });

    // Reformatear para mantener la estructura de respuesta actual
    const areasFormatted = areasSummary.map((row) => ({
      id_area: row.programa_formacion.area.id_area,
      nombre_area: row.programa_formacion.area.nombre_area,
      total_grupos: row.total_grupos,
    }));

    // Resumen por programa: contar grupos agrupados por programa
    const programsSummary = await Group.findAll({
      attributes: [
        [fn('COUNT', col('Group.id_grupo')), 'total_grupos'],
      ],
      include: [
        {
          model: FormativeProgram,
          as: 'programa_formacion',
          attributes: ['id_programa', 'nombre_programa'],
          required: true,
          where: {
            id_area: { [Op.in]: areaIds },
          },
          include: [
            {
              model: EducationalArea,
              as: 'area',
              attributes: ['id_area', 'nombre_area'],
            },
          ],
        },
      ],
      group: [
        'programa_formacion.id_programa',
        'programa_formacion.nombre_programa',
        'programa_formacion.area.id_area',
        'programa_formacion.area.nombre_area',
      ],
      order: [[{ model: FormativeProgram, as: 'programa_formacion' }, 'nombre_programa', 'ASC']],
      raw: true,
      nest: true,
    });

    const programsFormatted = programsSummary.map((row) => ({
      id_programa: row.programa_formacion.id_programa,
      nombre_programa: row.programa_formacion.nombre_programa,
      id_area: row.programa_formacion.area.id_area,
      nombre_area: row.programa_formacion.area.nombre_area,
      total_grupos: row.total_grupos,
    }));

    return successResponse(res, 'Resumen del coordinador obtenido correctamente', {
      kpis: {
        total_areas: totalAreas,
        total_programas: totalProgramsResult,
        total_grupos_activos: totalActiveGroups,
        total_aprendices_activos: totalActiveApprentices,
        total_alertas_activas: totalActiveAlerts,
        total_observaciones_abiertas: totalOpenObservations,
        total_inasistencias_validas: totalValidAbsences,
      },
      areas: areasFormatted,
      programas: programsFormatted,
    });
  } catch (error) {
    return errorResponse(res, 'Error al obtener resumen del coordinador', 500, error.message);
  }
};

const getAreaDetail = async (req, res) => {
  try {
    const id_usuario = req.user.id_usuario;
    const { idArea } = req.params;

    const assignment = await CoordinatorArea.findOne({
      where: {
        id_usuario,
        id_area: idArea,
        estado: 'ACTIVO',
      },
    });

    if (!assignment) {
      return errorResponse(res, 'No tienes esta área asignada', 403);
    }

    const area = await EducationalArea.findByPk(idArea, {
      attributes: ['id_area', 'nombre_area'],
    });

    const groups = await Group.findAll({
      include: [
        {
          model: FormativeProgram,
          as: 'programa_formacion',
          attributes: ['id_programa', 'nombre_programa'],
          required: true,
          where: {
            id_area: idArea,
          },
        },
      ],
      attributes: [
        'id_grupo',
        'numero_ficha',
        'jornada',
        'fecha_inicio',
        'fecha_fin',
        'estado',
      ],
      order: [
        [{ model: FormativeProgram, as: 'programa_formacion' }, 'nombre_programa', 'ASC'],
        ['numero_ficha', 'ASC'],
      ],
    });

    return successResponse(res, 'Detalle del área obtenido correctamente', {
      area,
      grupos: groups,
    });
  } catch (error) {
    return errorResponse(res, 'Error al obtener detalle del área', 500, error.message);
  }
};

const getSuperAdminSummary = async (_req, res) => {
  try {
    const safeCount = async (counter) => {
      try {
        return await counter();
      } catch (error) {
        if (String(error?.message || '').includes("doesn't exist")) return 0;
        if (String(error?.original?.code || '') === 'ER_NO_SUCH_TABLE') return 0;
        throw error;
      }
    };

    const [
      totalUsers,
      activeUsers,
      totalSuperAdmins,
      totalCoordinators,
      totalInstructors,
      totalApprentices,
      totalAreas,
      totalPrograms,
      totalGroups,
      activeGroups,
      totalEnvironments,
      activeEnvironments,
      activeAlerts,
      openObservations,
      validAbsences,
      activeDevices,
      maintenanceDevices,
      activeFingerprints,
      revokedFingerprints,
      pendingJustifications,
      iotAttemptsToday,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { estado: 'ACTIVO' } }),
      User.count({ include: [{ model: Role, as: 'rol', required: true, where: { nombre: 'SUPER_ADMIN' } }] }),
      User.count({ include: [{ model: Role, as: 'rol', required: true, where: { nombre: 'coordinador' } }] }),
      Instructor.count({ where: { estado: 'ACTIVO' } }),
      Apprentice.count({ where: { estado: 'ACTIVO' } }),
      EducationalArea.count(),
      FormativeProgram.count(),
      Group.count(),
      Group.count({ where: { estado: 'EN_FORMACION' } }),
      Environment.count(),
      Environment.count({ where: { estado: 'ACTIVO' } }),
      Alert.count({ where: { estado: 'ABIERTA' } }),
      Observation.count({ where: { estado: 'ABIERTA' } }),
      ValidAbsencesView.count(),
      IoTDevice.count({ where: { estado: 'ACTIVO' } }),
      IoTDevice.count({ where: { estado: 'MANTENIMIENTO' } }),
      BiometricFingerprint.count({ where: { estado: 'ACTIVA' } }),
      BiometricFingerprint.count({ where: { estado: 'REVOCADA' } }),
      AttendanceJustification.count({ where: { estado: 'PENDIENTE' } }),
      safeCount(() => IoTAttendanceAttempt.count({
        where: {
          fecha_origen: {
            [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      })),
    ]);

    const groupsByState = await Group.findAll({
      attributes: ['estado', [fn('COUNT', col('id_grupo')), 'total']],
      group: ['estado'],
      raw: true,
    });

    const devicesByState = await IoTDevice.findAll({
      attributes: ['estado', [fn('COUNT', col('id_dispositivo')), 'total']],
      group: ['estado'],
      raw: true,
    });

    return successResponse(res, 'Resumen del superadministrador obtenido correctamente', {
      kpis: {
        total_usuarios: totalUsers,
        usuarios_activos: activeUsers,
        total_super_admins: totalSuperAdmins,
        total_coordinadores: totalCoordinators,
        total_instructores_activos: totalInstructors,
        total_aprendices_activos: totalApprentices,
        total_areas: totalAreas,
        total_programas: totalPrograms,
        total_grupos: totalGroups,
        total_grupos_activos: activeGroups,
        total_ambientes: totalEnvironments,
        ambientes_activos: activeEnvironments,
        total_alertas_activas: activeAlerts,
        total_observaciones_abiertas: openObservations,
        total_inasistencias_validas: validAbsences,
        dispositivos_activos: activeDevices,
        dispositivos_mantenimiento: maintenanceDevices,
        huellas_activas: activeFingerprints,
        huellas_revocadas: revokedFingerprints,
        justificaciones_pendientes: pendingJustifications,
        intentos_iot_hoy: iotAttemptsToday,
      },
      grupos_por_estado: groupsByState,
      dispositivos_por_estado: devicesByState,
    });
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener resumen del superadministrador', 500);
  }
};

const getInstructorSummary = async (req, res) => {
  try {
    const idInstructor = req.user.id_instructor;

    if (!idInstructor) {
      return errorResponse(res, 'El usuario no tiene perfil activo de instructor', 403);
    }

    const ledGroups = await Group.findAll({
      where: { id_instructor_lider: idInstructor },
      attributes: ['id_grupo', 'numero_ficha', 'jornada', 'estado', 'fecha_inicio', 'fecha_fin'],
      include: [
        {
          model: FormativeProgram,
          as: 'programa_formacion',
          attributes: ['id_programa', 'nombre_programa'],
          include: [{ model: EducationalArea, as: 'area', attributes: ['id_area', 'nombre_area'] }],
        },
      ],
      order: [['numero_ficha', 'ASC']],
    });

    const assignedLinks = await InstructorGroup.findAll({
      where: { id_instructor: idInstructor, estado: 'ACTIVO' },
      attributes: ['id_grupo'],
    });

    const assignedGroupIds = assignedLinks.map((item) => Number(item.id_grupo));
    const ledGroupIds = ledGroups.map((item) => Number(item.id_grupo));
    const allGroupIds = [...new Set([...ledGroupIds, ...assignedGroupIds])];

    const assignedGroups = assignedGroupIds.length
      ? await Group.findAll({
          where: { id_grupo: { [Op.in]: assignedGroupIds } },
          attributes: ['id_grupo', 'numero_ficha', 'jornada', 'estado', 'fecha_inicio', 'fecha_fin', 'id_instructor_lider'],
          include: [
            {
              model: FormativeProgram,
              as: 'programa_formacion',
              attributes: ['id_programa', 'nombre_programa'],
              include: [{ model: EducationalArea, as: 'area', attributes: ['id_area', 'nombre_area'] }],
            },
          ],
          order: [['numero_ficha', 'ASC']],
        })
      : [];

    const totalApprentices = allGroupIds.length
      ? await ApprenticeGroup.count({
          where: { id_grupo: { [Op.in]: allGroupIds }, estado: 'ACTIVO' },
          distinct: true,
          col: 'id_aprendiz',
        })
      : 0;

    const totalAlerts = allGroupIds.length
      ? await Alert.count({ where: { id_grupo: { [Op.in]: allGroupIds }, estado: 'ABIERTA' } })
      : 0;

    const totalOpenObservations = allGroupIds.length
      ? await Observation.count({ where: { id_grupo: { [Op.in]: allGroupIds }, estado: 'ABIERTA' } })
      : 0;

    return successResponse(res, 'Resumen del instructor obtenido correctamente', {
      kpis: {
        total_grupos_liderados: ledGroupIds.length,
        total_grupos_asignados: assignedGroupIds.length,
        total_grupos_visibles: allGroupIds.length,
        total_aprendices_activos: totalApprentices,
        total_alertas_activas: totalAlerts,
        total_observaciones_abiertas: totalOpenObservations,
      },
      grupos_liderados: ledGroups,
      grupos_asignados: assignedGroups,
    });
  } catch (error) {
    return errorResponse(res, 'Error al obtener resumen del instructor', 500, error.message);
  }
};

module.exports = {
  getSuperAdminSummary,
  getCoordinatorSummary,
  getAreaDetail,
  getInstructorSummary,
};
