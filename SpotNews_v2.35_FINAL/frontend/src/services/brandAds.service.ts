import { supabase } from '@/lib/supabase';

/**
 * Brand deals (replaces Google AdMob).
 *
 * Only well-known shopping brands are allowed (the database enforces the list,
 * see supabase/migrations/20261103_brand_ads.sql). The admin adds a banner and
 * an affiliate link (Amazon Associates, or Flipkart / Meesho / Myntra links
 * through an affiliate network). Nothing is shown that the admin did not add.
 */
export const BRAND_LIST = [
  'Amazon', 'Flipkart', 'Meesho', 'Myntra', 'Ajio', 'JioMart',
  'Nykaa', 'Tata CLiQ', 'BigBasket', 'Croma', 'Reliance Digital',
] as const;
export type Brand = (typeof BRAND_LIST)[number];

export interface BrandAd {
  id: string;
  brand: Brand;
  title_te: string;
  title_en?: string | null;
  subtitle_te?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  affiliate_url: string;
  accent_color?: string | null;
  target_state?: string | null;
  target_district?: string | null;
  priority?: number;
}

/** Brand colours used for the card accent when the admin leaves it empty. */
export const BRAND_COLOURS: Record<string, string> = {
  Amazon: '#FF9900',
  Flipkart: '#2874F0',
  Meesho: '#9F2089',
  Myntra: '#FF3F6C',
  Ajio: '#2C4152',
  JioMart: '#0078AD',
  Nykaa: '#FC2779',
  'Tata CLiQ': '#DA1C5C',
  BigBasket: '#84C225',
  Croma: '#00A39B',
  'Reliance Digital': '#E42529',
};

const CACHE_KEY = 'spotnews_brand_ads_cache_v1';

export const brandAdsService = {
  async fetchActive(state?: string, district?: string): Promise<BrandAd[]> {
    try {
      const nowIso = new Date().toISOString();
      const q = supabase
        .from('brand_ads')
        .select('id, brand, title_te, title_en, subtitle_te, image_url, cta_label, affiliate_url, accent_color, target_state, target_district, priority, starts_at, ends_at')
        .eq('active', true)
        .order('priority', { ascending: false })
        .limit(20);

      const { data, error } = await q;
      if (error) throw error;

      const norm = (v?: string | null) => (v || '').trim().toLowerCase();
      const d = norm(district);
      const s = norm(state);
      const rows = ((data || []) as (BrandAd & { starts_at?: string | null; ends_at?: string | null })[]).filter((ad) => {
        if (ad.starts_at && ad.starts_at > nowIso) return false; // not started yet
        if (ad.ends_at && ad.ends_at < nowIso) return false;     // expired
        const td = norm(ad.target_district);
        const ts = norm(ad.target_state);
        const districtOk = !td || td === 'all' || !d || d === 'all' || td === d;
        const stateOk = !ts || ts === 'all' || !s || s === 'all' || s === 'both states' || ts === s;
        return districtOk && stateOk;
      });
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch { /* storage full or blocked */ }
      return rows;
    } catch (e) {
      console.warn('[BrandAds] fetch failed, using cache', e);
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) return JSON.parse(cached) as BrandAd[];
      } catch { /* no cache */ }
      return [];
    }
  },

  /** Fire-and-forget counters for the admin's report. */
  trackImpression(id: string) {
    supabase.rpc('brand_ad_event', { p_id: id, p_kind: 'impression' }).then(() => {}, () => {});
  },
  trackClick(id: string) {
    supabase.rpc('brand_ad_event', { p_id: id, p_kind: 'click' }).then(() => {}, () => {});
  },
};
