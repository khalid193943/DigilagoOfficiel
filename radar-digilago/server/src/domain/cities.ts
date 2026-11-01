/** Villes de départ (centre approximatif, rayon par défaut en km). Extensible sans migration. */
export type City = { id: string; name: string; region: string; lat: number; lon: number; radiusKm: number };

export const CITIES: City[] = [
  { id: 'el-jadida', name: 'El Jadida', region: 'Casablanca-Settat', lat: 33.2316, lon: -8.5007, radiusKm: 6 },
  { id: 'azemmour', name: 'Azemmour', region: 'Casablanca-Settat', lat: 33.2876, lon: -8.3425, radiusKm: 3 },
  { id: 'casablanca', name: 'Casablanca', region: 'Casablanca-Settat', lat: 33.5731, lon: -7.5898, radiusKm: 15 },
  { id: 'mohammedia', name: 'Mohammedia', region: 'Casablanca-Settat', lat: 33.6866, lon: -7.3830, radiusKm: 6 },
  { id: 'settat', name: 'Settat', region: 'Casablanca-Settat', lat: 33.0011, lon: -7.6166, radiusKm: 5 },
  { id: 'rabat', name: 'Rabat', region: 'Rabat-Salé-Kénitra', lat: 34.0209, lon: -6.8416, radiusKm: 10 },
  { id: 'sale', name: 'Salé', region: 'Rabat-Salé-Kénitra', lat: 34.0531, lon: -6.7985, radiusKm: 8 },
  { id: 'kenitra', name: 'Kénitra', region: 'Rabat-Salé-Kénitra', lat: 34.2610, lon: -6.5802, radiusKm: 7 },
  { id: 'marrakech', name: 'Marrakech', region: 'Marrakech-Safi', lat: 31.6295, lon: -7.9811, radiusKm: 12 },
  { id: 'safi', name: 'Safi', region: 'Marrakech-Safi', lat: 32.2994, lon: -9.2372, radiusKm: 6 },
  { id: 'essaouira', name: 'Essaouira', region: 'Marrakech-Safi', lat: 31.5085, lon: -9.7595, radiusKm: 4 },
  { id: 'tanger', name: 'Tanger', region: 'Tanger-Tétouan-Al Hoceïma', lat: 35.7595, lon: -5.8340, radiusKm: 12 },
  { id: 'tetouan', name: 'Tétouan', region: 'Tanger-Tétouan-Al Hoceïma', lat: 35.5785, lon: -5.3684, radiusKm: 6 },
  { id: 'fes', name: 'Fès', region: 'Fès-Meknès', lat: 34.0181, lon: -5.0078, radiusKm: 10 },
  { id: 'meknes', name: 'Meknès', region: 'Fès-Meknès', lat: 33.8935, lon: -5.5473, radiusKm: 8 },
  { id: 'agadir', name: 'Agadir', region: 'Souss-Massa', lat: 30.4278, lon: -9.5981, radiusKm: 10 },
  { id: 'oujda', name: 'Oujda', region: "L'Oriental", lat: 34.6814, lon: -1.9086, radiusKm: 8 },
  { id: 'beni-mellal', name: 'Béni Mellal', region: 'Béni Mellal-Khénifra', lat: 32.3373, lon: -6.3498, radiusKm: 6 },
  { id: 'errachidia', name: 'Errachidia', region: 'Drâa-Tafilalet', lat: 31.9314, lon: -4.4246, radiusKm: 5 },
  { id: 'laayoune', name: 'Laâyoune', region: 'Laâyoune-Sakia El Hamra', lat: 27.1253, lon: -13.1625, radiusKm: 7 },
];
export const cityById = (id: string) => CITIES.find((c) => c.id === id);
