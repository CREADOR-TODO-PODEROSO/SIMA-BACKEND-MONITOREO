const express = require('express');
const { param, query } = require('express-validator');

const router = express.Router();

const authMiddleware = require('../middlewares/authmiddleware');
const sseAuthMiddleware = require('../middlewares/sseauthmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  streamNotifications,
} = require('../controller/notificationscontroller');

router.get(
  '/',
  authMiddleware,
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit debe estar entre 1 y 50'),
  validateRequest,
  getNotifications
);

router.patch(
  '/read-all',
  authMiddleware,
  markAllNotificationsRead
);

router.patch(
  '/:id/read',
  authMiddleware,
  param('id').isInt({ min: 1 }).withMessage('id debe ser un entero positivo'),
  validateRequest,
  markNotificationRead
);

router.get('/stream', sseAuthMiddleware, streamNotifications);

module.exports = router;
