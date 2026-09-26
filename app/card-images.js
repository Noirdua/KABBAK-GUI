(function () {
  const DEFAULT_DECK_ID = "ceremonial-magick";

  const trumpNumberByCanonicalName = {
    fool: 0,
    magus: 1,
    magician: 1,
    "high priestess": 2,
    empress: 3,
    emperor: 4,
    hierophant: 5,
    lovers: 6,
    chariot: 7,
    lust: 8,
    strength: 8,
    hermit: 9,
    fortune: 10,
    "wheel of fortune": 10,
    justice: 11,
    "hanged man": 12,
    death: 13,
    art: 14,
    temperance: 14,
    devil: 15,
    tower: 16,
    star: 17,
    moon: 18,
    sun: 19,
    aeon: 20,
    judgement: 20,
    judgment: 20,
    universe: 21,
    world: 21
  };

  const pipValueByToken = {
    ace: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10
  };

  const rankWordByPipValue = {
    1: "Ace",
    2: "Two",
    3: "Three",
    4: "Four",
    5: "Five",
    6: "Six",
    7: "Seven",
    8: "Eight",
    9: "Nine",
    10: "Ten"
  };

  const trumpRomanToNumber = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
    XI: 11,
    XII: 12,
    XIII: 13,
    XIV: 14,
    XV: 15,
    XVI: 16,
    XVII: 17,
    XVIII: 18,
    XIX: 19,
    XX: 20,
    XXI: 21
  };

  const suitSearchAliasesById = {
    wands: ["wands"],
    cups: ["cups"],
    swords: ["swords"],
    disks: ["disks", "pentacles", "coins"]
  };
  const defaultPipRankOrder = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
  const defaultThumbnailConfig = {
    root: "thumbs",
    width: 240,
    height: 360,
    fit: "inside",
    quality: 82
  };
  const defaultDeckWarmupOptions = {
    includeThumbnails: true,
    includeFull: false
  };
  const activeDeckWarmupOptions = {
    includeThumbnails: true,
    includeFull: true
  };
  const standardMajorCardNames = [
    "Fool",
    "Magus",
    "High Priestess",
    "Empress",
    "Emperor",
    "Hierophant",
    "Lovers",
    "Chariot",
    "Lust",
    "Hermit",
    "Fortune",
    "Justice",
    "Hanged Man",
    "Death",
    "Art",
    "Devil",
    "Tower",
    "Star",
    "Moon",
    "Sun",
    "Aeon",
    "Universe"
  ];
  const standardMinorRanks = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Knight", "Queen", "Prince", "Princess"];
  const standardMinorSuits = ["Wands", "Cups", "Swords", "Disks"];
  const standardDeckCardNames = buildStandardDeckCardNames();

  let deckManifestSources = null;
  let deckManifestSourcesBuilt = false;
  let lastResetConnectionTimestamp = 0;

  const manifestCache = new Map();
  const cardBackCache = new Map();
  const cardBackThumbnailCache = new Map();
  const imagePreloadCache = new Map();
  const loadedImageCache = new Map();
  const deckImagePreloadCache = new Map();
  const deckPreloadStatus = {
    activeDeckId: DEFAULT_DECK_ID,
    selectedDeckPhase: "idle",
    selectedDeckLoadedCount: 0,
    selectedDeckTotalCount: 0,
    selectedDeckPercent: 0,
    warmedDeckIds: []
  };
  let activeDeckId = DEFAULT_DECK_ID;

  function getApiBaseUrl() {
    return String(window.TarotDataService?.getApiBaseUrl?.() || window.TarotAppConfig?.apiBaseUrl || "")
      .trim()
      .replace(/\/+$/, "");
  }

  function buildManifestRequestHeaders(path) {
    const normalizedPath = String(path || "").trim();
    const apiBaseUrl = getApiBaseUrl();
    const apiKey = String(
      window.TarotDataService?.getApiKey?.()
      || window.TarotAppConfig?.getApiKey?.()
      || window.TarotAppConfig?.apiKey
      || ""
    ).trim();

    if (!normalizedPath || !apiBaseUrl || !apiKey || !normalizedPath.startsWith(apiBaseUrl)) {
      return {};
    }

    return {
      "x-api-key": apiKey
    };
  }

  function rewriteBasePathForApi(basePath) {
    const normalizedBasePath = String(basePath || "").trim();
    if (!normalizedBasePath) {
      return normalizedBasePath;
    }

    return window.TarotDataService?.toApiAssetUrl?.(normalizedBasePath) || normalizedBasePath;
  }

  function canonicalMajorName(cardName) {
    return String(cardName || "")
      .trim()
      .toLowerCase()
      .replace(/^the\s+/, "")
      .replace(/\s+/g, " ");
  }

  function canonicalMinorName(cardName) {
    const parsedMinor = parseMinorCard(cardName);
    if (!parsedMinor) {
      return "";
    }

    return `${String(parsedMinor.rankKey || "").trim().toLowerCase()} of ${parsedMinor.suitId}`;
  }

  function toTitleCase(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
      return "";
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function normalizeDeckId(deckId) {
    const sources = getDeckManifestSources();
    const normalized = String(deckId || "").trim().toLowerCase();
    if (sources[normalized]) {
      return normalized;
    }

    const byName = Object.keys(sources).find((id) => {
      const name = String(sources[id]?.name || sources[id]?.label || "").trim().toLowerCase();
      return name && name === normalized;
    });
    if (byName) {
      return byName;
    }

    if (sources[DEFAULT_DECK_ID]) {
      return DEFAULT_DECK_ID;
    }

    const fallbackId = Object.keys(sources)[0];
    return fallbackId || DEFAULT_DECK_ID;
  }

  function normalizeTrumpNumber(value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 21) {
      return null;
    }

    return parsed;
  }

  function parseTrumpNumberKey(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if (!normalized) {
      return null;
    }

    if (/^\d+$/.test(normalized)) {
      return normalizeTrumpNumber(Number(normalized));
    }

    if (Object.prototype.hasOwnProperty.call(trumpRomanToNumber, normalized)) {
      return normalizeTrumpNumber(trumpRomanToNumber[normalized]);
    }

    return null;
  }

  function normalizeSuitId(suitInput) {
    const suit = String(suitInput || "").trim().toLowerCase();
    if (suit === "pentacles") {
      return "disks";
    }
    return suit;
  }

  function resolveDeckOptions(optionsOrDeckId) {
    let resolvedDeckId = "";
    let trumpNumber = null;

    if (typeof optionsOrDeckId === "string") {
      resolvedDeckId = normalizeDeckId(optionsOrDeckId);
    } else if (optionsOrDeckId && typeof optionsOrDeckId === "object") {
      if (optionsOrDeckId.deckId) {
        resolvedDeckId = normalizeDeckId(optionsOrDeckId.deckId);
      }
      trumpNumber = normalizeTrumpNumber(optionsOrDeckId.trumpNumber);
    }

    if (!resolvedDeckId) {
      // Prefer the user-selected active deck so Sky/Now cards and other
      // callers without an explicit deckId follow Settings deck changes.
      resolvedDeckId = normalizeDeckId(activeDeckId);
    }

    return { resolvedDeckId, trumpNumber };
  }

  function buildStandardDeckCardNames() {
    const cardNames = [...standardMajorCardNames];

    standardMinorSuits.forEach((suit) => {
      standardMinorRanks.forEach((rank) => {
        cardNames.push(`${rank} of ${suit}`);
      });
    });

    return cardNames;
  }

  function deferPreload(callback) {
    if (typeof callback !== "function") {
      return Promise.resolve([]);
    }

    if (typeof window.requestIdleCallback === "function") {
      return new Promise((resolve) => {
        window.requestIdleCallback(() => {
          Promise.resolve(callback()).then(resolve).catch(() => resolve([]));
        }, { timeout: 1200 });
      });
    }

    return Promise.resolve().then(callback).catch(() => []);
  }

  function emitDeckPreloadStatus() {
    const snapshot = {
      activeDeckId: deckPreloadStatus.activeDeckId,
      selectedDeckPhase: deckPreloadStatus.selectedDeckPhase,
      selectedDeckLoadedCount: deckPreloadStatus.selectedDeckLoadedCount,
      selectedDeckTotalCount: deckPreloadStatus.selectedDeckTotalCount,
      selectedDeckPercent: deckPreloadStatus.selectedDeckPercent,
      warmedDeckIds: [...deckPreloadStatus.warmedDeckIds],
      warmedDeckCount: deckPreloadStatus.warmedDeckIds.length,
      totalDeckCount: Object.keys(getDeckManifestSources()).length
    };

    document.dispatchEvent(new CustomEvent("tarot:deck-cache-status", {
      detail: snapshot
    }));

    return snapshot;
  }

  function setDeckPreloadStatus(partialStatus) {
    if (!partialStatus || typeof partialStatus !== "object") {
      return emitDeckPreloadStatus();
    }

    if (Object.prototype.hasOwnProperty.call(partialStatus, "activeDeckId")) {
      deckPreloadStatus.activeDeckId = normalizeDeckId(partialStatus.activeDeckId);
    }

    if (Object.prototype.hasOwnProperty.call(partialStatus, "selectedDeckPhase")) {
      deckPreloadStatus.selectedDeckPhase = String(partialStatus.selectedDeckPhase || "idle");
    }

    if (Object.prototype.hasOwnProperty.call(partialStatus, "selectedDeckLoadedCount")) {
      const nextLoadedCount = Number(partialStatus.selectedDeckLoadedCount);
      deckPreloadStatus.selectedDeckLoadedCount = Number.isFinite(nextLoadedCount) && nextLoadedCount >= 0
        ? nextLoadedCount
        : 0;
    }

    if (Object.prototype.hasOwnProperty.call(partialStatus, "selectedDeckTotalCount")) {
      const nextTotalCount = Number(partialStatus.selectedDeckTotalCount);
      deckPreloadStatus.selectedDeckTotalCount = Number.isFinite(nextTotalCount) && nextTotalCount >= 0
        ? nextTotalCount
        : 0;
    }

    if (Object.prototype.hasOwnProperty.call(partialStatus, "selectedDeckPercent")) {
      const nextPercent = Number(partialStatus.selectedDeckPercent);
      deckPreloadStatus.selectedDeckPercent = Number.isFinite(nextPercent)
        ? Math.max(0, Math.min(100, nextPercent))
        : 0;
    }

    if (Array.isArray(partialStatus.warmedDeckIds)) {
      deckPreloadStatus.warmedDeckIds = Array.from(new Set(partialStatus.warmedDeckIds.map((deckId) => normalizeDeckId(deckId))));
    }

    return emitDeckPreloadStatus();
  }

  function markDeckAsWarmed(deckId) {
    const normalizedDeckId = normalizeDeckId(deckId);
    if (!deckPreloadStatus.warmedDeckIds.includes(normalizedDeckId)) {
      deckPreloadStatus.warmedDeckIds = [...deckPreloadStatus.warmedDeckIds, normalizedDeckId];
    }
  }

  function parseMinorCard(cardName) {
    const match = String(cardName || "")
      .trim()
      .match(/^(ace|two|three|four|five|six|seven|eight|nine|ten|knight|queen|prince|princess|king|page|knave|[2-9]|10)\s+of\s+(cups|wands|swords|pentacles|disks)$/i);

    if (!match) {
      return null;
    }

    const rankToken = String(match[1] || "").toLowerCase();
    const suitId = normalizeSuitId(match[2]);
    const pipValue = pipValueByToken[rankToken] ?? null;

    if (Number.isFinite(pipValue)) {
      const rankWord = rankWordByPipValue[pipValue] || "";
      return {
        suitId,
        pipValue,
        court: "",
        rankWord,
        rankKey: rankWord.toLowerCase()
      };
    }

    const courtWord = toTitleCase(rankToken);
    if (!courtWord) {
      return null;
    }

    return {
      suitId,
      pipValue: null,
      court: rankToken,
      rankWord: courtWord,
      rankKey: rankToken
    };
  }

  function applyTemplate(template, variables) {
    return String(template || "")
      .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, token) => {
        const value = variables[token];
        return value == null ? "" : String(value);
      });
  }

  function isRemoteAssetPath(pathValue) {
    return /^(https?:)?\/\//i.test(String(pathValue || ""));
  }

  function joinAssetPath(basePath, relativePath) {
    const normalizedBasePath = String(basePath || "").trim().replace(/\/+$/, "");
    const normalizedRelativePath = String(relativePath || "")
      .trim()
      .replace(/^\.\//, "")
      .replace(/^\/+/, "");

    if (!normalizedBasePath) {
      return normalizedRelativePath;
    }

    if (!normalizedRelativePath) {
      return normalizedBasePath;
    }

    if (!isRemoteAssetPath(normalizedBasePath)) {
      return `${normalizedBasePath}/${normalizedRelativePath}`;
    }

    try {
      const url = new URL(normalizedBasePath);
      const encodedRelativePath = normalizedRelativePath
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

      url.pathname = `${url.pathname.replace(/\/+$/, "")}/${encodedRelativePath}`;
      return url.toString();
    } catch {
      return `${normalizedBasePath}/${normalizedRelativePath}`;
    }
  }

  function toDeckAssetPath(manifest, relativeOrAbsolutePath) {
    const normalizedPath = String(relativeOrAbsolutePath || "").trim();
    if (!normalizedPath) {
      return "";
    }

    if (isRemoteAssetPath(normalizedPath) || normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    return joinAssetPath(manifest.basePath, normalizedPath);
  }

  function resolveDeckCardBackPath(manifest) {
    if (!manifest) {
      return null;
    }

    const explicitCardBack = String(manifest.cardBack || "").trim();
    if (explicitCardBack) {
      return toDeckAssetPath(manifest, explicitCardBack) || null;
    }

    const detectedCardBack = String(manifest.cardBackPath || "").trim();
    if (detectedCardBack) {
      return toDeckAssetPath(manifest, detectedCardBack) || null;
    }

    return null;
  }

  function normalizeThumbnailConfig(rawConfig, fallbackRoot = "") {
    if (rawConfig === false) {
      return false;
    }

    if (!rawConfig || typeof rawConfig !== "object") {
      const root = String(fallbackRoot || "").trim();
      if (!root) {
        return null;
      }

      return {
        ...defaultThumbnailConfig,
        root
      };
    }

    const root = String(rawConfig.root || fallbackRoot || defaultThumbnailConfig.root).trim();
    if (!root) {
      return null;
    }

    return {
      root,
      width: Number.isInteger(Number(rawConfig.width)) && Number(rawConfig.width) > 0
        ? Number(rawConfig.width)
        : defaultThumbnailConfig.width,
      height: Number.isInteger(Number(rawConfig.height)) && Number(rawConfig.height) > 0
        ? Number(rawConfig.height)
        : defaultThumbnailConfig.height,
      fit: String(rawConfig.fit || defaultThumbnailConfig.fit).trim() || defaultThumbnailConfig.fit,
      quality: Number.isInteger(Number(rawConfig.quality)) && Number(rawConfig.quality) >= 1 && Number(rawConfig.quality) <= 100
        ? Number(rawConfig.quality)
        : defaultThumbnailConfig.quality
    };
  }

  function resolveDeckThumbnailPath(manifest, relativePath) {
    if (!manifest || !manifest.thumbnails || manifest.thumbnails === false) {
      return null;
    }

    const normalizedPath = String(relativePath || "").trim().replace(/^\.\//, "");
    if (!normalizedPath || isRemoteAssetPath(normalizedPath) || normalizedPath.startsWith("/")) {
      return null;
    }

    return toDeckAssetPath(manifest, `${manifest.thumbnails.root}/${normalizedPath}`) || null;
  }

  function readManifestJsonSync(path) {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", encodeURI(path), false);
      request.setRequestHeader("Cache-Control", "no-cache");
      request.setRequestHeader("Pragma", "no-cache");
      Object.entries(buildManifestRequestHeaders(path)).forEach(([headerName, headerValue]) => {
        request.setRequestHeader(headerName, headerValue);
      });
      request.send(null);

      const okStatus = (request.status >= 200 && request.status < 300) || request.status === 0;
      if (!okStatus || !request.responseText) {
        return null;
      }

      const payload = JSON.parse(request.responseText);
      // The API wraps successful responses in { data, meta }; unwrap the data.
      if (payload && typeof payload === "object" && "data" in payload) {
        return payload.data;
      }
      return payload;
    } catch {
      return null;
    }
  }

  function normalizeDerivedDeckId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\.json$/i, "")
      .replace(/[_\s]+/g, "-")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function toPathSegments(pathValue) {
    const normalizedPath = String(pathValue || "").trim();
    if (!normalizedPath) {
      return [];
    }

    let pathname = normalizedPath;
    try {
      pathname = new URL(normalizedPath).pathname;
    } catch {
      pathname = normalizedPath.split("?")[0].split("#")[0];
    }

    return pathname
      .split("/")
      .map((segment) => String(segment || "").trim())
      .filter(Boolean)
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      });
  }

  function deriveDeckIdFromPath(pathValue) {
    const segments = toPathSegments(pathValue);
    if (!segments.length) {
      return "";
    }

    const lowerSegments = segments.map((segment) => segment.toLowerCase());
    for (let index = 0; index < lowerSegments.length - 1; index += 1) {
      if (lowerSegments[index] !== "decks") {
        continue;
      }

      const deckId = normalizeDerivedDeckId(segments[index + 1]);
      if (deckId && deckId !== "manifest") {
        return deckId;
      }
    }

    const lastIndex = segments.length - 1;
    const lastLower = lowerSegments[lastIndex];
    if ((lastLower === "deck.json" || lastLower === "manifest" || lastLower === "manifest.json") && lastIndex > 0) {
      return normalizeDerivedDeckId(segments[lastIndex - 1]);
    }

    const fallbackId = normalizeDerivedDeckId(segments[lastIndex]);
    if (!fallbackId || fallbackId === "decks" || fallbackId === "deck" || fallbackId === "manifest") {
      return "";
    }

    return fallbackId;
  }

  function deriveDeckIdFromSource(entry) {
    const explicitId = normalizeDerivedDeckId(entry?.id || entry?.deckId || "");
    if (explicitId) {
      return explicitId;
    }

    const manifestPathId = deriveDeckIdFromPath(entry?.manifestPath);
    if (manifestPathId) {
      return manifestPathId;
    }

    return deriveDeckIdFromPath(entry?.basePath);
  }

  function formatDeckLabelFromId(deckId) {
    const normalizedDeckId = normalizeDerivedDeckId(deckId);
    if (!normalizedDeckId) {
      return "";
    }

    return normalizedDeckId
      .split("-")
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  function resolveDeckSourceLabel(entry, deckId) {
    const explicitLabel = String(entry?.name || entry?.label || "").trim();
    if (explicitLabel) {
      return explicitLabel;
    }

    return formatDeckLabelFromId(deckId) || deckId;
  }

  function toDeckSourceMap(sourceList) {
    const sourceMap = {};
    if (!Array.isArray(sourceList)) {
      return sourceMap;
    }

    sourceList.forEach((entry) => {
      const id = deriveDeckIdFromSource(entry);
      const basePath = String(entry?.basePath || "").trim().replace(/\/$/, "");
      const manifestPath = String(entry?.manifestPath || "").trim();
      if (!id || !manifestPath) {
        return;
      }

      sourceMap[id] = {
        id,
        label: resolveDeckSourceLabel(entry, id),
        basePath,
        manifestPath,
        cardBackPath: String(entry?.cardBackPath || "").trim(),
        thumbnailRoot: String(entry?.thumbnailRoot || "").trim()
      };
    });

    return sourceMap;
  }

  function buildDeckManifestSources() {
    if (!window.TarotDataService?.isApiEnabled?.() && !getApiBaseUrl()) {
      return {};
    }

    // Skip the sync registry fetch until the connection is verified so an
    // invalid/missing key doesn't fire a guaranteed 401 during boot. The caches
    // reset on connection:updated, so decks load once connected.
    const connected = window.TarotAppConfig?.getConnectionAccess?.()?.connected === true;
    if (!connected) {
      return {};
    }

    const registryUrl = window.TarotDataService?.buildApiUrl?.("/api/v1/decks/options") || `${getApiBaseUrl()}/api/v1/decks/options`;
    if (!registryUrl) {
      return {};
    }

    const registry = readManifestJsonSync(registryUrl);
    const registryDecks = Array.isArray(registry?.decks)
      ? registry.decks.map((entry) => {
          const normalizedDeckId = normalizeDerivedDeckId(entry?.id || entry?.deckId || "");
          const apiManifestPath = normalizedDeckId
            ? (
                window.TarotDataService?.buildApiUrl?.(`/api/v1/decks/${encodeURIComponent(normalizedDeckId)}/manifest`)
                || `${getApiBaseUrl()}/api/v1/decks/${encodeURIComponent(normalizedDeckId)}/manifest`
              )
            : "";

          return {
            id: normalizedDeckId,
            label: entry?.name || entry?.label,
            basePath: entry?.basePath,
            manifestPath: String(entry?.manifestPath || "").trim() || apiManifestPath,
            cardBackPath: entry?.cardBackPath,
            thumbnailRoot: entry?.thumbnailRoot
          };
        })
      : [];

    return toDeckSourceMap(registryDecks);
  }

  function resetConnectionCaches() {
    const now = Date.now();
    if (now - lastResetConnectionTimestamp < 1000) {
      return;
    }
    lastResetConnectionTimestamp = now;
    deckManifestSourcesBuilt = false;
    deckManifestSources = {};
    manifestCache.clear();
    cardBackCache.clear();
    cardBackThumbnailCache.clear();
    imagePreloadCache.clear();

    // Only rebuild immediately when the connection is already verified;
    // otherwise leave it unbuilt so the next getDeckManifestSources() builds
    // lazily once connectionAccess.connected flips true (access-updated).
    if (window.TarotAppConfig?.getConnectionAccess?.()?.connected === true) {
      deckManifestSources = buildDeckManifestSources();
      deckManifestSourcesBuilt = true;
    }
    loadedImageCache.clear();
    deckImagePreloadCache.clear();
    setDeckPreloadStatus({
      activeDeckId,
      selectedDeckPhase: "idle",
      selectedDeckLoadedCount: 0,
      selectedDeckTotalCount: 0,
      selectedDeckPercent: 0,
      warmedDeckIds: []
    });
    setActiveDeck(activeDeckId);
  }

  function getDeckManifestSources(forceRefresh = false) {
    if (forceRefresh || !deckManifestSourcesBuilt) {
      const built = buildDeckManifestSources();
      const connected = window.TarotAppConfig?.getConnectionAccess?.()?.connected === true;
      deckManifestSources = built;
      // Only cache the result once the connection is verified. Building while
      // disconnected yields an empty map, and caching it would leave the deck
      // list empty even after the connection lands.
      deckManifestSourcesBuilt = connected;
    }

    return deckManifestSources || {};
  }

  function normalizeDeckManifest(source, rawManifest) {
    if (!rawManifest || typeof rawManifest !== "object") {
      return null;
    }

    const rawMajorNameOverridesByTrump = rawManifest.majorNameOverridesByTrump;
    const majorNameOverridesByTrump = {};
    if (rawMajorNameOverridesByTrump && typeof rawMajorNameOverridesByTrump === "object") {
      Object.entries(rawMajorNameOverridesByTrump).forEach(([rawKey, rawValue]) => {
        const trumpNumber = parseTrumpNumberKey(rawKey);
        const value = String(rawValue || "").trim();
        if (Number.isInteger(trumpNumber) && value) {
          majorNameOverridesByTrump[trumpNumber] = value;
        }
      });
    }

    const rawMinorNameOverrides = rawManifest.minorNameOverrides;
    const minorNameOverrides = {};
    if (rawMinorNameOverrides && typeof rawMinorNameOverrides === "object") {
      Object.entries(rawMinorNameOverrides).forEach(([rawKey, rawValue]) => {
        const key = canonicalMinorName(rawKey);
        const value = String(rawValue || "").trim();
        if (key && value) {
          minorNameOverrides[key] = value;
        }
      });
    }
    const rawSuitNameOverrides = rawManifest.suitNameOverrides;
    const suitNameOverrides = {};
    if (rawSuitNameOverrides && typeof rawSuitNameOverrides === "object") {
      Object.entries(rawSuitNameOverrides).forEach(([rawKey, rawValue]) => {
        const key = String(rawKey || "").trim().toLowerCase();
        const value = String(rawValue || "").trim();
        if (key && value) {
          suitNameOverrides[key] = value;
        }
      });
    }

    return {
      id: source.id,
      label: String(rawManifest.name || rawManifest.label || source.label || source.name || source.id),
      basePath: rewriteBasePathForApi(String(rawManifest.basePath || source.basePath || "").replace(/\/$/, "")),
      cardBack: String(rawManifest.cardBack || "").trim(),
      cardBackPath: String(rawManifest.cardBackPath || source.cardBackPath || "").trim(),
      thumbnails: normalizeThumbnailConfig(rawManifest.thumbnails, source.thumbnailRoot),
      system: String(rawManifest.system || "tarot").trim().toLowerCase() || "tarot",
      majors: rawManifest.majors || {},
      minors: rawManifest.minors || {},
      hexagrams: rawManifest.hexagrams && typeof rawManifest.hexagrams === "object" ? rawManifest.hexagrams : {},
      hexagramNames: rawManifest.hexagramNames && typeof rawManifest.hexagramNames === "object" ? rawManifest.hexagramNames : {},
      cards: rawManifest.cards && typeof rawManifest.cards === "object" ? rawManifest.cards : {},
      minorNameOverrides,
      majorNameOverridesByTrump,
      suitNameOverrides
    };
  }

  function getDeckManifest(deckId) {
    const normalizedDeckId = normalizeDeckId(deckId);
    if (manifestCache.has(normalizedDeckId)) {
      return manifestCache.get(normalizedDeckId);
    }

    const sources = getDeckManifestSources();
    const source = sources[normalizedDeckId];
    if (!source) {
      return null;
    }

    const rawManifest = readManifestJsonSync(source.manifestPath);
    const normalizedManifest = normalizeDeckManifest(source, rawManifest);
    if (normalizedManifest) {
      manifestCache.set(normalizedDeckId, normalizedManifest);
    }
    return normalizedManifest;
  }

  const THOTH_TO_RWS_COURT = {
    princess: "page",
    prince: "knight",
    queen: "queen",
    knight: "king"
  };

  const RWS_COURT_SYNONYMS = {
    page: ["page", "knave", "valet", "jack", "fante", "maiden", "daughter"],
    knight: ["knight", "cavalier", "chevalier", "horseman"],
    queen: ["queen", "reine", "dame"],
    king: ["king", "roi"]
  };

  const PAGE_FAMILY = new Set(RWS_COURT_SYNONYMS.page);
  const THOTH_UNIQUE_COURTS = new Set(["princess", "prince"]);

  const SUIT_SYNONYMS = {
    wands: ["wands", "batons", "staves", "rods"],
    cups: ["cups", "chalices", "goblets"],
    swords: ["swords", "blades"],
    disks: ["disks", "pentacles", "coins", "deniers"]
  };

  function firstWord(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .split(/\s+/)[0] || "";
  }

  function addCourtToken(tokens, value) {
    const token = firstWord(value);
    if (token) {
      tokens.add(token);
    }
  }

  function collectNamedCourtTokens(minorRule, tokens, depth) {
    const nextTokens = tokens || new Set();
    const nextDepth = depth || 0;
    if (!minorRule || typeof minorRule !== "object" || nextDepth > 2) {
      return nextTokens;
    }
    getRankOrder(minorRule).forEach((entry) => addCourtToken(nextTokens, entry));
    const cards = minorRule.cards;
    if (cards && typeof cards === "object") {
      Object.keys(cards).forEach((key) => {
        const match = String(key || "").trim().toLowerCase().match(/^([a-z]+)\s+of\s+/);
        if (match) {
          addCourtToken(nextTokens, match[1]);
        }
      });
    }
    if (nextDepth === 0) {
      collectNamedCourtTokens(minorRule.courts, nextTokens, 1);
      collectNamedCourtTokens(minorRule.smalls, nextTokens, 1);
    }
    return nextTokens;
  }

  function usesRwsCourtNames(minorRule) {
    const tokens = collectNamedCourtTokens(minorRule);
    const hasPageFamily = Array.from(tokens).some((token) => PAGE_FAMILY.has(token));
    const hasThoth = Array.from(tokens).some((token) => THOTH_UNIQUE_COURTS.has(token));
    return hasPageFamily && !hasThoth;
  }

  function courtAliasMap(manifest) {
    const raw = Object.assign(
      {},
      manifest && manifest.courtRankAliases && typeof manifest.courtRankAliases === "object" ? manifest.courtRankAliases : {},
      manifest && manifest.minors && manifest.minors.courtRankAliases && typeof manifest.minors.courtRankAliases === "object"
        ? manifest.minors.courtRankAliases
        : {}
    );
    const map = {};
    Object.keys(raw).forEach((from) => {
      const src = firstWord(from);
      const dest = firstWord(raw[from]);
      if (src && dest) {
        map[src] = dest;
      }
    });
    return map;
  }

  function synonymsForCourt(rank, rws) {
    if (RWS_COURT_SYNONYMS[rank]) {
      return RWS_COURT_SYNONYMS[rank];
    }
    if (rws && THOTH_TO_RWS_COURT[rank]) {
      return RWS_COURT_SYNONYMS[THOTH_TO_RWS_COURT[rank]] || [];
    }
    return [];
  }

  function courtRankLookupOrder(rankKey, minorRule, options) {
    const rank = firstWord(rankKey);
    const preferMapped = Boolean(options && options.preferMapped);
    const manifest = options && options.manifest ? options.manifest : null;
    const rws = usesRwsCourtNames(minorRule);
    const mapped = rws ? THOTH_TO_RWS_COURT[rank] || "" : "";
    const order = [];
    const seen = new Set();
    const push = (value) => {
      const next = firstWord(value);
      if (!next || seen.has(next)) {
        return;
      }
      seen.add(next);
      order.push(next);
    };
    const pushFamily = (canonical) => {
      if (!canonical) {
        return;
      }
      push(canonical);
      synonymsForCourt(canonical, rws).forEach(push);
    };
    if (preferMapped) {
      pushFamily(mapped || rank);
      pushFamily(rank);
    } else {
      pushFamily(rank);
      pushFamily(mapped);
    }
    const overrides = manifest && manifest.courtNameOverrides && typeof manifest.courtNameOverrides === "object"
      ? manifest.courtNameOverrides
      : {};
    Object.keys(overrides).forEach((from) => {
      if (seen.has(firstWord(from))) {
        push(overrides[from]);
      }
    });
    const aliases = courtAliasMap(manifest);
    Object.keys(aliases).forEach((from) => {
      const dest = aliases[from];
      if (seen.has(dest) || dest === rank || dest === mapped) {
        push(from);
      }
    });
    return order;
  }

  function suitLookupOrder(suitId, manifest) {
    const suit = normalizeSuitId(suitId);
    const order = [];
    const seen = new Set();
    const push = (value) => {
      const next = firstWord(value);
      if (!next || seen.has(next)) {
        return;
      }
      seen.add(next);
      order.push(next);
    };
    (SUIT_SYNONYMS[suit] || [suit]).forEach(push);
    const overrides = manifest && manifest.suitNameOverrides && typeof manifest.suitNameOverrides === "object"
      ? manifest.suitNameOverrides
      : {};
    push(overrides[suit]);
    if (suit === "disks") {
      push(overrides.pentacles);
    }
    if (suit === "wands") {
      push(overrides.wands);
    }
    return order;
  }

  function getRankOrder(minorRule, fallbackRankOrder = []) {
    const explicitRankOrder = Array.isArray(minorRule?.rankOrder) ? minorRule.rankOrder : [];
    const rankOrderSource = explicitRankOrder.length ? explicitRankOrder : fallbackRankOrder;
    return rankOrderSource.map((entry) => String(entry || "").trim()).filter(Boolean);
  }

  function getRankIndex(minorRule, parsedMinor, fallbackRankOrder, manifest) {
    if (!minorRule || !parsedMinor) {
      return null;
    }

    const lowerRankWord = String(parsedMinor.rankWord || "").toLowerCase();
    const lowerRankKey = String(parsedMinor.rankKey || "").toLowerCase();
    const indexByKey = minorRule.rankIndexByKey && typeof minorRule.rankIndexByKey === "object"
      ? minorRule.rankIndexByKey
      : null;
    const rankAliases = courtRankLookupOrder(lowerRankKey, minorRule, {
      preferMapped: usesRwsCourtNames(minorRule) && !indexByKey,
      manifest: manifest || null
    });

    if (indexByKey) {
      const keys = [lowerRankKey].concat(rankAliases);
      for (let i = 0; i < keys.length; i += 1) {
        const mapped = Number(indexByKey[keys[i]]);
        if (Number.isInteger(mapped) && mapped >= 0) {
          return mapped;
        }
      }
    }

    const rankOrder = getRankOrder(minorRule, fallbackRankOrder || []).map((entry) => firstWord(entry));
    for (let i = 0; i < rankAliases.length; i += 1) {
      const index = rankOrder.indexOf(rankAliases[i]);
      if (index >= 0) {
        return index;
      }
    }
    const exact = rankOrder.indexOf(lowerRankWord);
    return exact >= 0 ? exact : null;
  }

  function resolveMinorNumberTemplateGroup(groupRule, parsedMinor, fallbackRankOrder, manifest) {
    if (!groupRule || typeof groupRule !== "object") {
      return null;
    }

    const rankIndex = getRankIndex(groupRule, parsedMinor, fallbackRankOrder, manifest);
    if (!Number.isInteger(rankIndex) || rankIndex < 0) {
      return null;
    }

    const suitBaseRaw = Number(groupRule?.suitBase?.[parsedMinor.suitId]);
    if (!Number.isFinite(suitBaseRaw)) {
      return null;
    }

    const numberPad = Number.isInteger(groupRule.numberPad) ? groupRule.numberPad : 2;
    const cardNumber = String(suitBaseRaw + rankIndex).padStart(numberPad, "0");
    const template = String(groupRule.template || "{number}.png");

    return applyTemplate(template, {
      number: cardNumber,
      suitId: parsedMinor.suitId,
      rank: parsedMinor.rankWord,
      rankKey: parsedMinor.rankKey,
      index: rankIndex
    });
  }

  function normalizeCardFiles(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry || "").trim()).filter(Boolean);
    }
    const single = String(value || "").trim();
    return single ? [single] : [];
  }

  function resolveTrumpNumber(manifest, cardName, trumpNumber) {
    const explicit = normalizeTrumpNumber(trumpNumber);
    if (Number.isInteger(explicit)) {
      return explicit;
    }
    const canonical = canonicalMajorName(cardName);
    const fromName = trumpNumberByCanonicalName[canonical];
    if (Number.isInteger(fromName)) {
      return fromName;
    }
    const overrides = manifest?.majorNameOverridesByTrump;
    if (!overrides || typeof overrides !== "object") {
      return null;
    }
    const match = Object.keys(overrides).find((key) => canonicalMajorName(overrides[key]) === canonical);
    return match ? normalizeTrumpNumber(match) : null;
  }

  function canonicalNameForTrump(trumpNumber) {
    const trump = normalizeTrumpNumber(trumpNumber);
    if (!Number.isInteger(trump)) {
      return "";
    }
    return Object.keys(trumpNumberByCanonicalName).find((name) => trumpNumberByCanonicalName[name] === trump) || "";
  }

  function resolveMinorLookupName(manifest, cardName) {
    const overrides = manifest?.minorNameOverrides;
    if (!overrides || typeof overrides !== "object") {
      return cardName;
    }
    const target = String(cardName || "").trim().toLowerCase();
    const match = Object.keys(overrides).find((key) => String(overrides[key] || "").trim().toLowerCase() === target);
    return match || cardName;
  }

  function resolveMajorFiles(manifest, cardName, trumpNumber) {
    const majorRule = manifest?.majors;
    if (!majorRule || typeof majorRule !== "object") {
      return [];
    }

    const canonicalName = canonicalMajorName(cardName);
    const trumpNo = resolveTrumpNumber(manifest, cardName, trumpNumber);
    if (majorRule.mode === "canonical-map") {
      const cards = majorRule.cards || {};
      const byName = normalizeCardFiles(cards[canonicalName]);
      if (byName.length) {
        return byName;
      }
      const canonicalFromTrump = canonicalNameForTrump(trumpNo);
      return canonicalFromTrump ? normalizeCardFiles(cards[canonicalFromTrump]) : [];
    }

    if (!Number.isInteger(trumpNo) || trumpNo < 0 || trumpNo > 21) {
      return [];
    }

    if (majorRule.mode === "trump-map") {
      const cards = majorRule.cards || {};
      return normalizeCardFiles(cards[String(trumpNo)] ?? cards[trumpNo]);
    }

    if (majorRule.mode === "trump-template") {
      const numberPad = Number.isInteger(majorRule.numberPad) ? majorRule.numberPad : 2;
      const template = String(majorRule.template || "{number}.png");
      const number = String(trumpNo).padStart(numberPad, "0");
      return normalizeCardFiles(applyTemplate(template, {
        trump: trumpNo,
        number
      }));
    }

    return [];
  }

  function resolveMinorFile(manifest, parsedMinor) {
    const minorRule = manifest?.minors;
    if (!minorRule || typeof minorRule !== "object") {
      return null;
    }

    if (minorRule.mode === "file-map") {
      const ranks = courtRankLookupOrder(parsedMinor.rankKey, minorRule, { preferMapped: true, manifest });
      const suits = suitLookupOrder(parsedMinor.suitId, manifest);
      for (let i = 0; i < ranks.length; i += 1) {
        const rank = ranks[i];
        for (let j = 0; j < suits.length; j += 1) {
          const suit = suits[j];
          const mapped = minorRule.cards?.[`${rank} of ${suit}`]
            || minorRule.cards?.[`${suit}:${rank}`];
          const files = Array.isArray(mapped) ? mapped : [mapped];
          const first = files.map((entry) => String(entry || "").trim()).find(Boolean);
          if (first) {
            return first;
          }
        }
      }
      return null;
    }

    if (minorRule.mode === "split-number-template") {
      if (Number.isFinite(parsedMinor.pipValue)) {
        return resolveMinorNumberTemplateGroup(minorRule.smalls, parsedMinor, defaultPipRankOrder, manifest);
      }

      return resolveMinorNumberTemplateGroup(minorRule.courts, parsedMinor, [], manifest);
    }

    const rankIndex = getRankIndex(minorRule, parsedMinor, [], manifest);
    if (!Number.isInteger(rankIndex) || rankIndex < 0) {
      return null;
    }

    if (minorRule.mode === "suit-base-and-rank-order") {
      const suitBaseRaw = Number(minorRule?.suitBase?.[parsedMinor.suitId]);
      if (!Number.isFinite(suitBaseRaw)) {
        return null;
      }

      const numberPad = Number.isInteger(minorRule.numberPad) ? minorRule.numberPad : 2;
      const cardNumber = String(suitBaseRaw + rankIndex).padStart(numberPad, "0");
      const suitWord = String(minorRule?.suitLabel?.[parsedMinor.suitId] || toTitleCase(parsedMinor.suitId));
      const template = String(minorRule.template || "{number}_{rank} {suit}.webp");

      return applyTemplate(template, {
        number: cardNumber,
        rank: parsedMinor.rankWord,
        rankKey: parsedMinor.rankKey,
        suit: suitWord,
        suitId: parsedMinor.suitId,
        index: rankIndex + 1
      });
    }

    if (minorRule.mode === "suit-prefix-and-rank-order") {
      const suitPrefix = minorRule?.suitPrefix?.[parsedMinor.suitId];
      if (!suitPrefix) {
        return null;
      }

      const indexStart = Number.isInteger(minorRule.indexStart) ? minorRule.indexStart : 1;
      const indexPad = Number.isInteger(minorRule.indexPad) ? minorRule.indexPad : 2;
      const suitIndex = String(indexStart + rankIndex).padStart(indexPad, "0");
      const template = String(minorRule.template || "{suit}{index}.png");

      return applyTemplate(template, {
        suit: suitPrefix,
        suitId: parsedMinor.suitId,
        index: suitIndex,
        rank: parsedMinor.rankWord,
        rankKey: parsedMinor.rankKey
      });
    }

    if (minorRule.mode === "suit-base-number-template") {
      const suitBaseRaw = Number(minorRule?.suitBase?.[parsedMinor.suitId]);
      if (!Number.isFinite(suitBaseRaw)) {
        return null;
      }

      const numberPad = Number.isInteger(minorRule.numberPad) ? minorRule.numberPad : 2;
      const cardNumber = String(suitBaseRaw + rankIndex).padStart(numberPad, "0");
      const template = String(minorRule.template || "{number}.png");

      return applyTemplate(template, {
        number: cardNumber,
        suitId: parsedMinor.suitId,
        rank: parsedMinor.rankWord,
        rankKey: parsedMinor.rankKey,
        index: rankIndex
      });
    }

    return null;
  }

  function resolveIChingCardFiles(manifest, cardName) {
    const hexagrams = manifest?.hexagrams && typeof manifest.hexagrams === "object" ? manifest.hexagrams : {};
    const names = manifest?.hexagramNames && typeof manifest.hexagramNames === "object" ? manifest.hexagramNames : {};
    const target = String(cardName || "").trim().toLowerCase();
    if (!target) return [];
    const numberMatch = target.match(/^(?:hexagram[\s#_-]*)?(\d{1,2})(?:\D|$)/)
      || target.match(/^(?:hexagram|hex)[\s#_-]*(\d{1,2})$/);
    const key = numberMatch
      ? String(Number(numberMatch[1]))
      : Object.keys(names).find((candidate) => String(names[candidate] || "").trim().toLowerCase() === target);
    const file = key ? hexagrams[key] : null;
    return file ? normalizeCardFiles(file) : [];
  }

  function resolvePlayingCardFiles(manifest, cardName) {
    const cards = manifest?.cards && typeof manifest.cards === "object" ? manifest.cards : {};
    if (/joker/i.test(String(cardName || ""))) {
      const direct = cards.joker ?? cards.jokers ?? cards["joker-1"] ?? cards.joker1;
      if (direct != null) return normalizeCardFiles(direct);
      const entry = Object.entries(cards).find(([name]) => /joker/i.test(String(name)));
      return entry ? normalizeCardFiles(entry[1]) : [];
    }
    const match = String(cardName || "")
      .trim()
      .toLowerCase()
      .match(/^(ace|two|three|four|five|six|seven|eight|nine|ten|jack|queen|king|knave|[2-9]|10|a|j|q|k)\s+of\s+(hearts?|diamonds?|clubs?|clovers?|spades?)$/);
    if (!match) return [];
    const rankMap = {
      ace: "ace", a: "ace", 1: "ace",
      two: "two", 2: "two", three: "three", 3: "three",
      four: "four", 4: "four", five: "five", 5: "five",
      six: "six", 6: "six", seven: "seven", 7: "seven",
      eight: "eight", 8: "eight", nine: "nine", 9: "nine",
      ten: "ten", 10: "ten",
      jack: "jack", j: "jack", knave: "jack",
      queen: "queen", q: "queen",
      king: "king", k: "king"
    };
    const suitMap = {
      heart: "hearts", hearts: "hearts",
      diamond: "diamonds", diamonds: "diamonds",
      club: "clubs", clubs: "clubs", clover: "clubs", clovers: "clubs",
      spade: "spades", spades: "spades"
    };
    const key = `${rankMap[match[1]] || ""} of ${suitMap[match[2]] || ""}`;
    const file = cards[key] || Object.entries(cards).find(([name]) => String(name).trim().toLowerCase() === key)?.[1];
    return file ? normalizeCardFiles(file) : [];
  }

  function resolveCardRelativePaths(manifest, cardName, trumpNumber) {
    if (!manifest) {
      return [];
    }

    const system = String(manifest.system || "").trim().toLowerCase();
    if (system === "iching") {
      return resolveIChingCardFiles(manifest, cardName);
    }
    if (system === "playing-cards") {
      return resolvePlayingCardFiles(manifest, cardName);
    }

    const parsedMinor = parseMinorCard(resolveMinorLookupName(manifest, cardName));
    if (parsedMinor) {
      const minorFile = resolveMinorFile(manifest, parsedMinor);
      if (minorFile) {
        return [minorFile];
      }
    }

    return resolveMajorFiles(manifest, cardName, trumpNumber);
  }

  function resolveCardRelativePath(manifest, cardName, trumpNumber) {
    return resolveCardRelativePaths(manifest, cardName, trumpNumber)[0] || null;
  }

  function resolveWithDeck(deckId, cardName, variant = "full", trumpNumber) {
    const manifest = getDeckManifest(deckId);
    if (!manifest) {
      return null;
    }

    const relativePath = resolveCardRelativePath(manifest, cardName, trumpNumber);
    if (!relativePath) {
      return null;
    }

    if (variant === "thumbnail") {
      return resolveDeckThumbnailPath(manifest, relativePath) || toDeckAssetPath(manifest, relativePath);
    }

    return toDeckAssetPath(manifest, relativePath);
  }

  function resolveTarotCardImage(cardName, optionsOrDeckId) {
    const { resolvedDeckId, trumpNumber } = resolveDeckOptions(optionsOrDeckId);
    const activePath = resolveWithDeck(resolvedDeckId, cardName, "full", trumpNumber);
    if (activePath) {
      return activePath;
    }

    return null;
  }

  function resolveTarotCardVariants(cardName, optionsOrDeckId) {
    const { resolvedDeckId } = resolveDeckOptions(optionsOrDeckId);
    const manifest = getDeckManifest(resolvedDeckId);
    if (!manifest) {
      return [];
    }

    const { trumpNumber } = resolveDeckOptions(optionsOrDeckId);
    return resolveCardRelativePaths(manifest, cardName, trumpNumber).map((relativePath, variantIndex) => ({
      variantIndex,
      relativePath,
      assetPath: toDeckAssetPath(manifest, relativePath),
      thumbnailPath: resolveDeckThumbnailPath(manifest, relativePath) || toDeckAssetPath(manifest, relativePath)
    }));
  }

  function resolveTarotCardThumbnail(cardName, optionsOrDeckId) {
    const { resolvedDeckId, trumpNumber } = resolveDeckOptions(optionsOrDeckId);
    const thumbnailPath = resolveWithDeck(resolvedDeckId, cardName, "thumbnail", trumpNumber);
    if (thumbnailPath) {
      return thumbnailPath;
    }

    return null;
  }

  function resolveTarotCardBackImage(optionsOrDeckId) {
    const { resolvedDeckId } = resolveDeckOptions(optionsOrDeckId);

    if (cardBackCache.has(resolvedDeckId)) {
      const cachedPath = cardBackCache.get(resolvedDeckId);
      return cachedPath || null;
    }

    const manifest = getDeckManifest(resolvedDeckId);
    const activeBackPath = resolveDeckCardBackPath(manifest);
    cardBackCache.set(resolvedDeckId, activeBackPath || null);

    if (activeBackPath) {
      return activeBackPath;
    }

    return null;
  }

  function resolveTarotCardBackThumbnail(optionsOrDeckId) {
    const { resolvedDeckId } = resolveDeckOptions(optionsOrDeckId);

    if (cardBackThumbnailCache.has(resolvedDeckId)) {
      const cachedPath = cardBackThumbnailCache.get(resolvedDeckId);
      return cachedPath || null;
    }

    const manifest = getDeckManifest(resolvedDeckId);
    const relativeBackPath = String(manifest?.cardBack || manifest?.cardBackPath || "").trim();
    const thumbnailPath = resolveDeckThumbnailPath(manifest, relativeBackPath) || resolveDeckCardBackPath(manifest);
    cardBackThumbnailCache.set(resolvedDeckId, thumbnailPath || null);

    return thumbnailPath || null;
  }

  function preloadImageUrl(url) {
    const normalizedUrl = String(url || "").trim();
    if (!normalizedUrl) {
      return Promise.resolve(null);
    }

    if (loadedImageCache.has(normalizedUrl)) {
      return Promise.resolve(loadedImageCache.get(normalizedUrl));
    }

    if (imagePreloadCache.has(normalizedUrl)) {
      return imagePreloadCache.get(normalizedUrl);
    }

    const preloadPromise = new Promise((resolve) => {
      const image = new Image();
      let settled = false;

      function finalize(result) {
        if (settled) {
          return;
        }

        settled = true;
        image.onload = null;
        image.onerror = null;
        resolve(result);
      }

      image.decoding = "async";
      image.onload = () => {
        loadedImageCache.set(normalizedUrl, image);
        finalize(image);
      };
      image.onerror = () => finalize(null);
      image.src = normalizedUrl;

      if (image.complete) {
        if (image.naturalWidth) {
          loadedImageCache.set(normalizedUrl, image);
          finalize(image);
        } else {
          finalize(null);
        }
      }
    });

    imagePreloadCache.set(normalizedUrl, preloadPromise);
    return preloadPromise;
  }

  function ensureImageLoaded(url) {
    return preloadImageUrl(url);
  }

  function isImageLoaded(url) {
    const normalizedUrl = String(url || "").trim();
    if (!normalizedUrl) {
      return false;
    }

    const cachedImage = loadedImageCache.get(normalizedUrl);
    return Boolean(cachedImage?.complete && cachedImage?.naturalWidth);
  }

  async function preloadImageUrls(urls, concurrency = 6, onProgress = null) {
    const queue = Array.from(new Set(Array.isArray(urls) ? urls.map((entry) => String(entry || "").trim()).filter(Boolean) : []));
    if (queue.length === 0) {
      return [];
    }

    const limit = Math.max(1, Number.isInteger(concurrency) ? concurrency : 6);
    const results = [];
    let cursor = 0;
    let completedCount = 0;

    function reportProgress(lastUrl) {
      completedCount += 1;
      if (typeof onProgress === "function") {
        onProgress({
          completedCount,
          totalCount: queue.length,
          lastUrl: String(lastUrl || "").trim()
        });
      }
    }

    async function consumeQueue() {
      while (cursor < queue.length) {
        const currentIndex = cursor;
        cursor += 1;
        const currentUrl = queue[currentIndex];
        try {
          results[currentIndex] = await preloadImageUrl(currentUrl);
        } finally {
          reportProgress(currentUrl);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, () => consumeQueue()));
    return results;
  }

  function buildDeckImagePreloadUrls(deckId, options = {}) {
    const normalizedDeckId = normalizeDeckId(deckId);
    const includeFull = options.includeFull === true;
    const includeThumbnails = options.includeThumbnails === true;
    const includeCardBack = options.includeCardBack !== false;
    const urls = new Set();

    if (includeFull) {
      standardDeckCardNames.forEach((cardName) => {
        const imagePath = resolveWithDeck(normalizedDeckId, cardName, "full");
        if (imagePath) {
          urls.add(imagePath);
        }
      });
    }

    if (includeThumbnails) {
      standardDeckCardNames.forEach((cardName) => {
        const thumbnailPath = resolveWithDeck(normalizedDeckId, cardName, "thumbnail");
        if (thumbnailPath) {
          urls.add(thumbnailPath);
        }
      });
    }

    if (includeCardBack) {
      const cardBackImage = resolveTarotCardBackImage(normalizedDeckId);
      if (cardBackImage) {
        urls.add(cardBackImage);
      }

      if (includeThumbnails) {
        const cardBackThumbnail = resolveTarotCardBackThumbnail(normalizedDeckId);
        if (cardBackThumbnail) {
          urls.add(cardBackThumbnail);
        }
      }
    }

    return Array.from(urls);
  }

  function preloadDeckImages(deckId, options = {}) {
    const normalizedDeckId = normalizeDeckId(deckId);
    const preloadUrls = buildDeckImagePreloadUrls(normalizedDeckId, options);
    const totalCount = preloadUrls.length;
    const cacheKey = JSON.stringify({
      deckId: normalizedDeckId,
      includeFull: options.includeFull === true,
      includeThumbnails: options.includeThumbnails === true,
      includeCardBack: options.includeCardBack !== false
    });

    if (!options.force && deckImagePreloadCache.has(cacheKey)) {
      if (deckPreloadStatus.warmedDeckIds.includes(normalizedDeckId)) {
        setDeckPreloadStatus({
          activeDeckId: normalizedDeckId,
          selectedDeckPhase: "ready",
          selectedDeckLoadedCount: totalCount,
          selectedDeckTotalCount: totalCount,
          selectedDeckPercent: totalCount > 0 ? 100 : 0
        });
      }
      return deckImagePreloadCache.get(cacheKey);
    }

    if (!options.background) {
      setDeckPreloadStatus({
        activeDeckId: normalizedDeckId,
        selectedDeckPhase: "loading",
        selectedDeckLoadedCount: 0,
        selectedDeckTotalCount: totalCount,
        selectedDeckPercent: 0
      });
    }

    const preloadPromise = preloadImageUrls(preloadUrls, options.concurrency, ({ completedCount, totalCount: progressTotalCount }) => {
      if (!options.background) {
        setDeckPreloadStatus({
          activeDeckId: normalizedDeckId,
          selectedDeckPhase: "loading",
          selectedDeckLoadedCount: completedCount,
          selectedDeckTotalCount: progressTotalCount,
          selectedDeckPercent: progressTotalCount > 0 ? Math.round((completedCount / progressTotalCount) * 100) : 0
        });
      }
    })
      .then((result) => {
        markDeckAsWarmed(normalizedDeckId);
        if (options.background) {
          emitDeckPreloadStatus();
        }
        if (!options.background) {
          setDeckPreloadStatus({
            activeDeckId: normalizedDeckId,
            selectedDeckPhase: "ready",
            selectedDeckLoadedCount: totalCount,
            selectedDeckTotalCount: totalCount,
            selectedDeckPercent: totalCount > 0 ? 100 : 0
          });
        }
        return result;
      })
      .catch((error) => {
        if (!options.background) {
          setDeckPreloadStatus({
            activeDeckId: normalizedDeckId,
            selectedDeckPhase: "error",
            selectedDeckTotalCount: totalCount
          });
        }
        throw error;
      });
    deckImagePreloadCache.set(cacheKey, preloadPromise);
    return preloadPromise;
  }

  async function preloadAllDeckImages(options = {}) {
    const deckIds = Object.keys(getDeckManifestSources());
    const startDeckId = options.startDeckId ? normalizeDeckId(options.startDeckId) : "";
    const orderedDeckIds = startDeckId && deckIds.includes(startDeckId)
      ? [startDeckId, ...deckIds.filter((deckId) => deckId !== startDeckId)]
      : deckIds;
    const results = [];

    for (const deckId of orderedDeckIds) {
      results.push(await preloadDeckImages(deckId, options));
    }

    return results;
  }

  function scheduleDeckImagePreload(deckId, options = {}) {
    return deferPreload(() => preloadDeckImages(deckId, {
      ...defaultDeckWarmupOptions,
      ...options
    }));
  }

  function scheduleAllDeckImagePreload(options = {}) {
    return deferPreload(() => preloadAllDeckImages({
      ...defaultDeckWarmupOptions,
      ...options
    }));
  }

  function resolveDisplayNameWithDeck(deckId, cardName, trumpNumber) {
    const manifest = getDeckManifest(deckId);
    let fallbackName = String(cardName || "").trim();
    if (!manifest) {
      return fallbackName;
    }

    let resolvedTrumpNumber = normalizeTrumpNumber(trumpNumber);
    if (!Number.isInteger(resolvedTrumpNumber)) {
      const canonical = canonicalMajorName(cardName);
      resolvedTrumpNumber = normalizeTrumpNumber(trumpNumberByCanonicalName[canonical]);
    }

    if (Number.isInteger(resolvedTrumpNumber)) {
      const byTrump = manifest?.majorNameOverridesByTrump?.[resolvedTrumpNumber];
      if (byTrump) {
        return byTrump;
      }
    }

    const minorKey = canonicalMinorName(cardName);
    const minorOverride = manifest?.minorNameOverrides?.[minorKey];
    if (minorOverride) {
      return minorOverride;
    }

    const overrides = manifest?.suitNameOverrides;
    if (overrides && typeof overrides === "object") {
      let next = fallbackName;
      [
        ["wands", overrides.wands],
        ["cups", overrides.cups],
        ["swords", overrides.swords],
        ["disks", overrides.disks || overrides.pentacles],
        ["pentacles", overrides.pentacles || overrides.disks]
      ].forEach(([from, to]) => {
        const custom = String(to || "").trim();
        if (!custom) {
          return;
        }
        next = next.replace(new RegExp(`of ${from}\\b`, "ig"), `of ${custom}`);
      });
      fallbackName = next;
    }

    const courtOverrides = manifest?.courtNameOverrides;
    if (courtOverrides && typeof courtOverrides === "object") {
      let next = fallbackName;
      [["page", courtOverrides.page], ["knight", courtOverrides.knight], ["queen", courtOverrides.queen], ["king", courtOverrides.king],
        ["princess", courtOverrides.princess], ["prince", courtOverrides.prince]]
        .forEach(([rank, to]) => {
          const custom = String(to || "").trim();
          if (!custom) {
            return;
          }
          next = next.replace(new RegExp(`^${rank}\\b`, "i"), custom);
        });
      return next;
    }

    return fallbackName;
  }

  function getTarotCardSearchAliases(cardName, optionsOrDeckId) {
    const fallbackName = String(cardName || "").trim();
    if (!fallbackName) {
      return [];
    }

    const { resolvedDeckId, trumpNumber } = resolveDeckOptions(optionsOrDeckId);
    const aliases = new Set();
    aliases.add(fallbackName);

    const displayName = String(resolveDisplayNameWithDeck(resolvedDeckId, fallbackName, trumpNumber) || "").trim();
    if (displayName) {
      aliases.add(displayName);
    }

    const canonicalMajor = canonicalMajorName(fallbackName);
    const resolvedTrumpNumber = Number.isInteger(normalizeTrumpNumber(trumpNumber))
      ? normalizeTrumpNumber(trumpNumber)
      : normalizeTrumpNumber(trumpNumberByCanonicalName[canonicalMajor]);

    if (Number.isInteger(resolvedTrumpNumber)) {
      aliases.add(canonicalMajor);
      aliases.add(`the ${canonicalMajor}`);
      aliases.add(`trump ${resolvedTrumpNumber}`);
    }

    const parsedMinor = parseMinorCard(fallbackName);
    if (parsedMinor) {
      const manifest = getDeckManifest(resolvedDeckId);
      const suitAliases = (suitSearchAliasesById[parsedMinor.suitId] || [parsedMinor.suitId])
        .concat(suitLookupOrder(parsedMinor.suitId, manifest));
      const uniqueSuits = [];
      const seenSuits = new Set();
      suitAliases.forEach((entry) => {
        const suit = firstWord(entry);
        if (suit && !seenSuits.has(suit)) {
          seenSuits.add(suit);
          uniqueSuits.push(suit);
        }
      });
      const rankAliases = courtRankLookupOrder(parsedMinor.rankKey, manifest?.minors, { manifest });
      rankAliases.forEach((rankAlias) => {
        uniqueSuits.forEach((suitAlias) => {
          aliases.add(`${rankAlias} of ${suitAlias}`);
        });
      });
      if (Number.isInteger(parsedMinor.pipValue)) {
        uniqueSuits.forEach((suitAlias) => {
          aliases.add(`${parsedMinor.pipValue} of ${suitAlias}`);
        });
      }
    }

    return Array.from(aliases);
  }

  function getTarotCardDisplayName(cardName, optionsOrDeckId) {
    const { resolvedDeckId, trumpNumber } = resolveDeckOptions(optionsOrDeckId);

    return resolveDisplayNameWithDeck(resolvedDeckId, cardName, trumpNumber);
  }

  function setActiveDeck(deckId) {
    activeDeckId = normalizeDeckId(deckId);
    getDeckManifest(activeDeckId);
    const preloadUrls = buildDeckImagePreloadUrls(activeDeckId, activeDeckWarmupOptions);
    const totalCount = preloadUrls.length;
    const isWarmed = deckPreloadStatus.warmedDeckIds.includes(activeDeckId);
    setDeckPreloadStatus({
      activeDeckId,
      selectedDeckPhase: isWarmed ? "ready" : "idle",
      selectedDeckLoadedCount: isWarmed ? totalCount : 0,
      selectedDeckTotalCount: totalCount,
      selectedDeckPercent: isWarmed && totalCount > 0 ? 100 : 0
    });
    scheduleDeckImagePreload(activeDeckId, activeDeckWarmupOptions);
    return activeDeckId;
  }

  function getDeckOptions() {
    return Object.values(getDeckManifestSources()).map((source) => {
      const manifest = getDeckManifest(source.id);
      return {
        id: source.id,
        label: manifest?.label || source.label,
        system: String(manifest?.system || "tarot").trim().toLowerCase() || "tarot"
      };
    });
  }

  document.addEventListener("settings:updated", (event) => {
    const nextDeck = event?.detail?.settings?.tarotDeck;
    if (nextDeck) {
      setActiveDeck(nextDeck);
    }
  });

  document.addEventListener("connection:updated", resetConnectionCaches);
  document.addEventListener("connection:access-updated", resetConnectionCaches);
  document.addEventListener("content:updated", () => {
    resetConnectionCaches();
    void window.TarotDataService?.loadDeckOptions?.(true);
  });

  window.TarotCardImages = {
    resolveTarotCardImage,
    resolveTarotCardThumbnail,
    resolveTarotCardVariants,
    resolveTarotCardBackImage,
    resolveTarotCardBackThumbnail,
    preloadDeckImages,
    preloadAllDeckImages,
    scheduleDeckImagePreload,
    scheduleAllDeckImagePreload,
    ensureImageLoaded,
    isImageLoaded,
    resetConnectionCaches,
    getDeckPreloadStatus: () => emitDeckPreloadStatus(),
    getTarotCardDisplayName,
    getTarotCardSearchAliases,
    getStandardDeckCardNames: () => [...standardDeckCardNames],
    setActiveDeck,
    getDeckOptions,
    getActiveDeck: () => activeDeckId
  };
})();
