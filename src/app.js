const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const runtimeState = require('./config/runtimeState');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
const authRoutes = require('./routes/authroutes');
const usersRoutes = require('./routes/usersroutes');
const rolesRoutes = require('./routes/rolesroutes');
const permissionsRoutes = require('./routes/permissionsroutes');
const apprenticesRoutes = require('./routes/apprenticesroutes');
const attendancesRoutes = require('./routes/attendancesRoutes');
const justificationsRoutes = require('./routes/justificationsRoutes');
const educationalSessionsRoutes = require('./routes/educationalSessionsRoutes');
const educationalSchedulesRoutes = require('./routes/educationalSchedulesRoutes');
const environmentsRoutes = require('./routes/environmentsRoutes');
const observationsRoutes = require('./routes/observationsroutes');
const profileRoutes = require('./routes/profileRoutes');
const instructorGroupsRoutes = require('./routes/instructorGroupsRoutes');
const apprenticePortalRoutes = require('./routes/apprenticePortalRoutes');
const iotRoutes = require('./routes/iotRoutes');
const biometricFingerprintsRoutes = require('./routes/biometricFingerprintsRoutes');

// coordinacion
const dashboardRoutes = require('./routes/dashboardRoutes');
const coordinatorAreasRoutes = require('./routes/coordinatorAreasRoutes');
const groupsRoutes = require('./routes/groupsRoutes');
const formativeProgramsRoutes = require('./routes/formativeProgramsRoutes');

// alertas
const alertsRoutes = require('./routes/alertsroutes');
const notificationsRoutes = require('./routes/notificationsroutes');

const errorMiddleware = require('./middlewares/errormiddleware');

app.use(helmet());
const normalizeOrigin = (origin) => origin.replace(/\/$/, '');
const configuredCorsOrigins = env.CORS_ORIGIN === '*'
  ? ['*']
  : env.CORS_ORIGIN
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

const defaultAllowedOrigins = [
  'https://sima-frontend-orpin.vercel.app',
  'https://sima-theta.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const allowedCorsOrigins = new Set([
  ...configuredCorsOrigins,
  ...defaultAllowedOrigins,
]);

const isAllowedVercelPreview = (origin) => {
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === 'https:' && hostname.endsWith('.vercel.app');
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    if (
      allowedCorsOrigins.has('*') ||
      allowedCorsOrigins.has(normalizedOrigin) ||
      isAllowedVercelPreview(normalizedOrigin)
    ) {
      return callback(null, true);
    }

    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const path = require('path');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

app.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'API de control de acceso por roles funcionando',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'sima-backend-monitoreo',
    environment: env.NODE_ENV,
    uptime_seconds: Math.floor(process.uptime()),
    database_connected: runtimeState.database.connected,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/apprentices', apprenticesRoutes);
app.use('/api/attendances', attendancesRoutes);
app.use('/api/justifications', justificationsRoutes);
app.use('/api/educational-schedules', educationalSchedulesRoutes);
app.use('/api/educational-sessions', educationalSessionsRoutes);
app.use('/api/environments', environmentsRoutes);
app.use('/api/ambientes', environmentsRoutes);
app.use('/api/observations', observationsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/instructor-groups', instructorGroupsRoutes);
app.use('/api/apprentice-portal', apprenticePortalRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/biometrics/fingerprints', biometricFingerprintsRoutes);

// Rutas especificas para coordinadores
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/coordinator-areas', coordinatorAreasRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/formative-programs', formativeProgramsRoutes);

// Rutas para alertas
app.use('/api/alerts', alertsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use(errorMiddleware);

module.exports = app;
