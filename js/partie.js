// Ce qui dure d’un geste à l’autre : les positions, l’historique, le compte
// des sommets touchés, la courbe des croisements. Aucun DOM, aucune horloge —
// le temps est mesuré ailleurs et versé ici au moment d’enregistrer.

import { MARGE, TAILLE } from './config.js';
import { conflitsAutour, conflitsParSommet, nombreConflits } from './graphe.js';

// Pas de la grille magnétique, en unités de plateau. Il doit dépasser le
// diamètre d’un sommet : sur une maille plus fine, deux sommets voisins se
// chevaucheraient — et se chevaucher, dans ce jeu, c’est un croisement.
export const PAS_AIMANT = 85;

const AIMANT_MIN = Math.ceil(MARGE / PAS_AIMANT) * PAS_AIMANT;
const AIMANT_MAX = Math.floor((TAILLE - MARGE) / PAS_AIMANT) * PAS_AIMANT;

export function contraindre(valeur) {
    return Math.min(TAILLE - MARGE, Math.max(MARGE, valeur));
}

export function aimanter(valeur) {
    return Math.min(AIMANT_MAX, Math.max(AIMANT_MIN, Math.round(valeur / PAS_AIMANT) * PAS_AIMANT));
}

// De combien une flèche du clavier déplace un sommet. Avec l’aimant, le pas
// doit être celui de la grille : un pas plus petit qu’une maille se fait
// avaler par l’accrochage, et la touche ne fait alors rien du tout — une fois
// sur deux pour le pas normal, toujours pour le pas fin.
export function pasDeDeplacement({ aimant = false, fin = false } = {}) {
    if (aimant) return PAS_AIMANT;
    return fin ? PAS_FIN : PAS_NORMAL;
}

export const PAS_NORMAL = 26;
export const PAS_FIN = 7;

export function partieNeuve(puzzle) {
    const positions = puzzle.positions.map(point => ({ ...point }));
    return {
        puzzle,
        positions,
        gestes: 0,
        touches: [],
        indices: 0,
        historique: [],
        // La courbe des croisements : un relevé au départ, puis un après
        // chaque dépose. C’est elle que le partage résume en huit blocs.
        jalons: [nombreConflits(positions, puzzle.aretes)]
    };
}

export function estEpingle(etat, sommet) {
    return etat.puzzle.epingles.includes(sommet);
}

export function croisements(etat) {
    return nombreConflits(etat.positions, etat.puzzle.aretes);
}

export function estTerminee(etat) {
    return croisements(etat) === 0;
}

// Une partie gagnée avec un indice ne concourt pas — c’est la règle de la
// collection, et elle vaut aussi pour la série quotidienne.
export function horsPalmares(etat) {
    return etat.indices > 0;
}

// Une dépose, un pas d’annulation. Reposer un sommet là où il était ne compte
// pour rien : sinon le moindre tremblement du doigt gonflerait le score.
export function deposer(etat, sommet, x, y, { aimant = false } = {}) {
    if (estEpingle(etat, sommet)) return false;
    const depart = etat.positions[sommet];
    const arrivee = aimant
        ? { x: aimanter(x), y: aimanter(y) }
        : { x: contraindre(x), y: contraindre(y) };
    if (Math.hypot(arrivee.x - depart.x, arrivee.y - depart.y) < 0.5) return false;
    etat.historique.push({ sommet, x: depart.x, y: depart.y, indice: false });
    etat.positions[sommet] = arrivee;
    etat.gestes++;
    if (!etat.touches.includes(sommet)) etat.touches.push(sommet);
    etat.jalons.push(croisements(etat));
    return true;
}

export function annuler(etat) {
    const pas = etat.historique.pop();
    if (!pas) return false;
    etat.positions[pas.sommet] = { x: pas.x, y: pas.y };
    etat.gestes = Math.max(0, etat.gestes - 1);
    if (pas.indice) etat.indices = Math.max(0, etat.indices - 1);
    etat.jalons.pop();
    // Le sommet reste marqué comme touché : l’annulation efface le geste, pas
    // le fait qu’on soit passé par là.
    return true;
}

