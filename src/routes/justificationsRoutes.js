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
  createJustification,
  getEligibleJustifications,
  getMyJustifications,
  getPendingJustifications,
  reviewJustification,
} = require('../controller/attendancesController');

const uploadDir = path.join(path.resolve(env.UPLOAD_DIR), 'justifications');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg'];
  const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  const error = new Error('Formato de soporte no permitido. Debe ser PDF, PNG, JPG o JPEG');
  error.status = 400;
  cb(error);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = express.Router();

router.post(
  '/apprentice',
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
  '/apprentice/eligible',
  authMiddleware,
  requireRole('aprendiz'),
  [
    query('id_grupo').optional().isInt({ min: 1 }).withMessage('id_grupo debe ser un entero positivo'),
  ],
  validateRequest,
  getEligibleJustifications
);

router.get(
  '/apprentice/my',
  authMiddleware,
  requireRole('aprendiz'),
  [
    query('id_grupo').optional().isInt({ min: 1 }).withMessage('id_grupo debe ser un entero positivo'),
  ],
  validateRequest,
  getMyJustifications
);

router.get(
  '/instructor/pending',
  authMiddleware,
  requireRole('instructor'),
  getPendingJustifications
);

router.patch(
  '/instructor/:id/status',
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
