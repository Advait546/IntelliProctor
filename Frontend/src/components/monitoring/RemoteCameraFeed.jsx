import React, { useEffect, useState } from 'react';
import { CameraOff, RefreshCw } from 'lucide-react';
import { monitoringApi } from '../../api/monitoringApi';

/**
 * Examiner-side view of a CANDIDATE's camera: polls the latest keyframe the
 * candidate uploaded (GET /proctor/sessions/:id/snapshot). This replaces the
 * old behaviour of opening the examiner's own webcam on every card.
 */
export const RemoteCameraFeed = ({ sessionId, size = 'small', live = true, intervalMs = 1500, label, endedText }) => {
  const [src, setSrc] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!sessionId) return undefined;
    if (!live && endedText) {
      setMissing(true); // session over: the volatile live keyframe no longer exists
      return undefined;
    }
    let cancelled = false;
    let current = null;
    const load = async () => {
      try {
        const blob = await monitoringApi.getSnapshotBlob(sessionId);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setSrc(url);
        setMissing(false);
        if (current) URL.revokeObjectURL(current);
        current = url;
      } catch {
        if (!cancelled) setMissing(true);
      }
    };
    load();
    const id = live ? setInterval(load, intervalMs) : null;
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
      if (current) URL.revokeObjectURL(current);
    };
  }, [sessionId, live, intervalMs, endedText]);

  const sizeClasses = { small: 'h-36', medium: 'h-48', large: 'h-72 sm:h-96' };
  return (
    <div className={`relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 ${sizeClasses[size]}`}>
      {src && !missing ? (
        <img src={src} alt="Candidate camera" className="w-full h-full object-cover transform -scale-x-100" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-[11px] gap-1">
          {missing ? <CameraOff className="w-7 h-7" /> : <RefreshCw className="w-6 h-6 animate-spin" />}
          <span className="text-center px-3">{missing ? endedText || 'No camera frames from candidate yet' : 'Loading feed...'}</span>
        </div>
      )}
      {label && (
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-mono text-slate-200 border border-slate-700">
          {label}
        </div>
      )}
      {live && src && !missing && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> LIVE
        </div>
      )}
    </div>
  );
};
