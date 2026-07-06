const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const IoTAttendanceAttempt = sequelize.define(
  'IoTAttendanceAttempt',
  {
    id_intento_iot: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_dispositivo: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_sesion_formacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_asistencia: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    tipo_intento: {
      type: DataTypes.ENUM('ASISTENCIA', 'ENROLAMIENTO', 'REVOCACION', 'CONEXION', 'SINCRONIZACION', 'FALLO'),
      allowNull: false,
    },
    resultado: {
      type: DataTypes.ENUM('EXITOSO', 'FALLIDO', 'RECHAZADO', 'RECUPERADO'),
      allowNull: false,
    },
    calidad_captura: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true,
    },
    evento_uuid: {
      type: DataTypes.STRING(36),
      allowNull: false,
      unique: true,
    },
    nonce: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    firma_evento: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    fecha_origen: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expira_en: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    motivo: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    detalle: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    fecha_evento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'intentos_asistencia_iot',
    timestamps: false,
  }
);

module.exports = IoTAttendanceAttempt;
