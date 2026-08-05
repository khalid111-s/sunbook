const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  booking: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking', 
    required: true 
  },
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  teacher: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  subject: { 
    type: String, 
    required: true,
    trim: true 
  },
  scheduledDate: { 
    type: Date, 
    required: true 
  },
  duration: { 
    type: Number, 
    default: 30 
  },
  jitsiRoomName: { 
    type: String, 
    required: true,
    unique: true
  },
  jitsiRoomUrl: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['scheduled', 'live', 'completed', 'cancelled'], 
    default: 'scheduled' 
  },
  startedAt: { type: Date },
  endedAt: { type: Date },
  feedback: { type: String, trim: true },
  recordingUrl: { type: String }
}, { 
  timestamps: true 
});

// Index for upcoming sessions
sessionSchema.index({ student: 1, scheduledDate: 1 });
sessionSchema.index({ teacher: 1, scheduledDate: 1 });

module.exports = mongoose.model('Session', sessionSchema);
