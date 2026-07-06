const NotificationService = require('../services/NotificationService');
const { successResponse, errorResponse } = require('../helpers/response');

const getNotifications = async (req, res) => {
  try {
    const notifications = await NotificationService.listForUser(req.user, req.query);
    return successResponse(res, 'Notificaciones consultadas correctamente', { notificaciones: notifications });
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar notificaciones', error.status || 500);
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id, req.user);
    return successResponse(res, 'Notificacion marcada como leida', { notificacion: notification });
  } catch (error) {
    return errorResponse(res, error.message || 'Error al marcar la notificacion', error.status || 500);
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const notifications = await NotificationService.markAllAsRead(req.user);
    return successResponse(res, 'Notificaciones marcadas como leidas', { notificaciones: notifications });
  } catch (error) {
    return errorResponse(res, error.message || 'Error al marcar notificaciones', error.status || 500);
  }
};

const streamNotifications = (req, res) => {
  NotificationService.addClient(req, res);
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  streamNotifications,
};
