import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_STUDENTS_LIVE } from '../constants/mockData';

const ProctoringContext = createContext();

export const ProctoringProvider = ({ children }) => {
  const [students, setStudents] = useState(MOCK_STUDENTS_LIVE);
  const [activeNotifications, setActiveNotifications] = useState([]);
  
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

  // Flag student manually in monitoring
  const flagStudent = (studentId, reason = "Manual Proctor Flag") => {
    setStudents((prev) =>
      prev.map((std) =>
        std.id === studentId
          ? { ...std, status: "Critical", riskScore: Math.min(100, std.riskScore + 30), lastIncident: reason }
          : std
      )
    );
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
      }}
    >
      {children}
    </ProctoringContext.Provider>
  );
};

export const useProctoring = () => useContext(ProctoringContext);
