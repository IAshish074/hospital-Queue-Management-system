// models/Hospital.js

const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  address: {
    type: String,
    required: true,
  },
  contactNumber: {
    type: String,
    required: true,
  },
  image: {
    type: String, // Store image URL or filename
    default:null,
  },
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  }],
  doctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
  }],
}, {
  timestamps: true
});

module.exports = mongoose.model('Hospital', hospitalSchema);
