import React, { useRef, useEffect, useState } from 'react';
import { Camera, ShieldAlert, Eye, Smartphone, BookOpen, Users } from 'lucide-react';

const CameraWidget = ({
  studentName = "Live Stream",
  faceVisible = true,
  phoneDetected = false,
  bookDetected = false,
  multiplePerson = false,
  status = "Safe",
  compact = false,
  showOverlays = true,
  allowRealWebcam = true,
  className = ""
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [usingWebcam, setUsingWebcam] = useState(false);
  const [webcamError, setWebcamError] = useState(false);

  // Attempt to enable real user webcam if allowed
  useEffect(() => {
    if (!allowRealWebcam) return;
    
    let stream = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480 } })
      .then((mediaStream) => {
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
          setUsingWebcam(true);
        }
      })
      .catch(() => {
        setWebcamError(true);
        setUsingWebcam(false);
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [allowRealWebcam]);

  // Draw simulated YOLO & MediaPipe overlays on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrame;

    const renderOverlay = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;

      if (showOverlays) {
        // 1. MediaPipe Face Landmarks / Box
        if (faceVisible) {
          ctx.strokeStyle = '#10B981'; // Emerald
          ctx.lineWidth = 2;
          const boxX = w * 0.3;
          const boxY = h * 0.2;
          const boxW = w * 0.4;
          const boxH = h * 0.55;

          ctx.strokeRect(boxX, boxY, boxW, boxH);
          ctx.fillStyle = '#10B981';
          ctx.font = '11px sans-serif';
          ctx.fillText('YOLO: Face (98.4%)', boxX, boxY - 6);

          // Simulated MediaPipe facial points
          ctx.fillStyle = '#34D399';
          const points = [
            { x: w * 0.42, y: h * 0.38 }, // Left Eye
            { x: w * 0.58, y: h * 0.38 }, // Right Eye
            { x: w * 0.5, y: h * 0.48 },  // Nose tip
            { x: w * 0.5, y: h * 0.6 },   // Mouth center
            { x: w * 0.44, y: h * 0.6 },  // Mouth Left
            { x: w * 0.56, y: h * 0.6 }   // Mouth Right
          ];
          points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
          });
        } else {
          // Face Missing Warning Overlay
          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 13px sans-serif';
          ctx.fillText('⚠ FACE MISSING / ABSENT', w * 0.2, h * 0.5);
        }

        // 2. Phone Bounding Box
        if (phoneDetected) {
          ctx.strokeStyle = '#EF4444'; // Red
          ctx.lineWidth = 2.5;
          const pX = w * 0.65;
          const pY = h * 0.55;
          ctx.strokeRect(pX, pY, w * 0.25, h * 0.35);
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('YOLO: Phone (94.2%)', pX, pY - 6);
        }

        // 3. Book Bounding Box
        if (bookDetected) {
          ctx.strokeStyle = '#F59E0B'; // Amber
          ctx.lineWidth = 2.5;
          const bX = w * 0.1;
          const bY = h * 0.6;
          ctx.strokeRect(bX, bY, w * 0.3, h * 0.3);
          ctx.fillStyle = '#F59E0B';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('YOLO: Book (86.5%)', bX, bY - 6);
        }

        // 4. Multiple Person Box
        if (multiplePerson) {
          ctx.strokeStyle = '#8B5CF6'; // Purple
          ctx.lineWidth = 2.5;
          const mX = w * 0.7;
          const mY = h * 0.15;
          ctx.strokeRect(mX, mY, w * 0.25, h * 0.5);
          ctx.fillStyle = '#8B5CF6';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('YOLO: Person 2 (88.1%)', mX, mY - 6);
        }
      }

      animationFrame = requestAnimationFrame(renderOverlay);
    };

    renderOverlay();

    return () => cancelAnimationFrame(animationFrame);
  }, [faceVisible, phoneDetected, bookDetected, multiplePerson, showOverlays]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-lg ${
        status === "Critical" ? "ring-2 ring-rose-500/50" : ""
      } ${compact ? "h-36" : "h-56"} ${className}`}
    >
      {/* Video Stream or Simulated Canvas Background */}
      {usingWebcam ? (
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full h-full object-cover transform -scale-x-100"
        />
      ) : (
        <div className="w-full h-full relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center">
          {/* Simulated Face Silhouette */}
          <div className="relative flex flex-col items-center opacity-80">
            <div className="w-16 h-16 rounded-full bg-slate-700/80 border-2 border-indigo-400/40 flex items-center justify-center shadow-inner">
              <Camera className="w-8 h-8 text-indigo-300" />
            </div>
            <div className="w-24 h-12 bg-slate-700/60 rounded-t-full mt-1 border-t border-indigo-400/30" />
          </div>
        </div>
      )}

      {/* Dynamic Overlay Canvas for Bounding Boxes */}
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Laser Scanline effect */}
      <div className="animate-scanline" />

      {/* Top Header Tag */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900/80 backdrop-blur text-slate-200 border border-slate-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          YOLO + MediaPipe ON
        </span>
        {status === "Critical" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-bounce">
            <ShieldAlert className="w-3 h-3" />
            FLAGGED
          </span>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 backdrop-blur p-2 flex items-center justify-between border-t border-slate-800/80 text-xs">
        <span className="font-medium text-slate-200 truncate max-w-[130px]">
          {studentName}
        </span>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span
            className={`p-1 rounded ${
              faceVisible ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400 font-bold'
            }`}
            title="Face Visibility"
          >
            <Eye className="w-3.5 h-3.5 inline" />
          </span>
          <span
            className={`p-1 rounded ${
              phoneDetected ? 'bg-rose-500/20 text-rose-400 font-bold' : 'bg-slate-800 text-slate-400'
            }`}
            title="Phone Detector"
          >
            <Smartphone className="w-3.5 h-3.5 inline" />
          </span>
          <span
            className={`p-1 rounded ${
              bookDetected ? 'bg-amber-500/20 text-amber-400 font-bold' : 'bg-slate-800 text-slate-400'
            }`}
            title="Book Detector"
          >
            <BookOpen className="w-3.5 h-3.5 inline" />
          </span>
          <span
            className={`p-1 rounded ${
              multiplePerson ? 'bg-purple-500/20 text-purple-400 font-bold' : 'bg-slate-800 text-slate-400'
            }`}
            title="Multiple Person"
          >
            <Users className="w-3.5 h-3.5 inline" />
          </span>
        </div>
      </div>
    </div>
  );
};

export default CameraWidget;
