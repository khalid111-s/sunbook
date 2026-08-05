const axios = require('axios');
const User = require('../models/User');

const PAYMOB_BASE = 'https://accept.paymob.com/api';

// الخطوة 1: الحصول على auth token من Paymob
async function getAuthToken() {
  const { data } = await axios.post(`${PAYMOB_BASE}/auth/tokens`, {
    api_key: process.env.PAYMOB_API_KEY,
  });
  return data.token;
}

// الخطوة 2: إنشاء Order على Paymob
async function createOrder(authToken, amountCents) {
  const { data } = await axios.post(`${PAYMOB_BASE}/ecommerce/orders`, {
    auth_token: authToken,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: 'EGP',
    items: [],
  });
  return data.id;
}

// الخطوة 3: الحصول على payment key (اللي بيتحط في رابط الـ iframe)
async function getPaymentKey(authToken, orderId, amountCents, student) {
  const nameParts = (student?.name || 'Sunbook Student').split(' ');
  const firstName = nameParts[0] || 'Student';
  const lastName = nameParts.slice(1).join(' ') || 'Sunbook';

  const { data } = await axios.post(`${PAYMOB_BASE}/acceptance/payment_keys`, {
    auth_token: authToken,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: orderId,
    billing_data: {
      apartment: 'NA',
      email: student?.email || 'customer@example.com',
      floor: 'NA',
      first_name: firstName,
      street: 'NA',
      building: 'NA',
      phone_number: student?.phone || 'NA',
      shipping_method: 'NA',
      postal_code: 'NA',
      city: 'NA',
      country: 'NA',
      last_name: lastName,
      state: 'NA',
    },
    currency: 'EGP',
    integration_id: process.env.PAYMOB_INTEGRATION_ID,
  });
  return data.token;
}

// الدالة الرئيسية اللي بيستدعيها bookingController
const createPaymobPaymentIntent = async (booking) => {
  const amountCents = Math.round(booking.price * 100);

  const authToken = await getAuthToken();
  const orderId = await createOrder(authToken, amountCents);
  const student = await User.findById(booking.student);
  const paymentKey = await getPaymentKey(authToken, orderId, amountCents, student);

  return { orderId, paymentKey };
};

module.exports = { createPaymobPaymentIntent };
