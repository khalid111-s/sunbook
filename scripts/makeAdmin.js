// سكريبت تشغّله مرة واحدة عشان تحوّل حساب مسجّل بالفعل إلى "admin"
// عشان يقدر يدخل صفحة admin.html ويضيف/يعدّل/يمسح منتجات.
// أول حاجة: اعمل حساب عادي من صفحة تسجيل الدخول في الموقع (Register)،
// وبعدين شغّل السكريبت ده بإيميلك:
//   node scripts/makeAdmin.js your@email.com
// مسموح بـ 3 admins بحد أقصى في نفس الوقت (نفس حد صفحة admin-setup.html).
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
const mongoose = require('mongoose');
const User = require('../models/User');

dns.setServers(['8.8.8.8', '1.1.1.1']);

const MAX_ADMINS = 3;

async function makeAdmin() {
  const email = process.argv[2];
  if (!email) {
    console.error('❌ لازم تكتب الإيميل بعد اسم السكريبت، مثال:');
    console.error('   node scripts/makeAdmin.js your@email.com');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const user = await User.findOne({ email });
  if (!user) {
    console.log(`⚠️ مفيش حساب بالإيميل ده: ${email}. سجّل حساب عادي في الموقع الأول.`);
  } else if (user.role === 'admin') {
    console.log(`ℹ️ الحساب ده admin بالفعل: ${user.name} (${user.email})`);
  } else {
    const currentAdmins = await User.find({ role: 'admin' }).select('name email');
    if (currentAdmins.length >= MAX_ADMINS) {
      console.log(`❌ عندك بالفعل ${MAX_ADMINS} admins (الحد الأقصى):`);
      currentAdmins.forEach((a) => console.log(`   - ${a.name} (${a.email})`));
      console.log('   شيل واحد منهم الأول (رجّع role بتاعه لـ "student") قبل ما تضيف حساب جديد.');
    } else {
      user.role = 'admin';
      await user.save();
      console.log(`✅ الحساب بقى admin دلوقتي: ${user.name} (${user.email})`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

makeAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
