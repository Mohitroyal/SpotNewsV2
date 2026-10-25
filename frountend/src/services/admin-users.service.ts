import { supabase } from '@/lib/supabase';
import api from '@/lib/axios';
import { useAuthStore, isSuperAdminUser } from '@/store';
import type { AdminUserProfile } from './admin.service';

export const ADMIN_USERS_CACHE_KEY = 'spotnews_admin_users_cache';

export const getCachedAdminUsers = (): AdminUserProfile[] => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(ADMIN_USERS_CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {
    /* parse error */
  }
  return [];
};

const mapUser = (user: any, profile?: any, generations = 0): AdminUserProfile => {
  let phone = user.phone_number || profile?.phone_number || user.phone || profile?.phone || '';
  const email = user.email || profile?.email || '';
  if (!phone && email && email.endsWith('@phone.user')) {
    const raw = email.replace('@phone.user', '').replace(/\D/g, '');
    phone = raw.length === 12 && raw.startsWith('91') ? raw.slice(2) : raw;
  }
  const lastSignIn = user.last_sign_in_at || profile?.last_sign_in_at;
  const isPhone = user.provider === 'phone' || email.endsWith('@phone.user') || (!email && !!phone);
  const loginTime = Date.parse(lastSignIn || '');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return {
    id: String(user.id || profile?.id || ''),
    email,
    phone_number: phone,
    full_name: user.full_name || user.name || profile?.full_name || profile?.name || (isPhone ? `User (${phone})` : email.split('@')[0] || 'User'),
    role: user.role || profile?.role || 'user',
    plan: user.plan || profile?.plan || 'free',
    created_at: user.created_at || profile?.created_at || '',
    last_sign_in_at: lastSignIn,
    total_generations: user.total_generations ?? generations,
    generations_today: user.generations_today ?? 0,
    is_active_today: user.is_active_today ?? (user.generations_today > 0 || (loginTime >= today.getTime() && loginTime <= Date.now())),
    avatar_url: user.avatar_url || profile?.avatar_url || '',
    preferred_language: user.preferred_language || profile?.preferred_language || 'English',
    is_banned: Boolean(user.is_banned || profile?.is_banned || (user.banned_until && Date.parse(user.banned_until) > Date.now()) || (profile?.banned_until && Date.parse(profile.banned_until) > Date.now())),
    banned_until: user.banned_until || profile?.banned_until || null,
    district: user.district || profile?.district || '',
    state: user.state || profile?.state || '',
  };
};

const fetchBackendUsers = async (token: string | null): Promise<any[] | null> => {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  for (const endpoint of ['/api/v1/admin/auth-users', '/api/v1/admin/users']) {
    try {
      const res = await api.get(endpoint, { timeout: 2500, headers });
      const raw = res?.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.users)
          ? raw.users
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.results)
              ? raw.results
              : null;

      if (list && list.length > 0) {
        return list;
      }
    } catch {
      // Continue to next endpoint or fallback
    }
  }
  return null;
};

