const { sendContactMessageEmail } = require('../utils/email');

// @desc    استقبال رسالة من فورم "Contact Us" في الموقع وبعتها بالإيميل لصاحب الموقع
// @route   POST /api/contact
// @access  Public
const sendContactMessage = async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    res.status(400);
    throw new Error('Please fill in all fields.');
  }

  const result = await sendContactMessageEmail({ name, email, subject, message });

  if (!result.sent) {
    // بنسجّل الرسالة في اللوج عشان متضيعش لو الإيميل مش متظبط، وبنبلّغ العميل إن فيه مشكلة
    // بدل ما نقوله "تم الإرسال" وهي فعليًا معملتش
    console.error(`[contact] Message from "${name}" <${email}> could NOT be emailed (${result.reason}). Subject: "${subject}" | Message: ${message}`);
    res.status(500);
    throw new Error('Sorry, we could not send your message right now. Please try again later or reach us on WhatsApp.');
  }

  res.json({ success: true, message: 'Message sent successfully.' });
};

module.exports = { sendContactMessage };
