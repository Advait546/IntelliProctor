import { apiClient } from './client';

export const monitoringApi = {
  // Real proctoring session lifecycle -- these intentionally do NOT swallow
  // errors into a mock fallback like the rest of this file. The caller
  // (ProctoringContext) needs to know when the real backend isn't available
  // so it can fall back to the client-side simulation instead.
  startSession: (examCode) => apiClient.post('/monitoring/session/start', { examCode }),
  sendFrame: (sessionId, imageBase64) =>
    apiClient.post(`/monitoring/session/${sessionId}/frame`, { imageBase64 }),
  submitSession: (sessionId, payload) =>
    apiClient.post(`/monitoring/session/${sessionId}/submit`, payload),

  // examCode is optional -- the admin Live Monitoring dashboard doesn't
  // currently have a per-exam selector, so ProctoringContext polls with no
  // code to get every in-progress session across all exams.
  getLiveExaminees: async (examCode) => {
    try {
      const path = examCode ? `/monitoring/live/${examCode}` : '/monitoring/live';
      return await apiClient.get(path);
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
