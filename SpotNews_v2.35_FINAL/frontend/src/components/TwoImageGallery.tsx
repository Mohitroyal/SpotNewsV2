import React, { useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TwoImageGalleryProps {
  photos: string[];
  alt?: string;
  className?: string;
  onImageClick?: () => void;
  overlay?: React.ReactNode;
}

export function getClipPhotos(clip: any): string[] {
  if (!clip) return [];
  const cl = clip?.custom_layout || {};
  const cfg = clip?.config || {};

  const candidates = [
    clip?.image_urls,
    cl.imageUrls,
    cl.image_urls,
    cfg.imageUrls,
    cfg.image_urls,
  ];

  let foundList: string[] = [];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) {
      const valid = c.filter(
        (u): u is string =>
          typeof u === 'string' &&
          u.trim().length > 0 &&
          !u.startsWith('data:image/png;base64,iVBORw0KGgo')
      );
      if (valid.length > foundList.length) {
        foundList = valid;
      }
    }
  }

  if (foundList.length > 0) {
    return foundList;
  }

  const single =
    cl.imageUrl ||
    cl.image_url ||
    clip?.image_url ||
    clip?.imageUrl ||
    cfg.imageUrl ||
    clip?.png_url ||
    '';

  return single ? [single] : [];
}

export const TwoImageGallery: React.FC<TwoImageGalleryProps> = ({
  photos,
  alt = 'Spot News',
  className = '',
  onImageClick,
  overlay,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const mouseStartRef = useRef<number | null>(null);

  const validPhotos = photos.filter(Boolean);
  const hasMultiple = validPhotos.length >= 2;
  const currentPhoto = validPhotos[currentIndex] || validPhotos[0] || '';

  // ── Touch Gesture Handlers (Mobile) ─────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!hasMultiple) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    isDraggingRef.current = false;
  }, [hasMultiple]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !hasMultiple) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
      isDraggingRef.current = true;
    }
  }, [hasMultiple]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (hasMultiple && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 35) {
      if (deltaX < 0 && currentIndex === 0) {
        // Swiped left -> show Image 2
        setCurrentIndex(1);
      } else if (deltaX > 0 && currentIndex === 1) {
        // Swiped right -> show Image 1
        setCurrentIndex(0);
      }
    } else if (!isDraggingRef.current && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      onImageClick?.();
    }
    isDraggingRef.current = false;
  }, [hasMultiple, currentIndex, onImageClick]);

  // ── Mouse Drag Handlers (Desktop) ───────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!hasMultiple) return;
    mouseStartRef.current = e.clientX;
    isDraggingRef.current = false;
  }, [hasMultiple]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (mouseStartRef.current === null || !hasMultiple) return;
    const deltaX = e.clientX - mouseStartRef.current;
    if (Math.abs(deltaX) > 10) {
      isDraggingRef.current = true;
    }
  }, [hasMultiple]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (mouseStartRef.current === null) {
      if (!isDraggingRef.current) {
        onImageClick?.();
      }
      return;
    }
    const deltaX = e.clientX - mouseStartRef.current;
    mouseStartRef.current = null;

    if (hasMultiple && Math.abs(deltaX) > 35) {
      if (deltaX < 0 && currentIndex === 0) {
        setCurrentIndex(1);
      } else if (deltaX > 0 && currentIndex === 1) {
        setCurrentIndex(0);
      }
    } else if (!isDraggingRef.current && Math.abs(deltaX) < 10) {
      onImageClick?.();
    }
    isDraggingRef.current = false;
  }, [hasMultiple, currentIndex, onImageClick]);

  if (validPhotos.length === 0) {
    return null;
  }

  // ── Single Image (Preserve existing single-image layout 100%) ──────────────
  if (!hasMultiple) {
    return (
      <div
        className={`w-full h-full relative flex items-center justify-center overflow-hidden bg-black ${className}`}
        onClick={onImageClick}
      >
        <div
          className="absolute inset-0 opacity-40 blur-xl scale-110 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${validPhotos[0]})` }}
        />
        <img
          src={validPhotos[0]}
          alt={alt}
          className="w-full h-full object-contain relative z-10 select-none pointer-events-none"
          loading="lazy"
        />
        {overlay}
      </div>
    );
  }

  // ── Two Images (Horizontal Sliding Gallery with Pagination Dots) ───────────
  return (
    <div
      className={`w-full h-full relative flex items-center justify-center overflow-hidden bg-black select-none ${className}`}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Ambient background blur tracking active image */}
      {currentPhoto && (
        <div
          className="absolute inset-0 opacity-40 blur-xl scale-110 bg-cover bg-center pointer-events-none transition-all duration-300"
          style={{ backgroundImage: `url(${currentPhoto})` }}
        />
      )}

      {/* Sliding Viewport */}
      <div
        className="w-full h-full flex transition-transform duration-300 ease-out relative z-10"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {/* Slide 1 */}
        <div className="w-full h-full shrink-0 flex items-center justify-center relative">
          <img
            src={validPhotos[0]}
            alt={`${alt} - Image 1`}
            className="w-full h-full object-contain pointer-events-none select-none"
            loading="eager"
          />
        </div>

        {/* Slide 2 */}
        <div className="w-full h-full shrink-0 flex items-center justify-center relative">
          <img
            src={validPhotos[1]}
            alt={`${alt} - Image 2`}
            className="w-full h-full object-contain pointer-events-none select-none"
            loading="lazy"
          />
        </div>
      </div>

      {/* Subtle Pagination Indicators (Two Dots) */}
      <div className="absolute z-20 bottom-3 right-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-xs px-2.5 py-1.5 rounded-full border border-white/20 shadow-sm pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex(0);
          }}
          className={`rounded-full transition-all cursor-pointer border-0 p-0 ${
            currentIndex === 0
              ? 'w-2.5 h-2.5 bg-white shadow-xs'
              : 'w-2 h-2 bg-white/40 hover:bg-white/70'
          }`}
          title="Image 1"
          aria-label="View first image"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex(1);
          }}
          className={`rounded-full transition-all cursor-pointer border-0 p-0 ${
            currentIndex === 1
              ? 'w-2.5 h-2.5 bg-white shadow-xs'
              : 'w-2 h-2 bg-white/40 hover:bg-white/70'
          }`}
          title="Image 2"
          aria-label="View second image"
        />
      </div>

      {/* Desktop Navigation Chevrons (Hover/Click) */}
      {currentIndex === 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex(0);
          }}
          className="hidden sm:flex absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white items-center justify-center cursor-pointer transition shadow-md border border-white/20"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {currentIndex === 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex(1);
          }}
          className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white items-center justify-center cursor-pointer transition shadow-md border border-white/20"
          aria-label="Next image"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {overlay}
    </div>
  );
};

