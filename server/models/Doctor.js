const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  specialization: {
    type: String,
    required: true,
  },
  normalFee: {
    type: Number,
    required: true,
  },
  emergencyFee: {
    type: Number,
    required: true,
  },
  availableSlots: [{
    day: {
      type: String,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    maxBookings: {
      type: Number,
      required: true,
    },
    bookingsMade: {
      type: Number,
      default: 0,
    }
  }],
  image: {
    type: String,
    default: null,
  },
  degree: {
    type: String,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
  },
  emergencySlotsPerDay: {
    type: Number,
    default: 3,
  },
  emergencyBookingsToday: {
    type: Number,
    default: 0,
  },
  isFirstBooking: {
    type: Boolean,
    default: true,
  },
  lastResetDate: {
    type: Date,
    default: Date.now
  }
});

// Middleware to automatically reset bookings at the start of each day
doctorSchema.pre('save', async function(next) {
  const now = new Date();
  const lastReset = this.lastResetDate;

  // Check if it's a new day
  if (lastReset && now.getDate() !== lastReset.getDate()) {
    this.emergencyBookingsToday = 0;
    this.availableSlots.forEach(slot => {
      slot.bookingsMade = 0;
    });
    this.lastResetDate = now;
  }
  next();
});

// Method to check slot availability
doctorSchema.methods.checkSlotAvailability = function(slotIndex, isEmergency) {
  // Check emergency slots first
  if (isEmergency && this.emergencyBookingsToday >= this.emergencySlotsPerDay) {
    return false;
  }

  // Check if slot exists
  if (!this.availableSlots[slotIndex]) {
    return false;
  }

  // Check regular slot availability
  return this.availableSlots[slotIndex].bookingsMade < this.availableSlots[slotIndex].maxBookings;
};

// Method to update bookings
doctorSchema.methods.updateBookings = async function(slotIndex, isEmergency) {
  if (isEmergency) {
    if (this.emergencyBookingsToday >= this.emergencySlotsPerDay) {
      throw new Error('Emergency slots full for today');
    }
    this.emergencyBookingsToday += 1;
  }

  if (this.availableSlots[slotIndex]) {
    if (this.availableSlots[slotIndex].bookingsMade >= this.availableSlots[slotIndex].maxBookings) {
      throw new Error('Slot is full');
    }
    this.availableSlots[slotIndex].bookingsMade += 1;
  }

  this.isFirstBooking = false;
  this.markModified('availableSlots');
  this.markModified('emergencyBookingsToday');
  this.markModified('isFirstBooking');
  return this.save();
};

// Static method to reset all bookings for all doctors
doctorSchema.statics.resetAllBookings = async function() {
  return this.updateMany(
    {},
    {
      $set: {
        emergencyBookingsToday: 0,
        'availableSlots.$[].bookingsMade': 0,
        lastResetDate: new Date()
      }
    }
  );
};

const Doctor = mongoose.model('Doctor', doctorSchema);
module.exports = Doctor;