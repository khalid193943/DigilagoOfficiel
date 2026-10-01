'use strict';
/* Base de données : SQLite intégré à Node (aucune dépendance native). */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'digilago.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS counters (scope TEXT, year INTEGER, value INTEGER, PRIMARY KEY (scope, year));
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, company TEXT, ice TEXT, phone TEXT, email TEXT,
  address TEXT, city TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, unit TEXT DEFAULT 'forfait',
  unit_price REAL DEFAULT 0, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY, name TEXT, company TEXT, phone TEXT, email TEXT, need TEXT, message TEXT,
  source TEXT, status TEXT DEFAULT 'nouveau', quote_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY, number TEXT UNIQUE, client_id INTEGER REFERENCES clients(id),
  title TEXT, status TEXT DEFAULT 'brouillon', issue_date TEXT, valid_until TEXT,
  tva_rate REAL DEFAULT 20, discount_pct REAL DEFAULT 0, deposit_pct REAL DEFAULT 50,
  delay TEXT, notes TEXT, conditions TEXT, token TEXT UNIQUE,
  sent_at TEXT, viewed_at TEXT, accepted_at TEXT, accepted_name TEXT,
  total_ht REAL DEFAULT 0, total_tva REAL DEFAULT 0, total_ttc REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS quote_items (
  id INTEGER PRIMARY KEY, quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE, position INTEGER,
  label TEXT, description TEXT, qty REAL DEFAULT 1, unit TEXT, unit_price REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY, number TEXT UNIQUE, quote_id INTEGER REFERENCES quotes(id), client_id INTEGER REFERENCES clients(id),
  kind TEXT, title TEXT, issue_date TEXT, due_date TEXT, tva_rate REAL DEFAULT 20,
  total_ht REAL DEFAULT 0, total_tva REAL DEFAULT 0, total_ttc REAL DEFAULT 0,
  notes TEXT, token TEXT UNIQUE, cancelled INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY, invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE, position INTEGER,
  label TEXT, description TEXT, qty REAL DEFAULT 1, unit TEXT, unit_price REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  date TEXT, amount REAL, method TEXT, reference TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY, quote_id INTEGER UNIQUE REFERENCES quotes(id), client_id INTEGER REFERENCES clients(id),
  title TEXT, status TEXT DEFAULT 'a_demarrer', due_date TEXT, site_url TEXT, steps TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), delivered_at TEXT);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY, date TEXT, supplier TEXT, category TEXT, label TEXT,
  amount_ttc REAL DEFAULT 0, tva REAL DEFAULT 0, method TEXT, project_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS i_quotes_client ON quotes(client_id);
CREATE INDEX IF NOT EXISTS i_inv_quote ON invoices(quote_id);
CREATE INDEX IF NOT EXISTS i_pay_inv ON payments(invoice_id);
`);

const DEFAULTS = {
  company_name: 'Digilago', company_tagline: 'Sites web, Google et IA pour les entreprises marocaines',
  company_address: 'El Jadida, Maroc', company_phone: '+212 6 49 95 38 13', company_email: 'contact@digilago.ma',
  company_site: 'digilago.ma', company_ice: '', company_if: '', company_rc: '', company_patente: '', company_cnss: '',
  company_legal: '', bank_name: '', bank_rib: '', bank_swift: '',
  default_tva: '20', default_deposit: '50', default_validity: '30', default_delay: 'Première version en 72 heures',
  default_due_days: '15',
  default_conditions: "Le présent devis, signé ou accepté en ligne, vaut bon de commande.\nUn acompte est exigible à la commande ; les travaux démarrent à sa réception. Le solde est payable à la mise en ligne du site.\nLe nom de domaine est offert la première année ; l’hébergement de la première année est inclus sauf mention contraire.\nLes contenus (textes, photos, logo) fournis par le client restent sa propriété. Le site livré et ses sources sont cédés au client après paiement intégral.\nDeux séries de modifications sont incluses à chaque étape de validation.",
  quote_prefix: 'DG-D', invoice_prefix: 'DG-F', whatsapp: '212649953813', public_url: '',
};
const getSet = db.prepare('SELECT value FROM settings WHERE key = ?');
const putSet = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
for (const [k, v] of Object.entries(DEFAULTS)) if (!getSet.get(k)) putSet.run(k, v);

function settings() {
  const out = { ...DEFAULTS };
  for (const r of db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  return out;
}
function saveSettings(obj) { for (const k of Object.keys(DEFAULTS)) if (k in obj) putSet.run(k, String(obj[k] ?? '')); }

/* Numérotation continue par année, sans trou : DG-D-2026-0001 */
function nextNumber(scope, prefix, dateStr) {
  const year = Number((dateStr || new Date().toISOString()).slice(0, 4));
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT value FROM counters WHERE scope = ? AND year = ?').get(scope, year);
    const v = (row ? row.value : 0) + 1;
    db.prepare('INSERT INTO counters (scope, year, value) VALUES (?, ?, ?) ON CONFLICT(scope, year) DO UPDATE SET value = excluded.value').run(scope, year, v);
    db.exec('COMMIT');
    return `${prefix}-${year}-${String(v).padStart(4, '0')}`;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/* Mises à niveau de la base (colonnes ajoutées) */
for (const [t, c, d] of [['projects', 'info', 'TEXT'], ['projects', 'token', 'TEXT'], ['clients', 'whatsapp', 'TEXT']]) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map((r) => r.name);
  if (!cols.includes(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`);
}

