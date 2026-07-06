const { Op } = require('sequelize');

const env = require('../config/env');
const {
  Apprentice,
  ApprenticeGroup,
  Attendance,
  AttendanceEvidence,
  BiometricFingerprint,
  EducationalSession,
  IoTAttendanceAttempt,
  IoTDevice,
  User,
  sequelize,
} = require('../models');
const {
  getDeviceSecret,
  hasForbiddenBiometricFields,
  isValidSignature,
} = require('../helpers/iotSignature');

class IoTAttendanceService {
  static _currentTimeOnly() {
    return new Date().toTimeString().slice(0, 8);
  }

  static _timeToSeconds(value) {
    const [h, m, s = '0'] = String(value).split(':');
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }

  static _buildResponse(code, message, status = 200, data = null) {
    return {
      status,
      body: {
        codigo: code,
        mensaje: message,
        data,
      },
    };
  }

  static _safeDetail(detail) {
    if (!detail) return null;
    return String(detail).slice(0, 500);
  }

  static _normalizeDate(value, fieldName) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw { status: 400, code: 'FECHA_INVALIDA', message: `${fieldName} no es una fecha valida` };
    }
    return date;
  }

  static _assertTemporalWindow(payload) {
    const fechaOrigen = this._normalizeDate(payload.fecha_origen, 'fecha_origen');
    const expiraEn = this._normalizeDate(payload.expira_en, 'expira_en');
    const now = new Date();
    const maxFuture = env.SIMA_IOT_MAX_FUTURE_SKEW_SECONDS * 1000;

    if (expiraEn <= fechaOrigen) {
      throw { status: 400, code: 'VENTANA_INVALIDA', message: 'expira_en debe ser posterior a fecha_origen' };
    }
    if (expiraEn <= now) {
      throw { status: 409, code: 'EVENTO_EXPIRADO', message: 'El evento biometrico ya expiro' };
    }
    if (fechaOrigen.getTime() - now.getTime() > maxFuture) {
      throw { status: 400, code: 'FECHA_ORIGEN_FUTURA', message: 'fecha_origen esta fuera de la ventana permitida' };
    }

    return { fechaOrigen, expiraEn };
  }

  static _mapOperation(payload) {
    if (payload.operacion !== 'ASISTENCIA_IOT_HUELLA') {
      throw { status: 400, code: 'OPERACION_INVALIDA', message: 'operacion debe ser ASISTENCIA_IOT_HUELLA' };
    }
    return 'ASISTENCIA';
  }

  static _normalizeDeviceIdentifier(value) {
    return value === undefined || value === null ? null : String(value).trim();
  }

  static async _findDevice(deviceIdentifier, transaction) {
    if (!deviceIdentifier) return null;

    const where = /^\d+$/.test(deviceIdentifier)
      ? {
        [Op.or]: [
          { id_dispositivo: Number(deviceIdentifier) },
          { codigo_dispositivo: deviceIdentifier },
        ],
      }
      : { codigo_dispositivo: deviceIdentifier };

    return IoTDevice.findOne({ where, transaction });
  }

  static async _findExistingAttempt(payload, transaction) {
    return IoTAttendanceAttempt.findOne({
      where: {
        [Op.or]: [
          { evento_uuid: payload.evento_uuid },
          { nonce: payload.nonce },
        ],
      },
      transaction,
    });
  }

  static async _createAttempt({ payload, device, tipoIntento, resultado, motivo, detalle, idAsistencia = null, transaction }) {
    return IoTAttendanceAttempt.create({
      id_dispositivo: device.id_dispositivo,
      id_sesion_formacion: payload.id_sesion_formacion || null,
      id_usuario: payload.id_usuario || null,
      id_asistencia: idAsistencia,
      tipo_intento: tipoIntento,
      resultado,
      calidad_captura: payload.calidad_captura ?? null,
      evento_uuid: payload.evento_uuid,
      nonce: payload.nonce,
      firma_evento: payload.firma_evento,
      fecha_origen: payload.fecha_origen,
      expira_en: payload.expira_en,
      motivo,
      detalle: this._safeDetail(detalle),
    }, { transaction });
  }

  static async _rejectFunctionally({ payload, device, tipoIntento, motivo, message, status = 409, transaction }) {
    const attempt = await this._createAttempt({
      payload,
      device,
      tipoIntento,
      resultado: 'RECHAZADO',
      motivo,
      detalle: message,
      transaction,
    });

    return this._buildResponse(motivo, message, status, {
      id_intento_iot: attempt.id_intento_iot,
      asistencia_registrada: false,
    });
  }

  static async receiveAttendanceAttempt(payload) {
    const forbiddenFields = hasForbiddenBiometricFields(payload);
    if (forbiddenFields.length > 0) {
      console.warn('Intento IoT rechazado por campos biometricos prohibidos:', forbiddenFields);
      return this._buildResponse('BIOMETRIA_EXPUSTA', 'El payload contiene campos biometricos prohibidos', 400);
    }

    const deviceIdentifier = this._normalizeDeviceIdentifier(payload.id_dispositivo);
    const secret = getDeviceSecret(deviceIdentifier);
    if (!secret) {
      console.warn('Intento IoT rechazado por dispositivo sin secreto configurado:', deviceIdentifier);
      return this._buildResponse('DISPOSITIVO_NO_AUTORIZADO', 'Dispositivo IoT no autorizado', 401);
    }

    if (!isValidSignature(payload, secret)) {
      console.warn('Intento IoT rechazado por firma invalida:', {
        evento_uuid: payload.evento_uuid,
        id_dispositivo: deviceIdentifier,
      });
      return this._buildResponse('FIRMA_INVALIDA', 'Firma del evento invalida', 401);
    }

    let tipoIntento;
    let fechaOrigen;
    let expiraEn;
    try {
      tipoIntento = this._mapOperation(payload);
      ({ fechaOrigen, expiraEn } = this._assertTemporalWindow(payload));
    } catch (error) {
      return this._buildResponse(error.code || 'PAYLOAD_INVALIDO', error.message, error.status || 400);
    }

    payload.fecha_origen = fechaOrigen;
    payload.expira_en = expiraEn;

    const transaction = await sequelize.transaction();
    try {
      const existingAttempt = await this._findExistingAttempt(payload, transaction);
      if (existingAttempt) {
        await transaction.rollback();
        return this._buildResponse('EVENTO_DUPLICADO', 'El evento o nonce ya fue recibido', 409, {
          id_intento_iot: existingAttempt.id_intento_iot,
          asistencia_registrada: Boolean(existingAttempt.id_asistencia),
        });
      }

      const device = await this._findDevice(deviceIdentifier, transaction);
      if (!device) {
        await transaction.rollback();
        return this._buildResponse('DISPOSITIVO_NO_REGISTRADO', 'Dispositivo IoT no registrado', 404);
      }

      if (device.estado !== 'ACTIVO') {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'DISPOSITIVO_INACTIVO',
          message: 'El dispositivo IoT no esta activo',
          transaction,
        });
        await transaction.commit();
        return response;
      }

      if (payload.resultado !== 'CAPTURA_OK') {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: payload.motivo || 'INTENTO_FALLIDO',
          message: 'El intento biometrico no fue exitoso en el servicio local',
          status: 202,
          transaction,
        });
        await transaction.commit();
        return response;
      }

      const quality = Number(payload.calidad_captura);
      if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'CALIDAD_INVALIDA',
          message: 'calidad_captura debe ser un entero entre 0 y 100',
          status: 400,
          transaction,
        });
        await transaction.commit();
        return response;
      }

      if (quality < env.SIMA_IOT_MIN_QUALITY) {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'CALIDAD_BAJA',
          message: `La calidad de captura es menor al minimo permitido (${env.SIMA_IOT_MIN_QUALITY})`,
          transaction,
        });
        await transaction.commit();
        return response;
      }

      if (!payload.id_usuario) {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'USUARIO_NO_IDENTIFICADO',
          message: 'El servicio local no identifico un usuario',
          status: 202,
          transaction,
        });
        await transaction.commit();
        return response;
      }

      if (payload.match_status !== 'MATCH_OK' || !payload.matching_context_id || !payload.match_reference) {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'MATCH_BIOMETRICO_REQUERIDO',
          message: 'El servicio local debe declarar id_usuario solo despues de un matching biometrico real',
          status: 409,
          transaction,
        });
        await transaction.commit();
        return response;
      }

      if (!payload.id_sesion_formacion) {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'SESION_REQUERIDA',
          message: 'id_sesion_formacion es obligatorio para registrar asistencia',
          status: 400,
          transaction,
        });
        await transaction.commit();
        return response;
      }

      const session = await EducationalSession.findByPk(payload.id_sesion_formacion, { transaction });
      if (!session) {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'SESION_NO_ENCONTRADA',
          message: 'Sesion de formacion no encontrada',
          status: 404,
          transaction,
        });
        await transaction.commit();
        return response;
      }

      if (session.estado !== 'ABIERTA') {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'SESION_NO_ABIERTA',
          message: 'La sesion de formacion no esta abierta',
          transaction,
        });
        await transaction.commit();
        return response;
      }

      const user = await User.findByPk(payload.id_usuario, {
        include: [{ model: Apprentice, as: 'aprendiz', required: false }],
        transaction,
      });
      const apprentice = user?.aprendiz || null;
      if (!user || user.estado !== 'ACTIVO' || !apprentice || apprentice.estado !== 'ACTIVO') {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'APRENDIZ_NO_ACTIVO',
          message: 'El usuario identificado no corresponde a un aprendiz activo',
          transaction,
        });
        await transaction.commit();
        return response;
      }

      const activeFingerprintCount = await BiometricFingerprint.count({
        where: { id_usuario: payload.id_usuario, estado: 'ACTIVA' },
        transaction,
      });
      if (activeFingerprintCount <= 0) {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'HUELLA_NO_ENROLADA',
          message: 'El usuario no tiene huella activa enrolada',
          transaction,
        });
        await transaction.commit();
        return response;
      }

      const activeLink = await ApprenticeGroup.findOne({
        where: {
          id_aprendiz: apprentice.id_aprendiz,
          id_grupo: session.id_grupo,
          estado: 'ACTIVO',
        },
        transaction,
      });
      if (!activeLink) {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'APRENDIZ_FUERA_GRUPO',
          message: 'El aprendiz no pertenece activamente al grupo de la sesion',
          transaction,
        });
        await transaction.commit();
        return response;
      }

      let attendance = await Attendance.findOne({
        where: {
          id_sesion_formacion: session.id_sesion_formacion,
          id_aprendiz: apprentice.id_aprendiz,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!attendance) {
        attendance = await Attendance.create({
          id_sesion_formacion: session.id_sesion_formacion,
          id_aprendiz: apprentice.id_aprendiz,
          estado_asistencia: 'PENDIENTE',
          origen: null,
        }, { transaction });
      }

      if (attendance.estado_asistencia !== 'PENDIENTE' || attendance.anulada) {
        const response = await this._rejectFunctionally({
          payload,
          device,
          tipoIntento,
          motivo: 'ASISTENCIA_DUPLICADA',
          message: 'La asistencia ya fue consolidada previamente',
          transaction,
        });
        await transaction.commit();
        return response;
      }

      const startSeconds = this._timeToSeconds(session.hora_inicio_programada);
      const now = new Date();
      const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const attendanceState = nowSeconds > startSeconds + 600 ? 'TARDE' : 'PRESENTE';

      const attempt = await this._createAttempt({
        payload,
        device,
        tipoIntento,
        resultado: 'EXITOSO',
        motivo: payload.motivo || 'HUELLA_CAPTURADA',
        detalle: `Scanner: ${payload.scanner_id || 'N/A'}. Template size: ${payload.template_size || 'N/A'}. Match: ${payload.match_reference || 'N/A'}.`,
        transaction,
      });

      await attendance.update({
        estado_asistencia: attendanceState,
        hora_registro: this._currentTimeOnly(),
        origen: 'IOT_HUELLA',
        observacion: attendanceState === 'TARDE'
          ? 'Registro por lector IoT de huella despues del limite de tolerancia'
          : 'Registro por lector IoT de huella a tiempo',
      }, { transaction });

      await attempt.update({ id_asistencia: attendance.id_asistencia }, { transaction });

      await AttendanceEvidence.create({
        id_asistencia: attendance.id_asistencia,
        metodo: 'IOT_HUELLA',
        resultado: 'APROBADA',
        id_usuario_registra: payload.id_usuario,
        id_dispositivo: device.id_dispositivo,
        id_intento_iot: attempt.id_intento_iot,
        detalle: `Evento IoT ${payload.evento_uuid}. Calidad: ${quality}. Scanner: ${payload.scanner_id || 'N/A'}. Match: ${payload.match_reference || 'N/A'}.`,
      }, { transaction });

      await transaction.commit();
      return this._buildResponse('ASISTENCIA_REGISTRADA', 'Asistencia registrada correctamente por lector IoT', 201, {
        id_intento_iot: attempt.id_intento_iot,
        id_asistencia: attendance.id_asistencia,
        estado_asistencia: attendanceState,
        asistencia_registrada: true,
      });
    } catch (error) {
      await transaction.rollback();

      if (error.name === 'SequelizeUniqueConstraintError') {
        return this._buildResponse('EVENTO_DUPLICADO', 'El evento o nonce ya fue recibido', 409);
      }

      console.error('Error procesando intento IoT:', {
        message: error.message,
        evento_uuid: payload.evento_uuid,
        id_dispositivo: deviceIdentifier,
      });

      return this._buildResponse('ERROR_PROCESANDO_INTENTO', 'No se pudo procesar el intento IoT', error.status || 500);
    }
  }
}

module.exports = IoTAttendanceService;
