const axios = require('axios');

// دومين PayTabs بيختلف حسب المنطقة اللي سجلت فيها الحساب (مصر هنا).
// لو حصل خطأ "authentication" غريب بعد التجربة، راجع مقال PayTabs
// "What is my (Region)/(endpoint URL)?" وحدّث القيمة دي أو حط PAYTABS_BASE_URL في .env
const PAYTABS_BASE = process.env.PAYTABS_BASE_URL || 'https://secure-egypt.paytabs.com';

function isPaytabsConfigured() {
  const profileId = process.env.PAYTABS_PROFILE_ID || '';
  const serverKey = process.env.PAYTABS_SERVER_KEY || '';
  return profileId.length > 0 && serverKey.length > 0;
}

/**
 * بينشئ طلب دفع على PayTabs ويرجع رابط صفحة الدفع المستضافة (Hosted Payment Page).
 * @param {Object} params
 * @param {number} params.amount - المبلغ بالعملة المحددة (مش بالقروش/السنتات، رقم عادي زي 43.02)
 * @param {'EGP'|'EUR'} params.currency - العملة (لازم تكون مفعّلة على الـ Profile من لوحة PayTabs الأول)
 * @param {string} params.cartId - معرّف فريد للطلب (بنستخدم Order._id بتاعنا)
 * @param {string} params.description - وصف مختصر يظهر في تقارير PayTabs
 * @param {Object} params.customer - { name, email, phone, street, city, country }
 * @param {string} params.callbackUrl - رابط الـ webhook اللي PayTabs هينده عليه بعد الدفع (سيرفر لسيرفر)
 * @param {string} params.returnUrl - الرابط اللي المتصفح هيترجع له بعد ما العميل يخلّص الدفع
 */
async function createPaytabsPaymentIntent({
  amount,
  currency,
  cartId,
  description,
  customer,
  callbackUrl,
  returnUrl,
}) {
  const payload = {
    profile_id: Number(process.env.PAYTABS_PROFILE_ID),
    tran_type: 'sale',
    tran_class: 'ecom',
    cart_id: String(cartId),
    cart_currency: currency,
    cart_amount: Number(amount),
    cart_description: description || 'The Sun Book order',
    paypage_lang: 'en',
    // بنجمع بيانات العميل/الشحن في موقعنا إحنا قبل ما نوجهه لـ PayTabs، فمش محتاجين
    // نضيّع وقته بفورم شحن تاني هناك - ده بيسرّع الدفع بشكل واضح
    hide_shipping: true,
    customer_details: {
      name: customer?.name || 'Sunbook Customer',
      email: customer?.email || 'no-reply@sunbook.example',
      phone: customer?.phone || '00000000000',
      street1: customer?.street || 'N/A',
      city: customer?.city || 'N/A',
      state: customer?.city || 'N/A',
      country: customer?.country || 'EG',
      zip: '00000',
      ip: customer?.ip || '1.1.1.1',
    },
    callback: callbackUrl,
    return: returnUrl,
  };

  const { data } = await axios.post(`${PAYTABS_BASE}/payment/request`, payload, {
    headers: {
      authorization: process.env.PAYTABS_SERVER_KEY,
      'Content-Type': 'application/json',
    },
  });

  // data.redirect_url = رابط صفحة الدفع اللي المفروض نوجّه العميل ليها
  // data.tran_ref = مرجع العملية عند PayTabs، بنستخدمه لمطابقة الـ webhook بالطلب عندنا
  return {
    redirectUrl: data.redirect_url,
    tranRef: data.tran_ref,
    raw: data,
  };
}

/**
 * بيسأل PayTabs مباشرة عن الحالة الحقيقية لعملية دفع، بدل ما نستنى إشعار (webhook)
 * ممكن يتأخر أو ميوصلش. ده مصدر معلومة أضمن للتأكد من نتيجة الدفع.
 * @param {string} tranRef - مرجع العملية اللي PayTabs رجّعهولنا وقت إنشاء الطلب
 */
async function queryPaytabsTransaction(tranRef) {
  const payload = {
    profile_id: Number(process.env.PAYTABS_PROFILE_ID),
    tran_ref: tranRef,
  };

  const { data } = await axios.post(`${PAYTABS_BASE}/payment/query`, payload, {
    headers: {
      authorization: process.env.PAYTABS_SERVER_KEY,
      'Content-Type': 'application/json',
    },
  });

  return {
    responseStatus: data.payment_result?.response_status, // 'A' = Approved
    raw: data,
  };
}

module.exports = { createPaytabsPaymentIntent, isPaytabsConfigured, queryPaytabsTransaction };
