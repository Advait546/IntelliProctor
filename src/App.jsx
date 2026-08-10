import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ExamProvider } from './contexts/ExamContext';
import { MonitoringProvider } from './contexts/MonitoringContext';
import AppRoutes from './routes/AppRoutes';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ExamProvider>
          <MonitoringProvider>
            <AppRoutes />
          </MonitoringProvider>
        </ExamProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
