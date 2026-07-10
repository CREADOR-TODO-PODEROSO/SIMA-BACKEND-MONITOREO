const { Op } = require('sequelize');
const env = require('../config/env');
const {
  Apprentice,
  Attendance,
  BiometricConsent,
  FacialEnrollment,
  FacialValidationAttempt,
  PrivilegedAudit,
  sequelize,
} = require('../models');
const {
  buildFaceEmbeddingHash,
  cosineSimilarity,
  decryptFaceEmbedding,
  embeddingToBuffer,
  encryptFaceEmbedding,
} = require('../helpers/facialBiometricCrypto');
const {
  createFaceChallenge,
  createFaceValidationResult,
  verifyFaceChallenge,
  verifyFaceValidationResult,
} = require('../helpers/facialChallenge');

class FacialBiometricsService {
  static _assertApprentice(requester) {
    if (requester.rol !== 'aprendiz' || !requester.id_aprendiz) {
      throw { status: 403, message: 'Solo un aprendiz activo puede usar biometria facial' };
    }
  }

  static _sanitizeRequesterInfo(req) {
    return {
      ip_origen: String(req.ip || req.headers?.['x-forwarded-for'] || '').slice(0, 45) || null,
      user_agent: String(req.headers?.['user-agent'] || '').slice(0, 255) || null,
    };
  }

  static _serializeConsent(consent) {
    if (!consent) return null;
    const data = typeof consent.toJSON === 'function' ? consent.toJSON() : consent;
    return {
      id_consentimiento: data.id_consentimiento,
      tipo_biometria: data.tipo_biometria,
      version_politica: data.version_politica,
      aceptado: Boolean(data.aceptado),
      fecha_aceptacion: data.fecha_aceptacion,
      fecha_revocacion: data.fecha_revocacion,
    };
  }

  static _serializeEnrollment(enrollment) {
    if (!enrollment) return null;
    const data = typeof enrollment.toJSON === 'function' ? enrollment.toJSON() : enrollment;
    return {
      id_enrolamiento_facial: data.id_enrolamiento_facial,
      id_usuario: data.id_usuario,
      id_aprendiz: data.id_aprendiz,
      id_consentimiento: data.id_consentimiento,
      estado: data.estado,
      modelo_version: data.modelo_version,
      proveedor: data.proveedor,
      calidad_captura: data.calidad_captura,
      liveness_score: data.liveness_score,
      fecha_enrolamiento: data.fecha_enrolamiento,
      fecha_revocacion: data.fecha_revocacion,
    };
  }

  static _normalizeLiveness(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (['PASSED', 'BASIC_PASSED'].includes(normalized)) return normalized;
    if (normalized === 'FAILED') return 'FAILED';
    return 'NOT_AVAILABLE';
  }

  static _assertNoSensitivePayload(payload) {
    const blockedKeys = ['image', 'imagen', 'foto', 'base64_image', 'raw', 'frame', 'face_image'];
    const keys = Object.keys(payload || {});
    const found = keys.find((key) =>
      blockedKeys.some((blocked) => key.toLowerCase().includes(blocked))
    );
    if (found) {
      throw { status: 400, message: 'El modulo facial no acepta imagenes, RAW ni fotos persistentes' };
    }
  }

  static async getMyStatus(requester) {
    this._assertApprentice(requester);
    const [consent, enrollment] = await Promise.all([
      this.getActiveConsent(requester.id_usuario),
      this.getActiveEnrollment(requester.id_usuario, requester.id_aprendiz),
    ]);

    return {
      consentimiento: this._serializeConsent(consent),
      enrolamiento: this._serializeEnrollment(enrollment),
      tiene_consentimiento_activo: Boolean(consent),
      tiene_enrolamiento_activo: Boolean(enrollment),
      requiere_consentimiento: !consent,
      requiere_enrolamiento: Boolean(consent) && !enrollment,
    };
  }

  static async getActiveConsent(id_usuario, transaction = null) {
    return BiometricConsent.findOne({
      where: {
        id_usuario,
        tipo_biometria: 'FACIAL',
        aceptado: true,
        fecha_revocacion: null,
      },
      order: [['fecha_aceptacion', 'DESC']],
      transaction,
    });
  }

  static async getActiveEnrollment(id_usuario, id_aprendiz, transaction = null) {
    return FacialEnrollment.findOne({
      where: {
        id_usuario,
        id_aprendiz,
        estado: 'ACTIVO',
      },
      order: [['fecha_enrolamiento', 'DESC']],
      transaction,
    });
  }

