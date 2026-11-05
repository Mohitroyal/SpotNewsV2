import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface NewsImageCarouselProps {
  images: string[];
  alt?: string;
  isActive?: boolean;
  postId?: string | number;
}

export const NewsImageCarousel: React.FC<NewsImageCarouselProps> = ({
  images,
  alt = 'News photo',
  isActive = true,
  postId,
}) => {
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const isMouseDown = useRef<boolean>(false);
  const mouseStartX = useRef<number>(0);

  // Reset to first image whenever opening a different post or when post becomes inactive
  useEffect(() => {
    setCurrentImgIndex(0);
    setDragOffset(0);
    setIsDragging(false);
  }, [postId, isActive]);

  const total = images.length;

  const goToImage = useCallback((index: number) => {
    if (index >= 0 && index < total) {
      setCurrentImgIndex(index);
    }
  }, [total]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentImgIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentImgIndex((prev) => Math.min(total - 1, prev + 1));
  }, [total]);

  // Touch event handlers (strictly isolated from parent vertical pager)
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (total <= 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
    setDragOffset(0);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (total <= 1 || !isDragging) return;

    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    // Determine direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (isHorizontalSwipe.current) {
      // Horizontal swipe: prevent parent vertical scroll and isolate gesture
      e.stopPropagation();

      // Apply resistance at edges
      if ((currentImgIndex === 0 && diffX > 0) || (currentImgIndex === total - 1 && diffX < 0)) {
        setDragOffset(diffX * 0.3);
      } else {
        setDragOffset(diffX);
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (total <= 1 || !isDragging) return;

    if (isHorizontalSwipe.current) {
      e.stopPropagation();
      const threshold = 40; // minimum pixels to trigger slide
      if (dragOffset < -threshold && currentImgIndex < total - 1) {
        setCurrentImgIndex((prev) => prev + 1);
      } else if (dragOffset > threshold && currentImgIndex > 0) {
        setCurrentImgIndex((prev) => prev - 1);
      }
    }

    setIsDragging(false);
    setDragOffset(0);
    isHorizontalSwipe.current = null;
  };

  // Mouse drag support for web/desktop testing
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (total <= 1) return;
    isMouseDown.current = true;
    mouseStartX.current = e.clientX;
    setIsDragging(true);
    setDragOffset(0);
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDown.current || total <= 1) return;
    const diffX = e.clientX - mouseStartX.current;
    if ((currentImgIndex === 0 && diffX > 0) || (currentImgIndex === total - 1 && diffX < 0)) {
      setDragOffset(diffX * 0.3);
    } else {
      setDragOffset(diffX);
    }
  };

  const onMouseUp = () => {
    if (!isMouseDown.current) return;
    isMouseDown.current = false;
    const threshold = 40;
    if (dragOffset < -threshold && currentImgIndex < total - 1) {
      setCurrentImgIndex((prev) => prev + 1);
    } else if (dragOffset > threshold && currentImgIndex > 0) {
      setCurrentImgIndex((prev) => prev - 1);
    }
    setIsDragging(false);
    setDragOffset(0);
  };

  // If no images provided
  if (total === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#20252B] text-gray-400">
        <span className="text-xs font-semibold">No Image Available</span>
      </div>
    );
  }

  // Single-image post: render straightforward image without indicators
  if (total === 1) {
    return (
      <div className="w-full h-full relative overflow-hidden bg-[#20252B]">
        <img
          src={images[0]}
          alt={alt}
          className="w-full h-full object-cover"
          loading="eager"
        />
      </div>
    );
  }

  // Multiple-image post: full horizontally swipeable carousel
  return (
    <div
      className="w-full h-full relative overflow-hidden bg-[#20252B] select-none touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* ── Slides Container (Horizontally positioned with CSS transform) ── */}
      <div
        className="w-full h-full flex"
        style={{
          transform: `translateX(calc(-${currentImgIndex * 100}% + ${dragOffset}px))`,
          transition: isDragging ? 'none' : 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {images.map((imgUrl, idx) => (
          <div
            key={`${imgUrl}-${idx}`}
            className="w-full h-full flex-shrink-0 relative overflow-hidden"
          >
            <img
              src={imgUrl}
              alt={`${alt} - ${idx + 1}`}
              className="w-full h-full object-cover pointer-events-none"
              loading={Math.abs(currentImgIndex - idx) <= 1 ? 'eager' : 'lazy'}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* ── Counter: "1 / 2" Badge (Visible only for multiple images) ── */}
      <div className="absolute top-2.5 left-2.5 z-20 bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-white/20 shadow-xs pointer-events-none select-none tracking-wider flex items-center gap-1">
        <span>{currentImgIndex + 1} / {total}</span>
      </div>

      {/* ── Desktop/Click Arrow Controls (Subtle, accessible) ── */}
      {currentImgIndex > 0 && (
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-xs transition-opacity cursor-pointer border-0"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-4 h-4 text-white" strokeWidth={2.5} />
        </button>
      )}

      {currentImgIndex < total - 1 && (
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center backdrop-blur-xs transition-opacity cursor-pointer border-0"
          aria-label="Next image"
        >
          <ChevronRight className="w-4 h-4 text-white" strokeWidth={2.5} />
        </button>
      )}

      {/* ── Pagination Dots (Visible only for multiple images) ── */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-xs pointer-events-auto">
        {images.map((_, dotIdx) => (
          <button
            key={dotIdx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToImage(dotIdx);
            }}
            className={`rounded-full transition-all duration-200 cursor-pointer p-0 border-0 ${
              dotIdx === currentImgIndex
                ? 'w-4 h-1.5 bg-white shadow-xs'
                : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
            }`}
            aria-label={`Go to image ${dotIdx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
