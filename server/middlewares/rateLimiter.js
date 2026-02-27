const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'Too many OTP requests from this IP, please try again after 15 minutes',
});

module.exports = otpLimiter;
