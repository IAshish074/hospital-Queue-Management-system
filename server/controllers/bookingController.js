const Doctor = require('../models/Doctor');
const Queue = require('../models/Queue');
const { predictAppointmentTime } = require('../utils/mLIntegration'); // Import the ML integration function

const bookAppointment = async (req, res) => {
  try {
    const { doctorId, bookingType, emergency, bookingTime } = req.body;

    // Fetch the doctor details
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // Check if the doctor has any existing bookings
    const existingBookings = await Queue.find({ doctorId, status: 'Booked' });
    
    // If no bookings exist, predict the appointment time using ML
    let finalBookingTime = bookingTime;
    if (existingBookings.length === 0) {
      try {
        // If no bookings, use ML to predict time
        const predictedTime = await predictAppointmentTime(doctorId,emergency);
        if (predictedTime) {
          finalBookingTime = predictedTime;
        }
      } catch (error) {
        console.error("Error during ML prediction, using user-provided time:", error);
        // Fall back to the provided time if prediction fails
      }
    }

    // Find the matching available slot for the doctor
    const slot = doctor.availableSlots.find(slot => 
      new Date(slot.startTime) <= new Date(finalBookingTime) &&
      new Date(slot.endTime) >= new Date(finalBookingTime)
    );

    if (!slot) {
      return res.status(400).json({ message: "Selected time slot is not available." });
    }

    // Check if slot is fully booked
    if (slot.bookingsMade >= slot.maxBookings) {
      return res.status(400).json({ message: "No more slots available for the selected time." });
    }

    // Check if it's an emergency booking
    if (emergency) {
      // Check if emergency slots are available
      if (doctor.emergencyBookingsToday >= doctor.emergencySlotsPerDay) {
        return res.status(400).json({ message: "No emergency slots available for today." });
      }

      // Increase the emergency booking count for the day
      doctor.emergencyBookingsToday += 1;
    }

    // Proceed to create the queue booking
    const newQueue = new Queue({
      doctorId,
      bookingType,
      emergency,
      bookingTime: finalBookingTime, // Use the final booking time (either provided or predicted)
      status: 'Booked',
      fee: emergency ? doctor.emergencyFee : doctor.normalFee
    });

    await newQueue.save();

    // Update doctor's slot booking count
    slot.bookingsMade += 1;
    await doctor.save();

    return res.status(201).json({ message: "Appointment booked successfully", booking: newQueue });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { bookAppointment };
