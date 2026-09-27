import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_STUDENTS_LIVE } from '../constants/mockData';
import { monitoringApi } from '../api/monitoringApi';

const ProctoringContext = createContext();

// How often the admin Live Monitoring grid re-polls in-progress sessions.
// Matches the cadence CameraWidget already uses to send frames (see
// BACKEND_SETUP.md), so a student's real detection state shows up here
// within one polling cycle of it happening.
const LIVE_POLL_INTERVAL_MS = 4000;

export const ProctoringProvider = ({ children }) => {
  // Seeded with mock data so LiveMonitoringPage/StudentDetailPage never
  // render an empty grid before the first real poll resolves (or if the
  // backend is unreachable -- monitoringApi.getLiveExaminees already
  // swallows errors into `[]`). Once a poll returns actual in-progress
  // sessions, they replace the mock; on a page with zero real students this
  // means the mock rows keep showing rather than an accurate empty state --
  // an acceptable trade for this pass, same as ExamContext's exams/question
  // bank fetch.
  const [students, setStudents] = useState(MOCK_STUDENTS_LIVE);
  const [activeNotifications, setActiveNotifications] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const live = await monitoringApi.getLiveExaminees();
      if (cancelled) return;
      if (Array.isArray(live) && live.length > 0) setStudents(live);
    };

    poll();
    const intervalId = setInterval(poll, LIVE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  // Real proctoring session state. When examSessionId is set, CameraWidget
  // sends real frames to the Express + Python detection pipeline instead of
  // relying on useProctoringSim's canned event loop. realProctoringActive
  // flips true the first time a real frame analysis succeeds, and back to
  // false if frame submissions start failing (backend down, camera denied,
  // etc.) -- ExamScreenPage uses it to decide whether the fake simulation
  // should fill in.
  const [examSessionId, setExamSessionId] = useState(null);
  const [realProctoringActive, setRealProctoringActive] = useState(false);

  // Real-time student AI state during exam
  const [liveStudentAI, setLiveStudentAI] = useState({
    faceVisible: true,
    phoneDetected: false,
    bookDetected: false,
    multiplePersons: false,
    gazeDirection: "Center", // Center | Left | Right | Down | Away
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    riskScore: 8,
    warningCount: 0,
    status: "Safe" // Safe | Warning | Critical
  });

  // Called from SystemCheckPage right before the student enters the exam.
  // Best-effort: if this fails (backend unreachable, no exam code yet) we
  // just proceed without a real session and CameraWidget/useProctoringSim
  // fall back to the simulated feed -- the exam itself is never blocked on
  // proctoring infrastructure being up.
  const startRealSession = async (examCode) => {
    try {
      const session = await monitoringApi.startSession(examCode);
      setExamSessionId(session.id);
      return session;
    } catch (err) {
      console.warn('Real proctoring session could not be started, falling back to simulation:', err.message);
      setExamSessionId(null);
      return null;
    }
  };

  // Called by CameraWidget after every frame it successfully analyzes.
  const applyRealDetection = (apiSession) => {
    if (!apiSession) return;
    setRealProctoringActive(true);
    setLiveStudentAI((prev) => ({
      ...prev,
      faceVisible: apiSession.faceVisible,
      phoneDetected: apiSession.phoneDetected,
      bookDetected: apiSession.bookDetected,
      multiplePersons: apiSession.multiplePersons,
      gazeDirection: apiSession.gazeDirection,
      headPose: apiSession.headPose,
      riskScore: apiSession.riskScore,
      warningCount: apiSession.warningCount,
      status: apiSession.status,
    }));
  };

  // Called when frame submission itself fails (network/backend down mid-exam)
  // so useProctoringSim can pick back up rather than leaving a stale state.
  const markRealProctoringUnavailable = () => setRealProctoringActive(false);

  // Called from ExamScreenPage on final submit.
  const submitRealSession = async (answers, score) => {
    if (!examSessionId) return null;
    try {
      return await monitoringApi.submitSession(examSessionId, { answers, score });
    } catch (err) {
      console.warn('Could not submit real proctoring session (continuing anyway):', err.message);
      return null;
    }
  };

  // Trigger floating non-intrusive warning notification
  const triggerNotification = (type, message) => {
    const newId = `notif-${Date.now()}`;
    const newNotif = { id: newId, type, message, time: new Date().toLocaleTimeString() };

    setActiveNotifications((prev) => [newNotif, ...prev]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setActiveNotifications((prev) => prev.filter((n) => n.id !== newId));
    }, 4000);
  };

  // Flag student manually in monitoring. Updates the local grid immediately
  // (so the admin sees it change right away rather than waiting up to
  // LIVE_POLL_INTERVAL_MS for the next poll) and fires the real flag off to
  // the backend in the background so it's persisted as a Critical incident.
  const flagStudent = (studentId, reason = "Manual Proctor Flag") => {
    setStudents((prev) =>
      prev.map((std) =>
        std.id === studentId
          ? { ...std, status: "Critical", riskScore: Math.min(100, std.riskScore + 30), lastIncident: reason }
          : std
      )
    );
    monitoringApi.flagStudent(studentId, reason).catch((err) => {
      console.warn('Could not persist manual flag to the backend:', err.message);
    });
  };

  const getStudentById = (id) => {
    return students.find((s) => s.id === id) || students[0];
  };

  return (
    <ProctoringContext.Provider
      value={{
        students,
        setStudents,
        liveStudentAI,
        setLiveStudentAI,
        activeNotifications,
        triggerNotification,
        flagStudent,
        getStudentById,
        examSessionId,
        realProctoringActive,
        startRealSession,
        applyRealDetection,
        markRealProctoringUnavailable,
        submitRealSession,
      }}
    >
      {children}
    </ProctoringContext.Provider>
  );
};

export const useProctoring = () => useContext(ProctoringContext);
