import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ExamProvider } from './contexts/ExamContext';
import { ProctoringProvider } from './contexts/ProctoringContext';
import { Navbar } from './components/common/Navbar';
import { AppRoutes } from './routes/AppRoutes';

const AppContent = () => {
  const location = useLocation();
  const hideNavbarRoutes = ['/student/exam', '/student/join'];
  const showNavbar = !hideNavbarRoutes.includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {showNavbar && <Navbar />}
      <main className="flex-1">
        <AppRoutes />
      </main>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ExamProvider>
          <ProctoringProvider>
            <AppContent />
          </ProctoringProvider>
        </ExamProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
