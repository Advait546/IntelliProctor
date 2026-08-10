import { useState, useEffect } from 'react';

export const useTimer = (initialMinutes = 60, onTimeUp = null) => {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let interval = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      setIsActive(false);
      if (onTimeUp) onTimeUp();
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft, onTimeUp]);

  const formatTime = () => {
    const hours = Math.floor(secondsLeft / 3600);
    const mins = Math.floor((secondsLeft % 3600) / 60);
    const secs = secondsLeft % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  const pauseTimer = () => setIsActive(false);
  const resumeTimer = () => setIsActive(true);

  return { secondsLeft, formatTime, isActive, pauseTimer, resumeTimer };
};
