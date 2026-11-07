// LAGO, allume le Maroc : les niveaux. Une ville = un niveau ; Casablanca a trois quartiers.
// Unités du monde : le sol est à y = 0, le haut est négatif. Lago mesure environ 116 de haut,
// saute à 178, et à 320 avec le double saut de Cumulus. Entreprises et clients : fictifs.
(() => {
// ─── à quoi ressemble le site de chaque métier (notes affichées quand un commerce s'allume) ──────
// photo : image du site Digilago (assets/mt-…-600.webp) ; page : la page du secteur sur digilago.ma
// land (facultatif) : la capture d'un vrai site du métier, par exemple 'lago/metiers/cafe.webp' ; sans elle, la note montre une maquette
const METIERS = {
  cafe: { k: 'Le site d’un café', t: 'Menu, photos et réservation', b: ['La carte en ligne, en FR, AR et EN', 'Réserver une table en deux gestes', 'L’itinéraire et WhatsApp en un clic'],
    rows: ['La carte', 'Photos', 'Horaires'], cta: 'Réserver', photo: 'mt-26dacfa4f1', page: 'secteur-restauration-cafe-maroc.html' },
  commerce: { k: 'Le site d’une boutique', t: 'Catalogue et commande WhatsApp', b: ['Les produits avec prix et photos', 'Commande sur WhatsApp ou paiement en ligne', 'La fiche Google à jour'],
    rows: ['Nouveautés', 'Produits', 'Livraison'], cta: 'Commander', photo: 'mt-c051221409', page: 'secteur-commerce-boutique-maroc.html' },
  sante: { k: 'Le site d’un cabinet', t: 'Rendez-vous en ligne', b: ['Prendre rendez-vous sans appeler', 'Les spécialités et l’équipe', 'L’accès, les horaires, les urgences'],
    rows: ['Le cabinet', 'Spécialités', 'Accès'], cta: 'Prendre RDV', photo: 'mt-6c1d21f85f', page: 'secteur-sante-medical-maroc.html' },
  ecole: { k: 'Le site d’une école', t: 'Inscriptions et réponses aux parents', b: ['Les cycles, les frais, le transport', 'Une demande d’inscription en ligne', 'Les actualités de l’école'],
    rows: ['Nos cycles', 'Vie scolaire', 'Transport'], cta: 'S’inscrire', photo: 'mt-a69c241832', page: 'secteur-education-formation-maroc.html' },
  riad: { k: 'Le site d’un riad', t: 'Réservation directe', b: ['Les chambres en photos', 'Réserver sans commission', 'En français, arabe et anglais'],
    rows: ['Chambres', 'Galerie', 'Avis'], cta: 'Réserver', photo: 'mt-2624c8e52c', page: 'secteur-hotel-riad-hebergement-maroc.html' },
  sport: { k: 'Le site d’un club', t: 'Créneaux et inscriptions', b: ['Les créneaux réservables en ligne', 'Les cours et les tarifs', 'Les inscriptions des enfants'],
    rows: ['Terrains', 'Cours', 'Tarifs'], cta: 'Réserver', photo: 'mt-06e741922e', page: 'secteur-sport-loisirs-maroc.html' },
  hotel: { k: 'Le site d’un hôtel', t: 'Réservation directe en trois langues', b: ['Les chambres et les offres', 'La réservation directe', 'Le séminaire et l’événementiel'],
    rows: ['Chambres', 'Séminaires', 'Offres'], cta: 'Réserver', photo: 'mt-2624c8e52c', page: 'secteur-hotel-riad-hebergement-maroc.html' },
  industrie: { k: 'Le site d’un grand groupe', t: 'Une vitrine qui génère des demandes', b: ['Les métiers et les références', 'Une demande de devis qualifiée', 'Un espace client'],
    rows: ['Le groupe', 'Services', 'Références'], cta: 'Demander un devis', photo: 'mt-f4cae0406d', page: 'secteur-industrie-b2b-maroc.html' },
  conseil: { k: 'Le site d’un cabinet conseil', t: 'Expertise et prise de contact', b: ['Les expertises, clairement', 'Les publications et l’équipe', 'Un rendez-vous en ligne'],
    rows: ['Expertises', 'Équipe', 'Publications'], cta: 'Prendre RDV', photo: 'mt-4ae5e48318', page: 'secteur-juridique-conseil-finance-maroc.html' },
};

// l'adresse du site de chaque commerce, affichée en petit quand il s'allume (exemples : entreprises fictives)
const DOMS = { horloge: 'cafe-horloge.ma', derb: 'epicerie-derb.ma', darnour: 'riad-darnour.ma', lumiere: 'sante-lumiere.ma', jasmins: 'ecole-jasmins.ma', dinan: 'dinanderie-bab.ma', glacier: 'glacier-corniche.ma', surf: 'surf-aindiab.ma', sardine: 'la-sardine.ma', clubfoot: 'foot-corniche.ma', ocean: 'hotel-ocean.ma', logistique: 'ocean-logistique.ma', anfa: 'anfa-horizon.ma', atlas: 'atlas-energie.ma', cowork: 'cowork-anfa.ma' };

// ─── constructeur de quartier ──────────────────────────────────────────────────────────────────
function part(o) {
  const P = Object.assign({ solids: [], oneway: [], hidden: [], movers: [], shops: [], sparks: [], shadows: [], bubbles: [], anchors: [], checks: [], npcs: [], lamps: [], deco: [], costumes: [] }, o);
  const api = {
    ground(x1, x2, style) { P.solids.push({ x: x1, y: 0, w: x2 - x1, h: 900, style: style || 'ground' }); return api; },
    roof(x1, x2, top, style) { P.solids.push({ x: x1, y: top, w: x2 - x1, h: 1600, style: style || 'roof' }); return api; },
    block(x, y, w, h, style) { P.solids.push({ x, y, w, h, style: style || 'block' }); return api; },
    ledge(x, y, w, style) { P.oneway.push({ x, y, w, h: 18, style: style || 'ledge' }); return api; },
    secret(x, y, w, by) { P.hidden.push({ x, y, w, h: 18, by, a: 0, style: 'light' }); return api; },
    mover(x, y, w, dx, dy, period, style) { P.movers.push({ x0: x, y0: y, x, y, w, h: 18, dx, dy, period, dwell: style === 'lift' ? .2 : 0, style: style || 'mover', vx: 0, vy: 0 }); return api; },
    shop(id, x, sprite, name, metier, opt) { P.shops.push(Object.assign({ id, x, by: 0, sprite, name, metier, dom: DOMS[id] || '', lit: false, glow: 0 }, opt || {})); return api; },
    sparks(x1, x2, y, n) { for (let i = 0; i < n; i++) P.sparks.push({ x: x1 + (n === 1 ? 0 : (x2 - x1) * i / (n - 1)), y, got: false }); return api; },
    arc(cx, cy, r, n, a0 = -160, a1 = -20) { for (let i = 0; i < n; i++) { const a = (a0 + (a1 - a0) * i / Math.max(1, n - 1)) * Math.PI / 180; P.sparks.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, got: false }); } return api; },
    shadow(x1, x2, y = 0, speed = 80) { P.shadows.push({ kind: 'walk', x1, x2, x: (x1 + x2) / 2, y, dir: 1, speed, alive: true, t: Math.random() * 6 }); return api; },
    flyer(x, y, ax = 120, ay = 40, speed = 1) { P.shadows.push({ kind: 'fly', cx: x, cy: y, ax, ay, x, y, speed, alive: true, t: Math.random() * 6 }); return api; },
    bubble(x, y, kind) { P.bubbles.push({ x, y, kind: kind || 'wa', sq: 0 }); return api; },
    anchor(x, y) { P.anchors.push({ x, y }); return api; },
    check(x, y = 0) { P.checks.push({ x, y, on: false }); return api; },
    npc(id, x, sprite, name, role, lines, opt) { P.npcs.push(Object.assign({ id, x, y: 0, sprite, name, role, lines, done: false }, opt || {})); return api; },
    lamp(x, y, by) { P.lamps.push({ x, y, by, on: false }); return api; },
    deco(kind, x, y, s) { P.deco.push({ kind, x, y, s: s || 1 }); return api; },
    costume(x1, x2, kind) { P.costumes.push({ x1, x2, kind }); return api; },
    done: () => P,
  };
  return api;
}

