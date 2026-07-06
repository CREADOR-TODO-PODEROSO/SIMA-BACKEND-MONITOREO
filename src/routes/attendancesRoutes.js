const express = require('express');
const { body, query } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  getMyCalendar,
  registerManual,
  registerQrAttendance,
  createMobileBiometricChallenge,
  correctAttendance,
  createJustification,
  getEligibleJustifications,
  getMyJustifications,
  reviewJustification,
  getPendingJustifications,
} = require('../controller/attendancesController');

// Configuración de Multer para la subida de justificaciones (soporte)
const uploadDir = path.join(path.resolve(env.UPLOAD_DIR), 'justifications');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg'];
  const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Formato de soporte no permitido. Debe ser PDF, PNG, JPG o JPEG');
    error.status = 400;
    cb(error);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5 MB
});

const router = express.Router();

router.get(
  '/my-calendar',
  authMiddleware,
  requireRole('aprendiz'),
  [
    query('fecha_desde').optional().isISO8601().withMessage('fecha_desde debe ser una fecha valida'),
    query('fecha_hasta').optional().isISO8601().withMessage('fecha_hasta debe ser una fecha valida'),
    query('fecha_referencia').optional().isISO8601().withMessage('fecha_referencia debe ser una fecha valida'),
    query('id_grupo').optional().isInt({ min: 1 }).withMessage('id_grupo debe ser un entero positivo'),
    query('periodo').optional().isIn(['semana', 'mes']).withMessage('periodo debe ser semana o mes'),
    query('estado').optional().isIn(['PRESENTE', 'TARDE', 'INASISTENCIA', 'JUSTIFICADO']).withMessage('estado invalido'),
  ],
  validateRequest,
  getMyCalendar
);

router.post(
  '/manual',
  authMiddleware,
  requireRole('instructor'),
  [
    body('id_sesion_formacion').isInt({ min: 1 }).withMessage('id_sesion_formacion es obligatorio'),
    body('id_aprendiz').isInt({ min: 1 }).withMessage('id_aprendiz es obligatorio'),
    body('estado').isIn(['PRESENTE', 'TARDE']).withMessage('estado debe ser PRESENTE o TARDE'),
    body('observacion').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 255 }).withMessage('observacion no puede superar 255 caracteres'),
  ],
  validateRequest,
  registerManual
);

router.post(
  '/mobile-biometric-challenge',
  authMiddleware,
  requireRole('aprendiz'),
  [
    body('id_sesion_formacion').isInt({ min: 1 }).withMessage('id_sesion_formacion es obligatorio'),
    body('token_qr').notEmpty().withMessage('token_qr es obligatorio'),
    body('device_uuid').trim().notEmpty().withMessage('device_uuid es obligatorio'),
    body('metodo_solicitado').isIn(['FACIAL_SIMA', 'BIOMETRIA_MOVIL']).withMessage('metodo_solicitado debe ser FACIAL_SIMA o BIOMETRIA_MOVIL'),
  ],
  validateRequest,
  createMobileBiometricChallenge
);

router.post(
  '/qr',
  authMiddleware,
  requireRole('aprendiz'),
  [
    body('id_sesion_formacion').isInt({ min: 1 }).withMessage('id_sesion_formacion es obligatorio'),
    body('token_qr').notEmpty().withMessage('token_qr es obligatorio'),
    body('latitud').isFloat().withMessage('latitud debe ser un numero decimal'),
    body('longitud').isFloat().withMessage('longitud debe ser un numero decimal'),
    body('precision').isFloat().withMessage('precision debe ser un numero decimal'),
    body('mocked').isBoolean().withMessage('mocked debe ser booleano'),
    body('local_auth').optional().isBoolean().withMessage('local_auth debe ser booleano'),
    body('device_uuid').trim().notEmpty().withMessage('device_uuid es obligatorio'),
    body('biometric_method').isIn(['FACIAL_SIMA', 'BIOMETRIA_MOVIL']).withMessage('biometric_method debe ser FACIAL_SIMA o BIOMETRIA_MOVIL'),
    body('biometric_result').equals('APROBADO').withMessage('biometric_result debe ser APROBADO'),
    body('biometric_challenge_token').notEmpty().withMessage('biometric_challenge_token es obligatorio'),
    body('biometric_metadata').optional({ nullable: true }).isObject().withMessage('biometric_metadata debe ser un objeto'),
  ],
  validateRequest,
  registerQrAttendance
);

router.patch(
  '/:id/correction',
  authMiddleware,
  requireRole('instructor'),
  [
    body('estado').isIn(['PRESENTE', 'TARDE', 'INASISTENCIA', 'JUSTIFICADO']).withMessage('Estado invalido para correccion'),
    body('observacion').trim().isLength({ min: 20 }).withMessage('El motivo debe tener al menos 20 caracteres'),
  ],
  validateRequest,
  correctAttendance
);

router.post(
  '/justifications',
  authMiddleware,
  requireRole('aprendiz'),
  upload.single('soporte'),
  [
    body('id_asistencia').isInt({ min: 1 }).withMessage('id_asistencia es obligatorio'),
    body('comentario_aprendiz').optional().trim(),
  ],
  validateRequest,
  createJustification
);

router.get(
  '/justifications/eligible',
  authMiddleware,
  requireRole('aprendiz'),
  [
    query('id_grupo').optional().isInt({ min: 1 }).withMessage('id_grupo debe ser un entero positivo'),
  ],
  validateRequest,
  getEligibleJustifications
);

router.get(
  '/justifications/my',
  authMiddleware,
  requireRole('aprendiz'),
  [
    query('id_grupo').optional().isInt({ min: 1 }).withMessage('id_grupo debe ser un entero positivo'),
  ],
  validateRequest,
  getMyJustifications
);

router.get(
  '/justifications/pending',
  authMiddleware,
  requireRole('instructor'),
  getPendingJustifications
);

router.patch(
  '/justifications/:id/status',
  authMiddleware,
  requireRole('instructor'),
  [
    body('estado').isIn(['APROBADA', 'RECHAZADA']).withMessage('estado debe ser APROBADA o RECHAZADA'),
    body('comentario_instructor').optional().trim(),
  ],
  validateRequest,
  reviewJustification
);

module.exports = router;
