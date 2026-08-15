const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendPasswordResetEmail } = require('../utils/email');
const axios = require('axios');
const crypto = require('crypto');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  // Check if user exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('This email is already registered');
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: role || 'student'
  });

  if (user) {
    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (user && (await user.matchPassword(password))) {
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, data: user });
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
const updateProfile = async (req, res) => {
  const { name, phone, avatar, address } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, phone, avatar, address },
    { new: true, runValidators: true }
  );

  res.json({ success: true, data: user });
};

// @desc    Login/Register via Google (Google Identity Services ID token)
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    res.status(400);
    throw new Error('Missing Google credential');
  }

  // بنتأكد من صحة التوكن مباشرة مع جوجل (من غير أي مكتبة إضافية)
  const { data: payload } = await axios.get(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
  );

  // لازم التوكن يكون صادر لموقعنا بالظبط، مش لموقع تاني
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    res.status(401);
    throw new Error('Invalid Google token');
  }

  const { email, name, sub: googleId } = payload;
  if (!email) {
    res.status(400);
    throw new Error('This Google account has no email available');
  }

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: name || 'Sunbook User',
      email,
      password: crypto.randomBytes(32).toString('hex'), // مش هيتستخدم أبدًا، تسجيل الدخول هيبقى دايمًا عبر جوجل
      isVerified: true,
      googleId,
    });
  } else if (!user.googleId) {
    user.googleId = googleId;
    await user.save();
  }

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    },
  });
};

// @desc    Login/Register via Facebook (Facebook Login access token)
// @route   POST /api/auth/facebook
// @access  Public
const facebookLogin = async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) {
    res.status(400);
    throw new Error('Missing Facebook access token');
  }

  // بنتأكد إن التوكن ده فعلاً صادر لتطبيقنا إحنا، مش أي تطبيق تاني
  const appToken = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`;
  const { data: debugData } = await axios.get('https://graph.facebook.com/debug_token', {
    params: { input_token: accessToken, access_token: appToken },
  });

  if (
    !debugData.data ||
    !debugData.data.is_valid ||
    String(debugData.data.app_id) !== String(process.env.FACEBOOK_APP_ID)
  ) {
    res.status(401);
    throw new Error('Invalid Facebook token');
  }

  const { data: profile } = await axios.get('https://graph.facebook.com/me', {
    params: { fields: 'id,name,email', access_token: accessToken },
  });

  if (!profile.email) {
    res.status(400);
    throw new Error('This Facebook account has no email linked. Please sign in another way.');
  }

  let user = await User.findOne({ email: profile.email });
  if (!user) {
    user = await User.create({
      name: profile.name || 'Sunbook User',
      email: profile.email,
      password: crypto.randomBytes(32).toString('hex'),
      isVerified: true,
      facebookId: profile.id,
    });
  } else if (!user.facebookId) {
    user.facebookId = profile.id;
    await user.save();
  }

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    },
  });
};

// @desc    Request a password reset link by email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error('Please enter your email');
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });

  // بنرد بنفس الرسالة سواء الإيميل موجود أو لأ، عشان محدش يقدر يعرف إيه الإيميلات المسجلة عندنا
  const genericMessage = 'If an account with that email exists, a password reset link has been sent.';

  if (!user) {
    return res.json({ success: true, message: genericMessage });
  }

  // نولّد توكن عشوائي، نخزّن الـ hash بتاعه بس (زي الباسورد)، ونبعت الأصلي في الإيميل
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // ساعة واحدة
  await user.save({ validateBeforeSave: false });

  const frontendBase = process.env.FRONTEND_URL || 'https://sun-book-front.vercel.app';
  const resetUrl = `${frontendBase}/reset-password.html?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

  try {
    await sendPasswordResetEmail(user.email, user.name, resetUrl);
  } catch (err) {
    console.error('Failed to send password reset email:', err.message);
    // مش هنسرّب للمستخدم إن الإرسال فشل أو لأ - بس نلغي التوكن عشان محدش يستخدمه لو حصل خطأ غريب
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(500);
    throw new Error('Could not send reset email right now, please try again shortly.');
  }

  res.json({ success: true, message: genericMessage });
};

// @desc    Reset password using the token from the email link
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400);
    throw new Error('Missing token or new password');
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  }).select('+resetPasswordToken +resetPasswordExpires');

  if (!user) {
    res.status(400);
    throw new Error('This reset link is invalid or has expired. Please request a new one.');
  }

  user.password = password; // الـ pre('save') hook هيعمل hash تلقائي
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Password updated successfully. You can now sign in.',
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: generateToken(user._id),
    },
  });
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  googleLogin,
  facebookLogin,
  forgotPassword,
  resetPassword,
};
