import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BookOpen, Sparkles, Brain, ChevronLeft, ChevronRight, CloudSun, Cpu, Dumbbell, GraduationCap, Grid3x3, HeartPulse, Home, Leaf, Loader2, MapPin, Megaphone,
  Menu, Mic, Moon, Newspaper, PenSquare, Phone, Salad, Settings, Share2, Sprout, X,
} from 'lucide-react';
import { Browser } from '@capacitor/browser';
import logoUrl from '@/assets/rti_express_logo.png';
import { useAuthStore } from '@/store';
import { BRAND_GRADIENT, DoubleWave } from '@/components/BrandHeader';
import { LangToggle } from '@/components/LangToggle';
import { DistrictPickerSheet } from '@/components/DistrictPickerSheet';
import { useLang, pair, type Lang } from '@/lib/lang';
import { useWeather } from '@/services/weatherService';
import { applyDistrict, detectDistrict, locationMode } from '@/features/location/autoLocation';
import { findDistrict, istDate } from '@/features/daily/dailyContentEngine';
import { SkyScene } from '@/features/moments/SkyScene';
import { cultureOf } from '@/features/moments/districtCulture';
import { buildMoments, TOPIC_LABEL, type Topic } from '@/features/moments/momentsEngine';
import { fmtClock, istMinute, moodOf, MOOD_LABEL, skyTheme, sunTimes } from '@/features/moments/sky';
import { useLatestClippings, timeAgoPair } from '@/features/home/useLatestClippings';
import { clipPhoto } from '@/features/feed/ReaderStoryCard';
import { limitWordsForDisplay, MAX_HEADLINE_WORDS } from '@/utils/wordLimit';
import { PLAY_STORE_URL } from '@/features/share/links';

const T = (lang: Lang, te: string, en: string) => pair(lang, te, en);

function headlineOf(c: any) {
  const cl = c?.custom_layout || {};
  return limitWordsForDisplay(c?.headline || cl.headline || 'Spot News', MAX_HEADLINE_WORDS);
}

