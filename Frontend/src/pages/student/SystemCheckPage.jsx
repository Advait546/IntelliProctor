import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, RefreshCw, Camera, Mic, Wifi, Sun, UserCheck, Monitor, Maximize, Play, AlertTriangle, XCircle } from 'lucide-react';
import { CameraWidget } from '../../components/exam/CameraWidget';
import { useAuth } from '../../contexts/AuthContext';
import { useProctoring } from '../../contexts/ProctoringContext';
import { examApi } from '../../api/examApi';
import { monitoringApi } from '../../api/monitoringApi';
import { errorMessage } from '../../api/client';
import { captureFrame, frameBrightness } from '../../hooks/useWebcam';

const CHECKS = [
  { id: 'cam', name: 'Camera Stream', icon: Camera },
  { id: 'mic', name: 'Microphone', icon: Mic },
  { id: 'net', name: 'Backend & AI Proctor', icon: Wifi },
  { id: 'light', name: 'Ambient Lighting', icon: Sun },
  { id: 'face', name: 'Face Visibility (MediaPipe)', icon: UserCheck },
  { id: 'browser', name: 'Browser Compatibility', icon: Monitor },
  { id: 'full', name: 'Fullscreen API Support', icon: Maximize },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const SystemCheckPage = () => {
  const navigate = useNavigate();
  const { studentSession, setExamSession } = useAuth();
  const { resetProctoring } = useProctoring();
  const videoEl = useRef(null);
  const started = useRef(false);
  const [results, setResults] = useState(() => Object.fromEntries(CHECKS.map((c) => [c.id, { status: 'testing', note: 'Waiting...' }])));
  const [running, setRunning] = useState(false);
  const [startError, setStartError] = useState('');
  const [startingExam, setStartingExam] = useState(false);

  const set = (id, status, note) => setResults((prev) => ({ ...prev, [id]: { status, note } }));

  const runChecks = useCallback(async () => {
    setRunning(true);
    CHECKS.forEach((c) => set(c.id, 'testing', 'Checking...'));

    const hasGUM = !!navigator.mediaDevices?.getUserMedia;
    const okBrowser = hasGUM && 'WebSocket' in window && 'fetch' in window;
    set('browser', okBrowser ? 'pass' : 'fail', okBrowser ? 'getUserMedia, WebSocket & Fetch available' : 'Use a recent Chrome, Edge or Firefox');
    const fsOk = !!document.documentElement.requestFullscreen;
    set('full', fsOk ? 'pass' : 'warn', fsOk ? 'Fullscreen lock supported' : 'Fullscreen not supported (exam can continue)');

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mic = devices.some((d) => d.kind === 'audioinput');
      set('mic', mic ? 'pass' : 'warn', mic ? 'Audio input device detected' : 'No microphone found (not required)');
    } catch {
      set('mic', 'warn', 'Could not enumerate audio devices');
    }

    const t0 = performance.now();
    try {
      const h = await monitoringApi.cvHealth();
      const ms = Math.round(performance.now() - t0);
      if (h.cvService === 'online') set('net', ms < 1500 ? 'pass' : 'warn', `Backend ${ms} ms • AI proctor online`);
      else set('net', 'warn', `Backend ${ms} ms • AI proctor OFFLINE (exam allowed, monitoring limited)`);
    } catch (err) {
      set('net', 'fail', errorMessage(err));
    }

    // Wait up to 5 s for the camera to deliver frames.
    let video = videoEl.current;
    for (let i = 0; i < 25 && !(video && video.readyState >= 2 && video.videoWidth); i += 1) {
      await sleep(200);
      video = videoEl.current;
    }
    if (!video || !video.videoWidth) {
      set('cam', 'fail', 'No camera frames. Allow camera access and reload.');
      set('light', 'fail', 'Needs camera');
      set('face', 'fail', 'Needs camera');
      setRunning(false);
      return;
    }
    const res = `${video.videoWidth}x${video.videoHeight}`;
    set('cam', video.videoHeight >= 480 ? 'pass' : 'warn', video.videoHeight >= 720 ? `${res} (HD)` : `${res} (720p recommended)`);

    const b = frameBrightness(video);
    if (b === null) set('light', 'warn', 'Could not measure');
    else if (b < 45) set('light', 'fail', `Too dark (${Math.round(b)}/255). Add light in front of you.`);
    else if (b > 225) set('light', 'warn', `Very bright (${Math.round(b)}/255). Avoid backlight.`);
    else set('light', 'pass', `Good illumination (${Math.round(b)}/255)`);

    try {
      const pc = await monitoringApi.precheck(captureFrame(video, { quality: 0.8 }));
      if (!pc.cvOnline) set('face', 'warn', 'AI proctor offline -- face check skipped');
      else if (pc.faceCount === 1) set('face', 'pass', 'Exactly one face detected');
      else if (pc.faceCount === 0) set('face', 'fail', 'No face detected. Sit centred in front of the camera.');
      else set('face', 'fail', `${pc.faceCount} faces detected. Only the candidate may be visible.`);
    } catch (err) {
      set('face', 'warn', errorMessage(err, 'Face check unavailable'));
    }
    setRunning(false);
  }, []);

  const onVideoReady = useCallback(
    (el) => {
      videoEl.current = el;
      if (!started.current) {
        started.current = true;
        runChecks();
      }
    },
    [runChecks]
  );

  const anyFail = Object.values(results).some((r) => r.status === 'fail');
  const allDone = Object.values(results).every((r) => r.status !== 'testing');
  const canStart = allDone && !anyFail && !running;

  const handleStartExam = async () => {
    setStartError('');
    setStartingExam(true);
    try {
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      // Reference photograph for the examiner (best effort, section 5.3).
      const blob = await captureFrame(videoEl.current, { quality: 0.85, asBlob: true });
      if (blob) monitoringApi.uploadReferencePhoto(blob).catch(() => {});
      // Admission handshake: passkey + window validated by the backend, which
      // creates (or resumes) the attempt and returns the scoped session token.
      const res = await examApi.verifyPasskey(studentSession.examCode);
      resetProctoring();
      setExamSession({
        sessionToken: res.sessionToken,
        sessionId: res.session.sessionId,
        examId: res.exam.id,
        examTitle: res.exam.title,
        examCode: studentSession.examCode,
        expiresAt: res.session.expiresAt,
        serverNow: res.session.serverNow,
        resumed: res.resumed,
      });
      navigate('/student/exam');
    } catch (err) {
      setStartError(errorMessage(err, 'Could not start the exam'));
    } finally {
      setStartingExam(false);
    }
  };

  const passed = Object.values(results).filter((r) => r.status === 'pass').length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">AUTOMATED DIAGNOSTICS</span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">System Hardware Verification</h1>
            <p className="text-xs text-slate-500 font-medium">Camera, lighting, face visibility and connectivity checks</p>
          </div>
          {running || !allDone ? (
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 font-extrabold text-xs flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Running Diagnostics...
            </span>
          ) : (
            <span className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 ${anyFail ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {anyFail ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {passed}/{CHECKS.length} Checks Passed
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          <div className="sm:col-span-1">
            <div className="text-xs font-bold text-slate-700 mb-2">Live Camera Test View:</div>
            <CameraWidget size="medium" compact onVideoReady={onVideoReady} />
          </div>
          <div className="sm:col-span-2 space-y-3">
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-950 font-medium">
              <strong className="font-bold block mb-1">AI Proctor Diagnostic Note:</strong>
              Sit centred, face the screen, and make sure only you are visible. A reference photo is captured when you start.
            </div>
            <button
              onClick={runChecks}
              disabled={running}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} /> Re-run checks
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {CHECKS.map((c) => {
            const Icon = c.icon;
            const r = results[c.id];
            const tone =
              r.status === 'pass' ? 'bg-emerald-50/70 border-emerald-200' : r.status === 'warn' ? 'bg-amber-50/70 border-amber-200' : r.status === 'fail' ? 'bg-red-50/70 border-red-200' : 'bg-slate-50 border-slate-200';
            const iconTone = r.status === 'pass' ? 'bg-emerald-500 text-white' : r.status === 'warn' ? 'bg-amber-500 text-white' : r.status === 'fail' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600';
            return (
              <div key={c.id} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${tone}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconTone}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{c.name}</div>
                    <div className="text-[10px] text-slate-600 font-medium">{r.note}</div>
                  </div>
                </div>
                {r.status === 'pass' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {r.status === 'warn' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                {r.status === 'fail' && <XCircle className="w-5 h-5 text-red-600" />}
                {r.status === 'testing' && <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />}
              </div>
            );
          })}
        </div>

        {startError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold">{startError}</div>}

        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleStartExam}
            disabled={!canStart || startingExam}
            className={`px-10 py-5 rounded-2xl font-extrabold text-base shadow-2xl transition-all flex items-center gap-3 ${
              canStart && !startingExam
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-emerald-200 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{startingExam ? 'Starting Session...' : 'Start Examination Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
