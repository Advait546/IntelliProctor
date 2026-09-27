import React, { useEffect, useRef } from 'react';
import { Camera, AlertCircle, Eye, RefreshCw } from 'lucide-react';
import { useWebcam } from '../../hooks/useWebcam';
import { useProctoring } from '../../contexts/ProctoringContext';
import { monitoringApi } from '../../api/monitoringApi';

// How often a real frame is captured and sent to the proctoring backend.
// Kept well above the ~100-200ms a MediaPipe+YOLO pass takes on CPU so we
// don't pile up overlapping requests.
const FRAME_CAPTURE_INTERVAL_MS = 4000;
// Stop trying (and let useProctoringSim take back over) after this many
// consecutive frame failures, so a backend outage mid-exam doesn't leave the
// UI silently stuck on stale data.
const MAX_CONSECUTIVE_FAILURES = 3;

export const CameraWidget = ({
  size = 'medium', // small | medium | large
  showOverlays = true,
  studentName = null,
  customState = null,
  compact = false
}) => {
  const { videoRef, hasPermission } = useWebcam();
  const canvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const { liveStudentAI, examSessionId, applyRealDetection, markRealProctoringUnavailable } = useProctoring();

  const aiState = customState || liveStudentAI;

  // Real proctoring: periodically grab a frame from the live <video> element
  // and send it to the Express API (which forwards to the Python
  // MediaPipe+YOLO service). Only runs once a real session has been started
  // (see ProctoringContext.startRealSession, called from SystemCheckPage)
  // and the camera is actually available -- otherwise useProctoringSim's
  // fake event loop is what's driving liveStudentAI.
  useEffect(() => {
    if (!examSessionId || !hasPermission) return undefined;

    let cancelled = false;
    let consecutiveFailures = 0;

    const captureAndSend = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return; // not enough data yet

      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
      }
      const shot = captureCanvasRef.current;
      shot.width = video.videoWidth || 640;
      shot.height = video.videoHeight || 480;
      const ctx = shot.getContext('2d');
      ctx.drawImage(video, 0, 0, shot.width, shot.height);

      let imageBase64;
      try {
        imageBase64 = shot.toDataURL('image/jpeg', 0.7);
      } catch (err) {
        return; // canvas tainted or unsupported -- nothing we can do
      }

      try {
        const result = await monitoringApi.sendFrame(examSessionId, imageBase64);
        if (cancelled) return;
        if (result?.skipped) return; // proctoring microservice busy/unreachable this tick
        consecutiveFailures = 0;
        applyRealDetection(result.session);
      } catch (err) {
        if (cancelled) return;
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          markRealProctoringUnavailable();
        }
      }
    };

    const interval = setInterval(captureAndSend, FRAME_CAPTURE_INTERVAL_MS);
    captureAndSend(); // first frame immediately rather than waiting a full interval

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [examSessionId, hasPermission, videoRef, applyRealDetection, markRealProctoringUnavailable]);

  // Render simulated AI Bounding Boxes & MediaPipe Face Mesh on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrame;
    const renderOverlays = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (showOverlays && aiState.faceVisible) {
        // Draw MediaPipe Face Landmark Bounding Box
        ctx.strokeStyle = aiState.status === 'Critical' ? '#EF4444' : aiState.status === 'Warning' ? '#F59E0B' : '#10B981';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        const boxX = w * 0.3;
        const boxY = h * 0.18;
        const boxW = w * 0.4;
        const boxH = h * 0.55;

        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Corner accents
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        const cornerLen = 12;
        // Top-Left
        ctx.beginPath(); ctx.moveTo(boxX, boxY + cornerLen); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + cornerLen, boxY); ctx.stroke();
        // Top-Right
        ctx.beginPath(); ctx.moveTo(boxX + boxW - cornerLen, boxY); ctx.lineTo(boxX + boxW, boxY); ctx.lineTo(boxX + boxW, boxY + cornerLen); ctx.stroke();
        // Bottom-Left
        ctx.beginPath(); ctx.moveTo(boxX, boxY + boxH - cornerLen); ctx.lineTo(boxX, boxY + boxH); ctx.lineTo(boxX + cornerLen, boxY + boxH); ctx.stroke();
        // Bottom-Right
        ctx.beginPath(); ctx.moveTo(boxX + boxW - cornerLen, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH - cornerLen); ctx.stroke();

        // Label Tag
        ctx.fillStyle = aiState.status === 'Critical' ? '#EF4444' : '#10B981';
        ctx.fillRect(boxX, boxY - 20, 140, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`FACE LANDMARKS (468)`, boxX + 5, boxY - 6);

        // Draw Simulated Face Mesh Points
        ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
        const meshPoints = [
          [boxX + boxW * 0.5, boxY + boxH * 0.3], // Nose
          [boxX + boxW * 0.35, boxY + boxH * 0.25], // Left Eye
          [boxX + boxW * 0.65, boxY + boxH * 0.25], // Right Eye
          [boxX + boxW * 0.5, boxY + boxH * 0.65], // Mouth
          [boxX + boxW * 0.2, boxY + boxH * 0.4], // Left Cheek
          [boxX + boxW * 0.8, boxY + boxH * 0.4], // Right Cheek
        ];
        meshPoints.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });

        // Phone Detection Box if Active
        if (aiState.phoneDetected) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([]);
          const pX = w * 0.65;
          const pY = h * 0.5;
          const pW = w * 0.25;
          const pH = h * 0.4;
          ctx.strokeRect(pX, pY, pW, pH);

          ctx.fillStyle = '#EF4444';
          ctx.fillRect(pX, pY - 18, 120, 18);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(`YOLO: PHONE (94.2%)`, pX + 4, pY - 5);
        }

        // Book Detection Box if Active
        if (aiState.bookDetected) {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2.5;
          const bX = w * 0.1;
          const bY = h * 0.6;
          const bW = w * 0.35;
          const bH = h * 0.35;
          ctx.strokeRect(bX, bY, bW, bH);

          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(bX, bY - 18, 110, 18);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(`YOLO: BOOK (87.5%)`, bX + 4, bY - 5);
        }
      }

      animationFrame = requestAnimationFrame(renderOverlays);
    };

    renderOverlays();
    return () => cancelAnimationFrame(animationFrame);
  }, [showOverlays, aiState]);

  const sizeClasses = {
    small: 'h-36 max-w-xs',
    medium: 'h-48 w-full',
    large: 'h-72 sm:h-96 w-full',
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-md ${sizeClasses[size]}`}>
      {/* Video element for real webcam feed */}
      {hasPermission ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover transform -scale-x-100"
        />
      ) : (
        /* High Quality Animated AI Camera Simulation Fallback */
        <div className="w-full h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Background Grid Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

          {/* Simulated Candidate Silhouette */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-indigo-500/50 flex items-center justify-center text-indigo-400 shadow-inner">
              <Camera className="w-10 h-10 animate-pulse" />
            </div>
            {studentName && <span className="mt-2 text-xs font-bold text-slate-200">{studentName}</span>}
            <span className="mt-1 text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" /> AI Camera Feed Active
            </span>
          </div>
        </div>
      )}

      {/* Canvas Bounding Box & Mesh Overlay */}
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
      />

      {/* Scanner laser animation */}
      <div className="animate-scanline z-30"></div>

      {/* Top Badges */}
      {!compact && (
        <div className="absolute top-2 left-2 right-2 z-30 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            LIVE REC • 30 FPS
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] font-mono text-slate-300 border border-slate-700">
            <Eye className="w-3 h-3 text-indigo-400" />
            {aiState.gazeDirection}
          </div>
        </div>
      )}

      {/* Warning Overlay Banner if Face Missing */}
      {!aiState.faceVisible && (
        <div className="absolute inset-0 bg-red-950/80 backdrop-blur-xs z-30 flex flex-col items-center justify-center text-white p-4 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 animate-bounce mb-2" />
          <div className="text-sm font-bold text-red-200">FACE MISSING FROM FRAME</div>
          <div className="text-[11px] text-red-300 max-w-xs mt-1">
            Please re-position your head directly in front of your camera.
          </div>
        </div>
      )}
    </div>
  );
};
