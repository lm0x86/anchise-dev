'use client';

import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  ChevronLeft,
  Send,
  User as UserIcon,
  BadgeCheck,
  Loader2,
  AlertCircle,
  Heart,
  Flower2,
  MapPin,
  Calendar,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { profilesApi, profileContentApi, tributesApi, type Profile, type Tribute } from '@/lib/api';
import { useAuthStore, useAccessToken } from '@/store/auth';
import { toast } from 'sonner';
import { MosaicTab } from './components/mosaic-tab';
import { StoryTab } from './components/story-tab';
import { LegacyTab } from './components/legacy-tab';

type TabId = 'mosaic' | 'story' | 'people' | 'legacy';
const TABS: { id: TabId; label: string }[] = [
  { id: 'mosaic', label: 'Mosaic' },
  { id: 'story', label: 'My Story' },
  { id: 'people', label: 'My People' },
  { id: 'legacy', label: 'Legacy' },
];

function calculateAge(birthDate: string, deathDate: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const death = new Date(deathDate);
  let age = death.getFullYear() - birth.getFullYear();
  const monthDiff = death.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && death.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMMM d, yyyy');
}

function TributeCard({ tribute }: { tribute: Tribute }) {
  const authorName =
    tribute.author.displayName || `${tribute.author.firstName} ${tribute.author.lastName}`;

  return (
    <div className="p-4 md:p-5 bg-card/50 backdrop-blur border border-border/50 rounded-xl">
      <div className="flex items-start gap-3 md:gap-4">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <UserIcon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-medium text-sm md:text-base">{authorName}</span>
            <span className="text-xs md:text-sm text-muted-foreground">
              {format(new Date(tribute.createdAt), 'MMM d, yyyy')}
            </span>
          </div>
          <p className="text-sm md:text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {tribute.content}
          </p>
        </div>
      </div>
    </div>
  );
}

