const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BiometricFingerprint = sequelize.define(
  'BiometricFingerprint',
  {
    id_huella: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_dispositivo_enrolamiento: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    plantilla_biometrica_cifrada: {
      type: DataTypes.BLOB,
      allowNull: false,
    },
    plantilla_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    calidad_captura: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
    },
    dedo: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    fecha_enrolamiento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    enrolado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM('ACTIVA', 'REVOCADA'),
      allowNull: false,
      defaultValue: 'ACTIVA',
    },
    fecha_revocacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revocada_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    motivo_revocacion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'huellas_biometricas',
    timestamps: false,
  }
);

module.exports = BiometricFingerprint;
