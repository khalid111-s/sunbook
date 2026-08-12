const Settings = require('../models/Settings');

async function getOrCreateSettings() {
  let settings = await Settings.findOne({ key: 'general' });
  if (!settings) settings = await Settings.create({ key: 'general' });
  return settings;
}

// @desc    Get site settings (e.g. EUR→EGP conversion rate)
// @route   GET /api/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
  const settings = await getOrCreateSettings();
  res.json({ success: true, data: settings });
};

// @desc    Update site settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
  const { eurToEgpRate } = req.body;
  const settings = await getOrCreateSettings();

  if (eurToEgpRate !== undefined && eurToEgpRate !== null && eurToEgpRate > 0) {
    settings.eurToEgpRate = eurToEgpRate;
  }

  await settings.save();
  res.json({ success: true, data: settings });
};

module.exports = { getSettings, updateSettings, getOrCreateSettings };
