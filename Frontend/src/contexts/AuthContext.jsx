import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';
import { setToken } from '../api/client';

const AuthContext = createContext();

const load = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const save = (key, value) => {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

export const AuthProvider = ({ children }) => {
  // Examiner identity (role setter/admin) -- token lives in ip_examiner_token.
  const [user, setUser] = useState(() => load('ip_examiner'));
  // Candidate identity -- token lives in ip_student_token.
  const [studentSession, setStudentSession] = useState(() => load('ip_student'));
  // Scoped Exam Session Token + attempt metadata (BACKEND_ARCHITECTURE 10.3).
  const [examSession, setExamSessionState] = useState(() => load('ip_exam_session'));

  useEffect(() => save('ip_examiner', user), [user]);
  useEffect(() => save('ip_student', studentSession), [studentSession]);
  useEffect(() => save('ip_exam_session', examSession), [examSession]);

  const loginSetter = async (email, password) => {
    const res = await authApi.loginExaminer(email, password);
    setToken('examiner', res.token);
    const u = { ...res.user, token: res.token };
    setUser(u);
    return u;
  };

  const logoutSetter = useCallback(() => {
    authApi.logout().catch(() => {});
    setToken('examiner', null);
    setUser(null);
  }, []);

  const loginStudent = async ({ rollNumber, name, password, examCode }) => {
    const res = await authApi.loginCandidate({ candidateId: rollNumber, password, fullName: name });
    setToken('student', res.token);
    const s = {
      id: res.user.id,
      rollNumber: res.user.rollNumber || rollNumber,
      name: res.user.name,
      examCode: (examCode || '').toUpperCase(),
      registered: res.registered,
    };
    setStudentSession(s);
    return s;
  };

  const setExamCode = (examCode) => setStudentSession((prev) => (prev ? { ...prev, examCode: examCode.toUpperCase() } : prev));

  const setExamSession = useCallback((value) => setExamSessionState(value), []);

  const logoutStudent = useCallback(() => {
    authApi.logout().catch(() => {});
    setToken('student', null);
    setStudentSession(null);
    setExamSessionState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        studentSession,
        examSession,
        loginSetter,
        logoutSetter,
        loginStudent,
        logoutStudent,
        setExamCode,
        setExamSession,
        isAuthenticatedSetter: !!user,
        isAuthenticatedStudent: !!studentSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
