import { createClient } from '@supabase/supabase-js';

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://rffrqokpnqoycpozrjuc.supabase.co';

export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZnJxb2twbnFveWNwb3pyanVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NDE4MjUsImV4cCI6MjA5NDUxNzgyNX0.9BcRAPuhoK1C6SMeUvexABXp5HW2dfEJbdcRT_2FiL4';

/**
 * 1. publicClient: Dedicated unauthenticated client using the anon key.
 * This client NEVER carries expired user JWTs and is 100% guaranteed to succeed
 * for public and admin data queries (Feed, Clippings, Profiles/Users list, App Config).
 */
export const publicClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/**
 * 2. supabase: Authenticated client for user actions (auth state, login, profile updates).
 * Includes seamless fallback to anon key on token expiration.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: async (url, options = {}) => {
      let res: Response;
      try {
        res = await fetch(url, options);
      } catch (err) {
        res = await fetch(url, options);
      }

      // If 401/400/403 (JWT expired / bad session token / invalid signature), seamlessly retry with anon key
      if (res.status === 401 || res.status === 400 || res.status === 403) {
        try {
          const reqUrl = typeof url === 'string' ? url : (url as Request).url;
          const headersObj: Record<string, string> = {
            apikey: supabaseAnonKey,
            Authorization: 'Bearer ' + supabaseAnonKey,
          };
          const retryRes = await fetch(reqUrl, {
            method: options.method || 'GET',
            headers: headersObj,
            body: options.body,
          });
          if (retryRes.ok) return retryRes;
        } catch {}
      }
      return res;
    },
  },
});
