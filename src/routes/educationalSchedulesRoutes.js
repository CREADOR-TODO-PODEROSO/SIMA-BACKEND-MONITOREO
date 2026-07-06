const express = require('express');
const { body, param, query } = require('express-validator');

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  getCatalogs,
  createSchedule,
  getSchedulesByGroup,
  getMySchedules,
  getScheduleById,
  updateSchedule,
  deactivateSchedule,
} = require('../controller/educationalSchedulesController');

const router = express.Router();

const idParamValidation = param('id').isInt({ min: 1 }).withMessage('id debe ser un entero positivo');
const idGroupParamValidation = param('idGrupo').isInt({ min: 1 }).withMessage('idGrupo debe ser un entero positivo');

const timeValidation = (field) => body(field)
  .optional()
  .matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  .withMessage(`${field} debe tener formato HH:mm o HH:mm:ss`);

const scheduleBodyValidations = [
  body('id_grupo_trimestre').isInt({ min: 1 }).withMessage('id_grupo_trimestre es obligatorio'),
  body('id_clase_competencia').isInt({ min: 1 }).withMessage('id_clase_competencia es obligatorio'),
  body('id_instructor_grupo').isInt({ min: 1 }).withMessage('id_instructor_grupo es obligatorio'),
  body('id_bloque_jornada').isInt({ min: 1 }).withMessage('id_bloque_jornada es obligatorio'),
  body('dia_semana').isInt({ min: 1, max: 7 }).withMessage('dia_semana debe estar entre 1 y 7'),
  timeValidation('hora_inicio'),
  timeValidation('hora_fin'),
  body('tolerancia_minutos').optional().isInt({ min: 0 }).withMessage('tolerancia_minutos debe ser entero mayor o igual a cero'),
];

const updateScheduleValidations = [
  body('id_grupo_trimestre').optional().isInt({ min: 1 }).withMessage('id_grupo_trimestre debe ser entero positivo'),
  body('id_clase_competencia').optional().isInt({ min: 1 }).withMessage('id_clase_competencia debe ser entero positivo'),
  body('id_instructor_grupo').optional().isInt({ min: 1 }).withMessage('id_instructor_grupo debe ser entero positivo'),
  body('id_bloque_jornada').optional().isInt({ min: 1 }).withMessage('id_bloque_jornada debe ser entero positivo'),
  body('dia_semana').optional().isInt({ min: 1, max: 7 }).withMessage('dia_semana debe estar entre 1 y 7'),
  timeValidation('hora_inicio'),
  timeValidation('hora_fin'),
  body('tolerancia_minutos').optional().isInt({ min: 0 }).withMessage('tolerancia_minutos debe ser entero mayor o igual a cero'),
  body('estado').not().exists().withMessage('El estado no se actualiza directamente; use el endpoint de desactivacion'),
];

const listQueryValidations = [
  query('estado').optional().isIn(['ACTIVO', 'INACTIVO']).withMessage('estado invalido'),
  query('id_grupo_trimestre').optional().isInt({ min: 1 }).withMessage('id_grupo_trimestre debe ser entero positivo'),
  query('dia_semana').optional().isInt({ min: 1, max: 7 }).withMessage('dia_semana debe estar entre 1 y 7'),
];

router.get(
  '/catalogs',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  query('id_grupo').isInt({ min: 1 }).withMessage('id_grupo es obligatorio'),
  validateRequest,
  getCatalogs
);

router.post(
  '/',
  authMiddleware,
  requireRole('instructor'),
  scheduleBodyValidations,
  validateRequest,
  createSchedule
);

router.get(
  '/group/:idGrupo',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  idGroupParamValidation,
  listQueryValidations,
  validateRequest,
  getSchedulesByGroup
);

router.get(
  '/my',
  authMiddleware,
  requireRole('instructor'),
  query('estado').optional().isIn(['ACTIVO', 'INACTIVO']).withMessage('estado invalido'),
  validateRequest,
  getMySchedules
);

router.get(
  '/:id',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  idParamValidation,
  validateRequest,
  getScheduleById
);

router.put(
  '/:id',
  authMiddleware,
  requireRole('instructor'),
  idParamValidation,
  updateScheduleValidations,
  validateRequest,
  updateSchedule
);

router.patch(
  '/:id/deactivate',
  authMiddleware,
  requireRole('instructor'),
  idParamValidation,
  body('motivo').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 255 }).withMessage('motivo no puede superar 255 caracteres'),
  validateRequest,
  deactivateSchedule
);

module.exports = router;
