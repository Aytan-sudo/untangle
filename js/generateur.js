// Fabrication d’un écheveau. Le générateur ne sait rien du jeu : il rend un
// graphe planaire, une disposition qui le prouve, et une disposition brouillée
// pour commencer. Même graine, même écheveau.

import { MARGE, TAILLE } from './config.js';
import { Alea } from './hasard.js';
import {
    CONTACT, aretesEnConflit, degres, distancePointSegment,
    estTriconnexe, nombreConflits
} from './graphe.js';

export const NIVEAUX = {
    fil: { id: 'fil', nom: 'Fil', sommets: 10 },
    noeud: { id: 'noeud', nom: 'Nœud', sommets: 16 },
    echeveau: { id: 'echeveau', nom: 'Écheveau', sommets: 24 },
    toile: { id: 'toile', nom: 'Toile', sommets: 34 }
};

// Fils par sommet visés après élagage. La triangulation en donne près de
// trois ; deux se lisent sur un téléphone sans que le graphe cesse d’être
// 3-connexe — donc sans rien céder sur l’unicité du dessin.
export const DENSITE = 2;

const TENTATIVES_SEMIS = 60;
const TENTATIVES_BROUILLAGE = 40;

// Un semis sur grille jitterée plutôt qu’un semis franchement aléatoire : deux
// sommets ne peuvent pas se confondre, trois ne peuvent pas s’aligner, et le
// nuage couvre le plateau au lieu de s’agglutiner dans un coin.
export function semisDePoints(alea, nombre) {
    const cotes = Math.ceil(Math.sqrt(nombre * 3));
    const pas = (TAILLE - 2 * MARGE) / cotes;
    const cases = [];
    for (let y = 0; y < cotes; y++) for (let x = 0; x < cotes; x++) cases.push([x, y]);
    return alea.melanger(cases).slice(0, nombre).map(([x, y]) => ({
        x: MARGE + (x + 0.2 + 0.6 * alea.suivant()) * pas,
        y: MARGE + (y + 0.2 + 0.6 * alea.suivant()) * pas
    }));
}

// On mélange toutes les paires et on garde celles qui ne coupent rien : le
// résultat est une triangulation du nuage, donc un graphe planaire maximal.
// Un fil qui frôlerait un sommet étranger est refusé aussi — sans quoi ce
// sommet, condamné à ne plus rien pouvoir relier, resterait isolé.
export function triangulationGloutonne(points) {
    const aretes = [];
    const paires = [];
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) paires.push([i, j]);
    for (const paire of paires) {
        const [a, b] = paire;
        let libre = true;
        for (let k = 0; k < points.length && libre; k++) {
            if (k !== a && k !== b && distancePointSegment(points[k], points[a], points[b]) <= CONTACT) libre = false;
        }
        for (const posee of aretes) {
            if (!libre) break;
            if (aretesEnConflit(points, paire, posee)) libre = false;
        }
        if (libre) aretes.push(paire);
    }
    return aretes;
}

// Élagage : on retire des fils au hasard tant que le graphe reste 3-connexe.
// Le contrôle des degrés est là pour épargner l’essentiel des appels au test
// de 3-connexité, qui coûte cent fois plus cher.
export function elaguer(alea, nombreSommets, aretes, cible) {
    let courant = [...aretes];
    for (const arete of alea.melanger(aretes)) {
        if (courant.length <= cible) break;
        const candidat = courant.filter(autre => autre !== arete);
        if (degres(nombreSommets, candidat).some(degre => degre < 3)) continue;
        if (estTriconnexe(nombreSommets, candidat)) courant = candidat;
    }
    return courant;
}

