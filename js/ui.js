// Compteurs, dialogues, poignées sur le document. Ce module manipule la page ;
// il ne décide de rien.

import { formaterDate, formaterTemps } from './defi.js';
import { NIVEAUX } from './generateur.js';
import { MODE_GRILLE, MODE_MONTEE, MONTEE, PALIERS } from './montee.js';
import { THEMES } from './themes.js';
import { VARIANTES } from './variantes.js';

export const $ = id => document.getElementById(id);

export function ouvrir(dialogue) {
    if (!dialogue.open) dialogue.showModal();
}

export function poserTheme(document, theme, couleur) {
    document.documentElement.dataset.theme = theme;
    const barre = $('couleur-barre');
    if (barre) barre.setAttribute('content', couleur);
}

// Les boutons de choix sont fabriqués depuis les listes du code : ajouter un
// niveau ou un monde n’oblige pas à retoucher la page.
export function construireChoix(conteneur, entrees, surChoix) {
    conteneur.replaceChildren(...entrees.map(entree => {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.textContent = entree.nom;
        bouton.dataset.valeur = entree.id;
        bouton.setAttribute('aria-pressed', 'false');
        bouton.addEventListener('click', () => surChoix(entree.id));
        return bouton;
    }));
}

export function marquerChoix(conteneur, valeur, attribut = 'valeur') {
    for (const bouton of conteneur.querySelectorAll('button')) {
        bouton.setAttribute('aria-pressed', String(bouton.dataset[attribut] === valeur));
    }
}

export const entreesNiveaux = () => Object.values(NIVEAUX).map(niveau =>
    ({ id: niveau.id, nom: `${niveau.nom} · ${niveau.sommets}` }));

// Le mode n’est pas une taille : « Une grille » et « La Montée » choisissent
// ce qu’on lance, les six tailles choisissent quoi. Deux groupes, deux
// questions — les mêler ferait un septième bouton de taille qui n’en est pas
// une, et le joueur ne saurait plus ce qu’il coche.
export const entreesModes = () => [
    { id: MODE_GRILLE, nom: 'Une grille' },
    { id: MODE_MONTEE, nom: `La ${MONTEE.nom}` }
];

// Les quatre mondes seulement : « du jour » est une case à cocher, pas un
// cinquième bouton. Cinq boutons pour une grille de quatre laissaient le
// dernier seul sur sa ligne, et « du jour » n’est de toute façon pas un monde
// — c’est une façon d’en choisir un.
export const entreesThemes = () => THEMES.map(theme => ({ id: theme.id, nom: theme.nom }));

export function majHud({ partie, croisements, touches, temps, termine }) {
    $('hud-niveau').textContent = partie;
    $('hud-croisements').textContent = String(croisements);
    $('hud-touches').textContent = String(touches);
    $('hud-temps').textContent = formaterTemps(temps);
    const case_ = $('hud-croisements').parentElement;
    case_.classList.toggle('alerte', croisements > 0 && !termine);
    case_.classList.toggle('gagne', croisements === 0);
}

export function annoncer(texte) {
    $('annonce').textContent = texte;
}

export function vibrer(actif, motif) {
    if (!actif) return;
    try { navigator.vibrate?.(motif); } catch { /* l’appareil ne vibre pas */ }
}

export async function copier(texte) {
    try {
        await navigator.clipboard.writeText(texte);
        return true;
    } catch {
        return false;
    }
}

// ── Le palmarès ───────────────────────────────────────────────────────────

const NOMS_VARIANTES = Object.fromEntries(VARIANTES.map(variante => [variante.id, variante.court]));

// La montée n’est pas dans `NIVEAUX` — c’est un mode — mais sa clé de
// palmarès a la même forme que celle d’une taille. Sans cette entrée, le
// tableau des records afficherait la clé brute « montee+cercle ».
const NOMS_CONFIGURATIONS = {
    ...Object.fromEntries(Object.values(NIVEAUX).map(niveau => [niveau.id, niveau.nom])),
    [MONTEE.id]: MONTEE.nom
};

export function libelleConfiguration(cle) {
    const [niveau, ...variantes] = cle.split('+');
    const nom = NOMS_CONFIGURATIONS[niveau] || niveau;
    return variantes.length ? `${nom} · ${variantes.map(id => NOMS_VARIANTES[id] || id).join(', ')}` : nom;
}

function bloc(titre, valeur) {
    return `<div><span>${titre}</span><strong>${valeur}</strong></div>`;
}

function blocsDeSerie(titre, serie = {}) {
    return `<h3>${titre}</h3><div class="serie">${
        bloc('Série', serie.serie || 0)
    }${bloc('Record', serie.meilleureSerie || 0)
    }${bloc('Réussis', (serie.reussis || []).length)}</div>`;
}

