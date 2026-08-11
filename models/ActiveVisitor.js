const mongoose = require('mongoose');

// موديل خفيف بيتحدّث كل شوية (heartbeat) عشان نعرف مين موجود على الموقع فعليًا دلوقتي
const activeVisitorSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, unique: true },
  path: { type: String, default: '' },
  lastSeen: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ActiveVisitor', activeVisitorSchema);
