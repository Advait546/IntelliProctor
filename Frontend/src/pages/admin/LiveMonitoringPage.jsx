import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldAlert, Search, AlertCircle, ShieldCheck, Wifi, WifiOff, Users } from 'lucide-react';
import { useLiveRoster } from '../../hooks/useLiveRoster';
import { useExam } from '../../contexts/ExamContext';
import { StudentLiveCard } from '../../components/monitoring/StudentLiveCard';
import { ToastNotification } from '../../components/common/ToastNotification';
import { useProctoring } from '../../contexts/ProctoringContext';

const ALERT_TYPES = { PHONE_DETECTED: 'critical', BOOK_DETECTED: 'warning', MULTIPLE_FACES: 'warning', CANDIDATE_ABSENT: 'warning', MANUAL_FLAG: 'warning' };
const LABELS = {
  PHONE_DETECTED: 'Phone detected',
  BOOK_DETECTED: 'Book / notes detected',
  MULTIPLE_FACES: 'Multiple faces in frame',
  CANDIDATE_ABSENT: 'Candidate absent',
  MANUAL_FLAG: 'Manual flag recorded',
};

export const LiveMonitoringPage = () => {
  const [params, setParams] = useSearchParams();
  const examId = params.get('exam') || '';
  const [showFinished, setShowFinished] = useState(false);
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { exams } = useExam();
  const { triggerNotification } = useProctoring();

  const { students, error, loading, socketConnected } = useLiveRoster(examId || null, {
    includeFinished: showFinished,
    onEvent: (msg) => {
      if (msg.type === 'proctoring_event' && ALERT_TYPES[msg.anomaly]) {
        const who = students.find((s) => s.sessionId === msg.sessionId)?.name || 'A candidate';
        triggerNotification(ALERT_TYPES[msg.anomaly], `${who}: ${LABELS[msg.anomaly]}${msg.pointsApplied ? ` (+${msg.pointsApplied}, S=${msg.score})` : ''}`, { dedupeMs: 0 });
      }
    },
  });

  const q = searchQuery.toLowerCase();
  const filtered = students.filter(
    (s) => (filterStatus === 'All' || s.status === filterStatus) && ((s.name || '').toLowerCase().includes(q) || (s.rollNumber || '').toLowerCase().includes(q))
  );
  const count = (st) => students.filter((s) => s.status === st).length;
  const selectedExam = exams.find((e) => e.id === examId);

  const badge = (st, Icon, active, idle) => (
    <button
      onClick={() => setFilterStatus(filterStatus === st ? 'All' : st)}
      className={`px-4 py-2.5 rounded-2xl border text-xs font-extrabold transition-all flex items-center gap-2 ${filterStatus === st ? active : idle}`}
    >
      <Icon className="w-4 h-4" />
      <span>
        {count(st)} {st === 'Critical' ? 'Suspicious' : st}
      </span>
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <ToastNotification />
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono mb-2">
              {socketConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {socketConnected ? 'LIVE FEED CONNECTED' : 'LIVE SYNC VIA POLLING'}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Live AI Proctoring Grid</h1>
            <p className="text-xs text-indigo-200 font-medium mt-1">
              {selectedExam ? (
                <>
                  Exam: <strong className="text-white">{selectedExam.title}</strong> (<span className="font-mono">{selectedExam.code}</span>)
                </>
              ) : (
                'All of your exams'
              )}{' '}
              • Scores are computed by the backend ledger (Suspicious when S &ge; 100)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {badge('Critical', ShieldAlert, 'bg-red-600 text-white border-red-700', 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20')}
            {badge('Warning', AlertCircle, 'bg-amber-600 text-white border-amber-700', 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20')}
            {badge('Safe', ShieldCheck, 'bg-emerald-600 text-white border-emerald-700', 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20')}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <select
            value={examId}
            onChange={(e) => setParams(e.target.value ? { exam: e.target.value } : {})}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-xs"
          >
            <option value="">All exams</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} ({e.code})
              </option>
            ))}
          </select>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name or PRN..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} className="rounded" />
            Include submitted
          </label>
          <button
            onClick={() => setFilterStatus('All')}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${filterStatus === 'All' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Show All ({students.length})
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">Live sync delayed: {error}</div>}

      {!loading && filtered.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white border border-dashed border-slate-300 text-center text-slate-500 space-y-2">
          <Users className="w-8 h-8 mx-auto text-slate-400" />
          <p className="text-sm font-semibold">No {showFinished ? '' : 'in-progress '}candidates{filterStatus !== 'All' ? ` with status ${filterStatus}` : ''} yet.</p>
          <p className="text-xs">Candidates appear here as soon as they start the exam with its code.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((student) => (
            <StudentLiveCard key={student.sessionId} student={student} />
          ))}
        </div>
      )}
    </div>
  );
};
