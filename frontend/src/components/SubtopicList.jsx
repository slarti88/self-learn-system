import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import BackButton from './BackButton';
import ProficiencyBadge from './ProficiencyBadge';
import CompletionBar from './CompletionBar';

export default function SubtopicList() {
  const { subjectId, topicId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { subject, topic } = location.state || {};

  const [subtopics, setSubtopics] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formFile, setFormFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    api.getSubtopics(subjectId, topicId)
      .then(async (subs) => {
        setSubtopics(subs);
        const progressMap = {};
        await Promise.all(
          subs.map(async (s) => {
            try {
              const p = await api.getProgress(subjectId, s.id);
              progressMap[s.id] = p;
            } catch {
              progressMap[s.id] = { correct: 0, wrong: 0, level: 'beginner' };
            }
          })
        );
        setProgress(progressMap);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [subjectId, topicId]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!formName || !formDesc || !formFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('name', formName);
      fd.append('description', formDesc);
      fd.append('pdf', formFile);
      const newSub = await api.createManualSubtopic(subjectId, topicId, fd);
      setSubtopics(prev => [...prev, newSub]);
      setProgress(prev => ({ ...prev, [newSub.id]: { correct: 0, wrong: 0, level: 'beginner', completion: 0 } }));
      setShowForm(false);
      setFormName('');
      setFormDesc('');
      setFormFile(null);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(e, sub) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${sub.name}" and its PDF? This cannot be undone.`)) return;
    try {
      await api.deleteSubtopic(subjectId, topicId, sub.id);
      setSubtopics(prev => prev.filter(s => s.id !== sub.id));
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  if (loading) return (
    <div className="screen">
      <BackButton />
      <div className="loading">
        <div className="spinner" />
        <p>Generating sub-topics with AI... this may take a moment.</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="screen">
      <BackButton />
      <div className="error-msg">Error: {error}</div>
    </div>
  );

  return (
    <div className="screen">
      <BackButton />
      <h2 className="screen-title">{topic?.name || topicId}</h2>
      <p className="screen-subtitle">{topic?.description}</p>
      <div className="card-grid">
        {subtopics.map(sub => {
          const isManual = sub.type === 'manual';
          return (
            <div
              key={sub.id}
              className={`card ${isManual ? 'card-manual' : ''}`}
              onClick={() => navigate(`/subject/${subjectId}/topic/${topicId}/subtopic/${sub.id}`, {
                state: { subject, topic, subtopic: sub }
              })}
            >
              <div className="card-top">
                <h3>{sub.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {isManual && <span className="badge-pdf">PDF</span>}
                  <ProficiencyBadge level={progress[sub.id]?.level || 'beginner'} />
                </div>
              </div>
              <p>{sub.description}</p>
              {isManual && !sub.embeddingsReady && (
                <p className="indexing-note">Indexing...</p>
              )}
              <CompletionBar completion={progress[sub.id]?.completion ?? 0} />
              {isManual && (
                <button
                  className="btn-delete-subtopic"
                  title="Delete subtopic"
                  onClick={(e) => handleDelete(e, sub)}
                >
                  &#x1F5D1;
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        {!showForm ? (
          <button className="btn btn-add-subtopic" onClick={() => setShowForm(true)}>
            + Add Subtopic
          </button>
        ) : (
          <form className="manual-subtopic-form" onSubmit={handleUpload}>
            <h3>Add Manual Subtopic</h3>
            <label>
              Name
              <input
                type="text"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                required
                placeholder="e.g. Chapter 3 Notes"
              />
            </label>
            <label>
              Description
              <textarea
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                required
                placeholder="Brief description of the content"
                rows={3}
              />
            </label>
            <label>
              PDF File
              <input
                type="file"
                accept=".pdf"
                required
                onChange={e => setFormFile(e.target.files[0])}
              />
            </label>
            {uploadError && <p className="form-error">{uploadError}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
              <button
                type="button"
                className="btn btn-cancel"
                onClick={() => { setShowForm(false); setUploadError(null); }}
                disabled={uploading}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
