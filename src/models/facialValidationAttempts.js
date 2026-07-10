const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const FacialValidationAttempt = sequelize.define(
  'FacialValidationAttempt',
  {
    id_intento_facial: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_aprendiz: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_sesion_formacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_asistencia: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_enrolamiento_facial: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    resultado: {
      type: DataTypes.ENUM('APROBADO', 'RECHAZADO', 'NO_DISPONIBLE', 'LIVENESS_FALLIDO', 'ERROR'),
      allowNull: false,
    },
    motivo: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    proveedor: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    modelo_version: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    score_match: {
      type: DataTypes.DECIMAL(6, 5),
      allowNull: true,
    },
    liveness_result: {
      type: DataTypes.ENUM('PASSED', 'BASIC_PASSED', 'FAILED', 'NOT_AVAILABLE'),
      allowNull: false,
      defaultValue: 'NOT_AVAILABLE',
    },
    device_uuid: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    challenge_nonce: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    fecha_intento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    detalle: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'intentos_validacion_facial',
    timestamps: false,
  }
);

module.exports = FacialValidationAttempt;
