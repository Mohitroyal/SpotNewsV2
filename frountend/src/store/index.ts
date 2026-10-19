import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, GenerationConfig, Generation } from "@/types";

// ─── Permanent Reporter Name & Photo Helpers ─────────────────────────────────────
// Clean up any stale legacy keys that leaked across different accounts
if (typeof window !== "undefined" && window.localStorage) {
  try {
    localStorage.removeItem("spotnews_last_reporter_name");
    localStorage.removeItem("spotnews_last_reporter_photo");
  } catch (e) {
    // ignore
  }
}

export const getReporterName = (email?: string): string => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "";
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail) {
        const name = localStorage.getItem(`spotnews_reporter_name_${cleanEmail}`);
        if (name) return name;
      }
    }
    const activeName = localStorage.getItem('spotnews_active_reporter_name');
    if (activeName) return activeName;
  } catch (e) {
    console.warn("[NameStore] Error reading reporter name:", e);
  }
  return "";
};

export const saveReporterName = (email: string | undefined, name: string): void => {
  try {
    if (!name || typeof window === "undefined" || !window.localStorage) return;
    const trimmed = name.trim();
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail) {
        localStorage.setItem(`spotnews_reporter_name_${cleanEmail}`, trimmed);
      }
    }
    localStorage.setItem('spotnews_active_reporter_name', trimmed);
  } catch (e) {
    console.warn("[NameStore] Error saving reporter name:", e);
  }
};

export const isGoogleDefaultAvatar = (url?: string): boolean => {
  if (!url) return false;
  return (
    url.includes('googleusercontent.com') ||
    url.includes('lh3.google') ||
    url.includes('google.com/accounts')
  );
};

export const getReporterPhoto = (email?: string): string => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "";
    
    // 1. Check permanent registration photo
    const regPhoto = localStorage.getItem('spotnews_registration_photo');
    if (regPhoto && !isGoogleDefaultAvatar(regPhoto)) return regPhoto;

    // 2. Check email-specific photo
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail) {
        const photo = localStorage.getItem(`spotnews_reporter_photo_${cleanEmail}`);
        if (photo && !isGoogleDefaultAvatar(photo)) return photo;
      }
    }

    // 3. Check active reporter photo
    const activePhoto = localStorage.getItem('spotnews_active_reporter_photo');
    if (activePhoto && !isGoogleDefaultAvatar(activePhoto)) return activePhoto;

    // Fallbacks if only Google avatar exists
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      const photo = localStorage.getItem(`spotnews_reporter_photo_${cleanEmail}`);
      if (photo) return photo;
    }
    if (activePhoto) return activePhoto;
  } catch (e) {
    console.warn("[PhotoStore] Error reading reporter photo:", e);
  }
  return "";
};

export const getEffectiveReporterPhoto = (
  preferredEmail?: string,
  extraCandidates: (string | undefined | null)[] = []
): string => {
  const candidates: string[] = [];

  for (const c of extraCandidates) {
    if (c && typeof c === 'string' && c.trim()) {
      candidates.push(c.trim());
    }
  }

  if (preferredEmail) {
    const p = getReporterPhoto(preferredEmail);
    if (p) candidates.push(p);
  }

  try {
    const reg = localStorage.getItem('spotnews_registration_photo');
    if (reg) candidates.push(reg);
    const active = localStorage.getItem('spotnews_active_reporter_photo');
    if (active) candidates.push(active);
  } catch {}

  // 1. Highest priority: real uploaded photo (e.g. data:image/ or non-Google URL)
  const realPhoto = candidates.find((url) => url && !isGoogleDefaultAvatar(url));
  if (realPhoto) return realPhoto;

  // 2. Fallback to any photo if no real photo exists
  const anyPhoto = candidates.find((url) => Boolean(url));
  return anyPhoto || '';
};

