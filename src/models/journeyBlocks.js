const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const JourneyBlock = sequelize.define(
  'JourneyBlock',
  {
    id_bloque_jornada: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    jornada: {
      type: DataTypes.ENUM('MANANA', 'TARDE', 'NOCHE', 'SABADO'),
      allowNull: false,
    },
    nombre_bloque: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    orden: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
    },
    hora_inicio: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    hora_fin: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
  },
  {
    tableName: 'bloques_jornada',
    timestamps: false,
  }
);

module.exports = JourneyBlock;
