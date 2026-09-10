(function () {
  "use strict";

  const DEFAULT_TIMEOUT = 10000;
  const DEFAULT_INTERVAL = 50;

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function waitFor(predicate, options = {}) {
    const timeout = Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : DEFAULT_TIMEOUT;
    const interval = Number.isFinite(Number(options.interval)) ? Number(options.interval) : DEFAULT_INTERVAL;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      try {
        if (await predicate()) {
          return true;
        }
      } catch {
      }

      await sleep(interval);
    }

    return false;
  }

  function textById(id) {
    const element = document.getElementById(id);
    return element instanceof HTMLElement ? String(element.textContent || "").trim() : "";
  }

  function getSectionElement(selector) {
    const element = document.querySelector(selector);
    return element instanceof HTMLElement ? element : null;
  }

  function getLayoutState(selector) {
    const layout = getSectionElement(selector);
    const classes = layout ? Array.from(layout.classList) : [];
    return {
      classes,
      detailOnly: classes.includes("layout-sidebar-collapsed") && !classes.includes("layout-detail-collapsed")
    };
  }

  function getSelectedText(sectionSelector) {
    const section = getSectionElement(sectionSelector);
    if (!section) {
      return "";
    }

    const selected = section.querySelector('[aria-selected="true"]');
    return selected instanceof HTMLElement ? String(selected.textContent || "").trim() : "";
  }

  function dispatchNavigationEvent(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, {
      detail,
      bubbles: true
    }));
  }

  function createSnapshot(test) {
    const section = getSectionElement(test.sectionSelector);
    const layoutState = getLayoutState(test.layoutSelector);

    return {
      sectionHidden: section ? section.hidden : true,
      layoutClasses: layoutState.classes,
      detailOnly: layoutState.detailOnly,
      detailName: textById(test.detailNameId),
      detailSub: test.detailSubId ? textById(test.detailSubId) : "",
      detailBody: test.detailBodyId ? textById(test.detailBodyId) : "",
      selectedText: getSelectedText(test.sectionSelector)
    };
  }

  async function waitForAppReady() {
    return waitFor(() => {
      if (document.readyState !== "complete") {
        return false;
      }

      const referenceData = window.TarotAppRuntime?.getReferenceData?.();
      const magickDataset = window.TarotAppRuntime?.getMagickDataset?.();

      return Boolean(
        typeof window.TarotChromeUi?.showDetailOnly === "function"
        && referenceData
        && magickDataset
      );
    });
  }

  const TESTS = {
    tarotTrumpNav: {
      eventName: "nav:tarot-trump",
      detail: { trumpNumber: 0 },
      sectionSelector: "#tarot-section",
      layoutSelector: "#tarot-browse-view .browse-layout",
      detailNameId: "tarot-detail-name",
      matches: (state) => state.detailName === "The Fool"
    },
    kabViewTrump: {
      eventName: "kab:view-trump",
      detail: { trumpNumber: 0 },
      sectionSelector: "#tarot-section",
      layoutSelector: "#tarot-browse-view .browse-layout",
      detailNameId: "tarot-detail-name",
      matches: (state) => state.detailName === "The Fool"
    },
    ichingHexagramNav: {
      eventName: "nav:iching",
      detail: { hexagramNumber: 1 },
      sectionSelector: "#iching-section",
      layoutSelector: "#iching-section .browse-layout",
      detailNameId: "iching-detail-name",
      matches: (state) => /Creative Force/i.test(state.detailName) && /#1/i.test(state.selectedText)
    },
    zodiacSignNav: {
      eventName: "nav:zodiac",
      detail: { signId: "aries" },
      sectionSelector: "#zodiac-section",
      layoutSelector: "#zodiac-section .browse-layout",
      detailNameId: "zodiac-detail-name",
      detailSubId: "zodiac-detail-sub",
      matches: (state) => /Aries/i.test(state.detailSub) && /aries/i.test(state.selectedText)
    },
    planetNav: {
      eventName: "nav:planet",
      detail: { planetId: "mars" },
      sectionSelector: "#planet-section",
      layoutSelector: "#planet-section .browse-layout",
      detailNameId: "planet-detail-name",
      matches: (state) => state.detailName !== "--" && /mars/i.test(state.selectedText)
    },
    numberNav: {
      eventName: "nav:number",
      detail: { value: 1 },
      sectionSelector: "#numbers-section",
      layoutSelector: "#numbers-section .numbers-main-layout",
      detailNameId: "numbers-detail-name",
      matches: (state) => /Number 1|One/i.test(state.detailName) && /One/i.test(state.selectedText)
    },
    elementNav: {
      eventName: "nav:elements",
      detail: { elementId: "fire" },
      sectionSelector: "#elements-section",
      layoutSelector: "#elements-section .browse-layout",
      detailNameId: "elements-detail-name",
      matches: (state) => state.detailName !== "--" && /fire/i.test(state.selectedText)
    },
    modalityNav: {
      eventName: "nav:modalities",
      detail: { modalityId: "fixed" },
      sectionSelector: "#modalities-section",
      layoutSelector: "#modalities-section .browse-layout",
      detailNameId: "modalities-detail-name",
      matches: (state) => /Fixed/i.test(state.detailName) && /fixed/i.test(state.selectedText)
    },
    calendarMonthNav: {
      eventName: "nav:calendar-month",
      detail: { calendarId: "gregorian", monthId: "january" },
      sectionSelector: "#calendar-section",
      layoutSelector: "#calendar-section .browse-layout",
      detailNameId: "calendar-detail-name",
      matches: (state) => /january/i.test(state.detailName) && /january/i.test(state.selectedText)
    },
    tarotViewKabPath: {
      eventName: "tarot:view-kab-path",
      detail: { pathNumber: 11 },
      sectionSelector: "#kabbalah-paths-section",
      layoutSelector: "#kabbalah-paths-section .browse-layout",
      detailNameId: "kab-paths-detail-name",
      detailSubId: "kab-paths-detail-sub",
      detailBodyId: "kab-paths-detail-body",
      matches: (state) => /Path 11/i.test(state.detailName) && /The Fool/i.test(state.detailSub)
    }
  };

  async function runTest(testId, options = {}) {
    const test = TESTS[testId];
    if (!test) {
      throw new Error(`Unknown navigation detail test: ${testId}`);
    }

    const ready = await waitForAppReady();
    if (!ready) {
      return {
        id: testId,
        pass: false,
        error: "App data did not finish loading in time."
      };
    }

    dispatchNavigationEvent(test.eventName, test.detail);

    const timeout = Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : DEFAULT_TIMEOUT;
    const pass = await waitFor(() => {
      const state = createSnapshot(test);
      return !state.sectionHidden && state.detailOnly && test.matches(state);
    }, { timeout });

    const state = createSnapshot(test);
    return {
      id: testId,
      eventName: test.eventName,
      detail: test.detail,
      pass,
      ...state,
      error: pass ? "" : "Destination detail pane did not settle into detail-only mode."
    };
  }

  async function runAll(testIds = Object.keys(TESTS), options = {}) {
    const results = [];
    for (const testId of testIds) {
      results.push(await runTest(testId, options));
    }

    const summary = {
      total: results.length,
      passed: results.filter((result) => result.pass).length,
      failed: results.filter((result) => !result.pass).length
    };

    const payload = { summary, results };
    window.__TAROT_NAVIGATION_DETAIL_TEST_RESULTS__ = payload;
    return payload;
  }

  window.TarotNavigationDetailTestHarness = {
    runAll,
    runTest,
    listTests: () => Object.keys(TESTS)
  };

  if (new URLSearchParams(window.location.search).has("navtest")) {
    waitForAppReady().then((ready) => {
      if (!ready) {
        return;
      }

      runAll().then((result) => {
        window.__TAROT_NAVIGATION_DETAIL_TEST_LAST_RESULT__ = result;
        console.info("Navigation detail test harness results", result);
      });
    });
  }
})();