const { sequelize, Alert, Apprentice, Person, User } = require('../models');
const { successResponse, errorResponse } = require('../helpers/response');

class AnalyticsController {
  
  /**
   * Obtiene la distribución de riesgo de todos los aprendices.
   * Restringido a Coordinadores e Instructores.
   */
  async getDashboardStats(req, res) {
    try {
      // Distribución de Riesgo: Extraer el último histórico calculado por cada aprendiz
      // Para optimizar en MySQL: Obtenemos todos los registros más recientes agrupados
      const queryRiesgo = `
        SELECT 
          SUM(CASE WHEN score >= 60 THEN 1 ELSE 0 END) as altoRiesgo,
          SUM(CASE WHEN score >= 30 AND score < 60 THEN 1 ELSE 0 END) as riesgoMedio,
          SUM(CASE WHEN score < 30 THEN 1 ELSE 0 END) as riesgoBajo
        FROM (
          SELECT id_aprendiz, MAX(score) as score
          FROM historico_scorecard
          GROUP BY id_aprendiz
        ) as subquery
      `;
      
      const [resultadosRiesgo] = await sequelize.query(queryRiesgo);

      // Evolución mensual (Promedio de score por los últimos 7 días)
      const queryEvolucion = `
        SELECT fecha as fecha_calculo, AVG(score) as promedio_diario
        FROM historico_scorecard
        WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY fecha
        ORDER BY fecha ASC
      `;

      const [resultadosEvolucion] = await sequelize.query(queryEvolucion);

      return successResponse(res, 'Métricas del Dashboard obtenidas con éxito', {
        distribucionRiesgo: resultadosRiesgo[0] || { altoRiesgo: 0, riesgoMedio: 0, riesgoBajo: 0 },
        evolucionRiesgo: resultadosEvolucion
      });

    } catch (error) {
      console.error('[AnalyticsController] Error en getDashboardStats:', error);
      return errorResponse(res, 'Error interno obteniendo métricas del dashboard', 500);
    }
  }

  /**
   * Obtiene el listado de diagnósticos cualitativos de IA para aprendices en riesgo.
   */
  async getRecommendations(req, res) {
    try {
      // Filtrar alertas que tienen diagnóstico de IA y pertenecen al rol/coordinación (simplificado aquí)
      const recommendationsQuery = `
        SELECT 
          a.id_alerta, a.id_aprendiz, a.score_riesgo_calculado, a.diagnostico_cualitativo_ia, a.recomendacion_accion_ia, a.fecha_ultimo_calculo,
          p.nombres, p.apellidos, p.numero_documento
        FROM alertas a
        JOIN aprendices ap ON a.id_aprendiz = ap.id_aprendiz
        JOIN personas p ON ap.id_usuario = p.id_usuario
        WHERE a.diagnostico_cualitativo_ia IS NOT NULL 
          AND a.estado = 'ABIERTA'
        ORDER BY a.score_riesgo_calculado DESC
      `;

      const [recommendations] = await sequelize.query(recommendationsQuery);

      return successResponse(res, 'Recomendaciones predictivas obtenidas', {
        recomendaciones: recommendations
      });
    } catch (error) {
      console.error('[AnalyticsController] Error en getRecommendations:', error);
      return errorResponse(res, 'Error interno obteniendo recomendaciones de IA', 500);
    }
  }

  /**
   * Recibe el feedback (Thumbs Up / Thumbs Down) del usuario formativo
   * sobre la utilidad o precisión del diagnóstico de la IA.
   */
  async submitFeedback(req, res) {
    try {
      const { id_alerta, es_util, causa_rechazo, comentarios_adicionales } = req.body;
      const id_usuario = req.user.id_usuario;

      if (!id_alerta || es_util === undefined) {
        return errorResponse(res, 'Faltan campos obligatorios: id_alerta, es_util', 400);
      }

      await sequelize.query(`
        INSERT INTO feedback_predicciones_ia 
        (id_alerta, id_usuario_evaluador, es_util, causa_rechazo, comentarios_adicionales, fecha_evaluacion)
        VALUES (:id_alerta, :id_usuario, :es_util, :causa_rechazo, :comentarios, NOW())
      `, {
        replacements: {
          id_alerta,
          id_usuario,
          es_util,
          causa_rechazo: causa_rechazo || null,
          comentarios: comentarios_adicionales || null
        }
      });

      return successResponse(res, 'Feedback registrado inmutablemente con éxito');
    } catch (error) {
      console.error('[AnalyticsController] Error en submitFeedback:', error);
      return errorResponse(res, 'Error guardando feedback de predicción', 500);
    }
  }
}

module.exports = new AnalyticsController();
