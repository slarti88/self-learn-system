const express = require('express');
const router = express.Router();
const topics = require('../../config/topics.json');
const storage = require('../services/storage');
const openaiService = require('../services/ai');

router.get('/:topicId/:subtopicId/content', async (req, res) => {
  const { topicId, subtopicId } = req.params;

  const topic = topics.find(t => t.id === topicId);
  if (!topic) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  const subtopics = storage.read(`subtopics/${topicId}.json`);
  if (!subtopics) {
    return res.status(404).json({ error: 'Subtopics not yet generated. Please fetch subtopics first.' });
  }

  const subtopic = subtopics.find(s => s.id === subtopicId);
  if (!subtopic) {
    return res.status(404).json({ error: 'Subtopic not found' });
  }

  const cached = storage.read(`content/${topicId}_${subtopicId}.json`);
  if (cached) {
    return res.json(cached);
  }

  try {
    const content = await openaiService.generateContent(topic.name, subtopic.name, subtopic.description);
    const result = { topicId, subtopicId, content };
    storage.write(`content/${topicId}_${subtopicId}.json`, result);
    res.json(result);
  } catch (err) {
    console.error('Error generating content:', err.message);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

module.exports = router;
