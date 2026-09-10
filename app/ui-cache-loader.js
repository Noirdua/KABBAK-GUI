(function () {
  "use strict";

  const state = {
    overlayEl: null,
    progressEl: null,
    labelEl: null,
    statusEl: null,
    totalDecks: 0,
    listenersBound: false
  };

  function getElements() {
    if (!state.overlayEl) {
      state.overlayEl = document.getElementById("cache-loader-overlay");
      state.progressEl = document.getElementById("cache-loader-progress");
      state.labelEl = document.getElementById("cache-loader-progress-label");
      state.statusEl = document.getElementById("cache-loader-status");
    }
    return state;
  }

  function setVisible(visible) {
    const { overlayEl } = getElements();
    if (overlayEl) {
      overlayEl.hidden = !visible;
      overlayEl.setAttribute("aria-hidden", visible ? "false" : "true");
    }
  }

  function shouldShowOverlay() {
    try {
      return window.sessionStorage.getItem("kabbak-warmcache-shown") !== "1";
    } catch (_error) {
      return true;
    }
  }

  function markSessionBooted() {
    try {
      window.sessionStorage.setItem("kabbak-warmcache-shown", "1");
    } catch (_error) {}
  }

  function setProgress(percent, status) {
    const { progressEl, labelEl, statusEl } = getElements();
    const clamped = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    if (progressEl) {
      progressEl.value = clamped;
    }
    if (labelEl) {
      labelEl.textContent = `${clamped}%`;
    }
    if (statusEl && status) {
      statusEl.textContent = status;
    }
  }

  function bindDeckStatusListener() {
    if (state.listenersBound) {
      return;
    }
    state.listenersBound = true;

    document.addEventListener("tarot:deck-cache-status", (event) => {
      const status = event?.detail;
      if (!status) {
        return;
      }

      const totalDecks = state.totalDecks;
      const warmedDecks = Math.max(0, Number(status.warmedDeckCount) || 0);
      const currentPercent = Number(status.selectedDeckPercent) || 0;

      if (totalDecks > 0) {
        const overall = Math.round(((warmedDecks + currentPercent / 100) / totalDecks) * 100);
        const deckLabel = String(status.activeDeckId || "").trim();
        setProgress(overall, deckLabel ? `Caching ${deckLabel} deck images…` : "Caching deck images…");
      }
    });
  }

  async function warmCache({ dataService, cardImages, activeDeckId } = {}) {
    const hasDecks = !!cardImages;
    const deckOptions = hasDecks ? cardImages.getDeckOptions?.() : null;
    state.totalDecks = Array.isArray(deckOptions) ? deckOptions.length : 0;
    if (hasDecks) {
      bindDeckStatusListener();
    }

    // The progress card only shows on the first boot of a tab session. On
    // refreshes the same warmup runs silently in the background.
    const showOverlay = shouldShowOverlay();
    if (showOverlay) {
      setVisible(true);
      setProgress(0, "Caching content…");
    }

    // Never leave the card stuck: hide it no matter what happens, and give up
    // on hanging preloads after a while.
    const hideTimer = window.setTimeout(() => {
      setProgress(100, "Caching finished in the background.");
      window.setTimeout(() => setVisible(false), 250);
    }, 20000);

    try {
      // Small, fast data payloads first so the app feels warm immediately.
      const dataSteps = [
        [2, "Caching text library…", () => dataService?.loadTextLibrary?.(false)],
        [4, "Caching reference data…", () => dataService?.loadReferenceData?.()],
        [8, "Caching deck registry…", () => dataService?.loadDeckOptions?.()]
      ];

      for (const [percent, status, loader] of dataSteps) {
        if (showOverlay) setProgress(percent, status);
        try {
          await loader();
        } catch (_error) {
          // Non-fatal — the app loads on demand.
        }
      }

      if (hasDecks) {
        if (showOverlay) setProgress(10, "Caching deck images…");
        try {
          const normalizedActive = String(activeDeckId || "").trim().toLowerCase();
          // Thumbnails for everything (lightweight), full images only for the
          // active deck. Time-box the preload so a slow deck server never
          // leaves the loader card on screen.
          await Promise.race([
            (async () => {
              await cardImages.preloadAllDeckImages?.({
                includeThumbnails: true,
                includeFull: false
              });
              if (normalizedActive) {
                await cardImages.preloadDeckImages?.(normalizedActive, {
                  includeThumbnails: true,
                  includeFull: true
                });
              }
            })(),
            new Promise((resolve) => window.setTimeout(resolve, 12000))
          ]);
        } catch (_error) {
          // Non-fatal — images load on demand.
        }
      }
    } finally {
      window.clearTimeout(hideTimer);
      markSessionBooted();
      if (showOverlay) {
        setProgress(100, "Caching complete.");
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
      setVisible(false);
    }
    const idleLoadMagick = () => {
      void dataService?.loadMagickDataset?.();
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(idleLoadMagick, { timeout: 8000 });
    } else {
      window.setTimeout(idleLoadMagick, 1500);
    }
  }

  window.CacheLoaderUi = {
    show: () => setVisible(true),
    hide: () => setVisible(false),
    setProgress,
    warmCache
  };
})();
