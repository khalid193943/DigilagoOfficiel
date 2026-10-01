# Digilago — site web

Site vitrine de Digilago : 13 pages statiques, rapides et prêtes à être publiées.
Aucun serveur n'est nécessaire : les formulaires (« Démarrer un projet » et « Contact ») envoient la demande directement sur WhatsApp.

---

## Ce que contient le dépôt

| Dossier / fichier | Rôle |
|---|---|
| `site/` | **Le site prêt à publier.** C'est ce dossier que l'hébergeur doit servir. |
| `src/` | Les sources : gabarits de l'accueil (`head.html`, `body.html`, `script.html`), générateur des autres pages, styles (`css_*.txt`), textes des guides (`guides/`), et les scripts de construction. |
| `tests/` | Les tests automatiques du site (Playwright). |
| `.github/workflows/deploy.yml` | Teste puis publie automatiquement le site sur GitHub Pages à chaque envoi sur `main`. |
| `netlify.toml`, `vercel.json` | Configuration prête si vous préférez Netlify ou Vercel. |

Les 13 pages : accueil, services, réalisations, à propos, contact, démarrer un projet, guides (et 4 guides), mentions légales, confidentialité, plus une page 404, un `sitemap.xml` et un `robots.txt`.

---

## Mettre le site en ligne

Le site et l'espace de gestion sont hébergés sur **Vercel**, relié à ce dépôt GitHub : chaque envoi sur la branche `main` met en ligne automatiquement le site (`www.digilago.ma`, dossier `site/`) et la gestion (`gestion.digilago.ma`, dossier `backend/`). Une autre branche crée des **versions de prévisualisation** (liens privés, visibles une fois connecté à Vercel).

À chaque envoi, GitHub lance aussi les tests (`.github/workflows/deploy.yml`) : le site dans les 3 langues dans un vrai navigateur, et la gestion. Une coche verte = tout fonctionne.

---

## Tester en local

```bash
pip install -r requirements.txt
python -m playwright install chromium

npm run start      # ou : make serve  → http://localhost:4173
npm run test       # ou : make test   → 43 tests
```

Les tests vérifient, sur un vrai navigateur :

- chaque page s'ouvre sans erreur, avec son titre, son `h1` et son pied de page ;
- aucun lien interne ni aucune image n'est cassé ;
- l'accueil se parcourt jusqu'en bas sans erreur, les quatre réponses changent au défilement, et la version téléphone s'active ;
- sur téléphone, le menu plein écran s'ouvre et se ferme ;
- « Démarrer un projet » va jusqu'au bout et ouvre WhatsApp avec la demande complète ;
- le formulaire de contact ouvre WhatsApp avec le message.

---

## Modifier puis reconstruire

Le dossier `site/` est la version publiée. Les optimisations (vitesse, design, SEO) sont des **sources lisibles** appliquées par des scripts idempotents : on peut les relancer autant de fois que l'on veut.

| Fichier | Rôle |
|---|---|
| `src/js/home.js` | Script de l'accueil (moteur de défilement : ne travaille que pendant le défilement, aucune mesure forcée). |
| `src/js/pages.js` | Script de toutes les autres pages. |
| `src/js/common.js` | Commun : animations en pause hors écran, carte du monde chargée à la demande. |
| `src/css/perf.css` | Fluidité : apparitions sans flou, calques GPU, plus de décalage de mise en page. |
| `src/css/design.css` | Retouches de design, section par section, ordinateur et téléphone. |
| `tools/build.py` | Lance toutes les étapes ci-dessous dans l'ordre. |
| `tools/simplify_map.py` | Carte du monde allégée (886 Ko → 231 Ko) et chargée à la demande. |
| `tools/design_html.py` | Retouches de contenu de l'accueil (carte, quartiers, « Pourquoi un site ? »). |
| `tools/dedupe_pages.py` | Retire les blocs en double entre les pages. |
| `tools/fonts.py` | Polices hébergées sur le site (5 fichiers, 130 Ko) et préchargées. |
| `tools/inject.py` | Minifie et injecte `src/js` et `src/css` dans chaque page. |
| `tools/seo.py` | Canonique, Open Graph, Twitter, Schema.org (entreprise, articles, FAQ), sitemap. |
| `tools/i18n_build.py` | Génère les versions anglaise (`site/en/`) et arabe (`site/ar/`), et le sélecteur de langue. |
| `tools/i18n_extract.py` | Relève les textes français à traduire dans `src/i18n/strings.json`. |
| `tools/og_image.py` | Régénère l'image de partage 1200 × 630 depuis l'accueil (`npm run og`). |

