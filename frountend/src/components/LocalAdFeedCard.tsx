import React, { useState } from 'react';
import { Megaphone, Phone, MessageSquare, Volume2, VolumeX, Share2, Sparkles, ExternalLink } from 'lucide-react';
import type { LocalAd } from '@/types/localAds';

interface LocalAdFeedCardProps {
  ad: LocalAd;
  index: number;
}

export const LocalAdFeedCard: React.FC<LocalAdFeedCardProps> = ({ ad, index }) => {
  const [isMuted, setIsMuted] = useState(true);

  const cleanPhone = (ad.cta_value || '').replace(/[^0-9]/g, '');

  const getCtaLink = () => {
    if (ad.cta_type === 'whatsapp') {
      const phone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
      const msg = encodeURIComponent(`Hi, I saw your advertisement on SpotNews for "${ad.title}".`);
      return `https://wa.me/${phone}?text=${msg}`;
    }
    if (ad.cta_type === 'call') {
      return `tel:${cleanPhone}`;
    }
    // link
    let url = ad.cta_value || '#';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    return url;
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: ad.title,
          text: `Check out ${ad.title} on Spot News!\n${ad.description || ''}`,
          url: ad.media_url,
        });
      } catch {
        // user cancelled share
      }
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`*${ad.title}*\n${ad.description || ''}\n${ad.media_url}`)}`, '_blank');
    }
  };

  return (
    <div
      key={`local-ad-${ad.id}-${index}`}
      className="w-full h-full min-h-full snap-start snap-always flex flex-col bg-black border-b border-gray-800 relative select-none shrink-0"
      style={{ minHeight: '100%', height: '100%' }}
    >
      {/* ── Top Sponsored Header Floating Pill ── */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[11px] font-black uppercase tracking-wider shadow-lg border border-amber-300/40">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SPONSORED / ప్రకటన</span>
          </div>

          {ad.target_district && (
            <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/90 text-[10px] font-bold border border-white/10">
              📍 {ad.target_district}
            </span>
          )}
        </div>

        {ad.media_type === 'video' && (
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 pointer-events-auto active:scale-95 transition-transform"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        )}
      </div>

      {/* ── Media Display Area ── */}
      <div className="flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden pb-[110px]">
        {/* Glow ambient background */}
        {ad.media_type === 'image' && (
          <div
            className="absolute inset-0 opacity-25 scale-110 blur-2xl bg-cover bg-center pointer-events-none"
            style={{ backgroundImage: `url(${ad.media_url})` }}
          />
        )}

        {ad.media_type === 'video' ? (
          <video
            src={ad.media_url}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-contain relative z-10"
          />
        ) : (
          <img
            src={ad.media_url}
            alt={ad.title}
            className="w-full h-full object-contain relative z-10"
          />
        )}
      </div>

      {/* ── Bottom Overlay Card: Title, Description & CTA ── */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent pt-10 px-4 z-20 space-y-2.5"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[#FFCC00] text-[10px] font-black uppercase tracking-wider">
              <Megaphone className="w-3 h-3" />
              <span>Verified SpotNews Local Partner</span>
            </div>
            <h3 className="text-white text-base font-black leading-tight drop-shadow-sm">
              {ad.title}
            </h3>
            {ad.description && (
              <p className="text-white/80 text-xs line-clamp-2 leading-snug drop-shadow-xs">
                {ad.description}
              </p>
            )}
          </div>

          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center shrink-0 border border-white/20 active:scale-95 transition-all"
            title="Share Advertisement"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Call to Action Button */}
        {ad.cta_value && (
          <a
            href={getCtaLink()}
            target={ad.cta_type === 'call' ? '_self' : '_blank'}
            rel="noreferrer"
            className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all text-white ${
              ad.cta_type === 'whatsapp'
                ? 'bg-gradient-to-r from-[#25D366] to-[#128C7E] shadow-[0_4px_16px_rgba(37,211,102,0.4)]'
                : ad.cta_type === 'call'
                ? 'bg-gradient-to-r from-[#128842] to-[#0D6832] shadow-[0_4px_16px_rgba(18,136,66,0.4)]'
                : 'bg-gradient-to-r from-[#015BB3] to-[#0284c7] shadow-[0_4px_16px_rgba(1,91,179,0.4)]'
            }`}
          >
            {ad.cta_type === 'whatsapp' && (
              <>
                <MessageSquare className="w-4 h-4" />
                <span>Chat on WhatsApp / వాట్సాప్‌లో సంప్రదించండి</span>
              </>
            )}

            {ad.cta_type === 'call' && (
              <>
                <Phone className="w-4 h-4" />
                <span>Call Now: {ad.cta_value} / ఇప్పుడే కాల్ చేయండి</span>
              </>
            )}

            {ad.cta_type === 'link' && (
              <>
                <ExternalLink className="w-4 h-4" />
                <span>Visit Store / Website Link</span>
              </>
            )}
          </a>
        )}
      </div>
    </div>
  );
};
