const {
  Op,
} = require('sequelize');
const crypto = require('crypto');
const fs = require('fs');

const env = require('../config/env');
const {
  Apprentice,
  ApprenticeGroup,
  Attendance,
  AttendanceEvidence,
  AttendanceJustification,
  ClassCompetency,
  EducationalSession,
  Group,
  GroupTrimester,
  Instructor,
  JourneyBlock,
  User,
  Person,
  sequelize,
} = require('../models');
const {
  MANUAL_EP05_STATES,
  toDbAttendanceState,
  toEp05AttendanceState,
} = require('../helpers/attendanceStateMapper');
const {
  ALLOWED_MOBILE_BIOMETRIC_METHODS,
  createMobileBiometricChallenge,
  verifyMobileBiometricChallenge,
} = require('../helpers/mobileBiometricChallenge');
const { getAccessibleGroupIdsForRequester } = require('../helpers/coordinatorAuth');
const ApprenticePortalService = require('./ApprenticePortalService');
const FacialBiometricsService = require('./FacialBiometricsService');
const NotificationService = require('./NotificationService');

class AttendanceService {
  static _timeToSeconds(value) {
    const [h, m, s = '0'] = String(value).split(':');
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }

  static _calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
  static _assertInstructor(requester) {
    if (requester.rol !== 'instructor' || !requester.id_instructor) {
      throw { status: 403, message: 'Solo un instructor activo puede realizar esta operacion' };
    }
  }

  static _assertApprentice(requester) {
    if (requester.rol !== 'aprendiz' || !requester.id_aprendiz) {
      throw { status: 403, message: 'Solo un aprendiz activo puede realizar esta operacion' };
    }
  }

  static _currentTimeOnly() {
    return new Date().toTimeString().slice(0, 8);
  }

  static _toDateOnly(value) {
    return new Date(value).toISOString().slice(0, 10);
  }

  static _buildCalendarDateRange(filters = {}) {
    if (filters.fecha_desde || filters.fecha_hasta) {
      return {
        start: filters.fecha_desde || null,
        end: filters.fecha_hasta || null,
      };
    }

    if (filters.periodo === 'semana') {
      const date = new Date(`${this._toDateOnly(filters.fecha_referencia || new Date())}T00:00:00-05:00`);
      const day = date.getDay() || 7;
      date.setDate(date.getDate() - day + 1);
      const start = this._toDateOnly(date);
      date.setDate(date.getDate() + 6);
      return { start, end: this._toDateOnly(date) };
    }

    if (filters.periodo === 'mes') {
      const reference = new Date(`${this._toDateOnly(filters.fecha_referencia || new Date())}T00:00:00-05:00`);
      const startDate = new Date(reference.getFullYear(), reference.getMonth(), 1);
      const endDate = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
      return { start: this._toDateOnly(startDate), end: this._toDateOnly(endDate) };
    }

    return { start: null, end: null };
  }

  static _buildJustificationDeadline(session) {
    const base = new Date(`${session.fecha_clase}T${session.hora_fin_programada}-05:00`);
    base.setDate(base.getDate() + 3);
    return base;
  }

  static _isWithinJustificationDeadline(session) {
    return new Date() <= this._buildJustificationDeadline(session);
  }

  static _serializeJustification(justification) {
    const data = typeof justification.toJSON === 'function' ? justification.toJSON() : justification;
    return data;
  }

  static async _notifyInstructorForJustification(session, justification, transaction) {
    const instructor = await Instructor.findByPk(session.id_instructor, { attributes: ['id_usuario'], transaction });
    if (!instructor?.id_usuario) return;

    await NotificationService.createForUser({
      id_usuario: instructor.id_usuario,
      id_alerta: null,
      tipo: 'ASISTENCIA',
      titulo: 'Nueva justificacion de inasistencia',
      mensaje: `El aprendiz cargo la justificacion #${justification.id_justificacion} para la sesion del ${session.fecha_clase}.`,
      transaction,
    });
  }

  static async _notifyApprentice(id_aprendiz, title, message, transaction = null) {
    const apprentice = await Apprentice.findByPk(id_aprendiz, { attributes: ['id_usuario'], transaction });
    if (!apprentice?.id_usuario) return;

    await NotificationService.createForUser({
      id_usuario: apprentice.id_usuario,
      id_alerta: null,
      tipo: 'ASISTENCIA',
      titulo: title,
      mensaje: message,
      transaction,
    });
  }