// ─── Casablanca, quartier 1 : la médina ─────────────────────────────────────────────────────────
const medina = part({ id: 'medina', name: 'La médina', theme: 'medina', bg: 'bg_medina', len: 6100, start: { x: 140, y: 0 }, exit: { x: 5900, y: 0, kind: 'tram', label: 'Tram · Corniche' }, dark: .7 })
  .ground(-400, 1980).ground(2160, 4620).ground(4800, 6400)
  .check(60).check(2320).check(4880)
  .npc('radar', 360, 'radar_salut', 'Radar', 'Le repérage', [
    'Salam Lago ! Dans la médina, cinq commerces sont encore éteints en ligne.',
    'Je les repère pour toi : suis ma flèche dorée. Devant une vitrine, utilise la Lanterne pour l’allumer.',
  ], { gives: 'radar' })
  .shop('horloge', 760, 'cafe', 'Café de l’Horloge', 'cafe')
  .ledge(940, -130, 220, 'awning').ledge(1170, -250, 220, 'awning').arc(1180, -260, 120, 7)
  .shadow(1000, 1300)
  .shop('derb', 1500, 'commerce', 'Épicerie Fine Derb', 'commerce')
  .secret(1660, -150, 150, 'derb').secret(1830, -290, 150, 'derb')
  .ledge(1960, -400, 520, 'terrace').shop('darnour', 2240, 'ecole', 'Riad Dar Nour', 'riad', { by: -400, bonus: true })
  .sparks(1990, 2440, -460, 8)
  .sparks(260, 620, -50, 5).sparks(1680, 1900, -60, 4).sparks(2200, 2560, -50, 5)
  .npc('salma', 2560, 'h_salma', 'Salma', 'Photographe', [
    'Tu allumes les vitrines ? Moi, je photographie les commerces pour leurs sites.',
    'Tiens : ma lumière en plus pour ta Lanterne. Une belle photo, ça rend visible.',
  ], { gives: 'heart' })
  .shop('lumiere', 2860, 'sante', 'Cabinet Santé Lumière', 'sante')
  .ledge(3080, -120, 240, 'balcony').ledge(3300, -230, 240, 'balcony').ledge(3520, -340, 240, 'balcony').ledge(3780, -230, 240, 'balcony')
  .sparks(3120, 3960, -420, 9).flyer(3420, -230, 140, 50)
  .shadow(3180, 3600)
  .shop('jasmins', 4000, 'ecole', 'École Les Jasmins', 'ecole')
  .bubble(4260, -70).ledge(4080, -440, 440, 'terrace').sparks(4150, 4430, -500, 5)
  .shadow(4960, 5180).flyer(5050, -210, 100, 40)
  .shop('dinan', 5250, 'commerce', 'Dinanderie Bab Marrakech', 'commerce')
  .sparks(4560, 4600, -50, 2).sparks(4900, 5100, -50, 4).sparks(5450, 5800, -50, 5)
  .lamp(560, -230, 'horloge').lamp(1300, -230, 'derb').lamp(2700, -230, 'lumiere').lamp(3850, -230, 'jasmins').lamp(5080, -230, 'dinan').lamp(5480, -230, 'dinan')
  .done();

