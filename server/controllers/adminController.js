const Admin = require('../models/Admin');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital'); // Import Hospital model
const { generateOTP, isOTPExpired } = require('../utils/otpUtils');
const { sendEmail } = require('../utils/mailer');
const { sendSms } = require('../utils/sendSms');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Queue = require('../models/Queue');
const { resendOtp } = require('./userController');
// Admin Registration
const registerAdmin = async (req, res) => {
  await body('name').notEmpty().withMessage('Name is required').run(req);
  await body('hospitalId').notEmpty().withMessage('Hospital ID is required').run(req);
  await body('phone').notEmpty().withMessage('Phone is required').run(req);
  await body('email').isEmail().withMessage('Invalid email').run(req);
  await body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters').run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, hospitalId, phone, email, password } = req.body;

  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ $or: [{ email }, { phone }] });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists!' });
    }

    // Verify hospital existence
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(400).json({ message: 'Invalid hospital ID. Hospital not found.' });
    }

    // Hash the password (OTP not needed during registration)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin without OTP
    const newAdmin = new Admin({
      name,
      hospitalId,
      phone,
      email,
      password: hashedPassword,
      // otp and otpExpiresAt will be set later when needed
    });

    // Add admin ID to hospital's admins array
    hospital.admins.push(newAdmin._id);
    await hospital.save();

    // Save admin without sending OTP
    await newAdmin.save();

    res.status(201).json({ message: 'Admin registered successfully!' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
};


// Admin Login and Send OTP
const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find admin by phone or email
    const admin = await Admin.findOne({ $or: [{ email }] });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found!' });
    }

    // Compare passwords
    const isPasswordMatch = await bcrypt.compare(password, admin.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: 'Invalid credentials!' });
    }

    // Verify hospital existence
    const hospital = await Hospital.findById(admin.hospitalId);
    if (!hospital) {
      return res.status(400).json({ message: 'Associated hospital not found. Contact support.' });
    }

    // Generate OTP and update OTP-related fields
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 1 * 60 * 1000); // OTP expires in 1 minutes
    admin.otp = otp;
    admin.otpExpiresAt = otpExpiresAt;

    // Save updated admin data
    await admin.save();

    // Send OTP via SMS or Email
    //await sendSms(admin.phone, `Your OTP is ${otp}`);
    await sendEmail(admin.email, 'Your OTP Code', `Your OTP is ${otp}`);

    res.status(200).json({ message: 'OTP sent to phone/email for verification.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
};

// Forgot Password for Admin
const forgotPasswordAdmin = async (req, res) => {
  const { email } = req.body;

  try {
      const admin = await Admin.findOne({ email });
      if (!admin) {
          return res.status(404).json({ message: 'Admin not found!' });
      }

      const resetToken = crypto.randomBytes(20).toString('hex');
      admin.resetPasswordToken = await bcrypt.hash(resetToken, 10);
      admin.resetPasswordExpires = Date.now() + 3600000; // 1 hour

      await admin.save();

      const resetLink = `<span class="math-inline">\{req\.headers\.origin\}/admin/reset\-password/</span>{resetToken}`; // Adjust the link as needed
      const emailSubject = 'Admin Password Reset Request';
      const emailBody = `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
      Please click on the following link, or paste this into your browser to complete the process:\n\n
      ${resetLink}\n\n
      If you did not request this, please ignore this email and your password will remain unchanged.\n`;

      // Placeholder for sending email
      const sendEmailResult = await sendEmail(email, emailSubject, emailBody);
      if (!sendEmailResult) {
          return res.status(500).json({ message: 'Failed to send password reset email.' });
      }

      res.status(200).json({ message: 'Password reset email sent successfully.' });

  } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Server error during password reset.' });
  }
};

// Reset Password for Admin
const resetPasswordAdmin = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
      const admin = await Admin.findOne({
          resetPasswordToken: { $exists: true },
          resetPasswordExpires: { $gt: Date.now() },
      });

      if (!admin) {
          return res.status(400).json({ message: 'Invalid or expired reset token.' });
      }

      const isTokenValid = await bcrypt.compare(token, admin.resetPasswordToken);
      if (!isTokenValid) {
          return res.status(400).json({ message: 'Invalid reset token.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      admin.password = hashedPassword;
      admin.resetPasswordToken = undefined;
      admin.resetPasswordExpires = undefined;
      await admin.save();

      res.status(200).json({ message: 'Password reset successfully. You can now log in with your new password.' });

  } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Server error during password reset.' });
  }
};

// resendOtp

