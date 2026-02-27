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
      bookingDate = new Date()
    } = req.body;

    if (otp !== actualOtp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
   console.log(req.body)
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
   console.log(doctor)
    const dayOfWeek = new Date(bookingDate).toLocaleDateString('en-US', { weekday: 'long' });
    const slotIndex = doctor.availableSlots.findIndex(slot => slot.day === dayOfWeek);
    if (slotIndex === -1) {
      return res.status(400).json({ error: 'Doctor not available on this day' });
    }

    if (!doctor.checkSlotAvailability(slotIndex, emergency)) {
      return res.status(400).json({
        error: emergency ? 'Emergency slots full for today' : 'No more bookings available for this day'
      });
    }

    const hospital = await Hospital.findById(hospitalId);
    const tokenNumber = generateSecureTokenNumber();

    const baseTime = doctor.availableSlots[slotIndex].startTime.split(':');
    const slotStartTime = new Date(bookingDate);
    slotStartTime.setHours(parseInt(baseTime[0]), parseInt(baseTime[1]), 0, 0);

    const bookingStart = new Date(new Date(bookingDate).setHours(0, 0, 0));
    const bookingEnd = new Date(new Date(bookingDate).setHours(23, 59, 59));

    const lastEmergency = await Queue.findOne({
      doctorId,
      emergency: true,
      bookingDate: { $gte: bookingStart, $lte: bookingEnd }
    }).sort({ estimatedStartTime: -1 });

    const lastNormal = await Queue.findOne({
      doctorId,
      emergency: false,
      bookingDate: { $gte: bookingStart, $lte: bookingEnd }
    }).sort({ estimatedStartTime: -1 });

    let estimatedStartTime;

    if (emergency) {
      if (lastEmergency) {
        estimatedStartTime = new Date(lastEmergency.estimatedStartTime);
        estimatedStartTime.setMinutes(estimatedStartTime.getMinutes() + 20);
      } else {
        estimatedStartTime = new Date(slotStartTime);
      }

      // Shift all normal bookings after this time by 20 mins
      const affectedNormals = await Queue.find({
        doctorId,
        emergency: false,
        estimatedStartTime: { $gte: estimatedStartTime },
        bookingDate: { $gte: bookingStart, $lte: bookingEnd }
      }).sort({ estimatedStartTime: 1 });

      for (let normal of affectedNormals) {
        normal.estimatedStartTime.setMinutes(normal.estimatedStartTime.getMinutes() + 20);
        await normal.save();
      }

    } else {
      let maxTime = new Date(slotStartTime);
  
      const existingBookingsToday = await Queue.countDocuments({
        doctorId,
        bookingDate: { $gte: bookingStart, $lte: bookingEnd }
      });
  
      if (existingBookingsToday === 0) {
        const currentTime = new Date();
        const twentyMinutesLater = new Date(currentTime.getTime() + 20 * 60 * 1000);
        estimatedStartTime = twentyMinutesLater > maxTime ? twentyMinutesLater : maxTime;
      } else {
        if (lastEmergency) {
          const temp = new Date(lastEmergency.estimatedStartTime);
          temp.setMinutes(temp.getMinutes() + 20);
          if (temp > maxTime) maxTime = temp;
        }
  
        if (lastNormal) {
          const temp = new Date(lastNormal.estimatedStartTime);
          temp.setMinutes(temp.getMinutes() + 20);
          if (temp > maxTime) maxTime = temp;
        }
        estimatedStartTime = maxTime;
      }
    }

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
      estimatedStartTime,
      bookingDate,
      bookingTime: new Date(),
      bookingType,
      fee,
      emergency,
      otp
    });

    await queue.save();
    await doctor.updateBookings(slotIndex, emergency);

    const bookingMessage = `Your queue token is ${tokenNumber}. You can visit Dr. ${doctor.name} at ${hospital.name}.
Patient: ${patientName}, Age: ${age}, Disease: ${diseaseDescription}.
Estimated visit time: ${estimatedStartTime.toLocaleTimeString()}`;

    await sendEmail(email, bookingMessage);

    res.status(200).json({
      queueId:queue._id,
      message: 'Booking successful!',
      tokenNumber,
      estimatedStartTime,
      doctorName: doctor.name,
      hospitalName: hospital.name,
      emergency,
      status: 'Booked',
      bookingType
    });

  } catch (error) {
    console.error('Booking after OTP failed:', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
};


// Update Queue Status


const getQueuePosition = async (req, res) => {
  const { queueId } = req.params;

  try {
    const queue = await Queue.findById(queueId);
    if (!queue) return res.status(404).json({ error: 'Queue not found' });

    const doctor = await Doctor.findById(queue.doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    // All active queues sorted
    const allQueues = await Queue.find({
      doctorId: queue.doctorId,
      status: { $in: ['Booked', 'Confirmed'] }
    }).sort({ estimatedStartTime: 1 });

    const position = allQueues.findIndex(q => q._id.toString() === queueId) + 1;
    const peopleAhead = position - 1;

    // Currently serving patient (Confirmed ya Ongoing)
    const currentlyServingQueue = await Queue.findOne({
      doctorId: queue.doctorId,
      status: { $in: ['Ongoing', 'Confirmed'] }
    }).sort({ estimatedStartTime: 1 });

    // Calculate average time per patient using past completed visits
    const completedQueues = await Queue.find({
      doctorId: queue.doctorId,
      status: 'Completed',
      actualStartTime: { $exists: true },
      actualEndTime: { $exists: true }
    }).limit(10);

    let averageTimePerPatient = 15; // fallback average
    if (completedQueues.length > 0) {
      const totalTime = completedQueues.reduce((acc, q) => {
        const duration = (new Date(q.actualEndTime) - new Date(q.actualStartTime)) / (1000 * 60);
        return acc + duration;
      }, 0);
      averageTimePerPatient = Math.round(totalTime / completedQueues.length);
    }

    // Real-time gap between current time and estimated start
    const now = new Date();
    const visitTime = new Date(queue.estimatedStartTime);
    const realTimeGapInMin = Math.max(0, Math.ceil((visitTime - now) / (1000 * 60))); // Avoid negative

    // Either use position-based estimated wait or time-difference, whichever is higher
    const positionBasedWait = peopleAhead * averageTimePerPatient;
    const estimatedWaitTimeMinutes = Math.max(realTimeGapInMin, positionBasedWait);

    const hours = Math.floor(estimatedWaitTimeMinutes / 60);
    const minutes = estimatedWaitTimeMinutes % 60;
    const formattedWaitTime =
      hours > 0
        ? `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`
        : `${minutes} minute${minutes !== 1 ? 's' : ''}`;

    res.status(200).json({
      tokenNumber: queue.tokenNumber,
      position,
      peopleAhead,
      visitTime: queue.estimatedStartTime,
      currentlyServing: currentlyServingQueue ? currentlyServingQueue.tokenNumber : null,
      estimatedWaitTime: formattedWaitTime,
      doctor: {
        doctorName: doctor.name,
        image: doctor.image,
        qualification: doctor.degree,
        experience: 5,
        specialization: doctor.specialization
      },
      department: doctor.specialization
    });

  } catch (error) {
    console.error('Error in getQueuePosition:', error);
    res.status(500).json({ error: 'Failed to fetch position info' });
  }
};



const getQueueByTokenNumber = async (req, res) => {
  const { tokenNumber } = req.params;
console.log(req.params)
  try {
    const queue = await Queue.findOne({ tokenNumber });
    console.log(queue)
    if (!queue) {
      return res.status(404).json({ error: `Queue not found for token number ${tokenNumber}` });
    }
    const doctor = await Doctor.findById(queue.doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    // All active queues for the same doctor, sorted by estimated start time
    const allQueues = await Queue.find({
      doctorId: queue.doctorId,
      status: { $in: ['Booked', 'Confirmed'] }
    }).sort({ estimatedStartTime: 1 });

    const position = allQueues.findIndex(q => q._id.toString() === queue._id.toString()) + 1;
    const peopleAhead = position - 1;

    // Currently serving patient for the same doctor
    const currentlyServingQueue = await Queue.findOne({
      doctorId: queue.doctorId,
      status: { $in: ['Confirmed', 'Ongoing'] }
    }).sort({ estimatedStartTime: 1 });

    // Estimate average time per patient (same logic as getQueuePosition)
    const completedQueues = await Queue.find({
      doctorId: queue.doctorId,
      status: 'Completed',
      actualStartTime: { $exists: true },
      actualEndTime: { $exists: true }
    }).limit(10);

    let averageTimePerPatient = 15;
    if (completedQueues.length > 0) {
      const totalTime = completedQueues.reduce((acc, q) => {
        const duration = (new Date(q.actualEndTime) - new Date(q.actualStartTime)) / (1000 * 60);
        return acc + duration;
      }, 0);
      averageTimePerPatient = Math.round(totalTime / completedQueues.length);
    }

    const estimatedWaitTimeMinutes = peopleAhead * averageTimePerPatient;
    const hours = Math.floor(estimatedWaitTimeMinutes / 60);
    const minutes = estimatedWaitTimeMinutes % 60;
    const formattedWaitTime =
      hours > 0
        ? `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`
        : `${minutes} minute${minutes !== 1 ? 's' : ''}`;

    res.status(200).json({
      queueId:queue._id,
      tokenNumber: queue.tokenNumber,
      position,
      peopleAhead,
      visitTime: queue.estimatedStartTime,
      currentlyServing: currentlyServingQueue ? currentlyServingQueue.tokenNumber : null,
      estimatedWaitTime: formattedWaitTime,
      doctor: {
        doctorName: doctor.name,
        image: doctor.image,
        qualification: doctor.degree,
        experience: 5,
        specialization: doctor.specialization
      },
      department: doctor.specialization
    });

  } catch (error) {
    console.error('Error in getQueueByTokenNumber:', error);
    res.status(500).json({ error: 'Failed to fetch queue by token number' });
  }
};

module.exports = { checkStatus, bookQueue, verifyOtp,getQueuePosition,getQueueByTokenNumber };