  static async _findSessionOrFail(id_sesion_formacion) {
    const session = await EducationalSession.findByPk(id_sesion_formacion, {
      include: [
        { model: Group, as: 'grupo', attributes: ['id_grupo', 'numero_ficha', 'estado'] },
        { model: Instructor, as: 'instructor', attributes: ['id_instructor', 'codigo_instructor'] },
      ],
    });

    if (!session) throw { status: 404, message: 'Sesion de formacion no encontrada' };
    return session;
  }

  static _assertResponsibleInstructor(session, requester) {
    this._assertInstructor(requester);

    if (Number(session.id_instructor) !== Number(requester.id_instructor)) {
      throw { status: 403, message: 'No eres el instructor responsable de esta sesion' };
    }
  }

  static async _assertActiveApprenticeInSessionGroup(id_aprendiz, session) {
    const link = await ApprenticeGroup.findOne({
      where: {
        id_aprendiz,
        id_grupo: session.id_grupo,
        estado: 'ACTIVO',
      },
    });

    if (!link) {
      throw { status: 409, message: 'El aprendiz no tiene vinculacion activa con el grupo de la sesion' };
    }

    return link;
  }

  static async _assertNoAttendance(id_sesion_formacion, id_aprendiz) {
    const existing = await Attendance.findOne({
      where: { id_sesion_formacion, id_aprendiz },
    });

    if (existing) {
      throw {
        status: 409,
        message: 'El aprendiz ya tiene asistencia registrada en esta sesion; use correccion controlada',
      };
    }
  }

  static async _createEvidence({ attendance, metodo, requester, detalle, transaction = null }) {
    return AttendanceEvidence.create({
      id_asistencia: attendance.id_asistencia,
      metodo,
      resultado: 'APROBADA',
      id_usuario_registra: requester?.id_usuario || null,
      detalle: detalle || null,
    }, { transaction });
  }

  static _sanitizeBiometricMetadata(metadata = {}) {
    const safe = {};
    const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata
      : {};

    const blockedKeys = ['image', 'imagen', 'base64', 'raw', 'embedding', 'template', 'plantilla', 'face'];
    const hasBlockedKey = Object.keys(source).some((key) =>
      blockedKeys.some((blocked) => key.toLowerCase().includes(blocked))
    );
    if (hasBlockedKey) {
      throw { status: 400, message: 'La metadata biometrica no puede incluir imagenes, plantillas ni embeddings' };
    }

    safe.provider = String(source.provider || 'sima_mobile_mvp').slice(0, 40);
    safe.attempt_number = Number(source.attempt_number || 1);
    safe.duration_ms = Number(source.duration_ms || 0);
    safe.reason = String(source.reason || 'OK').slice(0, 40);

    if (!Number.isInteger(safe.attempt_number) || safe.attempt_number < 1 || safe.attempt_number > 3) {
      throw { status: 400, message: 'attempt_number debe estar entre 1 y 3' };
    }

    if (!Number.isFinite(safe.duration_ms) || safe.duration_ms < 0) {
      safe.duration_ms = 0;
    }

    return safe;
  }

