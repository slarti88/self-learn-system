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
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getProgress(subjectId, subtopicId), api.getSession()])
      .then(([prog, sess]) => {
        setProgress(prog);
        setSession(sess);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [subjectId, subtopicId]);

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading...</p></div>;

  const cooldownMins = session?.active ? Math.floor(session.remainingSeconds / 60) : 0;
  const cooldownSecs = session?.active ? session.remainingSeconds % 60 : 0;

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

        <div className="quiz-btn-wrapper">
          <button
            className={`btn ${session?.active ? 'btn-disabled' : 'btn-secondary'}`}
            disabled={session?.active}
            onClick={() => navigate(`/subject/${subjectId}/topic/${topicId}/subtopic/${subtopicId}/quiz`, {
              state: { subject, topic, subtopic }
            })}
          >
            Start Quiz
          </button>
          {session?.active && (
            <p className="cooldown-hint">
              Available in {cooldownMins}m {String(cooldownSecs).padStart(2, '0')}s
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
