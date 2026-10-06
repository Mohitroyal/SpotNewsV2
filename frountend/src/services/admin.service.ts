import { supabase } from '@/lib/supabase';
import api from '@/lib/axios';
import { generationService } from '@/services/generation.service';
import rtiExpressLogo from '@/assets/rti_express_logo.png';
import recoveredLogo from '@/assets/recovered_logo.png';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface AdminUserProfile {
  id: string;
  email: string;
  phone_number?: string;
  full_name: string;
  role: 'superadmin' | 'admin' | 'reporter' | 'user';
  plan: string;
  created_at: string;
  last_sign_in_at?: string;
  total_generations: number;
  generations_today?: number;
  is_active_today?: boolean;
  avatar_url?: string;
  preferred_language?: string;
  is_banned?: boolean;
  banned_until?: string | null;
}

export interface PublicationLogo {
  id: string;
  name: string;
  logo_url: string;
  publication_code: string;
  is_active: boolean;
  created_at: string;
}

export const LOCAL_LOGOS_KEY = 'spotnews_admin_publication_logos';

export const DEFAULT_PUBLICATION_LOGOS: PublicationLogo[] = [
  {
    id: 'pub_spot_news_24x7',
    name: 'Spot News 24x7',
    logo_url: recoveredLogo,
    publication_code: 'spot_news_24x7',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pub_rti_express',
    name: 'RTI Express',
    logo_url: rtiExpressLogo,
    publication_code: 'rti_express',
    is_active: true,
    created_at: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'pub_bharath_reporter',
    name: 'Bharath Reporter',
    logo_url: rtiExpressLogo,
    publication_code: 'bharath_reporter',
    is_active: true,
    created_at: '2026-01-03T00:00:00.000Z',
  },
  {
    id: 'pub_national_news',
    name: 'National News 24x7',
    logo_url: recoveredLogo,
    publication_code: 'national_news',
    is_active: true,
    created_at: '2026-01-04T00:00:00.000Z',
  },
];

export interface AdminStats {
  totalUsers: number;
  totalGenerationsToday: number;
  totalGenerationsAllTime: number;
  activeUsersToday: number;
  totalLogos: number;
  rangeGenerations?: number | null;
  rangeActiveUsers?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
  debug_info?: string;
}

export interface AdminClippingLog {
  id: string;
  status: string;
  created_at: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_plan: string;
  headline: string;
  template_id: string;
  language: string;
  tone: string;
  publication_name: string;
  publication_date?: string;
  layout_columns?: number;
  font_family?: string;
  image_count?: number;
  png_url?: string;
  pdf_url?: string;
}

// ─── Role Check ───────────────────────────────────────────────────────────────
export const getUserRole = async (userId: string): Promise<string | null> => {
  try {
    // Check profiles table first (has role column)
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (!error && data?.role) return data.role;

    // Fallback: check users table
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();
    return userData ? 'user' : null;
  } catch {
    return null;
  }
};

