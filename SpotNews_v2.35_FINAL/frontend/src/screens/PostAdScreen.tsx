import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, CalendarDays, CheckCircle2, GraduationCap, Home as HomeIcon, ListChecks, Megaphone,
  MoreHorizontal, Plus, Store, Tag, Wrench,
} from 'lucide-react';
import logoUrl from '@/assets/rti_express_logo.png';
import { BRAND_GRADIENT, DoubleWave } from '@/components/BrandHeader';
import { useLang, pair } from '@/lib/lang';

const AD_CATEGORIES = [
  { key: 'business', te: 'వ్యాపారం', en: 'Business', icon: Store, color: '#E11D2E' },
  { key: 'jobs', te: 'ఉద్యోగాలు', en: 'Jobs', icon: Briefcase, color: '#0B4EA2' },
  { key: 'real_estate', te: 'రియల్ ఎస్టేట్', en: 'Real Estate', icon: HomeIcon, color: '#F59E0B' },
  { key: 'education', te: 'విద్య', en: 'Education', icon: GraduationCap, color: '#1D4ED8' },
  { key: 'health', te: 'ఆరోగ్యం & క్లినిక్స్', en: 'Health & Clinics', icon: Plus, color: '#DC2626' },
  { key: 'events', te: 'కార్యక్రమాలు', en: 'Events', icon: CalendarDays, color: '#EA580C' },
  { key: 'buy_sell', te: 'కొనుగోలు / అమ్మకం', en: 'Buy / Sell', icon: Tag, color: '#F59E0B' },
  { key: 'services', te: 'సేవలు', en: 'Services', icon: Wrench, color: '#16A34A' },
  { key: 'others', te: 'ఇతరులు', en: 'Others', icon: MoreHorizontal, color: '#E11D2E' },
] as const;

type AdCategoryKey = (typeof AD_CATEGORIES)[number]['key'];

export const PostAdScreen: React.FC = () => {
  const navigate = useNavigate();
  const [lang] = useLang();
  const [picked, setPicked] = useState<AdCategoryKey | null>(null);

  const [titleA, titleB] = pair(lang, 'ప్రకటనను ఇవ్వండి', 'Post Advertisement');
  const [selA, selB] = pair(lang, 'వర్గాన్ని ఎంచుకోండి', 'Select Category');

  const create = () => {
    const c = AD_CATEGORIES.find((x) => x.key === picked);
    navigate('/ad-requests', { state: { category: c ? { key: c.key, te: c.te, en: c.en } : null, openForm: true } });
  };

  return (
    <div className="flex flex-col min-h-full bg-[#EEF3F8]">
      <header className="w-full pt-safe shrink-0" style={{ background: BRAND_GRADIENT }}>
        <div className="flex items-center gap-3 px-3 pt-2 pb-1">
          <button type="button" aria-label="Back" onClick={() => navigate(-1)}
            className="w-11 h-11 rounded-full bg-white/10 border-0 flex items-center justify-center text-white cursor-pointer shrink-0"><ArrowLeft className="w-6 h-6" /></button>
          <img src={logoUrl} alt="RTI Express" className="w-12 h-12 rounded-full bg-white object-contain shadow-md shrink-0" />
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-white font-black italic text-[19px] whitespace-nowrap">RTI Express</div>
            <div className="whitespace-nowrap"><span className="bg-[#E11D2E] text-white font-black italic text-[14px] px-1.5 rounded">Spot News</span> <span className="text-white font-black italic text-[14px]">24x7</span></div>
          </div>
        </div>
        <DoubleWave fill="#EEF3F8" height={54} />
      </header>

      <div className="w-full max-w-md mx-auto px-4 pb-28 space-y-4 -mt-1">
        <div className="flex items-center gap-3">
          <span className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0"><Megaphone className="w-9 h-9 text-[#E11D2E]" /></span>
          <div>
            <h1 className="text-[25px] font-extrabold text-[#0B3E8A] m-0 leading-tight">{titleA}</h1>
            <p className="text-[16px] font-bold text-[#334155] m-0">{titleB}</p>
          </div>
        </div>

        <div>
          <p className="text-[18px] font-extrabold text-[#0F172A] m-0">{selA} <span className="text-[14px] font-semibold text-[#64748B]">· {selB}</span></p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {AD_CATEGORIES.map((c) => {
              const Icon = c.icon;
              const on = picked === c.key;
              const [a, b] = pair(lang, c.te, c.en);
              return (
                <button key={c.key} type="button" onClick={() => setPicked(c.key)}
                  className={`relative rounded-2xl py-3.5 px-1 flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-all ${on ? 'bg-[#FFF1F1] border-2 border-[#E11D2E] shadow-md' : 'bg-white border border-[#D9E5F2] shadow-sm'}`}>
                  {on && <CheckCircle2 className="w-5 h-5 text-[#E11D2E] absolute top-1.5 right-1.5" />}
                  <Icon className="w-8 h-8" style={{ color: c.color }} strokeWidth={2.3} />
                  <span className="text-[14.5px] font-extrabold text-[#0F172A] text-center leading-tight">{a}</span>
                  <span className="text-[11.5px] font-semibold text-[#64748B] text-center leading-tight">{b}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button type="button" onClick={create} disabled={!picked}
          className="w-full rounded-2xl py-4 text-[19px] font-extrabold text-white border-0 cursor-pointer disabled:opacity-50 shadow-[0_10px_22px_rgba(225,29,46,0.3)]"
          style={{ background: 'linear-gradient(180deg,#F0202F,#B30F1C)' }}>
          {lang === 'en' ? 'Create Ad · ప్రకటన సృష్టించండి' : 'ప్రకటన సృష్టించండి · Create Ad'}
        </button>
        {!picked && <p className="text-center text-[14px] text-[#64748B] m-0 -mt-2">{lang === 'en' ? 'Pick a category first' : 'ముందుగా ఒక వర్గాన్ని ఎంచుకోండి'}</p>}

        <button type="button" onClick={() => navigate('/ad-requests')}
          className="w-full rounded-2xl py-3 text-[16px] font-extrabold text-[#0B4EA2] bg-white border-2 border-[#CFE0F5] cursor-pointer flex items-center justify-center gap-2">
          <ListChecks className="w-5 h-5" /> {lang === 'en' ? 'My ads · నా ప్రకటనలు' : 'నా ప్రకటనలు · My ads'}
        </button>

        <div className="rounded-3xl p-5 flex items-center gap-4 border border-[#CFE0F5]" style={{ background: 'linear-gradient(135deg,#F3F8FF,#E2EEFC)' }}>
          <Megaphone className="w-14 h-14 text-[#E11D2E] shrink-0 -rotate-12" />
          <div>
            <p className="text-[19px] font-black italic text-[#0B3E8A] m-0 leading-tight">{lang === 'en' ? 'Promote your business with RTI Express' : 'మీ వ్యాపారాన్ని మా వేదికలో ప్రచారం చేయండి'}</p>
            <p className="text-[14.5px] font-bold text-[#334155] m-0 mt-1">{lang === 'en' ? 'మీ వ్యాపారాన్ని మా వేదికలో ప్రచారం చేయండి' : 'Promote your business with RTI Express Spot News 24x7'}</p>
            <p className="text-[13px] text-[#64748B] m-0 mt-1">{lang === 'en' ? 'Your ad goes live in your district right away.' : 'మీ ప్రకటన వెంటనే మీ జిల్లాలో కనిపిస్తుంది.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
