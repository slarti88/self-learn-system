const BASE_URL = '/api';

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function del(path) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getSubjects: () => get('/subjects'),
  getTopics: (subjectId) => get(`/subjects/${subjectId}/topics`),
  getSubtopics: (subjectId, topicId) => get(`/subjects/${subjectId}/topics/${topicId}/subtopics`),
  getContent: (subjectId, topicId, subtopicId) => get(`/subjects/${subjectId}/subtopics/${topicId}/${subtopicId}/content`),
  getQuestions: (subjectId, topicId, subtopicId) => get(`/subjects/${subjectId}/subtopics/${topicId}/${subtopicId}/questions`),
  getTopicCompletion: (subjectId, topicId) => get(`/subjects/${subjectId}/topics/${topicId}/completion`),
  getSubjectCompletion: (subjectId) => get(`/subjects/${subjectId}/completion`),
  getProgress: (subjectId, subtopicId) => get(`/subjects/${subjectId}/progress/${subtopicId}`),
  submitProgress: (subjectId, subtopicId, correct, wrong) => post(`/subjects/${subjectId}/progress/${subtopicId}`, { correct, wrong }),
  createManualSubtopic: (subjectId, topicId, formData) => {
    return fetch(`${BASE_URL}/subjects/${subjectId}/topics/${topicId}/subtopics`, {
      method: 'POST',
      body: formData
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Request failed: ${res.status}`);
      }
      return res.json();
    });
  },
  deleteSubtopic: (subjectId, topicId, subtopicId) =>
    del(`/subjects/${subjectId}/topics/${topicId}/subtopics/${subtopicId}`),
  getPdfUrl: (subjectId, topicId, subtopicId) =>
    `${BASE_URL}/subjects/${subjectId}/topics/${topicId}/subtopics/${subtopicId}/pdf`,
};
