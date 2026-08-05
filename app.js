require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

connectDB();

const app = express();

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

app.get('/', (req, res) => {
  res.send('Sunbook API is running...');
});

app.use(errorHandler);

module.exports = app;
