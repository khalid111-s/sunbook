const crypto = require('crypto');
const axios = require('axios');

// Kashier ليه بيئتين منفصلتين تمامًا (test/live) بدومينات مختلفة لكل خدمة.
// KASHIER_MODE=test بيخلينا نستخدم دومينات التجربة تلقائيًا لحد ما نبقى جاهزين للإطلاق الفعلي.
const IS_LIVE = (process.env.KASHIER_MODE || 'test').toLowerCase() === 'live';

const HPP_BASE = IS_LIVE ? 'https://iframe.kashier.io' : 'https://test-iframe.kashier.io';
const FEP_BASE = IS_LIVE ? 'https://fep.kashier.io' : 'https://test-fep.kashier.io';

function isKashierConfigured() {
  // --- بوابة الدفع متوقفة مؤقتًا لحد ما يتحدد الاشتراك مع بوابة نهائية ---
  // لما تجهز، امسح السطرين دول (return false;) عشان يرجع يشتغل بالمفاتيح تحت زي ما هي.
  return false;

  const mid = process.env.KASHIER_MID || '';
  const apiKey = process.env.KASHIER_API_KEY || '';
  const secretKey = process.env.KASHIER_SECRET_KEY || '';
  return mid.length > 0 && apiKey.length > 0 && secretKey.length > 0;
}

/**
 * بيولّد الـ hash المطلوب لأي عملية إنشاء طلب دفع عند Kashier (HMAC-SHA256).
 * ده شرط أساسي قبل أي طلب - من غيره Kashier هيرفض العملية.
 */
function generateOrderHash({ orderId, amount, currency }) {
  const mid = process.env.KASHIER_MID;
  // مهم: hash صفحة الدفع (Hosted Payment Page) لازم يتعمل بـ Payment API Key
  // (اللي في صورة "Payment API Keys" عند Kashier)، مش بـ Secret Key. الـ Secret Key
  // ده مخصص بس للـ API calls السيرفر-لسيرفر (queryKashierOrder / refundKashierTransaction)
  // اللي بتتبعت لـ https://api.kashier.io بهيدر Authorization. استخدام الغلط منهم هو
  // اللي بيسبب "Kashier failed to authenticate this request".
  const paymentApiKey = process.env.KASHIER_API_KEY;
  const path = `/?payment=${mid}.${orderId}.${amount}.${currency}`;
  return crypto.createHmac('sha256', paymentApiKey).update(path).digest('hex');
}

/**
 * بيبني رابط صفحة الدفع الجاهزة (Hosted Payment Page) اللي هنوجّه العميل ليها.
 * @param {Object} params
 * @param {string} params.orderId - معرّف الطلب/الحجز عندنا (هنستخدمه كـ merchantOrderId عند Kashier)
 * @param {number} params.amount - المبلغ (رقم عادي، مش بالقروش)
 * @param {'EGP'|'USD'|'GBP'|'EUR'} params.currency
 * @param {string} params.merchantRedirect - الرابط اللي المتصفح هيرجعله بعد الدفع (لازم يكون URI-encoded)
 * @param {string} [params.allowedMethods] - مثلاً 'card,wallet,bank_installments' لو عايز تحدد طرق دفع بعينها
 */
function createKashierPaymentIntent({ orderId, amount, currency, merchantRedirect, allowedMethods }) {
  const mid = process.env.KASHIER_MID;
  const hash = generateOrderHash({ orderId, amount, currency });

  const params = new URLSearchParams({
    mid,
    orderId: String(orderId),
    amount: String(amount),
    currency,
    hash,
    merchantRedirect,
  });
  if (allowedMethods) params.set('allowedMethods', allowedMethods);

  return {
    redirectUrl: `${HPP_BASE}/payment?${params.toString()}`,
    hash,
  };
}

/**
 * بيتحقق من توقيع الـ webhook القادم من Kashier (header اسمه x-kashier-signature)
 * عشان نتأكد إن الإشعار جاي فعليًا من Kashier مش من حد بيحاول يزوّر إشعار دفع ناجح.
 * @param {Object} data - جسم الطلب (req.body.data) اللي فيه signatureKeys
 * @param {string} receivedSignature - القيمة اللي جاية في header('x-kashier-signature')
 */
function verifyKashierWebhookSignature(data, receivedSignature) {
  if (!data || !Array.isArray(data.signatureKeys) || !receivedSignature) return false;

  const paymentApiKey = process.env.KASHIER_API_KEY;
  const sortedKeys = [...data.signatureKeys].sort();
  const payload = sortedKeys
    .map((key) => `${key}=${data[key]}`)
    .join('&');

  const expectedSignature = crypto
    .createHmac('sha256', paymentApiKey)
    .update(payload)
    .digest('hex');

  return expectedSignature === receivedSignature;
}

/**
 * بيسأل Kashier مباشرة عن حالة طلب معيّن، بدل ما نستنى الـ webhook بس.
 * @param {string} merchantOrderId - نفس المعرّف اللي بعتناه وقت الإنشاء (orderId بتاعنا)
 */
async function queryKashierOrder(merchantOrderId) {
  const { data } = await axios.get(`${FEP_BASE}/orders/${merchantOrderId}`, {
    headers: { Authorization: process.env.KASHIER_SECRET_KEY },
  });
  return data;
}

/**
 * بيرجع فلوس عملية دفع ناجحة، بالكامل أو جزء منها.
 * ملحوظة مهمة: kashierOrderId هنا هو orderId الداخلي بتاع Kashier (اللي بيرجع في الـ webhook
 * تحت اسم "kashierOrderId" أو "orderId")، مش الـ merchantOrderId بتاعنا إحنا.
 * @param {string} kashierOrderId - orderId الداخلي عند Kashier
 * @param {number} amount - المبلغ المطلوب استرجاعه
 * @param {string} [reason]
 */
async function refundKashierTransaction({ kashierOrderId, amount, reason }) {
  const { data } = await axios.put(
    `${FEP_BASE}/orders/${kashierOrderId}/`,
    {
      apiOperation: 'REFUND',
      reason: reason || 'Refund',
      transaction: { amount: Number(amount) },
    },
    {
      headers: {
        Authorization: process.env.KASHIER_SECRET_KEY,
        'Content-Type': 'application/json',
      },
    }
  );
  return {
    success: data.status === 'SUCCESS',
    raw: data,
  };
}

module.exports = {
  isKashierConfigured,
  createKashierPaymentIntent,
  verifyKashierWebhookSignature,
  queryKashierOrder,
  refundKashierTransaction,
};
