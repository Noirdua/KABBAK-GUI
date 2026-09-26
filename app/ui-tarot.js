(function () {
  const dataService = window.TarotDataService || {};
  const {
    resolveTarotCardImage,
    resolveTarotCardThumbnail,
    getTarotCardDisplayName,
    getTarotCardSearchAliases,
    getDeckOptions,
    getActiveDeck
  } = window.TarotCardImages || {};
  const tarotHouseUi = window.TarotHouseUi || {};
  const tarotRelationsUi = window.TarotRelationsUi || {};
  const tarotCardDerivations = window.TarotCardDerivations || {};
  const tarotDetailUi = window.TarotDetailUi || {};
  const tarotRelationDisplay = window.TarotRelationDisplay || {};

  const state = {
    initialized: false,
    cards: [],
    filteredCards: [],
    searchQuery: "",
    selectedCardId: "",
    houseFocusMode: false,
    houseTopCardsVisible: true,
    houseTopInfoModes: {
      hebrew: true,
      planet: true,
      zodiac: true,
      trump: true,
      path: true,
      date: false
    },
    houseBottomCardsVisible: true,
    houseBottomInfoModes: {
      zodiac: true,
      decan: true,
      month: true,
      ruler: true,
      date: false
    },
    houseExportInProgress: false,
    houseExportFormat: "png",

    magickDataset: null,
    referenceData: null,
    monthRefsByCardId: new Map(),
    courtCardByDecanId: new Map(),
    cardVariantCounts: new Map(),
    loadingPromise: null
  };
  let detailNavigator = null;
  let lastRenderedDeckId = "";

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

  const MINOR_NUMBER_WORD_BY_VALUE = {
    1: "ace",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten"
  };

  const HEBREW_LETTER_ALIASES = {
    aleph: "alef",
    alef: "alef",
    heh: "he",
    he: "he",
    beth: "bet",
    bet: "bet",
    cheth: "het",
    chet: "het",
    kaph: "kaf",
    kaf: "kaf",
    peh: "pe",
    tzaddi: "tsadi",
    tzadi: "tsadi",
    tsadi: "tsadi",
    qoph: "qof",
    qof: "qof",
    taw: "tav",
    tau: "tav"
  };

  const CUBE_MOTHER_CONNECTOR_BY_LETTER = {
    alef: { connectorId: "above-below", connectorName: "Above ↔ Below" },
    mem: { connectorId: "east-west", connectorName: "East ↔ West" },
    shin: { connectorId: "south-north", connectorName: "South ↔ North" }
  };

  const ELEMENT_NAME_BY_ID = {
    water: "Water",
    fire: "Fire",
    air: "Air",
    earth: "Earth"
  };

  const ELEMENT_HEBREW_LETTER_BY_ID = {
    fire: "Yod",
    water: "Heh",
    air: "Vav",
    earth: "Heh"
  };

  const ELEMENT_HEBREW_CHAR_BY_ID = {
    fire: "י",
    water: "ה",
    air: "ו",
    earth: "ה"
  };

  const HEBREW_LETTER_ID_BY_TETRAGRAMMATON_LETTER = {
    yod: "yod",
    heh: "he",
    vav: "vav"
  };

  const ACE_ELEMENT_BY_CARD_NAME = {
    "ace of cups": "water",
    "ace of wands": "fire",
    "ace of swords": "air",
    "ace of disks": "earth"
  };

  const COURT_ELEMENT_BY_RANK = {
    knight: "fire",
    queen: "water",
    prince: "air",
    princess: "earth"
  };

  const SUIT_ELEMENT_BY_SUIT = {
    wands: "fire",
    cups: "water",
    swords: "air",
    disks: "earth"
  };

  const MINOR_RANK_NUMBER_BY_NAME = {
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

  const SMALL_CARD_SIGN_BY_MODALITY_AND_SUIT = {
    cardinal: {
      wands: "aries",
      cups: "cancer",
      swords: "libra",
      disks: "capricorn"
    },
    fixed: {
      wands: "leo",
      cups: "scorpio",
      swords: "aquarius",
      disks: "taurus"
    },
    mutable: {
      wands: "sagittarius",
      cups: "pisces",
      swords: "gemini",
      disks: "virgo"
    }
  };

  const MINOR_PLURAL_BY_RANK = {
    ace: "aces",
    two: "twos",
    three: "threes",
    four: "fours",
    five: "fives",
    six: "sixes",
    seven: "sevens",
    eight: "eights",
    nine: "nines",
    ten: "tens"
  };

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function cardId(card) {
    const suitPart = card.suit ? `-${slugify(card.suit)}` : "";
    return `${slugify(card.arcana)}${suitPart}-${slugify(card.name)}`;
  }

  function getElements() {
    return {
      tarotSectionEl: document.getElementById("tarot-section"),
      tarotHouseSectionEl: document.getElementById("tarot-house-section"),
      tarotCardListEl: document.getElementById("tarot-card-list"),
      tarotSearchInputEl: document.getElementById("tarot-search-input"),
      tarotSearchClearEl: document.getElementById("tarot-search-clear"),
      tarotCountEl: document.getElementById("tarot-card-count"),
      tarotDetailImageEl: document.getElementById("tarot-detail-image"),
      tarotDetailNameEl: document.getElementById("tarot-detail-name"),
      tarotDetailTypeEl: document.getElementById("tarot-detail-type"),
      tarotDetailPrevEl: document.getElementById("tarot-detail-prev"),
      tarotDetailPositionEl: document.getElementById("tarot-detail-position"),
      tarotDetailNextEl: document.getElementById("tarot-detail-next"),
      tarotDetailSummaryEl: document.getElementById("tarot-detail-summary"),
      tarotDetailUprightEl: document.getElementById("tarot-detail-upright"),
      tarotDetailReversedEl: document.getElementById("tarot-detail-reversed"),
      tarotMetaDeckGalleryCardEl: document.getElementById("tarot-meta-deck-gallery-card"),
      tarotDetailDeckGalleryEl: document.getElementById("tarot-detail-deck-gallery"),
      tarotMetaMeaningCardEl: document.getElementById("tarot-meta-meaning-card"),
      tarotDetailMeaningEl: document.getElementById("tarot-detail-meaning"),
      tarotDetailKeywordsEl: document.getElementById("tarot-detail-keywords"),
      tarotMetaPlanetCardEl: document.getElementById("tarot-meta-planet-card"),
      tarotMetaElementCardEl: document.getElementById("tarot-meta-element-card"),
      tarotMetaTetragrammatonCardEl: document.getElementById("tarot-meta-tetragrammaton-card"),
      tarotMetaZodiacCardEl: document.getElementById("tarot-meta-zodiac-card"),
      tarotMetaCourtDateCardEl: document.getElementById("tarot-meta-courtdate-card"),
      tarotMetaHebrewCardEl: document.getElementById("tarot-meta-hebrew-card"),
      tarotMetaCubeCardEl: document.getElementById("tarot-meta-cube-card"),
      tarotMetaIChingCardEl: document.getElementById("tarot-meta-iching-card"),
      tarotMetaCalendarCardEl: document.getElementById("tarot-meta-calendar-card"),
      tarotDetailPlanetEl: document.getElementById("tarot-detail-planet"),
      tarotDetailElementEl: document.getElementById("tarot-detail-element"),
      tarotDetailTetragrammatonEl: document.getElementById("tarot-detail-tetragrammaton"),
      tarotDetailZodiacEl: document.getElementById("tarot-detail-zodiac"),
      tarotDetailCourtDateEl: document.getElementById("tarot-detail-courtdate"),
      tarotDetailHebrewEl: document.getElementById("tarot-detail-hebrew"),
      tarotDetailCubeEl: document.getElementById("tarot-detail-cube"),
      tarotDetailIChingEl: document.getElementById("tarot-detail-iching"),
      tarotDetailCalendarEl: document.getElementById("tarot-detail-calendar"),
      tarotKabPathEl: document.getElementById("tarot-kab-path"),
      tarotHouseOfCardsEl: document.getElementById("tarot-house-of-cards"),
      tarotBrowseViewEl: document.getElementById("tarot-browse-view"),
      tarotHouseViewEl: document.getElementById("tarot-house-view"),
      tarotHouseSettingsToggleEl: document.getElementById("tarot-house-settings-toggle"),
      tarotHouseSettingsPanelEl: document.getElementById("tarot-house-settings-panel"),
      tarotHouseTopCardsVisibleEl: document.getElementById("tarot-house-top-cards-visible"),
      tarotHouseTopInfoHebrewEl: document.getElementById("tarot-house-top-info-hebrew"),
      tarotHouseTopInfoPlanetEl: document.getElementById("tarot-house-top-info-planet"),
      tarotHouseTopInfoZodiacEl: document.getElementById("tarot-house-top-info-zodiac"),
      tarotHouseTopInfoTrumpEl: document.getElementById("tarot-house-top-info-trump"),
      tarotHouseTopInfoPathEl: document.getElementById("tarot-house-top-info-path"),
      tarotHouseTopInfoDateEl: document.getElementById("tarot-house-top-info-date"),
      tarotHouseBottomCardsVisibleEl: document.getElementById("tarot-house-bottom-cards-visible"),
      tarotHouseBottomInfoZodiacEl: document.getElementById("tarot-house-bottom-info-zodiac"),
      tarotHouseBottomInfoDecanEl: document.getElementById("tarot-house-bottom-info-decan"),
      tarotHouseBottomInfoMonthEl: document.getElementById("tarot-house-bottom-info-month"),
      tarotHouseBottomInfoRulerEl: document.getElementById("tarot-house-bottom-info-ruler"),
      tarotHouseBottomInfoDateEl: document.getElementById("tarot-house-bottom-info-date"),
      tarotHouseExportWebpEl: document.getElementById("tarot-house-export-webp")
    };
  }

  function setHouseBottomInfoCheckboxState(checkbox, enabled) {
    if (!checkbox) {
      return;
    }
    checkbox.checked = Boolean(enabled);
    checkbox.disabled = Boolean(state.houseExportInProgress);
  }

  function normalizeRelationId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  if (typeof tarotRelationDisplay.createTarotRelationDisplay !== "function") {
    throw new Error("TarotRelationDisplay.createTarotRelationDisplay is unavailable. Ensure app/ui-tarot-relation-display.js loads before app/ui-tarot.js.");
  }

  if (typeof tarotCardDerivations.createTarotCardDerivations !== "function") {
    throw new Error("TarotCardDerivations.createTarotCardDerivations is unavailable. Ensure app/ui-tarot-card-derivations.js loads before app/ui-tarot.js.");
  }

  if (typeof tarotDetailUi.createTarotDetailRenderer !== "function") {
    throw new Error("TarotDetailUi.createTarotDetailRenderer is unavailable. Ensure app/ui-tarot-detail.js loads before app/ui-tarot.js.");
  }

  const tarotCardDerivationsUi = tarotCardDerivations.createTarotCardDerivations({
    normalizeRelationId,
    normalizeTarotCardLookupName,
    toTitleCase,
    getReferenceData: () => state.referenceData,
    ELEMENT_NAME_BY_ID,
    ELEMENT_HEBREW_LETTER_BY_ID,
    ELEMENT_HEBREW_CHAR_BY_ID,
    HEBREW_LETTER_ID_BY_TETRAGRAMMATON_LETTER,
    ACE_ELEMENT_BY_CARD_NAME,
    COURT_ELEMENT_BY_RANK,
    MINOR_RANK_NUMBER_BY_NAME,
    SMALL_CARD_SIGN_BY_MODALITY_AND_SUIT,
    MINOR_PLURAL_BY_RANK
  });

  const tarotRelationDisplayUi = tarotRelationDisplay.createTarotRelationDisplay({
    normalizeRelationId
  });

  const tarotDetailRenderer = tarotDetailUi.createTarotDetailRenderer({
    getMonthRefsByCardId: () => state.monthRefsByCardId,
    getMagickDataset: () => state.magickDataset,
    resolveTarotCardImage,
    resolveTarotCardThumbnail,
    getDeckVariantsForCard,
    getCardVariantsForCard,
    openDeckVariantLightbox,
    openCardVariantLightbox,
    getDisplayCardName,
    buildTypeLabel,
    clearChildren,
    normalizeRelationObject,
    buildElementRelationsForCard,
    buildTetragrammatonRelationsForCard,
    buildSmallCardRulershipRelation,
    buildSmallCardCourtLinkRelations,
    buildCubeRelationsForCard,
    buildIChingRelationsForCard,
    parseMonthDayToken,
    createRelationListItem,
    findSephirahForMinorCard
  });

  function normalizeSearchValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeTarotName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function normalizeTarotCardLookupName(value) {
    const text = normalizeTarotName(value)
      .replace(/\b(pentacles?|coins?)\b/g, "disks");

    const match = text.match(/^(\d{1,2})\s+of\s+(.+)$/i);
    if (!match) {
      return text;
    }

    const numeric = Number(match[1]);
    const suit = String(match[2] || "").trim();
    const rankWord = MINOR_NUMBER_WORD_BY_VALUE[numeric];
    if (!rankWord || !suit) {
      return text;
    }

    return `${rankWord} of ${suit}`;
  }

  function getDisplayCardName(cardOrName, trumpNumber) {
    const cardName = typeof cardOrName === "object"
      ? String(cardOrName?.name || "")
      : String(cardOrName || "");

    const resolvedTrumpNumber = typeof cardOrName === "object"
      ? cardOrName?.number
      : trumpNumber;

    if (typeof getTarotCardDisplayName === "function") {
      const display = String(getTarotCardDisplayName(cardName, { trumpNumber: resolvedTrumpNumber }) || "").trim();
      if (display) {
        return display;
      }
    }

    return cardName.trim();
  }

  function toTitleCase(value) {
    return String(value || "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function buildElementRelationsForCard(card, baseElementRelations = []) {
    return tarotCardDerivationsUi.buildElementRelationsForCard(card, baseElementRelations);
  }

  function buildTetragrammatonRelationsForCard(card) {
    return tarotCardDerivationsUi.buildTetragrammatonRelationsForCard(card);
  }

  function buildSmallCardRulershipRelation(card) {
    return tarotCardDerivationsUi.buildSmallCardRulershipRelation(card);
  }

  function buildCourtCardByDecanId(cards) {
    if (typeof tarotRelationsUi.buildCourtCardByDecanId !== "function") {
      return new Map();
    }
    return tarotRelationsUi.buildCourtCardByDecanId(cards);
  }

  function buildSmallCardCourtLinkRelations(card, relations) {
    if (typeof tarotRelationsUi.buildSmallCardCourtLinkRelations !== "function") {
      return [];
    }
    return tarotRelationsUi.buildSmallCardCourtLinkRelations(card, relations, state.courtCardByDecanId);
  }

  function parseMonthDayToken(value) {
    if (typeof tarotRelationsUi.parseMonthDayToken !== "function") {
      return null;
    }
    return tarotRelationsUi.parseMonthDayToken(value);
  }

  function buildMonthReferencesByCard(referenceData, cards) {
    if (typeof tarotRelationsUi.buildMonthReferencesByCard !== "function") {
      return new Map();
    }
    return tarotRelationsUi.buildMonthReferencesByCard(referenceData, cards);
  }

  function relationToSearchText(relation) {
    if (window.TarotSearchText?.relationToSearchText) {
      return window.TarotSearchText.relationToSearchText(relation);
    }

    if (!relation) {
      return "";
    }

    if (typeof relation === "string") {
      return relation;
    }

    const relationParts = [
      relation.label,
      relation.type,
      relation.id,
      relation.data && typeof relation.data === "object"
        ? Object.values(relation.data).join(" ")
        : ""
    ];

    return relationParts.filter(Boolean).join(" ");
  }

  function collectCardLinkRelations(card) {
    const baseRelations = Array.isArray(card?.relations) ? card.relations : [];
    const baseElementRelations = baseRelations.filter((relation) => relation?.type === "element");

    return [
      ...baseRelations,
      buildSmallCardRulershipRelation(card),
      ...buildElementRelationsForCard(card, baseElementRelations),
      ...buildTetragrammatonRelationsForCard(card),
      ...buildCubeRelationsForCard(card),
      ...buildIChingRelationsForCard(card),
      ...buildSmallCardCourtLinkRelations(card, baseRelations)
    ].filter(Boolean);
  }

  function buildCardSearchText(card) {
    if (card?.__searchTextCached) {
      return card.__searchTextCached;
    }

    const displayName = getDisplayCardName(card);
    const tarotAliases = typeof getTarotCardSearchAliases === "function"
      ? getTarotCardSearchAliases(card?.name, { trumpNumber: card?.number })
      : [];
    const linkRelations = collectCardLinkRelations(card);
    const searchTextUi = window.TarotSearchText;

    const text = typeof searchTextUi?.buildSearchText === "function"
      ? searchTextUi.buildSearchText(
        card?.name,
        displayName,
        card?.arcana,
        card?.rank,
        card?.suit,
        card?.summary,
        tarotAliases,
        card?.keywords,
        linkRelations
      )
      : normalizeSearchValue([
        card?.name,
        displayName,
        card?.arcana,
        card?.rank,
        card?.suit,
        card?.summary,
        ...tarotAliases,
        ...(Array.isArray(card?.keywords) ? card.keywords : []),
        ...linkRelations.map(relationToSearchText)
      ].filter(Boolean).join(" "));

    if (card && typeof card === "object") {
      card.__searchTextCached = text;
    }

    return text;
  }

  function applySearchFilter(elements) {
    const query = normalizeSearchValue(state.searchQuery);
    state.filteredCards = query
      ? state.cards.filter((card) => buildCardSearchText(card).includes(query))
      : [...state.cards];

    if (elements?.tarotSearchClearEl) {
      elements.tarotSearchClearEl.disabled = !query;
    }

    renderList(elements);

    if (!state.filteredCards.some((card) => card.id === state.selectedCardId)) {
      if (state.filteredCards.length > 0) {
        selectCardById(state.filteredCards[0].id, elements);
      } else {
        syncDetailNavigation(elements);
      }
      return;
    }

    updateListSelection(elements);
    syncDetailNavigation(elements);
  }

  function clearChildren(element) {
    if (element) {
      element.replaceChildren();
    }
  }

  function updateHouseSelection(elements) {
    tarotHouseUi.updateSelection?.(elements);
  }

  function renderHouseOfCards(elements) {
    tarotHouseUi.render?.(elements);
  }

  function syncHouseControls(elements) {
    if (elements?.tarotHouseViewEl) {
      elements.tarotHouseViewEl.classList.toggle("is-house-focus", Boolean(state.houseFocusMode));
    }

    // House settings use the shared page-settings button/overlay
    // (app/ui-page-settings.js) via data-page-settings attributes.

    if (elements?.tarotHouseTopCardsVisibleEl) {
      elements.tarotHouseTopCardsVisibleEl.checked = Boolean(state.houseTopCardsVisible);
      elements.tarotHouseTopCardsVisibleEl.disabled = Boolean(state.houseExportInProgress);
    }

    setHouseBottomInfoCheckboxState(elements?.tarotHouseTopInfoHebrewEl, state.houseTopInfoModes.hebrew);
    setHouseBottomInfoCheckboxState(elements?.tarotHouseTopInfoPlanetEl, state.houseTopInfoModes.planet);
    setHouseBottomInfoCheckboxState(elements?.tarotHouseTopInfoZodiacEl, state.houseTopInfoModes.zodiac);
    setHouseBottomInfoCheckboxState(elements?.tarotHouseTopInfoTrumpEl, state.houseTopInfoModes.trump);
    setHouseBottomInfoCheckboxState(elements?.tarotHouseTopInfoPathEl, state.houseTopInfoModes.path);
    setHouseBottomInfoCheckboxState(elements?.tarotHouseTopInfoDateEl, state.houseTopInfoModes.date);

    if (elements?.tarotHouseBottomCardsVisibleEl) {
      elements.tarotHouseBottomCardsVisibleEl.checked = Boolean(state.houseBottomCardsVisible);
      elements.tarotHouseBottomCardsVisibleEl.disabled = Boolean(state.houseExportInProgress);
    }

    setHouseBottomInfoCheckboxState(elements?.tarotHouseBottomInfoZodiacEl, state.houseBottomInfoModes.zodiac);
    setHouseBottomInfoCheckboxState(elements?.tarotHouseBottomInfoDecanEl, state.houseBottomInfoModes.decan);
    setHouseBottomInfoCheckboxState(elements?.tarotHouseBottomInfoMonthEl, state.houseBottomInfoModes.month);
    setHouseBottomInfoCheckboxState(elements?.tarotHouseBottomInfoRulerEl, state.houseBottomInfoModes.ruler);
    setHouseBottomInfoCheckboxState(elements?.tarotHouseBottomInfoDateEl, state.houseBottomInfoModes.date);

    if (elements?.tarotHouseExportWebpEl) {
      const supportsWebp = tarotHouseUi.isExportFormatSupported?.("webp") === true;
      elements.tarotHouseExportWebpEl.disabled = Boolean(state.houseExportInProgress) || !supportsWebp;
      elements.tarotHouseExportWebpEl.hidden = !supportsWebp;
      elements.tarotHouseExportWebpEl.textContent = state.houseExportInProgress && state.houseExportFormat === "webp"
        ? "Exporting..."
        : "Export WebP";
      if (supportsWebp) {
        elements.tarotHouseExportWebpEl.title = "Smaller file size, but not guaranteed lossless like PNG.";
      }
    }
  }

  function refreshHouseUi() {
    if (!state.initialized) {
      return;
    }

    const elements = getElements();
    renderHouseOfCards(elements);
    syncHouseControls(elements);
  }

  function setHouseTopCardsVisible(value) {
    state.houseTopCardsVisible = Boolean(value);
    refreshHouseUi();
  }

  function setHouseTopInfoMode(mode, value) {
    const key = String(mode || "").trim();
    if (!key || !Object.prototype.hasOwnProperty.call(state.houseTopInfoModes, key)) {
      return;
    }

    state.houseTopInfoModes[key] = Boolean(value);
    refreshHouseUi();
  }

  function setHouseBottomCardsVisible(value) {
    state.houseBottomCardsVisible = Boolean(value);
    refreshHouseUi();
  }

  function setHouseBottomInfoMode(mode, value) {
    const key = String(mode || "").trim();
    if (!key || !Object.prototype.hasOwnProperty.call(state.houseBottomInfoModes, key)) {
      return;
    }

    state.houseBottomInfoModes[key] = Boolean(value);
    refreshHouseUi();
  }

  async function exportHouseOfCards(elements, format = "png") {
    if (state.houseExportInProgress) {
      return;
    }

    state.houseExportInProgress = true;
    state.houseExportFormat = format;
    syncHouseControls(elements);

    try {
      await tarotHouseUi.exportImage?.(format);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to export the House of Cards image.");
    } finally {
      state.houseExportInProgress = false;
      state.houseExportFormat = "png";
      syncHouseControls(elements);
    }
  }

  function buildTypeLabel(card) {
    return tarotCardDerivationsUi.buildTypeLabel(card);
  }

  function findSephirahForMinorCard(card, kabTree) {
    return tarotCardDerivationsUi.findSephirahForMinorCard(card, kabTree);
  }

  function formatRelation(relation) {
    return tarotRelationDisplayUi.formatRelation(relation);
  }

  function relationKey(relation, index) {
    return tarotRelationDisplayUi.relationKey(relation, index);
  }

  function normalizeRelationObject(relation, index) {
    return tarotRelationDisplayUi.normalizeRelationObject(relation, index);
  }

  function formatRelationDataLines(relation) {
    return tarotRelationDisplayUi.formatRelationDataLines(relation);
  }

  function buildCubeRelationsForCard(card) {
    if (typeof tarotRelationsUi.buildCubeRelationsForCard !== "function") {
      return [];
    }
    return tarotRelationsUi.buildCubeRelationsForCard(card, state.magickDataset);
  }

  function buildIChingRelationsForCard(card) {
    if (typeof tarotRelationsUi.buildIChingRelationsForCard !== "function") {
      return [];
    }
    return tarotRelationsUi.buildIChingRelationsForCard(card, state.referenceData);
  }

  // Returns nav dispatch config for relations that have a corresponding section,
  // null for informational-only relations.
  function getRelationNavTarget(relation) {
    return tarotRelationDisplayUi.getRelationNavTarget(relation);
  }

  function createRelationListItem(relation) {
    return tarotRelationDisplayUi.createRelationListItem(relation);
  }

  function renderStaticRelationGroup(targetEl, cardEl, relations) {
    tarotDetailRenderer.renderStaticRelationGroup(targetEl, cardEl, relations);
  }

  function renderDetail(card, elements) {
    tarotDetailRenderer.renderDetail(card, elements);
    window.KabbakLibraryMarks?.attachControls?.(document.getElementById("tarot-library-actions"), {
      type: "tarot",
      key: String(card?.id || ""),
      title: String(card?.name || card?.id || "Tarot card"),
      body: String(card?.meaning || card?.summary || card?.meanings?.upright || "").trim(),
      meta: { cardId: String(card?.id || "") }
    });
  }

  function updateListSelection(elements) {
    if (!elements?.tarotCardListEl) {
      return;
    }

    const buttons = elements.tarotCardListEl.querySelectorAll(".list-item");
    buttons.forEach((button) => {
      const isSelected = button.dataset.cardId === state.selectedCardId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function getCardSequenceState() {
    const total = state.filteredCards.length;
    const currentIndex = state.filteredCards.findIndex((card) => card.id === state.selectedCardId);

    return {
      total,
      currentIndex,
      previousId: currentIndex > 0 ? state.filteredCards[currentIndex - 1].id : "",
      nextId: currentIndex >= 0 && currentIndex < total - 1 ? state.filteredCards[currentIndex + 1].id : ""
    };
  }

  function getDetailNavigator() {
    if (detailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return detailNavigator;
    }

    detailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.tarotSectionEl && elements.tarotSectionEl.hidden === false),
      getSequenceState: getCardSequenceState,
      getPrevButton: (elements) => elements?.tarotDetailPrevEl,
      getNextButton: (elements) => elements?.tarotDetailNextEl,
      getPositionEl: (elements) => elements?.tarotDetailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          const suffix = state.searchQuery ? " shown" : "";
          return `${currentIndex + 1} of ${total}${suffix}`;
        }

        return total > 0 ? `${total} cards` : "No cards";
      },
      selectTarget: (targetId, elements) => {
        selectCardById(targetId, elements);
        return true;
      },
      afterSelect: (targetId, elements) => {
        scrollCardIntoView(targetId, elements);
      }
    });

    return detailNavigator;
  }

  function syncDetailNavigation(elements) {
    getDetailNavigator()?.sync(elements);
  }

  function selectAdjacentCard(offset, elements = getElements()) {
    return getDetailNavigator()?.step(offset, elements) === true;
  }

  function bindKeyboardNavigation(elements) {
    getDetailNavigator()?.bind(elements);
  }

  function selectCardById(cardIdToSelect, elements) {
    const card = state.cards.find((entry) => entry.id === cardIdToSelect);
    if (!card) {
      return;
    }

    state.selectedCardId = card.id;
    updateListSelection(elements);
    updateHouseSelection(elements);
    renderDetail(card, elements);
    syncDetailNavigation(elements);
  }

  function scrollCardIntoView(cardIdToReveal, elements) {
    elements?.tarotCardListEl
      ?.querySelector(`[data-card-id="${cardIdToReveal}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function getRegisteredDeckOptionMap() {
    const entries = typeof getDeckOptions === "function" ? getDeckOptions() : [];
    return new Map(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => ({
          id: String(entry?.id || "").trim(),
          label: String(entry?.label || entry?.id || "").trim(),
          system: String(entry?.system || "tarot").trim().toLowerCase() || "tarot"
        }))
        .filter((entry) => entry.id)
        .map((entry) => [entry.id, entry])
    );
  }

  function getRegisteredDeckList() {
    return Array.from(getRegisteredDeckOptionMap().values());
  }

  function getDeckSystem(deckId) {
    const normalizedDeckId = String(deckId || "").trim();
    return getRegisteredDeckOptionMap().get(normalizedDeckId)?.system || "tarot";
  }

  function getRegisteredDecksForSystem(system) {
    const normalizedSystem = String(system || "tarot").trim().toLowerCase() || "tarot";
    return getRegisteredDeckList().filter((deck) => deck.system === normalizedSystem);
  }

  function resolveRawCardVariants(card, deckIdToResolve = "") {
    const resolvedDeckId = String(deckIdToResolve || getActiveDeck?.() || "").trim().toLowerCase();
    const trumpNumber = card?.arcana === "Major" && Number.isFinite(Number(card?.number)) ? Number(card.number) : undefined;
    const resolveVariants = window.TarotCardImages?.resolveTarotCardVariants;
    if (typeof resolveVariants !== "function") {
      return [];
    }

    const variants = resolveVariants(card.name, { deckId: resolvedDeckId, trumpNumber });
    return Array.isArray(variants) ? variants : [];
  }

  function getCardVariantsForCard(card) {
    if (!card) {
      return [];
    }

    const variants = resolveRawCardVariants(card);
    if (variants.length <= 1) {
      return [];
    }

    return variants
      .map((variant) => ({
        variantIndex: Number(variant?.variantIndex) || 0,
        src: String(variant?.thumbnailPath || variant?.assetPath || "").trim(),
        assetPath: String(variant?.assetPath || "").trim(),
        isPrimary: Number(variant?.variantIndex) === 0
      }))
      .filter((variant) => variant.src);
  }

  function getCardVariantCount(card) {
    const activeDeckId = String(getActiveDeck?.() || "").trim().toLowerCase();
    const cacheKey = `${activeDeckId}|${String(card?.id || "")}`;
    if (state.cardVariantCounts.has(cacheKey)) {
      return state.cardVariantCounts.get(cacheKey);
    }

    const count = getCardVariantsForCard(card).length;
    state.cardVariantCounts.set(cacheKey, count);
    return count;
  }

  function buildCardVariantEntries(cardIdToResolve, deckIdToResolve = "") {
    const card = state.cards.find((entry) => entry.id === cardIdToResolve);
    if (!card) {
      return [];
    }

    return resolveRawCardVariants(card, deckIdToResolve)
      .map((variant) => ({
        src: String(variant?.assetPath || "").trim(),
        previewSrc: String(variant?.thumbnailPath || variant?.assetPath || "").trim()
      }))
      .filter((variant) => variant.src);
  }

  function getDeckVariantsForCard(card) {
    if (!card) {
      return [];
    }

    const trumpNumber = card?.arcana === "Major" && Number.isFinite(Number(card?.number)) ? Number(card.number) : undefined;
    const activeDeckId = String(getActiveDeck?.() || "").trim().toLowerCase();

    return getRegisteredDeckList()
      .map((deck) => {
        const deckId = String(deck?.id || "").trim().toLowerCase();
        if (!deckId) {
          return null;
        }

        const imageOptions = { deckId, trumpNumber };
        const src = (typeof resolveTarotCardThumbnail === "function"
          ? resolveTarotCardThumbnail(card.name, imageOptions)
          : "") || (typeof resolveTarotCardImage === "function"
          ? resolveTarotCardImage(card.name, imageOptions)
          : "");

        if (!src) {
          return null;
        }

        const displayName = (typeof getTarotCardDisplayName === "function"
          ? String(getTarotCardDisplayName(card.name, imageOptions) || "").trim()
          : "") || getDisplayCardName(card) || card.name;

        return {
          deckId,
          label: String(deck?.label || deckId).trim() || deckId,
          src,
          displayName,
          isActive: deckId === activeDeckId
        };
      })
      .filter(Boolean);
  }

  function buildDeckLightboxCardRequest(cardIdToResolve, deckIdToResolve = "") {
    const card = state.cards.find((entry) => entry.id === cardIdToResolve);
    if (!card) {
      return null;
    }

    const resolvedDeckId = String(deckIdToResolve || getActiveDeck?.() || "").trim();
    const trumpNumber = card?.arcana === "Major" && Number.isFinite(Number(card?.number)) ? Number(card.number) : undefined;
    const deckOptions = resolvedDeckId ? { deckId: resolvedDeckId, trumpNumber } : { trumpNumber };
    const src = typeof resolveTarotCardImage === "function"
      ? resolveTarotCardImage(card.name, deckOptions)
      : "";
    const previewSrc = typeof resolveTarotCardThumbnail === "function"
      ? (resolveTarotCardThumbnail(card.name, deckOptions) || src)
      : src;
    const deckMeta = resolvedDeckId ? getRegisteredDeckOptionMap().get(resolvedDeckId) : null;
    const label = (typeof getTarotCardDisplayName === "function"
      ? getTarotCardDisplayName(card.name, deckOptions)
      : "") || getDisplayCardName(card) || card.name || "Tarot card enlarged image";

    return {
      src,
      previewSrc,
      altText: label,
      label,
      cardId: card.id,
      deckId: resolvedDeckId,
      deckLabel: deckMeta?.label || resolvedDeckId,
      compareDetails: tarotDetailRenderer.buildCompareDetails?.(card) || []
    };
  }

  function buildLightboxCardRequestById(cardIdToResolve, deckIdToResolve = "") {
    const request = buildDeckLightboxCardRequest(cardIdToResolve, deckIdToResolve || getActiveDeck?.() || "");
    if (!request?.src) {
      return null;
    }

    return request;
  }

  function getDefaultLightboxSequenceIds(cardIdToOpen = "") {
    const normalizedCardId = String(cardIdToOpen || "").trim();
    const filteredIds = state.filteredCards
      .map((card) => String(card?.id || "").trim())
      .filter(Boolean);

    if (normalizedCardId && filteredIds.includes(normalizedCardId)) {
      return filteredIds;
    }

    return state.cards
      .map((card) => String(card?.id || "").trim())
      .filter(Boolean);
  }

  function getDeckVariantSequenceEntries(cardIdToResolve) {
    const card = state.cards.find((entry) => entry.id === cardIdToResolve);
    if (!card) {
      return [];
    }

    return getDeckVariantsForCard(card)
      .map((variant) => {
        const deckId = String(variant?.deckId || "").trim().toLowerCase();
        if (!deckId) {
          return null;
        }

        return {
          sequenceId: deckId,
          deckId
        };
      })
      .filter(Boolean);
  }

  function getIChingDeckOptions() {
    return (typeof getDeckOptions === "function" ? getDeckOptions() : [])
      .filter((deck) => deck?.id && String(deck.system || "").trim().toLowerCase() === "iching");
  }

  function buildIChingLightboxCardRequest(cardId, deckId) {
    const match = String(cardId || "").trim().match(/^hex-(\d+)$/);
    if (!match) {
      return null;
    }
    const number = Number(match[1]);
    const src = resolveTarotCardImage?.(`Hexagram ${number}`, { deckId });
    if (!src) {
      return null;
    }
    const deck = getIChingDeckOptions()
      .find((candidate) => candidate.id.toLowerCase() === String(deckId || "").trim().toLowerCase());
    return {
      src,
      altText: `Hexagram ${number}`,
      label: `Hexagram ${number}`,
      cardId: `hex-${number}`,
      deckId,
      deckLabel: deck?.label || deckId,
      compareDetails: []
    };
  }

  function openIChingCardLightbox(cardId, requestedDeckId, options = {}) {
    const ichingDecks = getIChingDeckOptions();
    if (!ichingDecks.length) {
      return false;
    }
    const wanted = String(requestedDeckId || "").trim().toLowerCase();
    const deckId = ichingDecks.some((deck) => deck.id.toLowerCase() === wanted)
      ? ichingDecks.find((deck) => deck.id.toLowerCase() === wanted).id
      : ichingDecks[0].id;
    const primary = buildIChingLightboxCardRequest(cardId, deckId);
    if (!primary) {
      return false;
    }
    window.TarotUiLightbox?.open?.({
      ...primary,
      allowOverlayCompare: true,
      allowDeckCompare: ichingDecks.length > 1,
      activeDeckId: deckId,
      activeDeckLabel: primary.deckLabel,
      availableCompareDecks: ichingDecks.map((deck) => ({ id: deck.id, label: deck.label })),
      maxCompareDecks: 3,
      sequenceIds: Array.from({ length: 64 }, (_value, index) => `hex-${index + 1}`),
      resolveCardById: (nextCardId) => buildIChingLightboxCardRequest(nextCardId, deckId),
      resolveDeckCardById: (nextCardId, nextDeckId) => buildIChingLightboxCardRequest(nextCardId, nextDeckId),
      originRect: options?.originRect || null,
      rotated: Boolean(options?.rotated),
      onClose: typeof options?.onClose === "function" ? options.onClose : null
    });
    return true;
  }

  function openCardLightboxById(cardIdToOpen, options = {}) {
    const normalizedCardId = String(cardIdToOpen || "").trim();
    if (!normalizedCardId) {
      return;
    }

    if (/^hex-\d+$/.test(normalizedCardId)
      && openIChingCardLightbox(normalizedCardId, options?.deckId || getActiveDeck?.(), options)) {
      return;
    }

    const requestedDeckId = String(options?.deckId || getActiveDeck?.() || "").trim();
    const primaryCardRequest = buildLightboxCardRequestById(normalizedCardId, requestedDeckId);
    if (!primaryCardRequest?.src) {
      return;
    }

    const activeDeckId = String(primaryCardRequest.deckId || requestedDeckId || getActiveDeck?.() || "").trim();
    const availableCompareDecks = getRegisteredDecksForSystem(getDeckSystem(activeDeckId)).filter((deck) => deck.id);
    const requestedSequenceIds = Array.isArray(options?.sequenceIds)
      ? options.sequenceIds
        .map((sequenceId) => String(sequenceId || "").trim())
        .filter(Boolean)
      : [];
    const sequenceIds = requestedSequenceIds.length > 0
      ? requestedSequenceIds
      : getDefaultLightboxSequenceIds(normalizedCardId);
    const resolveCardById = typeof options?.resolveCardById === "function"
      ? options.resolveCardById
      : (nextCardId) => buildLightboxCardRequestById(nextCardId, activeDeckId);
    const onSelectCardId = typeof options?.onSelectCardId === "function"
      ? options.onSelectCardId
      : (nextCardId) => {
        const latestElements = getElements();
        selectCardById(nextCardId, latestElements);
        scrollCardIntoView(nextCardId, latestElements);
      };

    window.TarotUiLightbox?.open?.({
      src: primaryCardRequest.src,
      altText: primaryCardRequest.altText,
      label: primaryCardRequest.label,
      cardId: primaryCardRequest.cardId,
      sequenceId: String(options?.sequenceId || primaryCardRequest.sequenceId || normalizedCardId).trim(),
      deckId: primaryCardRequest.deckId || activeDeckId,
      deckLabel: primaryCardRequest.deckLabel || "",
      compareDetails: primaryCardRequest.compareDetails || [],
      allowOverlayCompare: true,
      allowDeckCompare: true,
      activeDeckId,
      activeDeckLabel: primaryCardRequest.deckLabel || "",
      availableCompareDecks,
      maxCompareDecks: 2,
      sequenceIds,
      resolveCardById,
      resolveDeckCardById: buildDeckLightboxCardRequest,
      resolveCardVariants: (cardId, deckId) => buildCardVariantEntries(cardId, deckId),
      onSelectCardId,
      rotated: Boolean(options?.rotated),
      originRect: options?.originRect || null,
      originEl: options?.originEl instanceof HTMLElement ? options.originEl : null,
      previewSrc: String(options?.previewSrc || "").trim(),
      onClose: typeof options?.onClose === "function" ? options.onClose : null
    });
  }

  function openCardVariantLightbox(cardIdToOpen, assetPath = "") {
    const card = state.cards.find((entry) => entry.id === cardIdToOpen);
    const src = String(assetPath || "").trim();
    if (!src || !card) {
      return;
    }

    const label = getDisplayCardName(card) || card.name || "Tarot card";

    window.TarotUiLightbox?.open?.({
      src,
      altText: label,
      label,
      cardId: card.id,
      deckId: String(getActiveDeck?.() || "").trim()
    });
  }

  function openDeckVariantLightbox(cardIdToOpen, deckIdToOpen = "") {
    const normalizedCardId = String(cardIdToOpen || "").trim();
    if (!normalizedCardId) {
      return;
    }

    const variantEntries = getDeckVariantSequenceEntries(normalizedCardId);
    if (variantEntries.length < 1) {
      openCardLightboxById(normalizedCardId, { deckId: deckIdToOpen });
      return;
    }

    const requestedDeckId = String(deckIdToOpen || getActiveDeck?.() || "").trim().toLowerCase();
    const activeVariant = variantEntries.find((variant) => variant.deckId === requestedDeckId) || variantEntries[0];
    if (!activeVariant?.deckId) {
      openCardLightboxById(normalizedCardId);
      return;
    }

    const primaryCardRequest = buildLightboxCardRequestById(normalizedCardId, activeVariant.deckId);
    if (!primaryCardRequest?.src) {
      return;
    }

    const availableCompareDecks = getRegisteredDecksForSystem(getDeckSystem(activeVariant.deckId)).filter((deck) => deck.id);

    window.TarotUiLightbox?.open?.({
      ...primaryCardRequest,
      deckId: activeVariant.deckId,
      sequenceId: activeVariant.sequenceId,
      activeDeckId: activeVariant.deckId,
      activeDeckLabel: primaryCardRequest.deckLabel || "",
      availableCompareDecks,
      maxCompareDecks: 2,
      allowOverlayCompare: true,
      allowDeckCompare: true,
      sequenceIds: variantEntries.map((variant) => variant.sequenceId),
      resolveDeckCardById: buildDeckLightboxCardRequest,
      resolveCardVariants: (cardId, deckId) => buildCardVariantEntries(cardId, deckId),
      resolveCardById: (sequenceId) => {
        const normalizedSequenceId = String(sequenceId || "").trim().toLowerCase();
        const matchingVariant = variantEntries.find((variant) => variant.sequenceId === normalizedSequenceId);
        if (!matchingVariant?.deckId) {
          return null;
        }

        const request = buildLightboxCardRequestById(normalizedCardId, matchingVariant.deckId);
        return request
          ? {
            ...request,
            sequenceId: matchingVariant.sequenceId,
            deckId: matchingVariant.deckId
          }
          : null;
      },
      onSelectCardId: () => {
      }
    });
  }

  function renderList(elements) {
    if (!elements?.tarotCardListEl) {
      return;
    }

    clearChildren(elements.tarotCardListEl);

    state.filteredCards.forEach((card) => {
      const cardDisplayName = getDisplayCardName(card);
      const variantCount = getCardVariantCount(card);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item";
      button.dataset.cardId = card.id;
      button.setAttribute("role", "option");

      const nameEl = document.createElement("span");
      nameEl.className = "list-name";
      nameEl.textContent = cardDisplayName || card.name;

      const metaEl = document.createElement("span");
      metaEl.className = "list-meta";
      metaEl.textContent = buildTypeLabel(card);

      button.append(nameEl, metaEl);

      if (variantCount > 1) {
        const badgeEl = document.createElement("span");
        badgeEl.className = "tarot-list-variant-badge";
        badgeEl.textContent = String(variantCount);
        badgeEl.title = `${variantCount} image variants`;
        badgeEl.setAttribute("aria-label", `${variantCount} image variants`);
        button.appendChild(badgeEl);
      }

      elements.tarotCardListEl.appendChild(button);
    });

    if (elements.tarotCountEl) {
      elements.tarotCountEl.textContent = state.searchQuery
        ? `${state.filteredCards.length} of ${state.cards.length} cards`
        : `${state.cards.length} cards`;
    }
  }

  async function loadCards(referenceData, magickDataset) {
    const payload = await dataService.loadTarotCards?.();
    const cards = Array.isArray(payload?.cards)
      ? payload.cards
      : (Array.isArray(payload) ? payload : []);

    return cards.map((card) => ({
      ...card,
      id: String(card?.id || "").trim() || cardId(card)
    }));
  }

  async function ensureTarotSection(referenceData, magickDataset = null) {
    state.referenceData = referenceData || state.referenceData;

    if (magickDataset) {
      state.magickDataset = magickDataset;
    }

    tarotHouseUi.init?.({
      resolveTarotCardImage,
      resolveTarotCardThumbnail,
      getActiveDeck,
      getDisplayCardName,
      clearChildren,
      normalizeTarotCardLookupName,
      selectCardById,
      openCardLightbox: (src, altText, options = {}) => {
        const cardId = String(options?.cardId || "").trim();
        if (cardId) {
          openCardLightboxById(cardId);
          return;
        }

        window.TarotUiLightbox?.open?.({
          src,
          altText: altText || "Tarot card enlarged image",
          label: altText || "Tarot card enlarged image"
        });
      },
      shouldOpenCardLightboxOnSelect: (latestElements) => Boolean(
        latestElements?.tarotHouseSectionEl instanceof HTMLElement
        && latestElements.tarotHouseSectionEl.hidden === false
      ),
      isHouseFocusMode: () => state.houseFocusMode,
      getCards: () => state.cards,
      getSelectedCardId: () => state.selectedCardId,
      getHouseTopCardsVisible: () => state.houseTopCardsVisible,
      getHouseTopInfoModes: () => ({ ...state.houseTopInfoModes }),
      getMagickDataset: () => state.magickDataset,
      getHouseBottomCardsVisible: () => state.houseBottomCardsVisible,
      getHouseBottomInfoModes: () => ({ ...state.houseBottomInfoModes })
    });

    const elements = getElements();

    if (state.initialized) {
      state.monthRefsByCardId = buildMonthReferencesByCard(referenceData, state.cards);
      state.courtCardByDecanId = buildCourtCardByDecanId(state.cards);
      renderHouseOfCards(elements);
      syncHouseControls(elements);
      if (state.selectedCardId) {
        const selected = state.cards.find((card) => card.id === state.selectedCardId);
        if (selected) {
          renderDetail(selected, elements);
          syncDetailNavigation(elements);
        }
      }
      return;
    }

    if (!elements.tarotCardListEl || !elements.tarotDetailNameEl) {
      return;
    }

    if (state.loadingPromise) {
      await state.loadingPromise;
      return;
    }

    state.loadingPromise = (async () => {
      const cards = await loadCards(referenceData, magickDataset);

      state.cards = cards;
      state.monthRefsByCardId = buildMonthReferencesByCard(referenceData, cards);
      state.courtCardByDecanId = buildCourtCardByDecanId(cards);
      state.filteredCards = [...cards];
      lastRenderedDeckId = String(getActiveDeck?.() || "").trim().toLowerCase();
      renderList(elements);
      renderHouseOfCards(elements);
      syncHouseControls(elements);

      if (cards.length > 0) {
        selectCardById(cards[0].id, elements);
      }

      elements.tarotCardListEl.addEventListener("click", (event) => {
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

        const selectedId = button.dataset.cardId;
        if (!selectedId) {
          return;
        }

        selectCardById(selectedId, elements);
      });

      if (elements.tarotSearchInputEl) {
        elements.tarotSearchInputEl.addEventListener("input", () => {
          state.searchQuery = elements.tarotSearchInputEl.value || "";
          applySearchFilter(elements);
        });
      }

      if (elements.tarotSearchClearEl && elements.tarotSearchInputEl) {
        elements.tarotSearchClearEl.addEventListener("click", () => {
          elements.tarotSearchInputEl.value = "";
          state.searchQuery = "";
          applySearchFilter(elements);
          elements.tarotSearchInputEl.focus();
        });
      }

      bindKeyboardNavigation(elements);

      if (elements.tarotHouseTopCardsVisibleEl) {
        elements.tarotHouseTopCardsVisibleEl.addEventListener("change", () => {
          state.houseTopCardsVisible = Boolean(elements.tarotHouseTopCardsVisibleEl.checked);
          renderHouseOfCards(elements);
          syncHouseControls(elements);
        });
      }

      [
        [elements.tarotHouseTopInfoHebrewEl, "hebrew"],
        [elements.tarotHouseTopInfoPlanetEl, "planet"],
        [elements.tarotHouseTopInfoZodiacEl, "zodiac"],
        [elements.tarotHouseTopInfoTrumpEl, "trump"],
        [elements.tarotHouseTopInfoPathEl, "path"],
        [elements.tarotHouseTopInfoDateEl, "date"]
      ].forEach(([checkbox, key]) => {
        if (!checkbox) {
          return;
        }
        checkbox.addEventListener("change", () => {
          state.houseTopInfoModes[key] = Boolean(checkbox.checked);
          renderHouseOfCards(elements);
          syncHouseControls(elements);
        });
      });

      if (elements.tarotHouseBottomCardsVisibleEl) {
        elements.tarotHouseBottomCardsVisibleEl.addEventListener("change", () => {
          state.houseBottomCardsVisible = Boolean(elements.tarotHouseBottomCardsVisibleEl.checked);
          renderHouseOfCards(elements);
          syncHouseControls(elements);
        });
      }

      [
        [elements.tarotHouseBottomInfoZodiacEl, "zodiac"],
        [elements.tarotHouseBottomInfoDecanEl, "decan"],
        [elements.tarotHouseBottomInfoMonthEl, "month"],
        [elements.tarotHouseBottomInfoRulerEl, "ruler"],
        [elements.tarotHouseBottomInfoDateEl, "date"]
      ].forEach(([checkbox, key]) => {
        if (!checkbox) {
          return;
        }
        checkbox.addEventListener("change", () => {
          state.houseBottomInfoModes[key] = Boolean(checkbox.checked);
          renderHouseOfCards(elements);
          syncHouseControls(elements);
        });
      });

      if (elements.tarotHouseExportWebpEl) {
        elements.tarotHouseExportWebpEl.addEventListener("click", () => {
          exportHouseOfCards(elements, "webp");
        });
      }

      if (elements.tarotDetailImageEl) {
        elements.tarotDetailImageEl.addEventListener("click", () => {
          if (elements.tarotDetailImageEl.style.display === "none" || !state.selectedCardId) {
            return;
          }

          openCardLightboxById(state.selectedCardId);
        });
      }

      document.addEventListener("settings:updated", (event) => {
        const nextDeck = String(event?.detail?.settings?.tarotDeck || "").trim().toLowerCase();
        if (!nextDeck || nextDeck === lastRenderedDeckId) {
          return;
        }

        lastRenderedDeckId = nextDeck;
        state.cardVariantCounts.clear();
        renderList(elements);

        if (state.selectedCardId) {
          const selected = state.cards.find((card) => card.id === state.selectedCardId);
          if (selected) {
            renderDetail(selected, elements);
            syncDetailNavigation(elements);
          }
        }
      });

      state.initialized = true;
    })();

    try {
      await state.loadingPromise;
    } finally {
      state.loadingPromise = null;
    }
  }

  function selectCardByTrump(trumpNumber) {
    if (!state.initialized) return;
    const el = getElements();
    const card = state.cards.find(c => c.arcana === "Major" && c.number === trumpNumber);
    if (!card) return;
    selectCardById(card.id, el);
    scrollCardIntoView(card.id, el);
  }

  function selectCardByName(name) {
    if (!state.initialized) return;
    const el = getElements();
    const needle = normalizeTarotCardLookupName(name);
    const card = state.cards.find((entry) => normalizeTarotCardLookupName(entry.name) === needle);
    if (!card) return;
    selectCardById(card.id, el);
    scrollCardIntoView(card.id, el);
  }

  window.TarotSectionUi = {
    ensureTarotSection,
    selectCardByTrump,
    selectCardByName,
    selectCardById: (cardId) => selectCardById(cardId, getElements()),
    openCardLightboxById,
    getCards: () => state.cards,
    getHouseTopCardsVisible: () => state.houseTopCardsVisible,
    getHouseTopInfoModes: () => ({ ...state.houseTopInfoModes }),
    getHouseBottomCardsVisible: () => state.houseBottomCardsVisible,
    getHouseBottomInfoModes: () => ({ ...state.houseBottomInfoModes }),
    setHouseTopCardsVisible,
    setHouseTopInfoMode,
    setHouseBottomCardsVisible,
    setHouseBottomInfoMode
  };
})();
