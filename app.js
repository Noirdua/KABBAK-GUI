const { getCenteredWeekStartDay, getDateKey, getMoonPhaseName } = window.TarotCalc;
const { loadReferenceData, loadMagickDataset } = window.TarotDataService;
const { buildWeekEvents } = window.TarotEventBuilder;
const { updateNowPanel } = window.TarotNowUi;
// Live lookups so lazy-loaded section modules are visible after first open.
const ensureTarotSection = (...args) => window.TarotSectionUi?.ensureTarotSection?.(...args);
const ensurePlanetSection = (...args) => window.PlanetSectionUi?.ensurePlanetSection?.(...args);
const ensureCyclesSection = (...args) => window.CyclesSectionUi?.ensureCyclesSection?.(...args);
const ensureElementsSection = (...args) => window.ElementsSectionUi?.ensureElementsSection?.(...args);
const ensureTattvasSection = (...args) => window.TattvasSectionUi?.ensureTattvasSection?.(...args);
const ensureModalitiesSection = (...args) => window.ModalitiesSectionUi?.ensureModalitiesSection?.(...args);
const ensureAudioCircleSection = (...args) => window.AudioCircleUi?.ensureAudioCircleSection?.(...args);
const ensureAudioNotesSection = (...args) => window.AudioNotesUi?.ensureAudioNotesSection?.(...args);
const ensureIChingSection = (...args) => window.IChingSectionUi?.ensureIChingSection?.(...args);
const ensureIChingTrigramSection = (...args) => window.IChingTrigramSectionUi?.ensureIChingTrigramSection?.(...args);
const ensureIChingBigramSection = (...args) => window.IChingBigramSectionUi?.ensureIChingBigramSection?.(...args);
const ensureIChingPhaseSection = (...args) => window.IChingPhaseSectionUi?.ensureIChingPhaseSection?.(...args);
const ensureKabbalahSection = (...args) => window.KabbalahSectionUi?.ensureKabbalahSection?.(...args);
const ensureCubeSection = (...args) => window.CubeSectionUi?.ensureCubeSection?.(...args);
const ensureAlphabetSection = (...args) => window.AlphabetSectionUi?.ensureAlphabetSection?.(...args);
const ensureAlphabetTextSection = (...args) => window.AlphabetTextUi?.ensureAlphabetTextSection?.(...args);
const ensureAlphabetReferenceSection = (...args) => window.AlphabetReferenceUi?.ensureAlphabetReferenceSection?.(...args);
const ensureScriberSection = (...args) => window.ScriberSectionUi?.ensureScriberSection?.(...args);
const ensureZodiacSection = (...args) => window.ZodiacSectionUi?.ensureZodiacSection?.(...args);
const ensureQuizSection = (...args) => window.QuizSectionUi?.ensureQuizSection?.(...args);
const ensureProfileSection = () => window.ProfileUi?.ensureProfileSection?.();
const ensureGodsSection = (...args) => window.GodsSectionUi?.ensureGodsSection?.(...args);
const ensureEnochianSection = (...args) => window.EnochianSectionUi?.ensureEnochianSection?.(...args);
const ensureCalendarSection = (...args) => window.CalendarSectionUi?.ensureCalendarSection?.(...args);
const ensureHolidaySection = (...args) => window.HolidaySectionUi?.ensureHolidaySection?.(...args);
const ensureNatalPanel = (...args) => window.TarotNatalUi?.ensureNatalPanel?.(...args);
const ensureNumbersSection = (...args) => window.TarotNumbersUi?.ensureNumbersSection?.(...args);
const ensureNumPadSection = (...args) => window.NumPadUi?.ensureNumPadSection?.(...args);
const selectNumberEntry = (...args) => window.TarotNumbersUi?.selectNumberEntry?.(...args);
const normalizeNumberValue = (...args) => window.TarotNumbersUi?.normalizeNumberValue?.(...args);
const showBrowseView = (...args) => window.TarotNumbersUi?.showBrowseView?.(...args);
const showTheoryView = (...args) => window.TarotNumbersUi?.showTheoryView?.(...args);
const tarotSpreadUi = new Proxy({}, {
  get: (_target, prop) => (window.TarotSpreadUi || {})[prop]
});
const settingsUi = window.TarotSettingsUi || {};
const chromeUi = window.TarotChromeUi || {};
const navigationUi = window.TarotNavigationUi || {};
const calendarFormattingUi = window.TarotCalendarFormatting || {};
const calendarVisualsUi = window.TarotCalendarVisuals || {};
const homeUi = window.TarotHomeUi || {};
const sectionStateUi = window.TarotSectionStateUi || {};
const appRuntime = window.TarotAppRuntime || {};

