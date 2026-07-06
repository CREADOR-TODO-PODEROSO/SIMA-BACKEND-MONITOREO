const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const {
  getSuperAdminSummary,
  getCoordinatorSummary,
  getAreaDetail,
  getInstructorSummary,
} = require('../controller/dashboardController');

router.get('/super-admin/resumen', authMiddleware, requireRole('SUPER_ADMIN'), getSuperAdminSummary);
router.get('/coordinador/resumen', authMiddleware, requireRole('coordinador'), getCoordinatorSummary);
router.get('/coordinador/area/:idArea', authMiddleware, requireRole('coordinador'), getAreaDetail);
router.get('/instructor/resumen', authMiddleware, requireRole('instructor'), getInstructorSummary);

module.exports = router;
