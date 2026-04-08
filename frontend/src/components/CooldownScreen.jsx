import { useEffect, useState } from 'react';
import BackButton from './BackButton';

export default function CooldownScreen({ remainingSeconds, onComplete }) {
  const [seconds, setSeconds] = useState(remainingSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onComplete?.();
      return;
    }
    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="screen cooldown-screen">
      <BackButton />
      <div className="cooldown-content">
        <div className="cooldown-icon">⏳</div>
        <h2>Take a Short Break</h2>
        <p>Great work completing the session! Rest for a few minutes to let it sink in.</p>
        <div className="cooldown-timer">
          {mins}:{String(secs).padStart(2, '0')}
        </div>
        <p className="cooldown-hint">Quiz unlocks when the timer reaches 0:00</p>
      </div>
    </div>
  );
}
