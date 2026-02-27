const User = require('../models/User');
const { isOTPExpired } = require('../utils/otpUtils');

// Middleware to verify OTP
const verifyUserOtp = async (req, res, next) => {
  const { phone, email, otp } = req.body;

  try {
    // Find user by phone or email
    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Check if OTP is expired
    if (isOTPExpired(user.otpExpiresAt)) {
      return res.status(400).json({ message: 'OTP has expired, please request a new one.' });
    }

    // Check if OTP is correct
    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP!' });
    }

    // Proceed to the next middleware/controller
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
};

module.exports = { verifyUserOtp };