const resendOtpAdmin = async (req, res) => {
  const {  email } = req.body;

  try {
    // Find admin by phone or email
    const admin = await Admin.findOne({ $or: [{ email }] });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found!' });
    }

    // Check if OTP is expired
    if (!isOTPExpired(admin.otpExpiresAt)) {
      return res.status(400).json({ message: 'OTP is still valid, please use the existing OTP.' });
    }

    // Generate new OTP and set new expiry time
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // OTP expires in 10 minutes
    admin.otp = otp;
    admin.otpExpiresAt = otpExpiresAt;

    // Save the updated admin data
    await admin.save();

    // Send OTP via SMS or Email
    const sendSmsResult = await sendSms(admin.phone, `Your OTP is ${otp}`);
    const sendEmailResult = await sendEmail(admin.email, 'Your OTP Code', `Your OTP is ${otp}`);

    if (!sendEmailResult) {
      return res.status(500).json({ message: 'Failed to send OTP via Email.' });
    }

    res.status(200).json({ message: 'OTP resent successfully.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error, please try again later.' });
  }
};



// Verify OTP for Admin
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found!" });
    }

    // Check if OTP is valid and not expired
    if (admin.otp !== otp || new Date() > admin.otpExpiresAt) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    // Mark the admin as verified
    admin.isVerified = true;
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { adminId: admin._id, isAdmin: true,hospitalId:admin.hospitalId,Name:admin.name },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Clear existing token cookie before setting a new one
    res.clearCookie("token", {
      httpOnly: true,
      secure: true, // keep false during development; change to true for production
      sameSite: "Lax",
      path: "/"
    });

    // Set new token cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // keep as-is for development
      sameSite: "None",
      maxAge: 60 * 60 * 1000, // 1 hour
      path: "/",         // ensure it's accessible from all routes
      overwrite: true,   // ensures old token gets replaced
    });

    // Redirect to the Dashboard (assuming a successful OTP verification)
    return res.status(200).json({ message: "OTP verified successfully!" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
};

// Get Doctor List for Admin Dashboard
const getDoctorList = async (req, res) => {
  try {
    // Fetch the list of doctors
    const doctors = await Doctor.find({ hospitalId: req.query.hospitalId });
    res.status(200).json({ doctors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching doctor list.' });
  }
};


const getAllQueues = async (req, res) => {
  try {
    const { adminId } = req.query; // Get adminId from query parameters

    const adminData = await Admin.findOne({ _id: adminId }).select('hospitalId');
    if (!adminData) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const hospitalId = adminData.hospitalId;

    const queues = await Queue.find({ hospitalId })
      .populate({
        path: 'doctorId',
        select: 'name', 
      })
      .populate({
        path: 'hospitalId',
        select: 'name', 
      });

    const formattedQueues = queues.map(queue => ({
      tokenNumber: queue.tokenNumber,
      patientName: queue.patientName, 
      doctor: queue.doctorId ? queue.doctorId.name : 'N/A', 
      estimatedStartTime: queue.estimatedStartTime,
      status: queue.status,
      id: queue._id
    }));

    res.status(200).json({ success: true, queues: formattedQueues });
  } catch (error) {
    console.error("Error in getAllQueues:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};



// ✅ Delete queue by ID
const deleteQueueById = async (req, res) => {
  try {
    const { id } = req.params;
    await Queue.findByIdAndDelete(id);
    res.json({ success: true, message: 'Queue deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Update queue status (helped/cancelled/etc.)
const updateQueueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await Queue.findByIdAndUpdate(id, { status }, { new: true });
    res.json({ success: true, queue: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAllPatients = async (req, res) => {
  try {
    const { hospitalId, doctorId, status } = req.query;

    // Validate query parameters
    if (!hospitalId && !doctorId && !status) {
      return res.status(400).json({
        error: 'At least one of hospitalId, doctorId, or status must be provided.',
      });
    }

    const filter = {};
    if (hospitalId) filter.hospitalId = hospitalId;
    if (doctorId) filter.doctorId = doctorId;
    if (status) filter.status = status;

    const queues = await Queue.find(filter)
      .populate('doctorId', 'name')
      .populate('hospitalId', 'name')
      .sort({ createdAt: -1 });

    if (!queues || queues.length === 0) {
      return res.status(404).json({ message: 'No matching patients found.' });
    }

    res.status(200).json({ queues });
  } catch (error) {
    console.error('Admin error fetching patients:', error);
    res.status(500).json({ error: 'Error fetching patients for admin.' });
  }
};


// Admin: Update Doctor's Fee Structure
const updateDoctorFees = async (req, res) => {
  try {
    const { doctorId, normalFee, emergencyFee ,availableSlots} = req.body;

    // Check if admin is authorized
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    // Find the doctor and update fees
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    doctor.normalFee = normalFee;
    doctor.emergencyFee = emergencyFee;
    doctor.availableSlots = availableSlots;
    await doctor.save();

    return res.status(200).json({ message: "Doctor fees updated successfully", doctor });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  });
  res.status(200).json({ message: "Logged out successfully." });
};

module.exports = { registerAdmin, verifyOTP, loginAdmin,resendOtpAdmin, getDoctorList,getAllQueues,deleteQueueById,updateQueueStatus,getAllPatients,updateDoctorFees,logout, forgotPasswordAdmin,
  resetPasswordAdmin};