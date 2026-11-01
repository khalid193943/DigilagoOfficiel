# Radar Digilago

**Toutes les entreprises du Maroc, leur présence en ligne, et qui contacter aujourd’hui.**

Le Radar découvre les entreprises par ville et par métier, les dédoublonne, lit leur site officiel, établit un diagnostic de leur présence en ligne (site, fiche Google, puis référencement et visibilité IA), calcule un score d’opportunité **explicable**, et accompagne l’équipe commerciale jusqu’au client signé.

---

## Sommaire
1. [Ce que fait le Radar](#1-ce-que-fait-le-radar)
2. [Démarrage rapide (Docker)](#2-démarrage-rapide-docker)
3. [Développement local](#3-développement-local)
4. [Brancher Google Places](#4-brancher-google-places)
5. [OpenStreetMap, démo, import](#5-openstreetmap-démo-import)
6. [Mise en ligne (HTTPS)](#6-mise-en-ligne-https)
7. [Équipe et rôles](#7-équipe-et-rôles)
8. [Règles de confiance (non négociables)](#8-règles-de-confiance-non-négociables)
9. [Architecture](#9-architecture)
10. [Tests et vérifications](#10-tests-et-vérifications)
11. [Limites connues et feuille de route](#11-limites-connues-et-feuille-de-route)

---

## 1. Ce que fait le Radar

| Écran | Rôle |
|---|---|
| **Radar** (accueil) | Carte 3D du Maroc en hexagones calculés à partir des vraies données (densité, opportunités, couverture), balises par ville, caméra qui vole vers la ville choisie, flux en direct des détections, indicateurs. |
| **Balayages** | Choix région / ville / secteurs / mots-clés / sources ; estimation du coût **avant** de lancer ; découpage de la zone en tuiles, **redécoupage automatique** des tuiles saturées ; progression et journal en direct ; historique. |
| **Entreprises** | Vues (liste du jour, nouvelles, sans site, WhatsApp prouvé, à relancer, à valider), filtres partagés par l’URL, les 4 « cases », canaux disponibles, sélection multiple, aperçu rapide, ajout manuel, import Excel/CSV, export Excel/CSV. |
| **Fiche entreprise** | Contacts avec source, date et preuve ; diagnostic des 4 piliers ; **« Pourquoi ce score ? »** point par point ; message proposé (WhatsApp, email, Facebook, script d’appel) ; résultat du contact ; notes et tâches ; concurrents proches ; traçabilité ; corrections protégées ; « ne pas contacter ». |
| **Couverture** | Statut de chaque zone et des 12 régions, carte de couverture, matrice « qui trouve quoi » pour décider quelles sources valent leur prix. |
| **Pipeline** | Kanban glisser-déposer du premier contact au client signé, tâches à faire. |
| **Paramètres** | État et quotas des sources, file de travail, doublons à valider, équipe et rôles, purge des données de démonstration, ré-analyse, journal des actions, conformité. |

**Les 4 cases** (une seule offre, quatre arguments d’entrée) :
- **Aucun site trouvé** : « Vos clients vous cherchent en ligne et ne vous trouvent pas. »
- **Facebook / site Google** : « Vous existez, mais vous ne contrôlez pas votre image. »
- **Site basique** : « Votre site existe, mais il ne vous ramène pas de clients. »
- **Bon site** : « Passons au référencement et à la visibilité sur les IA. »

---

## 2. Démarrage rapide (Docker)

Prérequis : un serveur Linux (VPS 2 Go de RAM suffit pour commencer) avec Docker.

```bash
git clone <votre-dépôt> radar-digilago && cd radar-digilago
cp .env.example .env            # puis éditez .env (mot de passe base, clé Google…)
docker compose up -d --build    # base PostgreSQL + Radar

# Créer le premier administrateur
docker compose exec -e ADMIN_EMAIL=vous@digilago.ma -e ADMIN_PASSWORD='un-mot-de-passe-long' -e ADMIN_NAME='Votre Nom' \
  app node server/dist/scripts/seed-admin.js
```

Le Radar écoute sur `127.0.0.1:8080`. Placez un reverse-proxy HTTPS devant (section 6). Les migrations de la base s’appliquent automatiquement au démarrage.

---

## 3. Développement local

Prérequis : Node.js 22, PostgreSQL 14+.

```bash
npm install
createdb radar
export DATABASE_URL=postgres://localhost/radar
export DEMO_SOURCE_ENABLED=true ALLOW_PRIVATE_FETCH=true COOKIE_SECURE=false   # mode démo local
ADMIN_EMAIL=admin@local.ma ADMIN_PASSWORD=admin-local-123 npm run seed:admin
npm run dev        # API sur :8080, interface sur :5173 (proxy /api)
```

Commandes utiles : `npm test` (tests serveur sur une base dédiée `TEST_DATABASE_URL`), `npm run lint` (vérification des types), `npm run build`.

---

## 4. Brancher Google Places

C’est la source la plus complète au Maroc. Le Radar utilise **l’API officielle** (jamais d’aspiration de Google Maps).

1. Sur <https://console.cloud.google.com> : créer un projet, **activer la facturation**, activer **« Places API (New) »**.
2. Créer une **clé API**, la restreindre à « Places API (New) » et à l’adresse IP de votre serveur.
3. Dans `.env` :
   ```
   GOOGLE_PLACES_ENABLED=true
   GOOGLE_PLACES_API_KEY=votre-clé
   GOOGLE_PLACES_DAILY_LIMIT=200
   GOOGLE_PLACES_COST_PER_REQUEST=0.035
   ```
4. `docker compose up -d` pour redémarrer. La source apparaît « Active » dans Paramètres.

**Coût.** Le Radar demande téléphone, site, note et horaires : ces champs relèvent de la catégorie « Enterprise » de Google. À titre indicatif (fin 2026, à vérifier sur la grille officielle) : environ **35 $ pour 1 000 requêtes**, avec un petit volume gratuit chaque mois. Une ville moyenne coûte quelques dollars ; le plafond quotidien (`GOOGLE_PLACES_DAILY_LIMIT`) et le budget par balayage protègent contre les surprises. L’estimation s’affiche avant chaque lancement.

**Conservation.** Les conditions Google limitent la durée de conservation des contenus (hors identifiant de lieu). Chaque fiche Google porte une date de rafraîchissement (`GOOGLE_PLACES_RETENTION_DAYS`) ; alignez-la sur les conditions en vigueur.

---

## 5. OpenStreetMap, démo, import

- **OpenStreetMap** : gratuit, actif par défaut, interrogé une fois par zone, en respectant les règles d’usage d’Overpass. Couverture plus faible hors grandes villes. Pour un usage intensif, hébergez votre propre serveur Overpass (`OVERPASS_URL`).
- **Démonstration** (`DEMO_SOURCE_ENABLED=true`) : génère des entreprises **fictives** (badge « FICTIF », nom suffixé « (démo) »), avec de faux sites servis localement, pour essayer tout le parcours sans clé. **À désactiver en production.** Purge en un clic dans Paramètres › Données.
- **Ajout manuel** et **import Excel/CSV** (colonnes : Nom, Téléphone, Email, Site, Facebook, Instagram, WhatsApp, Ville, Secteur, Adresse) : les doublons sont détectés, chaque fiche garde la trace de son origine.

---

## 6. Mise en ligne (HTTPS)

> Dans le dépôt **DigilagoOfficiel**, le Radar vit dans le dossier `radar-digilago/` (à côté de `site/` et `backend/`). Sur Render, indiquer **Root Directory : `radar-digilago`**. Les projets Vercel du site et de la gestion ne sont pas concernés.

### Gratuit, pour tester : Render (Free) + base Neon (Free)

1. Base Neon gratuite, au choix :
   - depuis **Vercel** : onglet *Storage › Create Database › Neon* › plan **Free** › région Frankfurt › puis *Show secret* et copier `DATABASE_URL` ;
   - ou sur <https://neon.com> : créer un projet (région Frankfurt) et copier la *connection string*.

   Les deux adresses Neon (« pooled » ou directe) conviennent : le Radar passe tout seul en connexion directe, et il se reconnecte quand la base gratuite sort de veille.
2. <https://render.com> : *New › Web Service* › dépôt `DigilagoOfficiel` › **Root Directory : `radar-digilago`** › région Frankfurt › instance **Free**.
3. Variables : `DATABASE_URL` (Neon), `DATABASE_SSL=true`, `NODE_ENV=production`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
4. Ouvrir l’adresse `https://….onrender.com`, se connecter, puis retirer `ADMIN_PASSWORD`.

Limites du gratuit : le service s’endort après 15 min sans visite (≈ 1 min pour se réveiller) et les balayages n’avancent que lorsqu’il est réveillé. Pour un usage quotidien, passer l’instance en payant (7 $/mois) : la base Neon reste la même.

### Payant, tout en un : Render (fichier `render.yaml`)

`render.yaml` décrit tout : le Radar, sa base PostgreSQL (région Frankfurt), les variables et le domaine. Environ 13 $/mois (7 $ pour le Radar + 6 $ pour la base), prix fixe.

1. Mettre ce dossier dans un dépôt GitHub privé.
2. Sur <https://render.com> : *New › Blueprint* › connecter GitHub › choisir le dépôt.
3. Remplir `ADMIN_EMAIL`, `ADMIN_PASSWORD` (10 caractères minimum) et `ADMIN_NAME`, puis *Deploy Blueprint*.
4. Service `radar-digilago` › *Settings › Custom Domains* : `radar.digilago.ma` doit y figurer (sinon l’ajouter). Noter l’adresse en `.onrender.com` du service.
5. Sur Vercel : *Domains › digilago.ma › DNS Records › Add* : type **CNAME**, nom **radar**, valeur = l’adresse `.onrender.com`. Puis *Verify* sur Render : le HTTPS s’active tout seul.

### Autre option : `radar.digilago.ma` sur Railway, DNS chez Vercel

Le Radar a besoin d’un serveur toujours allumé (balayages et analyses en arrière-plan) et de PostgreSQL : il ne peut pas tourner dans les fonctions Vercel (coupées après quelques minutes). Les domaines restent gérés chez Vercel ; seul `radar` pointe vers Railway.

1. Mettre ce dossier dans un dépôt GitHub **privé**.
2. Sur <https://railway.com> : *New Project › Deploy from GitHub repo* › choisir le dépôt. Railway lit `railway.json` et construit le `Dockerfile`.
3. Dans le projet : *+ New › Database › PostgreSQL*.
4. Service Radar › *Variables* :
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   NODE_ENV=production
   PUBLIC_BASE_URL=https://radar.digilago.ma
   ADMIN_EMAIL=vous@digilago.ma
   ADMIN_PASSWORD=un-mot-de-passe-long
   ADMIN_NAME=Votre Nom
   ```
   (+ les variables Google de la section 4 quand la clé est prête.) Au premier démarrage, la base se crée et le premier administrateur aussi ; retirez ensuite `ADMIN_PASSWORD`.
5. Service Radar › *Settings › Networking › Custom Domain* : `radar.digilago.ma`. Railway affiche deux enregistrements : un **CNAME** et un **TXT** de vérification (les deux sont obligatoires).
6. Sur Vercel : *Domains › digilago.ma › DNS Records › Add* : type **CNAME**, nom **radar**, valeur = la cible donnée par Railway puis ajouter aussi le **TXT** avec le nom et la valeur donnés par Railway.
7. Après propagation (quelques minutes), Railway active le HTTPS : le Radar répond sur `https://radar.digilago.ma`.

Chaque `git push` sur le dépôt redéploie automatiquement.

### Alternative : serveur privé (VPS)

Exemple avec **Caddy** (certificat HTTPS automatique) sur le même serveur :

```
radar.digilago.ma {
    reverse_proxy 127.0.0.1:8080
    encode gzip
}
```

Alternatives : Railway, Render ou Fly.io pour l’application, avec une base PostgreSQL gérée (Neon, Supabase…) : renseignez `DATABASE_URL`, `NODE_ENV=production`, `PUBLIC_BASE_URL`.

Sauvegardes : `docker compose exec db pg_dump -U radar radar > sauvegarde.sql` (à automatiser quotidiennement).

Montée en charge : lancez un worker séparé (`INLINE_WORKER=false` sur l’API, `node server/dist/worker.js` dans un second conteneur). La file de tâches PostgreSQL permet plusieurs workers sans Redis.

---

## 7. Équipe et rôles

| Rôle | Peut |
|---|---|
| Administrateur | Tout, dont équipe, purge, annulation de fusion, journal |
| Opérateur | Lancer des balayages, corriger les fiches, valider les doublons |
| Commercial | Suivi, contacts, statuts, notes, tâches, exports |
| Lecture seule | Consulter |

---

## 8. Règles de confiance (non négociables)

- **Aucune donnée inventée.** Un champ inconnu reste inconnu. Les données de démonstration sont marquées partout.
- **« Aucun site trouvé » n’est pas « n’a pas de site »** : le diagnostic indique les sources consultées et la date.
- **WhatsApp jamais déduit** d’un numéro mobile : seulement si l’entreprise publie un lien `wa.me`, ou si un membre de l’équipe l’atteste.
- **Provenance et date** sur chaque coordonnée, dans la fiche et dans les exports.
- **Dédoublonnage prudent** : fusion automatique uniquement sur règle robuste (même téléphone ou domaine **et** nom proche, ou même nom au même endroit). Les cas ambigus vont en validation humaine. Toute fusion est traçable et réversible.
- **Corrections manuelles protégées** : un champ corrigé n’est plus jamais écrasé par un balayage.
- **Pas d’envoi automatique** : les messages s’ouvrent rédigés ; un humain les envoie un par un. Meta interdit l’automatisation de messages non sollicités sur WhatsApp, Messenger et Instagram, et un compte bloqué serait une perte bien plus grave.
- **« Ne pas contacter »** appliqué partout, y compris aux coordonnées qui réapparaissent plus tard.
- **Sécurité** : clés API côté serveur uniquement ; sessions en cookie `HttpOnly` ; protection CSRF ; limitation de débit sur la connexion ; protection contre l’accès au réseau interne lors de la lecture des sites (SSRF) ; respect de `robots.txt` et délai entre requêtes ; journal des actions sensibles.
- **Conformité** : avant un usage à grande échelle, faire valider la démarche par un juriste (loi 09-08) et, si nécessaire, déclarer le traitement à la CNDP.

---

## 9. Architecture

```
web/  (React + Vite)  ──HTTP/JSON + SSE──►  server/ (Fastify + TypeScript)  ──►  PostgreSQL
                                             │  routes : auth, radar, balayages, entreprises, données
                                             │  sources/  : google-places · osm-overpass · demo   (interface commune)
                                             │  jobs/     : file de tâches (SKIP LOCKED) · balayage par tuiles · analyse
                                             │  pipeline/ : ingestion + dédoublonnage + provenance
                                             │  enrich/   : lecture prudente des sites (robots.txt, SSRF, délais)
                                             │  audit/    : diagnostic des piliers, case, argument
                                             └  scoring/  : score explicable versionné
```

- **Ajouter une source** : écrire un adaptateur (`server/src/sources/types.ts` › `SourceAdapter`) et l’inscrire dans `registry.ts`. Le cœur ne change pas.
- **Ajouter un secteur ou un métier** : `server/src/domain/sectors.ts` (tags OpenStreetMap + mots-clés Google).
- **Ajouter une ville** : `server/src/domain/cities.ts`.
- **Temps réel** : PostgreSQL `LISTEN/NOTIFY` → Server-Sent Events. Marche même avec des workers dans d’autres processus.
- **Carte** : fond hexagonal du Maroc (frontières Natural Earth, Sahara inclus) ; colonnes 3D calculées dans le navigateur à partir des coordonnées réelles des entreprises.

Base de données : `server/src/db/migrations/001_init.sql` (entreprises, établissements, références sources, contacts, sites, audits, réseaux sociaux, scores, doublons, fusions, CRM, listes, « ne pas contacter », journal, exports, quotas, tuiles de balayage, file de tâches).

---

## 10. Tests et vérifications

`npm test` lance **37 tests** sur une vraie base PostgreSQL :
- normalisation (téléphones fixe/mobile, liens WhatsApp, noms, URL), dédoublonnage, lecture de site, robots.txt, audit, score ;
- adaptateurs Google et OpenStreetMap sur des réponses enregistrées (aucun appel réseau, la clé n’est jamais exposée) ;
- parcours complet : balayage démo par tuiles avec redécoupage, analyse des sites, cases, WhatsApp uniquement sur preuve, relance sans doublon, tableau de bord, carte, couverture, ajout manuel, fusion sûre / à valider / annulation, corrections protégées, CRM, exports CSV/XLSX filtrés avec provenance, « ne pas contacter » propagé, import CSV, droits par rôle, SSRF, CSRF.

Audit des dépendances de production : aucune vulnérabilité haute ou critique ; quelques avertissements « modérés » dans des sous-dépendances de la bibliothèque Excel et d’un utilitaire de fichiers, sur des chemins qui ne reçoivent pas d’entrée utilisateur. Gardez les dépendances à jour (`npm update`).

---

## 11. Limites connues et feuille de route

**Limites de la V1 (à connaître)**
- Les appels réels à Google Places et à Overpass n’ont pas pu être exécutés depuis l’environnement de développement (pas d’accès réseau sortant) : ils sont couverts par des tests sur réponses enregistrées. **Faites un premier balayage « Rapide » sur une petite zone** pour valider votre clé et vos quotas.
- Référentiel géographique : 20 zones urbaines. Le découpage officiel (≈ 1 500 communes) s’ajoute en important la liste des communes.
- Piliers 3 (référencement) et 4 (visibilité IA) : affichés « non mesurés » tant que la mesure n’est pas branchée.
- Recherche de site officiel : à partir des sources (Google, OSM, import). Une recherche web dédiée viendra en V2.

**V2 proposée**
1. Sources supplémentaires : Apple Maps, Foursquare, Azure Maps, HERE, TomTom (déjà prévues dans l’interface).
2. Veille des **nouvelles sociétés** (registre du commerce / annonces légales, selon l’accès obtenu) avec alerte « fenêtre idéale de contact ».
3. Mesure du **référencement** (position sur « métier + ville ») et de la **visibilité IA**.
4. **Diagnostic PDF** personnalisé à joindre au premier message, et maquette de démo par secteur.
5. Liste officielle des communes (HCP) : couverture commune par commune.
6. Extension Chrome « Ajouter au Radar » et ajout terrain sur mobile avec photo et position.
7. Leads entrants (publicités « clic vers WhatsApp », formulaires du site) reliés aux fiches, et coût par client signé.
