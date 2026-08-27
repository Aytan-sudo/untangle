# Untangle

Un écheveau de fils relie des sommets, et les fils se croisent. Tirez les
sommets jusqu’à ce qu’aucun fil n’en croise plus aucun autre. Jouable au doigt,
hors ligne, sans serveur ni dépendance.

Rien à deviner, rien à perdre, aucun coup irréversible : il n’y a qu’un nœud,
et il finit toujours par céder.

## Version 1.2.0

- **deux tailles de plus** : Lacis (11 sommets) et Dédale (13). Quatre modes,
  disaient les joueurs, c’est trop peu.
- **la Montée** : les six tailles enchaînées, du Fil au Dédale, sous un seul
  chronomètre. Aucune vie, aucune défaite, une reprise exacte.
- **deux défis du jour** : l’Écheveau du jour et la Montée du jour, chacun avec
  sa série. Le bouton `◉` ouvre le panneau des deux.
- l’indice ne se consomme plus quand il n’a rien à dégager.
- trois correctifs d’interface trouvés en capture : le titre passait sous les
  boutons de la barre (illisible dès 393 px, invisible à 320), les libellés des
  compteurs se chevauchaient sur petit écran, et le bouton × des dialogues
  faisait 36 px au lieu de 44.

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
- que ce soit facile. Une Toile démarre à une quinzaine de croisements, et
  chacun s’en va rarement seul ;
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
bout de la partie : au départ, presque tous les fils dépasseraient n’importe
quel seuil et le plateau deviendrait un mur uniforme ; à la fin, il ne reste
qu’un croisement et il doit crever les yeux. L’échelle relative fait les
deux.

Deux compteurs, deux palmarès : le **chrono**, et le nombre de **sommets
distincts** qu’il a fallu toucher. Le second récompense l’analyse plutôt que
l’agitation. Les Options choisissent lequel s’affiche en premier — les deux sont
enregistrés dans tous les cas.

Au clavier : les flèches visent le sommet voisin de ce côté, `Entrée` le prend
et le repose, les flèches le déplacent tant qu’on le tient (`Maj` pour le pas
fin). Puis `N` nouvelle partie, `R` relancer la même, `T` monde, `U` ou
`Ctrl+Z` annuler, `H` indice, `?` les règles, `Échap` ferme.

## Les écheveaux

| Niveau | Sommets | Fils | Croisements au départ (moyenne) |
| --- | --- | --- | --- |
| Fil | 4 | 6 | 1 |
| Nœud | 5 | 8 à 9 | 5 |
| Écheveau | 7 | 13 à 14 | 9 |
| Toile | 9 | 18 | 13 |
| Lacis | 11 | 22 | 19 |
| Dédale | 13 | 26 | 35 |

C’est le nombre de croisements, et non le nombre de sommets, qui fait la
difficulté ressentie : il monte au moins de moitié d’un niveau au suivant, et
un test le vérifie. Le pas le plus court est Toile → Lacis, à 1,39 ; du Fil au
Dédale, l’écart est de trente-cinq pour un.

Le premier niveau tient en un seul geste — un graphe planaire 3-connexe à
quatre sommets ne peut être que K4, et un K4 mal dessiné n’admet jamais qu’un
croisement. C’est une propriété du graphe, pas un réglage : Fil est une
découverte, pas une épreuve.

## La Montée

Les six tailles d’affilée, du Fil au Dédale, **sous un seul chronomètre qui ne
s’arrête pas entre les grilles**. Quarante-neuf sommets en tout, six paliers,
une ligne d’arrivée.

Il n’y a **ni vie, ni sablier, ni défaite** : on ne peut pas rater un palier,
seulement mettre du temps à le passer. C’est délibéré — Untangle est un jeu où
l’on ne perd pas, et lui inventer une perte pour l’occasion l’aurait trahi. La
tension vient de l’horloge, et de l’envie d’arriver sans indice.

