const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  age: { type: Number, required: true },
  diseaseDescription: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  bookingType: { type: String, required: true }, // ✅ added
  bookingTime: { type: Date },   // ✅ added
  bookingDate: {   type: Date},
  status: { type: String, default: 'Booked' },
  tokenNumber: { type: String, required: true, unique: true },
  otp: { type: String, required: true },
  emergency: { type: Boolean, default: false },
  fee: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  estimatedStartTime: { type: Date },
});

module.exports = mongoose.model('Queue', queueSchema);
