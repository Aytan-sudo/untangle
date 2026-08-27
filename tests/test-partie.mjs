import { readFileSync } from 'node:fs';
import { compteur } from './harness.mjs';
import { MARGE, TAILLE } from '../js/config.js';
import { genererPuzzle } from '../js/generateur.js';
import { conflitsAutour, nombreConflits } from '../js/graphe.js';
import {
    BALAYAGE, PAS_AIMANT, PAS_FIN, PAS_NORMAL, aimanter, annuler, appliquerIndice, contraindre, courbe, croisements,
    deposer, estEpingle, estTerminee, horsPalmares, meilleurIndice, partieNeuve,
    pasDeDeplacement, positionSuggeree, restaurer, serialiser, sommetLePlusEmpetre
} from '../js/partie.js';

const { check, egal, rapport } = compteur();
console.log('\nLa partie\n');

const puzzle = genererPuzzle({ graine: 'partie', niveau: 'toile' });

// — Contraintes de placement
check('le cadre borne les positions', contraindre(-500) === MARGE && contraindre(9000) === TAILLE - MARGE);
check('le cadre laisse passer l’intérieur', contraindre(500) === 500);
check('l’aimant accroche la grille', aimanter(497) % PAS_AIMANT === 0 && aimanter(497) === 510);
check('l’aimant reste dans le cadre', aimanter(-900) >= MARGE && aimanter(9000) <= TAILLE - MARGE);

// — Le pas du clavier
{
    egal('sans aimant, deux pas au choix',
        [pasDeDeplacement(), pasDeDeplacement({ fin: true })], [PAS_NORMAL, PAS_FIN]);
    // Le piège : un pas plus court qu’une maille est avalé par l’accrochage.
    // La flèche ne fait alors rien — toujours, pour le pas fin, et une fois
    // sur deux pour le pas normal.
    check('les deux pas libres sont plus courts qu’une maille',
        PAS_FIN < PAS_AIMANT && PAS_NORMAL < PAS_AIMANT);
    egal('avec l’aimant, le pas vaut la maille',
        [pasDeDeplacement({ aimant: true }), pasDeDeplacement({ aimant: true, fin: true })],
        [PAS_AIMANT, PAS_AIMANT]);
    check('une flèche déplace toujours quelque chose, aimant ou non',
        [{}, { fin: true }, { aimant: true }, { aimant: true, fin: true }].every(reglage => {
            const depart = 400;
            const pas = pasDeDeplacement(reglage);
            const arrivee = reglage.aimant ? aimanter(depart - pas) : depart - pas;
            return arrivee !== depart;
        }));
}

// — Gestes
{
    const etat = partieNeuve(puzzle);
    check('une partie neuve part de la disposition brouillée',
        JSON.stringify(etat.positions) === JSON.stringify(puzzle.positions));
    check('une partie neuve est emmêlée', !estTerminee(etat) && croisements(etat) > 0);
    check('une partie neuve concourt', !horsPalmares(etat));

    check('déposer déplace le sommet', deposer(etat, 0, 300, 400));
    egal('le sommet est arrivé', etat.positions[0], { x: 300, y: 400 });
    check('le geste est compté', etat.gestes === 1 && etat.touches.length === 1);
    check('la courbe gagne un jalon', etat.jalons.length === 2);

    check('reposer au même endroit ne compte pas', !deposer(etat, 0, 300, 400));
    check('rien n’a bougé', etat.gestes === 1 && etat.jalons.length === 2);

    deposer(etat, 0, 700, 700);
    check('retoucher le même sommet ne l’ajoute pas deux fois', etat.touches.length === 1 && etat.gestes === 2);
    deposer(etat, 1, 200, 800);
    check('un second sommet touché est compté à part', etat.touches.length === 2 && etat.gestes === 3);

    check('l’aimant pose sur la grille', deposer(etat, 2, 313, 587, { aimant: true })
        && etat.positions[2].x === aimanter(313) && etat.positions[2].y === aimanter(587)
        && etat.positions[2].x % PAS_AIMANT === 0);
    check('le cadre s’applique à la dépose', deposer(etat, 3, -400, 4000)
        && etat.positions[3].x === MARGE && etat.positions[3].y === TAILLE - MARGE);
}

