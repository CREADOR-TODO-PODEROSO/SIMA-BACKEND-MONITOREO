const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const EnvironmentAccess = sequelize.define(
  'EnvironmentAccess',
  {
    id_acceso: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_dispositivo: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    tipo_evento: {
      type: DataTypes.ENUM('ENTRADA', 'SALIDA', 'INTENTO_FALLIDO'),
      allowNull: false,
    },
    resultado: {
      type: DataTypes.ENUM('PERMITIDO', 'DENEGADO'),
      allowNull: false,
    },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    observacion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sincronizado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'accesos_ambiente',
    timestamps: false,
  }
);

module.exports = EnvironmentAccess;