  static async _validateMobileBiometric({
    biometric_method,
    biometric_result,
    biometric_challenge_token,
    facial_validation_token,
    biometric_metadata,
    requester,
    session,
    scannedHash,
    device_uuid,
    transaction = null,
  }) {
    const method = String(biometric_method || '').trim().toUpperCase();
    const result = String(biometric_result || '').trim().toUpperCase();

    if (!ALLOWED_MOBILE_BIOMETRIC_METHODS.includes(method)) {
      throw { status: 400, message: 'Debe seleccionar FACIAL_SIMA o BIOMETRIA_MOVIL para validar asistencia' };
    }

    if (result !== 'APROBADO') {
      throw { status: 400, message: 'La asistencia requiere biometria movil aprobada' };
    }

    const challenge = verifyMobileBiometricChallenge(biometric_challenge_token);

    if (Number(challenge.id_usuario) !== Number(requester.id_usuario)) {
      throw { status: 401, message: 'El reto biometrico no pertenece al usuario autenticado' };
    }
    if (Number(challenge.id_aprendiz) !== Number(requester.id_aprendiz)) {
      throw { status: 401, message: 'El reto biometrico no pertenece al aprendiz autenticado' };
    }
    if (Number(challenge.id_sesion_formacion) !== Number(session.id_sesion_formacion)) {
      throw { status: 401, message: 'El reto biometrico no pertenece a esta sesion' };
    }
    if (challenge.qr_token_hash !== scannedHash) {
      throw { status: 401, message: 'El reto biometrico no corresponde al QR escaneado' };
    }
    if (String(challenge.device_uuid || '') !== String(device_uuid || '')) {
      throw { status: 401, message: 'El reto biometrico no corresponde al dispositivo movil' };
    }
    if (!Array.isArray(challenge.metodos_permitidos) || !challenge.metodos_permitidos.includes(method)) {
      throw { status: 401, message: 'Metodo biometrico no permitido para este reto' };
    }

    const evidence = {
      method,
      metadata: this._sanitizeBiometricMetadata(biometric_metadata),
      nonce: challenge.nonce,
    };

    if (method !== 'FACIAL_SIMA') {
      return evidence;
    }

    if (!facial_validation_token) {
      throw { status: 409, message: 'Facial SIMA requiere validacion de identidad facial contra enrolamiento activo' };
    }

    return FacialBiometricsService.verifyAttendanceFacialResult({
      token: facial_validation_token,
      requester,
      session,
      device_uuid,
      transaction,
    }).then(({ attempt, result }) => ({
      ...evidence,
      facial_attempt_id: attempt.id_intento_facial,
      facial_enrollment_id: result.id_enrolamiento_facial,
      facial_score_match: result.score_match,
      facial_liveness_result: result.liveness_result,
    }));
  }

  static _serializeAttendance(attendance) {
    const data = typeof attendance.toJSON === 'function' ? attendance.toJSON() : attendance;
    return {
      ...data,
      estado_ep05: toEp05AttendanceState(data.estado_asistencia),
    };
  }

