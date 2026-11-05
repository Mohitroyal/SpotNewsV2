import React, { useState } from 'react';
import { ChevronDown, ShieldAlert } from 'lucide-react';

/** Bump this when the wording changes, so new acceptances can be told apart. */
export const REPORTER_TERMS_VERSION = '2026-11-v1';

const POINTS: { te: string; en: string }[] = [
  { te: 'నేను పంపే ప్రతి వార్త నిజమైనది, నేను స్వయంగా ధృవీకరించినది.', en: 'Every news item I post is true and checked by me.' },
  { te: 'ఆమోదం పొందిన రిపోర్టర్‌గా నా వార్తలు ఎవరి ఆమోదం లేకుండా వెంటనే ప్రచురించబడతాయని నాకు తెలుసు.', en: 'As an approved reporter, my news is published at once without further approval.' },
  { te: 'తప్పుడు / ఫేక్ వార్తలు, పుకార్లు, ఎడిట్ చేసిన ఫోటోలకు పూర్తి బాధ్యత నాదే.', en: 'I take full responsibility for any false or fake news, rumours or edited photos I post.' },
  { te: 'కులం, మతం, ప్రాంతం మీద ద్వేషం, అసభ్యత, హింసను ప్రోత్సహించే వార్తలు పంపను.', en: 'I will not post hate against caste, religion or region, obscene content, or content that incites violence.' },
  { te: 'బాధితుల (ముఖ్యంగా మహిళలు, పిల్లలు) పేర్లు, ఫోటోలు చట్ట ప్రకారం బయటపెట్టను.', en: 'I will not reveal names or photos of victims (especially women and children) where the law forbids it.' },
  { te: 'వ్యక్తుల పరువుకు భంగం కలిగించే నిరాధార ఆరోపణలు చేయను; ఇతరుల ఫోటోలు/వార్తలు కాపీ చేయను.', en: 'I will not make unproven allegations that defame anyone, or copy others\' photos or stories.' },
  { te: 'నియమాలు ఉల్లంఘిస్తే RTI Express నా వార్తను తొలగించి, నా ఖాతాను నిలిపివేయవచ్చు; చట్టపరమైన చర్యలకు నేనే బాధ్యుడిని.', en: 'If I break these rules RTI Express may remove my news and suspend my account; I am answerable for any legal action.' },
];

export const ReporterTerms: React.FC<{ agreed: boolean; onChange: (v: boolean) => void }> = ({ agreed, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 ${agreed ? 'border-[#16A34A] bg-[#F0FDF4]' : 'border-[#F59E0B] bg-[#FFFBEB]'}`}>
      <p className="text-[17px] font-extrabold text-[#0F172A] m-0 flex items-center gap-2">
        <ShieldAlert className="w-6 h-6 text-[#B45309] shrink-0" /> వార్తల ప్రచురణ నియమాలు · News publishing rules
      </p>
      <ul className="m-0 pl-5 space-y-1.5 text-[15.5px] text-[#334155] leading-relaxed">
        {(open ? POINTS : POINTS.slice(0, 3)).map((p) => (
          <li key={p.en}>{p.te}<br /><span className="text-[13.5px] text-[#64748B]">{p.en}</span></li>
        ))}
      </ul>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[15px] font-bold text-[#0B4EA2] bg-transparent border-0 p-0 cursor-pointer">
        {open ? 'తక్కువ చూపించు · Show less' : 'అన్ని నియమాలు చదవండి · Read all rules'}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={agreed} onChange={(e) => onChange(e.target.checked)}
          className="w-7 h-7 mt-0.5 shrink-0 accent-[#16A34A] cursor-pointer" />
        <span className="text-[16px] font-bold text-[#0F172A] leading-snug">
          పై నియమాలు చదివి అంగీకరిస్తున్నాను. నేను పంపే వార్తలకు, ఫేక్ వార్తలకు పూర్తి బాధ్యత నాదే.
          <span className="block text-[13.5px] font-semibold text-[#475569] mt-0.5">I have read and agree to these rules, and I accept full responsibility for the news I publish, including any fake news.</span>
        </span>
      </label>
    </div>
  );
};
