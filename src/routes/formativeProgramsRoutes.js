const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { getProgramsByArea } = require('../controller/formativeProgramsController');

// Programas de formación por área (para poblar select en formulario de creación de grupo)
router.get(
  '/area/:idArea',
  authMiddleware,
  requireRole('coordinador'),
  getProgramsByArea
);

module.exports = router;
