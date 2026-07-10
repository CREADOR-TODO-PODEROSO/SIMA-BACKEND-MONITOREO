const sequelize = require('../config/db');

const Role = require('./roles');
const User = require('./users');
const Person = require('./person');
const Instructor = require('./instructors');
const Apprentice = require('./apprentices');

const EducationalArea = require('./educational_areas');
const FormativeProgram = require('./formativePrograms');
const ClassCompetency = require('./classCompetencies');
const ProgramClassCompetency = require('./programClassCompetencies');
const CoordinatorArea = require('./coordinatorAreas');
const Environment = require('./environments');
const Group = require('./groups');
const GroupTrimester = require('./groupTrimesters');
const JourneyBlock = require('./journeyBlocks');
const EducationalSchedule = require('./educational_schedules');
const EducationalSession = require('./EducationalSession');

const IoTDevice = require('./iotDevices');
const EnvironmentAccess = require('./environmentAccesses');
const IoTAttendanceAttempt = require('./iotAttendanceAttempts');

const ApprenticeGroup = require('./apprenticeGroups');
const InstructorGroup = require('./instructorGroups');

const Attendance = require('./attendances');
const AttendanceEvidence = require('./attendanceEvidences');
const Observation = require('./observations');
const Alert = require('./alerts');
const AlertObservation = require('./alertObservation');
const AttendanceJustification = require('./attendanceJustifications');
const Notification = require('./notifications');
const BiometricFingerprint = require('./biometricFingerprints');
const BiometricConsent = require('./biometricConsents');
const FacialEnrollment = require('./facialEnrollments');
const FacialValidationAttempt = require('./facialValidationAttempts');
const ValidAbsencesView = require('./validAbsencesView');
const PrivilegedAudit = require('./privilegedAudits');

// =========================
// Usuarios y roles
// =========================
User.belongsTo(Role, {
  foreignKey: 'id_rol',
  as: 'rol',
});

Role.hasMany(User, {
  foreignKey: 'id_rol',
  as: 'usuarios',
});

// =========================
// Usuario y persona
// =========================
User.hasOne(Person, {
  foreignKey: 'id_usuario',
  as: 'persona',
});

Person.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario',
});

// =========================
// Usuario e instructor
// =========================
User.hasOne(Instructor, {
  foreignKey: 'id_usuario',
  as: 'instructor',
});

Instructor.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario',
});

// =========================
// Usuario y aprendiz
// =========================
User.hasOne(Apprentice, {
  foreignKey: 'id_usuario',
  as: 'aprendiz',
});

Apprentice.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario',
});

// =========================
// Programas de formación y áreas
// =========================
FormativeProgram.belongsTo(EducationalArea, {
  foreignKey: 'id_area',
  as: 'area',
});

EducationalArea.hasMany(FormativeProgram, {
  foreignKey: 'id_area',
  as: 'programas',
});

ProgramClassCompetency.belongsTo(FormativeProgram, {
  foreignKey: 'id_programa',
  as: 'programa',
});

FormativeProgram.hasMany(ProgramClassCompetency, {
  foreignKey: 'id_programa',
  as: 'programa_competencias',
});

ProgramClassCompetency.belongsTo(ClassCompetency, {
  foreignKey: 'id_clase_competencia',
  as: 'competencia',
});

ClassCompetency.hasMany(ProgramClassCompetency, {
  foreignKey: 'id_clase_competencia',
  as: 'programas_competencia',
});

FormativeProgram.belongsToMany(ClassCompetency, {
  through: ProgramClassCompetency,
  foreignKey: 'id_programa',
  otherKey: 'id_clase_competencia',
  as: 'competencias',
});

ClassCompetency.belongsToMany(FormativeProgram, {
  through: ProgramClassCompetency,
  foreignKey: 'id_clase_competencia',
  otherKey: 'id_programa',
  as: 'programas',
});

Group.belongsTo(FormativeProgram, {
  foreignKey: 'id_programa',
  as: 'programa_formacion',
});

FormativeProgram.hasMany(Group, {
  foreignKey: 'id_programa',
  as: 'grupos',
});

Group.belongsTo(Environment, {
  foreignKey: 'id_ambiente',
  as: 'ambiente',
});

