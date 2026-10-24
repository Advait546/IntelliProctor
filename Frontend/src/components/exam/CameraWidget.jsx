import React, { useEffect, useRef } from 'react';
import { Camera, AlertCircle, Eye, CameraOff, WifiOff } from 'lucide-react';
import { useWebcam, captureFrame } from '../../hooks/useWebcam';
import { useProctoring } from '../../contexts/ProctoringContext';
import { monitoringApi } from '../../api/monitoringApi';
import { errorCode } from '../../api/client';

// ~1.4 frames/s: MediaPipe head-pose needs >1 Hz to measure the 1.0 s turn dwell
// time; YOLO runs decoupled on the worker at its own pace. A new frame is never
// sent while the previous one is still in flight.
const FRAME_INTERVAL_MS = 700;

/**
 * Candidate's LOCAL camera (Stream 1). With ``sendFrames`` it also uploads
 * keyframes to the backend CV pipeline and renders the returned observation.
 * Examiner views use <RemoteCameraFeed/> instead -- never this component.
 */
export const CameraWidget = ({
  size = 'medium',
  compact = false,
  sendFrames = false,
  sessionId = null,
  sessionToken = null,
  onSessionClosed = null,
  onVideoReady = null,
}) => {
  const { videoRef, hasPermission, error } = useWebcam();
  const { liveStudentAI, applyObservation, proctorStatus, setProctorStatus, triggerNotification } = useProctoring();
  const closedRef = useRef(onSessionClosed);
  closedRef.current = onSessionClosed;

  useEffect(() => {
    if (hasPermission) onVideoReady?.(videoRef.current);
  }, [hasPermission, onVideoReady, videoRef]);

  useEffect(() => {
    if (!sendFrames) return undefined;
    if (!hasPermission) {
      if (error) setProctorStatus('camera-blocked');
      return undefined;
    }
    if (!sessionId || !sessionToken) return undefined;

    let cancelled = false;
    let inFlight = false;
    let failures = 0;

    const tick = async () => {
      if (inFlight || cancelled) return;
      const image = captureFrame(videoRef.current, { quality: 0.7 });
      if (!image) return;
      inFlight = true;
      try {
        const res = await monitoringApi.sendFrame(sessionId, sessionToken, image);
        if (cancelled) return;
        failures = 0;
        setProctorStatus(res.cvOnline ? 'online' : 'offline');
        if (res.observation) applyObservation(res.observation);
        (res.notices || []).forEach((n) => triggerNotification(n.type, n.message));
      } catch (err) {
        if (cancelled) return;
        const code = errorCode(err);
        if (code === 'SESSION_NOT_ACTIVE' || err?.response?.status === 401) {
          cancelled = true;
          closedRef.current?.(code);
          return;
        }
        failures += 1;
        if (failures >= 3) setProctorStatus('offline');
      } finally {
        inFlight = false;
      }
    };

    const id = setInterval(tick, FRAME_INTERVAL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sendFrames, hasPermission, error, sessionId, sessionToken, videoRef, applyObservation, setProctorStatus, triggerNotification]);

  const sizeClasses = { small: 'h-36 w-full', medium: 'h-48 w-full', large: 'h-72 sm:h-96 w-full' };
  const ai = liveStudentAI;
  const statusTone =
    proctorStatus === 'online' ? 'text-emerald-400 border-emerald-500/30' : proctorStatus === 'connecting' ? 'text-amber-300 border-amber-500/30' : 'text-red-300 border-red-500/30';
  const statusText = { online: 'AI PROCTOR LIVE', connecting: 'CONNECTING', offline: 'AI OFFLINE', 'camera-blocked': 'CAMERA BLOCKED' }[proctorStatus];

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-md ${sizeClasses[size]}`}>
      {hasPermission ? (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-gradient-to-b from-slate-950 to-slate-900">
          {error ? <CameraOff className="w-9 h-9 text-red-400" /> : <Camera className="w-9 h-9 text-indigo-400 animate-pulse" />}
          <span className="mt-2 text-[11px] text-slate-300 font-medium max-w-[16rem]">
            {error ? `${error} Allow camera access in the browser address bar, then reload.` : 'Starting camera...'}
          </span>
        </div>
      )}

      {sendFrames && hasPermission && (
        <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-between pointer-events-none">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] font-mono border ${statusTone}`}>
            {proctorStatus === 'online' ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> : <WifiOff className="w-3 h-3" />}
            {statusText}
          </div>
          {!compact && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] font-mono text-slate-300 border border-slate-700">
              <Eye className="w-3 h-3 text-indigo-400" />
              {ai.gazeDirection}
            </div>
          )}
        </div>
      )}

      {sendFrames && proctorStatus === 'online' && !ai.faceVisible && (
        <div className="absolute inset-0 bg-red-950/70 z-30 flex flex-col items-center justify-center text-white p-3 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mb-1" />
          <div className="text-xs font-bold text-red-100">FACE NOT VISIBLE</div>
          <div className="text-[10px] text-red-200 mt-0.5">Please position yourself in front of the camera.</div>
        </div>
      )}
    </div>
  );
};
