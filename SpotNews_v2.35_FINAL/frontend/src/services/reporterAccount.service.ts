// Simple reporter account flow (Nov 2026)
//   Register: name + phone (OTP) → photo + district → Aadhaar (+ old press ID, optional) → super admin approves
//   Login:    phone + OTP, only for registered reporters
//   ID card:  optional, only after approval (₹500)
import { supabase, publicClient } from '@/lib/supabase';
import { useAuthStore } from '@/store';
import { generationService } from '@/services/generation.service';

const API_URL = (import.meta.env.VITE_API_URL || 'https://spotnewsv2-ew09.onrender.com').replace(/\/+$/, '');

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

  /** Aadhaar document → Supabase storage with multi-tier fallback. Returns the storage URL/path. */
  async uploadPrivateDoc(file: File, kind: 'aadhaar' | 'press_id' = 'aadhaar'): Promise<string> {
    const ext = file.name?.split('.').pop() || 'jpg';
    const cleanExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'jpg';
    const path = `reporter_docs/${kind}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${cleanExt}`;

    // Tier 1: Direct upload to Supabase storage 'uploads' bucket
    try {
      const client = publicClient || supabase;
      const { data, error } = await client.storage
        .from('uploads')
        .upload(path, file, {
          contentType: file.type || 'image/jpeg',
          upsert: true,
        });
      if (!error && data) {
        const { data: pubData } = client.storage.from('uploads').getPublicUrl(path);
        if (pubData?.publicUrl) {
          console.log(`[ReporterAccount] Uploaded ${kind} to Supabase storage:`, pubData.publicUrl);
          return pubData.publicUrl;
        }
        return path;
      }
      if (error) {
        console.warn(`[ReporterAccount] Supabase storage upload returned error:`, error);
      }
    } catch (sbErr) {
      console.warn(`[ReporterAccount] Supabase storage upload exception:`, sbErr);
    }

    // Tier 2: generationService.uploadImage fallback
    try {
      const res = await generationService.uploadImage(file);
      if (res?.success && res?.data?.url) {
        console.log(`[ReporterAccount] Uploaded ${kind} via generationService:`, res.data.url);
        return res.data.url;
      }
    } catch (genErr) {
      console.warn(`[ReporterAccount] generationService fallback failed:`, genErr);
    }

    // Tier 3: Backend upload attempt if route exists
    try {
      const form = new FormData();
      form.append('file', file, file.name || `${kind}.jpg`);
      form.append('kind', kind);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${API_URL}/v1/reporter/docs`, { method: 'POST', headers: authHeader(), body: form, signal: ctrl.signal });
      clearTimeout(timer);
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.path) return json.path as string;
    } catch {}

    // Tier 4: Guaranteed Base64 Data URL fallback (never fails, ensures registration can complete)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          console.log(`[ReporterAccount] Using Base64 fallback for ${kind}`);
          resolve(reader.result);
        } else {
          reject(new Error('Failed to encode document'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read document file'));
      reader.readAsDataURL(file);
    });
  },

  /** Super admin only: link to view an Aadhaar / document image. */
  async docViewUrl(path: string): Promise<string> {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    try {
      const client = publicClient || supabase;
      const { data } = client.storage.from('uploads').getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
    } catch {}
    try {
      const res = await fetch(`${API_URL}/v1/admin/reporter-docs/url?path=${encodeURIComponent(path)}`, { headers: authHeader() });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.url) return json.url;
    } catch {}
    return path;
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
