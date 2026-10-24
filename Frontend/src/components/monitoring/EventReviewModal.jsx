import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, ShieldX, RefreshCw } from 'lucide-react';
import { monitoringApi } from '../../api/monitoringApi';
import { errorMessage } from '../../api/client';

/**
 * Evidence inspector + examiner adjudication (FRONTEND_ARCHITECTURE.md 15).
 * Dismiss / Confirm require a written justification (>= 10 characters); the
 * original detection, evidence and automated score are never altered.
 */
export const EventReviewModal = ({ event, onClose, onReviewed }) => {
  const [evidenceUrl, setEvidenceUrl] = useState(null);
  const [evidenceError, setEvidenceError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!event?.hasEvidence) return;
    monitoringApi
      .getEvidence(event.id)
      .then((res) => setEvidenceUrl(res.url))
      .catch((err) => setEvidenceError(errorMessage(err)));
  }, [event]);

  if (!event) return null;

  const review = async (action) => {
    if (note.trim().length < 10) {
      setError('Please write a justification of at least 10 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = action === 'dismiss' ? await monitoringApi.dismissEvent(event.id, note.trim()) : await monitoringApi.confirmEvent(event.id, note.trim());
      onReviewed?.(res);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pose = event.headPose;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">{event.event}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date(event.time).toLocaleString()} • source {event.source} • review status <strong>{event.reviewStatus}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {event.hasEvidence ? (
            evidenceUrl ? (
              <img src={evidenceUrl} alt="Evidence keyframe" className="w-full rounded-2xl border border-slate-200" />
            ) : (
              <div className="h-48 rounded-2xl bg-slate-100 flex items-center justify-center text-xs text-slate-500 gap-2">
                {evidenceError || (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading evidence (signed 15-minute link)...
                  </>
                )}
              </div>
            )
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">No evidence image is attached to this event type.</div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Points (ledger)</div>
              <div className="font-extrabold text-slate-900">+{event.pointsApplied || 0}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Confidence</div>
              <div className="font-extrabold text-slate-900">{event.confidence != null ? `${(event.confidence * 100).toFixed(1)}%` : '—'}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Duration</div>
              <div className="font-extrabold text-slate-900">{event.durationMs ? `${(event.durationMs / 1000).toFixed(1)} s` : '—'}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Head pose</div>
              <div className="font-extrabold text-slate-900 font-mono text-[11px]">
                {pose ? `Y${Math.round(pose.yaw)} P${Math.round(pose.pitch)} R${Math.round(pose.roll)}` : '—'}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600">{event.detail}</p>

          {event.review && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-950">
              <strong>{event.review.action === 'DISMISS' ? 'Dismissed' : 'Confirmed'}</strong> by {event.review.examinerName} on{' '}
              {new Date(event.review.reviewedAt).toLocaleString()}: “{event.review.justificationNote}”
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Examiner justification (required)</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Candidate held up a scientific calculator during the maths section."
              className="w-full p-3 rounded-xl border border-slate-300 focus:border-indigo-500 outline-none text-sm"
            />
            {error && <p className="mt-1 text-xs text-red-600 font-semibold">{error}</p>}
            <p className="mt-1 text-[11px] text-slate-500">
              Reviews are audit records. They never delete the detection, its evidence, or the automated score.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              disabled={busy}
              onClick={() => review('dismiss')}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 flex items-center gap-1.5"
            >
              <ShieldX className="w-4 h-4" /> Dismiss as False Positive
            </button>
            <button
              disabled={busy}
              onClick={() => review('confirm')}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" /> Confirm Violation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
