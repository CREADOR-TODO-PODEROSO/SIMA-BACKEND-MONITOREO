const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const {
  assignAreaToCoordinator,
  getAreas,
  removeAreaFromCoordinator,
  getCoordinatorAreas,
} = require('../controller/coordinatorAreasController');

router.get('/areas', authMiddleware, requireRole('SUPER_ADMIN', 'coordinador'), getAreas);
router.post('/', authMiddleware, requireRole('SUPER_ADMIN'), assignAreaToCoordinator);
router.get('/:idUsuario', authMiddleware, requireRole('SUPER_ADMIN', 'coordinador'), getCoordinatorAreas);
router.delete('/:idUsuario/:idArea', authMiddleware, requireRole('SUPER_ADMIN'), removeAreaFromCoordinator);

module.exports = router;
