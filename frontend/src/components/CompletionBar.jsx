export default function CompletionBar({ completion }) {
  return (
    <div className="card-completion">
      <div className="card-completion-bar">
        <div className="card-completion-fill" style={{ width: `${completion}%` }} />
      </div>
      <span className="card-completion-text">{Math.round(completion)}% complete</span>
    </div>
  );
}
