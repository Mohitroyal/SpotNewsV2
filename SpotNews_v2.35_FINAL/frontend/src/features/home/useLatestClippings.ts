// Latest published clippings for the reader's area (same rules as the swipe feed), with an instant cached first paint.
import { useEffect, useState } from 'react';
import { publicClient, supabase } from '@/lib/supabase';

const COLUMNS = 'id, headline, article_content, png_url, image_url, likes_count, comments_count, created_at, district, state, status, is_posted, custom_layout';
const isAll = (v?: string) => !v || ['All', 'All districts', 'All Regions', 'Both states'].includes(v);

function cached(): any[] {
  try {
    const c = JSON.parse(localStorage.getItem('spotnews_feed_cache') || '[]');
    return Array.isArray(c) ? c : [];
  } catch { return []; }
}

export function useLatestClippings(district: string, userState: string, limit = 20) {
  const [items, setItems] = useState<any[]>(() => cached().slice(0, limit));
  const [loading, setLoading] = useState<boolean>(() => cached().length === 0);

  useEffect(() => {
    let alive = true;

    // Safety timeout: Never leave loading spinner spinning indefinitely past 5 seconds
    const safetyTimer = setTimeout(() => {
      if (alive) setLoading(false);
    }, 5000);

    const fetchClippings = async () => {
      try {
        const client = publicClient || supabase;
        const cleanDistrict = district ? district.split('/')[0]?.split('·')[0]?.trim() : '';
        const cleanState = userState ? userState.split('/')[0]?.split('·')[0]?.trim() : '';

        // Helper timeout for individual network queries (4 seconds max)
        const withTimeout = async <T = any>(thenable: any, ms = 4000): Promise<T> =>
          Promise.race([
            Promise.resolve(thenable),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
          ]);

        let data: any[] | null = null;

        // Try district/state specific query first if specified
        if (!isAll(cleanDistrict) || !isAll(cleanState)) {
          try {
            let q = client.from('clippings').select(COLUMNS).eq('is_posted', true).neq('status', 'rejected')
              .order('created_at', { ascending: false }).limit(limit);

            if (!isAll(cleanState)) {
              q = q.or(`state.eq."${cleanState}",state.eq.All,state.eq."Both states",state.is.null`);
            }
            if (!isAll(cleanDistrict)) {
              q = q.or(`district.eq."${cleanDistrict}",district.eq.All,district.is.null`);
            }

            const res = await withTimeout(q);
            if (res && res.data && res.data.length > 0) {
              data = res.data;
            }
          } catch (e) {
            console.warn('District query failed or timed out, trying global fallback:', e);
          }
        }

        // If no items found for specific district, fetch latest overall approved clippings
        if (!data || data.length === 0) {
          try {
            const allRes = await withTimeout(
              client.from('clippings').select(COLUMNS).eq('is_posted', true).neq('status', 'rejected')
                .order('created_at', { ascending: false }).limit(limit)
            );
            if (allRes && allRes.data) {
              data = allRes.data;
            }
          } catch (e) {
            console.warn('Fallback query failed or timed out:', e);
          }
        }

        if (alive && data && data.length > 0) {
          setItems(data);
          try {
            localStorage.setItem('spotnews_feed_cache', JSON.stringify(data));
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