Une graine par montée, dérivée pour chaque palier (`graine|montee|lacis`) :
deux montées voisines n’ont aucune grille en commun, et la même graine redonne
exactement la même série. Une montée interrompue **se reprend au palier où elle
en était, avec son temps déjà couru** ; `R` remet le palier à plat sans rendre
les secondes, sans quoi la touche serait un bouton « effacer le chronomètre ».
Le palmarès de la Montée est distinct de celui des tailles : un temps total sur
quarante-neuf sommets ne concourt pas contre un temps sur sept.

## Les deux défis du jour

Le bouton `◉` ouvre les deux, avec leurs séries :

- **l’Écheveau du jour** — une grille de sept sommets, deux minutes ;
- **la Montée du jour** — les six paliers, un quart d’heure.

Chacun a **sa propre série** : réussir la Montée ne prolonge pas celle de
l’Écheveau. Une habitude de deux minutes et une de quinze n’ont pas la même
régularité, et une série commune se serait cassée chaque fois qu’on n’a eu que
deux minutes.

Les deux se jouent en version canonique. La graine est la date : la même grille
pour tout le monde, refabriquée chez chacun, sans qu’un octet ne circule
(`?jour=AAAA-MM-JJ`, `?montee=AAAA-MM-JJ`). La série ne compte que le défi joué
le jour même ; un lien rouvert plus tard redonne la grille, hors série.
L’horloge de la machine fait foi — se tricher soi-même est possible, et sans
intérêt.

## Les variantes

Trois axes indépendants, qui se combinent librement. Chaque combinaison a son
propre palmarès : un temps en écheveau épinglé ne concourt pas contre un temps
en écheveau nu.

- **Sommets épinglés** — un à quatre sommets, selon la taille, sont posés
  d’avance à leur place et refusent de bouger. Le démêlage doit s’organiser
  autour d’eux.
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
js/montee.js      les six paliers, le chronomètre du parcours, sa reprise
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
triangulation est déjà maximale — alors on resème. Il faut trois à cinq essais
en moyenne, et davantage à quatre sommets, où il faut que le quatrième point
tombe précisément dans le triangle des trois autres.

Le nuage est ensuite **recentré et dilaté** pour occuper le cadre. Tirer
quelques cases au hasard dans une grille laisse souvent la moitié du plateau
vide, et à quatre sommets l’écran a l’air en panne. Les deux axes s’étirent
séparément, ce qui est légitime : une application affine préserve exactement la
planarité et les croisements, donc la garantie n’en souffre pas. Seul l’œil
impose une bride, pour ne pas aplatir les figures en accordéon.

**Le brouillage.** Une disposition de départ doit être emmêlée dans une
fourchette — un plancher seul laissait passer la première venue au-dessus du
seuil, et un même niveau sortait tantôt à quatre croisements, tantôt à
vingt-deux. Elle doit surtout être **propre** : aucun sommet couché sur un fil.
Ce n’en était pas une évidence. Comme un sommet posé sur un fil compte pour un
croisement, la première version — qui retenait, à défaut de seuil atteignable,
la disposition la plus embrouillée de toutes — allait systématiquement chercher
les cas dégénérés. Invisible à trois cents croisements, ruineux à trois.

**La Montée.** Un module à part, sans DOM ni horloge : on lui verse le résultat
d’un palier, il dit lequel vient ensuite. Il ne garde pas de total — le temps,
les sommets et les indices se recomposent en additionnant les paliers franchis,
ce qui évite d’avoir deux compteurs à tenir d’accord. Le rang, lui, **se déduit
des paliers réellement franchis plutôt que de se lire** : un `rang: 5` bricolé
dans le stockage offrirait sinon le Dédale d’emblée, avec le temps d’un seul
palier au compteur.

