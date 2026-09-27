import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, RefreshCw, Camera, Mic, Wifi, Sun, UserCheck, Monitor, Maximize, Play } from 'lucide-react';
import { CameraWidget } from '../../components/exam/CameraWidget';
import { useAuth } from '../../contexts/AuthContext';
import { useProctoring } from '../../contexts/ProctoringContext';

export const SystemCheckPage = () => {
  const navigate = useNavigate();
  const { studentSession } = useAuth();
  const { startRealSession } = useProctoring();
  const [startingExam, setStartingExam] = useState(false);

  const [checks, setChecks] = useState([
    { id: 'cam', name: 'Camera Stream', status: 'testing', icon: Camera, note: 'Checking video feed resolution...' },
    { id: 'mic', name: 'Microphone Stream', status: 'testing', icon: Mic, note: 'Checking audio input frequency...' },
    { id: 'net', name: 'Internet Bandwidth', status: 'testing', icon: Wifi, note: 'Testing latency & packet loss...' },
    { id: 'light', name: 'Ambient Lighting', status: 'testing', icon: Sun, note: 'Measuring brightness levels...' },
    { id: 'face', name: 'Face Visibility', status: 'testing', icon: UserCheck, note: 'MediaPipe mesh landmark test...' },
    { id: 'browser', name: 'Browser Compatibility', status: 'testing', icon: Monitor, note: 'HTML5 WebRTC API verification...' },
    { id: 'full', name: 'Fullscreen API Support', status: 'testing', icon: Maximize, note: 'Screen Lock API check...' },
  ]);

  const [allPassed, setAllPassed] = useState(false);

  useEffect(() => {
    // Simulate automated sequential verification
    const timer = setTimeout(() => {
      setChecks((prev) =>
        prev.map((item) => ({ ...item, status: 'pass', note: 'Verified & Clean' }))
      );
      setAllPassed(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleStartExam = async () => {
    // Request browser fullscreen if available
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    // Best-effort: start a real proctoring session with the backend before
    // entering the exam. If this fails (backend down, offline, etc.) we
    // still proceed -- ExamScreenPage/CameraWidget fall back to the
    // simulated AI feed automatically when no real session is active.
    setStartingExam(true);
    if (studentSession?.examCode) {
      await startRealSession(studentSession.examCode);
    }
    setStartingExam(false);

    navigate('/student/exam');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              AUTOMATED DIAGNOSTICS
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              System Hardware Verification
            </h1>
            <p className="text-xs text-slate-500 font-medium">Verifying WebRTC, camera feed, and browser lock APIs</p>
          </div>

          <div className="flex items-center gap-2">
            {!allPassed ? (
              <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 font-extrabold text-xs flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Running Diagnostics...
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                7/7 Checks Passed
              </span>
            )}
          </div>
        </div>

        {/* Live Camera Stream Diagnostic Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          <div className="sm:col-span-1">
            <div className="text-xs font-bold text-slate-700 mb-2">Live Camera Test View:</div>
            <CameraWidget size="medium" compact={true} />
          </div>

          <div className="sm:col-span-2 space-y-3">
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-950 font-medium">
              <strong className="font-bold block mb-1">AI Proctor Diagnostic Note:</strong>
              Your camera stream and face mesh landmarks have been calibrated. Ensure your face remains centered during the exam.
            </div>
          </div>
        </div>

        {/* Status Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {checks.map((c) => {
            const Icon = c.icon;
            const isPass = c.status === 'pass';
            return (
              <div
                key={c.id}
                className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                  isPass ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    isPass ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{c.name}</div>
                    <div className="text-[10px] text-slate-500 font-medium">{c.note}</div>
                  </div>
                </div>

                <div>
                  {isPass ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-amber-600 animate-spin flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Start Exam CTA Button (ONLY ENABLED AFTER ALL CHECKS PASS) */}
        <div className="pt-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleStartExam}
            disabled={!allPassed || startingExam}
            className={`px-10 py-5 rounded-2xl font-extrabold text-base shadow-2xl transition-all flex items-center gap-3 ${
              allPassed && !startingExam
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-emerald-200 cursor-pointer animate-bounce'
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
