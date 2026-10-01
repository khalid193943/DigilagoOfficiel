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

### Option 1 — GitHub Pages (automatique, recommandé)

1. Créez un dépôt sur GitHub et envoyez-y ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Site Digilago"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/digilago.git
   git push -u origin main
   ```
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. L'onglet **Actions** lance le workflow « Tester et publier le site » : il reconstruit le site, lance tous les tests, puis publie. L'adresse en ligne s'affiche à la fin (du type `https://VOTRE-COMPTE.github.io/digilago/`).
4. Pour votre domaine : **Settings → Pages → Custom domain** → `digilago.ma`, puis chez votre registrar un enregistrement `CNAME` vers `VOTRE-COMPTE.github.io`.

### Option 2 — Netlify ou Vercel

Importez le dépôt : le dossier à publier (`site`) est déjà configuré. Aucune commande de construction n'est nécessaire.

### Option 3 — N'importe quel hébergeur

Envoyez le **contenu** du dossier `site/` à la racine de votre hébergement (FTP ou gestionnaire de fichiers).

---

## Tester en local

```bash
pip install -r requirements.txt
python -m playwright install chromium

npm run start      # ou : make serve  → http://localhost:4173
npm run test       # ou : make test   → 41 tests
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

1. Modifiez les sources dans `src/` (textes de l'accueil dans `body.html`, autres pages dans `gen_pages.py`, guides dans `src/guides/articles.json`).
2. Reconstruisez :
   ```bash
   npm run build      # ou : make build
   ```
   Étapes : `build.py` (accueil) → `gen_pages.py` (autres pages) → `finalize.py` (images en WebP, CSS inutile retiré, CSS et JavaScript compressés) → `extras.py` (sitemap et robots).
3. Vérifiez avec `npm run test`, puis envoyez sur GitHub : la publication se fait toute seule.

Variables utiles : `SITE_URL` (adresse utilisée dans le sitemap, par défaut `https://digilago.ma`).

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
- Remplacer `https://digilago.ma` dans `SITE_URL` si le domaine est différent, puis reconstruire.
- Ajouter vos autres réalisations (captures dans `src/trust_imgs.json`).
- Ajouter les exemples des autres domaines : images dans `src/landings/`, listes dans `build_showcase.py`, domaines dans `build_styles.py` (page « À quoi ressemblera votre site ? »), puis `python landings/build_showcase.py && python landings/build_styles.py` et `npm run build`.

---

Conçu et codé à El Jadida.
