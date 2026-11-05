import React from 'react';
import { ArrowLeft } from 'lucide-react';
import logoUrl from '@/assets/rti_express_logo.png';

/**
 * One header for every screen (matches the approved sample design):
 * deep-blue gradient, the RTI Express logo in a white tile, "Spot News 24x7",
 * an optional pill on the right, and the layered double wave at the bottom.
 */
export const BRAND_BLUE = '#0B4EA2';
export const BRAND_GRADIENT = 'linear-gradient(135deg, #062F6E 0%, #0B4EA2 55%, #1E6FD9 100%)';
export const PAGE_BG = '#EEF3F8';

/** Layered double wave: a brighter blue wave behind a light wave. */
export const DoubleWave: React.FC<{ fill?: string; height?: number }> = ({ fill = PAGE_BG, height = 62 }) => (
  <div style={{ width: '100%', overflow: 'hidden', lineHeight: 0, position: 'relative', marginTop: '-1px', background: 'transparent' }} aria-hidden>
    <svg viewBox="0 0 1440 200" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height }}>
      {/* one clear bump: the page colour rises high on the left and dips on the right, with two blue layers behind */}
      <path d="M0,40 C240,5 470,40 720,95 C990,155 1220,150 1440,70 L1440,201 L0,201 Z" fill="#2F80ED" fillOpacity="0.9" />
      <path d="M0,78 C250,40 480,78 730,130 C990,182 1230,175 1440,108 L1440,201 L0,201 Z" fill="#9CC3F5" fillOpacity="0.75" />
      <path d="M0,112 C260,72 500,110 750,158 C1000,203 1240,196 1440,140 L1440,201 L0,201 Z" fill={fill} />
    </svg>
  </div>
);

/** Matching wave at the bottom of a page. */
export const BottomWave: React.FC<{ height?: number }> = ({ height = 56 }) => (
  <div style={{ width: '100%', overflow: 'hidden', lineHeight: 0 }} aria-hidden>
    <svg viewBox="0 0 1440 200" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height }}>
      <path d="M0,90 C320,20 620,150 980,90 C1200,55 1340,60 1440,80 L1440,201 L0,201 Z" fill="#9CC3F5" fillOpacity="0.6" />
      <path d="M0,130 C360,70 640,190 1000,130 C1220,95 1350,105 1440,115 L1440,201 L0,201 Z" fill="#0B4EA2" />
    </svg>
  </div>
);

interface BrandHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Small pill on the right, e.g. "REPORTER PORTAL" */
  badge?: string;
  right?: React.ReactNode;
  waveFill?: string;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({ title, subtitle, onBack, badge, right, waveFill }) => (
  <header className="w-full flex flex-col pt-safe select-none" style={{ background: BRAND_GRADIENT }}>
    <div className="w-full flex items-center gap-3 px-4 pt-3 pb-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-12 h-12 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center text-white active:scale-95 shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
        </button>
      )}
      <div className="w-14 h-14 rounded-2xl bg-white p-1 shadow-lg flex items-center justify-center overflow-hidden shrink-0">
        <img src={logoUrl} alt="RTI Express Spot News 24x7" className="w-full h-full object-contain" />
      </div>
      <div className="flex-1 min-w-0 leading-[1.05]">
        <div className="text-white font-bold text-[23px] whitespace-nowrap" style={{ fontFamily: "Georgia, 'Noto Serif Telugu', serif" }}>Spot News</div>
        <div className="text-white font-bold text-[23px] whitespace-nowrap" style={{ fontFamily: "Georgia, 'Noto Serif Telugu', serif" }}>24x7</div>
      </div>
      {badge && (
        <span className="shrink-0 rounded-full border-2 border-white/40 bg-white/10 text-white text-[11px] font-extrabold tracking-wide uppercase px-2.5 py-1.5 leading-tight text-center max-w-[96px]">
          {badge}
        </span>
      )}
      {right}
    </div>
    {(title || subtitle) && (
      <div className="px-5 pt-1">
        {title && <h1 className="text-white font-extrabold text-[22px] leading-snug m-0">{title}</h1>}
        {subtitle && <p className="text-white/85 text-[15px] font-semibold m-0 mt-0.5">{subtitle}</p>}
      </div>
    )}
    <DoubleWave fill={waveFill} />
  </header>
);
