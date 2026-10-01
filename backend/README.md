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

En local, la base est un simple fichier (`backend/data/digilago.db`), créé tout seul. À la première visite, choisissez votre mot de passe, puis complétez **Paramètres** et **Prestations**.

## Mettre en ligne sur Vercel (avec la base Turso)

Vercel n'a pas de disque permanent : la base de données est donc chez **Turso**, une base compatible SQLite qui se branche à Vercel en un clic. Le code est déjà prêt pour les deux.

1. **Créer le projet** : sur vercel.com, **Add New → Project**, choisissez votre dépôt GitHub, puis dans **Root Directory** choisissez **`backend`**. Framework : **Other**. Ne lancez pas encore le déploiement, ou laissez-le échouer : c'est normal sans base.
2. **Brancher la base** : dans le projet, onglet **Storage → Create Database → Turso** (ou **Marketplace → Turso**). Liez-la au projet : Vercel ajoute tout seul `TURSO_DATABASE_URL` et `TURSO_AUTH_TOKEN`.
3. **Ajouter les variables** (**Settings → Environment Variables**) :
   - `ADMIN_PASSWORD` : votre mot de passe ;
   - `SESSION_SECRET` : une longue phrase secrète au hasard ;
   - `SITE_ORIGIN` : `https://digilago.ma` ;
   - `NODE_ENV` : `production`.
4. **Déployer** (**Deployments → Redeploy**). Les tables se créent toutes seules à la première visite.
5. **Votre adresse** : **Settings → Domains** → `gestion.digilago.ma`, puis l'enregistrement DNS indiqué par Vercel chez votre registrar.
6. **Dans l'espace** : **Paramètres → Adresse de cet espace en ligne** = `https://gestion.digilago.ma`.

Si les noms des variables Turso sont différents chez vous, `LIBSQL_URL` et `LIBSQL_AUTH_TOKEN` fonctionnent aussi.

## Relier le site

1. Dans le dossier principal : `python tools/set_gestion_url.py https://gestion.digilago.ma`
2. Envoyez sur GitHub : le site redéployé envoie chaque demande à WhatsApp **et** dans « Demandes du site ».

## Autres hébergements

`Dockerfile`, `docker-compose.yml` et `render.yaml` restent disponibles pour un serveur classique : la base est alors un fichier (`DB_PATH`) sur un disque persistant.

## Sauvegardes

**Paramètres → Télécharger la sauvegarde complète** télécharge toutes vos données (format JSON). Faites-le au moins une fois par semaine. Turso garde aussi un historique de votre base.

## Tests

```bash
npm test   # installation, devis, acceptation en ligne, acompte, paiements, solde, demandes du site, projets, dépenses, rapports
```
