import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Flag, FileText, ArrowLeft, MessageSquare, RefreshCw } from 'lucide-react';
import { monitoringApi } from '../../api/monitoringApi';
import { errorMessage, getToken } from '../../api/client';
import { RemoteCameraFeed } from '../../components/monitoring/RemoteCameraFeed';
import { RiskBadge } from '../../components/common/RiskBadge';
import { AIStatusChip } from '../../components/common/AIStatusChip';
import { IncidentTimeline } from '../../components/monitoring/IncidentTimeline';
import { EventReviewModal } from '../../components/monitoring/EventReviewModal';
import { SessionReportModal } from '../../components/monitoring/SessionReportModal';
import { useLiveSocket } from '../../hooks/useLiveSocket';

export const StudentDetailPage = () => {
  const { studentId: sessionId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [events, setEvents] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, ev, led] = await Promise.all([
        monitoringApi.getSession(sessionId),
        monitoringApi.getSessionEvents(sessionId),
        monitoringApi.getSessionLedger(sessionId),
      ]);
      setStudent(s);
      setEvents(ev);
      setLedger(led);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load this session'));
    }
  }, [sessionId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  const token = getToken('examiner');
  useLiveSocket(student ? `/ws/v1/proctor/live/${student.examId}?token=${encodeURIComponent(token)}` : null, (msg) => {
    if (msg.sessionId === sessionId) load();
  });

  // Score-over-time from the immutable ledger (never computed client-side).
  const graph = useMemo(() => {
    if (!ledger) return [];
    const t0 = ledger.startedAt ? new Date(ledger.startedAt) : null;
    const pts = t0 ? [{ time: t0.toLocaleTimeString(), score: 0 }] : [];
    ledger.entries.forEach((e) => pts.push({ time: new Date(e.eventTimestamp || e.createdAt).toLocaleTimeString(), score: e.newScore, rule: e.ruleApplied }));
    pts.push({ time: 'now', score: ledger.currentScore });
    return pts;
  }, [ledger]);

  const handleFlag = async () => {
    const reason = window.prompt('Reason for flagging this candidate (recorded in the audit trail, 0 points):', 'Suspicious behaviour observed on camera');
    if (!reason) return;
    try {
      await monitoringApi.flagSession(sessionId, reason);
      setActionMsg('Candidate flagged for review.');
      load();
    } catch (err) {
      setActionMsg(errorMessage(err));
    }
  };

  const handleMessage = async () => {
    const message = window.prompt('Message to show the candidate:', 'Please keep your face visible to the camera.');
    if (!message) return;
    try {
      await monitoringApi.notifyCandidate(sessionId, message, 'warning');
      setActionMsg('Message sent to the candidate.');
    } catch (err) {
      setActionMsg(errorMessage(err));
    }
  };

  if (!student) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
        {error || (
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading session...
          </span>
        )}
      </div>
    );
  }

  const inProgress = student.sessionStatus === 'IN_PROGRESS';
  const ec = student.eventCounts || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <button onClick={() => navigate('/admin/live-monitoring')} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600">
        <ArrowLeft className="w-4 h-4" /> Back to Live Grid
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900">{student.name}</h1>
            <RiskBadge status={student.status} riskScore={student.riskScore} />
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            PRN: <strong>{student.rollNumber}</strong> • {student.examTitle} • {student.sessionStatus}
            {student.academicScore != null && ` • Score ${student.academicScore}/${student.maxAcademicScore}`}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Official status: <strong>{student.officialStatus}</strong>
            {student.manuallyFlagged && ' • manually flagged'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {inProgress && (
            <button onClick={handleMessage} className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Message Candidate
            </button>
          )}
          <button onClick={handleFlag} className="px-4 py-3 rounded-2xl text-xs font-extrabold shadow-md bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
            <Flag className="w-4 h-4" /> {student.manuallyFlagged ? 'Add Another Flag' : 'Flag Candidate'}
          </button>
          <button onClick={() => setShowReport(true)} className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-2">
            <FileText className="w-4 h-4" /> Audit Report
          </button>
        </div>
      </div>
      {actionMsg && <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-semibold">{actionMsg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Candidate Camera (latest keyframe)</span>
              <span className="text-xs font-bold text-slate-600">{!inProgress ? 'Session ended' : student.cvOnline ? 'AI analysis live' : 'AI analysis offline'}</span>
            </div>
            <RemoteCameraFeed
              sessionId={sessionId}
              size="large"
              live={inProgress}
              intervalMs={1000}
              endedText={inProgress ? undefined : 'Session ended -- the live feed is closed. Evidence keyframes are in the timeline.'}
            />
            {inProgress && (
              <div className="flex flex-wrap gap-2 pt-2">
                <AIStatusChip type="face" active={student.faceVisible} />
                <AIStatusChip type="phone" active={student.phoneDetected} />
                <AIStatusChip type="book" active={student.bookDetected} />
                <AIStatusChip type="persons" active={student.multiplePersons} />
                <AIStatusChip type="gaze" active label={`Gaze: ${student.gazeDirection}`} />
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Suspicion Score Ledger (S, 0–1000)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graph}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                  <YAxis domain={[0, (max) => Math.max(150, max)]} stroke="#94a3b8" fontSize={11} />
                  <Tooltip />
                  <ReferenceLine y={100} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Suspicious (100)', fontSize: 10, fill: '#EF4444' }} />
                  <Line type="stepAfter" dataKey="score" stroke="#4F46E5" strokeWidth={3} name="Suspicion score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-slate-500">
              Rules: +10 per 3 sideways head turns • +50 per book episode • +100 per phone episode • tab switches, absence and multiple faces are logged with 0 points.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Head Pose & Turns</h4>
              <div className="text-xs text-slate-600 font-mono space-y-1">
                <div>
                  Yaw {student.headPose.yaw}° • Pitch {student.headPose.pitch}° • Roll {student.headPose.roll}°
                </div>
                <div>
                  Qualifying turns: <strong>{student.headTurnsCompleted}</strong> ({student.headTurnsPending} toward next +10)
                </div>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recorded Episodes</h4>
              <div className="text-xs text-slate-600 space-y-1 font-medium">
                <div>
                  Phone: <strong className="text-red-600">{ec.PHONE_DETECTED || 0}</strong> • Book/notes: <strong>{ec.BOOK_DETECTED || 0}</strong>
                </div>
                <div>
                  Multiple faces: <strong>{ec.MULTIPLE_FACES || 0}</strong> • Absent: <strong>{ec.CANDIDATE_ABSENT || 0}</strong>
                </div>
                <div>
                  Tab switches: <strong>{student.tabSwitchCount}</strong> ({(student.tabHiddenTotalMs / 1000).toFixed(1)} s hidden)
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <IncidentTimeline incidents={[...events].reverse()} onSelect={setSelected} title="Proctoring Timeline (click to review)" />
        </div>
      </div>

      {selected && <EventReviewModal event={selected} onClose={() => setSelected(null)} onReviewed={load} />}
      {showReport && <SessionReportModal sessionId={sessionId} onClose={() => setShowReport(false)} />}
    </div>
  );
};
