const PromoCode = require('../models/PromoCode');

// بيحسب تاريخ الانتهاء بناءً على المدة اللي اختارها الأدمن (رقم + وحدة زمن)
function calculateExpiry(amount, unit) {
  const n = Number(amount);
  const now = new Date();
  const expires = new Date(now);

  switch (unit) {
    case 'hours':
      expires.setHours(expires.getHours() + n);
      break;
    case 'days':
      expires.setDate(expires.getDate() + n);
      break;
    case 'weeks':
      expires.setDate(expires.getDate() + n * 7);
      break;
    case 'months':
      expires.setMonth(expires.getMonth() + n);
      break;
    case 'years':
      expires.setFullYear(expires.getFullYear() + n);
      break;
    default:
      return null;
  }
  return expires;
}

// بيولّد كود عشوائي سهل القراءة زي SUN-8X4K2Q
function generateRandomCode(prefix = 'SUN') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // من غير حروف/أرقام بتتلخبط زي O/0 و I/1
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${random}`;
}

// @desc    Generate a new promo code with an expiry duration set by the admin
// @route   POST /api/promocodes
// @access  Private/Admin
const createPromoCode = async (req, res) => {
  const { code, discountType, discountValue, durationAmount, durationUnit, usageLimit } = req.body;

  if (!discountValue || discountValue <= 0) {
    res.status(400);
    throw new Error('Discount value must be greater than 0');
  }

  const validUnits = ['hours', 'days', 'weeks', 'months', 'years'];
  if (!validUnits.includes(durationUnit)) {
    res.status(400);
    throw new Error('Please choose a valid duration unit (hours, days, weeks, months, years)');
  }

  if (!durationAmount || durationAmount <= 0) {
    res.status(400);
    throw new Error('Duration amount must be greater than 0');
  }

  const expiresAt = calculateExpiry(durationAmount, durationUnit);
  if (!expiresAt) {
    res.status(400);
    throw new Error('Could not calculate expiry date');
  }

  // لو الأدمن مكتبش كود بنفسه، نولّد واحد عشوائي (ونتأكد إنه مش مكرر)
  let finalCode = (code || '').trim().toUpperCase();
  if (!finalCode) {
    let attempts = 0;
    do {
      finalCode = generateRandomCode();
      attempts++;
    } while ((await PromoCode.findOne({ code: finalCode })) && attempts < 10);
  }

  const existing = await PromoCode.findOne({ code: finalCode });
  if (existing) {
    res.status(400);
    throw new Error('This code already exists, please choose another one');
  }

  const promoCode = await PromoCode.create({
    code: finalCode,
    discountType: discountType === 'fixed' ? 'fixed' : 'percentage',
    discountValue,
    expiresAt,
    usageLimit: usageLimit || null,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: promoCode });
};

// @desc    List all promo codes (most recent first)
// @route   GET /api/promocodes
// @access  Private/Admin
const getPromoCodes = async (req, res) => {
  const promoCodes = await PromoCode.find().sort({ createdAt: -1 });
  res.json({ success: true, count: promoCodes.length, data: promoCodes });
};

// @desc    Deactivate a promo code (soft-disable, keeps history)
// @route   PATCH /api/promocodes/:id/deactivate
// @access  Private/Admin
const deactivatePromoCode = async (req, res) => {
  const promoCode = await PromoCode.findById(req.params.id);
  if (!promoCode) {
    res.status(404);
    throw new Error('Promo code not found');
  }
  promoCode.active = false;
  await promoCode.save();
  res.json({ success: true, data: promoCode });
};

// @desc    Delete a promo code
// @route   DELETE /api/promocodes/:id
// @access  Private/Admin
const deletePromoCode = async (req, res) => {
  const promoCode = await PromoCode.findByIdAndDelete(req.params.id);
  if (!promoCode) {
    res.status(404);
    throw new Error('Promo code not found');
  }
  res.json({ success: true, data: {} });
};

// @desc    Validate a promo code and return the discount info (used at checkout)
// @route   POST /api/promocodes/validate
// @access  Public
const validatePromoCode = async (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400);
    throw new Error('Please enter a promo code');
  }

  const promoCode = await PromoCode.findOne({ code: String(code).trim().toUpperCase() });

  if (!promoCode || !promoCode.active) {
    res.status(404);
    throw new Error('Invalid promo code');
  }

  if (promoCode.expiresAt < new Date()) {
    res.status(400);
    throw new Error('This promo code has expired');
  }

  if (promoCode.usageLimit && promoCode.timesUsed >= promoCode.usageLimit) {
    res.status(400);
    throw new Error('This promo code has reached its usage limit');
  }

  res.json({
    success: true,
    data: {
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
    },
  });
};

module.exports = {
  createPromoCode,
  getPromoCodes,
  deactivatePromoCode,
  deletePromoCode,
  validatePromoCode,
};
