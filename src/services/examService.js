import apiClient from '../api/client';
import { INITIAL_EXAMS } from '../constants/mockData';

export const examService = {
  async getExams() {
    try {
      return await apiClient.get('/exams');
    } catch {
      const stored = localStorage.getItem('app_exams');
      return stored ? JSON.parse(stored) : INITIAL_EXAMS;
    }
  },

  async getExamByCode(code) {
    try {
      return await apiClient.get(`/exams/code/${code}`);
    } catch {
      const exams = await this.getExams();
      const found = exams.find((e) => e.code.toUpperCase() === code.toUpperCase());
      if (found) return found;
      // Fallback default exam if user enters custom code
      return {
        ...INITIAL_EXAMS[0],
        code: code.toUpperCase(),
        title: `Exam (${code.toUpperCase()})`
      };
    }
  },

  async createExam(examData) {
    try {
      return await apiClient.post('/exams', examData);
    } catch {
      const exams = await this.getExams();
      const newExam = {
        id: `exam-${Date.now()}`,
        code: examData.code || `AI2026CS${Math.floor(10 + Math.random() * 90)}`,
        title: examData.title || "Untitled Assessment",
        subject: examData.subject || "General Science",
        duration: Number(examData.duration) || 60,
        totalQuestions: examData.questions?.length || 0,
        totalMarks: examData.questions?.reduce((acc, q) => acc + (Number(q.marks) || 1), 0) || 10,
        passingScore: 12,
        scheduledDate: examData.scheduledDate || new Date().toISOString().split('T')[0],
        scheduledTime: examData.scheduledTime || "10:00 AM",
        setter: "Dr. Sharma",
        status: "Active",
        studentsEnrolled: 30,
        studentsCompleted: 0,
        avgScore: 0,
        avgRiskScore: 0,
        completionRate: 0,
        settings: examData.settings || {},
        instructions: examData.instructions || ["Follow standard AI proctoring guidelines."]
      };
      const updated = [newExam, ...exams];
      localStorage.setItem('app_exams', JSON.stringify(updated));
      return newExam;
    }
  }
};
