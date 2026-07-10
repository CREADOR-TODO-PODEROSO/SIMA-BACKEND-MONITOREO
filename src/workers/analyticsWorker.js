const { Worker } = require('bullmq');
const env = require('../config/env');
const { connection } = require('../config/queue');
const GeminiService = require('../services/GeminiService');
const { sequelize } = require('../models');

// Función que inicializa el Worker para procesar las tareas asíncronas
function initAnalyticsWorker() {
  console.log('[Worker] Inicializando Analytics Worker de BullMQ...');

  const worker = new Worker('analytics-jobs', async job => {
    console.log(`[Worker] Procesando Job ID ${job.id} para aprendiz ${job.data.id_aprendiz}...`);
    
    try {
      const { id_aprendiz, metrics } = job.data;
      
      // Llamada a la IA (Puede demorar varios segundos)
      const iaResult = await GeminiService.generatePrescriptiveAnalytics(metrics);
      
      // Actualizar la tabla de Alertas (o donde decidamos guardar el output de la IA)
      // Como solicitaste usar query cruda sin migraciones complejas en ORM
      await sequelize.query(`
        UPDATE alertas 
        SET 
          diagnostico_cualitativo_ia = :diagnostico,
          recomendacion_accion_ia = :recomendacion,
          fecha_ultimo_calculo = NOW()
        WHERE id_aprendiz = :id AND estado = 'ABIERTA'
      `, {
        replacements: {
          id: id_aprendiz,
          diagnostico: iaResult.diagnostico,
          recomendacion: iaResult.recomendacion
        }
      });
      
      console.log(`[Worker] Job ID ${job.id} completado con éxito. Base de datos actualizada.`);
      return iaResult;

    } catch (error) {
      console.error(`[Worker] Error crítico en Job ID ${job.id}:`, error.message);
      // Lanzar el error hace que BullMQ aplique el backoff y reintente
      throw error; 
    }
  }, { 
    connection,
    concurrency: 2 // Procesar un máximo de 2 peticiones a Gemini en paralelo
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job.id} ha fallado con error: ${err.message}`);
  });
}

module.exports = {
  initAnalyticsWorker
};
