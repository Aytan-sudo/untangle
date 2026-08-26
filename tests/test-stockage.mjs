import { compteur } from './harness.mjs';
import {
    PREFERENCES_PAR_DEFAUT, _reinitialiserPourTests, chargerPartie, chargerPreferences,
    chargerStatistiques, cleConfiguration, effacerStatistiques, enregistrerPartie,
    enregistrerPreferences, enregistrerVictoire, oublierPartie, statistiquesVides
} from '../js/stockage.js';

const { check, egal, rapport } = compteur();
console.log('\nStockage\n');

// Un faux localStorage, pour jouer sans navigateur.
function coffreDeTest() {
    const donnees = new Map();
    globalThis.localStorage = {
        getItem: cle => donnees.get(cle) ?? null,
        setItem: (cle, valeur) => donnees.set(cle, String(valeur)),
        removeItem: cle => donnees.delete(cle)
    };
    _reinitialiserPourTests();
    return donnees;
}

// — Préférences
{
    const donnees = coffreDeTest();
    egal('sans rien de stocké, les défauts', chargerPreferences(), PREFERENCES_PAR_DEFAUT);
    enregistrerPreferences({ ...PREFERENCES_PAR_DEFAUT, theme: 'circuit', sons: false, aimant: true });
    const relues = chargerPreferences();
    check('les préférences font l’aller-retour', relues.theme === 'circuit' && relues.sons === false && relues.aimant === true);
    check('les clés portent le préfixe du jeu', [...donnees.keys()].every(cle => cle.startsWith('untangle.')));
    check('la valeur porte sa version de schéma', JSON.parse(donnees.get('untangle.preferences')).schema === 1);
}
{
    const donnees = coffreDeTest();
    // Un stockage bricolé à la main, ou vieilli : chaque champ hors type
    // retombe sur son défaut, sans emporter les autres.
    donnees.set('untangle.preferences', JSON.stringify({
        schema: 1, donnees: { theme: 42, sons: 'oui', vibration: false, niveau: 'toile', inconnu: 'x' }
    }));
    const preferences = chargerPreferences();
    check('un thème du mauvais type retombe sur le défaut', preferences.theme === PREFERENCES_PAR_DEFAUT.theme);
    check('une case du mauvais type retombe sur le défaut', preferences.sons === true);
    check('les champs valides sont gardés', preferences.vibration === false && preferences.niveau === 'toile');
    check('un champ inconnu n’entre pas', !('inconnu' in preferences));
}
{
    const donnees = coffreDeTest();
    donnees.set('untangle.preferences', '{ ceci n’est pas du JSON');
    egal('un stockage illisible donne les défauts', chargerPreferences(), PREFERENCES_PAR_DEFAUT);
    donnees.set('untangle.preferences', JSON.stringify({ schema: 99, donnees: { theme: 'circuit' } }));
    egal('un schéma inconnu est ignoré', chargerPreferences(), PREFERENCES_PAR_DEFAUT);
}
{
    // Le cas qui doit ne jamais empêcher de jouer : pas de localStorage du
    // tout (navigation privée, réglages verrouillés). Une mémoire de session
    // prend le relais.
    delete globalThis.localStorage;
    _reinitialiserPourTests();
    enregistrerPreferences({ ...PREFERENCES_PAR_DEFAUT, theme: 'cordage' });
    check('sans localStorage, le jeu se souvient quand même de la session',
        chargerPreferences().theme === 'cordage');
}

// — Partie en cours
{
    coffreDeTest();
    check('aucune partie au départ', chargerPartie() === null);
    enregistrerPartie({ graine: '2026-08-26', niveau: 'echeveau', gestes: 4 });
    egal('la partie se reprend', chargerPartie(), { graine: '2026-08-26', niveau: 'echeveau', gestes: 4 });
    oublierPartie();
    check('la partie s’oublie', chargerPartie() === null);
}

// — Clé de configuration
{
    check('un niveau nu donne son nom', cleConfiguration('echeveau', {}) === 'echeveau');
    check('les variantes entrent dans la clé', cleConfiguration('toile', { aveugle: true, epingles: true }) === 'toile+epingles+aveugle');
    check('l’ordre des variantes est stable',
        cleConfiguration('toile', { aveugle: true, epingles: true }) === cleConfiguration('toile', { epingles: true, aveugle: true }));
    // L’aimant est un confort de doigt : il ne sépare pas les palmarès.
    check('l’aimant n’entre pas dans la clé', cleConfiguration('fil', { aimant: true }) === 'fil');
}