Environment.hasMany(Group, {
  foreignKey: 'id_ambiente',
  as: 'grupos',
});

GroupTrimester.belongsTo(Group, {
  foreignKey: 'id_grupo',
  as: 'grupo',
});

Group.hasMany(GroupTrimester, {
  foreignKey: 'id_grupo',
  as: 'trimestres_grupo',
});

// =========================
// Coordinadores de área
// =========================
CoordinatorArea.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'coordinador',
});

User.hasMany(CoordinatorArea, {
  foreignKey: 'id_usuario',
  as: 'areas_asignadas',
});

CoordinatorArea.belongsTo(EducationalArea, {
  foreignKey: 'id_area',
  as: 'area',
});

EducationalArea.hasMany(CoordinatorArea, {
  foreignKey: 'id_area',
  as: 'coordinadores_asignados',
});

// =========================
// Grupo e instructor líder
// =========================
Group.belongsTo(Instructor, {
  foreignKey: 'id_instructor_lider',
  as: 'instructor_lider',
});

Instructor.hasMany(Group, {
  foreignKey: 'id_instructor_lider',
  as: 'grupos_liderados',
});

// =========================
// Horarios de formación
// =========================
EducationalSchedule.belongsTo(GroupTrimester, {
  foreignKey: 'id_grupo_trimestre',
  as: 'grupo_trimestre',
});

GroupTrimester.hasMany(EducationalSchedule, {
  foreignKey: 'id_grupo_trimestre',
  as: 'horarios',
});

EducationalSchedule.belongsTo(ClassCompetency, {
  foreignKey: 'id_clase_competencia',
  as: 'competencia',
});

ClassCompetency.hasMany(EducationalSchedule, {
  foreignKey: 'id_clase_competencia',
  as: 'horarios',
});

EducationalSchedule.belongsTo(InstructorGroup, {
  foreignKey: 'id_instructor_grupo',
  as: 'instructor_grupo',
});

InstructorGroup.hasMany(EducationalSchedule, {
  foreignKey: 'id_instructor_grupo',
  as: 'horarios',
});

EducationalSchedule.belongsTo(JourneyBlock, {
  foreignKey: 'id_bloque_jornada',
  as: 'bloque_jornada',
});

JourneyBlock.hasMany(EducationalSchedule, {
  foreignKey: 'id_bloque_jornada',
  as: 'horarios',
});

// =========================
// Dispositivos IoT
// =========================
IoTDevice.belongsTo(Environment, {
  foreignKey: 'id_ambiente',
  as: 'ambiente',
});

Environment.hasMany(IoTDevice, {
  foreignKey: 'id_ambiente',
  as: 'dispositivos',
});

// =========================
// Accesos a ambiente
// =========================
EnvironmentAccess.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario',
});

User.hasMany(EnvironmentAccess, {
  foreignKey: 'id_usuario',
  as: 'accesos',
});

EnvironmentAccess.belongsTo(IoTDevice, {
  foreignKey: 'id_dispositivo',
  as: 'dispositivo',
});

IoTDevice.hasMany(EnvironmentAccess, {
  foreignKey: 'id_dispositivo',
  as: 'accesos',
});

// =========================
// Intentos biometricos IoT de asistencia
// =========================
IoTAttendanceAttempt.belongsTo(IoTDevice, {
  foreignKey: 'id_dispositivo',
  as: 'dispositivo',
});

IoTDevice.hasMany(IoTAttendanceAttempt, {
  foreignKey: 'id_dispositivo',
  as: 'intentos_asistencia_iot',
});

IoTAttendanceAttempt.belongsTo(EducationalSession, {
  foreignKey: 'id_sesion_formacion',
  as: 'sesion',
});

EducationalSession.hasMany(IoTAttendanceAttempt, {
  foreignKey: 'id_sesion_formacion',
  as: 'intentos_asistencia_iot',
});

IoTAttendanceAttempt.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario_identificado',
});

User.hasMany(IoTAttendanceAttempt, {
  foreignKey: 'id_usuario',
  as: 'intentos_asistencia_iot',
});

// =========================
// Relación aprendiz-grupo
// =========================
ApprenticeGroup.belongsTo(Apprentice, {
  foreignKey: 'id_aprendiz',
  as: 'aprendiz',
});

