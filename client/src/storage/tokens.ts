import { tokenStorage } from '../services/tokenStorage';

export const getAccessToken = () => tokenStorage.getAccessToken();
export const setAccessToken = (token: string) => tokenStorage.setAccessToken(token);
export const getRefreshToken = () => tokenStorage.getRefreshToken();
export const setRefreshToken = (token: string) => tokenStorage.setRefreshToken(token);
export const clearTokens = () => tokenStorage.clearAll();
