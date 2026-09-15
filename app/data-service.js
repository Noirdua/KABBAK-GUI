(function () {
  let magickManifestCache = null;
  let magickDataCache = null;
  let referenceDataCache = null;
  let referenceDataPromise = null;
  let deckOptionsCache = null;
  const deckManifestCache = new Map();
  let quizCategoriesCache = null;
  const quizTemplatesCache = new Map();
  let textLibraryCache = null;
  const textSourceCache = new Map();
  const textSectionCache = new Map();
  const textReferenceCache = new Map();
  const textReferenceOccurrencesCache = new Map();
  const textReferenceSearchCache = new Map();
  const textSearchCache = new Map();
  const MAX_SEARCH_CACHE_ENTRIES = 64;
  const MAX_SECTION_CACHE_ENTRIES = 128;
  const NOW_SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000;
  let nowSnapshotCache = {
    geoKey: "",
    fetchedAtMs: 0,
    value: null,
    pendingGeoKey: "",
    pendingPromise: null
  };

  const DATA_ROOT = "data";
  const MAGICK_ROOT = DATA_ROOT;

  const TAROT_TRUMP_NUMBER_BY_NAME = {
    "the fool": 0,
    fool: 0,
    "the magus": 1,
    magus: 1,
    magician: 1,
    "the high priestess": 2,
    "high priestess": 2,
    "the empress": 3,
    empress: 3,
    "the emperor": 4,
    emperor: 4,
    "the hierophant": 5,
    hierophant: 5,
    "the lovers": 6,
    lovers: 6,
    "the chariot": 7,
    chariot: 7,
    strength: 8,
    lust: 8,
    "the hermit": 9,
    hermit: 9,
    fortune: 10,
    "wheel of fortune": 10,
    justice: 11,
    "the hanged man": 12,
    "hanged man": 12,
    death: 13,
    temperance: 14,
    art: 14,
    "the devil": 15,
    devil: 15,
    "the tower": 16,
    tower: 16,
    "the star": 17,
    star: 17,
    "the moon": 18,
    moon: 18,
    "the sun": 19,
    sun: 19,
    aeon: 20,
    judgement: 20,
    judgment: 20,
    universe: 21,
    world: 21,
    "the world": 21
  };

  const HEBREW_BY_TRUMP_NUMBER = {
    0: { hebrewLetterId: "alef", kabbalahPathNumber: 11 },
    1: { hebrewLetterId: "bet", kabbalahPathNumber: 12 },
    2: { hebrewLetterId: "gimel", kabbalahPathNumber: 13 },
    3: { hebrewLetterId: "dalet", kabbalahPathNumber: 14 },
    4: { hebrewLetterId: "he", kabbalahPathNumber: 15 },
    5: { hebrewLetterId: "vav", kabbalahPathNumber: 16 },
    6: { hebrewLetterId: "zayin", kabbalahPathNumber: 17 },
    7: { hebrewLetterId: "het", kabbalahPathNumber: 18 },
    8: { hebrewLetterId: "tet", kabbalahPathNumber: 19 },
    9: { hebrewLetterId: "yod", kabbalahPathNumber: 20 },
    10: { hebrewLetterId: "kaf", kabbalahPathNumber: 21 },
    11: { hebrewLetterId: "lamed", kabbalahPathNumber: 22 },
    12: { hebrewLetterId: "mem", kabbalahPathNumber: 23 },
    13: { hebrewLetterId: "nun", kabbalahPathNumber: 24 },
    14: { hebrewLetterId: "samekh", kabbalahPathNumber: 25 },
    15: { hebrewLetterId: "ayin", kabbalahPathNumber: 26 },
    16: { hebrewLetterId: "pe", kabbalahPathNumber: 27 },
    17: { hebrewLetterId: "tsadi", kabbalahPathNumber: 28 },
    18: { hebrewLetterId: "qof", kabbalahPathNumber: 29 },
    19: { hebrewLetterId: "resh", kabbalahPathNumber: 30 },
    20: { hebrewLetterId: "shin", kabbalahPathNumber: 31 },
    21: { hebrewLetterId: "tav", kabbalahPathNumber: 32 }
  };

  const ICHING_PLANET_BY_PLANET_ID = {
    sol: "Sun",
    luna: "Moon",
    mercury: "Mercury",
    venus: "Venus",
    mars: "Mars",
    jupiter: "Jupiter",
    saturn: "Saturn",
    earth: "Earth",
    uranus: "Uranus",
    neptune: "Neptune",
    pluto: "Pluto"
  };

  function resolveConnectionSettings(connectionSettings = null) {
    if (!connectionSettings || typeof connectionSettings !== "object") {
      return {
        apiBaseUrl: getApiBaseUrl(),
        apiKey: getApiKey()
      };
    }

    return {
      apiBaseUrl: normalizeApiBaseUrl(connectionSettings.apiBaseUrl),
      apiKey: String(connectionSettings.apiKey || "").trim()
    };
  }

  function buildRequestHeaders(connectionSettings = null) {
    const { apiKey } = resolveConnectionSettings(connectionSettings);
    return apiKey
      ? {
          "x-api-key": apiKey
        }
      : undefined;
  }

  function emitAuthLost(status) {
    if (Number(status) !== 401) {
      return;
    }
    try {
      document.dispatchEvent(new CustomEvent("connection:auth-lost", {
        detail: { status: 401 }
      }));
    } catch (_error) {
      // ignore
    }
  }

  let lastNetworkLostAt = 0;

  function emitNetworkLost() {
    const now = Date.now();
    if (now - lastNetworkLostAt < 4000) {
      return;
    }
    lastNetworkLostAt = now;
    try {
      document.dispatchEvent(new CustomEvent("connection:network-lost"));
    } catch (_error) {}
  }

  async function fetchJson(path, { timeoutMs = 30000 } = {}) {
    if (!path) {
      throw new Error("API connection is not configured.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(path, {
        cache: "no-store",
        headers: buildRequestHeaders(),
        signal: controller.signal
      });
      if (!response.ok) {
        emitAuthLost(response.status);
        const error = new Error(`Failed to load ${path} (${response.status})`);
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();
      // The API wraps successful responses in { data, meta }; unwrap the data.
      if (payload && typeof payload === "object" && "data" in payload) {
        return payload.data;
      }
      return payload;
    } catch (error) {
      if (!error?.status) emitNetworkLost();
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function buildObjectPath(target, pathParts, value) {
    let cursor = target;
    for (let index = 0; index < pathParts.length - 1; index += 1) {
      const part = pathParts[index];
      if (!cursor[part] || typeof cursor[part] !== "object") {
        cursor[part] = {};
      }
      cursor = cursor[part];
    }
    cursor[pathParts[pathParts.length - 1]] = value;
  }

  function normalizeApiBaseUrl(value) {
    return String(value || "")
      .trim()
      .replace(/\/+$/, "");
  }

  function getApiBaseUrl() {
    return normalizeApiBaseUrl(
      window.TarotAppConfig?.getApiBaseUrl?.() || window.TarotAppConfig?.apiBaseUrl || ""
    );
  }

  function getApiKey() {
    return String(window.TarotAppConfig?.getApiKey?.() || window.TarotAppConfig?.apiKey || "")
      .trim();
  }

  function hasAdminCapability(auth) {
    const roles = Array.isArray(auth?.roles) ? auth.roles.map((value) => String(value || "").trim()) : [];
    const scopes = Array.isArray(auth?.scopes) ? auth.scopes.map((value) => String(value || "").trim()) : [];
    return roles.includes("admin") || scopes.includes("api:admin");
  }

  function isApiEnabled() {
    return Boolean(getApiBaseUrl());
  }

  function encodePathSegments(pathValue) {
    return String(pathValue || "")
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        try {
          return encodeURIComponent(decodeURIComponent(segment));
        } catch {
          return encodeURIComponent(segment);
        }
      })
      .join("/");
  }

  function buildApiUrl(path, query = {}, connectionSettings = null) {
    const { apiBaseUrl } = resolveConnectionSettings(connectionSettings);
    if (!apiBaseUrl) {
      return "";
    }

    const url = new URL(path, `${apiBaseUrl}/`);
    Object.entries(query || {}).forEach(([key, value]) => {
      if (value == null) {
        return;
      }

      const normalizedValue = String(value).trim();
      if (!normalizedValue) {
        return;
      }

      url.searchParams.set(key, normalizedValue);
    });

    return url.toString();
  }

  function normalizeGeoKey(geo) {
    const latitude = Number(geo?.latitude);
    const longitude = Number(geo?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return "";
    }

    return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  }

  function isNowSnapshotPollingEnabled() {
    if (typeof document !== "undefined" && document.hidden === true) {
      return false;
    }

    const activeSection = String(window.TarotSectionStateUi?.getActiveSection?.() || "home").trim();
    return activeSection === "home" || activeSection === "sky";
  }

  function toApiAssetUrl(assetPath) {
    const { apiBaseUrl, apiKey } = resolveConnectionSettings();
    const normalizedAssetPath = String(assetPath || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/^asset\//i, "");

    if (!apiBaseUrl || !normalizedAssetPath) {
      return "";
    }

    const url = new URL(`/api/v1/assets/${encodePathSegments(normalizedAssetPath)}`, `${apiBaseUrl}/`);
    if (apiKey) {
      url.searchParams.set("apiKey", apiKey);
    }

    return url.toString();
  }

  function resetCaches() {
    magickManifestCache = null;
    magickDataCache = null;
    referenceDataCache = null;
    referenceDataPromise = null;
    deckOptionsCache = null;
    quizCategoriesCache = null;
    textLibraryCache = null;
    deckManifestCache.clear();
    quizTemplatesCache.clear();
    textSourceCache.clear();
    textSectionCache.clear();
    textReferenceCache.clear();
    textReferenceOccurrencesCache.clear();
    textReferenceSearchCache.clear();
    textSearchCache.clear();
    nowSnapshotCache = {
      geoKey: "",
      fetchedAtMs: 0,
      value: null,
      pendingGeoKey: "",
      pendingPromise: null
    };
  }

  function pruneMapCache(map, maxSize) {
    if (!(map instanceof Map) || map.size <= maxSize) return;
    const excess = map.size - maxSize;
    const keys = Array.from(map.keys());
    for (let i = 0; i < excess && i < keys.length; i++) {
      map.delete(keys[i]);
    }
  }

  function normalizeTarotName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function resolveTarotTrumpNumber(cardName) {
    const key = normalizeTarotName(cardName);
    if (!key) {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(TAROT_TRUMP_NUMBER_BY_NAME, key)) {
      return TAROT_TRUMP_NUMBER_BY_NAME[key];
    }

    const withoutLeadingThe = key.replace(/^the\s+/, "");
    if (Object.prototype.hasOwnProperty.call(TAROT_TRUMP_NUMBER_BY_NAME, withoutLeadingThe)) {
      return TAROT_TRUMP_NUMBER_BY_NAME[withoutLeadingThe];
    }

    return null;
  }

  function enrichAssociation(associations) {
    if (!associations || typeof associations !== "object") {
      return associations;
    }

    const next = { ...associations };

    if (next.tarotCard) {
      const trumpNumber = resolveTarotTrumpNumber(next.tarotCard);
      if (trumpNumber != null) {
        if (!Number.isFinite(Number(next.tarotTrumpNumber))) {
          next.tarotTrumpNumber = trumpNumber;
        }

        const hebrew = HEBREW_BY_TRUMP_NUMBER[trumpNumber];
        if (hebrew) {
          if (!next.hebrewLetterId) {
            next.hebrewLetterId = hebrew.hebrewLetterId;
          }
          if (!Number.isFinite(Number(next.kabbalahPathNumber))) {
            next.kabbalahPathNumber = hebrew.kabbalahPathNumber;
          }
        }
      }
    }

    const planetId = String(next.planetId || "").trim().toLowerCase();
    if (!next.iChingPlanetaryInfluence && planetId) {
      const influence = ICHING_PLANET_BY_PLANET_ID[planetId];
      if (influence) {
        next.iChingPlanetaryInfluence = influence;
      }
    }

    return next;
  }

  function enrichCalendarMonth(month) {
    const events = Array.isArray(month?.events)
      ? month.events.map((event) => ({
          ...event,
          associations: enrichAssociation(event?.associations)
        }))
      : [];

    return {
      ...month,
      associations: enrichAssociation(month?.associations),
      events
    };
  }

  function enrichCelestialHoliday(holiday) {
    return {
      ...holiday,
      associations: enrichAssociation(holiday?.associations)
    };
  }

  function enrichCalendarHoliday(holiday) {
    return {
      ...holiday,
      associations: enrichAssociation(holiday?.associations)
    };
  }

  async function loadMagickManifest() {
    if (magickManifestCache) {
      return magickManifestCache;
    }

    magickManifestCache = await fetchJson(buildApiUrl("/api/v1/bootstrap/magick-manifest"));
    return magickManifestCache;
  }

  async function loadMagickDataset() {
    if (magickDataCache) {
      return magickDataCache;
    }

    magickDataCache = await fetchJson(buildApiUrl("/api/v1/bootstrap/magick-dataset"));
    return magickDataCache;
  }

  async function loadReferenceData() {
    if (referenceDataCache) {
      return referenceDataCache;
    }
    if (referenceDataPromise) {
      return referenceDataPromise;
    }

    referenceDataPromise = fetchJson(buildApiUrl("/api/v1/bootstrap/reference-data"))
      .then((payload) => {
        referenceDataCache = payload;
        return payload;
      })
      .finally(() => {
        referenceDataPromise = null;
      });

    return referenceDataPromise;
  }

  async function fetchWeekEvents(geo, anchorDate = new Date()) {
    return fetchJson(buildApiUrl("/api/v1/calendar/week-events", {
      latitude: geo?.latitude,
      longitude: geo?.longitude,
      date: anchorDate instanceof Date ? anchorDate.toISOString() : anchorDate
    }));
  }

  async function fetchNowSnapshot(geo, timestamp = new Date()) {
    const geoKey = normalizeGeoKey(geo);
    const nowMs = Date.now();

    if (!isNowSnapshotPollingEnabled()) {
      if (geoKey && nowSnapshotCache.pendingPromise && nowSnapshotCache.pendingGeoKey === geoKey) {
        return nowSnapshotCache.pendingPromise;
      }

      if (geoKey && geoKey === nowSnapshotCache.geoKey && nowSnapshotCache.value) {
        return nowSnapshotCache.value;
      }

      return null;
    }

    if (
      geoKey
      && geoKey === nowSnapshotCache.geoKey
      && nowSnapshotCache.value
      && Number.isFinite(nowSnapshotCache.fetchedAtMs)
      && (nowMs - nowSnapshotCache.fetchedAtMs) < NOW_SNAPSHOT_MIN_INTERVAL_MS
    ) {
      return nowSnapshotCache.value;
    }

    if (geoKey && nowSnapshotCache.pendingPromise && nowSnapshotCache.pendingGeoKey === geoKey) {
      return nowSnapshotCache.pendingPromise;
    }

    const requestPromise = fetchJson(buildApiUrl("/api/v1/now", {
      latitude: geo?.latitude,
      longitude: geo?.longitude,
      date: timestamp instanceof Date ? timestamp.toISOString() : timestamp
    }))
      .then((snapshot) => {
        if (geoKey) {
          nowSnapshotCache.geoKey = geoKey;
          nowSnapshotCache.fetchedAtMs = Date.now();
          nowSnapshotCache.value = snapshot;
        }
        return snapshot;
      })
      .finally(() => {
        if (nowSnapshotCache.pendingPromise === requestPromise) {
          nowSnapshotCache.pendingPromise = null;
          nowSnapshotCache.pendingGeoKey = "";
        }
      });

    nowSnapshotCache.pendingPromise = requestPromise;
    nowSnapshotCache.pendingGeoKey = geoKey;
    return requestPromise;
  }

  async function loadTarotCards(filters = {}) {
    return fetchJson(buildApiUrl("/api/v1/tarot/cards", {
      q: filters?.query,
      arcana: filters?.arcana,
      suit: filters?.suit
    }));
  }

  async function pullTarotSpread(spreadId, options = {}) {
    const normalizedSpreadId = String(spreadId || "").trim() || "three-card";
    return fetchJson(buildApiUrl(`/api/v1/tarot/spreads/${encodeURIComponent(normalizedSpreadId)}/pull`, {
      seed: options?.seed,
      reversed: options?.reversed ? "true" : null
    }));
  }

  async function loadGematriaWordsByValue(value, options = {}) {
    const ciphers = Array.isArray(options?.ciphers)
      ? options.ciphers.map((cipherId) => String(cipherId || "").trim()).filter(Boolean).join(",")
      : String(options?.ciphers || "").trim();

    return fetchJson(buildApiUrl("/api/v1/gematria/words", {
      value,
      ciphers
    }));
  }

  async function loadWordAnagrams(text) {
    return fetchJson(buildApiUrl("/api/v1/words/anagrams", {
      text
    }));
  }

  async function loadWordLookup(word) {
    return fetchJson(buildApiUrl("/api/v1/words/lookup", {
      word
    }));
  }

  async function loadWordsByPrefix(prefix, options = {}) {
    return fetchJson(buildApiUrl("/api/v1/words/prefix", {
      prefix,
      ...(options.limit ? { limit: String(options.limit) } : {})
    }));
  }

  async function loadWordTranslations(text, options = {}) {
    return fetchJson(buildApiUrl("/api/v1/words/translate", {
      text,
      ...(options.limit ? { limit: String(options.limit) } : {}),
      ...(options.mode ? { mode: String(options.mode) } : {})
    }));
  }

  async function loadTextLibrary(forceRefresh = false) {
    if (!forceRefresh && textLibraryCache) {
      return textLibraryCache;
    }

    textLibraryCache = await fetchJson(buildApiUrl("/api/v1/texts"));
    return textLibraryCache;
  }

  async function loadTextSource(sourceId, forceRefresh = false) {
    const normalizedSourceId = String(sourceId || "").trim().toLowerCase();
    if (!normalizedSourceId) {
      return null;
    }

    if (!forceRefresh && textSourceCache.has(normalizedSourceId)) {
      return textSourceCache.get(normalizedSourceId);
    }

    const payload = await fetchJson(buildApiUrl(`/api/v1/texts/${encodeURIComponent(normalizedSourceId)}`));
    textSourceCache.set(normalizedSourceId, payload);
    return payload;
  }

  async function loadTextSection(sourceId, workId, sectionId, forceRefresh = false) {
    const normalizedSourceId = String(sourceId || "").trim().toLowerCase();
    const normalizedWorkId = String(workId || "").trim().toLowerCase();
    const normalizedSectionId = String(sectionId || "").trim().toLowerCase();
    if (!normalizedSourceId || !normalizedWorkId || !normalizedSectionId) {
      return null;
    }

    const cacheKey = `${normalizedSourceId}::${normalizedWorkId}::${normalizedSectionId}`;
    if (!forceRefresh && textSectionCache.has(cacheKey)) {
      return textSectionCache.get(cacheKey);
    }

    const payload = await fetchJson(buildApiUrl(
      `/api/v1/texts/${encodeURIComponent(normalizedSourceId)}/works/${encodeURIComponent(normalizedWorkId)}/sections/${encodeURIComponent(normalizedSectionId)}`
    ));
    textSectionCache.set(cacheKey, payload);
    pruneMapCache(textSectionCache, MAX_SECTION_CACHE_ENTRIES);
    return payload;
  }

  async function loadTextReferenceEntry(referenceId, entryId, forceRefresh = false) {
    const normalizedReferenceId = String(referenceId || "").trim().toLowerCase();
    const normalizedEntryId = String(entryId || "").trim().toUpperCase();
    if (!normalizedReferenceId || !normalizedEntryId) {
      return null;
    }

    const cacheKey = `${normalizedReferenceId}::${normalizedEntryId}`;
    if (!forceRefresh && textReferenceCache.has(cacheKey)) {
      return textReferenceCache.get(cacheKey);
    }

    const payload = await fetchJson(buildApiUrl(
      `/api/v1/texts/references/${encodeURIComponent(normalizedReferenceId)}/entries/${encodeURIComponent(normalizedEntryId)}`
    ));
    textReferenceCache.set(cacheKey, payload);
    return payload;
  }

  async function searchTextReference(referenceId, query, options = {}, forceRefresh = false) {
    const normalizedReferenceId = String(referenceId || "").trim().toLowerCase();
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const normalizedLimit = Number.parseInt(options?.limit, 10);
    const limit = Number.isFinite(normalizedLimit) ? normalizedLimit : 50;
    if (!normalizedReferenceId) {
      return null;
    }

    const cacheKey = `${normalizedReferenceId}::${normalizedQuery}::${limit}`;
    if (!forceRefresh && textReferenceSearchCache.has(cacheKey)) {
      return textReferenceSearchCache.get(cacheKey);
    }

    const payload = await fetchJson(buildApiUrl(
      `/api/v1/texts/references/${encodeURIComponent(normalizedReferenceId)}/search`,
      { q: normalizedQuery, limit }
    ));
    textReferenceSearchCache.set(cacheKey, payload);
    pruneMapCache(textReferenceSearchCache, MAX_SEARCH_CACHE_ENTRIES);
    return payload;
  }

  async function loadTextReferenceOccurrences(referenceId, entryId, options = {}, forceRefresh = false) {
    const normalizedReferenceId = String(referenceId || "").trim().toLowerCase();
    const normalizedEntryId = String(entryId || "").trim().toUpperCase();
    const normalizedLimit = Number.parseInt(options?.limit, 10);
    const limit = Number.isFinite(normalizedLimit) ? normalizedLimit : 100;
    if (!normalizedReferenceId || !normalizedEntryId) {
      return null;
    }

    const cacheKey = `${normalizedReferenceId}::${normalizedEntryId}::${limit}`;
    if (!forceRefresh && textReferenceOccurrencesCache.has(cacheKey)) {
      return textReferenceOccurrencesCache.get(cacheKey);
    }

    const payload = await fetchJson(buildApiUrl(
      `/api/v1/texts/references/${encodeURIComponent(normalizedReferenceId)}/entries/${encodeURIComponent(normalizedEntryId)}/occurrences`,
      { limit }
    ));
    textReferenceOccurrencesCache.set(cacheKey, payload);
    pruneMapCache(textReferenceOccurrencesCache, MAX_SEARCH_CACHE_ENTRIES);
    return payload;
  }

  async function searchTextLibrary(query, options = {}, forceRefresh = false) {
    const normalizedQuery = String(query || "").trim();
    const normalizedSourceId = String(options?.sourceId || "").trim().toLowerCase();
    const normalizedLimit = Number.parseInt(options?.limit, 10);
    const limit = Number.isFinite(normalizedLimit) ? normalizedLimit : 50;

    if (!normalizedQuery) {
      return {
        query: "",
        normalizedQuery: "",
        scope: normalizedSourceId ? { type: "source", sourceId: normalizedSourceId } : { type: "global" },
        limit,
        total: 0,
        truncated: false,
        matches: []
      };
    }

    const cacheKey = `${normalizedSourceId || "global"}::${limit}::${normalizedQuery.toLowerCase()}`;
    if (!forceRefresh && textSearchCache.has(cacheKey)) {
      return textSearchCache.get(cacheKey);
    }

    const path = normalizedSourceId
      ? `/api/v1/texts/${encodeURIComponent(normalizedSourceId)}/search`
      : "/api/v1/texts/search";

    const payload = await fetchJson(buildApiUrl(path, {
      q: normalizedQuery,
      limit
    }));
    textSearchCache.set(cacheKey, payload);
    pruneMapCache(textSearchCache, MAX_SEARCH_CACHE_ENTRIES);
    return payload;
  }

  async function loadDeckOptions(forceRefresh = false) {
    if (!forceRefresh && deckOptionsCache) {
      return deckOptionsCache;
    }

    deckOptionsCache = await fetchJson(buildApiUrl("/api/v1/decks/options"));
    return deckOptionsCache;
  }

  async function loadDeckManifest(deckId, forceRefresh = false) {
    const normalizedDeckId = String(deckId || "").trim().toLowerCase();
    if (!normalizedDeckId) {
      return null;
    }

    if (!forceRefresh && deckManifestCache.has(normalizedDeckId)) {
      return deckManifestCache.get(normalizedDeckId);
    }

    const manifest = await fetchJson(buildApiUrl(`/api/v1/decks/${encodeURIComponent(normalizedDeckId)}/manifest`));
    deckManifestCache.set(normalizedDeckId, manifest);
    return manifest;
  }

  async function loadQuizCategories(forceRefresh = false) {
    if (!forceRefresh && quizCategoriesCache) {
      return quizCategoriesCache;
    }

    quizCategoriesCache = await fetchJson(buildApiUrl("/api/v1/quiz/categories"));
    return quizCategoriesCache;
  }

  async function loadQuizTemplates(query = {}, forceRefresh = false) {
    const categoryId = String(query?.categoryId || "").trim();
    const cacheKey = categoryId || "__all__";

    if (!forceRefresh && quizTemplatesCache.has(cacheKey)) {
      return quizTemplatesCache.get(cacheKey);
    }

    const templates = await fetchJson(buildApiUrl("/api/v1/quiz/templates", {
      categoryId
    }));
    quizTemplatesCache.set(cacheKey, templates);
    return templates;
  }

  async function fetchBoardTopics() {
    return requestJson("GET", buildApiUrl("/api/v1/board/topics"));
  }

  async function fetchBoardContributors(limit) {
    return requestJson("GET", buildApiUrl("/api/v1/board/contributors", { limit }));
  }

  async function reportBoardPost(payload) {
    return requestJson("POST", buildApiUrl("/api/v1/board/report"), payload);
  }

  async function watchBoardTopic(topicId, watching) {
    return requestJson(
      "POST",
      buildApiUrl(`/api/v1/board/topics/${encodeURIComponent(topicId)}/watch`),
      { watching }
    );
  }

  async function fetchBoardTopic(topicId) {
    return requestJson("GET", buildApiUrl(`/api/v1/board/topics/${encodeURIComponent(topicId)}`));
  }

  async function createBoardTopic(topic) {
    return requestJson("POST", buildApiUrl("/api/v1/board/topics"), topic);
  }

  async function deleteBoardTopic(topicId) {
    return requestJson("DELETE", buildApiUrl(`/api/v1/board/topics/${encodeURIComponent(topicId)}`));
  }

  async function createBoardReply(topicId, body) {
    return requestJson(
      "POST",
      buildApiUrl(`/api/v1/board/topics/${encodeURIComponent(topicId)}/replies`),
      { body }
    );
  }

  async function deleteBoardReply(topicId, replyId) {
    return requestJson(
      "DELETE",
      buildApiUrl(`/api/v1/board/topics/${encodeURIComponent(topicId)}/replies/${encodeURIComponent(replyId)}`)
    );
  }

  async function updateBoardTopic(topicId, patch) {
    return requestJson("PATCH", buildApiUrl(`/api/v1/board/topics/${encodeURIComponent(topicId)}`), patch);
  }

  async function updateBoardReply(topicId, replyId, body) {
    return requestJson(
      "PATCH",
      buildApiUrl(`/api/v1/board/topics/${encodeURIComponent(topicId)}/replies/${encodeURIComponent(replyId)}`),
      { body }
    );
  }

  async function pinBoardTopic(topicId, pinned) {
    return requestJson(
      "POST",
      buildApiUrl(`/api/v1/board/topics/${encodeURIComponent(topicId)}/pin`),
      { pinned }
    );
  }

  async function fetchQuizSession(query = {}) {
    return fetchJson(buildApiUrl("/api/v1/quiz/session", {
      categoryId: query?.categoryId,
      templateKey: query?.templateKey,
      difficulty: query?.difficulty,
      count: query?.count,
      seed: query?.seed,
      includeAnswer: query?.includeAnswer
    }));
  }

  async function pullQuizQuestion(query = {}) {
    return fetchJson(buildApiUrl("/api/v1/quiz/questions/pull", {
      categoryId: query?.categoryId,
      templateKey: query?.templateKey,
      difficulty: query?.difficulty,
      seed: query?.seed,
      includeAnswer: query?.includeAnswer
    }));
  }

  async function probeConnection(connectionSettings = null) {
    const resolvedConnection = resolveConnectionSettings(connectionSettings);
    const apiBaseUrl = resolvedConnection.apiBaseUrl;
    if (!apiBaseUrl) {
      return {
        ok: false,
        reason: "missing-base-url",
        message: "Enter an API Base URL to load KABBAK."
      };
    }

    const requestOptions = {
      cache: "no-store",
      headers: buildRequestHeaders(resolvedConnection)
    };

    try {
      let healthResponse = await fetch(buildApiUrl("/api/v1/health", {}, resolvedConnection), requestOptions);

      // The public health endpoint is lightly rate limited. If we land on a
      // 429, honor Retry-After (capped) and try once more before giving up.
      if (healthResponse.status === 429) {
        const retryAfterRaw = Number(healthResponse.headers.get("retry-after") || 0);
        const retryAfterMs = Number.isFinite(retryAfterRaw) && retryAfterRaw > 0
          ? Math.min(retryAfterRaw * 1000, 3000)
          : 1500;
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
        healthResponse = await fetch(buildApiUrl("/api/v1/health", {}, resolvedConnection), requestOptions);
      }

      if (!healthResponse.ok) {
        if (healthResponse.status === 429) {
          return {
            ok: false,
            reason: "health-check-failed",
            message: "The API is rate-limiting health checks. Wait a few seconds and try again."
          };
        }
        return {
          ok: false,
          reason: "health-check-failed",
          message: `The API responded with ${healthResponse.status} during the health check.`
        };
      }

      const health = await healthResponse.json().catch(() => null);
      const presentedKey = Boolean(String(resolvedConnection.apiKey || "").trim());
      if (health?.apiKeyRequired === true && health?.auth?.authenticated !== true) {
        return {
          ok: false,
          reason: "auth-required",
          message: presentedKey
            ? "That API key is not valid."
            : "The API requires a valid API key.",
          health,
          auth: health?.auth || null
        };
      }

      let tarotAvailable = false;
      let deckCount = null;
      const deckResponse = await fetch(buildApiUrl("/api/v1/decks/options", {}, resolvedConnection), requestOptions);

      if (deckResponse.status === 401) {
        return {
          ok: false,
          reason: "auth-required",
          message: health?.apiKeyRequired
            ? "The API requires a valid API key."
            : "The API rejected this connection."
        };
      }

      if (deckResponse.status === 403) {
        // 403 here means the key IS valid but the tier can't load decks.
        // Connect anyway (tarot hidden) so lower tiers and the demo user can
        // still use the rest of the app instead of bouncing off the gate.
        if (health?.auth?.authenticated !== true) {
          return {
            ok: false,
            reason: "auth-required",
            message: health?.apiKeyRequired
              ? "The API requires a valid API key."
              : "The API rejected this connection."
          };
        }
        return {
          ok: true,
          reason: "connected",
          message: "Connected. Tarot decks are unavailable for this key's tier.",
          health,
          auth: health?.auth || null,
          deckCount: null,
          capabilities: {
            tarot: false,
            adminApiManagement: hasAdminCapability(health?.auth)
          }
        };
      }

      if (!deckResponse.ok) {
        return {
          ok: false,
          reason: "protected-route-failed",
          message: `The API responded with ${deckResponse.status} when loading connected data.`
        };
      }

      const decksPayload = await deckResponse.json().catch(() => null);
      const decksData = decksPayload && typeof decksPayload === "object" && "data" in decksPayload
        ? decksPayload.data
        : decksPayload;
      deckCount = Array.isArray(decksData?.decks) ? decksData.decks.length : null;
      tarotAvailable = true;

      return {
        ok: true,
        reason: "connected",
        message: tarotAvailable ? "Connected." : "Connected. Tarot features are unavailable for this API key.",
        health,
        auth: health?.auth || null,
        deckCount,
        capabilities: {
          tarot: tarotAvailable,
          adminApiManagement: hasAdminCapability(health?.auth)
        }
      };
    } catch (_error) {
      return {
        ok: false,
        reason: "network-error",
        message: "Unable to reach the API. Check the URL and make sure the server is running."
      };
    }
  }

  async function requestJson(method, path, body = null, { timeoutMs = 30000 } = {}) {
    if (!path) {
      throw new Error("API connection is not configured.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(path, {
        method: String(method || "GET").toUpperCase(),
        cache: "no-store",
        headers: {
          ...(buildRequestHeaders() || {}),
          ...(body ? { "content-type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal
      });
      if (!response.ok) {
        emitAuthLost(response.status);
        let message = `Request failed with status ${response.status}`;
        try {
          const errorPayload = await response.json();
          if (errorPayload && typeof errorPayload === "object") {
            message = errorPayload.message || errorPayload.error || message;
          }
        } catch (_error) {
          // keep generic message
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }

      const payload = await response.json();
      if (payload && typeof payload === "object" && "data" in payload) {
        return payload.data;
      }
      return payload;
    } catch (error) {
      if (!error?.status) emitNetworkLost();
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function requestBlob(method, path) {
    if (!path) {
      throw new Error("API connection is not configured.");
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000);
    try {
      const response = await fetch(path, {
        method: String(method || "GET").toUpperCase(),
        cache: "no-store",
        headers: buildRequestHeaders() || {},
        signal: controller.signal
      });
      if (!response.ok) {
        emitAuthLost(response.status);
        const error = new Error(`Request failed with status ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return await response.blob();
    } catch (error) {
      if (!error?.status) emitNetworkLost();
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function fetchProfileEvents(from, to) {
    return requestJson("GET", buildApiUrl("/api/v1/profile/events", {
      ...(from ? { from } : {}),
      ...(to ? { to } : {})
    }));
  }

  async function fetchProfileEvent(eventId) {
    return requestJson("GET", buildApiUrl(`/api/v1/profile/events/${encodeURIComponent(eventId)}`));
  }

  async function createProfileEvent(event) {
    return requestJson("POST", buildApiUrl("/api/v1/profile/events"), event);
  }

  async function updateProfileEvent(eventId, event) {
    return requestJson("PATCH", buildApiUrl(`/api/v1/profile/events/${encodeURIComponent(eventId)}`), event);
  }

  async function deleteProfileEvent(eventId) {
    return requestJson("DELETE", buildApiUrl(`/api/v1/profile/events/${encodeURIComponent(eventId)}`));
  }

  async function fetchProfileCalendarFeed() {
    return requestJson("GET", buildApiUrl("/api/v1/profile/calendar-feed"));
  }

  async function createProfileLink(link) {
    return requestJson("POST", buildApiUrl("/api/v1/profile/links"), link);
  }

  async function listProfileLinks() {
    return requestJson("GET", buildApiUrl("/api/v1/profile/links"));
  }

  async function fetchInbox(filters = {}) {
    return requestJson("GET", buildApiUrl("/api/v1/profile/inbox", {
      kind: filters.kind,
      scope: filters.scope,
      unread: filters.unreadOnly ? "1" : undefined
    }));
  }

  async function fetchInboxMessage(scope, messageId) {
    return requestJson(
      "GET",
      buildApiUrl(`/api/v1/profile/inbox/${encodeURIComponent(scope)}/${encodeURIComponent(messageId)}`)
    );
  }

  async function markInboxItemRead(scope, messageId) {
    return requestJson(
      "POST",
      buildApiUrl(`/api/v1/profile/inbox/${encodeURIComponent(scope)}/${encodeURIComponent(messageId)}/read`),
      {}
    );
  }

  async function markInboxAllRead() {
    return requestJson("POST", buildApiUrl("/api/v1/profile/inbox/read-all"), {});
  }

  async function createBroadcast(message) {
    return requestJson("POST", buildApiUrl("/api/v1/admin/messages"), message);
  }

  async function fetchAdminMessages() {
    return requestJson("GET", buildApiUrl("/api/v1/admin/messages"));
  }

  async function fetchAdminMessageLog() {
    return requestJson("GET", buildApiUrl("/api/v1/admin/messages/log"));
  }

  async function clearAdminMessageLog() {
    return requestJson("DELETE", buildApiUrl("/api/v1/admin/messages/log/all"));
  }

  async function fetchAdminReplies() {
    return requestJson("GET", buildApiUrl("/api/v1/admin/messages/replies"));
  }

  async function fetchAdminReports() {
    return requestJson("GET", buildApiUrl("/api/v1/admin/reports"));
  }

  async function resolveAdminReport(reportId) {
    return requestJson("POST", buildApiUrl(`/api/v1/admin/reports/${encodeURIComponent(reportId)}/resolve`), {});
  }

  async function clearAdminReports() {
    return requestJson("DELETE", buildApiUrl("/api/v1/admin/reports/all"));
  }

  async function clearAdminReplies() {
    return requestJson("DELETE", buildApiUrl("/api/v1/admin/messages/replies/all"));
  }

  async function sendInboxReply(scope, messageId, body) {
    return requestJson(
      "POST",
      buildApiUrl(`/api/v1/profile/inbox/${encodeURIComponent(scope)}/${encodeURIComponent(messageId)}/reply`),
      { body }
    );
  }

  async function fetchQuietHours() {
    return requestJson("GET", buildApiUrl("/api/v1/profile/quiet-hours"));
  }

  async function fetchQuizProgress() {
    return requestJson("GET", buildApiUrl("/api/v1/profile/quiz-progress"));
  }

  async function fetchQuizLeaderboard(limit) {
    return requestJson("GET", buildApiUrl("/api/v1/quiz/leaderboard", { limit }));
  }

  async function fetchProfileDirectory() {
    return requestJson("GET", buildApiUrl("/api/v1/profile/directory"));
  }

  async function updateProfileDirectory(visibility) {
    return requestJson("PATCH", buildApiUrl("/api/v1/profile/directory"), { visibility });
  }

  async function fetchDirectory() {
    return requestJson("GET", buildApiUrl("/api/v1/directory"));
  }

  async function sendAdminMessage(message) {
    return requestJson("POST", buildApiUrl("/api/v1/admin/messages/send"), message);
  }

  async function fetchAdminRoles() {
    return requestJson("GET", buildApiUrl("/api/v1/admin/roles"));
  }

  async function fetchAdminAccessLevels() {
    return requestJson("GET", buildApiUrl("/api/v1/admin/access-levels"));
  }

  async function updateQuietHours(settings) {
    return requestJson("PATCH", buildApiUrl("/api/v1/profile/quiet-hours"), settings);
  }

  async function deleteAdminMessage(messageId) {
    return requestJson("DELETE", buildApiUrl(`/api/v1/admin/messages/${encodeURIComponent(messageId)}`));
  }

  // <img> tags cannot send headers, so attachment previews carry the apiKey on
  // the query string like other media.
  function buildInboxAttachmentUrl(scope, messageId, attachmentId) {
    return buildApiUrl(
      `/api/v1/profile/inbox/${encodeURIComponent(scope)}/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { apiKey: getApiKey() }
    );
  }

  function buildEventAttachmentUrl(eventId, attachmentId) {
    return buildApiUrl(
      `/api/v1/profile/events/${encodeURIComponent(eventId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { apiKey: getApiKey() }
    );
  }

  async function updateProfileCalendarFeed(action) {
    return requestJson("POST", buildApiUrl("/api/v1/profile/calendar-feed"), { action });
  }

  window.TarotDataService = {
    buildApiUrl,
    buildEventAttachmentUrl,
    buildInboxAttachmentUrl,
    createBoardReply,
    createBoardTopic,
    createBroadcast,
    createProfileEvent,
    createProfileLink,
    deleteBoardReply,
    deleteBoardTopic,
    deleteAdminMessage,
    deleteProfileEvent,
    clearAdminMessageLog,
    clearAdminReplies,
    clearAdminReports,
    fetchAdminAccessLevels,
    fetchAdminReplies,
    fetchAdminReports,
    resolveAdminReport,
    fetchAdminMessageLog,
    fetchAdminMessages,
    fetchAdminRoles,
    fetchDirectory,
    fetchInbox,
    fetchInboxMessage,
    fetchBoardContributors,
    fetchBoardTopic,
    fetchBoardTopics,
    fetchJson,
    fetchProfileDirectory,
    fetchQuizLeaderboard,
    fetchQuizProgress,
    fetchQuizSession,
    fetchQuietHours,
    fetchNowSnapshot,
    fetchProfileCalendarFeed,
    fetchProfileEvent,
    fetchProfileEvents,
    fetchWeekEvents,
    getApiBaseUrl,
    getApiKey,
    isApiEnabled,
    loadDeckManifest,
    loadDeckOptions,
    loadGematriaWordsByValue,
    loadWordAnagrams,
    loadWordLookup,
    loadWordsByPrefix,
    loadWordTranslations,
    loadQuizCategories,
    loadQuizTemplates,
    loadTarotCards,
    loadReferenceData,
    loadMagickManifest,
    loadMagickDataset,
    loadTextLibrary,
    loadTextSource,
    searchTextLibrary,
    loadTextSection,
    loadTextReferenceEntry,
    searchTextReference,
    listProfileLinks,
    markInboxAllRead,
    markInboxItemRead,
    pinBoardTopic,
    loadTextReferenceOccurrences,
    probeConnection,
    pullQuizQuestion,
    pullTarotSpread,
    reportBoardPost,
    requestBlob,
    requestJson,
    sendAdminMessage,
    sendInboxReply,
    toApiAssetUrl,
    updateBoardReply,
    updateBoardTopic,
    watchBoardTopic,
    updateProfileCalendarFeed,
    updateProfileDirectory,
    updateProfileEvent,
    updateQuietHours
  };

  document.addEventListener("connection:updated", resetCaches);
})();
