const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Route to book an appointment
router.post('/book', bookingController.bookAppointment);

module.exports = router;
