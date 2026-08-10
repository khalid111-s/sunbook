require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const dns = require('dns');
const mongoose = require('mongoose');
const Product = require('../models/Product');

dns.setServers(['8.8.8.8', '1.1.1.1']);

// نفس المنتجات اللي كانت مكتوبة ثابتة جوه js/script.js في الفرونت اند،
// دلوقتي هتترحل للداتابيز عشان الموقع يجيبها من الـ API.
const products = [
  {
    title: 'Trio Wisdom Bundle',
    price: 79.99,
    image: 'assets/book-bundle.png',
    description:
      'A powerful collection of ancient wisdom. This bundle includes three essential texts that uncover the mysteries of the old world.',
    type: 'physical',
    badges: ['Paperback', 'English'],
    featured: true,
    order: 1,
  },
  {
    title: 'Mystic Elements Bundle',
    price: 60.0,
    image: 'assets/book-bundle.png',
    description:
      'Master the elements. This exclusive bundle brings together the core teachings of earth, water, air, and fire.',
    type: 'physical',
    badges: ['Hardcover', 'English'],
    featured: true,
    order: 2,
  },
  {
    title: 'Book of Symbolism',
    price: 34.99,
    image: 'assets/book-symbolism.png',
    description:
      'Unlock the hidden meanings behind ancient symbols and their profound influence on modern spirituality.',
    type: 'digital',
    badges: ['E-Book', 'PDF'],
    order: 3,
  },
  {
    title: 'The Golden Path',
    price: 45.0,
    image: 'assets/book-bundle.png',
    description:
      'Trace the steps of the ancients through this beautifully bound hardcover guide to enlightenment.',
    type: 'physical',
    badges: ['Hardcover', 'English'],
    order: 4,
  },
  {
    title: 'Secrets of the Ancients',
    price: 30.0,
    image: 'assets/book-symbolism.png',
    description:
      'A deep dive into the esoteric knowledge preserved by secret societies across millennia.',
    type: 'digital',
    badges: ['Digital', 'PDF'],
    order: 5,
  },
  {
    title: 'Lost Rituals',
    price: 25.99,
    image: 'assets/book-wisdom.png',
    description:
      'Discover the forgotten ceremonies that shaped ancient civilizations and their connection to the cosmos.',
    type: 'digital',
    badges: ['E-Book', 'English'],
    order: 6,
  },
  {
    title: 'The Lunar Chronicles',
    price: 22.5,
    image: 'assets/book-prophecy.png',
    description:
      'Understand the profound influence of lunar cycles on ancient magic, prophecies, and human history.',
    type: 'digital',
    badges: ['E-Book', 'English'],
    order: 7,
  },
  {
    title: 'The Sun Book - Exclusive',
    price: 55.0,
    image: 'assets/book-symbolism.png',
    description:
      'The masterpiece of our collection. The Sun Book holds the ultimate truth of the solar deities.',
    type: 'physical',
    badges: ['Exclusive'],
    order: 8,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  for (const p of products) {
    const existing = await Product.findOne({ title: p.title });
    if (existing) {
      await Product.updateOne({ _id: existing._id }, p);
      console.log('🔄 Updated:', p.title);
    } else {
      await Product.create(p);
      console.log('✅ Created:', p.title);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
