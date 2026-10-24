import { apiClient } from './client';

export const questionApi = {
  getQuestionBank: () => apiClient.get('/question-bank', { authRole: 'examiner' }),
  addToBank: (questions) => apiClient.post('/question-bank', { questions }, { authRole: 'examiner' }),
  deleteFromBank: (id) => apiClient.delete(`/question-bank/${id}`, { authRole: 'examiner' }),
  importCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/question-bank/import-csv', formData, {
      authRole: 'examiner',
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
