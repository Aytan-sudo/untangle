import { readFileSync } from 'node:fs';
import { compteur } from './harness.mjs';
import { NIVEAU_QUOTIDIEN } from '../js/config.js';
import {
    courbeEnEmojis, dateLocale, estUneDate, formaterDate, formaterTemps,
    lienDePartage, lireParametres, messageDePartage
} from '../js/defi.js';
import { genererPuzzle } from '../js/generateur.js';
import { IDS as VARIANTES_PARTAGEES } from '../js/variantes.js';
import { THEMES, themeAffiche, themeDuJour, themeSuivant } from '../js/themes.js';

const { check, egal, rapport } = compteur();
console.log('\nDéfi du jour, partage et thèmes\n');

const BASE = 'https://aytan-sudo.github.io/untangle/';

// — Date locale
{
    egal('la date locale est en AAAA-MM-JJ', dateLocale(new Date(2026, 7, 26, 3, 12)), '2026-08-26');
    egal('les mois et jours sont complétés', dateLocale(new Date(2026, 0, 5)), '2026-01-05');
    // L’horloge de la machine fait foi, et c’est une limite assumée : le
    // 31 décembre à 23 h 59, heure locale, le défi est encore celui du 31.
    egal('la fin de journée reste le même jour', dateLocale(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
    check('une date bien formée est reconnue', estUneDate('2026-08-26'));
    check('une date bricolée est refusée', !estUneDate('26/08/2026') && !estUneDate('') && !estUneDate(null));
    egal('la date s’affiche à la française', formaterDate('2026-08-26'), '26/08/2026');
}

// — Chronomètre
{
    egal('le temps s’écrit en minutes', formaterTemps(161000), '2:41');
    egal('les secondes sont complétées', formaterTemps(65000), '1:05');
    egal('un temps négatif ne casse rien', formaterTemps(-5), '0:00');
    egal('une heure passe en minutes', formaterTemps(3_723_000), '62:03');
}

// — Lecture de l’adresse
{
    check('sans paramètre, rien n’est imposé', lireParametres('') === null);
    const jour = lireParametres('?jour=2026-08-26', '2026-08-26');
    egal('le défi du jour prend la date pour graine', [jour.graine, jour.niveau], ['2026-08-26', NIVEAU_QUOTIDIEN]);
    check('le défi du jour joué le jour même compte', jour.quotidien);
    // Un lien du jour rouvert plus tard redonne la grille, hors série.
    check('le même lien un autre jour ne compte plus',
        !lireParametres('?jour=2026-08-26', '2026-09-02').quotidien);
    check('la grille reste la même', lireParametres('?jour=2026-08-26', '2026-09-02').graine === '2026-08-26');
    // Personne ne compare un écheveau épinglé à un écheveau nu.
    egal('le défi du jour est canonique',
        Object.values(lireParametres('?jour=2026-08-26&v=epingles,aveugle', '2026-08-26').variantes), [false, false, false]);
    check('une date bricolée dans l’adresse est ignorée', lireParametres('?jour=demain') === null);
}
{
    const libre = lireParametres('?seed=abc123&niveau=toile&v=aveugle,cercle');
    egal('une partie libre lit sa graine et son niveau', [libre.graine, libre.niveau], ['abc123', 'toile']);
    check('les variantes partagées sont relues', libre.variantes.aveugle && libre.variantes.cercle && !libre.variantes.epingles);
    check('une partie libre ne compte jamais pour la série', !libre.quotidien && libre.dateJour === null);
    check('un niveau inconnu retombe sur le quotidien', lireParametres('?seed=x&niveau=zzz').niveau === NIVEAU_QUOTIDIEN);
    check('une variante inventée est ignorée', !('triche' in lireParametres('?seed=x&v=triche').variantes));
}

// — Liens
{
    egal('le lien du jour porte la date',
        lienDePartage(`${BASE}?seed=vieux`, { dateJour: '2026-08-26' }), `${BASE}?jour=2026-08-26`);
    egal('le lien libre porte la graine et le niveau',
        lienDePartage(BASE, { graine: 'abc', niveau: 'toile', variantes: {} }), `${BASE}?seed=abc&niveau=toile`);
    egal('le lien libre porte les variantes',
        lienDePartage(BASE, { graine: 'abc', niveau: 'fil', variantes: { aveugle: true, epingles: true } }),
        `${BASE}?seed=abc&niveau=fil&v=epingles%2Caveugle`);
    check('l’aimant ne voyage pas dans le lien',
        !lienDePartage(BASE, { graine: 'a', niveau: 'fil', variantes: { aimant: true } }).includes('aimant'));
    check('un vieux fragment est nettoyé',
        !lienDePartage(`${BASE}?jour=2020-01-01#stats`, { graine: 'a', niveau: 'fil', variantes: {} }).includes('#'));
    // Le lien porte la date ou la graine, jamais la solution ni un résultat.
    const lien = lienDePartage(BASE, { graine: 'abc', niveau: 'toile', variantes: {} });
    check('le lien ne dit rien de la partie', !/temps|touches|sommets|solution/.test(lien));
}

// — La courbe en emojis
{
    egal('un démêlage franc descend en couleurs', courbeEnEmojis([1, 0.8, 0.6, 0.4, 0.3, 0.1, 0, 0]), '🟥🟥🟧🟧🟨🟨🟩🟩');
    egal('une partie sans progrès reste rouge', courbeEnEmojis([1, 1, 1, 1]), '🟥🟥🟥🟥');
    egal('une partie gagnée finit en vert', courbeEnEmojis([0.5, 0]), '🟧🟩');
}

// — Le message de partage
{
    const meta = { graine: '2026-08-26', niveau: 'echeveau', dateJour: '2026-08-26', variantes: {} };
    const message = messageDePartage({
        base: BASE, meta, termine: true, tempsMs: 161000, touches: 11, indices: 0,
        courbe: [1, 1, 0.7, 0.6, 0.4, 0.2, 0, 0]
    });
    const lignes = message.split('\n');
    egal('l’entête dit le jeu, la date et le niveau', lignes[0], 'Untangle 26/08/2026 · Écheveau');
    egal('le résultat tient sur une ligne', lignes[1], 'Démêlé en 2:41 · 11 sommets touchés');
    egal('la partie propre se signale', lignes[2], 'Sans indice ✦');
    egal('la courbe suit', lignes[3], '🟥🟥🟥🟧🟧🟨🟩🟩');
    egal('le lien ferme le message', lignes[4], `${BASE}?jour=2026-08-26`);
    check('le message ne contient aucune position', !/\d{3},\d/.test(message));
}
{
    const meta = { graine: 'zz', niveau: 'toile', dateJour: null, variantes: { aveugle: true } };
    const message = messageDePartage({
        base: BASE, meta, termine: true, tempsMs: 61000, touches: 1, indices: 3, courbe: [0]
    });
    check('une partie libre annonce sa variante', message.startsWith('Untangle · Toile (aveugle)'));
    check('un sommet unique reste au singulier', message.includes('1 sommet touché'));
    check('les indices sont avoués', message.includes('3 indices'));
    const invitation = messageDePartage({ base: BASE, meta, termine: false, courbe: [] });
    check('une partie en cours invite au lieu de résumer',
        invitation.includes('À vous.') && !invitation.includes('Démêlé'));
}

// — Une seule liste de variantes
{
    // Recopier la liste dans defi.js marcherait aujourd’hui et se
    // désynchroniserait à la quatrième variante, sans rien casser de visible :
    // le lien partagé rendrait une autre grille que celle jouée.
    const source = readFileSync(new URL('../js/defi.js', import.meta.url), 'utf8');
    check('defi.js ne recopie pas la liste des variantes',
        !/VARIANTES_PARTAGEES\s*=\s*\[/.test(source) && source.includes("from './variantes.js'"));
    const lien = lienDePartage(BASE, {
        graine: 'x', niveau: 'fil',
        variantes: Object.fromEntries(VARIANTES_PARTAGEES.map(id => [id, true]))
    });
    check('toute variante déclarée sait voyager dans le lien',
        VARIANTES_PARTAGEES.every(id => lien.includes(id)), lien);
    const relues = lireParametres(`?seed=x&niveau=fil&v=${VARIANTES_PARTAGEES.join(',')}`).variantes;
    check('toute variante déclarée se relit depuis le lien',
        VARIANTES_PARTAGEES.every(id => relues[id] === true));
}

// — Thèmes
{
    check('quatre mondes', THEMES.length === 4);
    check('chaque monde a un identifiant, un nom et une couleur',
        THEMES.every(theme => theme.id && theme.nom && /^#[0-9a-f]{6}$/i.test(theme.couleur)));
    check('les identifiants sont distincts', new Set(THEMES.map(theme => theme.id)).size === 4);
    check('les couleurs d’accent sont distinctes', new Set(THEMES.map(theme => theme.couleur)).size === 4);
    egal('le bouton fait tourner la liste', themeSuivant(THEMES.at(-1).id), THEMES[0].id);
    egal('un thème inconnu repart du début', themeSuivant('néant'), THEMES[0].id);
    // Sans préférence, le monde du jour vient de la date : le même décor pour
    // tout le monde, le même jour.
    check('le thème du jour est un thème connu',
        THEMES.some(theme => theme.id === themeDuJour('2026-08-26')));
    egal('deux fois le même jour, le même monde', themeDuJour('2026-08-26'), themeDuJour('2026-08-26'));
    const mondes = new Set();
    for (let jour = 1; jour <= 28; jour++) mondes.add(themeDuJour(`2026-08-${String(jour).padStart(2, '0')}`));
    egal('un mois passe par les quatre mondes', mondes.size, 4);
    egal('une préférence explicite l’emporte', themeAffiche('circuit', '2026-08-26'), 'circuit');
    egal('« du jour » suit la date', themeAffiche('auto', '2026-08-26'), themeDuJour('2026-08-26'));
    egal('une préférence effacée suit la date', themeAffiche('', '2026-08-26'), themeDuJour('2026-08-26'));
    egal('un thème disparu suit la date', themeAffiche('sashiko', '2026-08-26'), themeDuJour('2026-08-26'));
}

// — Le défi du jour est bien le même pour tous
{
    const matin = genererPuzzle({ graine: '2026-08-26', niveau: NIVEAU_QUOTIDIEN });
    const soir = genererPuzzle({ graine: '2026-08-26', niveau: NIVEAU_QUOTIDIEN });
    check('deux machines refabriquent la même grille', JSON.stringify(matin) === JSON.stringify(soir));
    check('le lendemain en donne une autre',
        JSON.stringify(matin) !== JSON.stringify(genererPuzzle({ graine: '2026-08-27', niveau: NIVEAU_QUOTIDIEN })));
}

rapport();
