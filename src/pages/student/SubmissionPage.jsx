import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldAlert,
  Home,
  Award,
  Sparkles
} from 'lucide-react';
import { useExam } from '../../contexts/ExamContext';

const SubmissionPage = () => {
  const navigate = useNavigate();
  const { submissionResult } = useExam();

  const result = submissionResult || {
    examTitle: "Advanced Artificial Intelligence & Neural Networks",
    examCode: "AI2026CS01",
    submissionTime: new Date().toLocaleString(),
    totalQuestions: 15,
    attemptedCount: 14,
    skippedCount: 1,
    incidentsCount: 0
  };

  useEffect(() => {
    // Launch celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Fallback if canvas confetti isn't supported
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 relative overflow-hidden">
      {/* Background Decorative Blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-tr from-emerald-600/20 via-indigo-500/20 to-transparent blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between z-10">
        <span className="font-extrabold text-white text-lg tracking-tight">AI Exam Portal</span>
        <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800">
          SUBMISSION COMPLETED
        </span>
      </header>

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto z-10 my-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl text-center space-y-6"
        >
          {/* Animated Trophy Icon */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 mx-auto shadow-xl shadow-emerald-500/30">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-12 h-12" />
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">Congratulations! 🎉</h2>
            <h3 className="text-lg font-bold text-emerald-400 mt-1">Exam Submitted Successfully</h3>
            <p className="text-xs text-slate-400 mt-1">{result.examTitle}</p>
          </div>

          {/* Submission Stats Breakdown (EXACT PDF REQUIREMENT) */}
          <div className="grid grid-cols-2 gap-3 text-xs text-left pt-2">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Submission Time</span>
              <span className="font-mono font-bold text-slate-200 mt-1 block">{result.submissionTime}</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Questions Attempted</span>
              <span className="font-extrabold text-emerald-400 text-base mt-0.5 block">
                {result.attemptedCount} / {result.totalQuestions}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Questions Skipped</span>
              <span className="font-extrabold text-amber-400 text-base mt-0.5 block">
                {result.skippedCount}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Incidents Recorded</span>
              <span className={`font-extrabold text-base mt-0.5 block ${result.incidentsCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {result.incidentsCount} Flags
              </span>
            </div>
          </div>

          {/* Return Home Button */}
          <div className="pt-4">
            <button
              onClick={() => navigate('/')}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
              <Home className="w-5 h-5" />
              <span>Return Home</span>
            </button>
          </div>
        </motion.div>
      </main>

      <footer className="text-center text-xs text-slate-600 z-10">
        Smart Examination Portal • Final Audit Recorded
      </footer>
    </div>
  );
};

export default SubmissionPage;
