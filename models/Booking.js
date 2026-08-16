const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Student is required'] 
  },
  teacher: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Teacher is required'] 
  },
  subject: { 
    type: String, 
    required: [true, 'Subject is required'],
    trim: true 
  },
  date: { 
    type: Date, 
    required: [true, 'Date is required'] 
  },
  duration: { 
    type: Number, 
    default: 30,
    min: [15, 'Minimum duration is 15 minutes'],
    max: [120, 'Maximum duration is 120 minutes']
  },
  price: { 
    type: Number, 
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  paymentMethod: { 
    type: String, 
    enum: ['card', 'wallet', 'cash'], 
    default: 'card' 
  },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'confirmed', 'cancelled', 'completed'], 
    default: 'pending' 
  },
  paymobOrderId: { type: String },
  paymobPaymentKey: { type: String },
  paytabsTranRef: { type: String },
  notes: { type: String, trim: true },
  cancelledAt: { type: Date },
  cancellationReason: { type: String },
  // بنمنع بيهم تكرار إرسال إيميلات التأكيد/التذكير
  confirmationEmailSent: { type: Boolean, default: false },
  reminderSent: { type: Boolean, default: false },
}, { 
  timestamps: true 
});

// Index for faster queries
bookingSchema.index({ teacher: 1, date: 1 });
bookingSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
