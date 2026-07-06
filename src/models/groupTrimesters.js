const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const GroupTrimester = sequelize.define(
  'GroupTrimester',
  {
    id_grupo_trimestre: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_grupo: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    numero_trimestre: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
    },
    fecha_inicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fecha_fin: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM('PROGRAMADO', 'ACTIVO', 'COMPLETADO', 'CANCELADO'),
      allowNull: false,
      defaultValue: 'PROGRAMADO',
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
    tableName: 'grupo_trimestre',
    timestamps: false,
  }
);

module.exports = GroupTrimester;
