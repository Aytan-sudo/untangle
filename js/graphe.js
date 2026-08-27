// Géométrie et structure du démêlage. Des points, des segments, une matrice
// d’adjacence — ni DOM, ni horloge, ni hasard : tout se teste en Node.

// Tolérance de contact, en unités du plateau (le plateau fait 1000 de côté et
// un sommet en occupe une trentaine). Un sommet posé à moins de ça d’un fil
// est réputé posé dessus. À l’œil il l’est ; prétendre le contraire donnerait
// des grilles « résolues » où un sommet repose visiblement sur une corde, et
// laisserait la variante Aimant produire des superpositions exactes que le
// test strict de croisement ne verrait jamais.
export const CONTACT = 16;

const EPS = 1e-9;

function produitVectoriel(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function distancePointSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const carre = dx * dx + dy * dy;
    if (carre < EPS) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / carre));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Croisement franc : les deux segments se traversent, extrémités exclues. Les
// cas limites (une extrémité posée sur l’autre segment, deux segments
// colinéaires) ne passent pas par ici — ils sont pris par la tolérance de
// contact, qui les décide sans jamais dépendre d’un signe à 1e-15 près.
export function segmentsSeTraversent(a, b, c, d) {
    const d1 = produitVectoriel(a, b, c);
    const d2 = produitVectoriel(a, b, d);
    const d3 = produitVectoriel(c, d, a);
    const d4 = produitVectoriel(c, d, b);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
        && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// Deux fils sont en conflit s’ils se traversent, se frôlent, ou si le sommet
// libre de l’un repose sur l’autre. Deux fils partant du même sommet ne se
// croisent pas — sauf à se superposer, ce que la seconde règle attrape.
export function aretesEnConflit(positions, arete1, arete2) {
    const [a1, b1] = arete1;
    const [a2, b2] = arete2;
    const p1 = positions[a1], q1 = positions[b1];
    const p2 = positions[a2], q2 = positions[b2];
    const partageA1 = a1 === a2 || a1 === b2;
    const partageB1 = b1 === a2 || b1 === b2;
    if (partageA1 || partageB1) {
        const libre1 = partageA1 ? q1 : p1;
        const libre2 = (a2 === a1 || a2 === b1) ? q2 : p2;
        return distancePointSegment(libre1, p2, q2) <= CONTACT
            || distancePointSegment(libre2, p1, q1) <= CONTACT;
    }
    return distancePointSegment(p1, p2, q2) <= CONTACT
        || distancePointSegment(q1, p2, q2) <= CONTACT
        || distancePointSegment(p2, p1, q1) <= CONTACT
        || distancePointSegment(q2, p1, q1) <= CONTACT
        || segmentsSeTraversent(p1, q1, p2, q2);
}

export function conflits(positions, aretes) {
    const trouves = [];
    for (let i = 0; i < aretes.length; i++) {
        for (let j = i + 1; j < aretes.length; j++) {
            if (aretesEnConflit(positions, aretes[i], aretes[j])) trouves.push([i, j]);
        }
    }
    return trouves;
}

export function nombreConflits(positions, aretes) {
    return conflits(positions, aretes).length;
}

// Combien de croisements chaque fil porte. Un simple « fautif / sain » ne dit
// rien au début d’une partie : sur un écheveau brouillé, la quasi-totalité des
// fils sont fautifs et le plateau devient un mur uniforme. Le compte, lui, se
// gradue — on voit tout de suite les pires, et on voit le dernier.
// Il se calcule à partir des paires déjà trouvées : le rendu en a besoin à
// chaque image, il ne va pas parcourir l’écheveau deux fois.
// Les croisements francs seulement : deux fils qui se traversent vraiment, à
// l’exclusion des contacts. Le jeu, lui, compte les deux — un sommet posé sur
// un fil est bien une faute. Mais pour juger la qualité d’un brouillage, il
// faut savoir distinguer un écheveau franchement emmêlé d’une disposition
// simplement dégénérée.
export function croisementsFrancs(positions, aretes) {
    let compte = 0;
    for (let i = 0; i < aretes.length; i++) {
        for (let j = i + 1; j < aretes.length; j++) {
            const [a1, b1] = aretes[i];
            const [a2, b2] = aretes[j];
            if (a1 === a2 || a1 === b2 || b1 === a2 || b1 === b2) continue;
            if (segmentsSeTraversent(positions[a1], positions[b1], positions[a2], positions[b2])) compte++;
        }
    }
    return compte;
}

// Un sommet posé sur un fil qui ne lui appartient pas — ou deux sommets
// confondus, qui est le même accident. C’est une faute en cours de partie,
// mais c’est surtout une disposition de départ qu’il ne faut jamais servir :
// elle a l’air d’un bug, pas d’une énigme.
export function unSommetReposeSurUnFil(positions, aretes) {
    for (const [a, b] of aretes) {
        for (let k = 0; k < positions.length; k++) {
            if (k === a || k === b) continue;
            if (distancePointSegment(positions[k], positions[a], positions[b]) <= CONTACT) return true;
        }
    }
    return false;
}

export function comptesParArete(nombreAretes, paires) {
    const compte = new Array(nombreAretes).fill(0);
    for (const [i, j] of paires) { compte[i]++; compte[j]++; }
    return compte;
}

export function conflitsParArete(positions, aretes) {
    return comptesParArete(aretes.length, conflits(positions, aretes));
}

// Combien de conflits chaque sommet porte, par ses propres fils. Sert à
// l’indice — le sommet le plus empêtré est celui qu’il faut bouger — et au
// halo des sommets fautifs.
export function conflitsParSommet(nombreSommets, aretes, positions) {
    const compte = new Array(nombreSommets).fill(0);
    for (const [i, j] of conflits(positions, aretes)) {
        for (const sommet of [...aretes[i], ...aretes[j]]) compte[sommet]++;
    }
    return compte;
}

// Les conflits que porte un seul sommet, sans parcourir tout le plateau. Sert
// à l’indice — le sommet le plus empêtré est celui qu’il faut bouger — et à
// chercher où le poser sans recompter l’écheveau entier à chaque candidat.
export function conflitsAutour(positions, aretes, sommet) {
    let compte = 0;
    for (let i = 0; i < aretes.length; i++) {
        const [a, b] = aretes[i];
        if (a !== sommet && b !== sommet) continue;
        for (let j = 0; j < aretes.length; j++) {
            if (j === i) continue;
            const [c, d] = aretes[j];
            // Deux fils du même sommet : la paire ne se compte qu’une fois.
            if ((c === sommet || d === sommet) && j < i) continue;
            if (aretesEnConflit(positions, aretes[i], aretes[j])) compte++;
        }
    }
    return compte;
}

export function adjacence(nombreSommets, aretes) {
    const voisins = Array.from({ length: nombreSommets }, () => []);
    for (const [a, b] of aretes) { voisins[a].push(b); voisins[b].push(a); }
    return voisins;
}

export function degres(nombreSommets, aretes) {
    const compte = new Array(nombreSommets).fill(0);
    for (const [a, b] of aretes) { compte[a]++; compte[b]++; }
    return compte;
}

// Connexité, éventuellement privée de quelques sommets : c’est la brique du
// test de 3-connexité juste en dessous.
export function estConnexe(nombreSommets, aretes, retires = [], voisins = adjacence(nombreSommets, aretes)) {
    const absent = new Uint8Array(nombreSommets);
    for (const sommet of retires) absent[sommet] = 1;
    let depart = -1;
    for (let i = 0; i < nombreSommets; i++) if (!absent[i]) { depart = i; break; }
    if (depart < 0) return true;
    const vus = new Uint8Array(nombreSommets);
    const pile = [depart];
    vus[depart] = 1;
    let atteints = 1;
    while (pile.length) {
        for (const voisin of voisins[pile.pop()]) {
            if (absent[voisin] || vus[voisin]) continue;
            vus[voisin] = 1;
            atteints++;
            pile.push(voisin);
        }
    }
    return atteints === nombreSommets - retires.length;
}

// Un graphe planaire 3-connexe n’admet qu’un seul dessin planaire, à
// réflexion près (théorème de Whitney). C’est la garantie du jeu : quand
// l’écheveau est démêlé, c’est le dessin du générateur qui a été retrouvé, et
// pas un cousin. L’élagage du générateur ne retire donc jamais un fil qui
// coûterait cette propriété.
export function estTriconnexe(nombreSommets, aretes) {
    if (nombreSommets < 4) return false;
    if (degres(nombreSommets, aretes).some(degre => degre < 3)) return false;
    const voisins = adjacence(nombreSommets, aretes);
    if (!estConnexe(nombreSommets, aretes, [], voisins)) return false;
    for (let u = 0; u < nombreSommets; u++) {
        for (let v = u + 1; v < nombreSommets; v++) {
            if (!estConnexe(nombreSommets, aretes, [u, v], voisins)) return false;
        }
    }
    return true;
}
