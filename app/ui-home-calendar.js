 (function () {
  "use strict";

  let config = {};
  let lastNowSkyGeoKey = "";
  let lastNowSkySourceUrl = "";
  const NOW_SKY_WRAPPER_PATH = "app/stellarium-now-wrapper.html?v=20260314-now-sky-mobile-04";
  const NOW_SKY_FOV_DEGREES = "220";

  function getNowSkyLayerEl() {
    return config.nowSkyLayerEl || null;
  }

  function getNowPanelEl() {
    return config.nowPanelEl || null;
  }

  function getCurrentGeo() {
    return config.getCurrentGeo?.() || null;
  }

  function getCurrentSettings() {
    return config.getCurrentSettings?.() || null;
  }

  function normalizeGeoForSky(geo) {
    const latitude = Number(geo?.latitude);
    const longitude = Number(geo?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      latitude: Number(latitude.toFixed(4)),
      longitude: Number(longitude.toFixed(4))
    };
  }

  function buildRoundedIsoTimestamp(stepMinutes = 5) {
    const rounded = new Date();
    const minute = rounded.getUTCMinutes();
    const bucket = Math.floor(minute / stepMinutes) * stepMinutes;
    rounded.setUTCMinutes(bucket, 0, 0);
    return rounded.toISOString();
  }

  function buildStellariumObserverUrl(geo) {
    const normalizedGeo = normalizeGeoForSky(geo);
    if (!normalizedGeo) {
      return "";
    }

    const wrapperUrl = new URL(NOW_SKY_WRAPPER_PATH, window.location.href);
    wrapperUrl.searchParams.set("lat", String(normalizedGeo.latitude));
    wrapperUrl.searchParams.set("lng", String(normalizedGeo.longitude));
    wrapperUrl.searchParams.set("elev", "0");
    wrapperUrl.searchParams.set("date", buildRoundedIsoTimestamp(5));
    wrapperUrl.searchParams.set("az", "0");
    wrapperUrl.searchParams.set("alt", "90");
    wrapperUrl.searchParams.set("fov", NOW_SKY_FOV_DEGREES);

    return wrapperUrl.toString();
  }

  function normalizeSkySyncOptions(optionsOrForce = false) {
    if (typeof optionsOrForce === "boolean") {
      return { force: optionsOrForce };
    }

    return {
      force: Boolean(optionsOrForce?.force),
      backgroundEnabled: optionsOrForce?.backgroundEnabled,
      hasExplicitLocation: optionsOrForce?.hasExplicitLocation
    };
  }

  function clearNowSkyBackground() {
    const nowSkyLayerEl = getNowSkyLayerEl();
    if (!nowSkyLayerEl) {
      return;
    }

    if (nowSkyLayerEl.getAttribute("src") !== "about:blank") {
      nowSkyLayerEl.src = "about:blank";
    }
    lastNowSkyGeoKey = "";
    lastNowSkySourceUrl = "";
  }

  function getNowSkyFrameSrc(nowSkyLayerEl) {
    if (!nowSkyLayerEl) {
      return "";
    }

    try {
      return String(nowSkyLayerEl.contentWindow?.location?.href || nowSkyLayerEl.src || "");
    } catch {
      return String(nowSkyLayerEl.src || "");
    }
  }

  function syncNowSkyBackground(geo, optionsOrForce = false) {
    const activeSection = window.TarotSectionStateUi?.getActiveSection?.() || "home";
    if (activeSection !== "sky") {
      // Keep the iframe warm while the Sky section is hidden so returning
      // to the tab does not flash a black background while Stellarium reloads.
      return;
    }

    const nowSkyLayerEl = getNowSkyLayerEl();
    const nowPanelEl = getNowPanelEl();
    if (!nowSkyLayerEl) {
      return;
    }

    const options = normalizeSkySyncOptions(optionsOrForce);
    const settings = getCurrentSettings();
    const backgroundEnabled = typeof options.backgroundEnabled === "boolean"
      ? options.backgroundEnabled
      : settings?.stellariumBackgroundEnabled === true;
    const hasExplicitLocation = typeof options.hasExplicitLocation === "boolean"
      ? options.hasExplicitLocation
      : settings?.hasExplicitLocation === true;
    const normalizedGeo = normalizeGeoForSky(geo || getCurrentGeo());
    const shouldLoadSky = Boolean(backgroundEnabled && hasExplicitLocation && normalizedGeo);

    if (nowPanelEl) {
      nowPanelEl.classList.toggle("is-sky-disabled", !shouldLoadSky);
    }

    if (!shouldLoadSky) {
      clearNowSkyBackground();
      return;
    }

    const geoKey = `${normalizedGeo.latitude.toFixed(4)},${normalizedGeo.longitude.toFixed(4)}`;
    const stellariumUrl = buildStellariumObserverUrl(normalizedGeo);
    if (!stellariumUrl) {
      return;
    }

    const currentSrc = getNowSkyFrameSrc(nowSkyLayerEl);
    const frameLooksLoaded = Boolean(currentSrc)
      && currentSrc !== "about:blank"
      && !currentSrc.endsWith("about:blank");

    if (!options.force
      && frameLooksLoaded
      && geoKey === lastNowSkyGeoKey
      && (lastNowSkySourceUrl === stellariumUrl || currentSrc.indexOf(stellariumUrl) === 0 || currentSrc === stellariumUrl)) {
      return;
    }

    let nextSrc = stellariumUrl;
    if (options.force) {
      // Browsers ignore same-URL iframe assignments; bust cache on forced restore
      // so returning to Sky after another tab never sticks on a black frame.
      try {
        const bustUrl = new URL(stellariumUrl, window.location.href);
        bustUrl.searchParams.set("_skyRestore", String(Date.now()));
        nextSrc = bustUrl.toString();
      } catch {
        nextSrc = `${stellariumUrl}${stellariumUrl.includes("?") ? "&" : "?"}_skyRestore=${Date.now()}`;
      }
    }

    nowSkyLayerEl.src = nextSrc;
    lastNowSkyGeoKey = geoKey;
    lastNowSkySourceUrl = stellariumUrl;
  }

  function syncNowPanelTheme(referenceDate = new Date()) {
    const nowPanelEl = getNowPanelEl();
    if (!nowPanelEl) {
      return;
    }

    const currentGeo = getCurrentGeo();
    if (!currentGeo || !window.SunCalc) {
      nowPanelEl.classList.remove("is-day");
      nowPanelEl.classList.add("is-night");
      return;
    }

    const sunPosition = window.SunCalc.getPosition(referenceDate, currentGeo.latitude, currentGeo.longitude);
    const sunAltitudeDeg = (sunPosition.altitude * 180) / Math.PI;
    const isDaytime = sunAltitudeDeg >= -4;

    nowPanelEl.classList.toggle("is-day", isDaytime);
    nowPanelEl.classList.toggle("is-night", !isDaytime);
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig
    };

    const nowSkyLayerEl = getNowSkyLayerEl();
    if (nowSkyLayerEl) {
      nowSkyLayerEl.src = "about:blank";
    }
  }

  window.TarotHomeUi = {
    ...(window.TarotHomeUi || {}),
    init,
    syncNowSkyBackground,
    syncNowPanelTheme,
    clearNowSkyBackground
  };
})();