// ─── Casablanca, quartier 2 : la Corniche ───────────────────────────────────────────────────────
const corniche = part({ id: 'corniche', name: 'La Corniche', theme: 'corniche', bg: 'bg_medina', len: 6600, start: { x: 140, y: 0 }, exit: { x: 6420, y: 0, kind: 'tram', label: 'Tram · Quartier d’affaires' }, dark: .68, sea: true })
  .ground(-400, 1500, 'promenade').ground(1820, 2700, 'promenade').ground(3000, 3600, 'promenade').ground(3600, 4800, 'pitch').ground(5100, 6800, 'promenade')
  .check(60).check(1900).check(3680).check(5180)
  .npc('cumulus', 400, 'cumulus', 'Cumulus', 'L’hébergement', [
    'Bonsoir ! Je suis Cumulus, le nuage qui garde les sites allumés jour et nuit.',
    'Au-dessus de la mer, je te porte : saute, puis saute encore en l’air.',
  ], { gives: 'double', fly: true })
  .shop('glacier', 950, 'cafe', 'Glacier de la Corniche', 'cafe')
  .sparks(300, 800, -50, 6).bubble(1660, -40).arc(1660, -300, 130, 6)
  .shop('surf', 2250, 'sport', 'École de surf Aïn Diab', 'sport')
  .shadow(2420, 2660).flyer(2850, -280, 90, 50).sparks(2750, 2950, -300, 4)
  .shop('sardine', 3300, 'cafe', 'Restaurant La Sardine', 'cafe')
  .costume(3600, 4800, 'sport')
  .ledge(3780, -150, 220, 'mast').ledge(4000, -290, 220, 'mast').ledge(4220, -430, 220, 'mast').sparks(3820, 4400, -540, 7)
  .bubble(4400, -40, 'ball').shop('clubfoot', 4600, 'sport', 'Club Foot Corniche', 'sport')
  .mover(4850, -10, 150, 140, 0, 3.2, 'boat')
  .flyer(3500, -240, 100, 40).shadow(5250, 5550).flyer(5400, -250, 120, 50)
  .shop('ocean', 5700, 'tower2', 'Hôtel Océan', 'hotel')
  .sparks(5150, 5500, -50, 5).sparks(5900, 6200, -50, 4)
  .npc('youssef', 6100, 'h_youssef', 'Youssef', 'Apporteur d’affaires', [
    'Bravo Lago, la Corniche brille ! Je connais les grands comptes du quartier d’affaires.',
  ], { deal: true })
  .lamp(700, -260, 'glacier').lamp(2050, -260, 'surf').lamp(3150, -260, 'sardine').lamp(5450, -260, 'ocean').lamp(6000, -260, 'ocean')
  .deco('palm', 600).deco('palm', 1400).deco('palm', 2500).deco('palm', 3200).deco('palm', 5300).deco('palm', 6300)
  .done();

