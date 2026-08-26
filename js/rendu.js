// Le dessin, et rien que le dessin : ce module ne connaît aucune règle du jeu.
// On lui donne des positions et des indices de fils fautifs, il les pose dans
// le SVG. Les teintes viennent des variables CSS — il n’en garde pas de copie.

import { TAILLE } from './config.js';

let plateau = null;

// Un fil, deux traits superposés : l’âme claire sur le fond sombre. C’est ce
// qui fait le cordage tressé, le double filet, la piste à reflet ou la
// traînée lumineuse selon le monde — sans une ligne de JavaScript par thème.
function creerFil(document) {
    const groupe = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    groupe.setAttribute('class', 'fil');
    for (const role of ['fil-fond', 'fil-ame']) {
        const trait = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        trait.setAttribute('class', role);
        groupe.append(trait);
    }
    return groupe;
}

function creerSommet(document, index, epingle) {
    const svg = 'http://www.w3.org/2000/svg';
    const groupe = document.createElementNS(svg, 'g');
    groupe.setAttribute('class', epingle ? 'sommet sommet--epingle' : 'sommet');
    groupe.dataset.sommet = String(index);

    // Les rayons sont repris par les variables CSS de chaque monde ; ceux
    // posés ici en attribut sont le filet de sécurité d’un navigateur qui ne
    // saurait pas lire `r` en CSS — sans eux, les sommets disparaîtraient.
    for (const [role, rayon] of [['sommet-halo', 34], ['sommet-corps', 16], ['sommet-coeur', 6]]) {
        const cercle = document.createElementNS(svg, 'circle');
        cercle.setAttribute('class', role);
        cercle.setAttribute('r', String(rayon));
        groupe.append(cercle);
    }
    const rivet = document.createElementNS(svg, 'path');
    rivet.setAttribute('class', 'sommet-rivet');
    rivet.setAttribute('d', 'M-7 0 H7 M0 -7 V7');
    groupe.append(rivet);
    return groupe;
}

export function construirePlateau(document, { svg, fils, sommets, laisse }, puzzle) {
    fils.replaceChildren(...puzzle.aretes.map(() => creerFil(document)));
    sommets.replaceChildren(...Array.from({ length: puzzle.sommets },
        (_, index) => creerSommet(document, index, puzzle.epingles.includes(index))));
    plateau = {
        svg,
        laisse,
        aretes: puzzle.aretes,
        fils: [...fils.children],
        sommets: [...sommets.children],
        traits: [...fils.children].map(groupe => [...groupe.children])
    };
    return plateau;
}

export function placerSommet(index, x, y) {
    if (!plateau) return;
    plateau.sommets[index].setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
}

// Redessiner seulement ce qui bouge : les fils du sommet tiré, pas les
// soixante-huit autres. Le marquage des fautifs, lui, regarde tout — mais il
// se contente d’ajouter ou de retirer une classe.
export function rendreFilsDe(index, positions) {
    if (!plateau) return;
    plateau.aretes.forEach((arete, rang) => {
        if (arete[0] !== index && arete[1] !== index) return;
        rendreFil(rang, positions);
    });
}

function rendreFil(rang, positions) {
    const [a, b] = plateau.aretes[rang];
    for (const trait of plateau.traits[rang]) {
        trait.setAttribute('x1', positions[a].x.toFixed(2));
        trait.setAttribute('y1', positions[a].y.toFixed(2));
        trait.setAttribute('x2', positions[b].x.toFixed(2));
        trait.setAttribute('y2', positions[b].y.toFixed(2));
    }
}

export function rendreTout(positions) {
    if (!plateau) return;
    positions.forEach((point, index) => placerSommet(index, point.x, point.y));
    plateau.aretes.forEach((_, rang) => rendreFil(rang, positions));
}

