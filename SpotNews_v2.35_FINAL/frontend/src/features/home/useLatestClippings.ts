// Latest published clippings for the reader's area (same rules as the swipe feed), with an instant cached first paint.
import { useEffect, useState } from 'react';
import { publicClient, supabase } from '@/lib/supabase';
import { findDistrict } from '@/features/daily/dailyContentEngine';

const COLUMNS = 'id, headline, article_content, png_url, image_url, likes_count, comments_count, created_at, district, state, status, is_posted, custom_layout';
const isAll = (v?: string) => !v || ['All', 'All districts', 'All Regions', 'Both states'].includes(v);

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export const isClippingWithin24Hours = (c: any): boolean => {
  if (!c) return false;
  const ts = c.published_at || c.created_at;
  if (!ts) return false;
  const time = new Date(ts).getTime();
  if (isNaN(time)) return false;
  const diff = Date.now() - time;
  return diff >= 0 && diff <= TWENTY_FOUR_HOURS_MS;
};

function cached(dKey?: string): any[] {
  try {
    const key = dKey ? `spotnews_feed_cache_${dKey}` : 'spotnews_feed_cache';
    const c = JSON.parse(localStorage.getItem(key) || localStorage.getItem('spotnews_feed_cache') || '[]');
    if (Array.isArray(c)) {
      return c.filter(isClippingWithin24Hours);
    }
    return [];
  } catch { return []; }
}

export function useLatestClippings(district: string, userState: string, limit = 20) {
  const cleanDistrict = district ? district.split('/')[0]?.split('·')[0]?.trim() : '';
  const [items, setItems] = useState<any[]>(() => cached(cleanDistrict).slice(0, limit));
  const [loading, setLoading] = useState<boolean>(() => cached(cleanDistrict).length === 0);

  useEffect(() => {
    let alive = true;

    // Safety timeout: Never leave loading spinner spinning indefinitely past 5 seconds
    const safetyTimer = setTimeout(() => {
      if (alive) setLoading(false);
    }, 5000);

    const fetchClippings = async () => {
      try {
        const client = publicClient || supabase;
        const cleanState = userState ? userState.split('/')[0]?.split('·')[0]?.trim() : '';
        const cutoff24hIso = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();

        // Helper timeout for individual network queries (4 seconds max)
        const withTimeout = async <T = any>(thenable: any, ms = 4000): Promise<T> =>
          Promise.race([
            Promise.resolve(thenable),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
          ]);

        let data: any[] | null = null;

        // If specific district is selected: query only for that district
        if (!isAll(cleanDistrict)) {
          try {
            const dInfo = findDistrict(cleanDistrict);
            let q = client.from('clippings').select(COLUMNS).eq('is_posted', true).neq('status', 'rejected')
              .gte('created_at', cutoff24hIso)
              .order('created_at', { ascending: false }).limit(limit);

            if (dInfo) {
              q = q.or(`district.eq."${dInfo.en}",district.eq."${dInfo.te}",district.ilike."${dInfo.en}"`);
            } else {
              q = q.ilike('district', cleanDistrict);
            }

            const res = await withTimeout(q);
            if (res && res.data) {
              data = res.data;
            }
          } catch (e) {
            console.warn('District query failed or timed out:', e);
          }
        } else if (!isAll(cleanState)) {
          // If specific state is selected with All districts
          try {
            const q = client.from('clippings').select(COLUMNS).eq('is_posted', true).neq('status', 'rejected')
              .gte('created_at', cutoff24hIso)
              .ilike('state', cleanState)
              .order('created_at', { ascending: false }).limit(limit);
            const res = await withTimeout(q);
            if (res && res.data) {
              data = res.data;
            }
          } catch (e) {
            console.warn('State query failed or timed out:', e);
          }
        } else {
          // All selected: fetch latest overall approved clippings
          try {
            const allRes = await withTimeout(
              client.from('clippings').select(COLUMNS).eq('is_posted', true).neq('status', 'rejected')
                .gte('created_at', cutoff24hIso)
                .order('created_at', { ascending: false }).limit(limit)
            );
            if (allRes && allRes.data) {
              data = allRes.data;
            }
          } catch (e) {
            console.warn('All query failed or timed out:', e);
          }
        }

        if (alive) {
          const finalItems = (data || []).filter(isClippingWithin24Hours);
          setItems(finalItems);
          try {
            const dKey = cleanDistrict || 'All';
            if (finalItems.length > 0) {
              localStorage.setItem(`spotnews_feed_cache_${dKey}`, JSON.stringify(finalItems));
              if (isAll(cleanDistrict)) {
                localStorage.setItem('spotnews_feed_cache', JSON.stringify(finalItems));
              }
            }
          } catch {}
        }
      } catch (err) {
        console.warn('Feed fetch error:', err);
      } finally {
        clearTimeout(safetyTimer);
        if (alive) setLoading(false);
      }
    };

    fetchClippings();

    return () => {
      alive = false;
      clearTimeout(safetyTimer);
    };
  }, [district, userState, limit]);

  return { items, loading };
}

export function timeAgoPair(iso?: string): [string, string] {
  if (!iso) return ['', ''];
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return ['ఇప్పుడే', 'just now'];
  if (m < 60) return [`${m} నిమి. క్రితం`, `${m} min ago`];
  const h = Math.floor(m / 60);
  if (h < 24) return [`${h} గంటల క్రితం`, `${h} hours ago`];
  const d = Math.floor(h / 24);
  return [`${d} రోజుల క్రితం`, `${d} days ago`];
}