// ─── Stats ────────────────────────────────────────────────────────────────────
export const getAdminStats = async (fromDate?: string, toDate?: string): Promise<AdminStats> => {
  const params: Record<string, string> = {};
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;

  // 1. Try Backend API first for full database accurate stats
  try {
    const res = await api.get('/api/v1/admin/stats', { params });
    if (res.data && typeof res.data.totalUsers === 'number' && res.data.totalUsers >= 0) {
      const logos = await getPublicationLogos();
      return {
        totalUsers: res.data.totalUsers,
        totalGenerationsToday: res.data.totalGenerationsToday ?? 0,
        totalGenerationsAllTime: res.data.totalGenerationsAllTime ?? 0,
        activeUsersToday: res.data.activeUsersToday ?? 0,
        totalLogos: logos.length,
        rangeGenerations: res.data.rangeGenerations ?? null,
        rangeActiveUsers: res.data.rangeActiveUsers ?? null,
        fromDate: res.data.fromDate ?? fromDate ?? null,
        toDate: res.data.toDate ?? toDate ?? null,
      };
    }
  } catch (err) {
    console.warn('[AdminService] Backend stats endpoint unavailable, falling back to Supabase client query:', err);
  }

  // 2. Fallback: Supabase Client Query using RPC to bypass RLS
  try {
    const { data, error } = await supabase.rpc('get_admin_stats');
    const fallbackLogos = await getPublicationLogos();
    
    if (data && !error) {
      return {
        totalUsers: data.totalUsers ?? 0,
        totalGenerationsAllTime: data.totalGenerationsAllTime ?? 0,
        totalGenerationsToday: data.totalGenerationsToday ?? 0,
        activeUsersToday: data.activeUsersToday ?? 0,
        totalLogos: fallbackLogos.length,
        rangeGenerations: null,
        rangeActiveUsers: null,
        fromDate: fromDate ?? null,
        toDate: toDate ?? null,
        debug_info: 'Supabase RPC Fallback (Bypassed RLS)'
      };
    }
    
    // If RPC is missing, return 0s as absolute fallback
    return {
      totalUsers: 0,
      totalGenerationsToday: 0,
      totalGenerationsAllTime: 0,
      activeUsersToday: 0,
      totalLogos: fallbackLogos.length,
      rangeGenerations: null,
      rangeActiveUsers: null,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
      debug_info: 'RPC fallback failed: ' + (error?.message || 'No data'),
    };
  } catch (err: any) {
    return {
      totalUsers: 0,
      totalGenerationsToday: 0,
      totalGenerationsAllTime: 0,
      activeUsersToday: 0,
      totalLogos: 0,
      rangeGenerations: null,
      rangeActiveUsers: null,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
      debug_info: 'CATCH: ' + String(err?.message || err),
    };
  }
};

// ─── Generations / Clippings by Date ──────────────────────────────────────────
export const getAdminClippings = async (options?: {
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  userId?: string;
}): Promise<{ total: number; results: AdminClippingLog[] }> => {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const params: Record<string, any> = { page, page_size: pageSize };
  if (options?.fromDate) params.from_date = options.fromDate;
  if (options?.toDate) params.to_date = options.toDate;
  if (options?.userId) params.user_id = options.userId;

  // 1. Try Backend API first
  try {
    const res = await api.get('/api/v1/admin/generations', { params });
    if (res.data && Array.isArray(res.data.results)) {
      return {
        total: res.data.total ?? res.data.results.length,
        results: res.data.results,
      };
    }
  } catch (err) {
    console.warn('[AdminService] Backend generations endpoint unavailable, falling back to Supabase client query:', err);
  }

  // 2. Fallback: Supabase Client Query
  try {
    let query = supabase
      .from('clippings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options?.fromDate) {
      const s = new Date(`${options.fromDate}T00:00:00+05:30`);
      query = query.gte('created_at', s.toISOString());
    }
    if (options?.toDate) {
      const e = new Date(`${options.toDate}T23:59:59+05:30`);
      query = query.lte('created_at', e.toISOString());
    }
    if (options?.userId) {
      query = query.eq('user_id', options.userId);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: clippings, count, error } = await query;
    if (error || !clippings) {
      return { total: 0, results: [] };
    }

    // Fetch user profiles to enrich each clipping with name/email
    const userIds = Array.from(new Set(clippings.map((c: any) => c.user_id).filter(Boolean)));
    const profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, plan')
        .in('id', userIds);
      (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    const results: AdminClippingLog[] = clippings.map((c: any) => {
      const prof = profileMap[c.user_id];
      return {
        id: c.id,
        status: c.status || 'completed',
        created_at: c.created_at || '',
        user_id: c.user_id || '',
        user_email: prof?.email || '',
        user_name: prof?.full_name || prof?.email?.split('@')[0] || 'User',
        user_plan: prof?.plan || 'free',
        headline: c.headline || 'Untitled Clipping',
        template_id: c.template_id || 'default',
        language: c.language || 'en',
        tone: c.tone || 'formal',
        publication_name: c.publication_name || '',
        publication_date: c.publication_date || '',
        layout_columns: c.layout_columns ?? 3,
        font_family: c.font_family || 'playfair',
        image_count: Array.isArray(c.image_urls) ? c.image_urls.length : c.image_url ? 1 : 0,
        png_url: c.png_url || '',
        pdf_url: c.pdf_url || '',
      };
    });

    return {
      total: count ?? results.length,
      results,
    };
  } catch (err) {
    console.error('[AdminService] Supabase fallback generations query error:', err);
    return { total: 0, results: [] };
  }
};

// ─── Users ────────────────────────────────────────────────────────────────────
export { getAdminUsers } from './admin-users.service';

// ─── Edit User Role / Plan ────────────────────────────────────────────────────
export const updateUserRole = async (
  userId: string,
  role: 'superadmin' | 'admin' | 'reporter' | 'user',
  phoneNumber?: string,
  plan?: string
): Promise<{ success: boolean; error?: string }> => {
  const targetPlan = plan || (role === 'superadmin' ? 'superadmin' : (role === 'admin' ? 'admin' : (role === 'reporter' ? 'reporter' : 'free')));

  // 1. Primary: Use Backend API (runs with service_role key, safely bypassing RLS)
  try {
    const payload: any = { role, plan: targetPlan };
    if (phoneNumber && phoneNumber.trim()) {
      payload.phone_number = phoneNumber.trim();
    }
    const res = await api.put(`/api/v1/admin/users/${userId}/role`, payload);
    if (res.status >= 200 && res.status < 300) {
      // Force-refresh the Supabase session so the promoted user's JWT picks
      // up the new app_metadata.role immediately — no sign-out/in needed.
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.id === userId) {
          await supabase.auth.refreshSession();
        }
      } catch {
        /* non-critical — session refresh failure doesn't block the update */
      }
      return { success: true };
    }
  } catch (backendErr: any) {
    console.warn('[AdminService] Backend role update error:', backendErr?.response?.data || backendErr?.message);
    const detail = backendErr?.response?.data?.detail;
    if (detail) {
      return { success: false, error: detail };
    }
  }

  // 2. Fallback: direct Supabase upsert (may fail if RLS does not allow public update)
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, role, plan: targetPlan }, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    // Force-refresh the Supabase session for the promoted user
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id === userId) {
        await supabase.auth.refreshSession();
      }
    } catch { /* non-critical */ }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to update role' };
  }
};

