const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AlertObservation = sequelize.define(
  'AlertObservation',
  {
    id_alerta_observacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_alerta: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_observacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
    },
    asociada_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    fecha_asociacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'alerta_observaciones',
    timestamps: false,
  }
);

module.exports = AlertObservation;
