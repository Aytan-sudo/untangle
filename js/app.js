// Assemblage, rien d’autre : les règles sont dans graphe/generateur/partie, le
// dessin dans rendu, les gestes dans entree, la page dans ui.

import { NIVEAU_QUOTIDIEN, VERSION } from './config.js';
import {
    courbeEnEmojis, dateLocale, formaterTemps, lireParametres, messageDePartage
} from './defi.js';
import { NIVEAUX, genererPuzzle } from './generateur.js';
import { comptesParArete, conflits } from './graphe.js';
import { graineLibre } from './hasard.js';
import {
    aimanter, annuler, appliquerIndice, contraindre, courbe, croisements, deposer,
    estEpingle, estTerminee, horsPalmares, partieNeuve, pasDeDeplacement, restaurer, serialiser
} from './partie.js';
import {
    construirePlateau, coordonneesPlateau, marquer, marquerChaleur, placerSommet,
    rendreFilsDe, rendreTout, sommetDansLaDirection, sommetProche, tendreLaisse
} from './rendu.js';
import { brancherClavier, brancherPointeur } from './entree.js';
import {
    preparerSon, sonDegage, sonEmmele, sonIndice, sonPose, sonPrise, sonRefus,
    sonVictoire, surveillerVisibilite
} from './son.js';
import {
    chargerPartie, chargerPreferences, chargerStatistiques, cleConfiguration,
    effacerStatistiques, enregistrerPartie, enregistrerPreferences, enregistrerVictoire,
    oublierPartie
} from './stockage.js';
import { THEMES, THEME_AUTOMATIQUE, themeAffiche, themeSuivant } from './themes.js';
import { IDS as VARIANTES_IDS, resumeVariantes, variantesDepuis } from './variantes.js';
import {
    $, annoncer, construireChoix, copier, entreesNiveaux, entreesThemes, libelleConfiguration,
    majHud, marquerChoix, ouvrir, poserTheme, rendreStatistiques, vibrer
} from './ui.js';

let preferences = chargerPreferences();
let meta = null;
let puzzle = null;
let etat = null;
let visee = -1;
let origineSaisie = null;
let termine = false;
let resultatEnregistre = false;
let montreLeGenerateur = false;
let dispositionDuJoueur = null;

let tempsCumule = 0;
let debutChrono = 0;
let chronoActif = false;
let aCommence = false;
let croisementsAffiches = 0;
let dernierEnregistrement = 0;

// ── Chronomètre ───────────────────────────────────────────────────────────
// Toute partie chronométrée se met en pause quand l’onglet passe à
// l’arrière-plan : le temps compté est celui qu’on a réellement passé dessus.

const tempsActuel = () => tempsCumule + (chronoActif ? performance.now() - debutChrono : 0);

function lancerChrono() {
    aCommence = true;
    if (chronoActif || termine || document.hidden) return;
    debutChrono = performance.now();
    chronoActif = true;
}

function arreterChrono() {
    if (!chronoActif) return;
    tempsCumule += performance.now() - debutChrono;
    chronoActif = false;
}

// ── Préférences et apparence ──────────────────────────────────────────────

function appliquerApparence() {
    const identifiant = themeAffiche(preferences.theme, dateLocale());
    const monde = THEMES.find(theme => theme.id === identifiant) || THEMES[0];
    poserTheme(document, monde.id, monde.couleur);
    document.documentElement.dataset.signes = preferences.signes ? 'oui' : 'non';
    // `aveugle` ne se lit surtout pas dans les préférences : c’est une
    // propriété de la partie en cours. Le défi du jour se joue en version
    // canonique — le relire ici rendrait aveugle un défi qui ne l’est pas, au
    // premier réglage touché en cours de partie.
    $('bouton-son').setAttribute('aria-pressed', String(preferences.sons));
    $('bouton-son').setAttribute('aria-label', preferences.sons ? 'Couper le son' : 'Rétablir le son');
}

function enregistrerReglages() {
    enregistrerPreferences(preferences);
    appliquerApparence();
    majFormulaire();
}

function majFormulaire() {
    marquerChoix($('choix-niveau'), preferences.niveau);
    // Même en « monde du jour », on marque le monde effectivement affiché :
    // la case dit d’où vient le choix, les boutons disent lequel c’est.
    marquerChoix($('choix-theme'), themeAffiche(preferences.theme, dateLocale()));
    $('option-theme-du-jour').checked = preferences.theme === THEME_AUTOMATIQUE;
    marquerChoix($('choix-classement'), preferences.classement, 'classement');
    for (const id of ['sons', 'vibration', 'aimant', 'signes', ...VARIANTES_IDS]) {
        $(`option-${id}`).checked = Boolean(preferences[id]);
    }
}

