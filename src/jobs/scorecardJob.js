const cron = require('node-cron');
const PredictiveAnalyticsService = require('../services/PredictiveAnalyticsService');

/**
 * Job Nocturno para calcular el Scorecard Heurístico
 * Se ejecuta todos los días a las 02:00 AM.
 * 
 * Este job se encarga de:
 * 1. Iterar sobre todos los aprendices activos.
 * 2. Calcular su riesgo heurístico (score).
 * 3. Guardar el resultado en la tabla historico_scorecard.
 * 4. (Futuro Bloque 3) Encolar llamadas a la API de IA para los que superen el umbral >= 60.
 */
function initScorecardJob() {
  console.log('[Jobs] Inicializando cron job de Scorecard Heurístico (02:00 AM)...');
  
  // '0 2 * * *' = A las 02:00 AM todos los días
  cron.schedule('0 2 * * *', async () => {
    console.log('[Jobs] Ejecutando cálculo nocturno del Scorecard Heurístico...');
    try {
      await PredictiveAnalyticsService.processAllApprentices();
      console.log('[Jobs] Cálculo nocturno finalizado.');
    } catch (error) {
      console.error('[Jobs] Fallo crítico durante el cálculo nocturno:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/Bogota" // Ajustar según zona horaria del servidor
  });
}

module.exports = {
  initScorecardJob
};
