const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ProgramClassCompetency = sequelize.define(
  'ProgramClassCompetency',
  {
    id_programa_clase_competencia: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_programa: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_clase_competencia: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
    creado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'programa_clase_competencia',
    timestamps: false,
  }
);

module.exports = ProgramClassCompetency;
