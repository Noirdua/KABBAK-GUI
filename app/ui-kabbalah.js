(function () {
  "use strict";

  const { html } = window.HtmlSafe;

  // ─── SVG tree layout constants ──────────────────────────────────────────────
  const NS = "http://www.w3.org/2000/svg";
  const R  = 11;   // sephira circle radius

  // Standard Hermetic GD Tree of Life positions in a 240×470 viewBox
  const NODE_POS = {
    1:  [120, 30],   // Kether      — crown of middle pillar
    2:  [200, 88],   // Chokmah     — right pillar
    3:  [40,  88],   // Binah       — left pillar
    4:  [200, 213],  // Chesed      — right pillar
    5:  [40,  213],  // Geburah     — left pillar
    6:  [120, 273],  // Tiphareth   — middle pillar
    7:  [200, 343],  // Netzach     — right pillar
    8:  [40,  343],  // Hod         — left pillar
    9:  [120, 398],  // Yesod       — middle pillar
    10: [120, 448],  // Malkuth     — bottom of middle pillar
  };

  // King-scale fill colours
  const SEPH_FILL = {
    1:  "#e8e8e8",  // Kether    — white brilliance
    2:  "#87ceeb",  // Chokmah   — soft sky blue
    3:  "#7d2b5a",  // Binah     — dark crimson
    4:  "#1a56e0",  // Chesed    — deep blue
    5:  "#d44014",  // Geburah   — scarlet
    6:  "#d4a017",  // Tiphareth — gold
    7:  "#22aa60",  // Netzach   — emerald
    8:  "#cc5500",  // Hod       — orange
    9:  "#6030c0",  // Yesod     — violet
    10: "#c8b000",  // Malkuth   — citrine / amber
  };

  // Nodes with light-ish fills get dark number text; others get white
  const DARK_TEXT = new Set([1, 2, 6, 10]);

  // Da'at – phantom sephira drawn as a dashed circle, not clickable
  const DAAT = [120, 148];
    const PATH_MARKER_SCALE = 1.85;
    const PATH_LABEL_FONT_SIZE = 8.8 * PATH_MARKER_SCALE;
  const PATH_TAROT_WIDTH = 16 * PATH_MARKER_SCALE;
  const PATH_TAROT_HEIGHT = 24 * PATH_MARKER_SCALE;
  const PATH_LABEL_OFFSET_WITH_TAROT = 11 * PATH_MARKER_SCALE;
  const PATH_TAROT_OFFSET_WITH_LABEL = 1 * PATH_MARKER_SCALE;
  const PATH_TAROT_OFFSET_NO_LABEL = 12 * PATH_MARKER_SCALE;

  // ─── state ──────────────────────────────────────────────────────────────────
  const state = {
    initialized: false,
    tree: null,
    godsData: {},
    hebrewLetterIdByToken: {},
    fourWorldLayers: [],
    showSephirot: true,
    showPaths: true,
    showPathLetters: true,
    showPathNumbers: true,
    showPathAstrology: false,
    showPathTarotCards: false,
    treeSpin: true,
    treeZoom: 1,
    treeRotX: 12,
    treeRotY: -18,
    selectedWorldLayerIndex: 0,
    selectedSephiraNumber: null,
    selectedPathNumber: null,
    activeNodeKey: "",
    exportInProgress: false,
    exportFormat: ""
  };
  let detailNavigator = null;
  let browserDetailNavigator = null;
  let worldsDetailNavigator = null;
  let pathsDetailNavigator = null;
  let roseDetailNavigator = null;
  const TREE_EXPORT_FORMATS = {
    webp: {
      mimeType: "image/webp",
      extension: "webp",
      quality: 0.98
    }
  };
  const TREE_EXPORT_BACKGROUND = "#02030a";
  const DAATH_SEPHIRA = Object.freeze({
    number: 0,
    displayNumber: "Daath",
    sephiraId: "daath",
    name: "Daath",
    nameHebrew: "דעת",
    translation: "Knowledge",
    planet: "Abyss / Hidden Sephirah",
    intelligence: "Invisible Sephirah of Knowledge",
    tarot: "No fixed trump attribution",
    description: "Daath is the hidden or invisible sephirah placed beneath Kether and between Chokmah and Binah. In Hermetic Qabalah it often marks the threshold of the Abyss rather than a stable emanation like the ten manifest sephiroth."
  });

  const kabbalahDetailUi = window.KabbalahDetailUi || {};
  const kabbalahViewsUi = window.KabbalahViewsUi || {};
  let webpExportSupported = null;

  if (
    typeof kabbalahViewsUi.renderTree !== "function"
    || typeof kabbalahViewsUi.renderRoseCross !== "function"
  ) {
    throw new Error("KabbalahViewsUi module must load before ui-kabbalah.js");
  }

  const PLANET_NAME_TO_ID = {
    saturn: "saturn",
    jupiter: "jupiter",
    mars: "mars",
    sol: "sol",
    sun: "sol",
    venus: "venus",
    mercury: "mercury",
    luna: "luna",
    moon: "luna"
  };

  const ZODIAC_NAME_TO_ID = {
    aries: "aries",
    taurus: "taurus",
    gemini: "gemini",
    cancer: "cancer",
    leo: "leo",
    virgo: "virgo",
    libra: "libra",
    scorpio: "scorpio",
    sagittarius: "sagittarius",
    capricorn: "capricorn",
    aquarius: "aquarius",
    pisces: "pisces"
  };

  const HEBREW_LETTER_ALIASES = {
    aleph: "alef",
    alef: "alef",
    beth: "bet",
    bet: "bet",
    gimel: "gimel",
    daleth: "dalet",
    dalet: "dalet",
    he: "he",
    vav: "vav",
    zayin: "zayin",
    cheth: "het",
    chet: "het",
    het: "het",
    teth: "tet",
    tet: "tet",
    yod: "yod",
    kaph: "kaf",
    kaf: "kaf",
    lamed: "lamed",
    mem: "mem",
    nun: "nun",
    samekh: "samekh",
    ayin: "ayin",
    pe: "pe",
    tzaddi: "tsadi",
    tzadi: "tsadi",
    tsadi: "tsadi",
    qoph: "qof",
    qof: "qof",
    resh: "resh",
    shin: "shin",
    tav: "tav"
  };

  const DEFAULT_FOUR_QABALISTIC_WORLD_LAYERS = [
    {
      slot: "Yod",
      letterChar: "י",
      hebrewToken: "yod",
      world: "Atziluth",
      worldLayer: "Archetypal World (God’s Will)",
      worldDescription: "World of gods or specific facets or divine qualities.",
      soulLayer: "Chiah",
      soulTitle: "Life Force",
      soulDescription: "The Chiah is the Life Force itself and our true identity as reflection of Supreme Consciousness."
    },
    {
      slot: "Heh",
      letterChar: "ה",
      hebrewToken: "he",
      world: "Briah",
      worldLayer: "Creative World (God’s Love)",
      worldDescription: "World of archangels, executors of divine qualities.",
      soulLayer: "Neshamah",
      soulTitle: "Soul-Intuition",
      soulDescription: "The Neshamah is the part of our soul that transcends the thinking process."
    },
    {
      slot: "Vav",
      letterChar: "ו",
      hebrewToken: "vav",
      world: "Yetzirah",
      worldLayer: "Formative World (God’s Mind)",
      worldDescription: "World of angels who work under archangelic direction.",
      soulLayer: "Ruach",
      soulTitle: "Intellect",
      soulDescription: "The Ruach is the thinking mind that often dominates attention and identity."
    },
    {
      slot: "Heh (final)",
      letterChar: "ה",
      hebrewToken: "he",
      world: "Assiah",
      worldLayer: "Material World (God’s Creation)",
      worldDescription: "World of spirits that infuse matter and energy through specialized duties.",
      soulLayer: "Nephesh",
      soulTitle: "Animal Soul",
      soulDescription: "The Nephesh is instinctive consciousness expressed through appetite, emotion, sex drive, and survival."
    }
  ];

  function titleCase(value) {
    return String(value || "")
      .split(/[\s-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function normalizeSoulId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  function buildFourWorldLayersFromDataset(magickDataset) {
    const worlds = magickDataset?.grouped?.kabbalah?.fourWorlds;
    const souls = magickDataset?.grouped?.kabbalah?.souls;
    if (!worlds || typeof worlds !== "object") {
      return [...DEFAULT_FOUR_QABALISTIC_WORLD_LAYERS];
    }

    const worldOrder = ["atzilut", "briah", "yetzirah", "assiah"];
    const soulAliases = {
      chiah: "chaya",
      chaya: "chaya",
      neshamah: "neshama",
      neshama: "neshama",
      ruach: "ruach",
      nephesh: "nephesh"
    };

    return worldOrder.map((worldId, index) => {
      const fallback = DEFAULT_FOUR_QABALISTIC_WORLD_LAYERS[index] || {};
      const worldEntry = worlds?.[worldId] || null;
      if (!worldEntry || typeof worldEntry !== "object") {
        return fallback;
      }

      const tetragrammaton = worldEntry?.tetragrammaton && typeof worldEntry.tetragrammaton === "object"
        ? worldEntry.tetragrammaton
        : {};

      const rawSoulId = normalizeSoulId(worldEntry?.soulId);
      const soulId = soulAliases[rawSoulId] || rawSoulId;
      const soulEntry = souls?.[soulId] && typeof souls[soulId] === "object"
        ? souls[soulId]
        : null;

      const soulLayer = soulEntry?.name?.roman || fallback.soulLayer || titleCase(rawSoulId || soulId);
      const soulTitle = soulEntry?.title?.en || fallback.soulTitle || titleCase(soulEntry?.name?.en || "");
      const soulDescription = soulEntry?.desc?.en || fallback.soulDescription || "";

      return {
        slot: tetragrammaton?.isFinal
          ? `${String(tetragrammaton?.slot || fallback.slot || "Heh")} (final)`
          : String(tetragrammaton?.slot || fallback.slot || ""),
        letterChar: String(tetragrammaton?.letterChar || fallback.letterChar || ""),
        hebrewToken: String(tetragrammaton?.hebrewLetterId || fallback.hebrewToken || "").toLowerCase(),
        world: String(worldEntry?.name?.roman || fallback.world || titleCase(worldEntry?.id || worldId)),
        worldLayer: String(worldEntry?.worldLayer?.en || fallback.worldLayer || worldEntry?.desc?.en || ""),
        worldDescription: String(worldEntry?.worldDescription?.en || fallback.worldDescription || ""),
        soulLayer: String(soulLayer || ""),
        soulTitle: String(soulTitle || ""),
        soulDescription: String(soulDescription || "")
      };
    }).filter(Boolean);
  }

  // ─── element references ─────────────────────────────────────────────────────
  function getElements() {
    return {
      browserSectionEl: document.getElementById("kabbalah-section"),
      browserListEl: document.getElementById("kab-browser-list"),
      browserCountEl: document.getElementById("kab-browser-count"),
      browserDetailNameEl: document.getElementById("kab-browser-detail-name"),
      browserDetailSubEl: document.getElementById("kab-browser-detail-sub"),
      browserDetailBodyEl: document.getElementById("kab-browser-detail-body"),
      browserDetailPrevEl: document.getElementById("kab-browser-detail-prev"),
      browserDetailPositionEl: document.getElementById("kab-browser-detail-position"),
      browserDetailNextEl: document.getElementById("kab-browser-detail-next"),
      worldsSectionEl: document.getElementById("kabbalah-worlds-section"),
      worldsListEl: document.getElementById("kab-worlds-list"),
      worldsCountEl: document.getElementById("kab-worlds-count"),
      worldsDetailNameEl: document.getElementById("kab-worlds-detail-name"),
      worldsDetailSubEl: document.getElementById("kab-worlds-detail-sub"),
      worldsDetailBodyEl: document.getElementById("kab-worlds-detail-body"),
      worldsDetailPrevEl: document.getElementById("kab-worlds-detail-prev"),
      worldsDetailPositionEl: document.getElementById("kab-worlds-detail-position"),
      worldsDetailNextEl: document.getElementById("kab-worlds-detail-next"),
      pathsSectionEl: document.getElementById("kabbalah-paths-section"),
      pathsListEl: document.getElementById("kab-paths-list"),
      pathsCountEl: document.getElementById("kab-paths-count"),
      pathsDetailNameEl: document.getElementById("kab-paths-detail-name"),
      pathsDetailSubEl: document.getElementById("kab-paths-detail-sub"),
      pathsDetailBodyEl: document.getElementById("kab-paths-detail-body"),
      pathsDetailPrevEl: document.getElementById("kab-paths-detail-prev"),
      pathsDetailPositionEl: document.getElementById("kab-paths-detail-position"),
      pathsDetailNextEl: document.getElementById("kab-paths-detail-next"),
      crossSectionEl: document.getElementById("kabbalah-cross-section"),
      sectionEl: document.getElementById("kabbalah-tree-section"),
      treeContainerEl: document.getElementById("kab-tree-container"),
      detailNameEl:    document.getElementById("kab-detail-name"),
      detailSubEl:     document.getElementById("kab-detail-sub"),
      detailBodyEl:    document.getElementById("kab-detail-body"),
      detailPrevEl:    document.getElementById("kab-detail-prev"),
      detailPositionEl: document.getElementById("kab-detail-position"),
      detailNextEl:    document.getElementById("kab-detail-next"),
      treeToolbarEl: document.getElementById("kab-tree-toolbar"),
      treeSephiraToggleEl: document.getElementById("kab-tree-sephirot-toggle"),
      treePathsToggleEl: document.getElementById("kab-tree-paths-toggle"),
      pathLetterToggleEl: document.getElementById("kab-path-letter-toggle"),
      pathNumberToggleEl: document.getElementById("kab-path-number-toggle"),
      pathAstrologyToggleEl: document.getElementById("kab-path-astrology-toggle"),
      pathTarotToggleEl: document.getElementById("kab-path-tarot-toggle"),
      treeSpinToggleEl: document.getElementById("kab-tree-spin-toggle"),
      treeExportWebpEl: document.getElementById("kab-tree-export-webp"),
      roseCrossContainerEl: document.getElementById("kab-rose-cross-container"),
      roseDetailNameEl: document.getElementById("kab-rose-detail-name"),
      roseDetailSubEl: document.getElementById("kab-rose-detail-sub"),
      roseDetailBodyEl: document.getElementById("kab-rose-detail-body"),
      roseDetailPrevEl: document.getElementById("kab-rose-detail-prev"),
      roseDetailPositionEl: document.getElementById("kab-rose-detail-position"),
      roseDetailNextEl: document.getElementById("kab-rose-detail-next"),
    };
  }

  function getTreeDetailElements(elements) {
    if (!elements) {
      return null;
    }

    return {
      detailNameEl: elements.detailNameEl,
      detailSubEl: elements.detailSubEl,
      detailBodyEl: elements.detailBodyEl
    };
  }

  function getRoseDetailElements(elements) {
    if (!elements) {
      return null;
    }

    return {
      detailNameEl: elements.roseDetailNameEl,
      detailSubEl: elements.roseDetailSubEl,
      detailBodyEl: elements.roseDetailBodyEl
    };
  }

  function getPathDetailElements(elements) {
    if (!elements) {
      return null;
    }

    return {
      detailNameEl: elements.pathsDetailNameEl,
      detailSubEl: elements.pathsDetailSubEl,
      detailBodyEl: elements.pathsDetailBodyEl
    };
  }

  function getBrowserDetailElements(elements) {
    if (!elements) {
      return null;
    }

    return {
      detailNameEl: elements.browserDetailNameEl,
      detailSubEl: elements.browserDetailSubEl,
      detailBodyEl: elements.browserDetailBodyEl
    };
  }

  function getWorldDetailElements(elements) {
    if (!elements) {
      return null;
    }

    return {
      detailNameEl: elements.worldsDetailNameEl,
      detailSubEl: elements.worldsDetailSubEl,
      detailBodyEl: elements.worldsDetailBodyEl
    };
  }

  function normalizeDetailElements(elements) {
    if (!elements) {
      return null;
    }

    return {
      detailNameEl: elements.detailNameEl || null,
      detailSubEl: elements.detailSubEl || null,
      detailBodyEl: elements.detailBodyEl || null
    };
  }

  function getDetailRenderTargets(primaryElements) {
    const elements = getElements();
    const candidates = [
      normalizeDetailElements(primaryElements),
      getTreeDetailElements(elements),
      getBrowserDetailElements(elements)
    ];
    const seen = new Set();

    return candidates.filter((target) => {
      const bodyEl = target?.detailBodyEl;
      if (!(bodyEl instanceof Element) || seen.has(bodyEl)) {
        return false;
      }

      seen.add(bodyEl);
      return true;
    });
  }

  function hasFiniteSelectionNumber(value) {
    if (value === null || value === undefined || value === "") {
      return false;
    }

    return Number.isFinite(Number(value));
  }

  function isDaathToken(value) {
    return String(value || "").trim().toLowerCase() === "daath";
  }

  function buildSephiraKey(value) {
    if (isDaathToken(value) || Number(value) === 0) {
      return "sephira:daath";
    }

    return hasFiniteSelectionNumber(value) ? `sephira:${Number(value)}` : "";
  }

  function buildPathKey(value) {
    return hasFiniteSelectionNumber(value) ? `path:${Number(value)}` : "";
  }

  function buildWorldKey(value) {
    return hasFiniteSelectionNumber(value) ? `world:${Number(value)}` : "";
  }

  function getSelectedSephiraKey() {
    return buildSephiraKey(state.selectedSephiraNumber);
  }

  function getSelectedPathKey() {
    return buildPathKey(state.selectedPathNumber);
  }

  function getSelectedWorldKey() {
    return buildWorldKey(state.selectedWorldLayerIndex);
  }

  function getSephiraByNumber(number) {
    if (isDaathToken(number) || Number(number) === 0) {
      return DAATH_SEPHIRA;
    }

    if (!state.tree) {
      return null;
    }

    return state.tree.sephiroth.find((entry) => Number(entry?.number) === Number(number)) || null;
  }

  function getPathByNumber(number) {
    if (!state.tree) {
      return null;
    }

    return state.tree.paths.find((entry) => Number(entry?.pathNumber) === Number(number)) || null;
  }

  function getWorldLayerByIndex(index) {
    if (!Array.isArray(state.fourWorldLayers)) {
      return null;
    }

    const targetIndex = Number(index);
    return Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < state.fourWorldLayers.length
      ? state.fourWorldLayers[targetIndex]
      : null;
  }

  function getSephirotSequenceEntries() {
    if (!state.tree) {
      return [];
    }

    const entries = Array.isArray(state.tree.sephiroth)
      ? [...state.tree.sephiroth]
          .sort((left, right) => Number(left?.number || 0) - Number(right?.number || 0))
          .map((entry) => ({
            key: buildSephiraKey(entry?.number),
            type: "sephira",
            number: Number(entry?.number)
          }))
      : [];

    const daathEntry = {
      key: buildSephiraKey(0),
      type: "sephira",
      number: 0
    };
    const insertIndex = entries.findIndex((entry) => entry.number === 3);
    if (insertIndex >= 0) {
      entries.splice(insertIndex + 1, 0, daathEntry);
    } else {
      entries.push(daathEntry);
    }

    return entries;
  }

  function getPathSequenceEntries() {
    if (!state.tree) {
      return [];
    }

    return Array.isArray(state.tree.paths)
      ? [...state.tree.paths]
          .sort((left, right) => Number(left?.pathNumber || 0) - Number(right?.pathNumber || 0))
          .map((entry) => ({
            key: buildPathKey(entry?.pathNumber),
            type: "path",
            number: Number(entry?.pathNumber)
          }))
      : [];
  }

  function getWorldSequenceEntries() {
    return Array.isArray(state.fourWorldLayers)
      ? state.fourWorldLayers.map((layer, index) => ({
          key: buildWorldKey(index),
          type: "world",
          index,
          world: String(layer?.world || "")
        }))
      : [];
  }

  function getNodeSequenceEntries() {
    if (!state.tree) {
      return [];
    }

    const sephiroth = Array.isArray(state.tree.sephiroth)
      ? [...state.tree.sephiroth]
          .sort((left, right) => Number(left?.number || 0) - Number(right?.number || 0))
          .map((entry) => ({
            key: buildSephiraKey(entry?.number),
            type: "sephira",
            number: Number(entry?.number)
          }))
      : [];

    const paths = getPathSequenceEntries();

    return [...sephiroth, ...paths];
  }

  function getSelectedNodeKey() {
    return String(state.activeNodeKey || "").trim() || getSelectedPathKey() || getSelectedSephiraKey();
  }

  function buildSequenceState(entries, currentKey) {
    const currentIndex = entries.findIndex((entry) => entry.key === currentKey);

    return {
      total: entries.length,
      currentIndex,
      previousKey: currentIndex > 0 ? entries[currentIndex - 1].key : "",
      nextKey: currentIndex >= 0 && currentIndex < entries.length - 1 ? entries[currentIndex + 1].key : ""
    };
  }

  function getNodeSequenceState() {
    return buildSequenceState(getNodeSequenceEntries(), getSelectedNodeKey());
  }

  function getSephirotSequenceState() {
    return buildSequenceState(getSephirotSequenceEntries(), getSelectedSephiraKey());
  }

  function getPathSequenceState() {
    return buildSequenceState(getPathSequenceEntries(), getSelectedPathKey());
  }

  function getWorldSequenceState() {
    return buildSequenceState(getWorldSequenceEntries(), getSelectedWorldKey());
  }

  function getBrowserListItemMeta(entry) {
    const seph = getSephiraByNumber(entry.number);
    const displayNumber = String(seph?.displayNumber || entry.number || "").trim();

    return {
      title: displayNumber ? `${displayNumber} · ${seph?.name || "Sephirah"}` : `${seph?.name || "Sephirah"}`,
      meta: [seph?.nameHebrew, seph?.translation, seph?.planet].filter(Boolean).join(" · ") || "Sephirah"
    };
  }

  function getWorldListItemMeta(entry) {
    const layer = getWorldLayerByIndex(entry.index);

    return {
      title: String(layer?.world || `World ${entry.index + 1}`),
      meta: [
        layer?.slot ? `${layer.slot}: ${layer.letterChar || ""}`.trim() : "",
        layer?.soulLayer
      ].filter(Boolean).join(" · ") || "Qabalistic World"
    };
  }

  function getPathListItemMeta(entry) {
    const path = getPathByNumber(entry.number);
    const fromName = getSephiraByNumber(path?.connects?.from)?.name || `Node ${path?.connects?.from || "?"}`;
    const toName = getSephiraByNumber(path?.connects?.to)?.name || `Node ${path?.connects?.to || "?"}`;
    const letterLabel = [path?.hebrewLetter?.char, path?.hebrewLetter?.transliteration].filter(Boolean).join(" ").trim();

    return {
      title: `Path ${entry.number}${letterLabel ? ` · ${letterLabel}` : ""}`,
      meta: [
        `${fromName} -> ${toName}`,
        String(path?.tarot?.card || "").trim()
      ].filter(Boolean).join(" · ") || "Path"
    };
  }

  function syncBrowserListSelection(elements = getElements()) {
    if (!elements?.browserListEl) {
      return;
    }

    const selectedKey = getSelectedSephiraKey();
    elements.browserListEl.querySelectorAll(".list-item[data-node-key]").forEach((button) => {
      const isSelected = button.dataset.nodeKey === selectedKey;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function renderBrowserList(elements = getElements()) {
    if (!elements?.browserListEl) {
      return;
    }

    const entries = getSephirotSequenceEntries();
    elements.browserListEl.innerHTML = "";

    entries.forEach((entry) => {
      const button = document.createElement("button");
      const { title, meta } = getBrowserListItemMeta(entry);
      button.type = "button";
      button.className = "list-item";
      button.setAttribute("role", "option");
      button.dataset.nodeKey = entry.key;
      button.innerHTML = html`
        <div class="list-name">${title}</div>
        <div class="list-meta">${meta}</div>
      `;
      elements.browserListEl.appendChild(button);
    });

    if (elements.browserCountEl) {
      elements.browserCountEl.textContent = `${entries.length} sephiroth`;
    }

    syncBrowserListSelection(elements);
  }

  function syncWorldListSelection(elements = getElements()) {
    if (!elements?.worldsListEl) {
      return;
    }

    const selectedKey = getSelectedWorldKey();
    elements.worldsListEl.querySelectorAll(".list-item[data-world-key]").forEach((button) => {
      const isSelected = button.dataset.worldKey === selectedKey;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function syncPathsListSelection(elements = getElements()) {
    if (!elements?.pathsListEl) {
      return;
    }

    const selectedKey = getSelectedPathKey();
    elements.pathsListEl.querySelectorAll(".list-item[data-path-key]").forEach((button) => {
      const isSelected = button.dataset.pathKey === selectedKey;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function renderWorldsList(elements = getElements()) {
    if (!elements?.worldsListEl) {
      return;
    }

    const entries = getWorldSequenceEntries();
    elements.worldsListEl.innerHTML = "";

    entries.forEach((entry) => {
      const button = document.createElement("button");
      const { title, meta } = getWorldListItemMeta(entry);
      button.type = "button";
      button.className = "list-item";
      button.setAttribute("role", "option");
      button.dataset.worldKey = entry.key;
      button.innerHTML = html`
        <div class="list-name">${title}</div>
        <div class="list-meta">${meta}</div>
      `;
      elements.worldsListEl.appendChild(button);
    });

    if (elements.worldsCountEl) {
      elements.worldsCountEl.textContent = `${entries.length} worlds`;
    }

    syncWorldListSelection(elements);
  }

  function renderPathsList(elements = getElements()) {
    if (!elements?.pathsListEl) {
      return;
    }

    const entries = getPathSequenceEntries();
    elements.pathsListEl.innerHTML = "";

    entries.forEach((entry) => {
      const button = document.createElement("button");
      const { title, meta } = getPathListItemMeta(entry);
      button.type = "button";
      button.className = "list-item";
      button.setAttribute("role", "option");
      button.dataset.pathKey = entry.key;
      button.innerHTML = html`
        <div class="list-name">${title}</div>
        <div class="list-meta">${meta}</div>
      `;
      elements.pathsListEl.appendChild(button);
    });

    if (elements.pathsCountEl) {
      elements.pathsCountEl.textContent = `${entries.length} paths`;
    }

    syncPathsListSelection(elements);
  }

  function bindBrowserList(elements = getElements()) {
    if (!elements?.browserListEl || elements.browserListEl.dataset.bound) {
      return;
    }

    elements.browserListEl.addEventListener("click", (event) => {
      const target = event.target instanceof Element
        ? event.target.closest(".list-item[data-node-key]")
        : null;

      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const targetKey = String(target.dataset.nodeKey || "").trim();
      if (!targetKey) {
        return;
      }

      selectNodeBySequenceKey(targetKey, getBrowserDetailElements(getElements()));
    });

    elements.browserListEl.dataset.bound = "true";
  }

  function bindWorldList(elements = getElements()) {
    if (!elements?.worldsListEl || elements.worldsListEl.dataset.bound) {
      return;
    }

    elements.worldsListEl.addEventListener("click", (event) => {
      const target = event.target instanceof Element
        ? event.target.closest(".list-item[data-world-key]")
        : null;

      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const targetKey = String(target.dataset.worldKey || "").trim();
      if (!targetKey) {
        return;
      }

      selectNodeBySequenceKey(targetKey, getWorldDetailElements(getElements()));
    });

    elements.worldsListEl.dataset.bound = "true";
  }

  function bindPathsList(elements = getElements()) {
    if (!elements?.pathsListEl || elements.pathsListEl.dataset.bound) {
      return;
    }

    elements.pathsListEl.addEventListener("click", (event) => {
      const target = event.target instanceof Element
        ? event.target.closest(".list-item[data-path-key]")
        : null;

      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const targetKey = String(target.dataset.pathKey || "").trim();
      if (!targetKey) {
        return;
      }

      selectNodeBySequenceKey(targetKey, getPathDetailElements(getElements()));
    });

    elements.pathsListEl.dataset.bound = "true";
  }

  function selectNodeBySequenceKey(targetKey, elements = getElements()) {
    if (!state.tree) {
      return false;
    }

    const [type, rawToken] = String(targetKey || "").split(":");

    if (type === "sephira") {
      const seph = getSephiraByNumber(isDaathToken(rawToken) ? 0 : Number(rawToken));
      if (!seph) {
        return false;
      }

      renderSephiraDetail(seph, state.tree, elements);
      return true;
    }

    if (type === "path") {
      const path = getPathByNumber(Number(rawToken));
      if (!path) {
        return false;
      }

      renderPathDetail(path, state.tree, elements);
      return true;
    }

    if (type === "world") {
      const worldLayer = getWorldLayerByIndex(Number(rawToken));
      if (!worldLayer) {
        return false;
      }

      renderWorldLayerDetail(worldLayer, Number(rawToken), state.tree, elements);
      return true;
    }

    return false;
  }

  function getDetailNavigator() {
    if (detailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return detailNavigator;
    }

    detailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.sectionEl && elements.sectionEl.hidden === false),
      getSequenceState: getNodeSequenceState,
      getPrevButton: (elements) => elements?.detailPrevEl,
      getNextButton: (elements) => elements?.detailNextEl,
      getPositionEl: (elements) => elements?.detailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          return `${currentIndex + 1} of ${total} nodes`;
        }

        return total > 0 ? `${total} nodes` : "No nodes";
      },
      selectTarget: (targetKey, elements) => selectNodeBySequenceKey(targetKey, elements)
    });

    return detailNavigator;
  }

  function getBrowserDetailNavigator() {
    if (browserDetailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return browserDetailNavigator;
    }

    browserDetailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.browserSectionEl && elements.browserSectionEl.hidden === false),
      getSequenceState: getSephirotSequenceState,
      getPrevButton: (elements) => elements?.browserDetailPrevEl,
      getNextButton: (elements) => elements?.browserDetailNextEl,
      getPositionEl: (elements) => elements?.browserDetailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          return `${currentIndex + 1} of ${total} sephiroth`;
        }

        return total > 0 ? `${total} sephiroth` : "No sephiroth";
      },
      selectTarget: (targetKey) => selectNodeBySequenceKey(targetKey, getBrowserDetailElements(getElements()))
    });

    return browserDetailNavigator;
  }

  function getPathsDetailNavigator() {
    if (pathsDetailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return pathsDetailNavigator;
    }

    pathsDetailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.pathsSectionEl && elements.pathsSectionEl.hidden === false),
      getSequenceState: getPathSequenceState,
      getPrevButton: (elements) => elements?.pathsDetailPrevEl,
      getNextButton: (elements) => elements?.pathsDetailNextEl,
      getPositionEl: (elements) => elements?.pathsDetailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          return `${currentIndex + 1} of ${total} paths`;
        }

        return total > 0 ? `${total} paths` : "No paths";
      },
      selectTarget: (targetKey) => selectNodeBySequenceKey(targetKey, getPathDetailElements(getElements()))
    });

    return pathsDetailNavigator;
  }

  function getRoseDetailNavigator() {
    if (roseDetailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return roseDetailNavigator;
    }

    roseDetailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.crossSectionEl && elements.crossSectionEl.hidden === false),
      getSequenceState: getPathSequenceState,
      getPrevButton: (elements) => elements?.roseDetailPrevEl,
      getNextButton: (elements) => elements?.roseDetailNextEl,
      getPositionEl: (elements) => elements?.roseDetailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          return `${currentIndex + 1} of ${total} paths`;
        }

        return total > 0 ? `${total} paths` : "No paths";
      },
      selectTarget: (targetKey) => selectNodeBySequenceKey(targetKey, getRoseDetailElements(getElements()))
    });

    return roseDetailNavigator;
  }

  function getWorldDetailNavigator() {
    if (worldsDetailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return worldsDetailNavigator;
    }

    worldsDetailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.worldsSectionEl && elements.worldsSectionEl.hidden === false),
      getSequenceState: getWorldSequenceState,
      getPrevButton: (elements) => elements?.worldsDetailPrevEl,
      getNextButton: (elements) => elements?.worldsDetailNextEl,
      getPositionEl: (elements) => elements?.worldsDetailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          return `${currentIndex + 1} of ${total} worlds`;
        }

        return total > 0 ? `${total} worlds` : "No worlds";
      },
      selectTarget: (targetKey) => selectNodeBySequenceKey(targetKey, getWorldDetailElements(getElements()))
    });

    return worldsDetailNavigator;
  }

  function syncDetailNavigation(elements = getElements()) {
    getDetailNavigator()?.sync(elements);
  }

  function syncBrowserDetailNavigation(elements = getElements()) {
    getBrowserDetailNavigator()?.sync(elements);
  }

  function syncPathsDetailNavigation(elements = getElements()) {
    getPathsDetailNavigator()?.sync(elements);
  }

  function syncRoseDetailNavigation(elements = getElements()) {
    getRoseDetailNavigator()?.sync(elements);
  }

  function syncWorldDetailNavigation(elements = getElements()) {
    getWorldDetailNavigator()?.sync(elements);
  }

  function bindDetailNavigation(elements = getElements()) {
    getDetailNavigator()?.bind(elements);
  }

  function bindBrowserDetailNavigation(elements = getElements()) {
    getBrowserDetailNavigator()?.bind(elements);
  }

  function bindPathsDetailNavigation(elements = getElements()) {
    getPathsDetailNavigator()?.bind(elements);
  }

  function bindRoseDetailNavigation(elements = getElements()) {
    getRoseDetailNavigator()?.bind(elements);
  }

  function bindWorldDetailNavigation(elements = getElements()) {
    getWorldDetailNavigator()?.bind(elements);
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeLetterToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  function buildHebrewLetterLookup(magickDataset) {
    const letters = magickDataset?.grouped?.hebrewLetters;
    const lookup = {};

    if (!letters || typeof letters !== "object") {
      return lookup;
    }

    Object.entries(letters).forEach(([letterId, entry]) => {
      const entryId = String(entry?.id || letterId || "");

      const idToken = normalizeLetterToken(letterId);
      const canonicalIdToken = HEBREW_LETTER_ALIASES[idToken] || idToken;
      if (canonicalIdToken && !lookup[canonicalIdToken]) {
        lookup[canonicalIdToken] = entryId;
      }

      const nameToken = normalizeLetterToken(entry?.letter?.name);
      const canonicalNameToken = HEBREW_LETTER_ALIASES[nameToken] || nameToken;
      if (canonicalNameToken && !lookup[canonicalNameToken]) {
        lookup[canonicalNameToken] = entryId;
      }
    });

    return lookup;
  }

  function resolveHebrewLetterId(value) {
    const token = normalizeLetterToken(value);
    if (!token) return null;

    const canonical = HEBREW_LETTER_ALIASES[token] || token;
    return state.hebrewLetterIdByToken[canonical] || state.hebrewLetterIdByToken[token] || null;
  }

  function resolvePlanetId(value) {
    const text = normalizeText(value);
    if (!text) return null;

    for (const [key, planetId] of Object.entries(PLANET_NAME_TO_ID)) {
      if (text === key || text.includes(key)) {
        return planetId;
      }
    }

    return null;
  }

  function resolveZodiacId(value) {
    const text = normalizeText(value);
    if (!text) return null;
    for (const [name, zodiacId] of Object.entries(ZODIAC_NAME_TO_ID)) {
      if (text === name || text.includes(name)) {
        return zodiacId;
      }
    }
    return null;
  }

  function findPathByHebrewToken(tree, hebrewToken) {
    const canonicalToken = HEBREW_LETTER_ALIASES[normalizeLetterToken(hebrewToken)] || normalizeLetterToken(hebrewToken);
    if (!canonicalToken) {
      return null;
    }

    const paths = Array.isArray(tree?.paths) ? tree.paths : [];
    return paths.find((path) => {
      const letterToken = normalizeLetterToken(path?.hebrewLetter?.transliteration || path?.hebrewLetter?.char);
      const canonicalLetterToken = HEBREW_LETTER_ALIASES[letterToken] || letterToken;
      return canonicalLetterToken === canonicalToken;
    }) || null;
  }

  function getDetailRenderContext(tree, elements, extra = {}) {
    return {
      tree,
      elements,
      godsData: state.godsData,
      fourWorldLayers: state.fourWorldLayers,
      resolvePlanetId,
      resolveZodiacId,
      resolveHebrewLetterId,
      findPathByHebrewToken,
      ...extra
    };
  }

  function clearHighlights() {
    document.querySelectorAll(".kab-node, .kab-node-glow")
      .forEach(el => el.classList.remove("kab-node-active"));
    document.querySelectorAll(".kab-path-hit, .kab-path-line, .kab-path-lbl, .kab-path-tarot, .kab-rose-petal")
      .forEach(el => el.classList.remove("kab-path-active"));
  }

  function renderSephiraDetailIntoElements(seph, tree, elements, options = {}) {
    if (typeof kabbalahDetailUi.renderSephiraDetail === "function") {
      kabbalahDetailUi.renderSephiraDetail(getDetailRenderContext(tree, elements, {
        seph,
        onPathSelect: typeof options.onPathSelect === "function"
          ? options.onPathSelect
          : null
      }));
    }
  }

  function renderPathDetailIntoElements(path, tree, elements) {
    if (typeof kabbalahDetailUi.renderPathDetail === "function") {
      kabbalahDetailUi.renderPathDetail(getDetailRenderContext(tree, elements, {
        path,
        activeHebrewToken: normalizeLetterToken(path?.hebrewLetter?.transliteration || path?.hebrewLetter?.char || "")
      }));
    }
  }

  function renderWorldLayerDetailIntoElements(worldLayer, tree, elements, worldIndex) {
    if (typeof kabbalahDetailUi.renderWorldLayerDetail === "function") {
      kabbalahDetailUi.renderWorldLayerDetail(getDetailRenderContext(tree, elements, {
        worldLayer,
        worldIndex
      }));
    }
  }

  function openSephiraFromTree(seph) {
    renderSephiraDetail(seph, state.tree, getBrowserDetailElements(getElements()));
    window.TarotSectionStateUi?.setActiveSection?.("kabbalah");
  }

  function openPathFromTree(path) {
    renderPathDetail(path, state.tree, getPathDetailElements(getElements()));
    window.TarotSectionStateUi?.setActiveSection?.("kabbalah-paths");
  }

  function renderSephiraDetail(seph, tree, elements) {
    state.selectedSephiraNumber = Number(seph?.number);
    if (buildSephiraKey(seph?.number) !== "sephira:daath") {
      state.activeNodeKey = buildSephiraKey(seph?.number);
    }

    clearHighlights();
    document.querySelectorAll(`.kab-node[data-sephira="${seph.number}"], .kab-node-glow[data-sephira="${seph.number}"]`)
      .forEach(el => el.classList.add("kab-node-active"));

    const allElements = getElements();
    const treeElements = getTreeDetailElements(allElements);
    const browserElements = getBrowserDetailElements(allElements);

    if (treeElements?.detailBodyEl) {
      renderSephiraDetailIntoElements(seph, tree, treeElements, {
        onPathSelect: (path) => renderPathDetail(path, tree, treeElements)
      });
    }

    if (browserElements?.detailBodyEl) {
      renderSephiraDetailIntoElements(seph, tree, browserElements, {
        onPathSelect: (path) => {
          document.dispatchEvent(new CustomEvent("nav:kabbalah-path", {
            detail: { pathNo: Number(path?.pathNumber) }
          }));
        }
      });
    }

    syncDetailNavigation();
    syncBrowserDetailNavigation();
    syncBrowserListSelection();
  }

  function renderPathDetail(path, tree, elements) {
    state.selectedPathNumber = Number(path?.pathNumber);
    state.activeNodeKey = buildPathKey(path?.pathNumber);

    clearHighlights();
    document.querySelectorAll(`[data-path="${path.pathNumber}"]`)
      .forEach(el => el.classList.add("kab-path-active"));

    const allElements = getElements();
    const treeElements = getTreeDetailElements(allElements);
    const pathElements = getPathDetailElements(allElements);
    const roseElements = getRoseDetailElements(allElements);

    if (treeElements?.detailBodyEl) {
      renderPathDetailIntoElements(path, tree, treeElements);
    }

    if (pathElements?.detailBodyEl) {
      renderPathDetailIntoElements(path, tree, pathElements);
    }

    if (roseElements?.detailBodyEl) {
      renderPathDetailIntoElements(path, tree, roseElements);
    }

    syncDetailNavigation();
    syncPathsDetailNavigation();
    syncRoseDetailNavigation();
    syncPathsListSelection();
    syncBrowserListSelection();
  }

  function renderWorldLayerDetail(worldLayer, worldIndex, tree, elements) {
    state.selectedWorldLayerIndex = Number(worldIndex);

    const worldElements = getWorldDetailElements(getElements());
    if (worldElements?.detailBodyEl) {
      renderWorldLayerDetailIntoElements(worldLayer, tree, worldElements, worldIndex);
    }

    syncWorldDetailNavigation();
    syncWorldListSelection();
  }


  function renderRoseLandingIntro(roseElements) {
    if (typeof kabbalahDetailUi.renderRoseLandingIntro === "function") {
      kabbalahDetailUi.renderRoseLandingIntro(roseElements);
    }
  }

  function renderBrowserCurrentSelection(elements) {
    if (!state.tree) {
      return;
    }

    const browserElements = getBrowserDetailElements(elements);
    if (!browserElements?.detailBodyEl) {
      return;
    }

    const selectedSephira = getSephiraByNumber(state.selectedSephiraNumber);
    if (selectedSephira) {
      renderSephiraDetail(selectedSephira, state.tree, browserElements);
      return;
    }

    const fallbackSephira = getSephiraByNumber(getSephirotSequenceEntries()[0]?.number);
    if (fallbackSephira) {
      renderSephiraDetail(fallbackSephira, state.tree, browserElements);
    }
  }

  function renderPathsCurrentSelection(elements) {
    if (!state.tree) {
      return;
    }

    const pathElements = getPathDetailElements(elements);
    if (!pathElements?.detailBodyEl) {
      return;
    }

    if (hasFiniteSelectionNumber(state.selectedPathNumber)) {
      const selectedPath = getPathByNumber(state.selectedPathNumber);
      if (selectedPath) {
        renderPathDetail(selectedPath, state.tree, pathElements);
        return;
      }
    }

    const fallbackPath = getPathByNumber(getPathSequenceEntries()[0]?.number);
    if (fallbackPath) {
      renderPathDetail(fallbackPath, state.tree, pathElements);
    }
  }

  function renderWorldCurrentSelection(elements) {
    const worldElements = getWorldDetailElements(elements);
    if (!worldElements?.detailBodyEl) {
      return;
    }

    const selectedWorld = getWorldLayerByIndex(state.selectedWorldLayerIndex);
    if (selectedWorld) {
      renderWorldLayerDetail(selectedWorld, state.selectedWorldLayerIndex, state.tree, worldElements);
      return;
    }

    const fallbackWorld = getWorldLayerByIndex(0);
    if (fallbackWorld) {
      renderWorldLayerDetail(fallbackWorld, 0, state.tree, worldElements);
    }
  }

  // Path labels can show the same astrology glyphs the cube's edges use.
  function getPathAstrologySymbol(path) {
    const astrology = path?.astrology || {};
    return window.AstroSymbols?.get?.(astrology.type, astrology.name) || "";
  }

  function getViewRenderContext(elements) {
    return {
      state,
      tree: state.tree,
      elements,
      getPathAstrologySymbol,
      getRoseDetailElements,
      renderSephiraDetail,
      renderPathDetail,
      openSephiraFromTree,
      openPathFromTree,
      NS,
      R,
      NODE_POS,
      SEPH_FILL,
      DARK_TEXT,
      DAAT,
      PATH_MARKER_SCALE,
      PATH_LABEL_FONT_SIZE,
      PATH_TAROT_WIDTH,
      PATH_TAROT_HEIGHT,
      PATH_LABEL_OFFSET_WITH_TAROT,
      PATH_TAROT_OFFSET_WITH_LABEL,
      PATH_TAROT_OFFSET_NO_LABEL
    };
  }

  function renderRoseCurrentSelection(elements) {
    if (!state.tree) {
      return;
    }

    const roseElements = getRoseDetailElements(elements);
    if (!roseElements?.detailBodyEl) {
      return;
    }

    if (hasFiniteSelectionNumber(state.selectedPathNumber)) {
      const selectedPath = getPathByNumber(state.selectedPathNumber);
      if (selectedPath) {
        renderPathDetail(selectedPath, state.tree, roseElements);
        return;
      }
    }

    renderRoseLandingIntro(roseElements);
    syncRoseDetailNavigation(elements);
  }

  function renderRoseCross(elements) {
    kabbalahViewsUi.renderRoseCross(getViewRenderContext(elements));
  }

  function renderTree(elements) {
    kabbalahViewsUi.renderTree(getViewRenderContext(elements));
  }

  function isExportFormatSupported(format) {
    const exportFormat = TREE_EXPORT_FORMATS[format];
    if (!exportFormat) {
      return false;
    }

    if (format === "webp" && typeof webpExportSupported === "boolean") {
      return webpExportSupported;
    }

    const probeCanvas = document.createElement("canvas");
    const dataUrl = probeCanvas.toDataURL(exportFormat.mimeType);
    const isSupported = dataUrl.startsWith(`data:${exportFormat.mimeType}`);
    if (format === "webp") {
      webpExportSupported = isSupported;
    }
    return isSupported;
  }

  function syncExportControls(elements) {
    if (!(elements?.treeExportWebpEl instanceof HTMLButtonElement)) {
      return;
    }

    const supportsWebp = isExportFormatSupported("webp");
    elements.treeExportWebpEl.hidden = !supportsWebp;
    elements.treeExportWebpEl.disabled = Boolean(state.exportInProgress) || !supportsWebp;
    elements.treeExportWebpEl.textContent = state.exportInProgress && state.exportFormat === "webp"
      ? "Exporting..."
      : "Export WebP";

    if (supportsWebp) {
      elements.treeExportWebpEl.title = "Download the current Tree of Life view as a WebP image.";
    }
  }

  function copyComputedStyles(sourceEl, targetEl) {
    if (!(sourceEl instanceof Element) || !(targetEl instanceof Element)) {
      return;
    }

    const computedStyle = window.getComputedStyle(sourceEl);
    Array.from(computedStyle).forEach((propertyName) => {
      targetEl.style.setProperty(
        propertyName,
        computedStyle.getPropertyValue(propertyName),
        computedStyle.getPropertyPriority(propertyName)
      );
    });

    targetEl.style.setProperty("animation", "none");
    targetEl.style.setProperty("transition", "none");
  }

  function inlineSvgStyles(sourceNode, targetNode) {
    if (!(sourceNode instanceof Element) || !(targetNode instanceof Element)) {
      return;
    }

    copyComputedStyles(sourceNode, targetNode);

    const sourceChildren = Array.from(sourceNode.children);
    const targetChildren = Array.from(targetNode.children);
    const childCount = Math.min(sourceChildren.length, targetChildren.length);
    for (let index = 0; index < childCount; index += 1) {
      inlineSvgStyles(sourceChildren[index], targetChildren[index]);
    }
  }

  function absolutizeSvgImageLinks(svgEl) {
    if (!(svgEl instanceof SVGSVGElement)) {
      return;
    }

    svgEl.querySelectorAll("image").forEach((imageEl) => {
      const href = imageEl.getAttribute("href")
        || imageEl.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (!href) {
        return;
      }

      const absoluteHref = new URL(href, document.baseURI).href;
      imageEl.setAttribute("href", absoluteHref);
      imageEl.setAttributeNS("http://www.w3.org/1999/xlink", "href", absoluteHref);
    });
  }

  function prepareSvgMarkupForExport(svgEl) {
    if (!(svgEl instanceof SVGSVGElement)) {
      throw new Error("Tree view is not ready to export yet.");
    }

    const bounds = svgEl.getBoundingClientRect();
    const viewBox = svgEl.viewBox?.baseVal || null;
    const width = Math.max(
      240,
      Math.round(bounds.width),
      Number.isFinite(viewBox?.width) ? Math.round(viewBox.width) : 0
    );
    const height = Math.max(
      470,
      Math.round(bounds.height),
      Number.isFinite(viewBox?.height) ? Math.round(viewBox.height) : 0
    );

    const clone = svgEl.cloneNode(true);
    if (!(clone instanceof SVGSVGElement)) {
      throw new Error("Tree export could not clone the current SVG view.");
    }

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    inlineSvgStyles(svgEl, clone);
    absolutizeSvgImageLinks(clone);

    const backgroundRect = document.createElementNS(NS, "rect");
    backgroundRect.setAttribute("x", "0");
    backgroundRect.setAttribute("y", "0");
    backgroundRect.setAttribute("width", "100%");
    backgroundRect.setAttribute("height", "100%");
    backgroundRect.setAttribute("fill", TREE_EXPORT_BACKGROUND);
    backgroundRect.setAttribute("pointer-events", "none");
    clone.insertBefore(backgroundRect, clone.firstChild);

    return {
      width,
      height,
      markup: new XMLSerializer().serializeToString(clone)
    };
  }

  function loadSvgImage(markup) {
    return new Promise((resolve, reject) => {
      const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();

      image.decoding = "async";
      image.onload = () => {
        URL.revokeObjectURL(svgUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("Tree export renderer could not load the current SVG view."));
      };
      image.src = svgUrl;
    });
  }

  function canvasToBlobByFormat(canvas, format) {
    const exportFormat = TREE_EXPORT_FORMATS[format];
    if (!exportFormat) {
      return Promise.reject(new Error("Unsupported export format."));
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Canvas export failed."));
      }, exportFormat.mimeType, exportFormat.quality);
    });
  }

  async function exportTreeView(format = "webp") {
    const exportFormat = TREE_EXPORT_FORMATS[format];
    if (!exportFormat || state.exportInProgress) {
      return;
    }

    const elements = getElements();
    const svgEl = elements.treeContainerEl?.querySelector("svg.kab-svg");
    if (!(svgEl instanceof SVGSVGElement)) {
      window.alert("Tree view is not ready to export yet.");
      return;
    }

    state.exportInProgress = true;
    state.exportFormat = format;
    syncExportControls(elements);

    try {
      const { width, height, markup } = prepareSvgMarkupForExport(svgEl);
      const image = await loadSvgImage(markup);
      const scale = Math.max(2, Math.min(4, Number(window.devicePixelRatio) || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(width * scale));
      canvas.height = Math.max(1, Math.ceil(height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context is unavailable.");
      }

      context.scale(scale, scale);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = TREE_EXPORT_BACKGROUND;
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const blob = await canvasToBlobByFormat(canvas, format);
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      downloadLink.href = blobUrl;
      downloadLink.download = `tree-of-life-${stamp}.${exportFormat.extension}`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to export the current Tree of Life view.");
    } finally {
      state.exportInProgress = false;
      state.exportFormat = "";
      syncExportControls(getElements());
    }
  }

  function renderCurrentSelection(elements) {
    if (!state.tree) {
      return;
    }

    const activeNodeKey = String(state.activeNodeKey || "").trim();
    if (activeNodeKey.startsWith("path:")) {
      const selectedPath = getPathByNumber(Number(activeNodeKey.split(":")[1]));
      if (selectedPath) {
        renderPathDetail(selectedPath, state.tree, elements);
        return;
      }
    }

    if (activeNodeKey.startsWith("sephira:") && !activeNodeKey.endsWith(":daath")) {
      const selectedSephira = getSephiraByNumber(Number(activeNodeKey.split(":")[1]));
      if (selectedSephira) {
        renderSephiraDetail(selectedSephira, state.tree, elements);
        return;
      }
    }

    renderSephiraDetail(state.tree.sephiroth[0], state.tree, elements);
  }

  function renderVisibleKabbalahViews(elements = getElements()) {
    renderBrowserList(elements);
    renderWorldsList(elements);
    renderPathsList(elements);

    if (elements.browserSectionEl && elements.browserSectionEl.hidden === false) {
      renderBrowserCurrentSelection(elements);
    } else {
      syncBrowserListSelection(elements);
      syncBrowserDetailNavigation(elements);
    }

    if (elements.worldsSectionEl && elements.worldsSectionEl.hidden === false) {
      renderWorldCurrentSelection(elements);
    } else {
      syncWorldListSelection(elements);
      syncWorldDetailNavigation(elements);
    }

    if (elements.pathsSectionEl && elements.pathsSectionEl.hidden === false) {
      renderPathsCurrentSelection(elements);
    } else {
      syncPathsListSelection(elements);
      syncPathsDetailNavigation(elements);
    }

    if (elements.crossSectionEl && elements.crossSectionEl.hidden === false) {
      renderRoseCross(elements);
      renderRoseCurrentSelection(elements);
    } else {
      syncRoseDetailNavigation(elements);
    }

    if (elements.sectionEl && elements.sectionEl.hidden === false) {
      renderTree(elements);
    } else {
      syncDetailNavigation(elements);
    }
  }

  // ─── initialise section ──────────────────────────────────────────────────────
  function init(magickDataset, elements) {
    const tree = magickDataset?.grouped?.kabbalah?.["kabbalah-tree"];
    if (!tree) {
      if (elements.treeContainerEl) {
        elements.treeContainerEl.textContent = "Could not load kabbalah-tree.json";
      }
      if (elements.browserDetailNameEl) {
        elements.browserDetailNameEl.textContent = "Kabbalah data unavailable";
      }
      return;
    }
    state.tree = tree;
    state.godsData = magickDataset?.grouped?.["gods"]?.byPath || {};
    state.hebrewLetterIdByToken = buildHebrewLetterLookup(magickDataset);
    state.fourWorldLayers = buildFourWorldLayersFromDataset(magickDataset);
    if (!hasFiniteSelectionNumber(state.selectedWorldLayerIndex)
      || Number(state.selectedWorldLayerIndex) < 0
      || Number(state.selectedWorldLayerIndex) >= state.fourWorldLayers.length) {
      state.selectedWorldLayerIndex = 0;
    }
    if (!hasFiniteSelectionNumber(state.selectedSephiraNumber)) {
      state.selectedSephiraNumber = Number(state.tree.sephiroth[0]?.number || 1);
    }
    if (!String(state.activeNodeKey || "").trim()) {
      state.activeNodeKey = buildSephiraKey(state.selectedSephiraNumber);
    }

    const bindPathDisplayToggle = (toggleEl, stateKey) => {
      if (!toggleEl) {
        return;
      }

      toggleEl.checked = Boolean(state[stateKey]);
      if (toggleEl.dataset.bound) {
        return;
      }

      toggleEl.addEventListener("change", () => {
        state[stateKey] = Boolean(toggleEl.checked);
        renderTree(elements);
        renderCurrentSelection(elements);
      });

      toggleEl.dataset.bound = "true";
    };

    bindPathDisplayToggle(elements.treeSephiraToggleEl, "showSephirot");
    bindPathDisplayToggle(elements.treePathsToggleEl, "showPaths");
    bindPathDisplayToggle(elements.pathLetterToggleEl, "showPathLetters");
    bindPathDisplayToggle(elements.pathNumberToggleEl, "showPathNumbers");
    bindPathDisplayToggle(elements.pathAstrologyToggleEl, "showPathAstrology");
    bindPathDisplayToggle(elements.pathTarotToggleEl, "showPathTarotCards");
    bindPathDisplayToggle(elements.treeSpinToggleEl, "treeSpin");
    bindDetailNavigation(elements);
    bindBrowserDetailNavigation(elements);
    bindPathsDetailNavigation(elements);
    bindWorldDetailNavigation(elements);
    bindRoseDetailNavigation(elements);
    bindBrowserList(elements);
    bindWorldList(elements);
    bindPathsList(elements);

    syncExportControls(elements);
    if (elements.treeExportWebpEl && !elements.treeExportWebpEl.dataset.bound) {
      elements.treeExportWebpEl.addEventListener("click", () => {
        void exportTreeView("webp");
      });
      elements.treeExportWebpEl.dataset.bound = "true";
    }

    renderVisibleKabbalahViews(elements);
  }

  function selectPathByNumber(pathNumber) {
    if (!state.initialized || !state.tree) return;
    const el = getElements();
    const path = getPathByNumber(pathNumber);
    if (path) renderPathDetail(path, state.tree, el);
  }

  function selectSephiraByNumber(n) {
    if (!state.initialized || !state.tree) return;
    const el = getElements();
    const seph = getSephiraByNumber(n);
    if (seph) renderSephiraDetail(seph, state.tree, el);
  }

  // select sephirah (1-10) or path (11+) by a single number
  function selectNode(n) {
    if (isDaathToken(n) || Number(n) === 0) selectSephiraByNumber(0);
    else if (n >= 1 && n <= 10) selectSephiraByNumber(n);
    else selectPathByNumber(n);
  }

  // ─── public API ────────────────────────────────────────────────────────
  function ensureKabbalahSection(magickDataset) {
    const elements = getElements();
    if (state.initialized) {
      renderVisibleKabbalahViews(elements);
      return;
    }

    state.initialized = true;
    init(magickDataset, elements);
  }

  window.KabbalahSectionUi = { ensureKabbalahSection, selectPathByNumber, selectSephiraByNumber, selectNode };
})();
