const express = require('express');
const router = express.Router();

const AnalyticsController = require('../controller/analyticsController');
const authMiddleware = require('../middlewares/authmiddleware');
const { requireRole } = require('../middlewares/permissionsmiddleware');

// Todas las rutas analíticas requieren autenticación
router.use(authMiddleware);

// Endpoint Bloque 4: Obtener métricas del dashboard (Solo roles formativos y administrativos)
router.get(
  '/dashboard',
  requireRole('Administrador', 'Coordinador', 'Instructor'),
  AnalyticsController.getDashboardStats
);

// Endpoint Bloque 5: Obtener lista de aprendices en riesgo con diagnóstico IA
router.get(
  '/recommendations',
  requireRole('Administrador', 'Coordinador', 'Instructor'),
  AnalyticsController.getRecommendations
);

// Endpoint Bloque 5: Guardar el feedback sobre un diagnóstico predictivo
router.post(
  '/feedback',
  requireRole('Administrador', 'Coordinador', 'Instructor'),
  AnalyticsController.submitFeedback
);

module.exports = router;
