// La liste des mondes et leur ordre, rien d’autre : les couleurs, les
// matières et les textures vivent dans css/themes.css, seule source des
// teintes. Quatre directions artistiques plutôt que quatre variations d’une
// seule — deux claires, deux sombres.

// La couleur portée ici est la barre du navigateur, et elle doit être
// exactement l’`--accent` du monde correspondant : deux valeurs voisines ne
// lèvent aucune erreur, elles font seulement une barre système qui jure avec
// la page. `tests/test-page.mjs` compare les deux listes.
export const THEMES = [
    { id: 'cordage', nom: 'Cordage', couleur: '#b0762a' },
    { id: 'enluminure', nom: 'Enluminure', couleur: '#a83226' },
    { id: 'circuit', nom: 'Circuit', couleur: '#3ecf8e' },
    { id: 'constellation', nom: 'Constellation', couleur: '#7aa2f7' }
];

export const THEME_AUTOMATIQUE = 'auto';

export function themeSuivant(id) {
    const index = THEMES.findIndex(theme => theme.id === id);
    return THEMES[(index + 1 + THEMES.length) % THEMES.length].id;
}

// Sans préférence, le monde du jour se déduit de la date : tout le monde ouvre
// le même décor le même jour, sans que rien n’ait à circuler. La formule tient
// exprès en une somme de codes de caractères — elle doit pouvoir être répétée
// telle quelle dans le script de restauration du <head>, qui ne peut rien
// importer. `tests/test-page.mjs` exécute ce script et vérifie qu’il dit bien
// la même chose que cette fonction.
export function themeDuJour(date) {
    let somme = 0;
    for (const caractere of String(date)) somme += caractere.charCodeAt(0);
    return THEMES[somme % THEMES.length].id;
}

export function themeAffiche(preference, date) {
    if (preference && preference !== THEME_AUTOMATIQUE && THEMES.some(theme => theme.id === preference)) {
        return preference;
    }
    return themeDuJour(date);
}
