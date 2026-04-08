const express = require('express');
const router = express.Router();
const storage = require('../services/storage');
const config = require('../../config/config.json');

// Get current cooldown state
router.get('/session', (req, res) => {
  const session = storage.read('progress/session.json') || { lastSessionEnd: null };
  const cooldownMs = (config.session.cooldownMinutes || 5) * 60 * 1000;

  if (!session.lastSessionEnd) {
    return res.json({ active: false, remainingSeconds: 0 });
  }

  const elapsed = Date.now() - new Date(session.lastSessionEnd).getTime();
  const remaining = cooldownMs - elapsed;

  if (remaining <= 0) {
    return res.json({ active: false, remainingSeconds: 0 });
  }

  res.json({ active: true, remainingSeconds: Math.ceil(remaining / 1000) });
});

// Start cooldown after a session ends
router.post('/session/start', (req, res) => {
  storage.write('progress/session.json', { lastSessionEnd: new Date().toISOString() });
  res.json({ success: true });
});

module.exports = router;
