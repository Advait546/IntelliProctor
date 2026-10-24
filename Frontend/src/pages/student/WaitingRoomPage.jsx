import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw, Clock, CalendarClock, AlertCircle, Camera, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../api/authApi';
import { errorMessage } from '../../api/client';
import { formatSeconds } from '../../hooks/useTimer';

export const WaitingRoomPage = () => {
  const navigate = useNavigate();
  const { studentSession } = useAuth();
  const [exam, setExam] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('ip_exam_lookup') || 'null');
    } catch {
      return null;
    }
  });
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!studentSession?.examCode) return;
    try {
      const res = await authApi.lookupExamCode(studentSession.examCode);
      setExam(res);
      setError(res.valid ? '' : res.error || 'This exam is not available.');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [studentSession?.examCode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = exam?.startWindow ? new Date(exam.startWindow).getTime() : null;
  const end = exam?.endWindow ? new Date(exam.endWindow).getTime() : null;
  const notYet = start && now < start;
  const open = exam?.valid && !notYet && (!end || now < end);

  useEffect(() => {
    if (notYet && start - now < 1000) load();
  }, [notYet, start, now, load]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono">
          <RefreshCw className={`w-3.5 h-3.5 ${notYet ? 'animate-spin' : ''} text-emerald-400`} />
          {open ? 'EXAM OPEN' : notYet ? 'WAITING FOR EXAM WINDOW' : 'EXAM WAITING ROOM'}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{exam?.examTitle || 'Loading exam...'}</h1>
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-indigo-200 font-medium">
          <div>
            Candidate: <strong className="text-white">{studentSession?.name}</strong> ({studentSession?.rollNumber})
          </div>
          <div>
            Code: <strong className="text-emerald-400 font-mono">{studentSession?.examCode}</strong>
          </div>
          {exam?.durationMinutes && (
            <div>
              Duration: <strong className="text-white">{exam.durationMinutes} min</strong>
            </div>
          )}
        </div>
        {notYet && (
          <div className="pt-2">
            <div className="text-xs text-indigo-200 font-bold uppercase tracking-widest mb-1">Exam opens in</div>
            <div className="text-4xl sm:text-5xl font-mono font-extrabold text-emerald-400 bg-white/10 px-6 py-3 rounded-2xl inline-block border border-white/20">
              {formatSeconds((start - now) / 1000)}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Before you begin</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex gap-3">
            <Camera className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <span>Your webcam is analysed by the AI proctor throughout the exam. Keep your face visible.</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex gap-3">
            <MonitorSmartphone className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <span>Switching tabs or windows is logged. Keep phones, books and notes away.</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex gap-3">
            <Clock className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <span>The timer starts when you press “Start Examination” and is kept by the server.</span>
          </div>
        </div>
        {end && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4" /> Exam window closes {new Date(end).toLocaleString()}.
          </p>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          {open ? 'The exam is open. Continue when ready.' : notYet ? 'Please wait for the exam window to open.' : 'Checking exam status...'}
        </div>
        <button
          onClick={() => navigate('/student/instructions')}
          disabled={!open}
          className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-extrabold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
            open ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <span>Read Exam Rules & Instructions</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
