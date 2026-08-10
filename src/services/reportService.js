import apiClient from '../api/client';
import { MOCK_REPORTS } from '../constants/mockData';

export const reportService = {
  async getReports() {
    try {
      return await apiClient.get('/reports');
    } catch {
      return MOCK_REPORTS;
    }
  },

  async downloadReportPdf(reportId) {
    try {
      return await apiClient.get(`/reports/${reportId}/download`, { responseType: 'blob' });
    } catch {
      return { success: true, message: `Report PDF download triggered for ${reportId}` };
    }
  }
};
