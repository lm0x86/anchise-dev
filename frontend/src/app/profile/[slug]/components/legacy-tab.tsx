'use client';

import { useMemo } from 'react';
import { Trophy, Video, MessageCircle } from 'lucide-react';
import type { PublicProfileContent, Profile } from '@/lib/api';

interface LegacyTabProps {
  profile: Profile;
  content: PublicProfileContent;
}

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  GENERAL: { icon: '💬', label: 'General' },
  ON_WORK: { icon: '💡', label: 'On Work' },
  ON_LOVE: { icon: '❤️', label: 'On Love' },
  ON_FAMILY: { icon: '👨‍👩‍👧', label: 'On Family' },
  ON_ADVERSITY: { icon: '🧭', label: 'On Adversity' },
  ON_FRIENDSHIP: { icon: '🤝', label: 'On Friendship' },
  ON_LIFE: { icon: '🌿', label: 'On Life' },
  ON_FAITH: { icon: '🕊️', label: 'On Faith' },
};

function formatYear(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).getFullYear().toString();
}

function formatYearRange(date: string | null, endDate: string | null): string {
  const start = formatYear(date);
  if (!endDate) return start;
  const end = formatYear(endDate);
  return start === end ? start : `${start}–${end}`;
}

export function LegacyTab({ profile, content }: LegacyTabProps) {
  const { quotes, futureMessages, achievements, stats } = content;
  const pronoun = profile.sex === 'FEMALE' ? 'She' : 'He';

  const pinnedMessage = useMemo(
    () => futureMessages.find((m) => m.isPinned) ?? futureMessages[0],
    [futureMessages],
  );

  const adviceMessages = useMemo(
    () => futureMessages.filter((m) => m !== pinnedMessage),
    [futureMessages, pinnedMessage],
  );

  const hasContent = quotes.length > 0 || futureMessages.length > 0 || achievements.length > 0 || stats.length > 0;

  if (!hasContent) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-16 md:py-24">
          <div className="text-4xl md:text-5xl mb-3 opacity-30">🏛️</div>
          <p className="text-muted-foreground text-sm md:text-base font-medium">Legacy</p>
          <p className="text-muted-foreground/60 text-xs md:text-sm mt-1">
            Content will appear here as it&apos;s added.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      {/* Section Intro */}
      <div className="text-center px-4">
        <div className="text-[10px] md:text-xs text-primary font-semibold tracking-[2px] uppercase mb-2">
          What {pronoun} Left Behind
        </div>
        <p className="text-xs md:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
          Lessons, messages, and the wisdom of a lifetime — preserved for those who carry it forward.
        </p>
      </div>

      {/* Pinned Future Message Hero */}
      {pinnedMessage && pinnedMessage.content && (
        <div className="relative bg-gradient-to-br from-primary/8 via-primary/4 to-transparent border border-primary/15 rounded-2xl p-5 md:p-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            {pinnedMessage.videoUrl && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/15 text-primary rounded-full text-[10px] md:text-xs font-medium mb-3">
                <Video className="w-3 h-3" />
                Video Message
              </span>
            )}
            {pinnedMessage.recipientName && (
              <div className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                Message to {pinnedMessage.recipientName}
              </div>
            )}
            <blockquote className="font-serif text-base md:text-xl lg:text-2xl leading-relaxed text-foreground/90">
              &ldquo;{pinnedMessage.content}&rdquo;
            </blockquote>
          </div>
        </div>
      )}

      {/* Life Lessons (Quotes) */}
      {quotes.length > 0 && (
        <section>
          <div className="text-[10px] md:text-xs text-primary font-semibold tracking-[2px] uppercase mb-3 md:mb-4">
            Life Lessons
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
            {quotes.map((quote) => {
              const meta = CATEGORY_META[quote.category] ?? CATEGORY_META.GENERAL;
              return (
                <div
                  key={quote.id}
                  className="bg-card/50 border border-border/50 rounded-xl md:rounded-2xl p-4 md:p-5"
                >
                  <div className="text-xl md:text-2xl mb-2">{meta.icon}</div>
                  <div className="text-xs md:text-sm font-semibold text-foreground/80 mb-1.5">
                    {meta.label}
                  </div>
                  <blockquote className="font-serif text-sm md:text-base text-muted-foreground leading-relaxed italic">
                    &ldquo;{quote.text}&rdquo;
                  </blockquote>
                  {quote.attribution && (
                    <div className="text-[10px] md:text-xs text-muted-foreground/60 mt-2">
                      — {quote.attribution}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <section>
          <div className="text-[10px] md:text-xs text-primary font-semibold tracking-[2px] uppercase mb-3 md:mb-4">
            Achievements
          </div>
          <div className="space-y-2.5 md:space-y-3">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="flex gap-3 md:gap-4 bg-card/50 border border-border/50 rounded-xl md:rounded-2xl p-4 md:p-5"
              >
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm md:text-base font-semibold">{achievement.title}</div>
                    {achievement.date && (
                      <span className="text-[10px] md:text-xs text-primary font-medium flex-shrink-0">
                        {formatYearRange(achievement.date, achievement.endDate)}
                      </span>
                    )}
                  </div>
                  {achievement.description && (
                    <p className="text-[11px] md:text-sm text-muted-foreground mt-1 leading-relaxed">
                      {achievement.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Advice to the Future */}
      {adviceMessages.length > 0 && (
        <section>
          <div className="text-[10px] md:text-xs text-primary font-semibold tracking-[2px] uppercase mb-3 md:mb-4">
            Advice to the Future
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
            {adviceMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-card/50 border border-border/50 rounded-xl md:rounded-2xl p-4 md:p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  <span className="text-xs md:text-sm font-semibold text-foreground/80">
                    {msg.recipientName ? `To ${msg.recipientName}` : 'To Everyone'}
                  </span>
                </div>
                {msg.content && (
                  <blockquote className="font-serif text-sm md:text-base text-muted-foreground leading-relaxed italic">
                    &ldquo;{msg.content}&rdquo;
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stats */}
      {stats.length > 0 && (
        <section>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {stats.map((stat) => (
              <div
                key={stat.id}
                className="bg-card/50 border border-border/50 rounded-xl md:rounded-2xl p-3 md:p-5 text-center"
              >
                <div className="font-serif text-2xl md:text-4xl lg:text-5xl font-bold text-primary">
                  {stat.value}
                </div>
                <div className="text-[10px] md:text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
