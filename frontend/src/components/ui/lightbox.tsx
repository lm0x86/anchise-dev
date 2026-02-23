'use client';

import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LightboxImage {
  src: string;
  alt?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, currentIndex, onClose, onNavigate }: LightboxProps) {
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(currentIndex + 1);
    },
    [onClose, onNavigate, currentIndex, hasPrev, hasNext],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const current = images[currentIndex];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-4 right-4 h-10 w-10 text-white hover:bg-white/10 z-10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {hasPrev && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 text-white hover:bg-white/10 z-10"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
      )}

      {hasNext && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 text-white hover:bg-white/10 z-10"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      )}

      <img
        src={current.src}
        alt={current.alt || ''}
        className="max-w-full max-h-[90vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
