(function () {
  const apiBaseUrlStorageKey = "tarot-time-api-base-url";
  const apiBaseUrlOriginKey = "tarot-time-api-base-url-origin";
  const apiKeyStorageKey = "tarot-time-api-key";
  const defaultConnectionAccess = Object.freeze({
    connected: false,
    apiKeyRequired: false,
    authenticated: false,
    clientId: "",
    accountId: "",
    accessLevel: "",
    roles: Object.freeze([]),
    scopes: Object.freeze([]),
    capabilities: Object.freeze({
      tarot: false,
      adminApiManagement: false
    }),
    demo: false,
    personalFeatures: true
  });

  function normalizeBaseUrl(value) {
    return String(value || "")
      .trim()
      .replace(/\/+$/, "");
  }

  // Opt-in features, all off unless config.json or ?features= turns them on.
  const defaultFeatures = Object.freeze({
    textSearchDiagnostics: false
  });

  function readQueryFeatureOverrides() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const requested = String(params.get("features") || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const overrides = {};
      for (const entry of requested) {
        const disabled = entry.startsWith("-") || entry.startsWith("!");
        const name = disabled ? entry.slice(1) : entry;
        if (name in defaultFeatures) overrides[name] = !disabled;
      }
      return overrides;
    } catch (_error) {
      return {};
    }
  }

  function normalizeFeatures(value) {
    const source = value && typeof value === "object" ? value : {};
    const overrides = readQueryFeatureOverrides();
    const normalized = {};
    for (const name of Object.keys(defaultFeatures)) {
      normalized[name] = name in overrides ? overrides[name] : source[name] === true;
    }
    return normalized;
  }

  function normalizeApiKey(value) {
    return String(value || "").trim();
  }

  function normalizeStringList(values) {
    return Array.isArray(values)
      ? values.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
  }

  function normalizeAccessLevel(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeConnectionAccess(source = null) {
    const health = source?.health || {};
    const auth = health?.auth || source?.auth || {};
    const roles = normalizeStringList(auth?.roles);
    const scopes = normalizeStringList(auth?.scopes);
    const apiKeyRequired = health?.apiKeyRequired === true || source?.apiKeyRequired === true;
    const authenticated = auth?.authenticated === true;
    const connected = (source?.ok === true || source?.connected === true)
      && (!apiKeyRequired || authenticated);
    const accessLevel = normalizeAccessLevel(
      auth?.accessLevel
      || source?.accessLevel
      || (connected && !apiKeyRequired ? "premium" : "")
    );
    const adminApiManagementCapability = source?.capabilities?.adminApiManagement === true
      || roles.includes("admin")
      || scopes.includes("api:admin");
    const tarotCapability = source?.capabilities?.tarot === true
      || (connected && !apiKeyRequired)
      || accessLevel === "premium"
      || accessLevel === "pro+"
      || adminApiManagementCapability;
    const clientId = String(auth?.clientId || source?.clientId || "").trim();
    const demo = auth?.demo === true
      || source?.demo === true
      || clientId === "cli_demo"
      || clientId.startsWith("cli_demo_");
    const personalFeatures = authenticated && !demo && auth?.personalFeatures !== false && source?.personalFeatures !== false;

    return {
      connected,
      apiKeyRequired,
      authenticated,
      clientId,
      accountId: String(auth?.accountId || source?.accountId || "").trim(),
      accessLevel,
      roles,
      scopes,
      capabilities: {
        tarot: tarotCapability,
        adminApiManagement: adminApiManagementCapability
      },
      demo,
      personalFeatures
    };
  }

  function sameConnectionAccess(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function normalizeConnectionSettings(settings) {
    return {
      apiBaseUrl: normalizeBaseUrl(settings?.apiBaseUrl),
      apiKey: normalizeApiKey(settings?.apiKey)
    };
  }

  function stripLegacyCredentialParams() {
    try {
      const currentUrl = new URL(window.location.href);
      const hadApiKeyParam = currentUrl.searchParams.has("apiKey") || currentUrl.searchParams.has("api_key");
      if (!hadApiKeyParam) {
        return;
      }

      currentUrl.searchParams.delete("apiKey");
      currentUrl.searchParams.delete("api_key");
      const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    } catch (_error) {
    }
  }

  function persistConnectionSettings(settings) {
    let didPersist = true;

    try {
      const params = new URLSearchParams(window.location.search || "");
      const queryValue = String(params.get("apiBaseUrl") || "").trim();

      if (queryValue) {
        window.localStorage.setItem(apiBaseUrlStorageKey, normalizeBaseUrl(queryValue));
      }

      if (settings.apiBaseUrl) {
        window.localStorage.setItem(apiBaseUrlStorageKey, settings.apiBaseUrl);
      } else {
        window.localStorage.removeItem(apiBaseUrlStorageKey);
      }

      if (settings.apiKey) {
        window.localStorage.setItem(apiKeyStorageKey, settings.apiKey);
      } else {
        window.localStorage.removeItem(apiKeyStorageKey);
      }
    } catch (_error) {
      didPersist = false;
    }

    // Fallback so refreshes keep working even when localStorage is blocked
    // (privacy modes, storage-disabled browsers, some file:// setups).
    let didPersistSession = true;
    try {
      if (settings.apiBaseUrl) {
        window.sessionStorage.setItem(apiBaseUrlStorageKey, settings.apiBaseUrl);
      } else {
        window.sessionStorage.removeItem(apiBaseUrlStorageKey);
      }
      if (settings.apiKey) {
        window.sessionStorage.setItem(apiKeyStorageKey, settings.apiKey);
      } else {
        window.sessionStorage.removeItem(apiKeyStorageKey);
      }
    } catch (_error) {
      didPersistSession = false;
    }

    if (!didPersist && !didPersistSession) {
      console.warn("[connection] Browser storage is unavailable; the API connection will reset on reload.");
    }

    return {
      didPersist,
      didPersistSession
    };
  }

  function readConfiguredConnectionSettings() {
    let storedBaseUrl = "";
    let storedApiKey = "";

    try {
      const params = new URLSearchParams(window.location.search || "");
      const queryValue = String(params.get("apiBaseUrl") || "").trim();

      if (queryValue) {
        window.localStorage.setItem(apiBaseUrlStorageKey, normalizeBaseUrl(queryValue));
      }

      storedBaseUrl = String(window.localStorage.getItem(apiBaseUrlStorageKey) || "").trim();
      storedApiKey = String(window.localStorage.getItem(apiKeyStorageKey) || "").trim();
    } catch (_error) {
      storedBaseUrl = "";
      storedApiKey = "";
    }

    // Session fallback for browsers that block persistent storage.
    try {
      if (!storedBaseUrl) {
        storedBaseUrl = String(window.sessionStorage.getItem(apiBaseUrlStorageKey) || "").trim();
      }
      if (!storedApiKey) {
        storedApiKey = String(window.sessionStorage.getItem(apiKeyStorageKey) || "").trim();
      }
    } catch (_error) {
      // Keep whatever localStorage provided.
    }

    if (!storedBaseUrl) {
      const fileUrl = normalizeBaseUrl(readSameOriginConfigSync()?.apiBaseUrl);
      if (/^https?:\/\//i.test(fileUrl)) storedBaseUrl = fileUrl;
    }

    return normalizeConnectionSettings({
      apiBaseUrl: storedBaseUrl,
      apiKey: storedApiKey
    });
  }

  function readSameOriginConfigSync() {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", `config.json?_=${Date.now()}`, false);
      request.send(null);
      if (request.status < 200 || request.status >= 300) return null;
      const parsed = JSON.parse(request.responseText);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function hasStoredBaseUrl() {
    try {
      if (String(window.localStorage.getItem(apiBaseUrlStorageKey) || "").trim()) return true;
    } catch (_error) {}
    try {
      if (String(window.sessionStorage.getItem(apiBaseUrlStorageKey) || "").trim()) return true;
    } catch (_error) {}
    return false;
  }

  function getConnectionStorageHealth() {
    try {
      const localKey = String(window.localStorage.getItem(apiKeyStorageKey) || "").trim();
      if (localKey) {
        return "persistent";
      }
      const sessionKey = String(window.sessionStorage.getItem(apiKeyStorageKey) || "").trim();
      if (sessionKey) {
        return "session";
      }
      return "none";
    } catch (_error) {
      return "none";
    }
  }

  function hasQueryApiBaseUrl() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return Boolean(String(params.get("apiBaseUrl") || "").trim());
    } catch (_error) {
      return false;
    }
  }

  const LOGO_CANDIDATES = ["logo.png", "logo.svg", "logo.webp", "logo.jpg", "logo.jpeg"];
  const SETTINGS_STORAGE_KEY = "tarot-time-settings-v1";
  const BRANDING_CACHE_KEY = "kabbak-branding-cache-v1";

  let serverDefaults = Object.freeze({});
  let appliedBrandingBase = "";
  let brandingConfig = Object.freeze({
    title: "KABBAK",
    homeLabel: "KABBAK",
    logoUrl: ""
  });

  function normalizeMenuLayoutValue(value) {
    return String(value || "").trim().toLowerCase() === "drawer" ? "drawer" : "panel";
  }

  function normalizeTimeFormatValue(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "hours" || normalized === "seconds" || normalized === "minutes") {
      return normalized;
    }
    return "minutes";
  }

  function normalizeServerDefaults(rawDefaults = null) {
    const source = rawDefaults && typeof rawDefaults === "object" ? rawDefaults : {};
    const next = {};

    if (source.menuLayout != null) {
      next.menuLayout = normalizeMenuLayoutValue(source.menuLayout);
    }
    if (source.timeFormat != null) {
      next.timeFormat = normalizeTimeFormatValue(source.timeFormat);
    }
    if (source.tarotDeck != null && String(source.tarotDeck).trim()) {
      next.tarotDeck = String(source.tarotDeck).trim().toLowerCase();
    }
    if (source.detailTextScale != null && Number.isFinite(Number(source.detailTextScale))) {
      const scale = Number(source.detailTextScale);
      next.detailTextScale = Math.min(1.35, Math.max(0.85, scale > 2 ? scale / 100 : scale));
    }
    if (source.stellariumBackgroundEnabled != null) {
      next.stellariumBackgroundEnabled = source.stellariumBackgroundEnabled === true;
    }
    if (source.latitude != null && Number.isFinite(Number(source.latitude))) {
      next.latitude = Number(source.latitude);
    }
    if (source.longitude != null && Number.isFinite(Number(source.longitude))) {
      next.longitude = Number(source.longitude);
    }
    if (source.hasExplicitLocation != null) {
      next.hasExplicitLocation = source.hasExplicitLocation === true;
    }
    if (source.themeId != null && String(source.themeId).trim()) {
      next.themeId = String(source.themeId).trim();
    }
    if (source.theme && typeof source.theme === "object") {
      next.theme = source.theme;
    }

    return next;
  }

  function normalizeBranding(rawBranding = null, options = {}) {
    const hasBrandingBlock = rawBranding && typeof rawBranding === "object";
    const source = hasBrandingBlock ? rawBranding : {};
    const title = String(source.title || source.homeLabel || "KABBAK").trim() || "KABBAK";
    const homeLabel = String(source.homeLabel || source.title || "KABBAK").trim() || "KABBAK";
    let logo = source.logo;
    // Default: no logo probing (avoids console 404 spam).
    // Enable auto-detect only with branding.logo: true.
    // Use an explicit path string to load a specific file.
    if (logo === false || logo === null || logo === undefined) {
      logo = "";
    } else if (logo === true) {
      logo = null; // auto-detect candidates
    } else {
      logo = String(logo || "").trim();
    }

    return {
      title,
      homeLabel,
      logo
    };
  }

  function escapeHtmlAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function probeImageUrl(url) {
    if (!url) {
      return false;
    }

    // Prefer HEAD so missing logos do not show as broken image resource errors.
    try {
      const response = await fetch(url, {
        method: "HEAD",
        cache: "no-cache"
      });
      if (response.ok) {
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();
        if (!contentType || contentType.startsWith("image/") || contentType.includes("octet-stream")) {
          return true;
        }
      }
      // Some static servers reject HEAD; fall through to GET below.
      if (response.status !== 405 && response.status !== 501) {
        return false;
      }
    } catch {
      // fall through
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-cache"
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function resolveLogoUrl(logoSetting) {
    if (logoSetting === "" || logoSetting === undefined || logoSetting === false) {
      return "";
    }
    if (typeof logoSetting === "string" && logoSetting) {
      const exists = await probeImageUrl(logoSetting);
      return exists ? logoSetting : "";
    }

    // logoSetting === null means explicit auto-detect (branding.logo: true)
    for (const candidate of LOGO_CANDIDATES) {
      if (await probeImageUrl(candidate)) {
        return candidate;
      }
    }
    return "";
  }

  function resolvePublicApiUrl(rawUrl, apiBaseUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
    const base = normalizeBaseUrl(apiBaseUrl);
    if (!base) return value;
    return value.startsWith("/") ? `${base}${value}` : `${base}/${value}`;
  }

  function applyOverlayBackground(rawUrl, apiBaseUrl) {
    const resolved = resolvePublicApiUrl(rawUrl, apiBaseUrl);
    const safe = resolved.replace(/\\/g, "/").replace(/"/g, "");
    document.documentElement.style.setProperty("--tt-lightbox-overlay-image", safe ? `url("${safe}")` : "none");
  }

  function applyFavicon(rawUrl, apiBaseUrl) {
    const href = String(resolvePublicApiUrl(rawUrl, apiBaseUrl) || "").trim();
    const link = document.createElement("link");
    link.id = "app-favicon";
    link.rel = "icon";
    if (href) {
      link.setAttribute("href", href);
    } else {
      link.setAttribute("href", "app/favicon.svg");
      link.setAttribute("type", "image/svg+xml");
    }
    const existing = document.getElementById("app-favicon");
    if (existing && existing.parentNode) {
      existing.parentNode.replaceChild(link, existing);
    } else {
      document.head.appendChild(link);
    }
  }

  function applyBranding(branding, logoUrl = "") {
    const title = String(branding?.title || "KABBAK").trim() || "KABBAK";
    const homeLabel = String(branding?.homeLabel || title).trim() || title;
    document.title = title;
    const loadingMark = document.querySelector(".app-loading-mark");
    if (loadingMark) loadingMark.textContent = homeLabel;

    const homeButton = document.getElementById("open-home");
    if (!(homeButton instanceof HTMLElement)) {
      return;
    }

    if (logoUrl) {
      homeButton.className = "topbar-home-button topbar-home-logo-text";
      homeButton.setAttribute("aria-label", homeLabel);
      homeButton.innerHTML =
        `<img class="topbar-home-logo" src="${escapeHtmlAttr(logoUrl)}" alt="">`
        + `<span class="topbar-home-text">${escapeHtmlAttr(homeLabel)}</span>`;
      return;
    }

    homeButton.className = "topbar-home-button";
    homeButton.removeAttribute("aria-label");
    homeButton.textContent = homeLabel;
  }

  function isNativeShell() {
    return document.documentElement.getAttribute("data-kabbak-native") === "1"
      || window.Capacitor?.isNativePlatform?.() === true;
  }

  function isLoopbackHost(hostname) {
    const host = String(hostname || "").replace(/^\[|\]$/g, "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function isLoopbackUrl(value) {
    try {
      return isLoopbackHost(new URL(value).hostname);
    } catch (_error) {
      return false;
    }
  }

  function usableFileApiBaseUrl(value) {
    const url = normalizeBaseUrl(value);
    if (!url || !/^https?:\/\//i.test(url)) return "";
    if ((isNativeShell() || !isLoopbackHost(window.location.hostname)) && isLoopbackUrl(url)) {
      return "";
    }
    return url;
  }

  function readBaseUrlOrigin() {
    try {
      const local = String(window.localStorage.getItem(apiBaseUrlOriginKey) || "").trim();
      if (local) return local;
    } catch (_error) {}
    try {
      return String(window.sessionStorage.getItem(apiBaseUrlOriginKey) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function writeBaseUrlOrigin(origin) {
    const value = String(origin || "");
    try {
      if (value) window.localStorage.setItem(apiBaseUrlOriginKey, value);
      else window.localStorage.removeItem(apiBaseUrlOriginKey);
    } catch (_error) {}
    try {
      if (value) window.sessionStorage.setItem(apiBaseUrlOriginKey, value);
      else window.sessionStorage.removeItem(apiBaseUrlOriginKey);
    } catch (_error) {}
  }

  // A GUI served from gui.example.com is commonly paired with an API at
  // api.example.com on the same server. Probe those siblings so a fresh
  // visitor can discover the server default without a local config.json.
  function apiSiblingCandidates(protocol, hostname) {
    const parts = String(hostname || "").split(".");
    if (parts.length < 3) return [];
    const root = parts.slice(1).join(".");
    return [`${protocol}//api.${root}`, `${protocol}//${root}`];
  }

  // When the API publishes a base URL that reuses the host we actually reached,
  // prefer that reachable origin: a proxy often fronts TLS on 443 while the
  // operator typed the internal port (e.g. :3100), which browsers cannot use.
  function preferReachableBase(published, reached) {
    if (!published) return "";
    try {
      const pub = new URL(published);
      const base = new URL(reached);
      if (pub.hostname && base.hostname && pub.hostname.toLowerCase() === base.hostname.toLowerCase()) {
        return base.origin;
      }
    } catch (_error) {}
    return published;
  }

  function shouldApplyConnectionDefault() {
    if (hasQueryApiBaseUrl()) return false;
    if (!hasStoredBaseUrl()) return true;
    return readBaseUrlOrigin() === "default";
  }

  async function readFileConfig() {
    try {
      const response = await fetch(`config.json?_=${Date.now()}`, { cache: "no-cache" });
      if (!response.ok) return null;
      const config = await response.json().catch(() => null);
      return config && typeof config === "object" ? config : null;
    } catch (_error) {
      return null;
    }
  }

  async function fetchBrandingPayload(baseUrl) {
    const base = normalizeBaseUrl(baseUrl);
    if (!base) return null;
    try {
      const response = await fetch(`${base}/api/v1/branding`, { cache: "no-cache" });
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      if (!payload || typeof payload !== "object") return null;
      return { payload, base };
    } catch (_error) {
      return null;
    }
  }

  function readBrandingCache() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(BRANDING_CACHE_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function savedApiBaseUrl() {
    try {
      return normalizeBaseUrl(window.localStorage.getItem(apiBaseUrlStorageKey) || "");
    } catch {
      return "";
    }
  }

  function brandingCacheMatches(cached, baseUrl) {
    const cachedBase = normalizeBaseUrl(cached?.apiBaseUrl);
    if (!cachedBase) return false;
    const base = normalizeBaseUrl(baseUrl);
    if (!base) return true;
    return cachedBase === base;
  }

  function writeBrandingCache(payload, baseUrl, logoUrl) {
    const base = normalizeBaseUrl(baseUrl);
    if (!base) return;
    try {
      window.localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify({
        apiBaseUrl: base,
        title: String(payload?.title || "").trim(),
        homeLabel: String(payload?.homeLabel || "").trim(),
        logoUrl: String(logoUrl || "").trim(),
        overlayBackgroundUrl: resolvePublicApiUrl(payload?.overlayBackgroundUrl, base),
        faviconUrl: resolvePublicApiUrl(payload?.faviconUrl, base)
      }));
    } catch {
    }
  }

  function applyCachedBranding() {
    const cached = readBrandingCache();
    const base = savedApiBaseUrl() || normalizeBaseUrl(window.TarotAppConfig?.getApiBaseUrl?.() || "");
    if (!cached || !brandingCacheMatches(cached, base)) return;
    const title = String(cached.title || "").trim();
    const homeLabel = String(cached.homeLabel || "").trim();
    const logoUrl = String(cached.logoUrl || "").trim();
    if (title || homeLabel || logoUrl) {
      brandingConfig = normalizeBranding({
        title: title || undefined,
        homeLabel: homeLabel || undefined,
        logo: logoUrl || ""
      });
      applyBranding(brandingConfig, logoUrl);
      window.TarotAppConfig.branding = { ...brandingConfig };
    }
    if (cached.overlayBackgroundUrl) applyOverlayBackground(cached.overlayBackgroundUrl, "");
    if (cached.faviconUrl) applyFavicon(cached.faviconUrl, "");
  }

  async function applyRemoteBranding(brandingPayload, baseUrl) {
    if (!brandingPayload) return;
    const remoteTitle = String(brandingPayload.title || "").trim();
    const remoteHomeLabel = String(brandingPayload.homeLabel || "").trim();
    const remoteLogo = String(brandingPayload.logoUrl || "").trim();
    const resolvedLogo = resolvePublicApiUrl(remoteLogo, baseUrl);
    const cached = readBrandingCache();
    const base = normalizeBaseUrl(baseUrl);
    brandingConfig = normalizeBranding({
      title: remoteTitle || undefined,
      homeLabel: remoteHomeLabel || undefined,
      logo: remoteLogo || ""
    });
    window.TarotAppConfig.branding = { ...brandingConfig };
    let logoUrl = "";
    if (resolvedLogo) {
      if (cached && brandingCacheMatches(cached, base) && cached.logoUrl === resolvedLogo) {
        logoUrl = resolvedLogo;
      } else {
        logoUrl = await resolveLogoUrl(resolvedLogo);
      }
    }
    applyBranding(brandingConfig, logoUrl);
    if (remoteTitle) {
      document.title = remoteTitle;
    }
    applyOverlayBackground(brandingPayload.overlayBackgroundUrl, baseUrl);
    applyFavicon(brandingPayload.faviconUrl, baseUrl);
    applyPublishedGuiDefaults(brandingPayload);
    writeBrandingCache(brandingPayload, baseUrl, logoUrl);
    appliedBrandingBase = base;
  }

  function hasStoredLook() {
    try {
      return Boolean(String(window.localStorage.getItem("tarot-time-app-look-v1") || "").trim());
    } catch {
      return false;
    }
  }

  function hasStoredSkin() {
    try {
      return Boolean(String(window.localStorage.getItem("kabbak-active-skin") || "").trim());
    } catch {
      return false;
    }
  }

  function applyPublishedGuiDefaults(payload) {
    const gui = payload?.guiDefaults && typeof payload.guiDefaults === "object" ? payload.guiDefaults : null;
    if (!gui) return;
    const source = {};
    if (gui.menuLayout) source.menuLayout = gui.menuLayout;
    if (gui.timeFormat) source.timeFormat = gui.timeFormat;
    if (gui.themeId) source.themeId = gui.themeId;
    serverDefaults = Object.freeze(normalizeServerDefaults(source));
    window.TarotAppConfig.serverDefaults = { ...serverDefaults };
    const lookId = String(gui.lookId || "").trim();
    if (lookId && !hasStoredLook()) {
      window.TarotUiLook?.applyLook?.(lookId, { persist: true });
    }
    const skinId = String(gui.skinId || "").trim();
    if (skinId && !hasStoredSkin()) {
      try {
        window.localStorage.setItem("kabbak-active-skin", skinId);
      } catch {
      }
    }
  }

  async function applyConnectedBranding(baseUrl) {
    const branding = await fetchBrandingPayload(baseUrl);
    if (!branding) return false;
    await applyRemoteBranding(branding.payload, branding.base);
    return true;
  }

  function hasUserSavedSettings() {
    try {
      return Boolean(String(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "").trim());
    } catch {
      return false;
    }
  }

  async function loadConfigDefaults() {
    try {
      const fileConfig = await readFileConfig();
      if (fileConfig?.features) {
        window.TarotAppConfig?.updateFeatures?.(fileConfig.features);
      }
      const fileApiBaseUrl = usableFileApiBaseUrl(fileConfig?.apiBaseUrl);
      const savedBaseUrl = normalizeBaseUrl(
        window.TarotAppConfig?.getApiBaseUrl?.() || readConfiguredConnectionSettings().apiBaseUrl
      );
      const bootstrapUrls = [];
      const pushBootstrap = (value) => {
        const url = normalizeBaseUrl(value);
        if (url && !bootstrapUrls.includes(url)) bootstrapUrls.push(url);
      };
      pushBootstrap(savedBaseUrl);
      pushBootstrap(fileApiBaseUrl);
      if (!isNativeShell() && isLoopbackHost(window.location.hostname)) {
        pushBootstrap("http://127.0.0.1:3100");
        pushBootstrap("http://localhost:3100");
      } else if (!isNativeShell() && window.location.hostname) {
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        apiSiblingCandidates(protocol, window.location.hostname).forEach(pushBootstrap);
        pushBootstrap(`${protocol}//${window.location.hostname}:3100`);
      }
      pushBootstrap(window.location.origin);
      let branding = null;
      for (const candidate of bootstrapUrls) {
        branding = await fetchBrandingPayload(candidate);
        if (branding) break;
      }
      const serverApiBaseUrl = normalizeBaseUrl(branding?.payload?.apiBaseUrl);
      const publishedPort = String(branding?.payload?.apiPort || "").trim();
      let publishedApiBaseUrl = /^https?:\/\//i.test(serverApiBaseUrl) ? serverApiBaseUrl : "";
      if (publishedApiBaseUrl && publishedPort) {
        try {
          const published = new URL(publishedApiBaseUrl);
          if (!published.port) published.port = publishedPort;
          publishedApiBaseUrl = normalizeBaseUrl(published.href);
        } catch (_error) {}
      }
      const reachableApiBaseUrl = preferReachableBase(publishedApiBaseUrl, branding?.base);
      if (reachableApiBaseUrl && reachableApiBaseUrl !== branding?.base) {
        const preferred = await fetchBrandingPayload(reachableApiBaseUrl);
        if (preferred) branding = preferred;
      }
      if (branding) {
        await applyRemoteBranding(branding.payload, branding.base);
      }

      if (shouldApplyConnectionDefault()) {
        const learnedServerDefault = Boolean(branding);
        const loopbackFallback = !isNativeShell() && isLoopbackHost(window.location.hostname)
          ? "http://localhost:3100"
          : "";
        const nextUrl = reachableApiBaseUrl || fileApiBaseUrl || loopbackFallback;
        const saved = readConfiguredConnectionSettings();
        const nextKey = nextUrl
          ? (saved.apiKey || normalizeApiKey(fileConfig?.apiKey))
          : saved.apiKey;
        const canReplace = Boolean(nextUrl) || learnedServerDefault;
        if (canReplace && (nextUrl !== saved.apiBaseUrl || nextKey !== saved.apiKey)) {
          window.TarotAppConfig?.updateConnectionSettings?.({
            apiBaseUrl: nextUrl,
            apiKey: nextKey
          }, { asDefault: true });
        }
      }

      // Theme: apply server default only when the user has not chosen one yet.
      window.TarotUiTheme?.applyServerThemeDefaults?.(serverDefaults, {
        onlyIfUnset: true
      });

      document.dispatchEvent(new CustomEvent("config:defaults-loaded", {
        detail: {
          defaults: { ...serverDefaults },
          branding: { ...brandingConfig },
          hasUserSavedSettings: hasUserSavedSettings()
        }
      }));

      return true;
    } catch (_error) {
      return false;
    }
  }

  stripLegacyCredentialParams();

  const initialConnectionSettings = readConfiguredConnectionSettings();
  const initialConnectionAccess = normalizeConnectionAccess(null);

  window.TarotAppConfig = {
    ...(window.TarotAppConfig || {}),
    apiBaseUrl: initialConnectionSettings.apiBaseUrl,
    apiKey: initialConnectionSettings.apiKey,
    connectionAccess: initialConnectionAccess,
    serverDefaults: {},
    branding: {
      title: "KABBAK",
      homeLabel: "KABBAK",
      logoUrl: ""
    },
    features: normalizeFeatures(null),
    isFeatureEnabled(featureName) {
      return this.features?.[featureName] === true;
    },
    getFeatures() {
      return { ...normalizeFeatures(this.features) };
    },
    updateFeatures(nextFeatures = null) {
      const previous = this.getFeatures();
      const current = normalizeFeatures({ ...previous, ...(nextFeatures || {}) });
      this.features = current;

      const changed = Object.keys(current).some((key) => previous[key] !== current[key]);
      if (changed) {
        document.dispatchEvent(new CustomEvent("features:updated", {
          detail: { previous, current: { ...current } }
        }));
      }

      return { ...current };
    },
    getApiBaseUrl() {
      return normalizeBaseUrl(this.apiBaseUrl);
    },
    getApiKey() {
      return normalizeApiKey(this.apiKey);
    },
    isConnectionConfigured() {
      return Boolean(this.getApiBaseUrl());
    },
    getConnectionSettings() {
      return {
        apiBaseUrl: this.getApiBaseUrl(),
        apiKey: this.getApiKey()
      };
    },
    getConnectionAccess() {
      // Stored access is already normalized (updateConnectionAccess). Re-running
      // normalizeConnectionAccess here would treat the flattened object as an
      // un-normalized probe source and wipe authenticated/roles/scopes.
      return this.connectionAccess || defaultConnectionAccess;
    },
    isProfileAuthorized() {
      const access = this.getConnectionAccess();
      return access.authenticated === true && Boolean(String(access.clientId || "").trim());
    },
    hasPersonalFeatures() {
      return this.getConnectionAccess().personalFeatures === true;
    },
    hasTarotAccess() {
      return this.getConnectionAccess().capabilities.tarot === true;
    },
    hasAdminApiManagementAccess() {
      return this.getConnectionAccess().capabilities.adminApiManagement === true;
    },
    updateConnectionAccess(nextAccess = null) {
      const previous = this.getConnectionAccess();
      const current = normalizeConnectionAccess(nextAccess);
      this.connectionAccess = current;
      document.documentElement.dataset.personalFeatures = current.personalFeatures === true ? "on" : "off";

      if (!sameConnectionAccess(previous, current)) {
        document.dispatchEvent(new CustomEvent("connection:access-updated", {
          detail: {
            previous,
            current: { ...current, roles: [...current.roles], scopes: [...current.scopes], capabilities: { ...current.capabilities } }
          }
        }));
      }

      return current;
    },
    // Log out: drop the saved key (both storages) but keep the API base URL so
    // the gate is ready for another key or a new trial account.
    clearConnectionKey() {
      const previous = this.getConnectionSettings();
      try {
        window.localStorage.removeItem(apiKeyStorageKey);
      } catch (_error) {}
      try {
        window.sessionStorage.removeItem(apiKeyStorageKey);
      } catch (_error) {}

      this.apiKey = "";

      document.dispatchEvent(new CustomEvent("connection:updated", {
        detail: {
          previous,
          current: { apiBaseUrl: this.getApiBaseUrl(), apiKey: "" }
        }
      }));

      return { ...previous };
    },
    updateConnectionSettings(nextSettings = {}, options = {}) {
      const previous = this.getConnectionSettings();
      const current = normalizeConnectionSettings({
        ...previous,
        ...nextSettings
      });
      const persistResult = persistConnectionSettings(current);

      this.apiBaseUrl = current.apiBaseUrl;
      this.apiKey = current.apiKey;
      if (options.asDefault === true) {
        writeBaseUrlOrigin(current.apiBaseUrl ? "default" : "");
      } else if (current.apiBaseUrl) {
        writeBaseUrlOrigin("user");
      } else {
        writeBaseUrlOrigin("");
      }

      if (previous.apiBaseUrl !== current.apiBaseUrl || previous.apiKey !== current.apiKey) {
        document.dispatchEvent(new CustomEvent("connection:updated", {
          detail: {
            previous,
            current: { ...current }
          }
        }));
      }

      return {
        ...current,
        didPersist: persistResult.didPersist,
        didPersistSession: persistResult.didPersistSession
      };
    },
    getConnectionStorageHealth,
    loadConfigDefaults,
    applyConnectedBranding,
    getAppliedBrandingBase() {
      return appliedBrandingBase;
    },
    getServerDefaults() {
      return { ...(this.serverDefaults || serverDefaults || {}) };
    },
    getBranding() {
      return { ...(this.branding || brandingConfig || {}) };
    },
    applyOverlayBackground,
    applyFavicon,
    hasUserSavedSettings
  };

  applyCachedBranding();
})();