import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ProctoringContext = createContext();

// Candidate-side live proctoring state. This holds only what the CV worker
// OBSERVED in the latest frame (face visible, facing the screen, ...). There is
// no score here on purpose: suspicion scores are computed exclusively by the
// backend and are never shown to examinees during the exam (section 14.2).
const INITIAL_AI_STATE = {
  faceVisible: true,
  faceCount: null,
  phoneDetected: false,
  bookDetected: false,
  multiplePersons: false,
  lookingAway: false,
  gazeDirection: 'Center',
  headPose: { pitch: 0, yaw: 0, roll: 0 },
};

export const ProctoringProvider = ({ children }) => {
  const [liveStudentAI, setLiveStudentAI] = useState(INITIAL_AI_STATE);
  // 'connecting' | 'online' | 'offline' (CV worker unreachable) | 'camera-blocked'
  const [proctorStatus, setProctorStatus] = useState('connecting');
  const [activeNotifications, setActiveNotifications] = useState([]);
  const lastToast = useRef({});

  const triggerNotification = useCallback((type, message, { dedupeMs = 8000 } = {}) => {
    const now = Date.now();
    if (lastToast.current[message] && now - lastToast.current[message] < dedupeMs) return;
    lastToast.current[message] = now;
    const id = `notif-${now}-${Math.random().toString(36).slice(2, 6)}`;
    setActiveNotifications((prev) => [{ id, type, message, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 4));
    setTimeout(() => setActiveNotifications((prev) => prev.filter((n) => n.id !== id)), 4500);
  }, []);

  // Called by CameraWidget with the backend's /frames response.
  const applyObservation = useCallback((obs) => {
    if (!obs) return;
    setLiveStudentAI({
      faceVisible: obs.faceVisible,
      faceCount: obs.faceCount,
      phoneDetected: obs.phoneInView,
      bookDetected: obs.bookInView,
      multiplePersons: obs.multipleFaces,
      lookingAway: obs.lookingAway,
      gazeDirection: obs.gazeDirection || 'Center',
      headPose: obs.headPose || { pitch: 0, yaw: 0, roll: 0 },
    });
  }, []);

  const resetProctoring = useCallback(() => {
    setLiveStudentAI(INITIAL_AI_STATE);
    setProctorStatus('connecting');
  }, []);

  return (
    <ProctoringContext.Provider
      value={{
        liveStudentAI,
        applyObservation,
        proctorStatus,
        setProctorStatus,
        activeNotifications,
        triggerNotification,
        resetProctoring,
      }}
    >
      {children}
    </ProctoringContext.Provider>
  );
};

export const useProctoring = () => useContext(ProctoringContext);
