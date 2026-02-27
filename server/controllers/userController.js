const User = require('../models/User');
const { generateOTP, isOTPExpired } = require('../utils/otpUtils');
const { sendEmail } = require('../utils/mailer');
const { sendSms } = require('../utils/sendSms');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOtpToken, generateAccessToken } = require('../utils/jwt');

// Register User and Send OTP
const registerUser = async (req, res) => {
  // Input validation
  await body('name').notEmpty().withMessage('Name is required').run(req);
  await body('phone').notEmpty().withMessage('Phone is required').run(req);
  await body('email').isEmail().withMessage('Valid email is required').run(req);
  await body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters').run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, phone, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists!' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save new user
    const newUser = new User({
      name,
      phone,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(200).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
};

// Login User and Send OTP (using only email and password)
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Compare password
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: 'Invalid credentials!' });
    }

    // Generate OTP and update OTP-related fields
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 1 * 60 * 1000); // OTP expires in 10 minutes
    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;

    // Save updated user data
    await user.save();

    // Send OTP via SMS or Email
    // const sendSmsResult = await sendSms(user.phone, `Your OTP is ${otp}`);
    const sendEmailResult = await sendEmail(user.email, 'Your OTP Code', `Your OTP is ${otp}`);

    if (!sendEmailResult) {
      return res.status(500).json({ message: 'Failed to send OTP via Email' });
    }

    

    res.status(200).json({ message: 'OTP sent to email for verification.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
};
// resend Otp

const resendOtp = async (req, res) => {
  const { phone, email } = req.body;

  // Call this function before proceeding with the new login process.
  
  try {
    // Find user by phone or email
    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Check if OTP is expired
    if (!isOTPExpired(user.otpExpiresAt)) {
      return res.status(400).json({ message: 'OTP is still valid, please use the existing OTP.' });
    }

    // Generate new OTP and set new expiry time
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes
    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;

    // Save the updated user data
    await user.save();

    // Send OTP via SMS or Email
    // const sendSmsResult = await sendSms(user.phone, `Your OTP is ${otp}`);
    const sendEmailResult = await sendEmail(user.email, 'Your OTP Code', `Your OTP is ${otp}`);
    
    if (!sendEmailResult) {
      return res.status(500).json({ message: 'Failed to send OTP via Email.' });
    }

    res.status(200).json({ message: 'OTP resent successfully.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
};



// Verify OTP
// Verify OTP
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
 console.log(email,otp)
  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // Check if OTP is expired
    if (isOTPExpired(user.otpExpiresAt)) {
      return res.status(400).json({ message: 'OTP has expired, please request a new one.' });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP!' });
    }

    // Mark the user as verified
    user.isVerified = true;
    await user.save();

    // Generate authentication token for the user
    const token = jwt.sign({ userId: user._id,email:user.email }, process.env.JWT_SECRET,{ expiresIn: "1h" } );

    // Set authentication token in cookie
 res.cookie("token", token, {
  httpOnly: false,
  secure: true,
  sameSite: "None",
  maxAge: 60 * 60 * 1000,
});


    // // Redirect based on the role sent from the frontend
    // if (role === 'admin') {
    //   return res.status(200).json({ message: 'OTP verified successfully! Redirecting to Admin Dashboard.' });
    // } else if (role === 'user') {
    //   return res.status(200).json({ message: 'OTP verified successfully! Redirecting to User Dashboard.' });
    // }

    res.status(200).json({ message: "OTP verified successfully!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
};



// Logout User
const logoutUser = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true, // true if using HTTPS
    sameSite: "Lax",
  });
  res.status(200).json({ message: "Logged out successfully." });
};

module.exports = { registerUser, loginUser, verifyOtp,resendOtp, logoutUser };
