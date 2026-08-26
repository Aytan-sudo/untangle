# Untangle

Un écheveau de fils relie des sommets, et les fils se croisent. Tirez les
sommets jusqu’à ce qu’aucun fil n’en croise plus aucun autre. Jouable au doigt,
hors ligne, sans serveur ni dépendance.

Rien à deviner, rien à perdre, aucun coup irréversible : il n’y a qu’un nœud,
et il finit toujours par céder.

## La particularité : le dessin est unique

La plupart des démêleurs promettent qu’une solution existe. Celui-ci promet
davantage, et le prouve à l’écran quand vous avez fini.

Chaque écheveau est un graphe planaire **3-connexe** : on ne peut pas le couper
en deux en retirant moins de trois sommets. Le théorème de Whitney dit qu’un tel
graphe n’admet **qu’un seul dessin planaire**, à réflexion près. Autrement dit :
il n’y a pas plusieurs façons de démêler, il n’y en a qu’une. Quand vous avez
fini, vous n’avez pas trouvé *une* solution — vous avez retrouvé, sans le savoir,
exactement le dessin qui a servi à fabriquer la grille. Le bouton « Montrer le
dessin du générateur » superpose les deux ; c’est le même, retourné.

Ce que la garantie promet :

- zéro croisement est toujours atteignable, sur toute grille, à tout niveau ;
- le dessin sans croisement est unique à une réflexion, une rotation et une
  déformation continue près ;
- aucune grille ne demande un coup impossible : les sommets épinglés, quand la
  variante est active, sont posés à leur place de la solution.

Ce qu’elle ne promet pas :

- que le chemin soit court. Le nombre minimal de sommets à déplacer n’est pas
  calculé — il est NP-difficile en général, et le jeu ne prétend pas le
  connaître. Il n’y a donc pas de « par » ;
- que ce soit facile. Un Écheveau de vingt-quatre sommets démarre à plus de
  trois cents croisements ;
- que votre dessin ressemble au dessin d’origine à l’œil nu. Il lui est
  homéomorphe, ce qui est une autre affaire.

## Jouer

<https://aytan-sudo.github.io/untangle/>

Posez le doigt sur un sommet et glissez. Le sommet **remonte au-dessus du
doigt**, relié par un fil fin : la main ne cache jamais ce qu’on est en train de
placer — ce qui compte, sur un jeu qui se joue au micro-ajustement. Relâchez
pour poser. Un simple tapotement ne compte pas.

La chaleur d’un fil dit combien de croisements il porte, sur une échelle
**relative au pire fil du moment**. Des seuils fixes ne marcheraient à aucun
bout de la partie : au départ, tout dépasse n’importe quel seuil et le plateau
devient un mur uniforme ; à la fin, il ne reste qu’un croisement et il doit
crever les yeux. L’échelle relative fait les deux.

Deux compteurs, deux palmarès : le **chrono**, et le nombre de **sommets
distincts** qu’il a fallu toucher. Le second récompense l’analyse plutôt que
l’agitation. Les Options choisissent lequel s’affiche en premier — les deux sont
enregistrés dans tous les cas.

Au clavier : les flèches visent le sommet voisin de ce côté, `Entrée` le prend
et le repose, les flèches le déplacent tant qu’on le tient (`Maj` pour le pas
fin). Puis `N` nouvelle partie, `R` relancer la même, `T` monde, `U` ou
`Ctrl+Z` annuler, `H` indice, `?` les règles, `Échap` ferme.

## Les écheveaux

| Niveau | Sommets | Fils |
| --- | --- | --- |
| Fil | 10 | 20 |
| Nœud | 16 | 32 |
| Écheveau | 24 | 48 |
| Toile | 34 | 68 |

Le **défi du jour** se joue en Écheveau, en version canonique. La graine est la
date : la même grille pour tout le monde, refabriquée chez chacun, sans qu’un
octet ne circule. La série ne compte que le défi joué le jour même ; un lien
rouvert plus tard redonne la grille, hors série. L’horloge de la machine fait
foi — se tricher soi-même est possible, et sans intérêt.

## Les variantes

Trois axes indépendants, qui se combinent librement. Chaque combinaison a son
propre palmarès : un temps en écheveau épinglé ne concourt pas contre un temps
en écheveau nu.

- **Sommets épinglés** — deux à quatre sommets sont posés d’avance à leur place
  et refusent de bouger. Le démêlage doit s’organiser autour d’eux.
- **Départ en cercle** — tous les sommets commencent sur un cercle, comme un
  diagramme de cordes. Très lisible, très intimidant.
- **À l’aveugle** — les fils fautifs ne se signalent plus ; seul le compteur de
  croisements subsiste.

L’**aimant**, lui, n’est pas une variante mais un confort : il accroche les
sommets à une grille invisible, il est disponible partout, défi du jour compris,
et il ne sépare pas les palmarès. Il ne change ni le graphe ni les croisements
possibles — seulement la précision du doigt.

## Les quatre mondes

Quatre directions artistiques, pas quatre variations d’une seule : **Cordage**
(toile de voile, chanvre goudronné, cosses de laiton), **Enluminure**
(entrelacs à l’encre sur parchemin, cabochons d’or), **Circuit** (ardoise
sérigraphiée, pistes de cuivre, pastilles de soudure) et **Constellation**
(nuit profonde, traînées fines, sommets en étoiles). Deux claires, deux
sombres.

Sans préférence, **le monde du jour se déduit de la date** : tout le monde ouvre
le même décor le même jour, et les quatre reviennent au fil de la semaine. Le
bouton `T` en fige un.

