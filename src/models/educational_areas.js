const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const EducationalArea = sequelize.define(
  'EducationalArea',
  {
    id_area: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre_area: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: 'areas_formacion',
    timestamps: false,
  }
);

module.exports = EducationalArea;