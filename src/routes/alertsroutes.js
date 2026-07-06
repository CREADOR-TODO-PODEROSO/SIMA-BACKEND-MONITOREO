const express = require('express');
const { body, param, query } = require('express-validator');

const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  createAlertFromObservationsController,
  createManualAlertController,
  reevaluateAttendanceAlertController,
  reevaluateObservationAlertController,
  getAlerts,
  getAlertById,
  getAlertObservationsController,
  updateAlertStatus,
  deleteAlert,
} = require('../controller/alertscontroller');

const alertTypes = ['ASISTENCIAL', 'OBSERVACIONES_RECURRENTES', 'CONVIVENCIAL'];
const alertSeverities = ['LEVE', 'MODERADA', 'GRAVE', 'CRITICA'];
const alertStates = ['ABIERTA', 'CERRADA'];

const idParamValidation = (name) => param(name).isInt({ min: 1 }).withMessage(`${name} debe ser un entero positivo`);

const queryFilterValidations = [
  query('q').optional().trim().isLength({ min: 1 }).withMessage('q no puede estar vacio'),
  query('page').optional().isInt({ min: 1 }).withMessage('page debe ser un entero positivo'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit debe estar entre 1 y 50'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset debe ser un entero mayor o igual a cero'),
  query('estado').optional().isIn(alertStates).withMessage('estado invalido'),
  query('severidad').optional().isIn(alertSeverities).withMessage('severidad invalida'),
  query('tipo_alerta').optional().isIn(alertTypes).withMessage('tipo_alerta invalido'),
  query('id_aprendiz').optional().isInt({ min: 1 }).withMessage('id_aprendiz debe ser un entero positivo'),
  query('id_grupo').optional().isInt({ min: 1 }).withMessage('id_grupo debe ser un entero positivo'),
  query('fecha_desde').optional().isISO8601().withMessage('fecha_desde debe ser una fecha valida'),
  query('fecha_hasta').optional().isISO8601().withMessage('fecha_hasta debe ser una fecha valida'),
];

const createAlertFromObservationsValidations = [
  body('id_aprendiz').isInt({ min: 1 }).withMessage('id_aprendiz es obligatorio y debe ser entero positivo'),
  body('id_grupo').isInt({ min: 1 }).withMessage('id_grupo es obligatorio y debe ser entero positivo'),
  body('severidad').isIn(alertSeverities).withMessage('severidad debe ser LEVE, MODERADA, GRAVE o CRITICA'),
  body('tipo_alerta').optional().isIn(alertTypes).withMessage('tipo_alerta invalido'),
  body('descripcion').trim().isLength({ min: 20, max: 2000 }).withMessage('descripcion debe tener entre 20 y 2000 caracteres'),
  body('observationIds').isArray({ min: 1 }).withMessage('Debe asociar al menos una observacion'),
  body('observationIds.*').isInt({ min: 1 }).withMessage('Cada observacion debe ser un entero positivo'),
];

const createManualAlertValidations = [
  body('id_aprendiz').isInt({ min: 1 }).withMessage('id_aprendiz es obligatorio y debe ser entero positivo'),
  body('id_grupo').isInt({ min: 1 }).withMessage('id_grupo es obligatorio y debe ser entero positivo'),
  body('tipo_alerta').optional().isIn(alertTypes).withMessage('tipo_alerta invalido'),
  body('severidad').isIn(alertSeverities).withMessage('severidad debe ser LEVE, MODERADA, GRAVE o CRITICA'),
  body('descripcion').trim().isLength({ min: 20, max: 2000 }).withMessage('descripcion debe tener entre 20 y 2000 caracteres'),
];

const updateStatusValidations = [
  body('estado').isIn(alertStates).withMessage('estado debe ser ABIERTA o CERRADA'),
  body('justificacion_cierre')
    .if(body('estado').equals('CERRADA'))
    .trim()
    .notEmpty()
    .withMessage('justificacion_cierre es obligatoria al cerrar una alerta')
    .isLength({ min: 20, max: 2000 })
    .withMessage('justificacion_cierre debe tener entre 20 y 2000 caracteres'),
  body('justificacion_reapertura')
    .if(body('estado').equals('ABIERTA'))
    .trim()
    .notEmpty()
    .withMessage('justificacion_reapertura es obligatoria al reabrir una alerta')
    .isLength({ min: 20, max: 2000 })
    .withMessage('justificacion_reapertura debe tener entre 20 y 2000 caracteres'),
];

router.get(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  queryFilterValidations,
  validateRequest,
  getAlerts
);

router.post(
  '/from-observations',
  authMiddleware,
  requireRole('instructor'),
  createAlertFromObservationsValidations,
  validateRequest,
  createAlertFromObservationsController
);

router.post(
  '/manual',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'instructor', 'coordinador'),
  createManualAlertValidations,
  validateRequest,
  createManualAlertController
);

router.get(
  '/:id/observations',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  idParamValidation('id'),
  validateRequest,
  getAlertObservationsController
);

router.get(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  idParamValidation('id'),
  validateRequest,
  getAlertById
);

router.patch(
  '/:id/status',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador'),
  idParamValidation('id'),
  updateStatusValidations,
  validateRequest,
  updateAlertStatus
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN'),
  idParamValidation('id'),
  validateRequest,
  deleteAlert
);

router.post(
  '/reevaluate/attendance/:idAprendiz',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  idParamValidation('idAprendiz'),
  validateRequest,
  reevaluateAttendanceAlertController
);

router.post(
  '/reevaluate/observations/:idAprendiz',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  idParamValidation('idAprendiz'),
  validateRequest,
  reevaluateObservationAlertController
);

module.exports = router;
