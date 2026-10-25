import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface NewsVideoPlayerProps {
  src: string;
  isActive: boolean;
  className?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
}

export const NewsVideoPlayer: React.FC<NewsVideoPlayerProps> = ({
  src,
  isActive,
  className = 'w-full h-full object-cover',
  objectFit = 'cover',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Format seconds to mm:ss
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Reset the 3-second controls auto-hide timer
  const restartHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  // Sync playback with isActive prop — pauses immediately when user swipes to another news item
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isActive) {
      video.pause();
      setIsPlaying(false);
      setShowControls(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      // Auto-play when card becomes active
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // Autoplay with sound may be blocked by browser policy; fallback to muted autoplay
            video.muted = true;
            setIsMuted(true);
            video.play()
              .then(() => setIsPlaying(true))
              .catch(() => setIsPlaying(false));
          });
      }
    }

    return () => {
      video.pause();
    };
  }, [isActive]);

  // Handle Fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Update time and duration
  const handleTimeUpdate = () => {
    if (videoRef.current && !isDraggingRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      setIsMuted(videoRef.current.muted);
    }
  };

  // Toggle Play / Pause
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Toggle Mute / Unmute
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  // Touching the video area toggles play/pause AND reveals controls for 3s
  const handleContainerTap = () => {
    // Only toggle if clicked directly on video area (not on progress bar or buttons)
    togglePlayPause();
    restartHideTimer();
  };

  // Seeking on the red progress line
  const seekTo = (clientX: number) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = ratio * duration;
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    seekTo(e.clientX);
    restartHideTimer();

    const onMouseMove = (moveEvent: MouseEvent) => {
      seekTo(moveEvent.clientX);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleProgressTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    if (e.touches[0]) seekTo(e.touches[0].clientX);
    restartHideTimer();

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault();
      if (moveEvent.touches[0]) seekTo(moveEvent.touches[0].clientX);
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      ref={containerRef}
      onClick={handleContainerTap}
      className="relative w-full h-full bg-black select-none overflow-hidden cursor-pointer group"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* ── 1. The Video Element ── */}
      <video
        ref={videoRef}
        src={src}
        loop
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className={`${className} ${
          objectFit === 'contain'
            ? 'object-contain'
            : objectFit === 'fill'
            ? 'object-fill'
            : 'object-cover'
        }`}
      />

      {/* ── 2. Floating On-Screen Controls Overlay (Fades out after 3 seconds) ── */}
      <div
        className={`absolute inset-0 z-10 transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Subtle dark vignette when controls are visible */}
        <div className="absolute inset-0 bg-black/35 pointer-events-none" />

        {/* Center Play / Pause Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
              restartHideTimer();
            }}
            className={`w-16 h-16 rounded-full bg-black/65 hover:bg-black/80 active:scale-90 text-white flex items-center justify-center shadow-2xl transition-all border-0 cursor-pointer ${
              showControls ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-white fill-white" />
            ) : (
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            )}
          </button>
        </div>

        {/* Bottom Controls Strip (Above the progress line) */}
        <div
          className={`absolute bottom-3.5 inset-x-0 px-3 flex items-center justify-between ${
            showControls ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          {/* Time Badge: "0:43 / 1:00" */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              restartHideTimer();
            }}
            className="bg-black/85 backdrop-blur-xs text-white text-[12px] font-semibold px-3 py-1 rounded-full shadow-md tracking-wide"
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          {/* Sound & Fullscreen Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Sound Mute / Unmute Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
                restartHideTimer();
              }}
              className="w-9 h-9 rounded-full bg-black/65 hover:bg-black/85 active:scale-90 text-white flex items-center justify-center shadow-md transition-all border-0 cursor-pointer"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
                restartHideTimer();
              }}
              className="w-9 h-9 rounded-full bg-black/65 hover:bg-black/85 active:scale-90 text-white flex items-center justify-center shadow-md transition-all border-0 cursor-pointer"
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4 text-white" />
              ) : (
                <Maximize className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. ALWAYS VISIBLE Thin Red Progress Line with Red Dot on Bottom Edge ── */}
      <div
        ref={progressBarRef}
        onMouseDown={handleProgressMouseDown}
        onTouchStart={handleProgressTouchStart}
        onClick={(e) => {
          e.stopPropagation();
          seekTo(e.clientX);
          restartHideTimer();
        }}
        className="absolute bottom-0 inset-x-0 h-4.5 flex items-end z-20 cursor-pointer"
        style={{ touchAction: 'none' }}
      >
        {/* Track */}
        <div className="w-full h-[3.5px] bg-white/20 relative">
          {/* Red Progress Fill */}
          <div
            className="h-full bg-[#E50914] relative transition-[width] duration-75"
            style={{ width: `${progressPercent}%` }}
          >
            {/* Red Dot (Thumb) Sitting on the Progress Line (Matches Image 2) */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#E50914] shadow-md pointer-events-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
