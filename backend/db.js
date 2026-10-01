'use strict';
/* Base de données libSQL (compatible SQLite).
   En local : un fichier (DB_PATH). En ligne sur Vercel : Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN). */
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@libsql/client');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'digilago.db');
/* La base Turso est trouvée quel que soit le préfixe choisi dans Vercel (TURSO_DATABASE_URL, STORAGE_URL…) */
const ENV = process.env;
const urlKey = ['TURSO_DATABASE_URL', 'LIBSQL_URL', 'DATABASE_URL'].find((k) => /^(libsql|https?|wss?):\/\//.test(ENV[k] || '')) || Object.keys(ENV).find((k) => /_URL$/.test(k) && /^libsql:\/\//.test(ENV[k] || ''));
const REMOTE = urlKey ? ENV[urlKey] : '';
const prefix = urlKey ? urlKey.replace(/(_DATABASE)?_URL$/, '') : '';
const TOKEN = ENV.TURSO_AUTH_TOKEN || ENV.LIBSQL_AUTH_TOKEN || (prefix && (ENV[prefix + '_AUTH_TOKEN'] || ENV[prefix + '_DATABASE_AUTH_TOKEN'] || ENV[prefix + '_TOKEN'])) || (Object.keys(ENV).find((k) => /AUTH_TOKEN$/.test(k) && /TURSO|LIBSQL|DATABASE|STORAGE/.test(k)) ? ENV[Object.keys(ENV).find((k) => /AUTH_TOKEN$/.test(k) && /TURSO|LIBSQL|DATABASE|STORAGE/.test(k))] : '');
if (!REMOTE) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const client = createClient(REMOTE ? { url: REMOTE, authToken: TOKEN || undefined } : { url: 'file:' + DB_PATH });

const plain = (rs) => rs.rows.map((r) => { const o = {}; rs.columns.forEach((c, i) => { const v = r[i]; o[c] = typeof v === 'bigint' ? Number(v) : v; }); return o; });
function api(ex) {
  const run1 = async (sql, args) => ex.execute({ sql, args: args.map((a) => (a === undefined ? null : a)) });
  return {
    prepare: (sql) => ({
      get: async (...a) => plain(await run1(sql, a))[0],
      all: async (...a) => plain(await run1(sql, a)),
      run: async (...a) => { const r = await run1(sql, a); return { changes: r.rowsAffected, lastInsertRowid: Number(r.lastInsertRowid ?? 0) }; },
    }),
  };
}
const db = {
  ...api(client),
  exec: (sql) => client.executeMultiple(sql),
  /* transaction d'écriture : await db.tx(async (t) => { await t.prepare(…).run(…) }) */
  async tx(fn) { const t = await client.transaction('write'); try { const out = await fn(api(t)); await t.commit(); return out; } catch (e) { try { await t.rollback(); } catch (_) {} throw e; } finally { t.close(); } },
  client,
};

const DEFAULTS = {
  company_name: 'Digilago', company_tagline: 'Sites web, Google et IA pour les entreprises marocaines',
  company_address: 'El Jadida, Maroc', company_phone: '+212 6 49 95 38 13', company_email: 'contact@digilago.ma',
  company_site: 'digilago.ma', company_ice: '', company_if: '', company_rc: '', company_patente: '', company_cnss: '',
  company_legal: '', bank_name: '', bank_rib: '', bank_swift: '',
  default_tva: '20', default_deposit: '50', default_validity: '30', default_delay: 'Première version en 72 heures',
  default_due_days: '15',
  default_conditions: "Le présent devis, signé ou accepté en ligne, vaut bon de commande.\nUn acompte est exigible à la commande ; les travaux démarrent à sa réception. Le solde est payable à la mise en ligne du site.\nLe nom de domaine est offert la première année ; l’hébergement de la première année est inclus sauf mention contraire.\nLes contenus (textes, photos, logo) fournis par le client restent sa propriété. Le site livré et ses sources sont cédés au client après paiement intégral.\nDeux séries de modifications sont incluses à chaque étape de validation.",
  quote_prefix: 'DG-D', invoice_prefix: 'DG-F', whatsapp: '212649953813', public_url: '',
  signature: 'Khalid, Digilago', google_review_url: '', wa_verify_token: '',
  fiscal_regime: '', tva_assujetti: '1', tva_periodicite: 'trimestrielle', tva_regime: 'encaissement', fiscal_year_start: '01',
  accountant_name: '', accountant_email: '', accountant_phone: '', accountant_token: '',
  acc_revenue: '71243', acc_revenue_export: '7125', acc_clients: '3421', acc_bank: '5141', acc_cash: '5161', acc_suppliers: '4411', acc_tva_out: '4455', acc_tva_in: '34552', acc_stamp: '4457',
  wa1_label: 'WhatsApp Business', wa1_number: '212649953813', wa1_phone_id: '', wa1_token: '',
  wa2_label: 'WhatsApp 2', wa2_number: '', wa2_phone_id: '', wa2_token: '',
  mail1_label: 'contact@digilago.ma', mail1_address: 'contact@digilago.ma', mail1_smtp_host: '', mail1_smtp_port: '465', mail1_imap_host: '', mail1_imap_port: '993', mail1_user: '', mail1_pass: '', mail1_last_uid: '0',
  mail2_label: 'E-mail 2', mail2_address: '', mail2_smtp_host: '', mail2_smtp_port: '465', mail2_imap_host: '', mail2_imap_port: '993', mail2_user: '', mail2_pass: '', mail2_last_uid: '0',
};
const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS counters (scope TEXT, year INTEGER, value INTEGER, PRIMARY KEY (scope, year));
CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, name TEXT NOT NULL, company TEXT, ice TEXT, phone TEXT, email TEXT, address TEXT, city TEXT, notes TEXT, whatsapp TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, unit TEXT DEFAULT 'forfait', unit_price REAL DEFAULT 0, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY, name TEXT, company TEXT, phone TEXT, email TEXT, need TEXT, message TEXT, source TEXT, status TEXT DEFAULT 'nouveau', quote_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS quotes (id INTEGER PRIMARY KEY, number TEXT UNIQUE, client_id INTEGER REFERENCES clients(id), title TEXT, status TEXT DEFAULT 'brouillon', issue_date TEXT, valid_until TEXT, tva_rate REAL DEFAULT 20, discount_pct REAL DEFAULT 0, deposit_pct REAL DEFAULT 50, delay TEXT, notes TEXT, conditions TEXT, token TEXT UNIQUE, sent_at TEXT, viewed_at TEXT, accepted_at TEXT, accepted_name TEXT, total_ht REAL DEFAULT 0, total_tva REAL DEFAULT 0, total_ttc REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS quote_items (id INTEGER PRIMARY KEY, quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE, position INTEGER, label TEXT, description TEXT, qty REAL DEFAULT 1, unit TEXT, unit_price REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY, number TEXT UNIQUE, quote_id INTEGER REFERENCES quotes(id), client_id INTEGER REFERENCES clients(id), kind TEXT, title TEXT, issue_date TEXT, due_date TEXT, tva_rate REAL DEFAULT 20, total_ht REAL DEFAULT 0, total_tva REAL DEFAULT 0, total_ttc REAL DEFAULT 0, notes TEXT, token TEXT UNIQUE, cancelled INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY, invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE, position INTEGER, label TEXT, description TEXT, qty REAL DEFAULT 1, unit TEXT, unit_price REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE, date TEXT, amount REAL, method TEXT, reference TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, quote_id INTEGER UNIQUE REFERENCES quotes(id), client_id INTEGER REFERENCES clients(id), title TEXT, status TEXT DEFAULT 'a_demarrer', due_date TEXT, site_url TEXT, steps TEXT, notes TEXT, info TEXT, token TEXT, created_at TEXT DEFAULT (datetime('now')), delivered_at TEXT);
CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, date TEXT, supplier TEXT, category TEXT, label TEXT, amount_ttc REAL DEFAULT 0, tva REAL DEFAULT 0, method TEXT, project_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, number TEXT UNIQUE, quote_id INTEGER UNIQUE REFERENCES quotes(id), client_id INTEGER REFERENCES clients(id), issue_date TEXT, total_ttc REAL DEFAULT 0, token TEXT UNIQUE, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY, invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE, level INTEGER, channel TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, channel TEXT, direction TEXT, ckey TEXT, contact TEXT, name TEXT, client_id INTEGER, lead_id INTEGER, subject TEXT, body TEXT, status TEXT, template TEXT, ext_id TEXT, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS i_msg_ckey ON messages(ckey);
CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY, key TEXT UNIQUE, step TEXT, title TEXT, subject TEXT, fr TEXT, ar TEXT, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS tax_periods (id INTEGER PRIMARY KEY, kind TEXT, period TEXT, status TEXT DEFAULT 'a_preparer', amount REAL, reference TEXT, declared_at TEXT, paid_at TEXT, notes TEXT, UNIQUE(kind, period));
CREATE TABLE IF NOT EXISTS locks (month TEXT PRIMARY KEY, locked_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS acc_notes (id INTEGER PRIMARY KEY, period TEXT, author TEXT, text TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS lead_notes (id INTEGER PRIMARY KEY, lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE, kind TEXT, text TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY, kind TEXT, ref_id INTEGER, text TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS i_quotes_client ON quotes(client_id);
CREATE INDEX IF NOT EXISTS i_inv_quote ON invoices(quote_id);
CREATE INDEX IF NOT EXISTS i_pay_inv ON payments(invoice_id);
`;
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
  ['Landing page', 'Page unique orientée conversion pour une offre ou une campagne : message clair, preuves, formulaire et WhatsApp.', 'forfait'],
  ['Refonte et migration', 'Reprise d’un site existant : audit, nouveau design, reprise des contenus et redirections 301 pour conserver le référencement acquis.', 'forfait'],
  ['Transfert du nom de domaine', 'Reprise du nom de domaine existant : transfert ou configuration DNS, sans coupure du site ni des e-mails.', 'forfait'],
  ['Création de logo et charte', 'Logo, déclinaisons, palette de couleurs et typographies, livrés en fichiers prêts à l’emploi.', 'forfait'],
  ['Photos professionnelles', 'Séance photo sur place ou sélection d’images libres de droits adaptées à votre activité.', 'forfait'],
  ['Paiement en ligne', 'Intégration du paiement par carte (CMI ou autre passerelle) et des confirmations de commande.', 'forfait'],
  ['Prise de rendez-vous en ligne', 'Réservation de créneaux, confirmations et rappels automatiques pour vos clients.', 'forfait'],
  ['E-mails professionnels', 'Adresses e-mail à votre nom de domaine (contact@votresite.ma), configurées sur ordinateur et téléphone.', 'an'],
  ['Rapport mensuel SEO', 'Suivi mensuel des positions Google, des visites et des appels, avec recommandations.', 'mois'],
];
const STEPS = ['Brief et identité', 'Maquette validée', 'Développement', 'Textes SEO et GEO', 'Fiche Google', 'Mise en ligne'];

/* Initialisation : rapide quand la base est à jour (1 requête), complète et groupée sinon (quelques requêtes) */
const SCHEMA_VERSION = '2026-10-01.8';
const COLUMNS = [['projects', 'info', 'TEXT'], ['projects', 'token', 'TEXT'], ['clients', 'whatsapp', 'TEXT'],
  ['quotes', 'plan', 'TEXT'], ['quotes', 'pack', 'TEXT'],
  ['invoices', 'sched_idx', 'INTEGER'], ['invoices', 'credit_of', 'INTEGER'], ['invoices', 'label', 'TEXT'],
  ['payments', 'number', 'TEXT'], ['payments', 'token', 'TEXT'], ['payments', 'stamp', 'REAL'],
  ['projects', 'tech', 'TEXT'], ['projects', 'launch', 'TEXT'], ['projects', 'situation', 'TEXT'], ['projects', 'kind', 'TEXT'], ['projects', 'sector', 'TEXT'],
  ['clients', 'website', 'TEXT'], ['clients', 'sector', 'TEXT'], ['clients', 'source', 'TEXT'], ['clients', 'if_num', 'TEXT'], ['clients', 'is_foreign', 'INTEGER'],
  ['leads', 'stage', 'TEXT'], ['leads', 'lost_reason', 'TEXT'], ['leads', 'next_at', 'TEXT'], ['leads', 'notes', 'TEXT'], ['leads', 'city', 'TEXT'], ['leads', 'sector', 'TEXT'], ['leads', 'budget', 'TEXT'], ['leads', 'kind', 'TEXT'], ['leads', 'updated_at', 'TEXT'],
  ['expenses', 'supplier_ice', 'TEXT'], ['expenses', 'supplier_if', 'TEXT'], ['expenses', 'invoice_ref', 'TEXT'], ['expenses', 'receipt_url', 'TEXT'], ['expenses', 'account', 'TEXT'], ['expenses', 'deductible', 'INTEGER']];
let ready = null;
function init() {
  if (ready) return ready;
  ready = (async () => {
    try { const v = (await db.prepare("SELECT value FROM settings WHERE key = '_schema'").get()); if (v && v.value === SCHEMA_VERSION) return; } catch (e) { /* première installation */ }
    if (!REMOTE) await db.exec('PRAGMA journal_mode = WAL;');
    await db.exec(SCHEMA);
    /* colonnes ajoutées au fil des versions : une lecture par table, puis tous les ajouts en une fois */
    const tables = [...new Set(COLUMNS.map((c) => c[0]))], have = {};
    const info = await client.batch(tables.map((t) => `PRAGMA table_info(${t})`), 'read');
    tables.forEach((t, i) => { have[t] = new Set(info[i].rows.map((r) => r.name || r[1])); });
    const alters = COLUMNS.filter(([t, c]) => !have[t].has(c)).map(([t, c, d]) => `ALTER TABLE ${t} ADD COLUMN ${c} ${d}`);
    if (alters.length) await client.batch(alters, 'write');
    /* réglages, catalogue et modèles par défaut : une seule écriture groupée */
    const TPL = require('./lib/templates').DEFAULT, st = [];
    for (const [k, v] of Object.entries(DEFAULTS)) st.push({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: [k, v] });
    CATALOGUE.forEach(([n, d, u], i) => st.push({ sql: 'INSERT INTO services (name, description, unit, unit_price, sort) SELECT ?, ?, ?, 0, ? WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = ?)', args: [n, d, u, i, n] }));
    for (const t of TPL) st.push({ sql: 'INSERT OR IGNORE INTO templates (key, step, title, subject, fr, ar, sort) VALUES (?,?,?,?,?,?,?)', args: [t.key, t.step, t.title, t.subject, t.fr, t.ar, t.sort] });
    st.push("UPDATE leads SET stage = CASE status WHEN 'devis' THEN 'proposition' WHEN 'traitee' THEN 'contacte' ELSE 'nouveau' END WHERE stage IS NULL");
    st.push({ sql: "INSERT INTO settings (key, value) VALUES ('_schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [SCHEMA_VERSION] });
    await client.batch(st, 'write');
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

/* réglages : gardés en mémoire quelques secondes, rechargés à chaque enregistrement */
let SCACHE = null, SAT = 0;
async function settings() {
  if (SCACHE && Date.now() - SAT < 5000) return { ...SCACHE };
  const out = { ...DEFAULTS };
  for (const r of await db.prepare('SELECT key, value FROM settings').all()) out[r.key] = r.value;
  SCACHE = out; SAT = Date.now(); return { ...out };
}
async function saveSettings(obj) {
  const st = Object.keys(DEFAULTS).filter((k) => k in obj).map((k) => ({ sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', args: [k, String(obj[k] ?? '')] }));
  if (st.length) await client.batch(st, 'write');
  SCACHE = null;
}

/* Numérotation continue par année, sans trou : DG-D-2026-0001 */
async function nextNumber(scope, prefix, dateStr) {
  const year = Number((dateStr || new Date().toISOString()).slice(0, 4));
  return db.tx(async (t) => {
    const row = await t.prepare('SELECT value FROM counters WHERE scope = ? AND year = ?').get(scope, year);
    const v = (row ? row.value : 0) + 1;
    await t.prepare('INSERT INTO counters (scope, year, value) VALUES (?, ?, ?) ON CONFLICT(scope, year) DO UPDATE SET value = excluded.value').run(scope, year, v);
    return `${prefix}-${year}-${String(v).padStart(4, '0')}`;
  });
}

module.exports = { db, init, settings, saveSettings, nextNumber, DB_PATH, STEPS, REMOTE };
