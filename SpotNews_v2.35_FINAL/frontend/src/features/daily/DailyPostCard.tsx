import React, { useRef, useState } from 'react';
import { Share2, Loader2, Sparkles } from 'lucide-react';
import { findDistrict, type DailyPost, type PostKind } from './dailyContentEngine';
import { nodeToImage, shareImage } from '@/features/share/shareImage';
import { PLAY_STORE_URL, shareCaption } from '@/features/share/links';
import { DailyHero, foodIcon } from './DailyArt';
import logoUrl from '@/assets/rti_express_logo.png';
import { FitBox } from '@/components/FitBox';
import { SkyScene } from '@/features/moments/SkyScene';
import { cultureOf } from '@/features/moments/districtCulture';
import { TOPIC_LABEL, type Layout, type Topic } from '@/features/moments/momentsEngine';
import {
  getLiveMood, hashStr, istMinute, moodOf, MOOD_LABEL, PHASE_LABEL, skyTheme, sunTimes, type Mood,
} from '@/features/moments/sky';

/**
 * Full-screen card for every automatic post (daily + hourly).
 * Colours follow the real sky of the district at that hour (sunrise, noon, sunset, night) and the weather
 * (rain, heat, clouds, mist). Four layouts rotate, so two cards in a row never look alike.
 * Content always fits one screen: one swipe = next card.
 */
const KIND_LABEL: Record<PostKind, string> = {
  morning: 'శుభోదయం', weather: 'వాతావరణం', agri: 'వ్యవసాయం', diet: 'ఆహారం', health: 'ఆరోగ్యం', exercise: 'ఫిట్‌నెస్',
  sustainability: 'పర్యావరణం', night: 'శుభరాత్రి', affirmation: 'పాజిటివ్ ఉదయం', career: 'కెరీర్', tech: 'టెక్ & AI',
  youth: 'యువత', mindcare: 'మనసు', sleep: 'నిద్ర', deals: 'షాపింగ్', quote: 'ఆలోచన',
};

const COND_MOOD: Record<string, Mood> = {
  storm: 'storm', heavyRain: 'rain', rain: 'rain', heat: 'heat', hot: 'heat', cold: 'cold', fog: 'fog', humid: 'cloudy', pleasant: 'clear',
};

function defaultLayout(post: DailyPost, seed: number): Layout {
  if (post.kind === 'quote' || post.kind === 'morning' || post.kind === 'night') return seed % 2 ? 'poster' : 'frame';
  const many = (post.bullets?.length || 0) >= 3;
  if (many) return seed % 3 === 0 ? 'panel' : 'top';
  return (['top', 'panel', 'poster'] as Layout[])[seed % 3];
}