// ── Cycle d’une partie ────────────────────────────────────────────────────

function nomDeLaPartie() {
    const nom = NIVEAUX[meta.niveau]?.nom || meta.niveau;
    if (meta.dateJour) return meta.quotidien ? 'Défi du jour' : `Défi ${meta.dateJour.slice(8)}/${meta.dateJour.slice(5, 7)}`;
    const variantes = resumeVariantes(meta.variantes);
    return variantes ? `${nom} · ${variantes}` : nom;
}

function demarrer(nouvelleMeta, sauvegarde = null) {
    meta = nouvelleMeta;
    puzzle = genererPuzzle({
        graine: meta.graine,
        niveau: meta.niveau,
        cercle: meta.variantes.cercle,
        epingles: meta.variantes.epingles
    });
    etat = sauvegarde ? restaurer(puzzle, sauvegarde.partie) : partieNeuve(puzzle);
    tempsCumule = sauvegarde ? Number(sauvegarde.tempsMs) || 0 : 0;
    chronoActif = false;
    // Une partie reprise a déjà commencé : son chrono repart au retour de
    // l’onglet, sans attendre qu’on saisisse un sommet.
    aCommence = Boolean(sauvegarde) && (tempsCumule > 0 || etat.gestes > 0);
    termine = false;
    resultatEnregistre = false;
    montreLeGenerateur = false;
    dispositionDuJoueur = null;
    visee = -1;
    origineSaisie = null;

    document.documentElement.dataset.aveugle = meta.variantes.aveugle ? 'oui' : 'non';
    construirePlateau(document, {
        svg: $('plateau'), fils: $('fils'), sommets: $('sommets'), laisse: $('laisse')
    }, puzzle);
    rendreTout(etat.positions);
    rafraichir();
    annoncer(meta.quotidien
        ? `Défi du ${meta.dateJour.split('-').reverse().join('/')} — le même écheveau pour tout le monde.`
        : `${puzzle.sommets} sommets, ${puzzle.aretes.length} fils. Tirez.`);
    if (estTerminee(etat)) conclure();
}

function rafraichir() {
    const paires = conflits(etat.positions, puzzle.aretes);
    marquerChaleur(comptesParArete(puzzle.aretes.length, paires));
    croisementsAffiches = paires.length;
    majHud({
        partie: nomDeLaPartie(),
        croisements: paires.length,
        touches: etat.touches.length,
        temps: tempsActuel(),
        termine
    });
    $('bouton-annuler').disabled = etat.historique.length === 0;
    $('bouton-indice').disabled = termine;
    return paires.length;
}

function sauvegarder(force = false) {
    const maintenant = Date.now();
    if (!force && maintenant - dernierEnregistrement < 1200) return;
    dernierEnregistrement = maintenant;
    if (termine) { oublierPartie(); return; }
    enregistrerPartie({
        graine: meta.graine, niveau: meta.niveau, dateJour: meta.dateJour,
        quotidien: meta.quotidien, variantes: meta.variantes,
        tempsMs: tempsActuel(), partie: serialiser(etat)
    });
}

function conclure() {
    if (termine) return;
    termine = true;
    arreterChrono();
    oublierPartie();
    marquer(-1, 'sommet--saisi', false);
    marquer(-1, 'sommet--vise', false);
    rafraichir();
    if (preferences.sons) sonVictoire();
    vibrer(preferences.vibration, [18, 60, 18, 60, 40]);

    if (!resultatEnregistre) {
        resultatEnregistre = true;
        enregistrerVictoire({
            niveau: meta.niveau, variantes: meta.variantes,
            quotidien: meta.quotidien, dateJour: meta.dateJour,
            tempsMs: tempsActuel(), touches: etat.touches.length,
            gestes: etat.gestes, indices: etat.indices
        });
    }

    const touches = etat.touches.length;
    $('fin-resume').textContent =
        `Démêlé en ${formaterTemps(tempsActuel())}, en touchant ${touches} sommet${touches > 1 ? 's' : ''} sur ${puzzle.sommets}.`;
    $('fin-courbe').textContent = courbeEnEmojis(courbe(etat));
    $('fin-details').textContent = horsPalmares(etat)
        ? `${etat.indices} indice${etat.indices > 1 ? 's' : ''} : cette partie ne concourt pas au palmarès.`
        : `${libelleConfiguration(cleConfiguration(meta.niveau, meta.variantes))} · ${etat.gestes} geste${etat.gestes > 1 ? 's' : ''} · sans indice.`;
    $('bouton-generateur').textContent = 'Montrer le dessin du générateur';
    ouvrir($('dialogue-fin'));
}

