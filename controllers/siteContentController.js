const SiteContent = require('../models/SiteContent');
const seedItems = require('../data/siteContentSeed');

// بتتأكد إن كل النصوص الافتراضية موجودة في قاعدة البيانات، من غير ما تدوس
// على أي تعديل عمله الأدمن قبل كده (upsert بـ $setOnInsert بس)
async function ensureSeeded() {
  const ops = seedItems.map((item) => ({
    updateOne: {
      filter: { key: item.key },
      update: { $setOnInsert: item },
      upsert: true,
    },
  }));
  if (ops.length) await SiteContent.bulkWrite(ops);
}

// @desc    Get all editable site content (public - the frontend i18n engine needs this for every visitor)
// @route   GET /api/site-content
// @access  Public
const getSiteContent = async (req, res) => {
  await ensureSeeded();
  const items = await SiteContent.find().sort({ group: 1, key: 1 });
  res.json({ success: true, data: items });
};

// @desc    Update one or more site content items
// @route   PUT /api/site-content
// @access  Private/Admin
const updateSiteContent = async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'لا توجد نصوص لتحديثها' });
  }

  const ops = [];
  for (const item of items) {
    if (!item.key) continue;
    const update = {};
    if (typeof item.en === 'string') update.en = item.en;
    if (typeof item.ar === 'string') update.ar = item.ar;
    if (Object.keys(update).length === 0) continue;
    ops.push({ updateOne: { filter: { key: item.key }, update: { $set: update } } });
  }

  if (ops.length === 0) {
    return res.status(400).json({ success: false, message: 'لا توجد بيانات صالحة للتحديث' });
  }

  await SiteContent.bulkWrite(ops);
  const items2 = await SiteContent.find().sort({ group: 1, key: 1 });
  res.json({ success: true, data: items2 });
};

module.exports = { getSiteContent, updateSiteContent };
