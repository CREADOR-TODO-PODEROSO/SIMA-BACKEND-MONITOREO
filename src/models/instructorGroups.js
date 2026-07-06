const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const InstructorGroup = sequelize.define(
  'InstructorGroup',
  {
    id_instructor_grupo: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_instructor: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_grupo: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    asignado_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: 'instructor_grupo',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['id_instructor', 'id_grupo'],
        name: 'uk_instructor_grupo_unico',
      },
    ],
  }
);

module.exports = InstructorGroup;
