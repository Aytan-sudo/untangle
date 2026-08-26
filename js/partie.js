// Ce qui dure d’un geste à l’autre : les positions, l’historique, le compte
// des sommets touchés, la courbe des croisements. Aucun DOM, aucune horloge —
// le temps est mesuré ailleurs et versé ici au moment d’enregistrer.

import { MARGE, TAILLE } from './config.js';
import { conflitsAutour, conflitsParSommet, nombreConflits } from './graphe.js';

// Pas de la grille magnétique, en unités de plateau. Assez fin pour ne pas
// brider le placement, assez gros pour que deux sommets voisins tombent
// visiblement sur la même colonne.
export const PAS_AIMANT = 40;

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

// Où poser un sommet pour le dégager : on part du barycentre de ses voisins —
// la place naturelle d’un sommet dans un dessin planaire — puis on essaie des
// anneaux autour, et on garde le point qui laisse le moins de conflits. Rien
// d’aléatoire : le même écheveau donne toujours le même indice.
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
    for (const rayon of [45, 95, 155, 225]) {
        for (let pas = 0; pas < 12; pas++) {
            const angle = (pas / 12) * Math.PI * 2;
            candidats.push({
                x: contraindre(barycentre.x + rayon * Math.cos(angle)),
                y: contraindre(barycentre.y + rayon * Math.sin(angle))
            });
        }
    }

    const memoire = etat.positions[sommet];
    let meilleur = candidats[0];
    let minimum = Infinity;
    for (const candidat of candidats) {
        etat.positions[sommet] = candidat;
        const compte = conflitsAutour(etat.positions, aretes, sommet);
        if (compte < minimum) { minimum = compte; meilleur = candidat; }
        if (compte === 0) break;
    }
    etat.positions[sommet] = memoire;
    return meilleur;
}

export function appliquerIndice(etat) {
    const sommet = sommetLePlusEmpetre(etat);
    if (sommet < 0) return null;
    const cible = positionSuggeree(etat, sommet);
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
