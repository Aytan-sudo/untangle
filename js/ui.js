// Compteurs, dialogues, poignées sur le document. Ce module manipule la page ;
// il ne décide de rien.

import { formaterDate, formaterTemps } from './defi.js';
import { NIVEAUX } from './generateur.js';
import { THEMES, THEME_AUTOMATIQUE } from './themes.js';
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

export const entreesNiveaux = () => Object.values(NIVEAUX).map(niveau => ({ id: niveau.id, nom: niveau.nom }));
export const entreesThemes = () => [{ id: THEME_AUTOMATIQUE, nom: 'Du jour' },
    ...THEMES.map(theme => ({ id: theme.id, nom: theme.nom }))];

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

export function libelleConfiguration(cle) {
    const [niveau, ...variantes] = cle.split('+');
    const nom = NIVEAUX[niveau]?.nom || niveau;
    return variantes.length ? `${nom} · ${variantes.map(id => NOMS_VARIANTES[id] || id).join(', ')}` : nom;
}

function bloc(titre, valeur) {
    return `<div><span>${titre}</span><strong>${valeur}</strong></div>`;
}

export function rendreStatistiques(stats, { classement }) {
    const quotidien = stats.quotidien || {};
    const configurations = Object.entries(stats.configurations || {})
        .sort(([a], [b]) => a.localeCompare(b));
    const economie = classement === 'economie';

    const morceaux = [`<div class="serie">${
        bloc('Série', quotidien.serie || 0)
    }${bloc('Record', quotidien.meilleureSerie || 0)
    }${bloc('Défis', (quotidien.reussis || []).length)}</div>`];

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
