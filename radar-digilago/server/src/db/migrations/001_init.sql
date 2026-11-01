-- Digilago Lead Finder — schéma initial (PostgreSQL 14+)
-- Principes : identifiant interne stable, provenance + date pour chaque donnée,
-- corrections manuelles protégées (locked_fields), historique (audit_log, merges).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------- Utilisateurs & rôles ----------
CREATE TYPE user_role AS ENUM ('admin', 'operator', 'sales', 'readonly');

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  role          user_role NOT NULL DEFAULT 'readonly',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,              -- sha256 du jeton ; le jeton brut n'est jamais stocké
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  ip          text,
  user_agent  text
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

-- ---------- Recherches (jobs de découverte) ----------
CREATE TYPE job_status AS ENUM ('pending', 'running', 'done', 'partial', 'error', 'cancelled');

CREATE TABLE discovery_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    uuid REFERENCES users(id),
  label         text,
  params        jsonb NOT NULL,              -- ville, rayon, secteurs, mots-clés, sources, limites, options
  sources       text[] NOT NULL,
  status        job_status NOT NULL DEFAULT 'pending',
  counters      jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_reports jsonb NOT NULL DEFAULT '[]'::jsonb, -- par source : ok/erreur, nb résultats, tronqué, attribution
  errors        jsonb NOT NULL DEFAULT '[]'::jsonb,
  coverage_note text,
  est_cost      numeric(10,4),
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  parent_job_id uuid REFERENCES discovery_jobs(id),  -- relance
  city_id       text,
  progress      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { tiles_done, tiles_total, found, fresh }
  log           jsonb NOT NULL DEFAULT '[]'::jsonb    -- journal lisible : [{ at, tag, msg }]
);

-- Tuiles de balayage : la base de la carte de couverture
CREATE TABLE scan_tiles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     uuid NOT NULL REFERENCES discovery_jobs(id) ON DELETE CASCADE,
  city_id    text,
  source     text NOT NULL,
  label      text NOT NULL,
  south      double precision NOT NULL,
  west       double precision NOT NULL,
  north      double precision NOT NULL,
  east       double precision NOT NULL,
  depth      integer NOT NULL DEFAULT 0,
  status     text NOT NULL DEFAULT 'todo',   -- todo | running | done | split | partial | error
  results    integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scan_tiles_job_idx ON scan_tiles(job_id);
CREATE INDEX scan_tiles_city_idx ON scan_tiles(city_id, status);

-- ---------- Entreprises ----------
CREATE SEQUENCE company_ref_seq START 1;

