import apiClient from '../api/client';
import { INITIAL_QUESTIONS } from '../constants/mockData';

export const questionService = {
  async getQuestions() {
    try {
      return await apiClient.get('/questions');
    } catch {
      const stored = localStorage.getItem('app_questions');
      return stored ? JSON.parse(stored) : INITIAL_QUESTIONS;
    }
  },

  async saveQuestion(question) {
    try {
      return await apiClient.post('/questions', question);
    } catch {
      const questions = await this.getQuestions();
      const newQ = {
        id: question.id || `q-${Date.now()}`,
        type: question.type || "MCQ",
        text: question.text || "New Question",
        options: question.options || ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: question.correctAnswer || question.options?.[0] || "",
        marks: Number(question.marks) || 2,
        difficulty: question.difficulty || "Medium",
        subject: question.subject || "Computer Science",
        topic: question.topic || "General"
      };
      const updated = [newQ, ...questions];
      localStorage.setItem('app_questions', JSON.stringify(updated));
      return newQ;
    }
  },

  async deleteQuestion(id) {
    try {
      return await apiClient.delete(`/questions/${id}`);
    } catch {
      const questions = await this.getQuestions();
      const updated = questions.filter((q) => q.id !== id);
      localStorage.setItem('app_questions', JSON.stringify(updated));
      return { success: true };
    }
  }
};
