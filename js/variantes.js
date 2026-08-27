// Les variantes, en un seul endroit. Le moteur lit `cercle` et `epingles` au
// moment de fabriquer l’écheveau et ne sait rien d’autre ; `aveugle` ne
// concerne que l’affichage. Les axes sont indépendants : les trois se
// combinent librement, et chaque combinaison a son propre palmarès.

export const VARIANTES = [
    {
        id: 'epingles',
        nom: 'Sommets épinglés',
        court: 'épinglé',
        resume: 'Un à trois sommets sont posés d’avance à leur place et refusent de bouger.'
    },
    {
        id: 'cercle',
        nom: 'Départ en cercle',
        court: 'en cercle',
        resume: 'Tous les sommets commencent posés sur un cercle, comme un diagramme de cordes.'
    },
    {
        id: 'aveugle',
        nom: 'À l’aveugle',
        court: 'à l’aveugle',
        resume: 'Les fils fautifs ne sont plus signalés : seul le compteur de croisements reste.'
    }
];

export const IDS = VARIANTES.map(variante => variante.id);

export function variantesDepuis(source = {}) {
    return Object.fromEntries(IDS.map(id => [id, Boolean(source[id])]));
}

export function resumeVariantes(variantes = {}) {
    const actives = VARIANTES.filter(variante => variantes[variante.id]);
    return actives.length ? actives.map(variante => variante.court).join(', ') : '';
}
