const config = require('../../config/config.json');

// ── Helpers ────────────────────────────────────────────────

function stripCodeBlock(text) {
  return text
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/\s*```$/m, '')
    .trim();
}

// ── OpenAI provider ────────────────────────────────────────

async function openaiChat(systemPrompt, userPrompt) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: config.openai.model || 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt }
    ],
    temperature: 0.7
  });
  return response.choices[0].message.content.trim();
}

// ── Google AI Studio provider ──────────────────────────────

async function googleChat(systemPrompt, userPrompt) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: config.google.model || 'gemini-1.5-flash',
    systemInstruction: systemPrompt
  });
  const result = await model.generateContent(userPrompt);
  return result.response.text().trim();
}

// ── Unified chat call ──────────────────────────────────────

async function chat(systemPrompt, userPrompt) {
  const provider = config.provider || 'openai';
  if (provider === 'google') {
    return googleChat(systemPrompt, userPrompt);
  }
  return openaiChat(systemPrompt, userPrompt);
}

// ── Public functions ───────────────────────────────────────

async function generateSubtopics(topicName, topicDescription, subjectName) {
  const system = `You are an expert ${subjectName} educator. Return only valid JSON arrays, no markdown.`;
  const user = `Generate 6 to 8 sub-topics for the ${subjectName} topic: "${topicName}".
Description: ${topicDescription}

Return a JSON array with this exact structure:
[
  {
    "id": "kebab-case-id",
    "name": "Sub-topic Name",
    "description": "One sentence description of what this sub-topic covers."
  }
]

Return only the JSON array, no other text.`;

  const raw = await chat(system, user);
  return JSON.parse(stripCodeBlock(raw));
}

async function generateContent(topicName, subtopicName, subtopicDescription, subjectName) {
  const system = `You are an expert ${subjectName} educator. Write clear, engaging study material in markdown.`;
  const user = `Write a concise one-page study guide for the ${subjectName} sub-topic: "${subtopicName}" (part of ${topicName}).
Description: ${subtopicDescription}

Structure:
- Brief introduction (2-3 sentences)
- 4-6 key concepts with explanations (use ## headings)
- A real-world example
- Key takeaway

Use markdown formatting. Keep it under 600 words.`;

  return chat(system, user);
}

async function generateQuestions(topicName, subtopicName, count = 5, subjectName, ragChunks = null) {
  const system = `You are an expert ${subjectName} educator. Return only valid JSON arrays, no markdown.`;

  let user;
  if (ragChunks && ragChunks.length > 0) {
    const excerpts = ragChunks.join('\n---\n');
    user = `Based on the following excerpts from the study material:

${excerpts}

Generate ${count} multiple choice quiz questions that test understanding of the important facts, definitions, and concepts present in the material above.

Return a JSON array with this exact structure:
[
  {
    "question": "Question text here?",
    "options": ["A. Option one", "B. Option two", "C. Option three", "D. Option four"],
    "correctIndex": 0,
    "explanation": "Brief explanation of why the correct answer is right."
  }
]

Rules:
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- Each question must have exactly 4 options prefixed with A. B. C. D.
- Vary difficulty from easy to challenging
- Return only the JSON array, no other text.`;
  } else {
    user = `Generate ${count} multiple choice quiz questions about "${subtopicName}" (part of ${topicName} in ${subjectName}).

Return a JSON array with this exact structure:
[
  {
    "question": "Question text here?",
    "options": ["A. Option one", "B. Option two", "C. Option three", "D. Option four"],
    "correctIndex": 0,
    "explanation": "Brief explanation of why the correct answer is right."
  }
]

Rules:
- correctIndex is 0-based (0=A, 1=B, 2=C, 3=D)
- Each question must have exactly 4 options prefixed with A. B. C. D.
- Vary difficulty from easy to challenging
- Return only the JSON array, no other text.`;
  }

  const raw = await chat(system, user);
  return JSON.parse(stripCodeBlock(raw));
}

module.exports = { generateSubtopics, generateContent, generateQuestions };
