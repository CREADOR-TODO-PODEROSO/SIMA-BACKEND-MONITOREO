const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const FacialEnrollment = sequelize.define(
  'FacialEnrollment',
  {
    id_enrolamiento_facial: {
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
    id_consentimiento: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'REVOCADO', 'PENDIENTE_VERIFICACION', 'RECHAZADO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
    embedding_cifrado: {
      type: DataTypes.BLOB('long'),
      allowNull: false,
    },
    embedding_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    modelo_version: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    proveedor: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'SIMA_LOCAL_CONTRACT',
    },
    calidad_captura: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: true,
    },
    liveness_score: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
    },
    enrolado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    fecha_enrolamiento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    revocado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    fecha_revocacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    motivo_revocacion: {
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
    tableName: 'enrolamientos_faciales',
    timestamps: false,
  }
);

module.exports = FacialEnrollment;
