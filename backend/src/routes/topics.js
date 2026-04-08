const express = require('express');
const router = express.Router();
const topics = require('../../config/topics.json');

router.get('/', (req, res) => {
  res.json(topics);
});

module.exports = router;
