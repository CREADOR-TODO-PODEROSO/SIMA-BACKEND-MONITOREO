const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequiredFields } = require('../middlewares/validatemiddleware');
const {
  getRoles,
  getRoleById,
  getUsersByRole,
  assignRoleToUser,
} = require('../controller/rolescontroller');

router.get('/', authMiddleware, getRoles);
router.get('/:id', authMiddleware, getRoleById);
router.get('/:id/usuarios', authMiddleware, requireRole('SUPER_ADMIN', 'coordinador'), getUsersByRole);

router.put(
  '/usuarios/:idUsuario',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador'),
  validateRequiredFields(['id_rol']),
  assignRoleToUser
);

module.exports = router;
