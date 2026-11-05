import React, { useLayoutEffect, useRef } from 'react';

/**
 * Shrinks its content (zoom) until it fits the box, so a card never needs its own scrolling.
 * One swipe on the feed then always moves to the next card.
 */
export const FitBox: React.FC<{
  className?: string;
  style?: React.CSSProperties;
  innerClassName?: string;
  min?: number;
  children: React.ReactNode;
}> = ({ className = '', style, innerClassName = '', min = 0.68, children }) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let z = 1;
        (i.style as any).zoom = '1';
        const room = o.clientHeight;
        if (!room) return;
        while (i.scrollHeight * z > room + 1 && z > min) {
          z = Math.max(min, z - 0.03);
          (i.style as any).zoom = String(z);
        }
      });
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(o);
    i.querySelectorAll('img').forEach((img) => img.addEventListener('load', fit, { once: true }));
    (document as any).fonts?.ready?.then(fit).catch(() => {});
    return () => { ro?.disconnect(); cancelAnimationFrame(frame); };
  });

  return (
    <div ref={outer} className={`overflow-hidden ${className}`} style={style}>
      <div ref={inner} className={innerClassName}>{children}</div>
    </div>
  );
};