export const getAdminUsers = async (): Promise<AdminUserProfile[]> => {
  const authStoreToken = typeof window !== 'undefined' && useAuthStore?.getState ? useAuthStore.getState().token : null;
  const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const token = sessionData?.session?.access_token || authStoreToken;

  // ── Parallel Execution: Backend probe + Supabase client queries together ──
  const [backendRes, profilesRes, usersRes, appsRes, clipsRes] = await Promise.allSettled([
    fetchBackendUsers(token),
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('users').select('*').order('created_at', { ascending: false }),
    supabase.from('reporter_applications').select('*').order('created_at', { ascending: false }),
    supabase.from('clippings').select('*').order('created_at', { ascending: false }),
  ]);

  const userMap = new Map<string, AdminUserProfile>();

  // A. Backend users if available
  if (backendRes.status === 'fulfilled' && Array.isArray(backendRes.value) && backendRes.value.length > 0) {
    backendRes.value.forEach((u: any) => {
      if (!u) return;
      const key = String(u.id || u.email || u.phone_number);
      userMap.set(key, mapUser(u));
    });
  }

  // B. Merge from Supabase profiles table
  const profiles = profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value.data) ? profilesRes.value.data : [];
  profiles.forEach((p: any) => {
    if (!p) return;
    const key = String(p.id || p.email || p.phone_number);
    if (userMap.has(key)) {
      const existing = userMap.get(key)!;
      userMap.set(key, mapUser({ ...existing, ...p }, existing));
    } else {
      userMap.set(key, mapUser(p));
    }
  });

  // C. Merge users table if present
  const users = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value.data) ? usersRes.value.data : [];
  users.forEach((u: any) => {
    if (!u) return;
    const key = String(u.id || u.email || u.phone_number);
    if (userMap.has(key)) {
      const existing = userMap.get(key)!;
      userMap.set(key, mapUser({ ...existing, ...u }, existing));
    } else {
      userMap.set(key, mapUser(u));
    }
  });

  // D. Merge reporter applications
  const apps = appsRes.status === 'fulfilled' && Array.isArray(appsRes.value.data) ? appsRes.value.data : [];
  apps.forEach((app: any) => {
    if (!app) return;
    const emailKey = (app.email || '').trim().toLowerCase();
    const phoneKey = (app.phone || '').trim();

    let matchedKey = '';
    for (const [k, u] of userMap.entries()) {
      if ((emailKey && u.email?.toLowerCase() === emailKey) || (phoneKey && u.phone_number?.includes(phoneKey))) {
        matchedKey = k;
        break;
      }
    }

    const isApproved = app.status === 'approved' || app.status === 'active';
    if (matchedKey) {
      const existing = userMap.get(matchedKey)!;
      if (!existing.full_name || existing.full_name === 'User') existing.full_name = app.name;
      if (!existing.phone_number) existing.phone_number = app.phone;
      if (!existing.district) existing.district = app.district;
      if (!existing.state) existing.state = app.state;
      if (existing.role === 'user' && isApproved) existing.role = 'reporter';
    } else {
      const newKey = String(app.id || app.email || app.phone);
      userMap.set(newKey, {
        id: String(app.id),
        email: app.email || '',
        phone_number: app.phone || '',
        full_name: app.name || 'Reporter Applicant',
        role: isApproved ? 'reporter' : 'user',
        plan: isApproved ? 'reporter' : 'free',
        created_at: app.created_at || '',
        last_sign_in_at: undefined,
        total_generations: 0,
        generations_today: 0,
        is_active_today: false,
        avatar_url: '',
        preferred_language: 'Telugu',
        is_banned: app.status === 'rejected',
        banned_until: null,
        district: app.district || 'Hyderabad',
        state: app.state || 'Telangana',
      });
    }
  });

  // E. Merge clipping creators & calculate generations and live activity
  const todayStr = new Date().toISOString().slice(0, 10);
  const clips = clipsRes.status === 'fulfilled' && Array.isArray(clipsRes.value.data) ? clipsRes.value.data : [];
  clips.forEach((c: any) => {
    if (!c?.user_id) return;
    const uid = String(c.user_id);
    const isToday = c.created_at && String(c.created_at).startsWith(todayStr);

    let layout = c.custom_layout;
    if (typeof layout === 'string') {
      try { layout = JSON.parse(layout); } catch { layout = {}; }
    }
    layout = layout || {};

    const reporterName = layout.reporter_name || layout.reporterName || c.reporter_name || c.user_name || '';
    const avatar = layout.reporter_image || c.avatar_url || '';
    const userEmail = c.user_email || c.email || (uid.includes('@') ? uid : '');

    let targetUser = userMap.get(uid);
    if (!targetUser && userEmail) {
      targetUser = userMap.get(userEmail);
    }
    if (!targetUser) {
      for (const u of userMap.values()) {
        if (reporterName && u.full_name?.toLowerCase() === reporterName.toLowerCase()) {
          targetUser = u;
          break;
        }
      }
    }

    if (targetUser) {
      targetUser.total_generations = (targetUser.total_generations || 0) + 1;
      if (isToday) {
        targetUser.generations_today = (targetUser.generations_today || 0) + 1;
        targetUser.is_active_today = true;
      }
      if (reporterName && (!targetUser.full_name || targetUser.full_name.startsWith('Reporter') || targetUser.full_name === 'User')) {
        targetUser.full_name = reporterName;
      }
      if (avatar && !targetUser.avatar_url) {
        targetUser.avatar_url = avatar;
      }
      if (c.district && !targetUser.district) {
        targetUser.district = c.district;
      }
      if (targetUser.role === 'user') {
        targetUser.role = 'reporter';
      }
    } else {
      userMap.set(uid, {
        id: uid,
        email: userEmail,
        phone_number: c.phone || c.phone_number || '',
        full_name: reporterName || `Reporter ${uid.slice(0, 6)}`,
        role: 'reporter',
        plan: 'reporter',
        created_at: c.created_at || '',
        last_sign_in_at: c.created_at,
        total_generations: 1,
        generations_today: isToday ? 1 : 0,
        is_active_today: Boolean(isToday),
        avatar_url: avatar || '',
        preferred_language: 'Telugu',
        is_banned: false,
        banned_until: null,
        district: c.district || 'Hyderabad',
        state: c.state || 'Telangana',
      });
    }
  });

  // F. Ensure current logged-in admin user is ALWAYS present
  try {
    const currentUser = typeof window !== 'undefined' && useAuthStore?.getState ? useAuthStore.getState().user : null;
    if (currentUser) {
      const curEmail = (currentUser.email || (currentUser as any)?.user_metadata?.email || '').toLowerCase().trim();
      const curId = String(currentUser.id || '');
      let found = false;
      for (const u of userMap.values()) {
        if ((curId && u.id === curId) || (curEmail && u.email?.toLowerCase() === curEmail)) {
          found = true;
          if (currentUser.role === 'superadmin' || currentUser.role === 'admin') {
            u.role = currentUser.role;
            u.plan = currentUser.role;
          }
          break;
        }
      }
      if (!found && (curId || curEmail)) {
        const isSuper = (currentUser.role === 'superadmin') || isSuperAdminUser(currentUser) || isSuperAdminUser(curEmail);
        const assignedRole: 'superadmin' | 'admin' | 'reporter' | 'user' = isSuper ? 'superadmin' : ((currentUser.role === 'admin' || currentUser.role === 'reporter') ? currentUser.role : 'admin');
        userMap.set(curId || curEmail, {
          id: curId || 'current-admin',
          email: curEmail,
          phone_number: (currentUser as any)?.phone || (currentUser as any)?.phone_number || '',
          full_name: currentUser.full_name || currentUser.firstName || (curEmail ? curEmail.split('@')[0] : 'Administrator'),
          role: assignedRole,
          plan: isSuper ? 'superadmin' : 'admin',
          created_at: (currentUser as any)?.created_at || (currentUser as any)?.createdAt || new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          total_generations: 0,
          generations_today: 0,
          is_active_today: true,
          avatar_url: currentUser.avatarUrl || '',
          preferred_language: 'English',
          is_banned: false,
          banned_until: null,
          district: (currentUser as any).district || 'Hyderabad',
          state: (currentUser as any).state || 'Telangana',
        });
      }
    }
  } catch {
    /* silent */
  }

  // G. Ensure hardcoded Superadmins are present
  const superAdminList = [
    { email: 'mohithroyal16450@gmail.com', name: 'Mohith Royal', phone: '9346843889' },
    { email: 'baba.journlist@gmail.com', name: 'Baba Journalist', phone: '7668886666' },
    { email: 'baba.journilist@gmail.com', name: 'Baba Journalist', phone: '7668886666' },
  ];
  superAdminList.forEach((sa) => {
    let found = false;
    for (const u of userMap.values()) {
      const emailMatches = u.email && (u.email.toLowerCase() === sa.email.toLowerCase());
      const phoneDigits = (u.phone_number || '').replace(/\D/g, '');
      const emailDigits = (u.email || '').replace(/\D/g, '');
      const phoneMatches = Boolean(sa.phone && (phoneDigits.endsWith(sa.phone) || emailDigits.includes(sa.phone)));
      if (emailMatches || phoneMatches) {
        u.role = 'superadmin';
        if (!u.plan || u.plan === 'free') u.plan = 'pro';
        if (!u.phone_number && sa.phone) u.phone_number = `+91 ${sa.phone}`;
        found = true;
        break;
      }
    }
    if (!found) {
      userMap.set(sa.email, {
        id: 'superadmin-' + sa.phone,
        email: sa.email,
        phone_number: `+91 ${sa.phone}`,
        full_name: sa.name,
        role: 'superadmin',
        plan: 'pro',
        created_at: '2026-01-01T00:00:00Z',
        last_sign_in_at: new Date().toISOString(),
        total_generations: 0,
        generations_today: 0,
        is_active_today: true,
        avatar_url: '',
        preferred_language: 'Telugu',
        is_banned: false,
        banned_until: null,
        district: 'Hyderabad',
        state: 'Telangana',
      });
    }
  });

  const finalUsers = Array.from(userMap.values());

  // Save to cache for instant subsequent loads
  try {
    if (typeof window !== 'undefined' && window.localStorage && finalUsers.length > 0) {
      localStorage.setItem(ADMIN_USERS_CACHE_KEY, JSON.stringify(finalUsers));
    }
  } catch {
    /* ignore */
  }

  return finalUsers;
};
