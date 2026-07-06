const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ClassCompetency = sequelize.define(
  'ClassCompetency',
  {
    id_clase_competencia: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre_competencia: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    tipo_competencia: {
      type: DataTypes.ENUM('FORMATIVA', 'TRANSVERSAL'),
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM('ACTIVA', 'INACTIVA'),
      allowNull: false,
      defaultValue: 'ACTIVA',
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
    tableName: 'clases_competencias',
    timestamps: false,
  }
);

module.exports = ClassCompetency;
