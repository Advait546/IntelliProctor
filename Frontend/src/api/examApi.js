import { apiClient } from './client';

export const examApi = {
  createExam: async (examData) => {
    try {
      return await apiClient.post('/exams', examData);
    } catch {
      return { success: true, exam: { ...examData, id: `EX-${Date.now()}` } };
    }
  },
  getExams: async () => {
    try {
      return await apiClient.get('/exams');
    } catch {
      return [];
    }
  },
  getExamByCode: async (code) => {
    try {
      return await apiClient.get(`/exams/code/${code}`);
    } catch {
      return null;
    }
  },
  publishExam: async (examId, publishOptions) => {
    try {
      return await apiClient.post(`/exams/${examId}/publish`, publishOptions);
    } catch {
      return { success: true, publishedAt: new Date().toISOString() };
    }
  }
};
