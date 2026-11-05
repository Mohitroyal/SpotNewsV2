import React, { useEffect, useRef } from 'react';
import { ShoppingBag, ExternalLink } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { brandAdsService, BRAND_COLOURS, type BrandAd } from '@/services/brandAds.service';

/**
 * Full-screen in-feed brand deal card (Amazon, Flipkart, Meesho …).
 * Replaces Google AdMob: calm, clearly labelled, never pops up over news.
 */
export const BrandDealCard: React.FC<{ ad: BrandAd }> = ({ ad }) => {
  const ref = useRef<HTMLDivElement>(null);
  const accent = ad.accent_color || BRAND_COLOURS[ad.brand] || '#015BB3';

  // Count one impression when the card is actually on screen
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sent = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!sent && entries.some((e) => e.isIntersecting)) {
          sent = true;
          brandAdsService.trackImpression(ad.id);
          io.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ad.id]);

  const open = async () => {
    brandAdsService.trackClick(ad.id);
    try {
      if (Capacitor.isNativePlatform()) {
        // Android hands Amazon / Flipkart / Meesho links to their apps when installed
        window.open(ad.affiliate_url, '_system');
      } else {
        await Browser.open({ url: ad.affiliate_url });
      }
    } catch {
      window.open(ad.affiliate_url, '_blank');
    }
  };

  return (
    <div
      ref={ref}
      className="w-full h-full snap-start snap-always flex flex-col bg-black border-b border-gray-800 relative p-3 box-border shrink-0"
      style={{ minHeight: '100%' }}
    >
      <div className="flex-1 w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col bg-white">
        {/* Header strip */}
        <div className="flex items-center justify-between px-4 py-3" style={{ background: accent }}>
          <div className="flex items-center gap-2 text-white">
            <ShoppingBag className="w-5 h-5" strokeWidth={2.4} />
            <span className="text-[15px] font-black tracking-wide">{ad.brand}</span>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/90 text-black/80 px-2 py-0.5 rounded">
            ప్రకటన · Sponsored
          </span>
        </div>

        {/* Banner */}
        <button type="button" onClick={open} className="flex-1 min-h-0 w-full bg-[#F8FAFC] flex items-center justify-center overflow-hidden border-0 p-0 cursor-pointer">
          {ad.image_url ? (
            <img src={ad.image_url} alt={ad.title_en || ad.title_te} className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <ShoppingBag className="w-24 h-24 opacity-20" style={{ color: accent }} />
          )}
        </button>

        {/* Text + CTA */}
        <div className="px-4 pt-3 pb-4">
          <h3 className="text-[18px] font-extrabold text-[#0F172A] leading-snug m-0">{ad.title_te}</h3>
          {ad.title_en && <p className="text-[12.5px] text-[#475569] font-semibold mt-0.5 m-0">{ad.title_en}</p>}
          {ad.subtitle_te && <p className="text-[13.5px] text-[#334155] mt-1.5 m-0 leading-relaxed">{ad.subtitle_te}</p>}
          <button
            type="button"
            onClick={open}
            className="mt-3 w-full text-white rounded-xl py-3 text-[15px] font-extrabold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform border-0 cursor-pointer"
            style={{ background: accent }}
          >
            {ad.cta_label || `${ad.brand} లో చూడండి · Shop now`}
            <ExternalLink className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-[#94A3B8] text-center mt-2 m-0">
            ఈ లింక్ ద్వారా కొనుగోలు చేస్తే మాకు చిన్న కమీషన్ రావచ్చు · We may earn a commission from this link
          </p>
        </div>
      </div>
    </div>
  );
};
