// Le doigt, la souris, le clavier. Ce module ne connaît ni les règles ni le
// dessin : il traduit des gestes en intentions et appelle les actions qu’on
// lui a confiées.

// Le sommet tiré remonte au-dessus du doigt, relié par une laisse. Sans ce
// décalage, la main couvre exactement ce qu’on essaie de placer — et sur un
// jeu qui se joue au micro-ajustement, c’est rédhibitoire. À la souris, le
// curseur ne cache rien : pas de décalage.
export const DECALAGE_DOIGT = 150;
export const RAYON_SAISIE_DOIGT = 110;
export const RAYON_SAISIE_SOURIS = 75;

// En deçà, le doigt n’a pas voulu déplacer quoi que ce soit : c’est un
// tapotement, le sommet retourne d’où il vient et rien n’est compté.
export const SEUIL_GESTE = 20;

export const decalagePour = type => (type === 'mouse' ? 0 : DECALAGE_DOIGT);

const DIRECTIONS = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }
};

export function brancherPointeur(svg, actions) {
    let saisi = null;

    const cible = point => ({ x: point.x, y: point.y - saisi.decalage });

    svg.addEventListener('pointerdown', evenement => {
        if (saisi) return;
        const point = actions.coordonnees(evenement.clientX, evenement.clientY);
        const rayon = evenement.pointerType === 'mouse' ? RAYON_SAISIE_SOURIS : RAYON_SAISIE_DOIGT;
        const index = actions.viser(point, rayon);
        if (index < 0) return;
        evenement.preventDefault();
        if (!actions.peutPrendre(index)) { actions.refuser(index); return; }
        try { svg.setPointerCapture(evenement.pointerId); } catch { /* souris hors capture */ }
        saisi = {
            index,
            pointeur: evenement.pointerId,
            decalage: decalagePour(evenement.pointerType),
            doigtDepart: point,
            origine: actions.positionDe(index),
            bouge: false
        };
        svg.classList.add('tire');
        actions.prendre(index);
        actions.glisser(index, cible(point), point);
    });

    svg.addEventListener('pointermove', evenement => {
        if (!saisi || evenement.pointerId !== saisi.pointeur) return;
        evenement.preventDefault();
        const point = actions.coordonnees(evenement.clientX, evenement.clientY);
        if (Math.hypot(point.x - saisi.doigtDepart.x, point.y - saisi.doigtDepart.y) > SEUIL_GESTE) {
            saisi.bouge = true;
        }
        actions.glisser(saisi.index, cible(point), point);
    });

    const relacher = evenement => {
        if (!saisi || evenement.pointerId !== saisi.pointeur) return;
        const point = actions.coordonnees(evenement.clientX, evenement.clientY);
        const { index, bouge, origine } = saisi;
        saisi = null;
        svg.classList.remove('tire');
        if (bouge) actions.poser(index, { x: point.x, y: point.y - decalagePour(evenement.pointerType) });
        else actions.abandonner(index, origine);
    };

    svg.addEventListener('pointerup', relacher);
    svg.addEventListener('pointercancel', evenement => {
        if (!saisi || evenement.pointerId !== saisi.pointeur) return;
        const { index, origine } = saisi;
        saisi = null;
        svg.classList.remove('tire');
        actions.abandonner(index, origine);
    });
}

// Au clavier, les flèches font deux choses selon qu’un sommet est en main ou
// non : viser le voisin de ce côté, ou déplacer ce qu’on tient. Une tabulation
// par sommet marcherait à cette taille, mais viser le voisin « à gauche » dit
// quelque chose du dessin, là où « le suivant dans l’ordre du document » ne
// dit rien.
export function brancherClavier(svg, actions) {
    let enMain = -1;
    let origine = null;

    svg.addEventListener('keydown', evenement => {
        const direction = DIRECTIONS[evenement.key];
        if (direction) {
            evenement.preventDefault();
            if (enMain >= 0) {
                const pas = actions.pasClavier(evenement.shiftKey);
                const point = actions.positionDe(enMain);
                actions.glisser(enMain, { x: point.x + direction.x * pas, y: point.y + direction.y * pas });
            } else {
                const vise = actions.viserDansLaDirection(direction);
                if (vise >= 0) actions.viserSommet(vise);
            }
            return;
        }

        if (evenement.key === 'Enter' || evenement.key === ' ' || evenement.key === 'Spacebar') {
            evenement.preventDefault();
            if (enMain >= 0) {
                const point = actions.positionDe(enMain);
                actions.poser(enMain, point, origine);
                enMain = -1;
                origine = null;
                return;
            }
            const vise = actions.sommetVise();
            if (vise < 0) return;
            if (!actions.peutPrendre(vise)) { actions.refuser(vise); return; }
            enMain = vise;
            origine = actions.positionDe(vise);
            actions.prendre(vise);
            return;
        }

        if (evenement.key === 'Escape' && enMain >= 0) {
            evenement.preventDefault();
            evenement.stopPropagation();
            actions.abandonner(enMain, origine);
            enMain = -1;
            origine = null;
        }
    });

    svg.addEventListener('blur', () => {
        if (enMain < 0) return;
        actions.abandonner(enMain, origine);
        enMain = -1;
        origine = null;
    });
}
