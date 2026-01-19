'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import Link from 'next/link';
import { 
  MapPin, 
  Calendar, 
  Heart, 
  ChevronLeft, 
  Send,
  User as UserIcon,
  BadgeCheck,
  Loader2,
  AlertCircle,
  Share2,
  Copy,
  Flower2,
  BookOpen,
  Image as ImageIcon,
  Clock,
  Church,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { profilesApi, tributesApi, type Profile, type Tribute } from '@/lib/api';
import { useAuthStore, useAccessToken } from '@/store/auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const authorName = tribute.author.displayName || 
    `${tribute.author.firstName} ${tribute.author.lastName}`;
  
  return (
    <div className="p-5 bg-card/50 backdrop-blur border border-border/50 rounded-xl">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <UserIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-medium">{authorName}</span>
            <span className="text-sm text-muted-foreground">
              {format(new Date(tribute.createdAt), 'MMM d, yyyy')}
            </span>
          </div>
          <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {tribute.content}
          </p>
        </div>
      </div>
    </div>
  );
}

function AddTributeForm({ profileId, onSuccess }: { profileId: string; onSuccess: () => void }) {
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
    } catch (error) {
      toast.error(t('tributeError'));
      console.error('Failed to submit tribute:', error);
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        placeholder={t('tributePlaceholder')}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        maxLength={2000}
        className="resize-none bg-card/50"
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {content.length}/2000
        </span>
        <Button type="submit" disabled={!content.trim() || isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          {t('sendCondolence')}
        </Button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations('profile');
  const queryClient = useQueryClient();

  // Fetch profile
  const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['profile', slug],
    queryFn: () => profilesApi.get(slug),
    enabled: !!slug,
  });

  // Fetch tributes
  const { data: tributesData, isLoading: isLoadingTributes } = useQuery({
    queryKey: ['tributes', profile?.id],
    queryFn: () => tributesApi.getByProfile(profile!.id, { limit: 50 }),
    enabled: !!profile?.id,
  });

  const handleTributeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['tributes', profile?.id] });
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.firstName} ${profile?.lastName} - Memorial`,
          url,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success(t('linkCopied'));
    }
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

  const age = profile.birthDate ? calculateAge(profile.birthDate, profile.deathDate) : null;
  const tributes = tributesData?.tributes || [];
  const isVerified = !!profile.partnerId;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/5 via-primary/10 to-background pt-8 pb-24">
        {/* Back button */}
        <div className="container mx-auto px-4 mb-8">
          <Link 
            href="/board" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t('backToBoard')}
          </Link>
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Photo */}
            <div className="mb-6">
              {profile.photoUrl ? (
                <img 
                  src={profile.photoUrl} 
                  alt={`${profile.firstName} ${profile.lastName}`}
                  className="w-40 h-40 md:w-48 md:h-48 rounded-full object-cover border-4 border-background shadow-2xl mx-auto"
                />
              ) : (
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full bg-card border-4 border-background shadow-2xl flex items-center justify-center mx-auto">
                  <span className="text-5xl md:text-6xl font-serif text-primary">
                    {getInitials(profile.firstName, profile.lastName)}
                  </span>
                </div>
              )}
            </div>

            {/* Name */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-semibold mb-3">
              {profile.firstName} {profile.lastName}
            </h1>

            {/* Dates */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-muted-foreground mb-4">
              {profile.birthDate && (
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(profile.birthDate)}
                </span>
              )}
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(profile.deathDate)}
              </span>
              {age !== null && (
                <span className="text-sm">({age} {t('yearsOld')})</span>
              )}
            </div>

            {/* Location */}
            {profile.deathPlaceLabel && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-6">
                <MapPin className="w-4 h-4" />
                {profile.deathPlaceLabel}
              </div>
            )}

            {/* Verified badge */}
            {isVerified && profile.partnerName && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm mb-6">
                <BadgeCheck className="w-4 h-4" />
                {t('managedBy', { partner: profile.partnerName })}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                {t('shareMemorial')}
              </Button>
              <a href="#tributes">
                <Button>
                  <Flower2 className="w-4 h-4 mr-2" />
                  {t('leaveCondolence')}
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Decorative divider */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-12">

          {/* Life Story / Obituary */}
          {profile.obituary && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-serif font-semibold">{t('lifeStory')}</h2>
              </div>
              <div className="bg-card/50 border border-border/50 rounded-xl p-6 md:p-8">
                <div className="prose prose-invert prose-lg max-w-none">
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed text-lg">
                    {profile.obituary}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Service Details */}
          {profile.serviceDetails && Object.keys(profile.serviceDetails).length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Church className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-serif font-semibold">{t('serviceDetails')}</h2>
              </div>
              <div className="bg-card/50 border border-border/50 rounded-xl p-6 md:p-8">
                {/* For now, display as formatted JSON - can be enhanced later */}
                <div className="space-y-4">
                  {Object.entries(profile.serviceDetails).map(([key, value]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                      <span className="text-muted-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Photo Gallery Placeholder */}
          {!profile.obituary && !profile.serviceDetails && (
            <section className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <ImageIcon className="w-8 h-8 text-primary/50" />
              </div>
              <h3 className="text-lg font-medium mb-2">{t('helpBuildMemorial')}</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {t('helpBuildMemorialDescription')}
              </p>
            </section>
          )}

          {/* Tributes Section */}
          <section id="tributes">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-2xl font-serif font-semibold">
                {t('condolences')}
                {tributes.length > 0 && (
                  <span className="text-lg font-normal text-muted-foreground ml-2">
                    ({tributes.length})
                  </span>
                )}
              </h2>
            </div>

            {/* Add tribute form */}
            <div className="bg-card/30 border border-border/50 rounded-xl p-6 mb-6">
              <h3 className="font-medium mb-4">{t('shareYourMemory')}</h3>
              <AddTributeForm profileId={profile.id} onSuccess={handleTributeSuccess} />
            </div>

            {/* Tributes list */}
            {isLoadingTributes ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : tributes.length === 0 ? (
              <div className="text-center py-12 bg-card/30 border border-border/50 rounded-xl">
                <Flower2 className="w-12 h-12 mx-auto mb-3 text-primary/30" />
                <p className="text-muted-foreground">{t('noCondolencesYet')}</p>
                <p className="text-sm text-muted-foreground/70">{t('beFirstToShare')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tributes.map((tribute) => (
                  <TributeCard key={tribute.id} tribute={tribute} />
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            {t('inLovingMemory', { name: `${profile.firstName} ${profile.lastName}` })}
          </p>
          <p className="text-muted-foreground/60 text-xs mt-2">
            {t('memorialCreatedWith')}
          </p>
        </div>
      </footer>
    </div>
  );
}
