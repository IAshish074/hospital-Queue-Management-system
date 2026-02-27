const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const Queue = require('../models/Queue');
// const { sendSMS } = require('../utils/sendSms');
// const { notifyNextInQueue } = require('../utils/notifyNext');
const generateSecureTokenNumber = require('../utils/tokenGenrator');
const{predictAppointmentTime}=require('../utils/mLIntegration')
const { sendEmail } = require('../utils/mailer');
const moment = require('moment');
const { generateOTP, isOTPExpired } = require('../utils/otpUtils');
// Check Queue status
const checkStatus = async (req, res) => {
  try {
    const queue = await Queue.findById(req.queueId);
    if (!queue) return res.status(404).json({ error: 'Queue not found' });

    const allConfirmed = await Queue.find({
      doctorId: queue.doctorId,
      status: 'Confirmed',
    }).sort({ createdAt: 1 });

    const position = allConfirmed.findIndex(q => q._id.equals(queue._id)) + 1;

    res.status(200).json({
      status: queue.status,
      queue,
      position,
      totalConfirmed: allConfirmed.length,
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({ error: 'Error fetching queue status' });
  }
};

// Book Queue
const bookQueue = async (req, res) => {
  try {
    const {
      patientName,
      age,
      diseaseDescription,
      fee,
      emergency,
      phoneNumber,
      doctorId,
      hospitalId,
      email
    } = req.body;

    const otp = generateOTP();

    // Optionally save OTP in some temp store (e.g., Redis or in-memory)

    await sendEmail(email, `Your OTP for queue booking is: ${otp}`);

    return res.status(200).json({
      message: 'OTP sent to email!',
      otp, // frontend ke liye testing phase mein rakh lo, production mein hata dena
      tempBookingData: {
        patientName,
        age,
        diseaseDescription,
        emergency,
        phoneNumber,
        doctorId,
        hospitalId,
        fee
      },
      actualOtp: otp
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }

};

// Verify OTP


const verifyOtp = async (req, res) => {
  try {
    const {
      otp,
      actualOtp,
      patientName,
      age,
      diseaseDescription,
      fee,
      emergency,
      bookingType,
      email,
      phoneNumber,
      doctorId,
      hospitalId,
    } = req.body;

    if (otp !== actualOtp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    const hospital = await Hospital.findById(hospitalId);

    const tokenNumber = generateSecureTokenNumber();

    const existingBookings = await Queue.find({ doctorId, status: 'Booked' });

    let estimatedStartTime;
    const now = new Date(); // current date and time

    // 1. Handle Emergency Bookings First
    if (emergency) {
      if (doctor.emergencyBookingsToday >= doctor.emergencySlotsPerDay) {
        return res.status(400).json({ error: 'Emergency booking limit reached for today' });
      }
      estimatedStartTime = now;  // Assign the earliest available time
      doctor.emergencyBookingsToday += 1;  // Increment the count of emergency bookings
    } else {
      // 2. Handle Normal Bookings: Calculate the estimated time considering existing bookings
      const predictedTime = await calculateBookingTime(existingBookings, doctor);
      estimatedStartTime = predictedTime || now; // Fallback to current time if no predictions
    }

    // 3. Create the booking record in the Queue model
    const queue = new Queue({
      patientName,
      age,
      diseaseDescription,
      phoneNumber,
      doctorId,
      hospitalId,
      email,
      tokenNumber,
      status: 'Booked',
      estimatedStartTime: estimatedStartTime,
      bookingDate: now,
      bookingTime: now,
      bookingType,
      fee,
      emergency,
      otp
    });

    await queue.save();

    // 4. Update doctor slots and emergency bookings
    await updateDoctorSlots(doctor, estimatedStartTime, emergency);

    const bookingMessage = `Your queue token is ${tokenNumber}. You can visit Dr. ${doctor.name} at ${hospital.name}. Patient: ${patientName}, Age: ${age}, Disease: ${diseaseDescription}. Estimated visit time: ${estimatedStartTime}`;
    await sendEmail(email, bookingMessage);

    res.status(200).json({
      message: 'Booking successful after OTP verification!',
      tokenNumber,
      estimatedStartTime,
      doctorName: doctor.name,
      hospitalName: hospital.name,
      emergency,
      status: 'Booked',
      bookingType: doctor.bookingType,
    });
  } catch (error) {
    console.error('Booking after OTP failed:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// Function to calculate the predicted appointment time based on the queue and doctor slots
const calculateBookingTime = async (existingBookings, doctor) => {
  let predictedTime = null;

  if (existingBookings.length === 0) {
    if (doctor.availableSlots[0].bookingsMade < doctor.availableSlots[0].maxBookings) {
      predictedTime = doctor.availableSlots[0].startTime;
    }
  } else {
    // Sort the existing bookings by the 'emergency' flag (priority queue logic)
    existingBookings.sort((a, b) => (a.emergency === b.emergency) ? 0 : a.emergency ? -1 : 1);
    
    // Calculate the predicted time based on the sorted queue
    predictedTime = existingBookings[existingBookings.length - 1].estimatedStartTime;
  }

  return predictedTime;
};

// Function to update doctor's available slots based on the booking
const updateDoctorSlots = async (doctor, predictedTime, emergency) => {
  const updatedSlots = doctor.availableSlots.map((slot) => {
    const slotStart = slot.startTime;
    const slotEnd = slot.endTime;
    const predictedDate = new Date(predictedTime);

    // Check if predicted time is within the slot range
    if (predictedDate >= new Date(slotStart) && predictedDate <= new Date(slotEnd)) {
      if (slot.bookingsMade < slot.maxBookings) {
        return { ...slot, bookingsMade: slot.bookingsMade + 1 };
      }
    }

    return slot;
  });

  doctor.availableSlots = updatedSlots;
  doctor.markModified('availableSlots');
  await doctor.save();
};

// Update Queue Status


const getQueuePosition = async (req, res) => {
  const { queueId } = req.params;

  try {
    const queue = await Queue.findById(queueId);
    if (!queue) return res.status(404).json({ error: 'Queue not found' });

    const doctorId = queue.doctorId;

    // Find all booked/confirmed patients for same doctor, sorted by bookingTime
    const allQueues = await Queue.find({
      doctorId,
      status: { $in: ['Booked', 'Confirmed'] }
    }).sort({ estimatedStartTime: 1 });

    const position = allQueues.findIndex(q => q._id.toString() === queueId) + 1;
    const peopleAhead = position - 1;

    res.status(200).json({
      tokenNumber: queue.tokenNumber,
      estimatedStartTime: queue.estimatedStartTime,
      position,
      peopleAhead
    });
  } catch (error) {
    console.error('Error in getQueuePosition:', error);
    res.status(500).json({ error: 'Failed to fetch position info' });
  }
};


module.exports = { checkStatus, bookQueue, verifyOtp,getQueuePosition };