// — Un palmarès vide reste vide
{
    coffreDeTest();
    enregistrerVictoire({ niveau: 'fil', variantes: {}, tempsMs: 1000, touches: 2, gestes: 2, indices: 0 });
    egal('le palmarès vide n’est pas contaminé par une victoire', statistiquesVides(),
        { configurations: {}, quotidien: {}, historique: [] });
}

// — Palmarès
{
    coffreDeTest();
    const nu = { niveau: 'echeveau', variantes: {}, quotidien: false, dateJour: null };
    enregistrerVictoire({ ...nu, tempsMs: 180000, touches: 14, gestes: 20, indices: 0 });
    enregistrerVictoire({ ...nu, tempsMs: 240000, touches: 9, gestes: 12, indices: 0 });
    const stats = chargerStatistiques();
    const config = stats.configurations.echeveau;
    check('deux parties comptées', config.parties === 2 && config.propres === 2);
    check('le meilleur temps est gardé', config.meilleurTempsMs === 180000);
    check('la meilleure économie est gardée à part', config.meilleursTouches === 9);
    check('l’économie retient son propre temps', config.meilleursTouchesTempsMs === 240000);

    // Même nombre de sommets : c’est le chrono qui départage.
    enregistrerVictoire({ ...nu, tempsMs: 200000, touches: 9, gestes: 11, indices: 0 });
    check('à économie égale, le temps départage', chargerStatistiques().configurations.echeveau.meilleursTouchesTempsMs === 200000);

    // Une partie gagnée avec un indice n’entre pas au palmarès, mais elle a
    // bien eu lieu.
    enregistrerVictoire({ ...nu, tempsMs: 1000, touches: 1, gestes: 1, indices: 2 });
    const apres = chargerStatistiques().configurations.echeveau;
    check('une partie avec indice ne bat aucun record',
        apres.meilleurTempsMs === 180000 && apres.meilleursTouches === 9);
    check('elle compte quand même dans les parties jouées', apres.parties === 4 && apres.propres === 3);
}
{
    coffreDeTest();
    enregistrerVictoire({ niveau: 'echeveau', variantes: {}, tempsMs: 1000, touches: 3, gestes: 3, indices: 0 });
    enregistrerVictoire({ niveau: 'echeveau', variantes: { aveugle: true }, tempsMs: 9000, touches: 30, gestes: 40, indices: 0 });
    const stats = chargerStatistiques();
    check('chaque configuration a son palmarès',
        stats.configurations.echeveau.parties === 1 && stats.configurations['echeveau+aveugle'].parties === 1);
}

// — Série quotidienne
{
    coffreDeTest();
    const jour = (dateJour, indices = 0) => enregistrerVictoire({
        niveau: 'echeveau', variantes: {}, quotidien: true, dateJour, tempsMs: 60000, touches: 5, gestes: 6, indices
    });
    jour('2026-08-24');
    jour('2026-08-25');
    jour('2026-08-26');
    check('trois jours d’affilée font une série de trois', chargerStatistiques().quotidien.serie === 3);
    jour('2026-08-26');
    check('rejouer le même jour ne double pas la série', chargerStatistiques().quotidien.serie === 3);
    jour('2026-08-29');
    const stats = chargerStatistiques();
    check('un jour manqué casse la série', stats.quotidien.serie === 1);
    check('la meilleure série est retenue', stats.quotidien.meilleureSerie === 3);
    jour('2026-08-30', 2);
    check('un défi gagné à l’indice ne nourrit pas la série', chargerStatistiques().quotidien.serie === 1);
}

// — Historique et effacement
{
    coffreDeTest();
    for (let i = 0; i < 20; i++) {
        enregistrerVictoire({ niveau: 'fil', variantes: {}, tempsMs: i * 1000, touches: i, gestes: i, indices: 0 });
    }
    const stats = chargerStatistiques();
    check('l’historique est borné à douze', stats.historique.length === 12);
    check('l’historique est du plus récent au plus ancien', stats.historique[0].touches === 19);
    effacerStatistiques();
    const vides = chargerStatistiques();
    egal('tout s’efface', [Object.keys(vides.configurations).length, vides.historique.length], [0, 0]);
}

rapport();
