import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { examService } from '../../services/examService';

const EnterCodePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter a valid Exam Code (e.g. AI2026CS01)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const exam = await examService.getExamByCode(code.trim());
      localStorage.setItem('student_exam_code', exam.code);
      localStorage.setItem('student_exam_data', JSON.stringify(exam));
      navigate('/student/login');
    } catch (err) {
      setError('Invalid Exam Code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-indigo-600/30 via-emerald-500/20 to-transparent blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <span className="font-extrabold text-white text-lg tracking-tight">AI Exam Portal</span>
        </div>

        <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
          Student Assessment Entry
        </span>
      </header>

      {/* Kahoot-Inspired Center Screen */}
      <main className="max-w-md w-full mx-auto z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 mx-auto shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-indigo-400">
              <KeyRound className="w-8 h-8" />
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">Enter Exam Code</h2>
            <p className="text-xs text-slate-400 mt-1">
              Input the PIN provided by your Exam Setter (e.g. <strong className="text-indigo-400 font-mono">AI2026CS01</strong>)
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Large Centered Input (Kahoot Style) */}
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AI2026CS01"
              maxLength={12}
              className="w-full py-4 text-center font-mono text-2xl font-black tracking-widest text-indigo-300 bg-slate-950 border-2 border-indigo-500/50 rounded-2xl focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 uppercase transition-all shadow-inner"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-emerald-500 text-white font-extrabold text-base transition-all duration-200 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
            >
              {loading ? (
                <span>Validating PIN...</span>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Fill link */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setCode("AI2026CS01")}
              className="text-xs font-bold text-slate-400 hover:text-indigo-400 flex items-center justify-center gap-1 mx-auto"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Use Demo Code: AI2026CS01</span>
            </button>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600 z-10">
        AI Exam Portal • Student Verification Layer
      </footer>
    </div>
  );
};

export default EnterCodePage;
