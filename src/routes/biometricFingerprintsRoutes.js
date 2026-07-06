const express = require('express');
const { body, param, query } = require('express-validator');

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  buildMatchingPackage,
  enrollFingerprint,
  listFingerprints,
  replaceFingerprint,
  revokeFingerprint,
} = require('../controller/biometricFingerprintsController');

const router = express.Router();

const enrollmentValidations = [
  body('id_usuario').isInt({ min: 1 }).withMessage('id_usuario es obligatorio'),
  body('plantilla_biometrica_base64').isString().notEmpty().withMessage('La plantilla base64 es obligatoria'),
  body('calidad_captura').isInt({ min: 0, max: 100 }).withMessage('calidad_captura debe estar entre 0 y 100'),
  body('id_dispositivo_enrolamiento').optional({ nullable: true, checkFalsy: true }).notEmpty().withMessage('Dispositivo invalido'),
  body('dedo').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 30 }).withMessage('dedo no puede superar 30 caracteres'),
  body('motivo').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 500 }).withMessage('motivo no puede superar 500 caracteres'),
];

const replacementValidations = [
  body('plantilla_biometrica_base64').isString().notEmpty().withMessage('La plantilla base64 es obligatoria'),
  body('calidad_captura').isInt({ min: 0, max: 100 }).withMessage('calidad_captura debe estar entre 0 y 100'),
  body('id_dispositivo_enrolamiento').optional({ nullable: true, checkFalsy: true }).notEmpty().withMessage('Dispositivo invalido'),
  body('dedo').optional({ nullable: true, checkFalsy: true }).isString().isLength({ max: 30 }).withMessage('dedo no puede superar 30 caracteres'),
  body('motivo').isString().trim().isLength({ min: 10, max: 255 }).withMessage('motivo es obligatorio y debe tener entre 10 y 255 caracteres'),
];

router.get(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'instructor'),
  [
    query('id_usuario').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }),
    query('estado').optional({ nullable: true, checkFalsy: true }).isIn(['ACTIVA', 'REVOCADA']),
  ],
  validateRequest,
  listFingerprints
);

router.post(
  '/enroll',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'instructor'),
  enrollmentValidations,
  validateRequest,
  enrollFingerprint
);

router.post(
  '/:id/revoke',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'instructor'),
  [
    param('id').isInt({ min: 1 }).withMessage('id de huella invalido'),
    body('motivo').isString().trim().isLength({ min: 10, max: 255 }).withMessage('motivo es obligatorio y debe tener entre 10 y 255 caracteres'),
  ],
  validateRequest,
  revokeFingerprint
);

router.post(
  '/:id/replace',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'instructor'),
  [
    param('id').isInt({ min: 1 }).withMessage('id de huella invalido'),
    ...replacementValidations,
  ],
  validateRequest,
  replaceFingerprint
);

router.post(
  '/matching-package',
  [
    body('evento_uuid').isUUID().withMessage('evento_uuid debe ser UUID valido'),
    body('nonce').isString().trim().isLength({ min: 12, max: 120 }).withMessage('nonce invalido'),
    body('fecha_origen').isISO8601().withMessage('fecha_origen debe ser fecha ISO-8601 valida'),
    body('expira_en').isISO8601().withMessage('expira_en debe ser fecha ISO-8601 valida'),
    body('id_dispositivo').notEmpty().withMessage('id_dispositivo es obligatorio'),
    body('id_sesion_formacion').isInt({ min: 1 }).withMessage('id_sesion_formacion es obligatorio'),
    body('operacion')
      .isIn(['MATCHING_PACKAGE_HUELLAS', 'MATCHING_PACKAGE'])
      .withMessage('operacion debe ser MATCHING_PACKAGE_HUELLAS'),
    body('firma_evento').isString().trim().isLength({ min: 20, max: 255 }).withMessage('firma_evento invalida'),
  ],
  validateRequest,
  buildMatchingPackage
);

module.exports = router;
