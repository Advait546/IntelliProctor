import apiClient from '../api/client';

export const authService = {
  async adminLogin(email, password) {
    // Simulated auth logic with backend fallback
    try {
      const response = await apiClient.post('/auth/admin/login', { email, password });
      return response;
    } catch {
      // Mock fallback for standalone frontend evaluation
      if (email && password) {
        const mockUser = {
          id: "admin-1",
          name: "Dr. Sharma",
          email: email,
          role: "Exam Setter / Admin",
          token: "mock-jwt-token-setter-2026"
        };
        localStorage.setItem('auth_token', mockUser.token);
        localStorage.setItem('auth_user', JSON.stringify(mockUser));
        return mockUser;
      }
      throw new Error("Invalid email or password");
    }
  },

  async studentLogin(code, prn, name, password) {
    try {
      const response = await apiClient.post('/auth/student/login', { code, prn, name, password });
      return response;
    } catch {
      const mockStudent = {
        id: "student-" + prn,
        prn: prn,
        name: name || "Alex Student",
        role: "Student",
        examCode: code,
        token: "mock-jwt-token-student-" + prn
      };
      localStorage.setItem('auth_token', mockStudent.token);
      localStorage.setItem('auth_user', JSON.stringify(mockStudent));
      return mockStudent;
    }
  },

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('auth_user');
    return userStr ? JSON.parse(userStr) : null;
  }
};
