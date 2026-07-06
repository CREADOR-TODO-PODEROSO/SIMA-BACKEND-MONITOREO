const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(
  env.DB_NAME,
  env.DB_USER,
  env.DB_PASSWORD,
  {
    host: env.DB_HOST,
    port: env.DB_PORT,
    dialect: 'mysql',
    logging: false,
    timezone: '-05:00',
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: env.DB_SSL
      ? {
          ssl: {
            rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
          },
        }
      : {},
  }
);

module.exports = sequelize;
