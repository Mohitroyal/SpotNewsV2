import React from 'react';
import type { Landscape } from './districtCulture';
import type { SkyTheme } from './sky';

/** Drawn sky + local landscape. Sun/moon move with the hour; rain, clouds, heat and mist follow the weather. */
export const SkyScene: React.FC<{ theme: SkyTheme; land: Landscape; seed: number; aspect?: number; className?: string; style?: React.CSSProperties; showLand?: boolean }> = ({ theme, land, seed, aspect = 0.75, className, style, showLand = true }) => {
  // viewBox follows the box shape (height / width), so the sun and moon are never cut off
  const H = Math.max(300, Math.round(400 * aspect));
  const skyH = H - 110;
  const { phase, mood, sunX, sunY, dark } = theme;
  const night = phase === 'night' || phase === 'predawn' || phase === 'dusk';
  const golden = phase === 'golden' || phase === 'dawn';
  const rnd = (k: number) => ((Math.sin(seed * 9.13 + k * 77.7) + 1) / 2);
  const cx = sunX * 400;
  const cy = 30 + sunY * (skyH - 40);
  const cloudCount = mood === 'cloudy' ? 4 : mood === 'rain' || mood === 'storm' ? 5 : mood === 'fog' ? 2 : mood === 'heat' ? 0 : 2;
  const cloudFill = mood === 'rain' || mood === 'storm' ? 'rgba(60,72,96,0.85)' : night ? 'rgba(200,210,240,0.18)' : 'rgba(255,255,255,0.9)';
  const landDark = night ? '#0B1530' : mood === 'rain' || mood === 'storm' ? '#1F3A4A' : null;
  const g1 = landDark || (land === 'dryland' ? '#B7894F' : land === 'plateau' ? '#7E8F5A' : '#3E8E4F');
  const g2 = landDark ? '#131F3F' : land === 'dryland' ? '#8F6534' : land === 'plateau' ? '#5E6E40' : '#2A6E3A';

  return (
    <svg viewBox={`0 0 400 ${H}`} preserveAspectRatio="xMidYMax slice" className={className} style={style} aria-hidden>
      <defs>
        <radialGradient id={`glow${seed}`}>
          <stop offset="0%" stopColor={night ? '#FFF7D6' : golden ? '#FFD27A' : '#FFF6B0'} stopOpacity="0.9" />
          <stop offset="100%" stopColor={night ? '#FFF7D6' : '#FFD27A'} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* stars */}
      {night && Array.from({ length: 26 }).map((_, i) => (
        <circle key={`s${i}`} cx={rnd(i) * 400} cy={rnd(i + 50) * skyH * 0.85} r={rnd(i + 99) * 1.4 + 0.4} fill="#fff" opacity={0.5 + rnd(i + 7) * 0.5} />
      ))}

      {/* sun or moon */}
      {mood !== 'storm' && (
        night ? (
          <g>
            <circle cx={cx} cy={cy} r="46" fill={`url(#glow${seed})`} />
            <circle cx={cx} cy={cy} r="17" fill="#FFF5CC" />
            <circle cx={cx + 7} cy={cy - 4} r="15" fill={dark ? '#1E2350' : '#334'} opacity="0.92" />
          </g>
        ) : (
          <g opacity={mood === 'rain' ? 0.35 : 1}>
            <circle cx={cx} cy={cy} r={mood === 'heat' ? 70 : 52} fill={`url(#glow${seed})`} />
            <circle cx={cx} cy={cy} r={golden ? 24 : 20} fill={golden ? '#FFB347' : mood === 'heat' ? '#FFE066' : '#FFF3A3'} />
            {mood === 'heat' && Array.from({ length: 12 }).map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return <line key={i} x1={cx + Math.cos(a) * 28} y1={cy + Math.sin(a) * 28} x2={cx + Math.cos(a) * 42} y2={cy + Math.sin(a) * 42} stroke="#FFE066" strokeWidth="3" strokeLinecap="round" />;
            })}
          </g>
        )
      )}

      {/* clouds */}
      {Array.from({ length: cloudCount }).map((_, i) => {
        const x = (rnd(i + 200) * 360) + 10;
        const y = 25 + rnd(i + 300) * skyH * 0.5;
        const s = 0.7 + rnd(i + 400) * 0.7;
        return (
          <g key={`c${i}`} transform={`translate(${x} ${y}) scale(${s})`} fill={cloudFill}>
            <ellipse cx="0" cy="0" rx="34" ry="14" /><ellipse cx="-18" cy="-8" rx="18" ry="14" /><ellipse cx="12" cy="-12" rx="22" ry="17" />
          </g>
        );
      })}

      {/* rain + lightning */}
      {(mood === 'rain' || mood === 'storm') && Array.from({ length: Math.round((46 * H) / 300) }).map((_, i) => {
        const x = rnd(i + 500) * 420 - 10;
        const y = 50 + rnd(i + 600) * (H - 80);
        return <line key={`r${i}`} x1={x} y1={y} x2={x - 6} y2={y + 16} stroke="#CFE3FF" strokeWidth="1.6" opacity="0.7" strokeLinecap="round" />;
      })}
      {mood === 'storm' && <path d="M250 60 l-22 46 h18 l-14 40 l36 -54 h-18 l14 -32z" fill="#FFE066" opacity="0.95" />}

      {/* birds at sunrise / sunset */}
      {golden && mood !== 'rain' && [0, 1, 2].map((i) => (
        <path key={`b${i}`} d={`M${60 + i * 26} ${skyH * 0.35 + i * 9} q6 -6 12 0 q6 -6 12 0`} stroke={night ? '#fff' : '#3A2A2A'} strokeWidth="2" fill="none" opacity="0.7" />
      ))}

      {/* mist */}
      {mood === 'fog' && [0, 1, 2, 3].map((i) => (
        <rect key={`f${i}`} x="-20" y={H - 150 + i * 28} width="440" height="14" rx="7" fill="#fff" opacity="0.35" />
      ))}

      {/* landscape */}
      {showLand && <g transform={`translate(0 ${H - 300})`}><Land land={land} g1={g1} g2={g2} night={night} /></g>}
    </svg>
  );
};

