import { useState, useEffect, useRef } from 'react';

const pad = (n) => String(n).padStart(2, '0');

export const formatSeconds = (secondsLeft) => {
  const s = Math.max(0, Math.floor(secondsLeft));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return hours > 0 ? `${pad(hours)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
};

/**
 * Countdown to a server-authoritative deadline. ``serverNow`` (ISO) lets us
 * correct for the client's clock offset, so changing the local clock cannot
 * extend the exam (FRONTEND_ARCHITECTURE.md 4.3).
 */
export const useServerCountdown = (expiresAt, serverNow, onTimeUp) => {
  const offsetRef = useRef(0);
  const firedRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    offsetRef.current = serverNow ? new Date(serverNow).getTime() - Date.now() : 0;
    firedRef.current = false;
  }, [serverNow, expiresAt]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const end = new Date(expiresAt).getTime();
    const tick = () => {
      const left = (end - (Date.now() + offsetRef.current)) / 1000;
      setSecondsLeft(Math.max(0, left));
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeUp?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onTimeUp]);

  return { secondsLeft, formatTime: () => (secondsLeft === null ? '--:--' : formatSeconds(secondsLeft)) };
};

/** Simple local countdown (used for non-authoritative UI such as waiting rooms). */
export const useTimer = (initialMinutes = 60, onTimeUp = null) => {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);
  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeUp?.();
      return undefined;
    }
    const id = setInterval(() => setSecondsLeft((p) => p - 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft, onTimeUp]);
  return { secondsLeft, formatTime: () => formatSeconds(secondsLeft) };
};
