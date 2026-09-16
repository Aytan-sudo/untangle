// Les vérifications structurelles : celles qui attrapent les fautes ne levant
// aucune erreur. Un fichier absent du service worker, un identifiant renommé
// d’un seul côté, une variable de palette oubliée dans un seul monde, une
// version qui ne concorde plus — rien de tout ça ne plante, tout se voit en
// jouant, trop tard.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compteur } from './harness.mjs';
import { NIVEAU_QUOTIDIEN, VERSION } from '../js/config.js';
import { dateLocale } from '../js/defi.js';
import { NIVEAUX } from '../js/generateur.js';
import { THEMES, themeAffiche, themeDuJour } from '../js/themes.js';
import { IDS as VARIANTES_IDS } from '../js/variantes.js';

const { check, egal, rapport } = compteur();
console.log('\nPage, interface et PWA\n');

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = chemin => readFileSync(join(racine, chemin), 'utf8');
const page = lire('index.html');
const worker = lire('sw.js');
const paquet = JSON.parse(lire('package.json'));
const manifeste = JSON.parse(lire('manifest.webmanifest'));
const styles = ['themes', 'plateau', 'interface'].map(nom => lire(`css/${nom}.css`)).join('\n');
const modules = readdirSync(join(racine, 'js')).filter(nom => nom.endsWith('.js'));
const code = modules.map(nom => lire(`js/${nom}`)).join('\n');

// ── 1. Le service worker liste tout ce que le jeu télécharge ──────────────
const coquille = [...worker.matchAll(/^\s+'([^']+)',?$/gm)].map(([, chemin]) => chemin);
const attendus = [
    ...modules.map(nom => `js/${nom}`),
    ...readdirSync(join(racine, 'css')).map(nom => `css/${nom}`),
    ...readdirSync(join(racine, 'assets')).map(nom => `assets/${nom}`)
];
const oublies = attendus.filter(chemin => !coquille.includes(chemin));
check('le service worker met en cache chaque fichier du jeu', oublies.length === 0, oublies.join(' '));
const fantomes = coquille.filter(chemin => chemin !== './' && !existsSync(join(racine, chemin)));
check('le service worker ne met en cache aucun fichier fantôme', fantomes.length === 0, fantomes.join(' '));

// Un module que personne n’importe dort dans le dossier sans que rien ne le
// dise : on remonte le graphe des imports depuis app.js.
function modulesCharges(depart) {
    const vus = new Set();
    const suite = [depart];
    while (suite.length) {
        const nom = suite.pop();
        if (vus.has(nom)) continue;
        vus.add(nom);
        for (const [, cible] of lire(`js/${nom}`).matchAll(/from\s+'\.\/([\w-]+\.js)'/g)) suite.push(cible);
    }
    return vus;
}
const charges = modulesCharges('app.js');
const dormants = modules.filter(nom => !charges.has(nom));
check('tous les modules sont réellement chargés par la page', dormants.length === 0, dormants.join(' '));

// ── 2. Chaque identifiant cherché par le code existe dans la page ─────────
const ids = [...new Set([...code.matchAll(/\$\('([\w-]+)'\)/g)].map(([, id]) => id))];
const introuvables = ids.filter(id => !page.includes(`id="${id}"`));
check('tous les éléments cherchés par le code existent', introuvables.length === 0, introuvables.join(' '));
check('des identifiants ont bien été relevés', ids.length > 20, String(ids.length));

// ── 3. Les quatre mondes définissent la même palette ──────────────────────
const blocs = [...lire('css/themes.css').matchAll(/\[data-theme="([a-z]+)"\]\s*\{([^}]*)\}/g)]
    .map(([, id, corps]) => [id, new Set([...corps.matchAll(/(--[a-z-]+)\s*:/g)].map(([, nom]) => nom))]);
