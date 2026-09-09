import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../services/tokenStorage';

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
    const token = await tokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to unwrap envelope and throw standardized ApiError
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse;
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success) {
        return body.data !== undefined ? body.data : body;
      } else {
        const errorDetails = body.error || { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred.' };
        throw new ApiError(errorDetails.message, errorDetails.code);
      }
    }
    return response.data;
  },
  (error: AxiosError<ApiResponse>) => {
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
    apiClient.get(url, { params }) as unknown as Promise<T>,
  post: <T = any>(url: string, data?: any): Promise<T> =>
    apiClient.post(url, data) as unknown as Promise<T>,
  put: <T = any>(url: string, data?: any): Promise<T> =>
    apiClient.put(url, data) as unknown as Promise<T>,
  patch: <T = any>(url: string, data?: any): Promise<T> =>
    apiClient.patch(url, data) as unknown as Promise<T>,
  delete: <T = any>(url: string): Promise<T> =>
    apiClient.delete(url) as unknown as Promise<T>,
};
