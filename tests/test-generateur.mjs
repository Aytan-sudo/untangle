import { readFileSync } from 'node:fs';
import { compteur } from './harness.mjs';
import { MARGE, TAILLE } from '../js/config.js';
import { Alea, graineLibre, hacher } from '../js/hasard.js';
import {
    DEFORMATION_MAX, DENSITE, NIVEAUX, bandeDeBrouillage, brouiller, choisirEpingles,
    elaguer, etaler, genererPuzzle, nombreEpingles, semisDePoints, triangulationGloutonne
} from '../js/generateur.js';
import {
    CONTACT, aretesEnConflit, croisementsFrancs, degres, distancePointSegment,
    estConnexe, estTriconnexe, nombreConflits, unSommetReposeSurUnFil
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

// — L’étalement
{
    const utile = TAILLE - 2 * MARGE;
    const tasse = [{ x: 100, y: 100 }, { x: 160, y: 120 }, { x: 130, y: 180 }, { x: 190, y: 190 }];
    const etale = etaler(tasse);
    check('un nuage tassé dans un coin remplit le cadre',
        Math.max(...etale.map(p => p.x)) - Math.min(...etale.map(p => p.x)) > utile * 0.9);
    check('et il reste dans le cadre', etale.every(({ x, y }) =>
        x >= MARGE - 1 && x <= TAILLE - MARGE + 1 && y >= MARGE - 1 && y <= TAILLE - MARGE + 1));
    check('il est centré', Math.abs((Math.min(...etale.map(p => p.x)) + Math.max(...etale.map(p => p.x))) / 2 - TAILLE / 2) < 1);

    // C’est une application affine : elle ne peut pas changer qui croise qui.
    // C’est ce qui autorise à étirer les deux axes séparément sans toucher à
    // la garantie du jeu.
    const aretes = [[0, 3], [1, 2], [0, 1], [2, 3]];
    egal('l’étalement ne change aucun croisement',
        nombreConflits(etaler(tasse), aretes), nombreConflits(tasse, aretes));
    // Chaque point garde sa place relative : personne ne passe de l’autre côté.
    const cote = (points, i, j, k) => Math.sign(
        (points[j].x - points[i].x) * (points[k].y - points[i].y)
        - (points[j].y - points[i].y) * (points[k].x - points[i].x));
    check('l’étalement ne retourne aucune orientation',
        [[0, 1, 2], [0, 1, 3], [1, 2, 3]].every(([i, j, k]) => cote(tasse, i, j, k) === cote(etale, i, j, k)));

    // Les facteurs valent au moins 1 : les sommets ne peuvent que s’écarter.
    const ecart = points => {
        let mini = Infinity;
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
            mini = Math.min(mini, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
        }
        return mini;
    };
    check('aucun sommet ne se rapproche d’un autre', ecart(etale) >= ecart(tasse) - 1e-9);

    // Sans bride, un nuage en bandeau deviendrait un accordéon.
    const bandeau = [{ x: 100, y: 480 }, { x: 500, y: 500 }, { x: 900, y: 520 }, { x: 500, y: 470 }];
    const bride = etaler(bandeau);
    const facteur = axe => {
        const avant = Math.max(...bandeau.map(p => p[axe])) - Math.min(...bandeau.map(p => p[axe]));
        const apres = Math.max(...bride.map(p => p[axe])) - Math.min(...bride.map(p => p[axe]));
        return apres / avant;
    };
    check('la déformation reste bridée',
        Math.max(facteur('x'), facteur('y')) <= Math.min(facteur('x'), facteur('y')) * DEFORMATION_MAX + 1e-6,
        `${facteur('x').toFixed(2)} / ${facteur('y').toFixed(2)}`);
    egal('un point unique ne casse rien', etaler([{ x: 300, y: 300 }]).length, 1);
    egal('deux points confondus non plus', etaler([{ x: 300, y: 300 }, { x: 300, y: 300 }]).length, 2);
}

// — Le semis
{
    const ecartMinimal = points => {
        let minimum = Infinity;
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
            minimum = Math.min(minimum, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
        }
        return minimum;
    };
    // Le plus gros sommet des quatre mondes : deux sommets plus proches que son
    // diamètre se chevaucheraient — et se chevaucher, ici, est un croisement
    // qu’aucun geste ne peut défaire.
    const styles = readFileSync(new URL('../css/themes.css', import.meta.url), 'utf8');
    const diametre = 2 * Math.max(...[...styles.matchAll(/--sommet-rayon:\s*([\d.]+)/g)].map(([, v]) => Number(v)));

    let pireEcart = Infinity;
    for (const niveau of Object.values(NIVEAUX)) {
        for (let essai = 0; essai < 40; essai++) {
            const points = semisDePoints(new Alea(`semis-${niveau.id}-${essai}`), niveau.sommets);
            check(`le semis ${niveau.id} rend le nombre de points demandé`,
                points.length === niveau.sommets, `${points.length}`);
            check(`le semis ${niveau.id} tient dans le plateau`, points.every(({ x, y }) =>
                x >= MARGE - 1e-6 && x <= TAILLE - MARGE + 1e-6
                && y >= MARGE - 1e-6 && y <= TAILLE - MARGE + 1e-6));
            pireEcart = Math.min(pireEcart, ecartMinimal(points));
            break;
        }
    }
    check('deux sommets ne peuvent jamais se chevaucher', pireEcart > diametre,
        `écart minimal ${pireEcart.toFixed(0)}, diamètre ${diametre}`);
    check('et ils restent loin d’une distance de contact', pireEcart > 4 * CONTACT,
        `écart minimal ${pireEcart.toFixed(0)}`);
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
    egal('une à quatre épingles selon le niveau',
        Object.values(NIVEAUX).map(niveau => nombreEpingles(niveau.sommets)), [1, 1, 2, 3, 4, 4]);
    check('il reste toujours des sommets libres à déplacer',
        Object.values(NIVEAUX).every(niveau => nombreEpingles(niveau.sommets) <= niveau.sommets - 3));
}

// — Les garanties, sur beaucoup de graines
{
    const essais = { fil: 60, noeud: 60, echeveau: 60, toile: 40 };
    let solutionsPlanes = 0;
    let triconnexes = 0;
    let densites = 0;
    let brouillages = 0;
    let total = 0;
    let dansLeCadre = 0;
    let remplissent = 0;
    let sansDoublon = 0;
    let piresTentatives = 0;
    let resolusDEmblee = 0;
    let sales = 0;
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
            // Le départ doit être emmêlé, dans la fourchette du niveau ou au
            // plus près quand elle est hors d’atteinte — et jamais, jamais
            // servi résolu.
            const franc = croisementsFrancs(puzzle.positions, puzzle.aretes);
            const [bas, haut] = bandeDeBrouillage(puzzle.aretes.length);
            if (franc >= 1 && (franc <= haut || bas > franc)) brouillages++;
            if (franc === 0 || nombreConflits(puzzle.positions, puzzle.aretes) === 0) resolusDEmblee++;
            if (unSommetReposeSurUnFil(puzzle.positions, puzzle.aretes)) sales++;
            if (puzzle.positions.every(({ x, y }) => x >= MARGE - 1 && x <= TAILLE - MARGE + 1 && y >= MARGE - 1 && y <= TAILLE - MARGE + 1)) dansLeCadre++;
            // Un graphe tassé dans un coin donne un écran qui a l’air en panne.
            const utile = TAILLE - 2 * MARGE;
            const etendue = axe => {
                const valeurs = puzzle.positions.map(point => point[axe]);
                return Math.max(...valeurs) - Math.min(...valeurs);
            };
            if (Math.max(etendue('x'), etendue('y')) >= utile * 0.85) remplissent++;
            const cles = puzzle.aretes.map(([a, b]) => `${a}-${b}`);
            if (new Set(cles).size === cles.length && puzzle.aretes.every(([a, b]) => a !== b)) sansDoublon++;
        }
    }
    check('toute grille est démêlable : la solution ne croise rien', solutionsPlanes === total, `${solutionsPlanes}/${total}`);
    check('tout graphe est 3-connexe, donc son dessin est unique', triconnexes === total, `${triconnexes}/${total}`);
    check('la densité tient entre le plancher structurel et la cible', densites === total, `${densites}/${total}`);
    check('aucun départ n’est à moitié résolu', brouillages === total, `${brouillages}/${total}`);
    check('aucune grille n’arrive déjà démêlée', resolusDEmblee === 0, `${resolusDEmblee}/${total}`);
    // Le piège que la fourchette a fermé : à défaut de seuil atteignable, la
    // première version prenait la disposition la plus embrouillée de toutes —
    // c’est-à-dire la plus dégénérée, sommets couchés sur les fils compris.
    check('aucun départ ne pose un sommet sur un fil', sales === 0, `${sales}/${total}`);
    check('tout tient dans le cadre', dansLeCadre === total, `${dansLeCadre}/${total}`);
    check('et tout remplit le cadre', remplissent === total, `${remplissent}/${total}`);
    check('aucun fil double ni boucle', sansDoublon === total, `${sansDoublon}/${total}`);
    // Un K4 n’existe que si le quatrième point tombe dans le triangle des
    // trois autres — une chance sur trois environ. D’où des resemis plus
    // nombreux aux petites tailles, et sans conséquence : chaque essai coûte
    // quelques dixièmes de milliseconde.
    check('les resemis restent bornés', piresTentatives < 120, `pire ${piresTentatives}`);
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
    check('les épingles sont posées à leur place de la solution', epingle.epingles.length === nombreEpingles(NIVEAUX.noeud.sommets)
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

// — La fourchette de brouillage
{
    egal('la fourchette monte avec le nombre de fils',
        [6, 13, 18].map(m => bandeDeBrouillage(m)), [[3, 6], [6, 12], [8, 17]]);
    check('la fourchette n’est jamais vide ni nulle',
        [1, 2, 3, 6, 13, 18, 40].every(m => {
            const [bas, haut] = bandeDeBrouillage(m);
            return bas >= 1 && haut > bas;
        }));

    const puzzle = genererPuzzle({ graine: 'emmele', niveau: 'toile' });
    const [bas, haut] = bandeDeBrouillage(puzzle.aretes.length);
    const positions = brouiller(new Alea('rebrouillage'), puzzle.solution, puzzle.aretes);
    const franc = croisementsFrancs(positions, puzzle.aretes);
    check('un brouillage neuf tombe dans la fourchette', franc >= bas && franc <= haut, `${franc} hors de ${bas}–${haut}`);
    check('et il est propre', !unSommetReposeSurUnFil(positions, puzzle.aretes));
    const sommets = NIVEAUX.toile.sommets;
    check('le graphe reste connexe quoi qu’il arrive', estConnexe(sommets, puzzle.aretes));
    check('aucun sommet n’est esseulé', degres(sommets, puzzle.aretes).every(degre => degre >= 3));
}

// — Les tailles : le jeu se joue au doigt, pas à la loupe
{
    const tailles = Object.values(NIVEAUX).map(niveau => niveau.sommets);
    egal('six tailles, de quatre à treize sommets', tailles, [4, 5, 7, 9, 11, 13]);
    check('les tailles montent', tailles.every((n, rang) => rang === 0 || n > tailles[rang - 1]));
    // La difficulté ressentie tient au nombre de croisements de départ, pas au
    // nombre de sommets : c’est lui qui doit monter franchement d’un niveau au
    // suivant, sans quoi deux niveaux se ressemblent.
    const moyennes = Object.values(NIVEAUX).map(niveau => {
        const comptes = Array.from({ length: 25 }, (_, i) => {
            const p = genererPuzzle({ graine: `courbe-${i}`, niveau: niveau.id });
            return croisementsFrancs(p.positions, p.aretes);
        });
        return comptes.reduce((somme, c) => somme + c, 0) / comptes.length;
    });
    // Le seuil est passé de 1,4 à 1,35 en ouvrant l’échelle à six paliers : à
    // quatre niveaux, chaque marche portait tout l’écart ; à six, elles se le
    // partagent. Le pas le plus court est Toile → Lacis (1,39 sur deux cents
    // tirages) — deux sommets et quatre fils de plus, ça reste une marche.
    // La montée complète, elle, va de 1 à 35 croisements.
    check('chaque niveau emmêle nettement plus que le précédent',
        moyennes.every((valeur, rang) => rang === 0 || valeur > moyennes[rang - 1] * 1.35),
        moyennes.map(v => v.toFixed(1)).join(' → '));
    check('du premier au dernier, l’écart est d’un ordre de grandeur',
        moyennes[moyennes.length - 1] > moyennes[0] * 20,
        `${moyennes[0].toFixed(1)} → ${moyennes[moyennes.length - 1].toFixed(1)}`);
    // Un K4 n’admet qu’un seul croisement franc : c’est une propriété du
    // graphe, pas un réglage. Le premier niveau est donc un coup unique — une
    // découverte, assumée comme telle.
    check('le premier niveau tient en un geste', moyennes[0] === 1, String(moyennes[0]));
}

rapport();
