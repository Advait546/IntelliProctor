import { useEffect, useRef, useState } from 'react';
import { wsUrl } from '../api/client';

/**
 * WebSocket with exponential-backoff reconnect (1s, 2s, 4s, 8s ... max 15s),
 * per FRONTEND_ARCHITECTURE.md section 20. ``path`` null disables the socket.
 */
export const useLiveSocket = (path, onMessage) => {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    if (!path) return undefined;
    let ws;
    let closed = false;
    let attempt = 0;
    let timer;

    const connect = () => {
      ws = new WebSocket(wsUrl(path));
      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type !== 'ping') handler.current?.(msg);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = (e) => {
        setConnected(false);
        if (closed || [4401, 4403, 4404].includes(e.code)) return;
        const delay = Math.min(15000, 1000 * 2 ** attempt++);
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [path]);

  return { connected };
};
