// Latest published clippings for the reader's area (same rules as the swipe feed), with an instant cached first paint.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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
  const [loading, setLoading] = useState(items.length === 0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let q = supabase.from('clippings').select(COLUMNS).eq('is_posted', true).neq('status', 'rejected')
          .order('created_at', { ascending: false }).limit(limit);
        if (!isAll(userState)) q = q.or(`state.eq.${userState},state.eq.All,state.eq.Both states,state.is.null`);
        if (!isAll(district)) q = q.or(`district.eq.${district},district.eq.All,district.is.null`);
        let { data } = await q;
        if (!data || data.length === 0) {
          const all = await supabase.from('clippings').select(COLUMNS).eq('is_posted', true).neq('status', 'rejected')
            .order('created_at', { ascending: false }).limit(limit);
          data = all.data || [];
        }
        if (alive) setItems(data);
      } catch { /* keep cached */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
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
