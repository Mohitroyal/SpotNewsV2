import React, { useRef, useState, useEffect } from 'react';
import { Newspaper, Share2, MessageCircle, ThumbsUp, Megaphone, ChevronRight, FileImage, MapPin, Play, Volume2, VolumeX } from 'lucide-react';
import { FitBox } from '@/components/FitBox';
import { limitWordsForDisplay, MAX_HEADLINE_WORDS } from '@/utils/wordLimit';
import { TwoImageGallery, getClipPhotos } from '@/components/TwoImageGallery';

/**
 * Hero video player for the feed card with play/pause and sound controls.
 */
const FeedHeroVideoPlayer: React.FC<{
  videoSrc: string;
  poster?: string;
}> = ({ videoSrc, poster }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Attempt muted auto-play on mount
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const p = vid.play();
    if (p !== undefined) {
      p.then(() => setIsPlaying(true)).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [videoSrc]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none">
      {poster && (
        <div
          className="absolute inset-0 opacity-20 scale-110 blur-xl bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${poster})` }}
        />
      )}

      <video
        ref={videoRef}
        src={videoSrc}
        poster={poster || undefined}
        playsInline
        muted={isMuted}
        loop
        preload="metadata"
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="relative z-10 w-full h-full object-contain cursor-pointer"
      />

      {/* Play button overlay when paused */}
      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute z-20 inset-0 m-auto w-14 h-14 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white border-0 cursor-pointer shadow-lg transition-transform active:scale-95"
          aria-label="Play video"
        >
          <Play className="w-7 h-7 ml-0.5 fill-white" />
        </button>
      )}

      {/* Sound toggle button */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute z-20 top-3 right-3 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white border-0 cursor-pointer shadow transition"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
};

/**
 * Way2News-style reading card: photo on top, short headline, ≤50-word story,
 * reporter + place, and big action buttons. One card = one screen; swipe up for next.
 */
export interface SponsoredTeaser {
  id: string;
  label: string;      // e.g. "Flipkart" or the local shop name
  title: string;
  onOpen: () => void;
}

interface Props {
  clip: any;
  liked: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onOpenClipping: () => void;
  sponsored?: SponsoredTeaser | null;
}

export function clipPhoto(clip: any): string {
  const cl = clip?.custom_layout || {};
  const list = cl.imageUrls || cl.image_urls || clip?.image_urls || [];
  const first = Array.isArray(list) ? list.find((u: string) => typeof u === 'string' && u && !u.startsWith('data:image/png;base64,iVBORw0KGgo')) : '';
  return first || cl.imageUrl || cl.image_url || clip?.png_url || clip?.image_url || '';
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ఇప్పుడే';
  if (m < 60) return `${m} నిమి. క్రితం`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} గం. క్రితం`;
  return new Date(iso).toLocaleDateString('te-IN', { day: 'numeric', month: 'short' });
}

export const ReaderStoryCard: React.FC<Props> = ({ clip, liked, onLike, onComment, onShare, onOpenClipping, sponsored }) => {
  const cl = clip?.custom_layout || {};
  // Text view must ONLY bind to the original uploaded news video, NOT the composed clipping video
  const originalVideo = cl.video_url || cl.videoUrl || clip.video_url || clip.videoUrl || '';
  const poster = clip?.png_url || cl?.png_url || cl?.pngUrl || clip?.image_url || cl?.imageUrl || '';
  const photos = getClipPhotos(clip);
  const headline = limitWordsForDisplay(clip.headline || cl.headline || 'Spot News', MAX_HEADLINE_WORDS);
  const body = limitWordsForDisplay(clip.article_content || cl.articleContent || cl.article_content || '');
  const reporter = cl.reporterName || cl.reporter_name || clip.reporter_name || 'RTI Express Reporter';
  const place = clip.district && clip.district !== 'All' ? clip.district : '';

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Photo / Two-Image Sliding Gallery */}
      <div className="relative w-full shrink-0 bg-black overflow-hidden" style={{ height: '38%' }}>
        {originalVideo ? (
          <FeedHeroVideoPlayer videoSrc={originalVideo} poster={poster} />
        ) : photos.length > 0 ? (
          <TwoImageGallery
            photos={photos}
            alt={headline}
            onImageClick={onOpenClipping}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center cursor-pointer"
            onClick={onOpenClipping}
          >
            <Newspaper className="w-16 h-16 text-white/40" />
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenClipping();
          }}
          className="absolute z-20 left-3 bottom-3 inline-flex items-center gap-1.5 bg-black/65 hover:bg-black/80 text-white text-[13px] font-bold px-3 py-1.5 rounded-full border-0 cursor-pointer shadow-sm transition"
        >
          <FileImage className="w-4 h-4" /> క్లిప్పింగ్ చూడండి
        </button>
      </div>

      {/* Text */}
      <FitBox className="flex-1 min-h-0 px-5 pt-4 pb-2">
        <h2 className="text-[23px] leading-[1.35] font-extrabold text-[#0A2540] m-0">{headline}</h2>
        {body && <p className="mt-3 mb-0 text-[18px] leading-[1.65] text-[#1F2937] whitespace-pre-line">{body}</p>}
        <div className="mt-3 flex items-center gap-2 text-[14px] text-[#64748B] font-semibold">
          <span className="truncate">{reporter}</span>
          {place && (<><span>·</span><span className="inline-flex items-center gap-0.5"><MapPin className="w-3.5 h-3.5" />{place}</span></>)}
          <span>·</span><span className="shrink-0">{timeAgo(clip.created_at)}</span>
        </div>

        {sponsored && (
          <button type="button" onClick={sponsored.onOpen}
            className="mt-4 w-full flex items-center gap-3 rounded-2xl border border-[#F4D58D] bg-[#FFF9E8] px-3.5 py-3 cursor-pointer text-left">
            <span className="w-10 h-10 rounded-full bg-[#F59E0B] flex items-center justify-center shrink-0"><Megaphone className="w-5 h-5 text-white" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] font-extrabold text-[#B45309] uppercase tracking-wide">ప్రకటన · Sponsored · {sponsored.label}</span>
              <span className="block text-[15.5px] font-bold text-[#3A2400] truncate">{sponsored.title}</span>
            </span>
            <ChevronRight className="w-5 h-5 text-[#B45309] shrink-0" />
          </button>
        )}
      </FitBox>

      {/* Actions */}
      <div className="shrink-0 grid grid-cols-3 border-t border-[#E2E8F0] bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button type="button" onClick={onLike} className={`py-3.5 flex items-center justify-center gap-2 text-[16px] font-bold bg-transparent border-0 cursor-pointer ${liked ? 'text-[#015BB3]' : 'text-[#475569]'}`}>
          <ThumbsUp className="w-6 h-6" fill={liked ? 'currentColor' : 'none'} /> {clip.likes_count || 0}
        </button>
        <button type="button" onClick={onComment} className="py-3.5 flex items-center justify-center gap-2 text-[16px] font-bold text-[#475569] bg-transparent border-0 cursor-pointer">
          <MessageCircle className="w-6 h-6" /> {clip.comments_count || 0}
        </button>
        <button type="button" onClick={onShare} className="py-3.5 flex items-center justify-center gap-2 text-[16px] font-extrabold text-white bg-[#015BB3] border-0 cursor-pointer">
          <Share2 className="w-6 h-6" /> షేర్
        </button>
      </div>
    </div>
  );
};
