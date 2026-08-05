const Session = require('../models/Session');
const Booking = require('../models/Booking');
const { getMeetingConfig } = require('../utils/jitsi');

const getMySessions = async (req, res) => {
  const sessions = await Session.find({
    $or: [{ student: req.user._id }, { teacher: req.user._id }],
  })
    .populate('student', 'name email')
    .populate('teacher', 'name email')
    .populate('booking', 'subject date price status duration notes')
    .sort({ scheduledDate: -1 });

  res.json({ success: true, count: sessions.length, data: sessions });
};

const getSession = async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.id,
    $or: [{ student: req.user._id }, { teacher: req.user._id }],
  })
    .populate('student', 'name email')
    .populate('teacher', 'name email')
    .populate('booking');

  if (!session) {
    res.status(404);
    throw new Error('Session not found or access denied');
  }

  const teacherId = (session.teacher._id || session.teacher).toString();
  const isTeacher = req.user._id.toString() === teacherId;
  const meetingConfig = getMeetingConfig(session.jitsiRoomName, req.user, isTeacher);

  res.json({ success: true, data: { session, meetingConfig } });
};

const joinSession = async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.id,
    $or: [{ student: req.user._id }, { teacher: req.user._id }],
  });

  if (!session) {
    res.status(404);
    throw new Error('Session not found');
  }

  if (session.status === 'cancelled') {
    res.status(400);
    throw new Error('This session has been cancelled');
  }

  if (session.status === 'completed') {
    res.status(400);
    throw new Error('This session has already ended');
  }

  if (session.status === 'scheduled') {
    session.status = 'live';
    session.startedAt = new Date();
    await session.save();
  }

  res.json({
    success: true,
    data: {
      session,
      jitsiUrl: session.jitsiRoomUrl,
      roomName: session.jitsiRoomName,
    },
  });
};

const endSession = async (req, res) => {
  const { feedback } = req.body;

  const session = await Session.findOne({
    _id: req.params.id,
    $or: [{ student: req.user._id }, { teacher: req.user._id }],
  });

  if (!session) {
    res.status(404);
    throw new Error('Session not found');
  }

  if (session.status === 'completed') {
    res.status(400);
    throw new Error('Session is already completed');
  }

  session.status = 'completed';
  session.endedAt = new Date();
  if (feedback) session.feedback = feedback;
  await session.save();

  await Booking.updateOne({ _id: session.booking }, { status: 'completed' });

  res.json({ success: true, data: session });
};

module.exports = {
  getMySessions,
  getSession,
  joinSession,
  endSession,
};
