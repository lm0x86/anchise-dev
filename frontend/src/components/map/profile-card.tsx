'use client';

import Link from 'next/link';
import { MapPin, Calendar, ChevronRight } from 'lucide-react';
import type { BoardProfile } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProfileCardProps {
  profile: BoardProfile;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ProfileCard({ profile, isSelected, onClick }: ProfileCardProps) {
  const deathDate = new Date(profile.deathDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      onClick={onClick}
      className={cn(
        'group p-4 rounded-lg border transition-all cursor-pointer',
        isSelected
          ? 'bg-primary/10 border-primary'
          : 'bg-card border-border hover:border-primary/50 hover:bg-accent/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar / Photo */}
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={`${profile.firstName} ${profile.lastName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg font-medium text-muted-foreground">
              {profile.firstName[0]}
              {profile.lastName[0]}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">
            {profile.firstName} {profile.lastName}
          </h3>
          
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>{deathDate}</span>
          </div>

          {profile.deathPlaceLabel && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate">{profile.deathPlaceLabel}</span>
            </div>
          )}
        </div>

        {/* Arrow */}
        <Link
          href={`/profile/${profile.slug}`}
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-primary/10 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
      </div>

      {/* Verified badge */}
      {profile.isVerified && (
        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
          <span className="w-1.5 h-1.5 bg-primary rounded-full" />
          Verified
        </div>
      )}
    </div>
  );
}

