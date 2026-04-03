'use client';

import dynamic from 'next/dynamic';

// Must load the map with SSR disabled (Leaflet uses window/document)
const LiveGeoMap = dynamic(() => import('@/components/LiveGeoMap'), { ssr: false });

export default function GeoMapPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif',
      color: '#e5e5e5'
    }}>
      <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
        🌍 Live Geo Map
      </h1>
      <p style={{ color: '#888', marginBottom: '1.5rem' }}>
        Real-time user locations — dots pulse and fade after 30 seconds of inactivity.
        Polls every 10 seconds.
      </p>
      <LiveGeoMap siteId="test-site-id" />
      <p style={{ color: '#555', marginTop: '1rem', fontSize: '0.8rem' }}>
        Tip: Open <a href="/demo/index.html" style={{ color: '#60a5fa' }}>/demo/index.html</a> in 
        another tab and click around to see dots appear on the map.
      </p>
    </div>
  );
}
