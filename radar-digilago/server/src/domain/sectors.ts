/**
 * Taxonomie des secteurs. Chaque secteur sait se traduire pour chaque source :
 *  - osm    : filtres de tags Overpass  (clé=valeur ou clé~regex)
 *  - google : mots-clés de recherche textuelle (Places API Text Search)
 * Modifiable sans toucher au cœur du pipeline.
 */
export type Sector = {
  id: string;
  label: string;
  priority: boolean;              // secteur où Digilago a une offre et des exemples
  osm: string[];                  // ex. 'amenity=restaurant', 'craft~^(plumber|electrician)$'
  google: string[];               // mots-clés FR pour la recherche texte
  subsectors?: Record<string, string>; // valeur de tag OSM -> sous-secteur lisible
};

export const SECTORS: Sector[] = [
  { id: 'hotellerie', label: 'Hôtellerie & hébergement', priority: true,
    osm: ['tourism~^(hotel|guest_house|hostel|motel|apartment|chalet|camp_site)$'],
    google: ['hôtel', 'riad', "maison d'hôtes", 'auberge'],
    subsectors: { hotel: 'Hôtel', guest_house: "Maison d'hôtes / riad", hostel: 'Auberge', motel: 'Motel', apartment: 'Appartements', chalet: 'Chalet', camp_site: 'Camping' } },
  { id: 'tourisme', label: 'Tourisme & voyages', priority: true,
    osm: ['shop=travel_agency', 'office~^(travel_agent|guide|tourism)$', 'tourism=information][information=office'],
    google: ['agence de voyage', 'excursions', 'guide touristique', 'activités touristiques', 'location quad'],
    subsectors: { travel_agency: 'Agence de voyage', travel_agent: 'Agence de voyage', guide: 'Guide' } },
  { id: 'restauration', label: 'Restauration', priority: true,
    osm: ['amenity~^(restaurant|cafe|fast_food|ice_cream)$', 'shop~^(bakery|pastry|confectionery)$'],
    google: ['restaurant', 'café', 'snack', 'pâtisserie', 'traiteur'],
    subsectors: { restaurant: 'Restaurant', cafe: 'Café', fast_food: 'Snack / fast-food', ice_cream: 'Glacier', bakery: 'Boulangerie', pastry: 'Pâtisserie', confectionery: 'Confiserie' } },
  { id: 'construction', label: 'Construction & rénovation', priority: true,
    osm: ['craft~^(builder|plumber|electrician|carpenter|hvac|roofer|tiler|painter|glaziery|metal_construction|stonemason|plasterer|insulation)$', 'office~^(architect|engineer|construction_company)$', 'shop~^(hardware|doityourself|tiles|bathroom_furnishing|paint)$'],
    google: ['entreprise de construction', 'rénovation', 'plombier', 'électricien', 'climatisation', 'architecte', 'menuiserie aluminium', 'bureau d\'études'],
    subsectors: { builder: 'BTP', plumber: 'Plomberie', electrician: 'Électricité', carpenter: 'Menuiserie', hvac: 'Climatisation', roofer: 'Toiture', tiler: 'Carrelage', painter: 'Peinture', glaziery: 'Vitrerie', metal_construction: 'Métallerie / aluminium', architect: 'Architecte', engineer: "Bureau d'études" } },
  { id: 'immobilier', label: 'Immobilier', priority: true,
    osm: ['office~^(estate_agent|property_management)$'],
    google: ['agence immobilière', 'promoteur immobilier', 'syndic'],
    subsectors: { estate_agent: 'Agence immobilière', property_management: 'Gestion / syndic' } },
  { id: 'industrie', label: 'Industrie & fabrication', priority: false,
    osm: ['man_made=works', 'industrial', 'craft~^(electronics_repair|sawmill|key_cutter)$'],
    google: ['usine', 'fabricant', 'fournisseur industriel', 'maintenance industrielle'] },
  { id: 'commerce', label: 'Commerce & distribution', priority: false,
    osm: ['shop~^(clothes|shoes|furniture|electronics|mobile_phone|computer|jewelry|optician|gift|books|sports|florist|kitchen|interior_decoration|houseware|bed|curtain|fabric|wholesale)$'],
    google: ['magasin', 'boutique', 'showroom', 'grossiste'] },
  { id: 'services_pro', label: 'Services professionnels', priority: true,
    osm: ['office~^(lawyer|accountant|notary|insurance|consulting|it|advertising_agency|financial|employment_agency|tax_advisor|company|bailiff)$'],
    google: ['cabinet comptable', 'fiduciaire', 'avocat', 'notaire', 'assurance', 'agence de communication', 'conseil en entreprise'],
    subsectors: { lawyer: 'Avocat', accountant: 'Expertise comptable / fiduciaire', notary: 'Notaire', insurance: 'Assurance', consulting: 'Conseil', it: 'Informatique', advertising_agency: 'Communication / publicité' } },
  { id: 'beaute', label: 'Beauté & bien-être', priority: true,
    osm: ['shop~^(hairdresser|beauty|cosmetics|massage|perfumery)$', 'amenity=public_bath', 'leisure~^(fitness_centre|sports_centre)$'],
    google: ['salon de coiffure', 'institut de beauté', 'spa', 'hammam', 'salle de sport', 'onglerie'],
    subsectors: { hairdresser: 'Coiffure', beauty: 'Institut de beauté', massage: 'Massage / spa', public_bath: 'Hammam', fitness_centre: 'Salle de sport' } },
  { id: 'sante', label: 'Santé', priority: true,
    osm: ['amenity~^(clinic|doctors|dentist|pharmacy)$', 'healthcare~^(clinic|doctor|dentist|physiotherapist|optometrist|laboratory|centre)$'],
    google: ['clinique', 'cabinet médical', 'dentiste', 'kinésithérapeute', 'laboratoire d\'analyses', 'opticien'],
    subsectors: { clinic: 'Clinique', doctors: 'Cabinet médical', dentist: 'Dentiste', pharmacy: 'Pharmacie', physiotherapist: 'Kinésithérapie', laboratory: 'Laboratoire' } },
  { id: 'education', label: 'Éducation & formation', priority: true,
    osm: ['amenity~^(school|kindergarten|language_school|driving_school|music_school|college|training)$'],
    google: ['école privée', 'crèche', 'centre de langues', 'auto-école', 'centre de formation', 'soutien scolaire'],
    subsectors: { school: 'École', kindergarten: 'Crèche / maternelle', language_school: 'Centre de langues', driving_school: 'Auto-école', music_school: 'École de musique', college: 'Enseignement supérieur', training: 'Formation' } },
  { id: 'transport', label: 'Transport, auto & logistique', priority: false,
    osm: ['amenity~^(car_rental|car_wash|driving_school)$', 'shop~^(car|car_repair|car_parts|tyres|motorcycle)$', 'office~^(logistics|moving_company|courier)$'],
    google: ['location de voitures', 'garage automobile', 'transport logistique', 'déménagement', 'transitaire'],
    subsectors: { car_rental: 'Location de voitures', car_repair: 'Garage', car: 'Concession auto', logistics: 'Logistique', moving_company: 'Déménagement' } },
  { id: 'artisanat', label: 'Artisanat', priority: false,
    osm: ['shop~^(craft|art|antiques|carpet|pottery)$', 'craft~^(pottery|tailor|upholsterer|jeweller|shoemaker|leather|weaver|dressmaker)$'],
    google: ['artisanat', 'coopérative artisanale', 'tapis', 'poterie', 'maroquinerie'] },
  { id: 'associations', label: 'Associations & coopératives', priority: false,
    osm: ['office~^(association|ngo|foundation|cooperative)$'],
    google: ['association', 'coopérative', 'fondation'] },
];

export const sectorById = (id: string) => SECTORS.find((s) => s.id === id);

/** Déduit secteur + sous-secteur depuis des tags OSM. */
export function sectorFromOsmTags(tags: Record<string, string>): { sector?: string; subsector?: string } {
  for (const s of SECTORS) {
    for (const f of s.osm) {
      const first = f.split('][')[0];
      const m = first.match(/^([a-z_:]+)(?:(=|~)(.+))?$/);
      if (!m) continue;
      const [, key, op, val] = m;
      const v = tags[key];
      if (v == null) continue;
      const hit = !op || (op === '=' ? v === val : new RegExp(val).test(v));
      if (hit) return { sector: s.id, subsector: s.subsectors?.[v] ?? v };
    }
  }
  return {};
}
