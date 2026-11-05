// Simple reporter account flow (Nov 2026)
//   Register: name + phone (OTP) → photo + district → Aadhaar (+ old press ID, optional) → super admin approves
//   Login:    phone + OTP, only for registered reporters
//   ID card:  optional, only after approval (₹500)
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store';

const API_URL = (import.meta.env.VITE_API_URL || 'https://spotnewsv2.onrender.com').replace(/\/+$/, '');

export type AppStatus = 'none' | 'pending' | 'approved' | 'active' | 'rejected';

export interface ReporterApplicationRow {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  district?: string | null;
  status: string;
  rejection_reason?: string | null;
  reporter_id?: string | null;
  photo_url?: string | null;
  aadhaar_doc_path?: string | null;
  press_id_doc_path?: string | null;
  id_card_status?: string | null;
  terms_accepted_at?: string | null;
  terms_version?: string | null;
  valid_until?: string | null;
  payment_status?: string | null;
  user_id?: string | null;
  created_at?: string;
}

export const last10 = (phone?: string | null) => (phone || '').replace(/\D/g, '').slice(-10);

/** Approved (or approved + ID card paid) = full reporter access. */
export const isApprovedStatus = (s?: string | null) => ['approved', 'active'].includes((s || '').toLowerCase());

function authHeader(): Record<string, string> {
  const t = useAuthStore.getState().token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const reporterAccountService = {
  /** The newest reporter application for this account (by user id, then by phone). */
  async findMyApplication(userId?: string, phone?: string): Promise<ReporterApplicationRow | null> {
    const cols = 'id,name,email,phone,state,district,status,rejection_reason,reporter_id,photo_url,aadhaar_doc_path,press_id_doc_path,id_card_status,valid_until,payment_status,user_id,created_at';
    try {
      if (userId) {
        const { data } = await supabase.from('reporter_applications').select(cols)
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
        if (data && data[0]) return data[0] as ReporterApplicationRow;
      }
      const d = last10(phone);
      if (d.length === 10) {
        const { data } = await supabase.from('reporter_applications').select(cols)
          .ilike('phone', `%${d}`).order('created_at', { ascending: false }).limit(1);
        if (data && data[0]) return data[0] as ReporterApplicationRow;
      }
    } catch (e) {
      console.warn('[ReporterAccount] findMyApplication failed', e);
    }
    return null;
  },

  /** Aadhaar / old press ID → PRIVATE storage through the backend. Returns the storage path. */
  async uploadPrivateDoc(file: File, kind: 'aadhaar' | 'press_id'): Promise<string> {
    const form = new FormData();
    form.append('file', file, file.name || `${kind}.jpg`);
    form.append('kind', kind);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(`${API_URL}/v1/reporter/docs`, { method: 'POST', headers: authHeader(), body: form, signal: ctrl.signal });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.path) throw new Error(json?.detail || `Upload failed (${res.status})`);
      return json.path as string;
    } finally {
      clearTimeout(timer);
    }
  },

  /** Super admin only: 10-minute link to view an Aadhaar / press ID image. */
  async docViewUrl(path: string): Promise<string> {
    const res = await fetch(`${API_URL}/v1/admin/reporter-docs/url?path=${encodeURIComponent(path)}`, { headers: authHeader() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.url) throw new Error(json?.detail || 'Could not open the document');
    return json.url as string;
  },

  async submitRegistration(input: {
    userId: string;
    name: string;
    phone: string;
    email: string;
    state: string;
    district: string;
    photoUrl: string;
    aadhaarPath: string;
    pressIdPath?: string;
    /** Reporter accepted the news publishing rules & responsibility for fake news */
    termsVersion: string;
  }): Promise<ReporterApplicationRow> {
    const row = {
      user_id: input.userId,
      name: input.name.trim(),
      phone: `+91${last10(input.phone)}`,
      email: input.email,
      state: input.state,
      district: input.district,
      photo_url: input.photoUrl,
      aadhaar_doc_path: input.aadhaarPath,
      press_id_doc_path: input.pressIdPath || null,
      status: 'pending',
      id_card_status: 'none',
      terms_accepted_at: new Date().toISOString(),
      terms_version: input.termsVersion,
    };
    const { data, error } = await supabase.from('reporter_applications').insert([row]).select().single();
    if (error) throw new Error(error.message);
    // Keep the profile in sync (name, photo, district) — role stays 'user' until super admin approves
    try {
      await supabase.from('profiles').update({
        full_name: row.name, state: row.state, district: row.district, avatar_url: row.photo_url,
      }).eq('id', input.userId);
    } catch { /* optional */ }
    return data as ReporterApplicationRow;
  },
};
