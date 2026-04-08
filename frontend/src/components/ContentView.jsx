import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { api } from '../services/api';
import BackButton from './BackButton';

export default function ContentView() {
  const { subjectId, topicId, subtopicId } = useParams();
  const location = useLocation();
  const { subtopic } = location.state || {};

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getContent(subjectId, topicId, subtopicId)
      .then(data => setContent(data.content))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [subjectId, topicId, subtopicId]);

  if (loading) return (
    <div className="screen">
      <BackButton />
      <div className="loading">
        <div className="spinner" />
        <p>Generating content with AI... this may take a moment.</p>
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
      <div className="content-view">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
