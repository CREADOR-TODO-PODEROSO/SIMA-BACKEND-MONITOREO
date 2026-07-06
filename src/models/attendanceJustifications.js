const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AttendanceJustification = sequelize.define(
  'AttendanceJustification',
  {
    id_justificacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_asistencia: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_aprendiz: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    archivo_url: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    archivo_nombre_original: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    archivo_mime: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    archivo_tamano_bytes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    archivo_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    comentario_aprendiz: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM('PENDIENTE', 'APROBADA', 'RECHAZADA'),
      allowNull: false,
      defaultValue: 'PENDIENTE',
    },
    fecha_envio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    revisada_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    fecha_revision: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    comentario_instructor: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'justificaciones_asistencia',
    timestamps: false,
  }
);

// Hooks para integracion automatica del motor de alertas
AttendanceJustification.addHook('afterCreate', async (justification, options) => {
  try {
    const AlertService = require('../services/AlertService');
    await AlertService.evaluateInattendanceAlert(justification.id_aprendiz);
  } catch (err) {
    console.error('Error al evaluar alerta de inasistencia tras creacion de justificacion:', err);
  }
});

AttendanceJustification.addHook('afterUpdate', async (justification, options) => {
  if (justification.changed('estado')) {
    try {
      const AlertService = require('../services/AlertService');
      await AlertService.evaluateInattendanceAlert(justification.id_aprendiz);
    } catch (err) {
      console.error('Error al evaluar alerta de inasistencia tras actualizacion de justificacion:', err);
    }
  }
});

module.exports = AttendanceJustification;