// ── Le dessin du générateur ───────────────────────────────────────────────
// Le graphe est 3-connexe : il n’a qu’un seul dessin planaire, à réflexion
// près. Superposer les deux dispositions, c’est montrer cette garantie plutôt
// que de se contenter de l’affirmer.

function transporterVers(cible, quand) {
    const depart = etat.positions.map(point => ({ ...point }));
    const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duree = reduit ? 0 : quand;
    const debut = performance.now();
    const pas = () => {
        const avancement = duree ? Math.min(1, (performance.now() - debut) / duree) : 1;
        const douceur = avancement < 0.5 ? 2 * avancement * avancement : 1 - ((-2 * avancement + 2) ** 2) / 2;
        etat.positions = depart.map((point, index) => ({
            x: point.x + (cible[index].x - point.x) * douceur,
            y: point.y + (cible[index].y - point.y) * douceur
        }));
        rendreTout(etat.positions);
        if (avancement < 1) requestAnimationFrame(pas);
        else rafraichir();
    };
    requestAnimationFrame(pas);
}

function basculerGenerateur() {
    if (!termine) return;
    if (!montreLeGenerateur) {
        dispositionDuJoueur = etat.positions.map(point => ({ ...point }));
        montreLeGenerateur = true;
        transporterVers(puzzle.solution, 800);
        $('bouton-generateur').textContent = 'Revenir à votre dessin';
        annoncer('Le dessin du générateur. Le vôtre est le même, à une réflexion près : c’est ce que garantit la 3-connexité.');
    } else {
        montreLeGenerateur = false;
        transporterVers(dispositionDuJoueur, 800);
        $('bouton-generateur').textContent = 'Montrer le dessin du générateur';
        annoncer('Votre dessin.');
    }
}

// ── Lancer une partie ─────────────────────────────────────────────────────

function partieLibre(graine = graineLibre()) {
    history.replaceState(null, '', location.pathname);
    demarrer({
        graine, niveau: preferences.niveau, dateJour: null, quotidien: false,
        variantes: variantesDepuis(preferences)
    });
}

function partieDuJour() {
    const jour = dateLocale();
    history.replaceState(null, '', `?jour=${jour}`);
    demarrer({
        graine: jour, niveau: NIVEAU_QUOTIDIEN, dateJour: jour, quotidien: true,
        variantes: variantesDepuis({})
    });
}

function relancer() {
    demarrer({ ...meta });
    annoncer('Le même écheveau, remis à plat.');
}

// ── Gestes ────────────────────────────────────────────────────────────────

function positionAffichee(index, cible) {
    const brut = preferences.aimant
        ? { x: aimanter(cible.x), y: aimanter(cible.y) }
        : { x: contraindre(cible.x), y: contraindre(cible.y) };
    etat.positions[index] = brut;
    placerSommet(index, brut.x, brut.y);
    rendreFilsDe(index, etat.positions);
    return brut;
}

