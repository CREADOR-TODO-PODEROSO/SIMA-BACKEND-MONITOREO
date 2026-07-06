const express = require('express');
const { query } = require('express-validator');

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  getContext,
  getDashboard,
  getObservatoryAlerts,
  getObservatoryObservations,
  getSchedule,
  getSessions,
} = require('../controller/apprenticePortalController');

const router = express.Router();

const groupContextValidation = [
  query('id_grupo').optional().isInt({ min: 1 }).withMessage('id_grupo debe ser un entero positivo'),
];

const dateRangeValidation = [
  ...groupContextValidation,
  query('fecha_desde').optional().isISO8601().withMessage('fecha_desde debe ser una fecha valida'),
  query('fecha_hasta').optional().isISO8601().withMessage('fecha_hasta debe ser una fecha valida'),
  query('fecha_referencia').optional().isISO8601().withMessage('fecha_referencia debe ser una fecha valida'),
];

const observatoryFiltersValidation = [
  ...groupContextValidation,
  query('fecha_desde').optional().isISO8601().withMessage('fecha_desde debe ser una fecha valida'),
  query('fecha_hasta').optional().isISO8601().withMessage('fecha_hasta debe ser una fecha valida'),
  query('severidad').optional().isIn(['LEVE', 'MODERADA', 'GRAVE', 'CRITICA']).withMessage('severidad invalida'),
  query('tipo').optional().trim().notEmpty().withMessage('tipo no puede estar vacio'),
  query('estado').optional().isIn(['ABIERTA', 'CERRADA']).withMessage('estado invalido'),
];

router.get(
  '/context',
  authMiddleware,
  requireRole('aprendiz'),
  groupContextValidation,
  validateRequest,
  getContext
);

router.get(
  '/dashboard',
  authMiddleware,
  requireRole('aprendiz'),
  groupContextValidation,
  validateRequest,
  getDashboard
);

router.get(
  '/schedule',
  authMiddleware,
  requireRole('aprendiz'),
  dateRangeValidation,
  validateRequest,
  getSchedule
);

router.get(
  '/sessions',
  authMiddleware,
  requireRole('aprendiz'),
  groupContextValidation,
  validateRequest,
  getSessions
);

router.get(
  '/observatory/observations',
  authMiddleware,
  requireRole('aprendiz'),
  observatoryFiltersValidation,
  validateRequest,
  getObservatoryObservations
);

router.get(
  '/observatory/alerts',
  authMiddleware,
  requireRole('aprendiz'),
  observatoryFiltersValidation,
  validateRequest,
  getObservatoryAlerts
);

module.exports = router;
