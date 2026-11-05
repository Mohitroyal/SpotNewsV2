// Sky + weather → colour theme for every automatic post.
// Sunrise / sunset are calculated on the phone (NOAA formula), so this works offline in every district.

export type SkyPhase = 'predawn' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'golden' | 'dusk' | 'night';
export type Mood = 'clear' | 'cloudy' | 'rain' | 'storm' | 'heat' | 'cold' | 'fog';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Sunrise and sunset in IST minutes after midnight for a place and date (YYYY-MM-DD). */
export function sunTimes(lat: number, lng: number, date: string): { rise: number; set: number } {
  const d = new Date(`${date}T12:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const n = Math.floor((d.getTime() - start) / 86400000);
  const g = ((2 * Math.PI) / 365) * (n - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = (Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl))) - Math.tan(rad(lat)) * Math.tan(decl);
  const ha = deg(Math.acos(Math.max(-1, Math.min(1, cosH))));
  const noonUtc = 720 - 4 * lng - eqt;
  return { rise: Math.round(noonUtc - 4 * ha + 330), set: Math.round(noonUtc + 4 * ha + 330) };
}

export const fmtClock = (min: number) => {
  const h = Math.floor(min / 60);
  const m = String(Math.round(min % 60)).padStart(2, '0');
  return `${h > 12 ? h - 12 : h}:${m}`;
};

export function phaseAt(minute: number, rise: number, set: number): SkyPhase {
  if (minute < rise - 45) return 'predawn';
  if (minute < rise + 60) return 'dawn';
  if (minute < 11 * 60) return 'morning';
  if (minute < 15 * 60) return 'midday';
  if (minute < set - 75) return 'afternoon';
  if (minute < set + 15) return 'golden';
  if (minute < set + 90) return 'dusk';
  return 'night';
}

/** WMO weather code (Open-Meteo) + temperature → mood. */
export function moodOf(code?: number | null, temp?: number | null): Mood {
  const c = code ?? 1;
  if (c >= 95) return 'storm';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if (c === 45 || c === 48) return 'fog';
  if (temp != null && temp >= 36) return 'heat';
  if (temp != null && temp <= 17) return 'cold';
  if (c === 3 || c === 2) return 'cloudy';
  return 'clear';
}

export interface SkyTheme {
  phase: SkyPhase;
  mood: Mood;
  bg: string;          // card background
  ink: string;         // main text colour
  sub: string;         // secondary text
  panel: string;       // bullet panel background
  accent: string;      // chips, buttons
  dark: boolean;
  sunX: number;        // 0..1 where the sun / moon sits in the sky
  sunY: number;
}

// Several palettes per phase so two posts in a row never look the same
const PALETTES: Record<SkyPhase, [string, string, string][]> = {
  predawn: [['#0B1026', '#2B2F77', '#5B4B8A'], ['#141E30', '#35577D', '#6B5B95'], ['#0F2027', '#2C5364', '#4E5D94']],
  dawn: [['#FF9A8B', '#FF6A88', '#FFD3A5'], ['#FBD786', '#F7797D', '#C6FFDD'], ['#FFCF71', '#F78CA0', '#2376DD'], ['#F9D423', '#FF4E50', '#FFB88C']],
  morning: [['#89F7FE', '#66A6FF', '#E0F7FF'], ['#A1C4FD', '#C2E9FB', '#FFFFFF'], ['#56CCF2', '#2F80ED', '#D6EFFF'], ['#B2FEFA', '#0ED2F7', '#E9FBFF']],
  midday: [['#36D1DC', '#5B86E5', '#E3F4FF'], ['#00C6FB', '#005BEA', '#CFE8FF'], ['#4FACFE', '#00F2FE', '#F0FCFF']],
  afternoon: [['#F6D365', '#FDA085', '#FFF1D6'], ['#FFE259', '#FFA751', '#FFF6E0'], ['#FAD961', '#F76B1C', '#FFE8CC']],
  golden: [['#FF512F', '#F09819', '#FFD86F'], ['#EE9CA7', '#FFDDE1', '#FFB86C'], ['#FF7E5F', '#FEB47B', '#FFE1A8'], ['#F857A6', '#FF5858', '#FFC371']],
  dusk: [['#41295A', '#2F0743', '#C06C84'], ['#355C7D', '#6C5B7B', '#C06C84'], ['#3A1C71', '#D76D77', '#FFAF7B']],
  night: [['#0F0C29', '#302B63', '#24243E'], ['#141E30', '#243B55', '#3A2E6B'], ['#000428', '#004E92', '#1B2A49'], ['#1F1C2C', '#3A3F78', '#2B1E4F']],
};

const MOOD_TINT: Partial<Record<Mood, [string, string, string]>> = {
  rain: ['#4B6CB7', '#182848', '#6D8BB8'],
  storm: ['#232526', '#414345', '#5D6D7E'],
  fog: ['#BDC3C7', '#8E9EAB', '#ECF0F1'],
  cloudy: ['#8E9EAB', '#B6C6D6', '#EEF2F3'],
};

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function skyTheme(opts: { minute: number; rise: number; set: number; mood: Mood; seed: number }): SkyTheme {
  const { minute, rise, set, mood, seed } = opts;
  const phase = phaseAt(minute, rise, set);
  const list = PALETTES[phase];
  let [a, b, c] = list[seed % list.length];
  const tint = MOOD_TINT[mood];
  const daytime = phase !== 'night' && phase !== 'predawn' && phase !== 'dusk';
  // Rain / clouds / fog colour the day sky; nights stay dark
  if (tint && daytime) [a, b, c] = mood === 'cloudy' ? [a, tint[1], tint[2]] : tint;
  if (mood === 'heat' && daytime) [a, b, c] = ['#F83600', '#F9D423', '#FFE29F'];
  if (mood === 'cold' && daytime) [a, b, c] = ['#83A4D4', '#B6FBFF', '#E8F9FF'];

  const dark = !daytime || mood === 'rain' || mood === 'storm';
  const angle = 150 + (seed % 4) * 15;
  const bg = `linear-gradient(${angle}deg, ${a} 0%, ${b} 55%, ${c} 100%)`;
  const dayFrac = Math.min(1, Math.max(0, (minute - rise) / Math.max(1, set - rise)));
  const nightFrac = minute >= set ? (minute - set) / Math.max(1, 24 * 60 - set + rise) : 0.9;
  const sunX = daytime ? 0.12 + dayFrac * 0.76 : 0.2 + nightFrac * 0.6;
  const sunY = daytime ? 0.62 - Math.sin(dayFrac * Math.PI) * 0.5 : 0.25;
  return {
    phase, mood, bg, dark, sunX, sunY,
    ink: dark ? '#F8FAFF' : '#10223D',
    sub: dark ? 'rgba(241,245,255,0.82)' : 'rgba(16,34,61,0.72)',
    panel: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.78)',
    accent: dark ? '#FFD166' : '#0B56A6',
  };
}

export const PHASE_LABEL: Record<SkyPhase, [string, string]> = {
  predawn: ['తెల్లవారుజాము', 'Before dawn'],
  dawn: ['సూర్యోదయం', 'Sunrise'],
  morning: ['ఉదయం', 'Morning'],
  midday: ['మధ్యాహ్నం', 'Midday'],
  afternoon: ['సాయంత్రం ముందు', 'Afternoon'],
  golden: ['సూర్యాస్తమయం', 'Sunset'],
  dusk: ['సంధ్య', 'Dusk'],
  night: ['రాత్రి', 'Night'],
};

export const MOOD_LABEL: Record<Mood, [string, string]> = {
  clear: ['నిర్మలమైన ఆకాశం', 'Clear sky'],
  cloudy: ['మేఘావృతం', 'Cloudy'],
  rain: ['వర్షం', 'Rain'],
  storm: ['ఉరుములు', 'Thunderstorm'],
  heat: ['ఎండ తీవ్రం', 'Hot'],
  cold: ['చలి', 'Cool'],
  fog: ['పొగమంచు', 'Mist'],
};

// Current weather mood for the reader's district (set by the feed when the weather loads)
let liveMood: Mood = 'clear';
export const setLiveMood = (m: Mood) => { liveMood = m; };
export const getLiveMood = () => liveMood;

/** IST minutes after midnight for an ISO time. */
export const istMinute = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
