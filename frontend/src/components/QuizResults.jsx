import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import ProficiencyBadge from './ProficiencyBadge';

export default function QuizResults({ correct, total, subjectId, topicId, subtopicId, subject, topic, subtopic }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    api.getProgress(subjectId, subtopicId).then(setProgress).catch(console.error);
  }, [subjectId, subtopicId]);

  const percentage = Math.round((correct / total) * 100);

  return (
    <div className="screen results-screen">
      <h2>Session Complete!</h2>

      <div className="score-display">
        <div className="score-circle">
          <span className="score-fraction">{correct}/{total}</span>
          <span className="score-pct">{percentage}%</span>
        </div>
        <p className="score-message">
          {percentage === 100 ? 'Perfect score!' :
           percentage >= 80 ? 'Great job!' :
           percentage >= 60 ? 'Good effort!' :
           'Keep practising!'}
        </p>
      </div>

      {progress && (
        <div className="progress-summary">
          <p>
            Total correct answers for <strong>{subtopic?.name}</strong>:{' '}
            <strong className="correct-color">{progress.correct}</strong>
          </p>
          <div className="badge-row">
            <span>Current level:</span>
            <ProficiencyBadge level={progress.level} />
          </div>
        </div>
      )}

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={() => navigate(`/subject/${subjectId}/topic/${topicId}/subtopic/${subtopicId}`, {
            state: { subject, topic, subtopic }
          })}
        >
          Back to Sub-topic
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/')}
        >
          Back to Subjects
        </button>
      </div>
    </div>
  );
}
