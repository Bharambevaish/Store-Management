const InstituteProfile = require('../models/instituteProfile');

exports.getProfile = async (req, res) => {
  try {
    const profile = await InstituteProfile.findOne();
    res.json(profile || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    let profile = await InstituteProfile.findOne();
    if (profile) {
      profile = await InstituteProfile.findByIdAndUpdate(profile._id, req.body, { new: true });
    } else {
      profile = new InstituteProfile(req.body);
      await profile.save();
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
