import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, ThumbsUp, MessageCircle, Share2, Newspaper, ChevronUp, ChevronDown } from 'lucide-react';
import { NewsVideoPlayer } from './NewsVideoPlayer';
import mastheadLogo from '@/assets/rti_express_logo.png';
import { admobService } from '@/services/admob.service';
import { LocalAdFeedCard } from '@/components/LocalAdFeedCard';
import type { LocalAd } from '@/types/localAds';
import { StarRating } from '@/features/rating/StarRating';

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
  const [viewMode, setViewMode] = useState<'clipping' | 'text'>('text');
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const pagerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const initialScrollDone = useRef(false);

  // Auto-hide swipe hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowSwipeHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Smooth scroll to target story index
  const goToIndex = useCallback((targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const targetEl = itemRefs.current.get(targetIdx);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveIndex(targetIdx);
      setShowSwipeHint(false);
    }
  }, [items.length]);

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

  // Immediately track card swipe/scroll so previous news video stops without delay
  const handleScroll = useCallback(() => {
    setShowSwipeHint(false);
    const pager = pagerRef.current;
    if (!pager) return;
    const height = pager.clientHeight;
    if (!height) return;
    const currentIdx = Math.round(pager.scrollTop / height);
    if (currentIdx >= 0 && currentIdx < items.length && currentIdx !== activeIndex) {
      setActiveIndex(currentIdx);
    }
  }, [items.length, activeIndex]);

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
      {/* ── 1. FIXED TOP BAR (Always visible, #92C1F0, height 56px + safe-area, matches Image 2) ── */}
      <header
        className="flex-shrink-0 bg-[#92C1F0] text-black flex items-center justify-between px-3.5 z-30 shadow-xs"
        style={{ height: '56px', paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-black hover:bg-black/10 rounded-full active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            title="Back"
            aria-label="Back to feed"
          >
            <ArrowLeft className="w-6 h-6 text-black" strokeWidth={2.2} />
          </button>
          <h1 className="text-black font-bold text-[19px] tracking-wide font-sans m-0">
            News
          </h1>
        </div>

        {/* View Mode Toggle: Full Clipping vs Text (Matches Image 2) */}
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setViewMode('clipping')}
            className={`px-3.5 py-1.5 rounded-full font-bold transition-all flex items-center justify-center cursor-pointer ${
              viewMode === 'clipping'
                ? 'bg-white text-black border border-black/40 shadow-xs'
                : 'bg-black text-white shadow-xs'
            }`}
          >
            <span>Full Clipping</span>
          </button>
          <button
            onClick={() => setViewMode('text')}
            className={`px-3.5 py-1.5 rounded-full font-bold transition-all flex items-center justify-center cursor-pointer ${
              viewMode === 'text'
                ? 'bg-white text-black border border-black/40 shadow-xs'
                : 'bg-black text-white shadow-xs'
            }`}
          >
            <span>Text</span>
          </button>
        </div>
      </header>

      {/* ── Story Reading Progress Indicator (Inshorts style) ── */}
      <div className="w-full bg-black/15 h-[2.5px] z-30 shrink-0 overflow-hidden">
        <div
          className="h-full bg-[#0A56B3] transition-all duration-300 ease-out"
          style={{ width: `${items.length > 0 ? ((activeIndex + 1) / items.length) * 100 : 0}%` }}
        />
      </div>

      {/* ── 2. VERTICAL PAGER (Filling all remaining height, 1 page per news) ── */}
      <div
        ref={pagerRef}
        onScroll={handleScroll}
        className="flex-1 w-full bg-black overflow-y-auto snap-y snap-mandatory no-scrollbar relative min-h-0"
        style={{
          scrollBehavior: 'smooth',
          overscrollBehaviorY: 'contain',
          height: 'calc(100dvh - 56px)',
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

          const subheadline =
            item.subheadline ||
            item.sub_headline ||
            item.sub_title ||
            item.subtitle ||
            item.custom_layout?.subheadline ||
            item.custom_layout?.sub_headline ||
            item.config?.subheadline ||
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
            item.custom_layout?.image_url ||
            item.custom_layout?.imageUrls?.[0] ||
            item.custom_layout?.image_urls?.[0] ||
            (item.image_urls && item.image_urls[0]) ||
            (item.config?.imageUrls && item.config?.imageUrls[0]) ||
            (item.config as any)?.imageUrl ||
            item.preview_url;

          const hasRawClipping = Boolean(rawClippingUrl || videoUrl);

          const reporterName =
            item.reporter_name ||
            item.custom_layout?.reporterName ||
            item.custom_layout?.reporter_name ||
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
                className="w-full snap-start snap-always flex flex-col bg-black overflow-hidden relative select-none shrink-0"
                style={{
                  height: '100%',
                  minHeight: '100%',
                  maxHeight: '100%',
                }}
              >
                {/* ── Animated Card Wrapper: Smooth Scale, Depth & Fade on Swipe ── */}
                <div
                  className={`w-full h-full flex flex-col transition-all duration-500 ease-out ${
                    isActive
                      ? 'scale-100 opacity-100'
                      : index < activeIndex
                      ? 'scale-[0.96] opacity-40 -translate-y-2'
                      : 'scale-[0.96] opacity-40 translate-y-2'
                  }`}
                  style={{
                    transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
                  }}
                >
                  {/* ── FULL RAW CLIPPING (Uncropped, Full Resolution) ── */}
                  {viewMode === 'clipping' && hasRawClipping ? (
                  <div className="flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden">
                    {videoUrl ? (
                      <NewsVideoPlayer
                        src={videoUrl}
                        isActive={isActive}
                        objectFit="fill"
                        className="w-full h-full object-fill relative z-10"
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
                          className="w-full h-full object-fill relative z-10"
                          loading={Math.abs(activeIndex - index) <= 1 ? 'eager' : 'lazy'}
                        />
                      </>
                    )}
                  </div>
                ) : (
                  /* ── EDITORIAL / TEXT READER VIEW ── */
                  <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
                    {/* Media block (Takes ~38% height with sane min/max bounds) */}
                    <div
                      className="w-full relative bg-[#20252B] overflow-hidden flex-shrink-0"
                      style={{ height: '38%', minHeight: '190px', maxHeight: '280px' }}
                    >
                      {videoUrl ? (
                        <NewsVideoPlayer
                          src={videoUrl}
                          isActive={isActive}
                          objectFit="cover"
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
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#20252B] text-gray-400 relative">
                          <span className="absolute top-2.5 left-3 text-xs text-white/70 font-sans pointer-events-none">
                            Photo placeholder
                          </span>
                          <Newspaper className="w-12 h-12 mb-1 opacity-50" />
                          <span className="text-xs font-bold uppercase tracking-wider opacity-60">Spot News</span>
                        </div>
                      )}

                      {/* RTI Logo Overlay (Only shown on static photos, video shows only video by default) */}
                      {!videoUrl && (
                        <div className="absolute top-2.5 right-2.5 z-10 w-11 h-11 rounded-full bg-white shadow-md border-2 border-white/80 p-0.5 flex items-center justify-center overflow-hidden">
                          <img
                            src={mastheadLogo}
                            alt="RTI Spot News"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}

                      {/* Author Info Overlay Strip (Only shown for static photos, not overlapping video player) */}
                      {!videoUrl && (
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
                      )}
                    </div>

                    {/* Headline & Body Text (Scrolls comfortably inside flex-1 min-h-0) */}
                    <div className="flex-1 min-h-0 px-3.5 pt-3 pb-2 overflow-y-auto select-none font-sans">
                      <h2 className="text-[18px] sm:text-[19px] font-bold text-black leading-snug font-sans m-0">
                        {headline}
                      </h2>
                      {subheadline && (
                        <h3 className="text-[14px] font-bold text-black/90 mt-1 m-0">
                          {subheadline}
                        </h3>
                      )}
                      <p className="mt-2 text-[14.5px] sm:text-[15px] leading-[22px] sm:leading-[24px] text-[#333333] whitespace-pre-line m-0">
                        {bodyText}
                      </p>
                      {/* Star Rating for Reader */}
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <StarRating postId={item.id} reporterName={reporterName} />
                      </div>
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
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare(item);
                  }}
                  className="absolute left-1/2 -translate-x-1/2 -top-[24px] flex flex-col items-center z-30 cursor-pointer"
                >
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

      {/* ── Floating Up / Down Quick Navigators (Smooth animated story switching) ── */}
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-40 pointer-events-auto">
        {activeIndex > 0 && (
          <button
            onClick={() => goToIndex(activeIndex - 1)}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 flex items-center justify-center hover:bg-black/80 active:scale-90 transition-all shadow-md cursor-pointer"
            title="Previous Story"
            aria-label="Previous Story"
          >
            <ChevronUp className="w-4 h-4 text-white" />
          </button>
        )}
        {activeIndex < items.length - 1 && (
          <button
            onClick={() => goToIndex(activeIndex + 1)}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 flex items-center justify-center hover:bg-black/80 active:scale-90 transition-all shadow-md cursor-pointer animate-pulse"
            title="Next Story"
            aria-label="Next Story"
          >
            <ChevronDown className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {/* ── Animated Swipe Up Hint Indicator (Appears on first card to guide user) ── */}
      {showSwipeHint && activeIndex === 0 && items.length > 1 && (
        <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center animate-bounce">
          <div className="bg-black/85 backdrop-blur-md text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full shadow-xl border border-white/25 flex items-center gap-1.5 tracking-wide">
            <ChevronUp className="w-3.5 h-3.5 text-[#92C1F0] animate-pulse" />
            <span>పైకి స్వైప్ చేయండి · Swipe up for next</span>
          </div>
        </div>
      )}
    </div>
  );
};
