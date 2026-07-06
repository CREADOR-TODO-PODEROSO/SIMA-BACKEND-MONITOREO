const express = require('express');
const { body, param } = require('express-validator');

const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  listGroupInstructors,
  assignSupportInstructor,
  changeSupportInstructorStatus,
} = require('../controller/instructorGroupsController');

router.get(
  '/grupo/:idGrupo',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  [param('idGrupo').isInt().withMessage('El idGrupo debe ser numerico')],
  validateRequest,
  listGroupInstructors
);

router.post(
  '/grupo/:idGrupo',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  [
    param('idGrupo').isInt().withMessage('El idGrupo debe ser numerico'),
    body('id_instructor').notEmpty().withMessage('El id_instructor es obligatorio').isInt(),
  ],
  validateRequest,
  assignSupportInstructor
);

router.patch(
  '/grupo/:idGrupo/instructor/:idInstructor',
  authMiddleware,
  requireRole('SUPER_ADMIN', 'coordinador', 'instructor'),
  [
    param('idGrupo').isInt().withMessage('El idGrupo debe ser numerico'),
    param('idInstructor').isInt().withMessage('El idInstructor debe ser numerico'),
    body('estado').isIn(['ACTIVO', 'INACTIVO']).withMessage('El estado debe ser ACTIVO o INACTIVO'),
  ],
  validateRequest,
  changeSupportInstructorStatus
);

module.exports = router;
