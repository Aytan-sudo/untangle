// Fabrication d’un écheveau. Le générateur ne sait rien du jeu : il rend un
// graphe planaire, une disposition qui le prouve, et une disposition brouillée
// pour commencer. Même graine, même écheveau.

import { MARGE, TAILLE } from './config.js';
import { Alea } from './hasard.js';
import {
    CONTACT, aretesEnConflit, croisementsFrancs, degres, distancePointSegment,
    estTriconnexe, unSommetReposeSurUnFil
} from './graphe.js';

// Six tailles, de la poignée de sommets à la petite treizaine. Les paliers
// suivent le nombre de croisements au départ, qui monte de moitié à chaque
// niveau — c’est lui, et non le nombre de sommets, qui fait la difficulté
// ressentie : 1, 5, 9, 12, 20, 33 en moyenne.
//
// La 1.1.0 s’était arrêtée à neuf, au motif qu’au-delà le jeu devenait une
// partie de patience contre l’écran. Les joueurs ont demandé plus haut, et à
// treize c’est encore jouable au doigt : vingt-six fils sur un plateau de
// téléphone, des sommets qui se frôlent parfois sans jamais se confondre. La
// limite n’a pas disparu, elle a bougé — trente-quatre sommets, l’échelle de
// la 1.0.0, reste une erreur.
//
// `feminin` n’est pas de la décoration : la Montée écrit « Toile démêlée » et
// « Écheveau démêlé », et cinq masculins sur six ne dispensent pas d’accorder
// le sixième. C’est une propriété du mot, elle vit avec lui.
export const NIVEAUX = {
    fil: { id: 'fil', nom: 'Fil', sommets: 4 },
    noeud: { id: 'noeud', nom: 'Nœud', sommets: 5 },
    echeveau: { id: 'echeveau', nom: 'Écheveau', sommets: 7 },
    toile: { id: 'toile', nom: 'Toile', sommets: 9, feminin: true },
    lacis: { id: 'lacis', nom: 'Lacis', sommets: 11 },
    dedale: { id: 'dedale', nom: 'Dédale', sommets: 13 }
};

// Fils par sommet visés après élagage. À ces tailles, la contrainte de
// 3-connexité y mène presque toute seule : un petit graphe planaire 3-connexe
// tient naturellement entre 1,5 et 2 fils par sommet, et l’élagage n’a
// souvent qu’un ou deux fils à retirer. La cible reste, pour les tailles où
// elle aurait quelque chose à faire.
export const DENSITE = 2;

const TENTATIVES_SEMIS = 200;
const TENTATIVES_BROUILLAGE = 120;

// Recentre et dilate le nuage pour qu’il occupe le cadre.
//
// Tirer quelques cases au hasard dans une grille laisse souvent la moitié du
// plateau vide : à quatre sommets, le graphe se tasse dans un coin et l’écran
// a l’air en panne.
//
// Les deux axes s’étirent séparément — c’est une application affine, elle
// préserve exactement la planarité et les croisements, donc la garantie du
// jeu n’en souffre pas. Les deux facteurs valent au moins 1, puisque la boîte
// englobante tient forcément dans le plateau : les sommets ne peuvent que
// s’écarter, jamais se rapprocher, et aucune distance de contact ne diminue.
// Reste l’œil : un étirement libre aplatirait les figures en accordéon, d’où
// la bride sur l’écart entre les deux facteurs.
export const DEFORMATION_MAX = 1.8;

export function etaler(points) {
    const utile = TAILLE - 2 * MARGE;
    const etendue = axe => {
        const valeurs = points.map(point => point[axe]);
        const minimum = Math.min(...valeurs);
        const maximum = Math.max(...valeurs);
        return [minimum, maximum, maximum - minimum];
    };
    const [minX, maxX, largeur] = etendue('x');
    const [minY, maxY, hauteur] = etendue('y');
    if (largeur <= 1 && hauteur <= 1) return points;

    let facteurX = largeur > 1 ? utile / largeur : Infinity;
    let facteurY = hauteur > 1 ? utile / hauteur : Infinity;
    const plancher = Math.min(facteurX, facteurY);
    facteurX = Math.min(facteurX, plancher * DEFORMATION_MAX);
    facteurY = Math.min(facteurY, plancher * DEFORMATION_MAX);

    const centreX = (minX + maxX) / 2;
    const centreY = (minY + maxY) / 2;
    return points.map(point => ({
        x: TAILLE / 2 + (point.x - centreX) * facteurX,
        y: TAILLE / 2 + (point.y - centreY) * facteurY
    }));
}

