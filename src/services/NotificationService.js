const { Notification } = require('../models');

class NotificationService {
  static clients = new Map();

  static _normalize(notification) {
    if (!notification) return null;
    const data = typeof notification.toJSON === 'function' ? notification.toJSON() : notification;
    return {
      ...data,
      id: data.id_notificacion,
      alertaId: data.id_alerta,
      fecha: data.fecha_envio,
      leida: Boolean(data.leida),
    };
  }

  static _emitToUser(id_usuario, notification) {
    const clients = this.clients.get(String(id_usuario));
    if (!clients?.size) return;

    const payload = JSON.stringify(this._normalize(notification));
    for (const res of clients) {
      res.write(`event: notification\n`);
      res.write(`data: ${payload}\n\n`);
    }
  }

  static addClient(req, res) {
    const idUsuario = String(req.user.id_usuario);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (!this.clients.has(idUsuario)) this.clients.set(idUsuario, new Set());
    this.clients.get(idUsuario).add(res);

    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ ok: true })}\n\n`);

    req.on('close', () => {
      const clients = this.clients.get(idUsuario);
      if (!clients) return;
      clients.delete(res);
      if (!clients.size) this.clients.delete(idUsuario);
    });
  }

  static async listForUser(user, filters = {}) {
    const limit = Math.min(Number(filters.limit) > 0 ? Number(filters.limit) : 20, 50);
    const rows = await Notification.findAll({
      where: { id_usuario: user.id_usuario },
      order: [['fecha_envio', 'DESC']],
      limit,
    });

    return rows.map((row) => this._normalize(row));
  }

  static async markAsRead(id, user) {
    const notification = await Notification.findOne({
      where: { id_notificacion: id, id_usuario: user.id_usuario },
    });
    if (!notification) throw { status: 404, message: 'Notificacion no encontrada' };

    if (!notification.leida) {
      await notification.update({ leida: true, fecha_lectura: new Date() });
    }

    return this._normalize(notification);
  }

  static async markAllAsRead(user) {
    await Notification.update(
      { leida: true, fecha_lectura: new Date() },
      { where: { id_usuario: user.id_usuario, leida: false } }
    );

    return this.listForUser(user);
  }

  static async createForUser({ id_usuario, id_alerta, titulo, mensaje, tipo = 'ALERTA', transaction = null }) {
    const where = { id_usuario, id_alerta, titulo, mensaje, tipo, leida: false };
    const existing = await Notification.findOne({ where, transaction });
    if (existing) return existing;

    const notification = await Notification.create(
      { id_usuario, id_alerta, titulo, mensaje, tipo, leida: false },
      { transaction }
    );

    if (transaction?.afterCommit) {
      transaction.afterCommit(() => this._emitToUser(id_usuario, notification));
    } else {
      this._emitToUser(id_usuario, notification);
    }

    return notification;
  }
}

module.exports = NotificationService;
