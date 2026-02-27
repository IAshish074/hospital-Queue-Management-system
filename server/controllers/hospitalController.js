const Hospital = require('../models/Hospital');
const Admin = require('../models/Admin');  // Import Admin model
const Doctor = require('../models/Doctor');
// Add a new hospital
const addHospital = async (req, res) => {
  console.log("Uploaded file:", req.file);
  try {
    const { name, address, contactNumber } = req.body;

    // Validate required fields
    if (!name || !address || !contactNumber) {
      return res.status(400).json({ message: 'Name, address, and contact number are required.' });
    }

    // Check if the hospital already exists by name
    const existingHospital = await Hospital.findOne({ name: name.trim() });
    if (existingHospital) {
      return res.status(409).json({ message: 'Hospital with this name already exists.' });
    }

    // Create a new hospital (admins and doctors can be empty initially)
    const imagePath = req.file ?  req.file.filename  : null;
    

    const newHospital = new Hospital({
      name: name.trim(),
      address: address.trim(),
      contactNumber: contactNumber.trim(),
      image: imagePath,
      admins: [],
      doctors: [],
    });

    // Save hospital to DB
    await newHospital.save();

    res.status(201).json({
      message: 'Hospital added successfully!',
      hospital: newHospital,
    });

  } catch (error) {
    console.error('❌ Error while adding hospital:', error);
    res.status(500).json({ message: 'Server error, please try again later.', error: error.message });
  }
};

// Get all hospitals
const getHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find().lean();

    const allDoctorIds = hospitals
      .flatMap(hospital => hospital.doctors)
      .map(doc => doc.doctorId || doc) // support both object and ID form
      .filter(Boolean);

    const uniqueDoctorIds = [...new Set(allDoctorIds.map(id => id.toString()))];

    const doctorsData = await Doctor.find({ _id: { $in: uniqueDoctorIds } }).lean();

    const doctorMap = {};
    doctorsData.forEach(doctor => {
      doctorMap[doctor._id.toString()] = {
        doctorId: doctor._id,
        name: doctor.name,
        specialization: doctor.specialization,
        normalFee: doctor.normalFee,
        emergencyFee: doctor.emergencyFee,
        avilabileSlot: doctor.availableSlots,
        drImage:doctor.image
      };
    });

    const hospitalsWithDoctorDetails = hospitals.map(hospital => {
      const enrichedDoctors = hospital.doctors.map(doc => {
        const docId = doc.doctorId || doc; // handle object or just ID
        return doctorMap[docId.toString()] || null;
      }).filter(Boolean); // remove null if doctor not found

      return {
        ...hospital,
        doctors: enrichedDoctors
      };
    });

    res.status(200).json(hospitalsWithDoctorDetails);
  } catch (error) {
    console.error('❌ Error while fetching hospitals:', error);
    res.status(500).json({ message: 'Error fetching hospital list.', error: error.message });
  }
};


// Get hospital by ID
const getHospitalById = async (req, res) => {
  try {
    const { hospitalId } = req.params;

    const hospital = await Hospital.findById(hospitalId).populate('admins doctors');
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found.' });
    }

    res.status(200).json({ hospital });

  } catch (error) {
    console.error('❌ Error while fetching hospital by ID:', error);
    res.status(500).json({ message: 'Error fetching hospital details.', error: error.message });
  }
};

 // Import Doctor model

