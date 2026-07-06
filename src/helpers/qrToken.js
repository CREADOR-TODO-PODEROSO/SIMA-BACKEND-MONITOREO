const crypto = require('crypto');

const generateQrToken = () => crypto.randomBytes(32).toString('base64url');

const hashQrToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const verifyQrToken = (token, expectedHash) => {
  if (!token || !expectedHash) return false;

  const candidateHash = hashQrToken(token);
  const left = Buffer.from(candidateHash, 'hex');
  const right = Buffer.from(String(expectedHash), 'hex');

  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

module.exports = {
  generateQrToken,
  hashQrToken,
  verifyQrToken,
};
