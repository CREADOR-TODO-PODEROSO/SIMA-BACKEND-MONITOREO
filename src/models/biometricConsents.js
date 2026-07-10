const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BiometricConsent = sequelize.define(
  'BiometricConsent',
  {
    id_consentimiento: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    tipo_biometria: {
      type: DataTypes.ENUM('FACIAL'),
      allowNull: false,
    },
    version_politica: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    aceptado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    fecha_aceptacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_revocacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ip_origen: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    creado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    actualizado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'consentimientos_biometricos',
    timestamps: false,
  }
);

module.exports = BiometricConsent;
