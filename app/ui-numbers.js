(function () {
  "use strict";

  let initialized = false;
  let activeNumberValue = 0;
  let activeNumbersView = "browse";
  let sectionChangeListenerBound = false;
  let config = {
    getReferenceData: () => null,
    getMagickDataset: () => null,
    ensureTarotSection: null,
    getActiveSection: () => "home",
    setActiveSection: null
  };

  const numbersDetailUi = window.NumbersDetailUi || {};

  if (typeof numbersDetailUi.renderNumberDetail !== "function") {
    throw new Error("NumbersDetailUi module must load before ui-numbers.js");
  }

  const DEFAULT_NUMBER_ENTRIES = Array.from({ length: 10 }, (_, value) => ({
    value,
    label: `${value}`,
    opposite: 9 - value,
    digitalRoot: value,
    summary: "",
    keywords: [],
    associations: {
      kabbalahNode: value === 0 ? 10 : value,
      playingSuit: "hearts"
    }
  }));

  const PLAYING_SUIT_SYMBOL = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠"
  };

  const PLAYING_SUIT_LABEL = {
    hearts: "Hearts",
    diamonds: "Diamonds",
    clubs: "Clubs",
    spades: "Spades"
  };

  const PLAYING_SUIT_TO_TAROT = {
    hearts: "Cups",
    diamonds: "Pentacles",
    clubs: "Wands",
    spades: "Swords"
  };

  const PLAYING_RANKS = [
    { rank: "A", rankLabel: "Ace", rankValue: 1 },
    { rank: "2", rankLabel: "Two", rankValue: 2 },
    { rank: "3", rankLabel: "Three", rankValue: 3 },
    { rank: "4", rankLabel: "Four", rankValue: 4 },
    { rank: "5", rankLabel: "Five", rankValue: 5 },
    { rank: "6", rankLabel: "Six", rankValue: 6 },
    { rank: "7", rankLabel: "Seven", rankValue: 7 },
    { rank: "8", rankLabel: "Eight", rankValue: 8 },
    { rank: "9", rankLabel: "Nine", rankValue: 9 },
    { rank: "10", rankLabel: "Ten", rankValue: 10 },
    { rank: "J", rankLabel: "Jack", rankValue: null },
    { rank: "Q", rankLabel: "Queen", rankValue: null },
    { rank: "K", rankLabel: "King", rankValue: null }
  ];

  const TAROT_RANK_NUMBER_MAP = {
    ace: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10
  };

  function getReferenceData() {
    return typeof config.getReferenceData === "function" ? config.getReferenceData() : null;
  }

  function getMagickDataset() {
    return typeof config.getMagickDataset === "function" ? config.getMagickDataset() : null;
  }

  function getActiveSection() {
    return typeof config.getActiveSection === "function"
      ? config.getActiveSection()
      : "home";
  }

  function getElements() {
    return {
      countEl: document.getElementById("numbers-count"),
      listEl: document.getElementById("numbers-list"),
      detailNameEl: document.getElementById("numbers-detail-name"),
      detailTypeEl: document.getElementById("numbers-detail-type"),
      detailSummaryEl: document.getElementById("numbers-detail-summary"),
      detailBodyEl: document.getElementById("numbers-detail-body"),
      openNumbersBrowseEl: document.getElementById("open-numbers-browse"),
      openNumbersTheoryEl: document.getElementById("open-numbers-theory")
    };
  }

  function normalizeNumbersView(value) {
    return value === "theory" ? "theory" : "browse";
  }

  function applyNumbersViewUiState() {
    const { openNumbersBrowseEl, openNumbersTheoryEl } = getElements();
    const isNumbersSectionActive = getActiveSection() === "numbers";

    if (openNumbersBrowseEl) {
      openNumbersBrowseEl.classList.toggle("is-active", isNumbersSectionActive && activeNumbersView === "browse");
    }

    if (openNumbersTheoryEl) {
      openNumbersTheoryEl.classList.toggle("is-active", isNumbersSectionActive && activeNumbersView === "theory");
    }
  }

  function normalizeNumberValue(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    const normalized = Math.trunc(parsed);
    if (normalized < 0) {
      return 0;
    }
    if (normalized > 9) {
      return 9;
    }
    return normalized;
  }

  function normalizeNumberEntry(rawEntry) {
    if (!rawEntry || typeof rawEntry !== "object") {
      return null;
    }

    const value = normalizeNumberValue(rawEntry.value);
    const oppositeRaw = Number(rawEntry.opposite);
    const opposite = Number.isFinite(oppositeRaw)
      ? normalizeNumberValue(oppositeRaw)
      : (9 - value);
    const digitalRootRaw = Number(rawEntry.digitalRoot);
    const digitalRoot = Number.isFinite(digitalRootRaw)
      ? normalizeNumberValue(digitalRootRaw)
      : value;
    const kabbalahNodeRaw = Number(rawEntry?.associations?.kabbalahNode);
    const kabbalahNode = Number.isFinite(kabbalahNodeRaw)
      ? Math.max(1, Math.trunc(kabbalahNodeRaw))
      : (value === 0 ? 10 : value);
    const tarotTrumpNumbersRaw = Array.isArray(rawEntry?.associations?.tarotTrumpNumbers)
      ? rawEntry.associations.tarotTrumpNumbers
      : [];
    const tarotTrumpNumbers = Array.from(new Set(
      tarotTrumpNumbersRaw
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item))
        .map((item) => Math.trunc(item))
    ));
    const playingSuitRaw = String(rawEntry?.associations?.playingSuit || "").trim().toLowerCase();
    const playingSuit = ["hearts", "diamonds", "clubs", "spades"].includes(playingSuitRaw)
      ? playingSuitRaw
      : "hearts";

    return {
      value,
      label: String(rawEntry.label || value),
      opposite,
      digitalRoot,
      summary: String(rawEntry.summary || ""),
      keywords: Array.isArray(rawEntry.keywords)
        ? rawEntry.keywords.map((keyword) => String(keyword || "").trim()).filter(Boolean)
        : [],
      associations: {
        kabbalahNode,
        tarotTrumpNumbers,
        playingSuit
      }
    };
  }

  function getNumbersDatasetEntries() {
    const numbersData = getMagickDataset()?.grouped?.numbers;
    const rawEntries = Array.isArray(numbersData)
      ? numbersData
      : (Array.isArray(numbersData?.entries) ? numbersData.entries : []);

    const normalizedEntries = rawEntries
      .map((entry) => normalizeNumberEntry(entry))
      .filter(Boolean)
      .sort((left, right) => left.value - right.value);

    return normalizedEntries.length
      ? normalizedEntries
      : DEFAULT_NUMBER_ENTRIES;
  }

  function getNumberEntryByValue(value) {
    const entries = getNumbersDatasetEntries();
    const normalized = normalizeNumberValue(value);
    return entries.find((entry) => entry.value === normalized) || entries[0] || null;
  }

  function computeDigitalRoot(value) {
    let current = Math.abs(Math.trunc(Number(value)));
    if (!Number.isFinite(current)) {
      return null;
    }
    while (current >= 10) {
      current = String(current)
        .split("")
        .reduce((sum, digit) => sum + Number(digit), 0);
    }
    return current;
  }

  function rankLabelToTarotMinorRank(rankLabel) {
    const key = String(rankLabel || "").trim().toLowerCase();
    if (key === "10" || key === "ten") return "Princess";
    if (key === "j" || key === "jack") return "Prince";
    if (key === "q" || key === "queen") return "Queen";
    if (key === "k" || key === "king") return "Knight";
    return String(rankLabel || "").trim();
  }

  function renderNumbersList() {
    const { listEl, countEl } = getElements();
    if (!listEl) {
      return;
    }

    const entries = getNumbersDatasetEntries();
    if (!entries.some((entry) => entry.value === activeNumberValue)) {
      activeNumberValue = entries[0]?.value ?? 0;
    }

    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `list-item${entry.value === activeNumberValue ? " is-selected" : ""}`;
      button.dataset.numberValue = String(entry.value);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", entry.value === activeNumberValue ? "true" : "false");

      const nameEl = document.createElement("span");
      nameEl.className = "list-name";
      nameEl.textContent = `${entry.label}`;

      const metaEl = document.createElement("span");
      metaEl.className = "list-meta";
      metaEl.textContent = `Opposite ${entry.opposite}`;

      button.append(nameEl, metaEl);
      fragment.appendChild(button);
    });

    listEl.replaceChildren(fragment);
    if (countEl) {
      countEl.textContent = `${entries.length} entries`;
    }
  }

  function getDetailRenderContext(value) {
    return {
      value,
      elements: getElements(),
      getReferenceData,
      getMagickDataset,
      getNumberEntryByValue,
      normalizeNumberValue,
      computeDigitalRoot,
      rankLabelToTarotMinorRank,
      ensureTarotSection: config.ensureTarotSection,
      activeNumbersView,
      selectNumberEntry,
      PLAYING_SUIT_SYMBOL,
      PLAYING_SUIT_LABEL,
      PLAYING_SUIT_TO_TAROT,
      PLAYING_RANKS,
      TAROT_RANK_NUMBER_MAP
    };
  }

  function renderNumberDetail(value) {
    numbersDetailUi.renderNumberDetail(getDetailRenderContext(value));
  }

  function selectNumberEntry(value) {
    const entry = getNumberEntryByValue(value);
    activeNumberValue = entry ? entry.value : 0;
    renderNumbersList();
    renderNumberDetail(activeNumberValue);
  }

  function ensureNumbersSection() {
    const { listEl } = getElements();
    if (!listEl) {
      applyNumbersViewUiState();
      return;
    }

    if (!initialized) {
      listEl.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Node)) {
          return;
        }
        const button = target instanceof Element
          ? target.closest(".list-item")
          : null;
        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        const value = Number(button.dataset.numberValue);
        if (!Number.isFinite(value)) {
          return;
        }
        selectNumberEntry(value);
      });

      initialized = true;
    }

    renderNumbersList();
    renderNumberDetail(activeNumberValue);
    applyNumbersViewUiState();
  }

  function setNumbersView(view, openNumbersSection = false) {
    activeNumbersView = normalizeNumbersView(view);

    if (openNumbersSection && typeof config.setActiveSection === "function") {
      config.setActiveSection("numbers");
    }

    if (getActiveSection() === "numbers" || openNumbersSection) {
      ensureNumbersSection();
      const { detailBodyEl } = getElements();
      if (detailBodyEl instanceof HTMLElement) {
        detailBodyEl.scrollTop = 0;
      }
    } else {
      applyNumbersViewUiState();
    }
  }

  function showBrowseView(openNumbersSection = false) {
    setNumbersView("browse", openNumbersSection);
  }

  function showTheoryView(openNumbersSection = false) {
    setNumbersView("theory", openNumbersSection);
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig
    };

    if (!sectionChangeListenerBound) {
      document.addEventListener("section:changed", () => {
        applyNumbersViewUiState();
      });
      sectionChangeListenerBound = true;
    }

    applyNumbersViewUiState();
  }

  window.TarotNumbersUi = {
    ...(window.TarotNumbersUi || {}),
    init,
    ensureNumbersSection,
    selectNumberEntry,
    normalizeNumberValue,
    showBrowseView,
    showTheoryView,
    getActiveView() {
      return activeNumbersView;
    }
  };
})();
