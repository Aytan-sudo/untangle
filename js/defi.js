// Le défi du jour et le partage. La date locale fait la graine : la même
// grille pour tout le monde, refabriquée chez chacun, sans serveur ni réseau.

import { NIVEAU_QUOTIDIEN } from './config.js';
import { NIVEAUX } from './generateur.js';
import { IDS as VARIANTES_PARTAGEES } from './variantes.js';

export function dateLocale(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const estUneDate = valeur => /^\d{4}-\d{2}-\d{2}$/.test(String(valeur || ''));

export function formaterDate(jour) {
    return estUneDate(jour) ? jour.split('-').reverse().join('/') : '';
}

export function formaterTemps(millisecondes) {
    const total = Math.max(0, Math.floor(millisecondes / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Les variantes voyagent dans l’adresse — la liste vient de `variantes.js`,
// leur unique domicile. La recopier ici marcherait aujourd’hui et se
// désynchroniserait à la quatrième variante, sans rien casser de visible :
// le lien partagé rendrait simplement une autre grille que celle jouée.
// L’aimant n’est pas du lot : c’est un confort de doigt, il ne regarde que
// son joueur et ne change pas la grille.

// Le défi du jour se joue en version canonique : personne ne compare un
// écheveau épinglé à un écheveau nu.
export function lireParametres(recherche, aujourdhui = dateLocale()) {
    const parametres = new URLSearchParams(recherche || '');
    const jour = parametres.get('jour');
    if (estUneDate(jour)) {
        return {
            graine: jour, niveau: NIVEAU_QUOTIDIEN, dateJour: jour,
            quotidien: jour === aujourdhui,
            variantes: { epingles: false, cercle: false, aveugle: false }
        };
    }
    const graine = parametres.get('seed');
    if (!graine) return null;
    const niveau = parametres.get('niveau');
    const drapeaux = (parametres.get('v') || '').split(',').filter(Boolean);
    return {
        graine,
        niveau: NIVEAUX[niveau] ? niveau : NIVEAU_QUOTIDIEN,
        dateJour: null,
        quotidien: false,
        variantes: Object.fromEntries(VARIANTES_PARTAGEES.map(nom => [nom, drapeaux.includes(nom)]))
    };
}

export function lienDePartage(base, meta) {
    const url = new URL(base);
    url.search = '';
    url.hash = '';
    if (meta.dateJour) {
        url.searchParams.set('jour', meta.dateJour);
        return url.href;
    }
    url.searchParams.set('seed', meta.graine);
    url.searchParams.set('niveau', meta.niveau);
    const actives = VARIANTES_PARTAGEES.filter(nom => meta.variantes?.[nom]);
    if (actives.length) url.searchParams.set('v', actives.join(','));
    return url.href;
}

// La courbe des croisements en couleurs. Elle dit les paliers et le déclic,
// jamais la solution : quatre teintes de la pelote au fil tendu.
const TEINTES = ['🟩', '🟨', '🟧', '🟥'];

export function courbeEnEmojis(courbe) {
    return courbe.map(valeur => {
        if (valeur <= 0) return TEINTES[0];
        if (valeur <= 1 / 3) return TEINTES[1];
        if (valeur <= 2 / 3) return TEINTES[2];
        return TEINTES[3];
    }).join('');
}

export function messageDePartage({ base, meta, termine, tempsMs, touches, indices, courbe }) {
    const nomNiveau = NIVEAUX[meta.niveau]?.nom || meta.niveau;
    const actives = VARIANTES_PARTAGEES.filter(nom => meta.variantes?.[nom]);
    const entete = meta.dateJour
        ? `Untangle ${formaterDate(meta.dateJour)} · ${nomNiveau}`
        : `Untangle · ${nomNiveau}`;
    const lignes = [actives.length ? `${entete} (${actives.join(', ')})` : entete];
    if (termine) {
        lignes.push(`Démêlé en ${formaterTemps(tempsMs)} · ${touches} sommet${touches > 1 ? 's' : ''} touché${touches > 1 ? 's' : ''}`);
        lignes.push(indices ? `${indices} indice${indices > 1 ? 's' : ''}` : 'Sans indice ✦');
        lignes.push(courbeEnEmojis(courbe));
    } else {
        lignes.push('Un écheveau, zéro croisement à trouver. À vous.');
    }
    lignes.push(lienDePartage(base, meta));
    return lignes.join('\n');
}
