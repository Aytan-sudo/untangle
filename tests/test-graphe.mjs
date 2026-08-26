import { compteur } from './harness.mjs';
import {
    CONTACT, adjacence, aretesEnConflit, comptesParArete, conflits, conflitsParArete,
    conflitsParSommet, degres, distancePointSegment, estConnexe, estTriconnexe,
    nombreConflits, segmentsSeTraversent
} from '../js/graphe.js';

const { check, proche, egal, rapport } = compteur();
console.log('\nGéométrie et structure du graphe\n');

const p = (x, y) => ({ x, y });

// — Distance d’un point à un segment
proche('distance au milieu du segment', distancePointSegment(p(50, 10), p(0, 0), p(100, 0)), 10);
proche('distance au-delà d’une extrémité', distancePointSegment(p(-30, 40), p(0, 0), p(100, 0)), 50);
proche('distance nulle sur le segment', distancePointSegment(p(30, 0), p(0, 0), p(100, 0)), 0);
proche('segment dégénéré : distance au point', distancePointSegment(p(3, 4), p(0, 0), p(0, 0)), 5);

// — Croisement franc
check('deux segments se traversent', segmentsSeTraversent(p(0, 0), p(100, 100), p(0, 100), p(100, 0)));
check('deux segments disjoints ne se traversent pas', !segmentsSeTraversent(p(0, 0), p(10, 10), p(50, 50), p(60, 60)));
check('un contact par l’extrémité n’est pas une traversée', !segmentsSeTraversent(p(0, 0), p(100, 0), p(50, 0), p(50, 90)));
check('deux segments parallèles ne se traversent pas', !segmentsSeTraversent(p(0, 0), p(100, 0), p(0, 20), p(100, 20)));

// — Conflit entre deux fils
{
    const positions = [p(0, 0), p(100, 100), p(0, 100), p(100, 0)];
    check('un croisement franc est un conflit', aretesEnConflit(positions, [0, 1], [2, 3]));
}
{
    const positions = [p(0, 0), p(100, 0), p(0, 200), p(100, 200)];
    check('deux fils bien séparés ne sont pas en conflit', !aretesEnConflit(positions, [0, 1], [2, 3]));
}
{
    // Deux fils partant du même sommet : autorisés, c’est le principe même
    // d’un graphe. Sauf superposés.
    const positions = [p(0, 0), p(100, 0), p(0, 100)];
    check('deux fils d’un même sommet ne sont pas en conflit', !aretesEnConflit(positions, [0, 1], [0, 2]));
}
{
    const positions = [p(0, 0), p(100, 0), p(40, 0)];
    check('deux fils d’un même sommet superposés sont en conflit', aretesEnConflit(positions, [0, 1], [0, 2]));
}
{
    // La règle qui interdit de tricher : poser un sommet sur un fil.
    const positions = [p(0, 0), p(100, 0), p(50, 1), p(50, 200)];
    check('un sommet posé sur un fil est un conflit', aretesEnConflit(positions, [0, 1], [2, 3]));
}
{
    const positions = [p(0, 0), p(100, 0), p(50, CONTACT + 2), p(50, 200)];
    check('un sommet frôlant juste hors tolérance passe', !aretesEnConflit(positions, [0, 1], [2, 3]));
}
{
    // Deux sommets empilés l’un sur l’autre : le fil de l’un touche celui de
    // l’autre à distance nulle.
    const positions = [p(0, 0), p(300, 0), p(0, 0), p(0, 300)];
    check('deux sommets confondus sont un conflit', aretesEnConflit(positions, [0, 1], [2, 3]));
}

// — Comptage
{
    // Une étoile à cinq branches tracée d’un trait : cinq croisements.
    const positions = [];
    for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
        positions.push(p(500 + 400 * Math.cos(angle), 500 + 400 * Math.sin(angle)));
    }
    const aretes = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]];
    check('le pentagramme compte cinq croisements', nombreConflits(positions, aretes) === 5, String(nombreConflits(positions, aretes)));
    // Chaque branche du pentagramme en croise deux : la chaleur est uniforme.
    egal('chaque fil du pentagramme porte deux croisements',
        conflitsParArete(positions, aretes), [2, 2, 2, 2, 2]);
    egal('les comptes se déduisent des paires déjà trouvées',
        comptesParArete(aretes.length, conflits(positions, aretes)), [2, 2, 2, 2, 2]);
    const parSommet = conflitsParSommet(5, aretes, positions);
    // Chaque sommet tient deux fils, et chacun de ces fils traverse deux
    // autres fils : quatre conflits à son compte.
    check('chaque sommet du pentagramme porte quatre conflits', parSommet.every(compte => compte === 4), parSommet.join(','));
}
{
    const positions = [p(100, 100), p(900, 100), p(900, 900), p(100, 900)];
    const aretes = [[0, 1], [1, 2], [2, 3], [3, 0]];
    check('un carré est sans conflit', nombreConflits(positions, aretes) === 0);
    egal('aucun fil n’est chaud', conflitsParArete(positions, aretes), [0, 0, 0, 0]);
    egal('aucune paire en conflit', conflits(positions, aretes), []);
}

// — Structure
{
    const carre = [[0, 1], [1, 2], [2, 3], [3, 0]];
    egal('les degrés du cycle valent deux', degres(4, carre), [2, 2, 2, 2]);
    egal('l’adjacence liste les voisins', adjacence(4, carre)[0], [1, 3]);
    check('le cycle est connexe', estConnexe(4, carre));
    check('le cycle privé de deux sommets se casse', !estConnexe(4, carre, [0, 2]));
    check('le cycle n’est pas 3-connexe', !estTriconnexe(4, carre));
}
{
    const k4 = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
    check('K4 est 3-connexe', estTriconnexe(4, k4));
    check('K4 privé d’un fil ne l’est plus', !estTriconnexe(4, k4.slice(1)));
}
{
    // Le graphe du cube : 3-connexe, planaire, huit sommets de degré trois.
    const cube = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    check('le cube est 3-connexe', estTriconnexe(8, cube));
    check('le cube amputé d’un fil ne l’est plus', !estTriconnexe(8, cube.filter(([a, b]) => !(a === 0 && b === 4))));
}
{
    // Deux K4 reliés par un seul sommet : connexe, degrés ≥ 3 par endroits,
    // mais un unique point d’articulation suffit à le couper.
    const papillon = [[0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [3, 4]];
    check('un papillon n’est pas 3-connexe', !estTriconnexe(5, papillon));
}
{
    const isole = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
    check('un sommet isolé interdit la 3-connexité', !estTriconnexe(5, isole));
}

rapport();
