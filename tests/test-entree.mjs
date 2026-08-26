// La couche d’entrée, sur un faux plateau. C’est là que vivent les décisions
// de geste — le sommet remonté au-dessus du doigt, le tapotement qui ne compte
// pas, le pas du clavier — et aucune ne lève d’erreur quand elle se trompe :
// elle rend simplement le jeu désagréable, sur un téléphone qu’on n’a pas
// sous la main.

import { compteur } from './harness.mjs';
import {
    DECALAGE_DOIGT, RAYON_SAISIE_DOIGT, RAYON_SAISIE_SOURIS, SEUIL_GESTE,
    brancherClavier, brancherPointeur, decalagePour
} from '../js/entree.js';

const { check, egal, rapport } = compteur();
console.log('\nDoigt, souris et clavier\n');

function fauxPlateau() {
    const ecouteurs = new Map();
    return {
        classes: new Set(),
        classList: {
            add(classe) { this.proprietaire.classes.add(classe); },
            remove(classe) { this.proprietaire.classes.delete(classe); }
        },
        setPointerCapture() {},
        addEventListener(type, fonction) {
            if (!ecouteurs.has(type)) ecouteurs.set(type, []);
            ecouteurs.get(type).push(fonction);
        },
        emettre(type, details = {}) {
            for (const fonction of ecouteurs.get(type) || []) {
                fonction({ preventDefault() {}, stopPropagation() {}, ...details });
            }
        }
    };
}

// Un plateau bidon et des actions qui notent tout ce qu’on leur demande.
function banc({ positions = [{ x: 100, y: 100 }, { x: 400, y: 400 }], epingles = [] } = {}) {
    const plateau = fauxPlateau();
    plateau.classList.proprietaire = plateau;
    const journal = [];
    let vise = -1;
    const actions = {
        coordonnees: (x, y) => ({ x, y }),
        viser: (point, rayon) => {
            let meilleur = -1;
            let minimum = rayon;
            positions.forEach((sommet, index) => {
                const ecart = Math.hypot(sommet.x - point.x, sommet.y - point.y);
                if (ecart <= minimum) { minimum = ecart; meilleur = index; }
            });
            return meilleur;
        },
        peutPrendre: index => !epingles.includes(index),
        positionDe: index => ({ ...positions[index] }),
        sommetVise: () => vise,
        viserSommet: index => { vise = index; journal.push(['viser', index]); },
        viserDansLaDirection: direction => journal.push(['direction', direction]) && -1,
        pasClavier: fin => (fin ? 5 : 25),
        prendre: index => { vise = index; journal.push(['prendre', index]); },
        glisser: (index, cible) => { positions[index] = { ...cible }; journal.push(['glisser', index, cible.x, cible.y]); },
        poser: (index, cible) => journal.push(['poser', index, cible.x, cible.y]),
        abandonner: (index, origine) => journal.push(['abandonner', index, origine?.x, origine?.y]),
        refuser: index => journal.push(['refuser', index])
    };
    return { plateau, journal, actions, positions, verbes: () => journal.map(([verbe]) => verbe) };
}

// ── Le décalage au doigt ──────────────────────────────────────────────────
{
    egal('la souris ne décale rien : le curseur ne cache pas le sommet', decalagePour('mouse'), 0);
    egal('le doigt décale le sommet vers le haut', decalagePour('touch'), DECALAGE_DOIGT);
    egal('un stylet est traité comme un doigt', decalagePour('pen'), DECALAGE_DOIGT);
    check('le décalage dépasse largement un bout de doigt', DECALAGE_DOIGT >= 80);
    check('le doigt vise plus large que la souris', RAYON_SAISIE_DOIGT > RAYON_SAISIE_SOURIS);
}

