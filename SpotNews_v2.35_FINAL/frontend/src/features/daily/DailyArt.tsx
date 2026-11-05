import React from 'react';
import {
  Apple, Banana, Bed, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Coffee, CookingPot, CupSoda,
  Droplets, Dumbbell, Earth, Egg, Fish, Footprints, GlassWater, HeartPulse, Leaf, Milk, MoonStar, PersonStanding,
  Recycle, Salad, Soup, Sparkles, Sprout, Stethoscope, Sun, Sunrise, Thermometer, ThermometerSun, Tractor, TreePine,
  Umbrella, UtensilsCrossed, Wheat, Wind, GraduationCap, BookOpen, Briefcase, Bot, Smartphone, ShieldCheck, Target,
  TrendingUp, Heart, HandHeart, Brain, ShoppingBag, Tag, Percent, Quote, AlarmClock, Smile, Landmark, Sunset, Users, Home, ScrollText, type LucideIcon,
} from 'lucide-react';
import type { DailyPost, PostKind } from './dailyContentEngine';

type Cond = 'storm' | 'heavyRain' | 'rain' | 'heat' | 'hot' | 'cold' | 'fog' | 'humid' | 'pleasant';

const WEATHER_ICON: Record<Cond, { icon: LucideIcon; color: string; te: string; en: string }> = {
  storm: { icon: CloudLightning, color: '#4338CA', te: 'ఉరుములు', en: 'Thunderstorm' },
  heavyRain: { icon: CloudRain, color: '#1D4ED8', te: 'భారీ వర్షం', en: 'Heavy rain' },
  rain: { icon: CloudDrizzle, color: '#2563EB', te: 'వర్షం', en: 'Rain' },
  heat: { icon: ThermometerSun, color: '#DC2626', te: 'తీవ్ర ఎండ', en: 'Heat wave' },
  hot: { icon: Sun, color: '#F59E0B', te: 'ఎండ', en: 'Sunny & hot' },
  cold: { icon: Wind, color: '#0EA5E9', te: 'చలి', en: 'Cold' },
  fog: { icon: CloudFog, color: '#64748B', te: 'పొగమంచు', en: 'Fog' },
  humid: { icon: Droplets, color: '#0891B2', te: 'తేమ', en: 'Humid' },
  pleasant: { icon: CloudSun, color: '#F59E0B', te: 'ఆహ్లాదం', en: 'Pleasant' },
};

