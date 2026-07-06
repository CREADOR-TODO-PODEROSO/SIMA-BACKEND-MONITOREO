const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Observation = sequelize.define(
  'Observation',
  {
    id_observacion: {
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
    id_instructor: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    tipo_observacion: {
      type: DataTypes.ENUM('ACADEMICA', 'CONVIVENCIAL'),
      allowNull: false,
    },
    severidad: {
      type: DataTypes.ENUM('LEVE', 'MODERADA', 'GRAVE'),
      allowNull: false,
      defaultValue: 'MODERADA',
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    fecha_observacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_cierre: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM('ABIERTA', 'CERRADA'),
      allowNull: false,
      defaultValue: 'ABIERTA',
    },
  },
  {
    tableName: 'observaciones',
    timestamps: false,
  }
);

module.exports = Observation;