export const ReaderHomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const loc = useLocation();
  const [lang] = useLang();
  const user = useAuthStore((s) => s.user);
  const district = useAuthStore((s) => s.district);
  const userState = useAuthStore((s) => s.userState);
  const isReporter = ['reporter', 'admin', 'superadmin'].includes(String(user?.role || ''));

  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [detecting, setDetecting] = useState(() => locationMode() === null);
  const [detected, setDetected] = useState(() => locationMode() === 'auto');

  // First visit: find the reader's district automatically
  useEffect(() => {
    if (locationMode() !== null) return;
    let alive = true;
    detectDistrict().then((r) => {
      if (!alive) return;
      setDetecting(false);
      if (r.ok) { applyDistrict(r.district, 'auto'); setDetected(true); }
      else { applyDistrict(null, 'all'); setPickerOpen(true); }
    });
    return () => { alive = false; };
  }, []);

  const { items, loading } = useLatestClippings(district, userState, 20);
  const breaking = useMemo(() => {
    const withPhotos = items.filter((c) => clipPhoto(c));
    return (withPhotos.length > 0 ? withPhotos : items).slice(0, 5);
  }, [items]);
  const quick = useMemo(() => items.slice(0, 8), [items]);

  const { data: weather } = useWeather({ state: userState, district });
  const d = findDistrict(district);
  const placeMain = d ? (lang === 'en' ? d.en : d.te) : (lang === 'en' ? 'All districts' : 'అన్ని జిల్లాలు');

  // Breaking news slider (auto-advances every 5 s)
  const [slide, setSlide] = useState(0);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    if (breaking.length < 2) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % breaking.length), 5000);
    return () => clearInterval(id);
  }, [breaking.length]);

  const cur = breaking.length ? slide % breaking.length : 0;

  // Sky + this hour's posts (made on the phone for every district)
  const homeDistrict = d || findDistrict(String(userState || '').toLowerCase().includes('andhra') ? 'NTR' : 'Hyderabad')!;
  const culture = cultureOf(homeDistrict.en);
  const today = istDate();
  const sun = sunTimes(homeDistrict.lat, homeDistrict.lng, today);
  const mood = moodOf(weather?.weatherCode, weather?.temperature);
  const nowMin = istMinute(new Date().toISOString());
  const sky = skyTheme({ minute: nowMin, rise: sun.rise, set: sun.set, mood, seed: 3 });
  const greet: [string, string] = sky.phase === 'night' || sky.phase === 'predawn' ? ['శుభ రాత్రి', 'Good night']
    : sky.phase === 'dusk' || sky.phase === 'golden' || sky.phase === 'afternoon' ? ['శుభ సాయంత్రం', 'Good evening']
    : sky.phase === 'midday' ? ['శుభ మధ్యాహ్నం', 'Good afternoon'] : ['శుభోదయం', 'Good morning'];
  const moments = useMemo(() => buildMoments({ district: homeDistrict, date: today, mood }), [homeDistrict.en, today, mood]);
  const liveMoments = moments.filter((m) => new Date(m.publish_at).getTime() <= Date.now());
  const nowMoment = liveMoments[liveMoments.length - 1] || moments[0];
  const recentMoments = liveMoments.slice(-8).reverse();

  // Shared links (old format /?clipId=...) open the story in the swipe reader
  const params = new URLSearchParams(loc.search);
  if (params.get('clipId') || params.get('id')) return <Navigate to={`/feed${loc.search}`} replace />;

  const pendingClip = typeof window !== 'undefined' ? (sessionStorage.getItem('spotnews_pending_clip_id') || localStorage.getItem('spotnews_pending_clip_id')) : null;
  if (pendingClip) {
    try {
      sessionStorage.removeItem('spotnews_pending_clip_id');
      localStorage.removeItem('spotnews_pending_clip_id');
    } catch {}
    return <Navigate to={`/feed?clipId=${encodeURIComponent(pendingClip)}`} replace />;
  }

  useEffect(() => {
    const handleClippingOpen = (ev: any) => {
      const clipId = ev?.detail?.clipId;
      if (clipId) {
        navigate(`/feed?clipId=${encodeURIComponent(clipId)}&t=${Date.now()}`);
      }
    };
    window.addEventListener('spotnews-open-clipping', handleClippingOpen);
    return () => window.removeEventListener('spotnews-open-clipping', handleClippingOpen);
  }, [navigate]);

  const openStory = (id: string) => navigate(`/feed?clipId=${encodeURIComponent(id)}`);
  const openEpaper = async () => {
    try { await Browser.open({ url: 'https://www.fouziyapublications.com/' }); }
    catch { window.open('https://www.fouziyapublications.com/', '_blank'); }
  };
  const shareApp = async () => {
    const text = `RTI Express Spot News 24x7 - మీ ఊరి వార్తలు\n${PLAY_STORE_URL}`;
    try { if (navigator.share) await navigator.share({ text }); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); }
    catch { /* cancelled */ }
  };

  const tiles = [
    { key: 'news', icon: Newspaper, color: '#E11D2E', bg: '#FDECEC', t: T(lang, 'తాజా వార్తలు', 'News Updates'), go: () => navigate('/feed') },
    { key: 'weather', icon: CloudSun, color: '#F59E0B', bg: '#FFF6DF', t: T(lang, 'వాతావరణం', 'Weather'), sub: weather ? `${Math.round(weather.temperature)}°` : '', go: () => navigate('/feed?cat=weather') },
    { key: 'health', icon: HeartPulse, color: '#DC2626', bg: '#FDECEC', t: T(lang, 'ఆరోగ్యం', 'Health'), go: () => navigate('/feed?cat=health') },
    { key: 'agri', icon: Sprout, color: '#16A34A', bg: '#E8F7EE', t: T(lang, 'వ్యవసాయం', 'Agriculture'), go: () => navigate('/feed?cat=agri') },
    { key: 'career', icon: GraduationCap, color: '#4F46E5', bg: '#EEF0FF', t: T(lang, 'కెరీర్ & స్కాలర్‌షిప్', 'Career & Scholarships'), go: () => navigate('/feed?cat=career') },
    { key: 'youth', icon: Brain, color: '#DB2777', bg: '#FDEAF3', t: T(lang, 'యువత & ప్రేరణ', 'Youth & Motivation'), go: () => navigate('/feed?cat=youth') },
    { key: 'mind', icon: Moon, color: '#6D28D9', bg: '#F1EBFE', t: T(lang, 'మానసిక ఆరోగ్యం', 'Mind & Sleep'), go: () => navigate('/feed?cat=mindcare') },
    { key: 'tech', icon: Cpu, color: '#0891B2', bg: '#E3F6FA', t: T(lang, 'టెక్ & AI', 'Tech & AI'), go: () => navigate('/feed?cat=tech') },
    { key: 'fitness', icon: Dumbbell, color: '#7C3AED', bg: '#F1EBFE', t: T(lang, 'వ్యాయామం', 'Fitness'), go: () => navigate('/feed?cat=exercise') },
    { key: 'diet', icon: Salad, color: '#16A34A', bg: '#E8F7EE', t: T(lang, 'ఆహారం', 'Food & Diet'), go: () => navigate('/feed?cat=diet') },
    { key: 'ads', icon: Megaphone, color: '#EA580C', bg: '#FFF0E5', t: T(lang, 'ప్రకటనలు', 'Advertisements'), go: () => navigate('/post-ad') },
    { key: 'more', icon: Grid3x3, color: '#0B4EA2', bg: '#E8F1FC', t: T(lang, 'మరిన్ని', 'More'), go: () => setMoreOpen(true) },
  ];


  return (
    <div className="flex flex-col min-h-full bg-[#EEF3F8]">
      {/* Header */}
      <header className="w-full pt-safe shrink-0" style={{ background: BRAND_GRADIENT }}>
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <button type="button" aria-label="Menu" onClick={() => setDrawerOpen(true)}
            className="w-11 h-11 rounded-full bg-white/10 border-0 flex items-center justify-center text-white cursor-pointer shrink-0">
            <Menu className="w-6 h-6" />
          </button>
          <img src={logoUrl} alt="RTI Express" className="w-12 h-12 rounded-full bg-white object-contain shadow-md shrink-0" />
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-white font-black italic text-[19px] whitespace-nowrap">RTI Express</div>
            <div className="whitespace-nowrap"><span className="bg-[#E11D2E] text-white font-black italic text-[14px] px-1.5 rounded">Spot News</span> <span className="text-white font-black italic text-[14px]">24x7</span></div>
          </div>
          <button type="button" aria-label="Notifications" onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full bg-transparent border-0 flex items-center justify-center text-white cursor-pointer shrink-0">
            <Bell className="w-6 h-6" />
          </button>
        </div>
        <DoubleWave fill="#EEF3F8" height={54} />
      </header>

      <div className="w-full max-w-md mx-auto px-4 -mt-1 space-y-4 pb-28">
        {/* Portal switch: always visible, one tap between Readers and Reporters */}
        <div className="flex items-center gap-2">
          <div className="flex-1 grid grid-cols-2 p-1 rounded-2xl bg-white shadow-sm border border-[#D9E5F2]" role="tablist">
            <button type="button" role="tab" aria-selected={!isReporter} onClick={() => navigate('/')}
              className={`rounded-xl py-2.5 flex items-center justify-center gap-1.5 border-0 cursor-pointer text-[15.5px] font-extrabold ${!isReporter ? 'text-white shadow-md' : 'bg-transparent text-[#0B3E8A]'}`}
              style={!isReporter ? { background: 'linear-gradient(135deg,#0B4EA2,#2F80ED)' } : undefined}>
              <BookOpen className="w-5 h-5" /> {lang === 'en' ? 'Readers' : 'పాఠకులు'}
            </button>
            <button type="button" role="tab" aria-selected={isReporter} onClick={() => navigate(isReporter ? '/generate' : '/reporter')}
              className={`rounded-xl py-2.5 flex items-center justify-center gap-1.5 border-0 cursor-pointer text-[15.5px] font-extrabold ${isReporter ? 'text-white shadow-md' : 'bg-transparent text-[#B3121F]'}`}
              style={isReporter ? { background: 'linear-gradient(135deg,#E11D2E,#B30F1C)' } : undefined}>
              <Mic className="w-5 h-5" /> {lang === 'en' ? 'Reporters' : 'రిపోర్టర్లు'}
            </button>
          </div>
          <LangToggle />
        </div>

        {/* Live sky card: the district's real time of day + weather, and this hour's post */}
        <div className="relative rounded-[28px] overflow-hidden shadow-[0_14px_30px_rgba(11,62,138,0.25)]" style={{ background: sky.bg, minHeight: 236 }}>
          <SkyScene theme={sky} land={culture.land} seed={7} aspect={0.72} className="absolute inset-0 w-full h-full" />
          <div className="relative p-4 flex flex-col gap-2" style={{ color: sky.ink }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold flex items-center gap-1" style={{ color: sky.sub }}>
                  <Sparkles className="w-4 h-4 text-[#F59E0B]" /> AI Spot · {T(lang, 'మీ జిల్లా కోసం', 'for your district')[0]}
                </div>
                <div className="text-[25px] font-black leading-tight" style={{ textShadow: sky.dark ? '0 2px 10px rgba(0,0,0,.35)' : 'none' }}>{T(lang, greet[0], greet[1])[0]}</div>
                <button type="button" onClick={() => setPickerOpen(true)}
                  className="mt-0.5 flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer text-[16px] font-extrabold" style={{ color: sky.ink }}>
                  {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  {detecting ? (lang === 'en' ? 'Finding your area…' : 'మీ ప్రాంతం చూస్తున్నాం…') : placeMain}
                  <span className="text-[12.5px] font-bold underline ml-1" style={{ color: sky.sub }}>{detected && d ? (lang === 'en' ? 'auto · change' : 'ఆటో · మార్చండి') : (lang === 'en' ? 'change' : 'మార్చండి')}</span>
                </button>
              </div>
              <div className="text-right shrink-0 rounded-2xl px-3 py-2" style={{ background: sky.dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)' }}>
                <div className="text-[28px] font-black leading-none">{weather ? `${Math.round(weather.temperature)}°` : '--°'}</div>
                <div className="text-[12px] font-extrabold mt-0.5">{MOOD_LABEL[sky.mood][lang === 'en' ? 1 : 0]}</div>
                <div className="text-[11px] font-bold mt-0.5" style={{ color: sky.sub }}>🌅 {fmtClock(sun.rise)} · 🌇 {fmtClock(sun.set)}</div>
              </div>
            </div>
            {nowMoment && (
              <button type="button" onClick={() => navigate('/feed?cat=quote')}
                className="mt-auto w-full text-left rounded-2xl px-3.5 py-3 border-0 cursor-pointer flex items-center gap-3 active:scale-[0.99]"
                style={{ background: sky.dark ? 'rgba(10,14,40,0.55)' : 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)', color: sky.ink, marginTop: 34 }}>
                <span className="text-[30px] shrink-0">{nowMoment.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-extrabold" style={{ color: sky.sub }}>{lang === 'en' ? 'This hour' : 'ఈ గంట'} · {TOPIC_LABEL[(nowMoment.meta as any).topic as Topic][lang === 'en' ? 1 : 0]}</span>
                  <span className="block text-[16.5px] font-extrabold leading-snug line-clamp-2">{nowMoment.title_te.split('\n')[0]}</span>
                </span>
                <ChevronRight className="w-6 h-6 shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2.5">
          {isReporter ? (
            <button type="button" onClick={() => navigate('/generate')} className="rounded-2xl py-2.5 border-0 cursor-pointer text-white flex flex-col items-center gap-0.5 shadow-sm" style={{ background: 'linear-gradient(135deg,#E11D2E,#B30F1C)' }}>
              <PenSquare className="w-6 h-6" /><span className="text-[13.5px] font-extrabold">{lang === 'en' ? 'Create news' : 'వార్త పంపండి'}</span>
            </button>
          ) : (
            <button type="button" onClick={() => navigate('/post-ad')} className="rounded-2xl py-2.5 border-0 cursor-pointer text-white flex flex-col items-center gap-0.5 shadow-sm" style={{ background: 'linear-gradient(135deg,#F97316,#E11D2E)' }}>
              <Megaphone className="w-6 h-6" /><span className="text-[13.5px] font-extrabold">{lang === 'en' ? 'Post Ad' : 'ప్రకటన ఇవ్వండి'}</span>
            </button>
          )}
          <button type="button" onClick={openEpaper} className="rounded-2xl py-2.5 border-0 cursor-pointer text-white flex flex-col items-center gap-0.5 shadow-sm" style={{ background: 'linear-gradient(135deg,#0B4EA2,#2F80ED)' }}>
            <Newspaper className="w-6 h-6" /><span className="text-[13.5px] font-extrabold">{lang === 'en' ? 'E-Paper' : 'ఈ-పేపర్'}</span>
          </button>
          <button type="button" onClick={shareApp} className="rounded-2xl py-2.5 border-0 cursor-pointer text-white flex flex-col items-center gap-0.5 shadow-sm" style={{ background: 'linear-gradient(135deg,#16A34A,#0D9488)' }}>
            <Share2 className="w-6 h-6" /><span className="text-[13.5px] font-extrabold">{lang === 'en' ? 'Share app' : 'యాప్ షేర్'}</span>
          </button>
        </div>

        {/* Reporters wanted - tap to call */}
        <a href="tel:7668886666" className="no-underline flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-sm active:scale-[0.99]"
          style={{ background: 'linear-gradient(135deg,#E11D2E,#B30F1C)', textDecoration: 'none' }}>
          <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0"><Mic className="w-5 h-5 text-white" /></span>
          <span className="flex-1 min-w-0 leading-tight">
            <span className="block text-[16px] font-extrabold text-white">{lang === 'en' ? 'Reporters wanted' : 'రిపోర్టర్లు కావాలి'}</span>
            <span className="block text-[12.5px] font-semibold text-white/85 whitespace-nowrap">{lang === 'en' ? 'Call now' : 'Reporters wanted'}</span>
          </span>
          <span className="shrink-0 rounded-full bg-white text-[#B30F1C] px-3 py-1.5 text-[16px] font-black flex items-center gap-1">
            <Phone className="w-4 h-4" /> 7668886666
          </span>
        </a>
        {/* Breaking news slider */}
        {breaking.length > 0 ? (
          <div className="relative rounded-3xl overflow-hidden shadow-lg bg-[#0B1523] aspect-[16/10]"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 40) setSlide((s) => (s + (dx < 0 ? 1 : -1) + breaking.length) % breaking.length);
            }}>
            {breaking.map((c, i) => (
              <button key={c.id} type="button" onClick={() => openStory(c.id)}
                className={`absolute inset-0 w-full h-full border-0 p-0 cursor-pointer transition-opacity duration-500 ${i === cur ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <img src={clipPhoto(c)} alt="" className="w-full h-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
                <span className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,.82) 100%)' }} />
                <span className="absolute left-3 top-3 rounded-lg bg-[#E11D2E] text-white px-2.5 py-1 text-left leading-tight shadow">
                  <span className="block text-[14px] font-extrabold">{lang === 'en' ? 'Breaking News' : 'తాజా వార్తలు'}</span>
                  <span className="block text-[11.5px] font-bold opacity-90">{lang === 'en' ? 'తాజా వార్తలు' : 'Breaking News'}</span>
                </span>
                <span className="absolute left-0 right-0 bottom-0 px-12 pb-4 text-left">
                  <span className="block text-white text-[19px] font-extrabold leading-snug line-clamp-2">{headlineOf(c)}</span>
                  {c.district && c.district !== 'All' && <span className="block text-white/80 text-[13px] font-semibold mt-0.5">📍 {c.district}</span>}
                </span>
              </button>
            ))}
            {breaking.length > 1 && (
              <>
                <button type="button" aria-label="Previous" onClick={() => setSlide((s) => (s - 1 + breaking.length) % breaking.length)}
                  className="absolute left-2 bottom-6 w-8 h-8 rounded-full bg-white/85 border-0 flex items-center justify-center cursor-pointer"><ChevronLeft className="w-5 h-5" /></button>
                <button type="button" aria-label="Next" onClick={() => setSlide((s) => (s + 1) % breaking.length)}
                  className="absolute right-2 bottom-6 w-8 h-8 rounded-full bg-white/85 border-0 flex items-center justify-center cursor-pointer"><ChevronRight className="w-5 h-5" /></button>
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {breaking.map((c, i) => <span key={c.id} className={`h-2 rounded-full transition-all ${i === cur ? 'w-5 bg-[#E11D2E]' : 'w-2 bg-white/70'}`} />)}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-3xl bg-white border border-[#D9E5F2] aspect-[16/10] flex items-center justify-center text-[#64748B] text-[16px] font-bold gap-2">
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> {lang === 'en' ? 'Loading news…' : 'వార్తలు వస్తున్నాయి…'}</> : (lang === 'en' ? 'No news yet' : 'ఇంకా వార్తలు లేవు')}
          </div>
        )}

        {/* This hour: latest automatic posts as mini posters */}
        {recentMoments.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[18px] font-extrabold text-[#0B3E8A] flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-[#F59E0B]" /> {lang === 'en' ? 'For you today' : 'ఈ రోజు మీ కోసం'}
              </span>
              <button type="button" onClick={() => navigate('/feed?cat=quote')}
                className="text-[15px] font-extrabold text-[#0B4EA2] bg-transparent border-0 cursor-pointer flex items-center gap-0.5">
                {lang === 'en' ? 'See All' : 'అన్నీ'} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              {recentMoments.map((m) => {
                const th = skyTheme({ minute: istMinute(m.publish_at), rise: sun.rise, set: sun.set, mood, seed: Number((m.meta as any).seed) || 1 });
                return (
                  <button key={m.publish_at} type="button" onClick={() => navigate('/feed?cat=quote')}
                    className="relative shrink-0 w-[150px] h-[190px] rounded-2xl overflow-hidden border-0 cursor-pointer text-left shadow-md p-0" style={{ background: th.bg }}>
                    <SkyScene theme={th} land={culture.land} seed={Number((m.meta as any).seed) % 997} aspect={1.27} className="absolute inset-0 w-full h-full" />
                    <span className="absolute inset-x-0 bottom-0 p-2.5" style={{ background: th.dark ? 'linear-gradient(180deg,transparent,rgba(5,8,30,.75))' : 'linear-gradient(180deg,transparent,rgba(255,255,255,.92))', color: th.ink }}>
                      <span className="block text-[22px] leading-none">{m.emoji}</span>
                      <span className="block text-[11.5px] font-extrabold mt-1" style={{ color: th.sub }}>{TOPIC_LABEL[(m.meta as any).topic as Topic][lang === 'en' ? 1 : 0]}</span>
                      <span className="block text-[14px] font-extrabold leading-snug line-clamp-3">{m.title_te.split('\n')[0]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Category tiles */}
        <div className="grid grid-cols-3 gap-3">
          {tiles.map(({ key, icon: Icon, color, bg, t, go, sub }) => (
            <button key={key} type="button" onClick={go}
              className="bg-white rounded-2xl border border-[#D9E5F2] shadow-sm py-3.5 px-1 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform">
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center relative" style={{ background: bg }}>
                <Icon className="w-7 h-7" style={{ color }} strokeWidth={2.2} />
                {sub && <span className="absolute -top-1.5 -right-3 bg-[#0B4EA2] text-white text-[11px] font-extrabold rounded-full px-1.5 py-0.5">{sub}</span>}
              </span>
              <span className="text-[15px] font-extrabold text-[#0F172A] leading-tight text-center">{t[0]}</span>
              <span className="text-[12px] font-semibold text-[#64748B] leading-tight text-center">{t[1]}</span>
            </button>
          ))}
        </div>

        {/* Quick news */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="rounded-full px-4 py-1.5 text-white text-[16px] font-extrabold" style={{ background: BRAND_GRADIENT }}>
              {lang === 'en' ? 'Quick News' : 'త్వరిత వార్తలు'} <span className="text-[13px] font-bold opacity-85">· {lang === 'en' ? 'త్వరిత వార్తలు' : 'Quick News'}</span>
            </span>
            <button type="button" onClick={() => navigate('/feed')}
              className="text-[15px] font-extrabold text-[#0B4EA2] bg-transparent border-0 cursor-pointer flex items-center gap-0.5">
              {lang === 'en' ? 'See All' : 'అన్నీ చూడండి'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-[#D9E5F2] shadow-sm divide-y divide-[#EEF2F7] overflow-hidden">
            {quick.length === 0 && (
              <div className="p-6 text-center text-[#64748B] text-[15px] font-bold">{loading ? (lang === 'en' ? 'Loading…' : 'లోడ్ అవుతోంది…') : (lang === 'en' ? 'No news yet' : 'ఇంకా వార్తలు లేవు')}</div>
            )}
            {quick.map((c) => {
              const photo = clipPhoto(c);
              const [ago] = timeAgoPair(c.created_at).slice(lang === 'en' ? 1 : 0);
              return (
                <button key={c.id} type="button" onClick={() => openStory(c.id)}
                  className="w-full flex items-center gap-3 p-3 bg-transparent border-0 cursor-pointer text-left active:bg-[#F6F9FD]">
                  <span className="w-[92px] h-[68px] rounded-xl overflow-hidden bg-[#E8F1FC] shrink-0 flex items-center justify-center">
                    {photo ? <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Newspaper className="w-7 h-7 text-[#0B4EA2]" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[16.5px] font-extrabold text-[#0F172A] leading-snug line-clamp-2">{headlineOf(c)}</span>
                    <span className="block text-[13px] text-[#64748B] font-semibold mt-1">
                      {c.district && c.district !== 'All' ? `📍 ${c.district} · ` : ''}{ago}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <DistrictPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)}
        onPicked={(_d, mode) => setDetected(mode === 'auto')} />

      {/* More sheet */}
      {moreOpen && (
        <Sheet onClose={() => setMoreOpen(false)} title={T(lang, 'మరిన్ని', 'More')}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Leaf, color: '#059669', t: T(lang, 'పర్యావరణం', 'Environment'), go: () => navigate('/feed?cat=sustainability') },
              { icon: Newspaper, color: '#0B4EA2', t: T(lang, 'ఈ-పేపర్', 'E-Paper'), go: openEpaper },
              { icon: Mic, color: '#E11D2E', t: T(lang, 'రిపోర్టర్ పోర్టల్', 'Reporter Portal'), go: () => navigate(isReporter ? '/reporter/status' : '/reporter') },
              { icon: Share2, color: '#0B4EA2', t: T(lang, 'యాప్ షేర్', 'Share App'), go: shareApp },
            ].map(({ icon: Icon, color, t, go }) => (
              <button key={t[1]} type="button" onClick={() => { setMoreOpen(false); go(); }}
                className="bg-[#F8FAFD] rounded-2xl border border-[#E2E8F0] py-3 px-1 flex flex-col items-center gap-1 cursor-pointer active:scale-95">
                <Icon className="w-7 h-7" style={{ color }} />
                <span className="text-[14px] font-extrabold text-[#0F172A] text-center leading-tight">{t[0]}</span>
                <span className="text-[11.5px] text-[#64748B] text-center leading-tight">{t[1]}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {/* Side menu */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[180] bg-black/50" onClick={() => setDrawerOpen(false)}>
          <div className="h-full w-[82%] max-w-[320px] bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="pt-safe" style={{ background: BRAND_GRADIENT }}>
              <div className="flex items-center gap-3 p-4">
                <img src={logoUrl} alt="" className="w-14 h-14 rounded-full bg-white object-contain" />
                <div className="flex-1 text-white font-black italic text-[18px] leading-tight">RTI Express<br /><span className="text-[14px]">Spot News 24x7</span></div>
                <button type="button" aria-label="Close" onClick={() => setDrawerOpen(false)} className="w-9 h-9 rounded-full bg-white/15 border-0 text-white flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {[
                { icon: Home, t: T(lang, 'హోమ్', 'Home'), go: () => navigate('/') },
                { icon: Newspaper, t: T(lang, 'వార్తలు', 'News'), go: () => navigate('/feed') },
                { icon: CloudSun, t: T(lang, 'వాతావరణం', 'Weather'), go: () => navigate('/feed?cat=weather') },
                { icon: Megaphone, t: T(lang, 'ప్రకటన ఇవ్వండి', 'Post Ad'), go: () => navigate('/post-ad') },
                { icon: MapPin, t: T(lang, 'ప్రాంతం మార్చండి', 'Change area'), go: () => setPickerOpen(true) },
                { icon: Mic, t: T(lang, 'రిపోర్టర్ పోర్టల్', 'Reporter Portal'), go: () => navigate(isReporter ? '/reporter/status' : '/reporter') },
                { icon: Newspaper, t: T(lang, 'ఈ-పేపర్', 'E-Paper'), go: openEpaper },
                { icon: Share2, t: T(lang, 'యాప్ షేర్ చేయండి', 'Share the app'), go: shareApp },
                { icon: Settings, t: T(lang, 'సెట్టింగ్స్', 'Settings'), go: () => navigate('/settings') },
              ].map(({ icon: Icon, t, go }) => (
                <button key={t[1]} type="button" onClick={() => { setDrawerOpen(false); go(); }}
                  className="w-full flex items-center gap-4 px-5 py-3.5 bg-transparent border-0 cursor-pointer text-left active:bg-[#F1F5F9]">
                  <Icon className="w-6 h-6 text-[#0B4EA2]" />
                  <span><span className="block text-[17px] font-extrabold text-[#0F172A]">{t[0]}</span><span className="block text-[13px] text-[#64748B]">{t[1]}</span></span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};

const Sheet: React.FC<{ title: [string, string]; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[190] flex items-end justify-center bg-black/50" onClick={onClose}>
    <div className="w-full max-w-md bg-white rounded-t-3xl p-5 pb-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <div><p className="text-[20px] font-extrabold text-[#0F172A] m-0">{title[0]}</p><p className="text-[14px] text-[#64748B] m-0">{title[1]}</p></div>
        <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-[#F1F5F9] border-0 flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
      </div>
      {children}
    </div>
  </div>
);
