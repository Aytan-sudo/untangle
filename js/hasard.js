// L’unique générateur pseudo-aléatoire du jeu : déterministe et sérialisable.
// Même graine, même écheveau — c’est ce qui rend possibles le défi du jour et
// le partage d’une partie libre sans qu’aucun serveur n’ait rien à dire.

export function hacher(texte) {
    let valeur = 2166136261;
    for (const caractere of String(texte)) {
        valeur ^= caractere.codePointAt(0);
        valeur = Math.imul(valeur, 16777619);
    }
    valeur ^= valeur >>> 16;
    valeur = Math.imul(valeur, 0x21f0aaad);
    valeur ^= valeur >>> 15;
    valeur = Math.imul(valeur, 0x735a2d97);
    return (valeur ^ (valeur >>> 15)) >>> 0;
}

export class Alea {
    constructor(graine) {
        this.etat = hacher(graine) || 0x6d2b79f5;
    }

    suivant() {
        let t = this.etat += 0x6d2b79f5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    entier(maximum) { return Math.floor(this.suivant() * maximum); }
    chance(probabilite) { return this.suivant() < probabilite; }
    choix(liste) { return liste[this.entier(liste.length)]; }

    entre(minimum, maximum) {
        return minimum + (maximum - minimum) * this.suivant();
    }

    melanger(liste) {
        const copie = [...liste];
        for (let i = copie.length - 1; i > 0; i--) {
            const j = this.entier(i + 1);
            [copie[i], copie[j]] = [copie[j], copie[i]];
        }
        return copie;
    }
}

export function graineLibre() {
    try {
        const nombres = new Uint32Array(2);
        globalThis.crypto.getRandomValues(nombres);
        return `${nombres[0].toString(36)}${nombres[1].toString(36)}`;
    } catch {
        return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
    }
}
