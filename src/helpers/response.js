const successResponse = (res, message, data = null, status = 200) => {
  return res.status(status).json({
    ok: true,
    message,
    data,
  });
};

const errorResponse = (res, message, status = 500, errors = null) => {
  return res.status(status).json({
    ok: false,
    message,
    errors,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};