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

// الإيميل اللي بتوصله تنبيهات الأدمن (طلب جديد / حجز جديد). لو مش متظبط، بيستخدم نفس إيميل الإرسال.
function getAdminEmail() {
  return process.env.ADMIN_EMAIL || process.env.SMTP_USER;
}

// ─── القالب الأساسي المشترك لكل الإيميلات - نفس هوية الموقع (خلفية سودا + دهبي) ───
function renderEmailShell({ heading, bodyHtml, footerNote }) {
  return `
    <div style="background:#0d0d0d; padding: 32px 16px; font-family: Georgia, 'Times New Roman', serif;">
      <div style="max-width: 520px; margin: 0 auto; background:#131313; border: 1px solid rgba(216,176,86,0.25); border-radius: 14px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #d8b056, #b8860b); padding: 22px 30px;">
          <h1 style="margin:0; color:#111; font-size: 1.3rem; letter-spacing: 1px;">The Sun Book</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color:#d8b056; font-size: 1.2rem; margin: 0 0 16px;">${heading}</h2>
          ${bodyHtml}
        </div>
        <div style="border-top: 1px solid rgba(216,176,86,0.15); padding: 18px 30px; text-align:center;">
          <p style="color:#666; font-size:0.75rem; margin:0; letter-spacing: 0.5px;">${footerNote || 'The Sun Book'}</p>
        </div>
      </div>
    </div>
  `;
}

// بيبني صف من صفوف جدول ملخص الطلب (كتاب × كمية .... سعر)
function renderItemsTable(items) {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0; color:#e8e8e8; border-bottom:1px solid rgba(216,176,86,0.1);">${i.title} <span style="color:#888;">×${i.qty}</span></td>
        <td style="padding:8px 0; color:#d8b056; text-align:right; border-bottom:1px solid rgba(216,176,86,0.1);">LE ${(i.price * i.qty).toFixed(2)}</td>
      </tr>`
    )
    .join('');
  return `<table style="width:100%; border-collapse: collapse; margin: 16px 0;">${rows}</table>`;
}

async function dispatchEmail({ to, subject, html }) {
  if (!isEmailConfigured()) {
    console.log(`[email disabled] "${subject}" for ${to} was not sent (SMTP not configured).`);
    return { sent: false, reason: 'SMTP not configured' };
  }
  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: `"The Sun Book" <${fromAddress}>`,
    to,
    subject,
    html,
  });
  return { sent: true };
}

// @param resetUrl الرابط الكامل اللي هيودّي المستخدم لصفحة إعادة تعيين الباسورد مع التوكن
async function sendPasswordResetEmail(toEmail, userName, resetUrl) {
  const html = renderEmailShell({
    heading: 'Password Reset Request',
    bodyHtml: `
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
    `,
  });
  return dispatchEmail({ to: toEmail, subject: 'Reset your password - The Sun Book', html });
}

// ─── تأكيد الطلب للعميل ───
async function sendOrderConfirmationEmail(order) {
  const shortId = String(order._id).slice(-6).toUpperCase();
  const html = renderEmailShell({
    heading: 'Order Confirmed 🌞',
    bodyHtml: `
      <p style="color:#e8e8e8; line-height: 1.6; margin: 0 0 12px;">Hi ${order.customerName || 'there'},</p>
      <p style="color:#c9c9c9; line-height: 1.6; margin: 0 0 20px;">
        Thank you for your order! Here's a quick summary:
      </p>
      <p style="color:#888; font-size:0.85rem; margin: 0 0 6px;">Order #${shortId}</p>
      ${renderItemsTable(order.items)}
      ${order.discountAmount > 0 ? `<p style="color:#34A853; text-align:right; margin: 4px 0;">Discount (${order.promoCode}): -LE ${Number(order.discountAmount).toFixed(2)}</p>` : ''}
      <p style="color:#d8b056; text-align:right; font-weight:bold; font-size:1.1rem; margin: 12px 0 0;">Total: LE ${Number(order.totalAmount).toFixed(2)}</p>
      <p style="color:#888; font-size:0.85rem; line-height:1.6; margin: 28px 0 0;">
        You can track your order status anytime from your profile page.
      </p>
    `,
  });
  return dispatchEmail({ to: order.customerEmail, subject: `Order Confirmed - #${shortId}`, html });
}

