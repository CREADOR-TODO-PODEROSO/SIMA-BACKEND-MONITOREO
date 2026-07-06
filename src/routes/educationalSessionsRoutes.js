const express = require('express');
const { body, param, query } = require('express-validator');

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  cancelSession,
  closeSession,
  generateQr,
  generateSessions,
  getSessionAttendances,
  listSessions,
  openSession,
} = require('../controller/educationalSessionsController');

const router = express.Router();

const idParamValidation = param('id').isInt({ min: 1 }).withMessage('id debe ser un entero positivo');

const sessionQueryValidations = [
  query('page').optional().isInt({ min: 1 }).withMessage('page debe ser un entero positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit debe estar entre 1 y 100'),
  query('estado').optional().isIn(['PROGRAMADA', 'ABIERTA', 'CERRADA', 'CANCELADA']).withMessage('estado invalido'),
  query('id_grupo').optional().isInt({ min: 1 }).withMessage('id_grupo debe ser entero positivo'),
  query('id_grupo_trimestre').optional().isInt({ min: 1 }).withMessage('id_grupo_trimestre debe ser entero positivo'),
  query('id_instructor').optional().isInt({ min: 1 }).withMessage('id_instructor debe ser entero positivo'),
  query('fecha').optional().isISO8601().withMessage('fecha debe ser una fecha valida'),
  query('fecha_desde').optional().isISO8601().withMessage('fecha_desde debe ser una fecha valida'),
  query('fecha_hasta').optional().isISO8601().withMessage('fecha_hasta debe ser una fecha valida'),
  query('solo_responsable').optional().isIn(['true', 'false']).withMessage('solo_responsable debe ser true o false'),
];

router.get(
  '/',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  sessionQueryValidations,
  validateRequest,
  listSessions
);

router.post(
  '/generate',
  authMiddleware,
  requireRole('instructor'),
  [
    body('id_grupo_trimestre').isInt({ min: 1 }).withMessage('id_grupo_trimestre es obligatorio'),
    body('id_horario').optional().isInt({ min: 1 }).withMessage('id_horario debe ser entero positivo'),
    body('fecha_desde').isISO8601().withMessage('fecha_desde debe ser una fecha valida'),
    body('fecha_hasta').optional().isISO8601().withMessage('fecha_hasta debe ser una fecha valida'),
  ],
  validateRequest,
  generateSessions
);

router.get(
  '/:id/attendances',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  idParamValidation,
  validateRequest,
  getSessionAttendances
);

router.patch(
  '/:id/open',
  authMiddleware,
  requireRole('instructor'),
  idParamValidation,
  validateRequest,
  openSession
);

router.post(
  '/:id/qr',
  authMiddleware,
  requireRole('instructor'),
  idParamValidation,
  validateRequest,
  generateQr
);

router.patch(
  '/:id/close',
  authMiddleware,
  requireRole('instructor'),
  idParamValidation,
  validateRequest,
  closeSession
);

router.patch(
  '/:id/cancel',
  authMiddleware,
  requireRole('instructor'),
  idParamValidation,
  [
    body('motivo')
      .trim()
      .notEmpty()
      .withMessage('El motivo de cancelacion es obligatorio')
      .isLength({ max: 255 })
      .withMessage('El motivo de cancelacion no puede superar 255 caracteres'),
  ],
  validateRequest,
  cancelSession
);

module.exports = router;
