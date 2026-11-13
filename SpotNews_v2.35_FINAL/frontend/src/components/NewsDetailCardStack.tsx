import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, ThumbsUp, MessageCircle, Share2, Newspaper, ChevronUp, ChevronDown } from 'lucide-react';
import { NewsVideoPlayer } from './NewsVideoPlayer';
import mastheadLogo from '@/assets/rti_express_logo.png';
import { LocalAdFeedCard } from '@/components/LocalAdFeedCard';
import { BrandDealCard } from '@/components/BrandDealCard';
import type { BrandAd } from '@/services/brandAds.service';
import { limitWordsForDisplay, MAX_HEADLINE_WORDS, MAX_ARTICLE_WORDS } from '@/utils/wordLimit';
import type { LocalAd } from '@/types/localAds';
import { localAdsService } from '@/services/localAds.service';
import { StarRating } from '@/features/rating/StarRating';
import { TwoImageGallery, getClipPhotos } from '@/components/TwoImageGallery';
import { publicClient } from '@/lib/supabase';

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
  brandAds?: BrandAd[];
  /** 'clipping' opens the newspaper clipping image first */
  initialMode?: 'clipping' | 'text';
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
  brandAds = [],
  initialMode = 'text',
}) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [viewMode, setViewMode] = useState<'clipping' | 'text'>(initialMode);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const pagerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const initialScrollDone = useRef(false);

  // Ensure local ads are always loaded even if parent feed hasn't passed them yet
  const [internalAds, setInternalAds] = useState<LocalAd[]>(() => {
    if (localAds && localAds.length > 0) return localAds;
    try {
      const c = localStorage.getItem('spotnews_active_local_ads_cache_v1');
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (localAds && localAds.length > 0) {
      setInternalAds(localAds);
    } else {
      localAdsService.fetchActiveLocalAds().then((ads) => {
        if (ads && ads.length > 0) setInternalAds(ads);
      }).catch(() => {});
    }
  }, [localAds]);
  const effectiveLocalAds = internalAds.length > 0 ? internalAds : localAds;

  // Auto-hide swipe hint after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowSwipeHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Track unique view when a clipping is focused/read in detail pager
  const viewedItemsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const cur = items[activeIndex];
    if (cur?.id && !viewedItemsRef.current.has(cur.id)) {
      viewedItemsRef.current.add(cur.id);
      const effectiveViewerId = localStorage.getItem('spotnews_guest_user_id') || undefined;
      Promise.resolve(
        publicClient.rpc('increment_clipping_view', {
          p_clipping_id: cur.id,
          p_viewer_id: effectiveViewerId,
        })
      )
        .then(({ data, error }: any) => {
          if (!error && data?.success && typeof data.views_count === 'number') {
            cur.views_count = data.views_count;
          }
        })
        .catch(() => {});
    }
  }, [activeIndex, items]);

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
              setActiveIndex(idx);
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

  // Immediately track card swipe/scroll accurately regardless of inserted ads
  const handleScroll = useCallback(() => {
    setShowSwipeHint(false);
    const pager = pagerRef.current;
    if (!pager) return;

    const pagerRect = pager.getBoundingClientRect();
    const pagerCenterY = pagerRect.top + pagerRect.height / 2;
    let closestIdx = activeIndex;
    let minDistance = Infinity;

    itemRefs.current.forEach((el, idx) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const elCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(elCenterY - pagerCenterY);
      if (distance < minDistance) {
        minDistance = distance;
        closestIdx = idx;
      }
    });

    if (closestIdx !== activeIndex) {
      setActiveIndex(closestIdx);
    }
  }, [activeIndex]);

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

  const textTouchStartRef = useRef<{ x: number; y: number; atBottom: boolean; atTop: boolean } | null>(null);

  const handleTextTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 6;
    const atTop = el.scrollTop <= 4;
    textTouchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      atBottom,
      atTop,
    };
  }, []);

  const handleTextTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!textTouchStartRef.current) return;
    const deltaX = Math.abs(textTouchStartRef.current.x - e.changedTouches[0].clientX);
    const deltaY = textTouchStartRef.current.y - e.changedTouches[0].clientY;
    const el = e.currentTarget;
    const isNowAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 6;
    const isNowAtTop = el.scrollTop <= 4;

    // Only handle mostly-vertical swipes
    if (Math.abs(deltaY) > 30 && Math.abs(deltaY) > deltaX) {
      // Swiping UP: advance to next news or ad if at bottom
      if (deltaY > 30 && (textTouchStartRef.current.atBottom || isNowAtBottom)) {
        const currentEl = itemRefs.current.get(activeIndex);
        if (currentEl && currentEl.nextElementSibling) {
          (currentEl.nextElementSibling as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          goToIndex(activeIndex + 1);
        }
      }
      // Swiping DOWN: go to previous news if at top
      else if (deltaY < -30 && (textTouchStartRef.current.atTop || isNowAtTop)) {
        const currentEl = itemRefs.current.get(activeIndex);
        if (currentEl && currentEl.previousElementSibling) {
          (currentEl.previousElementSibling as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          goToIndex(activeIndex - 1);
        }
      }
    }
    textTouchStartRef.current = null;
  }, [activeIndex, goToIndex]);

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
          <h1 className="text-black font-bold text-[21px] tracking-wide font-sans m-0">
            News
          </h1>
        </div>

        {/* Quick Prev / Next Navigator (Inside Header - 100% clean reading area) */}
        <div className="flex items-center gap-1 mr-auto ml-2">
          <button
            onClick={() => activeIndex > 0 && goToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              activeIndex === 0 ? 'text-black/20 cursor-not-allowed' : 'text-[#0A56B3] bg-white/80 active:scale-95 shadow-2xs hover:bg-white cursor-pointer'
            }`}
            title="Previous Story"
            aria-label="Previous Story"
          >
            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            onClick={() => activeIndex < items.length - 1 && goToIndex(activeIndex + 1)}
            disabled={activeIndex >= items.length - 1}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              activeIndex >= items.length - 1 ? 'text-black/20 cursor-not-allowed' : 'text-[#0A56B3] bg-white/80 active:scale-95 shadow-2xs hover:bg-white cursor-pointer'
            }`}
            title="Next Story"
            aria-label="Next Story"
          >
            <ChevronDown className="w-4 h-4 stroke-[2.5]" />
          </button>
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

          const clipPhotos = getClipPhotos(item);
          const isTwoImage = clipPhotos.length >= 2 || ['C', 'D'].includes(item.custom_layout?.layoutPattern || item.custom_layout?.layout_pattern || item.layout_pattern || item.pattern || item.image_layout || item.config?.layoutPattern || '');

          const rawHeadline = item.headline ||
            item.title ||
            item.config?.headline ||
            'Spot News Update';

          const headline = isTwoImage
            ? rawHeadline
            : limitWordsForDisplay(rawHeadline, MAX_HEADLINE_WORDS);

          const originalBodyText = item.article_content ||
            item.summary ||
            item.content ||
            item.config?.articleContent ||
            '';

          const rawBodyText = isTwoImage
            ? originalBodyText
            : limitWordsForDisplay(originalBodyText, MAX_ARTICLE_WORDS);

          // Single paragraph in feed view: collapse all newlines and multiple spaces
          const bodyText = rawBodyText
            ? rawBodyText.replace(/[\r\n]+/g, ' ').replace(/[ \t]+/g, ' ').trim()
            : '';

          const subheadline =
            item.subheadline ||
            item.sub_headline ||
            item.sub_title ||
            item.subtitle ||
            item.custom_layout?.subheadline ||
            item.custom_layout?.sub_headline ||
            item.config?.subheadline ||
            '';

          const cl = item.custom_layout || {};

          // Original uploaded news video (used ONLY in Text reader view)
          const originalVideoUrl =
            cl.video_url ||
            cl.videoUrl ||
            item.video_url ||
            item.videoUrl ||
            item.config?.videoUrl ||
            '';

          // Composed clipping video (used ONLY in Full Clipping view)
          const clippingVideoUrl =
            item.mp4_url ||
            item.mp4Url ||
            cl.mp4_url ||
            cl.mp4Url ||
            '';

          const rawClippingUrl =
            item.png_url ||
            item.pngUrl ||
            cl.png_url ||
            cl.pngUrl ||
            item.clipping_url;

          const cardPhotos = clipPhotos.length > 0 ? clipPhotos : (rawClippingUrl ? [rawClippingUrl] : (item.preview_url ? [item.preview_url] : []));

          const hasRawClipping = Boolean(rawClippingUrl || clippingVideoUrl);

          const reporterName =
            item.reporter_name ||
            item.custom_layout?.reporterName ||
            item.custom_layout?.reporter_name ||
            item.author_name ||
            item.user_name ||
            'RTI Express Reporter';

          const formattedTime = formatDate(item.created_at || item.createdAt);

          const isAdInterval = (index + 1) % 5 === 0;
          const shouldShowLocalAd = isAdInterval && effectiveLocalAds.length > 0;
          const localAdIndex = Math.floor(index / 5) % (effectiveLocalAds.length || 1);
          const localAd = effectiveLocalAds[localAdIndex];
          const showBrandAd = brandAds.length > 0 && (index + 1) % 7 === 0 && !shouldShowLocalAd;
          const brandAd = brandAds[Math.floor(index / 7) % (brandAds.length || 1)];

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
                {/* ── Card Wrapper: Always Full Brightness & Clean Reading Display ── */}
                <div className="w-full h-full flex flex-col opacity-100">
                  {/* ── FULL RAW CLIPPING (Uncropped, Full Resolution) ── */}
                  {viewMode === 'clipping' && hasRawClipping ? (
                  <div className="flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden">
                    {clippingVideoUrl ? (
                      <NewsVideoPlayer
                        src={clippingVideoUrl}
                        isActive={isActive}
                        objectFit="fill"
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
                  <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
                    {/* Media block (Takes ~38% height with sane min/max bounds, object-contain with ambient blur so NO heads/banners get cropped) */}
                    <div
                      className="w-full relative bg-[#0f172a] overflow-hidden flex-shrink-0 flex items-center justify-center"
                      style={{ height: '38%', minHeight: '190px', maxHeight: '280px' }}
                    >
                      {originalVideoUrl ? (
                        <NewsVideoPlayer
                          src={originalVideoUrl}
                          isActive={isActive}
                          objectFit="contain"
                          className="w-full h-full object-contain relative z-10"
                        />
                      ) : cardPhotos.length > 0 ? (
                        <TwoImageGallery
                          photos={cardPhotos}
                          alt={headline}
                          onImageClick={() => setViewMode('clipping')}
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
                      {!originalVideoUrl && (
                        <div className="absolute top-2.5 right-2.5 z-10 w-11 h-11 rounded-full bg-white shadow-md border-2 border-white/80 p-0.5 flex items-center justify-center overflow-hidden">
                          <img
                            src={mastheadLogo}
                            alt="RTI Spot News"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}

                    </div>

                    {/* Headline & Body Text (Scrollable container so full content is readable; swipes at bottom advance to next news) */}
                    <div
                      onTouchStart={handleTextTouchStart}
                      onTouchEnd={handleTextTouchEnd}
                      className="flex-1 min-h-0 px-4 pt-2.5 pb-3 overflow-y-auto font-sans"
                      style={{
                        WebkitOverflowScrolling: 'touch',
                      }}
                    >
                      {/* Clean Author Strip (Placed above headline - leaves photo 100% clean & uncropped) */}
                      {reporterName && (
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-[#0A56B3] text-white flex items-center justify-center text-[12.5px] font-bold shadow-xs shrink-0">
                              {(reporterName || 'R')[0].toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0 leading-tight">
                              <span className="text-[13.5px] font-bold text-[#0A2540] truncate">
                                {reporterName}
                              </span>
                              {formattedTime && (
                                <span className="text-[11.5px] text-gray-500 font-medium">
                                  {formattedTime}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="bg-[#0A56B3]/10 text-[#0A56B3] px-2 py-0.5 rounded text-[11px] font-extrabold tracking-wider uppercase shrink-0">
                            RTI EXPRESS
                          </span>
                        </div>
                      )}
                      <h2 className="text-[22px] sm:text-[23px] font-extrabold text-[#0A2540] leading-[1.35] font-sans m-0 tracking-tight">
                        {headline}
                      </h2>
                      {subheadline && (
                        <h3 className="text-[15.5px] font-bold text-black/90 mt-1 m-0">
                          {subheadline}
                        </h3>
                      )}
                      <p className="mt-2.5 text-[22px] sm:text-[23px] leading-[36px] sm:leading-[38px] text-[#1F2937] m-0 pb-3">
                        {bodyText}
                      </p>
                    </div>
                    {/* Star rating: one fixed row, so the story always fits one screen (one swipe = next story) */}
                    <div className="shrink-0 px-3 py-1 border-t border-gray-200 bg-[#F8FAFD]">
                      <StarRating postId={item.id} reporterName={reporterName} compact />
                    </div>

                    {/* Ticker strip */}
                    <div className="h-[30px] flex-shrink-0 bg-black text-white px-3 flex items-center justify-between text-[12px] sm:text-[12.5px] font-bold tracking-tight select-none z-10">
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
                    <span className="text-[15px] font-semibold text-[#444444]">
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
                  <span className="text-[10.5px] font-extrabold text-gray-500 mt-1 uppercase tracking-wider">
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
                    <span className="text-[15px] font-semibold text-[#444444]">
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
              {showBrandAd && brandAd && <BrandDealCard key={`reader-brand-${brandAd.id}-${index}`} ad={brandAd} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Quick Navigators moved to header bar for 100% clean, unobstructed reading view */}

      {/* ── Animated Swipe Up Hint Indicator (Appears on first card to guide user) ── */}
      {showSwipeHint && activeIndex === 0 && items.length > 1 && (
        <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center animate-bounce">
          <div className="bg-black/85 backdrop-blur-md text-white text-[12.5px] font-bold px-3.5 py-1.5 rounded-full shadow-xl border border-white/25 flex items-center gap-1.5 tracking-wide">
            <ChevronUp className="w-3.5 h-3.5 text-[#92C1F0] animate-pulse" />
            <span>పైకి స్వైప్ చేయండి · Swipe up for next</span>
          </div>
        </div>
      )}
    </div>
  );
};
