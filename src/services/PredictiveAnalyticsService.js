const { Op } = require('sequelize');
const { Apprentice, Attendance, Observation, Alert } = require('../models');

class PredictiveAnalyticsService {
  /**
   * Calcula el riesgo heurístico (score) de un aprendiz basado en sus datos actuales.
   * Criterios:
   * - Inasistencias (+10), Retardos (+5), Justificados (+2)
   * - Observaciones Abiertas: Graves (+20), Moderadas (+10), Leves (+5)
   * - Alertas Previas Abiertas: (+15 por cada una)
   * 
   * @param {number} id_aprendiz 
   * @returns {Promise<number>} Score de riesgo calculado
   */
  static async calculateHeuristicScore(id_aprendiz) {
    try {
      let score = 0;

      // 1. Pilar de Asistencias
      const attendances = await Attendance.findAll({
        where: {
          id_aprendiz,
          estado_asistencia: {
            [Op.in]: ['INASISTENCIA', 'TARDE', 'JUSTIFICADO']
          },
          anulada: false // ignorar anuladas
        }
      });

      attendances.forEach(att => {
        if (att.estado_asistencia === 'INASISTENCIA') score += 10;
        else if (att.estado_asistencia === 'TARDE') score += 5;
        else if (att.estado_asistencia === 'JUSTIFICADO') score += 2;
      });

      // 2. Pilar de Observaciones
      const observations = await Observation.findAll({
        where: {
          id_aprendiz,
          estado_observacion: 'ABIERTA'
        }
      });

      observations.forEach(obs => {
        if (obs.severidad === 'GRAVE') score += 20;
        else if (obs.severidad === 'MODERADA') score += 10;
        else if (obs.severidad === 'LEVE') score += 5;
        else score += 5; // Default por observación abierta si no tiene severidad
      });

      // 3. Pilar de Alertas
      const alerts = await Alert.findAll({
        where: {
          id_aprendiz,
          estado: 'ABIERTA'
        }
      });

      // Cada alerta previamente abierta suma puntos al riesgo general
      const score_alertas = alerts.length * 15;
      score += score_alertas;

      return {
        score,
        breakdown: {
          inasistencias: attendances.filter(a => a.estado_asistencia === 'INASISTENCIA').length,
          retardos: attendances.filter(a => a.estado_asistencia === 'TARDE').length,
          observaciones_leves: observations.filter(o => o.severidad === 'LEVE').length,
          observaciones_moderadas: observations.filter(o => o.severidad === 'MODERADA').length,
          observaciones_graves: observations.filter(o => o.severidad === 'GRAVE').length,
          alertas_previas: alerts.length
        }
      };
    } catch (error) {
      console.error(`Error calculando score heuristico para aprendiz ${id_aprendiz}:`, error);
      throw error;
    }
  }

  /**
   * Procesa a todos los aprendices activos y actualiza su score heurístico.
   * Esta función está pensada para ser llamada por el Cron Job nocturno.
   */
  static async processAllApprentices() {
    try {
      // 1 (Activo) asumiendo que el id_estado de aprendiz activo es 1
      const activeApprentices = await Apprentice.findAll({
        where: {
          id_estado: 1 
        },
        attributes: ['id_aprendiz']
      });

      console.log(`[Analytics] Procesando el scorecard de ${activeApprentices.length} aprendices activos...`);

      for (const app of activeApprentices) {
        const { score, breakdown } = await this.calculateHeuristicScore(app.id_aprendiz);
        
        // El guardado del histórico requiere la tabla historico_scorecard (creada por script SQL)
        // Por ahora simulamos la inserción mediante Query cruda, ya que el modelo no fue definido en Bloque 1
        const sequelize = require('../config/db');
        await sequelize.query(`
          INSERT INTO historico_scorecard (id_aprendiz, score_calculado, fecha_calculo, creado_en)
          VALUES (:id, :score, CURDATE(), NOW())
        `, {
          replacements: { id: app.id_aprendiz, score }
        });

        // Si el score supera el umbral de 60, encolamos un trabajo para la IA (Bloque 3)
        if (score >= 60) {
          console.log(`[Analytics] ALERTA: Aprendiz ${app.id_aprendiz} superó umbral con Score ${score}. Encolando análisis de IA...`);
          
          const { analyticsQueue } = require('../config/queue');
          
          // Agrupamos las métricas que le enviaremos a la IA
          await analyticsQueue.add('ia-diagnostico', {
            id_aprendiz: app.id_aprendiz,
            metrics: {
              score,
              ...breakdown
            }
          });
        }
      }

      console.log(`[Analytics] Procesamiento de scorecards completado exitosamente.`);
    } catch (error) {
      console.error('[Analytics] Error procesando scorecards de aprendices:', error);
    }
  }
}

module.exports = PredictiveAnalyticsService;
