// Assemblage, rien d’autre : les règles sont dans graphe/generateur/partie, le
// dessin dans rendu, les gestes dans entree, la page dans ui.

import { NIVEAU_QUOTIDIEN, VERSION } from './config.js';
import {
    courbeEnEmojis, dateLocale, formaterTemps, lireParametres, messageDePartage
} from './defi.js';
import { NIVEAUX, genererPuzzle } from './generateur.js';
import {
    MODE_GRILLE, MODE_MONTEE, MONTEE, PALIERS, SOMMETS_EN_TOUT, courbeDeMontee,
    estAchevee, franchir, graineDuPalier, monteeNeuve, palierCourant, rangAffiche,
    restaurerMontee, serialiserMontee, totalMontee
} from './montee.js';
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
    $, annoncer, construireChoix, copier, entreesModes, entreesNiveaux, entreesThemes,
    libelleConfiguration, majHud, marquerChoix, ouvrir, poserTheme, rendreDefis,
    rendreEchelle, rendreStatistiques, vibrer
} from './ui.js';

let preferences = chargerPreferences();
let meta = null;
// Le parcours en cours, ou `null` quand on joue une grille seule. C’est lui
// qui porte le chronomètre du mode : `etat` ne connaît que la grille sous le
// doigt, et n’a rien à savoir des cinq autres.
let montee = null;
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

// En montée, le temps affiché est celui de tout le parcours : les paliers déjà
// franchis, plus celui qu’on démêle. C’est l’unique tension du mode — pas de
// vies, pas de sablier, une horloge qui ne se remet jamais à zéro avant le
// Dédale.
const tempsDuParcours = () => (montee ? totalMontee(montee).tempsMs : 0) + tempsActuel();
const tempsAffiche = () => (meta?.mode === MODE_MONTEE ? tempsDuParcours() : tempsActuel());

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
    marquerChoix($('choix-mode'), preferences.mode, 'valeur');
    marquerChoix($('choix-niveau'), preferences.niveau);
    // En montée, choisir une taille n’a plus de sens : les six y passent dans
    // l’ordre. Le bloc disparaît plutôt que de rester là, grisé, à faire
    // croire qu’il attend quelque chose.
    $('bloc-taille').hidden = preferences.mode === MODE_MONTEE;
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

// La case du HUD est étroite : 111 px sur un iPhone 15, 86 px sur un SE.
// « Montée 4/6 » y tient partout ; « Montée du jour 4/6 » nulle part. C’est le
// rang qu’on garde — il change à chaque palier, et c’est ce qu’on regarde. Que
// la montée soit celle du jour, l’annonce le dit au départ et l’échelle le
// rappelle en dessous.
function nomDeLaPartie() {
    const nom = NIVEAUX[meta.niveau]?.nom || meta.niveau;
    if (meta.mode === MODE_MONTEE) {
        return `${MONTEE.nom} ${rangAffiche(montee)}/${PALIERS.length}`;
    }
    if (meta.dateJour) return meta.quotidien ? 'Défi du jour' : `Défi ${meta.dateJour.slice(8)}/${meta.dateJour.slice(5, 7)}`;
    const variantes = resumeVariantes(meta.variantes);
    return variantes ? `${nom} · ${variantes}` : nom;
}

