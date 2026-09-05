const express = require('express');
const router = express.Router();
const { paidWebhook, failedWebhook, cancelWebhook } = require('../controllers/fawaterakWebhookController');

// نقطة استقبال واحدة موحّدة لكل إشعارات فواتيرك، للطلبات والحجوزات مع بعض.
// سجّل الروابط دي في لوحة تحكم فواتيرك -> Integrations -> Webhooks/redirections URLs:
//   Paid transactions webhook       -> https://<BACKEND_URL>/api/payments/fawaterak-webhook/paid
//   Failed transactions webhook     -> https://<BACKEND_URL>/api/payments/fawaterak-webhook/failed
//   Cancellation webhook            -> https://<BACKEND_URL>/api/payments/fawaterak-webhook/cancel
router.post('/fawaterak-webhook/paid', paidWebhook);
// alias بنهاية _json - فواتيرك بتحتاج الصيغة دي في الرابط لو بعتناه كـ webhookUrl مع كل معاملة
// (زي التوثيق الرسمي بينص) عشان تضمن إنها تبعت الجسم بصيغة JSON مش form-data
router.post('/fawaterak-webhook/paid_json', paidWebhook);
router.post('/fawaterak-webhook/failed', failedWebhook);
router.post('/fawaterak-webhook/cancel', cancelWebhook);

module.exports = router;
