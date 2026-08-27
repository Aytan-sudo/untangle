// La Montée : l’échelle, le chronomètre unique, la reprise. Ce qui se teste
// ici, ce sont les promesses du mode — six paliers dans l’ordre, un temps
// total qui est la somme des paliers, et une sauvegarde qu’on ne peut pas
// bricoler pour se retrouver au Dédale sans avoir touché au Fil.

import { compteur } from './harness.mjs';
import { NIVEAUX, genererPuzzle } from '../js/generateur.js';
import { nombreConflits } from '../js/graphe.js';
import {
    MODE_GRILLE, MODE_MONTEE, MONTEE, PALIERS, SOMMETS_EN_TOUT, courbeDeMontee,
    estAchevee, estDernierPalier, franchir, graineDuPalier, monteeNeuve,
    niveauDuPalier, palierCourant, rangAffiche, restaurerMontee, serialiserMontee,
    totalMontee
} from '../js/montee.js';
import { cleConfiguration } from '../js/stockage.js';

const { check, egal, rapport } = compteur();
console.log('\nLa Montée\n');

// — L’échelle
{
    egal('les six paliers vont du Fil au Dédale', PALIERS, ['fil', 'noeud', 'echeveau', 'toile', 'lacis', 'dedale']);
    egal('chaque palier est une taille qui existe',
        PALIERS.filter(id => !NIVEAUX[id]), []);
    const tailles = PALIERS.map(id => NIVEAUX[id].sommets);
    egal('les tailles montent, de 4 à 13', tailles, [4, 5, 7, 9, 11, 13]);
    check('la montée compte 49 sommets en tout', SOMMETS_EN_TOUT === 49, String(SOMMETS_EN_TOUT));
    // Le panneau de palier écrit « démêlé » ou « démêlée » selon le mot : cinq
    // masculins et une Toile. Sans le drapeau, le sixième palier annoncerait
    // « Toile démêlé ».
    egal('seule la Toile est féminine',
        PALIERS.filter(id => NIVEAUX[id].feminin), ['toile']);
    // La montée est un mode, pas une taille : elle ne doit surtout pas
    // apparaître dans le sélecteur de tailles, où elle ferait un septième
    // bouton qui n’en est pas un.
    check('la montée n’est pas une taille de plus', !NIVEAUX[MONTEE.id]);
    check('les deux modes sont distincts', MODE_GRILLE !== MODE_MONTEE);
    egal('un rang hors bornes se recale', [niveauDuPalier(-3), niveauDuPalier(99)], ['fil', 'dedale']);
}

// — Une graine par palier
{
    const graines = PALIERS.map((_, rang) => graineDuPalier('semaine', rang));
    check('chaque palier a sa propre graine', new Set(graines).size === PALIERS.length);
    egal('la même montée redonne les mêmes graines',
        graines, PALIERS.map((_, rang) => graineDuPalier('semaine', rang)));
    check('deux montées voisines n’ont aucune grille en commun',
        PALIERS.every((_, rang) => graineDuPalier('a', rang) !== graineDuPalier('b', rang)));

    // La promesse du jeu vaut palier par palier : chaque grille de la montée
    // est démêlable, comme n’importe quelle autre.
    let demelables = 0;
    for (let rang = 0; rang < PALIERS.length; rang++) {
        const puzzle = genererPuzzle({ graine: graineDuPalier('garantie', rang), niveau: PALIERS[rang] });
        if (nombreConflits(puzzle.solution, puzzle.aretes) === 0
            && puzzle.sommets === NIVEAUX[PALIERS[rang]].sommets) demelables++;
    }
    check('chaque palier rend une grille démêlable', demelables === PALIERS.length, `${demelables}/${PALIERS.length}`);
}

