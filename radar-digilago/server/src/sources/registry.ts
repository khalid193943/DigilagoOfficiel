import { DemoAdapter } from './demo.js';
import { GooglePlacesAdapter } from './google-places.js';
import { OsmOverpassAdapter } from './osm-overpass.js';
import type { SourceAdapter } from './types.js';

/** Sources branchées. Ajouter une source = écrire un adapter et l'ajouter ici ; le cœur ne change pas. */
let adapters: SourceAdapter[] = [new GooglePlacesAdapter(), new OsmOverpassAdapter(), new DemoAdapter()];

/** Sources prévues, pas encore branchées : affichées honnêtement comme « à venir ». */
export const PLANNED_SOURCES = [
  { id: 'apple_maps', label: 'Apple Maps', mono: 'A', note: 'Complète Google sur les petits commerces (Apple Maps Server API, clé requise).' },
  { id: 'foursquare', label: 'Foursquare', mono: 'F', note: 'Couverture Maroc à valider (clé requise).' },
  { id: 'azure_maps', label: 'Azure Maps', mono: 'Az', note: 'Remplace Bing Maps (clé requise).' },
  { id: 'here', label: 'HERE', mono: 'H', note: 'Adresses et points d’intérêt (clé requise).' },
  { id: 'tomtom', label: 'TomTom', mono: 'T', note: 'Points d’intérêt (clé requise).' },
];

export const allSources = () => adapters;
export const sourceById = (id: string) => adapters.find((a) => a.id === id);
/** Pour les tests : remplacer les sources par des doubles. */
export function setSources(list: SourceAdapter[]) { adapters = list; }
