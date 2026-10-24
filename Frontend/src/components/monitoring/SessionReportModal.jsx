import React, { useEffect, useState } from 'react';
import { X, Printer, RefreshCw } from 'lucide-react';
import { reportApi } from '../../api/reportApi';
import { errorMessage } from '../../api/client';

/** Examiner's full forensic dossier for one attempt (BACKEND 15.3, examiner view). */
export const SessionReportModal = ({ sessionId, onClose }) => {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    reportApi.getReport(sessionId).then(setReport).catch((err) => setError(errorMessage(err)));
  }, [sessionId]);

  const p = report?.proctoring;
  const c = p?.anomalyCounts;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto print:max-h-none print:shadow-none" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between print:hidden">
          <h3 className="text-lg font-extrabold text-slate-900">Candidate Audit Report</h3>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {error && <div className="p-5 text-sm text-red-700">{error}</div>}
        {!report && !error && (
          <div className="p-10 flex items-center justify-center text-slate-500 text-sm gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading report...
          </div>
        )}
        {report && (
          <div className="p-6 space-y-5 text-sm">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{report.candidate.name}</h2>
              <p className="text-xs text-slate-500">
                PRN {report.candidate.rollNumber} • {report.exam.title} • status {report.status}
                {report.submissionType === 'TIMER_EXPIRED' ? ' (auto-submitted at time-out)' : ''}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-slate-500">Academic score</div>
                <div className="font-extrabold text-slate-900">
                  {report.academic.score ?? '—'} / {report.academic.maxScore || '—'} {report.academic.percentage != null ? `(${report.academic.percentage}%)` : ''}
                </div>
              </div>
              <div className={`p-3 rounded-xl border ${p.isSuspicious ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="text-slate-500">Automated AI score</div>
                <div className="font-extrabold text-slate-900">S = {p.suspicionScore} / 1000</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                <div className="text-slate-500">Official status</div>
                <div className="font-extrabold text-slate-900">{p.officialStatus}</div>
                {p.reviewAdjustedScore !== p.suspicionScore && (
                  <div className="text-[11px] text-slate-500">Excluding examiner-dismissed events: S = {p.reviewAdjustedScore}</div>
                )}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
              <span>Head turns: {c.headTurns} ({c.headTurnGroupsScored} × +10)</span>
              <span>Phone episodes: {c.phone} (× +100)</span>
              <span>Book episodes: {c.book} (× +50)</span>
              <span>Tab switches: {c.tabSwitches} ({(c.tabHiddenTotalMs / 1000).toFixed(1)} s, 0 pts)</span>
              <span>Absence: {c.candidateAbsent} (0 pts)</span>
              <span>Multiple faces: {c.multipleFaces} (0 pts)</span>
              <span>Manual flags: {c.manualFlags} (0 pts)</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-2">Event timeline</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-1">Time</th>
                    <th>Event</th>
                    <th>Points</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {report.timeline.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 align-top">
                      <td className="py-1 font-mono whitespace-nowrap pr-2">{new Date(e.time).toLocaleTimeString()}</td>
                      <td className="pr-2">
                        <strong>{e.event}</strong> <span className="text-slate-500">{e.detail}</span>
                      </td>
                      <td>{e.pointsApplied ? `+${e.pointsApplied}` : '0'}</td>
                      <td>{e.review ? `${e.review.action} – ${e.review.justificationNote}` : e.reviewStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.answers && (
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Answers</h4>
                <ol className="space-y-1 text-xs list-decimal pl-5">
                  {report.answers.map((a) => (
                    <li key={a.id}>
                      {a.text} — answered <strong>{Array.isArray(a.candidateAnswer) ? a.candidateAnswer.join(',') : a.candidateAnswer || '—'}</strong>, key{' '}
                      <strong>{Array.isArray(a.correctAnswer) ? a.correctAnswer.join(',') : a.correctAnswer || 'manual'}</strong>, marks{' '}
                      {a.marksAwarded ?? (a.type === 'Subjective' ? 'to grade' : 0)}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
