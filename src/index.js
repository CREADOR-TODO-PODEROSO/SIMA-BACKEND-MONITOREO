const app = require('./app');
const { sequelize } = require('./models');
const env = require('./config/env');
const runtimeState = require('./config/runtimeState');

const startServer = async () => {
  let scheduler = null;

  console.log(
    `Configuracion de arranque: node_env=${env.NODE_ENV}, port=${env.PORT}, db_host=${env.DB_HOST}, db_name=${env.DB_NAME}, jwt_configurado=${Boolean(env.JWT_SECRET)}`
  );

  const connectDatabase = async () => {
    await sequelize.authenticate();
    runtimeState.database.connected = true;
    runtimeState.database.lastError = null;
    runtimeState.database.checkedAt = new Date().toISOString();
    console.log('Conexion a la base de datos establecida correctamente');

    const EducationalSessionService = require('./services/EducationalSessionService');
    scheduler = setInterval(async () => {
      try {
        await EducationalSessionService.autoOpenSessions();
        await EducationalSessionService.autoCloseSessions();
      } catch (error) {
        console.error(
          'Error en planificador automatico de sesiones:',
          error.message
        );
      }
    }, 5 * 60 * 1000);
  };

  const server = app.listen(env.PORT, () => {
    console.log(`Servidor ejecutandose en puerto ${env.PORT}`);
  });

  connectDatabase().catch((error) => {
    runtimeState.database.connected = false;
    runtimeState.database.lastError = error.message;
    runtimeState.database.checkedAt = new Date().toISOString();
    console.error('Error conectando a la base de datos:', error.message);
  });

  try {
    const shutdown = async (signal) => {
      console.log(`${signal} recibido. Cerrando servidor...`);
      if (scheduler) clearInterval(scheduler);

      server.close(async () => {
        try {
          await sequelize.close();
          process.exit(0);
        } catch (error) {
          console.error(
            'Error cerrando la conexion a la base de datos:',
            error.message
          );
          process.exit(1);
        }
      });
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();
