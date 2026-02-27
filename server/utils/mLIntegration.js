const axios = require('axios');
const Doctor = require('../models/Doctor');
const Queue = require('../models/Queue');

const predictAppointmentTime = async (doctorId, isEmergency = false, retries = 1) => {
  try {
    const doctor = await Doctor.findById(doctorId);
    const queueData = await Queue.find({ doctorId, status: 'Booked' });
  console.log(doctorId,isEmergency)
    const response = await axios.post('http://localhost:5000/predict-time', {
      doctorData: {
        availableSlots: doctor.availableSlots
      },
      queueData: queueData.map(item => ({
        emergency: item.emergency,
        predictedTime: item.predictedTime,
        bookingDate: item.bookingDate
      })),
      isEmergency,
      doctorId // ✅ Fix: Send doctorId to Flask
    });

    return response.data.estimatedTime;

  } catch (err) {
    console.error("ML Prediction failed:", err.message);

    if (retries > 0) {
      await new Promise(res => setTimeout(res, 1000)); // Optional delay
      return await predictAppointmentTime(doctorId, isEmergency, retries - 1);
    }

    return null;
  }
};

module.exports = { predictAppointmentTime };