const actions = {
    coordonnees: (clientX, clientY) => coordonneesPlateau($('plateau'), clientX, clientY),
    viser: (point, rayon) => sommetProche(etat.positions, point, rayon),
    peutPrendre: index => !termine && !estEpingle(etat, index),
    positionDe: index => ({ ...etat.positions[index] }),
    sommetVise: () => visee,
    viserSommet: index => {
        visee = index;
        marquer(index, 'sommet--vise', true);
        const fils = puzzle.aretes.filter(([a, b]) => a === index || b === index).length;
        annoncer(`Sommet ${index + 1} sur ${puzzle.sommets}, ${fils} fils.`);
    },
    viserDansLaDirection: direction => sommetDansLaDirection(etat.positions, visee, direction),
    pasClavier: fin => pasDeDeplacement({ aimant: preferences.aimant, fin }),

    prendre: index => {
        origineSaisie = { ...etat.positions[index] };
        visee = index;
        marquer(index, 'sommet--saisi', true);
        marquer(-1, 'sommet--vise', false);
        lancerChrono();
        if (preferences.sons) sonPrise();
    },

    glisser: (index, cible, doigt = null) => {
        const pose = positionAffichee(index, cible);
        tendreLaisse(doigt && doigt.y - pose.y > 1 ? doigt : null, pose);
        rafraichir();
    },

    poser: (index, cible) => {
        const avant = origineSaisie;
        tendreLaisse(null, null);
        marquer(-1, 'sommet--saisi', false);
        marquer(index, 'sommet--vise', true);
        const croisementsAvant = (() => {
            const memoire = etat.positions[index];
            etat.positions[index] = avant;
            const compte = croisements(etat);
            etat.positions[index] = memoire;
            return compte;
        })();
        etat.positions[index] = avant;
        const bouge = deposer(etat, index, cible.x, cible.y, { aimant: preferences.aimant });
        if (!bouge) {
            placerSommet(index, avant.x, avant.y);
            rendreFilsDe(index, etat.positions);
            rafraichir();
            return;
        }
        placerSommet(index, etat.positions[index].x, etat.positions[index].y);
        rendreFilsDe(index, etat.positions);
        const apres = rafraichir();
        if (preferences.sons) {
            if (apres < croisementsAvant) sonDegage();
            else if (apres > croisementsAvant) sonEmmele();
            else sonPose();
        }
        if (apres < croisementsAvant) vibrer(preferences.vibration, 12);
        sauvegarder();
        if (apres === 0) conclure();
    },

    abandonner: (index, origine) => {
        tendreLaisse(null, null);
        marquer(-1, 'sommet--saisi', false);
        marquer(index, 'sommet--vise', true);
        if (origine) {
            etat.positions[index] = { ...origine };
            placerSommet(index, origine.x, origine.y);
            rendreFilsDe(index, etat.positions);
        }
        rafraichir();
    },

    refuser: index => {
        if (preferences.sons) sonRefus();
        annoncer(termine ? 'L’écheveau est démêlé.' : `Le sommet ${index + 1} est épinglé : il ne bouge pas.`);
    }
};

// ── Commandes ─────────────────────────────────────────────────────────────

function annulerUnGeste() {
    if (!annuler(etat)) { annoncer('Rien à annuler.'); return; }
    termine = false;
    rendreTout(etat.positions);
    rafraichir();
    if (preferences.sons) sonPose();
    sauvegarder(true);
    annoncer('Geste annulé.');
}

function demanderUnIndice() {
    if (termine) return;
    const conseil = appliquerIndice(etat);
    if (!conseil) { annoncer('Plus rien à dégager.'); return; }
    lancerChrono();
    rendreTout(etat.positions);
    const restants = rafraichir();
    if (preferences.sons) sonIndice();
    marquer(conseil.sommet, 'sommet--vise', true);
    visee = conseil.sommet;
    annoncer(`Le sommet ${conseil.sommet + 1} avait une meilleure place. Cette partie ne concourt plus.`);
    sauvegarder(true);
    if (restants === 0) conclure();
}

function tournerLeMonde() {
    const actuel = themeAffiche(preferences.theme, dateLocale());
    preferences.theme = themeSuivant(actuel);
    enregistrerReglages();
    const monde = THEMES.find(theme => theme.id === preferences.theme);
    annoncer(`Monde : ${monde.nom}.`);
}

function partager() {
    const texte = messageDePartage({
        base: location.href, meta, termine,
        tempsMs: tempsActuel(), touches: etat.touches.length,
        indices: etat.indices, courbe: courbe(etat)
    });
    copier(texte).then(reussi => annoncer(reussi ? 'Résultat copié.' : 'La copie a été refusée par le navigateur.'));
}

// ── Câblage ───────────────────────────────────────────────────────────────

