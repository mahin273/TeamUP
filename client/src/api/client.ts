import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as tokens from '../storage/tokens';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  code: string;
  constructor(message: string, code: string = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to attach JWT token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await tokens.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh and unwrap envelope
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retried and not refresh endpoint itself
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        const refreshToken = await tokens.getRefreshToken();
        if (!refreshToken) {
          await tokens.clearTokens();
          return Promise.reject(error);
        }

        const refreshRes = await apiClient.post('/auth/refresh', { refreshToken });
        const newAccess = refreshRes.data?.accessToken || refreshRes.data?.data?.accessToken;
        const newRefresh = refreshRes.data?.refreshToken || refreshRes.data?.data?.refreshToken;

        if (newAccess) {
          await tokens.setAccessToken(newAccess);
        }
        if (newRefresh) {
          await tokens.setRefreshToken(newRefresh);
        }

        if (originalRequest.headers && newAccess) {
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        await tokens.clearTokens();
        return Promise.reject(refreshErr);
      }
    }

    if (error.response && error.response.data && typeof error.response.data === 'object') {
      const responseData = error.response.data;
      if (responseData.error) {
        throw new ApiError(responseData.error.message, responseData.error.code);
      }
    }
    const message = error.message || 'Network error occurred.';
    const code = error.code || 'NETWORK_ERROR';
    throw new ApiError(message, code);
  }
);

export const api = {
  get: <T = any>(url: string, params?: Record<string, any>): Promise<T> =>
    apiClient.get(url, { params }).then((r) => {
      const body = r.data;
      if (body && typeof body === 'object' && 'success' in body) {
        return body.data !== undefined ? body.data : body;
      }
      return body;
    }),
  post: <T = any>(url: string, data?: any): Promise<T> =>
    apiClient.post(url, data).then((r) => {
      const body = r.data;
      if (body && typeof body === 'object' && 'success' in body) {
        return body.data !== undefined ? body.data : body;
      }
      return body;
    }),
  put: <T = any>(url: string, data?: any): Promise<T> =>
    apiClient.put(url, data).then((r) => {
      const body = r.data;
      if (body && typeof body === 'object' && 'success' in body) {
        return body.data !== undefined ? body.data : body;
      }
      return body;
    }),
  patch: <T = any>(url: string, data?: any): Promise<T> =>
    apiClient.patch(url, data).then((r) => {
      const body = r.data;
      if (body && typeof body === 'object' && 'success' in body) {
        return body.data !== undefined ? body.data : body;
      }
      return body;
    }),
  delete: <T = any>(url: string, data?: any): Promise<T> =>
    apiClient.delete(url, { data }).then((r) => {
      const body = r.data;
      if (body && typeof body === 'object' && 'success' in body) {
        return body.data !== undefined ? body.data : body;
      }
      return body;
    }),
};