const Land: React.FC<{ land: Landscape; g1: string; g2: string; night: boolean }> = ({ land, g1, g2, night }) => {
  const trunk = night ? '#0A1128' : '#5B3A1E';
  const leaf = night ? '#0E1A3A' : '#2F7D3B';
  const palm = (x: number, h: number) => (
    <g key={x}>
      <path d={`M${x} 300 C${x + 4} ${300 - h * 0.6} ${x + 10} ${300 - h * 0.85} ${x + 8} ${300 - h}`} stroke={trunk} strokeWidth="5" fill="none" />
      {[-60, -25, 15, 50, 85].map((a, k) => (
        <path key={k} d={`M${x + 8} ${300 - h} q${Math.cos((a * Math.PI) / 180) * 26} ${-12 + k * 3} ${Math.cos((a * Math.PI) / 180) * 44} ${14 + Math.abs(a) / 6}`} stroke={leaf} strokeWidth="5" fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
  switch (land) {
    case 'coast':
      return (
        <g>
          <path d="M0 238 Q50 228 100 238 T200 238 T300 238 T400 238 V300 H0Z" fill={night ? '#0D1F4A' : '#2E86C1'} />
          <path d="M0 254 Q50 244 100 254 T200 254 T300 254 T400 254 V300 H0Z" fill={night ? '#0A1838' : '#1B6FA8'} />
          <path d="M0 276 Q120 262 240 274 T400 270 V300 H0Z" fill={night ? '#1A1A2E' : '#E9C98B'} />
          <path d="M250 232 h40 l-6 9 h-28z M268 232 v-22 l14 18z" fill={night ? '#0A1128' : '#7A4A22'} />
          {palm(40, 92)}{palm(350, 78)}
        </g>
      );
    case 'delta':
      return (
        <g>
          <path d="M0 236 Q200 222 400 236 V300 H0Z" fill={g1} />
          {Array.from({ length: 7 }).map((_, i) => <path key={i} d={`M0 ${248 + i * 8} Q200 ${240 + i * 8} 400 ${248 + i * 8}`} stroke={g2} strokeWidth="2" fill="none" opacity="0.6" />)}
          {palm(30, 100)}{palm(70, 80)}{palm(330, 96)}{palm(365, 74)}
        </g>
      );
    case 'dryland':
      return (
        <g>
          <path d="M0 230 L60 196 L110 222 L170 188 L240 226 L300 200 L400 230 V300 H0Z" fill={g2} />
          <path d="M0 252 Q200 238 400 252 V300 H0Z" fill={g1} />
          {Array.from({ length: 6 }).map((_, i) => <path key={i} d={`M${i * 70} 300 L${200} 252`} stroke={g2} strokeWidth="2" opacity="0.4" />)}
          <g stroke={night ? '#334' : '#F4F4F4'} strokeWidth="3"><line x1="330" y1="252" x2="330" y2="190" /><line x1="330" y1="190" x2="352" y2="176" /><line x1="330" y1="190" x2="310" y2="174" /><line x1="330" y1="190" x2="330" y2="214" /></g>
        </g>
      );
    case 'hills':
      return (
        <g>
          <path d="M0 220 Q60 170 130 210 T260 196 T400 214 V300 H0Z" fill={g2} opacity="0.85" />
          <path d="M0 246 Q90 206 170 240 T330 230 T400 240 V300 H0Z" fill={g1} />
          {[40, 90, 300, 360].map((x) => <path key={x} d={`M${x} 250 l10 -26 l10 26z`} fill={leaf} />)}
        </g>
      );
    case 'city':
      return (
        <g fill={night ? '#0A1128' : '#4A5D7A'}>
          {[[0, 60], [34, 90], [70, 50], [100, 110], [140, 70], [176, 96], [212, 58], [246, 120], [286, 76], [320, 100], [356, 64]].map(([x, h]) => (
            <rect key={x} x={x} y={300 - h} width="32" height={h} />
          ))}
          <path d="M150 230 q20 -30 40 0z" />
          {night && Array.from({ length: 30 }).map((_, i) => <rect key={i} x={6 + (i * 37) % 390} y={210 + ((i * 17) % 80)} width="4" height="5" fill="#FFD166" opacity="0.8" />)}
        </g>
      );
    case 'plateau':
    default:
      return (
        <g>
          <path d="M0 240 Q200 226 400 240 V300 H0Z" fill={g1} />
          <ellipse cx="300" cy="262" rx="70" ry="9" fill={night ? '#16285A' : '#5DADE2'} opacity="0.8" />
          {[[70, 226, 26], [96, 214, 18], [112, 232, 16], [330, 222, 20], [352, 232, 14]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={night ? '#121C3C' : '#9C8F7E'} />
          ))}
        </g>
      );
  }
};
