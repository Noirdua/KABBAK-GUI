(function () {
  "use strict";

  let config = {
    defaultSettings: null,
    latEl: null,
    lngEl: null,
    nowElements: null,
    homeUi: null,
    onStatus: null,
    hasTarotAccess: () => false,
    shouldPollNow: () => true,
    nowPollIntervalMs: 5 * 60 * 1000,
    services: {},
    ensure: {}
  };

  let referenceData = null;
  let magickDataset = null;
  let currentGeo = null;
  let nowInterval = null;
  let runtimeListenersBound = false;
  let currentTimeFormat = "minutes";
  let currentSettings = null;

  function setStatus(text) {
    config.onStatus?.(text);
  }

  function getReferenceData() {
    return referenceData;
  }

  async function ensureReferenceData() {
    if (referenceData) return referenceData;
    try {
      referenceData = await config.services.loadReferenceData?.() || null;
    } catch {
      referenceData = null;
    }
    return referenceData;
  }

  function getMagickDataset() {
    return magickDataset;
  }

  async function ensureMagickDataset() {
    if (magickDataset) return magickDataset;
    try {
      magickDataset = await config.services.loadMagickDataset?.() || null;
    } catch {
      magickDataset = null;
    }
    return magickDataset;
  }

  function resolveProfileGeo() {
    const shared = window.TarotSettingsUi?.getProfileLocation?.();
    if (shared) {
      return { latitude: shared.latitude, longitude: shared.longitude };
    }
    const location = window.ProfileUi?.getLocation?.();
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
    return null;
  }

  function getCurrentGeo() {
    return resolveProfileGeo() || currentGeo;
  }

  function getCurrentTimeFormat() {
    return currentTimeFormat;
  }

  function getCurrentSettings() {
    return currentSettings ? { ...currentSettings } : null;
  }

  function parseGeoInput() {
    // Profile location is the source of truth; fall back to legacy inputs,
    // then saved settings defaults.
    const profileGeo = resolveProfileGeo();
    if (profileGeo) {
      return profileGeo;
    }
    const inputLatitude = Number(config.latEl?.value);
    const inputLongitude = Number(config.lngEl?.value);
    const settingsLatitude = Number(currentSettings?.latitude);
    const settingsLongitude = Number(currentSettings?.longitude);

    const latitude = Number.isFinite(inputLatitude) ? inputLatitude : settingsLatitude;
    const longitude = Number.isFinite(inputLongitude) ? inputLongitude : settingsLongitude;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("Latitude/Longitude must be valid numbers.");
    }

    return { latitude, longitude };
  }

  function startNowTicker() {
    stopNowTicker();

    const pollIntervalMs = Number.isFinite(Number(config.nowPollIntervalMs))
      ? Math.max(1000, Math.trunc(Number(config.nowPollIntervalMs)))
      : 5 * 60 * 1000;

    const tick = async () => {
      if (config.shouldPollNow?.() === false) {
        return;
      }
      if (!referenceData || !currentGeo) {
        return;
      }

      const now = new Date();
      config.homeUi?.syncNowPanelTheme?.(now);
      config.homeUi?.syncNowSkyBackground?.(currentGeo);

      try {
        await config.services.updateNowPanel?.(referenceData, currentGeo, config.nowElements, currentTimeFormat);
      } catch (_error) {
      }
    };

    void tick();
    nowInterval = setInterval(() => {
      void tick();
    }, pollIntervalMs);
  }

  function stopNowTicker() {
    if (!nowInterval) {
      return;
    }

    clearInterval(nowInterval);
    nowInterval = null;
  }

  function refreshNowPanel(options = {}) {
    if (!referenceData || !currentGeo) {
      return;
    }

    const now = new Date();
    config.homeUi?.syncNowPanelTheme?.(now);
    config.homeUi?.syncNowSkyBackground?.(currentGeo, {
      force: options.forceSky === true
    });
    void config.services.updateNowPanel?.(
      referenceData,
      currentGeo,
      config.nowElements,
      currentTimeFormat,
      { forceCards: options.forceCards === true }
    );
  }

  function syncNowTickerState() {
    if (config.shouldPollNow?.() === false) {
      stopNowTicker();
      config.services.stopCountdownTicker?.();
      return;
    }

    if (!referenceData || !currentGeo) {
      return;
    }

    // Restore sky + panel once when entering Sky; ticker handles later polls.
    refreshNowPanel({ forceSky: true });

    if (!nowInterval) {
      startNowTicker();
    } else {
      config.services.startCountdownTicker?.();
    }
  }

  async function bootstrapConnectedShell(options = {}) {
    currentGeo = parseGeoInput();
    if (!referenceData) {
      setStatus("Loading reference data...");
      referenceData = await config.services.loadReferenceData?.() || null;
    }

    if (config.shouldPollNow?.()) {
      const now = new Date();
      config.homeUi?.syncNowPanelTheme?.(now);
      config.homeUi?.syncNowSkyBackground?.(currentGeo, { force: options.forceSky === true });
      void config.services.updateNowPanel?.(referenceData, currentGeo, config.nowElements, currentTimeFormat);
    }

    setStatus("Connected.");
    return referenceData;
  }

  async function ensureMagickDatasetLoaded() {
    if (magickDataset) {
      return magickDataset;
    }
    try {
      magickDataset = await config.services.loadMagickDataset?.() || null;
    } catch {
      magickDataset = null;
    }
    return magickDataset;
  }

  function applySettings(settings) {
    currentTimeFormat = settings?.timeFormat || "minutes";
    currentSettings = settings ? { ...settings } : { ...(config.defaultSettings || {}) };
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig,
      services: {
        ...(config.services || {}),
        ...(nextConfig.services || {})
      },
      ensure: {
        ...(config.ensure || {}),
        ...(nextConfig.ensure || {})
      }
    };

    if (!currentSettings) {
      currentSettings = { ...(config.defaultSettings || {}) };
      currentTimeFormat = currentSettings.timeFormat || "minutes";
    }

    if (!runtimeListenersBound) {
      document.addEventListener("section:changed", () => {
        syncNowTickerState();
      });

      document.addEventListener("visibilitychange", () => {
        syncNowTickerState();
      });

      runtimeListenersBound = true;
    }
  }

  window.TarotAppRuntime = {
    ...(window.TarotAppRuntime || {}),
    init,
    parseGeoInput,
    applySettings,
    getReferenceData,
    ensureReferenceData,
    getMagickDataset,
    ensureMagickDataset,
    getCurrentGeo,
    getCurrentTimeFormat,
    getCurrentSettings,
    refreshNowPanel,
    bootstrapConnectedShell,
    ensureMagickDatasetLoaded
  };
})();
