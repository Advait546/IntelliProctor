import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { RequireExaminerAuth, RequireCandidate, RequireCandidateSession } from './Guards';

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

const examiner = (el) => <RequireExaminerAuth>{el}</RequireExaminerAuth>;
const candidate = (el) => <RequireCandidate>{el}</RequireCandidate>;

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />

    {/* Examiner portal */}
    <Route path="/admin/login" element={<AdminLoginPage />} />
    <Route path="/admin/dashboard" element={examiner(<DashboardPage />)} />
    <Route path="/admin/create-test" element={examiner(<CreateTestPage />)} />
    <Route path="/admin/question-creation" element={examiner(<QuestionCreationPage />)} />
    <Route path="/admin/question-bank" element={examiner(<QuestionBankPage />)} />
    <Route path="/admin/publish-test" element={examiner(<PublishTestPage />)} />
    <Route path="/admin/reports" element={examiner(<ReportsPage />)} />
    <Route path="/admin/live-monitoring" element={examiner(<LiveMonitoringPage />)} />
    <Route path="/admin/student-detail/:studentId" element={examiner(<StudentDetailPage />)} />
    <Route path="/admin/settings" element={examiner(<SettingsPage />)} />

    {/* Examinee portal */}
    <Route path="/student/join" element={<GiveTestCodePage />} />
    <Route path="/student/login" element={<StudentLoginPage />} />
    <Route path="/student/waiting-room" element={candidate(<WaitingRoomPage />)} />
    <Route path="/student/instructions" element={candidate(<InstructionsPage />)} />
    <Route path="/student/system-check" element={candidate(<SystemCheckPage />)} />
    <Route
      path="/student/exam"
      element={
        <RequireCandidateSession>
          <ExamScreenPage />
        </RequireCandidateSession>
      }
    />
    <Route path="/student/submission" element={<SubmissionPage />} />

    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);
