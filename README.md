# Mel d’antan

Le carnet de recettes de bougies de Mélanie : une appli pour noter les recettes de bougies, pensée pour la tablette.

- **Recettes** : nom, photo de la création, contenant au choix (verrine, coupe de glace, verre double paroi
  cappuccino, verre à café liégeois, mug en verre, bocal, ramequin, tasse à café, pot de yaourt en verre,
  pot à confiture, verre à whisky, coupe à champagne, verre à pied, bol, tasse à thé ancienne) ou bougie moulée
  (macaron, tartelette, cupcake, gâteau à étages, donut, éclair, bûche, cookie, madeleine, religieuse, cannelé,
  fraise, pomme, citron, cerises) : les couches remplissent alors la forme, couches du bas vers le haut.
  Chaque couche a ses produits pris dans l'inventaire avec leur quantité (500 g de cire de soja, 3 gouttes de colorant bleu…),
  une couleur et un aspect (lisse, chantilly, mousse, marbré, paillettes, morceaux, granité).
- **Contenance** : chaque contenant et moule a une contenance moyenne en grammes de cire (« ≈ 230 g »), remplaçable
  par celle du vrai verre dans la recette ; le niveau du dessin suit les grammes et l’appli prévient si ça déborde.
- **Aperçu** : à gauche, le contenant dessiné avec les couches dedans, à la hauteur de leur poids en grammes ;
  une chantilly en dernière couche fait un dôme au-dessus du verre.
- **Fiche** : quantités pour ½, 1, 2, 3 ou 4 bougies ; « J'ai coulé » retire les quantités de l'inventaire ;
  les produits en quantité insuffisante s'affichent en orange.
- **Approuvé** : une recette réussie reçoit le tampon Mel d’antan « Approuvé » (encre chocolat). Elle reste modifiable.
- **Mon livre** : les recettes en livre (couverture, sommaire, une recette par page sur papier café ligné, photo en polaroïd),
  pages qui tournent du doigt ; deux pages à l’horizontale, une à la verticale ; toutes les recettes ou les approuvées seulement ; bouton « Plein écran » (croix ou retour pour sortir).
- **PDF** : « Partager en PDF » sur une recette, ou « Partager le livre en PDF » (message, e-mail, WhatsApp, Fichiers, impression).
- **Mel** (onglet avec sa mascotte) : l’assistante d’atelier, qui tutoie Mel. Elle connaît tout le carnet (recettes, notes,
  inventaire, stock) et répond sur la fabrication : quantités, calculs, températures, mèches, défauts, idées de bougies.
  Elle peut proposer une fiche de recette (bouton « Ouvrir dans l’éditeur »). Dictée au micro, lecture à voix haute.
  Bouton 📷 : Mel regarde une photo de bougie et conseille (avec Claude). « Dessine-moi… » : Mel dessine une idée de bougie
  (IA d’images gratuite de Cloudflare, Workers AI), à télécharger ou à mettre en photo d’une recette.
  Pastille de Mel en bas de chaque page : la conversation s’ouvre par-dessus la page en cours (volet à droite en version
  site, panneau du bas en version appli) ; Mel sait quelle page est ouverte et propose des questions à propos.
  « Corriger Mel » sous chaque réponse : la bonne information est retenue (Réglages › Ce que Mel a appris), partagée entre
  les appareils et respectée en priorité. Une mention « IA gratuite » signale les réponses de l’IA de Cloudflare.
  La conversation reste sur l’appareil et fait partie de la sauvegarde.
- **Accueil** : bonjour, chiffres de l’atelier (recettes, approuvées, stocks bas), logo, astuce de Mel du jour.
- **Version** : « v1.0 » à côté du bouton Version appli / site ; bandeau de Mel et notification quand une mise à jour est prête.
- **Alertes de stock** : quand un produit passe sous son seuil (« M’alerter sous »), Mel apparaît en dessin avec sa bulle,
  et envoie une notification si elle est activée (Réglages › Notifications de Mel). Les notifications partent du serveur
  (Web Push, clés créées toutes seules) : elles arrivent même appli fermée. Les nouvelles versions sont annoncées par la
  tâche planifiée (toutes les 15 min, `triggers` dans `wrangler.jsonc`).
