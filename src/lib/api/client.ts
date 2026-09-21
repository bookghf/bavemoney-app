import axios, { AxiosError, type AxiosInstance } from 'axios';

import { useAuthStore } from '@/store/auth-store';

/**
 * Base URL comes from an Expo public env var so it can differ per environment.
 * Set EXPO_PUBLIC_API_URL in a .env file (see https://docs.expo.dev/guides/environment-variables/).
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://jsonplaceholder.typicode.com';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the auth token (if any) at request time. Reading from the store
// lazily via getState() keeps this out of React's render cycle.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Central place to normalize errors / handle 401s.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().signOut();
    }
    return Promise.reject(error);
  },
);
