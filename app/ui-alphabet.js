/* ui-alphabet.js — Multi-alphabet browser (English / Hebrew / Greek / Arabic / Enochian) */
(function () {
  "use strict";

  const { html } = window.HtmlSafe;

  const alphabetGematriaUi = window.AlphabetGematriaUi || {};
  const alphabetBrowserUi = window.AlphabetBrowserUi || {};
  const alphabetKabbalahUi = window.AlphabetKabbalahUi || {};
  const alphabetReferenceBuilders = window.AlphabetReferenceBuilders || {};
  const alphabetDetailUi = window.AlphabetDetailUi || {};

  if (
    typeof alphabetBrowserUi.createAlphabetBrowser !== "function"
    || typeof alphabetKabbalahUi.buildCubePlacementButton !== "function"
    || typeof alphabetKabbalahUi.buildFourWorldLayersFromDataset !== "function"
    || typeof alphabetKabbalahUi.createEmptyCubeRefs !== "function"
    || typeof alphabetKabbalahUi.getCubePlacementForHebrewLetter !== "function"
    || typeof alphabetKabbalahUi.getCubePlacementForPlanet !== "function"
    || typeof alphabetKabbalahUi.getCubePlacementForSign !== "function"
    || typeof alphabetKabbalahUi.normalizeId !== "function"
    || typeof alphabetKabbalahUi.normalizeLetterId !== "function"
    || typeof alphabetKabbalahUi.titleCase !== "function"
  ) {
    throw new Error("AlphabetBrowserUi and AlphabetKabbalahUi modules must load before ui-alphabet.js");
  }

  const state = {
    initialized: false,
    alphabets: null,
    activeAlphabet: "all",
    selectedKey: null,
    filters: {
      query: "",
      letterType: ""
    },
    fourWorldLayers: [],
    monthRefsByHebrewId: new Map(),
    cubeRefs: {
      hebrewPlacementById: new Map(),
      signPlacementById: new Map(),
      planetPlacementById: new Map(),
      pathPlacementByNo: new Map()
    },
    gematriaDb: null
  };
  let detailNavigator = null;

  function arabicDisplayName(letter) {
    return browserUi.arabicDisplayName(letter);
  }

  // ── Element cache ────────────────────────────────────────────────────
  let alphabetLettersSectionEl;
  let listEl, countEl, detailNameEl, detailSubEl, detailBodyEl;
  let detailPrevEl, detailPositionEl, detailNextEl;
  let tabAll, tabHebrew, tabGreek, tabGreekArchaic, tabEnglish, tabArabic, tabEnochian;
  let searchInputEl, searchClearEl, typeFilterEl;
  let gematriaCipherEl, gematriaInputEl, gematriaResultEl, gematriaBreakdownEl;
  let gematriaModeEls, gematriaMatchesEl, gematriaInputLabelEl, gematriaCipherLabelEl;
  let gematriaReverseCiphersEl, gematriaReverseCipherHintEl;
  let gematriaLanguageFieldEl, gematriaLanguageEl, gematriaMethodFieldEl, gematriaMethodEl;
  let gematriaOptionsBtnEl, gematriaOptionsSummaryEl;
  let gematriaKeyboardEl, gematriaKeyboardScriptEl, gematriaKeyboardGridEl, gematriaKeyboardActionsEl;
  let gematriaKeyboardToggleEl;

  function getElements() {
    alphabetLettersSectionEl = document.getElementById("alphabet-letters-section");
    listEl       = document.getElementById("alpha-letter-list");
    countEl      = document.getElementById("alpha-letter-count");
    detailNameEl = document.getElementById("alpha-detail-name");
    detailSubEl  = document.getElementById("alpha-detail-sub");
    detailBodyEl = document.getElementById("alpha-detail-body");
    detailPrevEl = document.getElementById("alpha-detail-prev");
    detailPositionEl = document.getElementById("alpha-detail-position");
    detailNextEl = document.getElementById("alpha-detail-next");
    tabAll       = document.getElementById("alpha-tab-all");
    tabHebrew    = document.getElementById("alpha-tab-hebrew");
    tabGreek     = document.getElementById("alpha-tab-greek");
    tabGreekArchaic = document.getElementById("alpha-tab-greek-archaic");
    tabEnglish   = document.getElementById("alpha-tab-english");
    tabArabic    = document.getElementById("alpha-tab-arabic");
    tabEnochian  = document.getElementById("alpha-tab-enochian");
    searchInputEl = document.getElementById("alpha-search-input");
    searchClearEl = document.getElementById("alpha-search-clear");
    typeFilterEl = document.getElementById("alpha-type-filter");
    gematriaCipherEl = document.getElementById("alpha-gematria-cipher");
    gematriaInputEl = document.getElementById("alpha-gematria-input");
    gematriaResultEl = document.getElementById("alpha-gematria-result");
    gematriaBreakdownEl = document.getElementById("alpha-gematria-breakdown");
    gematriaModeEls = Array.from(document.querySelectorAll("input[name='alpha-tool-mode']"));
    gematriaMatchesEl = document.getElementById("alpha-gematria-matches");
    gematriaInputLabelEl = document.getElementById("alpha-gematria-input-label");
    gematriaCipherLabelEl = document.getElementById("alpha-gematria-cipher-label");
    gematriaReverseCiphersEl = document.getElementById("alpha-gematria-reverse-ciphers");
    gematriaReverseCipherHintEl = document.getElementById("alpha-gematria-reverse-cipher-hint");
    gematriaLanguageFieldEl = document.getElementById("alpha-gematria-language-field");
    gematriaLanguageEl = document.getElementById("alpha-gematria-language");
    gematriaMethodFieldEl = document.getElementById("alpha-gematria-method-field");
    gematriaMethodEl = document.getElementById("alpha-gematria-method");
    gematriaOptionsBtnEl = document.getElementById("alpha-gematria-options");
    gematriaOptionsSummaryEl = document.getElementById("alpha-gematria-options-summary");
    gematriaKeyboardEl = document.getElementById("alpha-gematria-keyboard");
    gematriaKeyboardScriptEl = document.getElementById("alpha-gematria-keyboard-script");
    gematriaKeyboardGridEl = document.getElementById("alpha-gematria-keyboard-grid");
    gematriaKeyboardActionsEl = document.getElementById("alpha-gematria-keyboard-actions");
    gematriaKeyboardToggleEl = document.getElementById("alpha-gematria-keyboard-toggle");
  }

  function getGematriaElements() {
    getElements();
    return {
      cipherEl: gematriaCipherEl,
      inputEl: gematriaInputEl,
      resultEl: gematriaResultEl,
      breakdownEl: gematriaBreakdownEl,
      modeEls: gematriaModeEls,
      matchesEl: gematriaMatchesEl,
      inputLabelEl: gematriaInputLabelEl,
      cipherLabelEl: gematriaCipherLabelEl,
      reverseCiphersEl: gematriaReverseCiphersEl,
      reverseCipherHintEl: gematriaReverseCipherHintEl,
      reverseLanguageFieldEl: gematriaLanguageFieldEl,
      reverseLanguageEl: gematriaLanguageEl,
      methodFieldEl: gematriaMethodFieldEl,
      methodEl: gematriaMethodEl,
      optionsButtonEl: gematriaOptionsBtnEl,
      optionsSummaryEl: gematriaOptionsSummaryEl,
      keyboardEl: gematriaKeyboardEl,
      keyboardScriptEl: gematriaKeyboardScriptEl,
      keyboardGridEl: gematriaKeyboardGridEl,
      keyboardActionsEl: gematriaKeyboardActionsEl,
      keyboardToggleEl: gematriaKeyboardToggleEl
    };
  }

  function ensureGematriaCalculator() {
    alphabetGematriaUi.init?.({
      getAlphabets: () => state.alphabets,
      getGematriaDb: () => state.gematriaDb,
      getGematriaElements
    });
    alphabetGematriaUi.ensureCalculator?.();
  }

  // ── Data helpers ─────────────────────────────────────────────────────
  function getLetters() {
    return browserUi.getLetters();
  }

  function alphabetForLetter(letter) {
    return browserUi.alphabetForLetter(letter);
  }

  function letterKeyByAlphabet(alphabet, letter) {
    return browserUi.letterKeyByAlphabet(alphabet, letter);
  }

  function letterKey(letter) {
    return browserUi.letterKey(letter);
  }

  function displayGlyph(letter) {
    return browserUi.displayGlyph(letter);
  }

  function displayLabel(letter) {
    return browserUi.displayLabel(letter);
  }

  function displaySub(letter) {
    return browserUi.displaySub(letter);
  }

  function normalizeLetterType(value) {
    return browserUi.normalizeLetterType(value);
  }

  function getHebrewLetterTypeMap() {
    return browserUi.getHebrewLetterTypeMap();
  }

  function resolveLetterType(letter) {
    return browserUi.resolveLetterType(letter);
  }

  function buildLetterSearchText(letter) {
    return browserUi.buildLetterSearchText(letter);
  }

  function getFilteredLetters() {
    return browserUi.getFilteredLetters();
  }

  function syncFilterControls() {
    browserUi.syncFilterControls();
  }

  function applyFiltersAndRender() {
    browserUi.applyFiltersAndRender();
  }

  function bindFilterControls() {
    browserUi.bindFilterControls();
  }

  function enochianGlyphKey(letter) {
    return browserUi.enochianGlyphKey(letter);
  }

  function enochianGlyphCode(letter) {
    return browserUi.enochianGlyphCode(letter);
  }

  function enochianGlyphUrl(letter) {
    return browserUi.enochianGlyphUrl(letter);
  }

  function enochianGlyphImageHtml(letter, className) {
    return browserUi.enochianGlyphImageHtml(letter, className);
  }

  // ── List rendering ────────────────────────────────────────────────────
  function renderList() {
    browserUi.renderList();
  }

  // ── Detail rendering ──────────────────────────────────────────────────
  function renderDetail(letter) {
    if (!detailNameEl) return;

    const alphabet = alphabetForLetter(letter);

    detailNameEl.replaceChildren();
    if (alphabet === "enochian") {
      const image = document.createElement("img");
      image.className = "alpha-enochian-glyph-img alpha-enochian-glyph-img--detail";
      image.src = enochianGlyphUrl(letter);
      image.alt = `Enochian ${enochianGlyphKey(letter) || "?"}`;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        detailNameEl.textContent = enochianGlyphKey(letter) || "?";
      });
      detailNameEl.appendChild(image);
    } else {
      detailNameEl.textContent = displayGlyph(letter);
    }
    detailNameEl.classList.add("alpha-detail-glyph");
    detailNameEl.classList.toggle("alpha-detail-glyph--arabic", alphabet === "arabic");
    detailNameEl.classList.toggle("alpha-detail-glyph--enochian", alphabet === "enochian");

    if (typeof alphabetDetailUi.renderDetail === "function") {
      alphabetDetailUi.renderDetail(getDetailRenderContext(letter, alphabet));
    }

    syncDetailNavigation();
  }

  function getLetterSequenceState() {
    const filteredLetters = getFilteredLetters();
    const selectedLetter = filteredLetters.find((letter) => letterKey(letter) === state.selectedKey)
      || getLetters().find((letter) => letterKey(letter) === state.selectedKey)
      || null;

    const selectedAlphabet = state.activeAlphabet === "all"
      ? String(alphabetForLetter(selectedLetter) || "").trim().toLowerCase()
      : state.activeAlphabet;

    const letters = state.activeAlphabet === "all" && selectedAlphabet
      ? filteredLetters.filter((letter) => alphabetForLetter(letter) === selectedAlphabet)
      : filteredLetters;

    const total = letters.length;
    const currentIndex = letters.findIndex((letter) => letterKey(letter) === state.selectedKey);

    return {
      total,
      currentIndex,
      previousKey: currentIndex > 0 ? letterKey(letters[currentIndex - 1]) : "",
      nextKey: currentIndex >= 0 && currentIndex < total - 1 ? letterKey(letters[currentIndex + 1]) : ""
    };
  }

  function scrollLetterIntoView(keyToReveal, elements) {
    if (!elements?.listEl || !keyToReveal) {
      return;
    }

    const match = Array.from(elements.listEl.querySelectorAll(".alpha-list-item"))
      .find((entry) => entry.dataset.key === keyToReveal);

    match?.scrollIntoView({ block: "nearest" });
  }

  function getDetailNavigator() {
    if (detailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return detailNavigator;
    }

    detailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements: () => ({
        alphabetLettersSectionEl,
        listEl,
        detailPrevEl,
        detailPositionEl,
        detailNextEl
      }),
      isActive: (elements) => Boolean(elements?.alphabetLettersSectionEl && elements.alphabetLettersSectionEl.hidden === false),
      getSequenceState: getLetterSequenceState,
      getPrevButton: (elements) => elements?.detailPrevEl,
      getNextButton: (elements) => elements?.detailNextEl,
      getPositionEl: (elements) => elements?.detailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        const sequenceState = getLetterSequenceState();
        const alphabetLabel = sequenceState.selectedAlphabet
          ? `${sequenceState.selectedAlphabet} `
          : "";

        if (total > 0 && currentIndex >= 0) {
          const suffix = (state.activeAlphabet !== "all" || String(state.filters.query || "").trim() || state.filters.letterType)
            ? " shown"
            : "";
          return `${currentIndex + 1} of ${total} ${alphabetLabel}letters${suffix}`.trim();
        }

        return total > 0
          ? `${total} ${alphabetLabel}letters`.trim()
          : "No letters";
      },
      selectTarget: (targetKey) => {
        selectLetter(targetKey);
        return true;
      },
      afterSelect: (targetKey, elements) => {
        scrollLetterIntoView(targetKey, elements);
      }
    });

    return detailNavigator;
  }

  function syncDetailNavigation() {
    getDetailNavigator()?.sync();
  }

  function bindDetailNavigation() {
    getDetailNavigator()?.bind();
  }

  function card(title, bodyHTML) {
    return html`<div class="meta-card"><strong>${title}</strong><div class="body-text">${bodyHTML}</div></div>`;
  }

  const PLANET_SYMBOLS = {
    mercury: "☿︎", luna: "☾︎", venus: "♀︎", sol: "☉︎",
    jupiter: "♃︎", mars: "♂︎", saturn: "♄︎"
  };

  const ZODIAC_SYMBOLS = {
    aries: "♈︎", taurus: "♉︎", gemini: "♊︎", cancer: "♋︎",
    leo: "♌︎", virgo: "♍︎", libra: "♎︎", scorpio: "♏︎",
    sagittarius: "♐︎", capricorn: "♑︎", aquarius: "♒︎", pisces: "♓︎"
  };

  const HEBREW_DOUBLE_DUALITY = {
    bet: { left: "Life", right: "Death" },
    gimel: { left: "Peace", right: "War" },
    dalet: { left: "Wisdom", right: "Folly" },
    kaf: { left: "Wealth", right: "Poverty" },
    pe: { left: "Beauty", right: "Ugliness" },
    resh: { left: "Fruitfulness", right: "Sterility" },
    tav: { left: "Dominion", right: "Slavery" }
  };

  function normalizeId(value) {
    return alphabetKabbalahUi.normalizeId(value);
  }

  function normalizeLetterId(value) {
    return alphabetKabbalahUi.normalizeLetterId(value);
  }

  function titleCase(value) {
    return alphabetKabbalahUi.titleCase(value);
  }

  function buildFourWorldLayersFromDataset(magickDataset) {
    return alphabetKabbalahUi.buildFourWorldLayersFromDataset(magickDataset);
  }

  function buildMonthReferencesByHebrew(referenceData, alphabets) {
    if (typeof alphabetReferenceBuilders.buildMonthReferencesByHebrew !== "function") {
      return new Map();
    }

    return alphabetReferenceBuilders.buildMonthReferencesByHebrew(referenceData, alphabets);
  }

  function createEmptyCubeRefs() {
    return alphabetKabbalahUi.createEmptyCubeRefs();
  }

  function buildCubeReferences(magickDataset) {
    if (typeof alphabetReferenceBuilders.buildCubeReferences !== "function") {
      return createEmptyCubeRefs();
    }

    return alphabetReferenceBuilders.buildCubeReferences(magickDataset);
  }

  function getCubePlacementForHebrewLetter(hebrewLetterId, pathNo = null) {
    return alphabetKabbalahUi.getCubePlacementForHebrewLetter(state.cubeRefs, hebrewLetterId, pathNo);
  }

  function getCubePlacementForPlanet(planetId) {
    return alphabetKabbalahUi.getCubePlacementForPlanet(state.cubeRefs, planetId);
  }

  function getCubePlacementForSign(signId) {
    return alphabetKabbalahUi.getCubePlacementForSign(state.cubeRefs, signId);
  }

  function cubePlacementBtn(placement, fallbackDetail = null) {
    return alphabetKabbalahUi.buildCubePlacementButton(placement, navBtn, fallbackDetail);
  }

  function cubePlacementInlineBtn(placement, fallbackDetail = null) {
    return alphabetKabbalahUi.buildCubePlacementButton(placement, inlineNavBtn, fallbackDetail);
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

  function buildNavButton(label, event, detail, className, suffix = "") {
    const attrs = Object.entries(detail).map(([k, v]) => `data-${k}="${v}"`).join(" ");
    return html`<button class="${className}" data-event="${event}" ${attrs}>${label}${suffix}</button>`;
  }

  function navBtn(label, event, detail) {
    return buildNavButton(label, event, detail, "alpha-nav-btn", " ↗");
  }

  function inlineNavBtn(label, event, detail) {
    return buildNavButton(label, event, detail, "detail-inline-link");
  }

  function getDetailRenderContext(letter, alphabet) {
    return {
      letter,
      alphabet,
      detailSubEl,
      detailBodyEl,
      alphabets: state.alphabets,
      fourWorldLayers: state.fourWorldLayers,
      monthRefsByHebrewId: state.monthRefsByHebrewId,
      PLANET_SYMBOLS,
      ZODIAC_SYMBOLS,
      HEBREW_DOUBLE_DUALITY,
      card,
      navBtn,
      inlineNavBtn,
      cap,
      normalizeId,
      normalizeLetterId,
      getCubePlacementForPlanet,
      getCubePlacementForSign,
      getCubePlacementForHebrewLetter,
      cubePlacementBtn,
      cubePlacementInlineBtn,
      arabicDisplayName,
      enochianGlyphImageHtml,
      attachDetailListeners
    };
  }

  const browserUi = alphabetBrowserUi.createAlphabetBrowser({
    state,
    normalizeId,
    getDomRefs: () => ({
      listEl,
      countEl,
      detailNameEl,
      detailSubEl,
      detailBodyEl,
      tabAll,
      tabHebrew,
      tabGreek,
      tabGreekArchaic,
      tabEnglish,
      tabArabic,
      tabEnochian,
      searchInputEl,
      searchClearEl,
      typeFilterEl
    }),
    renderDetail,
    onStateChange: syncDetailNavigation
  });

  // ── Event delegation on detail body ──────────────────────────────────
  function attachDetailListeners() {
    if (!detailBodyEl) return;

    // Nav buttons — generic: forward all data-* (except data-event) as the event detail
    detailBodyEl.querySelectorAll(".alpha-nav-btn[data-event], .detail-inline-link[data-event]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const evtName = btn.dataset.event;
        const detail  = {};
        Object.entries(btn.dataset).forEach(([key, val]) => {
          if (key === "event") return;
          // Convert kebab data keys to camelCase (e.g. planet-id → planetId)
          const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          detail[camel] = isNaN(Number(val)) || val === "" ? val : Number(val);
        });
        document.dispatchEvent(new CustomEvent(evtName, { detail }));
      });
    });

    // Sister letter cross-navigation within this section
    detailBodyEl.querySelectorAll(".alpha-sister-btn[data-alpha]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const alpha = btn.dataset.alpha;
        const key   = btn.dataset.key;
        switchAlphabet(alpha, key);
      });
    });
  }

  // ── Selection ─────────────────────────────────────────────────────────
  function selectLetter(key) {
    browserUi.selectLetter(key);
  }

  // ── Alphabet switching ────────────────────────────────────────────────
  function switchAlphabet(alpha, selectKey) {
    browserUi.switchAlphabet(alpha, selectKey);
  }

  function updateTabs() {
    browserUi.updateTabs();
  }

  function resetDetail() {
    browserUi.resetDetail();
  }

  // ── Public init ───────────────────────────────────────────────────────
  function ensureAlphabetSection(magickDataset, referenceData = null) {
    const grouped = magickDataset?.grouped || {};
    const alphabetData = (grouped["alphabets"] && grouped["alphabets"]["hebrew"])
      ? grouped["alphabets"]
      : null;

    if (alphabetData) {
      state.alphabets = alphabetData;
      alphabetGematriaUi.refreshScriptMap?.();
    }

    state.fourWorldLayers = buildFourWorldLayersFromDataset(magickDataset);

    state.cubeRefs = buildCubeReferences(magickDataset);

    if (referenceData && state.alphabets) {
      state.monthRefsByHebrewId = buildMonthReferencesByHebrew(referenceData, state.alphabets);
    }

    state.gematriaDb = referenceData?.gematriaCiphers || null;

    if (state.initialized) {
      ensureGematriaCalculator();
      syncFilterControls();
      renderList();
      const letters = getFilteredLetters();
      const selected = letters.find((entry) => letterKey(entry) === state.selectedKey) || letters[0];
      if (selected) {
        renderDetail(selected);
      } else {
        resetDetail();
        if (detailSubEl) {
          detailSubEl.textContent = "No letters match the current filter.";
        }
      }
      return;
    }
    state.initialized = true;

    // alphabets.json is a top-level file → grouped["alphabets"] = the data object

    getElements();
    bindDetailNavigation();
    ensureGematriaCalculator();
    bindFilterControls();
    syncFilterControls();

    if (!state.alphabets) {
      if (detailSubEl) detailSubEl.textContent = "Alphabet data not loaded.";
      return;
    }

    // Attach tab listeners
    [tabAll, tabHebrew, tabGreek, tabGreekArchaic, tabEnglish, tabArabic, tabEnochian].forEach((btn) => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        switchAlphabet(btn.dataset.alpha, null);
      });
    });

    // Hebrew script switcher (Ashuri square vs Rashi script).
    const scriptSelectEl = document.getElementById("alpha-script-select");
    if (scriptSelectEl) {
      const applyScript = (scriptValue) => {
        const sectionEl = document.getElementById("alphabet-section");
        const isRashi = scriptValue === "rashi";
        if (sectionEl) {
          sectionEl.classList.toggle("alpha-script-rashi", isRashi);
        }
        try {
          window.localStorage.setItem("alphabet-hebrew-script", isRashi ? "rashi" : "ashuri");
        } catch (_error) {}
      };
      let storedScript = "ashuri";
      try {
        storedScript = String(window.localStorage.getItem("alphabet-hebrew-script") || "ashuri");
      } catch (_error) {}
      scriptSelectEl.value = storedScript === "rashi" ? "rashi" : "ashuri";
      applyScript(scriptSelectEl.value);
      scriptSelectEl.addEventListener("change", () => {
        applyScript(scriptSelectEl.value);
      });
    }

    switchAlphabet("all", null);
    syncDetailNavigation();
  }

  // ── Incoming navigation ───────────────────────────────────────────────
  function selectLetterByHebrewId(hebrewLetterId) {
    switchAlphabet("hebrew", hebrewLetterId);
  }

  function selectGreekLetterByName(name) {
    const greekLetters = Array.isArray(state.alphabets?.greek) ? state.alphabets.greek : [];
    const archaicLetters = Array.isArray(state.alphabets?.greekArchaic) ? state.alphabets.greekArchaic : [];
    const targetKey = String(name || "").trim().toLowerCase();

    if (archaicLetters.some((entry) => String(entry?.name || "").trim().toLowerCase() === targetKey)) {
      switchAlphabet("greekArchaic", name);
      return;
    }

    if (greekLetters.some((entry) => String(entry?.name || "").trim().toLowerCase() === targetKey)) {
      switchAlphabet("greek", name);
      return;
    }

    switchAlphabet("greek", name);
  }

  function selectEnglishLetter(letter) {
    switchAlphabet("english", letter);
  }

  function selectArabicLetter(name) {
    switchAlphabet("arabic", name);
  }

  function selectEnochianLetter(id) {
    switchAlphabet("enochian", id);
  }

  window.AlphabetSectionUi = {
    ensureAlphabetSection,
    selectLetterByHebrewId,
    selectGreekLetterByName,
    selectEnglishLetter,
    selectArabicLetter,
    selectEnochianLetter
  };
})();
