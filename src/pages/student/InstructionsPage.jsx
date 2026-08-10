import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Smartphone,
  BookOpen,
  Maximize,
  Camera,
  Users,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

const InstructionsPage = () => {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  const rules = [
    {
      title: "No Mobile Phones or Gadgets",
      desc: "YOLO object detection actively scans for smartphones, smartwatches, and secondary screens.",
      icon: Smartphone,
      color: "text-rose-400 bg-rose-500/10 border-rose-500/30"
    },
    {
      title: "No Books or Physical Study Material",
      desc: "Desks must be kept completely clear. Paper notebooks or written notes will trigger automated security flags.",
      icon: BookOpen,
      color: "text-amber-400 bg-amber-500/10 border-amber-500/30"
    },
    {
      title: "Remain in Strict Fullscreen Mode",
      desc: "Exiting full-screen or switching browser tabs will immediately pause the examination and notify the invigilator.",
      icon: Maximize,
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30"
    },
    {
      title: "Webcam & Microphone Must Stay ON",
      desc: "Camera feed and audio background levels must remain connected. Face must stay visible within frame.",
      icon: Camera,
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    },
    {
      title: "Only One Candidate Allowed in Room",
      desc: "MediaPipe landmark tracker identifies secondary persons in the webcam frame.",
      icon: Users,
      color: "text-purple-400 bg-purple-500/10 border-purple-500/30"
    },
    {
      title: "Continuous Autonomous AI Proctoring",
      desc: "Real-time head pose yaw/pitch analysis, gaze vector tracking, and risk score calculation.",
      icon: ShieldAlert,
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30"
    }
  ];

  const handleStartCheck = () => {
    if (!accepted) return;
    navigate('/student/system-check');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 relative overflow-hidden">
      {/* Background Decorative Gradient */}
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

        <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
          Step 1 of 2: Examination Rules
        </span>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto z-10 my-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl space-y-6"
        >
          <div className="text-center space-y-2 border-b border-slate-800 pb-4">
            <h2 className="text-3xl font-black text-white tracking-tight">
              Examination Rules & Security Guidelines
            </h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Please review the mandatory proctoring rules below. You must accept these terms to launch the system check.
            </p>
          </div>

          {/* Rules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule, idx) => {
              const Icon = rule.icon;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3.5"
                >
                  <div className={`p-2.5 rounded-xl border shrink-0 ${rule.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-200 mb-0.5">{rule.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{rule.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Accept Checkbox & Continue Button */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-300">
                I have read and agree to follow all AI proctoring rules & regulations.
              </span>
            </label>

            <button
              onClick={handleStartCheck}
              disabled={!accepted}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <span>Start System Check</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </main>

      <footer className="text-center text-xs text-slate-600 z-10">
        AI Exam Portal • Security Compliance Required
      </footer>
    </div>
  );
};

export default InstructionsPage;
