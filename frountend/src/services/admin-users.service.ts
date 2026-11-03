import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store';
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
  const phone = user?.phone_number || profile?.phone_number || user?.phone || profile?.phone || '';
  const email = (user?.email || profile?.email || '').trim();
  const lastSignIn = user?.last_sign_in_at || profile?.last_sign_in_at;
  const isPhone = user?.provider === 'phone' || email.endsWith('@phone.user') || (!email && !!phone);
  const loginTime = Date.parse(lastSignIn || '');
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const rawRole = (user?.role || profile?.role || (user?.is_admin ? 'admin' : 'user')).toLowerCase();
  const normalizedRole: 'superadmin' | 'admin' | 'reporter' | 'user' =
    rawRole === 'superadmin' || email === 'mohithroyal16450@gmail.com' || email === 'baba.journilist@gmail.com'
      ? 'superadmin'
      : rawRole === 'admin'
      ? 'admin'
      : rawRole === 'reporter'
      ? 'reporter'
      : 'user';

  const rawPlan = (user?.plan || profile?.plan || user?.subscription_plan || 'free').toLowerCase();
  const normalizedPlan: 'superadmin' | 'admin' | 'pro' | 'free' =
    normalizedRole === 'superadmin'
      ? 'superadmin'
      : normalizedRole === 'admin'
      ? 'admin'
      : rawPlan === 'pro'
      ? 'pro'
      : 'free';

  return {
    id: String(user?.id || profile?.id || ''),
    email,
    phone_number: phone,
    full_name:
      user?.full_name ||
      user?.name ||
      profile?.full_name ||
      profile?.name ||
      (isPhone ? `User (${phone})` : email.split('@')[0] || 'User'),
    role: normalizedRole,
    plan: normalizedPlan,
    created_at: user?.created_at || profile?.created_at || '',
    last_sign_in_at: lastSignIn,
    total_generations: user?.total_generations ?? generations,
    generations_today: user?.generations_today ?? 0,
    is_active_today:
      Boolean(user?.is_active_today) ||
      (user?.generations_today > 0) ||
      (loginTime >= today.getTime() && loginTime <= Date.now()),
    avatar_url: user?.avatar_url || profile?.avatar_url || '',
    preferred_language: user?.preferred_language || profile?.preferred_language || 'English',
    is_banned: Boolean(user?.is_banned || profile?.is_banned),
    banned_until: user?.banned_until || profile?.banned_until || null,
    district: user?.district || profile?.district || '',
    state: user?.state || profile?.state || '',
  };
};

