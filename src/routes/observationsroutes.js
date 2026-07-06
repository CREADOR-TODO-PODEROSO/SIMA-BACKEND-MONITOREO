const express = require('express');
const { body, param, query } = require('express-validator');

const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  createObservation,
  getObservationById,
  getMyObservations,
  getObservationsByApprentice,
  getObservationsByGroup,
  updateObservation,
  updateObservationStatus,
  deleteObservation,
} = require('../controller/observationscontroller');

const observationTypes = ['ACADEMICA', 'CONVIVENCIAL'];
const observationSeverities = ['LEVE', 'MODERADA', 'GRAVE'];
const observationStates = ['ABIERTA', 'CERRADA'];

const idParamValidation = (name) => param(name).isInt({ min: 1 }).withMessage(`${name} debe ser un entero positivo`);

const queryFiltersValidations = [
  query('page').optional().isInt({ min: 1 }).withMessage('page debe ser un entero positivo'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit debe ser un entero positivo'),
  query('id_aprendiz').optional().isInt({ min: 1 }).withMessage('id_aprendiz debe ser un entero positivo'),
  query('id_grupo').optional().isInt({ min: 1 }).withMessage('id_grupo debe ser un entero positivo'),
  query('tipo_observacion').optional().isIn(observationTypes).withMessage('tipo_observacion invalido'),
  query('severidad').optional().isIn(observationSeverities).withMessage('severidad invalida'),
  query('estado').optional().isIn(observationStates).withMessage('estado invalido'),
  query('fecha_desde').optional().isISO8601().withMessage('fecha_desde debe ser una fecha valida'),
  query('fecha_hasta').optional().isISO8601().withMessage('fecha_hasta debe ser una fecha valida'),
];

const createObservationValidations = [
  body('id_aprendiz').isInt({ min: 1 }).withMessage('id_aprendiz es obligatorio y debe ser un entero positivo'),
  body('id_grupo').isInt({ min: 1 }).withMessage('id_grupo es obligatorio y debe ser un entero positivo'),
  body('tipo_observacion').isIn(observationTypes).withMessage('tipo_observacion debe ser ACADEMICA o CONVIVENCIAL'),
  body('severidad').isIn(observationSeverities).withMessage('severidad debe ser LEVE, MODERADA o GRAVE'),
  body('descripcion')
    .trim()
    .isLength({ min: 20 })
    .withMessage('descripcion debe tener al menos 20 caracteres'),
  body('notificar_lider').optional().isBoolean().withMessage('notificar_lider debe ser booleano'),
];

const updateObservationValidations = [
  body('tipo_observacion').optional().isIn(observationTypes).withMessage('tipo_observacion debe ser ACADEMICA o CONVIVENCIAL'),
  body('severidad').optional().isIn(observationSeverities).withMessage('severidad debe ser LEVE, MODERADA o GRAVE'),
  body('descripcion')
    .optional()
    .trim()
    .isLength({ min: 20 })
    .withMessage('descripcion debe tener al menos 20 caracteres'),
];

const updateObservationStatusValidations = [
  body('estado').isIn(observationStates).withMessage('estado debe ser ABIERTA o CERRADA'),
];

router.post(
  '/',
  authMiddleware,
  requireRole('instructor'),
  createObservationValidations,
  validateRequest,
  createObservation
);

router.get(
  '/group/:idGrupo',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  idParamValidation('idGrupo'),
  queryFiltersValidations,
  validateRequest,
  getObservationsByGroup
);

router.get(
  '/apprentice/:idAprendiz',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  idParamValidation('idAprendiz'),
  queryFiltersValidations,
  validateRequest,
  getObservationsByApprentice
);

router.get(
  '/my',
  authMiddleware,
  requireRole('aprendiz'),
  queryFiltersValidations,
  validateRequest,
  getMyObservations
);

router.get(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  idParamValidation('id'),
  validateRequest,
  getObservationById
);

router.patch(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'instructor'),
  idParamValidation('id'),
  updateObservationValidations,
  validateRequest,
  updateObservation
);

router.patch(
  '/:id/status',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  idParamValidation('id'),
  updateObservationStatusValidations,
  validateRequest,
  updateObservationStatus
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  idParamValidation('id'),
  validateRequest,
  deleteObservation
);

module.exports = router;
