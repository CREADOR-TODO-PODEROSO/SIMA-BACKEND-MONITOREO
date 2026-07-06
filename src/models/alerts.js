const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Alert = sequelize.define(
  'Alert',
  {
    id_alerta: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_aprendiz: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_grupo: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    tipo_alerta: {
      type: DataTypes.ENUM('ASISTENCIAL', 'OBSERVACIONES_RECURRENTES', 'CONVIVENCIAL'),
      allowNull: false,
    },
    regla_disparo: {
      type: DataTypes.ENUM('3_CONSECUTIVAS', '5_TRIMESTRE', 'OBSERVACIONES_RECURRENTES', 'MANUAL'),
      allowNull: true,
    },
    origen: {
      type: DataTypes.ENUM('AUTOMATICA', 'MANUAL'),
      allowNull: false,
    },
    severidad: {
      type: DataTypes.ENUM('LEVE', 'MODERADA', 'GRAVE', 'CRITICA'),
      allowNull: false,
      defaultValue: 'MODERADA',
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM('ABIERTA', 'CERRADA'),
      allowNull: false,
      defaultValue: 'ABIERTA',
    },
    fecha_alerta: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_inicio_evaluada: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fecha_fin_evaluada: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fecha_ultima_evaluacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    creada_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    justificacion_cierre: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fecha_cierre: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cerrada_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    justificacion_reapertura: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fecha_reapertura: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reabierta_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
  },
  {
    tableName: 'alertas',
    timestamps: false,
  }
);

module.exports = Alert;
