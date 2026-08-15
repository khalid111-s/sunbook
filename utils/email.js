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
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #222;">
        <h2 style="color:#b8860b;">Password Reset Request</h2>
        <p>Hi ${userName || 'there'},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
        <p style="text-align:center; margin: 28px 0;">
          <a href="${resetUrl}" style="background:#b8860b; color:#fff; padding:12px 26px; border-radius:6px; text-decoration:none; font-weight:bold;">Reset Password</a>
        </p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p style="color:#888; font-size:0.85rem;">The Sun Book</p>
      </div>
    `,
  });

  return { sent: true };
}

module.exports = { isEmailConfigured, sendPasswordResetEmail };