// Quatre paliers plutôt qu’un drapeau, et une échelle relative au pire fil du
// moment plutôt qu’à des seuils fixes.
//
// Des seuils fixes ne marchent à aucun bout de la partie : au départ, un
// écheveau de vingt-quatre sommets compte trois cents croisements pour
// quarante-huit fils — tout dépasse n’importe quel seuil, le plateau redevient
// le mur uniforme qu’on voulait éviter. À la fin, il ne reste qu’un croisement
// et il faut qu’il crève les yeux. L’échelle relative fait les deux : elle
// désigne toujours les pires fils du moment, et le dernier croisement est
// toujours au rouge vif.
export const NIVEAUX_CHALEUR = ['', 'fil--chaud1', 'fil--chaud2', 'fil--chaud3'];

export function paliersDeChaleur(compte, maximum = compte) {
    if (compte <= 0) return 0;
    if (maximum <= 0) return 0;
    return Math.max(1, Math.min(3, Math.ceil((3 * compte) / maximum)));
}

export function marquerChaleur(comptes) {
    if (!plateau) return;
    const maximum = comptes.reduce((pire, compte) => Math.max(pire, compte), 0);
    plateau.fils.forEach((groupe, rang) => {
        const palier = paliersDeChaleur(comptes[rang], maximum);
        NIVEAUX_CHALEUR.forEach((classe, niveau) => {
            if (classe) groupe.classList.toggle(classe, niveau === palier);
        });
    });
}

export function marquer(index, classe, actif) {
    if (!plateau) return;
    for (const groupe of plateau.sommets) groupe.classList.remove(classe);
    if (actif && index >= 0) plateau.sommets[index].classList.add(classe);
}

export function tendreLaisse(depuis, vers) {
    if (!plateau) return;
    const { laisse } = plateau;
    if (!depuis || !vers) { laisse.classList.remove('tendue'); return; }
    laisse.setAttribute('x1', depuis.x.toFixed(2));
    laisse.setAttribute('y1', depuis.y.toFixed(2));
    laisse.setAttribute('x2', vers.x.toFixed(2));
    laisse.setAttribute('y2', vers.y.toFixed(2));
    laisse.classList.add('tendue');
}

// Du pixel de l’écran à l’unité du plateau. Le SVG est carré et sa viewBox
// aussi : la conversion est une simple règle de trois, sans matrice.
export function coordonneesPlateau(svg, clientX, clientY) {
    const cadre = svg.getBoundingClientRect();
    return {
        x: ((clientX - cadre.left) / cadre.width) * TAILLE,
        y: ((clientY - cadre.top) / cadre.height) * TAILLE
    };
}

// Le sommet le plus proche du doigt, dans un rayon donné. Viser une cible de
// 44 px parmi trente-quatre sommets est impossible sur un téléphone ; prendre
// le plus proche ne l’est pas.
export function sommetProche(positions, point, rayon) {
    let meilleur = -1;
    let minimum = rayon;
    positions.forEach((sommet, index) => {
        const ecart = Math.hypot(sommet.x - point.x, sommet.y - point.y);
        if (ecart <= minimum) { minimum = ecart; meilleur = index; }
    });
    return meilleur;
}

// Le voisin dans une direction, pour le pilotage au clavier : on ne garde que
// ce qui part franchement de ce côté, puis on prend le plus proche.
export function sommetDansLaDirection(positions, depart, direction) {
    const origine = positions[depart] || { x: TAILLE / 2, y: TAILLE / 2 };
    let meilleur = -1;
    let minimum = Infinity;
    positions.forEach((sommet, index) => {
        if (index === depart) return;
        const dx = sommet.x - origine.x;
        const dy = sommet.y - origine.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1) return;
        const projection = (dx * direction.x + dy * direction.y) / distance;
        // cos 55° : au-delà, le sommet n’est plus « de ce côté ».
        if (projection < 0.57) return;
        const cout = distance / projection;
        if (cout < minimum) { minimum = cout; meilleur = index; }
    });
    return meilleur;
}
