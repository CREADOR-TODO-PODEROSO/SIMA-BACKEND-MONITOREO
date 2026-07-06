const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PrivilegedAudit = sequelize.define(
  'PrivilegedAudit',
  {
    id_auditoria: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario_responsable: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    accion: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    entidad: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    id_entidad: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    valor_anterior: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    valor_nuevo: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    motivo: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    resultado: {
      type: DataTypes.ENUM('EXITOSO', 'FALLIDO'),
      allowNull: false,
      defaultValue: 'EXITOSO',
    },
    detalle_error: {
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
    tableName: 'auditoria_privilegiada',
    timestamps: false,
  }
);

module.exports = PrivilegedAudit;
