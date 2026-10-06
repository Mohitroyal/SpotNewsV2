import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store';
import { supabase } from '@/lib/supabase';
import {
  BarChart3, Eye, Heart, MessageSquare, TrendingUp, Newspaper, X
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Comment {
  id: string;
  clipping_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export const StatsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [clippings, setClippings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats aggregates
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);

  // Comments drawer
  const [commentDrawer, setCommentDrawer] = useState<{ clipId: string; headline: string } | null>(null);
  const [drawerComments, setDrawerComments] = useState<Comment[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        // Fetch all clippings for this reporter
        const { data, error } = await supabase
          .from('clippings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const feed = data || [];

        // Fetch actual comment counts directly from lipping_comments (source of truth)
        const clippingIds = feed.map((c: any) => c.id);
        let commentCountMap: Record<string, number> = {};

        if (clippingIds.length > 0) {
          const { data: commentRows } = await supabase
            .from('lipping_comments')
            .select('clipping_id')
            .in('clipping_id', clippingIds);

          (commentRows || []).forEach((row: any) => {
            commentCountMap[row.clipping_id] = (commentCountMap[row.clipping_id] || 0) + 1;
          });
        }

        // Merge real comment counts into clippings
        const enriched = feed.map((c: any) => ({
          ...c,
          comments_count: commentCountMap[c.id] ?? c.comments_count ?? 0,
        }));

        setClippings(enriched);

        let views = 0, likes = 0, comments = 0;
        enriched.forEach((c: any) => {
          views += c.views_count || 0;
          likes += c.likes_count || 0;
          comments += c.comments_count || 0;
        });

        setTotalViews(views);
        setTotalLikes(likes);
        setTotalComments(comments);
      } catch (err) {
        console.error('Failed to fetch stats', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

  }, [user?.id]);

  const openCommentDrawer = async (clipId: string, headline: string) => {
    setCommentDrawer({ clipId, headline });
    setDrawerLoading(true);
    setDrawerComments([]);
    try {
      const { data } = await supabase
        .from('lipping_comments')
        .select('*')
        .eq('clipping_id', clipId)
        .order('created_at', { ascending: true });
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

  return (
    <div className="min-h-full bg-[#EAF1FB] pb-24">
      {/* Header */}
      <div style={{ background: '#EAF1FB', paddingTop: '16px', paddingBottom: '14px', marginBottom: '10px' }}>
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BarChart3 style={{ width: '22px', height: '22px', color: '#123A66' }} />
            <h1 style={{ color: '#123A66', fontSize: '20px', fontWeight: 700, fontFamily: "'Georgia', serif", margin: 0, letterSpacing: '0.3px' }}>
              My Reporter Stats
            </h1>
          </div>
        </div>
      </div>

      <div className="px-3 space-y-4">
        {/* Aggregate Stats Cards */}
        <div className="grid grid-cols-3 gap-2">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-3 border border-[#D0E2F7] shadow-sm flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
              <Eye className="w-4 h-4" />
            </div>
            <span className="text-lg font-black text-[#0A2540]">{totalViews}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7A90]">Views</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-3 border border-[#D0E2F7] shadow-sm flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-1">
              <Heart className="w-4 h-4" />
            </div>
            <span className="text-lg font-black text-[#0A2540]">{totalLikes}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7A90]">Likes</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-3 border border-[#D0E2F7] shadow-sm flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="text-lg font-black text-[#0A2540]">{totalComments}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7A90]">Comments</span>
          </motion.div>
        </div>

        {/* Detailed News List */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 mt-4 px-1">
            <Newspaper className="w-4 h-4 text-[#0d4a8f]" />
            <h2 className="text-sm font-bold text-[#0A2540]">Performance by News Post</h2>
          </div>

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
              {clippings.map((clip: any) => (
                <div key={clip.id} className="bg-white border border-[#D0E2F7] rounded-2xl p-3 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-[#0A2540] text-xs leading-snug line-clamp-2 flex-1">
                      {clip.headline || 'Breaking News'}
                    </h3>
                    <span className="text-[9px] font-medium text-[#6B7A90] whitespace-nowrap shrink-0">
                      {formatDate(clip.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-[11px] font-bold text-slate-700">{clip.views_count || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-[11px] font-bold text-slate-700">{clip.likes_count || 0}</span>
                      </div>

                      {/* Tappable comment count → opens comment drawer */}
                      <button
                        className="flex items-center gap-1.5 active:scale-95 transition-transform"
                        onClick={() => openCommentDrawer(clip.id, clip.headline || 'Breaking News')}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[11px] font-bold text-emerald-600 underline underline-offset-2">
                          {clip.comments_count || 0}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Comments Drawer for Reporter ─────────────────────────────────────── */}
      {commentDrawer && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
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
              <button onClick={() => setCommentDrawer(null)} className="p-1 rounded-full hover:bg-gray-100">
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
          </div>
        </div>
      )}
    </div>
  );
};
