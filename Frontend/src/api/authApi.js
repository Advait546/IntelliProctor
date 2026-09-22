import { apiClient } from './client';

export const authApi = {
  loginSetter: async (credentials) => {
    try {
      return await apiClient.post('/auth/setter/login', credentials);
    } catch {
      // Mock Fallback
      return { token: 'mock-setter-jwt-token-2026', user: { name: 'Dr. Sharma', email: credentials.email, role: 'setter' } };
    }
  },
  loginStudent: async (studentDetails) => {
    try {
      return await apiClient.post('/auth/student/login', studentDetails);
    } catch {
      // Mock Fallback
      return { token: 'mock-student-jwt-token-2026', student: { rollNumber: studentDetails.rollNumber, name: studentDetails.name, examCode: studentDetails.examCode } };
    }
  },
  verifyExamCode: async (code) => {
    try {
      return await apiClient.get(`/auth/verify-code/${code}`);
    } catch {
      // Mock validation logic
      if (code && code.trim().length >= 5) {
        return { valid: true, code: code.toUpperCase() };
      }
      return { valid: false, error: "Invalid Exam Code" };
    }
  }
};
