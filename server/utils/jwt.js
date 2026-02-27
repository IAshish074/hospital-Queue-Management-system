const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;

const generateAccessToken = (payload) => {
  return jwt.sign(payload, secret, { expiresIn: '2h' }); // for login/session
};

const generateOtpToken = (payload) => {
  return jwt.sign(payload, secret, { expiresIn: '15m' }); // for OTP
};

const verifyToken = (token) => {
  return jwt.verify(token, secret);
};

module.exports = {
  generateAccessToken,
  generateOtpToken,
  verifyToken,
};