export const updateUserPlan = async (
  userId: string,
  plan: string
): Promise<{ success: boolean; error?: string }> => {
  // 1. Primary: Use Backend API (runs with service_role key, safely bypassing RLS)
  try {
    const res = await api.put(`/api/v1/admin/users/${userId}/plan`, { plan });
    if (res.status >= 200 && res.status < 300) {
      return { success: true };
    }
  } catch (backendErr: any) {
    console.warn('[AdminService] Backend plan update error:', backendErr?.response?.data || backendErr?.message);
    const detail = backendErr?.response?.data?.detail;
    if (detail) {
      return { success: false, error: detail };
    }
  }

  // 2. Fallback: direct Supabase upsert
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, plan }, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to update plan' };
  }
};

// ─── Ban / Block User ─────────────────────────────────────────────────────────
export const banUser = async (
  userId: string,
  duration: string = '876600h'
): Promise<{ success: boolean; error?: string }> => {
  // 1. Primary: Use Backend API
  try {
    const res = await api.post(`/api/v1/admin/users/${userId}/ban`, { duration });
    if (res.status >= 200 && res.status < 300) {
      return { success: true };
    }
  } catch (backendErr: any) {
    console.warn('[AdminService] Backend ban error:', backendErr?.response?.data || backendErr?.message);
    const detail = backendErr?.response?.data?.detail;
    if (detail) return { success: false, error: detail };
  }

  // 2. Fallback: Supabase direct profile update
  try {
    const isUnban = duration.toLowerCase() === 'none';
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, is_banned: !isUnban }, { onConflict: 'id' });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to update user block status' };
  }
};

// ─── Delete / Remove User ──────────────────────────────────────────────────────
export const deleteUser = async (
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  // 1. Primary: Use Backend API (removes from auth + local DB safely)
  try {
    const res = await api.delete(`/api/v1/admin/users/${userId}`);
    if (res.status >= 200 && res.status < 300) {
      return { success: true };
    }
  } catch (backendErr: any) {
    console.warn('[AdminService] Backend delete user error:', backendErr?.response?.data || backendErr?.message);
    const detail = backendErr?.response?.data?.detail;
    if (detail) return { success: false, error: detail };
  }

  // 2. Fallback: Supabase direct profiles deletion
  try {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to delete user' };
  }
};

