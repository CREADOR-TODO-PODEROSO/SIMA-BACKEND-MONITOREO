const EP05_TO_DB = {
  PRESENTE: 'PRESENTE',
  TARDE: 'TARDE',
  INASISTENCIA: 'INASISTENCIA',
  JUSTIFICADO: 'JUSTIFICADO',
};

const DB_TO_EP05 = {
  PRESENTE: 'PRESENTE',
  TARDE: 'TARDE',
  INASISTENCIA: 'INASISTENCIA',
  JUSTIFICADO: 'JUSTIFICADO',
  PENDIENTE: 'PENDIENTE',
};

const MANUAL_EP05_STATES = ['PRESENTE', 'TARDE'];

const toDbAttendanceState = (state) => {
  const normalized = String(state || '').trim().toUpperCase();
  return EP05_TO_DB[normalized] || null;
};

const toEp05AttendanceState = (state) => {
  const normalized = String(state || '').trim().toUpperCase();
  return DB_TO_EP05[normalized] || normalized || null;
};

module.exports = {
  MANUAL_EP05_STATES,
  toDbAttendanceState,
  toEp05AttendanceState,
};
