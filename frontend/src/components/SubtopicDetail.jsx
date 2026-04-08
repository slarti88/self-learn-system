import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import BackButton from './BackButton';
import ProficiencyBadge from './ProficiencyBadge';

export default function SubtopicDetail() {
  const { subjectId, topicId, subtopicId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { subject, topic, subtopic } = location.state || {};

  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProgress(subjectId, subtopicId)
      .then(setProgress)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [subjectId, subtopicId]);

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading...</p></div>;

  return (
    <div className="screen">
      <BackButton />

      <div className="detail-header">
        <div className="detail-title-block">
          <h2>{subtopic?.name || subtopicId}</h2>
          <p className="screen-subtitle">{subtopic?.description}</p>
        </div>
        {progress && <ProficiencyBadge level={progress.level} />}
      </div>

      {progress && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-number correct-color">{progress.correct}</span>
            <span className="stat-label">Correct</span>
          </div>
          <div className="stat-card">
            <span className="stat-number wrong-color">{progress.wrong}</span>
            <span className="stat-label">Wrong</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{progress.correct + progress.wrong}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
      )}

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={() => navigate(`/subject/${subjectId}/topic/${topicId}/subtopic/${subtopicId}/content`, {
            state: { subject, topic, subtopic }
          })}
        >
          Read One-Pager
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => navigate(`/subject/${subjectId}/topic/${topicId}/subtopic/${subtopicId}/quiz`, {
            state: { subject, topic, subtopic }
          })}
        >
          Start Quiz
        </button>
      </div>
    </div>
  );
}
