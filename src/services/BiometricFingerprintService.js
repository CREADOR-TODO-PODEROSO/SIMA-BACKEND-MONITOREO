const { Op } = require('sequelize');

const env = require('../config/env');
const {
  Apprentice,
  ApprenticeGroup,
  BiometricFingerprint,
  EducationalSession,
  Group,
  Instructor,
  IoTDevice,
  PrivilegedAudit,
  Role,
  User,
  sequelize,
} = require('../models');
const { buildTemplateHash, decryptTemplate, encryptTemplate } = require('../helpers/biometricCrypto');
const {
  getDeviceSecret,
  hasForbiddenBiometricFields,
  isValidSignature,
} = require('../helpers/iotSignature');

class BiometricFingerprintService {
  static _roleName(user) {
    return String(user?.rol || '').toLowerCase();
  }

  static _safeText(value, max = 500) {
    return value ? String(value).trim().slice(0, max) : null;
  }

  static _publicFingerprint(fingerprint) {
    return {
      id_huella: fingerprint.id_huella,
      id_usuario: fingerprint.id_usuario,
      id_dispositivo_enrolamiento: fingerprint.id_dispositivo_enrolamiento,
      plantilla_hash: fingerprint.plantilla_hash,
      calidad_captura: fingerprint.calidad_captura,
      dedo: fingerprint.dedo,
      fecha_enrolamiento: fingerprint.fecha_enrolamiento,
      enrolado_por: fingerprint.enrolado_por,
      estado: fingerprint.estado,
      fecha_revocacion: fingerprint.fecha_revocacion,
      revocada_por: fingerprint.revocada_por,
      motivo_revocacion: fingerprint.motivo_revocacion,
    };
  }

  static async _audit({ requester, action, entityId, before = null, after = null, reason = null, result = 'EXITOSO', detail = null, transaction }) {
    return PrivilegedAudit.create({
      id_usuario_responsable: requester?.id_usuario || null,
      accion: action,
      entidad: 'huellas_biometricas',
      id_entidad: entityId || null,
      valor_anterior: before,
      valor_nuevo: after,
      motivo: this._safeText(reason, 500),
      resultado: result,
      detalle_error: this._safeText(detail, 500),
    }, { transaction });
  }

  static async _findTargetUserOrFail(idUsuario, transaction) {
    const user = await User.findByPk(idUsuario, {
      include: [
        { model: Role, as: 'rol', attributes: ['nombre'] },
        { model: Apprentice, as: 'aprendiz', required: false },
        { model: Instructor, as: 'instructor', required: false },
      ],
      transaction,
    });
    if (!user || user.estado !== 'ACTIVO') {
      throw { status: 404, message: 'El usuario destino no existe o no esta activo' };
    }
    return user;
  }

  static async _assertInstructorLeaderScope(requester, targetUser, transaction) {
    if (!requester.id_instructor) {
      throw { status: 403, message: 'El instructor autenticado no tiene perfil activo' };
    }
    const apprentice = targetUser.aprendiz;
    if (!apprentice || apprentice.estado !== 'ACTIVO') {
      throw { status: 403, message: 'El instructor lider solo puede enrolar aprendices activos' };
    }

    const activeLinks = await ApprenticeGroup.findAll({
      where: { id_aprendiz: apprentice.id_aprendiz, estado: 'ACTIVO' },
      include: [{
        model: Group,
        as: 'grupo',
        where: {
          estado: 'EN_FORMACION',
          id_instructor_lider: requester.id_instructor,
        },
        required: true,
      }],
      transaction,
    });

    if (!activeLinks.length) {
      throw {
        status: 403,
        message: 'Solo el instructor lider vigente del grupo activo del aprendiz puede gestionar su huella',
      };
    }
  }

  static async _assertCanManageFingerprint(requester, targetUser, transaction) {
    const role = this._roleName(requester);
    if (role === 'super_admin') return;
    if (role === 'instructor') {
      await this._assertInstructorLeaderScope(requester, targetUser, transaction);
      return;
    }
    throw { status: 403, message: 'No tienes permisos para gestionar huellas biometricas' };
  }

  static _normalizeTemplate(data) {
    const template = data.plantilla_biometrica_base64 || data.plantilla_biometrica || data.template_base64;
    if (!template || typeof template !== 'string') {
      throw { status: 400, message: 'La plantilla biometrica base64 es obligatoria' };
    }
    return Buffer.from(template, 'base64');
  }

