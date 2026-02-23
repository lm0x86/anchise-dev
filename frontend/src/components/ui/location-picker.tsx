'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import 'leaflet/dist/leaflet.css';

interface GeocodeSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

async function geocodePlace(query: string): Promise<GeocodeSuggestion[]> {
  if (!query || query.length < 2) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
      { headers: { 'Accept-Language': 'en' } },
    );
    return await res.json();
  } catch {
    return [];
  }
}

export interface LocationValue {
  label: string;
  lat: number | null;
  lng: number | null;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  disabled?: boolean;
}

export function LocationPicker({ value, onChange, disabled }: LocationPickerProps) {
  const [query, setQuery] = useState(value.label);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    setQuery(value.label);
  }, [value.label]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize mini map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapContainerRef.current) return;

      const lat = value.lat ?? 46.5;
      const lng = value.lng ?? 2.5;
      const zoom = value.lat ? 12 : 3;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
      }).setView([lat, lng], zoom);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      if (value.lat && value.lng) {
        markerRef.current = L.marker([value.lat, value.lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:12px;height:12px;background:#C9A96E;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
        }).addTo(map);
      }

      map.on('click', (e: any) => {
        if (disabled) return;
        const { lat: newLat, lng: newLng } = e.latlng;
        updateMarker(map, newLat, newLng);
        onChange({ label: value.label, lat: newLat, lng: newLng });
        reverseGeocode(newLat, newLng);
      });

      mapRef.current = map;

      setTimeout(() => map.invalidateSize(), 100);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateMarker(map: any, lat: number, lng: number) {
    import('leaflet').then(({ default: L }) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], {
          icon: L.divIcon({
            className: '',
            html: `<div style="width:12px;height:12px;background:#C9A96E;border-radius:50%;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          }),
        }).addTo(map);
      }
      map.setView([lat, lng], Math.max(map.getZoom(), 10));
    });
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const data = await res.json();
      if (data.display_name) {
        const a = data.address || {};
        const road = a.road || a.pedestrian || a.street;
        const street = a.house_number && road ? `${a.house_number} ${road}` : road;
        const locality = a.city || a.town || a.village || a.municipality;
        const short = [street, locality, a.country]
          .filter(Boolean).join(', ') || data.display_name;
        setQuery(short);
        onChange({ label: short, lat, lng });
      }
    } catch {
      // keep existing label
    }
  }

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        const results = await geocodePlace(q);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
        setIsSearching(false);
      }, 300);
    },
    [],
  );

  function selectSuggestion(s: GeocodeSuggestion) {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    const parts = s.display_name.split(',');
    const short = parts.length > 2
      ? `${parts[0].trim()}, ${parts[parts.length - 1].trim()}`
      : s.display_name;

    setQuery(short);
    setShowDropdown(false);
    onChange({ label: short, lat, lng });

    if (mapRef.current) {
      updateMarker(mapRef.current, lat, lng);
    }
  }

  function clearLocation() {
    setQuery('');
    onChange({ label: '', lat: null, lng: null });
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
      mapRef.current.setView([46.5, 2.5], 3);
    }
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative" style={{ zIndex: 1000 }}>
        <Label className="flex items-center gap-1.5 mb-2">
          <MapPin className="h-4 w-4" />
          Location
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for a location..."
            disabled={disabled}
            className="pl-9 pr-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
          {query && !isSearching && !disabled && (
            <button
              type="button"
              onClick={clearLocation}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {showDropdown && (
          <div className="absolute z-[1001] top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                onClick={() => selectSuggestion(s)}
              >
                <span className="line-clamp-1">{s.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        ref={mapContainerRef}
        className="aspect-square w-full rounded-lg border border-border overflow-hidden relative"
        style={{ background: '#1a1a2e', zIndex: 0 }}
      />

      {value.lat && value.lng && (
        <p className="text-xs text-muted-foreground">
          Coordinates: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
