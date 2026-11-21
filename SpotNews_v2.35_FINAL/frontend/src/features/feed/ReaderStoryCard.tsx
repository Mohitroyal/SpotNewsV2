import React, { useRef, useState, useEffect } from 'react';
import { Newspaper, Share2, MessageCircle, ThumbsUp, Megaphone, ChevronRight, FileImage, MapPin, Play, Volume2, VolumeX } from 'lucide-react';
import { useLang } from '@/lib/lang';
import { limitWordsForDisplay, MAX_HEADLINE_WORDS, MAX_ARTICLE_WORDS } from '@/utils/wordLimit';
import { TwoImageGallery, getClipPhotos } from '@/components/TwoImageGallery';

/**
 * Hero video player for the feed card with viewport-aware autoplay and sound controls.
 */
const FeedHeroVideoPlayer: React.FC<{
  videoSrc: string;
  poster?: string;
  isActive?: boolean;
}> = ({ videoSrc, poster, isActive = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const isUserPausedRef = useRef(false);

  // Viewport intersection observer: only play when physically inside the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const inView = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.5);
        setIsVisible(inView);
        if (!inView) {
          const vid = videoRef.current;
          if (vid && !vid.paused) {
            vid.pause();
            setIsPlaying(false);
          }
        }
      },
      { threshold: [0, 0.5, 0.8] }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      const vid = videoRef.current;
      if (vid) {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
      }
    };
  }, []);

  // Synchronize playback with visibility and active state
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const shouldPlay = isActive && isVisible && !isUserPausedRef.current;

    if (shouldPlay) {
      vid.muted = isMuted;
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            // If sound was blocked, fallback to muted autoplay
            vid.muted = true;
            setIsMuted(true);
            vid.play()
              .then(() => setIsPlaying(true))
              .catch(() => setIsPlaying(false));
          });
      }
    } else {
      if (!vid.paused) {
        vid.pause();
      }
      setIsPlaying(false);
    }
  }, [isActive, isVisible, isMuted, videoSrc]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      isUserPausedRef.current = false;
      vid.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      isUserPausedRef.current = true;
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
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none">
      {poster && (
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${poster})` }}
        />
      )}

      {(isActive || isVisible) ? (
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
      ) : poster ? (
        <img
          src={poster}
          alt=""
          className="relative z-10 w-full h-full object-contain cursor-pointer"
          loading="lazy"
        />
      ) : null}

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
  isActive?: boolean;
}

export function clipPhoto(clip: any): string {
  const cl = clip?.custom_layout || {};
  const list = cl.imageUrls || cl.image_urls || clip?.image_urls || [];
  const first = Array.isArray(list) ? list.find((u: string) => typeof u === 'string' && u && !u.startsWith('data:image/png;base64,iVBORw0KGgo')) : '';
  return first || cl.imageUrl || cl.image_url || clip?.png_url || clip?.image_url || '';
}

function timeAgo(iso?: string, lang: 'te' | 'en' = 'te') {
  if (!iso) return '';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === 'en' ? 'Just now' : 'ఇప్పుడే';
  if (m < 60) return lang === 'en' ? `${m}m ago` : `${m} నిమి. క్రితం`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'en' ? `${h}h ago` : `${h} గం. క్రితం`;
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-IN' : 'te-IN', { day: 'numeric', month: 'short' });
}

export const ReaderStoryCard: React.FC<Props> = ({ clip, liked, onLike, onComment, onShare, onOpenClipping, sponsored, isActive = true }) => {
  const [lang] = useLang();
  const cl = clip?.custom_layout || {};
  // Text view must ONLY bind to the original uploaded news video, NOT the composed clipping video
  const originalVideo = cl.video_url || cl.videoUrl || clip.video_url || clip.videoUrl || '';
  const poster = clip?.png_url || cl?.png_url || cl?.pngUrl || clip?.image_url || cl?.imageUrl || '';
  const photos = getClipPhotos(clip);
  const isTwoImage = photos.length >= 2 || ['C', 'D'].includes(cl?.layoutPattern || cl?.layout_pattern || clip?.layout_pattern || clip?.pattern || clip?.image_layout || '');
  const rawHeadline = clip.headline || cl.headline || 'Spot News';
  const headline = isTwoImage ? rawHeadline : limitWordsForDisplay(rawHeadline, MAX_HEADLINE_WORDS);
  const cleanSinglePara = (str: string) =>
    (str || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/[\u00a0\u200b\ufeff]/g, ' ')
      .replace(/[\r\n\t\v\f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const rawSub = cleanSinglePara(
    clip.subheadline ||
    clip.sub_headline ||
    cl.subheadline ||
    cl.sub_headline ||
    ''
  );

  const originalBody = cleanSinglePara(
    clip.article_content ||
    cl.articleContent ||
    cl.article_content ||
    (Array.isArray(cl.sections) ? cl.sections.join(' ') : '') ||
    ''
  );

  const mergedBody = rawSub && !originalBody.startsWith(rawSub)
    ? `${rawSub} ${originalBody}`
    : (originalBody || rawSub);

  const rawBody = isTwoImage ? mergedBody : limitWordsForDisplay(mergedBody, MAX_ARTICLE_WORDS);
  const body = cleanSinglePara(rawBody);
  const reporter = cl.reporterName || cl.reporter_name || clip.reporter_name || 'RTI Express Reporter';
  const place = clip.district && clip.district !== 'All' ? clip.district : '';

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Photo / Two-Image Sliding Gallery */}
      <div className="relative w-full shrink-0 bg-black overflow-hidden" style={{ height: '38%' }}>
        {originalVideo ? (
          <FeedHeroVideoPlayer videoSrc={originalVideo} poster={poster} isActive={isActive} />
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
          <FileImage className="w-4 h-4" /> {lang === 'en' ? 'View Clipping' : 'క్లిప్పింగ్ చూడండి'}
        </button>
      </div>

      {/* Text */}
      <div
        className="flex-1 min-h-0 px-5 pt-4 pb-3 overflow-y-auto"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <h2 className="text-[21px] sm:text-[22px] leading-[1.3] font-extrabold text-[#0A2540] m-0 tracking-tight">{headline}</h2>
        {body && (
          <p
            className="mt-2.5 mb-0 text-[18px] sm:text-[19px] leading-[30px] sm:leading-[32px] text-[#1F2937] pb-2 font-normal"
            style={{
              textAlign: 'justify',
              textJustify: 'inter-word',
              hyphens: 'auto',
              wordBreak: 'break-word',
            }}
          >
            {body}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-[14px] text-[#64748B] font-semibold">
          <span className="truncate">{reporter}</span>
          {place && (<><span>·</span><span className="inline-flex items-center gap-0.5"><MapPin className="w-3.5 h-3.5" />{place}</span></>)}
          <span>·</span><span className="shrink-0">{timeAgo(clip.created_at, lang)}</span>
        </div>

        {sponsored && (
          <button type="button" onClick={sponsored.onOpen}
            className="mt-4 w-full flex items-center gap-3 rounded-2xl border border-[#F4D58D] bg-[#FFF9E8] px-3.5 py-3 cursor-pointer text-left">
            <span className="w-10 h-10 rounded-full bg-[#F59E0B] flex items-center justify-center shrink-0"><Megaphone className="w-5 h-5 text-white" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] font-extrabold text-[#B45309] uppercase tracking-wide">{lang === 'en' ? `Sponsored · ${sponsored.label}` : `ప్రకటన · Sponsored · ${sponsored.label}`}</span>
              <span className="block text-[15.5px] font-bold text-[#3A2400] truncate">{sponsored.title}</span>
            </span>
            <ChevronRight className="w-5 h-5 text-[#B45309] shrink-0" />
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 grid grid-cols-3 border-t border-[#E2E8F0] bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <button type="button" onClick={onLike} className={`py-3.5 flex items-center justify-center gap-2 text-[16px] font-bold bg-transparent border-0 cursor-pointer ${liked ? 'text-[#015BB3]' : 'text-[#475569]'}`}>
          <ThumbsUp className="w-6 h-6" fill={liked ? 'currentColor' : 'none'} /> {clip.likes_count || 0}
        </button>
        <button type="button" onClick={onComment} className="py-3.5 flex items-center justify-center gap-2 text-[16px] font-bold text-[#475569] bg-transparent border-0 cursor-pointer">
          <MessageCircle className="w-6 h-6" /> {clip.comments_count || 0}
        </button>
        <button type="button" onClick={onShare} className="py-3.5 flex items-center justify-center gap-2 text-[16px] font-extrabold text-white bg-[#015BB3] border-0 cursor-pointer">
          <Share2 className="w-6 h-6" /> {lang === 'en' ? 'Share' : 'షేర్'}
        </button>
      </div>
    </div>
  );
};