// — Annulation
{
    const etat = partieNeuve(puzzle);
    const depart = { ...etat.positions[5] };
    check('rien à annuler au départ', !annuler(etat));
    deposer(etat, 5, 250, 250);
    deposer(etat, 6, 750, 250);
    check('annuler rend le dernier geste', annuler(etat) && etat.gestes === 1);
    check('annuler remonte la courbe', etat.jalons.length === 2);
    annuler(etat);
    egal('le sommet est revenu à sa place', etat.positions[5], depart);
    check('le compte des gestes est retombé', etat.gestes === 0);
    // Le sommet reste marqué : on est passé par là, l’annulation n’efface pas
    // la promenade, seulement le geste.
    check('les sommets touchés gardent la mémoire', etat.touches.length === 2);
}

// — Épingles
{
    const epingle = genererPuzzle({ graine: 'partie', niveau: 'toile', epingles: true });
    const etat = partieNeuve(epingle);
    const ancre = epingle.epingles[0];
    check('un sommet épinglé est reconnu', estEpingle(etat, ancre));
    check('un sommet épinglé refuse de bouger', !deposer(etat, ancre, 500, 500));
    egal('l’épingle n’a pas bougé', etat.positions[ancre], epingle.solution[ancre]);
    check('l’indice ne propose jamais un sommet épinglé', !epingle.epingles.includes(sommetLePlusEmpetre(etat)));
}

// — Indice
{
    const etat = partieNeuve(puzzle);
    const empetre = meilleurIndice(etat).sommet;
    check('un sommet à conseiller est trouvé', empetre >= 0 && empetre < puzzle.sommets);
    check('le plus empêtré reste identifiable', sommetLePlusEmpetre(etat) >= 0);
    const avant = conflitsAutour(etat.positions, puzzle.aretes, empetre);
    const suggeree = positionSuggeree(etat, empetre);
    check('la position suggérée tient dans le cadre',
        suggeree.x >= MARGE && suggeree.x <= TAILLE - MARGE && suggeree.y >= MARGE && suggeree.y <= TAILLE - MARGE);
    check('la position suggérée ne dérange pas le plateau', etat.positions[empetre] !== suggeree);

    const avantTotal = croisements(etat);
    const applique = appliquerIndice(etat);
    check('l’indice bouge le sommet conseillé', applique && applique.sommet === empetre);
    const apres = conflitsAutour(etat.positions, puzzle.aretes, empetre);
    check('l’indice dégage le sommet', apres < avant, `${avant} → ${apres}`);
    check('l’indice ne rajoute pas de croisements ailleurs', croisements(etat) <= avantTotal);
    // Un conseil qui ne dégage rien n’est pas un conseil. Sur tous les
    // niveaux, sur beaucoup de graines : l’indice doit toujours améliorer la
    // situation du sommet qu’il désigne, ou la laisser déjà nette.
    let steriles = 0;
    let essais = 0;
    for (const niveau of ['fil', 'noeud', 'echeveau', 'toile']) {
        for (let graine = 0; graine < 20; graine++) {
            const jeu = partieNeuve(genererPuzzle({ graine: `indice-${graine}`, niveau }));
            essais++;
            const avantTout = croisements(jeu);
            const conseil = appliquerIndice(jeu);
            if (!conseil || croisements(jeu) >= avantTout) steriles++;
        }
    }
    check('l’indice fait toujours tomber au moins un croisement',
        steriles === 0, `${steriles} stériles sur ${essais}`);
    check('l’indice compte comme un geste', etat.gestes === 0 && etat.indices === 1);
    check('une partie avec indice ne concourt plus', horsPalmares(etat));
    annuler(etat);
    check('annuler l’indice rend aussi la partie au palmarès', !horsPalmares(etat));
}

