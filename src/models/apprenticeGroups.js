const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ApprenticeGroup = sequelize.define(
  'ApprenticeGroup',
  {
    id_aprendiz_grupo: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_aprendiz: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_grupo: {
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
  },
  {
    tableName: 'aprendiz_grupo',
    timestamps: false,
  }
);

module.exports = ApprenticeGroup;
