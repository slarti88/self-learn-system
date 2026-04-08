import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import BackButton from './BackButton';
import CompletionBar from './CompletionBar';

export default function TopicList() {
  const { subjectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const subject = location.state?.subject;

  const [topics, setTopics] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getTopics(subjectId)
      .then(async (tops) => {
        setTopics(tops);
        const compMap = {};
        await Promise.all(
          tops.map(async (t) => {
            try {
              const { completion } = await api.getTopicCompletion(subjectId, t.id);
              compMap[t.id] = completion;
            } catch {
              compMap[t.id] = 0;
            }
          })
        );
        setCompletions(compMap);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [subjectId]);

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading topics...</p></div>;
  if (error) return <div className="error-msg">Error: {error}</div>;

  return (
    <div className="screen">
      <BackButton />
      <h2 className="screen-title">{subject?.name || subjectId}</h2>
      <p className="screen-subtitle">{subject?.description}</p>
      <div className="card-grid">
        {topics.map(topic => (
          <div
            key={topic.id}
            className="card"
            onClick={() => navigate(`/subject/${subjectId}/topic/${topic.id}`, { state: { subject, topic } })}
          >
            <h3>{topic.name}</h3>
            <p>{topic.description}</p>
            <CompletionBar completion={completions[topic.id] ?? 0} />
          </div>
        ))}
      </div>
    </div>
  );
}
