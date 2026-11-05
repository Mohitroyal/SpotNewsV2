// Automatic reader location: GPS -> nearest district (AP + Telangana), with a manual "Change" option.
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { DISTRICTS, findDistrict, type DistrictInfo } from '@/features/daily/dailyContentEngine';
import { useAuthStore } from '@/store';

const MODE_KEY = 'spotnews_location_mode'; // 'auto' | 'manual' | 'all'
const MAX_KM = 120; // farther than this from every district centre = outside AP/TG

export type DetectResult =
  | { ok: true; district: DistrictInfo; km: number }
  | { ok: false; reason: 'denied' | 'unavailable' | 'far' };

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function nearestDistrict(lat: number, lng: number): { district: DistrictInfo; km: number } {
  let best = DISTRICTS[0];
  let bestKm = Infinity;
  for (const d of DISTRICTS) {
    const k = km(lat, lng, d.lat, d.lng);
    if (k < bestKm) { best = d; bestKm = k; }
  }
  return { district: best, km: bestKm };
}

async function position(): Promise<{ lat: number; lng: number } | 'denied' | 'unavailable'> {
  try {
    if (Capacitor.isNativePlatform()) {
      let perm = await Geolocation.checkPermissions().catch(() => null);
      if (!perm || (perm.location !== 'granted' && perm.coarseLocation !== 'granted')) {
        perm = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] }).catch(() => null);
      }
      if (!perm || (perm.location !== 'granted' && perm.coarseLocation !== 'granted')) return 'denied';
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 30 * 60 * 1000 });
      return { lat: p.coords.latitude, lng: p.coords.longitude };
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unavailable';
    return await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => resolve(e && e.code === 1 ? 'denied' : 'unavailable'),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 30 * 60 * 1000 },
      );
    });
  } catch {
    return 'unavailable';
  }
}

/** Ask for location once and return the nearest AP / Telangana district. */
export async function detectDistrict(): Promise<DetectResult> {
  const pos = await position();
  if (pos === 'denied' || pos === 'unavailable') return { ok: false, reason: pos };
  const near = nearestDistrict(pos.lat, pos.lng);
  if (near.km > MAX_KM) return { ok: false, reason: 'far' };
  return { ok: true, district: near.district, km: near.km };
}

/** Save the reader's district (used by the feed, weather and daily posts). */
export function applyDistrict(d: DistrictInfo | null, mode: 'auto' | 'manual' | 'all') {
  const store = useAuthStore.getState();
  store.setDistrict(d ? d.en : 'All');
  store.setUserState(d ? d.state : 'All');
  try {
    localStorage.setItem(MODE_KEY, mode);
    localStorage.setItem('spotnews_selected_district', d ? d.en : 'All');
    localStorage.setItem('spotnews_selected_state', d ? d.state : 'All');
  } catch { /* storage may be unavailable */ }
}

export function locationMode(): 'auto' | 'manual' | 'all' | null {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'auto' || m === 'manual' || m === 'all') return m;
    // Readers who picked a district in the older app keep their choice
    const old = localStorage.getItem('spotnews_selected_district');
    if (old && old !== 'All') return 'manual';
  } catch { /* ignore */ }
  return null;
}

export function currentDistrictInfo(): DistrictInfo | undefined {
  return findDistrict(useAuthStore.getState().district);
}