const statusEl = document.getElementById("status");
const monthStripEl = document.getElementById("month-strip");
const calendarEl = document.getElementById("calendar");
const timelineSectionEl = document.getElementById("timeline-section");
const settingsSectionEl = document.getElementById("settings-section");
const calendarSectionEl = document.getElementById("calendar-section");
const holidaySectionEl = document.getElementById("holiday-section");
const audioCircleSectionEl = document.getElementById("audio-circle-section");
const audioNotesSectionEl = document.getElementById("audio-notes-section");
const tarotSectionEl = document.getElementById("tarot-section");
const tarotFrameSectionEl = document.getElementById("tarot-frame-section");
const tarotHouseSectionEl = document.getElementById("tarot-house-section");
const astronomySectionEl = document.getElementById("astronomy-section");
const skySectionEl = document.getElementById("sky-section");
const natalSectionEl = document.getElementById("natal-section");
const planetSectionEl = document.getElementById("planet-section");
const cyclesSectionEl = document.getElementById("cycles-section");
const elementsSectionEl = document.getElementById("elements-section");
const tattvasSectionEl = document.getElementById("tattvas-section");
const modalitiesSectionEl = document.getElementById("modalities-section");
const ichingSectionEl = document.getElementById("iching-section");
const ichingTrigramSectionEl = document.getElementById("iching-trigram-section");
const ichingBigramSectionEl = document.getElementById("iching-bigram-section");
const ichingPhaseSectionEl = document.getElementById("iching-phase-section");
const kabbalahSectionEl = document.getElementById("kabbalah-section");
const kabbalahWorldsSectionEl = document.getElementById("kabbalah-worlds-section");
const kabbalahPathsSectionEl = document.getElementById("kabbalah-paths-section");
const kabbalahCrossSectionEl = document.getElementById("kabbalah-cross-section");
const kabbalahTreeSectionEl = document.getElementById("kabbalah-tree-section");
const cubeSectionEl = document.getElementById("cube-section");
const alphabetSectionEl = document.getElementById("alphabet-section");
const alphabetLettersSectionEl = document.getElementById("alphabet-letters-section");
const alphabetTextSectionEl = document.getElementById("alphabet-text-section");
const alphabetReferenceSectionEl = document.getElementById("alphabet-reference-section");
const scriberSectionEl = document.getElementById("scriber-section");
const numbersSectionEl = document.getElementById("numbers-section");
const numPadSectionEl = document.getElementById("num-pad-section");
const zodiacSectionEl = document.getElementById("zodiac-section");
const quizSectionEl = document.getElementById("quiz-section");
const godsSectionEl = document.getElementById("gods-section");
const enochianSectionEl = document.getElementById("enochian-section");
const openHomeEl = document.getElementById("open-home");
const openHomeMenuEl = document.getElementById("open-home-menu");
const openSettingsEl = document.getElementById("open-settings");
const openCalendarEl = document.getElementById("open-calendar");
const openCalendarTimelineEl = document.getElementById("open-calendar-timeline");
const openCalendarMonthsEl = document.getElementById("open-calendar-months");
const openHolidaysEl = document.getElementById("open-holidays");
const openAudioEl = document.getElementById("open-audio");
const openAudioCircleEl = document.getElementById("open-audio-circle");
const openAudioNotesEl = document.getElementById("open-audio-notes");
const openTarotEl = document.getElementById("open-tarot");
const openTarotCardsEl = document.getElementById("open-tarot-cards");
const openTarotSpreadEl = document.getElementById("open-tarot-spread");
const openTarotFrameEl = document.getElementById("open-tarot-frame");
const openTarotHouseEl = document.getElementById("open-tarot-house");
const settingsTarotPanelEl = document.getElementById("settings-tarot-panel");
const openAstronomyEl = document.getElementById("open-astronomy");
const openPlanetsEl = document.getElementById("open-planets");
const openCyclesEl = document.getElementById("open-cycles");
const openElementsEl = document.getElementById("open-elements");
const openTattvasEl = document.getElementById("open-tattvas");
const openModalitiesEl = document.getElementById("open-modalities");
const openIChingEl = document.getElementById("open-iching");
const openIChingHexagramsEl = document.getElementById("open-iching-hexagrams");
const openIChingTrigramsEl = document.getElementById("open-iching-trigrams");
const openIChingBigramsEl = document.getElementById("open-iching-bigrams");
const openIChingPhasesEl = document.getElementById("open-iching-phases");
const openKabbalahEl = document.getElementById("open-kabbalah");
const openKabbalahSephirotEl = document.getElementById("open-kabbalah-sephirot");
const openKabbalahWorldsEl = document.getElementById("open-kabbalah-worlds");
const openKabbalahPathsEl = document.getElementById("open-kabbalah-paths");
const openKabbalahCrossEl = document.getElementById("open-kabbalah-cross");
const openKabbalahTreeEl = document.getElementById("open-kabbalah-tree");
const openKabbalahCubeEl = document.getElementById("open-kabbalah-cube");
const openAlphabetEl = document.getElementById("open-alphabet");
const openAlphabetWordEl = document.getElementById("open-alphabet-word");
const openAlphabetLettersEl = document.getElementById("open-alphabet-letters");
const openAlphabetTextEl = document.getElementById("open-alphabet-text");
const openAlphabetReferenceEl = document.getElementById("open-alphabet-reference");
const openScriberEl = document.getElementById("open-scriber");
const openNumbersEl = document.getElementById("open-numbers");
const openNumbersBrowseEl = document.getElementById("open-numbers-browse");
const openNumbersTheoryEl = document.getElementById("open-numbers-theory");
const openNumbersNumPadEl = document.getElementById("open-numbers-num-pad");
const openZodiacEl = document.getElementById("open-zodiac");
const openSkyEl = document.getElementById("open-sky");
const openNatalEl = document.getElementById("open-natal");
const openQuizEl = document.getElementById("open-quiz");
const openGodsEl = document.getElementById("open-gods");
const openEnochianEl = document.getElementById("open-enochian");
const openProfileEl = document.getElementById("open-profile");
const openAdminEl = document.getElementById("open-admin");
const profileSectionEl = document.getElementById("profile-section");
const adminSectionEl = document.getElementById("admin-section");
const latEl = document.getElementById("now-lat") || document.getElementById("lat");
const lngEl = document.getElementById("now-lng") || document.getElementById("lng");
const nowSkyLayerEl = document.getElementById("now-sky-layer");
const nowPanelEl = document.getElementById("now-panel");
const homeWelcomeEl = document.getElementById("home-welcome");
const nowOverlayToggleEl = document.getElementById("now-overlay-toggle");
const KABBAK_GUI_VERSION = "1.0.0";
window.KABBAK_GUI_VERSION = KABBAK_GUI_VERSION;

const connectionGateEl = document.getElementById("connection-gate");
const connectionGateBaseUrlEl = document.getElementById("connection-gate-base-url");
const connectionGateApiKeyEl = document.getElementById("connection-gate-api-key");
const connectionGateStatusEl = document.getElementById("connection-gate-status");
const connectionGateConnectEl = document.getElementById("connection-gate-connect");
const connectionGateDemoEl = document.getElementById("connection-gate-demo");
const connectionGateDemoUseEl = document.getElementById("connection-gate-demo-use");
const connectionGateDemoDetailsEl = document.getElementById("connection-gate-demo-details");
const appLoadingScreenEl = document.getElementById("app-loading-screen");

function hideLoadingScreen() {
  // Remember this boot so the splash never flashes again on refreshes within
  // this tab session.
  try {
    window.sessionStorage.setItem("kabbak-booted", "1");
    document.documentElement.setAttribute("data-kabbak-booted", "1");
  } catch (_error) {}
  if (!appLoadingScreenEl || appLoadingScreenEl.dataset.hidden === "1") {
    return;
  }
  appLoadingScreenEl.dataset.hidden = "1";
  appLoadingScreenEl.classList.add("is-hidden");
  window.setTimeout(() => {
    if (appLoadingScreenEl && appLoadingScreenEl.parentElement) {
      appLoadingScreenEl.remove();
    }
  }, 500);
}

// Never leave the splash up forever, even if boot hits an unexpected error.
window.setTimeout(hideLoadingScreen, 15000);

// --- Mobile zoom reset --------------------------------------------------------
// Zoom is disabled entirely via the viewport meta (maximum-scale=1,
// user-scalable=no). Safari keeps its zoom level across reloads, so re-apply
// the clamp on load and whenever a field loses focus to always land at 100%.
const VIEWPORT_ZOOM_LOCKED = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

function resetViewportZoom() {
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    return;
  }
  if (viewportMeta.getAttribute("content") !== VIEWPORT_ZOOM_LOCKED) {
    viewportMeta.setAttribute("content", VIEWPORT_ZOOM_LOCKED);
  }
}

