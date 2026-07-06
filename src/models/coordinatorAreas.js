const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const CoordinatorArea = sequelize.define(
  'CoordinatorArea',
  {
    id_coordinador_area: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_area: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    asignado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    cerrado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    motivo_cierre: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: 'coordinador_area',
    timestamps: false,
  }
);

module.exports = CoordinatorArea;
