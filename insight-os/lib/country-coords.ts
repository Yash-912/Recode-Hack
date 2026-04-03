// Country code → approximate center lat/lon for map visualization
// Used when exact geo-ip lat/lon is unavailable

const COUNTRY_COORDS: Record<string, [number, number]> = {
  US: [39.8, -98.5], GB: [55.3, -3.4], DE: [51.1, 10.4], FR: [46.6, 2.2],
  IN: [20.5, 78.9], CN: [35.8, 104.1], JP: [36.2, 138.2], BR: [-14.2, -51.9],
  CA: [56.1, -106.3], AU: [-25.2, 133.7], RU: [61.5, 105.3], KR: [35.9, 127.7],
  MX: [23.6, -102.5], ID: [-0.7, 113.9], NG: [9.0, 8.6], ZA: [-30.5, 22.9],
  AR: [-38.4, -63.6], EG: [26.8, 30.8], TR: [38.9, 35.2], SA: [23.8, 45.0],
  IT: [41.8, 12.5], ES: [40.4, -3.7], NL: [52.1, 5.2], SE: [60.1, 18.6],
  PL: [51.9, 19.1], BE: [50.5, 4.4], CH: [46.8, 8.2], AT: [47.5, 14.5],
  PH: [12.8, 121.7], TH: [15.8, 100.9], VN: [14.0, 108.2], MY: [4.2, 101.9],
  SG: [1.3, 103.8], PK: [30.3, 69.3], BD: [23.6, 90.3], UA: [48.3, 31.1],
  CO: [4.5, -74.2], CL: [-35.6, -71.5], PE: [-9.1, -75.0], KE: [-0.02, 37.9],
  Unknown: [0, 0],
};

export function getCountryCoords(countryCode: string): [number, number] {
  return COUNTRY_COORDS[countryCode] || COUNTRY_COORDS['Unknown'];
}

export default COUNTRY_COORDS;
