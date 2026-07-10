const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Attendance = sequelize.define(
  'Attendance',
  {
    id_asistencia: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    id_sesion_formacion: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_aprendiz: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    id_acceso: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    estado_asistencia: {
      type: DataTypes.ENUM('PENDIENTE', 'PRESENTE', 'TARDE', 'INASISTENCIA', 'JUSTIFICADO'),
      allowNull: false,
      defaultValue: 'PENDIENTE',
    },
    hora_registro: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    origen: {
      type: DataTypes.ENUM('QR', 'IOT_HUELLA', 'MANUAL', 'AUTOMATICO_CIERRE', 'JUSTIFICACION', 'CORRECCION'),
      allowNull: true,
    },
    observacion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    anulada: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    fecha_anulacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    anulada_por: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    motivo_anulacion: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    creado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    actualizado_en: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'asistencias',
    timestamps: false,
  }
);

// Hooks para integracion automatica del motor de alertas
Attendance.addHook('afterCreate', (attendance, options) => {
  if (['INASISTENCIA', 'JUSTIFICADO'].includes(attendance.estado_asistencia)) {
    // Desacoplado (Bloque 2): Se encola en el Event Loop para no bloquear la transacción actual
    setImmediate(() => {
      const AlertService = require('../services/AlertService');
      AlertService.evaluateInattendanceAlert(attendance.id_aprendiz).catch(err => {
        console.error('Error al evaluar alerta de inasistencia despues de creacion (async):', err);
      });
    });
  }
});

Attendance.addHook('afterUpdate', (attendance, options) => {
  if (attendance.changed('estado_asistencia')) {
    // Desacoplado (Bloque 2): Se encola en el Event Loop para no bloquear la transacción actual
    setImmediate(() => {
      const AlertService = require('../services/AlertService');
      AlertService.evaluateInattendanceAlert(attendance.id_aprendiz).catch(err => {
        console.error('Error al evaluar alerta de inasistencia despues de actualizacion (async):', err);
      });
    });
  }
});

module.exports = Attendance;
