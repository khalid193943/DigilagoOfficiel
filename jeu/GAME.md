# LAGO, allume le Maroc : notes de construction (V1)

Jeu web mobile d'abord (portrait 9:16, s'adapte au paysage), un seul fichier HTML à la fin (dist/jeu.html),
hors ligne, sans compte, sans pub, sans donnée envoyée. Progression en localStorage (try/catch).
Ensuite : page Lab « LAB-03 Lago » sur digilago.ma, puis Capacitor pour Google Play et l'App Store.

## Fichiers
- build_assets.py : exporte les SVG (Lago v2 + costumes, Radar, Gestion, humains, décors Casablanca, carte) → src/assets.js
- src/style.css, src/audio.js (WebAudio, synthèse), src/engine.js (état, scènes, sauvegarde, HUD), src/minigames.js, src/content.js (villes, entreprises, textes)
- build.py : assemble tout dans dist/jeu.html (polices en base64)
- test.cjs : Playwright, captures des scènes + parcours automatique

## Boucle (V1 = Casablanca complète, Rabat « bientôt »)
Titre → intro (4 cartes) → carte du Maroc → Casablanca : deux quartiers (la médina : commerces ; le quartier d'affaires : grands comptes)
Mission d'une entreprise :
1. Radar trouve (tap au passage du balayage, 3 touches)
2. Appel découverte : Lago entre dans Cumulus, ressort en tenue du métier → mini-jeu du métier (10-15 s)
3. Gestion fait le devis (choisir exactement les bons blocs : étoile « prix juste »)
4. Lago construit en « 72 h » (20 s) : poser les blocs du site dans l'ordre, écraser les bugs
5. En ligne : fenêtres (site), repère Google, étincelle IA ; étoiles Prix / Délai / Réponse ; Lumière et Confiance montent
Systèmes : messages clients « le jour même » (répondre à temps), Cumulus et maintenance (immeuble qui clignote),
Youssef l'apporteur d'affaires (accord écrit → débloque un grand compte), recrutement d'Anas le stagiaire (aide à répondre),
fin : « Et votre entreprise ? » → nom tapé → s'allume → Démarrer mon projet (digilago.ma/demarrer.html?source=jeu-lago).

## Règles de marque
Lago toujours heureux, expressions symétriques, travaille avec tablette/téléphone/ordinateur, ne montre jamais du doigt.
Ambiance « Le jour se lève » : la ville part de la nuit et s'éclaire avec la Lumière. Entreprises fictives (mention dans les crédits).
