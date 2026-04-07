/**
 * hooks/useAuth.tsx
 * Authentication context — provides login/logout and current user throughout the app.
 * Used by ProtectedRoute and any component that needs to know who is logged in.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

interface User {
  id: string;
  username: string;
  role: 'COUNSELOR' | 'ADMIN';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('carelink_token');
    const storedUser = localStorage.getItem('carelink_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    const { token: newToken, user: newUser } = response.data;

    localStorage.setItem('carelink_token', newToken);
    localStorage.setItem('carelink_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('carelink_token');
    localStorage.removeItem('carelink_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAdmin: user?.role === 'ADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
