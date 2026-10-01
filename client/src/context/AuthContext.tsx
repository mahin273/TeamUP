import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform, Linking } from 'react-native';
import { tokenStorage } from '../services/tokenStorage';
import { api, ApiError } from '../api/client';
import { pushNotificationService } from '../services/pushNotificationService';

export interface ProfileSkill {
  id: string;
  skillName: string;
  category?: string;
  yearsOfExp?: number;
}

export interface UserProfile {
  id?: string;
  userId?: string;
  email: string;
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  department?: string;
  semester?: string;
  availability?: boolean;
  experienceLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  githubUsername?: string;
  portfolioUrl?: string;
  skills?: ProfileSkill[];
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGithub: (code: string, redirectUri?: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<UserProfile>) => void;
  fetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const profileData = await api.get<UserProfile>('/profiles/me');
      setUser((prev) => (prev ? { ...prev, ...profileData } : profileData));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
        await tokenStorage.clearAll();
        setToken(null);
        setUser(null);
      }
      throw err;
    }
  };

  const loginWithGithub = async (code: string, redirectUri?: string): Promise<void> => {
    setIsLoading(true);
    try {
      const payload: { code: string; redirectUri?: string } = { code };
      if (redirectUri) {
        payload.redirectUri = redirectUri;
      }
      const res = await api.post<any>('/auth/github', payload);
      const accessToken = res?.tokens?.accessToken || res?.accessToken;
      const refreshToken = res?.tokens?.refreshToken || res?.refreshToken;

      if (accessToken) {
        await tokenStorage.setAccessToken(accessToken);
        if (refreshToken) {
          await tokenStorage.setRefreshToken(refreshToken);
        }
        setToken(accessToken);

        if (res.user) {
          setUser(res.user);
        } else {
          try {
            const profile = await api.get<UserProfile>('/profiles/me');
            setUser(profile);
          } catch {
            setUser({ email: '', fullName: 'GitHub User' });
          }
        }

        await pushNotificationService.registerDevicePushToken();
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadAuth() {
      try {
        let storedToken = await tokenStorage.getAccessToken();

        // Check if there is a GitHub OAuth code in the URL (Web)
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          if (code) {
            try {
              window.history.replaceState({}, document.title, window.location.pathname);
              await loginWithGithub(code, window.location.origin);
              return;
            } catch (err) {
              console.error('GitHub web OAuth login failed:', err);
            }
          }
        }

        // Check if there is a GitHub OAuth deep link URL (Mobile cold start)
        if (Platform.OS !== 'web' && Linking.getInitialURL) {
          try {
            const initialUrl = await Linking.getInitialURL();
            if (initialUrl) {
              const match = initialUrl.match(/[?&]code=([^&]+)/);
              const code = match ? decodeURIComponent(match[1]) : null;
              if (code) {
                await loginWithGithub(code, 'teamup://github-callback');
                return;
              }
            }
          } catch (err) {
            console.error('GitHub native initial URL check failed:', err);
          }
        }

        if (storedToken && isMounted) {
          setToken(storedToken);
          try {
            const profileData = await api.get<UserProfile>('/profiles/me');
            if (isMounted) {
              setUser(profileData);
              // Register push notification token if not already done
              await pushNotificationService.registerDevicePushToken().catch(console.warn);
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

    const subscription = Linking.addEventListener?.('url', async ({ url }) => {
      const match = url.match(/[?&]code=([^&]+)/);
      const code = match ? decodeURIComponent(match[1]) : null;
      if (code) {
        try {
          await loginWithGithub(code, 'teamup://github-callback');
        } catch (err) {
          console.error('GitHub runtime deep link login failed:', err);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.remove?.();
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await api.post<any>('/auth/login', {
        email,
        password,
      });

      const accessToken = res?.tokens?.accessToken || res?.accessToken;
      const refreshToken = res?.tokens?.refreshToken || res?.refreshToken;

      if (accessToken) {
        await tokenStorage.setAccessToken(accessToken);
        if (refreshToken) {
          await tokenStorage.setRefreshToken(refreshToken);
        }
        setToken(accessToken);

        // Fetch or assign full user profile
        if (res.user) {
          setUser(res.user);
        } else {
          try {
            const profile = await api.get<UserProfile>('/profiles/me');
            setUser(profile);
          } catch {
            setUser({ email, fullName: email.split('@')[0] });
          }
        }

        // Register push notification token
        await pushNotificationService.registerDevicePushToken();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (fullName: string, email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await api.post<any>('/auth/register', {
        fullName,
        email,
        password,
      });

      const accessToken = res?.tokens?.accessToken || res?.accessToken;
      const refreshToken = res?.tokens?.refreshToken || res?.refreshToken;

      if (accessToken) {
        await tokenStorage.setAccessToken(accessToken);
        if (refreshToken) {
          await tokenStorage.setRefreshToken(refreshToken);
        }
        setToken(accessToken);
        try {
          const profile = await api.get<UserProfile>('/profiles/me');
          setUser(profile);
        } catch {
          setUser({ ...(res.user || {}), email, fullName });
        }

        // Register push notification token
        await pushNotificationService.registerDevicePushToken();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await pushNotificationService.deregisterDevicePushToken();
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
        loginWithGithub,
        register,
        logout,
        updateUser,
        fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      login: async () => {},
      loginWithGithub: async () => {},
      register: async () => {},
      logout: async () => {},
      updateUser: () => {},
      fetchProfile: async () => {},
    };
  }
  return context;
};