// — Franchir les paliers
{
    const montee = monteeNeuve('essai');
    egal('on commence au Fil', palierCourant(montee), 'fil');
    check('et au palier 1 sur 6', rangAffiche(montee) === 1);
    check('rien n’est achevé au départ', !estAchevee(montee));
    check('le premier palier n’est pas le dernier', !estDernierPalier(montee));

    franchir(montee, { tempsMs: 12000, touches: 3, gestes: 4, indices: 0 });
    egal('franchir avance d’un cran', palierCourant(montee), 'noeud');
    check('et le rang affiché suit', rangAffiche(montee) === 2);

    franchir(montee, { tempsMs: 30000, touches: 4, gestes: 6, indices: 1 });
    const total = totalMontee(montee);
    egal('le total additionne les paliers',
        [total.tempsMs, total.touches, total.gestes, total.indices], [42000, 7, 10, 1]);

    for (let reste = 0; reste < 4; reste++) franchir(montee, { tempsMs: 1000, touches: 1, gestes: 1, indices: 0 });
    check('six paliers franchis achèvent la montée', estAchevee(montee));
    check('le dernier palier reste le Dédale', palierCourant(montee) === 'dedale');
    check('le rang affiché ne dépasse pas six', rangAffiche(montee) === 6);

    // Sans ce garde-fou, une victoire renvoyée deux fois — un `conclure`
    // rappelé, un dialogue rouvert — ajouterait un septième palier au total.
    franchir(montee, { tempsMs: 99999, touches: 99, gestes: 99, indices: 9 });
    check('une montée achevée n’accepte plus de palier',
        montee.franchis.length === PALIERS.length && totalMontee(montee).tempsMs === 46000,
        `${montee.franchis.length} paliers, ${totalMontee(montee).tempsMs} ms`);
}

// — La courbe de partage
{
    const montee = monteeNeuve('courbe');
    egal('une montée neuve n’affiche que du gris', courbeDeMontee(montee), '⬜⬜⬜⬜⬜⬜');
    franchir(montee, { tempsMs: 1, touches: 1, gestes: 1, indices: 0 });
    franchir(montee, { tempsMs: 1, touches: 1, gestes: 1, indices: 2 });
    egal('elle dit où l’aide a servi', courbeDeMontee(montee), '🟩🟨⬜⬜⬜⬜');
    check('elle fait toujours six blocs', [...courbeDeMontee(montee)].length === PALIERS.length);
    // Elle raconte le parcours, jamais la solution : aucun temps, aucune
    // position, aucun nombre de croisements n’y transparaît.
    check('elle ne livre rien de la solution',
        !/\d/.test(courbeDeMontee(montee)));
}

// — Sérialiser et reprendre
{
    const montee = monteeNeuve('reprise');
    franchir(montee, { tempsMs: 5000, touches: 2, gestes: 3, indices: 0 });
    franchir(montee, { tempsMs: 7000, touches: 3, gestes: 5, indices: 1 });
    const repris = restaurerMontee(serialiserMontee(montee));
    egal('une montée se relit telle quelle', serialiserMontee(repris), serialiserMontee(montee));
    egal('elle reprend au bon palier', palierCourant(repris), 'echeveau');
    egal('avec son temps déjà couru', totalMontee(repris).tempsMs, 12000);

    check('un stockage absent ne rend pas de montée', restaurerMontee(null) === null);
    check('un stockage sans graine non plus', restaurerMontee({ franchis: [] }) === null);
    // Le piège : `rang: 5` posé à la main dans le stockage offrirait le Dédale
    // d’emblée, avec le temps d’un seul palier au compteur. Le rang se déduit
    // donc des paliers réellement franchis, il ne se lit pas.
    const triche = restaurerMontee({ graine: 'triche', rang: 5, franchis: [] });
    egal('un rang bricolé ne saute aucun palier', palierCourant(triche), 'fil');
    const troue = restaurerMontee({
        graine: 'troue',
        franchis: [['fil', 1000, 1, 1, 0], ['toile', 2000, 2, 2, 0]]
    });
    egal('une suite de paliers incohérente s’arrête au dernier valide',
        [palierCourant(troue), totalMontee(troue).tempsMs], ['noeud', 1000]);
    const deborde = restaurerMontee({
        graine: 'deborde',
        franchis: PALIERS.concat(PALIERS).map((id, rang) => [PALIERS[rang % PALIERS.length], 1000, 1, 1, 0])
    });
    egal('et jamais plus de six', deborde.franchis.length, PALIERS.length);
}

// — Le palmarès
{
    // La montée a sa propre configuration : son temps total ne concourt pas
    // contre le temps d’une grille de sept sommets.
    egal('la montée a sa clé de palmarès', cleConfiguration(MONTEE.id, {}), 'montee');
    egal('et les variantes s’y combinent comme ailleurs',
        cleConfiguration(MONTEE.id, { cercle: true, aveugle: true }), 'montee+cercle+aveugle');
    check('elle ne se confond avec aucune taille',
        PALIERS.every(id => cleConfiguration(id, {}) !== cleConfiguration(MONTEE.id, {})));
}

rapport();