function AddTributeForm({
  profileId,
  onSuccess,
}: {
  profileId: string;
  onSuccess: () => void;
}) {
  const t = useTranslations('profile');
  const token = useAccessToken();
  const { isAuthenticated } = useAuthStore();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !token) return;

    setIsSubmitting(true);
    try {
      await tributesApi.create({ profileId, content: content.trim() }, token);
      setContent('');
      toast.success(t('tributeSubmitted'));
      onSuccess();
    } catch {
      toast.error(t('tributeError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6 bg-card/30 border border-border/50 rounded-xl text-center">
        <Heart className="w-10 h-10 mx-auto mb-3 text-primary/50" />
        <p className="text-muted-foreground mb-4">{t('loginToLeaveCondolence')}</p>
        <Link href="/login">
          <Button variant="outline">{t('signIn')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder={t('tributePlaceholder')}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        maxLength={2000}
        className="resize-none bg-card/50 text-sm md:text-base"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{content.length}/2000</span>
        <Button size="sm" type="submit" disabled={!content.trim() || isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5 mr-1.5" />
          )}
          {t('sendCondolence')}
        </Button>
      </div>
    </form>
  );
}

function HeroSection({ profile }: { profile: Profile }) {
  const t = useTranslations('profile');
  const age = profile.birthDate ? calculateAge(profile.birthDate, profile.deathDate) : null;
  const isVerified = !!profile.partnerId;

  return (
    <section className="relative pt-8 md:pt-12 pb-8 md:pb-12">
      {/* Night sky background */}
      <div
        className="absolute inset-0 bg-center"
        style={{ backgroundImage: "url('/profile/memorial_sky_v3.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background" />

      <div className="relative z-10 container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Avatar */}
          <div className="mb-4 md:mb-6">
            <div className="w-24 h-24 md:w-36 md:h-36 lg:w-44 lg:h-44 rounded-full border-[3px] md:border-4 border-primary overflow-hidden mx-auto shadow-[0_0_40px_rgba(201,169,110,0.15)]">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={`${profile.firstName} ${profile.lastName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                  <span className="text-2xl md:text-5xl lg:text-6xl font-serif font-bold text-primary">
                    {getInitials(profile.firstName, profile.lastName)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Name */}
          <h1 className="font-serif text-2xl md:text-4xl lg:text-5xl font-semibold mb-2 md:mb-3">
            {profile.firstName} {profile.lastName}
          </h1>

          {/* Dates - compact on mobile, full on desktop */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 md:gap-x-6 gap-y-1 text-muted-foreground mb-2 md:mb-3">
            {profile.birthDate && (
              <span className="flex items-center gap-1.5 text-xs md:text-sm">
                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 hidden md:inline-block" />
                <span className="md:hidden">{new Date(profile.birthDate).getFullYear()}</span>
                <span className="hidden md:inline">{formatDate(profile.birthDate)}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs md:text-sm">
              <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 hidden md:inline-block" />
              <span className="md:hidden">
                {profile.birthDate && '– '}{new Date(profile.deathDate).getFullYear()}
              </span>
              <span className="hidden md:inline">{formatDate(profile.deathDate)}</span>
            </span>
            {age !== null && (
              <span className="text-xs md:text-sm">({age} {t('yearsOld')})</span>
            )}
          </div>

          {/* Location */}
          {profile.deathPlaceLabel && (
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-3 md:mb-4">
              <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm">{profile.deathPlaceLabel}</span>
            </div>
          )}

          {/* Epitaph */}
          {profile.epitaph && (
            <p className="font-serif italic text-sm md:text-base lg:text-lg text-primary mb-3 md:mb-4 leading-relaxed max-w-lg mx-auto">
              &ldquo;{profile.epitaph}&rdquo;
            </p>
          )}

          {/* Verified badge */}
          {isVerified && profile.partnerName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-[10px] md:text-xs">
              <BadgeCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
              {t('managedBy', { partner: profile.partnerName })}
            </div>
          )}
        </div>
      </div>

      {/* Decorative divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </section>
  );
}

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <div className="flex border-b border-white/6 sticky top-0 z-30 bg-background max-w-4xl mx-auto w-full">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-2.5 md:py-3.5 text-[11px] md:text-sm border-b-2 transition-all ${
            activeTab === tab.id
              ? 'text-primary font-semibold border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground/70'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations('profile');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('mosaic');
  const tributesRef = useRef<HTMLDivElement>(null);

  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useQuery({
    queryKey: ['profile', slug],
    queryFn: () => profilesApi.get(slug),
    enabled: !!slug,
  });

  const { data: content, isLoading: isLoadingContent } = useQuery({
    queryKey: ['profile-content', profile?.id],
    queryFn: () => profileContentApi.getPublic(profile!.id),
    enabled: !!profile?.id,
  });

  const { data: tributesData } = useQuery({
    queryKey: ['tributes', profile?.id],
    queryFn: () => tributesApi.getByProfile(profile!.id, { limit: 50 }),
    enabled: !!profile?.id,
  });

  const handleTributeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['tributes', profile?.id] });
    queryClient.invalidateQueries({ queryKey: ['profile-content', profile?.id] });
  };

  const scrollToTributes = () => {
    tributesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-xl font-semibold mb-2">{t('notFound')}</h1>
          <p className="text-muted-foreground mb-6">{t('notFoundDescription')}</p>
          <Link href="/board">
            <Button>
              <ChevronLeft className="w-4 h-4 mr-2" />
              {t('backToBoard')}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const tributes = tributesData?.tributes || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Hero - full width */}
      <HeroSection profile={profile} />

      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content - constrained width */}
      <div className="flex-1 max-w-4xl mx-auto w-full">
        {activeTab === 'mosaic' && (
          <div className="animate-in fade-in duration-400">
            {isLoadingContent ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : content ? (
              <MosaicTab
                profile={profile}
                content={content}
                tributeCount={tributes.length}
                onLeaveCondolence={scrollToTributes}
              />
            ) : null}

            {/* Tributes Section */}
            <div ref={tributesRef} className="px-2 md:px-4 pb-8">
              <div className="bg-card/30 border border-border/50 rounded-xl p-4 md:p-6 mb-4">
                <h3 className="font-medium text-sm md:text-base mb-3">{t('shareYourMemory')}</h3>
                <AddTributeForm profileId={profile.id} onSuccess={handleTributeSuccess} />
              </div>

              {tributes.length > 0 && (
                <div className="space-y-3 md:space-y-4">
                  {tributes.map((tribute) => (
                    <TributeCard key={tribute.id} tribute={tribute} />
                  ))}
                </div>
              )}

              {tributes.length === 0 && (
                <div className="text-center py-8 md:py-12 bg-card/30 border border-border/50 rounded-xl">
                  <Flower2 className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 text-primary/30" />
                  <p className="text-muted-foreground text-sm md:text-base">{t('noCondolencesYet')}</p>
                  <p className="text-muted-foreground/60 text-xs md:text-sm mt-1">{t('beFirstToShare')}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'story' && (
          <div className="animate-in fade-in duration-400">
            {isLoadingContent ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : content ? (
              <StoryTab profile={profile} content={content} />
            ) : null}
          </div>
        )}

        {activeTab === 'people' && (
          <div className="animate-in fade-in duration-400 p-4 md:p-6">
            <div className="text-center py-16 md:py-24">
              <div className="text-3xl md:text-4xl mb-3 opacity-30">&#128106;</div>
              <p className="text-muted-foreground text-sm md:text-base font-medium">My People</p>
              <p className="text-muted-foreground/60 text-xs md:text-sm mt-1">Coming soon</p>
            </div>
          </div>
        )}

          {activeTab === 'legacy' && (
            <div className="animate-in fade-in duration-400">
              {isLoadingContent ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : content ? (
                <LegacyTab profile={profile} content={content} />
              ) : null}
            </div>
          )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 md:py-8 text-center">
        <p className="text-muted-foreground text-xs md:text-sm">
          {t('inLovingMemory', { name: `${profile.firstName} ${profile.lastName}` })}
        </p>
        <p className="text-muted-foreground/60 text-[10px] md:text-xs mt-1">
          {t('memorialCreatedWith')}
        </p>
      </footer>
    </div>
  );
}
