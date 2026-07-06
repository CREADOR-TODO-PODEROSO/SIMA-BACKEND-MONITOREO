const { errorResponse } = require('../helpers/response');

const notImplemented = async (_req, res) => {
  return errorResponse(
    res,
    'Este modulo no esta disponible en esta version del proyecto. El control de acceso se gestiona por roles.',
    501
  );
};

module.exports = {
  notImplemented,
};
