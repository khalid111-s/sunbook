const User = require('../models/User');
const generateToken = require('../utils/generateToken');
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

module.exports = { register, login, getMe, updateProfile, googleLogin, facebookLogin };
