const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');
const { notImplemented } = require('../controller/permissionscontroller');

router.get('/', authMiddleware, requireRole('coordinador'), notImplemented);
router.post('/', authMiddleware, requireRole('coordinador'), notImplemented);
router.put('/:id', authMiddleware, requireRole('coordinador'), notImplemented);
router.delete('/:id', authMiddleware, requireRole('coordinador'), notImplemented);

module.exports = router;
