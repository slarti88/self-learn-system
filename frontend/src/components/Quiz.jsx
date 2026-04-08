import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import BackButton from './BackButton';
import QuizQuestion from './QuizQuestion';
import QuizResults from './QuizResults';

export default function Quiz() {
  const { subjectId, topicId, subtopicId } = useParams();
  const location = useLocation();
  const { subject, topic, subtopic } = location.state || {};

  const [phase, setPhase] = useState('loading'); // loading | quiz | results | error
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // { selected, correct }[]
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    api.getQuestions(subjectId, topicId, subtopicId)
      .then(qs => {
        setQuestions(qs);
        setPhase('quiz');
      })
      .catch(e => {
        setError(e.message);
        setPhase('error');
      });
  }, [subjectId, topicId, subtopicId]);

  function handleAnswer(selectedIndex) {
    const question = questions[currentIdx];
    const isCorrect = selectedIndex === question.correctIndex;
    setAnswers(prev => [...prev, { selected: selectedIndex, correct: isCorrect }]);
  }

  async function handleNext() {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      const totalCorrect = answers.filter(a => a.correct).length;
      const totalWrong = answers.filter(a => !a.correct).length;
      try {
        await api.submitProgress(subjectId, subtopicId, totalCorrect, totalWrong);
      } catch (e) {
        console.error('Error submitting results:', e);
      }
      setPhase('results');
    }
  }

  if (phase === 'loading') return (
    <div className="screen">
      <BackButton />
      <div className="loading">
        <div className="spinner" />
        <p>Generating questions with AI...</p>
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div className="screen">
      <BackButton />
      <div className="error-msg">Error: {error}</div>
    </div>
  );

  if (phase === 'results') {
    const totalCorrect = answers.filter(a => a.correct).length;
    return (
      <QuizResults
        correct={totalCorrect}
        total={questions.length}
        subjectId={subjectId}
        topicId={topicId}
        subtopicId={subtopicId}
        subject={subject}
        topic={topic}
        subtopic={subtopic}
      />
    );
  }

  return (
    <div className="screen">
      <div className="quiz-header">
        <span className="quiz-label">{subtopic?.name}</span>
        <span className="quiz-counter">Question {currentIdx + 1} of {questions.length}</span>
      </div>
      <div className="quiz-progress-bar">
        <div
          className="quiz-progress-fill"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>
      <QuizQuestion
        question={questions[currentIdx]}
        onAnswer={handleAnswer}
        onNext={handleNext}
        answered={answers.length > currentIdx}
        selectedIndex={answers[currentIdx]?.selected}
        isLast={currentIdx === questions.length - 1}
      />
    </div>
  );
}
