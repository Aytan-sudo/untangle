// La Montée : les six tailles enchaînées, du Fil au Dédale, sous un seul
// chronomètre. Ce module ne connaît ni le DOM, ni l’horloge, ni le hasard —
// on lui verse les résultats d’un palier, il dit lequel vient ensuite.
//
// Pas de vies, pas de sablier, pas de défaite : Untangle est un jeu où l’on
// ne peut pas perdre une grille, et lui inventer une perte pour l’occasion
// l’aurait trahi. La tension vient de l’horloge qui ne s’arrête pas entre les
// paliers, et de l’envie de finir sans indice.

import { NIVEAUX } from './generateur.js';

// L’échelle complète, dans l’ordre. C’est la seule liste : `PALIERS.length`
// donne le nombre de paliers, et ajouter une taille à `NIVEAUX` ne la change
// pas — une montée qui grandirait toute seule invaliderait les records.
export const PALIERS = ['fil', 'noeud', 'echeveau', 'toile', 'lacis', 'dedale'];

// La montée n’est pas une taille de plus : c’est un mode. Elle a donc son
// propre identifiant de configuration, son propre palmarès, et son nom vit ici
// plutôt que dans `NIVEAUX`, où il ferait un septième bouton de taille.
export const MONTEE = { id: 'montee', nom: 'Montée' };

export const MODE_GRILLE = 'grille';
export const MODE_MONTEE = 'montee';

// Une graine par palier, dérivée de celle de la montée. Deux montées de graine
// voisine n’ont aucun palier en commun, et la même graine redonne exactement
// la même série — c’est ce qui rend la montée du jour et le partage possibles
// sans qu’aucun octet ne circule.
export function graineDuPalier(graine, rang) {
    return `${graine}|montee|${PALIERS[rang]}`;
}

export function monteeNeuve(graine) {
    return { graine: String(graine), rang: 0, franchis: [] };
}

export function niveauDuPalier(rang) {
    return PALIERS[Math.min(Math.max(0, rang), PALIERS.length - 1)];
}

export const palierCourant = montee => niveauDuPalier(montee.rang);
export const estDernierPalier = montee => montee.rang >= PALIERS.length - 1;
export const estAchevee = montee => montee.franchis.length >= PALIERS.length;

// Le rang affiché compte à partir de 1 : « palier 3 sur 6 » se lit, « rang 2 »
// ne se lit pas.
export const rangAffiche = montee => Math.min(montee.rang + 1, PALIERS.length);

// Un palier franchi s’ajoute à la liste et fait avancer d’un cran. Le temps
// versé ici est celui du palier seul ; le total se recompose en additionnant,
// ce qui évite d’avoir deux compteurs à garder d’accord.
export function franchir(montee, { tempsMs = 0, touches = 0, gestes = 0, indices = 0 } = {}) {
    if (estAchevee(montee)) return montee;
    montee.franchis.push({
        niveau: palierCourant(montee),
        tempsMs: Math.max(0, Math.round(tempsMs)),
        touches, gestes, indices
    });
    montee.rang = Math.min(montee.rang + 1, PALIERS.length - 1);
    return montee;
}

export function totalMontee(montee) {
    return montee.franchis.reduce((somme, palier) => ({
        tempsMs: somme.tempsMs + palier.tempsMs,
        touches: somme.touches + palier.touches,
        gestes: somme.gestes + palier.gestes,
        indices: somme.indices + palier.indices
    }), { tempsMs: 0, touches: 0, gestes: 0, indices: 0 });
}

// Les sommets de toute la montée : 4 + 5 + 7 + 9 + 11 + 13 = 49. Sert à dire
// « 31 sommets touchés sur 49 » à l’arrivée, ce qui ne veut rien dire palier
// par palier mais veut tout dire sur l’ensemble.
export const SOMMETS_EN_TOUT = PALIERS.reduce((somme, id) => somme + NIVEAUX[id].sommets, 0);

// La montée en six blocs, un par palier : vert si le palier est tombé sans
// indice, jaune s’il a fallu de l’aide, gris s’il reste à faire. Elle ne dit
// rien de la solution — seulement comment la montée s’est passée.
const FRANC = '🟩';
const AIDE = '🟨';
const RESTE = '⬜';

export function courbeDeMontee(montee) {
    return PALIERS.map((_, rang) => {
        const palier = montee.franchis[rang];
        if (!palier) return RESTE;
        return palier.indices ? AIDE : FRANC;
    }).join('');
}

export function serialiserMontee(montee) {
    return {
        graine: montee.graine,
        rang: montee.rang,
        franchis: montee.franchis.map(({ niveau, tempsMs, touches, gestes, indices }) =>
            [niveau, tempsMs, touches, gestes, indices])
    };
}

// Une montée bricolée à la main ne doit pas pouvoir sauter des paliers : le
// rang se recale sur le nombre de paliers réellement franchis. Sans quoi un
// `rang: 5` posé dans le stockage offrirait le Dédale d’emblée, et le total
// afficherait le temps d’un seul palier.
export function restaurerMontee(sauvegarde) {
    if (!sauvegarde || typeof sauvegarde.graine !== 'string') return null;
    const montee = monteeNeuve(sauvegarde.graine);
    const franchis = Array.isArray(sauvegarde.franchis) ? sauvegarde.franchis : [];
    for (const pas of franchis.slice(0, PALIERS.length)) {
        if (!Array.isArray(pas) || pas.length < 5) break;
        const [niveau, tempsMs, touches, gestes, indices] = pas;
        if (niveau !== palierCourant(montee) || estAchevee(montee)) break;
        franchir(montee, {
            tempsMs: Number(tempsMs) || 0,
            touches: Number(touches) || 0,
            gestes: Number(gestes) || 0,
            indices: Number(indices) || 0
        });
    }
    return montee;
}
