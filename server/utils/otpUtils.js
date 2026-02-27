const otpGenerator = require('otp-generator');

// Generate a 6-digit numeric OTP
const generateOTP = () => {
  return otpGenerator.generate(6, {
    digits:true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false
  });
};

// Check if OTP is expired
const isOTPExpired = (otpExpiresAt) => {
  return new Date() > otpExpiresAt;
};

module.exports = {
  generateOTP,
  isOTPExpired,
};