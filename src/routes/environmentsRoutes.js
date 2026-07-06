const express = require('express');
const { query } = require('express-validator');

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const { getEnvironments } = require('../controller/environmentsController');

const router = express.Router();

router.get(
  '/',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  [
    query('estado')
      .optional()
      .isIn(['ACTIVO', 'MANTENIMIENTO', 'INACTIVO'])
      .withMessage('Estado de ambiente no valido'),
  ],
  validateRequest,
  getEnvironments
);

module.exports = router;
