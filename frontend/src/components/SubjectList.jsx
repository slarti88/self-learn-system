import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function SubjectList() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getSubjects()
      .then(setSubjects)
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
          </div>
        ))}
      </div>
    </div>
  );
}
