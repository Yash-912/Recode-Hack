// ─── Geo-IP Lookup ─────────────────────────────────────────
// Uses free ip-api.com (45 req/min) with in-memory cache per IP per hour

interface GeoResult {
  country: string;     // 2-letter code e.g. "US"
  countryName: string; // e.g. "United States"
  lat: number;
  lon: number;
}

const geoCache = new Map<string, { data: GeoResult; expiry: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function lookupGeoIP(ip: string): Promise<GeoResult | null> {
  // Check cache first
  const cached = geoCache.get(ip);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,country,lat,lon`);
    if (!res.ok) return null;

    const json = await res.json();
    if (json.status === 'fail') return null;

    const result: GeoResult = {
      country: json.countryCode,
      countryName: json.country,
      lat: json.lat,
      lon: json.lon,
    };

    geoCache.set(ip, { data: result, expiry: Date.now() + CACHE_TTL });

    // Evict old entries periodically (keep cache under 10k)
    if (geoCache.size > 10000) {
      const now = Date.now();
      for (const [key, val] of geoCache) {
        if (val.expiry < now) geoCache.delete(key);
      }
    }

    return result;
  } catch {
    return null;
  }
}
