import apiClient from '../api/client';
import { INITIAL_STUDENTS, MOCK_INCIDENTS, MOCK_RISK_TIMELINE } from '../constants/mockData';

export const monitoringService = {
  async getLiveStudents() {
    try {
      return await apiClient.get('/monitoring/live');
    } catch {
      const stored = localStorage.getItem('app_live_students');
      return stored ? JSON.parse(stored) : INITIAL_STUDENTS;
    }
  },

  async getStudentById(id) {
    try {
      return await apiClient.get(`/monitoring/student/${id}`);
    } catch {
      const students = await this.getLiveStudents();
      const found = students.find((s) => s.id === id || s.prn === id);
      if (found) return found;
      return INITIAL_STUDENTS[0];
    }
  },

  async getStudentIncidents(studentId) {
    try {
      return await apiClient.get(`/monitoring/student/${studentId}/incidents`);
    } catch {
      return MOCK_INCIDENTS.filter((i) => !studentId || i.studentId === studentId);
    }
  },

  async getRiskTimeline() {
    try {
      return await apiClient.get('/monitoring/timeline');
    } catch {
      return MOCK_RISK_TIMELINE;
    }
  },

  async flagStudent(studentId, reason) {
    try {
      return await apiClient.post(`/monitoring/student/${studentId}/flag`, { reason });
    } catch {
      const students = await this.getLiveStudents();
      const updated = students.map((s) => {
        if (s.id === studentId) {
          return { ...s, status: "Critical", riskScore: Math.min(100, s.riskScore + 30), warningCount: s.warningCount + 1 };
        }
        return s;
      });
      localStorage.setItem('app_live_students', JSON.stringify(updated));
      return { success: true, message: `Student flagged: ${reason}` };
    }
  }
};
