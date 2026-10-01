# Digilago Gestion

Votre espace privé pour **gérer toute l’entreprise** : demandes du site, devis, projets, acomptes, factures, paiements, dépenses et rapports. Au design du site (ciel, nuages, verre), relié au site.

## Ce qu'il fait

- **Superviseur, en haut du tableau de bord** : la carte du Maroc s'allume ville par ville avec vos clients, avec l'objectif « allumer tout le Maroc » suivi région par région (12 régions). Une lecture intelligente de l'entreprise s'affiche à côté : encaissements en hausse ou en baisse, taux d'acceptation, projets en retard, informations manquantes, devis à relancer, prochaine région à allumer. Juste en dessous, « Le travail fait » montre votre site et chaque site client livré.
- **Informations à réunir** : chaque projet affiche ce qu'il manque (adresse, ICE, logo, couleurs, photos, horaires, domaine souhaité, accès à la fiche Google…), avec un pourcentage. Envoyez au client son **lien de brief** par WhatsApp : il remplit tout lui-même, et la fiche se met à jour.

- **Devis en 1 minute** : un client (existant ou nouveau), des prestations tirées de votre catalogue, et c'est prêt. Totaux, remise, TVA, acompte et solde se calculent en direct.
- **Numérotation automatique et continue** par année : `DG-D-2026-0001` pour les devis, `DG-F-2026-0001` pour les factures.
- **Lien client** : le client consulte le devis, le télécharge en PDF et **l'accepte en ligne** (nom, date, case à cocher). Vous voyez quand il l'a ouvert.
- **Envoi en un clic** par WhatsApp ou e-mail, avec le lien.
- **Acompte, solde, facture totale** : depuis un devis accepté, une facture d'acompte (au pourcentage choisi), puis une facture de solde qui déduit automatiquement l'acompte déjà facturé.
- **Paiements** : virement, espèces, chèque, carte… Statut automatique : à payer, partiellement payée, payée, en retard.
- **Tableau de bord** : encaissé du mois, reste à encaisser, devis en attente, taux d'acceptation, devis à relancer (avec bouton WhatsApp), factures en retard, encaissements des 6 derniers mois.
- **Demandes du site** : chaque formulaire « Démarrer un projet » et « Contact » arrive ici. Un clic sur « Faire le devis » pré-remplit le client.
- **Documents pro** : PDF A4 à vos couleurs, montant en toutes lettres (« Arrêté le présent devis à la somme de… »), RIB, mentions légales marocaines (ICE, IF, RC, Patente, CNSS), case « Bon pour accord ».
- **Projets** : chaque devis accepté ouvre un projet, suivi en tableau (à démarrer, en cours, en validation, livré) avec ses étapes : brief et identité, maquette validée, développement, textes SEO et GEO, fiche Google, mise en ligne.
- **Dépenses** : hébergement, domaines, logiciels, publicité, sous-traitance… avec la TVA déductible.
- **Rapports** par année : chiffre d’affaires HT, encaissé, dépenses, résultat de trésorerie et estimation de la TVA à reverser, mois par mois.
- **Catalogue en langage professionnel** : site sur mesure, code optimisé et performance, rédaction SEO, optimisation GEO (moteurs de réponse IA), nom de domaine offert la première année (affiché « Offert » sur le devis), hébergement sécurisé, fiche Google, boutique, application, traduction, maintenance. Les prix restent à fixer par vous.
- **Exports CSV** (factures, paiements, dépenses) pour votre comptable, et **sauvegarde complète** en un clic.

## Lancer en local

```bash
cd backend
npm install
npm start           # http://localhost:3000
```

À la première visite, choisissez votre mot de passe, puis complétez **Paramètres** (ICE, RIB…) et vos **Prestations** (vos prix).

Node.js 22.13 ou plus récent est nécessaire (la base de données SQLite est intégrée à Node, rien d'autre à installer).

## Mettre en ligne

Il faut un hébergement **avec un disque persistant** (la base de données est un fichier).

### Option 1 : Render (le plus simple)
1. Envoyez le dépôt sur GitHub.
2. Sur render.com : **New → Blueprint**, choisissez le dépôt : le fichier `render.yaml` configure tout (service web + disque de 1 Go).
3. Ajoutez la variable `ADMIN_PASSWORD` (ou choisissez le mot de passe à la première visite).
4. Ajoutez votre sous-domaine, par exemple `gestion.digilago.ma`, dans **Settings → Custom Domain**.

### Option 2 : un VPS avec Docker (le plus économique)
```bash
cd backend
docker compose up -d --build     # la base est gardée dans backend/data
```
Placez ensuite un proxy HTTPS devant (Caddy, Nginx) pour `gestion.digilago.ma`.

### Option 3 : Railway, Fly.io…
Utilisez le `Dockerfile` et montez un volume sur `/data`.

## Relier le site

Pour que les demandes du site arrivent dans l'espace de gestion :
1. Sur GitHub : **Settings → Secrets and variables → Actions → Variables** → ajoutez `GESTION_URL` = `https://gestion.digilago.ma`.
2. Dans l'hébergement de la gestion, mettez `SITE_ORIGIN` = `https://digilago.ma`.
3. Republiez le site : les formulaires envoient alors chaque demande à WhatsApp **et** dans « Demandes du site ».

## Variables

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute (fourni par l'hébergeur) |
| `ADMIN_PASSWORD` | Mot de passe initial (facultatif) |
| `DB_PATH` | Fichier de la base, sur le disque persistant |
| `SITE_ORIGIN` | Adresse du site autorisée à envoyer des demandes |
| `NODE_ENV` | `production` pour des cookies sécurisés (HTTPS) |

## Sauvegardes

**Paramètres → Télécharger la sauvegarde complète** télécharge toute la base. Faites-le au moins une fois par semaine, ou copiez le fichier `DB_PATH` automatiquement.

## Tests

```bash
npm test   # installation, devis, acceptation en ligne, acompte, paiements, solde, demandes du site, projets, dépenses, rapports
```
