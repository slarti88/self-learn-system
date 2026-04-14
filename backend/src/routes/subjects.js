const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const topicsConfig = require('../../config/topics.json');
const storage = require('../services/storage');
const ai = require('../services/ai');
const proficiency = require('../services/proficiency');
const config = require('../../config/config.json');

const DATA_DIR = path.join(__dirname, '../../data');
const RAG_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

// ── Multer setup ──────────────────────────────────────────────

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const { subjectId, topicId } = req.params;
      const dir = path.join(DATA_DIR, 'uploads', subjectId, topicId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Temporary name; will be renamed after slug is computed
      cb(null, `_tmp_${Date.now()}.pdf`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

// ── Helpers ───────────────────────────────────────────────────

function getSubject(subjectId) {
  return topicsConfig.subjects.find(s => s.id === subjectId);
}

function getTopic(subject, topicId) {
  return subject.topics.find(t => t.id === topicId);
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

async function callRag(method, endpoint, body) {
  const res = await fetch(`${RAG_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RAG service error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Existing routes ───────────────────────────────────────────

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
    // Mark all AI-generated subtopics with type: "ai"
    const typed = subtopics.map(s => ({ ...s, type: 'ai', pdfPath: null, embeddingsReady: false }));
    storage.write(`subtopics/${subjectId}/${topicId}.json`, typed);
    res.json(typed);
  } catch (err) {
    console.error('Error generating subtopics:', err.message);
    res.status(500).json({ error: 'Failed to generate subtopics' });
  }
});

// ── NEW: Create a manual subtopic with PDF upload ─────────────

router.post('/:subjectId/topics/:topicId/subtopics', upload.single('pdf'), async (req, res) => {
  const { subjectId, topicId } = req.params;
  const { name, description } = req.body;

  if (!name || !description) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'name and description are required' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'PDF file is required' });
  }

  const subject = getSubject(subjectId);
  if (!subject) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Subject not found' });
  }

  const topic = getTopic(subject, topicId);
  if (!topic) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Topic not found' });
  }

  const subtopicId = slugify(name);
  const pdfFilename = `${subtopicId}.pdf`;
  const pdfDir = path.join(DATA_DIR, 'uploads', subjectId, topicId);
  const finalPdfPath = path.join(pdfDir, pdfFilename);

  // Rename tmp file to final name
  fs.renameSync(req.file.path, finalPdfPath);

  // Relative path for storage reference
  const relativePdfPath = `uploads/${subjectId}/${topicId}/${pdfFilename}`;

  const newSubtopic = {
    id: subtopicId,
    name,
    description,
    type: 'manual',
    pdfPath: relativePdfPath,
    embeddingsReady: false
  };

  // Append to subtopics list (ensure it exists first)
  let subtopics = storage.read(`subtopics/${subjectId}/${topicId}.json`) || [];
  if (subtopics.find(s => s.id === subtopicId)) {
    fs.unlinkSync(finalPdfPath);
    return res.status(409).json({ error: 'A subtopic with that name already exists' });
  }
  subtopics.push(newSubtopic);
  storage.write(`subtopics/${subjectId}/${topicId}.json`, subtopics);

  // Return immediately; embed async
  res.status(201).json(newSubtopic);

  // Fire-and-forget: call RAG /embed, then mark embeddingsReady
  callRag('POST', '/embed', {
    pdf_path: finalPdfPath.replace(/\\/g, '/'),
    subtopic_id: subtopicId,
    subject_id: subjectId,
    topic_id: topicId
  }).then(() => {
    const current = storage.read(`subtopics/${subjectId}/${topicId}.json`) || [];
    const updated = current.map(s => s.id === subtopicId ? { ...s, embeddingsReady: true } : s);
    storage.write(`subtopics/${subjectId}/${topicId}.json`, updated);
  }).catch(err => {
    console.error('RAG embed failed:', err.message);
  });
});

// ── NEW: Delete a subtopic (manual only) ─────────────────────

router.delete('/:subjectId/topics/:topicId/subtopics/:subtopicId', async (req, res) => {
  const { subjectId, topicId, subtopicId } = req.params;

  const subtopics = storage.read(`subtopics/${subjectId}/${topicId}.json`);
  if (!subtopics) return res.status(404).json({ error: 'Subtopics not found' });

  const subtopic = subtopics.find(s => s.id === subtopicId);
  if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });
  if (subtopic.type !== 'manual') return res.status(403).json({ error: 'Only manual subtopics can be deleted' });

  // Remove from list
  const updated = subtopics.filter(s => s.id !== subtopicId);
  storage.write(`subtopics/${subjectId}/${topicId}.json`, updated);

  // Delete PDF
  if (subtopic.pdfPath) {
    const pdfFull = path.join(DATA_DIR, subtopic.pdfPath);
    if (fs.existsSync(pdfFull)) fs.unlinkSync(pdfFull);
  }

  // Delete cached content if any
  const contentPath = path.join(DATA_DIR, 'content', subjectId, `${topicId}_${subtopicId}.json`);
  if (fs.existsSync(contentPath)) fs.unlinkSync(contentPath);

  // Remove progress entry
  const allProgress = storage.read('progress/user_progress.json') || {};
  if (allProgress[subjectId] && allProgress[subjectId][subtopicId]) {
    delete allProgress[subjectId][subtopicId];
    storage.write('progress/user_progress.json', allProgress);
  }

  // Call RAG service to remove index (fire-and-forget)
  callRag('DELETE', `/index/${subjectId}/${topicId}/${subtopicId}`)
    .catch(err => console.error('RAG delete failed:', err.message));

  res.json({ status: 'deleted' });
});

// ── NEW: Serve PDF ────────────────────────────────────────────

router.get('/:subjectId/topics/:topicId/subtopics/:subtopicId/pdf', (req, res) => {
  const { subjectId, topicId, subtopicId } = req.params;

  const subtopics = storage.read(`subtopics/${subjectId}/${topicId}.json`);
  if (!subtopics) return res.status(404).json({ error: 'Subtopics not found' });

  const subtopic = subtopics.find(s => s.id === subtopicId);
  if (!subtopic || !subtopic.pdfPath) return res.status(404).json({ error: 'PDF not found' });

  const pdfFull = path.join(DATA_DIR, subtopic.pdfPath);
  if (!fs.existsSync(pdfFull)) return res.status(404).json({ error: 'PDF file missing' });

  res.setHeader('Content-Type', 'application/pdf');
  fs.createReadStream(pdfFull).pipe(res);
});

// ── Existing: content, questions, completion, progress ────────

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
    let ragChunks = null;

    if ((subtopic.type || 'ai') === 'manual' && subtopic.embeddingsReady) {
      try {
        const result = await callRag('POST', '/query', {
          query: 'important facts, definitions and concepts from the document',
          subtopic_id: subtopicId,
          subject_id: subjectId,
          topic_id: topicId,
          top_k: 5
        });
        ragChunks = result.chunks;
      } catch (err) {
        console.error('RAG query failed, falling back to AI:', err.message);
      }
    }

    const questions = await ai.generateQuestions(topic.name, subtopic.name, count, subject.name, ragChunks);
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
