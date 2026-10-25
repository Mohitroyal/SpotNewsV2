// Reporter share card — rendered off-screen at full size, then turned into a PNG by shareImage.ts.
// Two formats: "square" 1080×1080 (WhatsApp, Facebook, X, Instagram feed) and "story" 1080×1920 (Instagram / WhatsApp Status).
import { forwardRef, useEffect, useState } from "react";
import QRCode from "qrcode";
import "./reporterCard.css";

export interface ReporterCardData {
  reporter: {
    name: string;
    photoUrl?: string;
    verified: boolean;
    avgStars: number;
    ratingsCount: number;
    stories: number;
    views: number;
    experienceYears?: number;
  };
  post: {
    headline: string;
    place: string;
    date: string;
    thumbUrl?: string;
  };
  link: string; // newsLink(post.id, reporter.slug)
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));
const stars = (v: number) => "★★★★★".slice(0, Math.round(v)) + "☆☆☆☆☆".slice(0, 5 - Math.round(v));

export const ReporterCard = forwardRef<HTMLDivElement, { data: ReporterCardData; format: "square" | "story" }>(
  ({ data, format }, ref) => {
    const [qr, setQr] = useState("");
    useEffect(() => {
      QRCode.toDataURL(data.link, { margin: 1, width: 360 }).then(setQr);
    }, [data.link]);

    const { reporter: r, post: p } = data;
    const short = data.link.replace(/^https?:\/\//, "").replace(/\?.*$/, "");

    return (
      <div ref={ref} className={`rc rc-${format}`}>
        <div className="rc-head">
          <img className="rc-logo" src="/assets/spot_news_badge.png" alt="" />
          {format === "square" && <span className="rc-tag">తాజా వార్త</span>}
          <div className="rc-who">
            <div className="rc-name">{r.name}</div>
            {r.verified && <div className="rc-ver">✓ వెరిఫైడ్ రిపోర్టర్</div>}
            <div className="rc-stars">
              <span>{stars(r.avgStars)}</span> {r.avgStars.toFixed(1)} <small>({r.ratingsCount})</small>
            </div>
          </div>
          <div className="rc-avatar" style={r.photoUrl ? { backgroundImage: `url(${r.photoUrl})` } : undefined}>
            {!r.photoUrl && (r.name ? r.name[0] : "R")}
          </div>
        </div>
        <div className="rc-rule" />
        <div className="rc-meta">
          <span>📍 {p.place}</span>
          <span>{p.date}</span>
        </div>
        <div className="rc-headline">{p.headline}</div>
        {p.thumbUrl && (
          <div className="rc-thumb">
            <img src={p.thumbUrl} alt="" crossOrigin="anonymous" />
          </div>
        )}
        <div className="rc-chips">
          <span>📰 {r.stories} వార్తలు</span>
          <span>👁 {fmt(r.views)} పాఠకులు</span>
          {r.experienceYears ? <span>🏅 {r.experienceYears}+ ఏళ్ల అనుభవం</span> : null}
        </div>
        <div className="rc-bar">
          {qr && <img className="rc-qr" src={qr} alt="" />}
          <div>
            <div className="rc-cta">పూర్తి వార్త యాప్‌లో చదవండి</div>
            <div className="rc-link">🔗 {short}</div>
            <div className="rc-play">Spot News 24x7 · Google Play Store</div>
          </div>
        </div>
      </div>
    );
  }
);
