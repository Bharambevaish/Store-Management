const Settings = require('../models/settings');

exports.getSettings = async (req, res) => {
  try {
    let setting = await Settings.findOne();
    if (!setting) {
      setting = await Settings.create({});
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    let setting = await Settings.findOne();
    if (setting) {
      setting = await Settings.findByIdAndUpdate(setting._id, req.body, { new: true });
    } else {
      setting = new Settings(req.body);
      await setting.save();
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
