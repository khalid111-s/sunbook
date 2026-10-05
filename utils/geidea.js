// تكامل Geidea (Hosted Payment Page) - كل الاتصالات هنا من السيرفر للسيرفر.
// الـ API Password سر: مينفعش يتبعت للفرونت إند أبدًا.
const axios = require('axios');
const crypto = require('crypto');

const getConfig = () => ({
  publicKey: process.env.GEIDEA_PUBLIC_KEY,
  apiPassword: process.env.GEIDEA_API_PASSWORD,
  baseUrl: (process.env.GEIDEA_BASE_URL || 'https://api.merchant.geidea.net').replace(/\/+$/, ''),
  hppScriptUrl: process.env.GEIDEA_HPP_SCRIPT || 'https://www.merchant.geidea.net/hpp/geideaCheckout.min.js',
});

const isConfigured = () => {
  const { publicKey, apiPassword } = getConfig();
  return Boolean(publicKey && apiPassword);
};

const formatAmount = (n) => Number(n).toFixed(2);

// الصيغة المطلوبة: YYYY/MM/DD HH:mm:ss
const makeTimestamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
};

// signature = Base64( HMAC-SHA256( publicKey + amount(2dp) + currency + merchantReferenceId + timestamp, apiPassword ) )
const generateSignature = ({ publicKey, apiPassword, amount, currency, merchantReferenceId, timestamp }) => {
  const data = `${publicKey}${formatAmount(amount)}${currency}${merchantReferenceId}${timestamp}`;
  return crypto.createHmac('sha256', apiPassword).update(data, 'utf8').digest('base64');
};

const geideaError = (err, fallback) => {
  const msg = err?.response?.data?.detailedResponseMessage || err?.response?.data?.responseMessage || err?.message;
  return new Error(msg || fallback);
};

// بيعمل جلسة دفع ويرجّع session.id اللي الفرونت إند بيفتح بيه نافذة Geidea
const createSession = async ({ amount, currency, merchantReferenceId, callbackUrl, language = 'en', customer }) => {
  const { publicKey, apiPassword, baseUrl } = getConfig();
  const timestamp = makeTimestamp();
  const signature = generateSignature({ publicKey, apiPassword, amount, currency, merchantReferenceId, timestamp });

  const body = {
    amount: Number(formatAmount(amount)),
    currency,
    timestamp,
    merchantReferenceId,
    signature,
    paymentOperation: 'Pay',
    language,
    callbackUrl,
    ...(customer ? { customer } : {}),
  };

  let data;
  try {
    ({ data } = await axios.post(`${baseUrl}/payment-intent/api/v2/direct/session`, body, {
      auth: { username: publicKey, password: apiPassword },
      timeout: 15000,
    }));
  } catch (err) {
    throw geideaError(err, 'Could not start the payment session');
  }

  if (data.responseCode !== '000' || data.detailedResponseCode !== '000' || !data.session?.id) {
    throw new Error(data.detailedResponseMessage || 'Could not start the payment session');
  }
  return data.session.id;
};

// بيجيب كل الطلبات المسجلة عند Geidea لمرجع معيّن - ده اللي بنعتمد عليه فعليًا لتأكيد الدفع
const fetchOrdersByReference = async (merchantReferenceId) => {
  const { publicKey, apiPassword, baseUrl } = getConfig();
  try {
    const { data } = await axios.get(`${baseUrl}/pgw/api/v1/direct/order`, {
      params: { MerchantReferenceId: merchantReferenceId },
      auth: { username: publicKey, password: apiPassword },
      timeout: 15000,
    });
    return Array.isArray(data.orders) ? data.orders : [];
  } catch (err) {
    throw geideaError(err, 'Could not verify the payment');
  }
};

const isOrderPaid = (o) => o && o.status === 'Success' && o.detailedStatus === 'Paid';

const sameAmount = (a, b) => formatAmount(a) === formatAmount(b);

module.exports = {
  getConfig,
  isConfigured,
  generateSignature,
  makeTimestamp,
  createSession,
  fetchOrdersByReference,
  isOrderPaid,
  sameAmount,
};
