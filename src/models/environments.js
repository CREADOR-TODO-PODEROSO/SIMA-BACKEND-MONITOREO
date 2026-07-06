const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Environment = sequelize.define(
  'Environment',
  {
    id_ambiente: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre_ambiente: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    ubicacion: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    capacidad: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'MANTENIMIENTO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
  },
  {
    tableName: 'ambientes',
    timestamps: false,
  }
);

module.exports = Environment;