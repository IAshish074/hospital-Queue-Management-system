const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital'); // Import Hospital model
const { body, validationResult } = require('express-validator');
// Add a new doctor

const addDoctor = async (req, res) => {
  try {
    let availableSlots = req.body.availableSlots;

    if (typeof availableSlots === 'string') {
      availableSlots = JSON.parse(availableSlots).map(slot => ({
        ...slot,
        maxBookings: parseInt(slot.maxBookings, 10),
      }));
    }

    const newDoctor = new Doctor({
      name: req.body.name,
      specialization: req.body.specialization,
      degree: req.body.degree,
      normalFee: parseInt(req.body.normalFee, 10),
      emergencyFee: parseInt(req.body.emergencyFee, 10),
      emergencySlotsPerDay: parseInt(req.body.emergencySlotsPerDay, 10),
      availableSlots: availableSlots,
      hospitalId: req.body.hospitalId,
      image: req.file ? req.file.filename : '',
    });

    await newDoctor.save();
  
    const hospital = await Hospital.findById(req.body.hospitalId);

    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    hospital.doctors.push(newDoctor._id);
    await hospital.save();

    res.status(201).json({ message: 'Doctor added successfully', doctor: newDoctor });
  } catch (err) {
    console.error('Error in addDoctor:', err.message);
    res.status(400).json({ message: 'Failed to add doctor', error: err.message });
  }
};




// Get list of doctors for a specific hospital
const getDoctorsByHospital = async (req, res) => {
  const { hospitalId } = req.params;
  const { doctorId, name, specialization, normalFee, emergencyFee, emergencySlotsPerDay, degree, availableSlots } = req.body;

  try {
    // If only hospitalId: return list of doctors
    if (!doctorId) {
      const doctors = await Doctor.find({ hospitalId });
      return res.status(200).json({ success: true, doctors });
    }

    // If doctorId exists, it's an edit request
    const updateData = {
      ...(name && { name }),
      ...(specialization && { specialization }),
      ...(normalFee && { normalFee }),
      ...(emergencyFee && { emergencyFee }),
      ...(emergencySlotsPerDay && { emergencySlotsPerDay }),
      ...(degree && { degree }),
      ...(availableSlots && { availableSlots: JSON.parse(availableSlots) }),
    };

    // Optional: handle image separately if needed
    if (req.file) {
      updateData.image = req.file.filename; // or wherever you store image
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(doctorId, updateData, { new: true });
    return res.status(200).json({ success: true, doctor: updatedDoctor });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get doctor by ID
const getDoctorById = async (req, res) => {
  const { doctorId } = req.params;

  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }
    res.status(200).json({ doctor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching doctor details.' });
  }
};

module.exports = { addDoctor, getDoctorsByHospital, getDoctorById };