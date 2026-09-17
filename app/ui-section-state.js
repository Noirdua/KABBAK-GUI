(function () {
  "use strict";

  const BUILTIN_SECTIONS = new Set([
    "home",
    "settings",
    "planner",
    "audio-circle",
    "audio-notes",
    "tarot",
    "tarot-frame",
    "tarot-house",
    "astronomy",
    "planets",
    "cycles",
    "sky",
    "natal",
    "elements",
    "tattvas",
    "modalities",
    "iching",
    "iching-trigram",
    "iching-bigram",
    "iching-phase",
    "playing-cards",
    "kabbalah",
    "kabbalah-worlds",
    "kabbalah-paths",
    "kabbalah-cross",
    "kabbalah-tree",
    "cube",
    "kabbalah-tandem",
    "alphabet",
    "alphabet-letters",
    "alphabet-text",
    "alphabet-reference",
    "scriber",
    "numbers",
    "num-pad",
    "zodiac",
    "quiz",
    "community",
    "gods",
    "enochian",
    "admin",
    "profile"
  ]);
  const VALID_SECTIONS = new Set(BUILTIN_SECTIONS);

  let activeSection = "home";
  const MAX_SECTION_HISTORY = 24;
  const sectionHistory = [];
  let restoringHistory = false;
  let historyUiBound = false;

  const SECTION_LABELS = {
    home: "Home",
    settings: "Settings",
    planner: "Calendar",
    "audio-circle": "Circle",
    "audio-notes": "Notes",
    tarot: "Tarot",
    "tarot-frame": "Frame",
    "tarot-house": "House",
    astronomy: "Astronomy",
    planets: "Planet",
    cycles: "Cycles",
    sky: "Sky",
    natal: "Natal",
    elements: "Elements",
    tattvas: "Tattvas",
    modalities: "Modalities",
    iching: "I Ching",
    "iching-trigram": "Trigrams",
    "iching-bigram": "Bigrams",
    "iching-phase": "Phases",
    "playing-cards": "Playing Cards",
    kabbalah: "Kabbalah",
    "kabbalah-worlds": "Worlds",
    "kabbalah-paths": "Paths",
    "kabbalah-cross": "Cross",
    "kabbalah-tree": "Tree",
    cube: "Cube",
    "kabbalah-tandem": "Tree + Cube",
    alphabet: "Word",
    "alphabet-letters": "Letter",
    "alphabet-text": "Text",
    "alphabet-reference": "Reference",
    scriber: "Scriber",
    numbers: "Numbers",
    "num-pad": "Num Pad",
    zodiac: "Zodiac",
    quiz: "Quiz",
    community: "Community",
    gods: "Gods",
    enochian: "Enochian",
    admin: "Admin",
    profile: "Profile"
  };

  let config = {
    elements: {},
    ensure: {},
    isSectionAccessible: () => true,
    getReferenceData: () => null,
    getMagickDataset: () => null,
    calendarVisualsUi: null,
    tarotSpreadUi: null,
    settingsUi: null,
    homeUi: null,
    calendar: null
  };

  function setHidden(element, hidden) {
    if (element) {
      element.hidden = hidden;
    }
  }

  function setPressed(element, pressed) {
    if (element) {
      element.setAttribute("aria-pressed", pressed ? "true" : "false");
    }
  }

  function toggleActive(element, active) {
    if (element) {
      element.classList.toggle("is-active", active);
    }
  }

  function getReferenceData() {
    return config.getReferenceData?.() || null;
  }

  function getMagickDataset() {
    return config.getMagickDataset?.() || null;
  }

  function sectionLabel(sectionId) {
    const id = String(sectionId || "");
    if (SECTION_LABELS[id]) return SECTION_LABELS[id];
    return id.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || id;
  }

  function recordSectionHistory(previousSection, nextSection) {
    if (restoringHistory || !previousSection || previousSection === nextSection) {
      return;
    }
    if (sectionHistory[sectionHistory.length - 1] !== previousSection) {
      sectionHistory.push(previousSection);
    }
    if (sectionHistory.length > MAX_SECTION_HISTORY) {
      sectionHistory.shift();
    }
    renderSectionHistory();
  }

  function renderSectionHistory() {
    const backButton = document.getElementById("topbar-back");
    const trailEl = document.getElementById("topbar-history-trail");
    if (backButton) {
      backButton.disabled = sectionHistory.length === 0;
      const previous = sectionHistory[sectionHistory.length - 1];
      backButton.title = previous ? `Back to ${sectionLabel(previous)}` : "Go back";
      backButton.setAttribute("aria-label", backButton.title);
    }
    if (!trailEl) return;
    trailEl.innerHTML = "";
    if (!sectionHistory.length) {
      trailEl.hidden = true;
      return;
    }
    trailEl.hidden = false;
    const visible = sectionHistory.slice(-5);
    const offset = sectionHistory.length - visible.length;
    visible.forEach((sectionId, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "topbar-history-sep";
        sep.textContent = "›";
        trailEl.appendChild(sep);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "topbar-history-chip";
      button.textContent = sectionLabel(sectionId);
      button.title = `Return to ${sectionLabel(sectionId)}`;
      button.addEventListener("click", () => {
        jumpToHistory(offset + index);
      });
      trailEl.appendChild(button);
    });
  }

  function goBack() {
    const previous = sectionHistory.pop();
    if (!previous) {
      renderSectionHistory();
      return;
    }
    restoringHistory = true;
    try {
      setActiveSection(previous);
    } finally {
      restoringHistory = false;
      renderSectionHistory();
    }
  }

  function jumpToHistory(index) {
    if (index < 0 || index >= sectionHistory.length) return;
    const target = sectionHistory[index];
    sectionHistory.length = index;
    restoringHistory = true;
    try {
      setActiveSection(target);
    } finally {
      restoringHistory = false;
      renderSectionHistory();
    }
  }

  function bindHistoryUi() {
    if (historyUiBound) return;
    const backButton = document.getElementById("topbar-back");
    if (!backButton) return;
    historyUiBound = true;
    backButton.addEventListener("click", () => {
      goBack();
    });
    document.addEventListener("keydown", (event) => {
      if (!(event.altKey && event.key === "ArrowLeft")) return;
      const target = event.target;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return;
      }
      event.preventDefault();
      goBack();
    });
    renderSectionHistory();
  }

  function resetBrowseLayoutToList(sectionId) {
    const special = {
      tarot: "#tarot-browse-view .browse-layout",
      cube: "#cube-layout"
    };
    const selector = special[sectionId] || `#${sectionId}-section .browse-layout, #${sectionId}-section .kab-layout`;
    const layout = document.querySelector(selector);
    if (!(layout instanceof HTMLElement)) {
      return;
    }
    window.TarotChromeUi?.showSidebarOnly?.(layout, true);
  }

  function setActiveSection(nextSection) {
    const previousSection = activeSection;
    const requestedSection = VALID_SECTIONS.has(nextSection) ? nextSection : "home";
    const normalized = config.isSectionAccessible?.(requestedSection) === false
      ? "home"
      : requestedSection;
    activeSection = normalized;
    recordSectionHistory(previousSection, normalized);

    document.dispatchEvent(new CustomEvent("section:changed", {
      detail: {
        previousSection,
        activeSection
      }
    }));

    const elements = config.elements || {};
    const ensure = config.ensure || {};
    const referenceData = getReferenceData();
    const magickDataset = getMagickDataset();

    const isHomeOpen = activeSection === "home";
    const isSettingsOpen = activeSection === "settings";
    const isPlannerOpen = activeSection === "planner";
    const isAudioNotesOpen = activeSection === "audio-notes";
    const isAudioCircleOpen = activeSection === "audio-circle";
    const isAudioMenuOpen = isAudioNotesOpen || isAudioCircleOpen;
    const isTarotOpen = activeSection === "tarot";
    const isTarotFrameOpen = activeSection === "tarot-frame";
    const isTarotHouseOpen = activeSection === "tarot-house";
    const isTarotMenuOpen = isTarotOpen || isTarotFrameOpen || isTarotHouseOpen;
    const isAstronomyOpen = activeSection === "astronomy";
    const isSkyOpen = activeSection === "sky";
    const isPlanetOpen = activeSection === "planets";
    const isCyclesOpen = activeSection === "cycles";
    const isNatalOpen = activeSection === "natal";
    const isZodiacOpen = activeSection === "zodiac";
    const isModalitiesOpen = activeSection === "modalities";
    const isAstronomyMenuOpen = isAstronomyOpen || isPlanetOpen || isCyclesOpen || isZodiacOpen || isModalitiesOpen || isNatalOpen || isSkyOpen;
    const isElementsOpen = activeSection === "elements";
    const isTattvasOpen = activeSection === "tattvas";
    const isIChingOpen = activeSection === "iching";
    const isIChingTrigramOpen = activeSection === "iching-trigram";
    const isIChingBigramOpen = activeSection === "iching-bigram";
    const isIChingPhaseOpen = activeSection === "iching-phase";
    const isIChingMenuOpen = isIChingOpen || isIChingTrigramOpen || isIChingBigramOpen || isIChingPhaseOpen;
    const isPlayingCardsOpen = activeSection === "playing-cards";
    const isKabbalahOpen = activeSection === "kabbalah";
    const isKabbalahWorldsOpen = activeSection === "kabbalah-worlds";
    const isKabbalahPathsOpen = activeSection === "kabbalah-paths";
    const isKabbalahCrossOpen = activeSection === "kabbalah-cross";
    // The tandem view keeps the Tree and Cube sections themselves on screen,
    // side by side, so both count as open while it is active.
    const isKabbalahTandemOpen = activeSection === "kabbalah-tandem";
    const isKabbalahTreeOpen = activeSection === "kabbalah-tree" || isKabbalahTandemOpen;
    const isCubeOpen = activeSection === "cube" || isKabbalahTandemOpen;
    const isKabbalahMenuOpen = isKabbalahOpen || isKabbalahWorldsOpen || isKabbalahPathsOpen || isKabbalahCrossOpen || isKabbalahTreeOpen || isCubeOpen;
    const isAlphabetOpen = activeSection === "alphabet";
    const isAlphabetLettersOpen = activeSection === "alphabet-letters";
    const isAlphabetTextOpen = activeSection === "alphabet-text";
    const isAlphabetReferenceOpen = activeSection === "alphabet-reference";
    const isAlphabetMenuOpen = isAlphabetOpen || isAlphabetLettersOpen || isAlphabetTextOpen || isAlphabetReferenceOpen;
    const isScriberOpen = activeSection === "scriber";
    const isNumbersOpen = activeSection === "numbers";
    const isNumPadOpen = activeSection === "num-pad";
    const isNumbersMenuOpen = isNumbersOpen || isNumPadOpen;
    const isQuizOpen = activeSection === "quiz";
    const isCommunityOpen = activeSection === "community";
    const isGodsOpen = activeSection === "gods";
    const isEnochianOpen = activeSection === "enochian";
    const isProfileOpen = activeSection === "profile";
    const isAdminOpen = activeSection === "admin";

    // Park or restore the paired sections before their visibility is applied.
    if (isKabbalahTandemOpen) {
      window.UiTandem?.enter?.();
    } else {
      window.UiTandem?.leave?.();
    }

    setHidden(elements.plannerSectionEl, !isPlannerOpen);
    setHidden(elements.settingsSectionEl, !isSettingsOpen);
    setHidden(elements.audioCircleSectionEl, !isAudioCircleOpen);
    setHidden(elements.audioNotesSectionEl, !isAudioNotesOpen);
    setHidden(elements.tarotSectionEl, !isTarotOpen);
    setHidden(elements.tarotFrameSectionEl, !isTarotFrameOpen);
    setHidden(elements.tarotHouseSectionEl, !isTarotHouseOpen);
    setHidden(elements.astronomySectionEl, !isAstronomyOpen);
    setHidden(elements.skySectionEl, !isSkyOpen);
    setHidden(elements.planetSectionEl, !isPlanetOpen);
    setHidden(elements.cyclesSectionEl, !isCyclesOpen);
    setHidden(elements.natalSectionEl, !isNatalOpen);
    setHidden(elements.elementsSectionEl, !isElementsOpen);
    setHidden(elements.tattvasSectionEl, !isTattvasOpen);
    setHidden(elements.modalitiesSectionEl, !isModalitiesOpen);
    setHidden(elements.ichingSectionEl, !isIChingOpen);
    setHidden(elements.ichingTrigramSectionEl, !isIChingTrigramOpen);
    setHidden(elements.ichingBigramSectionEl, !isIChingBigramOpen);
    setHidden(elements.ichingPhaseSectionEl, !isIChingPhaseOpen);
    setHidden(elements.playingCardsSectionEl, !isPlayingCardsOpen);
    setHidden(elements.kabbalahSectionEl, !isKabbalahOpen);
    setHidden(elements.kabbalahWorldsSectionEl, !isKabbalahWorldsOpen);
    setHidden(elements.kabbalahPathsSectionEl, !isKabbalahPathsOpen);
    setHidden(elements.kabbalahCrossSectionEl, !isKabbalahCrossOpen);
    setHidden(elements.kabbalahTreeSectionEl, !isKabbalahTreeOpen);
    setHidden(elements.cubeSectionEl, !isCubeOpen);
    setHidden(elements.kabbalahTandemSectionEl, !isKabbalahTandemOpen);
    setHidden(elements.alphabetSectionEl, !isAlphabetOpen);
    setHidden(elements.alphabetLettersSectionEl, !isAlphabetLettersOpen);
    setHidden(elements.alphabetTextSectionEl, !isAlphabetTextOpen);
    setHidden(elements.alphabetReferenceSectionEl, !isAlphabetReferenceOpen);
    setHidden(elements.scriberSectionEl, !isScriberOpen);
    setHidden(elements.numbersSectionEl, !isNumbersOpen);
    setHidden(elements.numPadSectionEl, !isNumPadOpen);
    setHidden(elements.zodiacSectionEl, !isZodiacOpen);
    setHidden(elements.quizSectionEl, !isQuizOpen);
    setHidden(elements.communitySectionEl, !isCommunityOpen);
    setHidden(elements.godsSectionEl, !isGodsOpen);
    setHidden(elements.enochianSectionEl, !isEnochianOpen);
    setHidden(elements.profileSectionEl, !isProfileOpen);
    setHidden(elements.adminSectionEl, !isAdminOpen);
    setHidden(elements.nowPanelEl, !isSkyOpen);
    setHidden(elements.homeWelcomeEl, !isHomeOpen);
    document.querySelectorAll("[data-plugin-section]").forEach((sectionEl) => {
      setHidden(sectionEl, sectionEl.getAttribute("data-plugin-section") !== activeSection);
    });
    document.querySelectorAll("[data-plugin-section-open]").forEach((buttonEl) => {
      setPressed(buttonEl, buttonEl.getAttribute("data-plugin-section-open") === activeSection);
    });

    setPressed(elements.openHomeEl, isHomeOpen);
    setPressed(elements.openSettingsEl, isSettingsOpen);
    setPressed(elements.openCalendarEl, isPlannerOpen);
    setPressed(elements.openAudioEl, isAudioMenuOpen);
    toggleActive(elements.openAudioCircleEl, isAudioCircleOpen);
    toggleActive(elements.openAudioNotesEl, isAudioNotesOpen);
    setPressed(elements.openTarotEl, isTarotMenuOpen);
    toggleActive(elements.openTarotFrameEl, isTarotFrameOpen);
    toggleActive(elements.openTarotHouseEl, isTarotHouseOpen);
    config.tarotSpreadUi?.applyViewState?.();
    setPressed(elements.openAstronomyEl, isAstronomyMenuOpen);
    toggleActive(elements.openPlanetsEl, isPlanetOpen);
    toggleActive(elements.openCyclesEl, isCyclesOpen);
    toggleActive(elements.openModalitiesEl, isModalitiesOpen);
    setPressed(elements.openElementsEl, isElementsOpen);
    setPressed(elements.openTattvasEl, isTattvasOpen);
    setPressed(elements.openIChingEl, isIChingMenuOpen);
    toggleActive(elements.openPlayingCardsEl, isPlayingCardsOpen);
    toggleActive(elements.openIChingHexagramsEl, isIChingOpen);
    toggleActive(elements.openIChingTrigramsEl, isIChingTrigramOpen);
    toggleActive(elements.openIChingBigramsEl, isIChingBigramOpen);
    toggleActive(elements.openIChingPhasesEl, isIChingPhaseOpen);
    setPressed(elements.openKabbalahEl, isKabbalahMenuOpen);
    toggleActive(elements.openKabbalahSephirotEl, isKabbalahOpen);
    toggleActive(elements.openKabbalahWorldsEl, isKabbalahWorldsOpen);
    toggleActive(elements.openKabbalahPathsEl, isKabbalahPathsOpen);
    toggleActive(elements.openKabbalahCrossEl, isKabbalahCrossOpen);
    toggleActive(elements.openKabbalahTreeEl, isKabbalahTreeOpen);
    toggleActive(elements.openKabbalahCubeEl, isCubeOpen);
    toggleActive(elements.openKabbalahTandemEl, isKabbalahTandemOpen);
    setPressed(elements.openAlphabetEl, isAlphabetMenuOpen);
    toggleActive(elements.openAlphabetWordEl, isAlphabetOpen);
    toggleActive(elements.openAlphabetLettersEl, isAlphabetLettersOpen);
    toggleActive(elements.openAlphabetTextEl, isAlphabetTextOpen);
    toggleActive(elements.openAlphabetReferenceEl, isAlphabetReferenceOpen);
    setPressed(elements.openScriberEl, isScriberOpen);
    setPressed(elements.openNumbersEl, isNumbersMenuOpen);
    toggleActive(elements.openNumbersNumPadEl, isNumPadOpen);
    toggleActive(elements.openZodiacEl, isZodiacOpen);
    toggleActive(elements.openNatalEl, isNatalOpen);
    setPressed(elements.openQuizEl, isQuizOpen);
    setPressed(elements.openCommunityEl, isCommunityOpen);
    setPressed(elements.openGodsEl, isGodsOpen);
    setPressed(elements.openEnochianEl, isEnochianOpen);
    setPressed(elements.openProfileEl, isProfileOpen);
    setPressed(elements.openAdminEl, isAdminOpen);

    if (isPlannerOpen) {
      window.TarotPlannerUi?.render?.();
      return;
    }

    if (isSettingsOpen) {
      return;
    }

    requestAnimationFrame(() => {
      // Only reset to the list ("Set") when a section is opened fresh from the
      // menu. Back/history navigation and relational deep-links restore the
      // section's own detail state instead of forcing the list.
      if (!restoringHistory) {
        resetBrowseLayoutToList(activeSection);
      }
    });

    // Load heavy section modules on demand, then hydrate content.
    void activateSectionContent(activeSection, ensure, referenceData, magickDataset);
  }

  const MAGICK_SECTIONS = new Set([
    "tarot",
    "tarot-frame",
    "tarot-house",
    "planets",
    "elements",
    "tattvas",
    "modalities",
    "kabbalah",
    "kabbalah-worlds",
    "kabbalah-paths",
    "kabbalah-cross",
    "kabbalah-tree",
    "cube",
    "kabbalah-tandem",
    "alphabet",
    "alphabet-letters",
    "alphabet-text",
    "scriber",
    "numbers",
    "zodiac",
    "quiz",
    "gods",
    "enochian"
  ]);

  async function activateSectionContent(sectionId, ensure, referenceData, magickDataset) {
    try {
      await window.TarotLazySections?.ensureSectionScripts?.(sectionId);
      window.TarotEnsureDeferredUiInits?.();
    } catch (error) {
      console.warn("[lazy-sections]", error?.message || error);
    }

    // Section may have changed while scripts were loading.
    if (getActiveSection() !== sectionId) {
      return;
    }

    let latestReferenceData = getReferenceData() || referenceData;
    let latestMagickDataset = getMagickDataset() || magickDataset;

    // Magick dataset is deferred at boot; load it on first section that needs it.
    if (MAGICK_SECTIONS.has(sectionId) && !latestMagickDataset) {
      try {
        latestMagickDataset = await window.TarotAppRuntime?.ensureMagickDatasetLoaded?.() || null;
      } catch (error) {
        console.warn("[magick-dataset]", error?.message || error);
      }
      if (getActiveSection() !== sectionId) {
        return;
      }
      latestReferenceData = getReferenceData() || latestReferenceData;
      latestMagickDataset = getMagickDataset() || latestMagickDataset;
    }

    if (sectionId === "audio-circle") {
      ensure.ensureAudioCircleSection?.();
      return;
    }
    if (sectionId === "audio-notes") {
      ensure.ensureAudioNotesSection?.();
      return;
    }
    if (sectionId === "tarot") {
      const tarotSpreadUi = window.TarotSpreadUi || config.tarotSpreadUi || null;
      if (typeof tarotSpreadUi?.handleSectionActivated === "function") {
        tarotSpreadUi.handleSectionActivated();
      } else {
        void Promise.resolve(ensure.ensureTarotSection?.(latestReferenceData, latestMagickDataset))
          .finally(() => {
            requestAnimationFrame(() => {
              window.TarotSequenceNav?.enableAutomaticSequenceNavigation?.();
            });
          });
        return;
      }
      requestAnimationFrame(() => {
        window.TarotSequenceNav?.enableAutomaticSequenceNavigation?.();
      });
      return;
    }
    if (sectionId === "tarot-frame") {
      ensure.ensureTarotFrameSection?.(latestReferenceData, latestMagickDataset);
      return;
    }
    if (sectionId === "tarot-house") {
      void Promise.resolve(ensure.ensureTarotSection?.(latestReferenceData, latestMagickDataset))
        .finally(() => {
          requestAnimationFrame(() => {
            window.TarotSequenceNav?.enableAutomaticSequenceNavigation?.();
          });
        });
      return;
    }
    if (sectionId === "planets") {
      ensure.ensurePlanetSection?.(latestReferenceData, latestMagickDataset);
      return;
    }
    if (sectionId === "cycles") {
      ensure.ensureCyclesSection?.(latestReferenceData);
      return;
    }
    if (sectionId === "elements") {
      ensure.ensureElementsSection?.(latestMagickDataset);
      requestAnimationFrame(() => {
        window.TarotSequenceNav?.enableAutomaticSequenceNavigation?.();
      });
      return;
    }
    if (sectionId === "tattvas") {
      ensure.ensureTattvasSection?.(latestMagickDataset);
      requestAnimationFrame(() => {
        window.TarotSequenceNav?.enableAutomaticSequenceNavigation?.();
      });
      return;
    }
    if (sectionId === "modalities") {
      ensure.ensureModalitiesSection?.(latestMagickDataset, latestReferenceData);
      return;
    }
    if (sectionId === "iching") {
      ensure.ensureIChingSection?.(latestReferenceData);
      return;
    }
    if (sectionId === "iching-trigram") {
      ensure.ensureIChingTrigramSection?.(latestReferenceData);
      return;
    }
    if (sectionId === "iching-bigram") {
      ensure.ensureIChingBigramSection?.(latestReferenceData);
      return;
    }
    if (sectionId === "iching-phase") {
      ensure.ensureIChingPhaseSection?.();
      return;
    }
    if (sectionId === "playing-cards") {
      ensure.ensurePlayingCardsSection?.(latestMagickDataset);
      return;
    }
    if (
      sectionId === "kabbalah"
      || sectionId === "kabbalah-worlds"
      || sectionId === "kabbalah-paths"
      || sectionId === "kabbalah-cross"
      || sectionId === "kabbalah-tree"
    ) {
      ensure.ensureKabbalahSection?.(latestMagickDataset);
      return;
    }
    if (sectionId === "cube") {
      ensure.ensureCubeSection?.(latestMagickDataset, latestReferenceData);
      return;
    }
    if (sectionId === "kabbalah-tandem") {
      ensure.ensureKabbalahSection?.(latestMagickDataset);
      ensure.ensureCubeSection?.(latestMagickDataset, latestReferenceData);
      return;
    }
    if (sectionId === "alphabet" || sectionId === "alphabet-letters") {
      ensure.ensureAlphabetSection?.(latestMagickDataset, latestReferenceData);
      return;
    }
    if (sectionId === "alphabet-text") {
      ensure.ensureAlphabetTextSection?.();
      return;
    }
    if (sectionId === "alphabet-reference") {
      ensure.ensureAlphabetReferenceSection?.();
      return;
    }
    if (sectionId === "scriber") {
      ensure.ensureScriberSection?.(latestMagickDataset, latestReferenceData);
      return;
    }
    if (sectionId === "numbers") {
      ensure.ensureNumbersSection?.(latestMagickDataset, latestReferenceData);
      return;
    }
    if (sectionId === "num-pad") {
      ensure.ensureNumPadSection?.();
      return;
    }
    if (sectionId === "zodiac") {
      ensure.ensureZodiacSection?.(latestReferenceData, latestMagickDataset);
      return;
    }
    if (sectionId === "natal") {
      ensure.ensureNatalPanel?.(latestReferenceData);
      return;
    }
    if (sectionId === "quiz") {
      ensure.ensureQuizSection?.(latestReferenceData, latestMagickDataset);
      return;
    }
    if (sectionId === "community") {
      ensure.ensureCommunitySection?.();
      return;
    }
    if (sectionId === "profile") {
      ensure.ensureProfileSection?.();
      return;
    }
    if (sectionId === "gods") {
      ensure.ensureGodsSection?.(latestMagickDataset, latestReferenceData);
      requestAnimationFrame(() => {
        window.TarotSequenceNav?.enableAutomaticSequenceNavigation?.();
      });
      return;
    }
    if (sectionId === "enochian") {
      ensure.ensureEnochianSection?.(latestMagickDataset, latestReferenceData);
      requestAnimationFrame(() => {
        window.TarotSequenceNav?.enableAutomaticSequenceNavigation?.();
      });
      return;
    }

    if (sectionId === "home" || sectionId === "sky") {
      config.homeUi?.syncNowPanelTheme?.(new Date());
    }
  }

  function getActiveSection() {
    return activeSection;
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig,
      elements: {
        ...(config.elements || {}),
        ...(nextConfig.elements || {})
      },
      ensure: {
        ...(config.ensure || {}),
        ...(nextConfig.ensure || {})
      }
    };
    bindHistoryUi();
  }

  function registerSection(sectionId) {
    const id = String(sectionId || "").trim();
    if (id) VALID_SECTIONS.add(id);
    return id;
  }

  function unregisterSection(sectionId) {
    const id = String(sectionId || "").trim();
    if (id && !BUILTIN_SECTIONS.has(id)) {
      VALID_SECTIONS.delete(id);
    }
  }

  function listSections() {
    return [...VALID_SECTIONS].map((id) => ({ id, label: sectionLabel(id) }));
  }

  function isBuiltinSection(sectionId) {
    return BUILTIN_SECTIONS.has(String(sectionId || "").trim());
  }

  window.TarotSectionStateUi = {
    ...(window.TarotSectionStateUi || {}),
    init,
    getActiveSection,
    setActiveSection,
    goBack,
    registerSection,
    unregisterSection,
    isBuiltinSection,
    sectionLabel,
    listSections
  };
})();