Apprentice.hasMany(ApprenticeGroup, {
  foreignKey: 'id_aprendiz',
  as: 'aprendiz_grupos',
});

ApprenticeGroup.belongsTo(Group, {
  foreignKey: 'id_grupo',
  as: 'grupo',
});

Group.hasMany(ApprenticeGroup, {
  foreignKey: 'id_grupo',
  as: 'aprendiz_grupos',
});

ApprenticeGroup.belongsTo(User, {
  foreignKey: 'asignado_por',
  as: 'usuario_asignador',
});

User.hasMany(ApprenticeGroup, {
  foreignKey: 'asignado_por',
  as: 'aprendiz_grupos_asignados',
});

// =========================
// Relación instructor-grupo
// =========================
InstructorGroup.belongsTo(Instructor, {
  foreignKey: 'id_instructor',
  as: 'instructor',
});

Instructor.hasMany(InstructorGroup, {
  foreignKey: 'id_instructor',
  as: 'instructor_grupos',
});

InstructorGroup.belongsTo(Group, {
  foreignKey: 'id_grupo',
  as: 'grupo',
});

Group.hasMany(InstructorGroup, {
  foreignKey: 'id_grupo',
  as: 'instructor_grupos',
});

InstructorGroup.belongsTo(User, {
  foreignKey: 'asignado_por',
  as: 'usuario_asignador',
});

User.hasMany(InstructorGroup, {
  foreignKey: 'asignado_por',
  as: 'instructor_grupos_asignados',
});

// =========================
// Sesiones de formación
// =========================
EducationalSession.belongsTo(EducationalSchedule, {
  foreignKey: 'id_horario',
  as: 'horario',
});

EducationalSchedule.hasMany(EducationalSession, {
  foreignKey: 'id_horario',
  as: 'sesiones',
});

EducationalSession.belongsTo(GroupTrimester, {
  foreignKey: 'id_grupo_trimestre',
  as: 'grupo_trimestre',
});

GroupTrimester.hasMany(EducationalSession, {
  foreignKey: 'id_grupo_trimestre',
  as: 'sesiones',
});

EducationalSession.belongsTo(ClassCompetency, {
  foreignKey: 'id_clase_competencia',
  as: 'competencia',
});

ClassCompetency.hasMany(EducationalSession, {
  foreignKey: 'id_clase_competencia',
  as: 'sesiones',
});

EducationalSession.belongsTo(JourneyBlock, {
  foreignKey: 'id_bloque_jornada',
  as: 'bloque_jornada',
});

JourneyBlock.hasMany(EducationalSession, {
  foreignKey: 'id_bloque_jornada',
  as: 'sesiones',
});

EducationalSession.belongsTo(Group, {
  foreignKey: 'id_grupo',
  as: 'grupo',
});

Group.hasMany(EducationalSession, {
  foreignKey: 'id_grupo',
  as: 'sesiones',
});

EducationalSession.belongsTo(Instructor, {
  foreignKey: 'id_instructor',
  as: 'instructor',
});

Instructor.hasMany(EducationalSession, {
  foreignKey: 'id_instructor',
  as: 'sesiones',
});

EducationalSession.belongsTo(Environment, {
  foreignKey: 'id_ambiente',
  as: 'ambiente',
});

Environment.hasMany(EducationalSession, {
  foreignKey: 'id_ambiente',
  as: 'sesiones',
});

EducationalSession.belongsTo(EnvironmentAccess, {
  foreignKey: 'id_acceso_apertura',
  as: 'acceso_apertura',
});

EnvironmentAccess.hasMany(EducationalSession, {
  foreignKey: 'id_acceso_apertura',
  as: 'sesiones_abiertas',
});

EducationalSession.belongsTo(EnvironmentAccess, {
  foreignKey: 'id_acceso_cierre',
  as: 'acceso_cierre',
});

EnvironmentAccess.hasMany(EducationalSession, {
  foreignKey: 'id_acceso_cierre',
  as: 'sesiones_cerradas',
});

EducationalSession.belongsTo(User, {
  foreignKey: 'abierta_por',
  as: 'usuario_apertura',
});

