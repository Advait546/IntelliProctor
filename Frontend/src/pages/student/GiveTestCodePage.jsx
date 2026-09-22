import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { useExam } from '../../contexts/ExamContext';

export const GiveTestCodePage = () => {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || 'AI2026CS01';

  const [examCode, setExamCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { getExamByCode } = useExam();

  const handleContinue = async (e) => {
    e.preventDefault();
    if (!examCode || examCode.trim().length < 4) {
      setError('Please enter a valid examination code PIN');
      return;
    }

    setLoading(true);
    setError('');

    const res = await authApi.verifyExamCode(examCode);
    if (res.valid) {
      const targetExam = getExamByCode(examCode);
      navigate(`/student/login?code=${examCode.toUpperCase()}`);
    } else {
      setError('Exam Code not found or not currently active.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-2xl relative z-10 text-center space-y-6"
      >
        
        {/* Header Icon (Kahoot Inspired Warmth) */}
        <div>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-200 mb-4">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Enter Exam Code</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Enter the PIN code provided by your instructor</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
            {error}
          </div>
        )}

        {/* Large Centered Code Input */}
        <form onSubmit={handleContinue} className="space-y-4">
          <div>
            <input
              type="text"
              value={examCode}
              onChange={(e) => setExamCode(e.target.value.toUpperCase())}
              placeholder="e.g. AI2026CS01"
              maxLength={12}
              className="w-full px-6 py-5 rounded-2xl border-2 border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none text-2xl sm:text-3xl font-mono font-extrabold tracking-widest text-center uppercase text-slate-900 bg-slate-50 shadow-inner"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Verifying Code...' : 'Continue'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>AI Proctoring Security Enabled</span>
        </div>

      </motion.div>
    </div>
  );
};
