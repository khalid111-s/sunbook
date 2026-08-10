// سكريبت تشغّله مرة واحدة بس عشان يحدّث اسم حساب المعلّم (teacher@thesunbook.com)
// في قاعدة البيانات الحقيقية من "Harry B Joseph" لـ "Ahmed Salem".
// شغّله بالأمر: node scripts/fix-teacher-name.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
const mongoose = require('mongoose');
const User = require('../models/User');

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function fixName() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const teacherEmail = 'teacher@thesunbook.com';
  const teacher = await User.findOne({ email: teacherEmail });

  if (!teacher) {
    console.log('⚠️ مفيش حساب معلّم بالإيميل ده أصلاً، مفيش حاجة تتحدث.');
  } else {
    teacher.name = 'Ahmed Salem';
    await teacher.save();
    console.log('✅ الاسم اتحدث بنجاح لـ:', teacher.name);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

fixName().catch((err) => {
  console.error(err);
  process.exit(1);
});
