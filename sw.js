/* ============================ Kreeda — service worker ============================
   The manifest promises an installable, offline-capable app. Without this file that
   promise is a lie: a browser can add the icon to the home screen but the "app" is
   just a bookmark that 404s the moment the network drops. This file is what makes
   the install real.

   These are twenty self-contained games with no build step — a deploy replaces the
   whole tree at once, nothing here ever changes in place. Freshness works in two
   tiers:

   - Page loads (navigations) go NETWORK-FIRST: the network copy wins whenever it
     answers, and the cache is only the offline fallback. A deploy therefore shows
     up on the very next reload — no cache bump, no "clear site data". The cost is
     one round-trip per page load, which these hand-sized HTML files can afford.
   - Everything else (icons, analytics.js, the manifest) answers from cache
     instantly and re-fetches in the background, so an asset is never more than one
     load behind.

   CACHE versioning remains as the deep clean: bump it and the new worker's
   activate wipes every cache that isn't the current name, evicting entries for
   anything renamed or deleted. It is no longer the only way a fix reaches players
   — that is what network-first pages are for — but forget the wipe in activate and
   dead entries accumulate forever, so it stays.
*/

const CACHE = 'kreeda-v9';

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
  '/ennead/index.html',
  '/dasanana/index.html',
  '/valence/index.html',
  '/quanta/index.html',
  '/radian/index.html',
  '/sync/index.html',
  '/windows/index.html',
  '/auction/index.html',
  '/fathom/index.html',
  '/split/index.html',
  '/garage/index.html',
  '/apogee/index.html'
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

  // Page loads: network first, so what renders is always the deployed build when
  // there is any network at all. The successful response also refreshes the cached
  // copy, so the offline fallback below is the newest build ever seen, not the one
  // from install time.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function(res){
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(req, copy); }).catch(function(){});
        }
        return res;
      }).catch(function(){
        // Offline. The browser's own offline interstitial is a dead end with no way
        // back into the app — the cached page (or at worst the cached landing page)
        // keeps the install usable.
        return caches.match(req).then(function(cached){
          return cached || caches.match('/');
        });
      })
    );
    return;
  }

  // Everything else: the cached copy answers instantly, and the same request is
  // re-fetched in the background to refresh the cache for next time — an asset is
  // stale for at most one load, without a page ever waiting on the network for it.
  event.respondWith(
    caches.match(req).then(function(cached){
      var refreshed = fetch(req).then(function(res){
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function(cache){ cache.put(req, copy); }).catch(function(){});
        }
        return res;
      }).catch(function(){ return cached; });
      return cached || refreshed;
    })
  );
});