export function sommetLePlusEmpetre(etat) {
    const compte = conflitsParSommet(etat.puzzle.sommets, etat.puzzle.aretes, etat.positions);
    let meilleur = -1;
    let maximum = 0;
    for (let sommet = 0; sommet < compte.length; sommet++) {
        if (estEpingle(etat, sommet) || compte[sommet] <= maximum) continue;
        maximum = compte[sommet];
        meilleur = sommet;
    }
    return meilleur;
}

// Où poser un sommet pour le dégager.
//
// On balaie tout le plateau, pas un voisinage : à neuf sommets et dix-huit
// fils, essayer quatre-vingts positions coûte quelques microsecondes, et la
// bonne place est souvent à l’autre bout du cadre. Une première version
// n’essayait que des anneaux autour du barycentre des voisins — un rayon
// calibré pour des plateaux trois fois plus peuplés — et rendait souvent un
// conseil qui ne dégageait rien du tout.
//
// À égalité de conflits, on retient la position la plus proche du barycentre
// des voisins : c’est la place naturelle d’un sommet dans un dessin planaire,
// et le conseil a alors l’air d’un conseil plutôt que d’un coup de dé. Rien
// d’aléatoire ici : le même écheveau donne toujours le même indice.
export const BALAYAGE = 10;

export function positionSuggeree(etat, sommet) {
    const { aretes } = etat.puzzle;
    const voisins = aretes.filter(([a, b]) => a === sommet || b === sommet)
        .map(([a, b]) => (a === sommet ? b : a));
    const barycentre = voisins.length
        ? {
            x: contraindre(voisins.reduce((somme, v) => somme + etat.positions[v].x, 0) / voisins.length),
            y: contraindre(voisins.reduce((somme, v) => somme + etat.positions[v].y, 0) / voisins.length)
        }
        : { x: TAILLE / 2, y: TAILLE / 2 };

    const candidats = [barycentre];
    const pas = (TAILLE - 2 * MARGE) / BALAYAGE;
    for (let colonne = 0; colonne <= BALAYAGE; colonne++) {
        for (let ligne = 0; ligne <= BALAYAGE; ligne++) {
            candidats.push({ x: MARGE + colonne * pas, y: MARGE + ligne * pas });
        }
    }

    const memoire = etat.positions[sommet];
    let meilleur = barycentre;
    let minimum = Infinity;
    let plusProche = Infinity;
    for (const candidat of candidats) {
        etat.positions[sommet] = candidat;
        const compte = conflitsAutour(etat.positions, aretes, sommet);
        const ecart = Math.hypot(candidat.x - barycentre.x, candidat.y - barycentre.y);
        if (compte < minimum || (compte === minimum && ecart < plusProche)) {
            minimum = compte;
            plusProche = ecart;
            meilleur = candidat;
        }
    }
    etat.positions[sommet] = memoire;
    return meilleur;
}