// Helper to ensure logos always have an image asset even if URL is empty in database
const enrichLogoWithAsset = (logo: any): PublicationLogo => {
  const code = (logo.publication_code || '').toLowerCase();
  let fallbackUrl = recoveredLogo;
  if (code.includes('rti') || code.includes('bharath')) {
    fallbackUrl = rtiExpressLogo;
  }
  return {
    id: String(logo.id || `pub_${code}`),
    name: logo.name || 'Publication',
    publication_code: code,
    logo_url: logo.logo_url || fallbackUrl,
    is_active: logo.is_active !== false,
    created_at: logo.created_at || new Date().toISOString(),
  };
};

// ─── Publication Logos ────────────────────────────────────────────────────────
export const getPublicationLogos = async (): Promise<PublicationLogo[]> => {
  // 1. Try Backend Admin API first (reliable, bypasses RLS, auto-seeds)
  try {
    const res = await api.get('/api/v1/admin/logos');
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      const enriched = res.data.map(enrichLogoWithAsset);
      try {
        localStorage.setItem(LOCAL_LOGOS_KEY, JSON.stringify(enriched));
      } catch { /* silent */ }
      return enriched;
    }
  } catch (err) {
    console.warn('[AdminService] Backend /admin/logos unavailable, trying Supabase / local:', err);
  }

  // 2. Try Supabase publication_logos table
  try {
    const { data, error } = await supabase
      .from('publication_logos')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map(enrichLogoWithAsset);
    }
  } catch {
    /* fallback to local */
  }

  // 3. Try localStorage custom logos
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(LOCAL_LOGOS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(enrichLogoWithAsset);
        }
      }
    }
  } catch {
    /* parse error */
  }

  // 4. Fallback to default publication brand logos
  return DEFAULT_PUBLICATION_LOGOS;
};

export const getActivePublicationLogos = async (): Promise<PublicationLogo[]> => {
  // 1. Try Backend active logos endpoint (public, unauthenticated/authenticated)
  try {
    const res = await api.get('/api/v1/admin/logos/active');
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data.map(enrichLogoWithAsset);
    }
  } catch (err) {
    console.warn('[AdminService] Backend /admin/logos/active unavailable:', err);
  }

  // 2. Fallback: fetch all and filter by is_active !== false
  const all = await getPublicationLogos();
  return all.filter((l) => l.is_active !== false);
};

