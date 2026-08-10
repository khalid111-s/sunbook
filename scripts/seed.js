require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
const mongoose = require('mongoose');
const User = require('../models/User');

dns.setServers(['8.8.8.8', '1.1.1.1']);

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const teacherEmail = 'teacher@thesunbook.com';
  let teacher = await User.findOne({ email: teacherEmail });

  if (!teacher) {
    teacher = await User.create({
      name: 'Ahmed Salem',
      email: teacherEmail,
      password: 'Teacher123',
      phone: '01000000000',
      role: 'teacher',
    });
    console.log('✅ Teacher created:', teacherEmail, '/ Teacher123');
  } else {
    teacher.role = 'teacher';
    await teacher.save();
    console.log('✅ Teacher already exists:', teacherEmail);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
