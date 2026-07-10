const { GoogleGenAI } = require('@google/genai');
const { z } = require('zod');
const env = require('../config/env');

class GeminiService {
  constructor() {
    this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.modelName = 'gemini-2.5-flash';
  }

  /**
   * Envía los datos anonimizados del aprendiz a Gemini para generar un diagnóstico cualitativo y una recomendación.
   * 
   * @param {Object} metrics 
   * @param {number} metrics.score
   * @param {number} metrics.inasistencias
   * @param {number} metrics.retardos
   * @param {number} metrics.observaciones_leves
   * @param {number} metrics.observaciones_moderadas
   * @param {number} metrics.observaciones_graves
   * @param {number} metrics.alertas_previas
   * @returns {Promise<{diagnostico: string, recomendacion: string}>}
   */
  async generatePrescriptiveAnalytics(metrics) {
    if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY.includes('mock')) {
      console.log('[GeminiService] Modo Desarrollo/Mock: Devolviendo respuesta simulada.');
      return {
        diagnostico: "El aprendiz presenta un patrón recurrente de inasistencias y observaciones que sugieren posible deserción temprana.",
        recomendacion: "Se sugiere citar al aprendiz a comité de evaluación y brindar acompañamiento psicosocial."
      };
    }

    const prompt = `
Actúa como un experto en analítica predictiva educativa. Analiza los siguientes datos anonimizados de un estudiante que tiene un alto riesgo de deserción (Score: ${metrics.score}/100).

Métricas del estudiante:
- Inasistencias injustificadas: ${metrics.inasistencias}
- Retardos: ${metrics.retardos}
- Observaciones Leves: ${metrics.observaciones_leves}
- Observaciones Moderadas: ${metrics.observaciones_moderadas}
- Observaciones Graves: ${metrics.observaciones_graves}
- Alertas Tempranas Previas: ${metrics.alertas_previas}

Genera un JSON estrictamente válido que contenga:
1. "diagnostico": Un breve análisis cualitativo (máximo 2 oraciones) interpretando el riesgo del estudiante basado en estos números.
2. "recomendacion": Una acción prescriptiva clara y directa para el instructor (máximo 2 oraciones).
`;

    // Define Zod schema for structured output response format
    const responseSchema = z.object({
      diagnostico: z.string(),
      recomendacion: z.string(),
    });

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const jsonText = response.text;
      const parsedData = JSON.parse(jsonText);
      return parsedData;
      
    } catch (error) {
      console.error('[GeminiService] Error contactando a la API de Gemini:', error);
      throw error;
    }
  }
}

module.exports = new GeminiService();
