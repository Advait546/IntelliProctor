import React from 'react';
import { ShieldAlert, AlertTriangle, Info, Image as ImageIcon, CheckCircle2, XCircle } from 'lucide-react';

const fmtTime = (t) => {
  if (!t) return '';
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toLocaleTimeString();
};

/**
 * Chronological audit trail of backend-recorded proctoring events. Dismissed
 * events stay visible (struck through) -- history is never deleted (14.2).
 */
export const IncidentTimeline = ({ incidents = [], onSelect, title = 'AI Incident Timeline', emptyText = 'No proctoring events recorded yet.' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
      <span>{title}</span>
      <span className="text-xs font-semibold text-slate-500">{incidents.length} Events</span>
    </h3>

    {incidents.length === 0 ? (
      <p className="text-xs text-slate-500">{emptyText}</p>
    ) : (
      <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200 max-h-[38rem] overflow-y-auto pr-1">
        {incidents.map((evt, idx) => {
          const dismissed = evt.reviewStatus === 'DISMISSED';
          const confirmed = evt.reviewStatus === 'CONFIRMED';
          return (
            <div key={evt.id || idx} className="relative flex items-start gap-3 pl-8">
              <span
                className={`absolute left-1.5 top-1 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                  evt.severity === 'critical' ? 'border-red-500 text-red-500' : evt.severity === 'warning' ? 'border-amber-500 text-amber-500' : 'border-indigo-500 text-indigo-500'
                }`}
              >
                {evt.severity === 'critical' ? <ShieldAlert className="w-2.5 h-2.5" /> : evt.severity === 'warning' ? <AlertTriangle className="w-2.5 h-2.5" /> : <Info className="w-2.5 h-2.5" />}
              </span>

              <button
                type="button"
                onClick={() => onSelect?.(evt)}
                disabled={!onSelect}
                className={`flex-1 text-left bg-slate-50 p-3 rounded-xl border text-xs transition-colors ${
                  onSelect ? 'hover:border-indigo-300 hover:bg-indigo-50/40 cursor-pointer' : 'cursor-default'
                } ${dismissed ? 'border-slate-200 opacity-70' : 'border-slate-200/70'}`}
              >
                <div className="flex items-center justify-between gap-2 font-bold text-slate-800">
                  <span className={dismissed ? 'line-through' : ''}>{evt.event}</span>
                  <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">{fmtTime(evt.time)}</span>
                </div>
                <p className="mt-1 text-slate-600 font-medium leading-relaxed">{evt.detail}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {evt.pointsApplied > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">+{evt.pointsApplied} pts</span>
                  )}
                  {evt.hasEvidence && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-semibold inline-flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" /> Evidence
                    </span>
                  )}
                  {evt.evidenceStatus === 'FAILED' && <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px]">Evidence upload failed</span>}
                  {dismissed && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold inline-flex items-center gap-1" title={evt.review?.justificationNote}>
                      <XCircle className="w-3 h-3" /> Dismissed{evt.review?.examinerName ? ` by ${evt.review.examinerName}` : ''}
                    </span>
                  )}
                  {confirmed && (
                    <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-semibold inline-flex items-center gap-1" title={evt.review?.justificationNote}>
                      <CheckCircle2 className="w-3 h-3" /> Confirmed
                    </span>
                  )}
                  {evt.timingDiscrepancy && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">Timing mismatch</span>}
                  {evt.isClockSkewed && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">Clock skew</span>}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
