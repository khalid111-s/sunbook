const axios = require('axios');
const crypto = require('crypto');

// ==========================================================================
// فواتيرك (Fawaterak) - API v3
// المصدر: توثيق فواتيرك الرسمي (app.fawaterk.com/documentation) بتاريخ سبتمبر 2026
// ==========================================================================
// فواتيرك بتستخدم OAuth2 (client_credentials) بدل مفتاح ثابت زي كاشير، فمحتاجين
// نجيب "access token" مؤقت الأول، ونجدده لما يخلص، قبل أي نداء API فعلي.

const BASE_URL = process.env.FAWATERAK_BASE_URL || 'https://staging.fawaterk.com';

function isFawaterakConfigured() {
  const clientId = process.env.FAWATERAK_CLIENT_ID || '';
  const clientSecret = process.env.FAWATERAK_CLIENT_SECRET || '';
  return clientId.length > 0 && clientSecret.length > 0;
}

// --- تخزين مؤقت للتوكن في الذاكرة (in-memory) عشان مانطلبش توكن جديد مع كل عملية دفع ---
let cachedToken = null; // { accessToken, refreshToken, expiresAt }

async function fetchNewToken() {
  const { data } = await axios.post(`${BASE_URL}/oauth/token`, {
    grant_type: 'client_credentials',
    client_id: process.env.FAWATERAK_CLIENT_ID,
    client_secret: process.env.FAWATERAK_CLIENT_SECRET,
  });

  cachedToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    // بنحط هامش أمان دقيقتين قبل الانتهاء الفعلي، عشان مانستخدمش توكن هيموت في نص الطلب
    expiresAt: Date.now() + (data.expires_in ? (data.expires_in - 120) * 1000 : 10 * 60 * 1000),
  };
  return cachedToken.accessToken;
}

async function refreshExistingToken() {
  if (!cachedToken?.refreshToken) return fetchNewToken();
  try {
    const { data } = await axios.post(`${BASE_URL}/oauth/token`, {
      grant_type: 'refresh_token',
      refresh_token: cachedToken.refreshToken,
      client_id: process.env.FAWATERAK_CLIENT_ID,
      client_secret: process.env.FAWATERAK_CLIENT_SECRET,
    });
    cachedToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || cachedToken.refreshToken,
      expiresAt: Date.now() + (data.expires_in ? (data.expires_in - 120) * 1000 : 10 * 60 * 1000),
    };
    return cachedToken.accessToken;
  } catch (err) {
    // لو الـ refresh فشل لأي سبب، نرجع نطلب توكن جديد من الأول بدل ما نوقع كل حاجة
    return fetchNewToken();
  }
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }
  if (cachedToken?.refreshToken) {
    return refreshExistingToken();
  }
  return fetchNewToken();
}

/**
 * بيعمل معاملة دفع "Hosted checkout" عند فواتيرك (زي بالظبط createKashierPaymentIntent):
 * من غير ما نبعت payment_method_id، فواتيرك بترجّعلنا رابط دفع جاهز نوجّه العميل عليه،
 * وهو بيختار طريقة الدفع (فيزا/محفظة/فوري) بنفسه في صفحتهم.
 */
async function createFawaterakTransaction({
  cartTotal,
  currency,
  customer,
  cartItems,
  payLoad,
  redirectionUrls,
}) {
  const token = await getAccessToken();

  const { data } = await axios.post(
    `${BASE_URL}/api/v3/createTransaction`,
    {
      cartTotal,
      currency,
      customer,
      cartItems,
      pay_load: payLoad,
      redirectionUrls,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  // data.data.url = رابط الدفع نوجّه العميل عليه، data.data.intent_key = المعرّف اللي هنربط بيه الـ webhook بعدين
  return {
    checkoutUrl: data?.data?.url,
    intentKey: data?.data?.intent_key,
  };
}

/**
 * بيعمل استرجاع (refund) لمعاملة سبق دفعها.
 * refund_id هنا هو الـ transaction_id الرقمي اللي وصلنا في webhook الدفع الناجح (مش الـ intent_key النصي).
 */
async function refundFawaterakTransaction({ transactionId, amount, reason }) {
  const token = await getAccessToken();
  const { data } = await axios.post(
    `${BASE_URL}/api/v3/refund/create`,
    {
      refund_type: 3, // 3 = integration transaction (المعاملات الجاية من الـ API مباشرة زي بتاعتنا)
      refund_id: transactionId,
      refundable_amount: amount,
      reason: reason || 'Customer requested refund',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
}

// --------------------------------------------------------------------------
// التحقق من توقيع الـ webhooks (HMAC-SHA256) - كل نوع webhook له صيغة توقيع مختلفة
// شرحها في التوثيق، وبيتوقّعوا بمفتاحك "vendor API key" (مش الـ OAuth secret)
// --------------------------------------------------------------------------
function hmac(stringToSign) {
  return crypto
    .createHmac('sha256', process.env.FAWATERAK_VENDOR_API_KEY || '')
    .update(stringToSign)
    .digest('hex');
}

// دفع ناجح / معلّق: StringToSign = "TransactionId=" + transaction_id + "TransactionKey=" + transaction_key
function verifyPaidWebhook(body) {
  const stringToSign = `TransactionId=${body.transaction_id}TransactionKey=${body.transaction_key}`;
  return hmac(stringToSign) === body.hashKey;
}

// فشل الدفع: نفس صيغة التوقيع بتاعة الدفع الناجح
function verifyFailedWebhook(body) {
  const stringToSign = `TransactionId=${body.transaction_id}TransactionKey=${body.transaction_key}`;
  return hmac(stringToSign) === body.hashKey;
}

// إلغاء/انتهاء مرجع دفع (فوري/أمان): StringToSign = "referenceId=" + referenceId + "&PaymentMethod=" + paymentMethod
function verifyCancelWebhook(body) {
  const stringToSign = `referenceId=${body.referenceId}&PaymentMethod=${body.paymentMethod}`;
  return hmac(stringToSign) === body.hashKey;
}

// استرجاع اتوافق عليه: StringToSign = "transactionId=" + transactionId + "&amount=" + amount + "&currency=" + currency
function verifyRefundWebhook(body) {
  const stringToSign = `transactionId=${body.transactionId}&amount=${body.amount}&currency=${body.currency}`;
  return hmac(stringToSign) === body.hashKey;
}

module.exports = {
  isFawaterakConfigured,
  createFawaterakTransaction,
  refundFawaterakTransaction,
  verifyPaidWebhook,
  verifyFailedWebhook,
  verifyCancelWebhook,
  verifyRefundWebhook,
};
