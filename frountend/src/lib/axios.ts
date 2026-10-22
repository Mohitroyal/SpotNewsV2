import axios from "axios";
import { useAuthStore } from "@/store";
import { supabase } from "@/lib/supabase";

export const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : "https://news-backend-sjw6.onrender.com";

/**
 * Axios instance.
 *
 * ─── NO global timeout ───────────────────────────────────────────────────────
 * The clipping generation endpoint (/generate/) runs Playwright + Supabase
 * upload on a Render free instance and can legitimately take 2–5 minutes.
 * A 60 000 ms global timeout was the direct cause of:
 *   "Failed to generate clipping: timeout of 60000ms exceeded"
 *
 * Per-call timeouts are set explicitly in generation.service.ts:
 *   • generate()     → timeout: 0  (no limit — polling handles the 10-min guard)
 *   • polling calls  → timeout: 15_000  (15 s per poll attempt)
 *   • upload         → timeout: 120_000 (2 min for large images)
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  // timeout is intentionally omitted here — set per-request in the service layer
});

// ─── Request Interceptor — Attach JWT ─────────────────────────────────────────
api.interceptors.request.use((config) => {
  // If sending FormData, delete the default JSON Content-Type so the browser
  // can auto-set multipart/form-data with the correct boundary parameter.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("newscraft-auth");
    if (raw) {
      try {
        const { state } = JSON.parse(raw);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return config;
});

// Share one refresh across simultaneous dashboard requests. Never replace a
// mobile OTP login with a different, leftover Supabase session on the device.
let tokenRefresh: Promise<string | null> | null = null;
const recoverSessionToken = (): Promise<string | null> => {
  if (!tokenRefresh) {
    tokenRefresh = (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;

      const userId = useAuthStore.getState().user?.id;
      if (userId && data.session.user.id !== userId) return null;

      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (error || !refreshed.session) return null;

      if (userId && refreshed.session.user.id !== userId) return null;

      const token = refreshed.session.access_token;
      useAuthStore.setState({ token });
      return token;
    })().catch(() => null).finally(() => { tokenRefresh = null; });
  }
  return tokenRefresh;
};

// ─── Response Interceptor — Handle 401 ───────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    const isAdminApi = originalRequest?.url?.includes('/admin/');

    // Prevent retry loops
    if (error.response?.status === 401 && originalRequest?._retry) {
      if (!isAdminRoute && !isAdminApi) {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const token = await recoverSessionToken();
      if (token) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }

      if (!isAdminRoute && !isAdminApi) {
        // If token recovery fails completely, log the user out
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        useAuthStore.getState().logout();

        const isPolling = typeof window !== 'undefined' && window.location.pathname.startsWith('/preview');

        if (!isPolling && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
