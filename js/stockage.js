// Préférences, reprise, palmarès. Tout tient en trois clés `untangle.`, chaque
// valeur porte sa version de schéma, et un stockage absent ou bricolé ne doit
// jamais empêcher de jouer : une mémoire de session prend alors le relais.

const PREFIXE = 'untangle.';
const SCHEMA = 1;
const memoire = new Map();
let coffre;

export const PREFERENCES_PAR_DEFAUT = {
    // Le mode : une grille seule, ou la Montée qui enchaîne les six tailles.
    // C’est une préférence et pas une variante — il ne se combine avec rien,
    // il choisit ce qu’on lance.
    mode: 'grille',
    niveau: 'echeveau',
    theme: 'auto',
    sons: true,
    vibration: true,
    // Confort de doigt : disponible partout, défi du jour compris, et sans
    // palmarès séparé — l’aimant ne change ni le graphe ni les croisements
    // possibles, seulement la précision du geste.
    aimant: false,
    // Les fils fautifs se signalent aussi par un pointillé, pour qui ne
    // distingue pas la couleur d’alerte du reste de la palette.
    signes: false,
    // Ce que le palmarès met en avant : le chrono, ou l’économie de sommets.
    classement: 'temps',
    epingles: false,
    cercle: false,
    aveugle: false
};

// Une fabrique, pas une constante : un objet partagé verrait ses sous-objets
// mutés par la première victoire enregistrée, et le « palmarès vide » se
// mettrait à contenir les records de la partie précédente.
//
// Deux séries quotidiennes depuis la 1.2.0 : l’Écheveau du jour et la Montée
// du jour se tiennent séparément — l’une est une habitude de deux minutes,
// l’autre un quart d’heure, et les mêler rendrait les deux illisibles.
//
// Le champ s’ajoute sans toucher au numéro de schéma : `chargerStatistiques`
// étale d’abord un palmarès vide, si bien qu’un stockage écrit par la 1.1.1
// se relit tel quel et gagne simplement une seconde série à zéro. Bumper le
// schéma aurait, lui, effacé les records de tout le monde.
export const statistiquesVides = () => ({
    configurations: {}, quotidien: {}, quotidienMontee: {}, historique: []
});

function obtenirCoffre() {
    if (coffre) return coffre;
    try {
        const sonde = `${PREFIXE}sonde`;
        globalThis.localStorage.setItem(sonde, '1');
        globalThis.localStorage.removeItem(sonde);
        coffre = globalThis.localStorage;
    } catch {
        coffre = {
            getItem: cle => memoire.get(cle) ?? null,
            setItem: (cle, valeur) => memoire.set(cle, String(valeur)),
            removeItem: cle => memoire.delete(cle)
        };
    }
    return coffre;
}

function lire(cle, defaut) {
    try {
        const brut = obtenirCoffre().getItem(PREFIXE + cle);
        if (!brut) return defaut;
        const enveloppe = JSON.parse(brut);
        return enveloppe?.schema === SCHEMA ? enveloppe.donnees : defaut;
    } catch { return defaut; }
}

function ecrire(cle, donnees) {
    try { obtenirCoffre().setItem(PREFIXE + cle, JSON.stringify({ schema: SCHEMA, donnees })); }
    catch { /* mémoire seulement : on joue quand même */ }
}

export function chargerPreferences() {
    const lues = lire('preferences', {});
    const preferences = { ...PREFERENCES_PAR_DEFAUT };
    for (const [cle, defaut] of Object.entries(PREFERENCES_PAR_DEFAUT)) {
        const valeur = lues?.[cle];
        if (typeof defaut === 'boolean' && typeof valeur === 'boolean') preferences[cle] = valeur;
        if (typeof defaut === 'string' && typeof valeur === 'string') preferences[cle] = valeur;
    }
    return preferences;
}

export const enregistrerPreferences = preferences => ecrire('preferences', preferences);
export const chargerPartie = () => lire('partie', null);
export const enregistrerPartie = partie => ecrire('partie', partie);
export const oublierPartie = () => ecrire('partie', null);
export const chargerStatistiques = () => ({ ...statistiquesVides(), ...lire('statistiques', {}) });
export const effacerStatistiques = () => ecrire('statistiques', statistiquesVides());

// Chaque combinaison niveau × variantes a son palmarès : un temps en écheveau
// épinglé ne concourt pas contre un temps en écheveau nu. L’aimant n’entre pas
// dans la clé — c’est un confort, pas une règle. La montée y entre comme un
// niveau de plus (`montee`, `montee+cercle`…) : c’est une configuration
// comme une autre, avec un temps total au lieu d’un temps de grille.
export function cleConfiguration(niveau, variantes = {}) {
    const actives = ['epingles', 'cercle', 'aveugle'].filter(nom => variantes[nom]);
    return [niveau, ...actives].join('+');
}

function ecartJours(a, b) {
    return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

export function enregistrerVictoire({ niveau, variantes, quotidien, dateJour, tempsMs, touches, gestes, indices }) {
    const stats = chargerStatistiques();
    // Une partie gagnée avec un indice n’entre pas au palmarès. Elle compte
    // dans les parties jouées : elle a bien eu lieu.
    const propre = !indices;
    const cle = cleConfiguration(niveau, variantes);
    const avant = stats.configurations[cle]
        || { parties: 0, propres: 0, meilleurTempsMs: null, meilleursTouches: null, meilleursTouchesTempsMs: null };
    const meilleursTouches = !propre || avant.meilleursTouches === null || touches < avant.meilleursTouches
        || (touches === avant.meilleursTouches && tempsMs < avant.meilleursTouchesTempsMs);
    stats.configurations[cle] = {
        parties: avant.parties + 1,
        propres: avant.propres + (propre ? 1 : 0),
        meilleurTempsMs: propre && (avant.meilleurTempsMs === null || tempsMs < avant.meilleurTempsMs)
            ? tempsMs : avant.meilleurTempsMs,
        meilleursTouches: propre && meilleursTouches ? touches : avant.meilleursTouches,
        meilleursTouchesTempsMs: propre && meilleursTouches ? tempsMs : avant.meilleursTouchesTempsMs
    };

    // Seul le défi joué le jour même nourrit la série : un lien du jour rouvert
    // trois semaines plus tard redonne la grille, hors série. Les deux défis
    // ont chacun la leur — réussir la Montée du jour ne prolonge pas la série
    // de l’Écheveau, et réciproquement.
    const serie = niveau === 'montee' ? stats.quotidienMontee : stats.quotidien;
    if (quotidien && dateJour && propre && !(serie.reussis || []).includes(dateJour)) {
        const suite = serie.dernierJour && ecartJours(serie.dernierJour, dateJour) === 1;
        serie.serie = suite ? (serie.serie || 0) + 1 : 1;
        serie.meilleureSerie = Math.max(serie.meilleureSerie || 0, serie.serie);
        serie.dernierJour = dateJour;
        serie.reussis = [...(serie.reussis || []), dateJour].slice(-180);
    }

    stats.historique.unshift({ date: new Date().toISOString(), cle, niveau, quotidien, dateJour, tempsMs, touches, gestes, indices });
    stats.historique = stats.historique.slice(0, 12);
    ecrire('statistiques', stats);
    return stats;
}

export function _reinitialiserPourTests() { coffre = null; memoire.clear(); }
