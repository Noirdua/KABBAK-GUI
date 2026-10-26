(function () {
  "use strict";

  const state = {
    splashEl: null,
    progressEl: null,
    labelEl: null,
    statusEl: null,
    wrapEl: null,
    spinnerEl: null,
    overlayEl: null,
    overlayProgressEl: null,
    overlayLabelEl: null,
    overlayStatusEl: null,
    totalDecks: 0,
    listenersBound: false,
    allowProgress: false,
    lastPercent: 0
  };

  function getElements() {
    state.splashEl = state.splashEl || document.getElementById("app-loading-screen");
    state.progressEl = state.progressEl || document.getElementById("app-loading-progress");
    state.labelEl = state.labelEl || document.getElementById("app-loading-progress-label");
    state.statusEl = state.statusEl || document.getElementById("app-loading-note");
    state.wrapEl = state.wrapEl || document.getElementById("app-loading-progress-wrap");
    state.spinnerEl = state.spinnerEl || document.getElementById("app-loading-spinner");
    state.overlayEl = state.overlayEl || document.getElementById("cache-loader-overlay");
    state.overlayProgressEl = state.overlayProgressEl || document.getElementById("cache-loader-progress");
    state.overlayLabelEl = state.overlayLabelEl || document.getElementById("cache-loader-progress-label");
    state.overlayStatusEl = state.overlayStatusEl || document.getElementById("cache-loader-status");
    return state;
  }

  function splashTarget() {
    const els = getElements();
    if (!els.splashEl || !els.splashEl.parentElement || els.splashEl.classList.contains("is-hidden")) {
      return null;
    }
    return {
      mode: "splash",
      root: els.splashEl,
      progressEl: els.progressEl,
      labelEl: els.labelEl,
      statusEl: els.statusEl,
      wrapEl: els.wrapEl,
      spinnerEl: els.spinnerEl
    };
  }

  function overlayTarget() {
    const els = getElements();
    return {
      mode: "overlay",
      root: els.overlayEl,
      progressEl: els.overlayProgressEl,
      labelEl: els.overlayLabelEl,
      statusEl: els.overlayStatusEl
    };
  }

  function getTarget() {
    return splashTarget() || overlayTarget();
  }

  function setVisible(visible) {
    const target = getTarget();
    if (!target.root || target.mode === "splash") {
      return;
    }
    target.root.hidden = !visible;
    target.root.setAttribute("aria-hidden", visible ? "false" : "true");
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
    const target = getTarget();
    const requested = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    const clamped = state.allowProgress
      ? Math.max(requested, state.lastPercent)
      : requested;
    if (state.allowProgress) {
      state.lastPercent = clamped;
    }
    if (target.progressEl) {
      target.progressEl.value = clamped;
    }
    if (target.labelEl) {
      target.labelEl.textContent = `${clamped}%`;
    }
    if (target.statusEl && status) {
      target.statusEl.textContent = status;
    }
    if (target.mode === "splash") {
      if (target.wrapEl) {
        target.wrapEl.hidden = false;
      }
      if (target.spinnerEl) {
        target.spinnerEl.hidden = true;
      }
    }
  }

  function bindDeckStatusListener() {
    if (state.listenersBound) {
      return;
    }
    state.listenersBound = true;

    document.addEventListener("tarot:deck-cache-status", (event) => {
      if (!state.allowProgress) {
        return;
      }
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

    const target = getTarget();
    const useSplash = target.mode === "splash";
    // The splash is the first-boot loading screen now; only use the separate
    // overlay when the splash has already been dismissed (manual reconnects).
    const firstBoot = shouldShowOverlay();
    const showSplashProgress = firstBoot && useSplash;
    const showOverlay = firstBoot && !useSplash;
    state.allowProgress = showSplashProgress || showOverlay;
    state.lastPercent = 0;
    if (hasDecks) {
      bindDeckStatusListener();
    }

    if (showOverlay) {
      setVisible(true);
      setProgress(0, "Caching content…");
    } else if (showSplashProgress) {
      setProgress(0, "Caching content…");
    }

    // Never leave the card stuck: hide it no matter what happens, and give up
    // on hanging preloads after a while.
    const hideTimer = window.setTimeout(() => {
      setProgress(100, "Caching finished in the background.");
      if (showOverlay) {
        window.setTimeout(() => setVisible(false), 250);
      }
    }, 20000);

    try {
      // Small, fast data payloads first so the app feels warm immediately.
      const dataSteps = [
        [2, "Caching text library…", () => dataService?.loadTextLibrary?.(false)],
        [4, "Caching reference data…", () => dataService?.loadReferenceData?.()],
        [8, "Caching deck registry…", () => dataService?.loadDeckOptions?.()]
      ];

      for (const [percent, status, loader] of dataSteps) {
        if (showSplashProgress || showOverlay) setProgress(percent, status);
        try {
          await loader();
        } catch (_error) {
          // Non-fatal — the app loads on demand.
        }
      }

      if (hasDecks) {
        if (showSplashProgress || showOverlay) setProgress(10, "Caching deck images…");
        const normalizedActive = String(activeDeckId || "").trim().toLowerCase();
        // Thumbnails for everything (lightweight), full images only for the
        // active deck. Time-box the preload so a slow deck server never
        // leaves the loader card on screen.
        const preload = (async () => {
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
        })();
        if (showSplashProgress || showOverlay) {
          try {
            await Promise.race([
              preload,
              new Promise((resolve) => window.setTimeout(resolve, 12000))
            ]);
          } catch (_error) {
            // Non-fatal — images load on demand.
          }
        } else {
          void preload.catch(() => {});
        }
      }
    } finally {
      window.clearTimeout(hideTimer);
      markSessionBooted();
      if (showSplashProgress || showOverlay) {
        setProgress(100, "Caching complete.");
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
      state.allowProgress = false;
      if (showOverlay) {
        setVisible(false);
      }
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
    show: () => {
      const target = getTarget();
      if (target.mode === "splash") {
        setProgress(0, "Preparing…");
        return;
      }
      setVisible(true);
    },
    hide: () => setVisible(false),
    setProgress,
    warmCache
  };
})();
