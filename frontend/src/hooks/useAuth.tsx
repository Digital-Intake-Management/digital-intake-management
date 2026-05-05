/**
 * hooks/useAuth.tsx
 * Authentication context — provides login/logout and current user throughout the app.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '@/services/api';

interface User {
  id: string;
  username: string;
  role: 'COUNSELOR' | 'ADMIN';
  mustChangePassword: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateSession: (token: string, user: User) => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('carelink_token');
    const storedUser = localStorage.getItem('carelink_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const updateSession = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('carelink_token', newToken);
    localStorage.setItem('carelink_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    const { token: newToken, user: newUser } = response.data;
    updateSession(newToken, newUser as User);
  }, [updateSession]);

  const logout = useCallback(async () => {
    // Tell the server to denylist the current token before clearing locally
    try {
      await authApi.logout();
    } catch {
      // Still clear locally even if the server call fails
    }
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
        updateSession,
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
