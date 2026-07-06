const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AttendanceEvidence = sequelize.define(
  'AttendanceEvidence',
  {
    id_evidencia_asistencia: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_asistencia: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    metodo: {
      type: DataTypes.ENUM('QR', 'IOT_HUELLA', 'MANUAL', 'BIOMETRIA_MOVIL', 'GEOLOCALIZACION', 'FACIAL_SIMA', 'CORRECCION', 'JUSTIFICACION'),
      allowNull: false,
    },
    resultado: {
      type: DataTypes.ENUM('APROBADA', 'RECHAZADA', 'PENDIENTE'),
      allowNull: false,
      defaultValue: 'APROBADA',
    },
    fecha_registro: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    id_usuario_registra: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_dispositivo: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_acceso: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_intento_iot: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    latitud: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitud: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    precision_metros: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    distancia_metros: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    dentro_rango: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    qr_token_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    detalle: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'evidencias_asistencia',
    timestamps: false,
  }
);

module.exports = AttendanceEvidence;
