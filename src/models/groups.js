const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Group = sequelize.define(
  'Group',
  {
    id_grupo: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    numero_ficha: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
    id_programa: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    jornada: {
      type: DataTypes.STRING(30),
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
    id_ambiente: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_instructor_lider: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM('EN_FORMACION', 'PRACTICAS', 'FINALIZADO'),
      allowNull: false,
      defaultValue: 'EN_FORMACION',
    },
    trimestres: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
  },
  {
    tableName: 'grupos_formativos',
    timestamps: false,
  }
);

module.exports = Group;
