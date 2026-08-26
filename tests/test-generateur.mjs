import { compteur } from './harness.mjs';
import { MARGE, TAILLE } from '../js/config.js';
import { Alea, graineLibre, hacher } from '../js/hasard.js';
import {
    DENSITE, NIVEAUX, brouiller, choisirEpingles, elaguer, genererPuzzle,
    nombreEpingles, semisDePoints, triangulationGloutonne
} from '../js/generateur.js';
import {
    CONTACT, aretesEnConflit, degres, distancePointSegment,
    estConnexe, estTriconnexe, nombreConflits
} from '../js/graphe.js';

const { check, egal, rapport } = compteur();
console.log('\nFabrication des écheveaux\n');

// — Le hasard, qui doit être le même partout et pour toujours
{
    egal('la même graine donne le même haché', hacher('2026-08-26'), hacher('2026-08-26'));
    check('deux graines voisines divergent', hacher('2026-08-26') !== hacher('2026-08-27'));
    check('le haché reste un entier non signé',
        ['', 'x', 'très longue graine accentuée ✦'].every(graine =>
            Number.isInteger(hacher(graine)) && hacher(graine) >= 0 && hacher(graine) < 2 ** 32));
    const tirages = Array.from({ length: 500 }, (_, i) => new Alea('suite').suivant());
    check('un tirage reste dans [0, 1[', tirages.every(valeur => valeur >= 0 && valeur < 1));
    const suite = new Alea('suite');
    const dix = Array.from({ length: 10 }, () => suite.suivant());
    const bis = new Alea('suite');
    egal('deux générateurs de même graine avancent ensemble',
        dix, Array.from({ length: 10 }, () => bis.suivant()));
    check('une graine libre est une chaîne non vide', typeof graineLibre() === 'string' && graineLibre().length > 3);
    check('deux graines libres diffèrent', graineLibre() !== graineLibre());
}

