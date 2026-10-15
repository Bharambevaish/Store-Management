const Calendar = require('../models/calendar');

exports.getEvents = async (req, res) => {
  try {
    // If Calendar model doesn't exist yet or is empty, we just return empty array
    let events = [];
    if (Calendar) {
      events = await Calendar.find().sort({ startDate: 1 });
    }
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
