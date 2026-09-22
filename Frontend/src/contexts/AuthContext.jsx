import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [studentSession, setStudentSession] = useState(() => {
    const saved = localStorage.getItem('student_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('user_session', JSON.stringify(user));
    else localStorage.removeItem('user_session');
  }, [user]);

  useEffect(() => {
    if (studentSession) localStorage.setItem('student_session', JSON.stringify(studentSession));
    else localStorage.removeItem('student_session');
  }, [studentSession]);

  const loginSetter = async (email, password) => {
    const res = await authApi.loginSetter({ email, password });
    const userObj = { email, name: 'Dr. Sharma', role: 'setter', token: res.token || 'mock-token' };
    setUser(userObj);
    return userObj;
  };

  const logoutSetter = () => {
    setUser(null);
  };

  const loginStudent = async (rollNumber, name, examCode) => {
    const res = await authApi.loginStudent({ rollNumber, name, examCode });
    const sessionObj = { rollNumber, name, examCode, token: res.token || 'mock-student-token' };
    setStudentSession(sessionObj);
    return sessionObj;
  };

  const logoutStudent = () => {
    setStudentSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        studentSession,
        loginSetter,
        logoutSetter,
        loginStudent,
        logoutStudent,
        isAuthenticatedSetter: !!user,
        isAuthenticatedStudent: !!studentSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