- **Inventaire** : cires, colorants (avec leur couleur), parfums, mèches, décors, additifs ; stock et seuil d'alerte facultatifs.
- **Affichage** : l’appli reconnaît l’appareil (Android, iPhone / iPad, ordinateur). Version appli (onglets en bas) sur téléphone
  et sur tablette à la verticale ; version site (menu en haut, page large) sur ordinateur et sur tablette à l’horizontale.
  Le bouton « Version site / Version appli » de l’en-tête change à la main ; sur tablette, tourner l’écran revient à l’automatique.
- **Réglages** : sauvegarde dans un fichier (recettes + photos + inventaire), restauration, thème clair / sombre.

Logo : `logo.jpg` (dans l’en-tête et sur l’accueil) ; icônes de l’appli tirées du même dessin (`icon-*.png`, `apple-touch-icon.png`, `favicon-48.png`).

**Carnet partagé** : sur la version Cloudflare, recettes, photos et inventaire sont synchronisés entre tous les appareils
(base D1 `mel-dantan`, créée toute seule au déploiement, protégée par `CODE_MEL`). Au premier passage d’un appareil qui a
déjà son propre carnet, l’appli demande : réunir les deux, prendre celui en ligne, ou garder celui de l’appareil.
La conversation avec Mel reste propre à chaque appareil.

Tout est aussi enregistré sur l’appareil (IndexedDB) et l'appli marche sans internet une fois installée.
Penser à faire une sauvegarde de temps en temps.

## Mel sur Cloudflare (une seule fois)
Mel a besoin d’un petit serveur (`worker.js`) : l’appli est donc publiée sur Cloudflare, qui la redéploie toute seule
à chaque envoi sur GitHub.
1. Cloudflare › Workers & Pages › Créer › Importer un dépôt Git › choisir `Mel-d-antan` › Déployer
   (Cloudflare lit `wrangler.jsonc` ; rien à régler).
2. L’appli est en ligne à `https://mel-d-antan.<compte>.workers.dev` : c’est cette adresse à installer sur la tablette.
   Mel répond tout de suite avec l’IA gratuite de Cloudflare (Workers AI, quota gratuit chaque jour).
3. Facultatif, dans Workers › mel-d-antan › Paramètres › Variables et secrets :
   - `ANTHROPIC_API_KEY` : Mel répond avec Claude (meilleures réponses en français ; payant à l’usage,
     quelques centimes par question, clé sur console.anthropic.com) ;
   - quand les crédits Claude du mois sont épuisés (ou la limite de dépense atteinte), Mel passe toute seule sur l’IA
     gratuite de Cloudflare et réessaie Claude toutes les 6 h ; si Claude est surchargé un instant, Cloudflare répond aussi ;
   - `CODE_MEL` : un code que l’appli demande une fois, pour que personne d’autre ne parle à Mel (conseillé avec Claude).
Les fichiers listés dans `.assetsignore` (serveur, réglages) ne sont jamais servis en ligne.
Essai local sans compte : `npm install` puis `node essai-local.mjs` (fausse IA).

## Mettre en ligne
Le dépôt se publie tel quel sur n'importe quel hébergeur de pages statiques (ici GitHub Pages : Settings › Pages › branche `main`, dossier `/ (root)`).
Il doit être servi en `https://` pour pouvoir être installé sur la tablette :
- iPad : Safari › Partager › « Sur l'écran d'accueil » ;
- Android : Chrome › ⋮ › « Installer l'application ».

## Publier une nouvelle version
1. `index.html` : augmenter `VERSION` (ex. 1.0 → 1.1) ; c’est le « v1.1 » affiché en haut.
2. `sw.js` : même numéro dans `VERSION`.
3. `version.json` : même numéro, date et nouveautés (affichées dans le bandeau « Mettre à jour »).
L’appli voit la nouvelle version (à l’ouverture, au retour dans l’appli, toutes les 30 min), affiche le bandeau de Mel
et, si c’est activé dans Réglages, envoie une notification ; elle s’installe quand Mel touche « Mettre à jour ».

`vendor/jspdf.umd.min.js` : bibliothèque libre jsPDF 2.5.1 (licence MIT, voir `vendor/LICENCE-jspdf.txt`) pour fabriquer les PDF sans internet.
