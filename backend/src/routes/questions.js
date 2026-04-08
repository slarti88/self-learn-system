const express = require('express');
const router = express.Router();
const topics = require('../../config/topics.json');
const storage = require('../services/storage');
const openaiService = require('../services/ai');
const config = require('../../config/config.json');

router.get('/:topicId/:subtopicId/questions', async (req, res) => {
  const { topicId, subtopicId } = req.params;

  const topic = topics.find(t => t.id === topicId);
  if (!topic) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  const subtopics = storage.read(`subtopics/${topicId}.json`);
  if (!subtopics) {
    return res.status(404).json({ error: 'Subtopics not yet generated' });
  }

  const subtopic = subtopics.find(s => s.id === subtopicId);
  if (!subtopic) {
    return res.status(404).json({ error: 'Subtopic not found' });
  }

  try {
    const count = config.session.questionsPerSession || 5;
    const questions = await openaiService.generateQuestions(topic.name, subtopic.name, count);
    res.json(questions);
  } catch (err) {
    console.error('Error generating questions:', err.message);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

module.exports = router;
