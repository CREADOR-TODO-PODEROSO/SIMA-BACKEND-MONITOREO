const bcrypt = require('bcrypt');

const hashPassword = async (plainText) => {
  return bcrypt.hash(plainText, 10);
};

const comparePassword = async (plainText, hashed) => {
  return bcrypt.compare(plainText, hashed);
};

module.exports = {
  hashPassword,
  comparePassword,
};