/** Main picture + two small pictures for each kind of daily post. */
function heroFor(post: DailyPost): { main: LucideIcon; mainColor: string; side: { icon: LucideIcon; color: string }[] } {
  const cond = (post.meta?.condition as Cond) || 'pleasant';
  const w = WEATHER_ICON[cond] || WEATHER_ICON.pleasant;
  const rainy = cond === 'rain' || cond === 'heavyRain' || cond === 'storm';
  const map: Record<PostKind, ReturnType<typeof heroFor>> = {
    weather: { main: w.icon, mainColor: w.color, side: [{ icon: Thermometer, color: '#DC2626' }, { icon: rainy ? Umbrella : Droplets, color: '#2563EB' }] },
    agri: { main: Sprout, mainColor: '#16A34A', side: [{ icon: Wheat, color: '#CA8A04' }, { icon: rainy ? CloudRain : Tractor, color: rainy ? '#2563EB' : '#B45309' }] },
    diet: { main: Salad, mainColor: '#16A34A', side: [{ icon: Banana, color: '#CA8A04' }, { icon: GlassWater, color: '#0284C7' }] },
    health: { main: HeartPulse, mainColor: '#DC2626', side: [{ icon: Stethoscope, color: '#0F766E' }, { icon: GlassWater, color: '#0284C7' }] },
    exercise: { main: PersonStanding, mainColor: '#B4232F', side: [{ icon: Dumbbell, color: '#334155' }, { icon: Footprints, color: '#EA580C' }] },
    sustainability: { main: Earth, mainColor: '#15803D', side: [{ icon: Recycle, color: '#0F766E' }, { icon: TreePine, color: '#166534' }] },
    morning: { main: Sunrise, mainColor: '#EA580C', side: [{ icon: Coffee, color: '#92400E' }, { icon: Sparkles, color: '#CA8A04' }] },
    night: { main: MoonStar, mainColor: '#4338CA', side: [{ icon: Bed, color: '#6366F1' }, { icon: Sparkles, color: '#A5B4FC' }] },
    affirmation: { main: Smile, mainColor: '#EA580C', side: [{ icon: Heart, color: '#E11D2E' }, { icon: Sun, color: '#F59E0B' }] },
    career: { main: GraduationCap, mainColor: '#1D4ED8', side: [{ icon: BookOpen, color: '#7C3AED' }, { icon: Briefcase, color: '#B45309' }] },
    tech: { main: Bot, mainColor: '#0F766E', side: [{ icon: Smartphone, color: '#334155' }, { icon: ShieldCheck, color: '#16A34A' }] },
    youth: { main: Target, mainColor: '#DC2626', side: [{ icon: TrendingUp, color: '#16A34A' }, { icon: Sparkles, color: '#CA8A04' }] },
    mindcare: { main: Brain, mainColor: '#7C3AED', side: [{ icon: HandHeart, color: '#DB2777' }, { icon: Leaf, color: '#16A34A' }] },
    sleep: { main: Bed, mainColor: '#4338CA', side: [{ icon: MoonStar, color: '#A5B4FC' }, { icon: AlarmClock, color: '#C7D2FE' }] },
    deals: { main: ShoppingBag, mainColor: '#EA580C', side: [{ icon: Tag, color: '#DB2777' }, { icon: Percent, color: '#16A34A' }] },
    quote: { main: Quote, mainColor: '#B45309', side: [{ icon: Sparkles, color: '#CA8A04' }, { icon: Heart, color: '#E11D2E' }] },
  };
  // Hourly posts: picture by topic
  const byTopic: Record<string, ReturnType<typeof heroFor>> = {
    sunrise: { main: Sunrise, mainColor: '#EA580C', side: [{ icon: Smile, color: '#F59E0B' }, { icon: Heart, color: '#E11D2E' }] },
    drink: { main: CupSoda, mainColor: '#0891B2', side: [{ icon: GlassWater, color: '#0284C7' }, { icon: Leaf, color: '#16A34A' }] },
    food: { main: CookingPot, mainColor: '#B45309', side: [{ icon: Salad, color: '#16A34A' }, { icon: Wheat, color: '#CA8A04' }] },
    pride: { main: Landmark, mainColor: '#0B4EA2', side: [{ icon: Sprout, color: '#16A34A' }, { icon: Heart, color: '#E11D2E' }] },
    padyam: { main: ScrollText, mainColor: '#92400E', side: [{ icon: BookOpen, color: '#7C3AED' }, { icon: Sparkles, color: '#CA8A04' }] },
    sunset: { main: Sunset, mainColor: '#EA580C', side: [{ icon: HandHeart, color: '#DB2777' }, { icon: Sparkles, color: '#CA8A04' }] },
    family: { main: Home, mainColor: '#0B4EA2', side: [{ icon: Users, color: '#DB2777' }, { icon: Heart, color: '#E11D2E' }] },
    pause: { main: Brain, mainColor: '#7C3AED', side: [{ icon: Leaf, color: '#16A34A' }, { icon: Wind, color: '#0EA5E9' }] },
    nightcalm: { main: MoonStar, mainColor: '#6366F1', side: [{ icon: Sparkles, color: '#A5B4FC' }, { icon: Heart, color: '#F472B6' }] },
  };
  const t = (post.meta as any)?.topic as string | undefined;
  return (t && byTopic[t]) || map[post.kind] || map.weather;
}