export const saveReporterPhoto = (email: string | undefined, photoUrl: string): void => {
  try {
    if (!photoUrl || typeof window === "undefined" || !window.localStorage) return;

    // Guard: never let a Google letter avatar overwrite an existing real uploaded photo
    const existing = getReporterPhoto(email);
    if (isGoogleDefaultAvatar(photoUrl) && existing && !isGoogleDefaultAvatar(existing)) {
      return;
    }

    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail) {
        localStorage.setItem(`spotnews_reporter_photo_${cleanEmail}`, photoUrl);
      }
    }

    if (!isGoogleDefaultAvatar(photoUrl) || !existing) {
      localStorage.setItem('spotnews_active_reporter_photo', photoUrl);
    }

    // If it's a real uploaded photo (base64 data URL), permanently preserve it as the registration photo!
    if (photoUrl.startsWith('data:image/')) {
      localStorage.setItem('spotnews_registration_photo', photoUrl);
    }
  } catch (e) {
    console.warn("[PhotoStore] Error saving reporter photo:", e);
  }
};

// ─── Auth Store ────────────────────────────────────────────────────────────────
interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  otpState?: { phoneNumber: string; reqId: string } | null;
  setOtpState: (state: { phoneNumber: string; reqId: string } | null) => void;
  district: string;
  setDistrict: (district: string) => void;
  userState: string;
  setUserState: (state: string) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => {
        const email = user?.email || (user as any)?.user_metadata?.email;
        const storedName = getReporterName(email);
        const storedPhoto = getReporterPhoto(email);

        const accountName =
          (user as any)?.user_metadata?.full_name ||
          (user as any)?.user_metadata?.name ||
          user?.full_name ||
          user?.firstName ||
          "";

        const existingName = accountName || storedName || "";

        const accountPhoto =
          user?.avatarUrl ||
          (user as any)?.user_metadata?.avatar_url ||
          (user as any)?.user_metadata?.picture ||
          "";

        const existingPhoto = getEffectiveReporterPhoto(email, [storedPhoto, accountPhoto]);

        const existingMetadata = (user as any)?.user_metadata || {};
        const updatedMetadata = {
          ...existingMetadata,
          ...(existingName ? { full_name: existingName, name: existingName } : {}),
          ...(existingPhoto ? { avatar_url: existingPhoto, picture: existingPhoto } : {}),
        };

        const enrichedUser: User = {
          ...user,
          full_name: existingName || user?.full_name || user?.firstName || "",
          firstName: existingName || user?.firstName || "",
          avatarUrl: existingPhoto || "",
          user_metadata: updatedMetadata,
          role:
            (user as any)?.email?.toLowerCase() === 'mohitroyal116@gmail.com' || (user as any)?.email?.toLowerCase() === 'mohithroyal116@gmail.com' ? 'reporter' :
            (user as any)?.role ||
            (user as any)?.user_metadata?.role ||
            (user as any)?.app_metadata?.role ||
            (isSuperAdminUser(user) ? 'admin' : 'user'),
          plan:
            user?.plan ||
            (user as any)?.subscription_plan ||
            ((user as any)?.role === 'admin' ? 'admin' : undefined) ||
            (isSuperAdminUser(user) ? 'admin' : 'free'),
        } as any;

        if (existingPhoto && email) {
          saveReporterPhoto(email, existingPhoto);
        }
        if (existingName && email) {
          saveReporterName(email, existingName);
        }

        set({ user: enrichedUser, token, isAuthenticated: true });
      },
      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
      updateUser: (partial) =>
        set((state) => {
          if (!state.user) return { user: null };
          const updatedUser: User = { ...state.user, ...partial };
          const email = (updatedUser.email || (updatedUser as any)?.user_metadata?.email || '').toLowerCase();
          
          if (email === 'mohitroyal116@gmail.com' || email === 'mohithroyal116@gmail.com') {
            updatedUser.role = 'reporter';
          } else if (isSuperAdminUser(updatedUser)) {
            updatedUser.role = 'admin';
          }

          const newName =
            partial.full_name ||
            partial.firstName ||
            (partial as any)?.user_metadata?.full_name ||
            (partial as any)?.user_metadata?.name;

          if (newName) {
            saveReporterName(email, newName);
          }
          if (partial.avatarUrl) {
            saveReporterPhoto(email, partial.avatarUrl);
          }

          // Ensure user_metadata is also kept in sync
          if (newName || partial.avatarUrl) {
            const currentMetadata = (updatedUser as any)?.user_metadata || {};
            (updatedUser as any).user_metadata = {
              ...currentMetadata,
              ...(newName ? { full_name: newName, name: newName } : {}),
              ...(partial.avatarUrl ? { avatar_url: partial.avatarUrl, picture: partial.avatarUrl } : {}),
            };
          }

          return { user: updatedUser };
        }),
      otpState: null,
      setOtpState: (otpState) => set({ otpState }),
      district: 'Hyderabad',
      setDistrict: (district) => set({ district }),
      userState: 'Telangana',
      setUserState: (userState) => set({ userState }),
    }),
    { name: "newscraft-auth" }
  )
);