User.hasMany(EducationalSession, {
  foreignKey: 'abierta_por',
  as: 'sesiones_abiertas_por_usuario',
});

EducationalSession.belongsTo(User, {
  foreignKey: 'cerrada_por',
  as: 'usuario_cierre',
});

User.hasMany(EducationalSession, {
  foreignKey: 'cerrada_por',
  as: 'sesiones_cerradas_por_usuario',
});

// =========================
// Asistencias
// =========================
Attendance.belongsTo(EducationalSession, {
  foreignKey: 'id_sesion_formacion',
  as: 'sesion',
});

EducationalSession.hasMany(Attendance, {
  foreignKey: 'id_sesion_formacion',
  as: 'asistencias',
});

Attendance.belongsTo(Apprentice, {
  foreignKey: 'id_aprendiz',
  as: 'aprendiz',
});

Apprentice.hasMany(Attendance, {
  foreignKey: 'id_aprendiz',
  as: 'asistencias',
});

Attendance.belongsTo(EnvironmentAccess, {
  foreignKey: 'id_acceso',
  as: 'acceso',
});

EnvironmentAccess.hasMany(Attendance, {
  foreignKey: 'id_acceso',
  as: 'asistencias',
});

IoTAttendanceAttempt.belongsTo(Attendance, {
  foreignKey: 'id_asistencia',
  as: 'asistencia',
});

Attendance.hasMany(IoTAttendanceAttempt, {
  foreignKey: 'id_asistencia',
  as: 'intentos_iot',
});

// La relacion directa por id_sesion_formacion es la relacion oficial.

AttendanceEvidence.belongsTo(Attendance, {
  foreignKey: 'id_asistencia',
  as: 'asistencia',
});

Attendance.hasMany(AttendanceEvidence, {
  foreignKey: 'id_asistencia',
  as: 'evidencias',
});

AttendanceEvidence.belongsTo(User, {
  foreignKey: 'id_usuario_registra',
  as: 'usuario_registra',
});

User.hasMany(AttendanceEvidence, {
  foreignKey: 'id_usuario_registra',
  as: 'evidencias_asistencia_registradas',
});

AttendanceEvidence.belongsTo(IoTDevice, {
  foreignKey: 'id_dispositivo',
  as: 'dispositivo',
});

IoTDevice.hasMany(AttendanceEvidence, {
  foreignKey: 'id_dispositivo',
  as: 'evidencias_asistencia',
});

AttendanceEvidence.belongsTo(EnvironmentAccess, {
  foreignKey: 'id_acceso',
  as: 'acceso',
});

EnvironmentAccess.hasMany(AttendanceEvidence, {
  foreignKey: 'id_acceso',
  as: 'evidencias_asistencia',
});

AttendanceEvidence.belongsTo(IoTAttendanceAttempt, {
  foreignKey: 'id_intento_iot',
  as: 'intento_iot',
});

IoTAttendanceAttempt.hasMany(AttendanceEvidence, {
  foreignKey: 'id_intento_iot',
  as: 'evidencias_asistencia',
});

// =========================
// Observaciones
// =========================
Observation.belongsTo(Apprentice, {
  foreignKey: 'id_aprendiz',
  as: 'aprendiz',
});

Apprentice.hasMany(Observation, {
  foreignKey: 'id_aprendiz',
  as: 'observaciones',
});

Observation.belongsTo(Group, {
  foreignKey: 'id_grupo',
  as: 'grupo',
});

Group.hasMany(Observation, {
  foreignKey: 'id_grupo',
  as: 'observaciones',
});

Observation.belongsTo(Instructor, {
  foreignKey: 'id_instructor',
  as: 'instructor',
});

Instructor.hasMany(Observation, {
  foreignKey: 'id_instructor',
  as: 'observaciones',
});

// =========================
// Alertas
// =========================
Alert.belongsTo(Apprentice, {
  foreignKey: 'id_aprendiz',
  as: 'aprendiz',
});

Apprentice.hasMany(Alert, {
  foreignKey: 'id_aprendiz',
  as: 'alertas',
});

Alert.belongsTo(Group, {
  foreignKey: 'id_grupo',
  as: 'grupo',
});

Group.hasMany(Alert, {
  foreignKey: 'id_grupo',
  as: 'alertas',
});