// — Le balayage de l’indice couvre le plateau
{
    // Une première version n’essayait que des anneaux de 45 à 225 unités
    // autour du barycentre des voisins — une échelle calibrée pour des
    // plateaux trois fois plus peuplés. Sur un plateau de 1000 avec neuf
    // sommets, elle ne voyait pas la bonne place, qui est souvent à l’autre
    // bout du cadre.
    const pas = (TAILLE - 2 * MARGE) / BALAYAGE;
    check('le balayage échantillonne tout le plateau', BALAYAGE >= 8, String(BALAYAGE));
    // Le maillage doit être plus fin que l’écart entre deux sommets, sinon il
    // enjambe les places libres.
    check('le maillage est plus fin que l’écart entre sommets', pas < 120, `pas ${pas.toFixed(0)}`);

    // Et il doit rester bon marché : l’indice se demande en pleine partie.
    //
    // On compte le travail, pas le temps d’horloge. Une première version
    // mesurait des millisecondes et passait ici pour échouer sur le runner de
    // la CI, deux fois plus lent — un test qui dépend de la machine ne teste
    // rien, il tire à pile ou face. Le nombre de positions essayées, lui, est
    // le même partout et c’est bien ce qui est en cause si le balayage enfle.
    const jeu = partieNeuve(genererPuzzle({ graine: 'cout', niveau: 'toile' }));
    let evaluations = 0;
    const compteur = new Proxy(jeu, {
        get(cible, propriete) {
            if (propriete === 'positions') evaluations++;
            return cible[propriete];
        }
    });
    positionSuggeree(compteur, 0);
    const candidats = (BALAYAGE + 1) ** 2 + 1;
    check('le conseil essaie une centaine de positions, pas des milliers',
        candidats <= 200, String(candidats));
    check('et il n’en évalue pas plus qu’il n’en essaie',
        evaluations <= candidats * 4 + 20, `${evaluations} accès pour ${candidats} candidats`);
}

// — L’indice est déterministe
{
    const a = partieNeuve(puzzle);
    const b = partieNeuve(puzzle);
    egal('deux indices sur le même écheveau donnent le même conseil', appliquerIndice(a), appliquerIndice(b));
}

// — La victoire
{
    const etat = partieNeuve(puzzle);
    for (let sommet = 0; sommet < puzzle.sommets; sommet++) {
        etat.positions[sommet] = { ...puzzle.solution[sommet] };
    }
    check('la disposition du générateur est gagnante', estTerminee(etat) && croisements(etat) === 0);
    check('la solution ne croise rien', nombreConflits(puzzle.solution, puzzle.aretes) === 0);
}

// — La courbe des croisements
{
    const etat = partieNeuve(puzzle);
    const traits = courbe(etat);
    check('la courbe compte huit blocs', traits.length === 8);
    check('la courbe part du plein', traits.every(valeur => valeur === 1));
    etat.jalons = [40, 30, 20, 10, 0];
    const descente = courbe(etat, 4);
    egal('la courbe suit la descente', descente, [0.75, 0.5, 0.25, 0]);
    check('la courbe reste bornée', courbe(etat).every(valeur => valeur >= 0 && valeur <= 1));
}

// — Reprise
{
    const etat = partieNeuve(puzzle);
    deposer(etat, 4, 333.333, 444.444);
    deposer(etat, 7, 611, 122);
    appliquerIndice(etat);
    const repris = restaurer(puzzle, JSON.parse(JSON.stringify(serialiser(etat))));
    check('la reprise retrouve le compte des gestes', repris.gestes === etat.gestes);
    check('la reprise retrouve les sommets touchés', repris.touches.join() === etat.touches.join());
    check('la reprise retrouve les indices', repris.indices === etat.indices);
    check('la reprise retrouve la courbe', repris.jalons.join() === etat.jalons.join());
    check('la reprise retrouve le plateau', repris.positions.every((point, index) =>
        Math.abs(point.x - etat.positions[index].x) < 0.02 && Math.abs(point.y - etat.positions[index].y) < 0.02));
    check('la reprise garde l’annulation', annuler(repris) && repris.gestes === etat.gestes - 1);
}