/* Catalogue professionnel : modifiable dans l'interface (les prix restent à fixer par vous) */
const CATALOGUE = [
  ['Site vitrine sur mesure', 'Conception et développement d’un site sur mesure à votre identité visuelle (logo, couleurs, typographie). Jusqu’à 6 pages, en français, anglais et arabe, adapté aux ordinateurs, tablettes et téléphones.', 'forfait'],
  ['Code optimisé et performance', 'Développement sur mesure, sans modèle préfabriqué : chargement rapide, images WebP et AVIF, chargement différé, objectif Google Lighthouse 90 et plus.', 'forfait'],
  ['Rédaction SEO', 'Rédaction des textes pour le référencement naturel sur Google : mots-clés de votre métier et de votre ville, titres, méta-descriptions et maillage interne.', 'page'],
  ['Optimisation GEO (moteurs de réponse IA)', 'Contenus et données structurées pour être cité par ChatGPT, Gemini et les assistants IA : balisage Schema.org, questions fréquentes, fichier llms.txt.', 'forfait'],
  ['Nom de domaine offert (1re année)', 'Réservation et configuration de votre nom de domaine (.ma ou .com) pour la première année, offert par Digilago.', 'an'],
  ['Hébergement sécurisé', 'Hébergement rapide sur CDN, certificat HTTPS, sauvegardes automatiques et surveillance de disponibilité.', 'an'],
  ['Fiche Google Business', 'Création, vérification et optimisation complète de votre fiche : catégories, horaires, photos, services et publications.', 'forfait'],
  ['Boutique en ligne', 'Catalogue produits, panier, paiement en ligne (CMI) ou à la livraison, gestion des commandes et des stocks.', 'forfait'],
  ['Application sur mesure', 'Réservations, espace client, tableau de bord et notifications, conçus pour votre activité.', 'forfait'],
  ['Traduction professionnelle', 'Traduction et adaptation de vos contenus en français, anglais et arabe, avec mise en page de droite à gauche pour l’arabe.', 'page'],
  ['Maintenance et support', 'Mises à jour, sécurité, modifications mineures et support prioritaire sur WhatsApp.', 'mois'],
];
{
  const has = db.prepare('SELECT id, description FROM services WHERE name = ?');
  const ins = db.prepare('INSERT INTO services (name, description, unit, unit_price, sort) VALUES (?, ?, ?, 0, ?)');
  const upd = db.prepare('UPDATE services SET description = ?, sort = ? WHERE id = ?');
  const OLD = new Set(['Design à votre identité, jusqu’à 6 pages, trilingue FR, EN, AR, adapté au téléphone', 'Création, vérification et optimisation complète de la fiche', 'Catalogue, panier, paiement en ligne (CMI) ou à la livraison, gestion des commandes', 'Réservations, espace client, tableau de bord', 'Domaine, hébergement rapide, HTTPS, sauvegardes', 'Mises à jour, sécurité, modifications mineures, support WhatsApp']);
  CATALOGUE.forEach(([n, d, u], i) => { const r = has.get(n); if (!r) ins.run(n, d, u, i); else if (!r.description || OLD.has(r.description)) upd.run(d, i, r.id); });
  for (const old of ['Référencement Google et IA', 'Nom de domaine et hébergement', 'Rédaction et traduction']) db.prepare('UPDATE services SET active = 0 WHERE name = ? AND unit_price = 0').run(old);
}
const STEPS = ['Brief et identité', 'Maquette validée', 'Développement', 'Textes SEO et GEO', 'Fiche Google', 'Mise en ligne'];

module.exports = { db, settings, saveSettings, nextNumber, DB_PATH, STEPS };