// ─── تنبيه للأدمن بطلب جديد ───
async function sendNewOrderAdminAlert(order) {
  const shortId = String(order._id).slice(-6).toUpperCase();
  const html = renderEmailShell({
    heading: 'New Order Received 🔔',
    bodyHtml: `
      <p style="color:#e8e8e8; line-height:1.6; margin:0 0 6px;"><strong>Customer:</strong> ${order.customerName}</p>
      <p style="color:#e8e8e8; line-height:1.6; margin:0 0 6px;"><strong>Phone:</strong> ${order.phone || '—'}</p>
      <p style="color:#e8e8e8; line-height:1.6; margin:0 0 20px;"><strong>Country:</strong> ${order.country || 'Unknown'}</p>
      ${renderItemsTable(order.items)}
      <p style="color:#d8b056; text-align:right; font-weight:bold; font-size:1.1rem; margin: 12px 0 0;">Total: LE ${Number(order.totalAmount).toFixed(2)}</p>
      <p style="color:#888; font-size:0.8rem; margin: 20px 0 0;">Order #${shortId} • ${new Date(order.createdAt || Date.now()).toLocaleString('en-GB')}</p>
    `,
    footerNote: 'The Sun Book — Admin Notification',
  });
  return dispatchEmail({ to: getAdminEmail(), subject: `New Order #${shortId} - LE ${Number(order.totalAmount).toFixed(2)}`, html });
}

// ─── تأكيد الحجز للطالب ───
async function sendBookingConfirmationEmail(booking) {
  const dateStr = new Date(booking.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const html = renderEmailShell({
    heading: 'Session Booked ✨',
    bodyHtml: `
      <p style="color:#e8e8e8; line-height: 1.6; margin: 0 0 12px;">Hi ${booking.studentName || 'there'},</p>
      <p style="color:#c9c9c9; line-height: 1.6; margin: 0 0 20px;">Your session has been booked successfully.</p>
      <p style="color:#e8e8e8; margin:0 0 6px;"><strong>Subject:</strong> ${booking.subject || '—'}</p>
      <p style="color:#e8e8e8; margin:0 0 6px;"><strong>Date &amp; Time:</strong> ${dateStr}</p>
      <p style="color:#d8b056; margin:16px 0 0; font-weight:bold;">Price: LE ${Number(booking.price).toFixed(2)}</p>
      <p style="color:#888; font-size:0.85rem; line-height:1.6; margin: 28px 0 0;">
        You can view or manage your bookings anytime from your profile page.
      </p>
    `,
  });
  return dispatchEmail({ to: booking.studentEmail, subject: 'Session Booking Confirmed - The Sun Book', html });
}

// ─── تنبيه للأدمن بحجز جديد ───
async function sendNewBookingAdminAlert(booking) {
  const dateStr = new Date(booking.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const html = renderEmailShell({
    heading: 'New Session Booking 🔔',
    bodyHtml: `
      <p style="color:#e8e8e8; line-height:1.6; margin:0 0 6px;"><strong>Student:</strong> ${booking.studentName}</p>
      <p style="color:#e8e8e8; line-height:1.6; margin:0 0 6px;"><strong>Email:</strong> ${booking.studentEmail || '—'}</p>
      <p style="color:#e8e8e8; line-height:1.6; margin:0 0 6px;"><strong>Phone:</strong> ${booking.studentPhone || '—'}</p>
      <p style="color:#e8e8e8; line-height:1.6; margin:0 0 6px;"><strong>Subject:</strong> ${booking.subject || '—'}</p>
      <p style="color:#e8e8e8; line-height:1.6; margin:0 0 20px;"><strong>Date &amp; Time:</strong> ${dateStr}</p>
      <p style="color:#d8b056; font-weight:bold; font-size:1.1rem; margin: 0;">Price: LE ${Number(booking.price).toFixed(2)}</p>
    `,
    footerNote: 'The Sun Book — Admin Notification',
  });
  return dispatchEmail({ to: getAdminEmail(), subject: `New Booking - ${booking.studentName}`, html });
}

// ─── تذكير قبل الجلسة بـ10 دقايق ───
async function sendBookingReminderEmail(booking) {
  const dateStr = new Date(booking.date).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const html = renderEmailShell({
    heading: 'Your Session Starts Soon ⏰',
    bodyHtml: `
      <p style="color:#e8e8e8; line-height: 1.6; margin: 0 0 12px;">Hi ${booking.studentName || 'there'},</p>
      <p style="color:#c9c9c9; line-height: 1.6; margin: 0 0 20px;">
        Just a reminder — your session <strong style="color:#d8b056;">"${booking.subject}"</strong> starts at
        <strong style="color:#d8b056;">${dateStr}</strong>, in about 10 minutes.
      </p>
      <div style="text-align:center; margin: 26px 0;">
        <a href="${booking.sessionUrl}" style="background: linear-gradient(135deg, #d8b056, #b8860b); color:#111; padding:14px 32px; border-radius:8px; text-decoration:none; font-weight:bold; font-size: 0.95rem; display:inline-block;">Join Session</a>
      </div>
    `,
  });
  return dispatchEmail({ to: booking.studentEmail, subject: 'Your session starts in 10 minutes - The Sun Book', html });
}

module.exports = {
  isEmailConfigured,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendNewOrderAdminAlert,
  sendBookingConfirmationEmail,
  sendNewBookingAdminAlert,
  sendBookingReminderEmail,
};
