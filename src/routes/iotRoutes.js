const express = require('express');
const { body } = require('express-validator');

const { receiveAttendanceAttempt } = require('../controller/iotAttendanceController');
const { validateRequest } = require('../middlewares/validatemiddleware');

const router = express.Router();

router.post(
  '/attendance-attempts',
  [
    body('evento_uuid').isUUID().withMessage('evento_uuid debe ser UUID valido'),
    body('nonce').isString().trim().isLength({ min: 12, max: 120 }).withMessage('nonce invalido'),
    body('fecha_origen').isISO8601().withMessage('fecha_origen debe ser fecha ISO-8601 valida'),
    body('expira_en').isISO8601().withMessage('expira_en debe ser fecha ISO-8601 valida'),
    body('id_dispositivo').notEmpty().withMessage('id_dispositivo o codigo_dispositivo es obligatorio'),
    body('scanner_id').isString().trim().notEmpty().withMessage('scanner_id es obligatorio'),
    body('operacion').equals('ASISTENCIA_IOT_HUELLA').withMessage('operacion debe ser ASISTENCIA_IOT_HUELLA'),
    body('resultado').isString().trim().notEmpty().withMessage('resultado es obligatorio'),
    body('motivo').isString().trim().isLength({ min: 3, max: 120 }).withMessage('motivo invalido'),
    body('calidad_captura').isInt({ min: 0, max: 100 }).withMessage('calidad_captura debe estar entre 0 y 100'),
    body('template_size').isInt({ min: 1 }).withMessage('template_size debe ser un entero positivo'),
    body('firma_evento').isString().trim().isLength({ min: 20, max: 255 }).withMessage('firma_evento invalida'),
    body('id_sesion_formacion').optional({ nullable: true }).isInt({ min: 1 }).withMessage('id_sesion_formacion invalido'),
    body('id_usuario').optional({ nullable: true }).isInt({ min: 1 }).withMessage('id_usuario invalido'),
    body('scanner_type').optional({ nullable: true }).isString().trim().isLength({ max: 50 }).withMessage('scanner_type invalido'),
    body('template_type').optional({ nullable: true }).isIn(['SUPREMA', 'ISO']).withMessage('template_type invalido'),
    body('lectores_encontrados').optional({ nullable: true }).isInt({ min: 0 }).withMessage('lectores_encontrados invalido'),
    body('biometria_incluida').optional({ nullable: true }).isBoolean().withMessage('biometria_incluida debe ser booleano'),
    body('match_status').optional({ nullable: true }).isIn(['MATCH_OK', 'NO_MATCH', 'MATCH_MULTIPLE', 'MATCH_ERROR']).withMessage('match_status invalido'),
    body('matching_context_id').optional({ nullable: true }).isString().trim().isLength({ max: 120 }).withMessage('matching_context_id invalido'),
    body('match_reference').optional({ nullable: true }).isString().trim().isLength({ max: 120 }).withMessage('match_reference invalido'),
    body('template_ref').optional({ nullable: true }).isString().trim().isLength({ max: 120 }).withMessage('template_ref invalido'),
  ],
  validateRequest,
  receiveAttendanceAttempt
);

module.exports = router;
