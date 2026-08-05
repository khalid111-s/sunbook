const mongoose = require('mongoose');
const dns = require('dns');

// بعض شبكات Windows بتفشل في SRV lookup — نستخدم DNS عام
// ⚠️ ده للتطوير المحلي بس. على Vercel (production) بيبوظ الاتصال لأن
// البيئة بترفض طلبات DNS المباشرة دي، فبنستخدمه محليًا بس.
if (process.env.NODE_ENV !== 'production') {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const connectDB = async () => {
  // لو الاتصال شغال بالفعل (مهم مع Vercel serverless عشان منفتحش اتصال جديد كل طلب)
  if (mongoose.connection.readyState === 1) return;

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 6+ لا يحتاج هذه الخيارات
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    // ملحوظة: متستخدمش process.exit هنا لأنها بتبوظ بيئة serverless (Vercel)
    throw error;
  }
};

module.exports = connectDB;