// — Le semis
{
    const alea = new Alea('semis');
    const points = semisDePoints(alea, 24);
    check('le semis rend le nombre de points demandé', points.length === 24);
    check('tous les points tiennent dans le plateau', points.every(({ x, y }) =>
        x >= MARGE && x <= TAILLE - MARGE && y >= MARGE && y <= TAILLE - MARGE));
    let minimum = Infinity;
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        minimum = Math.min(minimum, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
    check('deux points ne se confondent jamais', minimum > 4 * CONTACT, `écart minimal ${minimum.toFixed(1)}`);
}

// — La triangulation
{
    const points = semisDePoints(new Alea('triangulation'), 20);
    const aretes = triangulationGloutonne(points);
    let propre = true;
    for (let i = 0; i < aretes.length && propre; i++) {
        for (let j = i + 1; j < aretes.length && propre; j++) {
            if (aretesEnConflit(points, aretes[i], aretes[j])) propre = false;
        }
        for (let k = 0; k < points.length && propre; k++) {
            const [a, b] = aretes[i];
            if (k !== a && k !== b && distancePointSegment(points[k], points[a], points[b]) <= CONTACT) propre = false;
        }
    }
    check('la triangulation ne se coupe nulle part', propre);
    // Maximale : plus aucune paire ne peut être ajoutée sans couper.
    const posees = new Set(aretes.map(([a, b]) => `${a}-${b}`));
    let ajoutable = false;
    for (let a = 0; a < points.length && !ajoutable; a++) {
        for (let b = a + 1; b < points.length && !ajoutable; b++) {
            if (posees.has(`${a}-${b}`)) continue;
            const libre = aretes.every(posee => !aretesEnConflit(points, [a, b], posee))
                && points.every((point, k) => k === a || k === b || distancePointSegment(point, points[a], points[b]) > CONTACT);
            if (libre) ajoutable = true;
        }
    }
    check('la triangulation est maximale', !ajoutable);
}

// — L’élagage
{
    // Comme dans le générateur : on resème jusqu’à tomber sur une
    // triangulation 3-connexe, seule matière que l’élagage sache travailler.
    let alea; let points; let complete;
    for (let essai = 0; essai < 60; essai++) {
        alea = new Alea(`elagage-${essai}`);
        points = semisDePoints(alea, 20);
        complete = triangulationGloutonne(points);
        if (estTriconnexe(20, complete)) break;
    }
    check('le semis d’essai est bien 3-connexe', estTriconnexe(20, complete));
    const elague = elaguer(alea, 20, complete, 40);
    check('l’élagage retire des fils', elague.length < complete.length && elague.length <= 40,
        `${complete.length} → ${elague.length}`);
    check('l’élagage n’en invente pas', elague.every(arete => complete.includes(arete)));
    check('l’élagage préserve la 3-connexité', estTriconnexe(20, elague));
    check('l’élagage s’arrête au-dessus du plancher structurel', elague.length >= 1.5 * 20);
}

// — Les épingles
{
    const solution = semisDePoints(new Alea('epingles'), 24);
    const choisis = choisirEpingles(new Alea('choix'), solution, 3);
    check('trois épingles distinctes', new Set(choisis).size === 3);
    const ecarts = [];
    for (const i of choisis) for (const j of choisis) if (i < j) {
        ecarts.push(Math.hypot(solution[i].x - solution[j].x, solution[i].y - solution[j].y));
    }
    check('les épingles sont écartées les unes des autres', Math.min(...ecarts) > TAILLE / 4,
        `écart minimal ${Math.min(...ecarts).toFixed(0)}`);
    egal('deux à quatre épingles selon le niveau',
        Object.values(NIVEAUX).map(niveau => nombreEpingles(niveau.sommets)), [2, 2, 3, 4]);
}

// — Les garanties, sur beaucoup de graines
{
    const essais = { fil: 40, noeud: 30, echeveau: 25, toile: 15 };
    let solutionsPlanes = 0;
    let triconnexes = 0;
    let densites = 0;
    let brouillages = 0;
    let total = 0;
    let dansLeCadre = 0;
    let sansDoublon = 0;
    let piresTentatives = 0;
    for (const [niveau, nombre] of Object.entries(essais)) {
        const sommets = NIVEAUX[niveau].sommets;
        for (let i = 0; i < nombre; i++) {
            const puzzle = genererPuzzle({ graine: `garantie-${i}`, niveau });
            total++;
            piresTentatives = Math.max(piresTentatives, puzzle.tentatives);
            // La disposition du générateur est une solution : elle prouve que
            // zéro croisement est atteignable. C’est ça, la promesse du jeu.
            if (nombreConflits(puzzle.solution, puzzle.aretes) === 0) solutionsPlanes++;
            if (estTriconnexe(sommets, puzzle.aretes)) triconnexes++;
            // Une triangulation dont la coque mange presque tous les points en
            // offre déjà moins que la cible : l’élagage n’a alors rien à faire.
            if (puzzle.aretes.length <= DENSITE * sommets && puzzle.aretes.length >= 1.5 * sommets) densites++;
            if (nombreConflits(puzzle.positions, puzzle.aretes) >= Math.max(4, Math.round(sommets * 0.6))) brouillages++;
            if (puzzle.positions.every(({ x, y }) => x >= MARGE - 1 && x <= TAILLE - MARGE + 1 && y >= MARGE - 1 && y <= TAILLE - MARGE + 1)) dansLeCadre++;
            const cles = puzzle.aretes.map(([a, b]) => `${a}-${b}`);
            if (new Set(cles).size === cles.length && puzzle.aretes.every(([a, b]) => a !== b)) sansDoublon++;
        }
    }
    check('toute grille est démêlable : la solution ne croise rien', solutionsPlanes === total, `${solutionsPlanes}/${total}`);
    check('tout graphe est 3-connexe, donc son dessin est unique', triconnexes === total, `${triconnexes}/${total}`);
    check('la densité tient entre le plancher structurel et la cible', densites === total, `${densites}/${total}`);
    check('aucun départ n’est à moitié résolu', brouillages === total, `${brouillages}/${total}`);
    check('tout tient dans le cadre', dansLeCadre === total, `${dansLeCadre}/${total}`);
    check('aucun fil double ni boucle', sansDoublon === total, `${sansDoublon}/${total}`);
    check('les resemis restent rares', piresTentatives < 20, `pire ${piresTentatives}`);
}

// — Reproductibilité
{
    const a = genererPuzzle({ graine: '2026-08-26', niveau: 'echeveau' });
    const b = genererPuzzle({ graine: '2026-08-26', niveau: 'echeveau' });
    const c = genererPuzzle({ graine: '2026-08-27', niveau: 'echeveau' });
    check('même graine, même écheveau', JSON.stringify(a) === JSON.stringify(b));
    check('graine voisine, autre écheveau', JSON.stringify(a) !== JSON.stringify(c));
    check('un niveau inconnu retombe sur l’Écheveau', genererPuzzle({ graine: 'x', niveau: 'zzz' }).niveau === 'echeveau');
}

// — Les variantes ne touchent pas au graphe, seulement au départ
{
    const nu = genererPuzzle({ graine: 'variantes', niveau: 'noeud' });
    const cercle = genererPuzzle({ graine: 'variantes', niveau: 'noeud', cercle: true });
    const epingle = genererPuzzle({ graine: 'variantes', niveau: 'noeud', epingles: true });
    egal('le cercle garde le même graphe', cercle.aretes, nu.aretes);
    egal('les épingles gardent le même graphe', epingle.aretes, nu.aretes);
    egal('le cercle garde la même solution', cercle.solution, nu.solution);
    check('le cercle change le départ', JSON.stringify(cercle.positions) !== JSON.stringify(nu.positions));
    const rayons = cercle.positions.map(({ x, y }) => Math.hypot(x - TAILLE / 2, y - TAILLE / 2));
    check('le départ en cercle pose tout sur un cercle',
        Math.max(...rayons) - Math.min(...rayons) < 1e-6);
    check('une partie nue n’épingle rien', nu.epingles.length === 0);
    check('les épingles sont posées à leur place de la solution', epingle.epingles.length === nombreEpingles(16)
        && epingle.epingles.every(index =>
            Math.hypot(epingle.positions[index].x - epingle.solution[index].x,
                epingle.positions[index].y - epingle.solution[index].y) < 1e-9));
}

// — Le brouillage garde les épingles
{
    const puzzle = genererPuzzle({ graine: 'ancres', niveau: 'echeveau', epingles: true, cercle: true });
    check('épingles et cercle se combinent', puzzle.epingles.every(index =>
        Math.hypot(puzzle.positions[index].x - puzzle.solution[index].x,
            puzzle.positions[index].y - puzzle.solution[index].y) < 1e-9));
    const libres = puzzle.positions.filter((_, index) => !puzzle.epingles.includes(index));
    const rayons = libres.map(({ x, y }) => Math.hypot(x - TAILLE / 2, y - TAILLE / 2));
    check('les sommets libres restent sur le cercle', Math.max(...rayons) - Math.min(...rayons) < 1e-6);
}

// — Le brouillage retient la disposition la plus emmêlée
{
    const puzzle = genererPuzzle({ graine: 'emmele', niveau: 'noeud' });
    const positions = brouiller(new Alea('rebrouillage'), puzzle.solution, puzzle.aretes);
    check('un brouillage neuf est franchement emmêlé',
        nombreConflits(positions, puzzle.aretes) >= Math.max(4, Math.round(16 * 0.6)));
    check('le graphe reste connexe quoi qu’il arrive', estConnexe(16, puzzle.aretes));
    check('aucun sommet n’est esseulé', degres(16, puzzle.aretes).every(degre => degre >= 3));
}

rapport();
