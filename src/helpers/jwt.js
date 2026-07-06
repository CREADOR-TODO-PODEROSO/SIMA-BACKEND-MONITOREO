const jwt = require('jsonwebtoken');
const env = require('../config/env');

const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

module.exports = {
  verifyToken,
};