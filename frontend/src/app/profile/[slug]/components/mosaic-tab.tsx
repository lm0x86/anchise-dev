'use client';

import { useMemo } from 'react';
import { FlipTile, PhotoFace, TributeFace, HighlightFace } from './flip-tile';
import { TimelineStrip } from './timeline-strip';
import type { PublicProfileContent, Tribute, Profile } from '@/lib/api';

interface MosaicTabProps {
  profile: Profile;
  content: PublicProfileContent;
  tributeCount: number;
  onLeaveCondolence: () => void;
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function yearFromDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).getFullYear().toString();
}

type BackFaceData =
  | { type: 'tribute'; tribute: Tribute }
  | { type: 'highlight'; title: string; year?: string; detail?: string }
  | { type: 'achievement'; title: string; year?: string; detail?: string };

export function MosaicTab({ profile, content, tributeCount, onLeaveCondolence }: MosaicTabProps) {
  const { timelineEvents, media, values, achievements, tributes } = content;

  const photos = useMemo(() => shuffled(media.filter((m) => m.type === 'IMAGE')), [media]);
  const featuredEvents = useMemo(() => timelineEvents.filter((e) => e.isFeatured), [timelineEvents]);

  const backFaces = useMemo<BackFaceData[]>(() => {
    const items: BackFaceData[] = [];
    tributes.forEach((t) => items.push({ type: 'tribute', tribute: t }));
    featuredEvents.forEach((e) =>
      items.push({
        type: 'highlight',
        title: e.title,
        year: yearFromDate(e.date),
        detail: e.description ?? undefined,
      }),
    );
    achievements.forEach((a) =>
      items.push({
        type: 'achievement',
        title: a.title,
        year: yearFromDate(a.date),
        detail: a.description ?? undefined,
      }),
    );
    return shuffled(items);
  }, [tributes, featuredEvents, achievements]);

  const renderBackFace = (data: BackFaceData) => {
    switch (data.type) {
      case 'tribute': {
        const t = data.tribute;
        const name = t.author.displayName || `${t.author.firstName} ${t.author.lastName}`;
        return <TributeFace content={t.content} authorName={name} />;
      }
      case 'highlight':
        return <HighlightFace year={data.year} title={data.title} detail={data.detail} />;
      case 'achievement':
        return <HighlightFace year={data.year} title={data.title} detail={data.detail} />;
    }
  };

  const timelineData = useMemo(() => {
    const events: { year: string; label: string; isEndpoint?: boolean }[] = [];

    if (profile.birthDate) {
      events.push({
        year: yearFromDate(profile.birthDate),
        label: 'Born',
        isEndpoint: true,
      });
    }

    featuredEvents.forEach((e) => {
      events.push({
        year: yearFromDate(e.date),
        label: e.title,
      });
    });

    events.push({
      year: yearFromDate(profile.deathDate),
      label: 'Rest in peace',
      isEndpoint: true,
    });

    return events;
  }, [profile.birthDate, profile.deathDate, featuredEvents]);

  const hasPhotos = photos.length > 0;
  const hasBackContent = backFaces.length > 0;
  const hasHighlights = featuredEvents.length > 0 || achievements.length > 0;

  let photoIdx = 0;
  let backIdx = 0;
  const nextPhoto = () => photos[photoIdx++ % photos.length];
  const nextBack = () => backFaces[backIdx++ % backFaces.length];

  const getFlipTile = (heightClass: string, delayMs: number, intervalMs: number) => {
    if (!hasPhotos) return null;
    const photo = nextPhoto();
    const back = hasBackContent ? nextBack() : null;

    return (
      <FlipTile
        className={heightClass}
        delay={delayMs}
        interval={intervalMs}
        front={<PhotoFace imageUrl={photo.url} label={photo.caption ?? undefined} />}
        back={
          back ? (
            renderBackFace(back)
          ) : (
            <PhotoFace imageUrl={photos[(photoIdx) % photos.length]?.url ?? photo.url} />
          )
        }
      />
    );
  };

  const getHighlightTile = (heightClass: string) => {
    const item = featuredEvents[photoIdx % Math.max(featuredEvents.length, 1)] ||
                 achievements[0];
    if (!item) return null;
    const isTimeline = 'isFeatured' in item;
    return (
      <div className={heightClass}>
        <HighlightFace
          year={yearFromDate(isTimeline ? item.date : (item as typeof achievements[0]).date)}
          title={item.title}
          detail={item.description ?? undefined}
        />
      </div>
    );
  };

  return (
    <div className="p-2 md:p-4 lg:p-6 space-y-2 md:space-y-3 lg:space-y-4">
      {/* Mosaic Grid */}
      {hasPhotos && (
        <>
          {/* Row 1: 1.3fr + 1fr */}
          <div className="grid gap-2 md:gap-3" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
            {getFlipTile('h-[160px] md:h-[220px] lg:h-[260px]', 2000, 6000)}
            {hasHighlights
              ? getHighlightTile('h-[160px] md:h-[220px] lg:h-[260px]')
              : getFlipTile('h-[160px] md:h-[220px] lg:h-[260px]', 4000, 7000)}
          </div>

          {/* Row 2: 1fr + 1.3fr (highlight + stacked photos) */}
          {photos.length >= 3 && (
            <div className="grid gap-2 md:gap-3" style={{ gridTemplateColumns: '1fr 1.3fr' }}>
              {hasHighlights && achievements.length > 0 ? (
                <div className="h-[180px] md:h-[240px] lg:h-[280px]">
                  <HighlightFace
                    year={yearFromDate(achievements[0]?.date)}
                    title={achievements[0]?.title ?? ''}
                    detail={achievements[0]?.description ?? undefined}
                  />
                </div>
              ) : (
                getFlipTile('h-[180px] md:h-[240px] lg:h-[280px]', 3000, 7000)
              )}
              <div className="flex flex-col gap-2 md:gap-3 h-[180px] md:h-[240px] lg:h-[280px]">
                {getFlipTile('flex-1', 4500, 7000)}
                {getFlipTile('flex-1', 7000, 6500)}
              </div>
            </div>
          )}

          {/* Row 3: three equal */}
          {photos.length >= 5 && (
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {getFlipTile('h-[120px] md:h-[180px] lg:h-[200px]', 3000, 8000)}
              {hasHighlights && featuredEvents.length > 1 ? (
                <div className="h-[120px] md:h-[180px] lg:h-[200px]">
                  <HighlightFace
                    year={yearFromDate(featuredEvents[1]?.date)}
                    title={featuredEvents[1]?.title ?? ''}
                  />
                </div>
              ) : (
                getFlipTile('h-[120px] md:h-[180px] lg:h-[200px]', 5000, 7000)
              )}
              {getFlipTile('h-[120px] md:h-[180px] lg:h-[200px]', 5500, 7500)}
            </div>
          )}
        </>
      )}

      {/* Timeline Strip */}
      {timelineData.length >= 2 && <TimelineStrip events={timelineData} />}

      {/* Row 4: two equal (after timeline) */}
      {hasPhotos && photos.length >= 7 && (
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          {getFlipTile('h-[140px] md:h-[200px] lg:h-[220px]', 6000, 6000)}
          {getFlipTile('h-[140px] md:h-[200px] lg:h-[220px]', 8500, 7000)}
        </div>
      )}

      {/* Values Section */}
      {values.length > 0 && (
        <div className="bg-gradient-to-br from-[rgba(91,122,61,0.06)] to-[rgba(91,122,61,0.02)] border border-[rgba(91,122,61,0.12)] rounded-[14px] p-3.5 md:p-5">
          <div className="text-[10px] md:text-xs font-semibold tracking-[2px] uppercase mb-2.5 md:mb-3 text-[#a8c88a]">
            {profile.sex === 'FEMALE' ? 'Her' : 'His'} Values
          </div>
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {values.map((v) => (
              <span
                key={v.id}
                className="px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-[rgba(91,122,61,0.08)] border border-[rgba(91,122,61,0.15)] text-[10px] md:text-xs text-[#a8c88a] font-medium"
              >
                {v.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prayer/Tribute CTA */}
      <div className="flex items-center justify-between bg-primary/6 border border-primary/10 rounded-[14px] px-4 md:px-6 py-3 md:py-4">
        <div>
          <div className="text-[11px] md:text-sm text-muted-foreground">Prayers &amp; Tributes</div>
          <div className="font-serif text-xl md:text-2xl font-bold text-primary">{tributeCount}</div>
        </div>
        <button
          onClick={onLeaveCondolence}
          className="px-5 py-2.5 md:px-6 md:py-3 rounded-3xl bg-primary text-primary-foreground text-xs md:text-sm font-bold flex items-center gap-1.5 shadow-[0_4px_15px_rgba(201,169,110,0.25)] hover:brightness-110 transition"
        >
          Leave a Prayer
        </button>
      </div>

      {/* Empty state when no content */}
      {!hasPhotos && !hasHighlights && values.length === 0 && tributes.length === 0 && (
        <div className="text-center py-16 md:py-24">
          <div className="text-4xl md:text-5xl mb-3 opacity-30">&#128367;</div>
          <p className="text-muted-foreground text-sm md:text-base">This memorial is being prepared.</p>
          <p className="text-muted-foreground/60 text-xs md:text-sm mt-1">Content will appear here as it&apos;s added.</p>
        </div>
      )}
    </div>
  );
}