// Add a doctor to the hospital
const addDoctorToHospital = async (req, res) => {
  try {
    const { hospitalId, doctorId } = req.body;

    // Find hospital and doctor by ID
    const hospital = await Hospital.findById(hospitalId);
    const doctor = await Doctor.findById(doctorId);
     
    if (!hospital || !doctor) {
      return res.status(404).json({ message: 'Hospital or doctor not found.' });
    }

    // Check if doctor is already in the hospital's doctors list
    if (hospital.doctors.includes(doctorId)) {
      return res.status(400).json({ message: 'Doctor is already associated with this hospital.' });
    }
 
    // Add doctor to hospital's doctors list
    hospital.doctors.push(doctor._id);
    await hospital.save();

    // // Optionally, you can add hospital to the doctor's list as well
    // doctor.hospitalsId.push(hospitalId) Assuming Doctor model has hospitals field
    // await doctor.save();

    res.status(200).json({
      message: 'Doctor added to hospital successfully!',
      hospital,
    });
  } catch (error) {
    console.error('❌ Error while adding doctor to hospital:', error);
    res.status(500).json({ message: 'Server error, please try again later.', error: error.message });
  }
};

// Remove a doctor from the hospital
const removeDoctorFromHospital = async (req, res) => {
  try {
    const { hospitalId, doctorId } = req.body;

    // Find hospital and doctor by ID
    const hospital = await Hospital.findById(hospitalId);
    const doctor = await Doctor.findById(doctorId);

    if (!hospital || !doctor) {
      return res.status(404).json({ message: 'Hospital or doctor not found.' });
    }

    // Remove doctor from hospital's doctors list
    hospital.doctors = hospital.doctors.filter(id => id.toString() !== doctorId);
    await hospital.save();

    // Optionally, you can remove hospital from the doctor's list as well
    doctor.hospitals = doctor.hospitals.filter(id => id.toString() !== hospitalId);
    await doctor.save();

    res.status(200).json({
      message: 'Doctor removed from hospital successfully!',
      hospital,
    });
  } catch (error) {
    console.error('❌ Error while removing doctor from hospital:', error);
    res.status(500).json({ message: 'Server error, please try again later.', error: error.message });
  }
};

// Add an admin to the hospital
const addAdminToHospital = async (req, res) => {
  try {
    const { hospitalId, adminId } = req.body;

    // Find hospital and admin by ID
    const hospital = await Hospital.findById(hospitalId);
    const admin = await Admin.findById(adminId);

    if (!hospital || !admin) {
      return res.status(404).json({ message: 'Hospital or admin not found.' });
    }

    // Check if admin is already in the hospital's admins list
    if (hospital.admins.includes(adminId)) {
      return res.status(400).json({ message: 'Admin is already associated with this hospital.' });
    }

    // Add admin to hospital's admins list
    hospital.admins.push(adminId);
    await hospital.save();

    // Optionally, you can add hospital to the admin's list as well
    admin.hospitals.push(hospitalId);  // Assuming Admin model has hospitals field
    await admin.save();

    res.status(200).json({
      message: 'Admin added to hospital successfully!',
      hospital,
    });
  } catch (error) {
    console.error('❌ Error while adding admin to hospital:', error);
    res.status(500).json({ message: 'Server error, please try again later.', error: error.message });
  }
};

// Remove an admin from the hospital
const removeAdminFromHospital = async (req, res) => {
  try {
    const { hospitalId, adminId } = req.body;

    // Find hospital and admin by ID
    const hospital = await Hospital.findById(hospitalId);
    const admin = await Admin.findById(adminId);

    if (!hospital || !admin) {
      return res.status(404).json({ message: 'Hospital or admin not found.' });
    }

    // Remove admin from hospital's admins list
    hospital.admins = hospital.admins.filter(id => id.toString() !== adminId);
    await hospital.save();

    // Optionally, you can remove hospital from the admin's list as well
    admin.hospitals = admin.hospitals.filter(id => id.toString() !== hospitalId);
    await admin.save();

    res.status(200).json({
      message: 'Admin removed from hospital successfully!',
      hospital,
    });
  } catch (error) {
    console.error('❌ Error while removing admin from hospital:', error);
    res.status(500).json({ message: 'Server error, please try again later.', error: error.message });
  }
};
module.exports = {
  addHospital,
  getHospitals,
  getHospitalById,
  addDoctorToHospital,
  removeDoctorFromHospital,
  addAdminToHospital,
  removeAdminFromHospital,
};