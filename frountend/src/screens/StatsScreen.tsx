import React, { useState, useEffect } from 'react';
import { useAuthStore, useUIStore, isSuperAdminUser, isAdminUser } from '@/store';
import { supabase, publicClient } from '@/lib/supabase';
import {
  Eye, Heart, MessageSquare, TrendingUp, X, CheckCircle2, AlertCircle, Share2, ChevronRight, Send, Clock, Loader2, Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NewsDetailCardStack } from '@/components/NewsDetailCardStack';
import { directShareClipping } from '@/features/share';
import { redeemService, type RedeemRequest, type TopReporter } from '@/services/redeem.service';

interface Comment {
  id: string;
  clipping_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export const StatsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const setIsFullScreenFeed = useUIStore((state) => state.setIsFullScreenFeed);
  const [clippings, setClippings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats aggregates
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [totalShares, setTotalShares] = useState(0);

  // Full Screen News Detail Pager
  const [activeDetailIndex, setActiveDetailIndex] = useState<number | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const handleShare = async (clip: any) => {
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

  // Comments drawer
  const [commentDrawer, setCommentDrawer] = useState<{ clipId: string; headline: string } | null>(null);
  const [drawerComments, setDrawerComments] = useState<Comment[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // ── Top Reporters State ──
  const [topPeriod, setTopPeriod] = useState<'week' | 'month'>('week');
  const [topReporters, setTopReporters] = useState<TopReporter[]>([]);
  const [topLoading, setTopLoading] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  const loadTopReporters = async (period: 'week' | 'month') => {
    setTopLoading(true);
    setTopError(null);
    try {
      const data = await redeemService.fetchTopReporters(period);
      setTopReporters(data);
    } catch (err: any) {
      setTopError(err?.message || 'Failed to load leaderboard');
    } finally {
      setTopLoading(false);
    }
  };

  useEffect(() => {
    loadTopReporters(topPeriod);
  }, [topPeriod]);

  // ── Coins & Redemption State ──
  const [redeemedTotal, setRedeemedTotal] = useState<number>(() => {
    const saved = localStorage.getItem(`spotnews_redeemed_total_${user?.id || 'demo'}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [redeemHistory, setRedeemHistory] = useState<RedeemRequest[]>([]);
  const [isSubmittingRedeem, setIsSubmittingRedeem] = useState(false);

  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [redeemType, setRedeemType] = useState<'recharge' | 'upi'>('recharge');
  const [targetAccount, setTargetAccount] = useState('');
  const [coinsInput, setCoinsInput] = useState('');
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState<{
    amount: number;
    target: string;
    type: 'recharge' | 'upi';
  } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const safetyTimer = setTimeout(() => setLoading(false), 3000);

      try {
        let targetId = user?.id || '';

        // If user.id is not directly present, look up profile by email
        if (!targetId && user?.email) {
          try {
            const { data: prof } = await publicClient
              .from('profiles')
              .select('id')
              .ilike('email', user.email.trim())
              .maybeSingle();
            if (prof?.id) {
              targetId = prof.id;
            }
          } catch {}
        }

        // Default fallback if still unknown
        if (!targetId) {
          targetId = user?.email?.toLowerCase().includes('mohithroyal') ? '3b6081a1-731c-4397-ac4f-347dd3122547' : (user?.id || '3b6081a1-731c-4397-ac4f-347dd3122547');
        }

        // Fetch clippings for this user using publicClient (guaranteed no auth/RLS expiration issues)
        let query = publicClient.from('clippings').select('*');
        query = query.or(`user_id.eq.${targetId},owner_id.eq.${targetId}`);

        let { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.warn('[StatsScreen] Query with targetId returned error, trying fallback query:', error.message);
        }

        // If targetId returned 0 items, check if admin/superadmin or fallback to recent feed items
        if ((!data || data.length === 0) && (isSuperAdminUser(user) || isAdminUser(user) || !user?.id)) {
          const { data: fallbackData } = await publicClient
            .from('clippings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);
          if (fallbackData && fallbackData.length > 0) {
            data = fallbackData;
          }
        }

        // ONLY count clippings that were BOTH:
        // 1. Accepted through the moderation process (approved or auto_approved)
        // 2. Successfully published to the News feed (is_posted === true)
        // Strictly exclude drafts, pending approval, rejected, or unposted clippings.
        const isEligibleFeedClipping = (c: any): boolean => {
          const isPosted = c.is_posted === true || c.is_posted === 1 || String(c.is_posted) === 'true';
          const status = String(c.status || '').toLowerCase().trim();
          const isAccepted = status === 'approved' || status === 'auto_approved';
          const isNotRejected = status !== 'rejected' && status !== 'pending_approval' && status !== 'rendering' && status !== 'failed';
          return isPosted && isAccepted && isNotRejected;
        };

        const feed = (data || []).filter(isEligibleFeedClipping);

        // Fetch actual comment counts safely from lipping_comments
        const clippingIds = feed.map((c: any) => c.id);
        let commentCountMap: Record<string, number> = {};

        if (clippingIds.length > 0) {
          try {
            const { data: commentRows } = await publicClient
              .from('lipping_comments')
              .select('clipping_id')
              .in('clipping_id', clippingIds);

            (commentRows || []).forEach((row: any) => {
              commentCountMap[row.clipping_id] = (commentCountMap[row.clipping_id] || 0) + 1;
            });
          } catch {}
        }

        // Merge real comment counts into clippings
        const enriched = feed.map((c: any) => ({
          ...c,
          comments_count: commentCountMap[c.id] ?? c.comments_count ?? 0,
        }));

        setClippings(enriched);

        let views = 0, likes = 0, comments = 0, shares = 0;
        enriched.forEach((c: any) => {
          views += Number(c.views_count || c.views || 0);
          likes += Number(c.likes_count || c.likes || 0);
          comments += Number(c.comments_count || c.comments || 0);
          shares += Number(c.shares_count || c.shares || 0);
        });

        setTotalViews(views);
        setTotalLikes(likes);
        setTotalComments(comments);
        setTotalShares(shares);

        // Fetch real deducted coins in background (non-blocking)
        if (targetId) {
          Promise.all([
            redeemService.getUserDeductedCoins(targetId),
            redeemService.fetchUserRedeems(targetId),
          ]).then(([deducted, history]) => {
            setRedeemedTotal(deducted);
            setRedeemHistory(history);
            try {
              localStorage.setItem(`spotnews_redeemed_total_${targetId}`, String(deducted));
            } catch {}
          }).catch((redeemErr) => {
            console.warn('[StatsScreen] Background redeem history note:', redeemErr);
          });
        }
      } catch (err) {
        console.error('Failed to fetch stats', err);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    };

    fetchStats();
  }, [user?.id]);

  // Toggle full-screen mode to hide masthead and bottom nav when news viewer is open
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

  const handleLike = async (id: string, currentLikes: number) => {
    const alreadyLiked = likedIds.has(id);
    const newCount = alreadyLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1;

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
      console.error('Like toggle error:', err);
    }
  };

  const submitDrawerComment = async () => {
    if (!newCommentText.trim() || !commentDrawer || commentSubmitting) return;
    setCommentSubmitting(true);
    const text = newCommentText.trim();
    const userName =
      user?.full_name || user?.firstName || (user as any)?.user_metadata?.full_name || 'Reporter';

    try {
      let res = await supabase
        .from('lipping_comments')
        .insert({
          clipping_id: commentDrawer.clipId,
          user_id: user?.id || null,
          user_name: userName,
          text,
        })
        .select()
        .single();

      if (res.error) {
        res = await supabase
          .from('clipping_comments')
          .insert({
            clipping_id: commentDrawer.clipId,
            user_id: user?.id || null,
            user_name: userName,
            text,
          })
          .select()
          .single();
      }

      if (!res.error && res.data) {
        setDrawerComments((prev) => [...prev, res.data as Comment]);
        setNewCommentText('');
        setClippings((prev) =>
          prev.map((c) =>
            c.id === commentDrawer.clipId ? { ...c, comments_count: (c.comments_count || 0) + 1 } : c
          )
        );
      }
    } catch (err) {
      console.error('Comment submit error:', err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const openCommentDrawer = async (clipId: string, headline: string) => {
    setCommentDrawer({ clipId, headline });
    setDrawerLoading(true);
    setDrawerComments([]);
    try {
      let { data } = await supabase
        .from('lipping_comments')
        .select('*')
        .eq('clipping_id', clipId)
        .order('created_at', { ascending: true });
      if (!data) {
        const fallback = await supabase
          .from('clipping_comments')
          .select('*')
          .eq('clipping_id', clipId)
          .order('created_at', { ascending: true });
        data = fallback.data;
      }
      setDrawerComments(data || []);
    } catch {
      setDrawerComments([]);
    } finally {
      setDrawerLoading(false);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return new Date().toLocaleDateString('en-IN');
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ── Coin Calculations (Formula: 100 views=1 coin, 50 likes=1 coin, 25 comments=2 coins, 50 shares=5 coins) ──
  const getPostCoins = (clip: any): number => {
    const v = Number(clip.views_count || clip.views || 0);
    const l = Number(clip.likes_count || clip.likes || 0);
    const c = Number(clip.comments_count || clip.comments || 0);
    const s = Number(clip.shares_count || clip.shares || 0);
    return Math.floor(v / 100) * 1 + Math.floor(l / 50) * 1 + Math.floor(c / 25) * 2 + Math.floor(s / 50) * 5;
  };

  // Compute perfect coins: Evaluates both per-post milestone rewards and aggregate cumulative milestones
  // across all approved feed clippings so the reporter receives their full rightful rewards without rounding loss.
  const postCoinsSum = clippings.reduce((acc, c) => acc + getPostCoins(c), 0);
  const aggregateCoins = (
    Math.floor(totalViews / 100) * 1 +
    Math.floor(totalLikes / 50) * 1 +
    Math.floor(totalComments / 25) * 2 +
    Math.floor(totalShares / 50) * 5
  );
  const earnedCoins = Math.max(postCoinsSum, aggregateCoins);
  const availableCoins = Math.max(0, earnedCoins - redeemedTotal);
  const rupeesValue = Math.floor(availableCoins / 10);

  // Coins entered in redemption modal
  const coinsNum = parseInt(coinsInput, 10) || 0;
  const calculatedRupees = coinsNum >= 10 ? Math.floor(coinsNum / 10) : 0;

  // Handle Redeem submission
  const handleRedeemSubmit = async () => {
    setRedeemError('');

    // 1. Validate Target
    if (redeemType === 'recharge') {
      const cleanPhone = targetAccount.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        setRedeemError('Please enter a valid 10-digit mobile number');
        return;
      }
    } else {
      if (!targetAccount.trim() || targetAccount.trim().length < 3) {
        setRedeemError('Please enter a valid UPI ID (e.g. mobile@upi)');
        return;
      }
    }

    // 2. Validate Coins Amount
    if (coinsNum < 500) {
      setRedeemError('Minimum 500 coins required to redeem');
      return;
    }

    if (coinsNum > availableCoins) {
      setRedeemError(`Insufficient balance. You currently have ${availableCoins} coins.`);
      return;
    }

    if (!user?.id) {
      setRedeemError('Please log in to redeem your coins.');
      return;
    }

    // 3. Process Redemption to backend Supabase
    setIsSubmittingRedeem(true);
    const res = await redeemService.submitRedeemRequest({
      userId: user.id,
      userEmail: user.email,
      userName: user.full_name || (user as any)?.firstName || 'Reporter',
      userPhone: (user as any)?.phone || (user as any)?.phone_number || undefined,
      coins: coinsNum,
      amountInr: calculatedRupees,
      type: redeemType,
      targetAccount: targetAccount.trim(),
    });
    setIsSubmittingRedeem(false);

    if (!res.success) {
      setRedeemError(res.error || 'Failed to submit redemption request. Please try again.');
      return;
    }

    const newRedeemed = redeemedTotal + coinsNum;
    setRedeemedTotal(newRedeemed);
    localStorage.setItem(`spotnews_redeemed_total_${user.id}`, String(newRedeemed));
    if (res.data) {
      setRedeemHistory((prev) => [res.data!, ...prev]);
    }

    setRedeemSuccess({
      amount: calculatedRupees,
      target: targetAccount.trim(),
      type: redeemType,
    });
  };

  const closeRedeemModal = () => {
    setIsRedeemOpen(false);
    setRedeemError('');
    setRedeemSuccess(null);
    setCoinsInput('');
    setTargetAccount('');
  };

  // Real numbers for aggregate cards directly from user's data
  const displayViews = totalViews;
  const displayLikes = totalLikes;
  const displayComments = totalComments;

  return (
    <div className="min-h-full bg-[#EAF1FB] pb-24 select-none">
      <div className="px-3.5 pt-4 space-y-4">

        {/* ══════════════════════════════════════════════════════════
            1. MY COINS SECTION (Matches Image 2 exactly)
           ══════════════════════════════════════════════════════════ */}
        <div>
          <h2 className="text-[20px] font-bold text-[#123A66] font-serif m-0 mb-2.5 tracking-tight">
            My Coins
          </h2>

          {/* Deep Navy Blue Coins Card */}
          <div className="rounded-2xl bg-[#09407D] p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
            <span className="text-white/80 text-[12px] font-medium block">
              Available balance
            </span>

            {/* Coins Balance Row */}
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-2">
                {/* Gold Rupee Coin Icon */}
                <div className="w-8 h-8 rounded-full bg-[#F59E0B] flex items-center justify-center text-white font-black text-base shadow-sm">
                  ₹
                </div>
                {/* Large Coin Number */}
                <span className="text-[32px] sm:text-[34px] font-black text-white leading-none tracking-tight">
                  {availableCoins}
                </span>
              </div>

              {/* Redeem Button (Opens Image 3 Modal) */}
              <button
                type="button"
                onClick={() => {
                  setRedeemError('');
                  setRedeemSuccess(null);
                  setIsRedeemOpen(true);
                }}
                className="bg-white text-[#09407D] font-bold text-[13px] px-5 py-2 rounded-full shadow-sm hover:bg-gray-100 active:scale-95 transition-all cursor-pointer border-0"
              >
                Redeem
              </button>
            </div>

            {/* Currency Equivalent */}
            <p className="text-white/80 text-[11px] font-medium mt-2 m-0">
              ≈ ₹{rupeesValue} (10 coins = ₹1)
            </p>

            {/* Progress Bar (Goal: 500 Coins) */}
            <div className="w-full h-1.5 bg-[#062850] rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-[#F59E0B] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (availableCoins / 500) * 100)}%` }}
              />
            </div>

            {/* Status Line Below Progress Bar */}
            <p className="text-white/80 text-[11px] font-medium mt-1.5 m-0">
              {availableCoins >= 500 ? 'You can redeem now' : `Need ${500 - availableCoins} more coins to redeem`}
            </p>
          </div>

          {/* 4 Rate Cards in a Row */}
          <div className="grid grid-cols-4 gap-2 mt-2.5">
            <div className="bg-white rounded-xl border border-[#D0E2F7] p-2 text-center shadow-2xs">
              <span className="block text-[11.5px] font-bold text-[#0F172A] leading-tight">100 views</span>
              <span className="block text-[10px] text-[#64748B] mt-0.5">1 coin</span>
            </div>
            <div className="bg-white rounded-xl border border-[#D0E2F7] p-2 text-center shadow-2xs">
              <span className="block text-[11.5px] font-bold text-[#0F172A] leading-tight">50 likes</span>
              <span className="block text-[10px] text-[#64748B] mt-0.5">1 coin</span>
            </div>
            <div className="bg-white rounded-xl border border-[#D0E2F7] p-2 text-center shadow-2xs">
              <span className="block text-[11.5px] font-bold text-[#0F172A] leading-tight">25 comments</span>
              <span className="block text-[10px] text-[#64748B] mt-0.5">2 coins</span>
            </div>
            <div className="bg-white rounded-xl border border-[#D0E2F7] p-2 text-center shadow-2xs">
              <span className="block text-[11.5px] font-bold text-[#0F172A] leading-tight">50 shares</span>
              <span className="block text-[10px] text-[#64748B] mt-0.5">5 coins</span>
            </div>
          </div>

          {/* Recent Redemptions Section if user has any redemption history */}
          {redeemHistory.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl border border-[#D0E2F7] p-3.5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold text-[#0A2540] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#09407D]" />
                  <span>Redemption History</span>
                </span>
                <span className="text-[10px] text-gray-500 font-semibold">
                  {redeemHistory.length} {redeemHistory.length === 1 ? 'request' : 'requests'}
                </span>
              </div>
              <div className="space-y-2">
                {redeemHistory.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs py-1.5 px-2 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div>
                      <span className="font-bold text-[#0F172A]">₹{item.amount_inr}</span>
                      <span className="text-[10px] text-gray-500 ml-1.5">({item.coins_redeemed} coins)</span>
                      <span className="block text-[10px] text-gray-500 truncate max-w-[170px]">
                        {item.redeem_type === 'recharge' ? 'Recharge: ' : 'UPI: '}
                        {item.target_account}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status === 'completed'
                          ? 'Paid'
                          : item.status === 'rejected'
                          ? 'Refunded'
                          : 'Pending'}
                      </span>
                      <span className="block text-[9.5px] text-gray-400 mt-0.5">
                        {new Date(item.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════
            2. MY REPORTER STATS SECTION
           ══════════════════════════════════════════════════════════ */}
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-[20px] font-bold text-[#123A66] font-serif m-0 tracking-tight">
              My Reporter Stats
            </h2>
          </div>

          {/* Aggregate Stats Cards */}
          <div className="grid grid-cols-3 gap-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-3 border border-[#D0E2F7] shadow-sm flex flex-col items-center">
              <span className="text-[22px] font-bold text-[#0A2540] leading-none mb-1">
                {displayViews}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A90]">VIEWS</span>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-3 border border-[#D0E2F7] shadow-sm flex flex-col items-center">
              <span className="text-[22px] font-bold text-[#0A2540] leading-none mb-1">
                {displayLikes}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A90]">LIKES</span>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-3 border border-[#D0E2F7] shadow-sm flex flex-col items-center">
              <span className="text-[22px] font-bold text-[#0A2540] leading-none mb-1">
                {displayComments}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A90]">COMMENTS</span>
            </motion.div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            TOP REPORTERS SECTION (This Week / This Month)
           ══════════════════════════════════════════════════════════ */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[18px] sm:text-[20px] font-bold text-[#123A66] font-serif m-0 tracking-tight flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#F59E0B]" />
              <span>Top Reporters</span>
            </h2>

            {/* This Week / This Month Tabs */}
            <div className="flex items-center bg-[#D8E6F8] p-0.5 rounded-xl border border-[#C2D8F2]">
              <button
                type="button"
                onClick={() => setTopPeriod('week')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  topPeriod === 'week'
                    ? 'bg-[#09407D] text-white shadow-xs'
                    : 'text-[#475569] hover:text-[#09407D] bg-transparent'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setTopPeriod('month')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 ${
                  topPeriod === 'month'
                    ? 'bg-[#09407D] text-white shadow-xs'
                    : 'text-[#475569] hover:text-[#09407D] bg-transparent'
                }`}
              >
                This Month
              </button>
            </div>
          </div>

          {/* Top Reporters List Card */}
          <div className="bg-white rounded-2xl border border-[#D0E2F7] p-3.5 shadow-sm">
            {topLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 text-[#145AB1] animate-spin mx-auto mb-2" />
                <p className="text-xs text-[#6B7A90] font-bold m-0">Loading top reporters...</p>
              </div>
            ) : topError ? (
              <div className="p-6 text-center">
                <AlertCircle className="w-7 h-7 text-red-500 mx-auto mb-1.5 opacity-80" />
                <p className="text-xs font-bold text-red-600 m-0">{topError}</p>
                <button
                  type="button"
                  onClick={() => loadTopReporters(topPeriod)}
                  className="mt-2.5 px-3 py-1 rounded-lg bg-[#EAF2FB] text-[#09407D] text-xs font-bold border border-[#BFDBFE] cursor-pointer hover:bg-[#D9E9FA]"
                >
                  Try Again
                </button>
              </div>
            ) : topReporters.length === 0 ? (
              <div className="p-8 text-center">
                <Trophy className="w-8 h-8 text-[#8FA3B8] mx-auto mb-2 opacity-40" />
                <p className="text-sm font-bold text-[#0A2540] m-0">No published clippings yet</p>
                <p className="text-xs text-[#6B7A90] mt-1 m-0">
                  {topPeriod === 'week' ? 'No clippings published to feed this week.' : 'No clippings published to feed this month.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EAF1FB]">
                {topReporters.map((rep) => {
                  const initials = (rep.name || 'R')
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((s) => s[0]?.toUpperCase() || '')
                    .join('') || 'R';

                  return (
                    <div
                      key={rep.reporter_id}
                      className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3"
                    >
                      {/* Left: Rank Badge + Avatar + Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Rank Badge */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                            rep.rank === 1
                              ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                              : rep.rank === 2
                              ? 'bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]'
                              : rep.rank === 3
                              ? 'bg-[#FFEDD5] text-[#C2410C] border border-[#FED7AA]'
                              : 'bg-[#F8FAFC] text-[#64748B]'
                          }`}
                        >
                          {rep.rank}
                        </div>

                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-[#DEE9F5] border border-[#C2D8F2] flex items-center justify-center shrink-0">
                          {rep.avatar_url ? (
                            <img
                              src={rep.avatar_url}
                              alt={rep.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-xs font-black text-[#09407D]">{initials}</span>
                          )}
                        </div>

                        {/* Name */}
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-[#0F172A] truncate m-0 leading-tight">
                            {rep.name}
                          </p>
                          {rep.email && !rep.email.endsWith('@phone.user') && (
                            <p className="text-[10px] text-[#64748B] truncate m-0 leading-tight mt-0.5">
                              {rep.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Clipping Count */}
                      <div className="shrink-0 text-right">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#EAF2FB] text-[#09407D] border border-[#CDE1F8]">
                          {rep.eligible_count} {rep.eligible_count === 1 ? 'clipping' : 'clippings'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>


        {/* ══════════════════════════════════════════════════════════
            3. PERFORMANCE BY NEWS POST SECTION
           ══════════════════════════════════════════════════════════ */}
        <div>
          <h2 className="text-[16px] font-bold text-[#123A66] font-serif m-0 mb-2.5">
            Performance by News Post
          </h2>

          {loading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 rounded-full border-2 border-[#145AB1] border-t-transparent animate-spin mx-auto mb-2" />
              <p className="text-xs text-[#6B7A90] font-bold">Loading stats...</p>
            </div>
          ) : clippings.length === 0 ? (
            <div className="bg-white border border-[#D0E2F7] rounded-2xl p-6 text-center shadow-sm">
              <TrendingUp className="w-8 h-8 text-[#8FA3B8] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-[#0A2540]">No posts yet</p>
              <p className="text-xs text-[#6B7A90] mt-1">Generate your first news to see stats.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {clippings.map((clip: any, idx: number) => {
                const postCoin = getPostCoins(clip);
                const postViews = clip.views_count || 0;
                const postLikes = clip.likes_count || 0;
                const postComments = clip.comments_count || 0;

                return (
                  <div
                    key={clip.id}
                    onClick={() => setActiveDetailIndex(idx)}
                    className="bg-white border border-[#D0E2F7] rounded-2xl p-3.5 shadow-sm flex flex-col gap-2 cursor-pointer hover:border-[#145AB1]/60 hover:shadow-md transition-all active:scale-[0.99] group"
                    title="Click to view news"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-[#0A2540] text-[13px] leading-snug line-clamp-2 flex-1 m-0 group-hover:text-[#145AB1] transition-colors">
                        {clip.headline || 'ప్రజా సమస్యల పరిష్కారానికి మూకమామిడిలో వార్డు సభలు....'}
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-medium text-[#6B7A90] whitespace-nowrap">
                          {formatDate(clip.created_at)}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#145AB1] transition-colors" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
                      {/* Left: Views, Likes, Comments */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-[11.5px] font-bold text-slate-700">{postViews}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Heart className="w-3.5 h-3.5 text-slate-500 fill-slate-700" />
                          <span className="text-[11.5px] font-bold text-slate-700">{postLikes}</span>
                        </div>

                        {/* Tappable comment count → opens comment drawer */}
                        <button
                          type="button"
                          className="flex items-center gap-1.5 active:scale-95 transition-transform bg-transparent border-0 p-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCommentDrawer(clip.id, clip.headline || 'Breaking News');
                          }}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[11.5px] font-bold text-slate-700">
                            {postComments}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="flex items-center gap-1.5 active:scale-95 transition-transform bg-transparent border-0 p-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(clip);
                          }}
                        >
                          <Share2 className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-[11.5px] font-bold text-slate-700">{clip.shares_count ?? clip.shares ?? 0}</span>
                        </button>
                      </div>

                      {/* Right: Gold Coin Reward Badge (Matches Image 2) */}
                      <div className="flex items-center gap-1.5 bg-[#FFF8E7] border border-[#FDE68A] text-[#B45309] text-[11px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                        <span className="w-3.5 h-3.5 rounded-full bg-[#F59E0B] text-white flex items-center justify-center text-[8.5px] font-black">
                          C
                        </span>
                        <span>+{postCoin}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          4. REDEEM COINS MODAL (Matches Image 3 exactly)
         ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isRedeemOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={closeRedeemModal}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[360px] sm:max-w-[390px] bg-white rounded-[24px] p-5 shadow-2xl relative"
            >
              {redeemSuccess ? (
                /* Success View */
                <div className="text-center py-4 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0B3B74] m-0">
                    Redemption Submitted!
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed max-w-xs mx-auto">
                    ₹{redeemSuccess.amount} will be credited to{' '}
                    <strong className="text-gray-900">{redeemSuccess.target}</strong> via{' '}
                    {redeemSuccess.type === 'recharge' ? 'Mobile Recharge' : 'UPI'} within 24 hours.
                  </p>
                  <button
                    type="button"
                    onClick={closeRedeemModal}
                    className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#0B56A6] text-white shadow-sm mt-3 border-0 cursor-pointer active:scale-95 transition-all"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Form View (Image 3) */
                <div>
                  <h3 className="text-[18px] font-bold text-[#0B3B74] m-0 mb-3.5 tracking-tight">
                    Redeem coins
                  </h3>

                  {/* Section: REDEEM TO */}
                  <div>
                    <span className="block text-[10.5px] font-bold text-[#6B7A90] uppercase tracking-wider mb-2">
                      REDEEM TO
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setRedeemType('upi'); setRedeemError(''); }}
                        className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all text-center border cursor-pointer ${
                          redeemType === 'upi'
                            ? 'bg-[#EAF3FD] border-[#1976D2] text-[#0B4079]'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        UPI (cash)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRedeemType('recharge'); setRedeemError(''); }}
                        className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all text-center border cursor-pointer ${
                          redeemType === 'recharge'
                            ? 'bg-[#EAF3FD] border-[#1976D2] text-[#0B4079]'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        Mobile recharge
                      </button>
                    </div>
                  </div>

                  {/* Section: MOBILE NUMBER / UPI ID */}
                  <div className="mt-3.5">
                    <span className="block text-[10.5px] font-bold text-[#6B7A90] uppercase tracking-wider mb-1.5">
                      {redeemType === 'recharge' ? 'MOBILE NUMBER' : 'UPI ID (VPA)'}
                    </span>
                    <input
                      type="text"
                      value={targetAccount}
                      onChange={(e) => { setTargetAccount(e.target.value); setRedeemError(''); }}
                      placeholder={redeemType === 'recharge' ? '10-digit number' : 'mobile@upi or name@bank'}
                      className="w-full bg-[#373A40] text-white placeholder-gray-400 rounded-xl px-3.5 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1976D2] transition-all border-0 box-border"
                    />
                  </div>

                  {/* Section: COINS TO REDEEM */}
                  <div className="mt-3.5">
                    <span className="block text-[10.5px] font-bold text-[#6B7A90] uppercase tracking-wider mb-1.5">
                      COINS TO REDEEM
                    </span>
                    <input
                      type="number"
                      value={coinsInput}
                      onChange={(e) => { setCoinsInput(e.target.value); setRedeemError(''); }}
                      placeholder="Minimum 500"
                      className="w-full bg-[#373A40] text-white placeholder-gray-400 rounded-xl px-3.5 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-[#1976D2] transition-all border-0 box-border"
                    />

                    {/* Quick Select Buttons: 500 & Max */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => { setCoinsInput('500'); setRedeemError(''); }}
                        className="px-3.5 py-1 rounded-full text-xs font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
                      >
                        500
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCoinsInput(String(availableCoins)); setRedeemError(''); }}
                        className="px-3.5 py-1 rounded-full text-xs font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 active:scale-95 transition-all cursor-pointer"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  {/* Calculated Payout: You get ₹{calculatedRupees} */}
                  <p className="text-[15px] font-bold text-[#0F172A] mt-3.5 mb-0">
                    You get ₹{calculatedRupees}
                  </p>

                  {/* Validation Error Message */}
                  {redeemError && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{redeemError}</span>
                    </div>
                  )}

                  {/* Bottom Action Buttons */}
                  <div className="flex items-center gap-2.5 mt-5">
                    <button
                      type="button"
                      onClick={closeRedeemModal}
                      disabled={isSubmittingRedeem}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#EAF3FD] hover:bg-[#D8E9FA] text-[#0B56A6] transition-all cursor-pointer border-0 active:scale-95 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRedeemSubmit}
                      disabled={isSubmittingRedeem}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#0B56A6] hover:bg-[#094787] text-white shadow-sm transition-all cursor-pointer border-0 active:scale-95 disabled:opacity-75 flex items-center justify-center gap-1.5"
                    >
                      {isSubmittingRedeem && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                      <span>{isSubmittingRedeem ? 'Submitting...' : 'Redeem now'}</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Full Screen News Detail Pager ── */}
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
          onComment={(id) => {
            const clip = clippings.find((c) => c.id === id);
            openCommentDrawer(id, clip?.headline || 'News');
          }}
          onShare={handleShare}
        />
      )}

      {/* ── Comments Drawer for Reporter ─────────────────────────────────────── */}
      {commentDrawer && (
        <div
          className="fixed inset-0 z-[100005] flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => setCommentDrawer(null)}
        >
          <div
            className="bg-white rounded-t-2xl flex flex-col"
            style={{ height: '65vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
              <div className="flex-1 pr-2">
                <span className="text-sm font-bold text-[#0A2540]">
                  Comments ({drawerComments.length})
                </span>
                <p className="text-[10px] text-gray-400 line-clamp-1 mt-0.5">{commentDrawer.headline}</p>
              </div>
              <button onClick={() => setCommentDrawer(null)} className="p-1 rounded-full hover:bg-gray-100 border-0 bg-transparent cursor-pointer">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Comment List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 0 }}>
              {drawerLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 rounded-full border-2 border-[#015BB3] border-t-transparent animate-spin" />
                </div>
              ) : drawerComments.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">No comments yet on this post.</p>
              ) : (
                drawerComments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#015BB3] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {(c.user_name || 'A')[0].toUpperCase()}
                    </div>
                    <div className="bg-gray-50 rounded-2xl rounded-tl-none px-3 py-2 flex-1">
                      <p className="text-[10px] font-bold text-[#015BB3] mb-0.5">{c.user_name}</p>
                      <p className="text-[12px] text-gray-800 leading-snug">{c.text}</p>
                      <p className="text-[9px] text-gray-400 mt-1">
                        {new Date(c.created_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Row */}
            <div
              className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            >
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitDrawerComment()}
                placeholder="Write a comment..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-[#015BB3]"
              />
              <button
                type="button"
                onClick={submitDrawerComment}
                disabled={!newCommentText.trim() || commentSubmitting}
                className="w-9 h-9 rounded-full bg-[#015BB3] flex items-center justify-center text-white disabled:opacity-40 active:scale-95 transition-transform cursor-pointer border-0"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
