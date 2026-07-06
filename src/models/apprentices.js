const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Apprentice = sequelize.define(
  'Apprentice',
  {
    id_aprendiz: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
    },
    estado_formativo: {
      type: DataTypes.ENUM(
        'EN_FORMACION',
        'CONDICIONADO',
        'CANCELADO',
        'APLAZADO',
        'CERTIFICADO'
      ),
      allowNull: false,
      defaultValue: 'EN_FORMACION',
    },
    estado: {
      type: DataTypes.ENUM('ACTIVO', 'INACTIVO'),
      allowNull: false,
      defaultValue: 'ACTIVO',
    },
  },
  {
    tableName: 'aprendices',
    timestamps: false,
  }
);

module.exports = Apprentice;