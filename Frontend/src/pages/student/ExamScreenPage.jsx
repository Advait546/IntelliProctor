import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, Bookmark, ArrowLeft, ArrowRight, Send, CloudOff, Check, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProctoring } from '../../contexts/ProctoringContext';
import { useServerCountdown } from '../../hooks/useTimer';
import { useTabVisibility } from '../../hooks/useTabVisibility';
import { useLiveSocket } from '../../hooks/useLiveSocket';
import { QuestionCard } from '../../components/exam/QuestionCard';
import { QuestionPalette } from '../../components/exam/QuestionPalette';
import { CameraWidget } from '../../components/exam/CameraWidget';
import { AIStatusChip } from '../../components/common/AIStatusChip';
import { ToastNotification } from '../../components/common/ToastNotification';
import { examApi } from '../../api/examApi';
import { monitoringApi } from '../../api/monitoringApi';
import { errorCode, errorMessage } from '../../api/client';

const draftKey = (examId, candidateId) => `intelliproctor_draft_${examId}_${candidateId}`;

export const ExamScreenPage = () => {
  const navigate = useNavigate();
  const { examSession, studentSession } = useAuth();
  const { liveStudentAI, proctorStatus, triggerNotification } = useProctoring();
  const { sessionToken, sessionId, examId } = examSession || {};

  const [exam, setExam] = useState(null);
  const [session, setSession] = useState({ expiresAt: examSession.expiresAt, serverNow: examSession.serverNow });
  const [questions, setQuestions] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [visited, setVisited] = useState({});
  const [saveState, setSaveState] = useState('saved'); // saved | saving | offline
  const [submitting, setSubmitting] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const saveTimers = useRef({});
  const pendingSaves = useRef(new Set());
  const submittedRef = useRef(false);

  // ---------------------------------------------------------------- loading
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await examApi.getQuestions(examId, sessionToken);
        if (cancelled) return;
        if (res.session.status !== 'IN_PROGRESS') {
          navigate('/student/submission', { replace: true, state: { alreadySubmitted: true, sessionId } });
          return;
        }
        let cached = {};
        try {
          cached = JSON.parse(localStorage.getItem(draftKey(examId, studentSession.id)) || '{}');
        } catch {
          cached = {};
        }
        setExam(res.exam);
        setQuestions(res.questions);
        setSession({ expiresAt: res.session.expiresAt, serverNow: res.session.serverNow });
        // Server drafts are authoritative; local cache fills anything not yet synced.
        setAnswers({ ...cached, ...res.answers });
        setMarkedForReview(res.markedForReview || {});
        setVisited(res.questions[0] ? { [res.questions[0].id]: true } : {});
        Object.keys(cached).forEach((qid) => {
          if (!(qid in res.answers)) pendingSaves.current.add(qid);
        });
      } catch (err) {
        if (cancelled) return;
        if (err?.response?.status === 401) {
          navigate('/student/system-check', { replace: true });
          return;
        }
        setLoadError(errorMessage(err, 'Could not load the exam'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, sessionToken, sessionId, studentSession.id, navigate]);

  // ------------------------------------------------------------- autosave
  const persistLocal = (next) => {
    try {
      localStorage.setItem(draftKey(examId, studentSession.id), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const saveToServer = useCallback(
    async (qid, value, marked) => {
      setSaveState('saving');
      try {
        await examApi.saveDraft(examId, sessionToken, qid, value, marked);
        pendingSaves.current.delete(qid);
        setSaveState(pendingSaves.current.size ? 'offline' : 'saved');
      } catch (err) {
        if (errorCode(err) === 'SESSION_NOT_ACTIVE') return;
        pendingSaves.current.add(qid);
        setSaveState('offline');
      }
    },
    [examId, sessionToken]
  );

  // Retry unsynced answers every 10 s (network blips).
  useEffect(() => {
    const id = setInterval(() => {
      pendingSaves.current.forEach((qid) => saveToServer(qid, answersRef.current[qid] ?? null));
    }, 10000);
    return () => clearInterval(id);
  }, [saveToServer]);

  const currentQuestion = questions[currentIndex];

  const handleSelectOption = (value) => {
    if (!currentQuestion) return;
    const qid = currentQuestion.id;
    const next = { ...answersRef.current, [qid]: value };
    setAnswers(next);
    persistLocal(next);
    pendingSaves.current.add(qid);
    clearTimeout(saveTimers.current[qid]);
    const typed = currentQuestion.type === 'FillBlank' || currentQuestion.type === 'Subjective';
    saveTimers.current[qid] = setTimeout(() => saveToServer(qid, value, undefined), typed ? 800 : 0);
  };

  const goTo = (idx) => {
    setCurrentIndex(idx);
    setVisited((prev) => ({ ...prev, [questions[idx].id]: true }));
  };

  const handleToggleMark = () => {
    const qid = currentQuestion.id;
    const marked = !markedForReview[qid];
    setMarkedForReview((prev) => ({ ...prev, [qid]: marked }));
    saveToServer(qid, answersRef.current[qid] ?? null, marked);
  };

  // --------------------------------------------------------------- submit
  const finish = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      Object.values(saveTimers.current).forEach(clearTimeout);
      try {
        const res = await examApi.submit(examId, sessionToken, answersRef.current);
        try {
          localStorage.removeItem(draftKey(examId, studentSession.id));
        } catch {
          /* ignore */
        }
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        navigate('/student/submission', {
          replace: true,
          state: { ...res, sessionId, examTitle: exam?.title, autoSubmitted: auto, submissionTime: new Date(res.submittedAt).toLocaleTimeString() },
        });
      } catch (err) {
        submittedRef.current = false;
        setSubmitting(false);
        triggerNotification('critical', `Submission failed: ${errorMessage(err)}. Your answers are saved -- please retry.`, { dedupeMs: 0 });
      }
    },
    [examId, sessionToken, sessionId, studentSession.id, exam, navigate, triggerNotification]
  );

  const handleSubmitExam = () => {
    const unanswered = questions.filter((q) => answers[q.id] === undefined || answers[q.id] === '' || answers[q.id] === null).length;
    const msg = unanswered ? `You have ${unanswered} unanswered question(s). Submit anyway?` : 'Submit your examination now?';
    if (window.confirm(msg)) finish(false);
  };

  const onTimeUp = useCallback(() => {
    triggerNotification('warning', 'Time is up -- submitting your answers.', { dedupeMs: 0 });
    finish(true);
  }, [finish, triggerNotification]);
  const { formatTime, secondsLeft } = useServerCountdown(session.expiresAt, session.serverNow, onTimeUp);

  // ------------------------------------------------------ tab telemetry
  const tabEpisode = useRef(null);
  const sendTab = useCallback(
    (eventType, timestamp, durationMs) => {
      if (eventType === 'TAB_BLUR') tabEpisode.current = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const episodeId = tabEpisode.current || `tab-${Date.now()}`;
      const payload = { eventType, episodeId, timestamp, durationMs, details: { visibilityState: document.visibilityState } };
      const attempt = (n) =>
        monitoringApi.sendBrowserEvent(sessionId, sessionToken, payload).catch((err) => {
          // Idempotent on episodeId, so retrying after a network drop is safe.
          if (n < 5 && !err?.response) setTimeout(() => attempt(n + 1), 2000 * (n + 1));
        });
      attempt(0);
    },
    [sessionId, sessionToken]
  );
  useTabVisibility({
    enabled: !submitting,
    onTabHidden: ({ timestamp }) => sendTab('TAB_BLUR', timestamp),
    onTabVisible: ({ timestamp, durationMs }) => {
      sendTab('TAB_FOCUS', timestamp, durationMs);
      triggerNotification('warning', `You left the exam window for ${(durationMs / 1000).toFixed(1)} s. This has been logged.`);
    },
  });

  // ----------------------------------------- lockdown & fullscreen reminders
  useEffect(() => {
    const block = (e) => e.preventDefault();
    const keys = (e) => {
      const k = e.key?.toLowerCase();
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'u', 'p', 's'].includes(k))) e.preventDefault();
    };
    const fs = () => {
      if (!document.fullscreenElement) triggerNotification('warning', 'Please stay in fullscreen mode during the exam.');
    };
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    document.addEventListener('keydown', keys);
    document.addEventListener('fullscreenchange', fs);
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('paste', block);
      document.removeEventListener('keydown', keys);
      document.removeEventListener('fullscreenchange', fs);
    };
  }, [triggerNotification]);

  // ------------------------------------------------ candidate notifications
  useLiveSocket(`/ws/v1/candidate/session/${sessionId}?token=${encodeURIComponent(sessionToken)}`, (msg) => {
    if (msg.type === 'examiner_message') triggerNotification(msg.level === 'warning' ? 'warning' : 'info', `Examiner: ${msg.message}`, { dedupeMs: 0 });
    if (msg.type === 'session_closed') finish(true);
  });

  const onSessionClosed = useCallback(() => finish(true), [finish]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-3xl border border-red-200 p-8 text-center space-y-3">
          <h2 className="text-lg font-bold text-red-700">Could not load your exam</h2>
          <p className="text-sm text-slate-600">{loadError}</p>
          <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!exam || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading your examination...
      </div>
    );
  }

  const lowTime = secondsLeft !== null && secondsLeft < 300;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between relative overflow-x-hidden select-none">
      <ToastNotification />

      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-tight truncate">{exam.title}</h1>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">CODE: {examSession.examCode}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3 flex-1 max-w-xs mx-4">
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 whitespace-nowrap">
              {currentIndex + 1}/{questions.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-slate-300" title="Answers are autosaved to the server">
              {saveState === 'saved' && (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Saved
                </>
              )}
              {saveState === 'saving' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving
                </>
              )}
              {saveState === 'offline' && (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-400" /> Cached locally
                </>
              )}
            </span>
            <div
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border font-mono font-bold text-sm ${
                lowTime ? 'bg-red-900/40 border-red-700 text-red-300' : 'bg-slate-800 border-slate-700 text-emerald-400'
              }`}
            >
              <Clock className="w-4 h-4 animate-pulse" />
              <span>{formatTime()}</span>
            </div>
            <button
              onClick={handleSubmitExam}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit Exam'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <QuestionCard
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
            selectedAnswer={answers[currentQuestion.id] ?? ''}
            onSelectAnswer={handleSelectOption}
          />

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs border transition-all flex items-center gap-1.5 ${
                  currentIndex === 0 ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>
              <button
                onClick={handleToggleMark}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs border transition-all flex items-center gap-1.5 ${
                  markedForReview[currentQuestion.id] ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <Bookmark className="w-4 h-4" />
                <span>{markedForReview[currentQuestion.id] ? 'Marked' : 'Mark for Review'}</span>
              </button>
            </div>

            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => goTo(currentIndex + 1)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Save & Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmitExam}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Final Submit</span>
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Proctor AI Feed</span>
              <span className={`text-[10px] font-bold ${proctorStatus === 'online' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {proctorStatus === 'online' ? 'Monitoring' : proctorStatus === 'connecting' ? 'Connecting' : 'Limited'}
              </span>
            </div>
            <CameraWidget size="small" compact sendFrames sessionId={sessionId} sessionToken={sessionToken} onSessionClosed={onSessionClosed} />
            <div className="flex flex-wrap gap-1 pt-1">
              <AIStatusChip type="face" active={liveStudentAI.faceVisible} />
              {liveStudentAI.lookingAway && <AIStatusChip type="gaze" active label="Please face the screen" />}
              {liveStudentAI.multiplePersons && <AIStatusChip type="persons" active />}
            </div>
          </div>

          <QuestionPalette
            questions={questions}
            currentIndex={currentIndex}
            answers={answers}
            markedForReview={markedForReview}
            visited={visited}
            onSelectQuestion={goTo}
          />
        </aside>
      </main>
    </div>
  );
};