CREATE TABLE companies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref              text NOT NULL UNIQUE DEFAULT ('DLG-' || lpad(nextval('company_ref_seq')::text, 6, '0')),
  name             text NOT NULL,
  name_normalized  text NOT NULL,
  legal_name       text,
  description      text,
  sector           text,
  subsector        text,
  keywords         text[] NOT NULL DEFAULT '{}',
  activity_status  text NOT NULL DEFAULT 'unknown',     -- active | inactive | unknown
  city             text,
  city_id          text,                               -- zone de référence (domain/cities.ts)
  region           text,
  country          text NOT NULL DEFAULT 'MA',
  lat              double precision,                   -- établissement principal (pour la carte)
  lon              double precision,

  -- Présence numérique (jamais une certitude d'absence : voir web_presence_basis)
  web_presence        text NOT NULL DEFAULT 'unknown',  -- unknown | not_found | social_only | ok | unreachable | outdated | not_mobile | slow | incomplete
  web_presence_basis  jsonb NOT NULL DEFAULT '{}'::jsonb, -- sources consultées, date, raisons
  whatsapp_status     text NOT NULL DEFAULT 'unknown',  -- confirmed | official_link_found | unconfirmed | absent | unknown

  -- Diagnostic 4 piliers (site, fiche Google, référencement, visibilité IA)
  site_class          text NOT NULL DEFAULT 'unknown',  -- unknown | not_found | social_only | google_generated | unreachable | basic_template | correct | good
  site_cms            text,                             -- wordpress | wix | google_sites | ... (si détecté)
  google_profile      jsonb NOT NULL DEFAULT '{}'::jsonb, -- { exists, rating, reviews, has_hours, photos, has_website, maps_url, status, at }
  presence_score      integer,                          -- 0-100 : maturité de la présence digitale (haut = déjà bien équipé)
  segment             text,                             -- la « case » : no_site | social_or_generated | weak_site | good_site | unknown
  pitch_angle         text,                             -- argument d'approche proposé
  pillars             jsonb NOT NULL DEFAULT '{}'::jsonb, -- détail par pilier { site:{score,checks}, google:{...}, seo:{status}, ai:{status} }
  origin              text NOT NULL DEFAULT 'existing',   -- existing | new_registration (porte d'entrée)
  registered_at       date,                             -- date de création légale si connue

  -- Commercial
  score            integer,
  score_band       text,                               -- high | review | medium | low | excluded | client
  confidence       text NOT NULL DEFAULT 'low',        -- high | medium | low
  suggested_service text,
  crm_status       text NOT NULL DEFAULT 'new',
  owner_id         uuid REFERENCES users(id),
  next_action      text,
  next_action_at   timestamptz,
  tags             text[] NOT NULL DEFAULT '{}',
  do_not_contact   boolean NOT NULL DEFAULT false,

  -- Qualité & provenance
  field_provenance jsonb NOT NULL DEFAULT '{}'::jsonb, -- { champ: { source, at, url? } }
  locked_fields    text[] NOT NULL DEFAULT '{}',       -- champs corrigés à la main : jamais écrasés par une synchro
  needs_review     boolean NOT NULL DEFAULT false,
  review_reasons   text[] NOT NULL DEFAULT '{}',
  merged_into      uuid REFERENCES companies(id),
  is_demo          boolean NOT NULL DEFAULT false,     -- données fictives de démonstration

  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  enriched_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX companies_name_trgm ON companies USING gin (name_normalized gin_trgm_ops);
CREATE INDEX companies_city_idx ON companies(city);
CREATE INDEX companies_sector_idx ON companies(sector);
CREATE INDEX companies_score_idx ON companies(score DESC NULLS LAST);
CREATE INDEX companies_crm_idx ON companies(crm_status);
CREATE INDEX companies_segment_idx ON companies(segment);
CREATE INDEX companies_created_idx ON companies(created_at DESC);
CREATE INDEX companies_cityid_idx ON companies(city_id);
CREATE INDEX companies_active_idx ON companies(merged_into) WHERE merged_into IS NULL;

-- Établissements physiques (succursales, agences, points de vente)
CREATE TABLE locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label         text,
  address       text,
  neighborhood  text,
  city          text,
  region        text,
  postcode      text,
  country       text NOT NULL DEFAULT 'MA',
  lat           double precision,
  lon           double precision,
  is_primary    boolean NOT NULL DEFAULT false,
  source        text NOT NULL,
  collected_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX locations_company_idx ON locations(company_id);
CREATE INDEX locations_geo_idx ON locations(lat, lon);

-- Références sources : l'identifiant externe n'est jamais l'identifiant universel
CREATE TABLE source_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  location_id   uuid REFERENCES locations(id) ON DELETE SET NULL,
  source        text NOT NULL,
  external_id   text NOT NULL,
  source_name   text,                                 -- nom tel que publié par la source (sert au dédoublonnage même après correction manuelle)
  source_name_normalized text,
  source_url    text,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- données brutes minimales
  attribution   text,
  job_id        uuid REFERENCES discovery_jobs(id) ON DELETE SET NULL,
  collected_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,                          -- rétention imposée par la source
  UNIQUE (source, external_id)
);
CREATE INDEX source_records_company_idx ON source_records(company_id);
CREATE INDEX source_records_name_trgm ON source_records USING gin (source_name_normalized gin_trgm_ops);

-- Téléphones / emails / WhatsApp — un canal par ligne, jamais confondus
CREATE TABLE contacts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('phone', 'email', 'whatsapp')),
  value_raw        text NOT NULL,
  value_normalized text NOT NULL,
  phone_type       text,          -- fixed | mobile | unknown (estimé depuis le plan de numérotation)
  email_type       text,          -- general | sales | contact | other
  verification     text NOT NULL DEFAULT 'unverified', -- unverified | published_link | confirmed_manual | invalid
  source           text NOT NULL,
  source_url       text,
  collected_at     timestamptz NOT NULL DEFAULT now(),
  is_manual        boolean NOT NULL DEFAULT false,
  UNIQUE (company_id, kind, value_normalized)
);
CREATE INDEX contacts_value_idx ON contacts(kind, value_normalized);

CREATE TABLE websites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url             text NOT NULL,
  domain          text NOT NULL,
  official_status text NOT NULL DEFAULT 'probable',  -- confirmed | probable | rejected
  source          text NOT NULL,
  source_url      text,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  http_status     integer,
  final_url       text,
  uses_https      boolean,
  languages       text[] NOT NULL DEFAULT '{}',
  last_checked_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  UNIQUE (company_id, domain)
);
CREATE INDEX websites_domain_idx ON websites(domain);

