'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { BoardProfile } from '@/lib/api';

// Suppress noisy development warnings
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    const msg = args[0]?.toString?.() || '';
    // Suppress Leaflet animation errors and React DevTools params warning
    if (msg.includes('_leaflet_pos') || msg.includes('params are being enumerated')) return;
    originalError.apply(console, args);
  };
  
  // Catch unhandled errors from Leaflet animations
  window.addEventListener('error', (e) => {
    if (e.message?.includes('_leaflet_pos')) {
      e.preventDefault();
      return true;
    }
  });
}

// Custom cluster styles to match Anchise theme
const clusterStyles = `
  .marker-cluster-small {
    background-color: rgba(201, 167, 94, 0.6);
  }
  .marker-cluster-small div {
    background-color: rgba(201, 167, 94, 0.9);
  }
  .marker-cluster-medium {
    background-color: rgba(201, 167, 94, 0.7);
  }
  .marker-cluster-medium div {
    background-color: rgba(201, 167, 94, 0.95);
  }
  .marker-cluster-large {
    background-color: rgba(201, 167, 94, 0.8);
  }
  .marker-cluster-large div {
    background-color: rgba(201, 167, 94, 1);
  }
  .marker-cluster {
    background-clip: padding-box;
    border-radius: 20px;
  }
  .marker-cluster div {
    width: 30px;
    height: 30px;
    margin-left: 5px;
    margin-top: 5px;
    text-align: center;
    border-radius: 15px;
    font: 12px "Inter", sans-serif;
    font-weight: 600;
    color: #0F0F12;
  }
  .marker-cluster span {
    display: none;
  }
`;

// Generate popup content for a profile
const createPopupContent = (profile: BoardProfile) => {
  const deathDate = new Date(profile.deathDate).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `
    <div style="font-family: system-ui, sans-serif; min-width: 180px;">
      <div style="font-weight: 600; font-size: 15px; color: #FFFFFF; margin-bottom: 6px;">
        ${profile.firstName} ${profile.lastName}
      </div>
      <div style="font-size: 12px; color: #AFAFB3; margin-bottom: 4px;">
        ${deathDate}
      </div>
      ${profile.deathPlaceLabel ? `
        <div style="font-size: 12px; color: #AFAFB3; margin-bottom: 12px;">
          ${profile.deathPlaceLabel}
        </div>
      ` : '<div style="margin-bottom: 8px;"></div>'}
      <a href="/profile/${profile.slug}" style="
        display: inline-block;
        font-size: 12px;
        color: #C9A75E;
        text-decoration: none;
        font-weight: 500;
        padding: 6px 0;
        border-top: 1px solid #3A3A40;
        width: 100%;
      ">View memorial →</a>
    </div>
  `;
};

