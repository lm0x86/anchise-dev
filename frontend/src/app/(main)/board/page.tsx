'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MapPin, List, Search, Calendar, Loader2, RefreshCw, MapPinned, X } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { ProfileCard } from '@/components/map';
import type { MapBounds } from '@/components/map/board-map';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { profilesApi, type BoardProfile } from '@/lib/api';
import { cn } from '@/lib/utils';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Dynamically import map to avoid SSR issues with Leaflet
const BoardMap = dynamic(
  () => import('@/components/map/board-map').then((mod) => mod.BoardMap),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-[#0F0F12]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    ),
  }
);

type ViewMode = 'map' | 'list';

// Get date 30 days ago in ISO format
function getDateThirtyDaysAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

// Get today's date in ISO format
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

interface UserLocation {
  lat: number;
  lng: number;
}

// Check if new bounds require a fetch (moved significantly outside loaded area)
function shouldFetchForBounds(
  newBounds: MapBounds, 
  loadedBounds: MapBounds | null,
  threshold = 0.3 // 30% outside loaded area triggers fetch
): boolean {
  if (!loadedBounds) return true;
  
  const loadedWidth = loadedBounds.maxLng - loadedBounds.minLng;
  const loadedHeight = loadedBounds.maxLat - loadedBounds.minLat;
  
  // Check if new bounds extend beyond loaded bounds by threshold
  const leftOverflow = loadedBounds.minLng - newBounds.minLng;
  const rightOverflow = newBounds.maxLng - loadedBounds.maxLng;
  const bottomOverflow = loadedBounds.minLat - newBounds.minLat;
  const topOverflow = newBounds.maxLat - loadedBounds.maxLat;
  
  return (
    leftOverflow > loadedWidth * threshold ||
    rightOverflow > loadedWidth * threshold ||
    bottomOverflow > loadedHeight * threshold ||
    topOverflow > loadedHeight * threshold
  );
}

// Merge bounds to create a larger loaded area
function expandBounds(current: MapBounds | null, newBounds: MapBounds): MapBounds {
  if (!current) return newBounds;
  return {
    minLat: Math.min(current.minLat, newBounds.minLat),
    maxLat: Math.max(current.maxLat, newBounds.maxLat),
    minLng: Math.min(current.minLng, newBounds.minLng),
    maxLng: Math.max(current.maxLng, newBounds.maxLng),
  };
}