export const getAdminUsers = async (): Promise<AdminUserProfile[]> => {
  const userMap = new Map<string, AdminUserProfile>();

  // 1. Preload any cached users immediately for instant UI render
  const cached = getCachedAdminUsers();
  cached.forEach((u) => {
    if (u?.id || u?.email) {
      userMap.set(String(u.id || u.email), u);
    }
  });

  // 2. PRIMARY: Direct Supabase Fetch (100% reliable, completes in <1s)
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [profilesRes, usersRes, appsRes, clipsRes] = await Promise.allSettled([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('users').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('reporter_applications').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('clippings').select('user_id, created_at').limit(1000),
    ]);

    // Build clipping counts map
    const totalClipsMap: Record<string, number> = {};
    const todayClipsMap: Record<string, number> = {};
    if (clipsRes.status === 'fulfilled' && Array.isArray(clipsRes.value.data)) {
      clipsRes.value.data.forEach((c: any) => {
        if (!c?.user_id) return;
        totalClipsMap[c.user_id] = (totalClipsMap[c.user_id] || 0) + 1;
        if (c.created_at && c.created_at.startsWith(todayStr)) {
          todayClipsMap[c.user_id] = (todayClipsMap[c.user_id] || 0) + 1;
        }
      });
    }

    // Process profiles
    if (profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value.data)) {
      profilesRes.value.data.forEach((p: any) => {
        if (!p?.id && !p?.email) return;
        const totalGen = totalClipsMap[p.id] || 0;
        const todayGen = todayClipsMap[p.id] || 0;
        const mapped = mapUser(p, undefined, totalGen);
        mapped.generations_today = todayGen;
        if (todayGen > 0) mapped.is_active_today = true;
        userMap.set(String(p.id || p.email), mapped);
      });
    }

    // Process users table (enrich existing, add missing)
    if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value.data)) {
      usersRes.value.data.forEach((u: any) => {
        if (!u?.id && !u?.email) return;
        const key = String(u.id || u.supabase_id || u.email);
        if (userMap.has(key)) {
          const existing = userMap.get(key)!;
          if (!existing.phone_number && u.phone_number) existing.phone_number = u.phone_number;
          if ((!existing.full_name || existing.full_name === 'User') && u.full_name) existing.full_name = u.full_name;
        } else {
          const totalGen = totalClipsMap[u.id] || 0;
          const todayGen = todayClipsMap[u.id] || 0;
          const mapped = mapUser(u, undefined, totalGen);
          mapped.generations_today = todayGen;
          if (todayGen > 0) mapped.is_active_today = true;
          userMap.set(key, mapped);
        }
      });
    }

    // Enrich from reporter applications (district, phone)
    if (appsRes.status === 'fulfilled' && Array.isArray(appsRes.value.data)) {
      appsRes.value.data.forEach((app: any) => {
        if (!app) return;
        const emailKey = (app.email || '').trim().toLowerCase();
        for (const u of userMap.values()) {
          if (emailKey && u.email?.toLowerCase() === emailKey) {
            if (!u.district && app.district) u.district = app.district;
            if (!u.phone_number && app.phone) u.phone_number = app.phone;
            break;
          }
        }
      });
    }
  } catch (sbErr) {
    console.warn('[AdminUsers] Supabase query warning:', sbErr);
  }

  // 3. SECONDARY: Optionally background-sync Django Backend (never block the UI)
  try {
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), 1200);
    fetch('https://spotnewsv2.onrender.com/api/v1/admin/auth-users', {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        clearTimeout(abortTimeout);
        const rawList = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : null);
        if (rawList && rawList.length > 0) {
          rawList.forEach((u: any) => {
            if (!u) return;
            const mapped = mapUser(u);
            const key = String(u.id || u.email || mapped.email);
            if (userMap.has(key)) {
              const existing = userMap.get(key)!;
              if (u.total_generations !== undefined) existing.total_generations = u.total_generations;
              if (u.generations_today !== undefined) existing.generations_today = u.generations_today;
            }
          });
        }
      })
      .catch(() => {
        clearTimeout(abortTimeout);
      });
  } catch {
    /* non-blocking background fetch */
  }

  // 4. Ensure current logged-in user is ALWAYS present
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
        const isSuper = (currentUser.role === 'superadmin') || (curEmail === 'mohithroyal16450@gmail.com') || (curEmail === 'baba.journilist@gmail.com');
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

  // 5. Ensure hardcoded Superadmins are present
  const superAdminList = [
    { email: 'mohithroyal16450@gmail.com', name: 'Mohith Royal', phone: '9346843889' },
    { email: 'baba.journilist@gmail.com', name: 'Baba Journalist', phone: '7668886666' },
    { email: 'mahammadkousar2@gmail.com', name: 'Mahammad Kousar', phone: '' },
    { email: 'mahammadkousar2006@gmail.com', name: 'Mahammad 2006', phone: '' },
  ];
  superAdminList.forEach((sa) => {
    let found = false;
    for (const u of userMap.values()) {
      if (u.email?.toLowerCase() === sa.email.toLowerCase()) {
        if (sa.email === 'mahammadkousar2@gmail.com') {
          u.role = 'superadmin';
          u.plan = 'superadmin';
        } else if (sa.email === 'mahammadkousar2006@gmail.com') {
          u.role = 'admin';
          u.plan = 'admin';
        } else {
          u.role = 'superadmin';
          u.plan = 'superadmin';
        }
        found = true;
        break;
      }
    }
    if (!found) {
      userMap.set(sa.email, {
        id: 'user-' + sa.email,
        email: sa.email,
        phone_number: sa.phone,
        full_name: sa.name,
        role: sa.email === 'mahammadkousar2006@gmail.com' ? 'admin' : 'superadmin',
        plan: sa.email === 'mahammadkousar2006@gmail.com' ? 'admin' : 'superadmin',
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

  // 6. Save to local storage for instant loading on any next screen visit
  try {
    if (typeof window !== 'undefined' && window.localStorage && finalUsers.length > 0) {
      localStorage.setItem(ADMIN_USERS_CACHE_KEY, JSON.stringify(finalUsers));
    }
  } catch {
    /* silent */
  }

  return finalUsers;
};
