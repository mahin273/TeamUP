import React, { createContext, useContext, useState, useEffect } from 'react';
import { tokenStorage } from '../services/tokenStorage';
import { api } from '../api/client';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  skills?: string[];
  githubUsername?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadAuth() {
      try {
        const storedToken = await tokenStorage.getAccessToken();
        if (storedToken && isMounted) {
          setToken(storedToken);
          try {
            const profileData = await api.get<UserProfile>('/profiles/me');
            if (isMounted) {
              setUser(profileData);
            }
          } catch {
            await tokenStorage.clearAll();
            if (isMounted) {
              setToken(null);
              setUser(null);
            }
          }
        }
      } catch {
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await api.post<{ accessToken: string; refreshToken?: string; user: UserProfile }>('/auth/login', {
        email,
        password,
      });

      if (res.accessToken) {
        await tokenStorage.setAccessToken(res.accessToken);
        if (res.refreshToken) {
          await tokenStorage.setRefreshToken(res.refreshToken);
        }
        setToken(res.accessToken);
        setUser(res.user || null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (fullName: string, email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await api.post<{ accessToken: string; refreshToken?: string; user: UserProfile }>('/auth/register', {
        fullName,
        email,
        password,
      });

      if (res.accessToken) {
        await tokenStorage.setAccessToken(res.accessToken);
        if (res.refreshToken) {
          await tokenStorage.setRefreshToken(res.refreshToken);
        }
        setToken(res.accessToken);
        setUser(res.user || null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await tokenStorage.clearAll();
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (updatedUser: Partial<UserProfile>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedUser } : (updatedUser as UserProfile)));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
