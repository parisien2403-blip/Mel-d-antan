# Mel d’antan

Le carnet de recettes de bougies de Mélanie : une appli pour noter les recettes de bougies, pensée pour la tablette.

- **Recettes** : nom, photo de la création, contenant au choix (verrine, coupe de glace, verre double paroi
  cappuccino, verre à café liégeois, mug en verre, bocal, ramequin, tasse à café), couches du bas vers le haut.
  Chaque couche a ses produits pris dans l'inventaire avec leur quantité (500 g de cire de soja, 3 gouttes de colorant bleu…),
  une couleur et un aspect (lisse, chantilly, mousse, marbré, paillettes, morceaux, granité).
- **Aperçu** : à gauche, le contenant dessiné avec les couches dedans, à la hauteur de leur poids en grammes ;
  une chantilly en dernière couche fait un dôme au-dessus du verre.
- **Fiche** : quantités pour ½, 1, 2, 3 ou 4 bougies ; « J'ai coulé » retire les quantités de l'inventaire ;
  les produits en quantité insuffisante s'affichent en orange.
- **Inventaire** : cires, colorants (avec leur couleur), parfums, mèches, décors, additifs ; stock et seuil d'alerte facultatifs.
- **Réglages** : sauvegarde dans un fichier (recettes + photos + inventaire), restauration, thème clair / sombre.

Logo : `logo.jpg` (dans l’en-tête et sur l’accueil) ; icônes de l’appli tirées du même dessin (`icon-*.png`, `apple-touch-icon.png`, `favicon-48.png`).

Tout est enregistré sur l’appareil (IndexedDB) et l'appli marche sans internet une fois installée.
Penser à faire une sauvegarde de temps en temps.

## Mettre en ligne
Le dépôt se publie tel quel sur n'importe quel hébergeur de pages statiques (ici GitHub Pages : Settings › Pages › branche `main`, dossier `/ (root)`).
Il doit être servi en `https://` pour pouvoir être installé sur la tablette :
- iPad : Safari › Partager › « Sur l'écran d'accueil » ;
- Android : Chrome › ⋮ › « Installer l'application ».

Nouvelle version : augmenter `CACHE` dans `sw.js`.