Deux détails qui ne se voient qu’en jouant. Le panneau entre deux paliers est
une étape, pas une fenêtre qu’on écarte : le fermer par la croix laissait le
joueur devant une grille déjà démêlée, sans indice, sans annulation et sans
bouton pour avancer — toute fermeture enchaîne donc sur le palier suivant. Et
`R` reporte le temps déjà passé sur le palier qu’il relance, sans quoi il
serait un bouton « effacer le chronomètre » au milieu du seul mode qui n’a que
le chronomètre pour tension.

**Le croisement.** Deux fils sont en conflit s’ils se traversent, se frôlent, ou
si le sommet libre de l’un repose sur l’autre. Un sommet posé *sur* un fil
compte donc comme un croisement : sinon on empilerait les sommets pour tricher,
et la variante Aimant produirait des superpositions exactes qu’un test strict de
traversée ne verrait jamais. Les cas dégénérés passent par une tolérance de
contact, jamais par un signe à 1e-15 près.

**Le rendu, en SVG et pas en canvas.** Le SVG coûte un peu plus cher, mais le
plateau reste un objet du document : il se met au clavier, il s’annonce, et le
jeu échappe à la limite que la convention documente à contrecœur (« un plateau
canvas n’est pas lisible par un lecteur d’écran »). À neuf sommets et dix-huit fils, il ne
bronche pas — et on ne redessine de toute façon que les fils du sommet tiré.

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
  l’appelant une aide. L’indice, lui, déplace **un** sommet — celui dont le
  déplacement fait tomber le plus de croisements — et la partie cesse aussitôt
  de concourir. C’est un conseil local, pas un solveur : à onze ou treize
  sommets, il arrive qu’aucun sommet n’ait de meilleure place alors que le
  plateau est encore emmêlé. Il rend alors la main **sans se consommer** — la
  partie reste au palmarès, et le détour reste à trouver.
- **Pas de niveaux au-delà de treize sommets.** La 1.1.0 s’était arrêtée à
  neuf ; les joueurs trouvaient quatre modes trop peu, et à treize c’est encore
  jouable au doigt — vingt-six fils sur un plateau de téléphone, des sommets
  qui se frôlent parfois sans jamais se confondre. La limite a bougé, elle n’a
  pas disparu : la 1.0.0 proposait jusqu’à trente-quatre sommets, et ça reste
  une erreur d’échelle.
- **Pas de défaite dans la Montée.** Ni vies, ni sablier, ni palier à refaire.
  On ne peut pas perdre une grille d’Untangle ; un mode qui le permettrait
  serait un autre jeu.
- **Pas de compte, pas de classement en ligne, pas de télémétrie.** Aucun octet
  ne quitte la machine.

## Journal

- **1.2.0** — six tailles et la Montée. Lacis (11) et Dédale (13) rejoignent
  l’échelle : quatre modes, c’était trop peu. La Montée les enchaîne tous les
  six sous un chronomètre unique, et le défi du jour se dédouble — l’Écheveau
  et la Montée, chacun sa série. Trois écarts d’interface corrigés au passage,
  tous trouvés en regardant une capture d’iPhone plutôt qu’un test vert : le
  titre passait sous les boutons de la barre, les libellés des compteurs se
  chevauchaient à 320 px, et le × des dialogues faisait 36 px.
- **1.1.1** — les cibles tactiles de l’interface passent à 44 px, et le test
  vérifie la règle au lieu de figer l’ancienne valeur.
- **1.1.0** — la bonne échelle. Les niveaux passent de 10–34 sommets à 4–9 :
  la première version était un jeu de patience contre l’écran. Le brouillage
  est encadré par une fourchette et refuse les dispositions dégénérées, le
  nuage de points remplit le cadre, sommets et fils doublent de taille. Dans
  les Options, « le monde du jour » devient une case à cocher — cinq boutons
  pour une grille de quatre laissaient le dernier monde seul sur sa ligne.
- **1.0.0** — première publication. Le moteur et sa garantie de 3-connexité,
  les quatre mondes, le défi du jour, les trois variantes, l’aimant, le
  partage, les palmarès par configuration.
