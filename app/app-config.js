(function () {
  const apiBaseUrlStorageKey = "tarot-time-api-base-url";
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
    })
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
    const tarotCapability = source?.capabilities?.tarot === true
      || (connected && !apiKeyRequired)
      || accessLevel === "premium";
    const adminApiManagementCapability = source?.capabilities?.adminApiManagement === true
      || roles.includes("admin")
      || scopes.includes("api:admin");

    return {
      connected,
      apiKeyRequired,
      authenticated,
      clientId: String(auth?.clientId || source?.clientId || "").trim(),
      accountId: String(auth?.accountId || source?.accountId || "").trim(),
      accessLevel,
      roles,
      scopes,
      capabilities: {
        tarot: tarotCapability,
        adminApiManagement: adminApiManagementCapability
      }
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

    return normalizeConnectionSettings({
      apiBaseUrl: storedBaseUrl,
      apiKey: storedApiKey
    });
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

  let serverDefaults = Object.freeze({});
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
    if (logoSetting === "" || logoSetting == null) {
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

  function applyBranding(branding, logoUrl = "") {
    const title = String(branding?.title || "KABBAK").trim() || "KABBAK";
    const homeLabel = String(branding?.homeLabel || title).trim() || title;
    document.title = title;

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

  function hasUserSavedSettings() {
    try {
      return Boolean(String(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "").trim());
    } catch {
      return false;
    }
  }

  async function loadConfigDefaults() {
    // Query apiBaseUrl still wins for connection, but branding/defaults always load.
    try {
      const configResponse = await fetch(`config.json?_=${Date.now()}`, { cache: "no-cache" });
      if (!configResponse.ok) {
        brandingConfig = Object.freeze({
          title: "KABBAK",
          homeLabel: "KABBAK",
          logoUrl: ""
        });
        applyBranding(brandingConfig, "");
        return false;
      }

      const config = await configResponse.json().catch(() => null);
      if (!config || typeof config !== "object") {
        return false;
      }

      window.TarotAppConfig?.updateFeatures?.(config.features);

      const nextDefaults = normalizeServerDefaults(config.defaults);
      serverDefaults = Object.freeze({ ...nextDefaults });
      window.TarotAppConfig.serverDefaults = { ...serverDefaults };

      const nextBranding = normalizeBranding(config.branding);
      const logoUrl = await resolveLogoUrl(nextBranding.logo);
      brandingConfig = Object.freeze({
        title: nextBranding.title,
        homeLabel: nextBranding.homeLabel,
        logoUrl
      });
      window.TarotAppConfig.branding = { ...brandingConfig };
      applyBranding(brandingConfig, logoUrl);

      // The browser tab title can be overridden from the Admin panel (served
      // by a public API endpoint). Apply it when the shell config knows the
      // API URL; otherwise the static branding title stays in place.
      const remoteBrandingApiBaseUrl = normalizeBaseUrl(config.apiBaseUrl);
      if (remoteBrandingApiBaseUrl) {
        try {
          const brandingResponse = await fetch(`${remoteBrandingApiBaseUrl}/api/v1/branding`, { cache: "no-cache" });
          if (brandingResponse.ok) {
            const brandingPayload = await brandingResponse.json().catch(() => null);
            const remoteTitle = String(brandingPayload?.title || "").trim();
            if (remoteTitle) {
              document.title = remoteTitle;
            }
            applyOverlayBackground(brandingPayload?.overlayBackgroundUrl, remoteBrandingApiBaseUrl);
          }
        } catch (_error) {
          // Optional enhancement; the static branding title stays in place.
        }
      }

      // Theme: apply server default only when the user has not chosen one yet.
      window.TarotUiTheme?.applyServerThemeDefaults?.(serverDefaults, {
        onlyIfUnset: true
      });

      if (!hasQueryApiBaseUrl()) {
        const configApiBaseUrl = normalizeBaseUrl(config.apiBaseUrl);
        const configApiKey = normalizeApiKey(config.apiKey);
        if (configApiBaseUrl || configApiKey) {
          // Server/config defaults must never wipe a user-saved connection:
          // the stored values win and the config only fills missing fields.
          const storedConnectionSettings = readConfiguredConnectionSettings();
          window.TarotAppConfig?.updateConnectionSettings?.({
            apiBaseUrl: storedConnectionSettings.apiBaseUrl || configApiBaseUrl,
            apiKey: storedConnectionSettings.apiKey || configApiKey
          });
        }
      }

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
    updateConnectionSettings(nextSettings = {}) {
      const previous = this.getConnectionSettings();
      const current = normalizeConnectionSettings({
        ...previous,
        ...nextSettings
      });
      const persistResult = persistConnectionSettings(current);

      this.apiBaseUrl = current.apiBaseUrl;
      this.apiKey = current.apiKey;

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
    getServerDefaults() {
      return { ...(this.serverDefaults || serverDefaults || {}) };
    },
    getBranding() {
      return { ...(this.branding || brandingConfig || {}) };
    },
    applyOverlayBackground,
    hasUserSavedSettings
  };
})();