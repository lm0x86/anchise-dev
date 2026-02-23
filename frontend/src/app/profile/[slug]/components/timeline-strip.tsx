'use client';

interface TimelineEvent {
  year: string;
  label: string;
  isEndpoint?: boolean;
}

interface TimelineStripProps {
  events: TimelineEvent[];
}

export function TimelineStrip({ events }: TimelineStripProps) {
  if (events.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-primary/6 to-primary/2 border border-primary/10 rounded-[14px] md:rounded-2xl p-4 md:p-5 mb-2">
      <div className="text-[10px] md:text-xs text-primary font-semibold tracking-[2px] uppercase mb-2.5 md:mb-3">
        Highlights of a Lifetime
      </div>
      <div className="flex">
        {events.map((event, i) => (
          <div key={i} className="flex-1 text-center relative">
            <div
              className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full mx-auto mb-1 relative z-10 ${
                event.isEndpoint ? 'bg-primary' : 'bg-primary/30'
              }`}
            />
            {i < events.length - 1 && (
              <div className="absolute top-[3.5px] md:top-[5px] left-1/2 w-full h-px bg-primary/12" />
            )}
            <div className="text-[8px] md:text-[10px] text-primary font-semibold">{event.year}</div>
            <div className="text-[7px] md:text-[9px] text-muted-foreground mt-0.5 leading-tight">{event.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
