'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Radio } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface ActiveLocation {
  lat: number;
  lon: number;
  country: string;
  sessionHash: string;
  url: string;
  ts: string;
  lastSeen: number;
}

// Auto-fit the map to show all active markers
function FitBounds({ locations }: { locations: ActiveLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;
    
    const bounds = locations.map(l => [l.lat, l.lon] as [number, number]);
    
    if (bounds.length === 1) {
      // Single user — center on them with a reasonable zoom
      map.setView(bounds[0], 5, { animate: true });
    } else if (bounds.length > 1) {
      // Multiple users — fit all markers with padding
      const L = require('leaflet');
      const leafletBounds = L.latLngBounds(bounds);
      map.fitBounds(leafletBounds, { padding: [60, 60], maxZoom: 6, animate: true });
    }
  }, [locations.length]); // Only re-fit when count changes

  return null;
}

export default function LiveGeoMap() {
  const [locations, setLocations] = useState<ActiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const siteId = searchParams.get('site') || 'cmnjoenvi000004jp2ge44k3j';

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch(`/api/active-locations?site_id=${siteId}`);
      const data = await res.json();
      if (data.locations) {
        const now = Date.now();
        setLocations(prev => {
          const existingMap = new Map(prev.map(d => [d.sessionHash, d]));

          for (const loc of data.locations) {
            existingMap.set(loc.sessionHash, { ...loc, lastSeen: now });
          }

          // Remove dots inactive for >30s
          return Array.from(existingMap.values()).filter(
            d => now - d.lastSeen < 30000
          );
        });
      }
    } catch (e) {
      console.error('[GeoMap] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 10000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  // Age-based opacity for fade-out effect
  const getOpacity = (lastSeen: number) => {
    const age = Date.now() - lastSeen;
    if (age < 10000) return 0.9;
    if (age < 20000) return 0.6;
    return 0.3;
  };

  return (
    <div className="p-6 flex flex-col gap-6 w-full h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-crimson-bright" />
            Live Pulse Map
          </h2>
          <p className="text-sm text-zinc-500 mt-1">Real-time geo-location of active users (updates every 10s)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#333] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-crimson-bright animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.6)]" />
            <span className="text-xs text-zinc-400 font-mono">{locations.length} active</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 bg-[#050505] border border-[#222] rounded-xl relative overflow-hidden shadow-2xl">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-obsidian/80 z-50">
            <div className="text-crimson-bright font-mono text-sm animate-pulse tracking-widest">CONNECTING TO GEO-IP FEED...</div>
          </div>
        )}
        
        <MapContainer 
          center={[20, 78]} 
          zoom={4} 
          style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
          zoomControl={false}
          scrollWheelZoom={true}
        >
          {/* CartoDB Dark Matter Tiles (Free, No Auth required!) */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          {/* Auto-fit to show all markers */}
          <FitBounds locations={locations} />
          
          {locations.map((loc) => (
            <CircleMarker
              key={loc.sessionHash}
              center={[loc.lat, loc.lon]}
              radius={8}
              pathOptions={{
                color: '#ef4444', 
                fillColor: '#dc2626', 
                fillOpacity: getOpacity(loc.lastSeen),
                weight: 2,
                opacity: getOpacity(loc.lastSeen),
              }}
            >
              <Popup>
                <div className="text-xs font-mono">
                  <strong className="text-white">{loc.country}</strong><br/>
                  <span className="text-zinc-400">Page: {loc.url}</span><br/>
                  <span className="text-zinc-400">Time: {new Date(loc.ts).toLocaleTimeString()}</span><br/>
                  <span className="text-zinc-500">Session: {loc.sessionHash?.substring(0, 8)}</span>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Country Legend */}
        {locations.length > 0 && (
          <div className="absolute bottom-4 right-4 bg-[#0a0a0a]/90 border border-[#333] rounded-lg p-3 backdrop-blur-md z-[1000]">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Active Regions</div>
            {[...new Set(locations.map(l => l.country))].slice(0, 5).map(country => (
              <div key={country} className="flex items-center gap-2 text-xs text-zinc-400 py-0.5">
                <MapPin className="w-3 h-3 text-crimson-bright" />
                {country}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Overriding Leaflet default styles + pulse animation on markers */}
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-container {
          background: #0a0a0a !important;
          font-family: inherit;
        }
        .leaflet-popup-content-wrapper {
          background: #111;
          border: 1px solid #333;
          border-radius: 8px;
        }
        .leaflet-popup-tip {
          background: #111;
        }
        /* Pulsing ring animation on all circle markers */
        .leaflet-interactive {
          animation: geo-pulse 2s ease-in-out infinite;
          transform-origin: center center;
        }
        @keyframes geo-pulse {
          0%, 100% {
            stroke-width: 2;
            filter: drop-shadow(0 0 3px rgba(239, 68, 68, 0.4));
          }
          50% {
            stroke-width: 4;
            filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.8));
          }
        }
      `}} />
    </div>
  );
}
