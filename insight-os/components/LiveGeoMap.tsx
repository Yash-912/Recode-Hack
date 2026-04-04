'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';

// Leaflet must be loaded client-side only (no SSR)
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

interface LocationDot {
  sessionHash: string;
  country: string;
  lat: number;
  lon: number;
  url: string;
  ts: string;
  lastSeen: number; // timestamp for fade tracking (3B.7)
}

interface LiveGeoMapProps {
  siteId?: string;
}

export default function LiveGeoMap({ siteId = 'cmnjoenvi000004jp2ge44k3j' }: LiveGeoMapProps) {
  const [dots, setDots] = useState<LocationDot[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // 3B.6 — Poll every 10 seconds
  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch(`/api/active-locations?site_id=${siteId}`);
      const data = await res.json();
      if (data.locations) {
        const now = Date.now();
        setDots(prev => {
          const existingMap = new Map(prev.map(d => [d.sessionHash, d]));
          
          // Update existing dots and add new ones
          for (const loc of data.locations) {
            existingMap.set(loc.sessionHash, { ...loc, lastSeen: now });
          }

          // 3B.7 — Remove dots inactive for >30 seconds
          const active = Array.from(existingMap.values()).filter(
            d => now - d.lastSeen < 30000
          );
          return active;
        });
      }
    } catch (e) {
      console.error('[GeoMap] Fetch error:', e);
    }
  }, [siteId]);

  useEffect(() => {
    // Import leaflet CSS
    import('leaflet/dist/leaflet.css');
    setIsLoaded(true);
    
    fetchLocations();
    const interval = setInterval(fetchLocations, 10000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  // Calculate opacity based on age (3B.7)
  const getOpacity = (lastSeen: number) => {
    const age = Date.now() - lastSeen;
    if (age < 10000) return 0.9;
    if (age < 20000) return 0.6;
    return 0.3;
  };

  if (!isLoaded) {
    return (
      <div style={{ 
        height: '500px', background: '#0d1117', borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666'
      }}>
        Loading map...
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Active count badge */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 1000,
        background: 'rgba(0,0,0,0.8)', color: '#4ade80', padding: '8px 16px',
        borderRadius: '99px', fontSize: '0.85rem', fontWeight: 600,
        border: '1px solid #22c55e33', backdropFilter: 'blur(8px)'
      }}>
        🟢 {dots.length} active {dots.length === 1 ? 'user' : 'users'}
      </div>

      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        style={{ height: '500px', width: '100%', background: '#0d1117' }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* 3B.2 — CartoDB Dark Matter tiles (free, no API key) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* 3B.5 — Pulsing circle markers */}
        {dots.map(dot => (
          <CircleMarker
            key={dot.sessionHash}
            center={[dot.lat, dot.lon]}
            radius={8}
            pathOptions={{
              fillColor: '#4ade80',
              fillOpacity: getOpacity(dot.lastSeen),
              color: '#22c55e',
              weight: 2,
              opacity: getOpacity(dot.lastSeen),
            }}
          >
            <Popup>
              <div style={{ fontFamily: 'system-ui', fontSize: '0.85rem' }}>
                <strong>{dot.country}</strong><br />
                Page: {dot.url}<br />
                Time: {new Date(dot.ts).toLocaleTimeString()}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* CSS pulse animation for markers */}
      <style jsx global>{`
        .leaflet-interactive {
          animation: geopulse 2s ease-in-out infinite;
        }
        @keyframes geopulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
