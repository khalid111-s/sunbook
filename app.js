require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const dbReady = connectDB();
dbReady.catch(() => {}); // نمنع تحذير unhandled rejection، الخطأ بيتعالج في الـ middleware تحت

const app = express();
app.set('trust proxy', 1);

// بيتأكد إن الاتصال بقاعدة البيانات خلص (أو فشل برسالة واضحة)
// قبل ما يكمل لأي route - بدل ما الطلب يعلّق 10 ثواني من غير أي رسالة.
app.use(async (req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database connection failed. Please try again shortly.' });
  }
});

const clientUrls = (process.env.CLIENT_URL || '*')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

app.use(cors({
  origin: clientUrls.includes('*') ? true : clientUrls,
}));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Try again later.' },
});

app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/visits', require('./routes/visitRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/promocodes', require('./routes/promoCodeRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));

app.get('/', (req, res) => {
  res.send('Sunbook API is running...');
});

app.use(errorHandler);

module.exports = app;
