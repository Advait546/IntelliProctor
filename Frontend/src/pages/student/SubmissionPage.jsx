import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Home, Clock, Award, ShieldCheck, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const SubmissionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { studentSession } = useAuth();

  const state = location.state || {
    attemptedCount: 14,
    skippedCount: 1,
    totalQuestions: 15,
    submissionTime: new Date().toLocaleTimeString(),
    incidentsCount: 0
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 sm:p-10 text-center space-y-6">
        
        {/* Success Icon */}
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle className="w-12 h-12" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Congratulations!</h1>
          <p className="text-base font-bold text-emerald-700 mt-1">Exam Submitted Successfully</p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Candidate: <strong>{studentSession?.name || 'Aarav Sharma'}</strong> (PRN: {studentSession?.rollNumber || '2026-CS-042'})
          </p>
        </div>

        {/* Submission Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-left pt-2">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Submission Time</span>
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">{state.submissionTime}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              <span>Attempted</span>
            </div>
            <div className="text-sm font-extrabold text-emerald-700 mt-1">{state.attemptedCount} / {state.totalQuestions}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Skipped</span>
            </div>
            <div className="text-sm font-extrabold text-amber-700 mt-1">{state.skippedCount} Questions</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Incidents Recorded</span>
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">{state.incidentsCount} Security Flags</div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <button
            onClick={() => navigate('/')}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Return Home</span>
          </button>
        </div>

      </div>
    </div>
  );
};
