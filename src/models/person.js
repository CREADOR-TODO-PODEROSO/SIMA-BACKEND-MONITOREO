const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Person = sequelize.define(
  'Person',
  {
    id_persona: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
    },
    tipo_documento: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    numero_documento: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    nombres: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    apellidos: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    telefono: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  },
  {
    tableName: 'personas',
    timestamps: false,
  }
);

module.exports = Person;