import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, ThumbsUp, MessageCircle, Share2, Newspaper, FileText, Image as ImageIcon } from 'lucide-react';
import mastheadLogo from '@/assets/rti_express_logo.png';
import { admobService } from '@/services/admob.service';
import { LocalAdFeedCard } from '@/components/LocalAdFeedCard';
import type { LocalAd } from '@/types/localAds';

export interface NewsDetailCardStackProps {
  items: any[];
  initialIndex?: number;
  onBack: () => void;
  onLike: (id: string, currentLikes: number) => void;
  likedIds?: Set<string>;
  onComment: (id: string) => void;
  onShare: (item: any) => void;
  onEndReached?: () => void;
  localAds?: LocalAd[];
}

export const NewsDetailCardStack: React.FC<NewsDetailCardStackProps> = ({
  items,
  initialIndex = 0,
  onBack,
  onLike,
  likedIds = new Set(),
  onComment,
  onShare,
  onEndReached,
  localAds = [],
}) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [viewMode, setViewMode] = useState<'clipping' | 'text'>('clipping');
  const pagerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const initialScrollDone = useRef(false);

  // Scroll to initial index once layout is ready
  useEffect(() => {
    if (initialScrollDone.current) return;
    const targetEl = itemRefs.current.get(initialIndex);
    if (targetEl && pagerRef.current) {
      targetEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      initialScrollDone.current = true;
    }
  }, [initialIndex, items.length]);

  // Track active page via IntersectionObserver
  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const indexStr = (entry.target as HTMLElement).dataset.index;
            if (indexStr != null) {
              const idx = parseInt(indexStr, 10);
              setActiveIndex((prevIdx) => {
                if (prevIdx !== idx) {
                  // Milestone check: triggers ad after every 5 clippings
                  admobService.onClippingViewed();
                }
                return idx;
              });
              // Trigger load-more when nearing last 2 items
              if (onEndReached && idx >= items.length - 2) {
                onEndReached();
              }
            }
          }
        });
      },
      {
        root: pager,
        threshold: 0.6,
      }
    );

    itemRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items.length, onEndReached]);

  const formatDate = useCallback((dateStr?: string) => {
    if (!dateStr) return 'Spot News 24x7';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white h-[100dvh] w-full select-none overflow-hidden">
      {/* ── 1. FIXED TOP BAR (Always visible, #0A56B3, height 56px + safe-area) ── */}
      <header
        className="flex-shrink-0 bg-[#0A56B3] text-white flex items-center justify-between px-3 z-30 shadow-sm"
        style={{ height: '56px', paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-2 -ml-1 text-white hover:bg-white/10 rounded-full active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            title="Back"
            aria-label="Back to feed"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-bold text-[18px] tracking-wide font-sans m-0">
            News
          </h1>
        </div>

        {/* View Mode Toggle: Full Clipping vs Text */}
        <div className="flex items-center bg-black/25 p-0.5 rounded-full border border-white/20 text-xs">
          <button
            onClick={() => setViewMode('clipping')}
            className={`px-3 py-1 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer ${
              viewMode === 'clipping'
                ? 'bg-white text-[#0A56B3] shadow-xs'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Full Clipping</span>
          </button>
          <button
            onClick={() => setViewMode('text')}
            className={`px-3 py-1 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer ${
              viewMode === 'text'
                ? 'bg-white text-[#0A56B3] shadow-xs'
                : 'text-white/80 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Text</span>
          </button>
        </div>
      </header>

      {/* ── 2. VERTICAL PAGER (Filling all remaining height, 1 page per news) ── */}
      <div
        ref={pagerRef}
        className="flex-1 w-full bg-black overflow-y-auto snap-y snap-mandatory no-scrollbar relative"
        style={{
          scrollBehavior: 'smooth',
          overscrollBehaviorY: 'contain',
        }}
      >
        {items.map((item, index) => {
          const isLiked = likedIds.has(item.id);
          const isActive = activeIndex === index;

          const headline =
            item.headline ||
            item.title ||
            item.config?.headline ||
            'Spot News Update';

          const bodyText =
            item.article_content ||
            item.summary ||
            item.content ||
            item.config?.articleContent ||
            '';

          const videoUrl =
            item.mp4_url ||
            item.mp4Url ||
            item.video_url ||
            item.videoUrl ||
            item.custom_layout?.mp4_url ||
            item.custom_layout?.mp4Url ||
            item.custom_layout?.videoUrl ||
            item.custom_layout?.video_url ||
            item.config?.videoUrl;

          const rawClippingUrl =
            item.png_url ||
            item.pngUrl ||
            item.custom_layout?.png_url ||
            item.custom_layout?.pngUrl ||
            item.clipping_url;

          const articlePhotoUrl =
            item.image_url ||
            item.imageUrl ||
            (item.image_urls && item.image_urls[0]) ||
            (item.config?.imageUrls && item.config?.imageUrls[0]);

          const hasRawClipping = Boolean(rawClippingUrl || videoUrl);

          const reporterName =
            item.reporter_name ||
            item.custom_layout?.reporterName ||
            item.author_name ||
            item.user_name ||
            'Mohithroyal Pokkala';

          const formattedTime = formatDate(item.created_at || item.createdAt);

          const isAdInterval = (index + 1) % 10 === 0 || index === 4;
          const isShortFeedEnd = items.length < 5 && index === items.length - 1;
          const shouldShowLocalAd = (isAdInterval || isShortFeedEnd) && localAds.length > 0;
          const localAdIndex = Math.floor(index / 5) % (localAds.length || 1);
          const localAd = localAds[localAdIndex];

          return (
            <React.Fragment key={item.id || index}>
              <div
                data-index={index}
                ref={(el) => {
                  if (el) itemRefs.current.set(index, el);
                  else itemRefs.current.delete(index);
                }}
              className="h-full w-full snap-start snap-always flex flex-col bg-black overflow-hidden relative select-none"
              style={{ minHeight: '100%' }}
            >
              {/* ── FULL RAW CLIPPING (Uncropped, Full Resolution) ── */}
              {viewMode === 'clipping' && hasRawClipping ? (
                <div className="flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden">
                  {videoUrl ? (
                    <video
                      src={videoUrl}
                      controls
                      autoPlay={isActive}
                      loop
                      playsInline
                      className="w-full h-full object-contain relative z-10"
                    />
                  ) : (
                    <>
                      {/* Ambient background blur */}
                      <div
                        className="absolute inset-0 opacity-25 scale-110 blur-xl bg-cover bg-center"
                        style={{ backgroundImage: `url(${rawClippingUrl})` }}
                      />
                      <img
                        src={rawClippingUrl}
                        alt={headline}
                        className="w-full h-full object-contain relative z-10"
                        loading={Math.abs(activeIndex - index) <= 1 ? 'eager' : 'lazy'}
                      />
                    </>
                  )}
                </div>
              ) : (
                /* ── EDITORIAL / TEXT READER VIEW ── */
                <div className="flex-1 flex flex-col overflow-y-auto bg-white">
                  {/* Media block */}
                  <div
                    className="w-full relative bg-gray-100 overflow-hidden flex-shrink-0"
                    style={{ height: '38%' }}
                  >
                    {videoUrl ? (
                      <video
                        src={videoUrl}
                        controls
                        autoPlay={isActive}
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (articlePhotoUrl || rawClippingUrl) ? (
                      <img
                        src={articlePhotoUrl || rawClippingUrl}
                        alt={headline}
                        className="w-full h-full object-cover"
                        loading={Math.abs(activeIndex - index) <= 1 ? 'eager' : 'lazy'}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 text-gray-400">
                        <Newspaper className="w-12 h-12 mb-1 opacity-50" />
                        <span className="text-xs font-bold uppercase tracking-wider opacity-60">Spot News</span>
                      </div>
                    )}

                    {/* RTI Logo Overlay */}
                    <div className="absolute top-2.5 right-2.5 z-10 w-11 h-11 rounded-full bg-white shadow-md border-2 border-white/80 p-0.5 flex items-center justify-center overflow-hidden">
                      <img
                        src={mastheadLogo}
                        alt="RTI Spot News"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Author Info Overlay Strip */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-6 pb-2 px-3 flex items-center justify-between text-white z-10">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#015BB3] border border-white/80 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                          {(reporterName || 'R')[0].toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0 leading-tight">
                          <span className="text-[12px] font-bold text-white truncate drop-shadow-sm">
                            {reporterName}
                          </span>
                          <span className="text-[10px] text-white/80 font-medium tracking-wide">
                            {formattedTime}
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#0A56B3] px-2 py-0.5 rounded text-[9.5px] font-black tracking-wider uppercase border border-white/40 shadow-sm">
                        RTI EXPRESS
                      </div>
                    </div>
                  </div>

                  {/* Headline */}
                  <div className="px-3.5 pt-3 pb-1 flex-shrink-0">
                    <h2 className="text-[17px] sm:text-[18px] font-bold text-[#111827] line-clamp-3 leading-snug font-sans m-0">
                      {headline}
                    </h2>
                  </div>

                  {/* Body text */}
                  <div className="flex-1 px-3.5 pt-1.5 pb-2 text-[14.5px] sm:text-[15px] leading-[22px] sm:leading-[24px] text-[#333333] overflow-y-auto select-none font-sans">
                    <p className="m-0 whitespace-pre-line">
                      {bodyText}
                    </p>
                  </div>

                  {/* Ticker strip */}
                  <div className="h-[30px] flex-shrink-0 bg-black text-white px-3 flex items-center justify-between text-[10.5px] sm:text-[11px] font-bold tracking-tight select-none z-10">
                    <span className="truncate pr-2">
                      RTI Spot News: మీ ఊరి వార్తలు, మీ ఊరి ఆరోగ్యం - మీ చేతుల్లో
                    </span>
                    <span className="shrink-0 text-white font-extrabold uppercase">
                      WANTED REPORTERS: 7668886666
                    </span>
                  </div>
                </div>
              )}

              {/* ── [E] BOTTOM ACTION BAR (Pinned at bottom of page, height 56px + safe-area) ── */}
              <div
                className="bg-white border-t border-[#DDDDDD] flex items-center justify-between px-4 flex-shrink-0 relative select-none z-20"
                style={{
                  height: '56px',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
              >
                {/* Left: Like icon + count (flex: 1) */}
                <div className="flex-1 flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLike(item.id, item.likes_count || 0);
                    }}
                    className={`flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer ${
                      isLiked ? 'text-[#0A56B3]' : 'text-[#444444]'
                    }`}
                  >
                    <ThumbsUp
                      className={`w-5 h-5 ${
                        isLiked ? 'text-[#0A56B3] fill-[#0A56B3]' : 'text-[#444444]'
                      }`}
                    />
                    <span className="text-[13.5px] font-semibold text-[#444444]">
                      {item.likes_count || 0}
                    </span>
                  </button>
                </div>

                {/* Center: Raised Circular SHARE button (56x56, #0A56B3, margin-top -24px) */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-[24px] flex flex-col items-center z-30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(item);
                    }}
                    className="w-[56px] h-[56px] rounded-full bg-[#0A56B3] border-[3px] border-white flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer text-white"
                    title="Share News"
                    aria-label="Share News"
                  >
                    <Share2 className="w-5 h-5 text-white stroke-[2.5]" />
                  </button>
                  <span className="text-[9px] font-extrabold text-gray-500 mt-1 uppercase tracking-wider">
                    SHARE
                  </span>
                </div>

                {/* Right: Comment icon + count (flex: 1, right-aligned) */}
                <div className="flex-1 flex items-center justify-end gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onComment(item.id);
                    }}
                    className="flex items-center gap-1.5 text-[#444444] hover:text-[#0A56B3] active:scale-95 transition-transform cursor-pointer"
                  >
                    <MessageCircle className="w-5 h-5 text-[#444444]" />
                    <span className="text-[13.5px] font-semibold text-[#444444]">
                      {item.comments_count || 0}
                    </span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(item);
                    }}
                    className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-[#0A56B3] active:scale-95 transition-transform cursor-pointer"
                    title="More Share Options"
                  >
                    <Share2 className="w-4 h-4 text-[#0A56B3]" />
                  </button>
                </div>
              </div>
            </div>

            {shouldShowLocalAd && localAd && (
              <LocalAdFeedCard
                key={`reader-local-ad-${localAd.id}-${index}`}
                ad={localAd}
                index={index}
              />
            )}
          </React.Fragment>
        );
      })}
      </div>
    </div>
  );
};
