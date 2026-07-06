const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const FormativeProgram = sequelize.define(
  'FormativeProgram',
  {
    id_programa: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_area: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    nombre_programa: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: 'programas_formacion',
    timestamps: false,
  }
);

module.exports = FormativeProgram;
