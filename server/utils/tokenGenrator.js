const crypto = require('crypto');

const generateSecureTokenNumber = () => {
  return crypto.randomBytes(4).toString('hex').slice(0, 8); // 8 hex chars = 8-digit string
};

module.exports = generateSecureTokenNumber;