export default function BoardPage() {
  const t = useTranslations('board');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  
  // Debounced search for backend query
  const debouncedSearch = useDebounce(searchQuery.trim(), 400);
  const isSearchMode = debouncedSearch.length >= 2;
  
  // Date filter - default to last 30 days
  const [dateFrom] = useState(getDateThirtyDaysAgo);
  const [dateTo] = useState(getToday);
  
  // User geolocation
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(true);

  // Accumulated profiles cache (deduped by ID) - for viewport browsing
  const [profileCache, setProfileCache] = useState<Map<string, BoardProfile>>(new Map());
  const [loadedBounds, setLoadedBounds] = useState<MapBounds | null>(null);
  
  // Current viewport bounds for filtering display
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  
  // Bounds to fetch (only set when we need new data)
  const [fetchBounds, setFetchBounds] = useState<MapBounds | null>(null);
  
  // Debounce timer ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Get user's geolocation on mount - browser first, then IP fallback
  useEffect(() => {
    const getIPLocation = async () => {
      try {
        // Free IP geolocation API
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.latitude && data.longitude) {
          setUserLocation({ lat: data.latitude, lng: data.longitude });
        }
      } catch {
        // IP lookup failed, will use world view
        console.warn('IP geolocation failed');
      } finally {
        setIsLocating(false);
      }
    };

    if (!navigator.geolocation) {
      getIPLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        // Browser geolocation denied/failed - try IP
        getIPLocation();
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  }, []);

  // Handle bounds change from map
  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setCurrentBounds(bounds);
    
    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce the fetch decision
    debounceRef.current = setTimeout(() => {
      // Only set fetchBounds if we need new data
      if (shouldFetchForBounds(bounds, loadedBounds)) {
        // Expand the fetch area to preload nearby data
        const latPadding = (bounds.maxLat - bounds.minLat) * 0.5;
        const lngPadding = (bounds.maxLng - bounds.minLng) * 0.5;
        
        setFetchBounds({
          minLat: bounds.minLat - latPadding,
          maxLat: bounds.maxLat + latPadding,
          minLng: bounds.minLng - lngPadding,
          maxLng: bounds.maxLng + lngPadding,
        });
      }
    }, 300);
  }, [loadedBounds]);

  // Fetch profiles when fetchBounds changes (viewport browsing mode)
  const { isLoading: isInitialLoading, isFetching: isFetchingViewport } = useQuery({
    queryKey: ['board-profiles', dateFrom, dateTo, fetchBounds],
    queryFn: async () => {
      if (!fetchBounds) return [];
      
      const response = await profilesApi.getBoard({ 
        limit: 100,
        from: dateFrom,
        to: dateTo,
        minLat: fetchBounds.minLat,
        maxLat: fetchBounds.maxLat,
        minLng: fetchBounds.minLng,
        maxLng: fetchBounds.maxLng,
      });
      
      // Add to cache (accumulate, don't replace)
      setProfileCache(prev => {
        const newCache = new Map(prev);
        response.forEach(profile => {
          newCache.set(profile.id, profile);
        });
        return newCache;
      });
      
      // Expand loaded bounds
      setLoadedBounds(prev => expandBounds(prev, fetchBounds));
      
      return response;
    },
    enabled: !isLocating && fetchBounds !== null && !isSearchMode,
    staleTime: Infinity, // Never consider stale - we manage our own cache
  });

  // Search query - hits backend when user types 2+ characters
  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['board-search', debouncedSearch, dateFrom, dateTo],
    queryFn: async () => {
      const response = await profilesApi.getBoard({ 
        limit: 100,
        from: dateFrom,
        to: dateTo,
        search: debouncedSearch,
      });
      return response;
    },
    enabled: isSearchMode,
    staleTime: 30000, // Cache search results for 30s
  });

  // Trigger initial fetch when location is ready
  useEffect(() => {
    if (!isLocating && currentBounds && fetchBounds === null) {
      setFetchBounds(currentBounds);
    }
  }, [isLocating, currentBounds, fetchBounds]);

  // Get profiles visible in current viewport from cache (browse mode)
  const visibleProfiles = useMemo(() => {
    if (!currentBounds) return Array.from(profileCache.values());
    
    return Array.from(profileCache.values()).filter(profile => {
      if (profile.pinLat === null || profile.pinLng === null) return false;
      return (
        profile.pinLat >= currentBounds.minLat &&
        profile.pinLat <= currentBounds.maxLat &&
        profile.pinLng >= currentBounds.minLng &&
        profile.pinLng <= currentBounds.maxLng
      );
    });
  }, [profileCache, currentBounds]);

  // Display profiles: search results when searching, viewport profiles when browsing
  const displayProfiles = isSearchMode ? searchResults : visibleProfiles;

  // Profiles to show on map: search results when searching, all cached when browsing
  const mapProfiles = isSearchMode ? searchResults : Array.from(profileCache.values());

  // Track location to center map on
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number } | null>(null);

  const handleProfileClick = (profile: BoardProfile) => {
    setSelectedProfileId(profile.id);
    if (profile.pinLat !== null && profile.pinLng !== null) {
      setCenterOn({ lat: profile.pinLat, lng: profile.pinLng });
    }
  };

  const handleRefresh = () => {
    // Clear cache and reload current viewport
    setProfileCache(new Map());
    setLoadedBounds(null);
    if (currentBounds) {
      setFetchBounds({ ...currentBounds });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const isLoading = isSearchMode 
    ? isSearching && searchResults.length === 0
    : isInitialLoading && profileCache.size === 0;
  
  const isFetching = isSearchMode ? isSearching : isFetchingViewport;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />

      {/* Toolbar */}
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Search mode indicator */}
          {isSearchMode && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-sm">
              <Search className="h-4 w-4" />
              <span>Searching all records</span>
            </div>
          )}

          {/* Date filter indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm">
            <Calendar className="h-4 w-4" />
            <span>{t('last30Days')}</span>
          </div>

          {/* Location indicator */}
          {userLocation && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg text-sm">
              <MapPinned className="h-4 w-4" />
              <span>{t('nearYou')}</span>
            </div>
          )}
          {isLocating && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('locating')}</span>
            </div>
          )}

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh all data"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>

          {/* Mobile view toggle */}
          <div className="flex lg:hidden border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                'px-3 py-2 flex items-center gap-2 text-sm transition-colors',
                viewMode === 'map'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">{t('map')}</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-2 flex items-center gap-2 text-sm transition-colors border-l border-border',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">{t('list')}</span>
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
          {isLoading ? (
            t('loading')
          ) : (
            <>
              {t('resultsCount', { count: displayProfiles.length })}
              {!isSearchMode && profileCache.size > displayProfiles.length && (
                <span className="text-xs opacity-60">
                  ({profileCache.size} cached)
                </span>
              )}
              {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map - visible on desktop, toggle on mobile */}
        <div
          className={cn(
            'flex-1 lg:block',
            viewMode === 'map' ? 'block' : 'hidden'
          )}
        >
          <BoardMap
            profiles={mapProfiles}
            selectedProfileId={selectedProfileId}
            centerOn={centerOn}
            onProfileClick={handleProfileClick}
            onBoundsChange={handleBoundsChange}
            userLocation={userLocation}
            className="h-full w-full"
          />
        </div>

        {/* List - sidebar on desktop, full on mobile */}
        <div
          className={cn(
            'w-full lg:w-96 lg:border-l border-border bg-background overflow-y-auto',
            viewMode === 'list' ? 'block' : 'hidden lg:block'
          )}
        >
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-card rounded-lg animate-pulse" />
              ))}
            </div>
          ) : displayProfiles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">{t('noResults')}</p>
              <p className="text-sm mt-1">{isSearchMode ? t('tryDifferentSearch') : t('adjustFilters')}</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {displayProfiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  isSelected={selectedProfileId === profile.id}
                  onClick={() => handleProfileClick(profile)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