export function rendreStatistiques(stats, { classement }) {
    const configurations = Object.entries(stats.configurations || {})
        .sort(([a], [b]) => a.localeCompare(b));
    const economie = classement === 'economie';

    // Deux séries côte à côte plutôt qu’une : l’Écheveau du jour et la Montée
    // du jour sont deux habitudes de longueurs très différentes, et une série
    // commune se serait cassée chaque fois qu’on n’a eu que deux minutes.
    const morceaux = [
        blocsDeSerie('L’Écheveau du jour', stats.quotidien),
        blocsDeSerie(`La ${MONTEE.nom} du jour`, stats.quotidienMontee)
    ];

    if (!configurations.length) {
        morceaux.push('<p class="note">Aucun écheveau démêlé pour l’instant. Le premier fera le premier record.</p>');
    } else {
        const lignes = configurations.map(([cle, valeurs]) => {
            const temps = valeurs.meilleurTempsMs === null ? '—' : formaterTemps(valeurs.meilleurTempsMs);
            const touches = valeurs.meilleursTouches === null ? '—' : `${valeurs.meilleursTouches}`;
            return `<tr><td>${libelleConfiguration(cle)}</td><td>${valeurs.parties}</td>`
                + `<td class="${economie ? '' : 'vedette'}">${temps}</td>`
                + `<td class="${economie ? 'vedette' : ''}">${touches}</td></tr>`;
        }).join('');
        morceaux.push(`<table class="tableau"><thead><tr><th>Configuration</th><th>Parties</th>`
            + `<th>Chrono</th><th>Sommets</th></tr></thead><tbody>${lignes}</tbody></table>`);
        morceaux.push(`<p class="note">Les records sont propres à chaque configuration, et une partie gagnée avec un indice n’y entre pas. La colonne en couleur est celle que vous avez choisi de mettre en avant.</p>`);
    }

    const historique = (stats.historique || []).slice(0, 8);
    if (historique.length) {
        const lignes = historique.map(partie => {
            const quand = partie.dateJour ? formaterDate(partie.dateJour) : new Date(partie.date).toLocaleDateString('fr-FR');
            return `<tr><td>${quand}</td><td>${libelleConfiguration(partie.cle)}</td>`
                + `<td>${formaterTemps(partie.tempsMs)}</td><td>${partie.touches}</td></tr>`;
        }).join('');
        morceaux.push('<h3>Parties récentes</h3>');
        morceaux.push(`<table class="tableau"><tbody>${lignes}</tbody></table>`);
    }

    $('stats-corps').innerHTML = morceaux.join('');
}

// ── Les défis du jour ─────────────────────────────────────────────────────
// Deux défis, un seul bouton dans la barre : à cinq boutons de 44 px elle est
// déjà pleine sur un iPhone SE, et un sixième chasserait le titre. Le bouton
// ouvre donc un panneau qui présente les deux, avec leur série et une coche
// pour celui qui est déjà tombé aujourd’hui.

// Les deux cartes sont dans la page, pas fabriquées ici : un bouton posé en
// dur est un bouton que la vérification structurelle voit, dont l’écouteur se
// branche une fois, et qui ne disparaît pas si ce module change d’avis.
export function rendreDefis(jour, stats) {
    $('defis-date').textContent = formaterDate(jour);
    const cartes = [
        ['echeveau', stats.quotidien, 'Jouer'],
        ['montee', stats.quotidienMontee, 'Monter']
    ];
    for (const [id, serie, verbe] of cartes) {
        const fait = (serie?.reussis || []).includes(jour);
        $(`defi-${id}-fait`).hidden = !fait;
        const reussis = (serie?.reussis || []).length;
        $(`defi-${id}-serie`).textContent =
            `Série de ${serie?.serie || 0} · record ${serie?.meilleureSerie || 0} · ${reussis} réussi${reussis > 1 ? 's' : ''}`;
        const bouton = $(`bouton-defi-${id}`);
        bouton.textContent = fait ? 'Rejouer' : verbe;
        // Le défi qui reste à faire porte l’accent : c’est celui qu’on est
        // venu chercher.
        bouton.classList.toggle('outil--fort', !fait);
    }
}

// Le fil d’Ariane de la montée : six pastilles, celle du palier en cours en
// relief. Six mots ne tiendraient pas sur la largeur d’un téléphone ; six
// pastilles numérotées, si — et elles disent d’un coup d’œil où l’on en est.
export function rendreEchelle(conteneur, montee) {
    conteneur.innerHTML = PALIERS.map((id, rang) => {
        const etat = rang < montee.franchis.length ? 'franchi'
            : (rang === montee.rang ? 'courant' : 'a-venir');
        return `<span class="palier palier--${etat}" title="${NIVEAUX[id].nom} · ${NIVEAUX[id].sommets} sommets">`
            + `${NIVEAUX[id].sommets}</span>`;
    }).join('');
    conteneur.setAttribute('aria-label',
        `Montée : palier ${Math.min(montee.rang + 1, PALIERS.length)} sur ${PALIERS.length}, ${NIVEAUX[PALIERS[montee.rang]].nom}.`);
}
