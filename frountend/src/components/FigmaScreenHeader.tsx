import React from 'react';
import logoUrl from '@/assets/rti_express_logo.png';
import { Wifi, Battery } from 'lucide-react';

interface FigmaScreenHeaderProps {
  showStatusBar?: boolean;
}

export const FigmaScreenHeader: React.FC<FigmaScreenHeaderProps> = ({ showStatusBar = true }) => {
  return (
    <div className="w-full bg-white select-none">
      {/* ── Status Bar ── */}
      {showStatusBar && (
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[#0F172A] text-xs font-semibold">
          <span>9:41</span>
          <div className="flex items-center gap-1.5 text-xs">
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-1">
              <span>100%</span>
              <Battery className="w-4 h-4 fill-current" />
            </div>
          </div>
        </div>
      )}

      {/* ── Brand Masthead ── */}
      <div className="flex items-center gap-2.5 px-6 py-2.5">
        <div className="w-9 h-9 rounded-full bg-[#EBF3FB] border border-[#D5E5F7] flex items-center justify-center p-0.5 overflow-hidden shadow-xs shrink-0">
          <img src={logoUrl} alt="Spot News" className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1">
            <span className="text-[#0B4EA2] font-black text-[15px] tracking-tight">Spot News</span>
            <span className="text-[#CC1E1E] font-black text-[15px] tracking-tight">24×7</span>
          </div>
          <span className="text-[8.5px] font-bold text-[#64748B] tracking-wider uppercase mt-0.5">
            RTI EXPRESS
          </span>
        </div>
      </div>
    </div>
  );
};
