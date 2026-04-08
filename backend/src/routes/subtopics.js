const express = require('express');
const router = express.Router();
const topics = require('../../config/topics.json');
const storage = require('../services/storage');
const openaiService = require('../services/ai');

router.get('/:topicId/subtopics', async (req, res) => {
  const { topicId } = req.params;

  const topic = topics.find(t => t.id === topicId);
  if (!topic) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  const cached = storage.read(`subtopics/${topicId}.json`);
  if (cached) {
    return res.json(cached);
  }

  try {
    const subtopics = await openaiService.generateSubtopics(topic.name, topic.description);
    storage.write(`subtopics/${topicId}.json`, subtopics);
    res.json(subtopics);
  } catch (err) {
    console.error('Error generating subtopics:', err.message);
    res.status(500).json({ error: 'Failed to generate subtopics' });
  }
});

module.exports = router;
