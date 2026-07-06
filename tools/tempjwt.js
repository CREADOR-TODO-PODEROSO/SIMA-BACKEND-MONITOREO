const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id_usuario: 1 },
  'clave_secreta',
  { expiresIn: '1d' }
);

console.log(token);