egal('chaque monde de themes.js a son bloc CSS', blocs.map(([id]) => id).sort(), THEMES.map(theme => theme.id).sort());
// La barre du navigateur doit porter l’accent du monde affiché. Deux valeurs
// voisines ne lèvent rien : elles font juste une barre système qui jure.
const accents = Object.fromEntries([...lire('css/themes.css')
    .matchAll(/\[data-theme="([a-z]+)"\]\s*\{[^}]*--accent:\s*(#[0-9a-f]{6})/g)]
    .map(([, id, couleur]) => [id, couleur]));
const discordantes = THEMES.filter(theme => accents[theme.id] !== theme.couleur.toLowerCase());
check('la couleur de barre de chaque monde est son accent CSS', discordantes.length === 0,
    discordantes.map(theme => `${theme.id}: ${theme.couleur} ≠ ${accents[theme.id]}`).join(' | '));
check('la page et le manifeste partent sur l’accent du premier monde',
    page.includes(`content="${THEMES[0].couleur}" id="couleur-barre"`)
    && manifeste.theme_color === THEMES[0].couleur);

const reference = blocs[0][1];
check('la palette de référence est fournie', reference.size >= 25, String(reference.size));
const incompletes = blocs
    .map(([id, jeu]) => [id, [...reference].filter(variable => !jeu.has(variable))])
    .filter(([, manquantes]) => manquantes.length);
check('aucun monde n’oublie une variable de palette',
    incompletes.length === 0, incompletes.map(([id, manquantes]) => `${id}: ${manquantes.join(' ')}`).join(' | '));

// ── 4. La version concorde aux trois endroits ─────────────────────────────
check('la version du paquet et celle du code concordent', paquet.version === VERSION, `${paquet.version} / ${VERSION}`);
check('le cache du service worker porte la version', worker.includes(`const VERSION = 'untangle-${VERSION}'`));
check('la page affiche la version', page.includes(`Untangle ${VERSION}`));
check('la version affichée est relue depuis le code chargé',
    lire('js/app.js').includes('$(\'version\').textContent = `Untangle ${VERSION}`'));

// ── 5. La syntaxe de chaque module est vérifiée par npm run check ─────────
const controles = [...paquet.scripts.check.matchAll(/js\/([\w-]+\.js)/g)].map(([, nom]) => nom);
const nonControles = modules.filter(nom => !controles.includes(nom));
check('npm run check passe sur chaque module', nonControles.length === 0, nonControles.join(' '));
// Une suite que `npm test` n’appelle pas ne protège rien, et rien ne le
// signale : le fichier dort dans le dossier, vert par absence.
const suites = readdirSync(join(racine, 'tests')).filter(nom => nom.startsWith('test-'));
const nonLancees = suites.filter(nom => !paquet.scripts.test.includes(`tests/${nom}`));
check('npm test lance chaque suite', nonLancees.length === 0, nonLancees.join(' '));

// ── Le script de restauration du monde ────────────────────────────────────
// Il ne peut rien importer : il répète la formule de `themeDuJour`. Rien
// n’empêcherait les deux de diverger — sauf de faire tourner le vrai script.
const inline = page.match(/<script>([\s\S]*?)<\/script>/)[1];
function restaurer(stocke) {
    const racineFausse = { dataset: { theme: 'cordage' } };
    const faussetteDocument = { documentElement: racineFausse };
    const faussetteStockage = { getItem: () => stocke };
    new Function('localStorage', 'document', inline)(faussetteStockage, faussetteDocument);
    return racineFausse.dataset.theme;
}
const enveloppe = valeur => JSON.stringify({ schema: 1, donnees: { theme: valeur } });
egal('sans préférence, le script pose le monde du jour', restaurer(null), themeDuJour(dateLocale()));
egal('« du jour » suit la date', restaurer(enveloppe('auto')), themeAffiche('auto', dateLocale()));
for (const theme of THEMES) {
    egal(`une préférence « ${theme.nom} » est respectée`, restaurer(enveloppe(theme.id)), theme.id);
}
egal('un thème disparu retombe sur le monde du jour', restaurer(enveloppe('sashiko')), themeDuJour(dateLocale()));
egal('un stockage illisible ne casse rien', restaurer('{ pas du JSON'), 'cordage');
egal('un schéma inconnu retombe sur le monde du jour',
    restaurer(JSON.stringify({ schema: 42, donnees: { theme: 'circuit' } })), themeDuJour(dateLocale()));
check('le script est dans le <head>, avant le premier rendu',
    page.indexOf('<script>') < page.indexOf('</head>'));
// Avec un passeport, les réglages lus sont ceux du joueur ; sans, ceux de
// l'appareil. Le script ci-dessus tourne avec un faux `localStorage` et sans
// `Passeport` : c'est le chemin du mode invité qu'il vérifie.
check('le script d’amorce passe par l’espace du joueur quand il y en a un',
    page.includes("Passeport.stockageJeu('untangle')")
    && page.includes("getItem('untangle.preferences')"));

// ── Le passeport ──────────────────────────────────────────────────────────
// Sans `data-jeu`, le bandeau s'affiche mais aucun tampon n'est attribué ;
// sans les fichiers dans la coquille, la page hors ligne perd l'espace du
// joueur.
check('la page porte le bandeau du passeport',
    page.includes('data-passeport-ruban data-jeu="untangle"'));
check('le module commun est chargé et mis en cache',
    ['passeport.js', 'liaison.js', 'passeport.css'].every(nom =>
        page.includes(`commun/${nom}`) && coquille.includes(`commun/${nom}`)));

// ── Niveaux, variantes et défi du jour ────────────────────────────────────
check('le défi du jour vise un niveau qui existe', Boolean(NIVEAUX[NIVEAU_QUOTIDIEN]));
check('les niveaux alimentent un sélecteur fabriqué depuis le code',
    page.includes('id="choix-niveau"') && lire('js/app.js').includes('entreesNiveaux()'));
const sansCase = VARIANTES_IDS.filter(id => !page.includes(`id="option-${id}"`));
check('chaque variante a sa case dans les Options', sansCase.length === 0, sansCase.join(' '));
check('les Options portent bien ce nom', page.includes('>Options</h2>') && !/>R[ée]glages</.test(page));
// Cinq boutons pour une grille de quatre laissaient le dernier monde seul sur
// sa ligne. « Du jour » n’est pas un monde de plus : c’est une façon d’en
// choisir un, donc une case à cocher.
const { entreesNiveaux, entreesThemes } = await import('../js/ui.js');
egal('les boutons de monde sont exactement les quatre mondes',
    entreesThemes().map(entree => entree.id), THEMES.map(theme => theme.id));
check('« du jour » est une case, pas un cinquième bouton',
    page.includes('id="option-theme-du-jour"') && lire('js/app.js').includes('THEME_AUTOMATIQUE'));
check('les quatre mondes se rangent en grille',
    page.includes('choix--grille') && /\.choix--grille\s*\{[^}]*grid-template-columns/.test(styles));
// Le nombre de sommets est la seule chose qui distingue vraiment deux
// niveaux : il est écrit sur le bouton.
check('chaque bouton de niveau annonce sa taille',
    Object.values(NIVEAUX).every(niveau => entreesNiveaux()
        .some(entree => entree.id === niveau.id && entree.nom.includes(String(niveau.sommets)))));
// La limite a bougé en 1.2.0 — les joueurs trouvaient quatre modes trop peu —
// mais elle existe toujours : les trente-quatre sommets de la 1.0.0 restent
// une erreur d’échelle, et rien ne doit pouvoir y ramener par inadvertance.
check('aucun niveau ne dépasse la treizaine de sommets',
    Object.values(NIVEAUX).every(niveau => niveau.sommets >= 4 && niveau.sommets <= 13),
    Object.values(NIVEAUX).map(niveau => niveau.sommets).join(' '));

// ── Mobile d’abord ────────────────────────────────────────────────────────
check('le viewport verrouille le zoom tactile',
    page.includes('user-scalable=no') && page.includes('viewport-fit=cover'));
check('les boutons ne répondent pas au double-tap', styles.includes('touch-action: manipulation'));
check('le plateau capte les gestes directs',
    styles.includes('#plateau') && styles.includes('touch-action: none'));
check('mobile, paysage et mouvement réduit sont traités',
    styles.includes('safe-area-inset-top') && styles.includes('@media (orientation: landscape)')
    && styles.includes('prefers-reduced-motion'));
// Cacher, c’est une règle CSS, et une règle CSS se laisse écraser.
check('aucune règle d’auteur ne peut réafficher un élément caché',
    /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(styles));
check('les cibles tactiles sont assez grandes',
    /\.outil\s*\{[^}]*min-height:\s*(4[4-9]|[5-9]\d)px/.test(styles) && /\.icones button\s*\{[^}]*height:\s*(4[4-9]|[5-9]\d)px/.test(styles));

// ── Couleurs : themes.css est la seule source ─────────────────────────────
const horsThemes = [lire('css/plateau.css'), lire('css/interface.css')].join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
const teintes = [...horsThemes.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(([teinte]) => teinte);
check('aucune couleur en dur hors de themes.css', teintes.length === 0, teintes.join(' '));
const teintesJs = [...code.replace(/\/\/[^\n]*/g, '').matchAll(/#[0-9a-f]{6}\b/gi)].map(([teinte]) => teinte);
check('le JavaScript ne garde pas de copie des couleurs',
    teintesJs.every(teinte => THEMES.some(theme => theme.couleur.toLowerCase() === teinte.toLowerCase())),
    teintesJs.join(' '));

// ── PWA ───────────────────────────────────────────────────────────────────
check('le manifeste est complet',
    manifeste.name === 'Untangle' && manifeste.lang === 'fr' && manifeste.display === 'standalone'
    && manifeste.start_url === './' && manifeste.icons.length === 4
    && manifeste.icons.every(icone => existsSync(join(racine, icone.src))));
check('l’icône apple-touch est déclarée, et en PNG',
    page.includes('rel="apple-touch-icon" href="assets/icon-180.png"'));
check('le service worker est enregistré', lire('js/app.js').includes("navigator.serviceWorker.register('./sw.js')"));
// Une partie chronométrée se met en pause quand l’onglet passe à
// l’arrière-plan — et le chrono doit repartir au retour, sinon le temps
// affiché reste figé jusqu’au geste suivant et le résultat est faux.
const application = lire('js/app.js');
check('le chrono se met en pause en arrière-plan et repart au retour',
    /if \(document\.hidden\) \{ arreterChrono\(\)/.test(application)
    && /else if \(aCommence && !termine\) lancerChrono\(\)/.test(application));
// « À l’aveugle » est une propriété de la partie, pas une préférence
// d’affichage : le relire depuis les préférences rendrait aveugle un défi du
// jour, qui se joue toujours en version canonique.
check('l’aveuglement suit la partie en cours, pas les préférences',
    /dataset\.aveugle = meta\.variantes\.aveugle/.test(application)
    && !/dataset\.aveugle = preferences\.aveugle/.test(application));
check('le chrono ne tourne pas dans un onglet caché',
    /function lancerChrono[\s\S]{0,200}document\.hidden\) return/.test(application));
check('le déploiement attend les tests', lire('.github/workflows/pages.yml').includes('needs: tester'));
check('la CI lance les tests à chaque poussée', lire('.github/workflows/tests.yml').includes('npm test'));
check('Jekyll est neutralisé', existsSync(join(racine, '.nojekyll')));

// ── Accessibilité ─────────────────────────────────────────────────────────
check('le plateau s’annonce et se met au clavier',
    page.includes('id="plateau"') && page.includes('tabindex="0"') && page.includes('role="application"')
    && page.includes('aria-label="Écheveau à démêler'));
check('les boutons de la barre sont nommés',
    [...page.matchAll(/<button[^>]*id="bouton-(aide|defi|theme|son|options)"[^>]*>/g)]
        .every(([balise]) => balise.includes('aria-label')));
check('les annonces passent par une région vivante', page.includes('role="status"') && page.includes('aria-live="polite"'));
check('la couleur n’est jamais seule à porter l’information',
    styles.includes('[data-signes="oui"]') && page.includes('id="option-signes"'));
check('l’aide décrit le pilotage au clavier', page.includes('<h3>Au clavier</h3>'));

// ── Le dernier filet : la syntaxe, pour de vrai ───────────────────────────
try {
    execFileSync('npm', ['run', '--silent', 'check'], { cwd: racine, stdio: 'pipe' });
    check('node --check passe sur tous les modules', true);
} catch (erreur) {
    check('node --check passe sur tous les modules', false, String(erreur.stderr || erreur));
}

rapport();