// ─── Casablanca, quartier 3 : le quartier d'affaires ────────────────────────────────────────────
const affaires = part({ id: 'affaires', name: 'Le quartier d’affaires', theme: 'affaires', bg: 'bg_affaires', len: 6300, start: { x: 140, y: 0 }, exit: { x: 5900, y: -1250, kind: 'beacon', label: 'Le phare' }, dark: .72 })
  .ground(-400, 980, 'plaza').costume(-400, 7000, 'cravate')
  .check(60)
  .npc('mehdi', 380, 'h_mehdi', 'Mehdi', 'Développeur', [
    'Ici, les tours sont hautes et les rues sont larges. Il te faut l’épingle Google.',
    'Vise une épingle au-dessus de toi, utilise la Lanterne pour t’y accrocher, et balance-toi.',
  ], { gives: 'pin' })
  .shop('logistique', 700, 'tower0', 'Groupe Océan Logistique', 'industrie')
  .roof(980, 1320, -140).mover(1325, -140, 160, 0, -290, 5, 'lift').ground(1320, 1490, 'plaza').roof(1490, 1900, -430)
  .sparks(1000, 1300, -200, 5).sparks(1540, 1880, -490, 5)
  .anchor(2110, -760).arc(2110, -760, 220, 7, 20, 160)
  .roof(2300, 2820, -380).check(2360, -380).shop('anfa', 2600, 'tower2', 'Hôtel Anfa Horizon', 'hotel', { by: -380 })
  .shadow(2690, 2810, -380)
  .roof(3000, 3300, -250).sparks(3020, 3280, -310, 4)
  .anchor(3500, -600).anchor(3860, -640).flyer(4010, -600, 60, 30)
  .roof(4100, 4600, -300).check(4140, -300).shop('atlas', 4380, 'tower1', 'Atlas Énergie', 'industrie', { by: -300 })
  .shadow(4450, 4590, -300)
  .mover(4650, -300, 180, 280, 0, 3.6, 'lift')
  .roof(5110, 5420, -380).check(5150, -380).shop('cowork', 5300, 'tower0', 'Coworking Anfa', 'conseil', { by: -380 })
  .ledge(5440, -530, 230, 'steel').ledge(5600, -680, 230, 'steel').ledge(5440, -830, 230, 'steel').ledge(5600, -980, 230, 'steel').ledge(5440, -1130, 230, 'steel')
  .flyer(5560, -770, 70, 30).sparks(5480, 5640, -1210, 4)
  .roof(5720, 6100, -1250, 'top')
  .done();

window.LEVELS = [
  { id: 'casa', city: 'Casablanca', n: 1, parts: [medina, corniche, affaires], open: true,
    intro: 'Allume la médina, la Corniche et le quartier d’affaires.' },
  { id: 'rabat', city: 'Rabat', n: 2, soon: true, intro: 'Les Oudayas, le Bouregreg et la grande tour.' },
  { id: 'marrakech', city: 'Marrakech', n: 3, soon: true, intro: 'Les souks, Jemaa el-Fna et les riads.' },
  { id: 'fes', city: 'Fès', n: 4, soon: true, intro: 'Les toits des tanneries et la médina.' },
  { id: 'tanger', city: 'Tanger', n: 5, soon: true, intro: 'Le port, le Cap Spartel et le détroit.' },
];
window.METIERS = METIERS;
})();
