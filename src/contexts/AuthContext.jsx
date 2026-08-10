import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const current = authService.getCurrentUser();
    if (current) {
      setUser(current);
    }
    setLoading(false);
  }, []);

  const loginAdmin = async (email, password) => {
    const data = await authService.adminLogin(email, password);
    setUser(data);
    return data;
  };

  const loginStudent = async (code, prn, name, password) => {
    const data = await authService.studentLogin(code, prn, name, password);
    setUser(data);
    return data;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginAdmin, loginStudent, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
