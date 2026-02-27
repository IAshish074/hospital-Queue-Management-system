const express = require('express');
const router = express.Router();
const verifyOtpToken = require('../middlewares/verifyOtpToken');
const otpLimiter = require('../middlewares/rateLimiter');

const {
  checkStatus,
  bookQueue,
  verifyOtp,
  getQueuePosition,getQueueByTokenNumber
} = require('../controllers/queueBookingController');

// Route to check status
router.get('/status', verifyOtpToken, checkStatus);

// Route to book queue
router.post('/bookQueue', bookQueue);

// Route to verify OTP
router.post('/verifyOtp', otpLimiter, verifyOtp);



router.get('/queue-position/:queueId', getQueuePosition);
router.get('/queue-by-token/:tokenNumber', getQueueByTokenNumber);

module.exports = router;
