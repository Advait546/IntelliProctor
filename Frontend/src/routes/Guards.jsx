import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// UX guards only -- every rule is enforced again by the backend (RBAC + IDOR).
export const RequireExaminerAuth = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location }} />;
  return children;
};

export const RequireCandidate = ({ children }) => {
  const { studentSession } = useAuth();
  if (!studentSession) return <Navigate to="/student/join" replace />;
  return children;
};

export const RequireCandidateSession = ({ children }) => {
  const { studentSession, examSession } = useAuth();
  if (!studentSession) return <Navigate to="/student/join" replace />;
  if (!examSession?.sessionToken) return <Navigate to="/student/system-check" replace />;
  return children;
};
