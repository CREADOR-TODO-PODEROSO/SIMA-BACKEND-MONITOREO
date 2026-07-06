const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  getGroups,
  getGroupById,
  verifyFichaNumber,
  createGroup,
  updateGroup,
  changeGroupStatus,
  assignInstructorLeader,
  getAvailableInstructors,
} = require('../controller/groupsController');

// ─── Consulta ────────────────────────────────────────────────────────────────

// Listado paginado (coordinador ve todos de sus áreas, instructor solo sus grupos)
router.get(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  getGroups
);

// Instructores activos para poblar select (H06)
router.get(
  '/instructores-disponibles',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  getAvailableInstructors
);

// Verificar si un número de ficha ya existe (validación UX)
router.get(
  '/verificar-ficha/:numero_ficha',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador'),
  verifyFichaNumber
);

// Detalle de un grupo por ID
router.get(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  getGroupById
);

// ─── Escritura ───────────────────────────────────────────────────────────────

// Crear grupo formativo (H05)
router.post(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador'),
  [
    body('numero_ficha').trim().escape().notEmpty().withMessage('El número de ficha es obligatorio').isString().isLength({ max: 30 }),
    body('id_programa').notEmpty().withMessage('El programa es obligatorio').isInt(),
    body('jornada').trim().notEmpty().withMessage('La jornada es obligatoria').isString(),
    body('trimestres').notEmpty().withMessage('Los trimestres son obligatorios').isInt({ min: 1 }),
    body('fecha_inicio').notEmpty().withMessage('La fecha de inicio es obligatoria').isISO8601(),
    body('id_ambiente').notEmpty().withMessage('El ambiente es obligatorio').isInt({ min: 1 }).withMessage('El ambiente debe ser un entero valido'),
    body('id_instructor_lider').optional({ nullable: true, checkFalsy: true }).isInt()
  ],
  validateRequest,
  createGroup
);

// Actualizar grupo formativo (H05)
router.put(
  '/:id',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador'),
  [
    body('numero_ficha').optional().trim().escape().notEmpty().isString().isLength({ max: 30 }),
    body('id_programa').optional().isInt(),
    body('jornada').optional().trim().notEmpty().isString(),
    body('trimestres').optional().isInt({ min: 1 }),
    body('fecha_inicio').optional().isISO8601(),
    body('id_ambiente').optional({ nullable: true, checkFalsy: true }).isInt()
  ],
  validateRequest,
  updateGroup
);

// Cambiar estado del grupo (H05)
router.patch(
  '/:id/estado',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador'),
  [
    body('estado')
      .isIn(['EN_FORMACION', 'PRACTICAS', 'FINALIZADO'])
      .withMessage('El estado debe ser EN_FORMACION, PRACTICAS o FINALIZADO')
  ],
  validateRequest,
  changeGroupStatus
);

// Asignar/cambiar instructor líder (H06)
router.patch(
  '/:id/instructor-lider',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador'),
  [
    body('id_instructor').notEmpty().withMessage('El id_instructor es obligatorio').isInt()
  ],
  validateRequest,
  assignInstructorLeader
);

module.exports = router;