// Un semis sur grille jitterée plutôt qu’un semis franchement aléatoire : deux
// sommets ne peuvent pas se confondre, trois ne peuvent pas s’aligner. La
// grille est à peine plus grande que le nombre de sommets — assez lâche pour
// que les dispositions varient, assez serrée pour que le nuage ne se tasse
// pas — puis l’étalement finit le travail.
export function semisDePoints(alea, nombre) {
    const cotes = Math.ceil(Math.sqrt(nombre * 1.6));
    const pas = (TAILLE - 2 * MARGE) / cotes;
    const cases = [];
    for (let y = 0; y < cotes; y++) for (let x = 0; x < cotes; x++) cases.push([x, y]);
    return etaler(alea.melanger(cases).slice(0, nombre).map(([x, y]) => ({
        x: MARGE + (x + 0.2 + 0.6 * alea.suivant()) * pas,
        y: MARGE + (y + 0.2 + 0.6 * alea.suivant()) * pas
    })));
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

// Une épingle pour quatre ou cinq sommets, jusqu’à quatre pour le Dédale.
// Le nombre suit la taille : trois ancres perdues dans treize sommets
// n’ancreraient plus grand-chose, et la variante n’aurait plus d’effet là où
// elle serait le plus utile.
export function nombreEpingles(nombreSommets) {
    if (nombreSommets <= 5) return 1;
    if (nombreSommets <= 7) return 2;
    return nombreSommets <= 9 ? 3 : 4;
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

// Combien de croisements francs on veut au départ : une fourchette, pas un
// plancher. Un plancher seul laissait passer la première disposition venue
// au-dessus du seuil, et le hasard en produit d’extravagantes — un Écheveau
// pouvait sortir à quatre croisements comme à vingt-deux. À ce compte-là, le
// niveau ne veut plus rien dire. La fourchette rend la difficulté annoncée
// tenable ; jamais moins d’un croisement, sans quoi la grille arrive résolue.
export function bandeDeBrouillage(nombreAretes) {
    const bas = Math.max(1, Math.round(nombreAretes * 0.45));
    return [bas, Math.max(bas + 1, Math.round(nombreAretes * 0.95))];
}

// Un brouillage doit être franchement emmêlé — et propre.
//
// « Propre » n’allait pas de soi : la première version prenait, à défaut de
// seuil atteint, la disposition la plus embrouillée de toutes. Or un sommet
// posé sur un fil compte comme un croisement. En dessous d’une dizaine de
// sommets le seuil n’est jamais atteignable — un K4 n’admet qu’un croisement
// franc, pas davantage — si bien que le « meilleur de quarante » allait
// systématiquement chercher les dispositions dégénérées : trois sommets
// alignés, un quatrième couché sur une corde. Ça gonflait le compteur sans
// rien apporter à jouer, et ça avait l’air d’un bug. On refuse donc d’abord
// les dispositions sales, on retient la première assez emmêlée, et à défaut
// la plus emmêlée parmi les propres.
export function brouiller(alea, solution, aretes, options = {}) {
    const { cercle = false, epingles = [] } = options;
    const [bas, haut] = bandeDeBrouillage(aretes.length);
    // À défaut de tomber dans la fourchette, on garde la disposition propre
    // qui s’en approche le plus — par le bas comme par le haut. Un K4 n’admet
    // qu’un seul croisement franc, quoi qu’on fasse : la fourchette y est hors
    // d’atteinte, et c’est le repli qui sert.
    let meilleur = null;
    let meilleurEcart = Infinity;
    let secours = null;
    let compteSecours = -1;
    for (let essai = 0; essai < TENTATIVES_BROUILLAGE; essai++) {
        const positions = alea.melanger(disperser(alea, solution.length, cercle));
        for (const epingle of epingles) positions[epingle] = { ...solution[epingle] };
        const compte = croisementsFrancs(positions, aretes);
        if (compte > compteSecours) { compteSecours = compte; secours = positions; }
        if (unSommetReposeSurUnFil(positions, aretes)) continue;
        if (compte >= bas && compte <= haut) return positions;
        const ecart = compte < bas ? bas - compte : compte - haut;
        if (compte >= 1 && ecart < meilleurEcart) { meilleurEcart = ecart; meilleur = positions; }
    }
    return meilleur || secours;
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
