import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import CompletionBar from './CompletionBar';

export default function SubjectList() {
  const [subjects, setSubjects] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getSubjects()
      .then(async (subs) => {
        setSubjects(subs);
        const compMap = {};
        await Promise.all(
          subs.map(async (s) => {
            try {
              const { completion } = await api.getSubjectCompletion(s.id);
              compMap[s.id] = completion;
            } catch {
              compMap[s.id] = 0;
            }
          })
        );
        setCompletions(compMap);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /><p>Loading subjects...</p></div>;
  if (error) return <div className="error-msg">Error: {error}</div>;

  return (
    <div className="screen">
      <h2 className="screen-title">Choose a Subject</h2>
      <div className="card-grid">
        {subjects.map(subject => (
          <div
            key={subject.id}
            className="card"
            onClick={() => navigate(`/subject/${subject.id}`, { state: { subject } })}
          >
            <h3>{subject.name}</h3>
            <p>{subject.description}</p>
            <CompletionBar completion={completions[subject.id] ?? 0} />
          </div>
        ))}
      </div>
    </div>
  );
}
