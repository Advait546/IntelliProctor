import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ShieldCheck,
  Video,
  FileSpreadsheet,
  Lock,
  Cpu,
  ArrowRight,
  UserCheck
} from 'lucide-react';
const LandingPage = () => {
  const navigate = useNavigate();
  const features = [
    {
      title: "IntelliProcter",
      desc: "Real-time facial tracking, anomaly detection, and automated security flagging.",
      icon: ShieldCheck,
      color: "from-indigo-500 to-indigo-600"
    },
    {
      title: "Live Monitoring",
      desc: "Multi-student grid stream with live risk scores and instant invigilator alerts.",
      icon: Video,
      color: "from-emerald-500 to-teal-600"
    },
    {
      title: "Auto Reports",
      desc: "Instant candidate evaluation, risk graph timelines, and downloadable PDF reports.",
      icon: FileSpreadsheet,
      color: "from-blue-500 to-cyan-600"
    },
    {
      title: "Browser Security",
      desc: "Strict fullscreen lock, tab-switch detection, and copy-paste prevention.",
      icon: Lock,
      color: "from-purple-500 to-pink-600"
    },
];
  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-indigo-600/30 via-emerald-500/20 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-indigo-900/20 blur-3xl pointer-events-none" />
      {/* Top Navbar Header */}
      <header className="max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 shadow-lg shadow-indigo-500/25">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-indigo-400" />
            </div>
          </div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-white flex items-center gap-2">
              AI Exam Portal
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PROCTOR v2.0
              </span>
            </h1>
            <p className="text-xs text-slate-400">Secure AI Powered Examination System</p>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-12 relative z-10 w-full flex-1 flex flex-col justify-center items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-6"
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          Next-Generation Autonomous Exam Integrity Platform
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl leading-tight"
        >
          IntelliProctor
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-4 text-slate-400 text-lg max-w-2xl"
        >
          Select your journey to begin. Create and schedule assessments or join a live proctored examination session.
        </motion.p>
        {/* Center Two Large Cards (EXACT SPEC REQUIREMENT) */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
                  <motion.div
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/admin/login')}
            className="cursor-pointer group relative p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 hover:border-indigo-500/60 shadow-2xl transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all" />
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Generate Test</h3>
            <p className="text-sm text-slate-400 mb-6">
              Exam Setter portal to create tests, manage question banks, schedule exams & view live AI monitoring.
            </p>
            <button className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30">
              <span>Generate Test</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
          {/* Card 2: Give Test */}
          <motion.div
            whileHover={{ scale: 1.03, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/student/enter-code')}
            className="cursor-pointer group relative p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 hover:border-emerald-500/60 shadow-2xl transition-all duration-300 flex flex-col items-center text-center overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
            <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <UserCheck className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Give Test</h3>
            <p className="text-sm text-slate-400 mb-6">
              Student portal to enter exam PIN, verify system hardware, complete AI check & take proctored exam.
            </p>
            <button className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30">
              <span>Give Test</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
        {/* Feature Highlights List */}
        <div className="mt-20 w-full border-t border-slate-800/80 pt-12">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-8">
            Platform Capabilities & AI Architecture
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-left">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-3 shadow-md`}>
                    <Icon className="w-5 h-5" />
 </div>
                  <h4 className="font-bold text-sm text-slate-200 mb-1">{f.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        © 2026 IntelliProcter.
      </footer>
    </div>
  );
};
export default LandingPage;