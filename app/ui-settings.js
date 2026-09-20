(function () {
  "use strict";

  const SETTINGS_STORAGE_KEY = "tarot-time-settings-v1";
  const SETTINGS_LAST_SAVED_AT_STORAGE_KEY = "tarot-time-settings-last-saved-at-v1";

  let config = {
    defaultSettings: {
      latitude: 51.5074,
      longitude: -0.1278,
      timeFormat: "minutes",
      birthDate: "",
      birthTime: "",
      tarotDeck: "",
      stellariumBackgroundEnabled: false,
      detailTextScale: 1,
      menuLayout: "drawer",
      hasExplicitLocation: false
    },
    onSettingsApplied: null,
    onSyncSkyBackground: null,
    onStatus: null,
    onConnectionSaved: null,
    onReopenActiveSection: null,
    setActiveSection: null,
    getActiveSection: null
  };

  let lastConnectionProbeResult = null;
  let cachedProfileLocation = null;
  let profileLocationPromise = null;

  function getElements() {
    return {
      openSettingsEl: document.getElementById("open-settings"),
      nowLocationLabelEl: document.getElementById("now-location-label"),
      nowLocationCoordsEl: document.getElementById("now-location-coords"),
      nowLocationEditEl: document.getElementById("now-location-edit"),
      timeFormatEl: document.getElementById("time-format"),
      nowTimeFormatEl: document.getElementById("now-time-format"),
      birthDateEl: document.getElementById("birth-date"),
      birthTimeEl: document.getElementById("birth-time"),
      detailTextScaleEl: document.getElementById("detail-text-scale"),
      detailTextScaleValueEl: document.getElementById("detail-text-scale-value"),
      menuLayoutEl: document.getElementById("menu-layout"),
      nowTarotDeckEl: document.getElementById("now-tarot-deck"),
      nowDeckFieldEl: document.getElementById("now-deck-field"),
      apiBaseUrlEl: document.getElementById("api-base-url"),
      apiKeyEl: document.getElementById("api-key"),
      apiConnectionSummaryEl: document.getElementById("api-connection-summary"),
      apiConnectionSummaryStateEl: document.getElementById("api-connection-summary-state"),
      apiConnectionSummaryClientEl: document.getElementById("api-connection-summary-client"),
      apiConnectionSummaryAccessEl: document.getElementById("api-connection-summary-access"),
      apiConnectionSummaryPermissionsEl: document.getElementById("api-connection-summary-permissions"),
      settingsPageStatusEl: document.getElementById("settings-page-status"),
      settingsPageStatusTextEl: document.getElementById("settings-page-status-text"),
      settingsPageStatusTimeEl: document.getElementById("settings-page-status-time"),
      saveSettingsEl: document.getElementById("save-settings"),
      nowSettingsSaveEl: document.getElementById("now-settings-save"),
      nowSettingsStatusEl: document.getElementById("now-settings-status"),
      stellariumBackgroundEl: document.getElementById("now-stellarium-toggle")
        || document.getElementById("stellarium-background")
    };
  }

  function loadLastSavedAt() {
    try {
      const raw = window.localStorage.getItem(SETTINGS_LAST_SAVED_AT_STORAGE_KEY);
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  function persistLastSavedAt(timestamp) {
    try {
      window.localStorage.setItem(SETTINGS_LAST_SAVED_AT_STORAGE_KEY, String(timestamp));
      return true;
    } catch {
      return false;
    }
  }

  function formatLastSavedAt(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return "";
    }

    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(timestamp));
    } catch {
      return new Date(timestamp).toLocaleString();
    }
  }

  function setSettingsPageStatus(message, tone = "neutral", options = {}) {
    const {
      settingsPageStatusEl,
      settingsPageStatusTextEl,
      settingsPageStatusTimeEl
    } = getElements();

    if (settingsPageStatusEl) {
      settingsPageStatusEl.dataset.tone = String(tone || "neutral");
    }

    if (settingsPageStatusTextEl) {
      settingsPageStatusTextEl.textContent = String(message || "Settings ready.");
    }

    const savedAt = options.savedAt === undefined ? loadLastSavedAt() : options.savedAt;
    const formattedSavedAt = formatLastSavedAt(savedAt);
    if (settingsPageStatusTimeEl) {
      settingsPageStatusTimeEl.hidden = !formattedSavedAt;
      settingsPageStatusTimeEl.textContent = formattedSavedAt ? `Last saved ${formattedSavedAt}` : "";
    }
  }

  function syncSavedSettingsStatus(message = "Settings ready.") {
    setSettingsPageStatus(message, "neutral", { savedAt: loadLastSavedAt() });
  }

  function setSaveButtonBusy(isBusy) {
    const { saveSettingsEl } = getElements();
    if (!saveSettingsEl) {
      return;
    }

    if (!saveSettingsEl.dataset.defaultLabel) {
      saveSettingsEl.dataset.defaultLabel = String(saveSettingsEl.textContent || "Save Settings").trim() || "Save Settings";
    }

    saveSettingsEl.disabled = Boolean(isBusy);
    saveSettingsEl.textContent = isBusy ? "Saving..." : saveSettingsEl.dataset.defaultLabel;
  }

  // The Sky page now follows the Profile location instead of local lat/long.
  function resolveProfileGeo() {
    const location = window.ProfileUi?.getLocation?.() || cachedProfileLocation;
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    if (
      Number.isFinite(latitude)
      && Number.isFinite(longitude)
      && Math.abs(latitude) <= 90
      && Math.abs(longitude) <= 180
    ) {
      return { latitude, longitude, label: String(location?.label || "").trim() };
    }
    return null;
  }

  // Profile module is lazy-loaded, so fetch the saved location once the API
  // connection is up and cache it for the Sky page.
  async function loadProfileLocation() {
    if (window.ProfileUi?.getLocation?.()) {
      return cachedProfileLocation;
    }
    if (profileLocationPromise) {
      return profileLocationPromise;
    }
    profileLocationPromise = (async () => {
      try {
        const service = window.TarotDataService;
        const summary = await service?.requestJson?.("GET", service.buildApiUrl("/api/v1/profile"));
        const location = summary?.location && typeof summary.location === "object"
          ? summary.location
          : null;
        if (!location) {
          return null;
        }
        cachedProfileLocation = location;
        document.dispatchEvent(new CustomEvent("profile:location-updated", { detail: { location } }));
        return location;
      } catch (_error) {
        return null;
      } finally {
        profileLocationPromise = null;
      }
    })();
    return profileLocationPromise;
  }

  function renderProfileLocation() {
    const { nowLocationLabelEl, nowLocationCoordsEl } = getElements();
    const geo = resolveProfileGeo();
    if (nowLocationLabelEl) {
      nowLocationLabelEl.textContent = geo?.label || (geo ? "Profile location" : "Not set");
    }
    if (nowLocationCoordsEl) {
      nowLocationCoordsEl.textContent = geo
        ? `${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`
        : "Set your location on the Profile page; Sky uses it automatically.";
    }
  }

  function hasExplicitLocationEntry() {
    return Boolean(resolveProfileGeo());
  }

  function hasValidLocationInputs() {
    return Boolean(resolveProfileGeo());
  }

  function syncStellariumBackgroundAvailability() {
    const { stellariumBackgroundEl, stellariumBackgroundHintEl } = getElements();
    if (!stellariumBackgroundEl) {
      return;
    }

    const hasValidLocation = hasValidLocationInputs();
    stellariumBackgroundEl.disabled = !hasValidLocation;

    if (!hasValidLocation && stellariumBackgroundEl.checked) {
      stellariumBackgroundEl.checked = false;
    }

    if (stellariumBackgroundHintEl) {
      stellariumBackgroundHintEl.textContent = hasValidLocation
        ? "Uses your Profile location to load the live sky background."
        : "Set your location on the Profile page before enabling the live sky background.";
    }
  }

  function markLocationAsExplicit() {
    renderProfileLocation();
    syncStellariumBackgroundAvailability();
  }
  function getConnectionSettings() {
    return window.TarotAppConfig?.getConnectionSettings?.() || {
      apiBaseUrl: String(window.TarotAppConfig?.apiBaseUrl || "").trim(),
      apiKey: String(window.TarotAppConfig?.apiKey || "").trim()
    };
  }

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function syncConnectionInputs() {
    const { apiBaseUrlEl, apiKeyEl } = getElements();
    const connectionSettings = getConnectionSettings();

    if (apiBaseUrlEl) {
      apiBaseUrlEl.value = String(connectionSettings.apiBaseUrl || "");
    }

    if (apiKeyEl) {
      apiKeyEl.value = String(connectionSettings.apiKey || "");
    }
  }

  function hasConnectionChanged(previous, next) {
    return String(previous?.apiBaseUrl || "").trim() !== String(next?.apiBaseUrl || "").trim()
      || String(previous?.apiKey || "").trim() !== String(next?.apiKey || "").trim();
  }

  function normalizeConnectionValues(values) {
    return Array.isArray(values)
      ? values.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
  }

  function hasAdminCapability(auth) {
    const roles = normalizeConnectionValues(auth?.roles);
    const scopes = normalizeConnectionValues(auth?.scopes);
    return roles.includes("admin") || scopes.includes("api:admin");
  }

  function formatConnectionValues(values, fallback = "none") {
    const normalized = normalizeConnectionValues(values);
    return normalized.length ? normalized.join(", ") : fallback;
  }

  function setConnectionSummary(result = null) {
    const {
      apiConnectionSummaryEl,
      apiConnectionSummaryStateEl,
      apiConnectionSummaryClientEl,
      apiConnectionSummaryAccessEl,
      apiConnectionSummaryPermissionsEl
    } = getElements();

    if (!apiConnectionSummaryEl) {
      return;
    }

    if (!result) {
      apiConnectionSummaryEl.dataset.tone = "neutral";
      if (apiConnectionSummaryStateEl) {
        apiConnectionSummaryStateEl.textContent = "Not checked yet.";
      }
      if (apiConnectionSummaryClientEl) {
        apiConnectionSummaryClientEl.textContent = "No authenticated API identity.";
      }
      if (apiConnectionSummaryAccessEl) {
        apiConnectionSummaryAccessEl.textContent = "Unknown";
      }
      if (apiConnectionSummaryPermissionsEl) {
        apiConnectionSummaryPermissionsEl.textContent = "Save settings to validate this API key.";
      }
      return;
    }

    const tone = result.ok ? "success" : (result.reason === "auth-required" ? "warning" : "error");
    const auth = result.auth || result.health?.auth || {};
    const roles = normalizeConnectionValues(auth.roles);
    const scopes = normalizeConnectionValues(auth.scopes);
    const authenticated = auth.authenticated === true;
    const tarotAccessEnabled = result?.capabilities?.tarot === true;
    const accessValue = authenticated
      ? `${String(auth.accessLevel || "premium").trim() || "premium"}${hasAdminCapability(auth) ? " - admin capable" : ""}${tarotAccessEnabled ? " - tarot enabled" : " - tarot hidden"}`
      : (result.health?.apiKeyRequired ? "API key required" : "public");
    const permissionsValue = authenticated
      ? `roles: ${formatConnectionValues(roles)} | scopes: ${formatConnectionValues(scopes)}`
      : (result.message || "Unable to validate the API connection.");

    apiConnectionSummaryEl.dataset.tone = tone;
    if (apiConnectionSummaryStateEl) {
      apiConnectionSummaryStateEl.textContent = result.ok
        ? `Connected${Number.isInteger(result.deckCount) ? ` • ${result.deckCount} deck${result.deckCount === 1 ? "" : "s"}` : ""}`
        : String(result.message || "Unable to validate the API connection.");
    }
    if (apiConnectionSummaryClientEl) {
      apiConnectionSummaryClientEl.textContent = authenticated
        ? [String(auth.clientId || "").trim(), String(auth.accountId || "").trim()].filter(Boolean).join(" / ") || "Authenticated client"
        : (result.health?.apiKeyRequired ? "No valid API identity returned." : "Public access");
    }
    if (apiConnectionSummaryAccessEl) {
      apiConnectionSummaryAccessEl.textContent = accessValue;
    }
    if (apiConnectionSummaryPermissionsEl) {
      apiConnectionSummaryPermissionsEl.textContent = permissionsValue;
    }
  }

  async function refreshConnectionSummary(connectionSettings = getConnectionSettings(), { probeResult = null } = {}) {
    const apiBaseUrl = String(connectionSettings?.apiBaseUrl || "").trim();
    if (!apiBaseUrl) {
      lastConnectionProbeResult = null;
      setConnectionSummary(null);
      return null;
    }

    const result = probeResult || await window.TarotDataService?.probeConnection?.(connectionSettings) || null;
    lastConnectionProbeResult = result;
    setConnectionSummary(result);
    return result;
  }


  function setStatus(text) {
    if (typeof config.onStatus === "function") {
      config.onStatus(text);
    }
  }

  function applyExternalSettings(settings) {
    if (typeof config.onSettingsApplied === "function") {
      config.onSettingsApplied(settings);
    }
  }

  function syncDetailTextScaleLabel(detailTextScale) {
    const { detailTextScaleValueEl } = getElements();
    if (!detailTextScaleValueEl) {
      return;
    }

    detailTextScaleValueEl.textContent = `${Math.round(normalizeDetailTextScale(detailTextScale) * 100)}%`;
  }

  function syncSky(geo, options) {
    if (typeof config.onSyncSkyBackground === "function") {
      config.onSyncSkyBackground(geo, options);
    }
  }

  function normalizeTimeFormat(value) {
    if (value === "hours") {
      return "hours";
    }

    if (value === "seconds") {
      return "seconds";
    }

    return "minutes";
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, parsed));
  }

  function normalizeDetailTextScale(value) {
    return clampNumber(value, 0.85, 1.35, 1);
  }

  function normalizeMenuLayout(value) {
    return String(value || "").trim().toLowerCase() === "drawer" ? "drawer" : "panel";
  }

  function applyMenuLayout(menuLayout) {
    document.body.dataset.menuLayout = normalizeMenuLayout(menuLayout);
  }

  function syncUiSkinSelect() {
    const uiSkinEl = document.getElementById("ui-skin");
    if (!uiSkinEl) return;
    const skins = window.TaroTimePluginHost?.listSkins?.() || [];
    const active = window.TaroTimePluginHost?.getActiveSkin?.() || "";
    uiSkinEl.innerHTML = "";
    if (!skins.length) {
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Default layout";
      uiSkinEl.appendChild(defaultOption);
    }
    skins.forEach((skin) => {
      const option = document.createElement("option");
      option.value = skin.id;
      option.textContent = skin.name || skin.id;
      uiSkinEl.appendChild(option);
    });
    uiSkinEl.value = skins.some((skin) => skin.id === active) ? active : (skins[0]?.id || "");
  }

  function normalizeBirthDate(value) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return "";
    }

    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
  }

  function normalizeBirthTime(value) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return "";
    }
    const match = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) {
      return "";
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
      return "";
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function getKnownTarotDeckIds() {
    if (!hasTarotAccess()) {
      return new Set([String(config.defaultSettings?.tarotDeck || "ceremonial-magick").trim().toLowerCase()]);
    }

    const knownDeckIds = new Set();
    const deckOptions = window.TarotCardImages?.getDeckOptions?.();

    if (Array.isArray(deckOptions)) {
      deckOptions.forEach((option) => {
        const id = String(option?.id || "").trim().toLowerCase();
        if (id) {
          knownDeckIds.add(id);
        }
      });
    }

    if (!knownDeckIds.size) {
      knownDeckIds.add(String(config.defaultSettings?.tarotDeck || "ceremonial-magick").trim().toLowerCase());
    }

    return knownDeckIds;
  }

  function getFallbackTarotDeckId() {
    if (!hasTarotAccess()) {
      return String(config.defaultSettings?.tarotDeck || "ceremonial-magick").trim().toLowerCase();
    }

    const deckOptions = window.TarotCardImages?.getDeckOptions?.();
    if (Array.isArray(deckOptions)) {
      for (let i = 0; i < deckOptions.length; i += 1) {
        const id = String(deckOptions[i]?.id || "").trim().toLowerCase();
        if (id) {
          return id;
        }
      }
    }

    return String(config.defaultSettings?.tarotDeck || "ceremonial-magick").trim().toLowerCase();
  }

  function normalizeTarotDeck(value) {
    if (!hasTarotAccess()) {
      const preservedValue = String(value || "").trim().toLowerCase();
      return preservedValue || String(config.defaultSettings?.tarotDeck || "ceremonial-magick").trim().toLowerCase();
    }

    const normalized = String(value || "").trim().toLowerCase();
    const knownDeckIds = getKnownTarotDeckIds();

    if (knownDeckIds.has(normalized)) {
      return normalized;
    }

    return getFallbackTarotDeckId();
  }

  function parseStoredNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseStoredBoolean(value, fallback = false) {
    return typeof value === "boolean" ? value : fallback;
  }

  function hasLegacyExplicitLocation(settings, normalizedLatitude, normalizedLongitude) {
    const hasStoredCoordinates = Number.isFinite(Number(settings?.latitude)) && Number.isFinite(Number(settings?.longitude));
    if (!hasStoredCoordinates) {
      return false;
    }

    return Math.abs(normalizedLatitude - Number(config.defaultSettings.latitude)) > 0.00005
      || Math.abs(normalizedLongitude - Number(config.defaultSettings.longitude)) > 0.00005;
  }

  function normalizeSettings(settings) {
    const latitude = parseStoredNumber(settings?.latitude, config.defaultSettings.latitude);
    const longitude = parseStoredNumber(settings?.longitude, config.defaultSettings.longitude);
    const hasExplicitLocation = typeof settings?.hasExplicitLocation === "boolean"
      ? settings.hasExplicitLocation
      : hasLegacyExplicitLocation(settings, latitude, longitude);
    const activeDeckFallback = String(window.TarotCardImages?.getActiveDeck?.() || "").trim();

    return {
      latitude,
      longitude,
      timeFormat: normalizeTimeFormat(settings?.timeFormat),
      birthDate: normalizeBirthDate(settings?.birthDate),
      birthTime: normalizeBirthTime(settings?.birthTime),
      tarotDeck: normalizeTarotDeck(settings?.tarotDeck || activeDeckFallback || config.defaultSettings.tarotDeck),
      detailTextScale: normalizeDetailTextScale(settings?.detailTextScale),
      menuLayout: normalizeMenuLayout(settings?.menuLayout),
      stellariumBackgroundEnabled: parseStoredBoolean(settings?.stellariumBackgroundEnabled, false) && hasExplicitLocation,
      hasExplicitLocation
    };
  }

  function getResolvedTimeZone() {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return String(timeZone || "");
    } catch {
      return "";
    }
  }

  function buildBirthDateParts(birthDate) {
    const normalized = normalizeBirthDate(birthDate);
    if (!normalized) {
      return null;
    }

    const [year, month, day] = normalized.split("-").map((value) => Number(value));
    if (!year || !month || !day) {
      return null;
    }

    const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0);
    const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    return {
      year,
      month,
      day,
      isoDate: normalized,
      localNoonIso: localNoon.toISOString(),
      utcNoonIso: utcNoon.toISOString(),
      timezoneOffsetMinutesAtNoon: localNoon.getTimezoneOffset()
    };
  }

  function buildNatalContext(settings) {
    const normalized = normalizeSettings(settings);
    const birthDateParts = buildBirthDateParts(normalized.birthDate);
    const timeZone = getResolvedTimeZone();

    return {
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      birthDate: normalized.birthDate || null,
      birthTime: normalized.birthTime || null,
      birthDateParts,
      timeZone: timeZone || "UTC",
      timezoneOffsetMinutesNow: new Date().getTimezoneOffset(),
      timezoneOffsetMinutesAtBirthDateNoon: birthDateParts?.timezoneOffsetMinutesAtNoon ?? null
    };
  }

  function emitSettingsUpdated(settings) {
    const normalized = normalizeSettings(settings);
    const natalContext = buildNatalContext(normalized);
    document.dispatchEvent(new CustomEvent("settings:updated", {
      detail: {
        settings: normalized,
        natalContext
      }
    }));
  }

  function loadSavedSettings() {
    let normalized;
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      normalized = raw ? normalizeSettings(JSON.parse(raw)) : { ...config.defaultSettings };
    } catch {
      normalized = { ...config.defaultSettings };
    }

    // Profile location overrides any locally stored coordinates.
    const profileGeo = resolveProfileGeo();
    if (profileGeo) {
      normalized = normalizeSettings({
        ...normalized,
        latitude: profileGeo.latitude,
        longitude: profileGeo.longitude,
        hasExplicitLocation: true
      });
    }
    return normalized;
  }

  function saveSettings(settings) {
    try {
      const normalized = normalizeSettings(settings);
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
      return true;
    } catch {
      return false;
    }
  }

  // Time format and birth date now live on the Profile page. Persist them the
  // moment they change instead of waiting for the Settings Save button.
  function persistProfileTimingFields() {
    const { timeFormatEl, birthDateEl, birthTimeEl, nowTimeFormatEl } = getElements();
    const saved = loadSavedSettings();
    const next = normalizeSettings({
      ...saved,
      timeFormat: normalizeTimeFormat(nowTimeFormatEl?.value || timeFormatEl?.value || saved.timeFormat),
      birthDate: normalizeBirthDate(birthDateEl?.value || saved.birthDate),
      birthTime: normalizeBirthTime(birthTimeEl?.value || saved.birthTime)
    });
    saveSettings(next);
    emitSettingsUpdated(next);

    const statusEl = document.getElementById("profile-timing-status");
    if (statusEl) {
      statusEl.textContent = "Saved.";
      window.clearTimeout(persistProfileTimingFields._timer);
      persistProfileTimingFields._timer = window.setTimeout(() => {
        statusEl.textContent = "";
      }, 2000);
    }
  }

  function fillDeckSelect(selectEl, deckOptions, selectedDeckId, unavailableLabel) {
    if (!selectEl) {
      return;
    }

    const previousValue = String(
      selectEl.value
      || selectedDeckId
      || loadSavedSettings().tarotDeck
      || window.TarotCardImages?.getActiveDeck?.()
      || ""
    ).trim().toLowerCase();

    selectEl.innerHTML = "";

    if (!hasTarotAccess()) {
      const hiddenOption = document.createElement("option");
      hiddenOption.value = String(config.defaultSettings?.tarotDeck || "ceremonial-magick").trim().toLowerCase();
      hiddenOption.textContent = unavailableLabel || "Tarot deck unavailable for this API key";
      selectEl.appendChild(hiddenOption);
      selectEl.disabled = true;
      return;
    }

    if (!Array.isArray(deckOptions) || !deckOptions.length) {
      const emptyOption = document.createElement("option");
      emptyOption.value = String(config.defaultSettings?.tarotDeck || "ceremonial-magick").trim().toLowerCase();
      emptyOption.textContent = "No deck manifests found";
      selectEl.appendChild(emptyOption);
      selectEl.disabled = true;
      return;
    }

    selectEl.disabled = false;
    deckOptions.forEach((option) => {
      const id = String(option?.id || "").trim().toLowerCase();
      if (!id) {
        return;
      }
      const optionEl = document.createElement("option");
      optionEl.value = id;
      optionEl.textContent = String(option?.label || id);
      selectEl.appendChild(optionEl);
    });
    selectEl.value = normalizeTarotDeck(previousValue);
  }

  function syncTarotDeckInputOptions() {
    const {
      nowTarotDeckEl,
      nowDeckFieldEl
    } = getElements();
    const tarotVisible = hasTarotAccess();

    if (nowDeckFieldEl) {
      nowDeckFieldEl.hidden = !tarotVisible;
    }

    const deckOptions = window.TarotCardImages?.getDeckOptions?.() || [];
    const selectedDeckId = loadSavedSettings().tarotDeck || window.TarotCardImages?.getActiveDeck?.() || "";
    fillDeckSelect(nowTarotDeckEl, deckOptions, selectedDeckId);
  }

  function syncActiveTarotDeck(deckId) {
    const normalizedDeckId = normalizeTarotDeck(deckId);
    const { nowTarotDeckEl, nowDeckFieldEl } = getElements();
    const tarotVisible = hasTarotAccess();

    if (nowDeckFieldEl) {
      nowDeckFieldEl.hidden = !tarotVisible;
    }

    if (!tarotVisible) {
      return;
    }

    if (window.TarotCardImages?.setActiveDeck) {
      window.TarotCardImages.setActiveDeck(normalizedDeckId);
    }
    if (nowTarotDeckEl) {
      nowTarotDeckEl.value = normalizedDeckId;
    }
  }

  function applySettingsToInputs(settings) {
    const {
      timeFormatEl,
      nowTimeFormatEl,
      birthDateEl,
      birthTimeEl,
      detailTextScaleEl,
      menuLayoutEl,
      nowTarotDeckEl,
      nowDeckFieldEl,
      stellariumBackgroundEl
    } = getElements();
    syncConnectionInputs();
    const normalized = normalizeSettings(settings);
    if (timeFormatEl) {
      timeFormatEl.value = normalized.timeFormat;
    }
    if (nowTimeFormatEl) {
      nowTimeFormatEl.value = normalized.timeFormat;
    }
    if (birthDateEl) {
      birthDateEl.value = normalized.birthDate;
    }
    if (birthTimeEl) {
      birthTimeEl.value = normalized.birthTime;
    }
    if (detailTextScaleEl) {
      detailTextScaleEl.value = String(Math.round(normalized.detailTextScale * 100));
    }
    syncDetailTextScaleLabel(normalized.detailTextScale);
    if (menuLayoutEl) {
      menuLayoutEl.value = normalized.menuLayout;
    }
    applyMenuLayout(normalized.menuLayout);
    renderProfileLocation();
    if (stellariumBackgroundEl) {
      stellariumBackgroundEl.checked = normalized.stellariumBackgroundEnabled;
    }
    syncTarotDeckInputOptions();
    if (nowTarotDeckEl) {
      nowTarotDeckEl.value = normalizeTarotDeck(normalized.tarotDeck);
    }
    if (nowDeckFieldEl) {
      nowDeckFieldEl.hidden = !hasTarotAccess();
    }
    syncActiveTarotDeck(normalized.tarotDeck);
    syncStellariumBackgroundAvailability();
    applyExternalSettings(normalized);
    return normalized;
  }

  function getSettingsFromInputs() {
    const {
      timeFormatEl,
      nowTimeFormatEl,
      birthDateEl,
      birthTimeEl,
      detailTextScaleEl,
      menuLayoutEl,
      stellariumBackgroundEl
    } = getElements();
    const saved = loadSavedSettings();
    const profileGeo = resolveProfileGeo();
    const latitude = profileGeo ? profileGeo.latitude : Number(saved.latitude);
    const longitude = profileGeo ? profileGeo.longitude : Number(saved.longitude);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new Error("Set your location on the Profile page before saving settings.");
    }
    const timeFormatValue = nowTimeFormatEl?.value || timeFormatEl?.value || saved.timeFormat;

    // tarotDeck is no longer chosen in main settings (legacy removed); preserve current
    const deckValue = saved.tarotDeck || window.TarotCardImages?.getActiveDeck?.();

    return normalizeSettings({
      latitude,
      longitude,
      timeFormat: normalizeTimeFormat(timeFormatValue),
      birthDate: normalizeBirthDate(birthDateEl?.value || saved.birthDate),
      birthTime: normalizeBirthTime(birthTimeEl?.value || saved.birthTime),
      tarotDeck: normalizeTarotDeck(deckValue),
      detailTextScale: normalizeDetailTextScale(Number(detailTextScaleEl?.value || Math.round((saved.detailTextScale || 1) * 100)) / 100),
      menuLayout: normalizeMenuLayout(menuLayoutEl?.value || saved.menuLayout),
      stellariumBackgroundEnabled: Boolean(stellariumBackgroundEl?.checked),
      hasExplicitLocation: Boolean(profileGeo)
        || hasExplicitLocationEntry()
        || Boolean(saved.hasExplicitLocation)
    });
  }

  function setNowSettingsStatus(message, tone = "info") {
    const { nowSettingsStatusEl } = getElements();
    if (!nowSettingsStatusEl) {
      return;
    }
    nowSettingsStatusEl.textContent = String(message || "");
    nowSettingsStatusEl.dataset.tone = String(tone || "info");
  }

  async function saveSkySettingsFromPanel(options = {}) {
    const previous = loadSavedSettings();
    const settings = getSettingsFromInputs();
    const normalized = applySettingsToInputs(settings);
    const didPersist = saveSettings(normalized);

    // Apply deck immediately so Sky card image resolution uses the new deck
    // before the panel refresh runs.
    if (normalized.tarotDeck && typeof window.TarotCardImages?.setActiveDeck === "function") {
      window.TarotCardImages.setActiveDeck(normalized.tarotDeck);
    }

    emitSettingsUpdated(normalized);
    syncSky(
      { latitude: normalized.latitude, longitude: normalized.longitude },
      {
        force: true,
        backgroundEnabled: normalized.stellariumBackgroundEnabled,
        hasExplicitLocation: normalized.hasExplicitLocation
      }
    );

    const geoChanged = Math.abs(Number(previous.latitude) - Number(normalized.latitude)) > 0.00005
      || Math.abs(Number(previous.longitude) - Number(normalized.longitude)) > 0.00005;
    const deckChanged = String(previous.tarotDeck || "") !== String(normalized.tarotDeck || "");
    const timeFormatChanged = String(previous.timeFormat || "") !== String(normalized.timeFormat || "");

    // The panel is the only live surface; the calendar re-renders when opened.
    window.TarotAppRuntime?.refreshNowPanel?.({
      forceSky: true,
      forceCards: deckChanged || timeFormatChanged
    });

    if (options.quiet !== true) {
      setNowSettingsStatus(
        didPersist ? "Saved." : "Applied for this session (storage unavailable).",
        didPersist ? "success" : "info"
      );
      setStatus(didPersist ? "Sky settings saved." : "Sky settings applied for this session.");
    }

    return normalized;
  }

  function getConnectionSettingsFromInputs() {
    const { apiBaseUrlEl, apiKeyEl } = getElements();

    return {
      apiBaseUrl: String(apiBaseUrlEl?.value || "").trim(),
      apiKey: String(apiKeyEl?.value || "").trim()
    };
  }

  function openSettingsPopup() {
    applySettingsToInputs(loadSavedSettings());
    syncUiSkinSelect();
    syncTarotDeckInputOptions();
    syncSavedSettingsStatus();
    void refreshConnectionSummary(getConnectionSettings(), {
      probeResult: lastConnectionProbeResult
    });
    config.setActiveSection?.("settings");
  }

  async function handleSaveSettings() {
    setSaveButtonBusy(true);
    setSettingsPageStatus("Saving settings...", "info");

    try {
      const settings = getSettingsFromInputs();
      const previousConnectionSettings = getConnectionSettings();
      const connectionSettings = getConnectionSettingsFromInputs();
      const connectionChanged = hasConnectionChanged(previousConnectionSettings, connectionSettings);

      if (connectionChanged) {
        setSettingsPageStatus("Validating API connection...", "info", {
          savedAt: loadLastSavedAt()
        });

        const probeResult = await window.TarotDataService?.probeConnection?.(connectionSettings);
        if (!probeResult?.ok) {
          setConnectionSummary(probeResult);
          throw new Error(probeResult?.message || "Unable to validate the API connection.");
        }

        lastConnectionProbeResult = probeResult;
        setConnectionSummary(probeResult);
      }

      const connectionResult = window.TarotAppConfig?.updateConnectionSettings?.(connectionSettings) || { didPersist: true };
      const normalized = applySettingsToInputs(settings);
      syncSky(
        { latitude: normalized.latitude, longitude: normalized.longitude },
        {
          force: true,
          backgroundEnabled: normalized.stellariumBackgroundEnabled,
          hasExplicitLocation: normalized.hasExplicitLocation
        }
      );
      const didPersist = saveSettings(normalized);
      emitSettingsUpdated(normalized);
      const activeSection = typeof config.getActiveSection === "function" ? config.getActiveSection() : "home";
      if (activeSection && activeSection !== "home" && activeSection !== "profile") {
        config.onReopenActiveSection?.(activeSection);
      }
      if (connectionChanged && typeof config.onConnectionSaved === "function") {
        await config.onConnectionSaved(connectionResult, connectionSettings);
      }

      if (!didPersist || connectionResult.didPersist === false) {
        setSettingsPageStatus("Settings applied for this session. Browser storage is unavailable.", "warning", {
          savedAt: loadLastSavedAt()
        });
        setStatus("Settings applied for this session. Browser storage is unavailable.");
      } else {
        const savedAt = Date.now();
        persistLastSavedAt(savedAt);
        setSettingsPageStatus("Settings saved.", "success", { savedAt });
        setStatus("Settings saved.");
      }
    } catch (error) {
      setSettingsPageStatus(error?.message || "Unable to save settings.", "error", {
        savedAt: loadLastSavedAt()
      });
      setStatus(error?.message || "Unable to save settings.");
    } finally {
      setSaveButtonBusy(false);
    }
  }

  function persistLocationAndRefresh(latitude, longitude, options = {}) {
    const { stellariumBackgroundEl, nowTimeFormatEl } = getElements();
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(longitude);
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
      return null;
    }

    markLocationAsExplicit();

    const current = loadSavedSettings();
    const backgroundEnabled = typeof options.backgroundEnabled === "boolean"
      ? options.backgroundEnabled
      : Boolean(stellariumBackgroundEl?.checked);
    const normalized = normalizeSettings({
      ...current,
      latitude: nextLatitude,
      longitude: nextLongitude,
      timeFormat: normalizeTimeFormat(nowTimeFormatEl?.value || current.timeFormat),
      tarotDeck: current.tarotDeck,
      stellariumBackgroundEnabled: backgroundEnabled,
      hasExplicitLocation: true
    });

    applySettingsToInputs(normalized);
    saveSettings(normalized);
    emitSettingsUpdated(normalized);
    syncSky(
      { latitude: normalized.latitude, longitude: normalized.longitude },
      {
        force: true,
        backgroundEnabled: normalized.stellariumBackgroundEnabled,
        hasExplicitLocation: true
      }
    );

    if (options.render !== false) {
      window.TarotAppRuntime?.refreshNowPanel?.({ forceSky: true });
    }

    return normalized;
  }

  function openProfileLocation() {
    const sectionState = window.TarotSectionStateUi;
    if (typeof sectionState?.setActiveSection === "function") {
      sectionState.setActiveSection("settings");
    } else {
      document.dispatchEvent(new CustomEvent("nav:profile"));
      window.ProfileUi?.setProfileTab?.("settings");
    }
    window.setTimeout(() => {
      document.getElementById("profile-location-lat")?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }, 120);
  }

  function bindInteractions() {
    const {
      saveSettingsEl,
      nowSettingsSaveEl,
      openSettingsEl,
      detailTextScaleEl,
      menuLayoutEl,
      nowTimeFormatEl,
      timeFormatEl,
      birthDateEl,
      birthTimeEl,
      nowTarotDeckEl,
      nowLocationEditEl,
      stellariumBackgroundEl
    } = getElements();

    if (saveSettingsEl) {
      saveSettingsEl.addEventListener("click", () => {
        void handleSaveSettings();
      });
    }

    if (nowSettingsSaveEl) {
      nowSettingsSaveEl.addEventListener("click", () => {
        void saveSkySettingsFromPanel().catch((error) => {
          setNowSettingsStatus(error?.message || "Unable to save sky settings.", "error");
        });
      });
    }

    if (nowLocationEditEl) {
      nowLocationEditEl.addEventListener("click", openProfileLocation);
    }

    const markSkyDirty = () => {
      setNowSettingsStatus("Unsaved changes.", "info");
    };

    [nowTimeFormatEl, stellariumBackgroundEl].forEach((inputEl) => {
      if (!inputEl) {
        return;
      }
      inputEl.addEventListener("input", markSkyDirty);
      inputEl.addEventListener("change", markSkyDirty);
    });

    if (nowTimeFormatEl && timeFormatEl) {
      nowTimeFormatEl.addEventListener("change", () => {
        timeFormatEl.value = normalizeTimeFormat(nowTimeFormatEl.value);
      });
      timeFormatEl.addEventListener("change", () => {
        nowTimeFormatEl.value = normalizeTimeFormat(timeFormatEl.value);
      });
    }
    if (timeFormatEl) {
      timeFormatEl.addEventListener("change", persistProfileTimingFields);
    }
    if (birthDateEl) {
      birthDateEl.addEventListener("change", persistProfileTimingFields);
    }
    if (birthTimeEl) {
      birthTimeEl.addEventListener("change", persistProfileTimingFields);
    }

    if (detailTextScaleEl) {
      detailTextScaleEl.addEventListener("input", () => {
        syncDetailTextScaleLabel(Number(detailTextScaleEl.value) / 100);
      });
    }

    // Preview the menu style right away; Save still persists it.
    if (menuLayoutEl) {
      menuLayoutEl.addEventListener("change", () => {
        applyMenuLayout(normalizeMenuLayout(menuLayoutEl.value));
      });
    }

    const uiSkinEl = document.getElementById("ui-skin");
    if (uiSkinEl) {
      uiSkinEl.addEventListener("change", () => {
        window.TaroTimePluginHost?.setActiveSkin?.(uiSkinEl.value);
      });
    }
    document.addEventListener("taro-plugins-ready", syncUiSkinSelect);
    document.addEventListener("taro-skin-changed", syncUiSkinSelect);
    syncUiSkinSelect();

    if (openSettingsEl) {
      openSettingsEl.addEventListener("click", (event) => {
        event.stopPropagation();
        openSettingsPopup();
      });
    }

    document.addEventListener("connection:updated", () => {
      syncConnectionInputs();
      void refreshConnectionSummary(getConnectionSettings());
      void loadProfileLocation();
    });

    document.addEventListener("connection:access-updated", () => {
      syncTarotDeckInputOptions();
      syncActiveTarotDeck(getElements().nowTarotDeckEl?.value || loadSavedSettings().tarotDeck);
      void refreshConnectionSummary(getConnectionSettings());
    });

    document.addEventListener("profile:location-updated", () => {
      const normalized = applySettingsToInputs(loadSavedSettings());
      emitSettingsUpdated(normalized);
      const geo = resolveProfileGeo();
      if (geo) {
        syncSky(geo, {
          force: true,
          hasExplicitLocation: true,
          backgroundEnabled: Boolean(normalized.stellariumBackgroundEnabled)
        });
      }
      if ((window.TarotSectionStateUi?.getActiveSection?.() || "home") === "sky") {
        window.TarotAppRuntime?.refreshNowPanel?.({ forceSky: true });
      }
    });

    const onDeckSelectChange = (event) => {
      const nextDeckId = normalizeTarotDeck(event?.target?.value);
      const current = loadSavedSettings();
      const normalized = normalizeSettings({
        ...current,
        tarotDeck: nextDeckId
      });
      saveSettings(normalized);
      if (nowTarotDeckEl) nowTarotDeckEl.value = nextDeckId;
      syncActiveTarotDeck(nextDeckId);
      emitSettingsUpdated(normalized);
      applyExternalSettings(normalized);
      window.TarotCardImages?.scheduleDeckImagePreload?.(nextDeckId, {
        background: false,
        includeThumbnails: true,
        includeFull: true
      });
      setStatus(`Active deck set to ${nextDeckId}. Caching images in this browser...`);
    };
    if (nowTarotDeckEl) {
      nowTarotDeckEl.addEventListener("change", onDeckSelectChange);
    }
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig,
      defaultSettings: {
        ...config.defaultSettings,
        ...(nextConfig.defaultSettings || {})
      }
    };

    syncSavedSettingsStatus();
    setConnectionSummary(lastConnectionProbeResult);
    bindInteractions();
    void loadProfileLocation();
  }

  function loadInitialSettingsAndApply() {
    const initialSettings = loadSavedSettings();
    const normalized = applySettingsToInputs(initialSettings);
    emitSettingsUpdated(normalized);
    return normalized;
  }

  function mergeServerDefaults(serverDefaults = {}) {
    const source = serverDefaults && typeof serverDefaults === "object" ? serverDefaults : {};
    const nextDefaults = {
      ...config.defaultSettings
    };

    [
      "latitude",
      "longitude",
      "timeFormat",
      "tarotDeck",
      "detailTextScale",
      "menuLayout",
      "stellariumBackgroundEnabled",
      "hasExplicitLocation"
    ].forEach((key) => {
      if (source[key] !== undefined) {
        nextDefaults[key] = source[key];
      }
    });

    config.defaultSettings = nextDefaults;

    // First-time visitors inherit server defaults fully.
    // Returning users keep their saved settings.
    let hasSaved = false;
    try {
      hasSaved = Boolean(String(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || "").trim());
    } catch {
      hasSaved = false;
    }

    if (!hasSaved) {
      return loadInitialSettingsAndApply();
    }

    // Still refresh inputs against current defaults for any newly introduced keys.
    return applySettingsToInputs(loadSavedSettings());
  }

  window.TarotSettingsUi = {
    ...(window.TarotSettingsUi || {}),
    init,
    openSettingsPopup,
    loadInitialSettingsAndApply,
    mergeServerDefaults,
    buildNatalContext,
    normalizeSettings,
    persistLocationAndRefresh,
    getProfileLocation: resolveProfileGeo,
    syncProfileLocationDisplay: renderProfileLocation,
    saveSkySettingsFromPanel,
    syncTarotDeckInputOptions,
    syncActiveTarotDeck,
    syncStellariumBackgroundAvailability,
    setNowSettingsStatus,
    loadSavedSettings
  };
})();
