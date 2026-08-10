import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_STUDENTS, MOCK_INCIDENTS } from '../constants/mockData';

const MonitoringContext = createContext(null);

export const MonitoringProvider = ({ children }) => {
  const [students, setStudents] = useState(INITIAL_STUDENTS);
  const [incidents, setIncidents] = useState(MOCK_INCIDENTS);
  const [simulationActive, setSimulationActive] = useState(true);

  // Simulated live proctoring stream fluctuations
  useEffect(() => {
    if (!simulationActive) return;

    const interval = setInterval(() => {
      setStudents((prev) =>
        prev.map((student) => {
          // Keep std-1 and std-4 safe, std-3 highly critical, fluctuate others randomly
          if (student.id === 'std-1' || student.id === 'std-6') return student;
          
          const delta = Math.floor(Math.random() * 5) - 2;
          const newRisk = Math.max(0, Math.min(100, student.riskScore + delta));
          let newStatus = "Safe";
          if (newRisk > 40) newStatus = "Warning";
          if (newRisk > 75) newStatus = "Critical";

          return {
            ...student,
            riskScore: newRisk,
            status: newStatus
          };
        })
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [simulationActive]);

  const flagStudent = (studentId, reason) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === studentId) {
          return {
            ...s,
            status: "Critical",
            riskScore: 95,
            warningCount: s.warningCount + 1,
            lastIncident: reason || "Manual Flagged by Proctor"
          };
        }
        return s;
      })
    );

    const newIncident = {
      id: `inc-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      studentId,
      studentName: students.find(s => s.id === studentId)?.name || "Student",
      type: reason || "Manual Proctor Flag",
      confidence: "100%",
      severity: "Critical",
      details: "Flagged directly by live invigilator."
    };

    setIncidents((prev) => [newIncident, ...prev]);
  };

  return (
    <MonitoringContext.Provider
      value={{
        students,
        incidents,
        simulationActive,
        setSimulationActive,
        flagStudent
      }}
    >
      {children}
    </MonitoringContext.Provider>
  );
};

export const useMonitoring = () => {
  const context = useContext(MonitoringContext);
  if (!context) throw new Error('useMonitoring must be used within a MonitoringProvider');
  return context;
};