CREATE TABLE website_audits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    uuid NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ran_at        timestamptz NOT NULL DEFAULT now(),
  tool          text NOT NULL,
  tool_version  text NOT NULL,
  classification text NOT NULL,
  metrics       jsonb NOT NULL DEFAULT '{}'::jsonb,
  checks        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{id, ok, detail}]
  limits        text,
  error         text
);
CREATE INDEX website_audits_company_idx ON website_audits(company_id, ran_at DESC);

CREATE TABLE social_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  platform        text NOT NULL,
  url             text NOT NULL,
  official_status text NOT NULL DEFAULT 'probable', -- confirmed | linked_from_official_site | probable | rejected
  source          text NOT NULL,
  source_url      text,
  collected_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, url)
);

-- ---------- Scoring ----------
CREATE TABLE lead_scores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  score        integer NOT NULL,
  band         text NOT NULL,
  confidence   text NOT NULL,
  rule_version text NOT NULL,
  signals      jsonb NOT NULL,      -- [{id, label, points, evidence}]
  suggested_service text,
  computed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_scores_company_idx ON lead_scores(company_id, computed_at DESC);

-- ---------- Déduplication ----------
CREATE TABLE merge_candidates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_a   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_b   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  level       text NOT NULL CHECK (level IN ('certain', 'probable', 'weak')),
  signals     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'pending', -- pending | merged | rejected
  decided_by  uuid REFERENCES users(id),
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_a, company_b)
);

CREATE TABLE merges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survivor_id uuid NOT NULL REFERENCES companies(id),
  merged_id   uuid NOT NULL REFERENCES companies(id),
  reason      text NOT NULL,        -- auto:<règle> | manual
  moved       jsonb NOT NULL,       -- ids déplacés, pour annulation
  done_by     uuid REFERENCES users(id),
  done_at     timestamptz NOT NULL DEFAULT now(),
  undone_at   timestamptz,
  undone_by   uuid REFERENCES users(id)
);

-- ---------- CRM ----------
CREATE TABLE crm_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id),
  type        text NOT NULL,  -- note | task | contact | status_change | assignment | correction
  content     text,
  channel     text,           -- phone | email | whatsapp | visit | other
  outcome     text,           -- no_answer | interested | not_interested | wrong_contact | wrong_number | callback | other
  due_at      timestamptz,
  done_at     timestamptz,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_activities_company_idx ON crm_activities(company_id, created_at DESC);
CREATE INDEX crm_tasks_open_idx ON crm_activities(due_at) WHERE type = 'task' AND done_at IS NULL;

CREATE TABLE lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  goal        text,
  filters     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE list_items (
  list_id     uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, company_id)
);

-- Liste d'exclusion « ne pas contacter » : par entreprise, téléphone, email ou domaine
CREATE TABLE do_not_contact (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       text NOT NULL CHECK (scope IN ('company', 'phone', 'email', 'domain')),
  value       text NOT NULL,
  reason      text NOT NULL,
  requested_by text,               -- origine de la demande (ex. « appel du gérant »)
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, value)
);

-- ---------- Traçabilité ----------
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id),
  entity     text NOT NULL,
  entity_id  text,
  action     text NOT NULL,
  diff       jsonb,
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log(entity, entity_id);

CREATE TABLE export_log (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id),
  format     text NOT NULL,
  filters    jsonb NOT NULL,
  columns    text[] NOT NULL,
  row_count  integer NOT NULL,
  at         timestamptz NOT NULL DEFAULT now()
);

-- Consommation des sources (quotas, coût estimé)
CREATE TABLE source_usage (
  source     text NOT NULL,
  day        date NOT NULL,
  requests   integer NOT NULL DEFAULT 0,
  results    integer NOT NULL DEFAULT 0,
  errors     integer NOT NULL DEFAULT 0,
  est_cost   numeric(10,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (source, day)
);

-- ---------- File de tâches asynchrones (sans Redis : SKIP LOCKED) ----------
CREATE TABLE task_queue (
  id          bigserial PRIMARY KEY,
  type        text NOT NULL,          -- discovery | enrich | audit | score
  payload     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'queued', -- queued | running | done | failed
  attempts    integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  run_after   timestamptz NOT NULL DEFAULT now(),
  locked_at   timestamptz,
  last_error  text,
  job_id      uuid REFERENCES discovery_jobs(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX task_queue_ready_idx ON task_queue(run_after) WHERE status = 'queued';
CREATE INDEX task_queue_job_idx ON task_queue(job_id);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
