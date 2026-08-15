const nodemailer = require('nodemailer');

// بيبني الـ transporter من متغيرات البيئة (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
// شغالة مع أي مزود SMTP عادي (Gmail App Password, SendGrid, Mailgun, Zoho, ...إلخ).
function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true لبورت 465، false (STARTTLS) لباقي البورتات زي 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// @param resetUrl الرابط الكامل اللي هيودّي المستخدم لصفحة إعادة تعيين الباسورد مع التوكن
async function sendPasswordResetEmail(toEmail, userName, resetUrl) {
  if (!isEmailConfigured()) {
    // مفيش SMTP متظبط لسه - نطبع الرابط في اللوج بدل ما نكسر الطلب، عشان تقدر تختبر الفلو محليًا
    console.log(`[email disabled] Password reset link for ${toEmail}: ${resetUrl}`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: `"The Sun Book" <${fromAddress}>`,
    to: toEmail,
    subject: 'Reset your password - The Sun Book',
    html: `
      <div style="background:#0d0d0d; padding: 32px 16px; font-family: Georgia, 'Times New Roman', serif;">
        <div style="max-width: 480px; margin: 0 auto; background:#131313; border: 1px solid rgba(216,176,86,0.25); border-radius: 14px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #d8b056, #b8860b); padding: 22px 30px;">
            <h1 style="margin:0; color:#111; font-size: 1.3rem; letter-spacing: 1px;">The Sun Book</h1>
          </div>
          <div style="padding: 30px;">
            <h2 style="color:#d8b056; font-size: 1.2rem; margin: 0 0 16px;">Password Reset Request</h2>
            <p style="color:#e8e8e8; line-height: 1.6; margin: 0 0 12px;">Hi ${userName || 'there'},</p>
            <p style="color:#c9c9c9; line-height: 1.6; margin: 0 0 24px;">
              We received a request to reset your password. Click the button below to choose a new one.
              This link expires in <strong style="color:#d8b056;">1 hour</strong>.
            </p>
            <div style="text-align:center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #d8b056, #b8860b); color:#111; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:bold; font-size: 0.95rem; display:inline-block;">Reset Password</a>
            </div>
            <p style="color:#888; font-size:0.85rem; line-height:1.6; margin: 24px 0 0;">
              If you didn't request this, you can safely ignore this email — your password will stay the same.
            </p>
          </div>
          <div style="border-top: 1px solid rgba(216,176,86,0.15); padding: 18px 30px; text-align:center;">
            <p style="color:#666; font-size:0.75rem; margin:0; letter-spacing: 0.5px;">The Sun Book</p>
          </div>
        </div>
      </div>
    `,
  });

  return { sent: true };
}

module.exports = { isEmailConfigured, sendPasswordResetEmail };
