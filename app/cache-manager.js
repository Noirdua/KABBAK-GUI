/* cache-manager.js — manual app cache: precaches static assets via the service
 * worker and reports cache size/status. Wired to the Profile > App Cache card.
 */
(function () {
  "use strict";

  const CACHE_NAME = "kabbak-static-v3";
  let registration = null;

  function isSupported() {
    return Boolean("serviceWorker" in navigator && window.caches && window.fetch);
  }

  function collectStaticAssetUrls() {
    const urls = new Set();
    const addUrl = (raw) => {
      const url = String(raw || "").trim();
      if (!url) return;
      try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.origin !== window.location.origin) return;
        // Never precache the HTML document itself — updates must always show.
        if (/\.html?(\?.*)?$/i.test(parsed.pathname)) return;
        urls.add(parsed.href);
      } catch (_error) {
        // Ignore malformed URLs.
      }
    };

    // Everything already loaded by the page (scripts, styles, fonts, images).
    performance.getEntriesByType("resource").forEach((entry) => {
      addUrl(entry.name);
    });
    // Current document assets (in case resource timing misses any).
    document.querySelectorAll("script[src], link[rel='stylesheet'], img[src]").forEach((element) => {
      addUrl(element.src || element.href);
    });

    return [...urls];
  }

  function allowedCacheOrigin(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin === window.location.origin) return true;
      const apiBase = String(window.TarotDataService?.getApiBaseUrl?.() || "").trim();
      if (!apiBase) return false;
      return parsed.origin === new URL(apiBase, window.location.origin).origin;
    } catch (_error) {
      return false;
    }
  }

  async function collectPrecacheUrls() {
    const urls = new Set(collectStaticAssetUrls());
    const addUrl = (raw) => {
      const value = String(raw || "").trim();
      if (!value) return;
      try {
        const parsed = new URL(value, window.location.origin);
        if (!allowedCacheOrigin(parsed.href)) return;
        if (/\.html?(\?.*)?$/i.test(parsed.pathname)) return;
        if (parsed.pathname.startsWith("/api/v1/plugins/") || parsed.pathname.startsWith("/api/v1/integrations/")) return;
        urls.add(parsed.href);
      } catch (_error) {}
    };

    (window.TarotLazySections?.listKnownScripts?.() || []).forEach((src) => addUrl(src));
    document.querySelectorAll("script[src], link[rel='stylesheet'], link[rel='preload'], img[src]").forEach((element) => {
      addUrl(element.src || element.href);
    });

    const service = window.TarotDataService;
    if (service?.buildApiUrl) {
      [
        "/api/v1/bootstrap/reference-data",
        "/api/v1/bootstrap/magick-manifest",
        "/api/v1/bootstrap/magick-dataset",
        "/api/v1/decks/options",
        "/api/v1/locations/countries"
      ].forEach((path) => addUrl(service.buildApiUrl(path)));

      try {
        const listing = await service.fetchJson(service.buildApiUrl("/api/v1/decks/assets"));
        const decks = Array.isArray(listing?.decks) ? listing.decks : [];
        decks.forEach((deck) => {
          (Array.isArray(deck?.assets) ? deck.assets : []).forEach((asset) => {
            const assetPath = String(asset?.assetPath || "").trim();
            if (assetPath && typeof service.toApiAssetUrl === "function") {
              addUrl(service.toApiAssetUrl(assetPath));
            } else if (asset?.urlPath) {
              addUrl(service.buildApiUrl(`/api/v1/${String(asset.urlPath).replace(/^\/+/, "")}`));
            }
          });
        });
      } catch (_error) {
        // Deck listing is best-effort; app files still cache.
      }
    }

    return [...urls];
  }

  function estimateCacheSize() {
    if (!window.caches) return Promise.resolve({ count: 0, bytes: 0 });
    return caches.open(CACHE_NAME)
      .then((cache) => cache.keys().then((requests) => ({ cache, requests })))
      .then(({ cache, requests }) => {
        if (!requests.length) {
          return { count: 0, bytes: 0 };
        }
        return Promise.all(requests.map((request) =>
          cache.match(request).then(async (response) => {
            if (!response) return 0;
            const contentLength = Number(response.headers.get("content-length"));
            if (Number.isFinite(contentLength) && contentLength > 0) return contentLength;
            // Service-worker-stored responses often lack content-length; measure
            // the body directly (on a clone so the cached copy stays intact).
            try {
              const buffer = await response.clone().arrayBuffer();
              return buffer.byteLength;
            } catch (_error) {
              return 0;
            }
          }).catch(() => 0)
        )).then((sizes) => ({
          count: requests.length,
          bytes: sizes.reduce((sum, size) => sum + size, 0)
        }));
      })
      .catch(() => ({ count: 0, bytes: 0 }));
  }

  function formatBytes(bytes) {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  async function registerWorker() {
    if (!isSupported()) return null;
    try {
      registration = await navigator.serviceWorker.register("sw.js");
      // Ask the browser to check for a fresh sw.js so fixes deploy promptly.
      try {
        await registration.update();
      } catch (_error) {
        // Update check is best-effort.
      }
      return registration;
    } catch (_error) {
      return null;
    }
  }

  async function getStatus() {
    if (!isSupported()) {
      return { supported: false, controlled: false, registered: false, count: 0, bytes: 0, sizeText: "unsupported" };
    }
    const registered = Boolean(registration || await registerWorker());
    const { count, bytes } = await estimateCacheSize();
    return {
      supported: true,
      registered,
      controlled: Boolean(navigator.serviceWorker.controller),
      count,
      bytes,
      sizeText: count ? `${count} files · ${formatBytes(bytes)}` : "empty"
    };
  }

  async function precache({ onProgress } = {}) {
    if (!isSupported()) {
      throw new Error("Cache storage is not supported in this browser.");
    }
    if (!registration) {
      await registerWorker();
    }
    if (!registration) {
      throw new Error("Could not register the cache worker.");
    }

    const urls = await collectPrecacheUrls();
    const service = window.TarotDataService;
    const apiKey = service?.getApiKey?.();
    let apiOrigin = "";
    try {
      const base = String(service?.getApiBaseUrl?.() || "").trim();
      apiOrigin = base ? new URL(base, window.location.origin).origin : "";
    } catch (_error) {
      apiOrigin = "";
    }

    async function storeUrl(cache, url) {
      const parsed = new URL(url, window.location.origin);
      if (apiOrigin && parsed.origin === apiOrigin && apiKey) {
        const response = await fetch(url, { headers: { "x-api-key": apiKey } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await cache.put(url, response);
        return;
      }
      await cache.add(url);
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      caches.open(CACHE_NAME)
        .then((cache) => {
          let done = 0;
          return Promise.allSettled(urls.map((url) =>
            storeUrl(cache, url).finally(() => {
              done += 1;
              if (typeof onProgress === "function") {
                onProgress(done, urls.length);
              }
            })
          ));
        })
        .then((results) => {
          const cached = results.filter((result) => result.status === "fulfilled").length;
          finish({ cached, total: urls.length });
        })
        .catch(() => finish({ cached: 0, total: urls.length }));

      const activeWorker = registration?.active || navigator.serviceWorker.controller;
      if (activeWorker && activeWorker.postMessage) {
        const localUrls = urls.filter((url) => {
          try {
            return new URL(url, window.location.origin).origin === window.location.origin;
          } catch (_error) {
            return false;
          }
        });
        activeWorker.postMessage({ type: "PRECACHE", urls: localUrls, cacheName: CACHE_NAME });
      }

      window.setTimeout(() => {
        finish({ cached: 0, total: urls.length, timedOut: true });
      }, 180000);
    });
  }

  async function clearCache() {
    if (!window.caches) return;
    await caches.delete(CACHE_NAME);
    // Remove any stale worker so the next registration fetches the current
    // sw.js (otherwise an old worker keeps serving its own cache).
    try {
      if (registration) {
        await registration.unregister();
        registration = null;
      }
    } catch (_error) {}
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((registrations || []).map((entry) => entry.unregister()));
    } catch (_error) {}
    void registerWorker();
  }

  navigator.serviceWorker?.addEventListener("message", (event) => {
    // The worker's PRECACHE_DONE is informational; the direct page-side cache
    // above is the source of truth for progress and counts.
  });

  // Register the worker quietly on boot; precaching stays manual.
  void registerWorker();

  window.TaroTimeCache = {
    clearCache,
    estimateCacheSize,
    getStatus,
    precache,
    registerWorker
  };
})();