// Custom marker with Anchise colors
const createAnchorIcon = () => L.divIcon({
  className: 'anchise-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background: #C9A75E;
      border: 2px solid #0F0F12;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface MapPosition {
  lat: number;
  lng: number;
  zoom: number;
}

interface BoardMapProps {
  profiles: BoardProfile[];
  onProfileClick?: (profile: BoardProfile) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  onMapMove?: (position: MapPosition) => void;
  selectedProfileId?: string | null;
  popupTrigger?: number;
  centerOn?: { lat: number; lng: number; zoom?: number } | null;
  initialPosition?: MapPosition | null;
  userLocation?: { lat: number; lng: number } | null;
  className?: string;
}

// World view fallback (only if all location methods fail)
const WORLD_CENTER: [number, number] = [20, 0];
const WORLD_ZOOM = 2;
const USER_ZOOM = 10;

export function BoardMap({ 
  profiles, 
  onProfileClick, 
  onBoundsChange,
  onMapMove,
  selectedProfileId,
  popupTrigger,
  centerOn,
  initialPosition,
  userLocation, 
  className 
}: BoardMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const stylesAddedRef = useRef(false);
  const initializedWithLocationRef = useRef(false);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onMapMoveRef = useRef(onMapMove);
  const userLocationRef = useRef(userLocation);
  const initialPositionRef = useRef(initialPosition);
  const [isMapReady, setIsMapReady] = useState(false);

  // Keep refs updated
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
    onMapMoveRef.current = onMapMove;
  }, [onBoundsChange]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // Add custom cluster styles
  useEffect(() => {
    if (stylesAddedRef.current) return;
    const style = document.createElement('style');
    style.textContent = clusterStyles;
    document.head.appendChild(style);
    stylesAddedRef.current = true;
  }, []);

  // Stable emit bounds callback - uses ref to avoid re-creating
  const emitBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    
    try {
      const bounds = map.getBounds();
      if (onBoundsChangeRef.current) {
        onBoundsChangeRef.current({
          minLat: bounds.getSouth(),
          maxLat: bounds.getNorth(),
          minLng: bounds.getWest(),
          maxLng: bounds.getEast(),
        });
      }
    } catch {
      // Map not ready yet, ignore
    }
  }, []); // No dependencies - uses refs

  // Initialize map ONCE
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    // Small delay to ensure container is in DOM and has dimensions
    const initTimer = setTimeout(() => {
      if (!container || mapRef.current) return;
      
      // Ensure container has dimensions
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        return;
      }

      // Priority: 1) URL position, 2) user location, 3) world view
      const urlPos = initialPositionRef.current;
      const loc = userLocationRef.current;
      const center: [number, number] = urlPos 
        ? [urlPos.lat, urlPos.lng]
        : loc 
          ? [loc.lat, loc.lng] 
          : WORLD_CENTER;
      const zoom = urlPos 
        ? urlPos.zoom 
        : loc 
          ? USER_ZOOM 
          : WORLD_ZOOM;

      const map = L.map(container, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
        minZoom: 2, // Prevent zooming out past world view
        maxZoom: 18, // Max zoom in
        // Smooth animations
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        wheelDebounceTime: 80,
        wheelPxPerZoomLevel: 80,
      });

      // Dark CartoDB tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Create cluster group for profile markers
      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 15,
      });
      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;

      mapRef.current = map;
      initializedWithLocationRef.current = !!userLocationRef.current || !!urlPos;
      setIsMapReady(true);

      // Track if user has interacted with the map (vs programmatic positioning)
      let userHasInteracted = false;
      let interactionTimeout: ReturnType<typeof setTimeout> | null = null;
      
      // Mark user interaction on drag/zoom start
      map.on('dragstart', () => { userHasInteracted = true; });
      map.on('zoomstart', () => { 
        // Only count as user interaction if not from programmatic setView
        // Small delay to allow programmatic zooms to clear the flag
        if (interactionTimeout) clearTimeout(interactionTimeout);
        interactionTimeout = setTimeout(() => { userHasInteracted = true; }, 50);
      });

      // Emit map position for URL sync (only after user interaction)
      const emitMapPosition = () => {
        if (!userHasInteracted) return;
        try {
          const center = map.getCenter();
          const zoom = map.getZoom();
          if (onMapMoveRef.current) {
            onMapMoveRef.current({
              lat: center.lat,
              lng: center.lng,
              zoom,
            });
          }
        } catch {
          // Map not ready yet
        }
      };

      // Listen for map movements
      map.on('moveend', () => {
        emitBounds();
        emitMapPosition();
      });
      map.on('zoomend', () => {
        emitBounds();
        emitMapPosition();
      });

      // Emit initial bounds
      setTimeout(emitBounds, 50);
    }, 50);

    return () => {
      clearTimeout(initTimer);
      const map = mapRef.current;
      if (map) {
        try {
          map.off('moveend', emitBounds);
          map.off('zoomend', emitBounds);
          map.remove();
        } catch {
          // Map may already be in invalid state
        }
        mapRef.current = null;
        clusterGroupRef.current = null;
        setIsMapReady(false);
      }
    };
  }, [emitBounds]);

  // Pan to user location if it arrives after map initialized (only once)
  useEffect(() => {
    const map = mapRef.current;
    // Only pan if: map is ready, we have location, and map was NOT initialized with location
    if (!map || !userLocation || !isMapReady || initializedWithLocationRef.current) return;
    
    initializedWithLocationRef.current = true;
    try {
      map.setView([userLocation.lat, userLocation.lng], USER_ZOOM, { animate: true });
    } catch {
      // Map may be in transition, ignore
    }
  }, [userLocation, isMapReady]);

  // Update markers when profiles change
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup || !isMapReady) return;

    // Clear existing markers
    clusterGroup.clearLayers();
    markersMapRef.current.clear();

    // Add new markers
    profiles.forEach((profile) => {
      if (profile.pinLat === null || profile.pinLng === null) return;

      const marker = L.marker([profile.pinLat, profile.pinLng], {
        icon: createAnchorIcon(),
      });

      marker.bindPopup(createPopupContent(profile), { closeButton: true });
      marker.on('click', () => onProfileClick?.(profile));
      clusterGroup.addLayer(marker);
      
      // Store marker reference by profile ID
      markersMapRef.current.set(profile.id, marker);
    });
  }, [profiles, onProfileClick, isMapReady]);

  // Store profiles in a ref for popup access
  const profilesRef = useRef(profiles);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  // Open popup when a profile is selected from the list
  useEffect(() => {
    if (!selectedProfileId || !isMapReady) return;
    
    const map = mapRef.current;
    if (!map) return;
    
    // Find the profile data from ref
    const profile = profilesRef.current.find(p => p.id === selectedProfileId);
    if (!profile || profile.pinLat === null || profile.pinLng === null) return;
    
    // Open popup directly on the map at the profile's location
    L.popup()
      .setLatLng([profile.pinLat, profile.pinLng])
      .setContent(createPopupContent(profile))
      .openOn(map);
  }, [selectedProfileId, popupTrigger, isMapReady]);

  // Add/update user location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation || !isMapReady) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div style="position: relative;">
          <div style="width: 16px; height: 16px; background: #3B82F6; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(59, 130, 246, 0.5);"></div>
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 32px; height: 32px; background: rgba(59, 130, 246, 0.2); border-radius: 50%; animation: pulse 2s infinite;"></div>
        </div>
        <style>@keyframes pulse { 0% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(2); opacity: 0; } }</style>
      `,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
    marker.bindPopup('Your location');
    marker.addTo(map);
    userMarkerRef.current = marker;
  }, [userLocation, isMapReady]);

  // Center map when centerOn changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !centerOn || !isMapReady) return;
    
    try {
      const zoom = centerOn.zoom ?? 11; // Use provided zoom or default to 11 (moderate zoom)
      map.setView([centerOn.lat, centerOn.lng], zoom, { animate: true });
    } catch {
      // Map may be in transition, ignore
    }
  }, [centerOn, isMapReady]);

  // Highlight selected profile
  useEffect(() => {
    // Could implement marker highlighting here if needed
  }, [selectedProfileId]);

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={{ 
        background: '#0F0F12', 
        minHeight: '100%',
        position: 'relative',
        zIndex: 0,
        isolation: 'isolate'
      }}
    />
  );
}
