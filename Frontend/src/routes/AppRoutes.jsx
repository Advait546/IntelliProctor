import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Pages
import { LandingPage } from '../pages/LandingPage';
import { AdminLoginPage } from '../pages/admin/AdminLoginPage';
import { DashboardPage } from '../pages/admin/DashboardPage';
import { CreateTestPage } from '../pages/admin/CreateTestPage';
import { QuestionCreationPage } from '../pages/admin/QuestionCreationPage';
import { QuestionBankPage } from '../pages/admin/QuestionBankPage';
import { PublishTestPage } from '../pages/admin/PublishTestPage';
import { ReportsPage } from '../pages/admin/ReportsPage';
import { LiveMonitoringPage } from '../pages/admin/LiveMonitoringPage';
import { StudentDetailPage } from '../pages/admin/StudentDetailPage';
import { SettingsPage } from '../pages/admin/SettingsPage';

import { GiveTestCodePage } from '../pages/student/GiveTestCodePage';
import { StudentLoginPage } from '../pages/student/StudentLoginPage';
import { WaitingRoomPage } from '../pages/student/WaitingRoomPage';
import { InstructionsPage } from '../pages/student/InstructionsPage';
import { SystemCheckPage } from '../pages/student/SystemCheckPage';
import { ExamScreenPage } from '../pages/student/ExamScreenPage';
import { SubmissionPage } from '../pages/student/SubmissionPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Primary Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Flow 1: Exam Setter / Admin Routes */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<DashboardPage />} />
      <Route path="/admin/create-test" element={<CreateTestPage />} />
      <Route path="/admin/question-creation" element={<QuestionCreationPage />} />
      <Route path="/admin/question-bank" element={<QuestionBankPage />} />
      <Route path="/admin/publish-test" element={<PublishTestPage />} />
      <Route path="/admin/reports" element={<ReportsPage />} />
      <Route path="/admin/live-monitoring" element={<LiveMonitoringPage />} />
      <Route path="/admin/student-detail/:studentId" element={<StudentDetailPage />} />
      <Route path="/admin/settings" element={<SettingsPage />} />

      {/* Flow 2: Student Examination Routes */}
      <Route path="/student/join" element={<GiveTestCodePage />} />
      <Route path="/student/login" element={<StudentLoginPage />} />
      <Route path="/student/waiting-room" element={<WaitingRoomPage />} />
      <Route path="/student/instructions" element={<InstructionsPage />} />
      <Route path="/student/system-check" element={<SystemCheckPage />} />
      <Route path="/student/exam" element={<ExamScreenPage />} />
      <Route path="/student/submission" element={<SubmissionPage />} />

      {/* 404 Fallback */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
