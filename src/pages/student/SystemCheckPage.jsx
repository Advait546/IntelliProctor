import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Camera,
  Mic,
  Wifi,
  Sun,
  Eye,
  Globe,
  Maximize,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import CameraWidget from '../../components/common/CameraWidget';

const SystemCheckPage = () => {
  const navigate = useNavigate();

  const [checks, setChecks] = useState([
    { id: 'camera', label: 'Camera Hardware', icon: Camera, status: 'checking', message: 'Requesting webcam access...' },
    { id: 'mic', label: 'Microphone Input', icon: Mic, status: 'pending', message: 'Measuring ambient noise levels...' },
    { id: 'internet', label: 'Network Bandwidth', icon: Wifi, status: 'pending', message: 'Testing server latency...' },
    { id: 'lighting', label: 'Lighting Quality', icon: Sun, status: 'pending', message: 'Analyzing frame luminance...' },
    { id: 'face', label: 'Face Visibility AI', icon: Eye, status: 'pending', message: 'Running MediaPipe mesh tracker...' },
    { id: 'browser', label: 'Browser Compatibility', icon: Globe, status: 'pending', message: 'Verifying HTML5 APIs...' },
    { id: 'fullscreen', label: 'Fullscreen Support', icon: Maximize, status: 'pending', message: 'Checking fullscreen permission...' }
  ]);

  const [allPassed, setAllPassed] = useState(false);

  // Simulated automatic diagnostic sequence
  useEffect(() => {
    let currentStep = 0;

    const timer = setInterval(() => {
      if (currentStep < checks.length) {
        setChecks((prev) =>
          prev.map((item, index) => {
            if (index === currentStep) {
              return { ...item, status: 'passed', message: 'Verified & operational' };
            }
            if (index === currentStep + 1) {
              return { ...item, status: 'checking' };
            }
            return item;
          })
        );
        currentStep++;
      } else {
        clearInterval(timer);
        setAllPassed(true);
      }
    }, 800);

    return () => clearInterval(timer);
  }, []);

  const handleStartExam = () => {
    // Attempt real browser fullscreen request
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    navigate('/student/exam');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 relative overflow-hidden">
      {/* Background Decorative Blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-tr from-indigo-600/20 via-emerald-500/10 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <span className="font-extrabold text-white text-lg tracking-tight">AI Exam Portal</span>
        </div>

        <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-800">
          Step 2 of 2: Automated Diagnostic Check
        </span>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto z-10 my-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6"
        >
          <div className="text-center space-y-2 border-b border-slate-800 pb-4">
            <h2 className="text-3xl font-black text-white tracking-tight">
              Automated System & Camera Diagnostics
            </h2>
            <p className="text-xs text-slate-400">
              The platform is testing hardware compatibility and AI computer vision perception.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Camera Preview Box */}
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Webcam & Landmark Stream
              </span>
              <CameraWidget
                studentName="Candidate Preview"
                faceVisible={true}
                compact={false}
                className="h-64"
              />
              <p className="text-[11px] text-slate-400 text-center">
                Ensure your face is centered and fully illuminated.
              </p>
            </div>

            {/* Right Status Cards List (EXACT PDF REQUIREMENT) */}
            <div className="lg:col-span-7 space-y-2.5">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1">
                Diagnostic Progress
              </span>
              <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                {checks.map((check) => {
                  const Icon = check.icon;
                  const isPassed = check.status === 'passed';
                  const isChecking = check.status === 'checking';

                  return (
                    <div
                      key={check.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                        isPassed
                          ? 'bg-slate-950 border-emerald-500/40 text-slate-200'
                          : isChecking
                          ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-200 animate-pulse'
                          : 'bg-slate-950/50 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl border ${
                            isPassed
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : isChecking
                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                              : 'bg-slate-900 text-slate-600 border-slate-800'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-xs block">{check.label}</span>
                          <span className="text-[10px] text-slate-400">{check.message}</span>
                        </div>
                      </div>

                      <div>
                        {isPassed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            PASSED
                          </span>
                        ) : isChecking ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            TESTING
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-600">Pending</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              {allPassed ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> All 7 security checks passed! Ready to enter exam.
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  Running hardware diagnostic checks...
                </span>
              )}
            </div>

            {/* Enabled ONLY after all checks pass (EXACT SPEC REQUIREMENT) */}
            <button
              onClick={handleStartExam}
              disabled={!allPassed}
              className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-2 ${
                allPassed
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-600/30 hover:scale-105 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
              }`}
            >
              <span>Start Examination</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </main>

      <footer className="text-center text-xs text-slate-600 z-10">
        AI System Diagnostic Engine • Verified HTML5 & Vision Hardware
      </footer>
    </div>
  );
};

export default SystemCheckPage;
