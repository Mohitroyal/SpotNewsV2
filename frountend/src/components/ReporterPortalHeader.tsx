import logoUrl from '@/assets/rti_express_logo.png';
import watermarkLogo from '@/assets/rti_express_watermark.png';

export const ReporterPortalHeader = () => {
  return (
    <>
      {/* ══ RTI Express background watermark ══ */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-30deg)',
          zIndex: 0,
          pointerEvents: 'none',
          width: '100vw',
          maxWidth: '500px',
          opacity: 0.08,
          mixBlendMode: 'multiply'
        }}
      >
        <img
          src={watermarkLogo}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        />
      </div>

      {/* ── Masthead Header (matches the inside app masthead & wave) ── */}
      <header className="w-full flex flex-col pt-safe relative z-20" style={{ background: '#EAF2FB' }}>
        <div style={{ background: '#015BB3', paddingBottom: '12px' }}>
          <div className="w-full flex items-center justify-between px-4 pt-3.5 pb-2 gap-2">
            {/* Logo box + Spot News 24x7 */}
            <div className="flex items-center gap-2.5">
              <div className="rounded-[8px] flex items-center justify-center h-[46px] overflow-hidden bg-white p-1 border border-[#0B56A6]/20 shrink-0 shadow-sm">
                <img src={logoUrl} alt="Spot News Logo" className="h-full w-auto object-contain" style={{ maxWidth: '92px', borderRadius: '4px' }} />
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-bold text-white text-[22px] leading-[1.15] tracking-wide" style={{ fontFamily: "'Georgia', serif" }}>
                  Spot News<br/>24x7
                </span>
              </div>
            </div>

            {/* Portal Badge */}
            <div className="flex flex-col items-end shrink-0">
              <div className="bg-white/15 border border-white/25 text-white text-[9.5px] uppercase tracking-widest font-extrabold py-1 px-3 rounded-full shadow-sm">
                REPORTER PORTAL
              </div>
            </div>
          </div>
        </div>

        {/* ── Smooth Wave Divider ── */}
        <div style={{ width: '100%', overflow: 'hidden', lineHeight: 0, background: '#EAF2FB', position: 'relative' }}>
          <svg
            viewBox="0 0 1440 240"
            preserveAspectRatio="none"
            style={{ position: 'relative', display: 'block', width: '100%', height: '42px' }}
          >
            <path
              d="M0,0 L1440,0 L1440,100 C1100,240 500,10 0,170 Z"
              fill="#015BB3"
            />
          </svg>
        </div>
      </header>
    </>
  );
};
