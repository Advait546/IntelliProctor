import { apiClient } from './client';

export const reportApi = {
  getReports: () => apiClient.get('/reports', { authRole: 'examiner' }),
  // id = exam id (examiner roster) or session id (examiner full / candidate sanitized)
  getReport: (id, role = 'examiner') => apiClient.get(`/reports/${id}`, { authRole: role }),
  downloadReportCSV: (id) => apiClient.get(`/reports/${id}/download`, { responseType: 'blob', authRole: 'examiner' }),
  getOverview: () => apiClient.get('/stats/overview', { authRole: 'examiner' }),
};
