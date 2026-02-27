const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        match: [/^\d{10}$/, 'Invalid phone number'],
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
    },
    otpExpiresAt: {
        type: Date,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
}, {
    timestamps: true,
});

const User = mongoose.model('User', userSchema);
module.exports = User;