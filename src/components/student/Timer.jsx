import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const Timer = ({ initialMinutes = 60, onExpire }) => {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (onExpire) onExpire();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, onExpire]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const formattedMins = String(mins).padStart(2, '0');
  const formattedSecs = String(secs).padStart(2, '0');

  const isLowTime = mins < 5;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold shadow-xs ${
        isLowTime
          ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
          : 'bg-indigo-50 text-indigo-900 border-indigo-200'
      }`}
    >
      <Clock className={`w-4 h-4 ${isLowTime ? 'text-rose-600' : 'text-indigo-600'}`} />
      <span>
        {formattedMins}:{formattedSecs}
      </span>
    </div>
  );
};

export default Timer;
