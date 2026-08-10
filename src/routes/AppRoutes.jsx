import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Pages
import LandingPage from '../pages/LandingPage';
import AdminLoginPage from '../pages/admin/AdminLoginPage';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import CreateTestPage from '../pages/admin/CreateTestPage';
import QuestionCreationPage from '../pages/admin/QuestionCreationPage';
import QuestionBankPage from '../pages/admin/QuestionBankPage';
import PublishTestPage from '../pages/admin/PublishTestPage';
import ReportsPage from '../pages/admin/ReportsPage';
import LiveMonitoringPage from '../pages/admin/LiveMonitoringPage';
import StudentDetailPage from '../pages/admin/StudentDetailPage';
import SettingsPage from '../pages/admin/SettingsPage';

import EnterCodePage from '../pages/student/EnterCodePage';
import StudentLoginPage from '../pages/student/StudentLoginPage';
import WaitingRoomPage from '../pages/student/WaitingRoomPage';
import InstructionsPage from '../pages/student/InstructionsPage';
import SystemCheckPage from '../pages/student/SystemCheckPage';
import ExaminationScreenPage from '../pages/student/ExaminationScreenPage';
import SubmissionPage from '../pages/student/SubmissionPage';

import NotFoundPage from '../pages/not-found/NotFoundPage';

const AppRoutes = () => {
  return (
    <Routes>
      {/* 1. Landing */}
      <Route path="/" element={<LandingPage />} />

      {/* FLOW 1: Generate Test (Admin / Exam Setter) */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
      <Route path="/admin/create-test" element={<CreateTestPage />} />
      <Route path="/admin/create-questions" element={<QuestionCreationPage />} />
      <Route path="/admin/question-bank" element={<QuestionBankPage />} />
      <Route path="/admin/publish-test" element={<PublishTestPage />} />
      <Route path="/admin/reports" element={<ReportsPage />} />
      <Route path="/admin/monitoring" element={<LiveMonitoringPage />} />
      <Route path="/admin/monitoring/:studentId" element={<StudentDetailPage />} />
      <Route path="/admin/settings" element={<SettingsPage />} />

      {/* FLOW 2: Give Test (Student) */}
      <Route path="/give-test" element={<EnterCodePage />} />
      <Route path="/student/enter-code" element={<EnterCodePage />} />
      <Route path="/student/login" element={<StudentLoginPage />} />
      <Route path="/student/waiting-room" element={<WaitingRoomPage />} />
      <Route path="/student/instructions" element={<InstructionsPage />} />
      <Route path="/student/system-check" element={<SystemCheckPage />} />
      <Route path="/student/exam" element={<ExaminationScreenPage />} />
      <Route path="/student/submission" element={<SubmissionPage />} />

      {/* 404 Fallback */}
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};

export default AppRoutes;