// — Stockage douteux
{
    check('un stockage vide donne une partie neuve', restaurer(puzzle, null).gestes === 0);
    check('un stockage tronqué est ignoré', restaurer(puzzle, { positions: [[1, 2]] }).gestes === 0);
    const bricole = restaurer(puzzle, {
        positions: puzzle.positions.map(() => [-9999, 9999]),
        gestes: 'beaucoup', touches: [0, 999, -3], indices: null, historique: 'non', jalons: []
    });
    check('des positions absurdes sont ramenées dans le cadre',
        bricole.positions.every(({ x, y }) => x === MARGE && y === TAILLE - MARGE));
    check('un compte de gestes absurde retombe à zéro', bricole.gestes === 0);
    egal('les sommets touchés hors bornes sont écartés', bricole.touches, [0]);
    egal('un historique illisible devient vide', bricole.historique, []);
    check('la courbe se recalcule si elle manque', bricole.jalons.length === 1);
}
{
    const epingle = genererPuzzle({ graine: 'partie', niveau: 'toile', epingles: true });
    const triche = restaurer(epingle, {
        positions: epingle.positions.map(() => [500, 500]), gestes: 3, touches: [], indices: 0
    });
    check('une épingle déplacée dans le stockage revient à sa place',
        epingle.epingles.every(index =>
            triche.positions[index].x === epingle.solution[index].x
            && triche.positions[index].y === epingle.solution[index].y));
}

// — L’aimant laisse de la place aux sommets
{
    // Deux sommets sur des mailles voisines ne doivent pas se chevaucher :
    // dans ce jeu, se chevaucher est un croisement, et on l’aurait imposé au
    // joueur sans qu’il puisse rien y faire.
    const styles = readFileSync(new URL('../css/themes.css', import.meta.url), 'utf8');
    const rayons = [...styles.matchAll(/--sommet-rayon:\s*([\d.]+)/g)].map(([, valeur]) => Number(valeur));
    check('des rayons de sommet ont été relevés', rayons.length === 4, String(rayons.length));
    check('une maille tient deux sommets côte à côte',
        PAS_AIMANT > 2 * Math.max(...rayons), `maille ${PAS_AIMANT}, plus gros sommet ${Math.max(...rayons)}`);
}

// — Les paliers de chaleur du rendu
{
    const { paliersDeChaleur, NIVEAUX_CHALEUR } = await import('../js/rendu.js');
    egal('un fil sain n’a pas de palier', paliersDeChaleur(0, 30), 0);
    // Au départ d’un Écheveau : trois cents croisements, le pire fil en porte
    // trente. Les paliers doivent encore trier, pas tout peindre en rouge.
    egal('l’échelle trie encore au plus fort de l’emmêlement',
        [3, 9, 12, 21, 30].map(compte => paliersDeChaleur(compte, 30)), [1, 1, 2, 3, 3]);
    // À la fin : un seul croisement, deux fils concernés. Il doit crever les yeux.
    egal('le dernier croisement est au rouge vif', paliersDeChaleur(1, 1), 3);
    egal('un fil sain reste calme même quand tout brûle', paliersDeChaleur(0, 1), 0);
    egal('sans aucun croisement, rien ne chauffe', paliersDeChaleur(0, 0), 0);
    egal('un palier ne dépasse jamais trois', paliersDeChaleur(99, 4), 3);
    check('chaque palier a sa classe', NIVEAUX_CHALEUR.length === 4 && NIVEAUX_CHALEUR[0] === '');
    // Une classe déclarée ici mais absente du CSS ne lève rien : le fil reste
    // simplement de la couleur du calme, quel que soit son enchevêtrement.
    const styles = readFileSync(new URL('../css/plateau.css', import.meta.url), 'utf8');
    const sansRegle = NIVEAUX_CHALEUR.filter(classe => classe && !styles.includes(`.${classe} .fil-fond`));
    check('chaque palier est peint par le CSS', sansRegle.length === 0, sansRegle.join(' '));
}

rapport();
