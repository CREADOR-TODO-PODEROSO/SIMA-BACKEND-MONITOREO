const AttendanceService = require('../services/AttendanceService');
const { successResponse, errorResponse } = require('../helpers/response');

const registerManual = async (req, res) => {
  try {
    const attendance = await AttendanceService.registerManual(req.body, req.user);
    return successResponse(res, 'Asistencia manual registrada correctamente', attendance, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al registrar asistencia manual', error.status || 500);
  }
};

const getMyCalendar = async (req, res) => {
  try {
    const calendar = await AttendanceService.getMyCalendar(req.query, req.user);
    return successResponse(res, 'Calendario de asistencia obtenido correctamente', calendar);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar calendario de asistencia', error.status || 500);
  }
};

const registerQrAttendance = async (req, res) => {
  try {
    const attendance = await AttendanceService.registerQrAttendance(req.body, req.user);
    return successResponse(res, 'Asistencia registrada correctamente por QR', attendance, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al registrar asistencia por QR', error.status || 500);
  }
};

const createMobileBiometricChallenge = async (req, res) => {
  try {
    const challenge = await AttendanceService.createMobileBiometricChallenge(req.body, req.user);
    return successResponse(res, 'Reto biometrico movil generado correctamente', challenge, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al generar reto biometrico movil', error.status || 500);
  }
};

const correctAttendance = async (req, res) => {
  try {
    const attendance = await AttendanceService.correctAttendance(req.params.id, req.body, req.user);
    return successResponse(res, 'Asistencia corregida correctamente', attendance);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al corregir asistencia', error.status || 500);
  }
};

const createJustification = async (req, res) => {
  try {
    const justification = await AttendanceService.createJustification(req.body, req.file, req.user);
    return successResponse(res, 'Justificacion cargada correctamente', justification, 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al cargar justificacion', error.status || 500);
  }
};

const getEligibleJustifications = async (req, res) => {
  try {
    const list = await AttendanceService.getEligibleJustifications(req.query, req.user);
    return successResponse(res, 'Inasistencias justificables obtenidas correctamente', list);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener inasistencias justificables', error.status || 500);
  }
};

const getMyJustifications = async (req, res) => {
  try {
    const list = await AttendanceService.getMyJustifications(req.query, req.user);
    return successResponse(res, 'Justificaciones del aprendiz obtenidas correctamente', list);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener justificaciones del aprendiz', error.status || 500);
  }
};

const reviewJustification = async (req, res) => {
  try {
    const justification = await AttendanceService.reviewJustification(req.params.id, req.body, req.user);
    return successResponse(res, 'Justificacion revisada correctamente', justification);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al revisar justificacion', error.status || 500);
  }
};

const getPendingJustifications = async (req, res) => {
  try {
    const list = await AttendanceService.getPendingJustifications(req.user);
    return successResponse(res, 'Justificaciones pendientes obtenidas correctamente', list);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener justificaciones pendientes', error.status || 500);
  }
};

module.exports = {
  registerManual,
  getMyCalendar,
  registerQrAttendance,
  createMobileBiometricChallenge,
  correctAttendance,
  createJustification,
  getEligibleJustifications,
  getMyJustifications,
  reviewJustification,
  getPendingJustifications,
};
