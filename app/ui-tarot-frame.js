(function () {
  "use strict";

  const tarotCardImages = window.TarotCardImages || {};
  const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MINOR_RANKS = new Set(["Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"]);
  const COURT_RANKS = new Set(["Knight", "Queen", "Prince"]);
  const EXTRA_SUIT_ORDER = ["wands", "cups", "swords", "disks"];
  const HOUSE_MINOR_NUMBER_BANDS = [
    [2, 3, 4],
    [5, 6, 7],
    [8, 9, 10],
    [2, 3, 4],
    [5, 6, 7],
    [8, 9, 10]
  ];
  const HOUSE_LEFT_SUITS = ["Wands", "Disks", "Swords", "Cups", "Wands", "Disks"];
  const HOUSE_RIGHT_SUITS = ["Swords", "Cups", "Wands", "Disks", "Swords", "Cups"];
  const HOUSE_MIDDLE_SUITS = ["Wands", "Cups", "Swords", "Disks"];
  const HOUSE_MIDDLE_RANKS = ["Ace", "Knight", "Queen", "Prince", "Princess"];
  const HOUSE_TRUMP_ROWS = [
    [0],
    [20, 21, 12],
    [19, 10, 2, 1, 3, 16],
    [18, 17, 15, 14, 13, 9, 8, 7, 6, 5, 4],
    [11]
  ];
  const HOUSE_TRUMP_GRID_ROWS = [1, 2, 3, 4, 5];
  const HOUSE_BOTTOM_START_ROW = 8;
  const HOUSE_LEFT_START_COLUMN = 2;
  const HOUSE_MIDDLE_START_COLUMN = 6;
  const HOUSE_RIGHT_START_COLUMN = 11;
  const TAROT_CARD_WIDTH_RATIO = 2;
  const TAROT_CARD_HEIGHT_RATIO = 3;
  const ZODIAC_START_TOKEN_BY_SIGN_ID = {
    aries: "03-21",
    taurus: "04-20",
    gemini: "05-21",
    cancer: "06-21",
    leo: "07-23",
    virgo: "08-23",
    libra: "09-23",
    scorpio: "10-23",
    sagittarius: "11-22",
    capricorn: "12-22",
    aquarius: "01-20",
    pisces: "02-19"
  };
  const MASTER_GRID_SIZE = 24;
  const FRAME_GRID_ZOOM_STEPS = [1, 1.2, 1.4, 1.7, 2, 2.4, 3, 3.6, 4.2, 5.2, 6.4, 8, 10, 12, 14];
  const FRAME_GRID_MIN_SCALE = 0.8;
  const FRAME_GRID_MAX_SCALE = 14;
  const FRAME_PINCH_ZOOM_EXPONENT = 2.15;
  const FRAME_WHEEL_ZOOM_GAIN = 0.0052;
  const FRAME_DRAG_SNAP_MAX_SPEED = 0.26;
  const FRAME_CUSTOM_LAYOUTS_STORAGE_KEY = "tarot-frame-custom-layouts-v1";
  const FRAME_ACTIVE_LAYOUT_STORAGE_KEY = "tarot-frame-active-layout-v1";
  const FRAME_CARD_PICKER_QUERY_STORAGE_KEY = "tarot-frame-card-picker-query-v1";
  const FRAME_LAYOUT_NOTES_STORAGE_KEY = "tarot-frame-layout-notes-v1";
  const FRAME_SYSTEM_STORAGE_KEY = "tarot-frame-system-v1";
  const FRAME_EXPORT_COUNTS_STORAGE_KEY = "tarot-frame-export-counts-v1";
  const FRAME_SYSTEM_LABELS = { tarot: "Tarot", iching: "I Ching", "playing-cards": "Playing cards" };
  const PLAYING_CARD_SUITS = [
    { id: "spades", label: "Spades" },
    { id: "hearts", label: "Hearts" },
    { id: "diamonds", label: "Diamonds" },
    { id: "clubs", label: "Clovers" }
  ];
  const PLAYING_CARD_RANKS = [
    { id: "ace", label: "Ace" },
    { id: "two", label: "Two" },
    { id: "three", label: "Three" },
    { id: "four", label: "Four" },
    { id: "five", label: "Five" },
    { id: "six", label: "Six" },
    { id: "seven", label: "Seven" },
    { id: "eight", label: "Eight" },
    { id: "nine", label: "Nine" },
    { id: "ten", label: "Ten" },
    { id: "jack", label: "Jack" },
    { id: "queen", label: "Queen" },
    { id: "king", label: "King" }
  ];
  const PLAYING_CARDS = PLAYING_CARD_SUITS.flatMap((suit, suitIndex) => PLAYING_CARD_RANKS.map((rank, rankIndex) => ({
    id: `pc-${suit.id}-${rank.id}`,
    name: `${rank.label} of ${suit.label}`,
    arcana: "Playing",
    number: (suitIndex * 13) + rankIndex + 1,
    suit: suit.label,
    rank: rank.label
  })));

  function normalizeFrameSystem(system) {
    const value = String(system || "").trim().toLowerCase();
    if (value === "iching" || value === "playing-cards") return value;
    return "tarot";
  }
  const HOUSE_TOP_INFO_MODE_IDS = ["hebrew", "planet", "zodiac", "trump", "path", "date"];
  const HOUSE_BOTTOM_INFO_MODE_IDS = ["zodiac", "decan", "month", "ruler", "date"];
  const FRAME_LONG_PRESS_DELAY_MS = 460;
  const FRAME_LONG_PRESS_MOVE_TOLERANCE = 10;
  const FRAME_TOUCH_DRAG_ACTIVATION_DELAY_MS = 140;
  const FRAME_CUSTOM_CARD_PREFIX = "frame-custom-text:";
  const FRAME_CUSTOM_CARD_ACTION_ID = "create-custom-text";
  const EXPORT_SLOT_WIDTH = 180;
  const EXPORT_SLOT_HEIGHT = Math.round((EXPORT_SLOT_WIDTH * TAROT_CARD_HEIGHT_RATIO) / TAROT_CARD_WIDTH_RATIO);
  const EXPORT_CARD_INSET = 0;
  const EXPORT_GRID_GAP = 10;
  const EXPORT_PADDING = 28;
  const EXPORT_BACKGROUND = "#0f0f17";
  const EXPORT_PANEL = "#18181b";
  const EXPORT_CARD_BORDER = "#475569";
  const EXPORT_BADGE_BACKGROUND = "rgba(2, 6, 23, 0.9)";
  const EXPORT_BADGE_TEXT = "#f8fafc";
  const EXPORT_FORMATS = {
    webp: {
      mimeType: "image/webp",
      extension: "webp",
      quality: 1
    }
  };
  const FRAME_LAYOUT_GROUPS = [
    {
      id: "extra-cards",
      title: "Extra Band",
      description: "Two-row top band for aces, princesses, and the non-zodiac majors.",
      positions: [
        ...Array.from({ length: MASTER_GRID_SIZE }, (_, index) => ({ row: 1, column: index + 1 })),
        { row: 2, column: 6 },
        { row: 2, column: 7 },
        { row: 2, column: 8 },
        { row: 2, column: 9 }
      ],
      getOrderedCards(cards) {
        return cards
          .filter((card) => isExtraTopRowCard(card))
          .sort(compareExtraTopRowCards);
      }
    },
    {
      id: "small-cards",
      title: "Small Cards",
      description: "Outer perimeter in chronological decan order.",
      positions: buildPerimeterPath(10, 5, 3),
      getOrderedCards(cards) {
        return cards
          .filter((card) => isSmallCard(card))
          .sort((left, right) => compareDateTokens(getRelation(left, "decan")?.data?.dateStart, getRelation(right, "decan")?.data?.dateStart, "03-21"));
      }
    },
    {
      id: "court-dates",
      title: "Court Dates",
      description: "Inner left frame in chronological court-date order.",
      positions: buildPerimeterPath(4, 8, 4),
      getOrderedCards(cards) {
        return cards
          .filter((card) => isCourtDateCard(card))
          .sort((left, right) => compareDateTokens(getRelation(left, "courtDateWindow")?.data?.dateStart, getRelation(right, "courtDateWindow")?.data?.dateStart, "11-12"));
      }
    },
    {
      id: "zodiac-trumps",
      title: "Zodiac Trumps",
      description: "Inner right frame in chronological zodiac order.",
      positions: buildPerimeterPath(4, 8, 8),
      getOrderedCards(cards) {
        return cards
          .filter((card) => isZodiacTrump(card))
          .sort((left, right) => {
            const leftSignId = normalizeKey(getRelation(left, "zodiacCorrespondence")?.data?.signId);
            const rightSignId = normalizeKey(getRelation(right, "zodiacCorrespondence")?.data?.signId);
            return compareDateTokens(ZODIAC_START_TOKEN_BY_SIGN_ID[leftSignId], ZODIAC_START_TOKEN_BY_SIGN_ID[rightSignId], "03-21");
          });
      }
    }
  ];

  const LAYOUT_PRESETS = [
    {
      id: "frames",
      label: "Frames",
      title: "Master 24x24 Frame Grid",
      subtitle: "A two-row top band holds the remaining 18 cards, while the centered frame keeps the small cards, court dates, and zodiac trumps grouped together. Every square on the grid is a snap target for custom layouts.",
      statusMessage: "Frames layout applied to the master grid.",
      legendItems: FRAME_LAYOUT_GROUPS.map((group) => ({
        title: group.title,
        description: group.description
      })),
      buildPlacements(cards) {
        const placements = [];
        FRAME_LAYOUT_GROUPS.forEach((group) => {
          assignCardsToPositions(placements, group.positions, group.getOrderedCards(cards));
        });
        return placements;
      }
    },
    {
      id: "house",
      label: "House of Cards",
      title: "House of Cards Layout",
      subtitle: "The legacy house composition now lives inside the same draggable 24x24 grid. Centered trump tiers sit above the three lower columns, while every square still remains available for custom rearranging.",
      statusMessage: "House of Cards layout applied to the master grid.",
      legendItems: [
        {
          title: "Trump Tiers",
          description: "Five centered major-arcana rows preserve the original House silhouette."
        },
        {
          title: "Left Wing",
          description: "Minor bands descend through Wands, Disks, Swords, Cups, then repeat Wands and Disks."
        },
        {
          title: "Middle Court",
          description: "Aces and the court ranks run through the four suits down the center column."
        },
        {
          title: "Right Wing",
          description: "Minor bands mirror the opposite side with Swords, Cups, Wands, Disks, then Swords and Cups."
        }
      ],
      buildPlacements(cards) {
        return buildHousePlacements(cards);
      }
    },
    {
      id: "zodiac",
      label: "Zodiac",
      title: "Zodiac Trumps",
      subtitle: "The twelve zodiac majors in seasonal order, two rows of six.",
      statusMessage: "Zodiac layout applied to the master grid.",
      legendItems: [
        {
          title: "Zodiac Trumps",
          description: "Aries through Pisces in calendar order, six across and two down."
        }
      ],
      buildPlacements(cards) {
        return buildCenteredBandPlacements(getOrderedZodiacTrumps(cards), 2, 6);
      }
    },
    {
      id: "planets",
      label: "Planets",
      title: "Planet Trumps",
      subtitle: "Major arcana with planetary correspondences, arranged in a compact centered band.",
      statusMessage: "Planets layout applied to the master grid.",
      legendItems: [
        {
          title: "Planet Trumps",
          description: "Classical planets first (Saturn through Moon), then any extra planetary majors."
        }
      ],
      buildPlacements(cards) {
        const ordered = getOrderedPlanetTrumps(cards);
        const columns = Math.min(7, Math.max(1, ordered.length));
        const rows = Math.max(1, Math.ceil(ordered.length / columns));
        return buildCenteredBandPlacements(ordered, rows, columns);
      }
    },
    {
      id: "iching",
      label: "I Ching (8×8)",
      title: "I Ching Hexagrams",
      subtitle: "All 64 hexagrams in a centered 8×8 grid, in King Wen order.",
      statusMessage: "I Ching layout applied to the master grid.",
      legendItems: [
        {
          title: "Hexagrams",
          description: "Hexagram 1–64, eight across and eight down."
        }
      ],
      buildPlacements(cards) {
        const hexagrams = (Array.isArray(cards) ? cards : []).slice(0, 64);
        const columns = 8;
        const start = Math.floor((MASTER_GRID_SIZE - columns) / 2) + 1;
        return hexagrams.map((card, index) => ({
          row: start + Math.floor(index / columns),
          column: start + (index % columns),
          cardId: getCardId(card)
        }));
      }
    }
  ];

  const state = {
    initialized: false,
    layoutReady: false,
    cardSignature: "",
    slotAssignments: new Map(),
    slotFlips: new Map(),
    selectedSlotIds: new Set(),
    statusMessage: "Loading tarot cards...",
    drag: null,
    panGesture: null,
    pinchGesture: null,
    longPress: null,
    cardInsertMenu: {
      open: false,
      slotId: ""
    },
    cardActionMenu: {
      open: false,
      slotId: "",
      cardId: "",
      ignoreClickUntil: 0,
      clickArmed: false
    },
    cardPicker: {
      open: false,
      slotId: "",
      query: "",
      mode: "browse",
      editingCardId: "",
      editorImageData: ""
    },
    suppressClick: false,
    showInfo: false,
    layoutGuideVisible: false,
    settingsOpen: false,
    settingsOverlayOpen: false,
    settingsPanelRestore: null,
    framesPanelMode: "list",
    framesPanelRenameId: "",
    layoutMenuOpen: false,
    gridFocusMode: true,
    currentLayoutId: "frames",
    customLayouts: [],
    customCards: new Map(),
    slotDeckOverrides: new Map(),
    frameDeckId: "",
    tarotLayoutId: "",
    layoutNotesById: {},
    exportInProgress: false,
    exportFormat: "webp",
    exportScope: "used",
    gridZoomStepIndex: 0,
    gridZoomScale: FRAME_GRID_ZOOM_STEPS[0],
    system: "tarot"
  };
  state.system = normalizeFrameSystem(readStorageValue(FRAME_SYSTEM_STORAGE_KEY));

  let config = {
    ensureTarotSection: null,
    getCards: () => [],
    openCardLightbox: () => {},
    getHouseTopCardsVisible: () => true,
    getHouseTopInfoModes: () => ({}),
    getHouseBottomCardsVisible: () => true,
    getHouseBottomInfoModes: () => ({}),
    setHouseTopCardsVisible: () => {},
    setHouseTopInfoMode: () => {},
    setHouseBottomCardsVisible: () => {},
    setHouseBottomInfoMode: () => {}
  };

  let cardInsertMenuEl = null;
  let cardActionMenuEl = null;
  let cardActionMenuSelectEl = null;
  let cardActionMenuFlipEl = null;
  let cardActionMenuOpenEl = null;
  let cardActionMenuRemoveEl = null;
  let cardActionMenuDeckApplyEl = null;
  let cardActionMenuDeckResetEl = null;
  let cardActionMenuDeckSelectEl = null;
  let cardPickerEl = null;
  let cardPickerTitleEl = null;
  let cardPickerSearchEl = null;
  let cardPickerSectionsEl = null;
  let cardPickerSearchWrapEl = null;
  let cardPickerEditorHeadingEl = null;
  let cardPickerEditorTitleEl = null;
  let cardPickerEditorSubtitleEl = null;
  let cardPickerEditorColorEl = null;
  let cardPickerEditorImageEl = null;
  let cardPickerEditorImageUploadEl = null;
  let cardPickerEditorImageClearEl = null;
  let cardPickerEditorPreviewEl = null;
  let cardPickerEditorSaveEl = null;
  let cardPickerEditorRemoveEl = null;
  let cardCustomEditorEl = null;
  let cardCustomEditorTitleEl = null;
  let dragTrashEl = null;
  let pendingGridViewportRestoreFrameId = 0;
  let pendingLiveZoomFrameId = 0;
  let pendingLiveZoomJob = null;
  let pendingDragFrameId = 0;
  let activeTouchGestureCapture = false;
  let cachedFrameElements = null;

  function buildPerimeterPath(size, rowOffset = 1, columnOffset = 1) {
    const path = [];
    for (let column = 0; column < size; column += 1) {
      path.push({ row: rowOffset, column: columnOffset + column });
    }
    for (let row = 1; row < size - 1; row += 1) {
      path.push({ row: rowOffset + row, column: columnOffset + size - 1 });
    }
    for (let column = size - 1; column >= 0; column -= 1) {
      path.push({ row: rowOffset + size - 1, column: columnOffset + column });
    }
    for (let row = size - 2; row >= 1; row -= 1) {
      path.push({ row: rowOffset + row, column: columnOffset });
    }
    return path;
  }

  function getElements() {
    if (cachedFrameElements) {
      return cachedFrameElements;
    }
    cachedFrameElements = {
      tarotFrameSectionEl: document.getElementById("tarot-frame-section"),
      tarotFrameViewEl: document.getElementById("tarot-frame-view"),
      tarotFrameBoardEl: document.getElementById("tarot-frame-board"),
      tarotFrameStatusEl: document.getElementById("tarot-frame-status"),
      tarotFrameOverviewEl: document.getElementById("tarot-frame-overview"),
      tarotFrameSelectionChipEl: document.getElementById("tarot-frame-selection-chip"),
      tarotFrameFocusExitEl: document.getElementById("tarot-frame-focus-exit"),
      tarotFrameSettingsPanelEl: document.getElementById("tarot-frame-settings-panel"),
      tarotFrameLayoutOptionsEl: document.getElementById("tarot-frame-layout-options"),
      tarotFrameFramesPanelEl: document.getElementById("tarot-frame-frames-panel"),
      tarotFrameGridZoomEl: document.getElementById("tarot-frame-grid-zoom"),
      tarotFrameDeckSelectEl: document.getElementById("tarot-frame-deck-select"),
      tarotFrameSystemEl: document.getElementById("tarot-frame-system"),
      tarotFrameExportScopeEl: document.getElementById("tarot-frame-export-scope"),
      tarotFrameShowInfoEl: document.getElementById("tarot-frame-show-info"),
      tarotFrameHouseSettingsEl: document.getElementById("tarot-frame-house-settings"),
      tarotFrameHouseTopCardsVisibleEl: document.getElementById("tarot-frame-house-top-cards-visible"),
      tarotFrameHouseTopInfoHebrewEl: document.getElementById("tarot-frame-house-top-info-hebrew"),
      tarotFrameHouseTopInfoPlanetEl: document.getElementById("tarot-frame-house-top-info-planet"),
      tarotFrameHouseTopInfoZodiacEl: document.getElementById("tarot-frame-house-top-info-zodiac"),
      tarotFrameHouseTopInfoTrumpEl: document.getElementById("tarot-frame-house-top-info-trump"),
      tarotFrameHouseTopInfoPathEl: document.getElementById("tarot-frame-house-top-info-path"),
      tarotFrameHouseTopInfoDateEl: document.getElementById("tarot-frame-house-top-info-date"),
      tarotFrameHouseBottomCardsVisibleEl: document.getElementById("tarot-frame-house-bottom-cards-visible"),
      tarotFrameHouseBottomInfoZodiacEl: document.getElementById("tarot-frame-house-bottom-info-zodiac"),
      tarotFrameHouseBottomInfoDecanEl: document.getElementById("tarot-frame-house-bottom-info-decan"),
      tarotFrameHouseBottomInfoMonthEl: document.getElementById("tarot-frame-house-bottom-info-month"),
      tarotFrameHouseBottomInfoRulerEl: document.getElementById("tarot-frame-house-bottom-info-ruler"),
      tarotFrameHouseBottomInfoDateEl: document.getElementById("tarot-frame-house-bottom-info-date"),
      tarotFrameClearGridEl: document.getElementById("tarot-frame-clear-grid"),
      tarotFrameExportWebpEl: document.getElementById("tarot-frame-export-webp")
    };
    return cachedFrameElements;
  }

  function normalizeLabelText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function syncSelectionChip() {
    const { tarotFrameSelectionChipEl } = getElements();
    if (!(tarotFrameSelectionChipEl instanceof HTMLButtonElement)) {
      return;
    }

    const selectedCount = getSelectedSlotIds().length;
    tarotFrameSelectionChipEl.hidden = !(selectedCount > 0);
    tarotFrameSelectionChipEl.disabled = !(selectedCount > 0) || Boolean(state.exportInProgress);
    tarotFrameSelectionChipEl.classList.toggle("is-active", selectedCount > 0);
    tarotFrameSelectionChipEl.textContent = selectedCount === 1
      ? "1 Selected · Clear"
      : `${selectedCount} Selected · Clear`;
    tarotFrameSelectionChipEl.setAttribute(
      "aria-label",
      selectedCount > 0
        ? `Clear selection of ${selectedCount} card${selectedCount === 1 ? "" : "s"}`
        : "No cards selected"
    );
    tarotFrameSelectionChipEl.title = selectedCount > 0
      ? "Clear the current multi-card selection"
      : "";
  }

  function isSmallCard(card) {
    return card?.arcana === "Minor"
      && MINOR_RANKS.has(String(card?.rank || ""))
      && Boolean(getRelation(card, "decan"));
  }

  function isCourtDateCard(card) {
    return COURT_RANKS.has(String(card?.rank || ""))
      && Boolean(getRelation(card, "courtDateWindow"));
  }

  function isZodiacTrump(card) {
    return card?.arcana === "Major"
      && Boolean(getRelation(card, "zodiacCorrespondence"));
  }

  function isPlanetTrump(card) {
    return card?.arcana === "Major"
      && Boolean(getRelation(card, "planetCorrespondence"))
      && !isZodiacTrump(card);
  }

  const PLANET_ORDER_IDS = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon", "uranus", "neptune", "pluto", "earth"];

  function getOrderedZodiacTrumps(cards) {
    return cards
      .filter((card) => isZodiacTrump(card))
      .sort((left, right) => {
        const leftSignId = normalizeKey(getRelation(left, "zodiacCorrespondence")?.data?.signId);
        const rightSignId = normalizeKey(getRelation(right, "zodiacCorrespondence")?.data?.signId);
        return compareDateTokens(ZODIAC_START_TOKEN_BY_SIGN_ID[leftSignId], ZODIAC_START_TOKEN_BY_SIGN_ID[rightSignId], "03-21");
      });
  }

  function getPlanetOrderIndex(card) {
    const data = getRelation(card, "planetCorrespondence")?.data || {};
    const key = normalizeKey(data.planetId || data.name || data.id);
    const index = PLANET_ORDER_IDS.indexOf(key);
    return index === -1 ? PLANET_ORDER_IDS.length : index;
  }

  function getOrderedPlanetTrumps(cards) {
    return cards
      .filter((card) => isPlanetTrump(card))
      .sort((left, right) => {
        const orderDiff = getPlanetOrderIndex(left) - getPlanetOrderIndex(right);
        if (orderDiff) return orderDiff;
        return String(left?.name || "").localeCompare(String(right?.name || ""));
      });
  }

  function buildCenteredBandPlacements(orderedCards, rows, columns) {
    const placements = [];
    const safeColumns = Math.max(1, Number(columns) || 1);
    const safeRows = Math.max(1, Number(rows) || 1);
    const startColumn = Math.max(1, Math.floor((MASTER_GRID_SIZE - safeColumns) / 2) + 1);
    const startRow = Math.max(1, Math.floor((MASTER_GRID_SIZE - safeRows) / 2) + 1);
    const positions = [];
    for (let row = 0; row < safeRows; row += 1) {
      for (let column = 0; column < safeColumns; column += 1) {
        positions.push({ row: startRow + row, column: startColumn + column });
      }
    }
    assignCardsToPositions(placements, positions, orderedCards);
    return placements;
  }

  function getExtraTopRowCategory(card) {
    const rank = String(card?.rank || "").trim();
    if (rank === "Ace") {
      return 0;
    }
    if (card?.arcana === "Major") {
      return 1;
    }
    if (rank === "Princess") {
      return 2;
    }
    return 3;
  }

  function compareSuitOrder(leftSuit, rightSuit) {
    const leftIndex = EXTRA_SUIT_ORDER.indexOf(normalizeKey(leftSuit));
    const rightIndex = EXTRA_SUIT_ORDER.indexOf(normalizeKey(rightSuit));
    const safeLeft = leftIndex === -1 ? EXTRA_SUIT_ORDER.length : leftIndex;
    const safeRight = rightIndex === -1 ? EXTRA_SUIT_ORDER.length : rightIndex;
    return safeLeft - safeRight;
  }

  function compareExtraTopRowCards(left, right) {
    const categoryDiff = getExtraTopRowCategory(left) - getExtraTopRowCategory(right);
    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    const category = getExtraTopRowCategory(left);
    if (category === 0 || category === 2) {
      return compareSuitOrder(left?.suit, right?.suit);
    }

    if (category === 1) {
      return Number(left?.number) - Number(right?.number);
    }

    return String(left?.name || "").localeCompare(String(right?.name || ""));
  }

  function isExtraTopRowCard(card) {
    return Boolean(card) && !isSmallCard(card) && !isCourtDateCard(card) && !isZodiacTrump(card);
  }

  function buildReadyStatus(cards) {
    return `${Array.isArray(cards) ? cards.length : 0} cards ready. Drag cards freely and use Settings to change the grid zoom for any layout.`;
  }

  function clampFrameGridZoomScale(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return FRAME_GRID_ZOOM_STEPS[0];
    }

    return Math.min(FRAME_GRID_MAX_SCALE, Math.max(FRAME_GRID_MIN_SCALE, numericValue));
  }

  function getNearestFrameZoomStepIndex(scale) {
    const safeScale = clampFrameGridZoomScale(scale);
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    FRAME_GRID_ZOOM_STEPS.forEach((step, index) => {
      const distance = Math.abs(step - safeScale);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function getGridZoomScale() {
    return clampFrameGridZoomScale(state.gridZoomScale);
  }

  function buildPanelCountText(cards = getCards()) {
    return `${cards.length} cards / ${MASTER_GRID_SIZE * MASTER_GRID_SIZE} cells · Zoom ${Math.round(getGridZoomScale() * 100)}%`;
  }

  function normalizeKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function readStorageValue(key) {
    try {
      return String(window.localStorage?.getItem?.(key) || "");
    } catch (_error) {
      return "";
    }
  }

  function writeStorageValue(key, value) {
    try {
      window.localStorage?.setItem?.(key, value);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function removeStorageValue(key) {
    try {
      window.localStorage?.removeItem?.(key);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function normalizeLayoutLabel(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 64);
  }

  function normalizeLayoutNote(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u0000/g, "")
      .trim()
      .slice(0, 1600);
  }

  function createSavedLayoutId() {
    return `saved-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function isValidSlotId(value) {
    const match = String(value || "").trim().match(/^(\d+):(\d+)$/);
    if (!match) {
      return false;
    }

    const row = Number(match[1]);
    const column = Number(match[2]);
    return Number.isInteger(row)
      && Number.isInteger(column)
      && row >= 1
      && row <= MASTER_GRID_SIZE
      && column >= 1
      && column <= MASTER_GRID_SIZE;
  }

  function parseSlotId(value) {
    const match = String(value || "").trim().match(/^(\d+):(\d+)$/);
    if (!match) {
      return null;
    }

    const row = Number(match[1]);
    const column = Number(match[2]);
    if (!Number.isInteger(row) || !Number.isInteger(column)) {
      return null;
    }

    return { row, column };
  }

  function compareSlotIds(left, right) {
    const leftSlot = parseSlotId(left);
    const rightSlot = parseSlotId(right);
    if (!leftSlot || !rightSlot) {
      return String(left || "").localeCompare(String(right || ""));
    }

    return (leftSlot.row - rightSlot.row) || (leftSlot.column - rightSlot.column);
  }

  function normalizeDeckIdValue(deckId) {
    return String(deckId || "").trim().toLowerCase();
  }

  function getDeckOptionsList() {
    const wantedSystem = normalizeFrameSystem(state.system);
    const options = (Array.isArray(tarotCardImages.getDeckOptions?.())
      ? tarotCardImages.getDeckOptions()
      : []
    ).filter((option) => String(option?.system || "tarot").trim().toLowerCase() === wantedSystem);

    const seen = new Set();
    return options
      .map((option) => ({
        id: normalizeDeckIdValue(option?.id),
        label: normalizeLabelText(option?.label || option?.id)
      }))
      .filter((option) => {
        if (!option.id || seen.has(option.id)) {
          return false;
        }
        seen.add(option.id);
        return true;
      });
  }

  function getFallbackDeckId() {
    const options = getDeckOptionsList();
    const activeDeckId = window.TarotCardImages?.getActiveDeck?.();
    if (activeDeckId && options.some((option) => option.id === activeDeckId)) {
      return activeDeckId;
    }
    return options[0]?.id || "";
  }

  function normalizeFrameDeckId(deckId) {
    const normalizedDeckId = normalizeDeckIdValue(deckId);
    if (!normalizedDeckId) {
      return "";
    }

    return getDeckOptionsList().some((option) => option.id === normalizedDeckId)
      ? normalizedDeckId
      : "";
  }

  function getFrameDeckId() {
    const normalized = normalizeFrameDeckId(state.frameDeckId);
    return normalized || getFallbackDeckId();
  }

  // Tarot vs I Ching card set. Switching clears placements so the two card
  // namespaces never mix, and re-points the Frame Deck list at that system.
  function syncSystemUi() {
    const { tarotFrameSystemEl, tarotFrameLayoutOptionsEl, tarotFrameFramesPanelEl } = getElements();
    if (tarotFrameSystemEl) {
      tarotFrameSystemEl.value = state.system;
    }
    const hideTarotChrome = state.system !== "tarot";
    [[tarotFrameLayoutOptionsEl, "tarot-frame-layout-options"], [tarotFrameFramesPanelEl, "tarot-frame-frames-panel"]]
      .forEach(([element]) => {
        if (!(element instanceof HTMLElement)) return;
        element.style.display = hideTarotChrome ? "none" : "";
        const heading = element.previousElementSibling;
        if (heading && heading.classList?.contains("tarot-frame-settings-heading")) {
          heading.style.display = hideTarotChrome ? "none" : "";
        }
      });
    // Tarot-only display info (Hebrew, planet, zodiac, trump, path, date…) does
    // not apply to hexagram or playing cards.
    const showInfoLabel = document.getElementById("tarot-frame-show-info")?.closest("label");
    if (showInfoLabel) {
      showInfoLabel.style.display = hideTarotChrome ? "none" : "";
    }
    const houseSettings = document.getElementById("tarot-frame-house-settings");
    if (houseSettings) {
      houseSettings.style.display = hideTarotChrome ? "none" : "";
    }
  }

  function setFrameSystem(system) {
    const next = normalizeFrameSystem(system);
    if (state.system === next) {
      syncSystemUi();
      return;
    }
    if (state.system === "tarot") {
      state.tarotLayoutId = state.currentLayoutId;
    }
    state.system = next;
    writeStorageValue(FRAME_SYSTEM_STORAGE_KEY, next);
    state.slotAssignments.clear();
    state.slotFlips.clear();
    state.slotDeckOverrides.clear();
    state.customCards.clear();
    state.selectedSlotIds.clear();
    state.frameDeckId = "";
    const apply = () => {
      syncSystemUi();
      if (next === "iching") {
        applyLayoutPreset("iching", getCards(), "I Ching layout applied to the master grid.");
      } else {
        applyLayoutSelection(state.tarotLayoutId || "frames", getCards(), "Tarot layout applied to the master grid.");
      }
      render();
      syncControls();
    };
    if (next === "iching") {
      void ensureFrameIChingCards().then(apply);
    } else {
      apply();
    }
  }

  function getSlotDeckOverride(slotId) {
    const targetSlotId = String(slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return "";
    }

    return normalizeFrameDeckId(state.slotDeckOverrides.get(targetSlotId));
  }

  function getResolvedSlotDeckId(slotId) {
    return getSlotDeckOverride(slotId) || getFrameDeckId();
  }

  function setFrameDeckId(deckId) {
    const nextDeckId = normalizeFrameDeckId(deckId);
    const previousDeckId = normalizeFrameDeckId(state.frameDeckId);
    state.frameDeckId = nextDeckId;
    return previousDeckId !== nextDeckId;
  }

  function setSlotDeckOverride(slotId, deckId) {
    const targetSlotId = String(slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return false;
    }

    const nextDeckId = normalizeFrameDeckId(deckId);
    const previousDeckId = getSlotDeckOverride(targetSlotId);
    if (!nextDeckId) {
      state.slotDeckOverrides.delete(targetSlotId);
      return Boolean(previousDeckId);
    }

    state.slotDeckOverrides.set(targetSlotId, nextDeckId);
    return previousDeckId !== nextDeckId;
  }

  function buildDeckSelectOptions(selectEl, selectedDeckId, includeDefaultOption = false) {
    if (!(selectEl instanceof HTMLSelectElement)) {
      return;
    }

    const options = getDeckOptionsList();
    const resolvedFrameDeckId = getFrameDeckId();
    const requestedDeckId = normalizeDeckIdValue(selectedDeckId);
    const normalizedSelectedDeckId = options.some((option) => option.id === requestedDeckId)
      ? requestedDeckId
      : (includeDefaultOption ? "" : resolvedFrameDeckId || options[0]?.id || "");

    selectEl.replaceChildren();
    if (includeDefaultOption) {
      const defaultOptionEl = document.createElement("option");
      defaultOptionEl.value = "";
      const defaultDeckLabel = options.find((option) => option.id === resolvedFrameDeckId)?.label || "Current";
      defaultOptionEl.textContent = `Frame Default (${defaultDeckLabel})`;
      selectEl.appendChild(defaultOptionEl);
    }

    options.forEach((option) => {
      const optionEl = document.createElement("option");
      optionEl.value = option.id;
      optionEl.textContent = option.label || option.id;
      selectEl.appendChild(optionEl);
    });

    selectEl.value = normalizedSelectedDeckId;
  }

  function buildFrameSettingsSnapshot() {
    const topModes = config.getHouseTopInfoModes?.() || {};
    const bottomModes = config.getHouseBottomInfoModes?.() || {};

    return {
      showInfo: Boolean(state.showInfo),
      frameDeckId: normalizeFrameDeckId(state.frameDeckId),
      gridZoomScale: getGridZoomScale(),
      gridZoomStepIndex: state.gridZoomStepIndex,
      houseTopCardsVisible: config.getHouseTopCardsVisible?.() !== false,
      houseBottomCardsVisible: config.getHouseBottomCardsVisible?.() !== false,
      houseTopInfoModes: HOUSE_TOP_INFO_MODE_IDS.reduce((result, mode) => {
        result[mode] = Boolean(topModes[mode]);
        return result;
      }, {}),
      houseBottomInfoModes: HOUSE_BOTTOM_INFO_MODE_IDS.reduce((result, mode) => {
        result[mode] = Boolean(bottomModes[mode]);
        return result;
      }, {})
    };
  }

  function normalizeFrameSettingsSnapshot(rawSettings) {
    const fallback = buildFrameSettingsSnapshot();
    const raw = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
    const rawZoomIndex = Number(raw.gridZoomStepIndex);
    const rawZoomScale = Number(raw.gridZoomScale);
    const normalizedZoomScale = Number.isFinite(rawZoomScale)
      ? clampFrameGridZoomScale(rawZoomScale)
      : (Number.isFinite(rawZoomIndex)
        ? clampFrameGridZoomScale(FRAME_GRID_ZOOM_STEPS[Math.max(0, Math.min(FRAME_GRID_ZOOM_STEPS.length - 1, rawZoomIndex))])
        : fallback.gridZoomScale);
    return {
      showInfo: raw.showInfo === undefined ? fallback.showInfo : Boolean(raw.showInfo),
      frameDeckId: raw.frameDeckId === undefined
        ? normalizeFrameDeckId(fallback.frameDeckId)
        : normalizeFrameDeckId(raw.frameDeckId),
      gridZoomScale: normalizedZoomScale,
      gridZoomStepIndex: Number.isFinite(rawZoomIndex)
        ? Math.max(0, Math.min(FRAME_GRID_ZOOM_STEPS.length - 1, rawZoomIndex))
        : getNearestFrameZoomStepIndex(normalizedZoomScale),
      houseTopCardsVisible: raw.houseTopCardsVisible === undefined ? fallback.houseTopCardsVisible : Boolean(raw.houseTopCardsVisible),
      houseBottomCardsVisible: raw.houseBottomCardsVisible === undefined ? fallback.houseBottomCardsVisible : Boolean(raw.houseBottomCardsVisible),
      houseTopInfoModes: HOUSE_TOP_INFO_MODE_IDS.reduce((result, mode) => {
        result[mode] = raw.houseTopInfoModes?.[mode] === undefined
          ? fallback.houseTopInfoModes[mode]
          : Boolean(raw.houseTopInfoModes[mode]);
        return result;
      }, {}),
      houseBottomInfoModes: HOUSE_BOTTOM_INFO_MODE_IDS.reduce((result, mode) => {
        result[mode] = raw.houseBottomInfoModes?.[mode] === undefined
          ? fallback.houseBottomInfoModes[mode]
          : Boolean(raw.houseBottomInfoModes[mode]);
        return result;
      }, {})
    };
  }

  function captureSlotAssignmentsSnapshot(cards = getCards()) {
    const validCardIds = new Set(Array.from(getCardMap(cards).keys()));
    return [...state.slotAssignments.entries()]
      .map(([slotId, cardId]) => ({
        slotId: String(slotId || "").trim(),
        cardId: String(cardId || "").trim(),
        isFlipped: Boolean(state.slotFlips.get(String(slotId || "").trim())),
        deckId: getSlotDeckOverride(slotId)
      }))
      .filter((entry) => isValidSlotId(entry.slotId) && validCardIds.has(entry.cardId))
      .sort((left, right) => {
        const [leftRow, leftColumn] = left.slotId.split(":").map(Number);
        const [rightRow, rightColumn] = right.slotId.split(":").map(Number);
        if (leftRow !== rightRow) {
          return leftRow - rightRow;
        }
        return leftColumn - rightColumn;
      });
  }

  function captureCustomCardsSnapshot() {
    const assignedCustomIds = new Set(
      Array.from(state.slotAssignments.values())
        .map((cardId) => String(cardId || "").trim())
        .filter((cardId) => isCustomFrameCardId(cardId))
    );

    return Array.from(state.customCards.values())
      .filter((card) => assignedCustomIds.has(getCardId(card)))
      .map((card) => ({
        id: getCardId(card),
        customText: normalizeCustomCardText(card?.customText),
        backgroundColor: normalizeCustomCardBackgroundColor(card?.backgroundColor),
        backgroundImage: normalizeCustomCardBackgroundImage(card?.backgroundImage)
      }))
      .filter((card) => card.id && (card.customText || card.backgroundColor || card.backgroundImage))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  function normalizeSavedLayoutRecord(rawLayout) {
    const label = normalizeLayoutLabel(rawLayout?.label || rawLayout?.name);
    if (!label) {
      return null;
    }

    const id = String(rawLayout?.id || "").trim() || createSavedLayoutId();
    const slotAssignments = Array.isArray(rawLayout?.slotAssignments)
      ? rawLayout.slotAssignments
          .map((entry) => ({
            slotId: String(entry?.slotId || "").trim(),
            cardId: String(entry?.cardId || "").trim(),
            isFlipped: Boolean(entry?.isFlipped),
            deckId: normalizeFrameDeckId(entry?.deckId)
          }))
          .filter((entry) => isValidSlotId(entry.slotId) && entry.cardId)
      : [];
    const customCards = Array.isArray(rawLayout?.customCards)
      ? rawLayout.customCards
          .map((entry) => normalizeSavedCustomCardRecord(entry))
          .filter(Boolean)
      : [];
    const settings = normalizeFrameSettingsSnapshot(rawLayout?.settings);
    const createdAt = String(rawLayout?.createdAt || rawLayout?.updatedAt || "").trim();
    const note = normalizeLayoutNote(rawLayout?.note);

    return {
      id,
      label,
      title: label,
      subtitle: "Saved browser layout with custom card positions, frame display settings, and optional notes.",
      statusMessage: `${label} layout loaded from browser storage.`,
      legendItems: [
        {
          title: "Saved Layout",
          description: "Custom card positions, frame settings, and notes stored only in this browser."
        }
      ],
      slotAssignments,
      customCards,
      settings,
      note,
      createdAt,
      isCustom: true
    };
  }

  function loadLayoutNotesFromStorage() {
    const rawValue = readStorageValue(FRAME_LAYOUT_NOTES_STORAGE_KEY);
    if (!rawValue) {
      state.layoutNotesById = {};
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        state.layoutNotesById = {};
        return;
      }

      state.layoutNotesById = Object.entries(parsed).reduce((result, [layoutId, note]) => {
        const normalizedId = String(layoutId || "").trim();
        const normalizedNote = normalizeLayoutNote(note);
        if (normalizedId && normalizedNote) {
          result[normalizedId] = normalizedNote;
        }
        return result;
      }, {});
    } catch (_error) {
      state.layoutNotesById = {};
    }
  }

  function loadSavedLayoutsFromStorage() {
    const rawValue = readStorageValue(FRAME_CUSTOM_LAYOUTS_STORAGE_KEY);
    if (!rawValue) {
      state.customLayouts = [];
      return;
    }

    try {
      const parsed = JSON.parse(rawValue);
      state.customLayouts = Array.isArray(parsed)
        ? parsed.map((entry) => normalizeSavedLayoutRecord(entry)).filter(Boolean)
        : [];
    } catch (_error) {
      state.customLayouts = [];
    }
  }

  function serializeSavedLayouts() {
    return state.customLayouts.map((layout) => ({
      id: layout.id,
      label: layout.label,
      slotAssignments: layout.slotAssignments,
      customCards: Array.isArray(layout.customCards) ? layout.customCards : [],
      settings: layout.settings,
      note: normalizeLayoutNote(layout.note),
      createdAt: layout.createdAt || new Date().toISOString()
    }));
  }

  function persistSavedLayouts() {
    writeStorageValue(FRAME_CUSTOM_LAYOUTS_STORAGE_KEY, JSON.stringify(serializeSavedLayouts()));
    void persistSavedLayoutsToProfile();
  }

  function canUseProfileLayoutStore() {
    return window.TarotAppConfig?.isProfileAuthorized?.() === true
      && typeof window.TarotDataService?.requestJson === "function";
  }

  async function persistSavedLayoutsToProfile() {
    if (!canUseProfileLayoutStore()) {
      return;
    }
    try {
      await window.TarotDataService.requestJson(
        "PUT",
        window.TarotDataService.buildApiUrl("/api/v1/profile/plugin-state/tarot-frame"),
        { state: { layouts: serializeSavedLayouts(), savedAt: new Date().toISOString() } }
      );
    } catch (_error) {}
  }

  async function hydrateSavedLayoutsFromProfile() {
    if (!canUseProfileLayoutStore()) {
      return;
    }
    try {
      const payload = await window.TarotDataService.requestJson(
        "GET",
        window.TarotDataService.buildApiUrl("/api/v1/profile/plugin-state/tarot-frame")
      );
      const remote = payload?.state && typeof payload.state === "object" ? payload.state : payload;
      const layouts = Array.isArray(remote?.layouts)
        ? remote.layouts.map((entry) => normalizeSavedLayoutRecord(entry)).filter(Boolean)
        : [];
      if (!layouts.length) {
        return;
      }
      state.customLayouts = layouts.sort((left, right) => String(left.label || "").localeCompare(String(right.label || "")));
      writeStorageValue(FRAME_CUSTOM_LAYOUTS_STORAGE_KEY, JSON.stringify(serializeSavedLayouts()));
      if (state.initialized) {
        syncControls();
        render();
      }
    } catch (_error) {}
  }

  function persistLayoutNotes() {
    const entries = Object.entries(state.layoutNotesById || {}).reduce((result, [layoutId, note]) => {
      const normalizedId = String(layoutId || "").trim();
      const normalizedNote = normalizeLayoutNote(note);
      if (normalizedId && normalizedNote) {
        result[normalizedId] = normalizedNote;
      }
      return result;
    }, {});

    if (!Object.keys(entries).length) {
      removeStorageValue(FRAME_LAYOUT_NOTES_STORAGE_KEY);
      return true;
    }

    return writeStorageValue(FRAME_LAYOUT_NOTES_STORAGE_KEY, JSON.stringify(entries));
  }

  function persistActiveLayoutId(layoutId = state.currentLayoutId) {
    const nextId = String(layoutId || "").trim();
    if (!nextId) {
      removeStorageValue(FRAME_ACTIVE_LAYOUT_STORAGE_KEY);
      return;
    }
    writeStorageValue(FRAME_ACTIVE_LAYOUT_STORAGE_KEY, nextId);
  }

  function restoreActiveLayoutId() {
    const storedId = String(readStorageValue(FRAME_ACTIVE_LAYOUT_STORAGE_KEY) || "").trim();
    if (!storedId) {
      return;
    }

    const nextLayout = getLayoutDefinition(storedId);
    state.currentLayoutId = nextLayout.id;
  }

  function persistCardPickerQuery(query = state.cardPicker.query) {
    writeStorageValue(FRAME_CARD_PICKER_QUERY_STORAGE_KEY, String(query || ""));
  }

  function restoreCardPickerQuery() {
    state.cardPicker.query = String(readStorageValue(FRAME_CARD_PICKER_QUERY_STORAGE_KEY) || "");
  }

  function getLayoutNote(layoutId = state.currentLayoutId) {
    const nextLayoutId = String(layoutId || "").trim();
    if (!nextLayoutId) {
      return "";
    }

    const storedNote = normalizeLayoutNote(state.layoutNotesById?.[nextLayoutId]);
    if (storedNote) {
      return storedNote;
    }

    return normalizeLayoutNote(getSavedLayout(nextLayoutId)?.note);
  }

  function setLayoutNote(layoutId, note, options = {}) {
    const nextLayoutId = String(layoutId || "").trim();
    if (!nextLayoutId) {
      return;
    }

    const normalizedNote = normalizeLayoutNote(note);
    if (normalizedNote) {
      state.layoutNotesById[nextLayoutId] = normalizedNote;
    } else {
      delete state.layoutNotesById[nextLayoutId];
    }

    const savedLayout = getSavedLayout(nextLayoutId);
    if (savedLayout) {
      savedLayout.note = normalizedNote;
      persistSavedLayouts();
    }

    persistLayoutNotes();

    if (options.updateUi !== false) {
      updateLayoutNotesUi();
    }
  }

  function getLayoutNotePlaceholder(layoutDefinition = getLayoutDefinition()) {
    if (layoutDefinition?.id === "house") {
      return "Add placement notes, reading rules, or reminders for this House of Cards arrangement.";
    }
    return "Add your own notes for this layout: intentions, spread logic, card placement rules, or reminders.";
  }

  function updateLayoutNotesUi() {
    const { tarotFrameOverviewEl } = getElements();
    if (!(tarotFrameOverviewEl instanceof HTMLElement)) {
      return;
    }

    const currentNote = getLayoutNote();

    const noteFieldEl = tarotFrameOverviewEl.querySelector("#tarot-frame-layout-note");
    if (noteFieldEl instanceof HTMLTextAreaElement) {
      noteFieldEl.value = currentNote;
      noteFieldEl.placeholder = getLayoutNotePlaceholder(getLayoutDefinition());
      noteFieldEl.disabled = Boolean(state.exportInProgress);
    }

    const noteClearEl = tarotFrameOverviewEl.querySelector("[data-frame-note-clear='true']");
    if (noteClearEl instanceof HTMLButtonElement) {
      noteClearEl.disabled = !currentNote || Boolean(state.exportInProgress);
    }

    const noteBadgeEl = tarotFrameOverviewEl.querySelector(".tarot-frame-notes-badge");
    if (noteBadgeEl instanceof HTMLElement) {
      noteBadgeEl.textContent = currentNote ? "Saved" : "Optional";
    }
  }

  function applyLayoutGuideUi() {
    const { tarotFrameOverviewEl } = getElements();
    if (!(tarotFrameOverviewEl instanceof HTMLElement)) {
      return;
    }

    tarotFrameOverviewEl.hidden = !state.layoutGuideVisible;
  }

  function applyGridFocusModeUi() {
    const {
      tarotFrameSectionEl,
      tarotFrameViewEl,
      tarotFrameFocusExitEl,
      tarotFrameSettingsPanelEl
    } = getElements();

    if (tarotFrameSectionEl instanceof HTMLElement) {
      tarotFrameSectionEl.classList.toggle("is-grid-focus", Boolean(state.gridFocusMode));
    }

    document.body.classList.toggle("is-tarot-frame-focus-lock", Boolean(state.gridFocusMode));

    // Move settings panel to view for proper absolute positioning in immersive
    // mode — but never when the shared overlay owns it, or it gets yanked out
    // of the overlay (leaving an empty "Frame" header).
    if (!state.settingsOverlayOpen && tarotFrameViewEl && tarotFrameSettingsPanelEl && state.gridFocusMode) {
      if (tarotFrameSettingsPanelEl.parentElement !== tarotFrameViewEl) {
        tarotFrameViewEl.appendChild(tarotFrameSettingsPanelEl);
      }
    }

    if (tarotFrameFocusExitEl) {
      tarotFrameFocusExitEl.hidden = false;
      tarotFrameFocusExitEl.setAttribute("aria-pressed", state.settingsOpen ? "true" : "false");
      tarotFrameFocusExitEl.classList.toggle("is-active", Boolean(state.settingsOpen));
      tarotFrameFocusExitEl.textContent = "⚙";
      tarotFrameFocusExitEl.title = state.settingsOpen ? "Hide settings" : "Settings";
      tarotFrameFocusExitEl.setAttribute("aria-label", tarotFrameFocusExitEl.title);
      tarotFrameFocusExitEl.disabled = Boolean(state.exportInProgress);
    }
  }

  function setGridFocusMode(nextFocus) {
    // Immersive full-grid mode is always on for the Frame (playful canvas)
    const shouldFocus = true;
    if (state.gridFocusMode === shouldFocus) {
      applyGridFocusModeUi();
      return;
    }

    state.gridFocusMode = shouldFocus;
    state.settingsOpen = false;
    state.layoutMenuOpen = false;
    finishPanGesture();
    clearLongPressGesture();
    if (state.cardPicker.open) {
      closeCardPicker();
    }
    cleanupDrag();
    syncControls();
    updateViewportInteractionState();
    setStatus("");
  }

  function applyFrameSettingsSnapshot(rawSettings) {
    const settings = normalizeFrameSettingsSnapshot(rawSettings);
    state.showInfo = settings.showInfo;
    state.frameDeckId = normalizeFrameDeckId(settings.frameDeckId);
    state.gridZoomScale = settings.gridZoomScale;
    state.gridZoomStepIndex = settings.gridZoomStepIndex;
    config.setHouseTopCardsVisible?.(settings.houseTopCardsVisible);
    config.setHouseBottomCardsVisible?.(settings.houseBottomCardsVisible);
    HOUSE_TOP_INFO_MODE_IDS.forEach((mode) => {
      config.setHouseTopInfoMode?.(mode, settings.houseTopInfoModes[mode]);
    });
    HOUSE_BOTTOM_INFO_MODE_IDS.forEach((mode) => {
      config.setHouseBottomInfoMode?.(mode, settings.houseBottomInfoModes[mode]);
    });
  }

  function getSuitSortIndex(suit) {
    const suitIndex = EXTRA_SUIT_ORDER.indexOf(normalizeKey(suit));
    return suitIndex === -1 ? EXTRA_SUIT_ORDER.length : suitIndex;
  }

  function getMinorRankSortIndex(rank) {
    const rankName = String(rank || "").trim();
    const lookup = {
      Two: 2,
      Three: 3,
      Four: 4,
      Five: 5,
      Six: 6,
      Seven: 7,
      Eight: 8,
      Nine: 9,
      Ten: 10
    };
    return lookup[rankName] || 999;
  }

  function getCourtRankSortIndex(rank) {
    const lookup = {
      Knight: 0,
      Queen: 1,
      Prince: 2,
      Princess: 3
    };
    return lookup[String(rank || "").trim()] ?? 999;
  }

  function getGridViewportElement() {
    const { tarotFrameBoardEl } = getElements();
    const viewportEl = tarotFrameBoardEl?.querySelector(".tarot-frame-grid-viewport");
    return viewportEl instanceof HTMLElement ? viewportEl : null;
  }

  function isLayoutNoteTextarea(element) {
    return element instanceof HTMLTextAreaElement && element.id === "tarot-frame-layout-note";
  }

  function blurLayoutNoteForBoardInteraction(target) {
    const activeElement = document.activeElement;
    if (!isLayoutNoteTextarea(activeElement)) {
      return;
    }

    if (target instanceof Node && target === activeElement) {
      return;
    }

    activeElement.blur();
  }

  function updateViewportInteractionState() {
    const viewportEl = getGridViewportElement();
    if (!(viewportEl instanceof HTMLElement)) {
      return;
    }

    viewportEl.classList.toggle("is-panning", Boolean(state.panGesture));
    viewportEl.classList.toggle(
      "is-touch-gesture-active",
      Boolean(state.pinchGesture || (state.panGesture && state.panGesture.source === "touch"))
    );
  }

  function syncActiveTouchGestureCapture() {
    const shouldCapture = Boolean(state.pinchGesture || (state.panGesture && state.panGesture.source === "touch"));
    if (shouldCapture === activeTouchGestureCapture) {
      return;
    }

    activeTouchGestureCapture = shouldCapture;
    const method = shouldCapture ? "addEventListener" : "removeEventListener";
    document[method]("touchmove", handleBoardTouchMove, { passive: false });
    document[method]("touchend", handleBoardTouchEnd, { passive: false });
    document[method]("touchcancel", handleBoardTouchCancel, { passive: false });
  }

  function createCardPickerElements() {
    if (cardPickerEl) {
      return;
    }

    cardPickerEl = document.createElement("div");
    cardPickerEl.className = "tarot-frame-card-picker";
    cardPickerEl.hidden = true;

    const headEl = document.createElement("div");
    headEl.className = "tarot-frame-card-picker-head";

    cardPickerTitleEl = document.createElement("div");
    cardPickerTitleEl.className = "tarot-frame-card-picker-title";
    cardPickerTitleEl.textContent = "Browse Stock Cards";

    const closeButtonEl = document.createElement("button");
    closeButtonEl.type = "button";
    closeButtonEl.className = "tarot-frame-card-picker-close";
    closeButtonEl.textContent = "Close";
    closeButtonEl.addEventListener("click", () => {
      closeCardPicker();
    });

    headEl.append(cardPickerTitleEl, closeButtonEl);

    cardPickerSearchWrapEl = document.createElement("label");
    cardPickerSearchWrapEl.className = "tarot-frame-card-picker-search";
    const searchLabelEl = document.createElement("span");
    searchLabelEl.textContent = "Search Cards, Associations, or Labels";
    cardPickerSearchEl = document.createElement("input");
    cardPickerSearchEl.type = "search";
    cardPickerSearchEl.placeholder = "Find by card, planet, sign, decan, label...";
    cardPickerSearchEl.autocomplete = "off";
    cardPickerSearchEl.spellcheck = false;
    cardPickerSearchEl.addEventListener("input", () => {
      state.cardPicker.query = String(cardPickerSearchEl.value || "");
      persistCardPickerQuery();
      renderCardPickerSections();
    });
    cardPickerSearchWrapEl.append(searchLabelEl, cardPickerSearchEl);

    cardPickerSectionsEl = document.createElement("div");
    cardPickerSectionsEl.className = "tarot-frame-card-picker-sections";
    cardPickerEl.append(headEl, cardPickerSearchWrapEl, cardPickerSectionsEl);
    cardPickerEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const cardOption = target.closest(".tarot-frame-card-picker-option[data-card-id]");
      if (!(cardOption instanceof HTMLButtonElement)) {
        return;
      }

      placeCardInSlot(state.cardPicker.slotId, cardOption.dataset.cardId);
      closeCardPicker();
    });
    document.body.appendChild(cardPickerEl);
  }

  function createCardInsertMenuElements() {
    if (cardInsertMenuEl) {
      return;
    }

    cardInsertMenuEl = document.createElement("div");
    cardInsertMenuEl.className = "tarot-frame-card-insert-menu";
    cardInsertMenuEl.hidden = true;

    const libraryButtonEl = document.createElement("button");
    libraryButtonEl.type = "button";
    libraryButtonEl.className = "tarot-frame-card-insert-menu-item";
    libraryButtonEl.dataset.cardInsertAction = "library";
    libraryButtonEl.textContent = "Card > Library";

    const customButtonEl = document.createElement("button");
    customButtonEl.type = "button";
    customButtonEl.className = "tarot-frame-card-insert-menu-item";
    customButtonEl.dataset.cardInsertAction = "custom";
    customButtonEl.textContent = "Card > Custom";

    cardInsertMenuEl.append(libraryButtonEl, customButtonEl);
    cardInsertMenuEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const actionButton = target.closest("[data-card-insert-action]");
      if (!(actionButton instanceof HTMLButtonElement)) {
        return;
      }

      const slotId = String(state.cardInsertMenu.slotId || "").trim();
      const anchor = getCardPickerAnchor(slotId);
      closeCardInsertMenu();
      if (actionButton.dataset.cardInsertAction === "custom") {
        openCustomCardEditor(slotId, "", { anchorX: anchor.x, anchorY: anchor.y, reposition: true });
        return;
      }

      openCardPicker(slotId, anchor.x, anchor.y);
    });

    document.body.appendChild(cardInsertMenuEl);
  }

  function createCustomCardEditorElements() {
    if (cardCustomEditorEl) {
      return;
    }

    cardCustomEditorEl = document.createElement("div");
    cardCustomEditorEl.className = "tarot-frame-card-custom-editor";
    cardCustomEditorEl.hidden = true;

    const headEl = document.createElement("div");
    headEl.className = "tarot-frame-card-picker-head";

    cardCustomEditorTitleEl = document.createElement("div");
    cardCustomEditorTitleEl.className = "tarot-frame-card-picker-title";
    cardCustomEditorTitleEl.textContent = "Create Custom Card";

    const closeButtonEl = document.createElement("button");
    closeButtonEl.type = "button";
    closeButtonEl.className = "tarot-frame-card-picker-close";
    closeButtonEl.textContent = "Close";
    closeButtonEl.addEventListener("click", () => {
      const slotId = String(state.cardPicker.slotId || "").trim();
      const editingCardId = String(state.cardPicker.editingCardId || "").trim();
      closeCustomCardEditor();
      if (!editingCardId && slotId) {
        const anchor = getCardPickerAnchor(slotId);
        openCardInsertMenu(slotId, anchor.x, anchor.y);
      }
    });

    headEl.append(cardCustomEditorTitleEl, closeButtonEl);

    const editorEl = document.createElement("div");
    editorEl.className = "tarot-frame-card-picker-editor";

    cardPickerEditorHeadingEl = document.createElement("div");
    cardPickerEditorHeadingEl.className = "tarot-frame-card-picker-editor-heading";
    const editorHeadingTitleEl = document.createElement("strong");
    editorHeadingTitleEl.textContent = "Custom Card";
    const editorHeadingCopyEl = document.createElement("span");
    editorHeadingCopyEl.textContent = "Leave text blank if you want a color or image-only card.";
    cardPickerEditorHeadingEl.append(editorHeadingTitleEl, editorHeadingCopyEl);

    const titleFieldEl = document.createElement("label");
    titleFieldEl.className = "tarot-frame-card-picker-editor-field";
    const titleLabelEl = document.createElement("span");
    titleLabelEl.textContent = "Title";
    cardPickerEditorTitleEl = document.createElement("input");
    cardPickerEditorTitleEl.type = "text";
    cardPickerEditorTitleEl.maxLength = 120;
    cardPickerEditorTitleEl.placeholder = "Optional title";
    titleFieldEl.append(titleLabelEl, cardPickerEditorTitleEl);

    const subtitleFieldEl = document.createElement("label");
    subtitleFieldEl.className = "tarot-frame-card-picker-editor-field";
    const subtitleLabelEl = document.createElement("span");
    subtitleLabelEl.textContent = "Subtitle / Notes";
    cardPickerEditorSubtitleEl = document.createElement("textarea");
    cardPickerEditorSubtitleEl.rows = 3;
    cardPickerEditorSubtitleEl.maxLength = 240;
    cardPickerEditorSubtitleEl.placeholder = "Optional secondary text";
    subtitleFieldEl.append(subtitleLabelEl, cardPickerEditorSubtitleEl);

    const visualGridEl = document.createElement("div");
    visualGridEl.className = "tarot-frame-card-picker-editor-grid";

    const colorFieldEl = document.createElement("label");
    colorFieldEl.className = "tarot-frame-card-picker-editor-field";
    const colorLabelEl = document.createElement("span");
    colorLabelEl.textContent = "Background Color";
    cardPickerEditorColorEl = document.createElement("input");
    cardPickerEditorColorEl.type = "color";
    cardPickerEditorColorEl.value = "#164e63";
    colorFieldEl.append(colorLabelEl, cardPickerEditorColorEl);

    const imageFieldEl = document.createElement("label");
    imageFieldEl.className = "tarot-frame-card-picker-editor-field";
    const imageLabelEl = document.createElement("span");
    imageLabelEl.textContent = "Background Image";
    cardPickerEditorImageUploadEl = document.createElement("input");
    cardPickerEditorImageUploadEl.type = "file";
    cardPickerEditorImageUploadEl.accept = "image/*";
    cardPickerEditorImageEl = document.createElement("span");
    cardPickerEditorImageEl.className = "tarot-frame-card-picker-editor-image-meta";
    cardPickerEditorImageEl.textContent = "No image selected.";
    imageFieldEl.append(imageLabelEl, cardPickerEditorImageUploadEl, cardPickerEditorImageEl);

    visualGridEl.append(colorFieldEl, imageFieldEl);

    const imageActionsEl = document.createElement("div");
    imageActionsEl.className = "tarot-frame-card-picker-editor-inline-actions";
    cardPickerEditorImageClearEl = document.createElement("button");
    cardPickerEditorImageClearEl.type = "button";
    cardPickerEditorImageClearEl.className = "tarot-frame-card-picker-editor-clear";
    cardPickerEditorImageClearEl.textContent = "Remove Image";
    imageActionsEl.appendChild(cardPickerEditorImageClearEl);

    const previewWrapEl = document.createElement("div");
    previewWrapEl.className = "tarot-frame-card-picker-editor-preview-wrap";
    const previewLabelEl = document.createElement("span");
    previewLabelEl.className = "tarot-frame-card-picker-editor-preview-label";
    previewLabelEl.textContent = "Preview";
    cardPickerEditorPreviewEl = document.createElement("div");
    cardPickerEditorPreviewEl.className = "tarot-frame-card-picker-editor-preview";
    previewWrapEl.append(previewLabelEl, cardPickerEditorPreviewEl);

    const editorActionsEl = document.createElement("div");
    editorActionsEl.className = "tarot-frame-card-picker-editor-actions";
    const editorCancelEl = document.createElement("button");
    editorCancelEl.type = "button";
    editorCancelEl.className = "tarot-frame-card-picker-editor-cancel";
    editorCancelEl.dataset.cardPickerEditorCancel = "true";
    editorCancelEl.textContent = "Back";
    cardPickerEditorSaveEl = document.createElement("button");
    cardPickerEditorSaveEl.type = "button";
    cardPickerEditorSaveEl.className = "tarot-frame-card-picker-editor-save";
    cardPickerEditorSaveEl.dataset.cardPickerEditorSave = "true";
    cardPickerEditorSaveEl.textContent = "Save Custom Card";
    cardPickerEditorRemoveEl = document.createElement("button");
    cardPickerEditorRemoveEl.type = "button";
    cardPickerEditorRemoveEl.className = "tarot-frame-card-picker-editor-remove";
    cardPickerEditorRemoveEl.dataset.cardPickerEditorRemove = "true";
    cardPickerEditorRemoveEl.textContent = "Delete Card";
    cardPickerEditorRemoveEl.hidden = true;
    editorActionsEl.append(editorCancelEl, cardPickerEditorSaveEl, cardPickerEditorRemoveEl);

    [cardPickerEditorTitleEl, cardPickerEditorSubtitleEl].forEach((field) => {
      field.addEventListener("input", () => {
        updateCustomCardEditorPreview();
      });
    });

    cardPickerEditorColorEl.addEventListener("input", () => {
      cardPickerEditorColorEl.dataset.explicit = "true";
      updateCustomCardEditorPreview();
    });

    cardPickerEditorImageUploadEl.addEventListener("change", () => {
      const file = cardPickerEditorImageUploadEl.files?.[0] || null;
      if (!file) {
        return;
      }
      if (Number(file.size || 0) > 1_500_000) {
        window.alert("Please choose an image under about 1.5 MB so it can be stored with the layout.");
        cardPickerEditorImageUploadEl.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        state.cardPicker.editorImageData = normalizeCustomCardBackgroundImage(reader.result);
        cardPickerEditorImageUploadEl.value = "";
        updateCustomCardEditorPreview();
      };
      reader.onerror = () => {
        window.alert("Unable to read that image file.");
        cardPickerEditorImageUploadEl.value = "";
      };
      reader.readAsDataURL(file);
    });

    cardPickerEditorImageClearEl.addEventListener("click", () => {
      state.cardPicker.editorImageData = "";
      if (cardPickerEditorImageUploadEl) {
        cardPickerEditorImageUploadEl.value = "";
      }
      updateCustomCardEditorPreview();
    });

    editorEl.append(
      cardPickerEditorHeadingEl,
      titleFieldEl,
      subtitleFieldEl,
      visualGridEl,
      imageActionsEl,
      previewWrapEl,
      editorActionsEl
    );

    cardCustomEditorEl.append(headEl, editorEl);
    cardCustomEditorEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const editorCancel = target.closest("[data-card-picker-editor-cancel='true']");
      if (editorCancel instanceof HTMLButtonElement) {
        const slotId = String(state.cardPicker.slotId || "").trim();
        const editingCardId = String(state.cardPicker.editingCardId || "").trim();
        closeCustomCardEditor();
        if (!editingCardId && slotId) {
          const anchor = getCardPickerAnchor(slotId);
          openCardInsertMenu(slotId, anchor.x, anchor.y);
        }
        return;
      }

      const editorSave = target.closest("[data-card-picker-editor-save='true']");
      if (editorSave instanceof HTMLButtonElement) {
        const didSave = submitCustomCardEditor();
        if (didSave) {
          closeCustomCardEditor();
        }
        return;
      }

      const editorRemove = target.closest("[data-card-picker-editor-remove='true']");
      if (editorRemove instanceof HTMLButtonElement) {
        const didRemove = removeEditedCustomCard();
        if (didRemove) {
          closeCustomCardEditor();
        }
      }
    });

    document.body.appendChild(cardCustomEditorEl);
  }

  function closeCardPicker() {
    state.cardPicker.open = false;
    state.cardPicker.slotId = "";
    state.cardPicker.mode = "browse";
    state.cardPicker.editingCardId = "";
    state.cardPicker.editorImageData = "";
    if (cardPickerSearchEl) {
      cardPickerSearchEl.value = state.cardPicker.query;
    }
    if (cardPickerEl) {
      cardPickerEl.hidden = true;
    }
    if (cardPickerEditorImageUploadEl) {
      cardPickerEditorImageUploadEl.value = "";
    }
  }

  function positionCardInsertMenu(anchorX, anchorY) {
    if (!(cardInsertMenuEl instanceof HTMLElement)) {
      return;
    }

    cardInsertMenuEl.hidden = false;
    cardInsertMenuEl.style.visibility = "hidden";
    requestAnimationFrame(() => {
      if (!(cardInsertMenuEl instanceof HTMLElement)) {
        return;
      }

      const panelWidth = cardInsertMenuEl.offsetWidth || 220;
      const panelHeight = cardInsertMenuEl.offsetHeight || 120;
      const margin = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = Math.min(Math.max(anchorX + 10, margin), viewportWidth - panelWidth - margin);
      let top = Math.min(Math.max(anchorY + 10, margin), viewportHeight - panelHeight - margin);
      if (top > viewportHeight - panelHeight - margin) {
        top = Math.max(margin, anchorY - panelHeight - 10);
      }

      cardInsertMenuEl.style.left = `${left}px`;
      cardInsertMenuEl.style.top = `${top}px`;
      cardInsertMenuEl.style.visibility = "visible";
    });
  }

  function closeCardInsertMenu() {
    state.cardInsertMenu.open = false;
    state.cardInsertMenu.slotId = "";
    if (cardInsertMenuEl) {
      cardInsertMenuEl.hidden = true;
    }
  }

  function createCardActionMenuElements() {
    if (cardActionMenuEl) {
      return;
    }

    cardActionMenuEl = document.createElement("div");
    cardActionMenuEl.className = "tarot-frame-card-action-menu";
    cardActionMenuEl.hidden = true;

    cardActionMenuSelectEl = document.createElement("button");
    cardActionMenuSelectEl.type = "button";
    cardActionMenuSelectEl.className = "tarot-frame-card-action-menu-item";
    cardActionMenuSelectEl.dataset.cardAction = "select";
    cardActionMenuSelectEl.textContent = "Select Multiple";

    cardActionMenuFlipEl = document.createElement("button");
    cardActionMenuFlipEl.type = "button";
    cardActionMenuFlipEl.className = "tarot-frame-card-action-menu-item";
    cardActionMenuFlipEl.dataset.cardAction = "flip";
    cardActionMenuFlipEl.textContent = "Flip Card";

    cardActionMenuOpenEl = document.createElement("button");
    cardActionMenuOpenEl.type = "button";
    cardActionMenuOpenEl.className = "tarot-frame-card-action-menu-item";
    cardActionMenuOpenEl.dataset.cardAction = "open";
    cardActionMenuOpenEl.textContent = "Open Card";

    cardActionMenuRemoveEl = document.createElement("button");
    cardActionMenuRemoveEl.type = "button";
    cardActionMenuRemoveEl.className = "tarot-frame-card-action-menu-item";
    cardActionMenuRemoveEl.dataset.cardAction = "remove";
    cardActionMenuRemoveEl.textContent = "Remove Card";

    const cardActionMenuDeckWrapEl = document.createElement("label");
    cardActionMenuDeckWrapEl.className = "tarot-frame-card-action-deck";
    const cardActionMenuDeckLabelEl = document.createElement("span");
    cardActionMenuDeckLabelEl.textContent = "Card Deck";
    cardActionMenuDeckSelectEl = document.createElement("select");
    cardActionMenuDeckSelectEl.className = "tarot-frame-card-action-deck-select";
    cardActionMenuDeckWrapEl.append(cardActionMenuDeckLabelEl, cardActionMenuDeckSelectEl);

    const cardActionMenuDeckActionsEl = document.createElement("div");
    cardActionMenuDeckActionsEl.className = "tarot-frame-card-action-deck-actions";
    cardActionMenuDeckApplyEl = document.createElement("button");
    cardActionMenuDeckApplyEl.type = "button";
    cardActionMenuDeckApplyEl.className = "tarot-frame-card-action-menu-item";
    cardActionMenuDeckApplyEl.dataset.cardAction = "deck-apply";
    cardActionMenuDeckApplyEl.textContent = "Apply Deck";
    cardActionMenuDeckResetEl = document.createElement("button");
    cardActionMenuDeckResetEl.type = "button";
    cardActionMenuDeckResetEl.className = "tarot-frame-card-action-menu-item";
    cardActionMenuDeckResetEl.dataset.cardAction = "deck-reset";
    cardActionMenuDeckResetEl.textContent = "Use Frame Deck";
    cardActionMenuDeckActionsEl.append(cardActionMenuDeckApplyEl, cardActionMenuDeckResetEl);

    cardActionMenuEl.append(
      cardActionMenuSelectEl,
      cardActionMenuFlipEl,
      cardActionMenuOpenEl,
      cardActionMenuRemoveEl,
      cardActionMenuDeckWrapEl,
      cardActionMenuDeckActionsEl
    );
    cardActionMenuEl.addEventListener("pointerdown", () => {
      state.cardActionMenu.clickArmed = true;
    });
    cardActionMenuEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!state.cardActionMenu.clickArmed) {
        event.preventDefault();
        return;
      }

      state.cardActionMenu.clickArmed = false;

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const actionButton = target.closest("[data-card-action]");
      if (!(actionButton instanceof HTMLButtonElement)) {
        return;
      }

      const slotId = String(state.cardActionMenu.slotId || "").trim();
      const cardId = String(state.cardActionMenu.cardId || "").trim();
      const action = String(actionButton.dataset.cardAction || "").trim();

      if (action === "select") {
        closeCardActionMenu();
        const selectionUpdate = setSelectedSlotIds(
          isSlotSelected(slotId)
            ? getSelectedSlotIds().filter((selectedSlotId) => selectedSlotId !== slotId)
            : [...getSelectedSlotIds(), slotId]
        );
        setStatus(buildSelectionStatusMessage(selectionUpdate.slotIds.length));
        return;
      }

      if (action === "flip") {
        closeCardActionMenu();
        toggleCardFlip(slotId);
        return;
      }

      if (action === "remove") {
        closeCardActionMenu();
        const removedCard = removeCardFromSlot(slotId);
        if (removedCard) {
          render({ preserveViewport: true });
          setStatus(`${getDisplayCardName(removedCard, slotId)} removed from ${describeSlot(slotId)}.`);
        }
        return;
      }

      if (action === "deck-apply") {
        const selectedDeckId = normalizeFrameDeckId(cardActionMenuDeckSelectEl?.value);
        const changed = setSlotDeckOverride(slotId, selectedDeckId);
        closeCardActionMenu();
        if (changed) {
          render({ preserveViewport: true });
          const card = getCardById(cardId);
          if (selectedDeckId) {
            const deckLabel = getDeckOptionsList().find((option) => option.id === selectedDeckId)?.label || selectedDeckId;
            setStatus(`${getDisplayCardName(card, slotId)} now uses the ${deckLabel} deck at ${describeSlot(slotId)}.`);
          } else {
            const frameDeckLabel = getDeckOptionsList().find((option) => option.id === getFrameDeckId())?.label || "frame default";
            setStatus(`${getDisplayCardName(card, slotId)} now follows the frame deck (${frameDeckLabel}) at ${describeSlot(slotId)}.`);
          }
        }
        return;
      }

      if (action === "deck-reset") {
        const changed = setSlotDeckOverride(slotId, "");
        closeCardActionMenu();
        if (changed) {
          render({ preserveViewport: true });
          const card = getCardById(cardId);
          const frameDeckLabel = getDeckOptionsList().find((option) => option.id === getFrameDeckId())?.label || "frame default";
          setStatus(`${getDisplayCardName(card, slotId)} now follows the frame deck (${frameDeckLabel}) at ${describeSlot(slotId)}.`);
        }
        return;
      }

      if (action === "open") {
        closeCardActionMenu();
        openCardLightbox(cardId, slotId);
      }
    });

    document.body.appendChild(cardActionMenuEl);
  }

  function positionCardActionMenu(anchorX, anchorY) {
    if (!(cardActionMenuEl instanceof HTMLElement)) {
      return;
    }

    cardActionMenuEl.hidden = false;
    cardActionMenuEl.style.visibility = "hidden";
    requestAnimationFrame(() => {
      if (!(cardActionMenuEl instanceof HTMLElement)) {
        return;
      }

      const panelWidth = cardActionMenuEl.offsetWidth || 220;
      const panelHeight = cardActionMenuEl.offsetHeight || 120;
      const margin = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = Math.min(Math.max(anchorX + 10, margin), viewportWidth - panelWidth - margin);
      let top = Math.min(Math.max(anchorY + 10, margin), viewportHeight - panelHeight - margin);
      if (top > viewportHeight - panelHeight - margin) {
        top = Math.max(margin, anchorY - panelHeight - 10);
      }

      cardActionMenuEl.style.left = `${left}px`;
      cardActionMenuEl.style.top = `${top}px`;
      cardActionMenuEl.style.visibility = "visible";
    });
  }

  function closeCardActionMenu() {
    state.cardActionMenu.open = false;
    state.cardActionMenu.slotId = "";
    state.cardActionMenu.cardId = "";
    state.cardActionMenu.ignoreClickUntil = 0;
    state.cardActionMenu.clickArmed = false;
    if (cardActionMenuEl) {
      cardActionMenuEl.hidden = true;
    }
  }

  function syncCardActionMenu(slotId, cardId) {
    const targetSlotId = String(slotId || state.cardActionMenu.slotId || "").trim();
    const targetCardId = String(cardId || state.cardActionMenu.cardId || "").trim();
    const card = getCardById(targetCardId);
    const flipped = isSlotFlipped(targetSlotId);

    if (cardActionMenuSelectEl) {
      cardActionMenuSelectEl.textContent = isSlotSelected(targetSlotId)
        ? "Remove From Selection"
        : (getSelectedSlotIds().length ? "Add To Selection" : "Select Multiple");
    }

    if (cardActionMenuFlipEl) {
      cardActionMenuFlipEl.textContent = flipped ? "Flip Upright" : "Flip Upside Down";
    }
    if (cardActionMenuOpenEl) {
      cardActionMenuOpenEl.textContent = isCustomFrameCard(card) ? "Edit Custom Card" : "Open Card";
    }
    if (cardActionMenuRemoveEl) {
      cardActionMenuRemoveEl.textContent = "Remove Card";
    }

    buildDeckSelectOptions(cardActionMenuDeckSelectEl, getSlotDeckOverride(targetSlotId), true);
    if (cardActionMenuDeckSelectEl) {
      cardActionMenuDeckSelectEl.disabled = Boolean(state.exportInProgress);
    }
    if (cardActionMenuDeckResetEl) {
      cardActionMenuDeckResetEl.disabled = !getSlotDeckOverride(targetSlotId) || Boolean(state.exportInProgress);
    }
    if (cardActionMenuDeckApplyEl) {
      cardActionMenuDeckApplyEl.disabled = Boolean(state.exportInProgress);
    }
  }

  function openCardActionMenu(slotId, cardId, anchorX, anchorY, options = {}) {
    const targetSlotId = String(slotId || "").trim();
    const targetCardId = String(cardId || "").trim();
    if (!isValidSlotId(targetSlotId) || !targetCardId) {
      return;
    }

    const sameMenuAlreadyOpen = Boolean(
      state.cardActionMenu.open
      && state.cardActionMenu.slotId === targetSlotId
      && state.cardActionMenu.cardId === targetCardId
    );
    const now = Number(window.performance.now()) || 0;
    if (sameMenuAlreadyOpen && now < Number(state.cardActionMenu.ignoreClickUntil || 0)) {
      return;
    }

    createCardActionMenuElements();
    closeCardInsertMenu();
    closeCardPicker();
    state.cardActionMenu.open = true;
    state.cardActionMenu.slotId = targetSlotId;
    state.cardActionMenu.cardId = targetCardId;
    state.cardActionMenu.ignoreClickUntil = options.fromTouchLongPress
      ? now + 500
      : (sameMenuAlreadyOpen ? Number(state.cardActionMenu.ignoreClickUntil || 0) : 0);
    state.cardActionMenu.clickArmed = !options.fromTouchLongPress;
    syncCardActionMenu(targetSlotId, targetCardId);
    positionCardActionMenu(
      options.fromTouchLongPress ? anchorX + 72 : anchorX,
      options.fromTouchLongPress ? anchorY + 72 : anchorY
    );
    if (options.focusFirstButton === true) {
      requestAnimationFrame(() => {
        cardActionMenuFlipEl?.focus?.({ preventScroll: true });
      });
    }
  }

  function positionCustomCardEditor(anchorX, anchorY) {
    if (!(cardCustomEditorEl instanceof HTMLElement)) {
      return;
    }

    cardCustomEditorEl.hidden = false;
    cardCustomEditorEl.style.visibility = "hidden";
    requestAnimationFrame(() => {
      if (!(cardCustomEditorEl instanceof HTMLElement)) {
        return;
      }

      const panelWidth = cardCustomEditorEl.offsetWidth || 360;
      const panelHeight = cardCustomEditorEl.offsetHeight || 520;
      const margin = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = Math.min(Math.max(anchorX + 10, margin), viewportWidth - panelWidth - margin);
      let top = Math.min(Math.max(anchorY + 10, margin), viewportHeight - panelHeight - margin);
      if (top > viewportHeight - panelHeight - margin) {
        top = Math.max(margin, anchorY - panelHeight - 10);
      }
      if (viewportWidth <= 760) {
        left = Math.max(margin, Math.round((viewportWidth - panelWidth) / 2));
      }

      cardCustomEditorEl.style.left = `${left}px`;
      cardCustomEditorEl.style.top = `${top}px`;
      cardCustomEditorEl.style.visibility = "visible";
    });
  }

  function closeCustomCardEditor() {
    state.cardPicker.editingCardId = "";
    state.cardPicker.editorImageData = "";
    if (cardCustomEditorEl) {
      cardCustomEditorEl.hidden = true;
    }
    if (cardPickerEditorImageUploadEl) {
      cardPickerEditorImageUploadEl.value = "";
    }
  }

  function openCardInsertMenu(slotId, anchorX, anchorY) {
    const targetSlotId = String(slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return;
    }

    createCardInsertMenuElements();
    closeCardPicker();
    closeCustomCardEditor();
    state.cardInsertMenu.open = true;
    state.cardInsertMenu.slotId = targetSlotId;
    positionCardInsertMenu(anchorX, anchorY);
    requestAnimationFrame(() => {
      cardInsertMenuEl?.querySelector("[data-card-insert-action='library']")?.focus?.({ preventScroll: true });
    });
  }

  function appendCardPickerSearchValue(terms, value) {
    const normalizedValue = normalizeLabelText(value);
    if (!normalizedValue) {
      return;
    }

    terms.add(normalizeKey(normalizedValue));
  }

  function appendCardPickerSearchValuesFromObject(terms, value, depth = 0) {
    if (depth > 4 || value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        appendCardPickerSearchValuesFromObject(terms, entry, depth + 1);
      });
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach((entry) => {
        appendCardPickerSearchValuesFromObject(terms, entry, depth + 1);
      });
      return;
    }

    appendCardPickerSearchValue(terms, value);
  }

  function buildCardPickerSearchText(card) {
    const terms = new Set();

    [
      getDisplayCardName(card),
      card?.name,
      card?.arcana,
      card?.rank,
      card?.suit,
      card?.number,
      card?.summary,
      card?.hebrewLetterId,
      card?.kabbalahPathNumber,
      buildHebrewLabel(card)?.primary,
      buildHebrewLabel(card)?.secondary,
      buildPlanetLabel(card)?.primary,
      buildMajorZodiacLabel(card)?.primary,
      buildTrumpNumberLabel(card)?.primary,
      buildPathNumberLabel(card)?.primary,
      buildZodiacLabel(card)?.primary,
      buildZodiacLabel(card)?.secondary,
      buildDecanLabel(card)?.primary,
      buildDecanLabel(card)?.secondary,
      buildDateLabel(card)?.primary,
      buildDateLabel(card)?.secondary,
      buildMonthLabel(card)?.primary,
      buildRulerLabel(card)?.primary,
      getCardOverlayDate(card)
    ].forEach((value) => {
      appendCardPickerSearchValue(terms, value);
    });

    appendCardPickerSearchValuesFromObject(terms, card?.relations || []);

    return Array.from(terms).join(" ");
  }

  function matchesCardPickerTerms(queryTerms, haystack) {
    if (!queryTerms.length) {
      return true;
    }

    return queryTerms.every((term) => haystack.includes(term));
  }

  function getCardPickerAnchor(slotId) {
    const slotButton = getSlotElement(slotId)?.querySelector(".tarot-frame-card") || null;
    if (slotButton instanceof HTMLElement) {
      const rect = slotButton.getBoundingClientRect();
      return {
        x: rect.left + (rect.width / 2),
        y: rect.top + (rect.height / 2)
      };
    }

    return {
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 2)
    };
  }

  function syncCardPickerTitle() {
    if (!(cardPickerTitleEl instanceof HTMLElement)) {
      return;
    }

    const slotText = describeSlot(state.cardPicker.slotId);
    cardPickerTitleEl.textContent = `Browse Stock Cards for ${slotText}`;
  }

  function repositionCardPickerForCurrentSlot() {
    if (!(cardPickerEl instanceof HTMLElement) || cardPickerEl.hidden || !state.cardPicker.open) {
      return;
    }

    const anchor = getCardPickerAnchor(state.cardPicker.slotId);
    positionCardPicker(anchor.x, anchor.y);
  }

  function setCardPickerMode(mode = "browse") {
    state.cardPicker.mode = "browse";

    syncCardPickerTitle();

    if (cardPickerEl) {
      cardPickerEl.classList.toggle("is-browse-mode", state.cardPicker.mode === "browse");
    }

    if (cardPickerSearchWrapEl) {
      cardPickerSearchWrapEl.hidden = false;
    }
    if (cardPickerSectionsEl) {
      cardPickerSectionsEl.hidden = false;
    }

    requestAnimationFrame(() => {
      repositionCardPickerForCurrentSlot();
    });

    if (state.cardPicker.mode === "browse") {
      if (cardPickerSearchEl) {
        cardPickerSearchEl.value = state.cardPicker.query;
      }
      renderCardPickerSections();
      requestAnimationFrame(() => {
        cardPickerSearchEl?.focus({ preventScroll: true });
      });
      return;
    }

  }

  function populateCustomCardEditor(card = null) {
    const parsedText = parseCustomCardText(card?.customText);
    if (cardPickerEditorHeadingEl) {
      const titleEl = cardPickerEditorHeadingEl.querySelector("strong");
      if (titleEl) {
        titleEl.textContent = card ? "Edit Custom Card" : "Create Custom Card";
      }
    }
    if (cardPickerEditorTitleEl) {
      cardPickerEditorTitleEl.value = parsedText.primary || "";
    }
    if (cardPickerEditorSubtitleEl) {
      cardPickerEditorSubtitleEl.value = parsedText.secondary || "";
    }
    if (cardPickerEditorColorEl) {
      const backgroundColor = normalizeCustomCardBackgroundColor(card?.backgroundColor);
      cardPickerEditorColorEl.value = backgroundColor || "#164e63";
      cardPickerEditorColorEl.dataset.explicit = backgroundColor ? "true" : "false";
    }
    state.cardPicker.editorImageData = normalizeCustomCardBackgroundImage(card?.backgroundImage);
    if (cardPickerEditorImageUploadEl) {
      cardPickerEditorImageUploadEl.value = "";
    }
    if (cardPickerEditorRemoveEl) {
      cardPickerEditorRemoveEl.hidden = !card;
    }
    updateCustomCardEditorPreview();
  }

  function getCustomCardEditorDraft() {
    const title = normalizeLabelText(cardPickerEditorTitleEl?.value || "");
    const subtitle = normalizeLabelText(cardPickerEditorSubtitleEl?.value || "");
    const customText = normalizeCustomCardText([title, subtitle].filter(Boolean).join("\n"));
    const backgroundColor = cardPickerEditorColorEl?.dataset.explicit === "true"
      ? normalizeCustomCardBackgroundColor(cardPickerEditorColorEl?.value || "")
      : "";
    const backgroundImage = normalizeCustomCardBackgroundImage(state.cardPicker.editorImageData);
    return {
      title,
      subtitle,
      customText,
      backgroundColor,
      backgroundImage
    };
  }

  function updateCustomCardEditorPreview() {
    if (!(cardPickerEditorPreviewEl instanceof HTMLElement)) {
      return;
    }

    const draft = getCustomCardEditorDraft();
    const previewCard = createCustomFrameCardRecord(draft, `${FRAME_CUSTOM_CARD_PREFIX}preview`);
    cardPickerEditorPreviewEl.replaceChildren();

    if (!previewCard) {
      const emptyPreviewEl = document.createElement("div");
      emptyPreviewEl.className = "tarot-frame-card-picker-editor-empty";
      emptyPreviewEl.textContent = "Add text, a color, or an image to build the card preview.";
      cardPickerEditorPreviewEl.appendChild(emptyPreviewEl);
      if (cardPickerEditorSaveEl) {
        cardPickerEditorSaveEl.disabled = true;
      }
      if (cardPickerEditorImageClearEl) {
        cardPickerEditorImageClearEl.disabled = !draft.backgroundImage;
      }
      if (cardPickerEditorImageEl) {
        cardPickerEditorImageEl.textContent = draft.backgroundImage ? "Uploaded image ready." : "No image selected.";
      }
      return;
    }

    if (cardPickerEditorSaveEl) {
      cardPickerEditorSaveEl.disabled = false;
    }
    if (cardPickerEditorImageClearEl) {
      cardPickerEditorImageClearEl.disabled = !draft.backgroundImage;
    }
    if (cardPickerEditorImageEl) {
      cardPickerEditorImageEl.textContent = draft.backgroundImage ? "Uploaded image ready." : "No image selected.";
    }

    cardPickerEditorPreviewEl.appendChild(createCardTextFaceElement(buildCardTextFaceModel(previewCard)));
  }

  function openCustomCardEditor(slotId, existingCardId = "", options = {}) {
    const targetSlotId = String(slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return false;
    }

    createCustomCardEditorElements();
    closeCardInsertMenu();
    closeCardPicker();
    state.cardPicker.slotId = targetSlotId;
    state.cardPicker.editingCardId = String(existingCardId || "").trim();
    const existingCard = state.cardPicker.editingCardId ? state.customCards.get(state.cardPicker.editingCardId) || null : null;

    if (cardCustomEditorTitleEl) {
      cardCustomEditorTitleEl.textContent = `${existingCard ? "Edit" : "Create"} Custom Card at ${describeSlot(targetSlotId)}`;
    }
    populateCustomCardEditor(existingCard);

    if (!cardCustomEditorEl || cardCustomEditorEl.hidden || options.reposition) {
      const anchor = getCardPickerAnchor(targetSlotId);
      positionCustomCardEditor(
        Number.isFinite(options.anchorX) ? options.anchorX : anchor.x,
        Number.isFinite(options.anchorY) ? options.anchorY : anchor.y
      );
    } else {
      cardCustomEditorEl.hidden = false;
    }
    requestAnimationFrame(() => {
      cardPickerEditorTitleEl?.focus({ preventScroll: true });
      cardPickerEditorTitleEl?.select?.();
    });
    return true;
  }

  function placeCustomCardInSlot(slotId, customCardInput, existingCardId = "") {
    const targetSlotId = String(slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return false;
    }

    const nextCard = createCustomFrameCardRecord(customCardInput, existingCardId || createCustomFrameCardId());
    if (!nextCard) {
      return false;
    }

    state.customCards.set(nextCard.id, nextCard);
    const previousSlotId = findAssignedSlotIdByCardId(nextCard.id);
    const inheritedFlip = previousSlotId && previousSlotId !== targetSlotId ? isSlotFlipped(previousSlotId) : isSlotFlipped(targetSlotId);
    const inheritedDeckId = previousSlotId && previousSlotId !== targetSlotId
      ? getSlotDeckOverride(previousSlotId)
      : getSlotDeckOverride(targetSlotId);
    if (previousSlotId && previousSlotId !== targetSlotId) {
      clearSlotAssignmentState(previousSlotId);
    }

    assignCardToSlot(
      targetSlotId,
      nextCard.id,
      inheritedFlip,
      inheritedDeckId
    );
    pruneUnusedCustomCards();
    state.layoutReady = true;
    render({ preserveViewport: true });
    syncControls();
    setStatus(`${existingCardId ? "Custom card updated" : "Custom card placed"} at ${describeSlot(targetSlotId)}.`);
    return true;
  }

  function submitCustomCardEditor() {
    const targetSlotId = String(state.cardPicker.slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return false;
    }

    const draft = getCustomCardEditorDraft();
    if (!draft.customText && !draft.backgroundColor && !draft.backgroundImage) {
      window.alert("Add text, a color, or an image before saving this custom card.");
      return false;
    }

    return placeCustomCardInSlot(targetSlotId, draft, state.cardPicker.editingCardId);
  }

  function removeEditedCustomCard() {
    const targetSlotId = String(state.cardPicker.slotId || "").trim();
    const targetCardId = String(state.cardPicker.editingCardId || "").trim();
    if (!isValidSlotId(targetSlotId) || !targetCardId) {
      return false;
    }

    clearSlotAssignmentState(targetSlotId);
    state.customCards.delete(targetCardId);
    pruneUnusedCustomCards();
    state.layoutReady = true;
    render({ preserveViewport: true });
    syncControls();
    setStatus(`Custom card removed from ${describeSlot(targetSlotId)}.`);
    return true;
  }

  function editCustomCard(slotId, cardId) {
    const targetSlotId = String(slotId || "").trim();
    const targetCardId = String(cardId || "").trim();
    const existingCard = state.customCards.get(targetCardId) || null;
    if (!isValidSlotId(targetSlotId) || !existingCard) {
      return false;
    }

    return openCustomCardEditor(targetSlotId, targetCardId, { reposition: true });
  }

  function buildCardPickerSections() {
    const cards = getCards();
    const queryTerms = normalizeKey(state.cardPicker.query).split(/\s+/).filter(Boolean);
    const matchesQuery = (card) => {
      const haystack = buildCardPickerSearchText(card);
      return matchesCardPickerTerms(queryTerms, haystack);
    };

    if (state.system === "iching") {
      const hexagrams = cards
        .filter(matchesQuery)
        .sort((left, right) => Number(left?.number) - Number(right?.number));
      return [{ title: "Hexagrams", groups: [{ title: "", items: hexagrams }] }]
        .filter((section) => section.groups.some((group) => group.items.length));
    }

    if (state.system === "playing-cards") {
      const groups = PLAYING_CARD_SUITS.map((suit) => {
        const items = cards
          .filter((card) => card?.suit === suit.label && matchesQuery(card))
          .sort((left, right) => Number(left?.number) - Number(right?.number));
        return { title: suit.label, items };
      }).filter((group) => group.items.length);
      return [{ title: "Playing cards", groups }]
        .filter((section) => section.groups.some((group) => group.items.length));
    }

    const majorCards = cards
      .filter((card) => card?.arcana === "Major" && matchesQuery(card))
      .sort((left, right) => Number(left?.number) - Number(right?.number));

    const minorSuitGroups = EXTRA_SUIT_ORDER.map((suitId) => {
      const items = cards
        .filter((card) => card?.arcana === "Minor"
          && MINOR_RANKS.has(String(card?.rank || ""))
          && normalizeKey(card?.suit) === suitId
          && matchesQuery(card))
        .sort((left, right) => getMinorRankSortIndex(left?.rank) - getMinorRankSortIndex(right?.rank));
      return {
        title: normalizeLabelText(items[0]?.suit || suitId),
        items
      };
    }).filter((group) => group.items.length);

    const courtSuitGroups = EXTRA_SUIT_ORDER.map((suitId) => {
      const items = cards
        .filter((card) => card?.arcana === "Minor"
          && !MINOR_RANKS.has(String(card?.rank || ""))
          && String(card?.rank || "").trim() !== "Ace"
          && normalizeKey(card?.suit) === suitId
          && matchesQuery(card))
        .sort((left, right) => getCourtRankSortIndex(left?.rank) - getCourtRankSortIndex(right?.rank));
      return {
        title: normalizeLabelText(items[0]?.suit || suitId),
        items
      };
    }).filter((group) => group.items.length);

    const aceCards = cards
      .filter((card) => card?.arcana === "Minor" && String(card?.rank || "").trim() === "Ace" && matchesQuery(card))
      .sort((left, right) => getSuitSortIndex(left?.suit) - getSuitSortIndex(right?.suit));

    return [
      { title: "Major Arcana", groups: [{ title: "", items: majorCards }] },
      { title: "Minor Arcana", groups: minorSuitGroups },
      { title: "Court Cards", groups: courtSuitGroups },
      { title: "Aces", groups: [{ title: "", items: aceCards }] }
    ].filter((section) => section.groups.some((group) => group.items.length));
  }

  function renderCardPickerSections() {
    if (!(cardPickerSectionsEl instanceof HTMLElement)) {
      return;
    }

    cardPickerSectionsEl.replaceChildren();
    const sections = buildCardPickerSections();
    if (!sections.length) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "tarot-frame-card-picker-empty";
      emptyEl.textContent = "No stock tarot cards match that search.";
      cardPickerSectionsEl.appendChild(emptyEl);
      return;
    }

    sections.forEach((section) => {
      const sectionEl = document.createElement("section");
      sectionEl.className = "tarot-frame-card-picker-section";

      const sectionTitleEl = document.createElement("h4");
      sectionTitleEl.className = "tarot-frame-card-picker-section-title";
      sectionTitleEl.textContent = section.title;
      sectionEl.appendChild(sectionTitleEl);

      section.groups.forEach((group) => {
        if (!group.items.length) {
          return;
        }

        if (group.title) {
          const groupTitleEl = document.createElement("div");
          groupTitleEl.className = "tarot-frame-card-picker-subtitle";
          groupTitleEl.textContent = group.title;
          sectionEl.appendChild(groupTitleEl);
        }

        const gridEl = document.createElement("div");
        gridEl.className = "tarot-frame-card-picker-grid";

        group.items.forEach((item) => {
          const buttonEl = document.createElement("button");
          buttonEl.type = "button";
          buttonEl.className = "tarot-frame-card-picker-option";
          buttonEl.dataset.cardId = getCardId(item);

          const titleEl = document.createElement("strong");
          titleEl.textContent = getDisplayCardName(item);
          const metaEl = document.createElement("span");
          metaEl.textContent = item?.arcana === "Major"
            ? `Trump ${Number.isFinite(Number(item?.number)) ? Number(item.number) : ""}`.trim()
            : [normalizeLabelText(item?.rank), normalizeLabelText(item?.suit)].filter(Boolean).join(" · ");
          buttonEl.append(titleEl, metaEl);
          gridEl.appendChild(buttonEl);
        });

        sectionEl.appendChild(gridEl);
      });

      cardPickerSectionsEl.appendChild(sectionEl);
    });
  }

  function positionCardPicker(anchorX, anchorY) {
    if (!(cardPickerEl instanceof HTMLElement)) {
      return;
    }

    cardPickerEl.hidden = false;
    cardPickerEl.style.visibility = "hidden";
    requestAnimationFrame(() => {
      if (!(cardPickerEl instanceof HTMLElement)) {
        return;
      }

      const panelWidth = cardPickerEl.offsetWidth || 360;
      const panelHeight = cardPickerEl.offsetHeight || 420;
      const margin = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = Math.min(Math.max(anchorX + 10, margin), viewportWidth - panelWidth - margin);
      let top = Math.min(Math.max(anchorY + 10, margin), viewportHeight - panelHeight - margin);
      if (top > viewportHeight - panelHeight - margin) {
        top = Math.max(margin, anchorY - panelHeight - 10);
      }
      if (viewportWidth <= 760) {
        left = Math.max(margin, Math.round((viewportWidth - panelWidth) / 2));
      }

      cardPickerEl.style.left = `${left}px`;
      cardPickerEl.style.top = `${top}px`;
      cardPickerEl.style.visibility = "visible";
    });
  }

  function openCardPicker(slotId, anchorX, anchorY) {
    createCardPickerElements();
    closeCardInsertMenu();
    state.cardPicker.open = true;
    state.cardPicker.slotId = String(slotId || "").trim();
    state.cardPicker.editingCardId = "";
    state.cardPicker.editorImageData = "";
    if (cardPickerSearchEl) {
      cardPickerSearchEl.value = state.cardPicker.query;
    }
    setCardPickerMode("browse");
    positionCardPicker(anchorX, anchorY);
  }

  function findAssignedSlotIdByCardId(cardId) {
    const targetCardId = String(cardId || "").trim();
    if (!targetCardId) {
      return "";
    }

    for (const [slotId, assignedCardId] of state.slotAssignments.entries()) {
      if (String(assignedCardId || "").trim() === targetCardId) {
        return slotId;
      }
    }
    return "";
  }

  function placeCardInSlot(slotId, cardId) {
    const targetSlotId = String(slotId || "").trim();
    const targetCardId = String(cardId || "").trim();
    if (!isValidSlotId(targetSlotId) || !targetCardId) {
      return;
    }

    const card = getCardById(targetCardId);
    if (!card) {
      return;
    }

    const previousSlotId = findAssignedSlotIdByCardId(targetCardId);
    const inheritedFlip = previousSlotId && previousSlotId !== targetSlotId ? isSlotFlipped(previousSlotId) : isSlotFlipped(targetSlotId);
    const inheritedDeckId = previousSlotId && previousSlotId !== targetSlotId
      ? getSlotDeckOverride(previousSlotId)
      : getSlotDeckOverride(targetSlotId);
    if (previousSlotId && previousSlotId !== targetSlotId) {
      clearSlotAssignmentState(previousSlotId);
    }

    assignCardToSlot(
      targetSlotId,
      targetCardId,
      inheritedFlip,
      inheritedDeckId
    );
    pruneUnusedCustomCards();
    state.layoutReady = true;
    render({ preserveViewport: true });
    syncControls();
    setStatus(`${getDisplayCardName(card, targetSlotId)} placed at ${describeSlot(targetSlotId)}.`);
  }

  function clearGrid() {
    if (!state.slotAssignments.size) {
      setStatus("The Frame grid is already empty.");
      return;
    }

    const shouldClear = window.confirm("Clear every card from the current Frame grid?");
    if (!shouldClear) {
      return;
    }

    state.slotAssignments.clear();
    state.slotFlips.clear();
    state.slotDeckOverrides.clear();
    state.customCards.clear();
    state.selectedSlotIds.clear();
    state.layoutReady = true;
    render();
    syncControls();
    setStatus("Frame grid cleared. Use the card picker or a layout preset to repopulate it.");
  }

  function clearLongPressGesture() {
    if (state.longPress?.timerId) {
      window.clearTimeout(state.longPress.timerId);
    }
    document.removeEventListener("pointermove", handleLongPressPointerMove);
    document.removeEventListener("pointerup", handleLongPressPointerUp);
    document.removeEventListener("pointercancel", handleLongPressPointerCancel);
    state.longPress = null;
  }

  function scheduleLongPress(slotId, event, action = "insert") {
    clearLongPressGesture();
    document.addEventListener("pointermove", handleLongPressPointerMove);
    document.addEventListener("pointerup", handleLongPressPointerUp);
    document.addEventListener("pointercancel", handleLongPressPointerCancel);
    state.longPress = {
      pointerId: event.pointerId,
      slotId,
      action,
      startX: event.clientX,
      startY: event.clientY,
      timerId: window.setTimeout(() => {
        const activeGesture = state.longPress;
        clearLongPressGesture();
        if (!activeGesture) {
          return;
        }
        state.suppressClick = true;
        cleanupDrag();
        if (activeGesture.action === "card") {
          const cardId = String(state.slotAssignments.get(String(activeGesture.slotId || "").trim()) || "").trim();
          if (cardId) {
            openCardActionMenu(activeGesture.slotId, cardId, activeGesture.startX, activeGesture.startY, { focusFirstButton: false, fromTouchLongPress: true });
          }
          return;
        }

        openCardInsertMenu(activeGesture.slotId, activeGesture.startX, activeGesture.startY);
      }, FRAME_LONG_PRESS_DELAY_MS)
    };
  }

  function updateLongPress(event) {
    if (!state.longPress || event.pointerId !== state.longPress.pointerId) {
      return;
    }

    if (Math.hypot(event.clientX - state.longPress.startX, event.clientY - state.longPress.startY) > FRAME_LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressGesture();
    }
  }

  function finishLongPress(event) {
    if (!state.longPress || event.pointerId !== state.longPress.pointerId) {
      return;
    }
    clearLongPressGesture();
  }

  function handleLongPressPointerMove(event) {
    updateLongPress(event);
  }

  function handleLongPressPointerUp(event) {
    finishLongPress(event);
  }

  function handleLongPressPointerCancel(event) {
    finishLongPress(event);
  }

  function getTouchPanAnchor(touches) {
    if (!touches || touches.length < 1) {
      return null;
    }

    let totalX = 0;
    let totalY = 0;
    let count = 0;

    Array.from(touches).forEach((touch) => {
      if (!touch) {
        return;
      }
      totalX += Number(touch.clientX) || 0;
      totalY += Number(touch.clientY) || 0;
      count += 1;
    });

    if (!count) {
      return null;
    }

    return {
      x: totalX / count,
      y: totalY / count
    };
  }

  function getTouchDistance(touches) {
    if (!touches || touches.length < 2) {
      return 0;
    }

    const first = touches[0];
    const second = touches[1];
    if (!first || !second) {
      return 0;
    }

    return Math.hypot(Number(first.clientX) - Number(second.clientX), Number(first.clientY) - Number(second.clientY));
  }

  function startPanGesture(event, options = {}) {
    const viewportEl = getGridViewportElement();
    if (!(viewportEl instanceof HTMLElement)) {
      return;
    }

    clearLongPressGesture();
    if (state.drag) {
      cleanupDrag();
    }

    const source = String(options.source || "pointer").trim() || "pointer";
    const startX = Number(options.startX ?? event?.clientX);
    const startY = Number(options.startY ?? event?.clientY);
    state.panGesture = {
      source,
      pointerId: source === "pointer" ? event?.pointerId : null,
      startX,
      startY,
      startScrollLeft: viewportEl.scrollLeft,
      startScrollTop: viewportEl.scrollTop
    };
    updateViewportInteractionState();
    syncActiveTouchGestureCapture();
    if (source === "pointer") {
      document.addEventListener("pointermove", handlePanPointerMove);
      document.addEventListener("pointerup", handlePanPointerUp);
      document.addEventListener("pointercancel", handlePanPointerCancel);
      event?.preventDefault?.();
    }
  }

  function startTouchPanGesture(event) {
    const anchor = getTouchPanAnchor(event?.touches);
    if (!anchor) {
      return;
    }

    removeOrphanedDragGhosts();
    startPanGesture(null, {
      source: "touch",
      startX: anchor.x,
      startY: anchor.y
    });
    state.suppressClick = true;
    event.preventDefault();
  }

  function startTouchPinchGesture(event) {
    const anchor = getTouchPanAnchor(event?.touches);
    const distance = getTouchDistance(event?.touches);
    const viewportEl = getGridViewportElement();
    if (!anchor || !(distance > 0) || !(viewportEl instanceof HTMLElement)) {
      return;
    }

    removeOrphanedDragGhosts();
    clearLongPressGesture();
    if (state.drag) {
      cleanupDrag();
    }

    state.pinchGesture = {
      startDistance: distance,
      startScale: getGridZoomScale(),
      startAnchorX: anchor.x,
      startAnchorY: anchor.y,
      startScrollLeft: viewportEl.scrollLeft,
      startScrollTop: viewportEl.scrollTop
    };
    finishPanGesture();
    syncActiveTouchGestureCapture();
    updateViewportInteractionState();
    state.suppressClick = true;
    event.preventDefault();
  }

  function finishTouchPinchGesture() {
    state.pinchGesture = null;
    syncActiveTouchGestureCapture();
    updateViewportInteractionState();
  }

  function finishPanGesture() {
    if (!state.panGesture) {
      return;
    }

    state.panGesture = null;
    document.removeEventListener("pointermove", handlePanPointerMove);
    document.removeEventListener("pointerup", handlePanPointerUp);
    document.removeEventListener("pointercancel", handlePanPointerCancel);
    syncActiveTouchGestureCapture();
    updateViewportInteractionState();
  }

  function handlePanPointerMove(event) {
    if (!state.panGesture || state.panGesture.source !== "pointer" || event.pointerId !== state.panGesture.pointerId) {
      return;
    }

    const viewportEl = getGridViewportElement();
    if (!(viewportEl instanceof HTMLElement)) {
      finishPanGesture();
      return;
    }

    viewportEl.scrollLeft = state.panGesture.startScrollLeft - (event.clientX - state.panGesture.startX);
    viewportEl.scrollTop = state.panGesture.startScrollTop - (event.clientY - state.panGesture.startY);
    state.suppressClick = true;
    event.preventDefault();
  }

  function handlePanPointerUp(event) {
    if (!state.panGesture || state.panGesture.source !== "pointer" || event.pointerId !== state.panGesture.pointerId) {
      return;
    }
    finishPanGesture();
  }

  function handlePanPointerCancel(event) {
    if (!state.panGesture || state.panGesture.source !== "pointer" || event.pointerId !== state.panGesture.pointerId) {
      return;
    }
    finishPanGesture();
  }

  function handleBoardTouchStart(event) {
    blurLayoutNoteForBoardInteraction(event.target);

    if (event.touches.length >= 3) {
      startTouchPanGesture(event);
      return;
    }

    if (event.touches.length !== 2) {
      return;
    }

    startTouchPinchGesture(event);
  }

  function handleBoardTouchMove(event) {
    if (state.pinchGesture) {
      if (event.touches.length >= 3) {
        finishTouchPinchGesture();
        startTouchPanGesture(event);
        return;
      }

      if (event.touches.length !== 2) {
        finishTouchPinchGesture();
        return;
      }

      const anchor = getTouchPanAnchor(event.touches);
      const distance = getTouchDistance(event.touches);
      const viewportEl = getGridViewportElement();
      if (!anchor || !(distance > 0) || !(viewportEl instanceof HTMLElement)) {
        finishTouchPinchGesture();
        return;
      }

      const pinchRatio = distance / state.pinchGesture.startDistance;
      const nextScale = clampFrameGridZoomScale(
        state.pinchGesture.startScale * (pinchRatio ** FRAME_PINCH_ZOOM_EXPONENT)
      );
      setGridZoomScale(nextScale, {
        preserveViewport: false,
        anchorClientX: anchor.x,
        anchorClientY: anchor.y,
        statusMessage: "",
        live: true
      });
      state.suppressClick = true;
      event.preventDefault();
      return;
    }

    if (!state.panGesture || state.panGesture.source !== "touch") {
      return;
    }

    if (event.touches.length === 2) {
      finishPanGesture();
      startTouchPinchGesture(event);
      return;
    }

    if (event.touches.length < 3) {
      finishPanGesture();
      return;
    }

    const anchor = getTouchPanAnchor(event.touches);
    if (!anchor) {
      finishPanGesture();
      return;
    }

    const viewportEl = getGridViewportElement();
    if (!(viewportEl instanceof HTMLElement)) {
      finishPanGesture();
      return;
    }

    viewportEl.scrollLeft = state.panGesture.startScrollLeft - (anchor.x - state.panGesture.startX);
    viewportEl.scrollTop = state.panGesture.startScrollTop - (anchor.y - state.panGesture.startY);
    state.suppressClick = true;
    event.preventDefault();
  }

  function handleBoardTouchEnd(event) {
    if (state.pinchGesture) {
      if (event.touches.length >= 3) {
        finishTouchPinchGesture();
        startTouchPanGesture(event);
        return;
      }

      if (event.touches.length === 2) {
        startTouchPinchGesture(event);
        return;
      }

      finishTouchPinchGesture();
      return;
    }

    if (!state.panGesture || state.panGesture.source !== "touch") {
      return;
    }

    if (event.touches.length >= 3) {
      startTouchPanGesture(event);
      return;
    }

    if (event.touches.length === 2) {
      finishPanGesture();
      startTouchPinchGesture(event);
      return;
    }

    finishPanGesture();
  }

  function handleBoardTouchCancel() {
    finishTouchPinchGesture();
    if (!state.panGesture || state.panGesture.source !== "touch") {
      return;
    }

    finishPanGesture();
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
  }

  function getGridViewportCenterAnchor() {
    const viewportEl = getGridViewportElement();
    if (!(viewportEl instanceof HTMLElement)) {
      return null;
    }

    const rect = viewportEl.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) {
      return null;
    }

    return {
      anchorClientX: rect.left + (rect.width / 2),
      anchorClientY: rect.top + (rect.height / 2)
    };
  }

  function normalizeWheelDelta(event) {
    const mode = Number(event?.deltaMode) || 0;
    const multiplier = mode === 1 ? 16 : mode === 2 ? Math.max(1, window.innerHeight || 1) : 1;
    return {
      deltaX: (Number(event?.deltaX) || 0) * multiplier,
      deltaY: (Number(event?.deltaY) || 0) * multiplier
    };
  }

  function handleBoardWheel(event) {
    if (state.exportInProgress) {
      return;
    }

    const viewportEl = getGridViewportElement();
    if (!(viewportEl instanceof HTMLElement)) {
      return;
    }

    const deltas = normalizeWheelDelta(event);
    if (event.ctrlKey) {
      event.preventDefault();
      const centerAnchor = getGridViewportCenterAnchor();
      const anchorClientX = Number.isFinite(Number(event.clientX)) ? Number(event.clientX) : centerAnchor?.anchorClientX;
      const anchorClientY = Number.isFinite(Number(event.clientY)) ? Number(event.clientY) : centerAnchor?.anchorClientY;
      const zoomBase = pendingLiveZoomJob?.scale ?? getGridZoomScale();
      const zoomFactor = Math.exp(-(deltas.deltaY || 0) * FRAME_WHEEL_ZOOM_GAIN);
      const nextScale = clampFrameGridZoomScale(zoomBase * zoomFactor);
      setGridZoomScale(nextScale, {
        preserveViewport: false,
        anchorClientX,
        anchorClientY,
        statusMessage: "",
        live: true
      });
      state.suppressClick = true;
      return;
    }

    if (!(Math.abs(deltas.deltaX) > 0 || Math.abs(deltas.deltaY) > 0)) {
      return;
    }

    event.preventDefault();
    viewportEl.scrollLeft += deltas.deltaX;
    viewportEl.scrollTop += deltas.deltaY;
    state.suppressClick = true;
  }

  function getFrameGridZoomShortcutDirection(event) {
    if (!(event instanceof KeyboardEvent)) {
      return 0;
    }

    const key = String(event.key || "");
    const code = String(event.code || "");
    if (key === "+" || key === "=" || code === "NumpadAdd") {
      return 1;
    }

    if (key === "-" || key === "_" || code === "NumpadSubtract") {
      return -1;
    }

    return 0;
  }

  function shouldHandleFrameZoomShortcut(event) {
    const { tarotFrameSectionEl } = getElements();
    if (!(tarotFrameSectionEl instanceof HTMLElement) || tarotFrameSectionEl.hidden) {
      return false;
    }

    if (state.cardInsertMenu.open || state.cardPicker.open || (cardCustomEditorEl && !cardCustomEditorEl.hidden)) {
      return false;
    }

    return !isEditableTarget(event?.target);
  }

  function normalizeLookupCardName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\b(pentacles?|coins?)\b/g, "disks");
  }

  let frameIChingCards = null;

  async function ensureFrameIChingCards() {
    if (Array.isArray(frameIChingCards) && frameIChingCards.length) {
      return frameIChingCards;
    }
    try {
      const payload = await window.TarotDataService.requestJson(
        "GET",
        window.TarotDataService.buildApiUrl("/api/v1/iching")
      );
      frameIChingCards = (Array.isArray(payload?.hexagrams) ? payload.hexagrams : [])
        .map((hexagram) => {
          const number = Number(hexagram?.number);
          if (!Number.isFinite(number)) return null;
          const name = String(hexagram?.name || `Hexagram ${number}`).trim() || `Hexagram ${number}`;
          // id keeps every card distinct; the leading number lets decks resolve
          // by hexagram number even when their names differ.
          return { id: `hex-${number}`, name: `${number} · ${name}`, arcana: "Hexagram", number, suit: "", rank: "" };
        })
        .filter(Boolean);
    } catch (_error) {
      frameIChingCards = [];
    }
    return frameIChingCards;
  }

  function getCards() {
    if (state.system === "iching") {
      return Array.isArray(frameIChingCards) ? frameIChingCards : [];
    }
    if (state.system === "playing-cards") {
      return PLAYING_CARDS;
    }
    const cards = config.getCards?.();
    return Array.isArray(cards) ? cards : [];
  }

  function isCustomFrameCardId(cardId) {
    return String(cardId || "").trim().startsWith(FRAME_CUSTOM_CARD_PREFIX);
  }

  function isCustomFrameCard(card) {
    return Boolean(card) && isCustomFrameCardId(getCardId(card));
  }

  function normalizeCustomCardText(value) {
    return String(value || "")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function normalizeCustomCardBackgroundColor(value) {
    const normalized = String(value || "").trim();
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized) ? normalized : "";
  }

  function normalizeCustomCardBackgroundImage(value) {
    return String(value || "").trim();
  }

  function parseCustomCardText(value) {
    const normalized = normalizeCustomCardText(value);
    if (!normalized) {
      return {
        raw: "",
        primary: "",
        secondary: ""
      };
    }

    const separator = normalized.includes("|") ? "|" : "\n";
    const segments = normalized
      .split(separator)
      .map((segment) => normalizeLabelText(segment))
      .filter(Boolean);

    return {
      raw: normalized,
      primary: segments[0] || "Label",
      secondary: segments.slice(1).join(" · ")
    };
  }

  function buildCustomLabelFaceClassName(parsedText, hasVisual = false) {
    const primaryLength = String(parsedText?.primary || "").replace(/\s+/g, "").length;
    const secondaryLength = String(parsedText?.secondary || "").replace(/\s+/g, "").length;
    const classes = ["is-custom-label"];

    if (hasVisual) {
      classes.push("is-custom-visual");
    }

    if (!primaryLength && !secondaryLength) {
      classes.push("is-custom-blank");
      if (hasVisual) {
        classes.push("is-custom-visual-only");
      }
      return classes.join(" ");
    }

    if (!secondaryLength && primaryLength <= 4) {
      classes.push("is-custom-hero");
    } else if (!secondaryLength && primaryLength <= 10) {
      classes.push("is-custom-short");
    } else if (primaryLength <= 14 && secondaryLength <= 28) {
      classes.push("is-custom-medium");
    }

    if (primaryLength >= 18 || secondaryLength >= 34) {
      classes.push("is-dense");
    }

    return classes.join(" ");
  }

  function createCustomFrameCardId() {
    return `${FRAME_CUSTOM_CARD_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createCustomFrameCardRecord(input, id = createCustomFrameCardId()) {
    const customText = typeof input === "string"
      ? normalizeCustomCardText(input)
      : normalizeCustomCardText(input?.customText || [input?.title, input?.subtitle].filter(Boolean).join("\n"));
    const backgroundColor = typeof input === "string" ? "" : normalizeCustomCardBackgroundColor(input?.backgroundColor);
    const backgroundImage = typeof input === "string" ? "" : normalizeCustomCardBackgroundImage(input?.backgroundImage);
    const parsed = parseCustomCardText(customText);
    if (!parsed.raw && !backgroundColor && !backgroundImage) {
      return null;
    }

    return {
      id: isCustomFrameCardId(id) ? id : createCustomFrameCardId(),
      frameCardType: "custom-text",
      arcana: "Custom",
      name: parsed.primary || "Custom Card",
      customText: parsed.raw,
      summary: parsed.secondary || "",
      backgroundColor,
      backgroundImage
    };
  }

  function normalizeSavedCustomCardRecord(rawCard) {
    const cardId = String(rawCard?.id || "").trim();
    const text = normalizeCustomCardText(rawCard?.customText || rawCard?.text || rawCard?.name);
    const backgroundColor = normalizeCustomCardBackgroundColor(rawCard?.backgroundColor);
    const backgroundImage = normalizeCustomCardBackgroundImage(rawCard?.backgroundImage);
    if (!text && !backgroundColor && !backgroundImage) {
      return null;
    }

    return createCustomFrameCardRecord({
      customText: text,
      backgroundColor,
      backgroundImage
    }, cardId);
  }

  function getCardId(card) {
    return String(card?.id || "").trim();
  }

  function getCardMap(cards) {
    const map = new Map(cards.map((card) => [getCardId(card), card]));
    state.customCards.forEach((card, cardId) => {
      if (cardId) {
        map.set(cardId, card);
      }
    });
    return map;
  }

  function getCardById(cardId) {
    const id = String(cardId || "").trim();
    if (!id) {
      return null;
    }
    const cards = getCards();
    for (let i = 0; i < cards.length; i += 1) {
      if (getCardId(cards[i]) === id) {
        return cards[i];
      }
    }
    return state.customCards.get(id) || null;
  }

  function removeCardFromSlot(slotId) {
    const targetSlotId = String(slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return null;
    }

    const cardId = String(state.slotAssignments.get(targetSlotId) || "").trim();
    if (!cardId) {
      return null;
    }

    const card = getCardById(cardId);
    clearSlotAssignmentState(targetSlotId);
    state.selectedSlotIds.delete(targetSlotId);
    if (isCustomFrameCardId(cardId)) {
      state.customCards.delete(cardId);
    }
    pruneUnusedCustomCards();
    state.layoutReady = true;
    return card;
  }

  function pruneUnusedCustomCards() {
    const assignedCustomIds = new Set(
      Array.from(state.slotAssignments.values())
        .map((cardId) => String(cardId || "").trim())
        .filter((cardId) => isCustomFrameCardId(cardId))
    );

    Array.from(state.customCards.keys()).forEach((cardId) => {
      if (!assignedCustomIds.has(cardId)) {
        state.customCards.delete(cardId);
      }
    });
  }

  function getRelation(card, type) {
    return Array.isArray(card?.relations)
      ? card.relations.find((relation) => relation?.type === type) || null
      : null;
  }

  function getRelations(card, type) {
    return Array.isArray(card?.relations)
      ? card.relations.filter((relation) => relation?.type === type)
      : [];
  }

  function parseMonthDayToken(token) {
    const match = String(token || "").trim().match(/^(\d{2})-(\d{2})$/);
    if (!match) {
      return null;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) {
      return null;
    }

    return { month, day };
  }

  function formatMonthDay(token) {
    const parsed = parseMonthDayToken(token);
    if (!parsed) {
      return "";
    }
    return `${MONTH_ABBR[parsed.month - 1]} ${parsed.day}`;
  }

  function decrementToken(token) {
    const parsed = parseMonthDayToken(token);
    if (!parsed) {
      return null;
    }

    if (parsed.day > 1) {
      return `${String(parsed.month).padStart(2, "0")}-${String(parsed.day - 1).padStart(2, "0")}`;
    }

    const previousMonth = parsed.month === 1 ? 12 : parsed.month - 1;
    const previousDay = MONTH_LENGTHS[previousMonth - 1];
    return `${String(previousMonth).padStart(2, "0")}-${String(previousDay).padStart(2, "0")}`;
  }

  function formatDateRange(startToken, endToken) {
    const start = parseMonthDayToken(startToken);
    const end = parseMonthDayToken(endToken);
    if (!start || !end) {
      return "";
    }

    const startMonth = MONTH_ABBR[start.month - 1];
    const endMonth = MONTH_ABBR[end.month - 1];
    if (start.month === end.month) {
      return `${startMonth} ${start.day}-${end.day}`;
    }
    return `${startMonth} ${start.day}-${endMonth} ${end.day}`;
  }

  function toOrdinalDay(token) {
    const parsed = parseMonthDayToken(token);
    if (!parsed) {
      return Number.POSITIVE_INFINITY;
    }

    const daysBeforeMonth = MONTH_LENGTHS.slice(0, parsed.month - 1).reduce((total, length) => total + length, 0);
    return daysBeforeMonth + parsed.day;
  }

  function getCyclicDayValue(token, cycleStartToken) {
    const value = toOrdinalDay(token);
    const cycleStart = toOrdinalDay(cycleStartToken);
    if (!Number.isFinite(value) || !Number.isFinite(cycleStart)) {
      return Number.POSITIVE_INFINITY;
    }

    return (value - cycleStart + 365) % 365;
  }

  function compareDateTokens(leftToken, rightToken, cycleStartToken) {
    return getCyclicDayValue(leftToken, cycleStartToken) - getCyclicDayValue(rightToken, cycleStartToken);
  }

  function assignCardsToPositions(placements, positions, orderedCards) {
    (Array.isArray(positions) ? positions : []).forEach((position, index) => {
      const card = orderedCards[index] || null;
      if (!card) {
        return;
      }

      placements.push({
        row: position.row,
        column: position.column,
        cardId: getCardId(card)
      });
    });
  }

  function buildMinorCardName(rankNumber, suit) {
    const rankName = ({
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
    })[Number(rankNumber)];
    const suitName = String(suit || "").trim();
    return rankName && suitName ? `${rankName} of ${suitName}` : "";
  }

  function buildCourtCardName(rank, suit) {
    const rankName = String(rank || "").trim();
    const suitName = String(suit || "").trim();
    return rankName && suitName ? `${rankName} of ${suitName}` : "";
  }

  function getCardLookupMap(cards) {
    const lookup = new Map();
    cards.forEach((card) => {
      const key = normalizeLookupCardName(card?.name);
      if (key) {
        lookup.set(key, card);
      }
    });
    return lookup;
  }

  function findCardByLookupName(cardLookupMap, cardName) {
    return cardLookupMap.get(normalizeLookupCardName(cardName)) || null;
  }

  function findMajorCardByTrumpNumber(cards, trumpNumber) {
    const target = Number(trumpNumber);
    return cards.find((card) => card?.arcana === "Major" && Number(card?.number) === target) || null;
  }

  function buildHousePlacements(cards) {
    const placements = [];
    const lookupMap = getCardLookupMap(cards);

    HOUSE_TRUMP_ROWS.forEach((trumpNumbers, rowIndex) => {
      const rowCards = trumpNumbers.map((trumpNumber) => findMajorCardByTrumpNumber(cards, trumpNumber));
      const startColumn = Math.floor((MASTER_GRID_SIZE - rowCards.length) / 2) + 1;
      assignCardsToPositions(
        placements,
        rowCards.map((card, index) => ({ row: HOUSE_TRUMP_GRID_ROWS[rowIndex], column: startColumn + index })),
        rowCards
      );
    });

    HOUSE_MINOR_NUMBER_BANDS.forEach((numbers, rowIndex) => {
      const row = HOUSE_BOTTOM_START_ROW + rowIndex;
      const leftCards = numbers.map((rankNumber) => findCardByLookupName(lookupMap, buildMinorCardName(rankNumber, HOUSE_LEFT_SUITS[rowIndex])));
      const rightCards = numbers.map((rankNumber) => findCardByLookupName(lookupMap, buildMinorCardName(rankNumber, HOUSE_RIGHT_SUITS[rowIndex])));

      assignCardsToPositions(
        placements,
        leftCards.map((card, index) => ({ row, column: HOUSE_LEFT_START_COLUMN + index })),
        leftCards
      );
      assignCardsToPositions(
        placements,
        rightCards.map((card, index) => ({ row, column: HOUSE_RIGHT_START_COLUMN + index })),
        rightCards
      );
    });

    HOUSE_MIDDLE_RANKS.forEach((rank, rowIndex) => {
      const row = HOUSE_BOTTOM_START_ROW + rowIndex;
      const middleCards = HOUSE_MIDDLE_SUITS.map((suit) => findCardByLookupName(lookupMap, buildCourtCardName(rank, suit)));
      assignCardsToPositions(
        placements,
        middleCards.map((card, index) => ({ row, column: HOUSE_MIDDLE_START_COLUMN + index })),
        middleCards
      );
    });

    return placements;
  }

  function getLayoutPreset(layoutId = state.currentLayoutId) {
    return LAYOUT_PRESETS.find((preset) => preset.id === normalizeKey(layoutId)) || null;
  }

  function getSavedLayout(layoutId = state.currentLayoutId) {
    return state.customLayouts.find((layout) => layout.id === String(layoutId || "").trim()) || null;
  }

  function getLayoutDefinition(layoutId = state.currentLayoutId) {
    return getSavedLayout(layoutId) || getLayoutPreset(layoutId) || LAYOUT_PRESETS[0];
  }

  function isCustomLayout(layoutId = state.currentLayoutId) {
    return Boolean(getSavedLayout(layoutId));
  }

  function buildCardSignature(cards) {
    return cards.map((card) => getCardId(card)).filter(Boolean).sort().join("|");
  }

  function resolveDeckOptions(card, slotId = "") {
    const deckId = getResolvedSlotDeckId(slotId) || getFallbackDeckId();
    const trumpNumber = card?.arcana === "Major" && Number.isFinite(Number(card?.number))
      ? Number(card.number)
      : undefined;

    return {
      ...(deckId ? { deckId } : {}),
      ...(Number.isFinite(trumpNumber) ? { trumpNumber } : {})
    };
  }

  function resolveCardThumbnail(card, slotId = "") {
    if (!card) {
      return "";
    }

    if (isCustomFrameCard(card)) {
      return "";
    }

    const deckOptions = resolveDeckOptions(card, slotId) || undefined;
    const thumbnailSrc = tarotCardImages.resolveTarotCardThumbnail?.(card.name, deckOptions);
    const fullSrc = tarotCardImages.resolveTarotCardImage?.(card.name, deckOptions);
    return String(thumbnailSrc || fullSrc || "").trim();
  }

  function resolveCardFullImage(card, slotId = "") {
    if (!card || isCustomFrameCard(card)) {
      return "";
    }
    const deckOptions = resolveDeckOptions(card, slotId) || undefined;
    const fullSrc = tarotCardImages.resolveTarotCardImage?.(card.name, deckOptions);
    const thumbnailSrc = tarotCardImages.resolveTarotCardThumbnail?.(card.name, deckOptions);
    return String(fullSrc || thumbnailSrc || "").trim();
  }

  function getDisplayCardName(card, slotId = "") {
    if (isCustomFrameCard(card)) {
      return parseCustomCardText(card?.customText).primary || "Custom Card";
    }

    const label = tarotCardImages.getTarotCardDisplayName?.(card?.name, resolveDeckOptions(card, slotId) || undefined);
    return String(label || card?.name || "Tarot").trim() || "Tarot";
  }

  function toRomanNumeral(value) {
    let remaining = Number(value);
    if (!Number.isFinite(remaining) || remaining <= 0) {
      return "";
    }

    const numerals = [
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"]
    ];

    let result = "";
    numerals.forEach(([amount, glyph]) => {
      while (remaining >= amount) {
        result += glyph;
        remaining -= amount;
      }
    });
    return result;
  }

  function buildHebrewLabel(card) {
    const hebrew = card?.hebrewLetter && typeof card.hebrewLetter === "object"
      ? card.hebrewLetter
      : getRelation(card, "hebrewLetter")?.data;
    const glyph = normalizeLabelText(hebrew?.glyph || hebrew?.char);
    const transliteration = normalizeLabelText(hebrew?.latin || hebrew?.name || card?.hebrewLetterId);
    const primary = glyph || transliteration;
    const secondary = glyph && transliteration ? transliteration : "";
    return primary ? { primary, secondary, className: "is-top-hebrew" } : null;
  }

  function buildPlanetLabel(card) {
    const relation = getRelation(card, "planetCorrespondence")
      || getRelation(card, "planet")
      || getRelation(card, "decanRuler");
    const name = normalizeLabelText(relation?.data?.symbol
      ? `${relation.data.symbol} ${relation.data.name || relation.data.planetId || ""}`
      : relation?.data?.name || relation?.data?.planetId || relation?.id);
    return name ? { primary: relation?.type === "decanRuler" ? `Ruler: ${name}` : `Planet: ${name}`, secondary: "", className: "" } : null;
  }

  function buildMajorZodiacLabel(card) {
    const relation = getRelation(card, "zodiacCorrespondence") || getRelation(card, "zodiac");
    const name = normalizeLabelText(relation?.data?.symbol
      ? `${relation.data.symbol} ${relation.data.name || relation.data.signName || ""}`
      : relation?.data?.name || relation?.data?.signName || relation?.id);
    return name ? { primary: `Zodiac: ${name}`, secondary: "", className: "" } : null;
  }

  function buildTrumpNumberLabel(card) {
    const number = Number(card?.number);
    if (!Number.isFinite(number)) {
      return null;
    }
    return {
      primary: `Trump: ${number === 0 ? "0" : toRomanNumeral(Math.trunc(number))}`,
      secondary: "",
      className: ""
    };
  }

  function buildPathNumberLabel(card) {
    const pathNumber = Number(card?.kabbalahPathNumber);
    return Number.isFinite(pathNumber)
      ? { primary: `Path: ${Math.trunc(pathNumber)}`, secondary: "", className: "" }
      : null;
  }

  function buildZodiacLabel(card) {
    const zodiacRelation = getRelation(card, "zodiac");
    const decanRelations = getRelations(card, "decan");
    const primary = normalizeLabelText(
      zodiacRelation?.data?.symbol
        ? `${zodiacRelation.data.symbol} ${zodiacRelation.data.signName || zodiacRelation.data.name || ""}`
        : zodiacRelation?.data?.signName || zodiacRelation?.data?.name
    );

    if (primary) {
      const dateRange = normalizeLabelText(getRelation(card, "courtDateWindow")?.data?.dateRange);
      return {
        primary,
        secondary: dateRange || "",
        className: ""
      };
    }

    if (decanRelations.length > 0) {
      const first = decanRelations[0]?.data || {};
      const last = decanRelations[decanRelations.length - 1]?.data || {};
      const firstName = normalizeLabelText(first.signName);
      const lastName = normalizeLabelText(last.signName);
      const rangeLabel = firstName && lastName
        ? (firstName === lastName ? firstName : `${firstName} -> ${lastName}`)
        : firstName || lastName;
      const dateRange = normalizeLabelText(getRelation(card, "courtDateWindow")?.data?.dateRange);
      return rangeLabel
        ? { primary: rangeLabel, secondary: dateRange || "", className: "" }
        : null;
    }

    return null;
  }

  function buildDecanLabel(card) {
    const decanRelations = getRelations(card, "decan");
    if (!decanRelations.length) {
      return null;
    }

    if (decanRelations.length === 1) {
      const data = decanRelations[0].data || {};
      const hasDegrees = Number.isFinite(Number(data.startDegree)) && Number.isFinite(Number(data.endDegree));
      const degreeLabel = hasDegrees ? `${data.startDegree}°-${data.endDegree}°` : "";
      const signLabel = normalizeLabelText(data.signName);
      const primary = degreeLabel || signLabel;
      const secondary = degreeLabel && signLabel ? signLabel : normalizeLabelText(data.dateRange);
      return primary ? { primary, secondary, className: "" } : null;
    }

    const first = decanRelations[0]?.data || {};
    const last = decanRelations[decanRelations.length - 1]?.data || {};
    const firstLabel = normalizeLabelText(first.signName) && Number.isFinite(Number(first.index))
      ? `${first.signName} ${toRomanNumeral(first.index)}`
      : normalizeLabelText(first.signName);
    const lastLabel = normalizeLabelText(last.signName) && Number.isFinite(Number(last.index))
      ? `${last.signName} ${toRomanNumeral(last.index)}`
      : normalizeLabelText(last.signName);
    const primary = firstLabel && lastLabel
      ? (firstLabel === lastLabel ? firstLabel : `${firstLabel} -> ${lastLabel}`)
      : firstLabel || lastLabel;
    const secondary = normalizeLabelText(getRelation(card, "courtDateWindow")?.data?.dateRange);
    return primary ? { primary, secondary, className: "" } : null;
  }

  function buildDateLabel(card) {
    const dateRange = normalizeLabelText(
      getRelation(card, "courtDateWindow")?.data?.dateRange
      || getRelation(card, "decan")?.data?.dateRange
      || getRelation(card, "calendarMonth")?.data?.dateRange
      || getCardOverlayDate(card)
      || getRelation(card, "calendarMonth")?.data?.name
    );
    const secondary = normalizeLabelText(
      getRelation(card, "calendarMonth")?.data?.name
      || getRelation(card, "decan")?.data?.signName
      || getRelation(card, "zodiacCorrespondence")?.data?.name
      || getRelation(card, "zodiac")?.data?.name
    );
    return dateRange
      ? { primary: dateRange, secondary: secondary && secondary !== dateRange ? secondary : "", className: "" }
      : null;
  }

  function buildMonthLabel(card) {
    const names = [];
    const seen = new Set();
    getRelations(card, "calendarMonth").forEach((relation) => {
      const name = normalizeLabelText(relation?.data?.name);
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        names.push(name);
      }
    });
    return names.length ? { primary: `Month: ${names.join("/")}`, secondary: "", className: "" } : null;
  }

  function buildRulerLabel(card) {
    const names = [];
    const seen = new Set();
    getRelations(card, "decanRuler").forEach((relation) => {
      const name = normalizeLabelText(
        relation?.data?.symbol
          ? `${relation.data.symbol} ${relation.data.name || relation.data.planetId || ""}`
          : relation?.data?.name || relation?.data?.planetId
      );
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        names.push(name);
      }
    });
    return names.length ? { primary: `Ruler: ${names.join("/")}`, secondary: "", className: "" } : null;
  }

  function getHouseTopInfoModeEnabled(mode) {
    return Boolean(config.getHouseTopInfoModes?.()?.[mode]);
  }

  function getHouseBottomInfoModeEnabled(mode) {
    return Boolean(config.getHouseBottomInfoModes?.()?.[mode]);
  }

  function buildHouseTopLabel(card) {
    const lines = [];
    const seen = new Set();
    const pushLine = (value) => {
      const text = normalizeLabelText(value);
      const key = text.toLowerCase();
      if (text && !seen.has(key)) {
        seen.add(key);
        lines.push(text);
      }
    };

    if (getHouseTopInfoModeEnabled("hebrew")) {
      const hebrew = buildHebrewLabel(card);
      pushLine(hebrew?.primary);
      pushLine(hebrew?.secondary);
    }
    if (getHouseTopInfoModeEnabled("planet")) {
      pushLine(buildPlanetLabel(card)?.primary);
    }
    if (getHouseTopInfoModeEnabled("zodiac")) {
      pushLine(buildMajorZodiacLabel(card)?.primary);
    }
    if (getHouseTopInfoModeEnabled("trump")) {
      pushLine(buildTrumpNumberLabel(card)?.primary);
    }
    if (getHouseTopInfoModeEnabled("path")) {
      pushLine(buildPathNumberLabel(card)?.primary);
    }
    if (getHouseTopInfoModeEnabled("date")) {
      pushLine(buildDateLabel(card)?.primary);
    }

    if (!lines.length) {
      return null;
    }

    const hasHebrew = getHouseTopInfoModeEnabled("hebrew") && Boolean(buildHebrewLabel(card)?.primary);
    return {
      primary: lines[0],
      secondary: lines.slice(1).join(" · "),
      className: `${lines.length >= 3 ? "is-dense" : ""}${hasHebrew ? " is-top-hebrew" : ""}`.trim()
    };
  }

  function buildHouseBottomLabel(card) {
    const lines = [];
    const seen = new Set();
    const pushLine = (value) => {
      const text = normalizeLabelText(value);
      const key = text.toLowerCase();
      if (text && !seen.has(key)) {
        seen.add(key);
        lines.push(text);
      }
    };

    if (getHouseBottomInfoModeEnabled("zodiac")) {
      pushLine(buildZodiacLabel(card)?.primary);
    }
    if (getHouseBottomInfoModeEnabled("decan")) {
      const decanLabel = buildDecanLabel(card);
      pushLine(decanLabel?.primary);
      if (!getHouseBottomInfoModeEnabled("date")) {
        pushLine(decanLabel?.secondary);
      }
    }
    if (getHouseBottomInfoModeEnabled("month")) {
      pushLine(buildMonthLabel(card)?.primary);
    }
    if (getHouseBottomInfoModeEnabled("ruler")) {
      pushLine(buildRulerLabel(card)?.primary);
    }
    if (getHouseBottomInfoModeEnabled("date")) {
      pushLine(buildDateLabel(card)?.primary);
    }

    if (!lines.length) {
      return null;
    }

    return {
      primary: lines[0],
      secondary: lines.slice(1).join(" · "),
      className: lines.length >= 3 ? "is-dense" : ""
    };
  }

  function buildHouseLabel(card) {
    if (!card) {
      return null;
    }

    if (isCustomFrameCard(card)) {
      return null;
    }

    return card.arcana === "Major" ? buildHouseTopLabel(card) : buildHouseBottomLabel(card);
  }

  function shouldShowCardImage(card) {
    if (!card) {
      return true;
    }

    if (isCustomFrameCard(card)) {
      return false;
    }

    if (card.arcana === "Major") {
      return config.getHouseTopCardsVisible?.() !== false;
    }

    return config.getHouseBottomCardsVisible?.() !== false;
  }

  function buildCardTextFaceModel(card, slotId = "") {
    if (isCustomFrameCard(card)) {
      const customText = parseCustomCardText(card?.customText);
      const backgroundColor = normalizeCustomCardBackgroundColor(card?.backgroundColor);
      const backgroundImage = normalizeCustomCardBackgroundImage(card?.backgroundImage);
      return {
        primary: customText.primary || "",
        secondary: customText.secondary,
        className: buildCustomLabelFaceClassName(customText, Boolean(backgroundColor || backgroundImage)),
        backgroundColor,
        backgroundImage
      };
    }

    const label = state.showInfo ? buildHouseLabel(card) : null;
    const displayName = normalizeLabelText(getDisplayCardName(card, slotId));

    if (card?.arcana !== "Major" && label?.primary) {
      return {
        primary: displayName || "Tarot",
        secondary: [label.primary, label.secondary].filter(Boolean).join(" · "),
        className: label.className || ""
      };
    }

    if (label?.primary) {
      return {
        primary: label.primary,
        secondary: label.secondary || (displayName && label.primary !== displayName ? displayName : ""),
        className: label.className || ""
      };
    }

    return {
      primary: displayName || "Tarot",
      secondary: "",
      className: ""
    };
  }

  function getCardOverlayDate(card) {
    const court = getRelation(card, "courtDateWindow")?.data || null;
    if (court?.dateStart && court?.dateEnd) {
      return formatDateRange(court.dateStart, court.dateEnd);
    }

    const decan = getRelation(card, "decan")?.data || null;
    if (decan?.dateStart && decan?.dateEnd) {
      return formatDateRange(decan.dateStart, decan.dateEnd);
    }

    const zodiac = getRelation(card, "zodiacCorrespondence")?.data || null;
    const signId = normalizeKey(zodiac?.signId);
    const signStart = ZODIAC_START_TOKEN_BY_SIGN_ID[signId];
    if (signStart) {
      const signIds = Object.keys(ZODIAC_START_TOKEN_BY_SIGN_ID);
      const index = signIds.indexOf(signId);
      const nextSignId = signIds[(index + 1) % signIds.length];
      const nextStart = ZODIAC_START_TOKEN_BY_SIGN_ID[nextSignId];
      const endToken = decrementToken(nextStart);
      return formatDateRange(signStart, endToken);
    }

    return "";
  }

  function getSlotId(row, column) {
    return `${row}:${column}`;
  }

  function isSlotSelected(slotId) {
    return state.selectedSlotIds.has(String(slotId || "").trim());
  }

  function getSelectedSlotIds() {
    return Array.from(state.selectedSlotIds)
      .map((slotId) => String(slotId || "").trim())
      .filter((slotId) => isValidSlotId(slotId) && String(state.slotAssignments.get(slotId) || "").trim())
      .sort(compareSlotIds);
  }

  function setSelectedSlotIds(slotIds) {
    const nextSlotIds = Array.from(new Set(
      (Array.isArray(slotIds) ? slotIds : [])
        .map((slotId) => String(slotId || "").trim())
        .filter((slotId) => isValidSlotId(slotId) && String(state.slotAssignments.get(slotId) || "").trim())
    )).sort(compareSlotIds);
    const changed = nextSlotIds.length !== state.selectedSlotIds.size
      || nextSlotIds.some((slotId) => !state.selectedSlotIds.has(slotId));

    state.selectedSlotIds = new Set(nextSlotIds);
    syncSelectionChip();
    syncSlotSelectionClasses();
    return {
      changed,
      slotIds: nextSlotIds
    };
  }

  function syncSlotSelectionClasses() {
    const { tarotFrameBoardEl } = getElements();
    if (!(tarotFrameBoardEl instanceof HTMLElement)) {
      return;
    }
    const slots = tarotFrameBoardEl.querySelectorAll(".tarot-frame-slot");
    slots.forEach((slotEl) => {
      if (!(slotEl instanceof HTMLElement)) {
        return;
      }
      const sid = String(slotEl.dataset.slotId || "").trim();
      const isSel = sid && state.selectedSlotIds.has(sid);
      slotEl.classList.toggle("is-selected", isSel);
      const btn = slotEl.querySelector(".tarot-frame-card");
      if (btn instanceof HTMLElement) {
        btn.classList.toggle("is-selected", isSel);
      }
    });
  }

  function buildSelectionStatusMessage(count = getSelectedSlotIds().length) {
    if (!(count > 0)) {
      return "Card selection cleared.";
    }

    return `${count} card${count === 1 ? "" : "s"} selected. Drag any selected card to move ${count === 1 ? "it" : "them"} together. Ctrl/Cmd-click adjusts the set on desktop, and touch users can long-press a card for Select Multiple.`;
  }

  function getDragSourceSlotIds(anchorSlotId) {
    const targetSlotId = String(anchorSlotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return [];
    }

    const selectedSlotIds = getSelectedSlotIds();
    if (selectedSlotIds.length > 1 && selectedSlotIds.includes(targetSlotId)) {
      return selectedSlotIds;
    }

    return [targetSlotId];
  }

  function isSlotFlipped(slotId) {
    const targetSlotId = String(slotId || "").trim();
    return Boolean(targetSlotId && state.slotFlips.get(targetSlotId));
  }

  function setSlotFlipState(slotId, isFlipped) {
    const targetSlotId = String(slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return;
    }

    if (isFlipped) {
      state.slotFlips.set(targetSlotId, true);
      return;
    }

    state.slotFlips.delete(targetSlotId);
  }

  function clearSlotAssignmentState(slotId) {
    const targetSlotId = String(slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return;
    }

    state.slotAssignments.delete(targetSlotId);
    state.slotFlips.delete(targetSlotId);
    state.slotDeckOverrides.delete(targetSlotId);
  }

  function assignCardToSlot(slotId, cardId, isFlipped = false, deckId = "") {
    const targetSlotId = String(slotId || "").trim();
    const targetCardId = String(cardId || "").trim();
    if (!isValidSlotId(targetSlotId) || !targetCardId) {
      return false;
    }

    state.slotAssignments.set(targetSlotId, targetCardId);
    setSlotFlipState(targetSlotId, isFlipped);
    setSlotDeckOverride(targetSlotId, deckId);
    return true;
  }

  function moveSlotAssignment(sourceSlotId, targetSlotId) {
    const fromSlotId = String(sourceSlotId || "").trim();
    const toSlotId = String(targetSlotId || "").trim();
    if (!isValidSlotId(fromSlotId) || !isValidSlotId(toSlotId)) {
      return false;
    }

    const cardId = String(state.slotAssignments.get(fromSlotId) || "").trim();
    if (!cardId) {
      return false;
    }

    const isFlipped = isSlotFlipped(fromSlotId);
    const deckId = getSlotDeckOverride(fromSlotId);
    clearSlotAssignmentState(fromSlotId);
    assignCardToSlot(toSlotId, cardId, isFlipped, deckId);
    return true;
  }

  function swapSlotAssignments(sourceSlotId, targetSlotId) {
    const fromSlotId = String(sourceSlotId || "").trim();
    const toSlotId = String(targetSlotId || "").trim();
    if (!isValidSlotId(fromSlotId) || !isValidSlotId(toSlotId)) {
      return false;
    }

    const sourceCardId = String(state.slotAssignments.get(fromSlotId) || "").trim();
    const targetCardId = String(state.slotAssignments.get(toSlotId) || "").trim();
    if (!sourceCardId) {
      return false;
    }

    const sourceFlip = isSlotFlipped(fromSlotId);
    const targetFlip = isSlotFlipped(toSlotId);
    const sourceDeckId = getSlotDeckOverride(fromSlotId);
    const targetDeckId = getSlotDeckOverride(toSlotId);

    state.slotAssignments.set(toSlotId, sourceCardId);
    setSlotFlipState(toSlotId, sourceFlip);
    setSlotDeckOverride(toSlotId, sourceDeckId);
    if (targetCardId) {
      state.slotAssignments.set(fromSlotId, targetCardId);
      setSlotFlipState(fromSlotId, targetFlip);
      setSlotDeckOverride(fromSlotId, targetDeckId);
    } else {
      clearSlotAssignmentState(fromSlotId);
    }

    return true;
  }

  function toggleCardFlip(slotId) {
    const targetSlotId = String(slotId || "").trim();
    if (!isValidSlotId(targetSlotId)) {
      return false;
    }

    const cardId = String(state.slotAssignments.get(targetSlotId) || "").trim();
    if (!cardId) {
      return false;
    }

    const nextIsFlipped = !isSlotFlipped(targetSlotId);
    setSlotFlipState(targetSlotId, nextIsFlipped);
    state.layoutReady = true;
    const slotEl = getSlotElement(targetSlotId);
    const btn = slotEl?.querySelector?.(".tarot-frame-card");
    const card = getCardById(cardId);
    if (btn instanceof HTMLElement) {
      btn.classList.toggle("is-flipped", nextIsFlipped);
      btn.dataset.flipped = nextIsFlipped ? "true" : "false";
      const name = getDisplayCardName(card, targetSlotId);
      const parsed = parseSlotId(targetSlotId);
      btn.title = `${name}${nextIsFlipped ? " (flipped upside down)" : ""}`;
      if (parsed) {
        btn.setAttribute("aria-label", `${name} in row ${parsed.row}, column ${parsed.column}${nextIsFlipped ? ", flipped upside down" : ""}${isSlotSelected(targetSlotId) ? ", selected for group move" : ""}`);
      }
    }
    setStatus(`${getDisplayCardName(card, targetSlotId)} flipped ${nextIsFlipped ? "upside down" : "upright"} at ${describeSlot(targetSlotId)}.`);
    return true;
  }

  function setStatus(message) {
    state.statusMessage = String(message || "").trim();
    const { tarotFrameStatusEl } = getElements();
    if (tarotFrameStatusEl) {
      tarotFrameStatusEl.textContent = state.statusMessage;
      // Re-trigger the entrance animation on every status update.
      tarotFrameStatusEl.classList.remove("is-updated");
      requestAnimationFrame(() => {
        tarotFrameStatusEl.classList.add("is-updated");
      });
    }
  }

  function applyLayoutPreset(layoutId = state.currentLayoutId, cards = getCards(), nextStatusMessage = "") {
    const layoutPreset = getLayoutPreset(layoutId) || LAYOUT_PRESETS[0];
    state.currentLayoutId = layoutPreset.id;
    state.slotAssignments.clear();
    state.slotFlips.clear();
    state.slotDeckOverrides.clear();
    state.selectedSlotIds.clear();
    state.customCards.clear();

    layoutPreset.buildPlacements(cards).forEach((placement) => {
      assignCardToSlot(getSlotId(placement.row, placement.column), placement.cardId);
    });

    state.layoutReady = true;
    persistActiveLayoutId(layoutPreset.id);
    setStatus(nextStatusMessage || layoutPreset.statusMessage || buildReadyStatus(cards));
  }

  function applySavedLayout(layoutId = state.currentLayoutId, cards = getCards(), nextStatusMessage = "") {
    const savedLayout = getSavedLayout(layoutId);
    if (!savedLayout) {
      applyLayoutPreset("frames", cards, nextStatusMessage);
      return;
    }

    state.customCards = new Map((savedLayout.customCards || []).map((card) => [getCardId(card), card]));
    const cardMap = getCardMap(cards);
    state.currentLayoutId = savedLayout.id;
    state.slotAssignments.clear();
    state.slotFlips.clear();
    state.slotDeckOverrides.clear();
    state.selectedSlotIds.clear();
    savedLayout.slotAssignments.forEach((entry) => {
      if (cardMap.has(entry.cardId)) {
        assignCardToSlot(entry.slotId, entry.cardId, Boolean(entry.isFlipped), entry.deckId);
      }
    });
    applyFrameSettingsSnapshot(savedLayout.settings);
    state.layoutReady = true;
    persistActiveLayoutId(savedLayout.id);
    setStatus(nextStatusMessage || savedLayout.statusMessage || `${savedLayout.label} layout applied to the master grid.`);
  }

  function applyLayoutSelection(layoutId = state.currentLayoutId, cards = getCards(), nextStatusMessage = "") {
    if (isCustomLayout(layoutId)) {
      applySavedLayout(layoutId, cards, nextStatusMessage);
      return;
    }

    applyLayoutPreset(layoutId, cards, nextStatusMessage);
  }

  function resetLayout(cards = getCards(), nextStatusMessage = "") {
    applyLayoutSelection(state.currentLayoutId, cards, nextStatusMessage);
  }

  function buildSavedLayoutMenuDescription(layout) {
    const zoomLabel = Number.isFinite(Number(layout?.settings?.gridZoomScale))
      ? `${Math.round(clampFrameGridZoomScale(layout.settings.gridZoomScale) * 100)}% zoom`
      : (Number.isFinite(Number(layout?.settings?.gridZoomStepIndex))
        ? `${Math.round((FRAME_GRID_ZOOM_STEPS[layout.settings.gridZoomStepIndex] || FRAME_GRID_ZOOM_STEPS[0]) * 100)}% zoom`
        : "saved settings");
    const infoLabel = layout?.settings?.showInfo === false ? "info hidden" : "info visible";
    const noteLabel = normalizeLayoutNote(layout?.note || state.layoutNotesById?.[layout?.id]) ? "note added" : "no note";
    const customLabelCount = Array.isArray(layout?.customCards) ? layout.customCards.length : 0;
    const customLabelText = customLabelCount ? ` · ${customLabelCount} label${customLabelCount === 1 ? "" : "s"}` : "";
    return `${layout?.slotAssignments?.length || 0} saved slots${customLabelText} · ${zoomLabel} · ${infoLabel} · ${noteLabel}`;
  }

  function createLayoutOptionButton(layout, isActive) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tarot-frame-layout-option";
    button.dataset.layoutId = layout.id;
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("aria-checked", isActive ? "true" : "false");
    button.classList.toggle("is-active", isActive);
    button.disabled = Boolean(state.exportInProgress);

    const titleEl = document.createElement("strong");
    titleEl.textContent = layout.label;
    const headEl = document.createElement("span");
    headEl.className = "tarot-frame-layout-option-head";
    headEl.appendChild(titleEl);
    if (isActive) {
      const activeBadgeEl = document.createElement("span");
      activeBadgeEl.className = "tarot-frame-layout-option-active";
      activeBadgeEl.textContent = "Active";
      headEl.appendChild(activeBadgeEl);
    }
    const descriptionEl = document.createElement("span");
    descriptionEl.textContent = layout.isCustom
      ? buildSavedLayoutMenuDescription(layout)
      : (layout.id === "house"
        ? "The legacy house composition rebuilt inside the 24x24 snap grid."
        : "The current master frame with top-row extras and nested chronological rings.");
    button.append(headEl, descriptionEl);
    return button;
  }

  function syncBuiltInLayoutOptions() {
    const { tarotFrameLayoutOptionsEl } = getElements();
    if (!(tarotFrameLayoutOptionsEl instanceof HTMLElement)) {
      return;
    }
    tarotFrameLayoutOptionsEl.querySelectorAll("[data-layout-preset-id]").forEach((optionEl) => {
      const isActive = optionEl.dataset.layoutPresetId === state.currentLayoutId;
      optionEl.classList.toggle("is-active", isActive);
      optionEl.setAttribute("aria-checked", isActive ? "true" : "false");
    });
  }

  function renderFramesPanel() {
    const { tarotFrameFramesPanelEl } = getElements();
    if (!(tarotFrameFramesPanelEl instanceof HTMLElement)) {
      return;
    }

    tarotFrameFramesPanelEl.replaceChildren();

    const naming = state.framesPanelMode === "new" || state.framesPanelMode === "rename";
    if (naming) {
      const editing = state.framesPanelMode === "rename";
      const current = editing ? getSavedLayout(state.framesPanelRenameId) : null;
      if (editing && !current) {
        state.framesPanelMode = "list";
        state.framesPanelRenameId = "";
      } else {
        const titleEl = document.createElement("div");
        titleEl.className = "tarot-frame-layout-section-title";
        titleEl.textContent = editing ? "Rename Frame" : "New Frame";
        tarotFrameFramesPanelEl.appendChild(titleEl);

        const formEl = document.createElement("div");
        formEl.className = "tarot-frame-frame-form";
        const inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.className = "tarot-frame-frame-name-input";
        inputEl.maxLength = 80;
        inputEl.placeholder = "Frame name";
        inputEl.value = editing ? (current?.label || "") : "";
        formEl.appendChild(inputEl);

        const formActionsEl = document.createElement("div");
        formActionsEl.className = "tarot-frame-frame-form-actions";
        const commitEl = document.createElement("button");
        commitEl.type = "button";
        commitEl.className = "tarot-frame-layout-save-btn";
        commitEl.dataset.frameAction = "commit-name";
        commitEl.textContent = editing ? "Save Name" : "Create Frame";
        const cancelEl = document.createElement("button");
        cancelEl.type = "button";
        cancelEl.className = "tarot-frame-frame-action-btn";
        cancelEl.dataset.frameAction = "cancel-name";
        cancelEl.textContent = "Cancel";
        formActionsEl.append(commitEl, cancelEl);
        formEl.appendChild(formActionsEl);
        tarotFrameFramesPanelEl.appendChild(formEl);

        inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitFrameName(inputEl.value);
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancelFrameName();
          }
        });
        window.setTimeout(() => inputEl.focus(), 30);
        return;
      }
    }

    const actionsEl = document.createElement("div");
    actionsEl.className = "tarot-frame-frames-actions";

    const activeFrame = getSavedLayout(state.currentLayoutId);
    if (activeFrame) {
      const saveActiveEl = document.createElement("button");
      saveActiveEl.type = "button";
      saveActiveEl.className = "tarot-frame-layout-save-btn";
      saveActiveEl.dataset.frameAction = "save-active";
      saveActiveEl.textContent = "Save Frame";
      saveActiveEl.title = `Update "${activeFrame.label}" with the current arrangement`;
      saveActiveEl.disabled = Boolean(state.exportInProgress);
      actionsEl.appendChild(saveActiveEl);
    }

    const newButtonEl = document.createElement("button");
    newButtonEl.type = "button";
    newButtonEl.className = "tarot-frame-layout-save-btn";
    newButtonEl.dataset.frameAction = "new";
    newButtonEl.textContent = "New Frame";
    newButtonEl.title = "Name and save the current arrangement as a new frame";
    newButtonEl.disabled = Boolean(state.exportInProgress);
    actionsEl.appendChild(newButtonEl);
    tarotFrameFramesPanelEl.appendChild(actionsEl);

    if (!state.customLayouts.length) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "tarot-frame-layout-empty-note";
      emptyEl.textContent = "No frames yet. Arrange cards, then choose New Frame to name and save this state.";
      tarotFrameFramesPanelEl.appendChild(emptyEl);
      return;
    }

    state.customLayouts.forEach((frame) => {
      const rowEl = document.createElement("div");
      rowEl.className = "tarot-frame-frame-entry";
      rowEl.appendChild(createLayoutOptionButton(frame, state.currentLayoutId === frame.id));

      const renameButtonEl = document.createElement("button");
      renameButtonEl.type = "button";
      renameButtonEl.className = "tarot-frame-frame-action-btn";
      renameButtonEl.dataset.frameAction = "rename";
      renameButtonEl.dataset.frameId = frame.id;
      renameButtonEl.textContent = "Rename";
      renameButtonEl.disabled = Boolean(state.exportInProgress);
      renameButtonEl.setAttribute("aria-label", `Rename frame ${frame.label}`);
      rowEl.appendChild(renameButtonEl);

      const deleteButtonEl = document.createElement("button");
      deleteButtonEl.type = "button";
      deleteButtonEl.className = "tarot-frame-layout-delete-btn";
      deleteButtonEl.dataset.frameAction = "delete";
      deleteButtonEl.dataset.frameId = frame.id;
      deleteButtonEl.textContent = "Delete";
      deleteButtonEl.disabled = Boolean(state.exportInProgress);
      deleteButtonEl.setAttribute("aria-label", `Delete frame ${frame.label}`);
      rowEl.appendChild(deleteButtonEl);

      tarotFrameFramesPanelEl.appendChild(rowEl);
    });
  }

  function beginNewFrame() {
    state.framesPanelMode = "new";
    state.framesPanelRenameId = "";
    renderFramesPanel();
  }

  function saveActiveFrame() {
    const activeFrame = getSavedLayout(state.currentLayoutId);
    if (!activeFrame) {
      beginNewFrame();
      return;
    }
    saveCurrentLayout(activeFrame.label);
  }

  function beginRenameFrame(frameId) {
    const frame = getSavedLayout(frameId);
    if (!frame) {
      return;
    }
    state.framesPanelMode = "rename";
    state.framesPanelRenameId = frame.id;
    renderFramesPanel();
  }

  function cancelFrameName() {
    state.framesPanelMode = "list";
    state.framesPanelRenameId = "";
    renderFramesPanel();
  }

  function commitFrameName(rawName) {
    const label = normalizeLayoutLabel(rawName);
    if (!label) {
      setStatus("Enter a name for this frame.");
      return;
    }
    const ok = state.framesPanelMode === "rename"
      ? renameSavedLayout(state.framesPanelRenameId, label)
      : saveCurrentLayout(label);
    if (ok) {
      state.framesPanelMode = "list";
      state.framesPanelRenameId = "";
    }
    renderFramesPanel();
  }

  function openFrameSettings() {
    const { tarotFrameSettingsPanelEl } = getElements();
    if (!(tarotFrameSettingsPanelEl instanceof HTMLElement) || state.settingsOverlayOpen) {
      return;
    }

    const overlayApi = window.TaroOverlay;
    if (!overlayApi?.open) {
      // Fallback to the inline dropdown when the shared overlay is unavailable.
      state.settingsOpen = true;
      syncControls();
      return;
    }

    state.settingsPanelRestore = {
      parent: tarotFrameSettingsPanelEl.parentNode,
      nextSibling: tarotFrameSettingsPanelEl.nextSibling
    };

    overlayApi.open({
        title: "Frame",
      body: tarotFrameSettingsPanelEl,
      size: "large",
      className: "tarot-frame-settings-overlay",
      onClose: () => {
        state.settingsOverlayOpen = false;
        state.settingsOpen = false;
        const restore = state.settingsPanelRestore;
        state.settingsPanelRestore = null;
        if (restore?.parent) {
          restore.parent.insertBefore(tarotFrameSettingsPanelEl, restore.nextSibling || null);
        }
        tarotFrameSettingsPanelEl.hidden = true;
        syncControls();
      }
    });

    // Set state after open() so any overlay it dismisses cannot hide our panel.
    state.settingsOverlayOpen = true;
    state.settingsOpen = true;
    tarotFrameSettingsPanelEl.hidden = false;
    renderFramesPanel();
  }

  function closeFrameSettings() {
    if (state.settingsOverlayOpen) {
      window.TaroOverlay?.close?.();
      return;
    }
    if (state.settingsOpen) {
      state.settingsOpen = false;
      syncControls();
    }
  }

  function saveCurrentLayout(providedLabel = "") {
    const cards = getCards();
    if (!cards.length) {
      setStatus("Tarot cards are still loading...");
      return false;
    }

    const activeSavedLayout = getSavedLayout(state.currentLayoutId);
    let label = normalizeLayoutLabel(providedLabel);
    if (!label) {
      const suggestedName = activeSavedLayout?.label || "";
      const inputName = window.prompt("Save current frame as:", suggestedName);
      if (inputName === null) {
        return false;
      }
      label = normalizeLayoutLabel(inputName);
    }
    if (!label) {
      setStatus("Frame save cancelled. Enter a name to save this arrangement.");
      return false;
    }

    const existingLayout = state.customLayouts.find((layout) => normalizeKey(layout.label) === normalizeKey(label)) || null;
    if (existingLayout && existingLayout.id !== activeSavedLayout?.id) {
      const shouldOverwrite = window.confirm(`Replace the frame \"${existingLayout.label}\"?`);
      if (!shouldOverwrite) {
        return false;
      }
    }

    const savedLayout = normalizeSavedLayoutRecord({
      id: existingLayout?.id || activeSavedLayout?.id || createSavedLayoutId(),
      label,
      slotAssignments: captureSlotAssignmentsSnapshot(cards),
      customCards: captureCustomCardsSnapshot(),
      settings: buildFrameSettingsSnapshot(),
      note: getLayoutNote(state.currentLayoutId),
      createdAt: existingLayout?.createdAt || activeSavedLayout?.createdAt || new Date().toISOString()
    });
    if (!savedLayout) {
      setStatus("Unable to save this frame.");
      return false;
    }

    state.customLayouts = [...state.customLayouts.filter((layout) => layout.id !== savedLayout.id), savedLayout]
      .sort((left, right) => String(left.label || "").localeCompare(String(right.label || "")));
    state.currentLayoutId = savedLayout.id;
    setLayoutNote(savedLayout.id, savedLayout.note, { updateUi: false });
    persistSavedLayouts();
    persistActiveLayoutId(savedLayout.id);
    render();
    syncControls();
    setStatus(canUseProfileLayoutStore()
      ? `Saved frame \"${savedLayout.label}\" to your profile.`
      : `Saved frame \"${savedLayout.label}\" in this browser.`);
    return true;
  }

  function renameSavedLayout(layoutId, providedLabel = "") {
    const savedLayout = getSavedLayout(layoutId);
    if (!savedLayout) {
      return false;
    }

    let label = normalizeLayoutLabel(providedLabel);
    if (!label) {
      const inputName = window.prompt("Rename frame:", savedLayout.label);
      if (inputName === null) {
        return false;
      }
      label = normalizeLayoutLabel(inputName);
    }
    if (!label) {
      setStatus("Rename cancelled. Enter a name for this frame.");
      return false;
    }

    const duplicate = state.customLayouts.find((layout) => (
      layout.id !== savedLayout.id && normalizeKey(layout.label) === normalizeKey(label)
    ));
    if (duplicate) {
      setStatus(`A frame named "${label}" already exists.`);
      return false;
    }

    const renamed = normalizeSavedLayoutRecord({ ...savedLayout, label });
    if (!renamed) {
      setStatus("Could not rename this frame.");
      return false;
    }

    state.customLayouts = state.customLayouts
      .map((layout) => (layout.id === savedLayout.id ? renamed : layout))
      .sort((left, right) => String(left.label || "").localeCompare(String(right.label || "")));
    persistSavedLayouts();
    renderFramesPanel();
    syncControls();
    setStatus(`Renamed frame to "${label}".`);
    return true;
  }

  function deleteSavedLayout(layoutId) {
    const savedLayout = getSavedLayout(layoutId);
    if (!savedLayout) {
      return;
    }

    const shouldDelete = window.confirm(`Delete the frame \"${savedLayout.label}\"?`);
    if (!shouldDelete) {
      return;
    }

    state.customLayouts = state.customLayouts.filter((layout) => layout.id !== savedLayout.id);
    delete state.layoutNotesById[savedLayout.id];
    persistSavedLayouts();
    persistLayoutNotes();

    const cards = getCards();
    if (state.currentLayoutId === savedLayout.id) {
      applyLayoutPreset("frames", cards, `Deleted frame \"${savedLayout.label}\". Frames layout applied to the master grid.`);
      render();
      syncControls();
      return;
    }

    syncControls();
    setStatus(`Deleted frame \"${savedLayout.label}\".`);
  }

  function getAssignedCard(slotId, cardMap) {
    const cardId = String(state.slotAssignments.get(slotId) || "").trim();
    return cardMap.get(cardId) || null;
  }

  function computeCardOverlayLabel(card, slotId = "") {
    if (isCustomFrameCard(card)) {
      return "";
    }

    const label = buildHouseLabel(card);
    const structuredLabel = normalizeLabelText([label?.primary, label?.secondary].filter(Boolean).join(" · "));
    if (structuredLabel) {
      return structuredLabel;
    }

    return getCardOverlayDate(card) || formatMonthDay(getRelation(card, "decan")?.data?.dateStart) || getDisplayCardName(card, slotId);
  }

  function getCardOverlayLabel(card, slotId = "") {
    if (!state.showInfo) {
      return "";
    }
    return computeCardOverlayLabel(card, slotId);
  }

  function getOccupiedGridBounds(gridTrackEl) {
    if (!(gridTrackEl instanceof HTMLElement)) {
      return null;
    }

    const filledSlots = Array.from(gridTrackEl.querySelectorAll(".tarot-frame-slot:not(.is-empty-slot)"));
    if (!filledSlots.length) {
      return null;
    }

    const trackRect = gridTrackEl.getBoundingClientRect();
    return filledSlots.reduce((bounds, slotEl) => {
      if (!(slotEl instanceof HTMLElement)) {
        return bounds;
      }

      const slotRect = slotEl.getBoundingClientRect();
      const left = slotRect.left - trackRect.left;
      const right = slotRect.right - trackRect.left;
      if (!bounds) {
        return { left, right };
      }

      return {
        left: Math.min(bounds.left, left),
        right: Math.max(bounds.right, right)
      };
    }, null);
  }

  function resetFrameSectionScroll() {
    const sectionEl = document.getElementById("tarot-frame-section");
    if (!(sectionEl instanceof HTMLElement)) {
      return;
    }

    sectionEl.scrollTop = 0;
  }

  function centerGridViewport(attempt = 0) {
    const { tarotFrameBoardEl } = getElements();
    const gridViewportEl = tarotFrameBoardEl?.querySelector(".tarot-frame-grid-viewport");
    const gridTrackEl = tarotFrameBoardEl?.querySelector(".tarot-frame-grid-track");
    if (!(gridViewportEl instanceof HTMLElement) || !(gridTrackEl instanceof HTMLElement)) {
      return;
    }

    requestAnimationFrame(() => {
      if (!(gridViewportEl instanceof HTMLElement) || !(gridTrackEl instanceof HTMLElement)) {
        return;
      }

      const contentWidth = gridTrackEl.scrollWidth || gridTrackEl.offsetWidth;
      const viewportWidth = gridViewportEl.clientWidth;
      if (!contentWidth || !viewportWidth) {
        if (attempt < 6) {
          centerGridViewport(attempt + 1);
        }
        return;
      }

      const occupiedBounds = getOccupiedGridBounds(gridTrackEl);
      const targetCenter = occupiedBounds
        ? (occupiedBounds.left + occupiedBounds.right) / 2
        : contentWidth / 2;
      const maxScrollLeft = Math.max(0, contentWidth - viewportWidth);
      const targetScrollLeft = Math.min(Math.max(targetCenter - (viewportWidth / 2), 0), maxScrollLeft);
      gridViewportEl.scrollLeft = targetScrollLeft;

      requestAnimationFrame(() => {
        if (!(gridViewportEl instanceof HTMLElement) || !(gridTrackEl instanceof HTMLElement)) {
          return;
        }

        const nextContentWidth = gridTrackEl.scrollWidth || gridTrackEl.offsetWidth;
        const nextViewportWidth = gridViewportEl.clientWidth;
        if (!nextContentWidth || !nextViewportWidth) {
          if (attempt < 6) {
            centerGridViewport(attempt + 1);
          }
          return;
        }

        const nextOccupiedBounds = getOccupiedGridBounds(gridTrackEl);
        const nextTargetCenter = nextOccupiedBounds
          ? (nextOccupiedBounds.left + nextOccupiedBounds.right) / 2
          : nextContentWidth / 2;
        const nextMaxScrollLeft = Math.max(0, nextContentWidth - nextViewportWidth);
        const nextTargetScrollLeft = Math.min(Math.max(nextTargetCenter - (nextViewportWidth / 2), 0), nextMaxScrollLeft);
        gridViewportEl.scrollLeft = nextTargetScrollLeft;
      });
    });
  }

  function captureGridViewportSnapshot() {
    const viewportEl = getGridViewportElement();
    if (!(viewportEl instanceof HTMLElement)) {
      return null;
    }

    return {
      scrollLeft: viewportEl.scrollLeft,
      scrollTop: viewportEl.scrollTop
    };
  }

  function captureGridViewportAnchor(clientX, clientY, scale = getGridZoomScale()) {
    const viewportEl = getGridViewportElement();
    if (!(viewportEl instanceof HTMLElement)) {
      return null;
    }

    const rect = viewportEl.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0 && scale > 0)) {
      return null;
    }

    const offsetX = Math.min(Math.max((Number(clientX) || 0) - rect.left, 0), rect.width);
    const offsetY = Math.min(Math.max((Number(clientY) || 0) - rect.top, 0), rect.height);

    return {
      offsetX,
      offsetY,
      contentX: (viewportEl.scrollLeft + offsetX) / scale,
      contentY: (viewportEl.scrollTop + offsetY) / scale
    };
  }

  function cancelPendingGridViewportRestore() {
    if (!pendingGridViewportRestoreFrameId) {
      return;
    }

    window.cancelAnimationFrame(pendingGridViewportRestoreFrameId);
    pendingGridViewportRestoreFrameId = 0;
  }

  function applyClampedGridViewportScroll(viewportEl, scrollLeft, scrollTop) {
    if (!(viewportEl instanceof HTMLElement)) {
      return;
    }

    const maxScrollLeft = Math.max(0, viewportEl.scrollWidth - viewportEl.clientWidth);
    const maxScrollTop = Math.max(0, viewportEl.scrollHeight - viewportEl.clientHeight);
    viewportEl.scrollLeft = Math.min(Math.max(Number(scrollLeft) || 0, 0), maxScrollLeft);
    viewportEl.scrollTop = Math.min(Math.max(Number(scrollTop) || 0, 0), maxScrollTop);
  }

  function restoreGridViewport(snapshot) {
    if (!snapshot) {
      return;
    }

    const viewportEl = getGridViewportElement();
    if (!(viewportEl instanceof HTMLElement)) {
      return;
    }

    cancelPendingGridViewportRestore();
    applyClampedGridViewportScroll(viewportEl, snapshot.scrollLeft, snapshot.scrollTop);

    pendingGridViewportRestoreFrameId = window.requestAnimationFrame(() => {
      pendingGridViewportRestoreFrameId = 0;
      const activeViewportEl = getGridViewportElement();
      if (!(activeViewportEl instanceof HTMLElement)) {
        return;
      }

      applyClampedGridViewportScroll(activeViewportEl, snapshot.scrollLeft, snapshot.scrollTop);
    });
  }

  function restoreGridViewportAnchor(anchorSnapshot, scale = getGridZoomScale(), options = {}) {
    if (!anchorSnapshot) {
      return;
    }

    const applyAnchor = () => {
      const viewportEl = getGridViewportElement();
      if (!(viewportEl instanceof HTMLElement) || !(scale > 0)) {
        return;
      }

      const targetScrollLeft = (Number(anchorSnapshot.contentX) * scale) - Number(anchorSnapshot.offsetX);
      const targetScrollTop = (Number(anchorSnapshot.contentY) * scale) - Number(anchorSnapshot.offsetY);
      applyClampedGridViewportScroll(viewportEl, targetScrollLeft, targetScrollTop);
    };

    cancelPendingGridViewportRestore();
    applyAnchor();

    if (options.defer === false) {
      return;
    }

    pendingGridViewportRestoreFrameId = window.requestAnimationFrame(() => {
      pendingGridViewportRestoreFrameId = 0;
      applyAnchor();
    });
  }

  function createCardTextFaceElement(faceModel) {
    const faceEl = document.createElement("span");
    faceEl.className = `tarot-frame-card-text-face${faceModel?.className ? ` ${faceModel.className}` : ""}`;
    const backgroundColor = normalizeCustomCardBackgroundColor(faceModel?.backgroundColor);
    const backgroundImage = normalizeCustomCardBackgroundImage(faceModel?.backgroundImage);

    if (backgroundImage) {
      faceEl.classList.add("has-custom-image");
      faceEl.style.backgroundColor = backgroundColor || "";
      faceEl.style.backgroundImage = `url("${backgroundImage.replace(/"/g, '\\"')}")`;
      faceEl.style.backgroundSize = "cover";
      faceEl.style.backgroundPosition = "center";
      faceEl.style.backgroundRepeat = "no-repeat";
    } else if (backgroundColor) {
      faceEl.style.background = backgroundColor;
      faceEl.style.backgroundImage = "none";
    }

    if (faceModel?.primary) {
      const primaryEl = document.createElement("span");
      primaryEl.className = "tarot-frame-card-text-primary";
      primaryEl.textContent = faceModel.primary;
      faceEl.appendChild(primaryEl);
    }

    if (faceModel?.secondary) {
      const secondaryEl = document.createElement("span");
      secondaryEl.className = "tarot-frame-card-text-secondary";
      secondaryEl.textContent = faceModel.secondary;
      faceEl.appendChild(secondaryEl);
    }

    return faceEl;
  }

  function createSlot(row, column, card) {
    const slotId = getSlotId(row, column);
    const flipped = isSlotFlipped(slotId);
    const selected = isSlotSelected(slotId);
    const slotEl = document.createElement("div");
    slotEl.className = "tarot-frame-slot";
    slotEl.dataset.slotId = slotId;
    slotEl.style.gridRow = String(row);
    slotEl.style.gridColumn = String(column);

    if (selected) {
      slotEl.classList.add("is-selected");
    }

    if (Array.isArray(state.drag?.sourceSlotIds) && state.drag.sourceSlotIds.includes(slotId)) {
      slotEl.classList.add("is-drag-source");
    }

    if (Array.isArray(state.drag?.hoverSlotIds) && state.drag.hoverSlotIds.includes(slotId) && state.drag?.started) {
      slotEl.classList.add("is-drop-target");
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "tarot-frame-card";
    button.dataset.slotId = slotId;
    button.draggable = false;
    button.classList.toggle("is-flipped", flipped);
    button.classList.toggle("is-selected", selected);
    button.dataset.flipped = flipped ? "true" : "false";

    if (!card) {
      slotEl.classList.add("is-empty-slot");
      button.classList.add("is-empty");
      button.setAttribute("aria-label", `Empty slot at row ${row}, column ${column}`);
      button.tabIndex = -1;
      const emptyEl = document.createElement("span");
      emptyEl.className = "tarot-frame-slot-empty";
      button.appendChild(emptyEl);
      slotEl.appendChild(button);
      return slotEl;
    }

    button.dataset.cardId = getCardId(card);
    button.setAttribute("aria-label", `${getDisplayCardName(card, slotId)} in row ${row}, column ${column}${flipped ? ", flipped upside down" : ""}${selected ? ", selected for group move" : ""}`);
    button.title = `${getDisplayCardName(card, slotId)}${flipped ? " (flipped upside down)" : ""}`;

    const showImage = shouldShowCardImage(card);

    const imageSrc = resolveCardThumbnail(card, slotId);
    if (showImage && imageSrc) {
      const imageCached = tarotCardImages.isImageLoaded?.(imageSrc) === true;
      const image = document.createElement("img");
      image.className = "tarot-frame-card-image";
      image.src = imageSrc;
      image.alt = getDisplayCardName(card, slotId);
      image.loading = imageCached ? "eager" : "lazy";
      image.decoding = "async";
      image.sizes = "120px";
      image.draggable = false;
      button.appendChild(image);
    } else if (showImage) {
      const fallback = document.createElement("span");
      fallback.className = "tarot-frame-card-fallback";
      fallback.textContent = getDisplayCardName(card, slotId);
      button.appendChild(fallback);
    } else {
      button.appendChild(createCardTextFaceElement(buildCardTextFaceModel(card, slotId)));
    }

    if (showImage) {
      // Always render the badge; `is-info-hidden` on the grid hides it, so the
      // info toggle is a class flip instead of rebuilding all 576 slots.
      const overlay = document.createElement("span");
      overlay.className = "tarot-frame-card-badge";
      overlay.textContent = computeCardOverlayLabel(card, slotId);
      button.appendChild(overlay);
    }

    slotEl.appendChild(button);
    return slotEl;
  }

  function createLegend(layoutPreset) {
    const legendEl = document.createElement("div");
    legendEl.className = "tarot-frame-legend";
    layoutPreset.legendItems.forEach((layout) => {
      const itemEl = document.createElement("div");
      itemEl.className = "tarot-frame-legend-item";

      const titleEl = document.createElement("strong");
      titleEl.textContent = layout.title;
      const textEl = document.createElement("span");
      textEl.textContent = layout.description;
      itemEl.append(titleEl, textEl);
      legendEl.appendChild(itemEl);
    });
    return legendEl;
  }

  function createOverview(layoutPreset, cards = getCards()) {
    const overviewEl = document.createElement("section");
    overviewEl.className = "tarot-frame-overview";

    const summaryEl = document.createElement("div");
    summaryEl.className = "tarot-frame-overview-summary";

    const headEl = document.createElement("div");
    headEl.className = "tarot-frame-overview-head";

    const titleWrapEl = document.createElement("div");
    const eyebrowEl = document.createElement("div");
    eyebrowEl.className = "tarot-frame-overview-eyebrow";
    eyebrowEl.textContent = layoutPreset?.isCustom ? "Saved Layout" : "Layout Guide";
    const titleEl = document.createElement("h3");
    titleEl.className = "tarot-frame-panel-title";
    titleEl.textContent = layoutPreset.title;
    const subtitleEl = document.createElement("p");
    subtitleEl.className = "tarot-frame-panel-subtitle";
    subtitleEl.textContent = layoutPreset.subtitle;
    titleWrapEl.append(eyebrowEl, titleEl, subtitleEl);

    const countEl = document.createElement("span");
    countEl.className = "tarot-frame-panel-count";
    countEl.textContent = buildPanelCountText(cards);
    headEl.append(titleWrapEl, countEl);
    summaryEl.appendChild(headEl);

    if (Array.isArray(layoutPreset.legendItems) && layoutPreset.legendItems.length) {
      summaryEl.appendChild(createLegend(layoutPreset));
    }

    const notesEl = document.createElement("section");
    notesEl.className = "tarot-frame-notes-card";

    const notesHeadEl = document.createElement("div");
    notesHeadEl.className = "tarot-frame-notes-head";
    const notesTitleWrapEl = document.createElement("div");
    const notesTitleEl = document.createElement("h4");
    notesTitleEl.className = "tarot-frame-notes-title";
    notesTitleEl.textContent = "Layout Notes";
    const notesCopyEl = document.createElement("p");
    notesCopyEl.className = "tarot-frame-notes-copy";
    notesCopyEl.textContent = "Saved automatically in this browser for the current layout.";
    notesTitleWrapEl.append(notesTitleEl, notesCopyEl);
    const notesBadgeEl = document.createElement("span");
    notesBadgeEl.className = "tarot-frame-notes-badge";
    notesBadgeEl.textContent = getLayoutNote() ? "Saved" : "Optional";
    notesHeadEl.append(notesTitleWrapEl, notesBadgeEl);

    const noteFieldEl = document.createElement("label");
    noteFieldEl.className = "tarot-frame-notes-field";
    const noteLabelEl = document.createElement("span");
    noteLabelEl.textContent = "Custom text / notes";
    const noteInputEl = document.createElement("textarea");
    noteInputEl.id = "tarot-frame-layout-note";
    noteInputEl.rows = 7;
    noteInputEl.maxLength = 1600;
    noteInputEl.placeholder = getLayoutNotePlaceholder(layoutPreset);
    noteInputEl.value = getLayoutNote();
    noteInputEl.disabled = Boolean(state.exportInProgress);
    noteFieldEl.append(noteLabelEl, noteInputEl);

    const notesFooterEl = document.createElement("div");
    notesFooterEl.className = "tarot-frame-notes-footer";
    const notesHintEl = document.createElement("span");
    notesHintEl.textContent = layoutPreset?.isCustom
      ? "This note stays with the saved layout and reopens with it."
      : "Use this area for placement reminders, timing, or custom reading instructions.";
    const clearButtonEl = document.createElement("button");
    clearButtonEl.type = "button";
    clearButtonEl.className = "tarot-frame-notes-clear";
    clearButtonEl.dataset.frameNoteClear = "true";
    clearButtonEl.textContent = "Clear Note";
    clearButtonEl.disabled = !getLayoutNote() || Boolean(state.exportInProgress);
    notesFooterEl.append(notesHintEl, clearButtonEl);

    notesEl.append(notesHeadEl, noteFieldEl, notesFooterEl);
    overviewEl.append(summaryEl, notesEl);
    return overviewEl;
  }

  function applyShowInfoToGrid() {
    const { tarotFrameBoardEl } = getElements();
    const grids = tarotFrameBoardEl?.querySelectorAll?.(".tarot-frame-grid") || [];
    grids.forEach((gridEl) => {
      gridEl.classList.toggle("is-info-hidden", !state.showInfo);
    });
  }

  function render(options = {}) {
    const { tarotFrameBoardEl, tarotFrameOverviewEl } = getElements();
    if (!tarotFrameBoardEl || !tarotFrameOverviewEl) {
      return;
    }

    state.selectedSlotIds = new Set(getSelectedSlotIds());
    syncSelectionChip();

    const preserveViewport = options.preserveViewport === true;
    const viewportSnapshot = preserveViewport ? captureGridViewportSnapshot() : null;

    const cards = getCards();
    const cardMap = getCardMap(cards);
    const layoutPreset = getLayoutDefinition();
    tarotFrameOverviewEl.replaceChildren();
    tarotFrameBoardEl.replaceChildren();

    tarotFrameOverviewEl.appendChild(createOverview(layoutPreset, cards));
    applyLayoutGuideUi();

    const panelEl = document.createElement("section");
    panelEl.className = "tarot-frame-panel tarot-frame-panel--master";
    panelEl.style.setProperty("--frame-grid-zoom-scale", String(getGridZoomScale()));

    const gridViewportEl = document.createElement("div");
    gridViewportEl.className = "tarot-frame-grid-viewport";

    const gridTrackEl = document.createElement("div");
    gridTrackEl.className = "tarot-frame-grid-track";

    const gridEl = document.createElement("div");
    gridEl.className = "tarot-frame-grid tarot-frame-grid--master";
    gridEl.classList.toggle("is-info-hidden", !state.showInfo);
    gridEl.style.setProperty("--frame-grid-size", String(MASTER_GRID_SIZE));

    const gridFragment = document.createDocumentFragment();
    for (let row = 1; row <= MASTER_GRID_SIZE; row += 1) {
      for (let column = 1; column <= MASTER_GRID_SIZE; column += 1) {
        gridFragment.appendChild(createSlot(row, column, getAssignedCard(getSlotId(row, column), cardMap)));
      }
    }
    gridEl.appendChild(gridFragment);

    gridTrackEl.appendChild(gridEl);
    gridViewportEl.appendChild(gridTrackEl);
    panelEl.appendChild(gridViewportEl);
    tarotFrameBoardEl.appendChild(panelEl);
    updateViewportInteractionState();
    if (preserveViewport) {
      restoreGridViewport(viewportSnapshot);
      return;
    }

    centerGridViewport();
  }

  function applyGridZoomState(options = {}) {
    const { tarotFrameBoardEl, tarotFrameOverviewEl } = getElements();
    const panelEl = tarotFrameBoardEl?.querySelector(".tarot-frame-panel--master");
    if (!(panelEl instanceof HTMLElement)) {
      return;
    }

    const anchorSnapshot = options.anchorSnapshot || null;
    const preserveViewport = options.preserveViewport !== false;
    const viewportSnapshot = preserveViewport ? captureGridViewportSnapshot() : null;

    panelEl.style.setProperty("--frame-grid-zoom-scale", String(getGridZoomScale()));

    const countEl = tarotFrameOverviewEl?.querySelector(".tarot-frame-panel-count");
    if (countEl instanceof HTMLElement) {
      countEl.textContent = buildPanelCountText();
    }

    if (anchorSnapshot) {
      restoreGridViewportAnchor(anchorSnapshot, getGridZoomScale(), { defer: options.live !== true });
      return;
    }

    if (preserveViewport) {
      restoreGridViewport(viewportSnapshot);
      return;
    }

    centerGridViewport();
  }

  function flushLiveGridZoom() {
    pendingLiveZoomFrameId = 0;
    const job = pendingLiveZoomJob;
    pendingLiveZoomJob = null;
    if (!job) {
      return;
    }

    state.gridZoomScale = job.scale;
    state.gridZoomStepIndex = getNearestFrameZoomStepIndex(job.scale);
    applyGridZoomState({
      preserveViewport: job.preserveViewport,
      anchorSnapshot: job.anchorSnapshot,
      live: true
    });
    if (job.statusMessage !== "") {
      setStatus(job.statusMessage || `Frame grid zoom ${Math.round(getGridZoomScale() * 100)}%. This setting applies to every Frame layout.`);
    }
  }

  function setGridZoomScale(nextScale, options = {}) {
    const safeScale = clampFrameGridZoomScale(nextScale);
    if (options.live === true) {
      const renderedScale = pendingLiveZoomJob?.scale ?? getGridZoomScale();
      const anchorSnapshot = options.anchorClientX === undefined || options.anchorClientY === undefined
        ? null
        : (pendingLiveZoomJob?.anchorSnapshot || captureGridViewportAnchor(options.anchorClientX, options.anchorClientY, renderedScale));
      pendingLiveZoomJob = {
        scale: safeScale,
        preserveViewport: options.preserveViewport !== false,
        anchorSnapshot,
        statusMessage: options.statusMessage
      };
      if (!pendingLiveZoomFrameId) {
        pendingLiveZoomFrameId = window.requestAnimationFrame(flushLiveGridZoom);
      }
      return;
    }

    const anchorSnapshot = options.anchorClientX === undefined || options.anchorClientY === undefined
      ? null
      : captureGridViewportAnchor(options.anchorClientX, options.anchorClientY, getGridZoomScale());
    state.gridZoomScale = safeScale;
    state.gridZoomStepIndex = getNearestFrameZoomStepIndex(safeScale);
    applyGridZoomState({
      preserveViewport: options.preserveViewport !== false,
      anchorSnapshot
    });
    if (options.statusMessage !== "") {
      setStatus(options.statusMessage || `Frame grid zoom ${Math.round(getGridZoomScale() * 100)}%. This setting applies to every Frame layout.`);
    }
  }

  function setGridZoomStepIndex(nextIndex) {
    const safeIndex = Math.max(0, Math.min(FRAME_GRID_ZOOM_STEPS.length - 1, Number(nextIndex) || 0));
    state.gridZoomStepIndex = safeIndex;
    state.gridZoomScale = FRAME_GRID_ZOOM_STEPS[safeIndex] || FRAME_GRID_ZOOM_STEPS[0];
    applyGridZoomState({ preserveViewport: true });
    setStatus(`Frame grid zoom ${Math.round(getGridZoomScale() * 100)}%. This setting applies to every Frame layout.`);
  }

  function syncControls() {
    syncSystemUi();
    const {
      tarotFrameSelectionChipEl,
      tarotFrameFocusExitEl,
      tarotFrameSettingsPanelEl,
      tarotFrameGridZoomEl,
      tarotFrameDeckSelectEl,
      tarotFrameExportScopeEl,
      tarotFrameShowInfoEl,
      tarotFrameHouseSettingsEl,
      tarotFrameHouseTopCardsVisibleEl,
      tarotFrameHouseTopInfoHebrewEl,
      tarotFrameHouseTopInfoPlanetEl,
      tarotFrameHouseTopInfoZodiacEl,
      tarotFrameHouseTopInfoTrumpEl,
      tarotFrameHouseTopInfoPathEl,
      tarotFrameHouseTopInfoDateEl,
      tarotFrameHouseBottomCardsVisibleEl,
      tarotFrameHouseBottomInfoZodiacEl,
      tarotFrameHouseBottomInfoDecanEl,
      tarotFrameHouseBottomInfoMonthEl,
      tarotFrameHouseBottomInfoRulerEl,
      tarotFrameHouseBottomInfoDateEl,
      tarotFrameClearGridEl,
      tarotFrameExportWebpEl,
    } = getElements();
    const activeLayout = getLayoutDefinition();

    if (tarotFrameSelectionChipEl) {
      syncSelectionChip();
    }

    if (tarotFrameFocusExitEl) {
      applyGridFocusModeUi();
    }

    if (tarotFrameSettingsPanelEl) {
      // While the shared overlay owns the panel, never hide it (an empty overlay
      // body would otherwise show only the header).
      tarotFrameSettingsPanelEl.hidden = state.settingsOverlayOpen ? false : !state.settingsOpen;
    }

    if (tarotFrameGridZoomEl) {
      tarotFrameGridZoomEl.value = String(state.gridZoomStepIndex);
      tarotFrameGridZoomEl.disabled = Boolean(state.exportInProgress);
    }

    if (tarotFrameDeckSelectEl) {
      buildDeckSelectOptions(tarotFrameDeckSelectEl, normalizeFrameDeckId(state.frameDeckId) || getFrameDeckId(), false);
      tarotFrameDeckSelectEl.disabled = Boolean(state.exportInProgress);
    }

    if (tarotFrameExportScopeEl) {
      tarotFrameExportScopeEl.value = state.exportScope || "used";
      tarotFrameExportScopeEl.disabled = Boolean(state.exportInProgress);
    }

    if (tarotFrameShowInfoEl) {
      tarotFrameShowInfoEl.checked = Boolean(state.showInfo);
      tarotFrameShowInfoEl.disabled = Boolean(state.exportInProgress);
    }

    if (tarotFrameHouseSettingsEl) {
      tarotFrameHouseSettingsEl.hidden = false;
    }

    if (tarotFrameHouseTopCardsVisibleEl) {
      tarotFrameHouseTopCardsVisibleEl.checked = config.getHouseTopCardsVisible?.() !== false;
      tarotFrameHouseTopCardsVisibleEl.disabled = Boolean(state.exportInProgress);
    }

    [
      [tarotFrameHouseTopInfoHebrewEl, "hebrew", config.getHouseTopInfoModes],
      [tarotFrameHouseTopInfoPlanetEl, "planet", config.getHouseTopInfoModes],
      [tarotFrameHouseTopInfoZodiacEl, "zodiac", config.getHouseTopInfoModes],
      [tarotFrameHouseTopInfoTrumpEl, "trump", config.getHouseTopInfoModes],
      [tarotFrameHouseTopInfoPathEl, "path", config.getHouseTopInfoModes],
      [tarotFrameHouseTopInfoDateEl, "date", config.getHouseTopInfoModes],
      [tarotFrameHouseBottomInfoZodiacEl, "zodiac", config.getHouseBottomInfoModes],
      [tarotFrameHouseBottomInfoDecanEl, "decan", config.getHouseBottomInfoModes],
      [tarotFrameHouseBottomInfoMonthEl, "month", config.getHouseBottomInfoModes],
      [tarotFrameHouseBottomInfoRulerEl, "ruler", config.getHouseBottomInfoModes],
      [tarotFrameHouseBottomInfoDateEl, "date", config.getHouseBottomInfoModes]
    ].forEach(([checkbox, mode, getter]) => {
      if (!checkbox) {
        return;
      }
      checkbox.checked = Boolean(getter?.()?.[mode]);
      checkbox.disabled = Boolean(state.exportInProgress);
    });

    if (tarotFrameHouseBottomCardsVisibleEl) {
      tarotFrameHouseBottomCardsVisibleEl.checked = config.getHouseBottomCardsVisible?.() !== false;
      tarotFrameHouseBottomCardsVisibleEl.disabled = Boolean(state.exportInProgress);
    }

    if (tarotFrameClearGridEl) {
      tarotFrameClearGridEl.disabled = Boolean(state.exportInProgress);
    }

    if (tarotFrameExportWebpEl) {
      const supportsWebp = isExportFormatSupported("webp");
      tarotFrameExportWebpEl.hidden = !supportsWebp;
      tarotFrameExportWebpEl.disabled = Boolean(state.exportInProgress) || !supportsWebp;
      tarotFrameExportWebpEl.textContent = state.exportInProgress ? "Exporting..." : "Export WebP";
      if (supportsWebp) {
        tarotFrameExportWebpEl.title = "Download the current frame grid arrangement as a WebP image.";
      }
    }

    updateLayoutNotesUi();
    syncBuiltInLayoutOptions();
    renderFramesPanel();
  }

  function getSlotElement(slotId) {
    const { tarotFrameBoardEl } = getElements();
    const selector = `.tarot-frame-slot[data-slot-id="${slotId}"]`;
    if (tarotFrameBoardEl instanceof HTMLElement) {
      return tarotFrameBoardEl.querySelector(selector);
    }
    return document.querySelector(selector);
  }

  function setHoverSlots(slotIds) {
    const nextSlotIds = Array.isArray(slotIds)
      ? Array.from(new Set(slotIds.map((slotId) => String(slotId || "").trim()).filter(Boolean)))
      : [];
    const previousSlotIds = Array.isArray(state.drag?.hoverSlotIds) ? state.drag.hoverSlotIds : [];

    previousSlotIds.forEach((slotId) => {
      if (!nextSlotIds.includes(slotId)) {
        getSlotElement(slotId)?.classList.remove("is-drop-target");
      }
    });

    if (state.drag) {
      state.drag.hoverSlotIds = nextSlotIds;
      state.drag.hoverSlotId = nextSlotIds[0] || "";
    }

    nextSlotIds.forEach((slotId) => {
      getSlotElement(slotId)?.classList.add("is-drop-target");
    });
  }

  function buildGroupDropPlan(anchorSourceSlotId, anchorTargetSlotId, dragSlotIds) {
    const anchorSource = parseSlotId(anchorSourceSlotId);
    const anchorTarget = parseSlotId(anchorTargetSlotId);
    const normalizedSlotIds = Array.isArray(dragSlotIds)
      ? dragSlotIds.map((slotId) => String(slotId || "").trim()).filter((slotId) => isValidSlotId(slotId))
      : [];

    if (!anchorSource || !anchorTarget || !normalizedSlotIds.length) {
      return {
        valid: false,
        moved: false,
        targetSlotIds: [],
        moves: [],
        reason: ""
      };
    }

    const sourceSet = new Set(normalizedSlotIds);
    const moves = [];
    for (const sourceSlotId of normalizedSlotIds) {
      const sourceSlot = parseSlotId(sourceSlotId);
      const cardId = String(state.slotAssignments.get(sourceSlotId) || "").trim();
      if (!sourceSlot || !cardId) {
        return {
          valid: false,
          moved: false,
          targetSlotIds: [],
          moves: [],
          reason: ""
        };
      }

      const targetRow = anchorTarget.row + (sourceSlot.row - anchorSource.row);
      const targetColumn = anchorTarget.column + (sourceSlot.column - anchorSource.column);
      if (targetRow < 1 || targetRow > MASTER_GRID_SIZE || targetColumn < 1 || targetColumn > MASTER_GRID_SIZE) {
        return {
          valid: false,
          moved: false,
          targetSlotIds: [],
          moves: [],
          reason: "Group move would push part of the selection outside the frame grid."
        };
      }

      const targetSlotId = getSlotId(targetRow, targetColumn);
      const existingCardId = String(state.slotAssignments.get(targetSlotId) || "").trim();
      if (normalizedSlotIds.length > 1 && existingCardId && !sourceSet.has(targetSlotId)) {
        return {
          valid: false,
          moved: false,
          targetSlotIds: [],
          moves: [],
          reason: "Group move needs open destination slots for every selected card."
        };
      }

      moves.push({
        sourceSlotId,
        targetSlotId,
        cardId,
        isFlipped: isSlotFlipped(sourceSlotId),
        deckId: getSlotDeckOverride(sourceSlotId)
      });
    }

    const targetSlotIds = moves.map((move) => move.targetSlotId).sort(compareSlotIds);
    return {
      valid: new Set(targetSlotIds).size === targetSlotIds.length,
      moved: moves.some((move) => move.sourceSlotId !== move.targetSlotId),
      targetSlotIds,
      moves,
      reason: ""
    };
  }

  function applyGroupMove(plan) {
    if (!plan?.valid || !Array.isArray(plan.moves) || !plan.moves.length) {
      return false;
    }

    plan.moves.forEach((move) => {
      clearSlotAssignmentState(move.sourceSlotId);
    });
    plan.moves.forEach((move) => {
      assignCardToSlot(move.targetSlotId, move.cardId, move.isFlipped, move.deckId);
    });
    state.layoutReady = true;
    pruneUnusedCustomCards();
    return true;
  }

  function createDragGhost(card, options = {}) {
    const ghost = document.createElement("div");
    ghost.className = "tarot-frame-drag-ghost";
    const groupSize = Math.max(1, Number(options.groupSize) || 1);

    const sourceSlotId = findAssignedSlotIdByCardId(getCardId(card));
    if (isSlotFlipped(sourceSlotId)) {
      ghost.classList.add("is-flipped");
    }

    if (groupSize > 1) {
      const countEl = document.createElement("span");
      countEl.className = "tarot-frame-drag-ghost-count";
      countEl.textContent = String(groupSize);
      countEl.setAttribute("aria-label", `${groupSize} selected cards`);
      ghost.appendChild(countEl);
    }

    const imageSrc = resolveCardThumbnail(card, sourceSlotId);
    if (imageSrc) {
      const image = document.createElement("img");
      image.src = imageSrc;
      image.alt = "";
      image.decoding = "async";
      image.draggable = false;
      ghost.appendChild(image);
    } else {
      ghost.appendChild(createCardTextFaceElement(buildCardTextFaceModel(card, sourceSlotId)));
    }

    if (state.showInfo) {
      const label = document.createElement("span");
      label.className = "tarot-frame-drag-ghost-label";
      label.textContent = getCardOverlayLabel(card, sourceSlotId);
      if (label.textContent) {
        ghost.appendChild(label);
      }
    }

    ghost.classList.add("is-lifting");
    document.body.appendChild(ghost);
    if (state.drag?.lastMove) {
      moveGhost(ghost, state.drag.lastMove.x, state.drag.lastMove.y);
    }
    return ghost;
  }

  function createDragTrashElement() {
    if (dragTrashEl instanceof HTMLElement) {
      return dragTrashEl;
    }

    dragTrashEl = document.createElement("div");
    dragTrashEl.className = "tarot-frame-drag-trash";
    dragTrashEl.dataset.frameDragTrash = "true";
    dragTrashEl.hidden = true;

    const iconEl = document.createElement("span");
    iconEl.className = "tarot-frame-drag-trash-icon";
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.innerHTML = "<svg viewBox='0 0 24 24' focusable='false' aria-hidden='true'><path d='M9 3h6l1 2h4v2H4V5h4l1-2Zm-1 6h2v8H8V9Zm6 0h2v8h-2V9ZM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Z'/></svg>";

    const copyEl = document.createElement("div");
    copyEl.className = "tarot-frame-drag-trash-copy";
    const titleEl = document.createElement("strong");
    titleEl.textContent = "Trash";
    const detailEl = document.createElement("span");
    detailEl.textContent = "Drop here to remove from the frame";
    copyEl.append(titleEl, detailEl);

    dragTrashEl.append(iconEl, copyEl);
    document.body.appendChild(dragTrashEl);
    return dragTrashEl;
  }

  function setDragTrashState(visible, active = false) {
    const nextDragTrashEl = createDragTrashElement();
    nextDragTrashEl.hidden = !visible;
    nextDragTrashEl.classList.toggle("is-active", Boolean(visible && active));
  }

  function moveGhost(ghostEl, clientX, clientY) {
    if (!(ghostEl instanceof HTMLElement)) {
      return;
    }

    const flipped = ghostEl.classList.contains("is-flipped") ? " rotate(180deg)" : "";
    const liftScale = ghostEl.classList.contains("is-dropping")
      ? Number(ghostEl.dataset.dropScale || 1)
      : (ghostEl.classList.contains("is-lifting") ? 1.08 : 0.92);
    ghostEl.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) translate(-50%, -50%) scale(${liftScale})${flipped}`;
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  }

  function playDropGhostAnimation(ghostEl, details) {
    if (!(ghostEl instanceof HTMLElement) || prefersReducedMotion()) {
      return Promise.resolve();
    }

    let targetX = Number(details.releaseX);
    let targetY = Number(details.releaseY);
    let scale = 1.08;
    let opacity = 1;

    if (details.deleteActive && dragTrashEl instanceof HTMLElement && !dragTrashEl.hidden) {
      const trashRect = dragTrashEl.getBoundingClientRect();
      targetX = trashRect.left + (trashRect.width / 2);
      targetY = trashRect.top + (trashRect.height / 2);
      scale = 0.28;
      opacity = 0;
    } else {
      const slotId = details.moved ? details.targetSlotId : details.sourceSlotId;
      const slotEl = getSlotElement(slotId);
      if (slotEl instanceof HTMLElement) {
        const slotRect = slotEl.getBoundingClientRect();
        targetX = slotRect.left + (slotRect.width / 2);
        targetY = slotRect.top + (slotRect.height / 2);
        scale = Math.max(0.2, slotRect.width / 90);
      }
    }

    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      return Promise.resolve();
    }

    const fromTransform = ghostEl.style.transform || "";
    const flipped = ghostEl.classList.contains("is-flipped") ? " rotate(180deg)" : "";
    const toTransform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%) scale(${scale})${flipped}`;
    const startX = Number(details.releaseX);
    const startY = Number(details.releaseY);
    const travel = Number.isFinite(startX) && Number.isFinite(startY)
      ? Math.hypot(targetX - startX, targetY - startY)
      : 80;
    const duration = Math.max(90, Math.min(200, 90 + travel * 0.35));

    ghostEl.classList.add("is-dropping");
    ghostEl.style.transition = "none";
    ghostEl.getAnimations?.().forEach((animation) => animation.cancel());

    if (typeof ghostEl.animate !== "function") {
      ghostEl.style.transform = toTransform;
      ghostEl.style.opacity = String(opacity);
      return Promise.resolve();
    }

    const animation = ghostEl.animate(
      [
        {
          transform: fromTransform && fromTransform !== "none" ? fromTransform : toTransform,
          opacity: 1
        },
        {
          transform: toTransform,
          opacity
        }
      ],
      {
        duration,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards"
      }
    );

    return animation.finished.catch(() => {});
  }

  function updateHoverSlotFromPoint(clientX, clientY, sourceSlotId) {
    const target = document.elementFromPoint(clientX, clientY);
    const trashTarget = target instanceof Element ? target.closest("[data-frame-drag-trash='true']") : null;
    if (state.drag) {
      state.drag.deleteActive = Boolean(trashTarget);
      setDragTrashState(Boolean(state.drag.started), Boolean(state.drag.deleteActive));
    }
    if (trashTarget) {
      if (state.drag) {
        state.drag.dropPlan = null;
        state.drag.invalidDropMessage = "";
      }
      setHoverSlots([]);
      return;
    }

    const slot = target instanceof Element ? target.closest(".tarot-frame-slot[data-slot-id]") : null;
    const nextSlotId = slot instanceof HTMLElement ? String(slot.dataset.slotId || "") : "";
    if (!state.drag) {
      return;
    }

    const dragSlotIds = Array.isArray(state.drag.sourceSlotIds) && state.drag.sourceSlotIds.length
      ? state.drag.sourceSlotIds
      : [sourceSlotId];
    if (dragSlotIds.length > 1) {
      const plan = nextSlotId && nextSlotId !== sourceSlotId
        ? buildGroupDropPlan(sourceSlotId, nextSlotId, dragSlotIds)
        : null;
      state.drag.dropPlan = plan?.valid ? plan : null;
      state.drag.invalidDropMessage = !plan || plan.valid ? "" : plan.reason;
      setHoverSlots(plan?.valid && plan.moved ? plan.targetSlotIds : []);
      return;
    }

    state.drag.dropPlan = nextSlotId && nextSlotId !== sourceSlotId
      ? {
          valid: true,
          moved: true,
          targetSlotIds: [nextSlotId],
          moves: [],
          reason: ""
        }
      : null;
    state.drag.invalidDropMessage = "";
    setHoverSlots(nextSlotId && nextSlotId !== sourceSlotId ? [nextSlotId] : []);
  }

  function removeOrphanedDragGhosts() {
    document.querySelectorAll(".tarot-frame-drag-ghost").forEach((ghostEl) => {
      if (ghostEl instanceof HTMLElement) {
        ghostEl.remove();
      }
    });
    setDragTrashState(false, false);
    document.body.classList.remove("is-tarot-frame-dragging");
  }

  function detachPointerListeners() {
    document.removeEventListener("pointermove", handlePointerMove);
    document.removeEventListener("pointerup", handlePointerUp);
    document.removeEventListener("pointercancel", handlePointerCancel);
  }

  function cleanupDrag() {
    if (pendingDragFrameId) {
      window.cancelAnimationFrame(pendingDragFrameId);
      pendingDragFrameId = 0;
    }
    if (!state.drag) {
      removeOrphanedDragGhosts();
      return;
    }

    if (state.drag.sourceButton instanceof HTMLElement && typeof state.drag.sourceButton.releasePointerCapture === "function") {
      try {
        if (state.drag.sourceButton.hasPointerCapture?.(state.drag.pointerId)) {
          state.drag.sourceButton.releasePointerCapture(state.drag.pointerId);
        }
      } catch (_error) {
        // Ignore pointer-capture release failures during cleanup.
      }
    }

    setHoverSlots([]);
    (Array.isArray(state.drag.sourceSlotIds) ? state.drag.sourceSlotIds : [state.drag.sourceSlotId]).forEach((slotId) => {
      getSlotElement(slotId)?.classList.remove("is-drag-source");
    });
    if (state.drag.ghostEl instanceof HTMLElement) {
      state.drag.ghostEl.remove();
    }

    state.drag = null;
    removeOrphanedDragGhosts();
    detachPointerListeners();
  }

  function handleDocumentTouchStart(event) {
    if (Number(event.touches?.length || 0) < 2) {
      return;
    }

    clearLongPressGesture();
    if (state.drag?.pointerType === "touch") {
      cleanupDrag();
      state.suppressClick = true;
      return;
    }

    removeOrphanedDragGhosts();
  }

  function swapOrMoveSlots(sourceSlotId, targetSlotId) {
    swapSlotAssignments(sourceSlotId, targetSlotId);
  }

  function describeSlot(slotId) {
    const [rowText, columnText] = String(slotId || "").split(":");
    return `row ${rowText || "?"}, column ${columnText || "?"}`;
  }

  function openCardLightbox(cardId, slotId = "") {
    const card = getCardById(cardId);
    if (!card) {
      return;
    }

    if (isCustomFrameCard(card)) {
      editCustomCard(slotId || findAssignedSlotIdByCardId(cardId), getCardId(card));
      return;
    }

    const originEl = getSlotElement(slotId)?.querySelector(".tarot-frame-card-image, .tarot-frame-card");
    const originBox = originEl instanceof HTMLElement ? originEl.getBoundingClientRect() : null;
    const originRect = originBox && originBox.width > 0
      ? { left: originBox.left, top: originBox.top, width: originBox.width, height: originBox.height }
      : null;
    const originCardEl = getSlotElement(slotId)?.querySelector(".tarot-frame-card");
    if (originCardEl instanceof HTMLElement) {
      originCardEl.classList.add("is-lightbox-origin");
    }
    const restoreOriginCard = () => {
      originCardEl?.classList.remove("is-lightbox-origin");
    };

    if (typeof config.openCardLightbox === "function") {
      config.openCardLightbox(getCardId(card), {
        onSelectCardId: () => {},
        deckId: getResolvedSlotDeckId(slotId),
        rotated: isSlotFlipped(slotId),
        originRect,
        onClose: restoreOriginCard
      });
      return;
    }

    const deckOptions = resolveDeckOptions(card, slotId);
    const src = String(
      tarotCardImages.resolveTarotCardImage?.(card.name, deckOptions)
      || tarotCardImages.resolveTarotCardThumbnail?.(card.name, deckOptions)
      || ""
    ).trim();

    if (!src) {
      return;
    }

    const label = getDisplayCardName(card, slotId);
    window.TarotUiLightbox?.open?.({
      src,
      altText: label,
      label,
      cardId: getCardId(card),
      deckId: getResolvedSlotDeckId(slotId),
      rotated: isSlotFlipped(slotId),
      originRect,
      onClose: restoreOriginCard
    });
  }

  function handlePointerDown(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    blurLayoutNoteForBoardInteraction(target);

    if (event.button === 1) {
      startPanGesture(event, { source: "pointer" });
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const pointerType = String(event.pointerType || "").toLowerCase();

    const cardButton = target.closest(".tarot-frame-card[data-slot-id][data-card-id]");
    if (!(cardButton instanceof HTMLButtonElement)) {
      const emptyButton = target.closest(".tarot-frame-card.is-empty[data-slot-id]");
      if (emptyButton instanceof HTMLButtonElement && (pointerType === "touch" || pointerType === "pen")) {
        event.preventDefault();
        scheduleLongPress(String(emptyButton.dataset.slotId || ""), event);
      }
      return;
    }

    const sourceSlotId = String(cardButton.dataset.slotId || "").trim();
    const toggleSelectionShortcut = pointerType !== "touch" && (event.ctrlKey || event.metaKey);
    if (toggleSelectionShortcut) {
      const selectionUpdate = setSelectedSlotIds(
        isSlotSelected(sourceSlotId)
          ? getSelectedSlotIds().filter((slotId) => slotId !== sourceSlotId)
          : [...getSelectedSlotIds(), sourceSlotId]
      );
      setStatus(buildSelectionStatusMessage(selectionUpdate.slotIds.length));
      state.suppressClick = true;
      event.preventDefault();
      return;
    }

    if (getSelectedSlotIds().length && pointerType !== "touch" && !isSlotSelected(sourceSlotId)) {
      setSelectedSlotIds([]);
    }

    const dragSourceSlotIds = getDragSourceSlotIds(sourceSlotId);

    state.drag = {
      pointerId: event.pointerId,
      pointerType,
      sourceSlotId,
      sourceSlotIds: dragSourceSlotIds.length ? dragSourceSlotIds : [sourceSlotId],
      cardId: String(cardButton.dataset.cardId || ""),
      startX: event.clientX,
      startY: event.clientY,
      touchEligibleAt: pointerType === "touch"
        ? (Number(event.timeStamp) || window.performance.now()) + FRAME_TOUCH_DRAG_ACTIVATION_DELAY_MS
        : 0,
      started: false,
      hoverSlotId: "",
      hoverSlotIds: [],
      dropPlan: null,
      invalidDropMessage: "",
      deleteActive: false,
      ghostEl: null,
      sourceButton: cardButton
    };

    if (typeof cardButton.setPointerCapture === "function") {
      try {
        cardButton.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore pointer-capture failures and continue with document listeners.
      }
    }

    if (pointerType === "touch") {
      event.preventDefault();
      scheduleLongPress(String(cardButton.dataset.slotId || ""), event, "card");
    }

    detachPointerListeners();
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerCancel);
  }

  function handlePointerMove(event) {
    updateLongPress(event);
    if (!state.drag || event.pointerId !== state.drag.pointerId) {
      return;
    }

    if (state.drag.pointerType === "touch" && state.longPress?.pointerId === event.pointerId) {
      return;
    }

    if (state.drag.pointerType === "touch" && (state.pinchGesture || (state.panGesture && state.panGesture.source === "touch"))) {
      cleanupDrag();
      state.suppressClick = true;
      return;
    }

    if (!state.drag.started
      && state.drag.pointerType === "touch"
      && (Number(event.timeStamp) || window.performance.now()) < Number(state.drag.touchEligibleAt || 0)) {
      return;
    }

    const movedEnough = Math.hypot(event.clientX - state.drag.startX, event.clientY - state.drag.startY) >= 6;
    if (!state.drag.started && movedEnough) {
      const card = getCardById(state.drag.cardId);
      if (!card) {
        cleanupDrag();
        return;
      }

      state.drag.started = true;
      state.drag.lastMove = {
        x: event.clientX,
        y: event.clientY,
        t: Number(event.timeStamp) || window.performance.now(),
        speed: FRAME_DRAG_SNAP_MAX_SPEED + 1
      };
      state.drag.ghostEl = createDragGhost(card, { groupSize: state.drag.sourceSlotIds.length });
      state.drag.sourceSlotIds.forEach((slotId) => {
        getSlotElement(slotId)?.classList.add("is-drag-source");
      });
      setDragTrashState(true, false);
      document.body.classList.add("is-tarot-frame-dragging");
      state.suppressClick = true;
    }

    if (!state.drag.started) {
      return;
    }

    const now = Number(event.timeStamp) || window.performance.now();
    const lastMove = state.drag.lastMove;
    const speed = lastMove
      ? Math.hypot(event.clientX - lastMove.x, event.clientY - lastMove.y) / Math.max(1, now - lastMove.t)
      : 0;
    state.drag.lastMove = { x: event.clientX, y: event.clientY, t: now, speed };

    if (!pendingDragFrameId) {
      pendingDragFrameId = window.requestAnimationFrame(() => {
        pendingDragFrameId = 0;
        const drag = state.drag;
        if (!drag?.started || !drag.lastMove) {
          return;
        }
        moveGhost(drag.ghostEl, drag.lastMove.x, drag.lastMove.y);
        if (drag.lastMove.speed <= FRAME_DRAG_SNAP_MAX_SPEED) {
          updateHoverSlotFromPoint(drag.lastMove.x, drag.lastMove.y, drag.sourceSlotId);
        } else if (drag.hoverSlotIds?.length || drag.dropPlan) {
          drag.dropPlan = null;
          drag.invalidDropMessage = "";
          setHoverSlots([]);
        }
      });
    }
    event.preventDefault();
  }

  function finishDrop() {
    if (!state.drag) {
      return;
    }

    const releaseX = Number(state.drag.lastMove?.x);
    const releaseY = Number(state.drag.lastMove?.y);
    if (Number.isFinite(releaseX) && Number.isFinite(releaseY) && state.drag.started) {
      updateHoverSlotFromPoint(releaseX, releaseY, state.drag.sourceSlotId);
    }

    const sourceSlotId = state.drag.sourceSlotId;
    const dragSlotIds = Array.isArray(state.drag.sourceSlotIds) && state.drag.sourceSlotIds.length
      ? state.drag.sourceSlotIds
      : [sourceSlotId];
    const targetSlotId = state.drag.hoverSlotId;
    const deleteActive = Boolean(state.drag.deleteActive);
    const dropPlan = state.drag.dropPlan;
    const draggedCard = getCardById(state.drag.cardId);
    const singleWasSelected = dragSlotIds.length === 1 && isSlotSelected(sourceSlotId);
    const moved = dragSlotIds.length > 1
      ? Boolean(dropPlan?.valid && dropPlan.moved)
      : Boolean(targetSlotId && targetSlotId !== sourceSlotId);
    const ghostEl = state.drag.ghostEl;
    const dragStarted = Boolean(state.drag.started);

    // Snapshot and clear drag sources so the upcoming render does not re-apply low-opacity
    // is-drag-source to source locations after the move (prevents a flash at release).
    const savedSourceSlotIds = Array.isArray(state.drag.sourceSlotIds) ? [...state.drag.sourceSlotIds] : (sourceSlotId ? [sourceSlotId] : []);
    if (state.drag) {
      state.drag.sourceSlotIds = [];
    }

    // Perform mutations + heavy render BEFORE starting the drop animation so the
    // WAAPI tween itself runs smoothly to completion with no main-thread work at the end.
    if (deleteActive) {
      dragSlotIds.forEach((slotId) => {
        removeCardFromSlot(slotId);
      });
      if (dragSlotIds.length > 1) {
        setSelectedSlotIds([]);
      }
      render({ preserveViewport: true });
      setStatus(dragSlotIds.length > 1
        ? `Removed ${dragSlotIds.length} selected cards from the frame grid.`
        : `${getDisplayCardName(draggedCard)} removed from the frame grid.`);
    } else if (dragSlotIds.length > 1 && dropPlan?.valid && dropPlan.moved) {
      applyGroupMove(dropPlan);
      setSelectedSlotIds(dropPlan.targetSlotIds);
      render({ preserveViewport: true });
      setStatus(`${dragSlotIds.length} selected cards moved together. Anchor card snapped to ${describeSlot(targetSlotId)}.`);
    } else if (moved) {
      swapOrMoveSlots(sourceSlotId, targetSlotId);
      if (singleWasSelected) {
        setSelectedSlotIds([targetSlotId]);
      }
      render({ preserveViewport: true });
      setStatus(`${getDisplayCardName(draggedCard)} snapped to ${describeSlot(targetSlotId)}.`);
    } else if (dragSlotIds.length > 1 && dropPlan && !dropPlan.valid && dropPlan.reason) {
      setStatus(dropPlan.reason);
    }

    if (dragStarted && ghostEl instanceof HTMLElement) {
      // Partial cleanup: clear hover/sources/listeners/drag but KEEP the ghost element
      // so the drop animation can finish without interference, then remove ghost cheaply.
      // Keep state.suppressClick TRUE until after the animation: the click that follows
      // pointerup must be swallowed even when the drop did not move (drop back on the
      // source slot), otherwise that click opens the card lightbox.
      setHoverSlots([]);
      savedSourceSlotIds.forEach((slotId) => {
        getSlotElement(slotId)?.classList.remove("is-drag-source");
      });
      document.body.classList.remove("is-tarot-frame-dragging");
      detachPointerListeners();
      const ghostToAnimate = ghostEl;
      state.drag = null;

      playDropGhostAnimation(ghostToAnimate, {
        deleteActive,
        moved,
        targetSlotId,
        sourceSlotId,
        releaseX,
        releaseY
      }).then(() => {
        if (ghostToAnimate && ghostToAnimate.parentNode) {
          ghostToAnimate.remove();
        }
        setDragTrashState(false, false);
        removeOrphanedDragGhosts();
        if (!moved && !deleteActive) {
          state.suppressClick = false;
        }
      });
      return;
    }

    cleanupDrag();
  }

  function handlePointerUp(event) {
    finishLongPress(event);
    if (!state.drag || event.pointerId !== state.drag.pointerId) {
      return;
    }

    if (!state.drag.started) {
      const sourceSlotId = state.drag.sourceSlotId;
      const shouldToggleTouchSelection = state.drag.pointerType === "touch" && getSelectedSlotIds().length > 0;
      cleanupDrag();
      if (shouldToggleTouchSelection) {
        const selectionUpdate = setSelectedSlotIds(
          isSlotSelected(sourceSlotId)
            ? getSelectedSlotIds().filter((slotId) => slotId !== sourceSlotId)
            : [...getSelectedSlotIds(), sourceSlotId]
        );
        setStatus(buildSelectionStatusMessage(selectionUpdate.slotIds.length));
        state.suppressClick = true;
      }
      return;
    }

    finishDrop();
  }

  function handlePointerCancel(event) {
    finishLongPress(event);
    if (!state.drag || event.pointerId !== state.drag.pointerId) {
      return;
    }

    cleanupDrag();
    state.suppressClick = false;
  }

  function handleBoardClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (state.suppressClick) {
      state.suppressClick = false;
      return;
    }

    const cardButton = target.closest(".tarot-frame-card[data-card-id]");
    if (!(cardButton instanceof HTMLButtonElement)) {
      const emptyButton = target.closest(".tarot-frame-card.is-empty[data-slot-id]");
      if (emptyButton instanceof HTMLButtonElement && getSelectedSlotIds().length > 0) {
        setSelectedSlotIds([]);
        setStatus(buildSelectionStatusMessage(0));
      }
      return;
    }

    if (isSlotSelected(cardButton.dataset.slotId)) {
      return;
    }

    if (getSelectedSlotIds().length > 0) {
      setSelectedSlotIds([]);
      setStatus(buildSelectionStatusMessage(0));
      return;
    }

    openCardLightbox(cardButton.dataset.cardId, cardButton.dataset.slotId);
  }

  function handleNativeDragStart(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (target.closest(".tarot-frame-card")) {
      event.preventDefault();
    }
  }

  function handleBoardContextMenu(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const occupiedButton = target.closest(".tarot-frame-card[data-card-id][data-slot-id]");
    if (occupiedButton instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      openCardActionMenu(
        String(occupiedButton.dataset.slotId || ""),
        String(occupiedButton.dataset.cardId || ""),
        event.clientX,
        event.clientY,
        { focusFirstButton: false }
      );
      return;
    }

    const emptyButton = target.closest(".tarot-frame-card.is-empty[data-slot-id]");
    if (!(emptyButton instanceof HTMLButtonElement)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    openCardInsertMenu(String(emptyButton.dataset.slotId || ""), event.clientX, event.clientY);
  }

  function handleDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const {
      tarotFrameSectionEl,
      tarotFrameBoardEl,
      tarotFrameFocusExitEl,
      tarotFrameSettingsPanelEl
    } = getElements();

    if (state.gridFocusMode && tarotFrameSectionEl?.contains(target)) {
      const targetElement = target instanceof Element ? target : null;
      const clickedInsideBoard = Boolean(targetElement?.closest("#tarot-frame-board"));
      if (!clickedInsideBoard) {
        return;
      }
    }

    let changed = false;
    if (!state.settingsOverlayOpen && state.settingsOpen && !tarotFrameSettingsPanelEl?.contains(target) && !tarotFrameFocusExitEl?.contains(target)) {
      state.settingsOpen = false;
      changed = true;
    }

    if (state.layoutMenuOpen) {
      state.layoutMenuOpen = false;
      changed = true;
    }

    if (state.cardInsertMenu.open && cardInsertMenuEl && !cardInsertMenuEl.contains(target)) {
      closeCardInsertMenu();
    }

    if (state.cardActionMenu.open && cardActionMenuEl && !cardActionMenuEl.contains(target)) {
      closeCardActionMenu();
    }

    if (cardCustomEditorEl && !cardCustomEditorEl.hidden && !cardCustomEditorEl.contains(target)) {
      closeCustomCardEditor();
    }

    if (state.cardPicker.open && cardPickerEl && !cardPickerEl.contains(target)) {
      closeCardPicker();
    }

    if (changed) {
      syncControls();
    }
  }

  function handleDocumentKeydown(event) {
    const zoomDirection = getFrameGridZoomShortcutDirection(event);
    if (zoomDirection && shouldHandleFrameZoomShortcut(event)) {
      event.preventDefault();
      setGridZoomStepIndex(state.gridZoomStepIndex + zoomDirection);
      return;
    }

    if (event.key !== "Escape") {
      return;
    }

    if (getSelectedSlotIds().length > 0) {
      setSelectedSlotIds([]);
      setStatus(buildSelectionStatusMessage(0));
      return;
    }

    // gridFocusMode is locked for immersive full-grid experience; Escape only closes overlays
    let changed = false;
    if (state.settingsOpen && !state.settingsOverlayOpen) {
      state.settingsOpen = false;
      changed = true;
    }
    if (state.layoutMenuOpen) {
      state.layoutMenuOpen = false;
      changed = true;
    }
    if (state.cardInsertMenu.open) {
      closeCardInsertMenu();
    }
    if (state.cardActionMenu.open) {
      closeCardActionMenu();
    }
    if (cardCustomEditorEl && !cardCustomEditorEl.hidden) {
      closeCustomCardEditor();
    }
    if (state.cardPicker.open) {
      closeCardPicker();
    }

    if (changed) {
      syncControls();
    }
  }

  function drawRoundedRectPath(context, x, y, width, height, radius) {
    const nextRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + nextRadius, y);
    context.lineTo(x + width - nextRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
    context.lineTo(x + width, y + height - nextRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
    context.lineTo(x + nextRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
    context.lineTo(x, y + nextRadius);
    context.quadraticCurveTo(x, y, x + nextRadius, y);
    context.closePath();
  }

  function fitCanvasLabelText(context, text, maxWidth) {
    const normalized = normalizeLabelText(text);
    if (!normalized || context.measureText(normalized).width <= maxWidth) {
      return normalized;
    }

    let result = normalized;
    while (result.length > 1 && context.measureText(`${result}...`).width > maxWidth) {
      result = result.slice(0, -1).trimEnd();
    }
    return `${result}...`;
  }

  function wrapCanvasText(context, text, maxWidth, maxLines = 2) {
    const normalized = normalizeLabelText(text);
    if (!normalized) {
      return [];
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (current && context.measureText(next).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) {
      lines.push(current);
    }

    if (lines.length <= maxLines) {
      return lines;
    }

    const clipped = lines.slice(0, Math.max(1, maxLines));
    clipped[clipped.length - 1] = fitCanvasLabelText(context, clipped[clipped.length - 1], maxWidth);
    return clipped;
  }

  function drawImageContain(context, image, x, y, width, height) {
    if (!(image instanceof HTMLImageElement) && !(image instanceof ImageBitmap)) {
      return;
    }

    const sourceWidth = Number(image.width || image.naturalWidth || 0);
    const sourceHeight = Number(image.height || image.naturalHeight || 0);
    if (!(sourceWidth > 0 && sourceHeight > 0)) {
      return;
    }

    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = x + ((width - drawWidth) / 2);
    const drawY = y + ((height - drawHeight) / 2);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  function drawImageCover(context, image, x, y, width, height) {
    if (!(image instanceof HTMLImageElement) && !(image instanceof ImageBitmap)) {
      return;
    }

    const sourceWidth = Number(image.width || image.naturalWidth || 0);
    const sourceHeight = Number(image.height || image.naturalHeight || 0);
    if (!(sourceWidth > 0 && sourceHeight > 0)) {
      return;
    }

    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = x + ((width - drawWidth) / 2);
    const drawY = y + ((height - drawHeight) / 2);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  function drawTextFaceToCanvas(context, x, y, width, height, faceModel) {
    const primaryText = normalizeLabelText(faceModel?.primary);
    const secondaryText = normalizeLabelText(faceModel?.secondary);
    const maxWidth = width - 12;
    const faceClasses = String(faceModel?.className || "").split(/\s+/).filter(Boolean);
    const hasFaceClass = (className) => faceClasses.includes(className);

    context.save();
    if (!primaryText && !secondaryText) {
      context.restore();
      return;
    }

    const primaryFontSize = hasFaceClass("is-top-hebrew") && primaryText.length <= 3
      ? 14
      : (hasFaceClass("is-custom-hero")
        ? 18
        : (hasFaceClass("is-custom-short")
          ? 15
          : (hasFaceClass("is-custom-medium") ? 13 : 10)));
    const primaryFontFamily = hasFaceClass("is-top-hebrew")
      ? "'Segoe UI Symbol', 'Noto Sans Hebrew', 'Segoe UI', sans-serif"
      : "'Segoe UI', sans-serif";
    context.font = `700 ${primaryFontSize}px ${primaryFontFamily}`;
    const primaryLines = wrapCanvasText(context, primaryText, maxWidth, secondaryText ? 3 : 4);
    const secondaryLines = secondaryText ? wrapCanvasText(context, secondaryText, maxWidth, 3) : [];
    const primaryLineHeight = hasFaceClass("is-top-hebrew") && primaryText.length <= 3
      ? 14
      : (hasFaceClass("is-custom-hero")
        ? 18
        : (hasFaceClass("is-custom-short")
          ? 15
          : (hasFaceClass("is-custom-medium") ? 13 : 11)));
    const secondaryFontSize = hasFaceClass("is-custom-hero") ? 8 : (hasFaceClass("is-custom-short") ? 8 : 7);
    const secondaryLineHeight = hasFaceClass("is-custom-hero") ? 10 : 9;
    const totalHeight = (primaryLines.length * primaryLineHeight) + (secondaryLines.length ? 4 + (secondaryLines.length * secondaryLineHeight) : 0);
    let currentY = y + ((height - totalHeight) / 2) + primaryLineHeight;

    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    primaryLines.forEach((line) => {
      context.fillStyle = "#f8fafc";
      context.font = `700 ${primaryFontSize}px ${primaryFontFamily}`;
      context.fillText(line, x + (width / 2), currentY, maxWidth);
      currentY += primaryLineHeight;
    });

    if (secondaryLines.length) {
      currentY += 2;
      context.fillStyle = "rgba(248, 250, 252, 0.78)";
      context.font = `500 ${secondaryFontSize}px 'Segoe UI', sans-serif`;
      secondaryLines.forEach((line) => {
        context.fillText(line, x + (width / 2), currentY, maxWidth);
        currentY += secondaryLineHeight;
      });
    }

    context.restore();
  }

  function drawSlotToCanvas(context, x, y, width, height, card, image, customBackgroundImage = null, isFlipped = false, slotId = "") {
    if (!card) {
      return;
    }

    const cardX = x + EXPORT_CARD_INSET;
    const cardY = y + EXPORT_CARD_INSET;
    const cardWidth = width - (EXPORT_CARD_INSET * 2);
    const cardHeight = height - (EXPORT_CARD_INSET * 2);
    const showImage = shouldShowCardImage(card);
    const faceModel = showImage ? null : buildCardTextFaceModel(card, slotId);

    context.save();
    if (isFlipped) {
      context.translate(cardX + (cardWidth / 2), cardY + (cardHeight / 2));
      context.rotate(Math.PI);
      context.translate(-(cardX + (cardWidth / 2)), -(cardY + (cardHeight / 2)));
    }
    drawRoundedRectPath(context, cardX, cardY, cardWidth, cardHeight, 0);
    context.clip();
    if (showImage && image) {
      drawImageContain(context, image, cardX, cardY, cardWidth, cardHeight);
    } else if (showImage) {
      context.fillStyle = EXPORT_PANEL;
      context.fillRect(cardX, cardY, cardWidth, cardHeight);
      context.fillStyle = "#f8fafc";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 14px 'Segoe UI', sans-serif";
      const lines = wrapCanvasText(context, getDisplayCardName(card, slotId), cardWidth - 18, 4);
      const lineHeight = 18;
      let currentY = cardY + (cardHeight / 2) - (((Math.max(1, lines.length) - 1) * lineHeight) / 2);
      lines.forEach((line) => {
        context.fillText(line, cardX + (cardWidth / 2), currentY, cardWidth - 18);
        currentY += lineHeight;
      });
    } else {
      const hasCustomLabelClass = String(faceModel?.className || "").split(/\s+/).includes("is-custom-label");
      context.fillStyle = normalizeCustomCardBackgroundColor(faceModel?.backgroundColor) || (hasCustomLabelClass ? "#123548" : EXPORT_PANEL);
      context.fillRect(cardX, cardY, cardWidth, cardHeight);
      if (customBackgroundImage) {
        drawImageCover(context, customBackgroundImage, cardX, cardY, cardWidth, cardHeight);
        context.fillStyle = faceModel?.primary || faceModel?.secondary
          ? "rgba(15, 23, 42, 0.38)"
          : "rgba(15, 23, 42, 0.16)";
        context.fillRect(cardX, cardY, cardWidth, cardHeight);
      }
      drawTextFaceToCanvas(context, cardX, cardY, cardWidth, cardHeight, faceModel);
    }

    if (showImage && state.showInfo) {
      const overlayText = getCardOverlayLabel(card, slotId);
      if (overlayText) {
        const overlayHeight = 30;
        const overlayX = cardX + 4;
        const overlayY = cardY + cardHeight - overlayHeight - 4;
        const overlayWidth = cardWidth - 8;
        drawRoundedRectPath(context, overlayX, overlayY, overlayWidth, overlayHeight, 8);
        context.fillStyle = EXPORT_BADGE_BACKGROUND;
        context.fill();
        context.fillStyle = EXPORT_BADGE_TEXT;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "700 11px 'Segoe UI', sans-serif";
        const lines = wrapCanvasText(context, overlayText, overlayWidth - 10, 2);
        const lineHeight = 12;
        let currentY = overlayY + (overlayHeight / 2) - (((Math.max(1, lines.length) - 1) * lineHeight) / 2);
        lines.forEach((line) => {
          context.fillText(line, overlayX + (overlayWidth / 2), currentY, overlayWidth - 10);
          currentY += lineHeight;
        });
      }
    }

    context.restore();
  }

  function isCrossOriginImageSource(src) {
    const normalizedSrc = String(src || "").trim();
    if (!normalizedSrc) {
      return false;
    }

    if (normalizedSrc.startsWith("data:") || normalizedSrc.startsWith("blob:")) {
      return false;
    }

    try {
      const sourceUrl = new URL(normalizedSrc, window.location.href);
      return sourceUrl.origin !== window.location.origin;
    } catch (_error) {
      return false;
    }
  }

  function loadImageElementFromUrl(src, { crossOrigin = "", revokeOnLoad = false } = {}) {
    return new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      if (crossOrigin) {
        image.crossOrigin = crossOrigin;
      }

      image.onload = () => {
        const finish = () => {
          if (revokeOnLoad) {
            try {
              URL.revokeObjectURL(src);
            } catch (_error) {}
          }
          resolve(image);
        };
        if (typeof image.decode === "function") {
          image.decode().then(finish).catch(finish);
          return;
        }
        finish();
      };
      image.onerror = () => {
        if (revokeOnLoad) {
          try {
            URL.revokeObjectURL(src);
          } catch (_error) {
            // Ignore object URL cleanup failures.
          }
        }
        resolve(null);
      };
      image.src = src;
    });
  }

  async function loadCardImage(src) {
    const normalizedSrc = String(src || "").trim();
    if (!normalizedSrc) {
      return null;
    }

    // Export uses blob-backed image URLs so the canvas remains origin-clean.
    try {
      const response = await fetch(normalizedSrc, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        cache: "default"
      });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size > 0) {
          const blobUrl = URL.createObjectURL(blob);
          const image = await loadImageElementFromUrl(blobUrl, { revokeOnLoad: true });
          if (image) {
            return image;
          }
        }
      }
    } catch (_error) {
      // Fall through to direct image loading path.
    }

    if (isCrossOriginImageSource(normalizedSrc)) {
      return null;
    }

    return loadImageElementFromUrl(normalizedSrc, { crossOrigin: "anonymous" });
  }

  function isExportFormatSupported(format) {
    const exportFormat = EXPORT_FORMATS[format];
    if (!exportFormat) {
      return false;
    }

    const probeCanvas = document.createElement("canvas");
    const dataUrl = probeCanvas.toDataURL(exportFormat.mimeType);
    return dataUrl.startsWith(`data:${exportFormat.mimeType}`);
  }

  function canvasToBlobByFormat(canvas, format) {
    const exportFormat = EXPORT_FORMATS[format] || EXPORT_FORMATS.webp;
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          reject(new Error("Canvas export failed. Some deck images may block export without CORS access."));
        }, exportFormat.mimeType, exportFormat.quality);
      } catch (_error) {
        reject(new Error("Canvas export failed because one or more images could not be read for export (CORS)."));
      }
    });
  }

  function getExportBounds(scope = "used") {
    const full = { minRow: 1, maxRow: MASTER_GRID_SIZE, minColumn: 1, maxColumn: MASTER_GRID_SIZE };
    const fromSlotIds = (slotIds) => {
      let minRow = Infinity;
      let maxRow = -Infinity;
      let minColumn = Infinity;
      let maxColumn = -Infinity;
      let found = false;
      (slotIds || []).forEach((slotId) => {
        const pos = parseSlotId(slotId);
        if (!pos) return;
        found = true;
        minRow = Math.min(minRow, pos.row);
        maxRow = Math.max(maxRow, pos.row);
        minColumn = Math.min(minColumn, pos.column);
        maxColumn = Math.max(maxColumn, pos.column);
      });
      return found ? { minRow, maxRow, minColumn, maxColumn } : null;
    };
    if (scope === "full") {
      return full;
    }
    if (scope === "selection") {
      const selectionBounds = fromSlotIds(getSelectedSlotIds());
      if (selectionBounds) {
        return selectionBounds;
      }
    }
    return fromSlotIds([...state.slotAssignments.keys()]) || full;
  }

  async function exportImage(format = "webp") {
    const cards = getCards();
    const cardMap = getCardMap(cards);
    const exportFormat = EXPORT_FORMATS[format] || EXPORT_FORMATS.webp;
    const scope = state.exportScope || "used";
    const bounds = getExportBounds(scope);
    const columns = Math.max(1, bounds.maxColumn - bounds.minColumn + 1);
    const rows = Math.max(1, bounds.maxRow - bounds.minRow + 1);
    const contentWidth = (columns * EXPORT_SLOT_WIDTH) + ((columns - 1) * EXPORT_GRID_GAP);
    const contentHeight = (rows * EXPORT_SLOT_HEIGHT) + ((rows - 1) * EXPORT_GRID_GAP);
    const canvasWidth = contentWidth + (EXPORT_PADDING * 2);
    const canvasHeight = contentHeight + (EXPORT_PADDING * 2);
    const scale = Math.max(2, Math.min(2.5, Number(window.devicePixelRatio) || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(canvasWidth * scale);
    canvas.height = Math.ceil(canvasHeight * scale);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context is unavailable.");
    }

    context.scale(scale, scale);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    // Full-grid exports keep the board background; trimmed/selection exports stay
    // transparent outside the cards so the file stays tight (WebP supports alpha).
    if (scope === "full") {
      context.fillStyle = EXPORT_BACKGROUND;
      context.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
      context.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    const imageCache = new Map();
    cards.forEach((card) => {
      const slotId = findAssignedSlotIdByCardId(getCardId(card));
      const src = resolveCardFullImage(card, slotId);
      if (src && !imageCache.has(src)) {
        imageCache.set(src, loadCardImage(src));
      }
    });

    const resolvedImages = new Map();
    await Promise.all(cards.map(async (card) => {
      const slotId = findAssignedSlotIdByCardId(getCardId(card));
      const src = resolveCardFullImage(card, slotId);
      const image = src ? await imageCache.get(src) : null;
      resolvedImages.set(getCardId(card), image || null);
    }));

    const customBackgroundImageCache = new Map();
    state.customCards.forEach((card) => {
      const src = normalizeCustomCardBackgroundImage(card?.backgroundImage);
      if (src && !customBackgroundImageCache.has(src)) {
        customBackgroundImageCache.set(src, loadCardImage(src));
      }
    });

    const resolvedCustomBackgroundImages = new Map();
    await Promise.all(Array.from(state.customCards.values()).map(async (card) => {
      const src = normalizeCustomCardBackgroundImage(card?.backgroundImage);
      const image = src ? await customBackgroundImageCache.get(src) : null;
      resolvedCustomBackgroundImages.set(getCardId(card), image || null);
    }));

    const originX = EXPORT_PADDING - ((bounds.minColumn - 1) * (EXPORT_SLOT_WIDTH + EXPORT_GRID_GAP));
    const originY = EXPORT_PADDING - ((bounds.minRow - 1) * (EXPORT_SLOT_HEIGHT + EXPORT_GRID_GAP));
    for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
      for (let column = bounds.minColumn; column <= bounds.maxColumn; column += 1) {
        const slotId = getSlotId(row, column);
        const card = getAssignedCard(slotId, cardMap);
        if (!card) {
          continue;
        }
        const x = originX + ((column - 1) * (EXPORT_SLOT_WIDTH + EXPORT_GRID_GAP));
        const y = originY + ((row - 1) * (EXPORT_SLOT_HEIGHT + EXPORT_GRID_GAP));
        drawSlotToCanvas(
          context,
          x,
          y,
          EXPORT_SLOT_WIDTH,
          EXPORT_SLOT_HEIGHT,
          card,
          card ? resolvedImages.get(getCardId(card)) : null,
          card ? resolvedCustomBackgroundImages.get(getCardId(card)) : null,
          card ? isSlotFlipped(slotId) : false,
          slotId
        );
      }
    }

    const blob = await canvasToBlobByFormat(canvas, format);
    const blobUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = blobUrl;
    downloadLink.download = nextFrameExportFileName(exportFormat.extension);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  // Export name is "<System> - <Deck>", e.g. "I Ching - Tao Oracle". Repeats of
  // the same name get an increment suffix (no timestamp).
  function sanitizeFileNamePart(value) {
    return String(value || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  }

  function buildFrameExportBaseName() {
    const systemLabel = FRAME_SYSTEM_LABELS[state.system] || "Frame";
    const deckId = getFrameDeckId();
    const deckLabel = getDeckOptionsList().find((option) => option.id === deckId)?.label || deckId || "Frame";
    return sanitizeFileNamePart(`${systemLabel} - ${deckLabel}`) || `Frame - ${systemLabel}`;
  }

  function nextFrameExportFileName(extension) {
    const base = buildFrameExportBaseName();
    let counts = {};
    try {
      counts = JSON.parse(readStorageValue(FRAME_EXPORT_COUNTS_STORAGE_KEY) || "{}") || {};
    } catch (_error) {
      counts = {};
    }
    const next = Number(counts[base] || 0) + 1;
    counts[base] = next;
    writeStorageValue(FRAME_EXPORT_COUNTS_STORAGE_KEY, JSON.stringify(counts));
    return `${base}${next > 1 ? ` (${next})` : ""}.${extension}`;
  }

  async function exportFrame(format = "webp") {
    if (state.exportInProgress) {
      return;
    }

    state.exportInProgress = true;
    state.exportFormat = format;
    syncControls();

    try {
      setStatus("Loading HD images for export…");
      await exportImage(format);
      setStatus(`Downloaded a ${String(format || "webp").toUpperCase()} export of the current frame grid.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to export the Frame image.");
    } finally {
      state.exportInProgress = false;
      state.exportFormat = "webp";
      syncControls();
    }
  }

  function bindEvents() {
    const {
      tarotFrameBoardEl,
      tarotFrameOverviewEl,
      tarotFrameSelectionChipEl,
      tarotFrameFocusExitEl,
      tarotFrameLayoutOptionsEl,
      tarotFrameFramesPanelEl,
      tarotFrameSettingsPanelEl,
      tarotFrameGridZoomEl,
      tarotFrameDeckSelectEl,
      tarotFrameExportScopeEl,
      tarotFrameShowInfoEl,
      tarotFrameHouseTopCardsVisibleEl,
      tarotFrameHouseTopInfoHebrewEl,
      tarotFrameHouseTopInfoPlanetEl,
      tarotFrameHouseTopInfoZodiacEl,
      tarotFrameHouseTopInfoTrumpEl,
      tarotFrameHouseTopInfoPathEl,
      tarotFrameHouseTopInfoDateEl,
      tarotFrameHouseBottomCardsVisibleEl,
      tarotFrameHouseBottomInfoZodiacEl,
      tarotFrameHouseBottomInfoDecanEl,
      tarotFrameHouseBottomInfoMonthEl,
      tarotFrameHouseBottomInfoRulerEl,
      tarotFrameHouseBottomInfoDateEl,
      tarotFrameClearGridEl,
      tarotFrameExportWebpEl
    } = getElements();
    if (tarotFrameBoardEl) {
      tarotFrameBoardEl.addEventListener("pointerdown", handlePointerDown);
      tarotFrameBoardEl.addEventListener("click", handleBoardClick);
      tarotFrameBoardEl.addEventListener("dragstart", handleNativeDragStart);
      tarotFrameBoardEl.addEventListener("contextmenu", handleBoardContextMenu);
      tarotFrameBoardEl.addEventListener("wheel", handleBoardWheel, { passive: false });
      tarotFrameBoardEl.addEventListener("touchstart", handleBoardTouchStart, { passive: false });
    }

    document.addEventListener("touchstart", handleDocumentTouchStart, {
      capture: true,
      passive: true
    });

    if (tarotFrameOverviewEl) {
      tarotFrameOverviewEl.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLTextAreaElement) || target.id !== "tarot-frame-layout-note") {
          return;
        }

        setLayoutNote(state.currentLayoutId, target.value, { updateUi: false });
        const badgeEl = tarotFrameOverviewEl.querySelector(".tarot-frame-notes-badge");
        if (badgeEl instanceof HTMLElement) {
          badgeEl.textContent = getLayoutNote() ? "Saved" : "Optional";
        }
        const clearButton = tarotFrameOverviewEl.querySelector("[data-frame-note-clear='true']");
        if (clearButton instanceof HTMLButtonElement) {
          clearButton.disabled = !getLayoutNote() || Boolean(state.exportInProgress);
        }
      });

      tarotFrameOverviewEl.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const clearButton = target.closest("[data-frame-note-clear='true']");
        if (!(clearButton instanceof HTMLButtonElement)) {
          return;
        }

        setLayoutNote(state.currentLayoutId, "");
      });
    }

    if (tarotFrameSelectionChipEl) {
      tarotFrameSelectionChipEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.exportInProgress || !getSelectedSlotIds().length) {
          return;
        }

        setSelectedSlotIds([]);
        setStatus(buildSelectionStatusMessage(0));
      });
    }

    if (tarotFrameFocusExitEl) {
      tarotFrameFocusExitEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.exportInProgress) {
          return;
        }
        state.layoutMenuOpen = false;
        if (state.settingsOverlayOpen || state.settingsOpen) {
          closeFrameSettings();
        } else {
          openFrameSettings();
        }
      });
    }

    if (tarotFrameLayoutOptionsEl) {
      tarotFrameLayoutOptionsEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.exportInProgress) return;
        const option = event.target?.closest?.("[data-layout-preset-id]");
        if (!option) return;
        const layoutId = option.dataset.layoutPresetId;
        const layoutDef = getLayoutDefinition(layoutId);
        const cards = getCards();
        applyLayoutSelection(layoutId, cards, `${layoutDef ? layoutDef.label : layoutId} layout applied.`);
        state.layoutMenuOpen = false;
        render();
        syncControls();
      });
    }

    if (tarotFrameFramesPanelEl) {
      tarotFrameFramesPanelEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.exportInProgress) return;

        const actionEl = event.target?.closest?.("[data-frame-action]");
        if (actionEl) {
          const action = actionEl.dataset.frameAction;
          const frameId = actionEl.dataset.frameId || "";
          if (action === "new") {
            beginNewFrame();
          } else if (action === "save-active") {
            saveActiveFrame();
          } else if (action === "rename") {
            beginRenameFrame(frameId);
          } else if (action === "delete") {
            deleteSavedLayout(frameId);
          } else if (action === "commit-name") {
            const inputEl = tarotFrameFramesPanelEl.querySelector(".tarot-frame-frame-name-input");
            commitFrameName(inputEl ? inputEl.value : "");
          } else if (action === "cancel-name") {
            cancelFrameName();
          }
          return;
        }

        const optionEl = event.target?.closest?.("[data-layout-id]");
        if (!optionEl) return;
        const frameId = optionEl.dataset.layoutId;
        if (!frameId || frameId === state.currentLayoutId) return;
        const frameDef = getSavedLayout(frameId);
        applyLayoutSelection(frameId, getCards(), frameDef ? `Loaded frame "${frameDef.label}".` : "");
        state.layoutMenuOpen = false;
        render();
        syncControls();
      });
    }

    if (tarotFrameSettingsPanelEl) {
      tarotFrameSettingsPanelEl.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    }

    if (tarotFrameShowInfoEl) {
      tarotFrameShowInfoEl.addEventListener("change", () => {
        state.showInfo = Boolean(tarotFrameShowInfoEl.checked);
        // Pure class flip on the existing grid — no re-render, so the viewfinder
        // and animation stay smooth.
        applyShowInfoToGrid();
        syncControls();
      });
    }

    if (tarotFrameGridZoomEl) {
      tarotFrameGridZoomEl.addEventListener("change", () => {
        setGridZoomStepIndex(tarotFrameGridZoomEl.value);
      });
    }

    const { tarotFrameSystemEl } = getElements();
    if (tarotFrameSystemEl) {
      tarotFrameSystemEl.addEventListener("change", () => {
        setFrameSystem(tarotFrameSystemEl.value);
      });
    }

    if (tarotFrameDeckSelectEl) {
      tarotFrameDeckSelectEl.addEventListener("change", () => {
        if (setFrameDeckId(tarotFrameDeckSelectEl.value)) {
          render({ preserveViewport: true });
        }
        syncControls();
        const deckLabel = getDeckOptionsList().find((option) => option.id === getFrameDeckId())?.label || "selected";
        setStatus(`Frame deck set to ${deckLabel}. Use card action menu to override individual slots.`);
      });
    }

    if (tarotFrameExportScopeEl) {
      tarotFrameExportScopeEl.addEventListener("change", () => {
        state.exportScope = String(tarotFrameExportScopeEl.value || "used");
        syncControls();
        const scopeLabels = { used: "used cards (trimmed)", selection: "selected cards", full: "full grid" };
        setStatus(`Export area set to ${scopeLabels[state.exportScope] || state.exportScope}.`);
      });
    }

    [
      [tarotFrameHouseTopCardsVisibleEl, (checked) => config.setHouseTopCardsVisible?.(checked)],
      [tarotFrameHouseTopInfoHebrewEl, (checked) => config.setHouseTopInfoMode?.("hebrew", checked)],
      [tarotFrameHouseTopInfoPlanetEl, (checked) => config.setHouseTopInfoMode?.("planet", checked)],
      [tarotFrameHouseTopInfoZodiacEl, (checked) => config.setHouseTopInfoMode?.("zodiac", checked)],
      [tarotFrameHouseTopInfoTrumpEl, (checked) => config.setHouseTopInfoMode?.("trump", checked)],
      [tarotFrameHouseTopInfoPathEl, (checked) => config.setHouseTopInfoMode?.("path", checked)],
      [tarotFrameHouseTopInfoDateEl, (checked) => config.setHouseTopInfoMode?.("date", checked)],
      [tarotFrameHouseBottomCardsVisibleEl, (checked) => config.setHouseBottomCardsVisible?.(checked)],
      [tarotFrameHouseBottomInfoZodiacEl, (checked) => config.setHouseBottomInfoMode?.("zodiac", checked)],
      [tarotFrameHouseBottomInfoDecanEl, (checked) => config.setHouseBottomInfoMode?.("decan", checked)],
      [tarotFrameHouseBottomInfoMonthEl, (checked) => config.setHouseBottomInfoMode?.("month", checked)],
      [tarotFrameHouseBottomInfoRulerEl, (checked) => config.setHouseBottomInfoMode?.("ruler", checked)],
      [tarotFrameHouseBottomInfoDateEl, (checked) => config.setHouseBottomInfoMode?.("date", checked)]
    ].forEach(([element, callback]) => {
      if (!element) {
        return;
      }
      element.addEventListener("change", () => {
        callback(Boolean(element.checked));
        render();
        syncControls();
      });
    });

    if (tarotFrameExportWebpEl) {
      tarotFrameExportWebpEl.addEventListener("click", () => {
        exportFrame("webp");
      });
    }

    if (tarotFrameClearGridEl) {
      tarotFrameClearGridEl.addEventListener("click", () => {
        clearGrid();
      });
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeydown);
  }

  async function ensureTarotFrameSection(referenceData, magickDataset) {
    if (typeof config.ensureTarotSection === "function") {
      await config.ensureTarotSection(referenceData, magickDataset);
    }

    resetFrameSectionScroll();

    if (state.system === "iching") {
      await ensureFrameIChingCards();
      const hexagramCards = getCards();
      if (!hexagramCards.length) {
        setStatus("I Ching hexagrams are still loading...");
        return;
      }
      state.cardSignature = buildCardSignature(hexagramCards);
      applyLayoutPreset("iching", hexagramCards);
      render();
      syncControls();
      setGridFocusMode(true);
      return;
    }

    const cards = getCards();
    if (!cards.length) {
      setStatus("Tarot cards are still loading...");
      return;
    }

    const signature = buildCardSignature(cards);
    if (!state.layoutReady || state.cardSignature !== signature) {
      state.cardSignature = signature;
      applyLayoutSelection(state.currentLayoutId, cards);
    } else {
      setStatus(state.statusMessage || buildReadyStatus(cards));
    }

    render();
    syncControls();
    setGridFocusMode(true);
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig
    };

    if (state.initialized) {
      return;
    }

    loadSavedLayoutsFromStorage();
    void hydrateSavedLayoutsFromProfile();
    loadLayoutNotesFromStorage();
    restoreActiveLayoutId();
    restoreCardPickerQuery();
    bindEvents();
    createCardPickerElements();
    state.initialized = true;
  }

  window.TarotFrameUi = {
    ...(window.TarotFrameUi || {}),
    init,
    ensureTarotFrameSection,
    render,
    resetLayout,
    setLayoutPreset(layoutId, options = {}) {
      const cards = getCards();
      state.currentLayoutId = getLayoutDefinition(layoutId).id;
      if (cards.length && options.reapply !== false) {
        applyLayoutSelection(state.currentLayoutId, cards, options.statusMessage || `${getLayoutDefinition(layoutId).label} layout applied to the master grid.`);
        render();
      }
      syncControls();
    },
    exportImage,
    isExportFormatSupported
  };
})();