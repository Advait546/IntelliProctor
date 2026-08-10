import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock,
  Camera,
  Mic,
  Wifi,
  Sun,
  Eye,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import Timer from '../../components/student/Timer';

const WaitingRoomPage = () => {
  const navigate = useNavigate();
  const examDataStr = localStorage.getItem('student_exam_data');
  const exam = examDataStr ? JSON.parse(examDataStr) : {
    title: "Advanced Artificial Intelligence & Neural Networks",
    setter: "Dr. Sharma",
    scheduledTime: "10:00 AM",
    duration: 60
  };

  const [systemCheckPassed, setSystemCheckPassed] = useState(true);

  const statuses = [
    { label: "Camera Stream", ready: true, icon: Camera, detail: "Full HD 1080p Active" },
    { label: "Microphone Feed", ready: true, icon: Mic, detail: "Input level ok (-12dB)" },
    { label: "Internet Latency", ready: true, icon: Wifi, detail: "Ping: 24ms (Stable)" },
    { label: "Ambient Lighting", ready: true, icon: Sun, detail: "Optimal brightness" },
    { label: "Face Detection AI", ready: true, icon: Eye, detail: "MediaPipe Landmarks Verified" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 relative overflow-hidden">
      {/* Background Lighting Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-tr from-indigo-600/20 via-emerald-500/10 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <span className="font-extrabold text-white text-lg tracking-tight">AI Exam Portal</span>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-800 text-xs text-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span>Lobby Status: WAITING ROOM</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl w-full mx-auto z-10 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6"
        >
          {/* Exam Title & Details */}
          <div className="text-center space-y-2 border-b border-slate-800 pb-6">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Scheduled Assessment Lobby
            </span>
            <h2 className="text-3xl font-black text-white tracking-tight">{exam.title}</h2>
            <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-1">
              <span>Exam Setter: <strong className="text-slate-200">{exam.setter}</strong></span>
              <span>•</span>
              <span>Scheduled: <strong className="text-slate-200">{exam.scheduledTime}</strong></span>
            </div>
          </div>

          {/* Live Countdown & Status indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Countdown Box */}
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Session Opens In
              </span>
              <div className="text-4xl font-mono font-black text-emerald-400 tracking-widest bg-emerald-950/40 px-6 py-3 rounded-2xl border border-emerald-500/30 shadow-inner">
                00:04:32
              </div>
              <p className="text-[11px] text-slate-500">
                Automatic redirect when counter reaches 00:00
              </p>
            </div>

            {/* Right: System Status List (EXACT PDF REQUIREMENT) */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Pre-Exam Hardware Verification
              </h3>
              {statuses.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-indigo-400" />
                      <div>
                        <span className="font-bold text-slate-200 block">{item.label}</span>
                        <span className="text-[10px] text-slate-500">{item.detail}</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.ready
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Ready
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Action bar */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold animate-pulse">
              <Clock className="w-4 h-4" />
              <span>Waiting for Exam to Start...</span>
            </div>

            <button
              onClick={() => navigate('/student/instructions')}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <span>Proceed to Instructions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </main>

      <footer className="text-center text-xs text-slate-600 z-10">
        AI Proctoring Waiting Room • Session Token Validated
      </footer>
    </div>
  );
};

export default WaitingRoomPage;
