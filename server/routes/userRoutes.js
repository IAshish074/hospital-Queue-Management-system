const express = require('express');
const { registerUser, loginUser, verifyOtp,resendOtp,logoutUser } = require('../controllers/userController');
const verifyJWT = require('../middlewares/auth'); // Import verifyJWT
const verifyOtpToken = require('../middlewares/verifyOtpToken');

const router = express.Router();

const otpLimiter = require('../middlewares/rateLimiter');



// Register new user (with OTP)
router.post('/register', registerUser);

// Login user (with OTP)
router.post('/login', loginUser);

// Verify OTP for user (after sending OTP)
router.post('/verify-otp',otpLimiter, verifyOtp);

// Resend OTP if expired or not received
router.post('/resend-otp', resendOtp);

// Example protected route (profile)
router.get('/profile', verifyJWT, (req, res) => {
    // Access user data from req.user
    res.json({ message: 'Profile data', user: req.user });
});

//Example protected route that requires verified OTP
router.get('/verifiedData', verifyJWT, verifyOtpToken, (req, res)=>{
    res.json({message: "verified data"})
})

router.post("/logout", logoutUser)
module.exports = router;