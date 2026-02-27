const express = require('express');
const { registerAdmin, resendOtpAdmin,verifyOTP, loginAdmin, getDoctorList,getAllQueues,deleteQueueById,updateQueueStatus ,getAllPatients,updateDoctorFees, forgotPasswordAdmin,
    resetPasswordAdmin,logout} = require('../controllers/adminController');
// adminRouter.js
const Admin = require('../models/Admin');
const verifyJWT = require('../middlewares/auth'); // Import verifyJWT
const verifyOtpToken = require('../middlewares/verifyOtpToken')
const router = express.Router();
const jwt = require("jsonwebtoken");

// Admin Registration Route
router.post('/register', registerAdmin);

// Resend Otp
router.post('/resend-otp', resendOtpAdmin)

// OTP Verification Route for Admin
router.post('/verify-otp', verifyOTP);

// Admin Login Route
router.post('/login', loginAdmin);

// Forgot Password Route for Admin
router.post('/forgot-password', forgotPasswordAdmin); // Define the route to initiate forgot password

// Reset Password Route for Admin (accepts the token in the URL)
router.post('/reset-password/:token', resetPasswordAdmin); // Route to handle password reset with token


// Get Doctor List Route (for Admin Dashboard)
router.get('/doctors', verifyJWT, getDoctorList); // Protect this route

//Example protected route that requires verified OTP
router.get('/adminData', verifyJWT, async (req, res) => {
  try {
    const adminId = req.user?._id;
    const admin = await Admin.findById(adminId).select('-password');

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    return res.json({
      success: true,
      admin: {
        name: admin.name,
        email: admin.email,
        hospitalId: admin.hospitalId,
      }
    });
  } catch (err) {
    console.error("Error fetching admin data:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post('/getAdminData', async (req, res) => {
  try {
    const token = req.cookies.token; // assuming you stored it as 'token'

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const adminId = decoded.adminId;

    if (!adminId) {
      return res.status(400).json({ error: "Invalid token" });
    }

    const admin = await Admin.findById(adminId).select('-password');

    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    return res.json({
      success: true,
      admin: {
        name: admin.name,
        email: admin.email,
        hospitalId: admin.hospitalId,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get('/queues', verifyJWT, getAllQueues);
router.get('/allpatients', verifyJWT, getAllPatients);
router.delete('/queue/:id', verifyJWT, deleteQueueById);


router.patch('/queue/:id/status', verifyJWT, updateQueueStatus);

router.put('/update-fees',verifyJWT, updateDoctorFees);

router.post("/logout", logout)

module.exports = router;