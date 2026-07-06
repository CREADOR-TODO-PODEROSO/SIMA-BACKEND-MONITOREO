const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define(
  'Notification',
  {
    id_notificacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_usuario: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_alerta: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_observacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_sesion_formacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_justificacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    id_intento_iot: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    titulo: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    mensaje: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    tipo: {
      type: DataTypes.ENUM('ALERTA', 'OBSERVACION', 'ASISTENCIA', 'SESION', 'JUSTIFICACION', 'IOT', 'SISTEMA'),
      allowNull: false,
    },
    leida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    fecha_envio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_lectura: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'notificaciones',
    timestamps: false,
  }
);

module.exports = Notification;
