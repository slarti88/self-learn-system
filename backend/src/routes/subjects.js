const express = require('express');
const router = express.Router();
const topicsConfig = require('../../config/topics.json');
const storage = require('../services/storage');
const ai = require('../services/ai');
const proficiency = require('../services/proficiency');
const config = require('../../config/config.json');

function getSubject(subjectId) {
  return topicsConfig.subjects.find(s => s.id === subjectId);
}

function getTopic(subject, topicId) {
  return subject.topics.find(t => t.id === topicId);
}

function calculateSubtopicCompletion(correct) {
  const expertMin = config.proficiency.expert.min;
  return Math.min(correct / expertMin, 1) * 100;
}

function calculateTopicCompletion(subjectId, topicId) {
  const subtopics = storage.read(`subtopics/${subjectId}/${topicId}.json`);
  if (!subtopics || subtopics.length === 0) return 0;
  const allProgress = storage.read('progress/user_progress.json') || {};
  const subjectProgress = allProgress[subjectId] || {};
  const total = subtopics.reduce((sum, sub) => {
    const entry = subjectProgress[sub.id] || { correct: 0 };
    return sum + calculateSubtopicCompletion(entry.correct);
  }, 0);
  return total / subtopics.length;
}

// List all subjects (without topics array)
router.get('/', (req, res) => {
  const subjects = topicsConfig.subjects.map(({ id, name, description }) => ({ id, name, description }));
  res.json(subjects);
});

// List topics for a subject
router.get('/:subjectId/topics', (req, res) => {
  const subject = getSubject(req.params.subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  res.json(subject.topics);
});

// Get subtopics for a topic (AI-generated, cached)
router.get('/:subjectId/topics/:topicId/subtopics', async (req, res) => {
  const { subjectId, topicId } = req.params;

  const subject = getSubject(subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const topic = getTopic(subject, topicId);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });

  const cached = storage.read(`subtopics/${subjectId}/${topicId}.json`);
  if (cached) return res.json(cached);

  try {
    const subtopics = await ai.generateSubtopics(topic.name, topic.description, subject.name);
    storage.write(`subtopics/${subjectId}/${topicId}.json`, subtopics);
    res.json(subtopics);
  } catch (err) {
    console.error('Error generating subtopics:', err.message);
    res.status(500).json({ error: 'Failed to generate subtopics' });
  }
});

// Get content for a subtopic (AI-generated, cached)
router.get('/:subjectId/subtopics/:topicId/:subtopicId/content', async (req, res) => {
  const { subjectId, topicId, subtopicId } = req.params;

  const subject = getSubject(subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const topic = getTopic(subject, topicId);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });

  const subtopics = storage.read(`subtopics/${subjectId}/${topicId}.json`);
  if (!subtopics) return res.status(404).json({ error: 'Subtopics not yet generated. Please fetch subtopics first.' });

  const subtopic = subtopics.find(s => s.id === subtopicId);
  if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });

  const cached = storage.read(`content/${subjectId}/${topicId}_${subtopicId}.json`);
  if (cached) return res.json(cached);

  try {
    const content = await ai.generateContent(topic.name, subtopic.name, subtopic.description, subject.name);
    const result = { topicId, subtopicId, content };
    storage.write(`content/${subjectId}/${topicId}_${subtopicId}.json`, result);
    res.json(result);
  } catch (err) {
    console.error('Error generating content:', err.message);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

// Get quiz questions for a subtopic (AI-generated, not cached)
router.get('/:subjectId/subtopics/:topicId/:subtopicId/questions', async (req, res) => {
  const { subjectId, topicId, subtopicId } = req.params;

  const subject = getSubject(subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const topic = getTopic(subject, topicId);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });

  const subtopics = storage.read(`subtopics/${subjectId}/${topicId}.json`);
  if (!subtopics) return res.status(404).json({ error: 'Subtopics not yet generated' });

  const subtopic = subtopics.find(s => s.id === subtopicId);
  if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });

  try {
    const count = config.session.questionsPerSession || 5;
    const questions = await ai.generateQuestions(topic.name, subtopic.name, count, subject.name);
    res.json(questions);
  } catch (err) {
    console.error('Error generating questions:', err.message);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

// Get topic completion percentage
router.get('/:subjectId/topics/:topicId/completion', (req, res) => {
  const { subjectId, topicId } = req.params;
  const subject = getSubject(subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  const topic = getTopic(subject, topicId);
  if (!topic) return res.status(404).json({ error: 'Topic not found' });
  res.json({ completion: Math.round(calculateTopicCompletion(subjectId, topicId)) });
});

// Get subject completion percentage
router.get('/:subjectId/completion', (req, res) => {
  const { subjectId } = req.params;
  const subject = getSubject(subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  if (!subject.topics || subject.topics.length === 0) return res.json({ completion: 0 });
  const total = subject.topics.reduce((sum, topic) => sum + calculateTopicCompletion(subjectId, topic.id), 0);
  res.json({ completion: Math.round(total / subject.topics.length) });
});

// Get progress for a subtopic within a subject
router.get('/:subjectId/progress/:subtopicId', (req, res) => {
  const { subjectId, subtopicId } = req.params;
  const allProgress = storage.read('progress/user_progress.json') || {};
  const subjectProgress = allProgress[subjectId] || {};
  const entry = subjectProgress[subtopicId] || { correct: 0, wrong: 0 };
  const level = proficiency.getLevel(entry.correct);
  const completion = Math.round(calculateSubtopicCompletion(entry.correct));
  res.json({ ...entry, level, completion });
});

// Submit quiz result for a subtopic within a subject
router.post('/:subjectId/progress/:subtopicId', (req, res) => {
  const { subjectId, subtopicId } = req.params;
  const { correct, wrong } = req.body;

  if (typeof correct !== 'number' || typeof wrong !== 'number') {
    return res.status(400).json({ error: 'correct and wrong must be numbers' });
  }

  const allProgress = storage.read('progress/user_progress.json') || {};
  if (!allProgress[subjectId]) allProgress[subjectId] = {};
  const existing = allProgress[subjectId][subtopicId] || { correct: 0, wrong: 0 };

  allProgress[subjectId][subtopicId] = {
    correct: existing.correct + correct,
    wrong: existing.wrong + wrong
  };

  storage.write('progress/user_progress.json', allProgress);

  const level = proficiency.getLevel(allProgress[subjectId][subtopicId].correct);
  res.json({ ...allProgress[subjectId][subtopicId], level });
});

module.exports = router;
