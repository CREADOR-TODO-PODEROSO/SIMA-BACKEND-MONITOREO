const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const IoTDevice = sequelize.define(
  'IoTDevice',
  {
    id_dispositivo: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    codigo_dispositivo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    id_ambiente: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    tipo_dispositivo: {
      type: DataTypes.ENUM('ESP32_HUELLA'),
      allowNull: false,
      defaultValue: 'ESP32_HUELLA',
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO', 'MANTENIMIENTO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
    ultima_conexion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ultima_sincronizacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ultimo_fallo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    fecha_ultimo_fallo: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    fallos_consecutivos: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    fecha_recuperacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    creado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    actualizado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: 'dispositivos_iot',
    timestamps: false,
  }
);

module.exports = IoTDevice;
