import { apiClient } from './client';

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