Le squelette dessiné est le même partout — ce sont l’épaisseur des fils, la
forme des embouts, la lueur et la palette qui changent. Pas une ligne de
JavaScript par thème : chaque fil est fait de deux traits superposés, une âme
claire sur un fond sombre, et cette même construction donne le cordage tressé,
le double filet, la piste à reflet ou la traînée lumineuse selon les variables
CSS du monde.

## Sous le capot

Statique intégral : aucune dépendance de production, aucun build, aucun
bundler. Les fichiers du dépôt sont exactement ceux que le navigateur
télécharge. Modules ES natifs — le jeu ne s’ouvre donc pas en `file://`, il lui
faut un serveur.

```
js/graphe.js      croisements, connexité, 3-connexité — de la géométrie pure
js/generateur.js  fabrication d’un écheveau : semis, triangulation, élagage, brouillage
js/partie.js      positions, annulation, sommets touchés, courbe des croisements
js/rendu.js       le SVG, et rien d’autre — aucune règle du jeu
js/entree.js      doigt, souris, clavier
js/hasard.js      le hasard reproductible
js/app.js         l’assemblage
```

**La fabrication.** On sème les points sur une grille jitterée plutôt qu’au
hasard franc : deux sommets ne peuvent pas se confondre, trois ne peuvent pas
s’aligner, et le nuage couvre le plateau au lieu de s’agglutiner. On mélange
ensuite toutes les paires et on garde celles qui ne coupent rien — le résultat
est une triangulation du nuage, donc un graphe planaire maximal. Puis on
**élague** au hasard, en refusant tout retrait qui coûterait la 3-connexité :
c’est là que la garantie se paie, et c’est ce qui permet de descendre à deux
fils par sommet — un plateau qui respire, sans rien céder sur l’unicité. Enfin
on brouille, et on rejette un brouillage qui serait déjà à moitié résolu.

Une triangulation n’est pas toujours 3-connexe : il suffit qu’un sommet de la
coque n’ait que ses deux voisins de bord. Aucun fil ne peut réparer ça, la
triangulation est déjà maximale — alors on resème. Il faut deux essais en
moyenne, jamais plus d’une dizaine.

**Le croisement.** Deux fils sont en conflit s’ils se traversent, se frôlent, ou
si le sommet libre de l’un repose sur l’autre. Un sommet posé *sur* un fil
compte donc comme un croisement : sinon on empilerait les sommets pour tricher,
et la variante Aimant produirait des superpositions exactes qu’un test strict de
traversée ne verrait jamais. Les cas dégénérés passent par une tolérance de
contact, jamais par un signe à 1e-15 près.

**Le rendu, en SVG et pas en canvas.** Le SVG coûte un peu plus cher, mais le
plateau reste un objet du document : il se met au clavier, il s’annonce, et le
jeu échappe à la limite que la convention documente à contrecœur (« un plateau
canvas n’est pas lisible par un lecteur d’écran »). À trente-quatre sommets et
soixante-huit fils, il ne bronche pas — on ne redessine que les fils du sommet
tiré.

**Les tests.** `npm test` fait tourner sept suites en Node, sans navigateur :
la géométrie, le générateur (les garanties vérifiées sur cent dix graines), la
partie, le défi et le partage, le son, le stockage, et les vérifications
structurelles. Ces dernières attrapent les fautes qui ne lèvent aucune erreur —
un fichier absent du service worker, un identifiant renommé d’un seul côté, une
variable de palette oubliée dans un seul monde, une version qui ne concorde
plus. Le script de restauration du thème, qui ne peut rien importer et répète
donc une formule à la main, est **exécuté** par la suite et comparé au module :
rien d’autre n’empêcherait les deux de diverger en silence.

**Le son** est de la synthèse WebAudio, pas un octet d’audio dans le dépôt. Tout
vit au-dessus de 300 Hz — un haut-parleur de téléphone ne restitue à peu près
rien en dessous, et une note écrite plus bas ne lève aucune erreur : elle part
simplement sans arriver. Le contexte audio se prépare au premier geste
d’activation, avant que le jeu n’ait une note à demander : ici tout se décide en
glissant, dans `pointermove`, qui n’est pas une activation pour iOS — un
contexte né là resterait suspendu pour toujours, et la partie serait muette au
doigt sans que rien ne le signale.

## Développer

```bash
npm run serve    # http://localhost:8768
npm test         # les sept suites
npm run check    # node --check sur chaque module
```

Le port 8768 n’est pas partagé avec les autres jeux du dossier : servir sur une
origine commune, c’est partager `localStorage`, la portée du service worker et
les caches.

## Ce qui n’est pas là

- **Pas de « par », pas de nombre de coups optimal.** Il n’est pas calculable en
  temps raisonnable, et un par approximatif ne vaudrait rien.
- **Pas de zoom ni de déplacement du plateau.** L’écheveau tient toujours dans
  l’écran. Un plateau qu’on peut fuir des yeux n’est plus un plateau.
- **Pas d’auto-démêlage, pas de « ranger le graphe ».** Un bouton qui applique
  quelques itérations de force dirigée résoudrait la grille à votre place en
  l’appelant une aide. L’indice, lui, déplace **un** sommet — le plus empêtré —
  et la partie cesse aussitôt de concourir.
- **Pas de niveaux au-delà de trente-quatre sommets.** À cinquante, le plateau
  d’un téléphone ne distingue plus deux sommets voisins ; ce serait un jeu de
  patience contre l’écran, pas contre le graphe.
- **Pas de compte, pas de classement en ligne, pas de télémétrie.** Aucun octet
  ne quitte la machine.

## Journal

- **0.1.0** — le moteur, les quatre mondes, le défi du jour, les trois
  variantes, le partage.
