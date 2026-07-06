const express = require('express');
const router = express.Router();
const multer = require('multer');

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');

const {
  getApprenticesByGroup,
  getAprendicesListado,
  getFichasActivas,
  getApprenticeById,
  registrarIndividual,
  registrarMasivo,
  validacionesRegistro,
} = require('../controller/apprenticescontroller');

const os = require('os');

// ── Multer: recepción de archivos Excel temporalmente en disco ──────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    const mimePermitidos = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (mimePermitidos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no permitido. Solo se aceptan archivos .xlsx o .xls'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Rutas ───────────────────────────────────────────────────────────────────


// Grupos activos para poblar select de registro
router.get(
  '/grupos-activos',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  getFichasActivas
);

// Listado administrativo global (paginado + filtros)
router.get(
  '/listado',
  authMiddleware,
  requireRole('coordinador'),
  getAprendicesListado
);

// Aprendices de un grupo específico (operativo, paginado + filtros)
router.get(
  '/grupo/:idGrupo',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  getApprenticesByGroup
);

// Registro individual (coordinador + instructor líder de ficha)
router.post(
  '/registro',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  validacionesRegistro,
  registrarIndividual
);

// Registro masivo para coordinador o instructor lider de ficha
router.post(
  '/registro-masivo',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  upload.single('archivo'),
  registrarMasivo
);

// Detalle individual de un aprendiz (SIEMPRE al final — captura /:id)
router.get(
  '/:id',
  authMiddleware,
  requireRole('coordinador', 'instructor'),
  getApprenticeById
);

module.exports = router;