// ─── Generation Store ──────────────────────────────────────────────────────────
interface GenerationStore {
  currentConfig: Partial<GenerationConfig>;
  generations: Generation[];
  isGenerating: boolean;
  setConfig: (partial: Partial<GenerationConfig>) => void;
  resetConfig: () => void;
  addGeneration: (generation: Generation) => void;
  updateGeneration: (id: string, partial: Partial<Generation>) => void;
  setGenerations: (generations: Generation[]) => void;
  setGenerating: (value: boolean) => void;
}

const defaultConfig: Partial<GenerationConfig> = {
  language: "en",
  tone: "formal",
  templateId: "rti_express",
  publicationName: "RTI Express",
  publicationDate: new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
  layoutColumns: 3,
  imageUrls: [],
  fontFamily: "playfair",
  layoutPattern: "A",
  borderColour: "#cc2222",
  headingBgColour: "#cc2222",
};

export const useGenerationStore = create<GenerationStore>()(
  persist(
    (set) => ({
      currentConfig: defaultConfig,
      generations: [],
      isGenerating: false,
      setConfig: (partial) =>
        set((state) => ({
          currentConfig: { ...state.currentConfig, ...partial },
        })),
      resetConfig: () => set({ currentConfig: defaultConfig }),
      addGeneration: (generation) =>
        set((state) => {
          // Strip base64 imageUrls to prevent localStorage QuotaExceededError
          const cleanGen = JSON.parse(JSON.stringify(generation));
          if (cleanGen?.config?.imageUrls) {
            cleanGen.config.imageUrls = [];
          }
          return { generations: [cleanGen, ...state.generations].slice(0, 50) };
        }),
      updateGeneration: (id, partial) =>
        set((state) => ({
          generations: state.generations.map((g) => {
            if (g.id === id) {
              const updated = { ...g, ...partial };
              if (updated?.config?.imageUrls) {
                updated.config.imageUrls = [];
              }
              return updated;
            }
            return g;
          }),
        })),
      setGenerations: (generations) => set({ generations: generations.slice(0, 50) }),
      setGenerating: (value) => set({ isGenerating: value }),
    }),
    { name: "newscraft-generations" }
  )
);

// ─── UI Store ─────────────────────────────────────────────────────────────────
interface UIStore {
  logoMode: boolean;
  sidebarOpen: boolean;
  language: string;
  showInnerBorders: boolean;
  isFullScreenFeed: boolean;
  toggleLogoMode: () => void;
  toggleInnerBorders: () => void;
  setLogoMode: (val: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setLanguage: (lang: string) => void;
  pendingCropImageSrc: string | null;
  setPendingCropImageSrc: (src: string | null) => void;
  setIsFullScreenFeed: (val: boolean) => void;
  toggleFullScreenFeed: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      logoMode: false,
      showInnerBorders: true,
      isFullScreenFeed: false,
      sidebarOpen: true,
      language: "en",
      toggleLogoMode: () =>
        set((state) => ({ logoMode: !state.logoMode })),
      toggleInnerBorders: () =>
        set((state) => ({ showInnerBorders: !(state.showInnerBorders ?? true) })),
      setLogoMode: (val) => set({ logoMode: val }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setLanguage: (lang) => set({ language: lang }),
      pendingCropImageSrc: null,
      setPendingCropImageSrc: (src) => set({ pendingCropImageSrc: src }),
      setIsFullScreenFeed: (val) => set({ isFullScreenFeed: val }),
      toggleFullScreenFeed: () => set((state) => ({ isFullScreenFeed: !state.isFullScreenFeed })),
    }),
    { name: "newscraft-ui" }
  )
);

