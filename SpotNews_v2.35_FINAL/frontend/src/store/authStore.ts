import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  mobile: string | null;
  token: string | null;
  userRole: string | null;
  setMobile: (mobile: string) => void;
  setAuth: (token: string, userRole: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      mobile: null,
      token: null,
      userRole: null,
      setMobile: (mobile) => set({ mobile }),
      setAuth: (token, userRole) => set({ token, userRole }),
      logout: () => set({ mobile: null, token: null, userRole: null }),
    }),
    { name: 'auth-storage' }
  )
);
