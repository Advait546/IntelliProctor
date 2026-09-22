import { apiClient } from './client';

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
