import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import BackButton from './BackButton';
import QuizQuestion from './QuizQuestion';
import QuizResults from './QuizResults';
import CooldownScreen from './CooldownScreen';

export default function Quiz() {
  const { subjectId, topicId, subtopicId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { subject, topic, subtopic } = location.state || {};

  const [phase, setPhase] = useState('loading'); // loading | cooldown | quiz | results | error
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // { selected, correct }[]
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const session = await api.getSession();
        if (session.active) {
          setSessionData(session);
          setPhase('cooldown');
          return;
        }
        const qs = await api.getQuestions(subjectId, topicId, subtopicId);
        setQuestions(qs);
        setPhase('quiz');
      } catch (e) {
        setError(e.message);
        setPhase('error');
      }
    }
    init();
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
        await Promise.all([
          api.submitProgress(subjectId, subtopicId, totalCorrect, totalWrong),
          api.startSession()
        ]);
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

  if (phase === 'cooldown') return (
    <CooldownScreen
      remainingSeconds={sessionData.remainingSeconds}
      onComplete={() => navigate(`/subject/${subjectId}/topic/${topicId}/subtopic/${subtopicId}`, {
        state: { subject, topic, subtopic }
      })}
    />
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