// ─── Admin RBAC Helper ────────────────────────────────────────────────────────
export const SUPER_ADMIN_EMAILS = [
  'mohithroyal16450@gmail.com',
  'baba.journilist@gmail.com',
  'baba.journlist@gmail.com',
  'mahammadkousar2@gmail.com',
];

export const DISTRICT_ADMIN_EMAILS = [
  'mpokkala@gitam.in',
  'mpokkala@gmail.com',
];

export const SUPER_ADMIN_PHONES = [
  '9346843889',
  '7668886666',
];

export const SUPER_ADMIN_EMAIL = 'mohithroyal16450@gmail.com';

/**
 * Returns true if the user is a superadmin:
 * - Emails: in SUPER_ADMIN_EMAILS
 * - Phones: 9346843889 or 7668886666
 * - Role: 'superadmin'
 * Note: mpokkala@gitam.in is strictly district admin, not superadmin.
 */
export const isSuperAdminUser = (userOrEmail?: any): boolean => {
  if (!userOrEmail) return false;

  const email = (
    typeof userOrEmail === 'string'
      ? userOrEmail
      : userOrEmail?.email || userOrEmail?.user_metadata?.email || ''
  ).trim().toLowerCase();

  // mpokkala@gitam.in is strictly District Admin
  if (email === 'mpokkala@gitam.in') {
    return false;
  }

  // 1. Check superadmin emails list
  if (email && SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === email)) {
    return true;
  }

  // 2. Check role property if object
  if (typeof userOrEmail === 'object') {
    const role = (
      userOrEmail.role ||
      userOrEmail.user_metadata?.role ||
      userOrEmail.app_metadata?.role ||
      ''
    ).toString().toLowerCase();
    if (role === 'superadmin') {
      return true;
    }
  }

  // 3. Check phone number
  const phone = (
    typeof userOrEmail === 'string'
      ? userOrEmail
      : userOrEmail?.phone_number || userOrEmail?.phone || (userOrEmail as any)?.user_metadata?.phone || ''
  ).replace(/\D/g, '');

  if (phone && SUPER_ADMIN_PHONES.some((p) => phone.endsWith(p))) {
    return true;
  }

  if (email && SUPER_ADMIN_PHONES.some((p) => email.includes(p))) {
    return true;
  }

  return false;
};

/**
 * Returns true if the given user or email has admin privileges:
 * 1. Checks isSuperAdminUser (including superadmin phones)
 * 2. Checks hardcoded admin emails (SUPER_ADMIN_EMAILS + VITE_ADMIN_EMAILS env var)
 * 3. Checks role / metadata from Supabase Auth & profiles ('admin')
 * 4. Checks subscription plan ('admin')
 */
export const isAdminUser = (userOrEmail?: any): boolean => {
  if (!userOrEmail) return false;
  if (isSuperAdminUser(userOrEmail)) return true;

  const envAdminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  const adminEmails = Array.from(new Set([
    ...SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...DISTRICT_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...envAdminEmails,
  ]));

  if (typeof userOrEmail === 'string') {
    const cleanEmail = userOrEmail.trim().toLowerCase();
    return adminEmails.includes(cleanEmail);
  }

  // Object check
  const u = userOrEmail;
  const email = (u.email || u.user_metadata?.email || '').trim().toLowerCase();
  if (email && adminEmails.includes(email)) return true;

  const role = (
    u.role ||
    u.user_metadata?.role ||
    u.app_metadata?.role ||
    u.subscription_plan ||
    u.plan ||
    ''
  ).toString().toLowerCase();

  return role === 'admin';
};

