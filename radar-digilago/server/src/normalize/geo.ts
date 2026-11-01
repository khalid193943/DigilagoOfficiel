export const R_EARTH = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(h));
}

export type Rect = { south: number; west: number; north: number; east: number };

export function rectAround(lat: number, lon: number, radiusKm: number): Rect {
  const dLat = radiusKm / 111.32, dLon = radiusKm / (111.32 * Math.cos(rad(lat)));
  return { south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon };
}

/** Découpe un rectangle en n×n tuiles (balayage complet d'une ville). */
export function splitRect(r: Rect, n: number): Rect[] {
  const out: Rect[] = [];
  const h = (r.north - r.south) / n, w = (r.east - r.west) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    out.push({ south: r.south + i * h, north: r.south + (i + 1) * h, west: r.west + j * w, east: r.west + (j + 1) * w });
  return out;
}
