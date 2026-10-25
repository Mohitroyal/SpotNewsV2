import React, { useState, useEffect, useRef } from 'react';
import { Newspaper, RefreshCw, X, Send, Share2, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import locationMapPinIcon from '@/assets/location_map_pin.png';
import { useAuthStore, useUIStore } from '@/store';
import { supabase } from '@/lib/supabase';
import { NewsDetailCardStack } from '@/components/NewsDetailCardStack';
import { admobService } from '@/services/admob.service';
import { localAdsService } from '@/services/localAds.service';
import { LocalAdFeedCard } from '@/components/LocalAdFeedCard';
import type { LocalAd } from '@/types/localAds';
import { AdvisoryCard } from '@/features/weather/AdvisoryCard';
import { useAdvisory } from '@/features/weather/useAdvisory';
import { useWeather, getWeatherInfo } from '@/services/weatherService';
import { ShareAfterClipping } from '@/features/share/ShareAfterClipping';

interface Comment {
  id: string;
  clipping_id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export const FeedScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetClipId = searchParams.get('clipId') || searchParams.get('id');
  const { user } = useAuthStore();
  const district = useAuthStore((state) => state.district) || '';
  const userState = useAuthStore((state) => state.userState) || '';
  const isFullScreenFeed = useUIStore((state) => state.isFullScreenFeed);
  const setIsFullScreenFeed = useUIStore((state) => state.setIsFullScreenFeed);
  const [clippings, setClippings] = useState<any[]>([]);
  const [localAds, setLocalAds] = useState<LocalAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null);

  // Automatically toggle full-screen mode to hide the bottom railbar during full page preview
  useEffect(() => {
    if (activeDetailIndex !== null) {
      setIsFullScreenFeed(true);
    }
  }, [activeDetailIndex, setIsFullScreenFeed]);

  useEffect(() => {
    return () => {
      setIsFullScreenFeed(false);
    };
  }, [setIsFullScreenFeed]);

  // In-memory session guard (prevents firing twice within a single scroll session)
  const viewedIds = useRef<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Liked clipping IDs by this user (stored in state for toggle)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // Weather Advisory
  const { advisory } = useAdvisory(district);
  const [showWeatherModal, setShowWeatherModal] = useState(false);

  // Live Weather from Open-Meteo
  const { data: liveWeather } = useWeather({
    state: userState,
    district,
  });
  const weatherInfo = getWeatherInfo(
    liveWeather?.weatherCode ?? -1,
    liveWeather?.isDay ?? 1
  );
  const WeatherIcon = weatherInfo.Icon;

  // Comments drawer state
  const [commentOpen, setCommentOpen] = useState<string | null>(null); // clipping id
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  // Share drawer state
  const [shareSheetOpen, setShareSheetOpen] = useState<any | null>(null);

  const handleShareClick = (clip: any) => {
    setShareSheetOpen(clip);
  };

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      let query = supabase
        .from('clippings')
        .select('*')
        .eq('is_posted', true)
        .eq('status', 'approved')
        .gte('created_at', todayISO)
        .order('created_at', { ascending: false });

      if (userState && userState !== 'All' && userState !== 'Both states') {
        query = query.eq('state', userState);
      }
      if (district && district !== 'All districts' && district !== 'All' && district !== 'All Regions') {
        query = query.eq('district', district);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Only display clippings that are posted AND explicitly approved by admin
      let postedClippings = (data || []).filter(
        (c) => c.is_posted === true && c.status === 'approved'
      );

      // If no clippings posted today specifically, fall back to recent published news
      if (postedClippings.length === 0) {
        let fallbackQuery = supabase
          .from('clippings')
          .select('*')
          .eq('is_posted', true)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(30);

        if (userState && userState !== 'All' && userState !== 'Both states') {
          fallbackQuery = fallbackQuery.eq('state', userState);
        }
        if (district && district !== 'All districts' && district !== 'All' && district !== 'All Regions') {
          fallbackQuery = fallbackQuery.eq('district', district);
        }

        const { data: fallbackData } = await fallbackQuery;
        postedClippings = (fallbackData || []).filter(
          (c) => c.is_posted === true && c.status === 'approved'
        );

        // If district-filtered query has no clippings, fetch latest across all regions
        if (postedClippings.length === 0) {
          const { data: allData } = await supabase
            .from('clippings')
            .select('*')
            .eq('is_posted', true)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(30);

          postedClippings = (allData || []).filter(
            (c) => c.is_posted === true && c.status === 'approved'
          );
        }
      }

      // Deep link support: If clipId query param is present, prioritize or fetch that clipping
      const urlParams = new URLSearchParams(window.location.search);
      const targetClip = urlParams.get('clipId') || urlParams.get('id') || searchParams.get('clipId') || searchParams.get('id');
      if (targetClip) {
        const found = postedClippings.find((c) => String(c.id) === String(targetClip));
        if (found) {
          postedClippings = [found, ...postedClippings.filter((c) => String(c.id) !== String(targetClip))];
          setActiveDetailIndex(0);
          setIsFullScreenFeed(true);
        } else {
          try {
            const { data: directClip } = await supabase
              .from('clippings')
              .select('*')
              .eq('id', targetClip)
              .eq('is_posted', true)
              .eq('status', 'approved')
              .maybeSingle();
            if (directClip) {
              postedClippings = [directClip, ...postedClippings];
              setActiveDetailIndex(0);
              setIsFullScreenFeed(true);
            }
          } catch (e) {
            console.warn('Could not fetch deep-linked clipping', e);
          }
        }
      }

      setClippings(postedClippings);
    } catch (err) {
      console.error('Failed to fetch feed', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Like toggle ────────────────────────────────────────────────────────────
  const handleLike = async (id: string, currentLikes: number) => {
    const alreadyLiked = likedIds.has(id);
    const newCount = alreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

    // Optimistic UI
    setClippings((prev) =>
      prev.map((c) => (c.id === id ? { ...c, likes_count: newCount } : c))
    );
    setLikedIds((prev) => {
      const next = new Set(prev);
      alreadyLiked ? next.delete(id) : next.add(id);
      return next;
    });

    try {
      await supabase.from('clippings').update({ likes_count: newCount }).eq('id', id);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Open comments ─────────────────────────────────────────────────────────
  const openComments = async (clipId: string) => {
    setCommentOpen(clipId);
    setCommentText('');
    try {
      const { data } = await supabase
        .from('lipping_comments')
        .select('*')
        .eq('clipping_id', clipId)
        .order('created_at', { ascending: true });
      const fetched = data || [];
      setComments(fetched);
      // Sync real count into clippings state so the counter is accurate
      setClippings((prev) =>
        prev.map((c) =>
          c.id === clipId ? { ...c, comments_count: fetched.length } : c
        )
      );
    } catch {
      setComments([]);
    }
    setTimeout(() => commentInputRef.current?.focus(), 300);
  };

  // ── Submit comment ────────────────────────────────────────────────────────
  const submitComment = async () => {
    if (!commentText.trim() || !commentOpen || submitting) return;
    setSubmitting(true);
    const text = commentText.trim();
    const userName =
      user?.full_name || user?.firstName || (user as any)?.user_metadata?.full_name || 'Anonymous';

    try {
      const { data, error } = await supabase
        .from('lipping_comments')
        .insert({
          clipping_id: commentOpen,
          user_id: user?.id || null,
          user_name: userName,
          text,
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistic UI bump for comment count (trigger updates DB)
      setClippings((prev) =>
        prev.map((c) =>
          c.id === commentOpen ? { ...c, comments_count: (c.comments_count || 0) + 1 } : c
        )
      );
      setComments((prev) => [...prev, data as Comment]);
      setCommentText('');
    } catch (err) {
      console.error('Comment failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Auto-view tracking via IntersectionObserver + DB unique constraint ─────
  // The clipping_views table has PRIMARY KEY (clipping_id, user_id) so the
  // same user can NEVER insert twice — uniqueness is enforced at DB level.
  useEffect(() => {
    if (clippings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.clipId;
            // In-memory guard: skip if already processed this scroll session
            if (!id || viewedIds.current.has(id)) return;
            viewedIds.current.add(id);

            // 🎯 Trigger AdMob: displays an ad after every 5 clippings viewed
            admobService.onClippingViewed();

            if (user?.id) {
              try {
                // Insert into clipping_views — will silently fail on duplicate
                const { error } = await supabase
                  .from('clipping_views')
                  .insert({ clipping_id: id, user_id: user.id });

                if (error) {
                  // Error code 23505 = unique violation = already viewed → skip
                  return;
                }

                // New unique view — optimistic UI update
                setClippings((prev) =>
                  prev.map((c) =>
                    c.id === id ? { ...c, views_count: (c.views_count || 0) + 1 } : c
                  )
                );
                // DB trigger (trg_sync_views_count) auto-increments views_count
              } catch (err) {
                console.error('View tracking failed', err);
              }
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    cardRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [clippings.length, user?.id]);


  useEffect(() => {
    fetchFeed();
    const loadAds = async () => {
      const ads = await localAdsService.fetchActiveLocalAds(district);
      setLocalAds(ads);
    };
    loadAds();
  }, [district, userState, targetClipId]);

  // Deep-link handler: automatically open clipping detail if clipId is in URL
  useEffect(() => {
    if (!targetClipId) return;
    const loadTargetClip = async () => {
      const existingIndex = clippings.findIndex((c) => String(c.id) === String(targetClipId));
      if (existingIndex !== -1) {
        setActiveDetailIndex(existingIndex);
        setIsFullScreenFeed(true);
        return;
      }

      try {
        const { data: directClip } = await supabase
          .from('clippings')
          .select('*')
          .eq('id', targetClipId)
          .eq('is_posted', true)
          .eq('status', 'approved')
          .maybeSingle();

        if (directClip) {
          setClippings((prev) => [directClip, ...prev.filter((c) => String(c.id) !== String(targetClipId))]);
          setActiveDetailIndex(0);
          setIsFullScreenFeed(true);
        }
      } catch (err) {
        console.warn('Failed to load target clipping on deep link:', err);
      }
    };
    loadTargetClip();
  }, [targetClipId]);

  return (
    <div className={`flex flex-col h-[100dvh] bg-black ${!isFullScreenFeed ? 'pb-[60px]' : ''}`}>
      {!isFullScreenFeed && (
        <div className="flex-shrink-0 bg-[#F4F8FC] border-b border-[#D8E4F2] px-3.5 pt-3 pb-3 space-y-2.5">
          {/* ── Top Card: Showing news for + Weather ── */}
          <div className="bg-white border border-[#D9E5F2] rounded-[20px] p-3 px-3.5 shadow-sm flex items-center justify-between">
            {/* Left: Region / District Selector */}
            <div
              onClick={() => navigate('/location')}
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer active:opacity-80"
              title="Change location"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-2xs flex items-center justify-center">
                <img
                  src={locationMapPinIcon}
                  alt="Location map pin"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] text-[#64748B] font-medium leading-tight">
                  Showing news for
                </span>
                <div className="flex items-center gap-1 text-[15px] font-bold text-[#0F172A] leading-snug mt-0.5 truncate">
                  <span className="truncate">{userState && userState !== 'All' ? userState : 'Both states'}</span>
                  <ChevronDown className="w-4 h-4 text-[#64748B] shrink-0" strokeWidth={2.2} />
                </div>
                <span className="text-[11.5px] text-[#64748B] font-medium leading-tight mt-0.5 truncate">
                  {district && district !== 'All' && district !== 'All districts' ? district : 'All districts'}
                </span>
              </div>
            </div>

            {/* Vertical Divider */}
            <div className="h-10 w-[1px] bg-[#E2E8F0] mx-3 shrink-0" />

            {/* Right: Weather Icon + Temperature */}
            <div
              onClick={() => setShowWeatherModal(true)}
              className="flex flex-col items-center justify-center shrink-0 min-w-[54px] cursor-pointer active:scale-95 transition-transform"
              title={liveWeather ? `${weatherInfo.label} · ${Math.round(liveWeather.temperature)}°C (Click for Advisory)` : 'View Weather & Health Advisory'}
            >
              {weatherInfo.iconUrl ? (
                <img
                  src={weatherInfo.iconUrl}
                  alt={weatherInfo.label}
                  className="w-5 h-5 object-contain select-none"
                  draggable={false}
                />
              ) : (
                <WeatherIcon className={`w-5 h-5 ${weatherInfo.colorClass}`} strokeWidth={2.2} />
              )}
              <span className="text-[15px] font-bold text-[#0F172A] leading-tight mt-0.5">
                {liveWeather !== null ? `${Math.round(liveWeather.temperature)}°C` : '--°C'}
              </span>
            </div>
          </div>

          {/* ── Blue Button [LATEST Line]: Opens Third Page Modal ── */}
          <button
            type="button"
            onClick={() => setShowWeatherModal(true)}
            className="w-full bg-[#0B56A6] hover:bg-[#094688] active:scale-[0.99] text-white rounded-[14px] px-3.5 py-2.5 flex items-center justify-between shadow-xs transition-all cursor-pointer border-0 text-left"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
              <span className="bg-[#CC1E1E] text-white text-[9.5px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 shadow-2xs">
                LATEST
              </span>
              <span className="text-white text-xs sm:text-[13px] font-semibold truncate leading-tight">
                {advisory?.headline_te || (district ? `${district} - సాధారణ వాతావరణం, ఆరోగ్య సూచనలు` : 'సాధారణ వాతావరణం, ఆరోగ్య సూచనలు')}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-white/90 shrink-0 ml-1" strokeWidth={2.5} />
          </button>

          {/* ── Today's News Feed + Refresh Button ── */}
          <div className="flex items-center justify-between px-0.5 pt-0.5">
            <h1 className="text-[#0F172A] text-[18px] sm:text-[19px] font-bold font-serif tracking-tight m-0">
              Today's News Feed
            </h1>
            <button
              onClick={fetchFeed}
              type="button"
              className="bg-white border border-[#D0E2F7] hover:bg-[#EBF3FC] active:scale-95 text-[#0B56A6] rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#0B56A6] ${loading ? 'animate-spin' : ''}`} strokeWidth={2.2} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 w-full bg-black flex justify-center overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#145AB1] border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-xs text-[#6B7A90] font-bold">Loading today's news...</p>
          </div>
        ) : clippings.length === 0 ? (
          <div className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-2xl p-8 text-center my-6 flex flex-col items-center justify-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[#0d4a8f]/10 flex items-center justify-center mb-4">
              <Newspaper className="w-8 h-8 text-[#0d4a8f]" />
            </div>
            <h3 className="text-lg font-bold text-[#0A2540] mb-2">No news found today</h3>
            <p className="text-xs text-[#6B7A90] max-w-xs leading-relaxed">
              Reporters in {district || 'your selected region'} haven't posted any news today. Check back later!
            </p>
          </div>
        ) : (
          <div className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar relative bg-black">
            {clippings.map((clip: any, idx: number) => {
              const isLiked = likedIds.has(clip.id);
              const isAdInterval = (idx + 1) % 10 === 0 || idx === 4;
              const isShortFeedEnd = clippings.length < 5 && idx === clippings.length - 1;
              const shouldShowLocalAd = (isAdInterval || isShortFeedEnd) && localAds.length > 0;
              const localAdIndex = Math.floor(idx / 5) % (localAds.length || 1);
              const localAd = localAds[localAdIndex];

              return (
                <React.Fragment key={clip.id}>
                  {/* District Weather & Health Advisory Card inserted into feed flow */}
                  {advisory && (idx === 1 || (idx > 1 && (idx - 1) % 6 === 0)) && (
                    <div className="w-full h-full snap-start snap-always flex flex-col bg-black border-b border-gray-800 relative p-3 box-border">
                      <div className="flex-1 w-full bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                        <AdvisoryCard row={advisory} liveWeather={liveWeather} />
                      </div>
                    </div>
                  )}
                  <div
                    data-clip-id={clip.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(clip.id, el);
                    else cardRefs.current.delete(clip.id);
                  }}
                  className="w-full h-full snap-start snap-always flex flex-col bg-black border-b border-gray-800 relative cursor-pointer"
                >
                  {/* Full Screen Generated Image */}
                  <div
                    className="flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden pb-[56px]"
                    onClick={() => setActiveDetailIndex(idx)}
                  >
                    {clip.png_url && (
                      <div
                        className="absolute inset-0 opacity-30 scale-110 blur-xl bg-cover bg-center"
                        style={{ backgroundImage: `url(${clip.png_url})` }}
                      />
                    )}
                    {clip.mp4_url || clip.video_url || clip.custom_layout?.mp4_url ? (
                      <video
                        src={clip.mp4_url || clip.video_url || clip.custom_layout?.mp4_url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-fill relative z-10"
                      />
                    ) : clip.png_url ? (
                      <img
                        src={clip.png_url}
                        alt="News clipping"
                        className="w-full h-full object-fill relative z-10"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-[#6B7A90] relative z-10">
                        <Newspaper className="w-16 h-16 mb-2 opacity-50" />
                        <span className="text-sm font-bold opacity-50">No Image Available</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 h-[56px] flex items-center justify-between px-3">

                    {/* Left: Like toggle + Dislike */}
                    <div className="flex items-center gap-3">
                      {/* Like button — toggles */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleLike(clip.id, clip.likes_count || 0); }}
                        className={`flex items-center gap-1.5 transition-colors ${isLiked ? 'text-blue-600' : 'text-gray-500'}`}
                      >
                        <svg className="w-[22px] h-[22px]" fill={isLiked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.514" />
                        </svg>
                        <span className="text-[13px] font-semibold">{clip.likes_count || 0}</span>
                      </button>
                    </div>

                    {/* Center: Universal Share Button */}
                    <div className="absolute left-1/2 -translate-x-1/2 -top-[24px] flex flex-col items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareClick(clip);
                        }}
                        className="w-[48px] h-[48px] bg-gradient-to-tr from-[#015BB3] to-[#0284c7] text-white rounded-full flex items-center justify-center shadow-[0_4px_14px_rgba(1,91,179,0.4)] active:scale-95 transition-transform border-[3px] border-white"
                        title="Share clipping"
                      >
                        <Share2 className="w-5 h-5 text-white stroke-[2.5]" />
                      </button>
                      <span className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-wider">Share</span>
                    </div>

                    {/* Right: Comments & Share */}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); openComments(clip.id); }}
                        className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        <svg className="w-[20px] h-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-[13px] font-semibold">{clip.comments_count || 0}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareClick(clip);
                        }}
                        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
                        title="Share Options"
                      >
                        <Share2 className="w-[18px] h-[18px] text-[#015BB3]" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 🎯 Local Ad: Displayed after every 10 clippings */}
                {shouldShowLocalAd && localAd && (
                  <LocalAdFeedCard key={`local-ad-feed-${localAd.id}-${idx}`} ad={localAd} index={idx} />
                )}
              </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Full Screen News Detail Pager (Covers top & bottom marked areas) ── */}
      {activeDetailIndex !== null && (
        <NewsDetailCardStack
          items={clippings}
          initialIndex={activeDetailIndex}
          onBack={() => {
            setActiveDetailIndex(null);
            setIsFullScreenFeed(false);
          }}
          onLike={handleLike}
          likedIds={likedIds}
          onComment={openComments}
          onShare={handleShareClick}
          onEndReached={fetchFeed}
          localAds={localAds}
        />
      )}

      {/* ── RTI Share Sheet (Clipping, Reporter Card 1:1, Status 9:16) ─── */}
      {shareSheetOpen && (
        <ShareAfterClipping
          post={{
            id: shareSheetOpen.id,
            headline: shareSheetOpen.headline || shareSheetOpen.title || 'News Update',
            place: shareSheetOpen.district || district || 'హైదరాబాద్',
            date: new Date(shareSheetOpen.created_at || Date.now()).toLocaleDateString('te-IN', {
              day: 'numeric',
              month: 'short',
            }),
            clippingUrl: shareSheetOpen.png_url,
            thumbUrl:
              shareSheetOpen.image_url ||
              shareSheetOpen.imageUrl ||
              shareSheetOpen.custom_layout?.image_url ||
              shareSheetOpen.custom_layout?.imageUrls?.[0] ||
              shareSheetOpen.custom_layout?.image_urls?.[0] ||
              shareSheetOpen.image_urls?.[0] ||
              shareSheetOpen.png_url,
            videoUrl: shareSheetOpen.mp4_url || shareSheetOpen.video_url || shareSheetOpen.custom_layout?.mp4_url || undefined,
          }}
          reporter={{
            id: shareSheetOpen.user_id || user?.id || 'reporter',
            name:
              shareSheetOpen.reporter_name ||
              shareSheetOpen.custom_layout?.reporter_name ||
              shareSheetOpen.custom_layout?.reporterName ||
              shareSheetOpen.author_name ||
              user?.full_name ||
              'Spot News Reporter',
            slug: (
              shareSheetOpen.reporter_name ||
              shareSheetOpen.custom_layout?.reporter_name ||
              shareSheetOpen.custom_layout?.reporterName ||
              shareSheetOpen.author_name ||
              'reporter'
            )
              .toLowerCase()
              .replace(/\s+/g, '-'),
            verified: true,
            avgStars: 4.8,
            ratingsCount: 24,
            stories: 15,
            views: shareSheetOpen.views_count || 120,
            experienceYears: 3,
            photoUrl: user?.avatarUrl,
          }}
          onClose={() => setShareSheetOpen(null)}
        />
      )}

      {/* ── Comments Bottom Sheet (Drawer) ─────────────────────────────────── */}
      {commentOpen && (
        <div
          className="fixed inset-0 z-[100005] flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setCommentOpen(null)}
        >
          <div
            className="bg-white rounded-t-2xl flex flex-col"
            style={{ height: '65vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle + Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
              <span className="text-sm font-bold text-[#0A2540]">
                Comments ({comments.length})
              </span>
              <button onClick={() => setCommentOpen(null)} className="p-1 rounded-full hover:bg-gray-100 cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Comment List — grows and scrolls */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {comments.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">Be the first to comment!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#015BB3] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {(c.user_name || 'A')[0].toUpperCase()}
                    </div>
                    <div className="bg-gray-50 rounded-2xl rounded-tl-none px-3 py-2 flex-1">
                      <p className="text-[10px] font-bold text-[#015BB3] mb-0.5">{c.user_name}</p>
                      <p className="text-[12px] text-gray-800 leading-snug">{c.text}</p>
                      <p className="text-[9px] text-gray-400 mt-1">
                        {new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Row — fixed at bottom */}
            <div
              className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            >
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                placeholder="Write a comment..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-[#015BB3]"
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submitting}
                className="w-9 h-9 rounded-full bg-[#015BB3] flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform cursor-pointer"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Weather Advisory Modal Sheet ──────────────────────────────── */}
      {showWeatherModal && advisory && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100005] flex items-end justify-center p-0 sm:p-4"
          onClick={() => setShowWeatherModal(false)}
        >
          <div
            className="w-full max-w-lg h-[88dvh] bg-white rounded-t-3xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <AdvisoryCard row={advisory} onClose={() => setShowWeatherModal(false)} liveWeather={liveWeather} />
          </div>
        </div>
      )}
    </div>
  );
};