export const DailyPostCard: React.FC<{ post: DailyPost }> = ({ post }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const meta = (post.meta || {}) as Record<string, any>;
  const info = findDistrict(post.district);
  const culture = cultureOf(post.district);
  const seed = typeof meta.seed === 'number' ? meta.seed : hashStr(`${post.district}${post.post_date}${post.kind}`);
  const minute = istMinute(post.publish_at);
  const sun = info ? sunTimes(info.lat, info.lng, post.post_date) : { rise: 370, set: 1070 };
  const mood: Mood = (meta.mood as Mood) || COND_MOOD[meta.condition as string] || getLiveMood() || moodOf(null);
  const theme = skyTheme({ minute, rise: sun.rise, set: sun.set, mood, seed });
  const layout: Layout = (meta.layout as Layout) || defaultLayout(post, seed);
  const topic = meta.topic as Topic | undefined;
  const label = topic ? TOPIC_LABEL[topic][0] : KIND_LABEL[post.kind];
  const isQuote = !!meta.quote || post.kind === 'quote' || layout === 'poster';
  const quoteMarks = !!meta.quote || (post.kind === 'quote' && !topic);
  const verse = !!meta.verse;
  const links = (meta.links || []) as { label: string; url: string }[];
  const { dark, ink, sub, panel, accent } = theme;
  const h = Math.floor(minute / 60), m = String(minute % 60).padStart(2, '0');
  const timeLabel = `${h >= 12 ? 'సా' : 'ఉ'}. ${h > 12 ? h - 12 : h}:${m}`;

  const openLink = async (url: string) => {
    try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url }); }
    catch { window.open(url, '_blank'); }
  };

  const share = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const dataUrl = await nodeToImage(cardRef.current);
      await shareImage({
        dataUrl, caption: shareCaption(post.title_te.split('\n')[0], PLAY_STORE_URL), channel: 'other', kind: 'story_card',
        postId: `daily-${post.district}-${post.post_date}-${post.kind}-${minute}`,
      });
    } catch (err) { console.warn('Daily post share failed', err); }
    finally { setSharing(false); }
  };

  // ── pieces ──
  const title = (
    <h2 className={`m-0 font-extrabold whitespace-pre-line ${verse ? 'text-[24px] leading-[1.6]' : isQuote ? 'text-[30px] leading-[1.42]' : 'text-[26px] leading-[1.3]'}`}
      style={{ color: ink, textShadow: dark ? '0 2px 12px rgba(0,0,0,0.35)' : 'none' }}>
      {quoteMarks && !verse ? `“${post.title_te}”` : post.title_te}
    </h2>
  );
  const subtitle = post.subtitle_en ? <p className="text-[14.5px] font-semibold mt-1.5 mb-0" style={{ color: sub }}>{post.subtitle_en}</p> : null;
  const body = post.body_te ? (
    <p className={`mt-3 mb-0 whitespace-pre-line font-semibold ${isQuote ? 'text-[19px] leading-[1.6]' : 'text-[19px] leading-[1.6]'}`} style={{ color: ink }}>{post.body_te}</p>
  ) : null;
  const bullets = post.bullets?.length ? (
    <div className="mt-4 rounded-2xl p-4 space-y-3 w-full text-left backdrop-blur-sm" style={{ background: panel, color: ink }}>
      {post.bullets.map((b, i) => (
        <div key={i} className="flex gap-3 items-start">
          {post.kind === 'diet' && !topic && (() => {
            const f = foodIcon(b.label, b.text); const Icon = f.icon;
            return <span className="shrink-0 w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center"><Icon className="w-5 h-5" style={{ color: f.color }} strokeWidth={2.3} /></span>;
          })()}
          {b.label ? (
            <span className="shrink-0 text-[13px] font-extrabold px-2 py-0.5 rounded-md mt-0.5" style={{ background: accent, color: dark ? '#1A1033' : '#fff' }}>{b.label}</span>
          ) : (
            <span className="shrink-0 w-2.5 h-2.5 rounded-full mt-[9px]" style={{ background: accent }} />
          )}
          <span className="text-[17.5px] leading-[1.55] font-medium">{b.text}</span>
        </div>
      ))}
    </div>
  ) : null;
  const linkRow = links.length ? (
    <div className="mt-4 flex flex-wrap gap-2 w-full">
      {links.map((l) => (
        <button key={l.url} type="button" onClick={(e) => { e.stopPropagation(); openLink(l.url); }}
          className="flex-1 min-w-[45%] rounded-xl px-3 py-2.5 text-[15px] font-extrabold border-0 cursor-pointer shadow-sm"
          style={{ background: accent, color: dark ? '#1A1033' : '#fff' }}>🔗 {l.label}</button>
      ))}
    </div>
  ) : null;
  const footer = post.footer_te ? <p className="text-[13.5px] leading-relaxed mt-3 mb-0 font-semibold" style={{ color: sub }}>ⓘ {post.footer_te}</p> : null;

  const sceneBg = (opacity = 1) => (
    <SkyScene theme={theme} land={culture.land} seed={seed % 997} aspect={1.9} className="absolute inset-x-0 bottom-0 w-full h-full pointer-events-none" style={{ opacity }} />
  );

  let main: React.ReactNode;
  if (layout === 'top') {
    main = (
      <>
        <div className="relative shrink-0" style={{ height: '30%' }}>
          <SkyScene theme={theme} land={culture.land} seed={seed % 997} aspect={0.6} className="absolute inset-0 w-full h-full" />
          <div className="absolute left-4 bottom-3"><DailyHero post={post} dark={dark} small /></div>
        </div>
        <FitBox className="flex-1 min-h-0 px-5 pt-3 pb-2 relative" innerClassName="flex flex-col">
          {title}{subtitle}{body}{bullets}{linkRow}{footer}
        </FitBox>
      </>
    );
  } else if (layout === 'panel') {
    main = (
      <>
        {sceneBg(0.95)}
        <FitBox className="flex-1 min-h-0 px-4 pt-2 pb-3 relative" innerClassName="flex flex-col">
          <DailyHero post={post} dark={dark} small />
          <div className="rounded-3xl p-4 shadow-xl" style={{ background: dark ? 'rgba(10,14,40,0.55)' : 'rgba(255,255,255,0.86)', backdropFilter: 'blur(6px)' }}>
            {title}{subtitle}{body}
            {post.bullets?.length ? (
              <div className="mt-3 space-y-2.5">
                {post.bullets.map((b, i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <span className="shrink-0 text-[12.5px] font-extrabold px-2 py-0.5 rounded-md mt-0.5" style={{ background: accent, color: dark ? '#1A1033' : '#fff' }}>{b.label || '•'}</span>
                    <span className="text-[17px] leading-[1.5] font-medium" style={{ color: ink }}>{b.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {linkRow}{footer}
          </div>
        </FitBox>
      </>
    );
  } else {
    // poster (big centred text) or frame (verse / affirmation with a decorative border)
    const framed = layout === 'frame';
    main = (
      <>
        {sceneBg(framed ? 0.55 : 0.9)}
        <FitBox className="flex-1 min-h-0 px-5 py-3 relative flex" innerClassName="m-auto w-full flex flex-col items-center text-center">
          <div className={framed ? 'w-full rounded-[26px] px-5 py-6 relative' : 'w-full px-1'}
            style={framed ? { border: `2px solid ${accent}`, outline: `6px double ${dark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)'}`, outlineOffset: 4, background: dark ? 'rgba(10,14,40,0.38)' : 'rgba(255,255,255,0.55)' } : undefined}>
            {framed && ['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos) => (
              <span key={pos} className={`absolute ${pos} text-[16px]`} style={{ color: accent }}>✦</span>
            ))}
            <div className="flex justify-center mb-2"><DailyHero post={post} dark={dark} small /></div>
            {title}
            {subtitle}
            {body}
            {bullets}{linkRow}{footer}
          </div>
        </FitBox>
      </>
    );
  }

  return (
    <div className="w-full h-full snap-start snap-always flex flex-col bg-black border-b border-gray-800 relative p-3 box-border shrink-0" style={{ minHeight: '100%' }}>
      <div ref={cardRef} className="flex-1 w-full rounded-[22px] overflow-hidden shadow-2xl flex flex-col relative min-h-0" style={{ background: theme.bg, color: ink }}>
        {/* Faint RTI Express logo watermark */}
        <img src={logoUrl} alt="" aria-hidden className="absolute pointer-events-none select-none z-[1]" style={{ width: 210, right: -46, bottom: 70, opacity: dark ? 0.07 : 0.09 }} />

        {/* Top row */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 relative z-[2] shrink-0">
          <span className="flex items-center gap-2 min-w-0">
            <img src={logoUrl} alt="RTI Express" className="w-10 h-10 rounded-full bg-white object-contain shadow-md shrink-0" />
            <span className="leading-tight whitespace-nowrap">
              <span className="block text-[13px] font-black italic" style={{ color: dark ? '#fff' : '#0B3E8A' }}>RTI Express</span>
              <span className="block text-[11.5px] font-black italic"><span className="bg-[#E11D2E] text-white px-1 rounded">Spot News</span> <span style={{ color: dark ? '#fff' : '#0B3E8A' }}>24x7</span></span>
            </span>
          </span>
          <span className="text-[12.5px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 min-w-0 truncate" style={{ background: dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.78)', color: dark ? '#fff' : '#0B3E8A' }}>
            <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: '#F59E0B' }} /> <span className="truncate">RTI Desk · {label}</span>
          </span>
        </div>
        <div className="px-4 pt-1 text-[12px] font-bold relative z-[2] shrink-0 truncate" style={{ color: sub }}>
          📍 {info?.te || post.district} · {timeLabel} · {PHASE_LABEL[theme.phase][0]} · {MOOD_LABEL[theme.mood][0]}
        </div>

        <div className="flex-1 min-h-0 flex flex-col relative z-[2]">{main}</div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 py-2.5 relative z-[2] shrink-0" style={{ background: dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)' }}>
          <span className="flex items-center gap-2 min-w-0">
            <img src={logoUrl} alt="" className="w-7 h-7 rounded-full bg-white object-contain shrink-0" />
            <span className="leading-tight min-w-0">
              <span className="block text-[12.5px] font-extrabold truncate" style={{ color: dark ? '#fff' : '#0A2540' }}>RTI Express Spot News 24x7</span>
              <span className="block text-[10.5px] font-bold truncate" style={{ color: sub }}>RTI Desk తో మీ జిల్లా కోసం ప్రత్యేకం</span>
            </span>
          </span>
          <button type="button" onClick={share}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[14px] font-extrabold border-0 cursor-pointer active:scale-95 transition-transform shrink-0"
            style={{ background: dark ? '#FFD166' : '#0B56A6', color: dark ? '#1A1033' : '#fff' }}>
            {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} షేర్
          </button>
        </div>
      </div>
    </div>
  );
};