// Quel sommet conseiller, et où le poser.
//
// Pas simplement le plus empêtré : il arrive qu’il n’ait aucune bonne place,
// ses voisins étant eux-mêmes mal posés — le conseil ne dégageait alors rien
// et se contentait de brûler l’indice. On cherche donc, parmi tous les sommets
// libres, celui dont le déplacement fait tomber le plus de croisements.
//
// Comme un déplacement ne change que les conflits des fils du sommet déplacé,
// minimiser ses conflits à lui revient exactement à minimiser le total : la
// mesure locale suffit, il n’y a jamais besoin de recompter l’écheveau.
export function meilleurIndice(etat) {
    const { aretes, sommets } = etat.puzzle;
    let choix = null;
    for (let sommet = 0; sommet < sommets; sommet++) {
        if (estEpingle(etat, sommet)) continue;
        const avant = conflitsAutour(etat.positions, aretes, sommet);
        if (avant === 0) continue;
        const cible = positionSuggeree(etat, sommet);
        const memoire = etat.positions[sommet];
        etat.positions[sommet] = cible;
        const apres = conflitsAutour(etat.positions, aretes, sommet);
        etat.positions[sommet] = memoire;
        const gain = avant - apres;
        // Un conseil qui ne dégage rien n’est pas un conseil : on préfère
        // rendre la main. Sans ce garde-fou, l’indice désignait quand même un
        // sommet quand aucun ne pouvait faire mieux — il brûlait le palmarès
        // pour un déplacement neutre, et deux indices d’affilée pouvaient
        // faire l’aller-retour. Ça ne se voyait guère à sept sommets ; à
        // treize, le plateau se stabilise bien avant d’être démêlé.
        if (gain <= 0) continue;
        if (!choix || gain > choix.gain) choix = { sommet, cible, gain };
    }
    return choix;
}

export function appliquerIndice(etat) {
    const choix = meilleurIndice(etat);
    if (!choix) return null;
    const { sommet, cible } = choix;
    const depart = etat.positions[sommet];
    etat.historique.push({ sommet, x: depart.x, y: depart.y, indice: true });
    etat.positions[sommet] = cible;
    etat.indices++;
    if (!etat.touches.includes(sommet)) etat.touches.push(sommet);
    etat.jalons.push(croisements(etat));
    return { sommet, ...cible };
}

// La courbe des croisements en huit blocs, du départ à la fin. Elle raconte le
// démêlage — les paliers, le déclic — sans rien livrer de la solution.
export function courbe(etat, blocs = 8) {
    const { jalons } = etat;
    const depart = jalons[0] || 1;
    return Array.from({ length: blocs }, (_, bloc) => {
        const index = Math.min(jalons.length - 1, Math.round(((bloc + 1) / blocs) * (jalons.length - 1)));
        return Math.min(1, jalons[index] / depart);
    });
}

export function serialiser(etat) {
    return {
        positions: etat.positions.map(({ x, y }) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]),
        gestes: etat.gestes,
        touches: [...etat.touches],
        indices: etat.indices,
        jalons: [...etat.jalons],
        historique: etat.historique.map(({ sommet, x, y, indice }) =>
            [sommet, Math.round(x * 100) / 100, Math.round(y * 100) / 100, indice ? 1 : 0])
    };
}

export function restaurer(puzzle, sauvegarde) {
    const etat = partieNeuve(puzzle);
    if (!sauvegarde || !Array.isArray(sauvegarde.positions)) return etat;
    if (sauvegarde.positions.length !== puzzle.sommets) return etat;
    etat.positions = sauvegarde.positions.map(([x, y]) => ({ x: contraindre(x), y: contraindre(y) }));
    etat.gestes = Number(sauvegarde.gestes) || 0;
    etat.touches = Array.isArray(sauvegarde.touches)
        ? sauvegarde.touches.filter(sommet => Number.isInteger(sommet) && sommet >= 0 && sommet < puzzle.sommets)
        : [];
    etat.indices = Number(sauvegarde.indices) || 0;
    etat.jalons = Array.isArray(sauvegarde.jalons) && sauvegarde.jalons.length
        ? sauvegarde.jalons.map(Number)
        : [croisements(etat)];
    etat.historique = Array.isArray(sauvegarde.historique)
        ? sauvegarde.historique
            .filter(pas => Array.isArray(pas) && pas.length >= 3 && pas[0] >= 0 && pas[0] < puzzle.sommets)
            .map(([sommet, x, y, indice]) => ({ sommet, x: contraindre(x), y: contraindre(y), indice: Boolean(indice) }))
        : [];
    // Les épingles ne se déplacent pas, même par un stockage bricolé à la main.
    for (const epingle of puzzle.epingles) etat.positions[epingle] = { ...puzzle.solution[epingle] };
    return etat;
}
