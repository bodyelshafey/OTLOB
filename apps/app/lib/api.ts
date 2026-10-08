import axios, { AxiosError, AxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "@/store/authStore";

// Resolution order:
//  1. EXPO_PUBLIC_API_URL — baked in at build time from a .env file or an
//     EAS "env" block for the build profile (preview/production). This is
//     the one that should point at Railway for real builds.
//  2. app.json's expo.extra.apiBaseUrl — legacy/static fallback.
//  3. A hardcoded LAN IP — only useful for Expo Go on the same local
//     network as the API during development; never reaches Railway.
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl ??
  "http://192.168.43.183:4000/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Retry once on 401 using the refresh token; force-logout on repeated failure.
// Mirrors the web app's lib/api.ts refresh flow.
let isRefreshing = false;
let pendingQueue: Array<(token: string | null) => void> = [];

function resolveQueue(token: string | null) {
  pendingQueue.forEach((cb) => cb(token));
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      const { refreshToken, setTokens, logout } = useAuthStore.getState();

      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        // Wait for the in-flight refresh to finish, then retry.
        return new Promise((resolve, reject) => {
          pendingQueue.push((token) => {
            if (!token) return reject(error);
            originalRequest.headers = {
              ...(originalRequest.headers ?? {}),
              Authorization: `Bearer ${token}`,
            };
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        setTokens(data.accessToken, data.refreshToken);
        resolveQueue(data.accessToken);
        originalRequest.headers = {
          ...(originalRequest.headers ?? {}),
          Authorization: `Bearer ${data.accessToken}`,
        };
        return api(originalRequest);
      } catch (refreshError) {
        resolveQueue(null);
        logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
