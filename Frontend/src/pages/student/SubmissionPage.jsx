import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, Home, Clock, Award, ShieldCheck, HelpCircle, Timer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { reportApi } from '../../api/reportApi';

export const SubmissionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { studentSession, setExamSession } = useAuth();
  const state = location.state || {};
  const [report, setReport] = useState(null);

  // The attempt is over: drop the scoped exam-session token.
  useEffect(() => {
    setExamSession(null);
  }, [setExamSession]);

  // Sanitized candidate report (BACKEND_ARCHITECTURE.md 15.3): academic marks
  // and high-level anomaly counts only -- no evidence or examiner notes.
  useEffect(() => {
    if (!state.sessionId) return;
    reportApi
      .getReport(state.sessionId, 'student')
      .then(setReport)
      .catch(() => {});
  }, [state.sessionId]);

  const counts = report?.proctoring?.anomalyCounts;
  const academic = report?.academic;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 sm:p-10 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle className="w-12 h-12" />
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{state.alreadySubmitted ? 'Already Submitted' : 'Exam Submitted'}</h1>
          <p className="text-base font-bold text-emerald-700 mt-1">
            {state.autoSubmitted ? 'Time expired -- your answers were submitted automatically.' : 'Your answers have been recorded.'}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Candidate: <strong>{studentSession?.name}</strong> (PRN: {studentSession?.rollNumber})
          </p>
          {state.examTitle && <p className="text-xs text-slate-500">{state.examTitle}</p>}
        </div>

        {state.totalQuestions !== undefined && (
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
              <div className="text-sm font-extrabold text-emerald-700 mt-1">
                {state.attemptedCount} / {state.totalQuestions}
              </div>
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
                <span>Proctoring Events</span>
              </div>
              <div className="text-sm font-extrabold text-slate-900 mt-1">{state.incidentsCount} logged</div>
            </div>
          </div>
        )}

        {academic?.evaluated && academic.maxScore > 0 && (
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-left text-xs text-indigo-950 space-y-1">
            <div className="font-bold text-sm">
              Objective score: {academic.score} / {academic.maxScore} ({academic.percentage}%)
            </div>
            <div className="text-indigo-800">Subjective answers (if any) are graded by your examiner.</div>
          </div>
        )}

        {counts && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-700 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" /> Proctoring summary
            </div>
            <div>
              Head turns: {counts.headTurns} • Tab switches: {counts.tabSwitches} • Phone episodes: {counts.phone} • Book episodes: {counts.book}
            </div>
            <div className="text-slate-500">Flags are reviewed by your examiner before any decision is made.</div>
          </div>
        )}

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