let zoomResetTimer = null;
function scheduleViewportZoomReset() {
  if (zoomResetTimer) {
    window.clearTimeout(zoomResetTimer);
  }
  zoomResetTimer = window.setTimeout(() => {
    zoomResetTimer = null;
    resetViewportZoom();
  }, 80);
}

document.addEventListener("focusout", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    scheduleViewportZoomReset();
  }
}, true);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    scheduleViewportZoomReset();
  }
});
// Legacy iOS gesture events: swallow double-tap/pinch zoom attempts.
["gesturestart", "gesturechange"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    event.preventDefault();
  });
});
resetViewportZoom();
const tarotDropdownEl = openTarotEl?.closest(".topbar-dropdown") || null;

const TAROT_RESTRICTED_SECTIONS = new Set(["tarot", "tarot-frame", "tarot-house"]);

const nowElements = {
  nowHourEl: document.getElementById("now-hour"),
  nowHourTarotEl: document.getElementById("now-hour-tarot"),
  nowCountdownEl: document.getElementById("now-countdown"),
  nowHourNextEl: document.getElementById("now-hour-next"),
  nowHourCardEl: document.getElementById("now-hour-card"),
  nowMoonEl: document.getElementById("now-moon"),
  nowMoonTarotEl: document.getElementById("now-moon-tarot"),
  nowMoonCountdownEl: document.getElementById("now-moon-countdown"),
  nowMoonNextEl: document.getElementById("now-moon-next"),
  nowMoonCardEl: document.getElementById("now-moon-card"),
  nowDecanEl: document.getElementById("now-decan"),
  nowDecanTarotEl: document.getElementById("now-decan-tarot"),
  nowDecanCountdownEl: document.getElementById("now-decan-countdown"),
  nowDecanNextEl: document.getElementById("now-decan-next"),
  nowDecanCardEl: document.getElementById("now-decan-card"),
  nowStatsSabianEl: document.getElementById("now-stats-sabian"),
  nowStatsPlanetsEl: document.getElementById("now-stats-planets")
};

function hasTarotFeatureAccess() {
  return window.TarotAppConfig?.hasTarotAccess?.() === true;
}

function isSectionAccessible(section) {
  const name = String(section || "").trim();
  if (name === "admin") {
    return hasAdminAccess();
  }
  if (TAROT_RESTRICTED_SECTIONS.has(name)) {
    return hasTarotFeatureAccess();
  }

  return true;
}

function syncTarotFeatureVisibility() {
  const tarotVisible = hasTarotFeatureAccess();

  if (tarotDropdownEl) {
    tarotDropdownEl.hidden = !tarotVisible;
  }

  if (settingsTarotPanelEl) {
    settingsTarotPanelEl.hidden = !tarotVisible;
  }

  if (!tarotVisible && TAROT_RESTRICTED_SECTIONS.has(sectionStateUi.getActiveSection?.())) {
    sectionStateUi.setActiveSection?.("home");
  }
}

function restoreSystemMenuButton(button) {
  if (!(button instanceof HTMLElement)) return;
  button.classList.remove("mp-hidden");
  button.style.removeProperty("display");
  const actions = document.getElementById("topbar-actions");
  if (actions && button.parentElement !== actions) {
    const settingsBtn = document.getElementById("open-settings");
    if (settingsBtn && settingsBtn.parentElement === actions && button !== settingsBtn) {
      actions.insertBefore(button, settingsBtn);
    } else {
      actions.appendChild(button);
    }
  }
}

function hasAdminAccess() {
  return window.TarotAppConfig?.hasAdminApiManagementAccess?.() === true;
}

function syncAdminVisibility() {
  // Admin used to "show" only because `.settings-trigger { display:flex }`
  // overrode the HTML `hidden` attribute. The button is unhidden here in the
  // always-loaded shell — ui-admin.js is lazy and cannot gate the menu item.
  const allowed = hasAdminAccess();
  if (openAdminEl) {
    restoreSystemMenuButton(openAdminEl);
    openAdminEl.hidden = !allowed;
  }
  if (!allowed && sectionStateUi.getActiveSection?.() === "admin") {
    sectionStateUi.setActiveSection?.("home");
  }
}