  static _assertQuality(value) {
    const quality = Number(value);
    if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
      throw { status: 400, message: 'calidad_captura debe ser un entero entre 0 y 100' };
    }
    if (quality < env.SIMA_BIOMETRIC_MIN_ENROLL_QUALITY) {
      throw {
        status: 409,
        message: `La calidad de captura es menor al minimo permitido (${env.SIMA_BIOMETRIC_MIN_ENROLL_QUALITY})`,
      };
    }
    return quality;
  }

  static async _findDeviceIfProvided(idDispositivo, transaction) {
    if (!idDispositivo) return null;
    const where = /^\d+$/.test(String(idDispositivo))
      ? { [Op.or]: [{ id_dispositivo: Number(idDispositivo) }, { codigo_dispositivo: String(idDispositivo) }] }
      : { codigo_dispositivo: String(idDispositivo) };
    const device = await IoTDevice.findOne({ where, transaction });
    if (!device || device.estado !== 'ACTIVO') {
      throw { status: 404, message: 'El dispositivo de enrolamiento no existe o no esta activo' };
    }
    return device;
  }

  static async listFingerprints(query, requester) {
    const where = {};
    if (query.id_usuario) where.id_usuario = query.id_usuario;
    if (query.estado) where.estado = query.estado;

    if (this._roleName(requester) === 'instructor') {
      if (!query.id_usuario) {
        throw { status: 400, message: 'El instructor debe consultar un usuario especifico' };
      }
      const transaction = await sequelize.transaction();
      try {
        const targetUser = await this._findTargetUserOrFail(query.id_usuario, transaction);
        await this._assertInstructorLeaderScope(requester, targetUser, transaction);
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } else if (this._roleName(requester) !== 'super_admin') {
      throw { status: 403, message: 'No tienes permisos para consultar huellas biometricas' };
    }

    const fingerprints = await BiometricFingerprint.findAll({
      where,
      order: [['fecha_enrolamiento', 'DESC']],
      limit: Math.min(Number(query.limit || 100), 500),
    });
    return fingerprints.map((item) => this._publicFingerprint(item));
  }

  static async enroll(data, requester) {
    const transaction = await sequelize.transaction();
    try {
      const targetUser = await this._findTargetUserOrFail(data.id_usuario, transaction);
      await this._assertCanManageFingerprint(requester, targetUser, transaction);
      const device = await this._findDeviceIfProvided(data.id_dispositivo_enrolamiento, transaction);
      const template = this._normalizeTemplate(data);
      const quality = this._assertQuality(data.calidad_captura);
      const templateHash = buildTemplateHash(template);

      const activeCount = await BiometricFingerprint.count({
        where: { id_usuario: targetUser.id_usuario, estado: 'ACTIVA' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (activeCount >= 2) {
        template.fill(0);
        throw { status: 409, message: 'El usuario ya tiene dos huellas activas' };
      }

      const duplicate = await BiometricFingerprint.findOne({
        where: { plantilla_hash: templateHash, estado: 'ACTIVA' },
        transaction,
      });
      if (duplicate) {
        template.fill(0);
        throw { status: 409, message: 'La plantilla biometrica ya se encuentra enrolada como activa' };
      }

      const encryptedTemplate = encryptTemplate(template);
      template.fill(0);

      const fingerprint = await BiometricFingerprint.create({
        id_usuario: targetUser.id_usuario,
        id_dispositivo_enrolamiento: device?.id_dispositivo || null,
        plantilla_biometrica_cifrada: encryptedTemplate,
        plantilla_hash: templateHash,
        calidad_captura: quality,
        dedo: this._safeText(data.dedo, 30),
        enrolado_por: requester.id_usuario,
        estado: 'ACTIVA',
      }, { transaction });

      await this._audit({
        requester,
        action: 'ENROLAR_HUELLA',
        entityId: fingerprint.id_huella,
        after: {
          id_usuario: targetUser.id_usuario,
          estado: 'ACTIVA',
          calidad_captura: quality,
          id_dispositivo_enrolamiento: device?.id_dispositivo || null,
        },
        reason: data.motivo || 'Enrolamiento biometrico productivo',
        transaction,
      });

      await transaction.commit();
      return this._publicFingerprint(fingerprint);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async revoke(idHuella, data, requester) {
    const transaction = await sequelize.transaction();
    try {
      const fingerprint = await BiometricFingerprint.findByPk(idHuella, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!fingerprint) throw { status: 404, message: 'Huella biometrica no encontrada' };
      if (fingerprint.estado !== 'ACTIVA') {
        throw { status: 409, message: 'La huella no esta activa o ya fue revocada' };
      }
      if (!data.motivo || String(data.motivo).trim().length < 10) {
        throw { status: 400, message: 'El motivo de revocacion es obligatorio y debe tener al menos 10 caracteres' };
      }

      const targetUser = await this._findTargetUserOrFail(fingerprint.id_usuario, transaction);
      await this._assertCanManageFingerprint(requester, targetUser, transaction);
      const before = this._publicFingerprint(fingerprint);

      await fingerprint.update({
        estado: 'REVOCADA',
        fecha_revocacion: new Date(),
        revocada_por: requester.id_usuario,
        motivo_revocacion: this._safeText(data.motivo, 255),
      }, { transaction });

      await this._audit({
        requester,
        action: 'REVOCAR_HUELLA',
        entityId: fingerprint.id_huella,
        before,
        after: this._publicFingerprint(fingerprint),
        reason: data.motivo,
        transaction,
      });

      await transaction.commit();
      return this._publicFingerprint(fingerprint);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async replace(idHuella, data, requester) {
    const revoked = await this.revoke(idHuella, {
      motivo: data.motivo || 'Reemplazo controlado de huella biometrica',
    }, requester);
    const enrolled = await this.enroll({
      ...data,
      id_usuario: revoked.id_usuario,
      motivo: data.motivo || 'Reemplazo controlado de huella biometrica',
    }, requester);
    return { huella_revocada: revoked, huella_nueva: enrolled };
  }

  static _normalizeDate(value, fieldName) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw { status: 400, message: `${fieldName} no es una fecha valida` };
    }
    return date;
  }

  static _assertSignedPackageRequest(payload) {
    const forbidden = hasForbiddenBiometricFields(payload);
    if (forbidden.length) {
      throw { status: 400, message: `Campos biometricos prohibidos en solicitud: ${forbidden.join(', ')}` };
    }
    const secret = getDeviceSecret(payload.id_dispositivo);
    if (!secret || !isValidSignature(payload, secret)) {
      throw { status: 401, message: 'Solicitud de paquete de matching no autorizada' };
    }
    const expiresAt = this._normalizeDate(payload.expira_en, 'expira_en');
    if (expiresAt <= new Date()) {
      throw { status: 409, message: 'La solicitud de paquete de matching ya expiro' };
    }
  }

  static async buildMatchingPackage(payload) {
    this._assertSignedPackageRequest(payload);
    const transaction = await sequelize.transaction();
    try {
      const session = await EducationalSession.findByPk(payload.id_sesion_formacion, { transaction });
      if (!session || session.estado !== 'ABIERTA') {
        throw { status: 409, message: 'Solo se entregan plantillas para sesiones abiertas' };
      }

      const links = await ApprenticeGroup.findAll({
        where: { id_grupo: session.id_grupo, estado: 'ACTIVO' },
        include: [{
          model: Apprentice,
          as: 'aprendiz',
          where: { estado: 'ACTIVO' },
          include: [{ model: User, as: 'usuario', where: { estado: 'ACTIVO' } }],
        }],
        transaction,
      });
      const userIds = links.map((link) => link.aprendiz.id_usuario);
      const fingerprints = userIds.length
        ? await BiometricFingerprint.findAll({
          where: { id_usuario: { [Op.in]: userIds }, estado: 'ACTIVA' },
          transaction,
        })
        : [];

      const templates = [];
      const omittedFingerprints = [];

      fingerprints.forEach((fingerprint) => {
        let template;
        try {
          template = decryptTemplate(fingerprint.plantilla_biometrica_cifrada);
          templates.push({
            id_huella: fingerprint.id_huella,
            id_usuario: fingerprint.id_usuario,
            plantilla_biometrica_base64: template.toString('base64'),
            template_type: 'SUPREMA',
          });
        } catch (error) {
          omittedFingerprints.push({
            id_huella: fingerprint.id_huella,
            id_usuario: fingerprint.id_usuario,
            motivo: error.message || 'Plantilla biometrica invalida',
          });
        } finally {
          if (template) {
            template.fill(0);
          }
        }
      });

      if (omittedFingerprints.length) {
        console.warn('Huellas omitidas del paquete de matching por cifrado invalido o legacy', omittedFingerprints);
      }

      const ttlSeconds = env.SIMA_BIOMETRIC_MATCHING_PACKAGE_TTL_SECONDS;
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await transaction.commit();
      return {
        matching_context_id: payload.evento_uuid,
        id_sesion_formacion: session.id_sesion_formacion,
        id_grupo: session.id_grupo,
        expira_en: expiresAt.toISOString(),
        ttl_segundos: ttlSeconds,
        total_plantillas: templates.length,
        plantillas: templates,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = BiometricFingerprintService;