export const addPublicationLogo = async (
  name: string,
  logo_url: string,
  publication_code: string
): Promise<{ success: boolean; error?: string }> => {
  const cleanCode = publication_code.trim().toLowerCase().replace(/\s+/g, '_');
  const cleanName = name.trim();
  const cleanUrl = logo_url.trim();

  const newLogo: PublicationLogo = {
    id: `logo_${Date.now()}`,
    name: cleanName,
    logo_url: cleanUrl || recoveredLogo,
    publication_code: cleanCode,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  // Update local storage optimistically
  try {
    const current = await getPublicationLogos();
    const updated = [newLogo, ...current.filter((l) => l.publication_code !== cleanCode)];
    localStorage.setItem(LOCAL_LOGOS_KEY, JSON.stringify(updated));
  } catch {
    /* local error */
  }

  // 1. Try Backend API first
  try {
    await api.post('/api/v1/admin/logos', {
      name: cleanName,
      publication_code: cleanCode,
      logo_url: cleanUrl,
      is_active: true,
    });
    return { success: true };
  } catch (err) {
    console.warn('[addPublicationLogo] Backend API error, attempting Supabase insert:', err);
  }

  // 2. Attempt Supabase insert
  try {
    const { error } = await supabase.from('publication_logos').insert([
      {
        name: cleanName,
        logo_url: cleanUrl,
        publication_code: cleanCode,
        is_active: true,
      },
    ]);
    if (error) {
      console.warn('[addPublicationLogo] Supabase insert warning (saved locally):', error.message);
    }
  } catch {
    /* silent */
  }

  return { success: true };
};

export const updatePublicationLogo = async (
  id: string,
  updates: {
    name?: string;
    logo_url?: string;
    publication_code?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; error?: string }> => {
  // Update local storage
  try {
    const current = await getPublicationLogos();
    const updated = current.map((l) => {
      if (l.id === id || l.publication_code === id) {
        return {
          ...l,
          ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
          ...(updates.logo_url !== undefined ? { logo_url: updates.logo_url.trim() } : {}),
          ...(updates.publication_code !== undefined ? { publication_code: updates.publication_code.trim().toLowerCase().replace(/\s+/g, '_') } : {}),
          ...(updates.is_active !== undefined ? { is_active: updates.is_active } : {}),
        };
      }
      return l;
    });
    localStorage.setItem(LOCAL_LOGOS_KEY, JSON.stringify(updated));
  } catch {
    /* local error */
  }

  // 1. Try Backend API first
  try {
    await api.put(`/api/v1/admin/logos/${encodeURIComponent(id)}`, updates);
    return { success: true };
  } catch (err) {
    console.warn('[updatePublicationLogo] Backend API error, attempting direct Supabase:', err);
  }

  // 2. Direct Supabase update fallback
  try {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.logo_url !== undefined) payload.logo_url = updates.logo_url.trim();
    if (updates.publication_code !== undefined) {
      payload.publication_code = updates.publication_code.trim().toLowerCase().replace(/\s+/g, '_');
    }
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;

    await supabase
      .from('publication_logos')
      .update(payload)
      .eq('id', id);
  } catch {
    /* silent */
  }

  return { success: true };
};

export const uploadLogoImage = async (file: File): Promise<{ url?: string; error?: string }> => {
  try {
    const res = await generationService.uploadImage(file);
    if (res.success && res.data?.url) {
      return { url: res.data.url };
    }
    if (!res.success && res.message) {
      return { error: res.message };
    }
  } catch (err: any) {
    console.warn('[uploadLogoImage] generationService upload failed, trying Supabase fallback:', err);
  }

  // Fallback to direct Supabase storage upload if backend endpoint fails
  try {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `publication_logos/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from('newscraft-clippings')
      .upload(fileName, file, { upsert: true });

    if (!uploadError) {
      const { data: pubData } = supabase.storage
        .from('newscraft-clippings')
        .getPublicUrl(fileName);
      if (pubData?.publicUrl) {
        return { url: pubData.publicUrl };
      }
    } else {
      console.warn('[uploadLogoImage] Supabase upload error:', uploadError.message);
    }
  } catch (err: any) {
    console.warn('[uploadLogoImage] Supabase fallback error:', err);
  }

  return { error: 'Failed to upload logo image. Please try again.' };
};

export const toggleLogoActive = async (
  id: string,
  is_active: boolean
): Promise<{ success: boolean }> => {
  // 1. Update local storage immediately for fast responsive UI
  try {
    const current = await getPublicationLogos();
    const updated = current.map((l) => (l.id === id || l.publication_code === id ? { ...l, is_active } : l));
    localStorage.setItem(LOCAL_LOGOS_KEY, JSON.stringify(updated));
  } catch {
    /* silent */
  }

  // 2. Call backend Admin API (uses service role key to bypass RLS and persist to database)
  try {
    await api.put(`/api/v1/admin/logos/${encodeURIComponent(id)}`, { is_active });
    return { success: true };
  } catch (err) {
    console.warn('[toggleLogoActive] Backend API error, attempting direct Supabase:', err);
  }

  // 3. Direct Supabase fallback
  try {
    await supabase
      .from('publication_logos')
      .update({ is_active })
      .eq('id', id);
  } catch {
    /* silent */
  }

  return { success: true };
};

export const removePublicationLogo = async (id: string): Promise<{ success: boolean }> => {
  // 1. Update local storage
  try {
    const current = await getPublicationLogos();
    const updated = current.filter((l) => l.id !== id && l.publication_code !== id);
    localStorage.setItem(LOCAL_LOGOS_KEY, JSON.stringify(updated));
  } catch {
    /* silent */
  }

  // 2. Try Backend API
  try {
    await api.delete(`/api/v1/admin/logos/${encodeURIComponent(id)}`);
    return { success: true };
  } catch (err) {
    console.warn('[removePublicationLogo] Backend API error, attempting Supabase delete:', err);
  }

  // 3. Fallback Supabase
  try {
    await supabase.from('publication_logos').delete().eq('id', id);
  } catch {
    /* silent */
  }

  return { success: true };
};

// ─── Activity Logger ──────────────────────────────────────────────────────────
export const logUserActivity = async (
  userId: string,
  email: string,
  name: string,
  action: 'login' | 'generate' | 'export'
): Promise<void> => {
  try {
    await supabase.from('user_activity').insert([
      { user_id: userId, user_email: email, user_name: name, action },
    ]);
  } catch {
    /* silent */
  }
};
