'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface FlipTileProps {
  front: React.ReactNode;
  back: React.ReactNode;
  delay?: number;
  interval?: number;
  className?: string;
}

export function FlipTile({ front, back, delay = 2000, interval = 6000, className = '' }: FlipTileProps) {
  const [flipped, setFlipped] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const startFlipping = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setFlipped((prev) => !prev);
    }, interval);
  }, [interval]);

  useEffect(() => {
    const timeout = setTimeout(startFlipping, delay);
    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [delay, startFlipping]);

  return (
    <div
      className={`[perspective:800px] cursor-pointer ${className}`}
      onClick={() => setFlipped((prev) => !prev)}
    >
      <div
        className="relative w-full h-full transition-transform duration-[900ms] [transform-style:preserve-3d]"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden] rounded-[14px] md:rounded-2xl overflow-hidden">
          {front}
        </div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-[14px] md:rounded-2xl overflow-hidden">
          {back}
        </div>
      </div>
    </div>
  );
}

export function PhotoFace({ imageUrl, label }: { imageUrl: string; label?: string }) {
  return (
    <div
      className="w-full h-full bg-cover bg-center flex items-end p-2.5 md:p-4 relative"
      style={{ backgroundImage: `url(${imageUrl})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      {label && (
        <span className="relative z-10 text-[9px] md:text-xs text-white/80 font-medium drop-shadow-md">
          {label}
        </span>
      )}
    </div>
  );
}

export function TributeFace({ content, authorName, relation }: { content: string; authorName: string; relation?: string }) {
  return (
    <div className="w-full h-full flex flex-col justify-center p-3.5 md:p-5 border border-primary/15 rounded-[14px] md:rounded-2xl bg-gradient-to-br from-[#1a1d28] to-[#141720]">
      <div className="text-[9px] md:text-xs text-primary font-semibold tracking-[1.5px] uppercase mb-1.5 md:mb-2">
        Prayer
      </div>
      <p className="font-serif italic text-xs md:text-sm leading-relaxed text-[#e8e0d0] line-clamp-4">
        &ldquo;{content}&rdquo;
      </p>
      <div className="mt-2 md:mt-3 text-[10px] md:text-xs text-muted-foreground">
        &mdash; {authorName}{relation && <>, <span className="text-primary">{relation}</span></>}
      </div>
    </div>
  );
}

export function HighlightFace({ year, title, detail }: { year?: string; title: string; detail?: string }) {
  return (
    <div className="w-full h-full bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/15 rounded-[14px] md:rounded-2xl p-3.5 md:p-5 flex flex-col justify-center">
      {year && (
        <div className="flex items-center gap-1.5 mb-1.5 md:mb-2">
          <span className="text-sm md:text-base">&#10022;</span>
          <span className="text-[10px] md:text-xs text-primary font-semibold">{year}</span>
        </div>
      )}
      <div className="text-[13px] md:text-base font-semibold leading-tight">{title}</div>
      {detail && (
        <div className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2 leading-relaxed line-clamp-3">{detail}</div>
      )}
    </div>
  );
}
