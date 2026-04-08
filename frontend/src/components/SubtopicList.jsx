import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import BackButton from './BackButton';
import ProficiencyBadge from './ProficiencyBadge';

export default function SubtopicList() {
  const { subjectId, topicId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { subject, topic } = location.state || {};

  const [subtopics, setSubtopics] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        {subtopics.map(sub => (
          <div
            key={sub.id}
            className="card"
            onClick={() => navigate(`/subject/${subjectId}/topic/${topicId}/subtopic/${sub.id}`, {
              state: { subject, topic, subtopic: sub }
            })}
          >
            <div className="card-top">
              <h3>{sub.name}</h3>
              <ProficiencyBadge level={progress[sub.id]?.level || 'beginner'} />
            </div>
            <p>{sub.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
