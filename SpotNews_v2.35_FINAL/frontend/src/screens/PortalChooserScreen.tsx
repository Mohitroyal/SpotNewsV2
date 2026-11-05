import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Mic, Users } from 'lucide-react';
import logoUrl from '@/assets/rti_express_logo.png';
import { useAuthStore } from '@/store';
import { LangToggle } from '@/components/LangToggle';
import { useLang, pair } from '@/lib/lang';
import { BRAND_GRADIENT } from '@/components/BrandHeader';

/** Generic city skyline (domes, towers, gateways) for the bottom of the front screen. */
const Skyline: React.FC = () => (
  <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax meet" className="w-full block" aria-hidden>
    <g fill="#9CC3F5" opacity="0.55">
      <rect x="8" y="70" width="18" height="50" /><rect x="12" y="55" width="10" height="15" /><circle cx="17" cy="52" r="6" />
      <rect x="34" y="82" width="26" height="38" /><path d="M34 82 q13 -22 26 0z" />
      <rect x="70" y="60" width="12" height="60" /><path d="M70 60 l6 -14 l6 14z" />
      <rect x="92" y="78" width="40" height="42" /><path d="M92 78 q20 -30 40 0z" /><rect x="110" y="40" width="4" height="10" />
      <rect x="142" y="66" width="14" height="54" /><circle cx="149" cy="62" r="7" />
      <path d="M166 120 v-44 h50 v44 h-12 v-26 a13 13 0 0 0 -26 0 v26z" /><rect x="162" y="70" width="58" height="8" />
      <rect x="228" y="74" width="30" height="46" /><path d="M228 74 q15 -26 30 0z" />
      <rect x="266" y="56" width="10" height="64" /><path d="M266 56 l5 -16 l5 16z" />
      <rect x="284" y="84" width="34" height="36" /><path d="M284 84 q17 -24 34 0z" />
      <rect x="326" y="64" width="14" height="56" /><circle cx="333" cy="60" r="7" />
      <rect x="348" y="80" width="44" height="40" /><path d="M348 80 q22 -30 44 0z" />
    </g>
  </svg>
);

