const express = require('express');
const { body } = require('express-validator');

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  acceptFacialConsent,
  createEnrollmentChallenge,
  createValidationChallenge,
  enrollFace,
  getMyFacialStatus,
  revokeFacialConsent,
  validateFaceAttempt,
} = require('../controller/facialBiometricsController');

const router = express.Router();

const deviceUuidValidation = body('device_uuid')
  .trim()
  .notEmpty()
  .withMessage('device_uuid es obligatorio')
  .isLength({ max: 120 })
  .withMessage('device_uuid no puede superar 120 caracteres');

router.get('/me', authMiddleware, requireRole('aprendiz'), getMyFacialStatus);

router.post(
  '/consent',
  authMiddleware,
  requireRole('aprendiz'),
  [
    body('version_politica')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 40 })
      .withMessage('version_politica no puede superar 40 caracteres'),
  ],
  validateRequest,
  acceptFacialConsent
);

router.delete(
  '/consent',
  authMiddleware,
  requireRole('aprendiz'),
  [
    body('motivo')
      .optional({ nullable: true, checkFalsy: true })
      .trim()
      .isLength({ max: 255 })
      .withMessage('motivo no puede superar 255 caracteres'),
  ],
  validateRequest,
  revokeFacialConsent
);

router.post(
  '/enrollment/challenge',
  authMiddleware,
  requireRole('aprendiz'),
  [deviceUuidValidation],
  validateRequest,
  createEnrollmentChallenge
);

router.post(
  '/enrollment',
  authMiddleware,
  requireRole('aprendiz'),
  [
    deviceUuidValidation,
    body('challenge_token').notEmpty().withMessage('challenge_token es obligatorio'),
    body('embedding').isArray({ min: 1 }).withMessage('embedding facial debe ser un vector numerico'),
    body('calidad_captura').isInt({ min: 0, max: 100 }).withMessage('calidad_captura debe estar entre 0 y 100'),
    body('liveness_result').isIn(['PASSED', 'BASIC_PASSED']).withMessage('liveness_result debe estar aprobado'),
    body('liveness_score').optional({ nullable: true }).isFloat({ min: 0, max: 1 }).withMessage('liveness_score debe estar entre 0 y 1'),
    body('modelo_version').optional({ nullable: true }).trim().isLength({ max: 80 }).withMessage('modelo_version no puede superar 80 caracteres'),
    body('proveedor').optional({ nullable: true }).trim().isLength({ max: 80 }).withMessage('proveedor no puede superar 80 caracteres'),
  ],
  validateRequest,
  enrollFace
);

router.post(
  '/validation/challenge',
  authMiddleware,
  requireRole('aprendiz'),
  [
    deviceUuidValidation,
    body('id_sesion_formacion').isInt({ min: 1 }).withMessage('id_sesion_formacion es obligatorio'),
  ],
  validateRequest,
  createValidationChallenge
);

router.post(
  '/validation/attempt',
  authMiddleware,
  requireRole('aprendiz'),
  [
    deviceUuidValidation,
    body('id_sesion_formacion').isInt({ min: 1 }).withMessage('id_sesion_formacion es obligatorio'),
    body('challenge_token').notEmpty().withMessage('challenge_token es obligatorio'),
    body('embedding').isArray({ min: 1 }).withMessage('embedding facial debe ser un vector numerico'),
    body('liveness_result').isIn(['PASSED', 'BASIC_PASSED', 'FAILED', 'NOT_AVAILABLE']).withMessage('liveness_result invalido'),
    body('modelo_version').optional({ nullable: true }).trim().isLength({ max: 80 }).withMessage('modelo_version no puede superar 80 caracteres'),
    body('proveedor').optional({ nullable: true }).trim().isLength({ max: 80 }).withMessage('proveedor no puede superar 80 caracteres'),
  ],
  validateRequest,
  validateFaceAttempt
);

module.exports = router;