// `report` sert à la relance d’un palier de montée : le temps déjà passé
// dessus revient dans le compteur du palier neuf. Sans lui, `R` serait un
// bouton « effacer le chronomètre » au milieu d’un mode qui n’a que le
// chronomètre pour tension.
function demarrer(nouvelleMeta, sauvegarde = null, report = 0) {
    meta = nouvelleMeta;
    const enMontee = meta.mode === MODE_MONTEE;
    if (enMontee) meta.niveau = palierCourant(montee);
    puzzle = genererPuzzle({
        // Une graine par palier, dérivée de celle du parcours : deux montées
        // de graine voisine n’ont aucune grille en commun.
        graine: enMontee ? graineDuPalier(montee.graine, montee.rang) : meta.graine,
        niveau: meta.niveau,
        cercle: meta.variantes.cercle,
        epingles: meta.variantes.epingles
    });
    etat = sauvegarde ? restaurer(puzzle, sauvegarde.partie) : partieNeuve(puzzle);
    tempsCumule = report || (sauvegarde ? Number(sauvegarde.tempsMs) || 0 : 0);
    chronoActif = false;
    // Une partie reprise a déjà commencé : son chrono repart au retour de
    // l’onglet, sans attendre qu’on saisisse un sommet.
    aCommence = tempsCumule > 0 || (Boolean(sauvegarde) && etat.gestes > 0);
    termine = false;
    resultatEnregistre = false;
    montreLeGenerateur = false;
    dispositionDuJoueur = null;
    visee = -1;
    origineSaisie = null;

    document.documentElement.dataset.aveugle = meta.variantes.aveugle ? 'oui' : 'non';
    $('echelle').hidden = !enMontee;
    if (enMontee) rendreEchelle($('echelle'), montee);
    construirePlateau(document, {
        svg: $('plateau'), fils: $('fils'), sommets: $('sommets'), laisse: $('laisse')
    }, puzzle);
    rendreTout(etat.positions);
    rafraichir();
    annoncer(annonceDeDepart());
    if (estTerminee(etat)) conclure();
}

function annonceDeDepart() {
    const tirez = `${puzzle.sommets} sommets, ${puzzle.aretes.length} fils. Tirez.`;
    if (meta.mode === MODE_MONTEE) {
        const nom = NIVEAUX[meta.niveau].nom;
        const quelle = meta.quotidien ? `${MONTEE.nom} du jour` : MONTEE.nom;
        return `${quelle}, palier ${rangAffiche(montee)} sur ${PALIERS.length} : ${nom}. ${tirez}`;
    }
    if (meta.quotidien) {
        return `Défi du ${meta.dateJour.split('-').reverse().join('/')} — le même écheveau pour tout le monde.`;
    }
    return tirez;
}

