import grid from '../ma-grid.json';

/** Même projection que la carte de base (equirectangulaire, cos 29°), en pixels de l'image 2000 × 2037. */
const C = Math.cos((29 * Math.PI) / 180);
export const MAP_W = grid.W, MAP_H = grid.H, SP = grid.SP, ROW_H = (SP * Math.sqrt(3)) / 2, HEX_R = SP * 0.47;
export const MA_CELLS = new Set<number>(grid.cells);
export const MA_PATH = grid.path;

export function project(lat: number, lon: number) { return { x: (lon - grid.LON0) * C * grid.SC, y: (grid.LAT1 - lat) * grid.SC }; }
export function cellCenter(key: number) {
  const row = Math.floor(key / 1000), col = key % 1000;
  return { x: SP / 2 + (row % 2 ? SP / 2 : 0) + col * SP, y: SP / 2 + row * ROW_H };
}
export function cellAt(x: number, y: number): number {
  const r0 = Math.round((y - SP / 2) / ROW_H);
  let best = -1, bd = Infinity;
  for (let row = r0 - 1; row <= r0 + 1; row++) {
    if (row < 0) continue;
    const col = Math.round((x - SP / 2 - (row % 2 ? SP / 2 : 0)) / SP);
    if (col < 0) continue;
    const k = row * 1000 + col, c = cellCenter(k), d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}
export const pctX = (x: number) => `${(x / MAP_W) * 100}%`;
export const pctY = (y: number) => `${(y / MAP_H) * 100}%`;

/** Contour détaillé (≈ 1 km) en [lon, lat], pour les vues à l'échelle d'une ville. */
export const COAST: [number, number][][] = (grid as any).coast;
export function rectAround(lat: number, lon: number, radiusKm: number) {
  const dLat = radiusKm / 111.32, dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { south: lat - dLat, north: lat + dLat, west: lon - dLon, east: lon + dLon };
}
