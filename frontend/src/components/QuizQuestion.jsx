export default function QuizQuestion({ question, onAnswer, onNext, answered, selectedIndex, isLast }) {
  return (
    <div className="quiz-question">
      <h3 className="question-text">{question.question}</h3>
      <div className="options">
        {question.options.map((option, i) => {
          let cls = 'option-btn';
          if (answered) {
            if (i === question.correctIndex) cls += ' correct';
            else if (i === selectedIndex) cls += ' wrong';
          } else if (i === selectedIndex) {
            cls += ' selected';
          }
          return (
            <button
              key={i}
              className={cls}
              onClick={() => !answered && onAnswer(i)}
              disabled={answered}
            >
              {option}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={`explanation ${selectedIndex === question.correctIndex ? 'explanation-correct' : 'explanation-wrong'}`}>
          <strong>{selectedIndex === question.correctIndex ? '✓ Correct!' : '✗ Incorrect'}</strong>
          <p>{question.explanation}</p>
        </div>
      )}

      {answered && (
        <button className="btn btn-primary next-btn" onClick={onNext}>
          {isLast ? 'See Results →' : 'Next Question →'}
        </button>
      )}
    </div>
  );
}
