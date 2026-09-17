(function () {
  "use strict";

  const loadedScripts = new Set(
    Array.from(document.scripts)
      .map((script) => String(script.getAttribute("src") || "").split("?")[0])
      .filter(Boolean)
  );
  const inflight = new Map();

  const SHARED_SCRIPTS = [
    "app/ui-sequence-nav.js?v=20260820-template",
    "app/ui-search-text.js?v=20260811-link-search-01"
  ];

  const HTML2CANVAS_SRC = "node_modules/html2canvas/dist/html2canvas.min.js";
  const JSPDF_SRC = "node_modules/jspdf/dist/jspdf.umd.min.js";

  const SCRIPT_GROUPS = {
    tarotCore: [
      "app/ui-tarot-lightbox.js?v=20260914-card-reader",
      "app/ui-tarot-relations.js",
      "app/ui-tarot-card-derivations.js?v=20260307b",
      "app/ui-tarot-detail.js?v=20260805-no-active-deck",
      "app/ui-tarot-relation-display.js?v=20260307b",
      "app/ui-tarot.js?v=20260914-frame-iching",
      "app/ui-tarot-spread.js?v=20260905-reverse-off",
      "app/tarot-database-builders.js?v=20260424-decan-ranges-01",
      "app/tarot-database-assembly.js?v=20260402-princess-links-01",
      "app/tarot-database.js?v=20260402-princess-links-01"
    ],
    tarotFrame: [
      "node_modules/html2canvas/dist/html2canvas.min.js",
      "app/ui-tarot-frame.js?v=20260916-deck-refresh"
    ],
    tarotHouse: [
      "app/ui-tarot-house.js?v=20260401-house-top-date-01"
    ],
    planets: [
      "app/ui-planets-references.js",
      "app/ui-planets.js?v=20260820-template"
    ],
    cycles: [
      "app/ui-cycles.js?v=20260820-template"
    ],
    elements: [
      "app/ui-elements.js?v=20260820-template"
    ],
    tattvas: [
      "app/ui-tarot-lightbox.js?v=20260914-card-reader",
      "app/ui-tattvas.js?v=20260827-tattvas-nest"
    ],
    modalities: [
      "app/ui-modalities.js?v=20260820-template"
    ],
    audio: [
      "app/ui-audio-notes.js?v=20260820-template",
      "app/ui-audio-circle.js?v=20260820-template"
    ],
    iching: [
      "app/ui-iching-references.js",
      "app/ui-iching.js?v=20260914-deck-compare",
      "app/ui-iching-trigram.js?v=20260820-template",
      "app/ui-iching-bigram.js?v=20260820-template",
      "app/ui-iching-phase.js?v=20260820-template"
    ],
    playingCards: [
      "app/ui-tarot-lightbox.js?v=20260914-card-reader",
      "app/ui-playing-cards.js?v=20260916-deck-cycle"
    ],
    kabbalah: [
      "app/ui-rosicrucian-cross.js",
      "app/ui-kabbalah-detail.js?v=20260820-template",
      "app/ui-kabbalah-views.js?v=20260915-spin-astro",
      "app/ui-kabbalah.js?v=20260915-spin-astro"
    ],
    cube: [
      "app/ui-cube-detail.js?v=20260915-cube-ux",
      "app/ui-cube-chassis.js?v=20260915-no-hidden-hits",
      "app/ui-cube-math.js?v=20260915-spin-astro",
      "app/ui-cube-selection.js?v=20260915-cube-ux",
      "app/ui-cube.js?v=20260915-spin-astro"
    ],
    alphabet: [
      "app/ui-alphabet-gematria.js?v=20260917-word-options",
      "app/ui-alphabet-browser.js?v=20260531-greek-gematria-04",
      "app/ui-alphabet-references.js",
      "app/ui-alphabet-detail.js?v=20260822-rashi",
      "app/ui-alphabet-kabbalah.js",
      "app/ui-alphabet.js?v=20260917-word-options",
      "app/ui-alphabet-text.js?v=20260914-zen-raw",
      "app/ui-alphabet-reference.js?v=20260913-syn-cells"
    ],
    scriber: [
      "app/ui-scriber.js?v=20260902-scriber-17"
    ],
    zodiac: [
      "app/ui-zodiac-references.js",
      "app/ui-zodiac.js?v=20260820-template"
    ],
    quiz: [
      "app/ui-quiz-bank-builtins-domains.js",
      "app/ui-quiz-bank-builtins.js",
      "app/ui-quiz-bank.js",
      "app/ui-quiz.js?v=20260915-leaderboard",
      "app/quiz-plugin-helpers.js",
      "app/quiz-calendars.js",
      "app/quiz-connections.js"
    ],
    community: [
      "app/ui-board.js?v=20260915-watch"
    ],
    gods: [
      "app/ui-gods-references.js",
      "app/ui-gods.js"
    ],
    enochian: [
      "app/ui-enochian.js?v=20260820-template"
    ],
    numbers: [
      "app/ui-numbers-detail.js?v=20260820-detail-template",
      "app/ui-numbers.js?v=20260820-template"
    ],
    numPad: [
      "app/ui-num-pad-grid.js?v=20260826-num-pad",
      "app/ui-num-pad-model.js?v=20260902-grid-degree",
      "app/ui-num-pad.js?v=20260915-numpad-actions"
    ],
    natal: [
      "app/ui-natal.js"
    ],
    admin: [
      "app/ui-admin.js?v=20260916-favicon-upload"
    ],
    profile: [
      "app/ui-profile.js?v=20260916-sky-revamp"
    ]
  };

  const SECTION_GROUPS = {
    tarot: ["tarotCore"],
    "tarot-frame": ["tarotCore", "tarotFrame"],
    "tarot-house": ["tarotCore", "tarotHouse", "tarotFrame"],
    planets: ["planets"],
    cycles: ["cycles"],
    elements: ["elements"],
    tattvas: ["tattvas"],
    modalities: ["modalities"],
    "audio-notes": ["audio"],
    "audio-circle": ["audio"],
    iching: ["iching"],
    "iching-trigram": ["iching"],
    "iching-bigram": ["iching"],
    "iching-phase": ["iching"],
    "playing-cards": ["playingCards"],
    kabbalah: ["kabbalah"],
    "kabbalah-worlds": ["kabbalah"],
    "kabbalah-paths": ["kabbalah"],
    "kabbalah-cross": ["kabbalah"],
    "kabbalah-tree": ["kabbalah"],
    cube: ["kabbalah", "cube"],
    "kabbalah-tandem": ["kabbalah", "cube"],
    alphabet: ["alphabet"],
    "alphabet-letters": ["alphabet"],
    "alphabet-text": ["alphabet"],
    "alphabet-reference": ["alphabet"],
    scriber: ["scriber"],
    zodiac: ["zodiac"],
    quiz: ["quiz"],
    community: ["community"],
    gods: ["gods"],
    enochian: ["enochian"],
    numbers: ["numbers"],
    "num-pad": ["numPad"],
    natal: ["natal"],
    admin: ["admin"],
    profile: ["profile"]
  };

  function normalizeSrc(src) {
    return String(src || "").trim();
  }

  function basePath(src) {
    return normalizeSrc(src).split("?")[0];
  }

  function loadScript(src) {
    const normalized = normalizeSrc(src);
    if (!normalized) {
      return Promise.resolve();
    }

    const key = basePath(normalized);
    if (loadedScripts.has(key)) {
      return Promise.resolve();
    }

    if (inflight.has(key)) {
      return inflight.get(key);
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = normalized;
      script.async = false;
      script.onload = () => {
        loadedScripts.add(key);
        inflight.delete(key);
        resolve();
      };
      script.onerror = () => {
        inflight.delete(key);
        reject(new Error(`Failed to load script: ${normalized}`));
      };
      document.head.appendChild(script);
    });

    inflight.set(key, promise);
    return promise;
  }

  async function loadSharedScripts() {
    for (const src of SHARED_SCRIPTS) {
      await loadScript(src);
    }
  }

  async function loadScriptGroup(groupId) {
    const scripts = SCRIPT_GROUPS[groupId] || [];
    for (const src of scripts) {
      await loadScript(src);
    }
  }

  async function ensureSectionScripts(sectionId) {
    await loadSharedScripts();
    const groups = SECTION_GROUPS[String(sectionId || "").trim()] || [];
    for (const groupId of groups) {
      await loadScriptGroup(groupId);
    }
    // Re-scan after section modules load so auto prev/next attaches to
    // Elements/Gods/etc. detail headers once their list is ready.
    try {
      window.TarotSequenceNav?.enableAutomaticSequenceNavigation?.();
    } catch (_) {}
  }

  async function ensureHtml2Canvas() {
    if (typeof window.html2canvas === "function") {
      return window.html2canvas;
    }

    await loadScript(HTML2CANVAS_SRC);

    if (typeof window.html2canvas !== "function") {
      throw new Error("Detail export library failed to load.");
    }

    return window.html2canvas;
  }

  async function ensureJsPDF() {
    if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
      return window.jspdf.jsPDF;
    }

    await loadScript(JSPDF_SRC);

    if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
      return window.jspdf.jsPDF;
    }

    throw new Error("PDF export library failed to load.");
  }

  // Warm common paths after first paint without blocking startup.
  function scheduleIdleWarmup(groupIds = []) {
    const run = () => {
      groupIds.reduce((chain, groupId) => chain.then(() => loadScriptGroup(groupId).catch(() => {})), Promise.resolve());
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 4000 });
      return;
    }

    window.setTimeout(run, 1500);
  }

  function listKnownScripts() {
    const urls = [...SHARED_SCRIPTS, HTML2CANVAS_SRC, JSPDF_SRC];
    Object.values(SCRIPT_GROUPS).forEach((group) => {
      if (Array.isArray(group)) urls.push(...group);
    });
    return urls;
  }

  window.TarotLazySections = {
    ensureSectionScripts,
    ensureHtml2Canvas,
    ensureJsPDF,
    listKnownScripts,
    loadScriptGroup,
    loadScript,
    scheduleIdleWarmup
  };
})();
