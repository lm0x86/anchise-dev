'use client';

import type { PublicProfileContent, Profile } from '@/lib/api';

interface StoryTabProps {
  profile: Profile;
  content: PublicProfileContent;
}

function yearFromDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).getFullYear().toString();
}

function formatDateRange(date: string, endDate: string | null): string {
  const start = yearFromDate(date);
  if (!endDate) return start;
  const end = yearFromDate(endDate);
  return start === end ? start : `${start}–${end}`;
}

interface TimelineEntry {
  id: string;
  year: string;
  title: string;
  description: string | null;
  mediaUrl: string | null;
  isEndpoint: boolean;
}

export function StoryTab({ profile, content }: StoryTabProps) {
  const { timelineEvents } = content;

  const entries: TimelineEntry[] = [];

  if (profile.birthDate) {
    const location = profile.birthPlaceLabel ? ` in ${profile.birthPlaceLabel}` : '';
    entries.push({
      id: '__birth',
      year: yearFromDate(profile.birthDate),
      title: `Born${location}`,
      description: null,
      mediaUrl: null,
      isEndpoint: true,
    });
  }

  const sorted = [...timelineEvents].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  sorted.forEach((event) => {
    entries.push({
      id: event.id,
      year: formatDateRange(event.date, event.endDate),
      title: event.title,
      description: event.description,
      mediaUrl: event.mediaUrl,
      isEndpoint: false,
    });
  });

  entries.push({
    id: '__death',
    year: yearFromDate(profile.deathDate),
    title: 'Rest in peace',
    description: null,
    mediaUrl: null,
    isEndpoint: true,
  });

  return (
    <div className="p-3 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      {/* Timeline */}
      <section>
        <div className="text-[10px] md:text-xs text-primary font-semibold tracking-[2px] uppercase mb-4 md:mb-5">
          Timeline
        </div>

        <div>
          {entries.map((entry, i) => {
            const isLast = i === entries.length - 1;

            return (
              <div key={entry.id} className="flex gap-3 md:gap-5 lg:gap-6 mb-4 md:mb-6">
                {/* Spine */}
                <div className="flex flex-col items-center w-5 md:w-7 flex-shrink-0">
                  <div
                    className={`w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full border-2 border-background relative z-10 ${
                      entry.isEndpoint
                        ? 'bg-primary shadow-[0_0_0_3px_rgba(201,169,110,0.25)]'
                        : 'bg-primary shadow-[0_0_0_2px_rgba(201,169,110,0.15)]'
                    }`}
                  />
                  {!isLast && (
                    <div className="w-[1.5px] flex-1 bg-primary/12 -mt-px" />
                  )}
                </div>

                {/* Card */}
                <div className="flex-1 bg-card/50 border border-border/50 rounded-[14px] md:rounded-2xl overflow-hidden">
                  {entry.mediaUrl && (
                    <div
                      className="h-[100px] md:h-[160px] lg:h-[200px] bg-cover bg-center relative"
                      style={{ backgroundImage: `url(${entry.mediaUrl})` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
                    </div>
                  )}

                  <div className="p-3 md:p-5 lg:p-6">
                    <div className="text-[10px] md:text-xs text-primary font-semibold">{entry.year}</div>
                    <div className="text-sm md:text-base lg:text-lg font-semibold leading-snug mt-0.5">{entry.title}</div>
                    {entry.description && (
                      <p className="text-[11px] md:text-sm lg:text-base text-muted-foreground mt-1 md:mt-2 leading-relaxed">
                        {entry.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
