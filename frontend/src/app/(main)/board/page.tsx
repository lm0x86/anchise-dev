'use client';

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MapPin, List, Search, Calendar, Loader2, RefreshCw, MapPinned, X, Navigation, SlidersHorizontal } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { ProfileCard } from '@/components/map';
import type { MapBounds, MapPosition } from '@/components/map/board-map';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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

// Date range options
type DateRangeKey = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string; days: number | null }[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '1y', label: 'Last year', days: 365 },
  { key: 'all', label: 'All time', days: null },
  { key: 'custom', label: 'Custom range', days: null },
];

// Get date N days ago in ISO format
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
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

interface GeocodeSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

// Geocode a place name using Nominatim (OpenStreetMap)
async function geocodePlace(query: string): Promise<GeocodeSuggestion[]> {
  if (!query || query.length < 2) return [];
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
      { headers: { 'Accept-Language': 'en' } }
    );
    return await response.json();
  } catch {
    return [];
  }
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

function BoardPageContent() {
  const t = useTranslations('board');
  const searchParams = useSearchParams();
  
  // Parse URL params for initial state
  const getUrlParam = (key: string) => searchParams.get(key);
  
  // Initialize state from URL
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = getUrlParam('view');
    return v === 'list' ? 'list' : 'map';
  });
  const [searchQuery, setSearchQuery] = useState(() => getUrlParam('q') || '');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => getUrlParam('profile'));
  
  // Debounced search for backend query
  const debouncedSearch = useDebounce(searchQuery.trim(), 400);
  const isSearchMode = debouncedSearch.length >= 2;
  
  // Date filter - default to last 30 days
  const [dateRange, setDateRange] = useState<DateRangeKey>(() => {
    const dr = getUrlParam('dateRange');
    if (dr && DATE_RANGE_OPTIONS.some(o => o.key === dr)) {
      return dr as DateRangeKey;
    }
    return '30d';
  });
  const [customDateFrom, setCustomDateFrom] = useState<string>(() => getUrlParam('from') || '');
  const [customDateTo, setCustomDateTo] = useState<string>(() => getUrlParam('to') || '');
  
  // Map position from URL for initial view
  const [initialMapPosition] = useState<MapPosition | null>(() => {
    const lat = getUrlParam('lat');
    const lng = getUrlParam('lng');
    const zoom = getUrlParam('zoom');
    if (lat && lng && zoom) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      const zoomNum = parseInt(zoom, 10);
      if (!isNaN(latNum) && !isNaN(lngNum) && !isNaN(zoomNum)) {
        return { lat: latNum, lng: lngNum, zoom: zoomNum };
      }
    }
    return null;
  });
  
  // Compute actual date values from range
  const dateFilter = useMemo(() => {
    if (dateRange === 'custom') {
      return {
        from: customDateFrom || undefined,
        to: customDateTo || undefined,
      };
    }
    const option = DATE_RANGE_OPTIONS.find(o => o.key === dateRange);
    if (!option || option.days === null) {
      return { from: undefined, to: undefined };
    }
    return {
      from: getDateDaysAgo(option.days),
      to: getToday(),
    };
  }, [dateRange, customDateFrom, customDateTo]);
  
  // Check if non-default filters are active
  const hasActiveFilters = useMemo(() => {
    return dateRange !== '30d';
  }, [dateRange]);
  
  // Current map position for URL sync (null until user interacts with map)
  const [mapPosition, setMapPosition] = useState<MapPosition | null>(null);
  const urlUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef(true);
  
  // Sync state changes to URL (debounced)
  useEffect(() => {
    // Skip initial mount to avoid overwriting URL with initial state
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    
    // Clear any pending update
    if (urlUpdateTimerRef.current) {
      clearTimeout(urlUpdateTimerRef.current);
    }
    
    urlUpdateTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      
      // Build updates - only include map position if user has moved the map
      const updates: Record<string, string | null> = {
        view: viewMode === 'list' ? 'list' : null,
        q: searchQuery || null,
        dateRange: dateRange !== '30d' ? dateRange : null,
        from: dateRange === 'custom' && customDateFrom ? customDateFrom : null,
        to: dateRange === 'custom' && customDateTo ? customDateTo : null,
        profile: selectedProfileId || null,
      };
      
      // Only update map position if we have one (user has interacted)
      if (mapPosition) {
        updates.lat = mapPosition.lat.toFixed(4);
        updates.lng = mapPosition.lng.toFixed(4);
        updates.zoom = mapPosition.zoom.toString();
      }
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      
      const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
      window.history.replaceState(null, '', newUrl);
    }, 500);
    
    return () => {
      if (urlUpdateTimerRef.current) {
        clearTimeout(urlUpdateTimerRef.current);
      }
    };
  }, [viewMode, searchQuery, dateRange, customDateFrom, customDateTo, selectedProfileId, mapPosition]);
  
  // Handle map move - update position state (only called after user interaction)
  const handleMapMove = useCallback((position: MapPosition) => {
    setMapPosition(position);
  }, []);
  
  // User geolocation
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  
  // Location search
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);

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
    queryKey: ['board-profiles', dateFilter.from, dateFilter.to, fetchBounds],
    queryFn: async () => {
      if (!fetchBounds) return [];
      
      const response = await profilesApi.getBoard({ 
        limit: 100,
        from: dateFilter.from,
        to: dateFilter.to,
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
    queryKey: ['board-search', debouncedSearch, dateFilter.from, dateFilter.to],
    queryFn: async () => {
      const response = await profilesApi.getBoard({ 
        limit: 100,
        from: dateFilter.from,
        to: dateFilter.to,
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

  // Track location to center map on (with optional zoom)
  const [centerOn, setCenterOn] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  
  // Trigger counter to force popup re-open on same profile click
  const [popupTrigger, setPopupTrigger] = useState(0);

  const handleProfileClick = (profile: BoardProfile) => {
    setSelectedProfileId(profile.id);
    setPopupTrigger(prev => prev + 1); // Always increment to trigger popup
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

  // Handle date range change - clear cache when filter changes
  const handleDateRangeChange = (value: DateRangeKey) => {
    setDateRange(value);
    setProfileCache(new Map());
    setLoadedBounds(null);
    if (currentBounds) {
      setFetchBounds({ ...currentBounds });
    }
  };

  // Clear cache when custom dates change
  const debouncedCustomDateFrom = useDebounce(customDateFrom, 500);
  const debouncedCustomDateTo = useDebounce(customDateTo, 500);
  
  useEffect(() => {
    if (dateRange === 'custom') {
      setProfileCache(new Map());
      setLoadedBounds(null);
      if (currentBounds) {
        setFetchBounds({ ...currentBounds });
      }
    }
  }, [dateRange, debouncedCustomDateFrom, debouncedCustomDateTo, currentBounds]);

  // Debounced location search
  const debouncedLocationQuery = useDebounce(locationQuery.trim(), 400);
  
  // Fetch location suggestions
  useEffect(() => {
    if (debouncedLocationQuery.length < 2) {
      setLocationSuggestions([]);
      return;
    }
    
    setIsGeocodingLocation(true);
    geocodePlace(debouncedLocationQuery)
      .then(setLocationSuggestions)
      .finally(() => setIsGeocodingLocation(false));
  }, [debouncedLocationQuery]);

  // Handle selecting a location suggestion
  const handleSelectLocation = (suggestion: GeocodeSuggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    
    // Calculate zoom based on bounding box size
    const [south, north, west, east] = suggestion.boundingbox.map(parseFloat);
    const latSpan = north - south;
    const lngSpan = east - west;
    const maxSpan = Math.max(latSpan, lngSpan);
    
    // Estimate zoom level (rough approximation)
    let zoom = 10; // Default for cities
    if (maxSpan > 10) zoom = 5;      // Countries
    else if (maxSpan > 3) zoom = 7;  // Regions
    else if (maxSpan > 1) zoom = 9;  // Large cities
    else if (maxSpan > 0.3) zoom = 11; // Cities
    else zoom = 13; // Neighborhoods
    
    setCenterOn({ lat, lng, zoom });
    setLocationQuery('');
    setShowLocationSuggestions(false);
  };

  // Close location suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationInputRef.current && !locationInputRef.current.contains(e.target as Node)) {
        setShowLocationSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          {/* Profile search */}
          <div className="relative flex-1 max-w-sm">
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

          {/* Location search */}
          <div className="relative hidden md:block" ref={locationInputRef}>
            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Go to location..."
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              className="pl-10 pr-10 w-[200px]"
            />
            {isGeocodingLocation && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
            {locationQuery && !isGeocodingLocation && (
              <button
                onClick={() => {
                  setLocationQuery('');
                  setLocationSuggestions([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            
            {/* Location suggestions dropdown */}
            {showLocationSuggestions && locationSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                {locationSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectLocation(suggestion)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors truncate"
                  >
                    {suggestion.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Search mode indicator */}
          {isSearchMode && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-sm">
              <Search className="h-4 w-4" />
              <span>Searching all records</span>
            </div>
          )}

          {/* Date filter dropdown */}
          <div className="hidden sm:flex items-center gap-2">
            <Calendar className={cn('h-4 w-4', hasActiveFilters ? 'text-primary' : 'text-muted-foreground')} />
            <Select value={dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className={cn('w-[140px] h-9', hasActiveFilters && 'border-primary')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Custom date inputs */}
            {dateRange === 'custom' && (
              <>
                <Input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-[130px] h-9"
                  placeholder="From"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-[130px] h-9"
                  placeholder="To"
                />
              </>
            )}
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

          {/* Mobile filters button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="sm:hidden relative">
                <SlidersHorizontal className={cn('h-4 w-4', hasActiveFilters && 'text-primary')} />
                {hasActiveFilters && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-4">
                {/* Mobile Location search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Go to location</label>
                  <div className="relative">
                    <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search location..."
                      value={locationQuery}
                      onChange={(e) => {
                        setLocationQuery(e.target.value);
                        setShowLocationSuggestions(true);
                      }}
                      className="pl-10"
                    />
                  </div>
                  {/* Mobile location suggestions */}
                  {showLocationSuggestions && locationSuggestions.length > 0 && (
                    <div className="bg-muted rounded-lg overflow-hidden">
                      {locationSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectLocation(suggestion)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-card transition-colors truncate"
                        >
                          {suggestion.display_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mobile Date filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Date range</label>
                  <Select value={dateRange} onValueChange={handleDateRangeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_RANGE_OPTIONS.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom date range inputs */}
                {dateRange === 'custom' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">From</label>
                      <Input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">To</label>
                      <Input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {/* Location status */}
                {userLocation && (
                  <div className="flex items-center gap-2 text-sm text-blue-500">
                    <MapPinned className="h-4 w-4" />
                    <span>{t('nearYou')}</span>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

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
            popupTrigger={popupTrigger}
            centerOn={centerOn}
            initialPosition={initialMapPosition}
            onProfileClick={handleProfileClick}
            onBoundsChange={handleBoundsChange}
            onMapMove={handleMapMove}
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

// Wrapper with Suspense for useSearchParams
export default function BoardPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-screen bg-background">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    }>
      <BoardPageContent />
    </Suspense>
  );
}