// ── Prendre, glisser, poser ───────────────────────────────────────────────
{
    const { plateau, journal, actions } = banc();
    brancherPointeur(plateau, actions);
    plateau.emettre('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    egal('le doigt prend le sommet le plus proche', journal[0], ['prendre', 0]);
    // Le sommet saute immédiatement au-dessus du doigt : sans ça, la main
    // couvre exactement ce qu’on essaie de placer.
    egal('le sommet monte aussitôt au-dessus du doigt', journal[1], ['glisser', 0, 100, 100 - DECALAGE_DOIGT]);
    check('le plateau se met en mode traction', plateau.classes.has('tire'));

    plateau.emettre('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 500 });
    egal('le sommet suit le doigt à distance constante', journal.at(-1), ['glisser', 0, 300, 500 - DECALAGE_DOIGT]);

    plateau.emettre('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 500 });
    egal('le sommet se pose au-dessus du doigt', journal.at(-1), ['poser', 0, 300, 500 - DECALAGE_DOIGT]);
    check('le mode traction est relâché', !plateau.classes.has('tire'));
}
{
    const { plateau, journal, actions } = banc();
    brancherPointeur(plateau, actions);
    plateau.emettre('pointerdown', { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100 });
    egal('à la souris, le sommet reste sous le curseur', journal[1], ['glisser', 0, 100, 100]);
    plateau.emettre('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 260, clientY: 260 });
    plateau.emettre('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: 260, clientY: 260 });
    egal('la souris pose là où elle est', journal.at(-1), ['poser', 0, 260, 260]);
}

// ── Le tapotement ─────────────────────────────────────────────────────────
{
    // Le sommet a bougé de cent unités rien qu’à la prise : sans cette règle,
    // un simple effleurement compterait comme un geste et fausserait le score.
    const { plateau, journal, actions } = banc();
    brancherPointeur(plateau, actions);
    plateau.emettre('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    plateau.emettre('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100 + SEUIL_GESTE - 2, clientY: 100 });
    plateau.emettre('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 100 + SEUIL_GESTE - 2, clientY: 100 });
    egal('sous le seuil, le sommet retourne d’où il vient', journal.at(-1), ['abandonner', 0, 100, 100]);
    check('rien n’a été posé', !journal.some(([verbe]) => verbe === 'poser'));
}
{
    const { plateau, journal, actions } = banc();
    brancherPointeur(plateau, actions);
    plateau.emettre('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    plateau.emettre('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100 + SEUIL_GESTE + 2, clientY: 100 });
    plateau.emettre('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 100 + SEUIL_GESTE + 2, clientY: 100 });
    check('au-delà du seuil, le geste compte', journal.at(-1)[0] === 'poser');
}

// ── Ce qu’on ne prend pas ─────────────────────────────────────────────────
{
    const { plateau, journal, actions } = banc({ epingles: [0] });
    brancherPointeur(plateau, actions);
    plateau.emettre('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    egal('un sommet épinglé est refusé, pas pris', journal, [['refuser', 0]]);
    plateau.emettre('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 300 });
    egal('et rien ne le suit', journal.length, 1);
}
{
    const { plateau, journal, actions } = banc();
    brancherPointeur(plateau, actions);
    // Loin de tout sommet : le doigt ne doit rien accrocher.
    plateau.emettre('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 800, clientY: 50 });
    egal('un doigt posé dans le vide ne prend rien', journal, []);
}
{
    const { plateau, journal, actions } = banc();
    brancherPointeur(plateau, actions);
    plateau.emettre('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    plateau.emettre('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 400 });
    plateau.emettre('pointercancel', { pointerId: 1, pointerType: 'touch', clientX: 400, clientY: 400 });
    egal('un geste interrompu remet le sommet en place', journal.at(-1), ['abandonner', 0, 100, 100]);
    check('le mode traction est relâché', !plateau.classes.has('tire'));
}
{
    // Deux doigts sur le plateau : le second ne doit pas voler le sommet du
    // premier, ni poser à sa place.
    const { plateau, journal, actions } = banc();
    brancherPointeur(plateau, actions);
    plateau.emettre('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    const avant = journal.length;
    plateau.emettre('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 400, clientY: 400 });
    egal('un second doigt est ignoré', journal.length, avant);
    plateau.emettre('pointerup', { pointerId: 2, pointerType: 'touch', clientX: 400, clientY: 400 });
    egal('et son relâchement aussi', journal.length, avant);
}

// ── Le clavier ────────────────────────────────────────────────────────────
{
    const { plateau, journal, actions } = banc();
    brancherClavier(plateau, actions);
    plateau.emettre('keydown', { key: 'ArrowRight' });
    egal('sans sommet en main, la flèche vise', journal.at(-1)[0], 'direction');

    actions.viserSommet(1);
    plateau.emettre('keydown', { key: 'Enter' });
    egal('Entrée prend le sommet visé', journal.at(-1), ['prendre', 1]);
    plateau.emettre('keydown', { key: 'ArrowLeft' });
    egal('sommet en main, la flèche le déplace', journal.at(-1), ['glisser', 1, 375, 400]);
    plateau.emettre('keydown', { key: 'ArrowUp', shiftKey: true });
    egal('Maj demande le pas fin', journal.at(-1), ['glisser', 1, 375, 395]);
    plateau.emettre('keydown', { key: 'Enter' });
    egal('Entrée repose le sommet', journal.at(-1), ['poser', 1, 375, 395]);
    plateau.emettre('keydown', { key: 'ArrowLeft' });
    egal('reposé, la flèche vise de nouveau', journal.at(-1)[0], 'direction');
}
{
    const { plateau, journal, actions } = banc();
    brancherClavier(plateau, actions);
    actions.viserSommet(0);
    plateau.emettre('keydown', { key: ' ' });
    egal('Espace prend aussi', journal.at(-1), ['prendre', 0]);
    plateau.emettre('keydown', { key: 'Escape' });
    egal('Échap rend le sommet à sa place', journal.at(-1), ['abandonner', 0, 100, 100]);
    plateau.emettre('keydown', { key: 'ArrowLeft' });
    egal('après Échap, la flèche vise', journal.at(-1)[0], 'direction');
}
{
    const { plateau, journal, actions } = banc({ epingles: [1] });
    brancherClavier(plateau, actions);
    actions.viserSommet(1);
    plateau.emettre('keydown', { key: 'Enter' });
    egal('au clavier aussi, une épingle se refuse', journal.at(-1), ['refuser', 1]);
}
{
    // Quitter le plateau en tenant un sommet le laisserait collé au clavier.
    const { plateau, journal, actions } = banc();
    brancherClavier(plateau, actions);
    actions.viserSommet(0);
    plateau.emettre('keydown', { key: 'Enter' });
    plateau.emettre('blur');
    egal('perdre le focus rend le sommet', journal.at(-1), ['abandonner', 0, 100, 100]);
}

rapport();
