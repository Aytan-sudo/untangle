// Synthèse WebAudio : pas un octet d’audio dans le dépôt. Sept timbres très
// courts, très bas en volume — démêler est une affaire de patience, le son
// accompagne le geste sans le commenter.
//
// Tout vit au-dessus de 300 Hz. Un haut-parleur de téléphone ne restitue à peu
// près rien en dessous, et l’oreille y est de surcroît bien moins sensible à
// faible volume : une note écrite plus bas ne lève aucune erreur, elle part
// simplement sans arriver. Le jeu se voulant mobile d’abord, c’est un défaut
// et pas un réglage — `tests/test-son.mjs` garde le plancher.

let contexte;

function audio() {
    if (contexte) return contexte;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioContext) contexte = new AudioContext();
    return contexte;
}

function note(frequence, { duree = 0.07, volume = 0.028, delai = 0, vers = null, forme = 'triangle' } = {}) {
    const moteur = audio();
    if (!moteur) return;
    if (moteur.state === 'suspended') moteur.resume?.();

    const debut = moteur.currentTime + delai;
    const oscillateur = moteur.createOscillator();
    const gain = moteur.createGain();

    oscillateur.type = forme;
    oscillateur.frequency.setValueAtTime(frequence, debut);
    if (vers) oscillateur.frequency.exponentialRampToValueAtTime(vers, debut + duree);

    gain.gain.setValueAtTime(0.0001, debut);
    gain.gain.exponentialRampToValueAtTime(volume, debut + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

    oscillateur.connect(gain).connect(moteur.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
}

// Le sommet qu’on saisit : presque rien, juste la confirmation que le doigt a
// bien accroché.
export const sonPrise = () => note(560, { duree: 0.035, volume: 0.015 });

// Le sommet qu’on repose sans que rien ne change.
export const sonPose = () => note(392, { duree: 0.06, volume: 0.022 });

// La dépose qui dénoue : la note monte, autant de fois qu’il faut le dire.
export const sonDegage = () => note(440, { duree: 0.11, vers: 660, forme: 'sine' });

// Celle qui embrouille davantage : le même mouvement à l’envers, deux fois
// plus discret — on signale, on ne sermonne pas.
export const sonEmmele = () => note(500, { duree: 0.09, volume: 0.014, vers: 340, forme: 'sine' });

// Le refus — un sommet épinglé, un geste impossible. Il dit non par la chute,
// pas par la profondeur : une note grave n’existerait pas sur un téléphone.
export const sonRefus = () => note(420, { duree: 0.09, volume: 0.024, vers: 315, forme: 'sine' });

// L’indice : deux notes qui désignent, comme un doigt tendu.
export function sonIndice() {
    note(660, { duree: 0.06, volume: 0.02 });
    note(880, { duree: 0.08, volume: 0.02, delai: 0.07 });
}

// La seule fanfare : le fil est tendu, l’écheveau est mort.
export function sonVictoire() {
    [392, 523, 659, 784].forEach((frequence, rang) => note(frequence, { duree: 0.2, delai: rang * 0.09 }));
}

// Le déblocage au geste.
//
// iOS ne laisse démarrer un contexte audio que depuis un événement
// d’activation : `pointerdown`, `touchstart`, `pointerup`, `touchend`,
// `keydown`, `click`. Ce jeu est exactement celui que le piège guette : tout se
// décide en glissant, et `pointermove` n’est pas une activation. Un contexte
// né là resterait suspendu pour toujours et la partie serait muette au doigt,
// sans lever la moindre erreur ni se voir depuis un ordinateur. Le contexte se
// prépare donc dès le poser, avant que le jeu n’ait une note à demander.
// `autorise` évite d’ouvrir un contexte audio chez qui a coupé le son.
const ACTIVATIONS = ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'keydown', 'click'];

export function preparerSon(cible, autorise = () => true) {
    const reveiller = () => {
        if (!autorise()) return;
        const moteur = audio();
        if (moteur && moteur.state !== 'running') moteur.resume?.();
    };
    for (const activation of ACTIVATIONS) {
        cible.addEventListener(activation, reveiller, { capture: true, passive: true });
    }
}

// Un jeu ne chante pas dans le dos de qui est parti lire ailleurs.
export function surveillerVisibilite(document) {
    document.addEventListener('visibilitychange', () => {
        if (!contexte) return;
        if (document.hidden) contexte.suspend?.();
        else contexte.resume?.();
    });
}
