import React from 'react';
import { useLang } from '@/lib/lang';

/** EN | తెలుగు pill used in the headers. */
export const LangToggle: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const [lang, setLang] = useLang();
  const base = 'px-3 py-1 rounded-full text-[14px] font-extrabold border-0 cursor-pointer transition-colors';
  return (
    <div className={`inline-flex items-center rounded-full p-0.5 shrink-0 ${dark ? 'bg-white/10 border-2 border-white/40' : 'bg-white border border-[#D0DCEA]'}`}>
      <button type="button" onClick={() => setLang('en')}
        className={`${base} ${lang === 'en' ? 'bg-[#0B4EA2] text-white' : dark ? 'bg-transparent text-white' : 'bg-transparent text-[#0B4EA2]'}`}>EN</button>
      <button type="button" onClick={() => setLang('te')}
        className={`${base} ${lang === 'te' ? 'bg-[#E11D2E] text-white' : dark ? 'bg-transparent text-white' : 'bg-transparent text-[#0B4EA2]'}`}>తెలుగు</button>
    </div>
  );
};