  static async registerManual(data, requester) {
    const { id_sesion_formacion, id_aprendiz, estado, observacion } = data;
    const ep05State = String(estado || '').trim().toUpperCase();

    if (!MANUAL_EP05_STATES.includes(ep05State)) {
      throw { status: 400, message: 'El estado manual debe ser PRESENTE o TARDE' };
    }

    const dbState = toDbAttendanceState(ep05State);
    const transaction = await sequelize.transaction();

    try {
      const session = await this._findSessionOrFail(id_sesion_formacion);
      this._assertResponsibleInstructor(session, requester);

      if (session.estado !== 'ABIERTA') {
        throw { status: 409, message: 'La asistencia manual solo aplica sobre sesiones ABIERTAS' };
      }

      await this._assertActiveApprenticeInSessionGroup(id_aprendiz, session);
      await this._assertNoAttendance(id_sesion_formacion, id_aprendiz);

      const attendance = await Attendance.create({
        id_sesion_formacion,
        id_aprendiz,
        estado_asistencia: dbState,
        hora_registro: this._currentTimeOnly(),
        origen: 'MANUAL',
        observacion: observacion ? String(observacion).trim() : null,
      }, { transaction });

      await this._createEvidence({
        attendance,
        metodo: 'MANUAL',
        requester,
        detalle: 'Registro manual por instructor responsable',
        transaction,
      });

      await transaction.commit();

      return Attendance.findByPk(attendance.id_asistencia, {
        include: [{ model: AttendanceEvidence, as: 'evidencias', required: false }],
      }).then((item) => this._serializeAttendance(item));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async createMobileBiometricChallenge(data, requester) {
    this._assertApprentice(requester);

    const {
      id_sesion_formacion,
      token_qr,
      device_uuid,
      metodo_solicitado,
    } = data;

    const method = String(metodo_solicitado || '').trim().toUpperCase();
    if (!ALLOWED_MOBILE_BIOMETRIC_METHODS.includes(method)) {
      throw { status: 400, message: 'metodo_solicitado debe ser FACIAL_SIMA o BIOMETRIA_MOVIL' };
    }

    const normalizedDeviceUuid = String(device_uuid || '').trim();
    if (!normalizedDeviceUuid) {
      throw { status: 400, message: 'device_uuid es obligatorio para emitir el reto biometrico' };
    }

    const session = await this._findSessionOrFail(id_sesion_formacion);
    if (session.estado !== 'ABIERTA') {
      throw { status: 409, message: 'La sesion de formacion no esta abierta' };
    }

    await this._assertActiveApprenticeInSessionGroup(requester.id_aprendiz, session);

    const { hashQrToken } = require('../helpers/qrToken');
    const scannedHash = hashQrToken(token_qr);
    if (session.qr_token_hash !== scannedHash) {
      throw { status: 400, message: 'Codigo QR invalido para esta sesion' };
    }

    return createMobileBiometricChallenge({
      id_usuario: requester.id_usuario,
      id_aprendiz: requester.id_aprendiz,
      id_sesion_formacion: session.id_sesion_formacion,
      qr_token_hash: scannedHash,
      device_uuid: normalizedDeviceUuid,
      metodo_solicitado: method,
    });
  }

  static async registerQrAttendance(data, requester) {
    this._assertApprentice(requester);

    const {
      id_sesion_formacion,
      token_qr,
      latitud,
      longitud,
      precision,
      mocked,
      device_uuid,
      biometric_method,
      biometric_result,
      biometric_challenge_token,
      facial_validation_token,
      biometric_metadata,
    } = data;
    const lat = Number(latitud);
    const lon = Number(longitud);
    const prec = Number(precision);

    const transaction = await sequelize.transaction();
    try {
      // 1. Validar la sesión
      const session = await this._findSessionOrFail(id_sesion_formacion);
      if (session.estado !== 'ABIERTA') {
        throw { status: 409, message: 'La sesion de formacion no esta abierta' };
      }

      // 2. Validar que el aprendiz pertenezca al grupo de la sesión
      await this._assertActiveApprenticeInSessionGroup(requester.id_aprendiz, session);

      // 3. Validar token QR
      const { hashQrToken } = require('../helpers/qrToken');
      const scannedHash = hashQrToken(token_qr);
      if (session.qr_token_hash !== scannedHash) {
        throw { status: 400, message: 'Codigo QR invalido para esta sesion' };
      }

      // 4. Validar geolocalización (Haversine)
      const centerLat = env.SIMA_GEO_LATITUD_CENTRO_CTPI;
      const centerLon = env.SIMA_GEO_LONGITUD_CENTRO_CTPI;
      const allowedRadius = env.SIMA_GEO_RADIO_PERMITIDO_METROS;
      const maxPrecision = env.SIMA_GEO_PRECISION_MAXIMA_METROS;

      const distance = this._calculateHaversine(lat, lon, centerLat, centerLon);

      if (mocked) {
        throw { status: 400, message: 'Se detecto el uso de ubicacion simulada (Mock Location)' };
      }
      if (prec > maxPrecision) {
        throw { status: 400, message: `Precision de GPS insuficiente (${prec.toFixed(1)}m > ${maxPrecision}m). Intenta en un espacio abierto.` };
      }
      if (distance > allowedRadius) {
        throw { status: 400, message: `Te encuentras fuera del rango permitido del CTPI (${distance.toFixed(1)}m > ${allowedRadius}m)` };
      }

      const biometricEvidence = await this._validateMobileBiometric({
        biometric_method,
        biometric_result,
        biometric_challenge_token,
        facial_validation_token,
        biometric_metadata,
        requester,
        session,
        scannedHash,
        device_uuid,
        transaction,
      });

      // 6. Obtener registro de asistencia PENDIENTE
      const attendance = await Attendance.findOne({
        where: {
          id_sesion_formacion,
          id_aprendiz: requester.id_aprendiz,
        },
        transaction,
      });

      if (!attendance) {
        throw { status: 409, message: 'El aprendiz no figura en la lista base de la sesion' };
      }
      if (attendance.estado_asistencia !== 'PENDIENTE') {
        throw { status: 409, message: 'La asistencia ya ha sido registrada previamente en esta sesion' };
      }

      // 7. Determinar estado de asistencia por tolerancia de tiempo
      const now = new Date();
      const startSeconds = this._timeToSeconds(session.hora_inicio_programada);
      const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      
      const isLate = nowSeconds > startSeconds + 600; // 10 minutos = 600 segundos
      const attendanceState = isLate ? 'TARDE' : 'PRESENTE';

      // 8. Actualizar asistencia
      await attendance.update({
        estado_asistencia: attendanceState,
        hora_registro: this._currentTimeOnly(),
        origen: 'QR',
        observacion: isLate 
          ? 'Registro seguro por QR despues del limite de tolerancia (Tarde)' 
          : 'Registro seguro por QR a tiempo (Presente)',
      }, { transaction });

      // 9. Registrar evidencia técnica
      await AttendanceEvidence.create({
        id_asistencia: attendance.id_asistencia,
        metodo: 'QR',
        resultado: 'APROBADA',
        id_usuario_registra: requester.id_usuario,
        latitud: lat,
        longitud: lon,
        precision_metros: prec,
        distancia_metros: distance,
        dentro_rango: true,
        qr_token_hash: scannedHash,
        detalle: `Dispositivo UUID: ${device_uuid || 'N/A'}. Biometria: ${biometricEvidence.method}.`,
      }, { transaction });

      await AttendanceEvidence.create({
        id_asistencia: attendance.id_asistencia,
        metodo: biometricEvidence.method,
        resultado: 'APROBADA',
        id_usuario_registra: requester.id_usuario,
        detalle: `Proveedor: ${biometricEvidence.metadata.provider}. Intento: ${biometricEvidence.metadata.attempt_number}. Duracion: ${Math.round(biometricEvidence.metadata.duration_ms)}ms. Motivo: ${biometricEvidence.metadata.reason}.${biometricEvidence.facial_attempt_id ? ` Intento facial: ${biometricEvidence.facial_attempt_id}. Liveness: ${biometricEvidence.facial_liveness_result}.` : ''}`,
      }, { transaction });

      if (biometricEvidence.facial_attempt_id) {
        await FacialBiometricsService.attachAttemptToAttendance({
          id_intento_facial: biometricEvidence.facial_attempt_id,
          id_asistencia: attendance.id_asistencia,
          transaction,
        });
      }

      await transaction.commit();

      return Attendance.findByPk(attendance.id_asistencia, {
        include: [{ model: AttendanceEvidence, as: 'evidencias', required: false }],
      }).then((item) => this._serializeAttendance(item));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async correctAttendance(id_asistencia, data, requester) {
    const { estado, observacion, hora_registro, hora_marcacion } = data;
    const ep05State = String(estado || '').trim().toUpperCase();

    if (!['PRESENTE', 'TARDE', 'INASISTENCIA', 'JUSTIFICADO'].includes(ep05State)) {
      throw { status: 400, message: 'Estado invalido para correccion' };
    }
    if (ep05State === 'JUSTIFICADO') {
      throw { status: 409, message: 'JUSTIFICADO solo puede asignarse al aprobar una justificacion con soporte' };
    }

    const cleanReason = String(observacion || '').trim();
    if (cleanReason.length < 20) {
      throw { status: 400, message: 'El motivo de la correccion debe tener al menos 20 caracteres' };
    }

    const transaction = await sequelize.transaction();
    try {
      const attendance = await Attendance.findByPk(id_asistencia, {
        include: [{ model: EducationalSession, as: 'sesion' }],
        transaction,
      });

      if (!attendance) {
        throw { status: 404, message: 'Registro de asistencia no encontrado' };
      }

      const session = attendance.sesion;
      this._assertResponsibleInstructor(session, requester);

      // Validar ventana de 7 días hábiles
      const closeDate = session.fecha_cierre ? new Date(session.fecha_cierre) : new Date(session.fecha_clase);
      const now = new Date();
      
      let businessDaysDiff = 0;
      let tempDate = new Date(closeDate);
      tempDate.setHours(0,0,0,0);
      const todayZero = new Date(now);
      todayZero.setHours(0,0,0,0);

      while (tempDate < todayZero) {
        tempDate.setDate(tempDate.getDate() + 1);
        const day = tempDate.getDay();
        if (day !== 0 && day !== 6) {
          businessDaysDiff++;
        }
      }

      if (businessDaysDiff > 7) {
        throw { status: 400, message: 'El plazo maximo de 7 dias habiles para corregir la asistencia ha expirado' };
      }

      // Validar trimestre activo
      const groupTrimester = await GroupTrimester.findByPk(session.id_grupo_trimestre, { transaction });
      if (!groupTrimester || groupTrimester.estado !== 'ACTIVO') {
        throw { status: 400, message: 'No se pueden corregir asistencias de un trimestre cerrado o inactivo' };
      }

      const dbState = toDbAttendanceState(ep05State);
      const previousState = toEp05AttendanceState(attendance.estado_asistencia);
      const correctionTime = hora_registro || hora_marcacion || this._currentTimeOnly();

      await attendance.update({
        estado_asistencia: dbState,
        hora_registro: correctionTime,
        origen: 'CORRECCION',
        observacion: `Corregido de ${previousState} a ${ep05State}. Motivo: ${cleanReason}`,
      }, { transaction });

      // Guardar traza de auditoría
      await AttendanceEvidence.create({
        id_asistencia: attendance.id_asistencia,
        metodo: 'MANUAL',
        resultado: 'APROBADA',
        id_usuario_registra: requester.id_usuario,
        detalle: `Correccion. Estado anterior: ${previousState}. Motivo: ${cleanReason}`,
      }, { transaction });

      await transaction.commit();

      // Enviar notificación al aprendiz afectado
      try {
        const NotificationService = require('./NotificationService');
        const apprentice = await Apprentice.findByPk(attendance.id_aprendiz, {
          attributes: ['id_usuario'],
        });

        if (!apprentice?.id_usuario) {
          throw new Error('No se encontro el usuario asociado al aprendiz');
        }

        await NotificationService.createForUser({
          id_usuario: apprentice.id_usuario,
          id_alerta: null,
          tipo: 'ASISTENCIA',
          titulo: 'Corrección de Asistencia',
          mensaje: `Tu asistencia de la sesión del ${session.fecha_clase} ha sido modificada a ${ep05State} por el instructor.`,
        });
      } catch (errNotify) {
        console.warn('No se pudo enviar notificación de corrección al aprendiz:', errNotify.message);
      }

      return Attendance.findByPk(id_asistencia, {
        include: [{ model: AttendanceEvidence, as: 'evidencias', required: false }],
      }).then((item) => this._serializeAttendance(item));
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async createJustification(data, file, requester) {
    this._assertApprentice(requester);

    const { id_asistencia, comentario_aprendiz } = data;
    if (!file) {
      throw { status: 400, message: 'Debe cargar un archivo de soporte (PDF, PNG, JPG o JPEG)' };
    }

    const transaction = await sequelize.transaction();
    try {
      const attendance = await Attendance.findByPk(id_asistencia, {
        include: [{ model: EducationalSession, as: 'sesion' }],
        transaction,
      });

      if (!attendance) {
        throw { status: 404, message: 'Registro de asistencia no encontrado' };
      }

      if (Number(attendance.id_aprendiz) !== Number(requester.id_aprendiz)) {
        throw { status: 403, message: 'No tienes permisos para justificar esta inasistencia' };
      }

      if (attendance.estado_asistencia !== 'INASISTENCIA') {
        throw { status: 400, message: 'Solo se pueden justificar inasistencias' };
      }

      if (!this._isWithinJustificationDeadline(attendance.sesion)) {
        throw { status: 409, message: 'El plazo para justificar esta inasistencia vencio' };
      }

      const approved = await AttendanceJustification.findOne({
        where: { id_asistencia, estado: 'APROBADA' },
        transaction,
      });
      if (approved) {
        throw { status: 409, message: 'La inasistencia ya tiene una justificacion aprobada' };
      }

      const latest = await AttendanceJustification.findOne({
        where: { id_asistencia },
        order: [['fecha_envio', 'DESC'], ['id_justificacion', 'DESC']],
        transaction,
      });
      if (latest && !['PENDIENTE', 'RECHAZADA'].includes(latest.estado)) {
        throw { status: 409, message: 'La justificacion actual no permite una nueva carga' };
      }

      const fileUrl = `/uploads/justifications/${file.filename}`;
      const fileBuffer = fs.readFileSync(file.path);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const justification = await AttendanceJustification.create({
        id_asistencia,
        id_aprendiz: requester.id_aprendiz,
        archivo_url: fileUrl,
        archivo_nombre_original: file.originalname,
        archivo_mime: file.mimetype,
        archivo_tamano_bytes: file.size,
        archivo_hash: fileHash,
        comentario_aprendiz: comentario_aprendiz ? String(comentario_aprendiz).trim() : null,
        estado: 'PENDIENTE',
      }, { transaction });

      await this._notifyInstructorForJustification(attendance.sesion, justification, transaction);

      await transaction.commit();
      return justification;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async reviewJustification(id_justificacion, data, requester) {
    const { estado, comentario_instructor } = data;
    const finalStatus = String(estado || '').trim().toUpperCase();

    if (!['APROBADA', 'RECHAZADA'].includes(finalStatus)) {
      throw { status: 400, message: 'El estado de la justificacion debe ser APROBADA o RECHAZADA' };
    }

    const transaction = await sequelize.transaction();
    try {
      const justification = await AttendanceJustification.findByPk(id_justificacion, {
        include: [{ model: Attendance, as: 'asistencia', include: [{ model: EducationalSession, as: 'sesion' }] }],
        transaction,
      });

      if (!justification) {
        throw { status: 404, message: 'Justificacion no encontrada' };
      }
      if (justification.estado !== 'PENDIENTE') {
        throw { status: 409, message: 'Solo se pueden revisar justificaciones pendientes' };
      }

      const session = justification.asistencia.sesion;
      this._assertResponsibleInstructor(session, requester);

      if (finalStatus === 'APROBADA') {
        const existingApproved = await AttendanceJustification.findOne({
          where: {
            id_asistencia: justification.id_asistencia,
            estado: 'APROBADA',
            id_justificacion: { [Op.ne]: justification.id_justificacion },
          },
          transaction,
        });
        if (existingApproved) {
          throw { status: 409, message: 'La inasistencia ya tiene una justificacion aprobada' };
        }
      }

      await justification.update({
        estado: finalStatus,
        revisada_por: requester.id_instructor,
        fecha_revision: new Date(),
        comentario_instructor: comentario_instructor ? String(comentario_instructor).trim() : null,
      }, { transaction });

      if (finalStatus === 'APROBADA') {
        await Attendance.update({
          estado_asistencia: 'JUSTIFICADO',
          observacion: `Justificada aprobada por instructor. Comentario: ${comentario_instructor || ''}`,
        }, {
          where: { id_asistencia: justification.id_asistencia },
          transaction,
          individualHooks: true,
        });
      }

      await this._notifyApprentice(
        justification.id_aprendiz,
        `Justificacion ${finalStatus === 'APROBADA' ? 'aprobada' : 'rechazada'}`,
        `Tu justificacion #${justification.id_justificacion} de la sesion del ${session.fecha_clase} fue ${finalStatus === 'APROBADA' ? 'aprobada' : 'rechazada'}.`,
        transaction
      );

      await transaction.commit();
      return AttendanceJustification.findByPk(id_justificacion);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getEligibleJustifications(filters, requester) {
    this._assertApprentice(requester);

    const context = await ApprenticePortalService.resolveApprenticeGroupContext(requester, filters.id_grupo);
    const rows = await Attendance.findAll({
      where: {
        id_aprendiz: requester.id_aprendiz,
        estado_asistencia: 'INASISTENCIA',
      },
      include: [
        {
          model: EducationalSession,
          as: 'sesion',
          required: true,
          where: { id_grupo: context.selectedGroup.id_grupo },
          include: [
            { model: ClassCompetency, as: 'competencia', attributes: ['id_clase_competencia', 'nombre_competencia'] },
            { model: JourneyBlock, as: 'bloque_jornada', attributes: ['id_bloque_jornada', 'nombre_bloque', 'hora_inicio', 'hora_fin'] },
          ],
        },
        { model: AttendanceJustification, as: 'justificaciones', required: false },
      ],
      order: [[{ model: EducationalSession, as: 'sesion' }, 'fecha_clase', 'ASC']],
    });

    const elegibles = [];
    for (const attendance of rows) {
      const plain = attendance.toJSON();
      const justifications = Array.isArray(plain.justificaciones) ? plain.justificaciones : [];
      const hasApproved = justifications.some((item) => item.estado === 'APROBADA');
      const withinDeadline = this._isWithinJustificationDeadline(attendance.sesion);

      if (!hasApproved && withinDeadline) {
        elegibles.push({
          id_asistencia: attendance.id_asistencia,
          estado_asistencia: toEp05AttendanceState(attendance.estado_asistencia),
          fecha_limite: this._buildJustificationDeadline(attendance.sesion),
          sesion: plain.sesion,
          ultima_justificacion: justifications.sort((a, b) => new Date(b.fecha_envio) - new Date(a.fecha_envio))[0] || null,
        });
      }
    }

    return {
      ficha: context.ficha_seleccionada,
      inasistencias: elegibles,
      mensaje: elegibles.length ? null : 'No tienes inasistencias disponibles para justificar',
    };
  }

  static async getMyJustifications(filters, requester) {
    this._assertApprentice(requester);

    const context = await ApprenticePortalService.resolveApprenticeGroupContext(requester, filters.id_grupo);
    const justifications = await AttendanceJustification.findAll({
      where: { id_aprendiz: requester.id_aprendiz },
      include: [
        {
          model: Attendance,
          as: 'asistencia',
          required: true,
          include: [
            {
              model: EducationalSession,
              as: 'sesion',
              required: true,
              where: { id_grupo: context.selectedGroup.id_grupo },
              include: [
                { model: ClassCompetency, as: 'competencia', attributes: ['id_clase_competencia', 'nombre_competencia'] },
                { model: Group, as: 'grupo', attributes: ['id_grupo', 'numero_ficha'] },
              ],
            },
          ],
        },
      ],
      order: [['fecha_envio', 'DESC'], ['id_justificacion', 'DESC']],
    });

    return {
      ficha: context.ficha_seleccionada,
      justificaciones: justifications.map((item) => this._serializeJustification(item)),
      mensaje: justifications.length ? null : 'No tienes justificaciones registradas',
    };
  }

  static async getPendingJustifications(requester) {
    this._assertInstructor(requester);

    const accessibleGroupIds = await getAccessibleGroupIdsForRequester(requester);

    return AttendanceJustification.findAll({
      where: { estado: 'PENDIENTE' },
      include: [
        {
          model: Attendance,
          as: 'asistencia',
          required: true,
          include: [
            {
              model: EducationalSession,
              as: 'sesion',
              required: true,
              where: {
                id_grupo: { [Op.in]: accessibleGroupIds }
              }
            }
          ]
        },
        {
          model: Apprentice,
          as: 'aprendiz',
          include: [{ model: User, as: 'usuario', include: [{ model: Person, as: 'persona' }] }]
        }
      ]
    });
  }

  static async getMyCalendar(filters, requester) {
    this._assertApprentice(requester);

    const context = await ApprenticePortalService.resolveApprenticeGroupContext(requester, filters.id_grupo);
    const where = { id_aprendiz: requester.id_aprendiz };
    const includeSessionWhere = {};
    const dateRange = this._buildCalendarDateRange(filters);

    includeSessionWhere.id_grupo = context.selectedGroup.id_grupo;

    if (dateRange.start || dateRange.end) {
      includeSessionWhere.fecha_clase = {};
      if (dateRange.start) includeSessionWhere.fecha_clase[Op.gte] = dateRange.start;
      if (dateRange.end) includeSessionWhere.fecha_clase[Op.lte] = dateRange.end;
    }

    const sessionInclude = {
      model: EducationalSession,
      as: 'sesion',
      required: true,
      where: includeSessionWhere,
      include: [
        { model: ClassCompetency, as: 'competencia', attributes: ['id_clase_competencia', 'nombre_competencia'] },
        { model: JourneyBlock, as: 'bloque_jornada', attributes: ['id_bloque_jornada', 'nombre_bloque', 'hora_inicio', 'hora_fin'] },
        { model: Group, as: 'grupo', attributes: ['id_grupo', 'numero_ficha'] },
      ],
    };

    const rows = await Attendance.findAll({
      where,
      include: [
        sessionInclude,
        { model: AttendanceJustification, as: 'justificaciones', required: false },
      ],
      order: [[{ model: EducationalSession, as: 'sesion' }, 'fecha_clase', 'ASC']],
    });

    const requestedState = filters.estado ? String(filters.estado).trim().toUpperCase() : null;

    const registros = rows
      .map((item) => this._serializeAttendance(item))
      .filter((item) => !requestedState || item.estado_ep05 === requestedState);

    return {
      ficha: context.ficha_seleccionada,
      filtros: {
        id_grupo: context.selectedGroup.id_grupo,
        fecha_desde: dateRange.start,
        fecha_hasta: dateRange.end,
        periodo: filters.periodo || null,
        estado: requestedState,
      },
      registros,
      mensaje: registros.length ? null : 'Aun no tienes registros de asistencia',
    };
  }
}

module.exports = AttendanceService;
