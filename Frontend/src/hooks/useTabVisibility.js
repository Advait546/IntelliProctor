import { useEffect, useRef } from 'react';

/**
 * Browser tab / window visibility monitoring (FRONTEND_ARCHITECTURE.md 17.2).
 * Completely independent of the CV pipeline. Reports raw transitions only --
 * the backend measures authoritative durations and assigns ZERO points.
 */
export const useTabVisibility = ({ onTabHidden, onTabVisible, onBlur, onFocus, enabled = true }) => {
  const hideTimeRef = useRef(null);
  const handlers = useRef({ onTabHidden, onTabVisible, onBlur, onFocus });
  handlers.current = { onTabHidden, onTabVisible, onBlur, onFocus };

  useEffect(() => {
    if (!enabled) return undefined;

    const hide = () => {
      if (hideTimeRef.current !== null) return; // already hidden
      hideTimeRef.current = performance.now();
      handlers.current.onTabHidden?.({ timestamp: new Date().toISOString() });
    };
    const show = () => {
      if (hideTimeRef.current === null) return;
      const durationMs = Math.round(performance.now() - hideTimeRef.current);
      hideTimeRef.current = null;
      handlers.current.onTabVisible?.({ timestamp: new Date().toISOString(), durationMs });
    };

    const handleVisibilityChange = () => (document.hidden ? hide() : show());
    // Window blur also covers switching to another application while the tab
    // itself stays "visible" (e.g. split screen / second window).
    const handleBlur = () => {
      handlers.current.onBlur?.({ timestamp: new Date().toISOString() });
      hide();
    };
    const handleFocus = () => {
      handlers.current.onFocus?.({ timestamp: new Date().toISOString() });
      show();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled]);
};
