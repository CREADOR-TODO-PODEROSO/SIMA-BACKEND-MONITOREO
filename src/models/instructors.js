const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Instructor = sequelize.define(
  'Instructor',
  {
    id_instructor: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
    },
    codigo_instructor: {
      type: DataTypes.STRING(30),
      allowNull: true,
      unique: true,
    },
    especialidad: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
  },
  {
    tableName: 'instructores',
    timestamps: false,
  }
);

module.exports = Instructor;