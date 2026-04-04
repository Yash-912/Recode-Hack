'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Radio } from 'lucide-react';

interface ActiveLocation {
  lat: number;
  lon: number;
  country: string;
  sessionHash: string;
  lastSeen: string;
}

export default function LiveGeoMap() {
  const [locations, setLocations] = useState<ActiveLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/active-locations?site_id=test-site-id');
        const data = await res.json();
        setLocations(data.locations || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
    const interval = setInterval(fetchLocations, 10000);
    return () => clearInterval(interval);
  }, []);

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
          center={[20, 0]} 
          zoom={2.5} 
          style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
          zoomControl={false}
          scrollWheelZoom={true}
        >
          {/* CartoDB Dark Matter Tiles (Free, No Auth required!) */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          {locations.map((loc, i) => (
            <CircleMarker
              key={i}
              center={[loc.lat, loc.lon]}
              radius={8}
              pathOptions={{
                color: '#ef4444', 
                fillColor: '#dc2626', 
                fillOpacity: 0.7,
                weight: 2
              }}
            >
              <Popup>
                <div className="text-xs font-mono">
                  <strong className="text-white">{loc.country}</strong><br/>
                  <span className="text-zinc-400">Session: {loc.sessionHash.substring(0, 8)}</span>
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
      
      {/* Overriding Leaflet default styles to match our Obsidian theme */}
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
      `}} />
    </div>
  );
}
