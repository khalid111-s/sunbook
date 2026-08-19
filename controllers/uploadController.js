const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const ALLOWED_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

// @desc    رفع صورة منتج (بتوصل كـ base64 data URL من الأدمن) وحفظها في /uploads
// @route   POST /api/upload
// @access  Private/Admin
const uploadImage = async (req, res) => {
  const { image } = req.body;

  if (!image || typeof image !== 'string') {
    res.status(400);
    throw new Error('لازم تبعت صورة (image) كـ base64 data URL');
  }

  const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    res.status(400);
    throw new Error('صيغة الصورة غير صالحة');
  }

  const mimeType = match[1].toLowerCase();
  const extension = ALLOWED_TYPES[mimeType];
  if (!extension) {
    res.status(400);
    throw new Error('نوع الصورة غير مدعوم. استخدم PNG أو JPG أو WEBP فقط');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_SIZE_BYTES) {
    res.status(400);
    throw new Error('حجم الصورة أكبر من الحد المسموح (8MB)');
  }

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extension}`;
  const filePath = path.join(UPLOAD_DIR, uniqueName);

  fs.writeFileSync(filePath, buffer);

  // بيرجع مسار نسبي، الفرونت إند هو اللي بيضيف دومين الباك إند قبله
  res.status(201).json({
    success: true,
    data: {
      path: `/uploads/${uniqueName}`,
    },
  });
};

module.exports = { uploadImage };