function brancherInterface() {
    $('version').textContent = `Untangle ${VERSION}`;

    construireChoix($('choix-niveau'), entreesNiveaux(), niveau => {
        preferences.niveau = niveau;
        enregistrerReglages();
        partieLibre();
    });
    construireChoix($('choix-theme'), entreesThemes(), theme => {
        preferences.theme = theme;
        enregistrerReglages();
    });
    $('option-theme-du-jour').addEventListener('change', evenement => {
        // Décocher sans rien choisir d’autre fige le monde affiché : sinon la
        // case se rocherait toute seule au prochain passage dans les Options.
        preferences.theme = evenement.target.checked
            ? THEME_AUTOMATIQUE
            : themeAffiche(preferences.theme, dateLocale());
        enregistrerReglages();
    });
    for (const bouton of $('choix-classement').querySelectorAll('button')) {
        bouton.addEventListener('click', () => {
            preferences.classement = bouton.dataset.classement;
            enregistrerReglages();
        });
    }

    for (const id of ['sons', 'vibration', 'aimant', 'signes']) {
        $(`option-${id}`).addEventListener('change', evenement => {
            preferences[id] = evenement.target.checked;
            enregistrerReglages();
        });
    }
    // Changer une variante relance un écheveau neuf : elles définissent la
    // configuration du palmarès, on ne les enfile pas en cours de route.
    for (const id of VARIANTES_IDS) {
        $(`option-${id}`).addEventListener('change', evenement => {
            preferences[id] = evenement.target.checked;
            enregistrerReglages();
            partieLibre();
        });
    }

    $('bouton-aide').addEventListener('click', () => ouvrir($('dialogue-aide')));
    $('bouton-options').addEventListener('click', () => { majFormulaire(); ouvrir($('dialogue-options')); });
    $('bouton-stats').addEventListener('click', () => {
        rendreStatistiques(chargerStatistiques(), preferences);
        ouvrir($('dialogue-stats'));
    });
    $('bouton-defi').addEventListener('click', partieDuJour);
    $('bouton-theme').addEventListener('click', tournerLeMonde);
    $('bouton-son').addEventListener('click', () => {
        preferences.sons = !preferences.sons;
        enregistrerReglages();
        annoncer(preferences.sons ? 'Son rétabli.' : 'Son coupé.');
    });

    $('bouton-annuler').addEventListener('click', annulerUnGeste);
    $('bouton-indice').addEventListener('click', demanderUnIndice);
    $('bouton-nouvelle').addEventListener('click', () => partieLibre());
    $('bouton-suivante').addEventListener('click', () => { $('dialogue-fin').close(); partieLibre(); });
    $('bouton-partager').addEventListener('click', partager);
    $('bouton-generateur').addEventListener('click', basculerGenerateur);
    $('bouton-effacer-stats').addEventListener('click', () => {
        effacerStatistiques();
        rendreStatistiques(chargerStatistiques(), preferences);
        annoncer('Palmarès effacé.');
    });

    document.addEventListener('keydown', evenement => {
        if (evenement.metaKey || evenement.altKey) return;
        // Un dialogue ouvert avale tous les raccourcis : sinon `U` annulerait
        // un geste derrière la fenêtre de fin, et `N` relancerait une partie
        // qu’on ne voit pas. `Échap` reste au navigateur, qui ferme.
        if (document.querySelector('dialog[open]')) return;
        const touche = evenement.key.toLowerCase();
        if ((touche === 'z' && evenement.ctrlKey) || (touche === 'u' && !evenement.ctrlKey)) {
            evenement.preventDefault();
            annulerUnGeste();
            return;
        }
        if (evenement.ctrlKey) return;
        if (touche === 'n') partieLibre();
        else if (touche === 'r') relancer();
        else if (touche === 't') tournerLeMonde();
        else if (touche === 'h') demanderUnIndice();
        else if (evenement.key === '?') ouvrir($('dialogue-aide'));
    });

    brancherPointeur($('plateau'), actions);
    brancherClavier($('plateau'), actions);
}

// ── Départ ────────────────────────────────────────────────────────────────

function partieDeDepart() {
    const demandee = lireParametres(location.search);
    const sauvegarde = chargerPartie();
    if (demandee) {
        const memeGrille = sauvegarde && sauvegarde.graine === demandee.graine
            && sauvegarde.niveau === demandee.niveau
            && VARIANTES_IDS.every(id => Boolean(sauvegarde.variantes?.[id]) === demandee.variantes[id]);
        demarrer(demandee, memeGrille ? sauvegarde : null);
        return;
    }
    if (sauvegarde && sauvegarde.graine) {
        demarrer({
            graine: sauvegarde.graine,
            niveau: NIVEAUX[sauvegarde.niveau] ? sauvegarde.niveau : preferences.niveau,
            dateJour: sauvegarde.dateJour || null,
            quotidien: Boolean(sauvegarde.quotidien) && sauvegarde.dateJour === dateLocale(),
            variantes: variantesDepuis(sauvegarde.variantes || {})
        }, sauvegarde);
        return;
    }
    partieLibre();
}

appliquerApparence();
brancherInterface();
majFormulaire();
partieDeDepart();

preparerSon(document, () => preferences.sons);
surveillerVisibilite(document);

// Le chrono s’arrête quand on part lire ailleurs — et repart quand on
// revient. Sans le second volet, le temps affiché resterait figé jusqu’au
// geste suivant : le jeu aurait l’air cassé, et le résultat serait faux.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { arreterChrono(); sauvegarder(true); }
    else if (aCommence && !termine) lancerChrono();
});

setInterval(() => {
    if (termine) return;
    majHud({
        partie: nomDeLaPartie(),
        croisements: croisementsAffiches,
        touches: etat.touches.length,
        temps: tempsActuel(),
        termine
    });
    sauvegarder();
}, 500);

if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { /* hors ligne plus tard */ }));
}