export const PortalChooserScreen: React.FC = () => {
  const navigate = useNavigate();
  const [lang] = useLang();

  const openReaders = () => {
    // Readers never log in - a private guest session keeps likes and comments on this phone
    if (!useAuthStore.getState().isAuthenticated) {
      useAuthStore.getState().login(
        { id: `guest_${Date.now()}`, email: 'guest@spotnews.local', full_name: 'Guest Reader', role: 'reader', plan: 'free' } as any,
        'guest_session_token',
      );
    }
    navigate('/');
  };

  const [chooseA, chooseB] = pair(lang, 'మీ పోర్టల్‌ను ఎంచుకోండి', 'Choose Your Portal');
  const [rTitleA, rTitleB] = pair(lang, 'పాఠకుల పోర్టల్', 'Readers Portal');
  const [pTitleA, pTitleB] = pair(lang, 'వార్తా ప్రతినిధుల పోర్టల్', 'Reporters Portal');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-[#F3F8FE] to-[#E6F0FC] font-sans">
      {/* Top wave */}
      <div className="relative" style={{ background: BRAND_GRADIENT }}>
        <div className="pt-safe" />
        <div className="h-9" />
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" className="block w-full h-[70px]" aria-hidden>
          <path d="M0,40 C240,5 470,40 720,95 C990,155 1220,150 1440,70 L1440,201 L0,201 Z" fill="#2F80ED" fillOpacity="0.9" />
          <path d="M0,78 C250,40 480,78 730,130 C990,182 1230,175 1440,108 L1440,201 L0,201 Z" fill="#9CC3F5" fillOpacity="0.75" />
          <path d="M0,112 C260,72 500,110 750,158 C1000,203 1240,196 1440,140 L1440,201 L0,201 Z" fill="#FFFFFF" />
        </svg>
        <div className="absolute right-4 top-[calc(env(safe-area-inset-top,0px)+8px)]"><LangToggle dark /></div>
      </div>

      <div className="flex-1 w-full max-w-md mx-auto px-5 flex flex-col">
        {/* Logo + name */}
        <div className="flex items-center gap-3 mt-2">
          <img src={logoUrl} alt="RTI Express" className="w-[92px] h-[92px] rounded-full bg-white shadow-lg object-contain shrink-0" />
          <div className="leading-none">
            <div className="text-[#0B3E8A] font-black italic text-[33px] tracking-tight">RTI Express</div>
            <div className="mt-1 font-black italic text-[27px]"><span className="text-[#E11D2E]">Spot News</span> <span className="text-[#0B3E8A]">24x7</span></div>
            <svg viewBox="0 0 200 10" className="w-[190px] h-[8px] mt-1" aria-hidden><path d="M2 8 Q100 -2 198 6" stroke="#E11D2E" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
          </div>
        </div>

        <div className="mt-5 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="h-[2px] w-10 bg-[#E11D2E]" />
            <span className="text-[20px] font-extrabold text-[#0B3E8A]">{lang === 'en' ? "India's Live Newspaper" : 'భారతదేశపు ప్రత్యక్ష వార్తా వేదిక'}</span>
            <span className="h-[2px] w-10 bg-[#E11D2E]" />
          </div>
          <p className="text-[16px] text-[#334155] font-semibold m-0 mt-1">{lang === 'en' ? 'భారతదేశపు ప్రత్యక్ష వార్తా వేదిక' : "India's Live Newspaper"}</p>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-[25px] font-extrabold text-[#0F172A] m-0">{chooseA}</h1>
          <p className="text-[17px] text-[#334155] font-semibold m-0">{chooseB}</p>
        </div>

        {/* Readers */}
        <button type="button" onClick={openReaders}
          className="mt-5 w-full text-left rounded-[26px] border-0 cursor-pointer p-5 flex items-center gap-4 shadow-[0_10px_26px_rgba(11,78,162,0.14)] active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg,#EAF3FF,#D6E8FD)' }}>
          <div className="relative w-[70px] h-[70px] shrink-0 rounded-2xl bg-white/70 flex items-center justify-center">
            <Users className="w-10 h-10 text-[#0B4EA2]" strokeWidth={2.2} />
            <BookOpen className="w-7 h-7 text-[#0B4EA2] absolute bottom-1.5 right-1.5 bg-white rounded-md p-0.5" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[23px] font-extrabold text-[#0B3E8A] leading-tight">{rTitleA}</div>
            <div className="text-[16px] font-bold text-[#0B3E8A]/80 leading-tight">{rTitleB}</div>
            <div className="mt-1.5 text-[14px] text-[#334155] leading-snug">
              {lang === 'en' ? 'Read news · Post ads · Weather · Health · Farming' : 'వార్తలు చదవండి · ప్రకటనలు ఇవ్వండి · వాతావరణం · ఆరోగ్యం · వ్యవసాయం'}
            </div>
            <div className="mt-1 text-[13px] font-bold text-[#0B4EA2]">{lang === 'en' ? 'No login needed' : 'లాగిన్ అవసరం లేదు'}</div>
          </div>
          <span className="w-10 h-10 rounded-full bg-[#0B4EA2] text-white flex items-center justify-center shrink-0"><ChevronRight className="w-6 h-6" /></span>
        </button>

        {/* Reporters */}
        <button type="button" onClick={() => navigate('/reporter')}
          className="mt-4 w-full text-left rounded-[26px] border-0 cursor-pointer p-5 flex items-center gap-4 shadow-[0_10px_26px_rgba(225,29,46,0.14)] active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg,#FFF0F0,#FDDCDC)' }}>
          <div className="w-[70px] h-[70px] shrink-0 rounded-2xl bg-white/70 flex items-center justify-center">
            <Mic className="w-10 h-10 text-[#E11D2E]" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[23px] font-extrabold text-[#B3121F] leading-tight">{pTitleA}</div>
            <div className="text-[16px] font-bold text-[#B3121F]/80 leading-tight">{pTitleB}</div>
            <div className="mt-1.5 text-[14px] text-[#334155] leading-snug">
              {lang === 'en' ? 'Report news · Upload photos · Track your news' : 'వార్తలు పంపండి · ఫోటోలు అప్‌లోడ్ · మీ వార్తల స్థితి'}
            </div>
            <div className="mt-1 text-[13px] font-bold text-[#E11D2E]">{lang === 'en' ? 'Registered reporters - login with OTP' : 'నమోదైన రిపోర్టర్లు - OTPతో లాగిన్'}</div>
          </div>
          <span className="w-10 h-10 rounded-full bg-[#E11D2E] text-white flex items-center justify-center shrink-0"><ChevronRight className="w-6 h-6" /></span>
        </button>

        <a href="tel:7668886666" className="mt-4 no-underline flex items-center justify-center gap-2 rounded-full bg-white border-2 border-[#FCA5A5] py-2.5 px-4 shadow-sm" style={{ textDecoration: 'none' }}>
          <span className="text-[16px] font-extrabold text-[#B3121F]">{lang === 'en' ? 'Reporters wanted' : 'రిపోర్టర్లు కావాలి'}</span>
          <span className="text-[17px] font-black text-[#0B3E8A]">📞 7668886666</span>
        </a>
        <div className="flex-1 min-h-[16px]" />
      </div>

      {/* Skyline + bottom wave */}
      <div className="w-full mt-2">
        <div className="max-w-md mx-auto px-2"><Skyline /></div>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="block w-full h-[56px] -mt-1" aria-hidden>
          <path d="M0,50 C320,0 620,110 980,50 C1200,15 1340,30 1440,45 L1440,121 L0,121 Z" fill="#9CC3F5" fillOpacity="0.6" />
          <path d="M0,80 C360,30 640,130 1000,80 C1220,50 1350,60 1440,70 L1440,121 L0,121 Z" fill="#0B4EA2" />
        </svg>
        <div className="pb-safe" style={{ background: '#0B4EA2' }} />
      </div>
    </div>
  );
};
