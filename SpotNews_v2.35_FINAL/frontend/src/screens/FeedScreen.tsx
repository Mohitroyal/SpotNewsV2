import React, { useState, useEffect, useRef } from 'react';
import { Newspaper, X, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import locationMapPinIcon from '@/assets/location_map_pin.png';
import { useAuthStore, useUIStore } from '@/store';
import { publicClient, supabase } from '@/lib/supabase';
import { NewsDetailCardStack } from '@/components/NewsDetailCardStack';
import { localAdsService } from '@/services/localAds.service';
import { LocalAdFeedCard } from '@/components/LocalAdFeedCard';
import { BrandDealCard } from '@/components/BrandDealCard';
import { brandAdsService, type BrandAd } from '@/services/brandAds.service';
import type { LocalAd } from '@/types/localAds';
import { AdvisoryCard } from '@/features/weather/AdvisoryCard';
import { useAdvisory } from '@/features/weather/useAdvisory';
import { useWeather, getWeatherInfo } from '@/services/weatherService';
import { directShareClipping } from '@/features/share';
import { useDailyPosts } from '@/features/daily/useDailyPosts';
import { DailyPostCard } from '@/features/daily/DailyPostCard';
import { useCategoryPosts } from '@/features/daily/useDailyPosts';
import { CATEGORY_LABELS, type PostKind } from '@/features/daily/dailyContentEngine';
import { ReaderStoryCard, type SponsoredTeaser } from '@/features/feed/ReaderStoryCard';
import { DistrictPickerSheet } from '@/components/DistrictPickerSheet';

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
  const setIsFullScreenFeed = useUIStore((state) => state.setIsFullScreenFeed);
  const [clippings, setClippings] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('spotnews_feed_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [localAds, setLocalAds] = useState<LocalAd[]>([]);
  const [brandAds, setBrandAds] = useState<BrandAd[]>([]);
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('spotnews_feed_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch {}
    return true;
  });
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null);

  // Sync full-screen mode: true only when activeDetailIndex is set
  useEffect(() => {
    setIsFullScreenFeed(activeDetailIndex !== null);
  }, [activeDetailIndex, setIsFullScreenFeed]);

  // Always reset full-screen feed on mount and unmount
  useEffect(() => {
    setIsFullScreenFeed(false);
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

  // Automatic daily posts for this district (good morning, weather, farming, diet, health, good night)
  const dailyPosts = useDailyPosts(district, userState, liveWeather);
  // One automatic card (hourly thought, food, weather, career…) after every 2 or 3 news stories, alternately
  const dailySlotBefore = (idx: number) => {
    // stories 0,1 | card | 2,3,4 | card | 5,6 | card | 7,8,9 | card …
    if (idx <= 0) return -1;
    const cycle = Math.floor(idx / 5), r = idx % 5;
    if (r === 2) return cycle * 2;
    if (r === 0) return cycle * 2 - 1;
    return -1;
  };
  const SPONSOR_EVERY = 3; // a small "Sponsored" option on every 3rd story

  // Reader categories (chips): null = all news
  const [category, setCategory] = useState<PostKind | null>(() => {
    // Home page tiles open the feed on one category: /feed?cat=weather
    const c = searchParams.get('cat');
    return c && CATEGORY_LABELS.some((x) => x.kind === c) ? (c as PostKind) : null;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const catParam = searchParams.get('cat');
  useEffect(() => {
    if (catParam && CATEGORY_LABELS.some((x) => x.kind === catParam)) setCategory(catParam as PostKind);
    else if (!catParam) setCategory(null);
  }, [catParam]);
  const categoryPosts = useCategoryPosts(category, district, userState, liveWeather);

  // Sponsored ads open in a sheet (never as a full-screen interruption)
  const [openAd, setOpenAd] = useState<{ type: 'local'; ad: LocalAd } | { type: 'brand'; ad: BrandAd } | null>(null);
  const [startInClipping, setStartInClipping] = useState(false);

  // Name for comments (readers do not log in)
  const [commentName, setCommentName] = useState<string>(() => {
    try { return localStorage.getItem('spotnews_comment_name') || ''; } catch { return ''; }
  });
  const [commentError, setCommentError] = useState('');

  // Comments drawer state
  const [commentOpen, setCommentOpen] = useState<string | null>(null); // clipping id
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const handleShareClick = async (clip: any) => {
    if (!clip?.id) return;
    try {
      await directShareClipping({
        id: clip.id,
        headline: clip.headline || clip.title || 'Spot News Update',
        clippingUrl:
          clip.png_url ||
          clip.pngUrl ||
          clip.custom_layout?.png_url ||
          clip.custom_layout?.pngUrl ||
          clip.clipping_url ||
          clip.image_url ||
          clip.preview_url ||
          '',
        videoUrl: clip.mp4_url || clip.video_url || clip.custom_layout?.mp4_url || undefined,
        reporterSlug: (
          clip.reporter_name ||
          clip.custom_layout?.reporter_name ||
          clip.custom_layout?.reporterName ||
          clip.author_name ||
          'reporter'
        )
          .toLowerCase()
          .replace(/\s+/g, '-'),
        reporterId: clip.user_id,
        status: clip.status,
        is_posted: clip.is_posted,
      });
    } catch (err: any) {
      console.error('Direct share error:', err);
    }
  };

  const fetchFeed = async () => {
    // Only set loading if we don't have any cached clippings displayed
    if (clippings.length === 0) {
      setLoading(true);
    }

    // Safety timeout: ensure loading spinner is NEVER stuck past 6 seconds
    const timeoutTimer = setTimeout(() => {
      setLoading(false);
    }, 6000);

    try {
      const FEED_COLUMNS = 'id, headline, article_content, png_url, mp4_url, image_url, image_urls, likes_count, views_count, comments_count, created_at, district, state, user_id, status, is_posted, custom_layout';

      const client = publicClient || supabase;
      let query = client
        .from('clippings')
        .select(FEED_COLUMNS)
        .eq('is_posted', true)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(40);

      const cleanState = userState ? userState.split('/')[0]?.split('·')[0]?.trim() : '';
      const cleanDistrict = district ? district.split('/')[0]?.split('·')[0]?.trim() : '';

      if (cleanState && cleanState !== 'All' && cleanState !== 'Both states') {
        query = query.or(`state.eq."${cleanState}",state.eq.All,state.eq."Both states",state.is.null`);
      }
      if (cleanDistrict && cleanDistrict !== 'All districts' && cleanDistrict !== 'All' && cleanDistrict !== 'All Regions') {
        query = query.or(`district.eq."${cleanDistrict}",district.eq.All,district.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const isApprovedFeedClip = (c: any) =>
        (c.is_posted === true || ['approved', 'auto_approved', 'published', 'completed'].includes(c.status)) &&
        c.status !== 'rejected';

      let postedClippings = (data || []).filter(isApprovedFeedClip);

      // If user's specific district has no news yet, fallback to latest news across all regions
      if (postedClippings.length === 0) {
        const { data: allData } = await client
          .from('clippings')
          .select(FEED_COLUMNS)
          .eq('is_posted', true)
          .neq('status', 'rejected')
          .order('created_at', { ascending: false })
          .limit(40);

        postedClippings = (allData || []).filter(isApprovedFeedClip);
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
            const { data: directClip } = await client
              .from('clippings')
              .select(FEED_COLUMNS)
              .eq('id', targetClip)
              .eq('is_posted', true)
              .neq('status', 'rejected')
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

      if (postedClippings.length > 0) {
        setClippings(postedClippings);
        try {
          localStorage.setItem('spotnews_feed_cache', JSON.stringify(postedClippings));
        } catch {}
      } else {
        setClippings([]);
        try {
          localStorage.removeItem('spotnews_feed_cache');
        } catch {}
      }
    } catch (err) {
      console.error('Failed to fetch feed', err);
    } finally {
      clearTimeout(timeoutTimer);
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
    const text = commentText.trim().slice(0, 500);
    const accountName = user?.full_name || user?.firstName || (user as any)?.user_metadata?.full_name || '';
    const isGuest = !accountName || accountName === 'Guest Reader';
    const userName = (isGuest ? commentName.trim() : accountName).slice(0, 60);
    if (!userName) {
      setCommentError('మీ పేరు ఇవ్వండి / Please enter your name');
      setSubmitting(false);
      return;
    }
    if (isGuest) {
      try { localStorage.setItem('spotnews_comment_name', userName); } catch { /* ignore */ }
    }
    setCommentError('');
    // Guest readers have ids like "guest_123" which are not valid database ids
    const validUserId = user?.id && /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null;

    try {
      const { data, error } = await supabase
        .from('lipping_comments')
        .insert({
          clipping_id: commentOpen,
          user_id: validUserId,
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
    } catch (err: any) {
      console.error('Comment failed', err);
      setCommentError('కామెంట్ పంపలేకపోయాం, మళ్ళీ ప్రయత్నించండి / Could not post the comment');
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
      const [ads, brands] = await Promise.all([
        localAdsService.fetchActiveLocalAds(district),
        brandAdsService.fetchActive(userState, district),
      ]);
      setLocalAds(ads);
      setBrandAds(brands);
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
          .neq('status', 'rejected')
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
    <div className="flex flex-col flex-1 min-h-0 bg-black">
      {activeDetailIndex === null && (
        <div className="flex-shrink-0 bg-[#F4F8FC] border-b border-[#D8E4F2] px-3 pt-2 pb-2 space-y-2">
          {/* ── One compact row: place (tap to change) + weather (tap for advice) ── */}
          <div className="bg-white border border-[#D9E5F2] rounded-2xl px-3 py-2 shadow-sm flex items-center gap-2">
            <button type="button" onClick={() => setPickerOpen(true)}
              className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-0 p-0 cursor-pointer text-left">
              <img src={locationMapPinIcon} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
              <span className="min-w-0">
                <span className="block text-[17px] font-extrabold text-[#0F172A] truncate leading-tight">
                  {district && district !== 'All' && district !== 'All districts' ? district : userState && userState !== 'All' ? userState : 'AP & తెలంగాణ'}
                </span>
                <span className="block text-[13px] text-[#64748B] font-semibold leading-tight">ప్రాంతం మార్చండి · Change</span>
              </span>
              <ChevronDown className="w-5 h-5 text-[#64748B] shrink-0" />
            </button>
            <button type="button" onClick={() => setShowWeatherModal(true)}
              className="flex items-center gap-1.5 shrink-0 rounded-xl bg-[#EAF2FB] px-3 py-1.5 border-0 cursor-pointer"
              title="Weather & health advice">
              {weatherInfo.iconUrl ? (
                <img src={weatherInfo.iconUrl} alt={weatherInfo.label} className="w-6 h-6 object-contain" draggable={false} />
              ) : (
                <WeatherIcon className={`w-6 h-6 ${weatherInfo.colorClass}`} strokeWidth={2.2} />
              )}
              <span className="text-[18px] font-extrabold text-[#0F172A]">{liveWeather !== null ? `${Math.round(liveWeather.temperature)}°` : '--°'}</span>
              <ChevronRight className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>

          {/* ── Categories: read only weather / farming / health / fitness / diet / environment ── */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-0.5 px-0.5 pb-0.5">
            <button type="button" onClick={() => setCategory(null)}
              className={`shrink-0 rounded-full px-4 py-2 text-[15px] font-extrabold border cursor-pointer ${category === null ? 'bg-[#015BB3] text-white border-[#015BB3]' : 'bg-white text-[#0F487F] border-[#D0E2F7]'}`}>
              📰 వార్తలు
            </button>
            {CATEGORY_LABELS.map((c) => (
              <button key={c.kind} type="button" onClick={() => setCategory(c.kind)}
                className={`shrink-0 rounded-full px-4 py-2 text-[15px] font-extrabold border cursor-pointer ${category === c.kind ? 'bg-[#015BB3] text-white border-[#015BB3]' : 'bg-white text-[#0F487F] border-[#D0E2F7]'}`}>
                {c.emoji} {c.te}
              </button>
            ))}
            <button type="button" onClick={() => navigate('/post-ad')}
              className="shrink-0 rounded-full px-4 py-2 text-[15px] font-extrabold border cursor-pointer bg-[#FFF4D6] text-[#9A5B00] border-[#F4D58D]">
              📣 ప్రకటన ఇవ్వండి
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 w-full bg-black flex justify-center overflow-hidden">
        {category !== null ? (
          <div className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar relative bg-black">
            {categoryPosts.length === 0 ? (
              <div className="p-12 text-center text-white/70 text-[16px] font-bold">లోడ్ అవుతోంది…</div>
            ) : categoryPosts.map((p) => (
              <DailyPostCard key={`cat-${p.kind}-${p.publish_at}`} post={p} />
            ))}
          </div>
        ) : loading && clippings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#145AB1] border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-[15px] text-white/80 font-bold">వార్తలు లోడ్ అవుతున్నాయి…</p>
          </div>
        ) : clippings.length === 0 && dailyPosts.length === 0 ? (
          <div className="bg-[#E8F2FC] border border-[#D0E2F7] rounded-2xl p-8 text-center my-6 mx-4 flex flex-col items-center justify-center shadow-sm">
            <Newspaper className="w-10 h-10 text-[#0d4a8f] mb-3" />
            <h3 className="text-[19px] font-bold text-[#0A2540] mb-2">ఈ జిల్లాలో ఇంకా వార్తలు లేవు</h3>
            <button
              onClick={() => {
                useAuthStore.getState().setDistrict('All');
                useAuthStore.getState().setUserState('All');
                fetchFeed();
              }}
              className="px-5 py-3 bg-[#015BB3] text-white text-[16px] font-bold rounded-xl shadow-md cursor-pointer border-0"
            >
              అన్ని జిల్లాల వార్తలు చూడండి
            </button>
          </div>
        ) : (
          <div className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar relative bg-black">
            {clippings.map((clip: any, idx: number) => {
              const isLiked = likedIds.has(clip.id);
              const slot = dailySlotBefore(idx);
              const dailyPost = slot >= 0 ? dailyPosts[slot] : undefined;
              // Sponsored option (icon row inside the card) on every SPONSOR_EVERY-th story
              let sponsored: SponsoredTeaser | null = null;
              if ((idx + 1) % SPONSOR_EVERY === 0 && (localAds.length || brandAds.length)) {
                const n = Math.floor(idx / SPONSOR_EVERY);
                const pool: ({ type: 'local'; ad: LocalAd } | { type: 'brand'; ad: BrandAd })[] = [
                  ...localAds.map((ad) => ({ type: 'local' as const, ad })),
                  ...brandAds.map((ad) => ({ type: 'brand' as const, ad })),
                ];
                const pickAd = pool[n % pool.length];
                sponsored = {
                  id: pickAd.ad.id,
                  label: pickAd.type === 'brand' ? pickAd.ad.brand : 'Local',
                  title: pickAd.type === 'brand' ? pickAd.ad.title_te : pickAd.ad.title,
                  onOpen: () => setOpenAd(pickAd),
                };
              }

              return (
                <React.Fragment key={clip.id}>
                  {dailyPost && <DailyPostCard key={`daily-${dailyPost.kind}-${dailyPost.publish_at}`} post={dailyPost} />}
                  <div
                    data-clip-id={clip.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(clip.id, el);
                      else cardRefs.current.delete(clip.id);
                    }}
                    className="w-full h-full snap-start snap-always relative"
                  >
                    <ReaderStoryCard
                      clip={clip}
                      liked={isLiked}
                      onLike={() => handleLike(clip.id, clip.likes_count || 0)}
                      onComment={() => openComments(clip.id)}
                      onShare={() => handleShareClick(clip)}
                      onOpenClipping={() => { setStartInClipping(true); setActiveDetailIndex(idx); }}
                      sponsored={sponsored}
                    />
                  </div>
                </React.Fragment>
              );
            })}
            {/* Automatic posts that did not fit between the stories (short feed) */}
            {dailyPosts.slice(clippings.reduce((n: number, _c: any, i: number) => (dailySlotBefore(i) >= 0 ? n + 1 : n), 0)).map((p) => (
              <DailyPostCard key={`daily-tail-${p.kind}-${p.publish_at}`} post={p} />
            ))}
          </div>
        )}
      </div>

      {/* ── Sponsored ad sheet (opened from the small "Sponsored" option) ── */}
      {openAd && (
        <div className="fixed inset-0 z-[100006] bg-black/70 flex flex-col" onClick={() => setOpenAd(null)}>
          <div className="flex justify-end p-3">
            <button type="button" className="w-11 h-11 rounded-full bg-white/20 text-white flex items-center justify-center border-0 cursor-pointer" onClick={() => setOpenAd(null)}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
            {openAd.type === 'brand' ? <BrandDealCard ad={openAd.ad} /> : <LocalAdFeedCard ad={openAd.ad} index={0} />}
          </div>
        </div>
      )}

      {/* ── Full Screen News Detail Pager (Covers top & bottom marked areas) ── */}
      {activeDetailIndex !== null && (
        <NewsDetailCardStack
          items={clippings}
          initialIndex={activeDetailIndex}
          initialMode={startInClipping ? 'clipping' : 'text'}
          onBack={() => {
            setActiveDetailIndex(null);
            setStartInClipping(false);
            setIsFullScreenFeed(false);
          }}
          onLike={handleLike}
          likedIds={likedIds}
          onComment={openComments}
          onShare={handleShareClick}
          onEndReached={fetchFeed}
          localAds={[]}
          brandAds={[]}
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
                    <div className="w-7 h-7 rounded-full bg-[#015BB3] flex items-center justify-center text-white text-[11.5px] font-bold shrink-0">
                      {(c.user_name || 'A')[0].toUpperCase()}
                    </div>
                    <div className="bg-gray-50 rounded-2xl rounded-tl-none px-3 py-2 flex-1">
                      <p className="text-[11.5px] font-bold text-[#015BB3] mb-0.5">{c.user_name}</p>
                      <p className="text-[13.5px] text-gray-800 leading-snug">{c.text}</p>
                      <p className="text-[10.5px] text-gray-400 mt-1">
                        {new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Row — fixed at bottom */}
            <div
              className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-white space-y-2"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            >
              {commentError && <p className="text-[14px] font-semibold text-[#B91C1C] m-0">{commentError}</p>}
              {(!user?.full_name || user?.full_name === 'Guest Reader') && (
                <input
                  type="text"
                  value={commentName}
                  onChange={(e) => setCommentName(e.target.value.slice(0, 60))}
                  placeholder="మీ పేరు · Your name"
                  className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-[16px] outline-none focus:border-[#015BB3]"
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                  placeholder="మీ అభిప్రాయం రాయండి · Write a comment"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-[16px] outline-none focus:border-[#015BB3]"
                />
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim() || submitting}
                  className="w-11 h-11 rounded-full bg-[#015BB3] flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform cursor-pointer border-0"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
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
      <DistrictPickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
};

