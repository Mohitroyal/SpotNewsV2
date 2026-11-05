import React, { useEffect, useState } from 'react';
import { ShoppingBag, Plus, Trash2, Pause, Play, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BRAND_LIST, BRAND_COLOURS } from '@/services/brandAds.service';
import { prepareImage } from '@/utils/prepareImage';

/**
 * Superadmin → Local Ads tab → "Brand deals".
 * Add / pause / delete Amazon, Flipkart, Meesho … banners that appear in the feed.
 */
interface Row {
  id: string;
  brand: string;
  title_te: string;
  title_en: string | null;
  image_url: string | null;
  affiliate_url: string;
  target_district: string | null;
  active: boolean;
  impressions: number;
  clicks: number;
  ends_at: string | null;
}

const empty = { brand: 'Amazon', title_te: '', title_en: '', subtitle_te: '', affiliate_url: '', target_district: '', ends_at: '' };

export const BrandAdsAdminSection: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...empty });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('brand_ads')
      .select('id, brand, title_te, title_en, image_url, affiliate_url, target_district, active, impressions, clicks, ends_at')
      .order('created_at', { ascending: false });
    if (error) setMsg(`Could not load brand deals: ${error.message}`);
    setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!form.title_te.trim() || !/^https:\/\//i.test(form.affiliate_url.trim())) {
      setMsg('Telugu title and an https:// affiliate link are required.');
      return;
    }
    setSaving(true);
    try {
      let image_url: string | null = null;
      if (imageFile) {
        const prepared = await prepareImage(imageFile, { maxEdge: 1200, fileName: 'brand' });
        const path = `brand_ads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage.from('uploads').upload(path, prepared, { contentType: 'image/jpeg' });
        if (upErr) throw upErr;
        image_url = supabase.storage.from('uploads').getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from('brand_ads').insert({
        brand: form.brand,
        title_te: form.title_te.trim(),
        title_en: form.title_en.trim() || null,
        subtitle_te: form.subtitle_te.trim() || null,
        affiliate_url: form.affiliate_url.trim(),
        target_district: form.target_district.trim() || null,
        ends_at: form.ends_at ? new Date(`${form.ends_at}T23:59:59+05:30`).toISOString() : null,
        image_url,
        active: true,
      });
      if (error) throw error;
      setForm({ ...empty });
      setImageFile(null);
      setMsg('Brand deal added. It will appear in the feed within a minute.');
      load();
    } catch (err: any) {
      setMsg(`Save failed: ${err?.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r: Row) => {
    await supabase.from('brand_ads').update({ active: !r.active }).eq('id', r.id);
    load();
  };
  const remove = async (r: Row) => {
    if (!window.confirm(`Delete this ${r.brand} deal?`)) return;
    await supabase.from('brand_ads').delete().eq('id', r.id);
    load();
  };

  const input = 'w-full border border-[#D6E4F5] rounded-lg px-3 py-2 text-[15px] outline-none focus:border-[#015BB3] bg-white';

  return (
    <div className="mt-6 bg-white rounded-2xl border border-[#D9E5F2] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[17px] font-extrabold text-[#0A2540] flex items-center gap-2 m-0">
          <ShoppingBag className="w-5 h-5 text-[#015BB3]" /> Brand deals (Amazon, Flipkart, Meesho…)
        </h3>
        <button onClick={load} className="p-2 rounded-full hover:bg-gray-100" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-[13px] text-[#64748B] mt-0 mb-3">
        Only these brands are allowed. Use your affiliate link (Amazon Associates, or an affiliate network for Flipkart / Meesho / Myntra) so each purchase earns a commission.
      </p>

      <form onSubmit={save} className="grid gap-2 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <select className={input} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
            {BRAND_LIST.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <input className={input} placeholder="District (empty = all)" value={form.target_district} onChange={(e) => setForm({ ...form, target_district: e.target.value })} />
        </div>
        <input className={input} placeholder="Telugu title * (e.g. దీపావళి ఆఫర్లు – 70% వరకు తగ్గింపు)" value={form.title_te} onChange={(e) => setForm({ ...form, title_te: e.target.value })} />
        <input className={input} placeholder="English line (optional)" value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
        <input className={input} placeholder="Short Telugu description (optional)" value={form.subtitle_te} onChange={(e) => setForm({ ...form, subtitle_te: e.target.value })} />
        <input className={input} placeholder="Affiliate link * https://…" value={form.affiliate_url} onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[13px] text-[#475569] font-semibold flex flex-col gap-1">
            Banner image
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="text-[13px]" />
          </label>
          <label className="text-[13px] text-[#475569] font-semibold flex flex-col gap-1">
            Ends on (optional)
            <input type="date" className={input} value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
          </label>
        </div>
        <button type="submit" disabled={saving} className="mt-1 bg-[#015BB3] text-white rounded-xl py-2.5 text-[15px] font-bold flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add brand deal
        </button>
        {msg && <p className="text-[13px] font-semibold text-[#B45309] m-0">{msg}</p>}
      </form>

      <div className="grid gap-2">
        {rows.length === 0 && !loading && <p className="text-[14px] text-[#94A3B8] text-center py-3 m-0">No brand deals yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border border-[#E2E8F0] rounded-xl p-2.5">
            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: BRAND_COLOURS[r.brand] || '#015BB3' }}>
              {r.image_url ? <img src={r.image_url} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="w-6 h-6 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-[#0A2540] truncate">{r.brand} · {r.title_te}</div>
              <div className="text-[12px] text-[#64748B]">
                {r.target_district || 'All districts'} · {r.impressions} views · {r.clicks} clicks{r.ends_at ? ` · ends ${new Date(r.ends_at).toLocaleDateString('en-IN')}` : ''}
              </div>
            </div>
            <button onClick={() => toggle(r)} className="p-2 rounded-full hover:bg-gray-100" title={r.active ? 'Pause' : 'Resume'}>
              {r.active ? <Pause className="w-4 h-4 text-[#B45309]" /> : <Play className="w-4 h-4 text-[#059669]" />}
            </button>
            <button onClick={() => remove(r)} className="p-2 rounded-full hover:bg-gray-100" title="Delete">
              <Trash2 className="w-4 h-4 text-[#DC2626]" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