Alert.belongsTo(User, {
  foreignKey: 'cerrada_por',
  as: 'usuario_cierre',
});

User.hasMany(Alert, {
  foreignKey: 'cerrada_por',
  as: 'alertas_cerradas',
});

Alert.belongsTo(User, {
  foreignKey: 'creada_por',
  as: 'usuario_creador',
});

User.hasMany(Alert, {
  foreignKey: 'creada_por',
  as: 'alertas_creadas',
});

Alert.belongsTo(User, {
  foreignKey: 'reabierta_por',
  as: 'usuario_reapertura',
});

User.hasMany(Alert, {
  foreignKey: 'reabierta_por',
  as: 'alertas_reabiertas',
});

AlertObservation.belongsTo(Alert, {
  foreignKey: 'id_alerta',
  as: 'alerta',
});

Alert.hasMany(AlertObservation, {
  foreignKey: 'id_alerta',
  as: 'alerta_observaciones',
});

AlertObservation.belongsTo(Observation, {
  foreignKey: 'id_observacion',
  as: 'observacion',
});

Observation.hasOne(AlertObservation, {
  foreignKey: 'id_observacion',
  as: 'alerta_observacion',
});

AlertObservation.belongsTo(User, {
  foreignKey: 'asociada_por',
  as: 'usuario_asociador',
});

User.hasMany(AlertObservation, {
  foreignKey: 'asociada_por',
  as: 'alertas_observaciones_asociadas',
});

// =========================
// Justificaciones de asistencia
// =========================
AttendanceJustification.belongsTo(Attendance, {
  foreignKey: 'id_asistencia',
  as: 'asistencia',
});

Attendance.hasMany(AttendanceJustification, {
  foreignKey: 'id_asistencia',
  as: 'justificaciones',
});

AttendanceJustification.belongsTo(Apprentice, {
  foreignKey: 'id_aprendiz',
  as: 'aprendiz',
});

Apprentice.hasMany(AttendanceJustification, {
  foreignKey: 'id_aprendiz',
  as: 'justificaciones',
});

AttendanceJustification.belongsTo(Instructor, {
  foreignKey: 'revisada_por',
  as: 'instructor_revisor',
});

Instructor.hasMany(AttendanceJustification, {
  foreignKey: 'revisada_por',
  as: 'justificaciones_revisadas',
});

// =========================
// Notificaciones
// =========================
Notification.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario',
});

User.hasMany(Notification, {
  foreignKey: 'id_usuario',
  as: 'notificaciones',
});

Notification.belongsTo(Alert, {
  foreignKey: 'id_alerta',
  as: 'alerta',
});

Alert.hasMany(Notification, {
  foreignKey: 'id_alerta',
  as: 'notificaciones',
});

Notification.belongsTo(Observation, {
  foreignKey: 'id_observacion',
  as: 'observacion',
});

Observation.hasMany(Notification, {
  foreignKey: 'id_observacion',
  as: 'notificaciones',
});

Notification.belongsTo(EducationalSession, {
  foreignKey: 'id_sesion_formacion',
  as: 'sesion',
});

EducationalSession.hasMany(Notification, {
  foreignKey: 'id_sesion_formacion',
  as: 'notificaciones',
});

Notification.belongsTo(AttendanceJustification, {
  foreignKey: 'id_justificacion',
  as: 'justificacion',
});

AttendanceJustification.hasMany(Notification, {
  foreignKey: 'id_justificacion',
  as: 'notificaciones',
});

Notification.belongsTo(IoTAttendanceAttempt, {
  foreignKey: 'id_intento_iot',
  as: 'intento_iot',
});

IoTAttendanceAttempt.hasMany(Notification, {
  foreignKey: 'id_intento_iot',
  as: 'notificaciones',
});

// =========================
// Huellas biométricas
// =========================
BiometricFingerprint.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario',
});

User.hasMany(BiometricFingerprint, {
  foreignKey: 'id_usuario',
  as: 'huellas',
});

BiometricFingerprint.belongsTo(IoTDevice, {
  foreignKey: 'id_dispositivo_enrolamiento',
  as: 'dispositivo_enrolamiento',
});

IoTDevice.hasMany(BiometricFingerprint, {
  foreignKey: 'id_dispositivo_enrolamiento',
  as: 'huellas_enroladas',
});

