// Réseau d’abord, cache en secours : une mise à jour publiée arrive sans
// manœuvre du joueur, et le cache prend le relais hors ligne.
//
// Le cache-first serait plus rapide, mais tous les jeux du dossier servent sur
// localhost : ils y partagent une origine, donc une portée de service worker
// et des caches. Un jeu cache-first y sert alors ses propres fichiers aux
// autres — le préfixe des clés protège les données, rien ne protège les
// fichiers.
const VERSION = 'untangle-0.1.0';
const COQUILLE = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/themes.css',
    'css/plateau.css',
    'css/interface.css',
    'js/app.js',
    'js/config.js',
    'js/defi.js',
    'js/entree.js',
    'js/generateur.js',
    'js/graphe.js',
    'js/hasard.js',
    'js/partie.js',
    'js/rendu.js',
    'js/son.js',
    'js/stockage.js',
    'js/themes.js',
    'js/ui.js',
    'js/variantes.js',
    'assets/icon.svg',
    'assets/icon-180.png',
    'assets/icon-192.png',
    'assets/icon-512.png'
];

self.addEventListener('install', evenement => {
    evenement.waitUntil(caches.open(VERSION).then(cache => cache.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', evenement => {
    evenement.waitUntil(
        caches.keys()
            .then(cles => Promise.all(cles.filter(cle => cle !== VERSION).map(cle => caches.delete(cle))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', evenement => {
    if (evenement.request.method !== 'GET') return;
    evenement.respondWith(
        fetch(evenement.request)
            .then(reponse => {
                if (reponse.ok && new URL(evenement.request.url).origin === location.origin) {
                    const copie = reponse.clone();
                    caches.open(VERSION).then(cache => cache.put(evenement.request, copie));
                }
                return reponse;
            })
            .catch(() => caches.match(evenement.request).then(reponse => reponse || caches.match('./')))
    );
});
