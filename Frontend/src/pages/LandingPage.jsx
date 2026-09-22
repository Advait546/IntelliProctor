import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ShieldCheck, Eye, FileText, Lock, Cpu, Play } from 'lucide-react';

export const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative overflow-hidden">
      {/* Background Hero Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 flex-1 flex flex-col items-center justify-center text-center relative z-10">
        
        {/* Top Announcement Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold shadow-xs mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
          <span>Next-Generation AI Proctoring Platform</span>
        </motion.div>

        {/* Title & Subtitle */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-3xl leading-tight"
        >
          AI Exam Portal
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-lg sm:text-xl font-medium text-slate-600 max-w-2xl"
        >
          Secure AI Powered Examination System
        </motion.p>

        {/* CENTER TWO LARGE PRIMARY CARDS ONLY (Generate Test & Give Test) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl"
        >
          {/* Card 1: Generate Test */}
          <button
            onClick={() => navigate('/admin/login')}
            className="group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1.5 text-left border border-indigo-500 flex flex-col justify-between h-64"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>

            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="mt-6 text-2xl font-extrabold text-white tracking-tight">Generate Test</h2>
              <p className="mt-1 text-sm text-indigo-100 font-medium leading-relaxed">
                For Exam Setters & Instructors to build, configure, and publish proctored exams.
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-2 text-sm font-extrabold text-white group-hover:translate-x-1 transition-transform">
              <span>Setter Portal Login</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* Card 2: Give Test */}
          <button
            onClick={() => navigate('/student/join')}
            className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1.5 text-left border border-emerald-400 flex flex-col justify-between h-64"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>

            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                <Play className="w-7 h-7 text-white fill-white" />
              </div>
              <h2 className="mt-6 text-2xl font-extrabold text-white tracking-tight">Give Test</h2>
              <p className="mt-1 text-sm text-emerald-100 font-medium leading-relaxed">
                For Candidates & Students to enter exam code and take AI-monitored assessments.
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-2 text-sm font-extrabold text-white group-hover:translate-x-1 transition-transform">
              <span>Enter Exam Code</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </motion.div>

        {/* Feature Highlights Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-16 w-full max-w-4xl pt-12 border-t border-slate-200"
        >
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">
            Powered by Enterprise AI & Computer Vision
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center">
              <ShieldCheck className="w-6 h-6 text-indigo-600 mb-2" />
              <span className="text-xs font-bold text-slate-800">AI Proctoring</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center">
              <Eye className="w-6 h-6 text-indigo-600 mb-2" />
              <span className="text-xs font-bold text-slate-800">Live Monitoring</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center">
              <FileText className="w-6 h-6 text-indigo-600 mb-2" />
              <span className="text-xs font-bold text-slate-800">Auto Reports</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center">
              <Lock className="w-6 h-6 text-indigo-600 mb-2" />
              <span className="text-xs font-bold text-slate-800">Browser Lock</span>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center col-span-2 sm:col-span-1">
              <Cpu className="w-6 h-6 text-indigo-600 mb-2" />
              <span className="text-xs font-bold text-slate-800">YOLO + MediaPipe</span>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};
