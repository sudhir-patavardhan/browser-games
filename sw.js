/* ============================ Kreeda — service worker ============================
   The manifest promises an installable, offline-capable app. Without this file that
   promise is a lie: a browser can add the icon to the home screen but the "app" is
   just a bookmark that 404s the moment the network drops. This file is what makes
   the install real.

   These are thirteen self-contained games with no build step — a deploy replaces the
   whole tree at once, nothing here ever changes in place. That means there is no
   value in revalidating against the network on every visit; the entire correctness
   model is CACHE VERSIONING. Bump CACHE, the browser installs a new worker, the new
   worker's activate wipes every cache that isn't the current name, and every client
   is on the new build on next load. Forget to bump it and ship a fix, or forget the
   wipe in activate, and players are stuck replaying the old build forever with no
   way to know why — that is the one failure mode this file cannot afford.
*/

const CACHE = 'kreeda-v2';

/* The whole app shell, spelled out by hand rather than discovered at runtime — a
   service worker has no directory listing to crawl, so this list IS the offline
   surface. Sourced from the `data-game` cards on the root page plus the handful of
   files every page depends on. Touch a game's path here if it ever moves. */
const PRECACHE_URLS = [
  '/',
  '/analytics.js',
  '/manifest.webmanifest',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png',
  '/drift/index.html',
  '/carrom/index.html',
  '/break-room/index.html',
  '/chroma-blocks/index.html',
  '/blackjack/index.html',
  '/last-16/index.html',
  '/road-rumble/index.html',
  '/fairway-four/index.html',
  '/deadpoint/index.html',
  '/ennead/index.html',
  '/dasanana/index.html',
  '/setu/index.html',
  '/maidan/index.html'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE).then(function(cache){
      /* cache.addAll() is all-or-nothing — one bad path (a typo, a game renamed
         mid-edit by someone else's PR) fails the whole batch and the worker never
         installs, which means it never activates, which means the site is
         permanently uninstallable until someone notices. Adding one at a time and
         swallowing individual failures means a single missing file just isn't
         offline-available; it doesn't take the rest of the list down with it. */
      return Promise.all(PRECACHE_URLS.map(function(url){
        return cache.add(url).catch(function(){});
      }));
    }).then(function(){
      return self.skipWaiting(); // new build takes over without waiting on old tabs to close
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      // delete anything that isn't this exact build's cache — this is the whole
      // point of versioning the name; skip it and old builds accumulate forever
      // and a stale cache entry can outlive the code that would have fixed it.
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){
        return caches.delete(k);
      }));
    }).then(function(){
      return self.clients.claim(); // start controlling already-open tabs immediately
    })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return; // never intercept POSTs etc.; let them hit the network untouched

  var url = new URL(req.url);
  // Cross-origin traffic (GA's gtag.js, Fairway Four's Three.js off cdnjs) must never
  // be answered from here — this worker has no version story for someone else's
  // asset, and caching a third party is how you end up serving a broken CDN response
  // forever. Leaving the event unhandled lets the browser do its normal thing.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(function(cached){
      if (cached) return cached; // cache-first: a hit is authoritative, no revalidation
      return fetch(req).catch(function(){
        // Offline and not in the precached shell. For a page load specifically, the
        // browser's own offline interstitial is a dead end with no way back into the
        // app — the cached landing page at least leaves the install usable.
        if (req.mode === 'navigate') return caches.match('/');
      });
    })
  );
});