function isAdminDeepLink() {
  try {
    const path = String(window.location.pathname || "").replace(/\/+$/, "");
    if (/(^|\/)admin$/i.test(path)) return true;
    const hash = String(window.location.hash || "").replace(/^#\/?/, "").split(/[?#]/)[0];
    if (hash.toLowerCase() === "admin") return true;
    const params = new URLSearchParams(window.location.search || "");
    return String(params.get("section") || "").trim().toLowerCase() === "admin";
  } catch (_error) {
    return false;
  }
}

let syncingAdminHash = false;

function writeAdminHash(isOpen) {
  try {
    const url = new URL(window.location.href);
    const hash = String(url.hash || "").replace(/^#\/?/, "").split(/[?#]/)[0];
    const next = `${url.pathname}${url.search}${isOpen ? "#admin" : ""}`;
    const current = `${url.pathname}${url.search}${url.hash}`;
    if (isOpen && hash.toLowerCase() !== "admin") {
      syncingAdminHash = true;
      window.history.replaceState(window.history.state, "", next);
      syncingAdminHash = false;
    } else if (!isOpen && hash.toLowerCase() === "admin" && current !== `${url.pathname}${url.search}`) {
      syncingAdminHash = true;
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      syncingAdminHash = false;
    }
  } catch (_error) {
    syncingAdminHash = false;
  }
}

function applyAdminDeepLink() {
  if (!isAdminDeepLink() || !hasAdminAccess()) return;
  sectionStateUi.setActiveSection?.("admin");
}

function syncProfileVisibility() {
  // Profile features only work when the server has resolved the key to a real
  // client. A configured key alone is not enough — auth-disabled servers or
  // stale/invalid keys would otherwise show a broken profile page.
  const authenticated = window.TarotAppConfig?.isProfileAuthorized?.() === true;

  if (openProfileEl) {
    restoreSystemMenuButton(openProfileEl);
    openProfileEl.hidden = !authenticated;
  }

  if (!authenticated && sectionStateUi.getActiveSection?.() === "profile") {
    sectionStateUi.setActiveSection?.("home");
  }
}

const baseWeekOptions = {
  hourStart: 0,
  hourEnd: 24,
  eventView: ["allday", "time"],
  taskView: false
};

const PLANET_CALENDAR_ORDER = ["saturn", "jupiter", "mars", "sol", "venus", "mercury", "luna"];
const DEFAULT_TAROT_DECK = "ceremonial-magick";
const DEFAULT_SETTINGS = {
  latitude: 51.5074,
  longitude: -0.1278,
  timeFormat: "minutes",
  birthDate: "",
  tarotDeck: DEFAULT_TAROT_DECK,
  stellariumBackgroundEnabled: false,
  detailTextScale: 1,
  menuLayout: "panel",
  hasExplicitLocation: false
};

const PLANET_CALENDAR_STYLES = {
  saturn: {
    name: "♄ Saturn",
    color: "#f4f4f5",
    backgroundColor: "#0a0a0a",
    borderColor: "#0a0a0a"
  },
  jupiter: {
    name: "♃ Jupiter",
    color: "#eff6ff",
    backgroundColor: "#1d4ed8",
    borderColor: "#1d4ed8"
  },
  mars: {
    name: "♂ Mars",
    color: "#fff1f2",
    backgroundColor: "#dc2626",
    borderColor: "#dc2626"
  },
  sol: {
    name: "☉ Sol",
    color: "#111827",
    backgroundColor: "#facc15",
    borderColor: "#eab308"
  },
  venus: {
    name: "♀ Venus",
    color: "#ecfdf5",
    backgroundColor: "#16a34a",
    borderColor: "#15803d"
  },
  mercury: {
    name: "☿ Mercury",
    color: "#111827",
    backgroundColor: "#fb923c",
    borderColor: "#f97316"
  },
  luna: {
    name: "☾ Luna",
    color: "#111827",
    backgroundColor: "#e2e8f0",
    borderColor: "#cbd5e1"
  }
};

const planetaryCalendars = PLANET_CALENDAR_ORDER.map((planetId) => {
  const style = PLANET_CALENDAR_STYLES[planetId];
  return {
    id: `planet-${planetId}`,
    name: style.name,
    color: style.color,
    backgroundColor: style.backgroundColor,
    dragBackgroundColor: style.backgroundColor,
    borderColor: style.borderColor
  };
});

const calendar = new tui.Calendar("#calendar", {
  defaultView: "week",
  usageStatistics: false,
  isReadOnly: true,
  useFormPopup: false,
  useDetailPopup: false,
  gridSelection: false,
  calendars: [
    ...planetaryCalendars,
    {
      id: "planetary",
      name: "Planetary (Fallback)",
      color: "#f4f4f5",
      backgroundColor: "#52525b",
      dragBackgroundColor: "#52525b",
      borderColor: "#52525b"
    },
    {
      id: "astrology",
      name: "Astrology & Tarot",
      color: "#18181b",
      backgroundColor: "#fcd34d",
      dragBackgroundColor: "#fcd34d",
      borderColor: "#fcd34d"
    }
  ],
  week: {
    ...baseWeekOptions,
    startDayOfWeek: getCenteredWeekStartDay(new Date())
  }
});

appRuntime.init?.({
  calendar,
  baseWeekOptions,
  defaultSettings: DEFAULT_SETTINGS,
  latEl,
  lngEl,
  nowElements,
  calendarVisualsUi,
  homeUi,
  hasTarotAccess: () => hasTarotFeatureAccess(),
  shouldPollNow: () => (sectionStateUi.getActiveSection?.() || "home") === "sky" && document.hidden !== true,
  nowPollIntervalMs: 5 * 60 * 1000,
  onStatus: (text) => setStatus(text),
  services: {
    getCenteredWeekStartDay,
    getDateKey,
    loadReferenceData,
    loadMagickDataset,
    buildWeekEvents,
    updateNowPanel,
    startCountdownTicker: () => window.TarotNowUi?.startCountdownTicker?.(),
    stopCountdownTicker: () => window.TarotNowUi?.stopCountdownTicker?.()
  },
  ensure: {
    ensureTarotSection,
    ensurePlanetSection,
    ensureCyclesSection,
    ensureElementsSection,
    ensureTattvasSection,
    ensureModalitiesSection,
    ensureAudioCircleSection,
    ensureAudioNotesSection,
    ensureIChingSection,
    ensureIChingTrigramSection,
    ensureIChingBigramSection,
    ensureIChingPhaseSection,
    ensureKabbalahSection,
    ensureCubeSection,
    ensureAlphabetSection,
    ensureAlphabetTextSection,
    ensureAlphabetReferenceSection,
    ensureScriberSection,
    ensureZodiacSection,
    ensureCalendarSection,
    ensureHolidaySection,
    ensureNatalPanel,
    ensureQuizSection,
    ensureGodsSection,
    ensureEnochianSection,
    ensureNumbersSection,
    ensureTarotFrameSection: (...args) => window.TarotFrameUi?.ensureTarotFrameSection?.(...args)
  }
});

let currentSettings = { ...DEFAULT_SETTINGS };
let hasRenderedConnectedShell = false;

function setStatus(text) {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = text;
}
function isBrowserZoomShortcut(event) {
  if (!(event?.ctrlKey || event?.metaKey)) {
    return false;
  }

  const key = String(event.key || "").toLowerCase();
  return key === "+"
    || key === "="
    || key === "-"
    || key === "_"
    || key === "0"
    || event.code === "NumpadAdd"
    || event.code === "NumpadSubtract"
    || event.code === "Digit0"
    || event.code === "Numpad0";
}

function preventBrowserZoom(event) {
  if (event.type === "wheel" && !event.ctrlKey) {
    return;
  }

  if (event.type === "touchmove" && Number(event.touches?.length || 0) < 2) {
    return;
  }

  event.preventDefault();
}

document.addEventListener("wheel", preventBrowserZoom, {
  capture: true,
  passive: false
});
document.addEventListener("touchmove", preventBrowserZoom, {
  capture: true,
  passive: false
});
["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
  document.addEventListener(eventName, preventBrowserZoom, {
    capture: true,
    passive: false
  });
});
document.addEventListener("keydown", (event) => {
  if (!isBrowserZoomShortcut(event)) {
    return;
  }

  event.preventDefault();
});

function getConnectionSettings() {
  return window.TarotAppConfig?.getConnectionSettings?.() || {
    apiBaseUrl: "",
    apiKey: ""
  };
}

function normalizeConnectionSettingsInput(connectionSettings = null) {
  return {
    apiBaseUrl: String(connectionSettings?.apiBaseUrl || "").trim().replace(/\/+$/, ""),
    apiKey: String(connectionSettings?.apiKey || "").trim()
  };
}

function syncConnectionGateInputs(connectionSettings = getConnectionSettings()) {
  const normalizedConnectionSettings = normalizeConnectionSettingsInput(connectionSettings);

  if (connectionGateBaseUrlEl) {
    connectionGateBaseUrlEl.value = normalizedConnectionSettings.apiBaseUrl;
  }

  if (connectionGateApiKeyEl) {
    connectionGateApiKeyEl.value = normalizedConnectionSettings.apiKey;
  }
}

function setConnectionGateStatus(text, tone = "default") {
  if (!connectionGateStatusEl) {
    return;
  }

  connectionGateStatusEl.textContent = text || "";
  if (tone && tone !== "default") {
    connectionGateStatusEl.dataset.tone = tone;
  } else {
    delete connectionGateStatusEl.dataset.tone;
  }
}

function showConnectionGate(message, tone = "default", connectionSettings = null) {
  syncConnectionGateInputs(connectionSettings || getConnectionSettings());
  if (connectionGateEl) {
    connectionGateEl.hidden = false;
  }
  document.body.classList.add("connection-gated");
  let finalMessage = message;
  const storageHealth = window.TarotAppConfig?.getConnectionStorageHealth?.();
  if (storageHealth === "session") {
    finalMessage = `${message} The API key is saved for this session only — your browser blocks persistent storage, so it resets when the browser fully closes.`;
  }
  setConnectionGateStatus(finalMessage, tone);
  void refreshConnectionGateDemo();
}

// --- Demo access on the gate -------------------------------------------------

let demoAccessCache = {
  baseUrl: "",
  value: undefined
};

function getDemoCandidateBaseUrls() {
  const candidates = [];
  const addCandidate = (rawValue) => {
    const normalized = normalizeConnectionSettingsInput({
      apiBaseUrl: String(rawValue || "").trim()
    }).apiBaseUrl;
    // Only accept real http(s) URLs. Autofill/typing can feed partial values
    // ("h", "ht", "https://api…" mid-edit) — those must never trigger fetches.
    if (!normalized || !/^https?:\/\//i.test(normalized)) {
      return;
    }
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  addCandidate(connectionGateBaseUrlEl?.value || "");
  addCandidate(getConnectionSettings()?.apiBaseUrl || "");
  return candidates;
}

function applyDemoAccessBox() {
  const demo = demoAccessCache.value;
  if (!connectionGateDemoEl) {
    return;
  }
  if (!demo || demo.enabled !== true) {
    connectionGateDemoEl.hidden = true;
    return;
  }
  connectionGateDemoEl.hidden = false;
  if (connectionGateDemoDetailsEl) {
    const keyPreview = demo.apiKey
      ? `${String(demo.apiKey).slice(0, 10)}…`
      : "(no key needed)";
    connectionGateDemoDetailsEl.textContent = `${demo.name || "Demo User"} (${demo.id}) · ${demo.apiBaseUrl} · ${keyPreview}`;
  }
}

async function refreshConnectionGateDemo() {
  if (!connectionGateDemoEl) {
    return;
  }
  const candidates = getDemoCandidateBaseUrls();
  if (!candidates.length) {
    demoAccessCache = { baseUrl: "", value: undefined };
    applyDemoAccessBox();
    return;
  }

  for (const baseUrl of candidates) {
    if (demoAccessCache.baseUrl === baseUrl && demoAccessCache.value !== undefined) {
      applyDemoAccessBox();
      return;
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/demo-access`, { cache: "no-store" });
      if (!response.ok) {
        demoAccessCache = { baseUrl, value: null };
        continue;
      }
      const payload = await response.json().catch(() => null);
      demoAccessCache = { baseUrl, value: payload && payload.enabled === true ? payload : null };
      break;
    } catch (_error) {
      // Network/CORS failure: the first candidate is the authoritative base
      // URL, so stop here instead of falling back to other origins.
      demoAccessCache = { baseUrl, value: null };
      break;
    }
  }
  applyDemoAccessBox();
}

function hideConnectionGate() {
  if (connectionGateEl) {
    connectionGateEl.hidden = true;
  }
  document.body.classList.remove("connection-gated");
}

let backgroundReconnectTimer = null;
let backgroundReconnectAttempts = 0;
let authLostHandled = false;

function stopBackgroundReconnect() {
  if (backgroundReconnectTimer) {
    window.clearTimeout(backgroundReconnectTimer);
    backgroundReconnectTimer = null;
  }
  backgroundReconnectAttempts = 0;
}

// While the gate is up because the server was unreachable, quietly re-probe
// with the SAVED settings. The delay grows with each failed attempt so a
// downed server isn't hammered (and multiple open tabs stay quiet).
function scheduleBackgroundReconnectProbe() {
  const delays = [3000, 5000, 10000, 30000];
  const delay = delays[Math.min(backgroundReconnectAttempts, delays.length - 1)];
  backgroundReconnectTimer = window.setTimeout(() => {
    backgroundReconnectTimer = null;
    backgroundReconnectAttempts += 1;
    void ensureConnectedApp();
  }, delay);
}

function startBackgroundReconnect() {
  if (backgroundReconnectTimer) {
    return;
  }
  // First retry immediately, then keep trying with backoff.
  void ensureConnectedApp();
  scheduleBackgroundReconnectProbe();
}

function hasConfiguredConnectionKey() {
  return Boolean(String(getConnectionSettings()?.apiKey || "").trim());
}

async function probeConnectionWithRetry(configuredConnection) {
  let lastResult = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    lastResult = await window.TarotDataService?.probeConnection?.(configuredConnection);
    if (!lastResult || !lastResult.ok) {
      if (lastResult?.reason !== "network-error" || attempt >= 2) {
        return lastResult;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      continue;
    }
    return lastResult;
  }
  return lastResult;
}

function getConnectionSettingsFromGate() {
  return normalizeConnectionSettingsInput({
    apiBaseUrl: String(connectionGateBaseUrlEl?.value || "").trim(),
    apiKey: String(connectionGateApiKeyEl?.value || "").trim()
  });
}

async function warmActiveDeckCache() {
  const activeDeckId = String(
    appRuntime.getCurrentSettings?.()?.tarotDeck
    || currentSettings?.tarotDeck
    || window.TarotCardImages?.getActiveDeck?.()
    || DEFAULT_TAROT_DECK
  ).trim();

  if (activeDeckId && window.TarotCardImages?.setActiveDeck) {
    window.TarotCardImages.setActiveDeck(activeDeckId);
  }
  if (hasTarotFeatureAccess()) {
    window.TarotSettingsUi?.syncTarotDeckInputOptions?.();
    window.TarotSettingsUi?.syncActiveTarotDeck?.(activeDeckId);
  }

  // Unified cache loader: a loading screen that warms the data payloads and all
  // deck images (full images only for active deck + thumbs for all; others on demand).
  await window.CacheLoaderUi?.warmCache?.({
    dataService: window.TarotDataService,
    cardImages: hasTarotFeatureAccess() ? window.TarotCardImages : null,
    activeDeckId: activeDeckId
  });
}

async function ensureConnectedApp(nextConnectionSettings = null) {
  const configuredConnection = nextConnectionSettings
    ? normalizeConnectionSettingsInput(nextConnectionSettings)
    : getConnectionSettings();

  if (!nextConnectionSettings) {
    syncConnectionGateInputs(configuredConnection);
  }

  if (!configuredConnection.apiBaseUrl) {
    showConnectionGate("Enter an API Base URL to load KABBAK.", "error", configuredConnection);
    return false;
  }

  if (nextConnectionSettings) {
    showConnectionGate("Connecting to the API...", "pending", configuredConnection);
  }

  // Manual gate submits should respond immediately; boot probes retry a few
  // times so a brief server restart during a refresh doesn't leave the gate up.
  const probeResult = nextConnectionSettings
    ? await window.TarotDataService?.probeConnection?.(configuredConnection)
    : await probeConnectionWithRetry(configuredConnection);
  if (!probeResult?.ok) {
    const isNetworkError = probeResult?.reason === "network-error";
    const hasSavedKey = hasConfiguredConnectionKey();
    const gateMessage = isNetworkError && hasSavedKey
      ? "The API is unreachable. Your saved key is filled in below — reconnecting automatically…"
      : (probeResult?.message || "Unable to reach the API.");
    const gateTone = isNetworkError && hasSavedKey ? "pending" : "error";
    showConnectionGate(gateMessage, gateTone, configuredConnection);
    hideLoadingScreen();
    if (isNetworkError && !nextConnectionSettings) {
      startBackgroundReconnect();
    }
    return false;
  }
  stopBackgroundReconnect();
  authLostHandled = false;

  if (nextConnectionSettings) {
    window.TarotAppConfig?.updateConnectionSettings?.(configuredConnection);
    syncConnectionGateInputs(configuredConnection);
  }

  window.TarotAppConfig?.updateConnectionAccess?.(probeResult);
  syncTarotFeatureVisibility();
  window.TarotSettingsUi?.syncTarotDeckInputOptions?.();

  hideConnectionGate();
  hideLoadingScreen();
  if (!hasRenderedConnectedShell) {
    sectionStateUi.setActiveSection?.("home");
    hasRenderedConnectedShell = true;
  }

  setConnectionGateStatus("Connected.", "success");
  setStatus(`Connected to ${configuredConnection.apiBaseUrl}.`);

  // Fast first paint: reference data only. Skip magick (~1MB) and week-events
  // until Timeline/Calendar is opened.
  try {
    await appRuntime.bootstrapConnectedShell?.();
  } catch (error) {
    setStatus(error?.message || "Connected, but reference data failed to load.");
  }

  await warmActiveDeckCache();

  // Prefetch calendar in the background without blocking home.
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => {
      void appRuntime.ensureWeekRendered?.();
    }, { timeout: 5000 });
  } else {
    window.setTimeout(() => {
      void appRuntime.ensureWeekRendered?.();
    }, 1200);
  }

  return true;
}

function bindConnectionGate() {
  syncConnectionGateInputs();

  if (connectionGateConnectEl) {
    connectionGateConnectEl.addEventListener("click", () => {
      void ensureConnectedApp(getConnectionSettingsFromGate());
    });
  }

  if (connectionGateDemoUseEl) {
    connectionGateDemoUseEl.addEventListener("click", () => {
      const demo = demoAccessCache.value;
      if (!demo || demo.enabled !== true) {
        return;
      }
      if (connectionGateBaseUrlEl) {
        connectionGateBaseUrlEl.value = String(demo.apiBaseUrl || "");
      }
      if (connectionGateApiKeyEl) {
        connectionGateApiKeyEl.value = String(demo.apiKey || "");
      }
      stopBackgroundReconnect();
      void ensureConnectedApp(getConnectionSettingsFromGate());
    });
  }

  [connectionGateBaseUrlEl, connectionGateApiKeyEl].forEach((element) => {
    if (!element) {
      return;
    }

    let demoRefreshTimer = null;
    element.addEventListener("input", () => {
      stopBackgroundReconnect();
      if (element === connectionGateBaseUrlEl) {
        // Debounce: autofill/password managers type character-by-character and
        // each keystroke would otherwise fire a demo-access request.
        if (demoRefreshTimer) {
          window.clearTimeout(demoRefreshTimer);
        }
        demoRefreshTimer = window.setTimeout(() => {
          demoRefreshTimer = null;
          void refreshConnectionGateDemo();
        }, 400);
      }
    });

    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void ensureConnectedApp(getConnectionSettingsFromGate());
      }
    });
  });

  document.addEventListener("connection:updated", () => {
    syncConnectionGateInputs();
    void refreshConnectionGateDemo();
  });
}

const deferredUiInitState = {
  numbers: false,
  numPad: false,
  spread: false,
  frame: false
};

function ensureDeferredUiInits() {
  if (!deferredUiInitState.numbers && typeof window.TarotNumbersUi?.init === "function") {
    window.TarotNumbersUi.init({
      getReferenceData: () => appRuntime.getReferenceData?.() || null,
      getMagickDataset: () => appRuntime.getMagickDataset?.() || null,
      ensureTarotSection,
      getActiveSection: () => sectionStateUi.getActiveSection?.() || "home",
      setActiveSection: (section) => sectionStateUi.setActiveSection?.(section)
    });
    deferredUiInitState.numbers = true;
  }

  if (!deferredUiInitState.numPad && typeof window.NumPadUi?.init === "function") {
    window.NumPadUi.init({
      getActiveSection: () => sectionStateUi.getActiveSection?.() || "home"
    });
    deferredUiInitState.numPad = true;
  }

  if (!deferredUiInitState.spread && typeof window.TarotSpreadUi?.init === "function") {
    window.TarotSpreadUi.init({
      ensureTarotSection,
      getReferenceData: () => appRuntime.getReferenceData?.() || null,
      getMagickDataset: () => appRuntime.getMagickDataset?.() || null,
      getActiveSection: () => sectionStateUi.getActiveSection?.() || "home",
      setActiveSection: (section) => sectionStateUi.setActiveSection?.(section)
    });
    deferredUiInitState.spread = true;
  }

  if (!deferredUiInitState.frame && typeof window.TarotFrameUi?.init === "function") {
    window.TarotFrameUi.init({
      ensureTarotSection,
      getCards: () => window.TarotSectionUi?.getCards?.() || [],
      openCardLightbox: (cardId, options = {}) => window.TarotSectionUi?.openCardLightboxById?.(cardId, options),
      getHouseTopCardsVisible: () => window.TarotSectionUi?.getHouseTopCardsVisible?.() !== false,
      getHouseTopInfoModes: () => window.TarotSectionUi?.getHouseTopInfoModes?.() || {},
      getHouseBottomCardsVisible: () => window.TarotSectionUi?.getHouseBottomCardsVisible?.() !== false,
      getHouseBottomInfoModes: () => window.TarotSectionUi?.getHouseBottomInfoModes?.() || {},
      setHouseTopCardsVisible: (value) => window.TarotSectionUi?.setHouseTopCardsVisible?.(value),
      setHouseTopInfoMode: (mode, value) => window.TarotSectionUi?.setHouseTopInfoMode?.(mode, value),
      setHouseBottomCardsVisible: (value) => window.TarotSectionUi?.setHouseBottomCardsVisible?.(value),
      setHouseBottomInfoMode: (mode, value) => window.TarotSectionUi?.setHouseBottomInfoMode?.(mode, value)
    });
    deferredUiInitState.frame = true;
  }
}

window.TarotEnsureDeferredUiInits = ensureDeferredUiInits;
ensureDeferredUiInits();

sectionStateUi.init?.({
  calendar,
  tarotSpreadUi,
  settingsUi,
  calendarVisualsUi,
  homeUi,
  isSectionAccessible: (section) => isSectionAccessible(section),
  getReferenceData: () => appRuntime.getReferenceData?.() || null,
  getMagickDataset: () => appRuntime.getMagickDataset?.() || null,
  elements: {
    calendarEl,
    monthStripEl,
    nowPanelEl,
    homeWelcomeEl,
    settingsSectionEl,
    timelineSectionEl,
    calendarSectionEl,
    holidaySectionEl,
    audioCircleSectionEl,
    audioNotesSectionEl,
    tarotSectionEl,
    tarotFrameSectionEl,
    tarotHouseSectionEl,
    astronomySectionEl,
    skySectionEl,
    natalSectionEl,
    planetSectionEl,
    cyclesSectionEl,
    elementsSectionEl,
    tattvasSectionEl,
    modalitiesSectionEl,
    ichingSectionEl,
    ichingTrigramSectionEl,
    ichingBigramSectionEl,
    ichingPhaseSectionEl,
    kabbalahSectionEl,
    kabbalahWorldsSectionEl,
    kabbalahPathsSectionEl,
    kabbalahCrossSectionEl,
    kabbalahTreeSectionEl,
    cubeSectionEl,
    alphabetSectionEl,
    alphabetLettersSectionEl,
    alphabetTextSectionEl,
    alphabetReferenceSectionEl,
    scriberSectionEl,
    numbersSectionEl,
    numPadSectionEl,
    zodiacSectionEl,
    quizSectionEl,
    godsSectionEl,
    enochianSectionEl,
    adminSectionEl,
    openHomeEl,
    openHomeMenuEl,
    openSettingsEl,
    openCalendarEl,
    openCalendarTimelineEl,
    openCalendarMonthsEl,
    openHolidaysEl,
    openAudioEl,
    openAudioCircleEl,
    openAudioNotesEl,
    openTarotEl,
    openTarotCardsEl,
    openTarotSpreadEl,
    openTarotFrameEl,
    openTarotHouseEl,
    openAstronomyEl,
    openPlanetsEl,
    openCyclesEl,
    openElementsEl,
    openTattvasEl,
    openModalitiesEl,
    openIChingEl,
    openIChingHexagramsEl,
    openIChingTrigramsEl,
    openIChingBigramsEl,
    openIChingPhasesEl,
    openKabbalahEl,
    openKabbalahSephirotEl,
    openKabbalahWorldsEl,
    openKabbalahPathsEl,
    openKabbalahCrossEl,
    openKabbalahTreeEl,
    openKabbalahCubeEl,
    openAlphabetEl,
    openAlphabetWordEl,
    openAlphabetLettersEl,
    openAlphabetTextEl,
    openAlphabetReferenceEl,
    openScriberEl,
    openNumbersEl,
    openNumbersBrowseEl,
    openNumbersTheoryEl,
    openNumbersNumPadEl,
    openZodiacEl,
    openSkyEl,
    openNatalEl,
    openQuizEl,
    openGodsEl,
    openEnochianEl,
    openProfileEl,
    openAdminEl,
    profileSectionEl
  },
  ensure: {
    ensureTarotSection,
    ensureTarotFrameSection: (...args) => window.TarotFrameUi?.ensureTarotFrameSection?.(...args),
    ensurePlanetSection,
    ensureCyclesSection,
    ensureElementsSection,
    ensureTattvasSection,
    ensureModalitiesSection,
    ensureIChingSection,
    ensureIChingTrigramSection,
    ensureIChingBigramSection,
    ensureIChingPhaseSection,
    ensureKabbalahSection,
    ensureCubeSection,
    ensureAlphabetSection,
    ensureAlphabetTextSection,
    ensureAlphabetReferenceSection,
    ensureScriberSection,
    ensureZodiacSection,
    ensureQuizSection,
    ensureProfileSection,
    ensureGodsSection,
    ensureEnochianSection,
    ensureCalendarSection,
    ensureHolidaySection,
    ensureNatalPanel,
    ensureNumbersSection,
    ensureNumPadSection,
    ensureAudioCircleSection,
    ensureAudioNotesSection
  }
});

settingsUi.init?.({
  defaultSettings: DEFAULT_SETTINGS,
  onSettingsApplied: (settings) => {
    appRuntime.applySettings?.(settings);
    currentSettings = settings;
    const detailTextScale = Number(settings?.detailTextScale);
    document.documentElement.style.setProperty(
      "--detail-text-scale",
      Number.isFinite(detailTextScale) && detailTextScale > 0 ? String(detailTextScale) : "1"
    );
  },
  onSyncSkyBackground: (geo, options) => homeUi.syncNowSkyBackground?.(geo, options),
  onStatus: (text) => setStatus(text),
  onConnectionSaved: async () => ensureConnectedApp(),
  getActiveSection: () => sectionStateUi.getActiveSection?.() || "home",
  setActiveSection: (section) => sectionStateUi.setActiveSection?.(section),
  onReopenActiveSection: (section) => sectionStateUi.setActiveSection?.(section),
  onRenderWeek: () => appRuntime.ensureWeekRendered?.({ force: true })
});

chromeUi.init?.();
calendarFormattingUi.init?.({
  getCurrentTimeFormat: () => appRuntime.getCurrentTimeFormat?.() || "minutes",
  getReferenceData: () => appRuntime.getReferenceData?.() || null
});
calendarVisualsUi.init?.({
  calendar,
  monthStripEl,
  getCurrentGeo: () => appRuntime.getCurrentGeo?.() || null,
  parseGeoInput: () => appRuntime.parseGeoInput?.(),
  getMoonPhaseName
});
homeUi.init?.({
  nowSkyLayerEl,
  nowPanelEl,
  getCurrentGeo: () => appRuntime.getCurrentGeo?.() || null,
  getCurrentSettings: () => appRuntime.getCurrentSettings?.() || currentSettings
});

if (nowOverlayToggleEl && nowPanelEl) {
  const syncNowOverlayVisibility = () => {
    nowPanelEl.classList.toggle("is-overlay-hidden", !nowOverlayToggleEl.checked);
  };

  nowOverlayToggleEl.addEventListener("change", syncNowOverlayVisibility);
  syncNowOverlayVisibility();
}

document.addEventListener("connection:auth-lost", () => {
  if (authLostHandled || document.body.classList.contains("connection-gated")) {
    return;
  }
  authLostHandled = true;
  stopBackgroundReconnect();
  window.TarotAppConfig?.updateConnectionAccess?.(null);
  showConnectionGate("Your API key is no longer valid. Enter a valid key to continue.", "error");
  hideLoadingScreen();
});

document.addEventListener("connection:network-lost", () => {
  if (authLostHandled) {
    return;
  }
  if (!hasConfiguredConnectionKey()) {
    return;
  }
  if (!document.body.classList.contains("connection-gated")) {
    showConnectionGate("Lost connection to the API. Retrying…", "warning");
    hideLoadingScreen();
  }
  startBackgroundReconnect();
});

document.addEventListener("connection:access-updated", () => {
  syncTarotFeatureVisibility();
  syncProfileVisibility();
  syncAdminVisibility();
  applyAdminDeepLink();
});

document.addEventListener("connection:updated", () => {
  syncProfileVisibility();
  syncAdminVisibility();
  applyAdminDeepLink();
});

document.addEventListener("section:changed", (event) => {
  writeAdminHash(String(event?.detail?.activeSection || "") === "admin");
});

window.addEventListener("hashchange", () => {
  if (syncingAdminHash) return;
  if (isAdminDeepLink()) {
    applyAdminDeepLink();
    return;
  }
  if (sectionStateUi.getActiveSection?.() === "admin") {
    sectionStateUi.setActiveSection?.("home");
  }
});

document.addEventListener("taro-plugins-ready", () => {
  syncAdminVisibility();
  syncProfileVisibility();
});

navigationUi.init?.({
  tarotSpreadUi,
  getActiveSection: () => sectionStateUi.getActiveSection?.() || "home",
  setActiveSection: (section) => sectionStateUi.setActiveSection?.(section),
  getReferenceData: () => appRuntime.getReferenceData?.() || null,
  getMagickDataset: () => appRuntime.getMagickDataset?.() || null,
  normalizeNumberValue,
  selectNumberEntry,
  showNumbersBrowseView: showBrowseView,
  showNumbersTheoryView: showTheoryView,
  elements: {
    openHomeEl,
    openHomeMenuEl,
    openSettingsEl,
    openCalendarEl,
    openCalendarTimelineEl,
    openCalendarMonthsEl,
    openHolidaysEl,
    openAudioEl,
    openAudioCircleEl,
    openAudioNotesEl,
    openTarotEl,
    openTarotCardsEl,
    openTarotSpreadEl,
    openTarotFrameEl,
    openTarotHouseEl,
    openAstronomyEl,
    openPlanetsEl,
    openCyclesEl,
    openElementsEl,
    openTattvasEl,
    openModalitiesEl,
    openIChingEl,
    openIChingHexagramsEl,
    openIChingTrigramsEl,
    openIChingBigramsEl,
    openIChingPhasesEl,
    openKabbalahEl,
    openKabbalahSephirotEl,
    openKabbalahWorldsEl,
    openKabbalahPathsEl,
    openKabbalahCrossEl,
    openKabbalahTreeEl,
    openKabbalahCubeEl,
    openAlphabetEl,
    openAlphabetWordEl,
    openAlphabetLettersEl,
    openAlphabetTextEl,
    openAlphabetReferenceEl,
    openScriberEl,
    openNumbersEl,
    openNumbersBrowseEl,
    openNumbersTheoryEl,
    openNumbersNumPadEl,
    openZodiacEl,
    openSkyEl,
    openNatalEl,
    openQuizEl,
    openGodsEl,
    openEnochianEl,
    openProfileEl,
    openAdminEl
  },
  ensure: {
    ensureTarotSection,
    ensureTarotFrameSection: (...args) => window.TarotFrameUi?.ensureTarotFrameSection?.(...args),
    ensurePlanetSection,
    ensureCyclesSection,
    ensureElementsSection,
    ensureTattvasSection,
    ensureModalitiesSection,
    ensureIChingSection,
    ensureIChingTrigramSection,
    ensureIChingBigramSection,
    ensureIChingPhaseSection,
    ensureKabbalahSection,
    ensureCubeSection,
    ensureAlphabetSection,
    ensureAlphabetTextSection,
    ensureAlphabetReferenceSection,
    ensureScriberSection,
    ensureZodiacSection,
    ensureGodsSection,
    ensureCalendarSection,
    ensureAudioCircleSection,
    ensureProfileSection
  }
});

window.TarotNatal = {
  ...(window.TarotNatal || {}),
  getSettings() {
    return appRuntime.getCurrentSettings?.() || { ...currentSettings };
  },
  getContext() {
    return settingsUi.buildNatalContext?.(appRuntime.getCurrentSettings?.() || currentSettings) || null;
  },
  buildContextFromSettings(settings) {
    return settingsUi.buildNatalContext?.(settings) || null;
  }
};

let initialSettings = { ...DEFAULT_SETTINGS };
syncTarotFeatureVisibility();
syncProfileVisibility();
syncAdminVisibility();
applyAdminDeepLink();

(async () => {
  // Server config seeds branding, theme, menu layout, and other defaults
  // before the first settings apply / connection attempt.
  await window.TarotAppConfig?.loadConfigDefaults?.();

  const serverDefaults = window.TarotAppConfig?.getServerDefaults?.() || {};
  if (settingsUi.mergeServerDefaults) {
    initialSettings = settingsUi.mergeServerDefaults(serverDefaults) || initialSettings;
  } else {
    initialSettings = settingsUi.loadInitialSettingsAndApply?.() || { ...DEFAULT_SETTINGS, ...serverDefaults };
  }

  currentSettings = { ...initialSettings };
  appRuntime.applySettings?.(initialSettings);
  homeUi.syncNowSkyBackground?.(
    { latitude: initialSettings.latitude, longitude: initialSettings.longitude },
    true
  );

  bindConnectionGate();
  const connected = await ensureConnectedApp();
  if (!connected) {
    // Skip authenticated warmups when the gate is up: they would just fire
    // 401s. They re-run once the connection (or background reconnect) lands.
    return;
  }
  // Warm reference data only. Section modules load on first navigation.
  await window.TarotAppRuntime?.ensureReferenceData?.();
  window.TarotLazySections?.scheduleIdleWarmup?.(["planets", "cycles", "zodiac"]);
})();
