const errorMiddleware = (err, req, res, next) => {
  console.error(err);

  return res.status(err.status || 500).json({
    ok: false,
    message: err.message || 'Error interno del servidor',
  });
};

module.exports = errorMiddleware;