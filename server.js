// نقطة الدخول التقليدية (تستخدم محليًا أو على Render).
// على Vercel، بيتم استخدام api/index.js بدل الملف ده.
const app = require('./app');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
