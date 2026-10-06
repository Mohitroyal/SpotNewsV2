import { supabase } from '@/lib/supabase';
import api from '@/lib/axios';
import type { AdminUserProfile } from './admin.service';

const mapUser = (user: any, profile?: any, generations = 0): AdminUserProfile => {
  const phone = user.phone_number || profile?.phone_number || '';
  const email = user.email || '';
  const lastSignIn = user.last_sign_in_at || profile?.last_sign_in_at;
  const isPhone = user.provider === 'phone' || email.endsWith('@phone.user') || (!email && !!phone);
  const loginTime = Date.parse(lastSignIn || '');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return { id: String(user.id), email, phone_number: phone,
    full_name: user.full_name || user.name || profile?.full_name || (isPhone ? `User (${phone})` : email.split('@')[0] || 'User'),
    role: user.role || profile?.role || 'user', plan: user.plan || profile?.plan || 'free',
    created_at: user.created_at || profile?.created_at || '', last_sign_in_at: lastSignIn,
    total_generations: user.total_generations ?? generations, generations_today: user.generations_today ?? 0,
    is_active_today: user.is_active_today ?? (user.generations_today > 0 || (loginTime >= today.getTime() && loginTime <= Date.now())),
    avatar_url: user.avatar_url || profile?.avatar_url || '', preferred_language: user.preferred_language || 'English',
    is_banned: Boolean(user.is_banned || profile?.is_banned || (user.banned_until && Date.parse(user.banned_until) > Date.now())),
    banned_until: user.banned_until || profile?.banned_until || null };
};

export const getAdminUsers = async (): Promise<AdminUserProfile[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  let accessToken = session?.access_token;
  
  for (const endpoint of ['/api/v1/admin/auth-users', '/api/v1/admin/users']) {

    do {
      try {
        const headers: any = {};
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        
        const { data } = await api.get(endpoint, { timeout: 60_000, headers }); 
        if (Array.isArray(data) && data.length > 0) return data.map((u: any) => mapUser(u)); 
        break; // Stop do-while if it succeeds but is empty, try next endpoint
      } catch (error: any) { 
        console.warn(`[AdminService] ${endpoint} unavailable; continuing with fallback`, error); 
        break;
      }
    } while (false);
  }

  const [{ data: users, error: usersError }, { data: profiles }, { data: clippings }] = await Promise.all([
    supabase.from('users').select('id, email, full_name, avatar_url, created_at, preferred_language, phone_number').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, role, plan, last_sign_in_at, is_banned, banned_until, phone_number'),
    supabase.from('clippings').select('user_id'),
  ]);
  if (usersError) throw usersError;
  const profileMap = new Map((profiles || []).map((p: any) => [String(p.id), p]));
  const counts = new Map<string, number>();
  (clippings || []).forEach((row: any) => row.user_id && counts.set(String(row.user_id), (counts.get(String(row.user_id)) || 0) + 1));
  return (users || []).map((u: any) => mapUser(u, profileMap.get(String(u.id)), counts.get(String(u.id)) || 0));
};
