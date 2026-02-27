const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Import bcrypt for pre-save hook

const adminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    otp: { type: String },
    otpExpiresAt: { type: Date},
    isVerified: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
});

module.exports = mongoose.model('Admin', adminSchema);