BiometricFingerprint.belongsTo(User, {
  foreignKey: 'enrolado_por',
  as: 'enrolador',
});

User.hasMany(BiometricFingerprint, {
  foreignKey: 'enrolado_por',
  as: 'huellas_enroladas',
});

// =========================
// Biometria facial de aprendices
// =========================
BiometricConsent.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario',
});

User.hasMany(BiometricConsent, {
  foreignKey: 'id_usuario',
  as: 'consentimientos_biometricos',
});

FacialEnrollment.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario',
});

User.hasMany(FacialEnrollment, {
  foreignKey: 'id_usuario',
  as: 'enrolamientos_faciales',
});

FacialEnrollment.belongsTo(Apprentice, {
  foreignKey: 'id_aprendiz',
  as: 'aprendiz',
});

Apprentice.hasMany(FacialEnrollment, {
  foreignKey: 'id_aprendiz',
  as: 'enrolamientos_faciales',
});

FacialEnrollment.belongsTo(BiometricConsent, {
  foreignKey: 'id_consentimiento',
  as: 'consentimiento',
});

BiometricConsent.hasMany(FacialEnrollment, {
  foreignKey: 'id_consentimiento',
  as: 'enrolamientos_faciales',
});

FacialEnrollment.belongsTo(User, {
  foreignKey: 'enrolado_por',
  as: 'usuario_enrolador',
});

FacialEnrollment.belongsTo(User, {
  foreignKey: 'revocado_por',
  as: 'usuario_revocador',
});

FacialValidationAttempt.belongsTo(User, {
  foreignKey: 'id_usuario',
  as: 'usuario',
});

User.hasMany(FacialValidationAttempt, {
  foreignKey: 'id_usuario',
  as: 'intentos_validacion_facial',
});

FacialValidationAttempt.belongsTo(Apprentice, {
  foreignKey: 'id_aprendiz',
  as: 'aprendiz',
});

Apprentice.hasMany(FacialValidationAttempt, {
  foreignKey: 'id_aprendiz',
  as: 'intentos_validacion_facial',
});

FacialValidationAttempt.belongsTo(EducationalSession, {
  foreignKey: 'id_sesion_formacion',
  as: 'sesion',
});

EducationalSession.hasMany(FacialValidationAttempt, {
  foreignKey: 'id_sesion_formacion',
  as: 'intentos_validacion_facial',
});

FacialValidationAttempt.belongsTo(Attendance, {
  foreignKey: 'id_asistencia',
  as: 'asistencia',
});

Attendance.hasMany(FacialValidationAttempt, {
  foreignKey: 'id_asistencia',
  as: 'intentos_validacion_facial',
});

FacialValidationAttempt.belongsTo(FacialEnrollment, {
  foreignKey: 'id_enrolamiento_facial',
  as: 'enrolamiento_facial',
});

FacialEnrollment.hasMany(FacialValidationAttempt, {
  foreignKey: 'id_enrolamiento_facial',
  as: 'intentos_validacion_facial',
});

PrivilegedAudit.belongsTo(User, {
  foreignKey: 'id_usuario_responsable',
  as: 'responsable',
});

User.hasMany(PrivilegedAudit, {
  foreignKey: 'id_usuario_responsable',
  as: 'auditorias_privilegiadas',
});

// =========================
// Exportación
// =========================
module.exports = {
  sequelize,
  Role,
  User,
  Person,
  Instructor,
  Apprentice,
  EducationalArea,
  FormativeProgram,
  ClassCompetency,
  ProgramClassCompetency,
  CoordinatorArea,
  Environment,
  Group,
  GroupTrimester,
  JourneyBlock,
  EducationalSchedule,
  EducationalSession,
  IoTDevice,
  EnvironmentAccess,
  IoTAttendanceAttempt,
  ApprenticeGroup,
  InstructorGroup,
  Attendance,
  AttendanceEvidence,
  Observation,
  Alert,
  AlertObservation,
  AttendanceJustification,
  Notification,
  BiometricFingerprint,
  BiometricConsent,
  FacialEnrollment,
  FacialValidationAttempt,
  ValidAbsencesView,
  PrivilegedAudit,
};