export const DailyHero: React.FC<{ post: DailyPost; dark: boolean; small?: boolean }> = ({ post, dark, small }) => {
  const h = heroFor(post);
  const Main = h.main;
  const cond = (post.meta?.condition as Cond) || null;
  const m = post.meta || {};
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : null);
  const tMax = num(m.tMax), tMin = num(m.tMin), rain = num(m.rainProb), hum = num(m.humidity);
  const ring = dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.92)';
  return (
    <div className="flex items-center gap-4 mb-3" style={small ? { zoom: 0.78 } as any : undefined}>
      <div className="relative w-[104px] h-[104px] shrink-0">
        <div className="absolute inset-0 rounded-full flex items-center justify-center shadow-lg" style={{ background: ring }}>
          <Main className="w-[60px] h-[60px]" style={{ color: dark ? '#E0E7FF' : h.mainColor }} strokeWidth={1.9} />
        </div>
        {h.side.map(({ icon: Icon, color }, i) => (
          <div key={i} className={`absolute w-10 h-10 rounded-full flex items-center justify-center shadow-md ${i === 0 ? '-right-2 -top-1' : '-right-3 bottom-0'}`}
            style={{ background: dark ? 'rgba(255,255,255,0.22)' : '#FFFFFF' }}>
            <Icon className="w-6 h-6" style={{ color: dark ? '#fff' : color }} strokeWidth={2.2} />
          </div>
        ))}
      </div>
      {/* Weather numbers (shown on weather, farming and morning cards when available) */}
      {(post.kind === 'weather' || post.kind === 'agri' || post.kind === 'morning' || post.kind === 'night') && tMax !== null && (
        <div className="flex flex-wrap gap-1.5 text-[14px] font-extrabold">
          {cond && WEATHER_ICON[cond] && (
            <span className="rounded-full px-2.5 py-1" style={{ background: ring, color: dark ? '#fff' : WEATHER_ICON[cond].color }}>
              {WEATHER_ICON[cond].te} · {WEATHER_ICON[cond].en}
            </span>
          )}
          <span className="rounded-full px-2.5 py-1 flex items-center gap-1" style={{ background: ring }}>
            <Thermometer className="w-4 h-4" /> {tMin !== null ? `${tMin}°–` : ''}{tMax}°C
          </span>
          {rain !== null && (
            <span className="rounded-full px-2.5 py-1 flex items-center gap-1" style={{ background: ring }}>
              <Umbrella className="w-4 h-4" /> {rain}%
            </span>
          )}
          {hum !== null && (
            <span className="rounded-full px-2.5 py-1 flex items-center gap-1" style={{ background: ring }}>
              <Droplets className="w-4 h-4" /> {hum}%
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/** Food picture for a meal line: picks by food words in the text, otherwise by time of day. */
export function foodIcon(label: string | undefined, text: string): { icon: LucideIcon; color: string } {
  const t = text || '';
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has('అరటి', 'పండ', 'బొప్పాయి', 'జామ', 'మామిడి', 'fruit')) return { icon: Banana, color: '#CA8A04' };
  if (has('ఆపిల్', 'దానిమ్మ')) return { icon: Apple, color: '#DC2626' };
  if (has('అన్నం', 'పప్పు')) return { icon: CookingPot, color: '#B45309' };
  if (has('రాగి', 'జొన్న', 'సజ్జ', 'రొట్టె', 'చపాతీ')) return { icon: Wheat, color: '#B45309' };
  if (has('మజ్జిగ', 'పాలు', 'పెరుగు', 'buttermilk', 'milk')) return { icon: Milk, color: '#0284C7' };
  if (has('కొబ్బరి నీళ్ళు', 'నిమ్మ', 'జ్యూస్', 'రసం', 'నీళ్ళు', 'నీరు')) return { icon: CupSoda, color: '#0891B2' };
  if (has('గుడ్డు', 'egg')) return { icon: Egg, color: '#CA8A04' };
  if (has('చేప', 'fish')) return { icon: Fish, color: '#0369A1' };
  if (has('ఆకుకూర', 'కూరగాయ', 'సలాడ్')) return { icon: Salad, color: '#16A34A' };
  if (has('సూప్', 'చారు', 'సాంబార్')) return { icon: Soup, color: '#EA580C' };
  switch (label) {
    case 'ఉదయం': return { icon: Coffee, color: '#92400E' };
    case 'మధ్యాహ్నం': return { icon: CookingPot, color: '#B45309' };
    case 'సాయంత్రం': return { icon: Apple, color: '#DC2626' };
    case 'రాత్రి': return { icon: UtensilsCrossed, color: '#475569' };
    default: return { icon: Leaf, color: '#16A34A' };
  }
}


