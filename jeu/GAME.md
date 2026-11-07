# LAGO, allume le Maroc : notes de construction (V2, jeu de plateforme)

Jeu web (paysage d'abord, s'adapte au portrait), assemblé en une seule page : site/lago/index.html.
Sans compte, sans publicité, sans donnée envoyée : la progression reste en localStorage (`lago-allume-le-maroc-v2`).
La mesure d'audience (GA4) ne part que si le visiteur l'a acceptée sur digilago.ma (`dg_consent`).

## L'histoire
Vu de l'espace, la nuit, chaque lumière est une entreprise que l'on trouve en ligne : le Maroc est encore peu éclairé
(31 % des entreprises ont un site, HCP). Lago, le D de Digilago, part allumer le pays, ville par ville.
Une ville = un niveau. Casablanca est jouable (trois quartiers) ; Rabat, Marrakech, Fès et Tanger arrivent.

## Les quartiers de Casablanca
- La médina : Radar prête la Lanterne (allumer un commerce), Salma la photographe donne un cœur en plus.
- La Corniche : Cumulus offre le double saut, la bulle WhatsApp et le ballon font rebondir (au contact), Youssef
  l'apporteur d'affaires propose un accord écrit.
- Le quartier d'affaires : Mehdi le développeur confie l'épingle Google (grappin), ascenseurs avec pause en bas et en
  haut, montée finale jusqu'au phare.
Chaque commerce allumé passe « En ligne », affiche en petit l'adresse de son site (exemple fictif, levels.js : DOMS) et
une note « à quoi ressemble le site de ce métier » (levels.js : METIERS ; `land` accueillera les captures de landings).
À la fin du niveau : le nom de votre entreprise s'allume, et le code cadeau LAGO-CASA (fiche Google offerte, conditions
sur digilago.ma/offres.html) mène à « Démarrer un projet » (?source=jeu-lago&code=LAGO-CASA).

## Fichiers
- gen/build_assets2.py : les dessins (Lago et ses tenues, personnages, façades) → src/assets.js
- gen/globe.mjs : les points du globe (world-atlas) → src/globe.js
- src/levels.js (niveaux, métiers, adresses), src/engine.js (physique au 1/120 s, lumière, rendu), src/ui.js (écrans,
  globe, dialogues, cartes de fin), src/audio.js (WebAudio), src/style.css
- build.py : assemble tout ; écrit dist/ et, dans le dépôt du site, site/lago/index.html
- bot.cjs : Playwright, vérifie que chaque passage difficile est franchissable (serveur local sur le port 4190, dossier serve/)

## Règles de marque
Lago toujours heureux, expressions symétriques, ne montre jamais du doigt. Entreprises, clients et adresses fictifs.