// Les sommets épinglés sont posés à leur place de la solution : la partie
// reste soluble par construction, puisque la solution elle-même les respecte.
// On les prend aussi éloignés que possible les uns des autres — trois points
// d’ancrage groupés dans un coin n’ancreraient rien.
export function choisirEpingles(alea, solution, nombre) {
    const choisis = [alea.entier(solution.length)];
    while (choisis.length < nombre) {
        let meilleur = -1;
        let meilleureDistance = -1;
        for (let i = 0; i < solution.length; i++) {
            if (choisis.includes(i)) continue;
            const distance = Math.min(...choisis.map(j => Math.hypot(
                solution[i].x - solution[j].x, solution[i].y - solution[j].y)));
            if (distance > meilleureDistance) { meilleureDistance = distance; meilleur = i; }
        }
        choisis.push(meilleur);
    }
    return choisis.sort((a, b) => a - b);
}

export function nombreEpingles(nombreSommets) {
    return Math.max(2, Math.min(4, Math.round(nombreSommets / 8)));
}

function disperser(alea, nombre, cercle) {
    if (!cercle) return semisDePoints(alea, nombre);
    const rayon = TAILLE / 2 - MARGE;
    const depart = alea.suivant() * Math.PI * 2;
    return alea.melanger([...Array(nombre).keys()]).map(rang => {
        const angle = depart + (rang / nombre) * Math.PI * 2;
        return { x: TAILLE / 2 + rayon * Math.cos(angle), y: TAILLE / 2 + rayon * Math.sin(angle) };
    });
}

// Un brouillage doit être franchement emmêlé : le hasard produit parfois une
// disposition à moitié résolue, qui donnerait une partie sans intérêt. On en
// tire plusieurs et on garde la plus embrouillée.
export function brouiller(alea, solution, aretes, options = {}) {
    const { cercle = false, epingles = [] } = options;
    const seuil = Math.max(4, Math.round(solution.length * 0.6));
    let meilleur = null;
    let meilleurCompte = -1;
    for (let essai = 0; essai < TENTATIVES_BROUILLAGE; essai++) {
        const positions = alea.melanger(disperser(alea, solution.length, cercle));
        for (const epingle of epingles) positions[epingle] = { ...solution[epingle] };
        const compte = nombreConflits(positions, aretes);
        if (compte > meilleurCompte) { meilleurCompte = compte; meilleur = positions; }
        if (compte >= seuil) break;
    }
    return meilleur;
}

export function genererPuzzle({ graine, niveau = 'echeveau', cercle = false, epingles = false }) {
    const definition = NIVEAUX[niveau] || NIVEAUX.echeveau;
    const nombre = definition.sommets;
    let solution = null;
    let aretes = null;
    let tentatives = 0;

    // Une triangulation n’est pas toujours 3-connexe : il suffit qu’un sommet
    // du bord n’ait que ses deux voisins de coque pour tout perdre. Aucun fil
    // ne peut réparer ça — la triangulation est déjà maximale. On resème.
    while (tentatives < TENTATIVES_SEMIS) {
        const alea = new Alea(`${graine}|${niveau}|${tentatives}`);
        const points = semisDePoints(alea, nombre);
        const complete = triangulationGloutonne(points);
        tentatives++;
        if (!estTriconnexe(nombre, complete)) continue;
        solution = points;
        aretes = elaguer(alea, nombre, complete, Math.round(DENSITE * nombre));
        break;
    }
    if (!solution) throw new Error(`aucun écheveau 3-connexe pour ${graine}/${niveau}`);

    const aleaDepart = new Alea(`${graine}|${niveau}|depart|${cercle ? 'cercle' : 'semis'}|${epingles ? 'epingles' : 'libre'}`);
    const ancres = epingles ? choisirEpingles(aleaDepart, solution, nombreEpingles(nombre)) : [];
    const positions = brouiller(aleaDepart, solution, aretes, { cercle, epingles: ancres });

    return {
        graine: String(graine),
        niveau: definition.id,
        sommets: nombre,
        aretes,
        solution,
        positions,
        epingles: ancres,
        tentatives
    };
}
