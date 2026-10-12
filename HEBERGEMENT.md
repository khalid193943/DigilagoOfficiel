# Mettre Digilago en ligne : le site et l'espace de gestion

Le projet contient deux choses, hébergées séparément mais envoyées ensemble sur GitHub :

| | Dossier | Adresse | Ce que c'est |
|---|---|---|---|
| **Le site** | `site/` | `https://www.digilago.ma` | Pages prêtes à servir (français, anglais, arabe). Aucun serveur. |
| **La gestion** | `backend/` | `https://gestion.digilago.ma` | Serveur Node.js + base de données : demandes du site, devis, factures, paiements. |

Le site envoie chaque formulaire (« Démarrer », « Contact », « On vous rappelle ») à la gestion. Sur « Démarrer », le client choisit quand être rappelé et voit une confirmation ; si l'envoi échoue, la page propose de réessayer ou d'envoyer la demande sur WhatsApp : aucune demande n'est perdue.

---

## 1. Envoyer le projet sur GitHub

Le dépôt est `github.com/khalid193943/DigilagoOfficiel`. La façon la plus sûre est **GitHub Desktop** (l'interface web de GitHub refuse plus de 100 fichiers par envoi) :

1. Ouvrez le dépôt dans GitHub Desktop.
2. Dans le dossier du dépôt sur votre ordinateur, **supprimez tout sauf le dossier caché `.git`** (sinon d'anciens fichiers resteraient).
3. Copiez-y le contenu du zip `DigilagoOfficiel`.
4. Écrivez un titre (« Nouvelle version »), cliquez **Commit to main**, puis **Push origin**.

Ne mettez jamais sur GitHub : un fichier `.env`, un mot de passe, ou un fichier `.db` (les données de vos clients). Le fichier `.gitignore` les écarte déjà.

---

## 2. Le site sur Vercel

Si le projet Vercel du site existe déjà et est relié au dépôt, **il n'y a rien à faire** : chaque envoi sur GitHub le remet en ligne en une à deux minutes.

Sinon, pour le créer :

1. Sur vercel.com : **Add New → Project**, choisissez le dépôt `DigilagoOfficiel`.
2. **Root Directory** : laissez la racine du dépôt (le fichier `vercel.json` indique déjà le dossier `site`).
3. **Framework Preset** : *Other*. **Build Command** : laissez vide (le site est déjà construit).
4. **Deploy**.
5. **Settings → Domains** : ajoutez `www.digilago.ma` et `digilago.ma`, puis faites rediriger `digilago.ma` vers `www.digilago.ma`. Vercel indique les enregistrements DNS à créer chez votre registrar.

---

## 3. La gestion sur Vercel, avec la base Turso

Vercel n'a pas de disque permanent : la base de données est chez **Turso** (compatible SQLite), branchée en quelques clics.

1. Sur vercel.com : **Add New → Project**, choisissez **le même dépôt**.
2. **Root Directory** : `backend`. **Framework Preset** : *Other*.
3. Avant de déployer, onglet **Storage → Create Database → Turso** (ou **Marketplace → Turso**), puis liez la base au projet. Vercel ajoute seul `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN`.
4. **Settings → Environment Variables**, ajoutez :

   | Variable | Valeur |
   |---|---|
   | `ADMIN_PASSWORD` | votre mot de passe de connexion |
   | `SESSION_SECRET` | une longue phrase secrète, au hasard (40 caractères ou plus) |
   | `SITE_ORIGIN` | `https://digilago.ma` (la version avec `www` est acceptée automatiquement) |
   | `NODE_ENV` | `production` |
   | `BANK_RIB` | le RIB de LAGODIGITAL (24 chiffres, celui de l'attestation du Crédit Agricole). Il s'imprime sur les devis et factures ; il reste hors du dépôt, qui est public |

5. **Deployments → Redeploy**. Les tables se créent toutes seules à la première visite.
6. **Settings → Domains** : ajoutez `gestion.digilago.ma`, puis l'enregistrement DNS indiqué par Vercel.
7. Connectez-vous sur `https://gestion.digilago.ma`, puis **Paramètres → Adresse de cet espace en ligne** = `https://gestion.digilago.ma`.

Vous avez alors **deux projets Vercel reliés au même dépôt** : un envoi sur GitHub met les deux à jour.

L'adresse de la gestion utilisée par le site est déjà réglée (`src/gestion_url.txt` = `https://gestion.digilago.ma`). Pour en changer : `python3 tools/set_gestion_url.py https://nouvelle-adresse`, puis renvoyez sur GitHub.

---

## 4. Vérifier que tout marche (5 minutes)

1. Ouvrez `https://www.digilago.ma` sur votre téléphone : la carte du Maroc s'affiche avec ses petits cadres « votre-….ma — En ligne », puis s'éloigne vers le monde en faisant défiler (cadres .fr, .ae, .ca…, reliés à El Jadida par une ligne dorée).
2. Changez de langue (FR, EN, عربي) : la version arabe se lit de droite à gauche.
3. Page **Démarrer** : choisissez un besoin, mettez votre prénom et votre numéro, choisissez quand être rappelé, puis envoyez. L'écran « C'est reçu » s'affiche avec le moment choisi.
4. Ouvrez `https://gestion.digilago.ma` → **Demandes** : la demande de l'étape 3 est dans « À appeler », avec le moment de rappel et sa chaleur (Très chaud, Chaud…).
5. Si elle n'y est pas : vérifiez `SITE_ORIGIN` (étape 3.4) et l'adresse de la gestion (étape 3.7).

---

## Autres hébergements possibles

- **Le site** : n'importe quel hébergement de fichiers (Netlify : `netlify.toml` est prêt ; ou tout serveur web) en publiant le dossier `site/`.
- **La gestion** : un serveur classique avec Docker (`backend/Dockerfile`, `backend/docker-compose.yml`) ou Render (`backend/render.yaml`). La base est alors un fichier (`DB_PATH`) sur un disque persistant.

## Sauvegardes

Dans la gestion : **Paramètres → Télécharger la sauvegarde complète**, au moins une fois par semaine. Turso garde aussi un historique de la base.

## Tester avant d'envoyer (facultatif, sur ordinateur)

```bash
pip install -r requirements.txt && python -m playwright install chromium
npm run test                     # le site : 300 tests dans un vrai navigateur
cd backend && npm ci && npm test # la gestion : 25 tests
```