Après une modification :

```bash
npm run build      # ou : make build   (Node.js requis pour la minification)
npm run test       # 43 tests dans un vrai navigateur
```

Puis envoyez sur GitHub : le workflow `.github/workflows/deploy.yml` teste et publie tout seul.

> **Important.** Si vous régénérez les pages avec le générateur d'origine (`src/build.py`, `gen_pages.py`… dont une partie des sources n'est pas dans ce dépôt), utilisez `npm run build:pages` : il relance ensuite `tools/build.py` pour réappliquer toutes les optimisations.

### Trois langues : français, anglais, arabe

- Les pages françaises (`site/*.html`) sont la référence. Les versions anglaise (`site/en/`) et arabe (`site/ar/`) en sont générées : mêmes animations, même vitesse.
- Traductions : `src/i18n/en.json` et `src/i18n/ar.json` (une entrée par texte, clé = empreinte du texte français dans `src/i18n/strings.json`). Messages des scripts (formulaires, WhatsApp…) : liste dans `src/i18n/js_fr.json`.
- Après avoir modifié un texte français : `python3 tools/i18n_extract.py` indique les textes nouveaux à traduire ; ajoutez-les dans `en.json` et `ar.json`, puis `npm run build`. Un texte non traduit reste en français, rien ne casse.
- Arabe : polices IBM Plex Sans Arabic et Noto Naskh Arabic (pour les accents en italique), lecture de droite à gauche, menus et pied de page en miroir.
- Chaque page annonce ses équivalents (`hreflang`) et le plan du site (`sitemap.xml`) liste les 3 langues : Google montre à chacun la bonne version.

Variables utiles : `SITE_URL` (adresse utilisée dans les balises canoniques et le sitemap, par défaut `https://www.digilago.ma`, l'adresse finale : `digilago.ma` redirige vers `www`).

---

## Espace de gestion : devis, acomptes, factures

Le dossier `backend/` contient **Digilago Gestion**, votre espace privé pour créer des devis en une minute, les faire accepter en ligne, facturer l'acompte puis le solde, et suivre les paiements. Voir `backend/README.md` pour le lancer et l'héberger.

## Front-end et back-end

- **Front-end :** HTML, CSS et JavaScript sans framework ni dépendance, pour la vitesse. Les polices viennent de Google Fonts.
- **Back-end :** `backend/` (Node.js, SQLite intégré). Les demandes partent sur WhatsApp au **+212 6 49 95 38 13** et, si `GESTION_URL` est configurée, arrivent aussi dans l'espace de gestion.

---

## Ajouter l'exemple d'un métier

1. Mettez la capture pleine page dans `src/landings/metiers/`, nommée comme le métier en minuscules sans accents, avec des tirets : `psychologue.webp`, `cabinet-d-avocats.webp`, `restaurant-marocain.webp`…
2. Lancez `python src/landings/build_styles.py` puis `npm run build`.

Le métier affiche alors son propre exemple, avec l'étiquette « Idée de site pour ce métier ».

Pour un secteur entier, mettez une seule landing dans `src/landings/secteurs/`, nommée comme la clé du secteur : `restauration.webp`, `hotellerie.webp`, `commerce.webp`, `immobilier.webp`, `sport.webp`, `beaute.webp`, `industrie.webp`, `juridique.webp`, `tourisme.webp`, `services.webp`. Tous les types d'entreprise du secteur l'utilisent (sauf ceux qui ont leur propre landing).

## À faire avant l'ouverture officielle

- Compléter les zones marquées « [À compléter] » des pages Mentions légales et Confidentialité.
- Vérifier le téléphone et l'e-mail affichés partout.
- Relire les fourchettes de prix du guide « Combien coûte un site web au Maroc en 2026 ? ».
- Remplacer `https://www.digilago.ma` dans `SITE_URL` si le domaine est différent, puis reconstruire.
- Ajouter vos autres réalisations (captures dans `src/trust_imgs.json`).
- Ajouter les exemples des autres domaines : images dans `src/landings/`, listes dans `build_showcase.py`, domaines dans `build_styles.py` (page « À quoi ressemblera votre site ? »), puis `python landings/build_showcase.py && python landings/build_styles.py` et `npm run build`.

---

Conçu et codé à El Jadida.