function rafraichir() {
    const paires = conflits(etat.positions, puzzle.aretes);
    marquerChaleur(comptesParArete(puzzle.aretes.length, paires));
    croisementsAffiches = paires.length;
    majHud({
        partie: nomDeLaPartie(),
        croisements: paires.length,
        touches: etat.touches.length,
        temps: tempsAffiche(),
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
    // Une montée en cours se garde même entre deux paliers : ce qu’on reprend,
    // c’est le parcours, pas la grille. Elle ne s’oublie qu’une fois bouclée.
    const enCoursDeMontee = Boolean(montee) && !estAchevee(montee);
    if (termine && !enCoursDeMontee) { oublierPartie(); return; }
    // Palier franchi mais parcours en cours : on n’écrit ni la grille ni son
    // chrono — le temps vient d’être versé dans la montée, le recompter le
    // ferait compter deux fois à la réouverture.
    const grilleEnCours = !termine;
    enregistrerPartie({
        mode: meta.mode, graine: meta.graine, niveau: meta.niveau, dateJour: meta.dateJour,
        quotidien: meta.quotidien, variantes: meta.variantes,
        montee: montee ? serialiserMontee(montee) : null,
        tempsMs: grilleEnCours ? tempsActuel() : 0,
        partie: grilleEnCours ? serialiser(etat) : null
    });
}

function conclure() {
    if (termine) return;
    termine = true;
    arreterChrono();
    marquer(-1, 'sommet--saisi', false);
    marquer(-1, 'sommet--vise', false);
    rafraichir();
    if (preferences.sons) sonVictoire();
    vibrer(preferences.vibration, [18, 60, 18, 60, 40]);

    if (meta.mode === MODE_MONTEE) { conclureLePalier(); return; }
    oublierPartie();

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
    $('titre-fin').textContent = 'Démêlé';
    $('bouton-suivante').textContent = 'Un autre';
    $('bouton-generateur').textContent = 'Montrer le dessin du générateur';
    ouvrir($('dialogue-fin'));
}

// ── La Montée ─────────────────────────────────────────────────────────────
// Un palier franchi n’ouvre pas le dialogue de fin : il ouvre un palier de
// respiration, avec l’échelle et le temps du parcours. Le dialogue de fin est
// réservé à l’arrivée — sinon le mode aurait six fins et aucune.

function conclureLePalier() {
    franchir(montee, {
        tempsMs: tempsActuel(), touches: etat.touches.length,
        gestes: etat.gestes, indices: etat.indices
    });
    rendreEchelle($('echelle'), montee);
    rafraichir();
    if (estAchevee(montee)) { conclureLaMontee(); return; }

    sauvegarder(true);
    const dernier = montee.franchis[montee.franchis.length - 1];
    const suivant = NIVEAUX[palierCourant(montee)];
    $('titre-palier').textContent = `Palier ${montee.franchis.length} sur ${PALIERS.length}`;
    const franchi = NIVEAUX[dernier.niveau];
    $('palier-resume').textContent =
        `${franchi.nom} démêlé${franchi.feminin ? 'e' : ''} en ${formaterTemps(dernier.tempsMs)}.`;
    $('palier-suite').textContent =
        `Au suivant : ${suivant.nom}, ${suivant.sommets} sommets. `
        + `${formaterTemps(totalMontee(montee).tempsMs)} depuis le départ.`;
    rendreEchelle($('palier-echelle'), montee);
    ouvrir($('dialogue-palier'));
    annoncer(`Palier franchi. Au suivant : ${suivant.nom}.`);
}

// Le panneau de palier est une étape, pas une fenêtre qu’on écarte : le
// fermer par la croix ou par Échap laissait le joueur devant une grille déjà
// démêlée, sans indice, sans annulation et sans bouton pour avancer — la
// montée était bloquée. Toute fermeture enchaîne donc sur le palier suivant,
// et le bouton Continuer ne fait rien d’autre que fermer.
function continuerLaMontee() {
    if (!montee || estAchevee(montee) || meta.mode !== MODE_MONTEE) return;
    demarrer({ ...meta });
    sauvegarder(true);
}

function conclureLaMontee() {
    const total = totalMontee(montee);
    oublierPartie();
    if (!resultatEnregistre) {
        resultatEnregistre = true;
        enregistrerVictoire({
            niveau: MONTEE.id, variantes: meta.variantes,
            quotidien: meta.quotidien, dateJour: meta.dateJour,
            tempsMs: total.tempsMs, touches: total.touches,
            gestes: total.gestes, indices: total.indices
        });
    }
    $('titre-fin').textContent = `${MONTEE.nom} bouclée`;
    $('fin-resume').textContent =
        `Du Fil au Dédale en ${formaterTemps(total.tempsMs)}, en touchant `
        + `${total.touches} sommets sur ${SOMMETS_EN_TOUT}.`;
    $('fin-courbe').textContent = courbeDeMontee(montee);
    $('fin-details').textContent = total.indices
        ? `${total.indices} indice${total.indices > 1 ? 's' : ''} : cette montée ne concourt pas au palmarès.`
        : `${libelleConfiguration(cleConfiguration(MONTEE.id, meta.variantes))} · six paliers · sans indice.`;
    $('bouton-suivante').textContent = 'Une autre montée';
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
    if (preferences.mode === MODE_MONTEE) { lancerMontee(graine, null); return; }
    montee = null;
    demarrer({
        mode: MODE_GRILLE,
        graine, niveau: preferences.niveau, dateJour: null, quotidien: false,
        variantes: variantesDepuis(preferences)
    });
}

// Une montée du jour se joue en version canonique, comme l’Écheveau du jour :
// personne ne compare six paliers épinglés à six paliers nus.
function lancerMontee(graine, dateJour) {
    montee = monteeNeuve(graine);
    demarrer({
        mode: MODE_MONTEE, graine, niveau: palierCourant(montee),
        dateJour, quotidien: Boolean(dateJour),
        variantes: dateJour ? variantesDepuis({}) : variantesDepuis(preferences)
    });
}

function partieDuJour() {
    const jour = dateLocale();
    history.replaceState(null, '', `?jour=${jour}`);
    montee = null;
    demarrer({
        mode: MODE_GRILLE,
        graine: jour, niveau: NIVEAU_QUOTIDIEN, dateJour: jour, quotidien: true,
        variantes: variantesDepuis({})
    });
}

function monteeDuJour() {
    const jour = dateLocale();
    history.replaceState(null, '', `?montee=${jour}`);
    lancerMontee(jour, jour);
}

function relancer() {
    // En montée, le temps déjà passé sur le palier revient dans le compteur :
    // `R` remet la grille à plat, pas l’horloge.
    const report = meta.mode === MODE_MONTEE ? tempsActuel() : 0;
    demarrer({ ...meta }, null, report);
    if (report > 0) lancerChrono();
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
    // Un palier franchi est versé dans la montée : le défaire rendrait un
    // temps déjà compté et laisserait le parcours d’un cran en avance.
    if (termine && meta.mode === MODE_MONTEE) { annoncer('Le palier est franchi.'); return; }
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
    // L’indice est un conseil local, pas un solveur : il arrive qu’aucun
    // sommet n’ait de meilleure place, sur un plateau encore emmêlé. Il rend
    // alors la main sans se consommer — la partie reste au palmarès.
    if (!conseil) {
        annoncer(termine || croisementsAffiches === 0
            ? 'Plus rien à dégager.'
            : 'Aucun sommet n’a de meilleure place : à vous de trouver le détour.');
        return;
    }
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

// Les deux défis du jour derrière un seul bouton : à cinq cibles de 44 px, la
// barre est déjà pleine sur un iPhone SE, et un sixième bouton y chasserait le
// titre. Le panneau se recalcule à chaque ouverture — la série a pu changer.
function ouvrirLesDefis() {
    rendreDefis(dateLocale(), chargerStatistiques());
    ouvrir($('dialogue-defis'));
}

function tournerLeMonde() {
    const actuel = themeAffiche(preferences.theme, dateLocale());
    preferences.theme = themeSuivant(actuel);
    enregistrerReglages();
    const monde = THEMES.find(theme => theme.id === preferences.theme);
    annoncer(`Monde : ${monde.nom}.`);
}

function partager() {
    const enMontee = meta.mode === MODE_MONTEE;
    const total = montee ? totalMontee(montee) : null;
    const acheve = enMontee ? Boolean(montee && estAchevee(montee)) : termine;
    const texte = messageDePartage({
        base: location.href, meta, termine: acheve, montee,
        tempsMs: enMontee ? total.tempsMs : tempsActuel(),
        touches: enMontee ? total.touches : etat.touches.length,
        indices: enMontee ? total.indices : etat.indices,
        courbe: courbe(etat)
    });
    copier(texte).then(reussi => annoncer(reussi ? 'Résultat copié.' : 'La copie a été refusée par le navigateur.'));
}

// ── Câblage ───────────────────────────────────────────────────────────────

function brancherInterface() {
    $('version').textContent = `Untangle ${VERSION}`;

    construireChoix($('choix-mode'), entreesModes(), mode => {
        preferences.mode = mode;
        enregistrerReglages();
        partieLibre();
    });
    construireChoix($('choix-niveau'), entreesNiveaux(), niveau => {
        preferences.niveau = niveau;
        // Choisir une taille, c’est vouloir cette grille-là : on quitte la
        // montée plutôt que d’ignorer le clic.
        preferences.mode = MODE_GRILLE;
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
    $('bouton-defi').addEventListener('click', ouvrirLesDefis);
    $('bouton-theme').addEventListener('click', tournerLeMonde);
    $('bouton-son').addEventListener('click', () => {
        preferences.sons = !preferences.sons;
        enregistrerReglages();
        annoncer(preferences.sons ? 'Son rétabli.' : 'Son coupé.');
    });

    $('bouton-defi-echeveau').addEventListener('click', () => { $('dialogue-defis').close(); partieDuJour(); });
    $('bouton-defi-montee').addEventListener('click', () => { $('dialogue-defis').close(); monteeDuJour(); });
    $('bouton-continuer').addEventListener('click', () => $('dialogue-palier').close());
    $('dialogue-palier').addEventListener('close', continuerLaMontee);
    $('bouton-annuler').addEventListener('click', annulerUnGeste);
    $('bouton-indice').addEventListener('click', demanderUnIndice);
    $('bouton-nouvelle').addEventListener('click', () => partieLibre());
    $('bouton-suivante').addEventListener('click', () => {
        $('dialogue-fin').close();
        // Une montée bouclée en rappelle une autre : le bouton relance le même
        // mode, pas la préférence d’avant.
        if (meta.mode === MODE_MONTEE) { lancerMontee(graineLibre(), null); return; }
        partieLibre();
    });
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

// Une sauvegarde d’avant la 1.2.0 n’a pas de champ `mode` : elle se relit
// comme une grille, ce qu’elle est. Rien à migrer.
const memesVariantes = (sauvegarde, demandee) =>
    VARIANTES_IDS.every(id => Boolean(sauvegarde.variantes?.[id]) === demandee.variantes[id]);

function partieDeDepart() {
    const demandee = lireParametres(location.search);
    const sauvegarde = chargerPartie();

    if (demandee?.mode === MODE_MONTEE) {
        const reprise = sauvegarde?.mode === MODE_MONTEE && sauvegarde.graine === demandee.graine
            && memesVariantes(sauvegarde, demandee)
            ? restaurerMontee(sauvegarde.montee) : null;
        montee = reprise && !estAchevee(reprise) ? reprise : monteeNeuve(demandee.graine);
        demarrer(demandee, reprise && sauvegarde.partie ? sauvegarde : null);
        return;
    }
    if (demandee) {
        montee = null;
        const memeGrille = sauvegarde && sauvegarde.mode !== MODE_MONTEE
            && sauvegarde.graine === demandee.graine
            && sauvegarde.niveau === demandee.niveau
            && memesVariantes(sauvegarde, demandee);
        demarrer(demandee, memeGrille ? sauvegarde : null);
        return;
    }

    // Une montée interrompue se reprend au palier où elle en était, avec le
    // temps déjà couru : fermer l’onglet ne coûte rien, pas même un parcours.
    if (sauvegarde?.mode === MODE_MONTEE) {
        const reprise = restaurerMontee(sauvegarde.montee);
        if (reprise && !estAchevee(reprise)) {
            montee = reprise;
            demarrer({
                mode: MODE_MONTEE, graine: montee.graine, niveau: palierCourant(montee),
                dateJour: sauvegarde.dateJour || null,
                quotidien: Boolean(sauvegarde.quotidien) && sauvegarde.dateJour === dateLocale(),
                variantes: variantesDepuis(sauvegarde.variantes || {})
            }, sauvegarde.partie ? sauvegarde : null);
            return;
        }
    }

    montee = null;
    if (sauvegarde && sauvegarde.graine && sauvegarde.mode !== MODE_MONTEE) {
        demarrer({
            mode: MODE_GRILLE,
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
        temps: tempsAffiche(),
        termine
    });
    sauvegarder();
}, 500);

if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { /* hors ligne plus tard */ }));
}
