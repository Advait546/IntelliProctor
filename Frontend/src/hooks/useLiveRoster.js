import { useCallback, useEffect, useRef, useState } from 'react';
import { monitoringApi } from '../api/monitoringApi';
import { errorMessage, getToken } from '../api/client';
import { useLiveSocket } from './useLiveSocket';

const POLL_MS = 3000;

/**
 * Examiner live roster: REST poll every 3 s plus an immediate refresh whenever
 * the backend pushes an event on the examiner WebSocket (section 14.1).
 */
export const useLiveRoster = (examId = null, { includeFinished = false, onEvent } = {}) => {
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await monitoringApi.getLiveCandidates(examId, includeFinished);
      setStudents(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Live sync delayed'));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [examId, includeFinished]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const token = getToken('examiner');
  const path = token ? `/ws/v1/proctor/live${examId ? `/${examId}` : ''}?token=${encodeURIComponent(token)}` : null;
  const { connected } = useLiveSocket(path, (msg) => {
    onEvent?.(msg);
    refresh();
  });

  return { students, error, loading, refresh, socketConnected: connected };
};
