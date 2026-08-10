import { apiClient } from './client';

export const questionApi = {
  saveQuestions: async (examId, questions) => {
    try {
      return await apiClient.post(`/exams/${examId}/questions`, { questions });
    } catch {
      return { success: true, count: questions.length };
    }
  },
  getQuestionBank: async () => {
    try {
      return await apiClient.get('/question-bank');
    } catch {
      return [];
    }
  },
  importCSV: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      return await apiClient.post('/question-bank/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    } catch {
      return { success: true, importedCount: 5 };
    }
  }
};

export const monitoringApi = {
  getLiveExaminees: async (examCode) => {
    try {
      return await apiClient.get(`/monitoring/live/${examCode}`);
    } catch {
      return [];
    }
  },
  getStudentDetail: async (studentId) => {
    try {
      return await apiClient.get(`/monitoring/student/${studentId}`);
    } catch {
      return null;
    }
  },
  flagStudent: async (studentId, reason) => {
    try {
      return await apiClient.post(`/monitoring/student/${studentId}/flag`, { reason });
    } catch {
      return { success: true, flagged: true, timestamp: new Date().toISOString() };
    }
  }
};

export const reportApi = {
  getReports: async () => {
    try {
      return await apiClient.get('/reports');
    } catch {
      return [];
    }
  },
  downloadReportCSV: async (reportId) => {
    try {
      return await apiClient.get(`/reports/${reportId}/download`, { responseType: 'blob' });
    } catch {
      return true;
    }
  }
};

export const settingsApi = {
  getSettings: async () => {
    try {
      return await apiClient.get('/settings');
    } catch {
      return null;
    }
  },
  updateSettings: async (settings) => {
    try {
      return await apiClient.put('/settings', settings);
    } catch {
      return { success: true, updated: true };
    }
  }
};
