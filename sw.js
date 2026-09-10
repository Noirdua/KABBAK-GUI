/* sw.js — KABBAK static-asset cache service worker.
 * - HTML/navigation: NETWORK-FIRST (updates always show), cache only as an
 *   offline fallback.
 * - Versioned static assets (js/css/fonts/images with ?v= busters): cache-first
 *   so browsers that disable HTTP caching don't redownload on every visit.
 * Precache is triggered manually from Profile > App Cache.
 */
const CACHE_NAME = "kabbak-static-v3";

const STATIC_EXTENSION_PATTERN = /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|mp3)(\?.*)?$/i;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("kabbak-static-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "PRECACHE") {
    return;
  }
  const urls = Array.isArray(event.data.urls) ? event.data.urls.slice(0, 2500) : [];
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(urls.map((url) => cache.add(url)))
    ).then((results) => {
      const cached = results.filter((result) => result.status === "fulfilled").length;
      if (event.source && typeof event.source.postMessage === "function") {
        event.source.postMessage({
          type: "PRECACHE_DONE",
          cached,
          total: urls.length
        });
      }
    })
  );
});

function isNavigationRequest(request) {
  return request.mode === "navigate"
    || String(request.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // HTML must never be stale: network first, cached copy only as fallback.
  if (isNavigationRequest(event.request) || /\.html?(\?.*)?$/i.test(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (!STATIC_EXTENSION_PATTERN.test(url.pathname)) {
    return;
  }

  // Versioned assets: cache-first (the ?v= query busts stale entries).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