  static async acceptConsent(data, requester, req) {
    this._assertApprentice(requester);
    const info = this._sanitizeRequesterInfo(req);
    const version = String(data.version_politica || env.SIMA_FACE_CONSENT_POLICY_VERSION).trim();

    const consent = await BiometricConsent.create({
      id_usuario: requester.id_usuario,
      tipo_biometria: 'FACIAL',
      version_politica: version,
      aceptado: true,
      ip_origen: info.ip_origen,
      user_agent: info.user_agent,
    });

    return this._serializeConsent(consent);
  }

  static async revokeConsent(data, requester) {
    this._assertApprentice(requester);
    const reason = String(data.motivo || 'Revocacion solicitada por aprendiz').trim().slice(0, 255);
    const transaction = await sequelize.transaction();

    try {
      const consent = await this.getActiveConsent(requester.id_usuario, transaction);
      if (!consent) {
        throw { status: 404, message: 'No hay consentimiento facial activo' };
      }

      await consent.update({
        aceptado: false,
        fecha_revocacion: new Date(),
      }, { transaction });

      await FacialEnrollment.update({
        estado: 'REVOCADO',
        fecha_revocacion: new Date(),
        revocado_por: requester.id_usuario,
        motivo_revocacion: reason,
      }, {
        where: {
          id_usuario: requester.id_usuario,
          id_aprendiz: requester.id_aprendiz,
          estado: 'ACTIVO',
        },
        transaction,
      });

      await transaction.commit();
      return this._serializeConsent(consent);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async createEnrollmentChallenge(data, requester) {
    this._assertApprentice(requester);
    const consent = await this.getActiveConsent(requester.id_usuario);
    if (!consent) {
      throw { status: 409, message: 'Debe aceptar consentimiento facial antes de enrolarse' };
    }

    return createFaceChallenge({
      purpose: 'ENROLLMENT',
      id_usuario: requester.id_usuario,
      id_aprendiz: requester.id_aprendiz,
      device_uuid: data.device_uuid,
    });
  }

  static async enroll(data, requester) {
    this._assertApprentice(requester);
    this._assertNoSensitivePayload(data);

    const challenge = verifyFaceChallenge(data.challenge_token, 'ENROLLMENT');
    if (Number(challenge.id_usuario) !== Number(requester.id_usuario)) {
      throw { status: 401, message: 'El reto facial no pertenece al usuario autenticado' };
    }
    if (Number(challenge.id_aprendiz) !== Number(requester.id_aprendiz)) {
      throw { status: 401, message: 'El reto facial no pertenece al aprendiz autenticado' };
    }
    if (String(challenge.device_uuid || '') !== String(data.device_uuid || '')) {
      throw { status: 401, message: 'El reto facial no corresponde a este dispositivo' };
    }

    const liveness = this._normalizeLiveness(data.liveness_result);
    if (!['PASSED', 'BASIC_PASSED'].includes(liveness)) {
      throw { status: 400, message: 'No se puede enrolar rostro sin liveness minimo aprobado' };
    }

    const quality = Number(data.calidad_captura);
    if (!Number.isInteger(quality) || quality < env.SIMA_FACE_MIN_ENROLL_QUALITY || quality > 100) {
      throw { status: 400, message: `calidad_captura debe estar entre ${env.SIMA_FACE_MIN_ENROLL_QUALITY} y 100` };
    }

    const transaction = await sequelize.transaction();
    try {
      const consent = await this.getActiveConsent(requester.id_usuario, transaction);
      if (!consent) {
        throw { status: 409, message: 'Debe aceptar consentimiento facial antes de enrolarse' };
      }

      const embeddingHash = buildFaceEmbeddingHash(data.embedding);
      const encryptedEmbedding = encryptFaceEmbedding(data.embedding);

      await FacialEnrollment.update({
        estado: 'REVOCADO',
        fecha_revocacion: new Date(),
        revocado_por: requester.id_usuario,
        motivo_revocacion: 'Reemplazo por nuevo enrolamiento facial',
      }, {
        where: {
          id_usuario: requester.id_usuario,
          id_aprendiz: requester.id_aprendiz,
          estado: 'ACTIVO',
        },
        transaction,
      });

      const enrollment = await FacialEnrollment.create({
        id_usuario: requester.id_usuario,
        id_aprendiz: requester.id_aprendiz,
        id_consentimiento: consent.id_consentimiento,
        estado: 'ACTIVO',
        embedding_cifrado: encryptedEmbedding,
        embedding_hash: embeddingHash,
        modelo_version: String(data.modelo_version || 'SIMA_FACE_EMBEDDING_V1').slice(0, 80),
        proveedor: String(data.proveedor || 'SIMA_LOCAL_CONTRACT').slice(0, 80),
        calidad_captura: quality,
        liveness_score: data.liveness_score == null ? null : Number(data.liveness_score),
        enrolado_por: requester.id_usuario,
      }, { transaction });

      await PrivilegedAudit.create({
        id_usuario_responsable: requester.id_usuario,
        accion: 'ENROLAR_ROSTRO',
        entidad: 'enrolamientos_faciales',
        id_entidad: enrollment.id_enrolamiento_facial,
        valor_nuevo: {
          estado: 'ACTIVO',
          modelo_version: enrollment.modelo_version,
          proveedor: enrollment.proveedor,
          calidad_captura: quality,
        },
        motivo: 'Enrolamiento facial de aprendiz autenticado',
        resultado: 'EXITOSO',
      }, { transaction });

      await transaction.commit();
      return this._serializeEnrollment(enrollment);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async createValidationChallenge(data, requester) {
    this._assertApprentice(requester);
    const [consent, enrollment] = await Promise.all([
      this.getActiveConsent(requester.id_usuario),
      this.getActiveEnrollment(requester.id_usuario, requester.id_aprendiz),
    ]);
    if (!consent) throw { status: 409, message: 'Debe aceptar consentimiento facial antes de validar asistencia' };
    if (!enrollment) throw { status: 409, message: 'No existe enrolamiento facial activo para el aprendiz' };

    return createFaceChallenge({
      purpose: 'VALIDATION',
      id_usuario: requester.id_usuario,
      id_aprendiz: requester.id_aprendiz,
      id_sesion_formacion: data.id_sesion_formacion,
      device_uuid: data.device_uuid,
    });
  }

  static async validateAttempt(data, requester) {
    this._assertApprentice(requester);
    this._assertNoSensitivePayload(data);

    const challenge = verifyFaceChallenge(data.challenge_token, 'VALIDATION');
    if (Number(challenge.id_usuario) !== Number(requester.id_usuario)) {
      throw { status: 401, message: 'El reto facial no pertenece al usuario autenticado' };
    }
    if (Number(challenge.id_aprendiz) !== Number(requester.id_aprendiz)) {
      throw { status: 401, message: 'El reto facial no pertenece al aprendiz autenticado' };
    }
    if (Number(challenge.id_sesion_formacion) !== Number(data.id_sesion_formacion)) {
      throw { status: 401, message: 'El reto facial no pertenece a esta sesion' };
    }
    if (String(challenge.device_uuid || '') !== String(data.device_uuid || '')) {
      throw { status: 401, message: 'El reto facial no corresponde a este dispositivo' };
    }

    const usedNonce = await FacialValidationAttempt.findOne({
      where: { challenge_nonce: challenge.nonce },
    });
    if (usedNonce) {
      throw { status: 409, message: 'El reto facial ya fue utilizado' };
    }

    const previousAttempts = await FacialValidationAttempt.count({
      where: {
        id_usuario: requester.id_usuario,
        id_aprendiz: requester.id_aprendiz,
        id_sesion_formacion: Number(data.id_sesion_formacion),
        device_uuid: String(data.device_uuid || ''),
        fecha_intento: {
          [Op.gte]: new Date(Date.now() - env.SIMA_FACE_CHALLENGE_TTL_SECONDS * 1000),
        },
      },
    });
    if (previousAttempts >= 3) {
      throw { status: 429, message: 'Se agotaron los 3 intentos faciales permitidos para este flujo' };
    }

    const enrollment = await this.getActiveEnrollment(requester.id_usuario, requester.id_aprendiz);
    if (!enrollment) {
      throw { status: 409, message: 'No existe enrolamiento facial activo para el aprendiz' };
    }

    const liveness = this._normalizeLiveness(data.liveness_result);
    if (!['PASSED', 'BASIC_PASSED'].includes(liveness)) {
      const failedAttempt = await FacialValidationAttempt.create({
        id_usuario: requester.id_usuario,
        id_aprendiz: requester.id_aprendiz,
        id_sesion_formacion: Number(data.id_sesion_formacion),
        id_enrolamiento_facial: enrollment.id_enrolamiento_facial,
        resultado: 'LIVENESS_FALLIDO',
        motivo: 'LIVENESS_NO_APROBADO',
        proveedor: String(data.proveedor || enrollment.proveedor).slice(0, 80),
        modelo_version: String(data.modelo_version || enrollment.modelo_version).slice(0, 80),
        liveness_result: liveness,
        device_uuid: String(data.device_uuid || '').slice(0, 120),
        challenge_nonce: challenge.nonce,
      });
      return {
        aprobado: false,
        resultado: failedAttempt.resultado,
        motivo: failedAttempt.motivo,
        intentos_restantes: Math.max(0, 2 - previousAttempts),
      };
    }

    const storedEmbedding = decryptFaceEmbedding(enrollment.embedding_cifrado);
    const capturedEmbedding = embeddingToBuffer(data.embedding);
    const score = cosineSimilarity(storedEmbedding, capturedEmbedding);
    storedEmbedding.fill(0);
    capturedEmbedding.fill(0);

    const approved = score >= env.SIMA_FACE_MATCH_THRESHOLD;
    const attempt = await FacialValidationAttempt.create({
      id_usuario: requester.id_usuario,
      id_aprendiz: requester.id_aprendiz,
      id_sesion_formacion: Number(data.id_sesion_formacion),
      id_enrolamiento_facial: enrollment.id_enrolamiento_facial,
      resultado: approved ? 'APROBADO' : 'RECHAZADO',
      motivo: approved ? 'MATCH_OK' : 'MATCH_INSUFICIENTE',
      proveedor: String(data.proveedor || enrollment.proveedor).slice(0, 80),
      modelo_version: String(data.modelo_version || enrollment.modelo_version).slice(0, 80),
      score_match: Number(score.toFixed(5)),
      liveness_result: liveness,
      device_uuid: String(data.device_uuid || '').slice(0, 120),
      challenge_nonce: challenge.nonce,
    });

    if (!approved) {
      return {
        aprobado: false,
        resultado: attempt.resultado,
        motivo: attempt.motivo,
        score_match: attempt.score_match,
        intentos_restantes: Math.max(0, 2 - previousAttempts),
      };
    }

    return {
      aprobado: true,
      resultado: 'APROBADO',
      id_intento_facial: attempt.id_intento_facial,
      facial_validation_token: createFaceValidationResult({
        id_usuario: requester.id_usuario,
        id_aprendiz: requester.id_aprendiz,
        id_sesion_formacion: Number(data.id_sesion_formacion),
        id_intento_facial: attempt.id_intento_facial,
        id_enrolamiento_facial: enrollment.id_enrolamiento_facial,
        device_uuid: data.device_uuid,
        challenge_nonce: challenge.nonce,
        score_match: score,
        liveness_result: liveness,
      }),
      score_match: attempt.score_match,
      intentos_restantes: Math.max(0, 2 - previousAttempts),
    };
  }

  static async verifyAttendanceFacialResult({
    token,
    requester,
    session,
    device_uuid,
    transaction,
  }) {
    const result = verifyFaceValidationResult(token);
    if (Number(result.id_usuario) !== Number(requester.id_usuario)) {
      throw { status: 401, message: 'El resultado facial no pertenece al usuario autenticado' };
    }
    if (Number(result.id_aprendiz) !== Number(requester.id_aprendiz)) {
      throw { status: 401, message: 'El resultado facial no pertenece al aprendiz autenticado' };
    }
    if (Number(result.id_sesion_formacion) !== Number(session.id_sesion_formacion)) {
      throw { status: 401, message: 'El resultado facial no pertenece a esta sesion' };
    }
    if (String(result.device_uuid || '') !== String(device_uuid || '')) {
      throw { status: 401, message: 'El resultado facial no corresponde a este dispositivo' };
    }
    if (result.resultado !== 'APROBADO') {
      throw { status: 401, message: 'El resultado facial no fue aprobado' };
    }

    const attempt = await FacialValidationAttempt.findByPk(result.id_intento_facial, { transaction });
    if (!attempt || attempt.resultado !== 'APROBADO') {
      throw { status: 401, message: 'Intento facial aprobado no encontrado' };
    }
    if (attempt.id_asistencia) {
      throw { status: 409, message: 'El intento facial ya fue asociado a una asistencia' };
    }

    return {
      attempt,
      result,
    };
  }

  static async attachAttemptToAttendance({ id_intento_facial, id_asistencia, transaction }) {
    await FacialValidationAttempt.update({
      id_asistencia,
    }, {
      where: { id_intento_facial },
      transaction,
    });
  }
}

module.exports = FacialBiometricsService;
