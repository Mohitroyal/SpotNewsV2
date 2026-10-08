import React, { useState, useEffect, useRef } from 'react';
import { Newspaper, MapPin, RefreshCw, X, Send, Share2, Copy, Check } from 'lucide-react';
import { useAuthStore, useUIStore } from '@/store';
import { supabase } from '@/lib/supabase';

interface Comment {
  id: string;
  clipping_id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export const FeedScreen: React.FC = () => {
  const { user } = useAuthStore();
  const district = useAuthStore((state) => state.district) || '';
  const userState = useAuthStore((state) => state.userState) || '';
  const isFullScreenFeed = useUIStore((state) => state.isFullScreenFeed);
  const toggleFullScreenFeed = useUIStore((state) => state.toggleFullScreenFeed);
  const [clippings, setClippings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // In-memory session guard (prevents firing twice within a single scroll session)
  const viewedIds = useRef<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Liked clipping IDs by this user (stored in state for toggle)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // Comments drawer state
  const [commentOpen, setCommentOpen] = useState<string | null>(null); // clipping id
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  // Share drawer state
  const [shareSheetOpen, setShareSheetOpen] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareClick = async (clip: any) => {
    const headline = clip.headline || clip.title || 'News Update';
    const content = clip.summary || clip.content || '';
    const shareUrl = clip.png_url || window.location.href;
    const text = `${headline}\n\n${content}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: headline,
          text: text,
          url: shareUrl
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    setShareSheetOpen(clip);
  };

  const handleShareOption = (option: string, clip: any) => {
    const headline = clip.headline || clip.title || 'News Update';
    const content = clip.summary || clip.content || '';
    const shareUrl = clip.png_url || window.location.href;
    const text = `${headline}\n\n${content}`;

    let url = '';
    switch (option) {
      case 'WhatsApp':
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + '\n' + shareUrl)}`;
        window.open(url, '_blank');
        break;
      case 'Facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        window.open(url, '_blank');
        break;
      case 'Twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(url, '_blank');
        break;
      case 'Telegram':
        url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        break;
      case 'Gmail':
        url = `mailto:?subject=${encodeURIComponent(headline)}&body=${encodeURIComponent(text + '\n\n' + shareUrl)}`;
        window.open(url, '_blank');
        break;
      case 'Copy':
        navigator.clipboard.writeText(shareUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        break;
    }
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
        .gte('created_at', todayISO)
        .order('created_at', { ascending: false });

      if (userState) query = query.eq('state', userState);
      if (district) query = query.eq('district', district);

      const { data, error } = await query;
      if (error) throw error;

      const postedClippings = (data || []).filter((c) => c.is_posted === true);
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
    if (clippings.length === 0 || !user?.id) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.clipId;
            // In-memory guard: skip if already processed this scroll session
            if (!id || viewedIds.current.has(id)) return;
            viewedIds.current.add(id);

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
        });
      },
      { threshold: 0.6 }
    );

    cardRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [clippings.length, user?.id]);


  useEffect(() => {
    fetchFeed();
  }, [district, userState]);

  return (
    <div className={`flex flex-col h-[100dvh] bg-black ${!isFullScreenFeed ? 'pb-[60px]' : ''}`}>
      {!isFullScreenFeed && (
        <div className="flex-shrink-0 bg-white" style={{ paddingTop: '16px', paddingBottom: '14px' }}>
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Newspaper style={{ width: '22px', height: '22px', color: '#123A66' }} />
              <h1 style={{ color: '#123A66', fontSize: '20px', fontWeight: 700, fontFamily: "'Georgia', serif", margin: 0, letterSpacing: '0.3px' }}>
                Today's News Feed
              </h1>
            </div>
            <button
              onClick={fetchFeed}
              style={{ background: '#145AB1', color: '#ffffff', border: 'none', borderRadius: '20px', padding: '6px 16px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
          <div className="px-4 mt-3">
            <div className="inline-flex items-center gap-1.5 bg-[#015BB3] text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
              <MapPin className="w-3.5 h-3.5" />
              Showing news for: {district || 'All Regions'}{userState ? `, ${userState}` : ''}
            </div>
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
            {clippings.map((clip: any) => {
              const isLiked = likedIds.has(clip.id);

              return (
                <div
                  key={clip.id}
                  data-clip-id={clip.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(clip.id, el);
                    else cardRefs.current.delete(clip.id);
                  }}
                  className="w-full h-full snap-start snap-always flex flex-col bg-black border-b border-gray-800 relative"
                >
                  {/* Full Screen Generated Image */}
                  <div
                    className="flex-1 w-full bg-black relative flex items-center justify-center overflow-hidden pb-[56px]"
                    onClick={toggleFullScreenFeed}
                  >
                    {clip.png_url && (
                      <div
                        className="absolute inset-0 opacity-30 scale-110 blur-xl bg-cover bg-center"
                        style={{ backgroundImage: `url(${clip.png_url})` }}
                      />
                    )}
                    {clip.mp4_url ? (
                      <video
                        src={clip.mp4_url}
                        controls
                        playsInline
                        loop
                        className="w-full h-full object-contain relative z-10 bg-black"
                      />
                    ) : clip.png_url ? (
                      <img
                        src={clip.png_url}
                        alt="News clipping"
                        className="w-full h-full object-contain relative z-10"
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
              );
            })}
          </div>
        )}
      </div>

      {/* ── Comments Bottom Sheet ─────────────────────────────────────────── */}
      {commentOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
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
              <button onClick={() => setCommentOpen(null)} className="p-1 rounded-full hover:bg-gray-100">
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
                className="w-9 h-9 rounded-full bg-[#015BB3] flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Share Bottom Sheet ─────────────────────────────────────────── */}
      {shareSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setShareSheetOpen(null)}
        >
          <div
            className="bg-white rounded-t-3xl p-5 shadow-2xl border-t-2 border-[#015BB3] max-w-md mx-auto w-full animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0A2540]">Share News Clipping</h3>
                <p className="text-xs text-gray-500 truncate max-w-[260px]">{shareSheetOpen.headline || shareSheetOpen.title || 'News Update'}</p>
              </div>
              <button
                onClick={() => setShareSheetOpen(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 py-3">
              {/* WhatsApp */}
              <button
                onClick={() => handleShareOption('WhatsApp', shareSheetOpen)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.455L0 24zm6.59-11.597c-.279-.314-.555-.262-.773-.272-.2-.008-.428-.008-.656-.008-.228 0-.6-.086-.913-.429-.314-.343-1.198-1.172-1.198-2.859 0-1.687 1.226-3.314 1.398-3.543.171-.228 2.413-3.685 5.845-5.17.816-.353 1.453-.564 1.948-.72.822-.262 1.572-.225 2.164-.137.66.099 2.03.83 2.314 1.632.285.803.285 1.49.201 1.632-.083.14-.308.228-.651.4l-2.102 1.03c-.342.166-.591.248-.846.634-.255.38-.973 1.226-1.195 1.48-.222.254-.443.286-.786.114-.343-.171-1.447-.533-2.755-1.7c-1.018-.908-1.704-2.03-1.902-2.372-.199-.343-.021-.528.15-.699.153-.153.343-.4.514-.6.171-.2.228-.343.343-.571.114-.229.057-.429-.028-.6-.086-.171-.773-1.857-1.059-2.543-.278-.669-.561-.578-.773-.589z"/>
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-gray-700">WhatsApp</span>
              </button>

              {/* Facebook */}
              <button
                onClick={() => handleShareOption('Facebook', shareSheetOpen)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#1877F2] text-white flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-gray-700">Facebook</span>
              </button>

              {/* X / Twitter */}
              <button
                onClick={() => handleShareOption('Twitter', shareSheetOpen)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center shadow-md">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-gray-700">X (Twitter)</span>
              </button>

              {/* Telegram */}
              <button
                onClick={() => handleShareOption('Telegram', shareSheetOpen)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#0088cc] text-white flex items-center justify-center shadow-md">
                  <Send className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-gray-700">Telegram</span>
              </button>

              {/* Copy Link */}
              <button
                onClick={() => handleShareOption('Copy', shareSheetOpen)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-700 flex items-center justify-center shadow-md">
                  {copiedLink ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                </div>
                <span className="text-[11px] font-semibold text-gray-700">{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>

              {/* System Share */}
              {Boolean(navigator.share) && (
                <button
                  onClick={() => {
                    const headline = shareSheetOpen.headline || shareSheetOpen.title || 'News Update';
                    const content = shareSheetOpen.summary || shareSheetOpen.content || '';
                    const shareUrl = shareSheetOpen.png_url || window.location.href;
                    navigator.share({ title: headline, text: `${headline}\n\n${content}`, url: shareUrl }).catch(() => {});
                  }}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#E8F2FC] text-[#015BB3] flex items-center justify-center shadow-md">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700">More Apps</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setShareSheetOpen(null)}
              className="w-full py-3 mt-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
