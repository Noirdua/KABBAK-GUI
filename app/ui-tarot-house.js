(function () {
  "use strict";

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
  const EXPORT_CARD_WIDTH = 128;
  const EXPORT_CARD_HEIGHT = 192;
  const EXPORT_CARD_GAP = 10;
  const EXPORT_ROW_GAP = 12;
  const EXPORT_SECTION_GAP = 18;
  const EXPORT_PADDING = 28;
  const EXPORT_BACKGROUND = "#151520";
  const EXPORT_PANEL = "#18181b";
  const EXPORT_BORDER = "#3f3f46";
  const EXPORT_FALLBACK_TEXT = "#f4f4f5";
  const EXPORT_FORMATS = {
    png: {
      mimeType: "image/png",
      extension: "png",
      quality: null
    },
    webp: {
      mimeType: "image/webp",
      extension: "webp",
      quality: 0.98
    }
  };

  const config = {
    resolveTarotCardImage: null,
    resolveTarotCardThumbnail: null,
    getActiveDeck: () => "",
    getDisplayCardName: (card) => card?.name || "",
    clearChildren: () => {},
    normalizeTarotCardLookupName: (value) => String(value || "").trim().toLowerCase(),
    selectCardById: () => {},
    openCardLightbox: () => {},
    shouldOpenCardLightboxOnSelect: () => false,
    isHouseFocusMode: () => false,
    getCards: () => [],
    getSelectedCardId: () => "",
    getHouseTopCardsVisible: () => true,
    getHouseTopInfoModes: () => ({}),
    getMagickDataset: () => null,
    getHouseBottomCardsVisible: () => true,
    getHouseBottomInfoModes: () => ({})
  };

  let houseImageObserver = null;

  function init(nextConfig = {}) {
    Object.assign(config, nextConfig || {});
  }

  function getCardLookupMap(cards) {
    const lookup = new Map();
    (Array.isArray(cards) ? cards : []).forEach((card) => {
      const key = config.normalizeTarotCardLookupName(card?.name);
      if (key) {
        lookup.set(key, card);
      }
    });
    return lookup;
  }

  function buildMinorCardName(rankNumber, suit) {
    const number = Number(rankNumber);
    const suitName = String(suit || "").trim();
    const rankName = ({ 1: "Ace", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten" })[number];
    if (!rankName || !suitName) {
      return "";
    }
    return `${rankName} of ${suitName}`;
  }

  function buildCourtCardName(rank, suit) {
    const rankName = String(rank || "").trim();
    const suitName = String(suit || "").trim();
    if (!rankName || !suitName) {
      return "";
    }
    return `${rankName} of ${suitName}`;
  }

  function findCardByLookupName(cardLookupMap, cardName) {
    const key = config.normalizeTarotCardLookupName(cardName);
    if (!key) {
      return null;
    }
    return cardLookupMap.get(key) || null;
  }

  function findMajorCardByTrumpNumber(cards, trumpNumber) {
    const target = Number(trumpNumber);
    if (!Number.isFinite(target)) {
      return null;
    }
    return (Array.isArray(cards) ? cards : []).find((card) => card?.arcana === "Major" && Number(card?.number) === target) || null;
  }

  function normalizeLabelText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getCardRelationsByType(card, type) {
    if (!card || !Array.isArray(card.relations)) {
      return [];
    }
    return card.relations.filter((relation) => relation?.type === type);
  }

  function getFirstCardRelationByType(card, type) {
    return getCardRelationsByType(card, type)[0] || null;
  }

  function toRomanNumeral(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return "";
    }

    const numerals = [
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"]
    ];

    let remaining = number;
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
      : getFirstCardRelationByType(card, "hebrewLetter")?.data;

    const glyph = normalizeLabelText(hebrew?.glyph || hebrew?.char);
    const transliteration = normalizeLabelText(hebrew?.latin || hebrew?.name || card?.hebrewLetterId);
    const primary = glyph || transliteration;
    const secondary = glyph && transliteration ? transliteration : "";

    if (!primary) {
      return null;
    }

    return {
      primary,
      secondary,
      className: "is-top-hebrew"
    };
  }

  function buildPlanetLabel(card) {
    const relation = getFirstCardRelationByType(card, "planetCorrespondence")
      || getFirstCardRelationByType(card, "planet")
      || getFirstCardRelationByType(card, "decanRuler");
    const name = normalizeLabelText(relation?.data?.name || relation?.data?.planetId || relation?.id);
    const symbol = normalizeLabelText(relation?.data?.symbol);
    const primary = normalizeLabelText(symbol ? `${symbol} ${name}` : name);
    if (!primary) {
      return null;
    }
    return {
      primary: relation?.type === "decanRuler" ? `Ruler: ${primary}` : `Planet: ${primary}`,
      secondary: "",
      className: ""
    };
  }

  function buildMajorZodiacLabel(card) {
    const relation = getFirstCardRelationByType(card, "zodiacCorrespondence")
      || getFirstCardRelationByType(card, "zodiac");
    const name = normalizeLabelText(relation?.data?.name || relation?.data?.signName || relation?.id);
    const symbol = normalizeLabelText(relation?.data?.symbol);
    const primary = normalizeLabelText(symbol ? `${symbol} ${name}` : name);
    if (!primary) {
      return null;
    }
    return {
      primary: `Zodiac: ${primary}`,
      secondary: "",
      className: ""
    };
  }

  function buildTrumpNumberLabel(card) {
    const number = Number(card?.number);
    if (!Number.isFinite(number)) {
      return null;
    }

    const formattedTrumpNumber = number === 0
      ? "0"
      : toRomanNumeral(Math.trunc(number));

    return {
      primary: `Trump: ${formattedTrumpNumber}`,
      secondary: "",
      className: ""
    };
  }

  function buildPathNumberLabel(card) {
    const pathNumber = Number(card?.kabbalahPathNumber);
    if (!Number.isFinite(pathNumber)) {
      return null;
    }
    return {
      primary: `Path: ${Math.trunc(pathNumber)}`,
      secondary: "",
      className: ""
    };
  }

  function buildZodiacLabel(card) {
    const zodiacRelation = getFirstCardRelationByType(card, "zodiac");
    const decanRelations = getCardRelationsByType(card, "decan");
    const primary = normalizeLabelText(
      zodiacRelation?.data?.symbol
        ? `${zodiacRelation.data.symbol} ${zodiacRelation.data.signName || zodiacRelation.data.name || ""}`
        : zodiacRelation?.data?.signName || zodiacRelation?.data?.name
    );

    if (primary) {
      const dateRange = normalizeLabelText(getFirstCardRelationByType(card, "courtDateWindow")?.data?.dateRange);
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
      const dateRange = normalizeLabelText(getFirstCardRelationByType(card, "courtDateWindow")?.data?.dateRange);
      if (rangeLabel) {
        return {
          primary: rangeLabel,
          secondary: dateRange || "",
          className: ""
        };
      }
    }

    return null;
  }

  function buildDecanLabel(card) {
    const decanRelations = getCardRelationsByType(card, "decan");
    if (decanRelations.length === 0) {
      return null;
    }

    if (decanRelations.length === 1) {
      const data = decanRelations[0].data || {};
      const hasDegrees = Number.isFinite(Number(data.startDegree)) && Number.isFinite(Number(data.endDegree));
      const degreeLabel = hasDegrees ? `${data.startDegree}°-${data.endDegree}°` : "";
      const signLabel = normalizeLabelText(data.signName);
      const primary = degreeLabel || signLabel;
      const secondary = degreeLabel && signLabel ? signLabel : normalizeLabelText(data.dateRange);
      if (primary) {
        return {
          primary,
          secondary,
          className: ""
        };
      }
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
    const secondary = normalizeLabelText(getFirstCardRelationByType(card, "courtDateWindow")?.data?.dateRange);

    if (!primary) {
      return null;
    }

    return {
      primary,
      secondary,
      className: ""
    };
  }

  function buildDateLabel(card) {
    const courtWindow = getFirstCardRelationByType(card, "courtDateWindow")?.data || null;
    const decan = getFirstCardRelationByType(card, "decan")?.data || null;
    const calendar = getFirstCardRelationByType(card, "calendarMonth")?.data || null;
    const zodiac = getFirstCardRelationByType(card, "zodiacCorrespondence")?.data
      || getFirstCardRelationByType(card, "zodiac")?.data
      || null;

    let zodiacDateRange = "";
    if (zodiac?.signId || zodiac?.id || zodiac?.name) {
      const zodiacId = normalizeLabelText(zodiac.signId || zodiac.id || zodiac.name).toLowerCase();
      const sign = config.getMagickDataset?.()?.grouped?.astrology?.zodiac?.[zodiacId] || null;
      const rulesFrom = Array.isArray(sign?.rulesFrom) ? sign.rulesFrom : [];
      if (rulesFrom.length === 2) {
        const [[startMonth, startDay], [endMonth, endDay]] = rulesFrom;
        const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const startLabel = Number.isFinite(Number(startMonth)) && Number.isFinite(Number(startDay))
          ? `${monthLabels[Math.max(0, Math.min(11, Number(startMonth) - 1))]} ${Number(startDay)}`
          : "";
        const endLabel = Number.isFinite(Number(endMonth)) && Number.isFinite(Number(endDay))
          ? `${monthLabels[Math.max(0, Math.min(11, Number(endMonth) - 1))]} ${Number(endDay)}`
          : "";
        zodiacDateRange = normalizeLabelText(startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel || endLabel);
      }
    }

    const primary = normalizeLabelText(courtWindow?.dateRange || decan?.dateRange || calendar?.dateRange || zodiacDateRange || calendar?.name);
    const secondary = normalizeLabelText(
      calendar?.name && primary !== calendar.name
        ? calendar.name
        : decan?.signName || zodiac?.name
    );

    if (!primary) {
      return null;
    }

    return {
      primary,
      secondary,
      className: ""
    };
  }

  function buildMonthLabel(card) {
    const monthRelations = getCardRelationsByType(card, "calendarMonth");
    const names = [];
    const seen = new Set();

    monthRelations.forEach((relation) => {
      const name = normalizeLabelText(relation?.data?.name);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) {
        return;
      }
      seen.add(key);
      names.push(name);
    });

    if (!names.length) {
      return null;
    }

    return {
      primary: `Month: ${names.join("/")}`,
      secondary: "",
      className: ""
    };
  }

  function buildRulerLabel(card) {
    const rulerRelations = getCardRelationsByType(card, "decanRuler");
    const names = [];
    const seen = new Set();

    rulerRelations.forEach((relation) => {
      const name = normalizeLabelText(
        relation?.data?.symbol
          ? `${relation.data.symbol} ${relation.data.name || relation.data.planetId || ""}`
          : relation?.data?.name || relation?.data?.planetId
      );
      const key = name.toLowerCase();
      if (!name || seen.has(key)) {
        return;
      }
      seen.add(key);
      names.push(name);
    });

    if (!names.length) {
      return null;
    }

    return {
      primary: `Ruler: ${names.join("/")}`,
      secondary: "",
      className: ""
    };
  }

  function getTopInfoModeEnabled(mode) {
    const modes = config.getHouseTopInfoModes?.();
    return Boolean(modes && modes[mode]);
  }

  function buildTopInfoLabel(card) {
    const lineSet = new Set();
    const lines = [];

    function pushLine(value) {
      const text = normalizeLabelText(value);
      const key = text.toLowerCase();
      if (!text || lineSet.has(key)) {
        return;
      }
      lineSet.add(key);
      lines.push(text);
    }

    if (getTopInfoModeEnabled("hebrew")) {
      const hebrew = buildHebrewLabel(card);
      pushLine(hebrew?.primary);
      pushLine(hebrew?.secondary);
    }

    if (getTopInfoModeEnabled("planet")) {
      pushLine(buildPlanetLabel(card)?.primary);
    }

    if (getTopInfoModeEnabled("zodiac")) {
      pushLine(buildMajorZodiacLabel(card)?.primary);
    }

    if (getTopInfoModeEnabled("trump")) {
      pushLine(buildTrumpNumberLabel(card)?.primary);
    }

    if (getTopInfoModeEnabled("path")) {
      pushLine(buildPathNumberLabel(card)?.primary);
    }

    if (getTopInfoModeEnabled("date")) {
      pushLine(buildDateLabel(card)?.primary);
    }

    if (!lines.length) {
      return null;
    }

    const hasHebrew = getTopInfoModeEnabled("hebrew") && Boolean(buildHebrewLabel(card)?.primary);

    return {
      primary: lines[0],
      secondary: lines.slice(1).join(" · "),
      className: `${lines.length >= 3 ? "is-dense" : ""}${hasHebrew ? " is-top-hebrew" : ""}`.trim()
    };
  }

  function getBottomInfoModeEnabled(mode) {
    const modes = config.getHouseBottomInfoModes?.();
    return Boolean(modes && modes[mode]);
  }

  function buildBottomInfoLabel(card) {
    const lineSet = new Set();
    const lines = [];

    function pushLine(value) {
      const text = normalizeLabelText(value);
      const key = text.toLowerCase();
      if (!text || lineSet.has(key)) {
        return;
      }
      lineSet.add(key);
      lines.push(text);
    }

    if (getBottomInfoModeEnabled("zodiac")) {
      pushLine(buildZodiacLabel(card)?.primary);
    }

    if (getBottomInfoModeEnabled("decan")) {
      const decanLabel = buildDecanLabel(card);
      pushLine(decanLabel?.primary);
      if (!getBottomInfoModeEnabled("date")) {
        pushLine(decanLabel?.secondary);
      }
    }

    if (getBottomInfoModeEnabled("month")) {
      pushLine(buildMonthLabel(card)?.primary);
    }

    if (getBottomInfoModeEnabled("ruler")) {
      pushLine(buildRulerLabel(card)?.primary);
    }

    if (getBottomInfoModeEnabled("date")) {
      pushLine(buildDateLabel(card)?.primary);
    }

    if (lines.length === 0) {
      return null;
    }

    return {
      primary: lines[0],
      secondary: lines.slice(1).join(" · "),
      className: lines.length >= 3 ? "is-dense" : ""
    };
  }

  function buildHouseCardLabel(card) {
    if (!card) {
      return null;
    }

    const name = normalizeLabelText(config.getDisplayCardName(card) || card.name || "");
    const label = card.arcana === "Major" ? buildTopInfoLabel(card) : buildBottomInfoLabel(card);
    if (!name) {
      return label;
    }
    if (!label?.primary) {
      return { primary: name, secondary: "", className: "" };
    }
    if (String(label.primary).toLowerCase() === name.toLowerCase()) {
      return label;
    }
    const secondary = [label.secondary, name].filter(Boolean).join(" · ");
    return { ...label, secondary };
  }

  function isHouseCardImageVisible(card) {
    if (!card) {
      return false;
    }

    if (card.arcana === "Major") {
      return config.getHouseTopCardsVisible?.() !== false;
    }

    return config.getHouseBottomCardsVisible?.() !== false;
  }

  function buildHouseCardTextFaceModel(card, label) {
    const displayName = normalizeLabelText(config.getDisplayCardName(card) || card?.name || "Tarot");

    if (card?.arcana !== "Major" && label?.primary) {
      return {
        primary: displayName || "Tarot",
        secondary: [label.primary, label.secondary].filter(Boolean).join(" · "),
        className: label.className || ""
      };
    }

    if (label?.primary) {
      const fallbackSecondary = displayName && label.primary !== displayName ? displayName : "";
      return {
        primary: label.primary,
        secondary: label.secondary || fallbackSecondary,
        className: label.className || ""
      };
    }

    return {
      primary: displayName || "Tarot",
      secondary: "",
      className: ""
    };
  }

  function createHouseCardLabelElement(label) {
    if (!label?.primary) {
      return null;
    }

    const labelEl = document.createElement("span");
    labelEl.className = `tarot-house-card-label${label.className ? ` ${label.className}` : ""}`;

    const primaryEl = document.createElement("span");
    primaryEl.className = "tarot-house-card-label-primary";
    primaryEl.textContent = label.primary;
    labelEl.appendChild(primaryEl);

    if (label.secondary) {
      const secondaryEl = document.createElement("span");
      secondaryEl.className = "tarot-house-card-label-secondary";
      secondaryEl.textContent = label.secondary;
      labelEl.appendChild(secondaryEl);
    }

    return labelEl;
  }

  function createHouseCardTextFaceElement(faceModel) {
    const faceEl = document.createElement("span");
    faceEl.className = `tarot-house-card-text-face${faceModel?.className ? ` ${faceModel.className}` : ""}`;

    const primaryEl = document.createElement("span");
    primaryEl.className = "tarot-house-card-text-primary";
    primaryEl.textContent = faceModel?.primary || "Tarot";
    faceEl.appendChild(primaryEl);

    if (faceModel?.secondary) {
      const secondaryEl = document.createElement("span");
      secondaryEl.className = "tarot-house-card-text-secondary";
      secondaryEl.textContent = faceModel.secondary;
      faceEl.appendChild(secondaryEl);
    }

    return faceEl;
  }

  function disconnectHouseImageObserver() {
    if (!houseImageObserver) {
      return;
    }

    houseImageObserver.disconnect();
    houseImageObserver = null;
  }

  function isCompactHouseLayout() {
    if (typeof window === "undefined") {
      return false;
    }

    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(max-width: 900px)").matches;
    }

    return Number(window.innerWidth) <= 900;
  }

  function buildHouseCardDeckOptions(card) {
    const deckId = String(config.getActiveDeck?.() || "").trim();
    const trumpNumber = card?.arcana === "Major" && Number.isFinite(Number(card?.number))
      ? Number(card.number)
      : undefined;

    if (!deckId && !Number.isFinite(trumpNumber)) {
      return null;
    }

    return {
      ...(deckId ? { deckId } : {}),
      ...(Number.isFinite(trumpNumber) ? { trumpNumber } : {})
    };
  }

  function hydrateHouseCardImage(image) {
    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    const nextSrc = String(image.dataset.src || "").trim();
    if (!nextSrc || image.dataset.imageHydrated === "true") {
      return;
    }

    image.dataset.imageHydrated = "true";
    image.classList.add("is-loading");
    image.src = nextSrc;
  }

  function getHouseImageObserver(elements) {
    const root = elements?.tarotHouseViewEl || elements?.tarotHouseOfCardsEl?.closest(".tarot-section-house-top") || null;
    if (!root || typeof IntersectionObserver !== "function") {
      return null;
    }

    if (houseImageObserver) {
      return houseImageObserver;
    }

    houseImageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const target = entry.target;
        observer.unobserve(target);
        hydrateHouseCardImage(target);
      });
    }, {
      root,
      rootMargin: "160px 0px",
      threshold: 0.01
    });

    return houseImageObserver;
  }

  function registerHouseCardImage(image, elements) {
    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    if (isCompactHouseLayout()) {
      hydrateHouseCardImage(image);
      return;
    }

    const observer = getHouseImageObserver(elements);
    if (!observer) {
      hydrateHouseCardImage(image);
      return;
    }

    observer.observe(image);
  }

  function createHouseCardButton(card, elements) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tarot-house-card-btn";

    if (!card) {
      button.disabled = true;
      const fallback = document.createElement("span");
      fallback.className = "tarot-house-card-fallback";
      fallback.textContent = "Missing";
      button.appendChild(fallback);
      return button;
    }

    const cardDisplayName = config.getDisplayCardName(card);
    const label = buildHouseCardLabel(card);
    const showImage = isHouseCardImageVisible(card);
    const deckOptions = buildHouseCardDeckOptions(card);
    const labelText = label?.secondary
      ? `${label.primary} - ${label.secondary}`
      : label?.primary || "";
    button.title = labelText ? `${cardDisplayName || card.name} - ${labelText}` : (cardDisplayName || card.name);
    button.setAttribute("aria-label", labelText ? `${cardDisplayName || card.name}, ${labelText}` : (cardDisplayName || card.name));
    button.dataset.houseCardId = card.id;
    const imageUrl = typeof config.resolveTarotCardThumbnail === "function"
      ? config.resolveTarotCardThumbnail(card.name, deckOptions || undefined)
      : (typeof config.resolveTarotCardImage === "function" ? config.resolveTarotCardImage(card.name, deckOptions || undefined) : null);
    const fullImageUrl = typeof config.resolveTarotCardImage === "function"
      ? config.resolveTarotCardImage(card.name, deckOptions || undefined)
      : imageUrl;

    if (showImage && imageUrl) {
      const image = document.createElement("img");
      image.className = "tarot-house-card-image";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.loading = "lazy";
      image.decoding = "async";
      image.fetchPriority = config.isHouseFocusMode?.() === true ? "auto" : "low";
      image.dataset.src = imageUrl;
      image.dataset.fullSrc = fullImageUrl || imageUrl;
      image.addEventListener("load", () => {
        image.classList.remove("is-loading");
        image.classList.add("is-loaded");
      }, { once: true });
      image.addEventListener("error", () => {
        const fallbackSrc = String(image.dataset.fullSrc || "").trim();
        if (fallbackSrc && fallbackSrc !== image.currentSrc && image.dataset.fullImageTried !== "true") {
          image.dataset.fullImageTried = "true";
          image.dataset.imageHydrated = "true";
          image.src = fallbackSrc;
          return;
        }
        image.classList.remove("is-loading");
        image.classList.remove("is-loaded");
        image.dataset.imageHydrated = "false";
      });
      button.appendChild(image);
      registerHouseCardImage(image, elements);
    } else if (showImage) {
      const fallback = document.createElement("span");
      fallback.className = "tarot-house-card-fallback";
      fallback.textContent = cardDisplayName || card.name;
      button.appendChild(fallback);
    } else {
      button.classList.add("is-text-only");
      button.appendChild(createHouseCardTextFaceElement(buildHouseCardTextFaceModel(card, label)));
    }

    const labelEl = showImage ? createHouseCardLabelElement(label) : null;
    if (labelEl) {
      button.appendChild(labelEl);
    }

    button.addEventListener("click", () => {
      const shouldOpenLightbox = Boolean(config.isHouseFocusMode?.())
        || Boolean(config.shouldOpenCardLightboxOnSelect?.(elements, card));

      config.selectCardById(card.id, elements);
      if (shouldOpenLightbox && imageUrl) {
        config.openCardLightbox?.(
          imageUrl,
          cardDisplayName || card.name || "Tarot card enlarged image",
          { cardId: card.id }
        );
        return;
      }
      elements?.tarotCardListEl
        ?.querySelector(`[data-card-id="${card.id}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });

    return button;
  }

  function updateSelection(elements) {
    if (!elements?.tarotHouseOfCardsEl) {
      return;
    }

    const selectedCardId = config.getSelectedCardId();
    const buttons = elements.tarotHouseOfCardsEl.querySelectorAll(".tarot-house-card-btn[data-house-card-id]");
    buttons.forEach((button) => {
      const isSelected = button.dataset.houseCardId === selectedCardId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-current", isSelected ? "true" : "false");
    });
  }

  function loadCardImage(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }

      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  function buildHouseRows(cards, cardLookupMap) {
    const trumpRows = HOUSE_TRUMP_ROWS.map((trumpNumbers) =>
      (trumpNumbers || []).map((trumpNumber) => findMajorCardByTrumpNumber(cards, trumpNumber))
    );

    const leftRows = HOUSE_MINOR_NUMBER_BANDS.map((numbers, rowIndex) =>
      numbers.map((rankNumber) => findCardByLookupName(cardLookupMap, buildMinorCardName(rankNumber, HOUSE_LEFT_SUITS[rowIndex])))
    );

    const middleRows = HOUSE_MIDDLE_RANKS.map((rank) =>
      HOUSE_MIDDLE_SUITS.map((suit) => findCardByLookupName(cardLookupMap, buildCourtCardName(rank, suit)))
    );

    const rightRows = HOUSE_MINOR_NUMBER_BANDS.map((numbers, rowIndex) =>
      numbers.map((rankNumber) => findCardByLookupName(cardLookupMap, buildMinorCardName(rankNumber, HOUSE_RIGHT_SUITS[rowIndex])))
    );

    return {
      trumpRows,
      leftRows,
      middleRows,
      rightRows
    };
  }

  function drawRoundedRectPath(context, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.arcTo(x + width, y, x + width, y + height, safeRadius);
    context.arcTo(x + width, y + height, x, y + height, safeRadius);
    context.arcTo(x, y + height, x, y, safeRadius);
    context.arcTo(x, y, x + width, y, safeRadius);
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

  function wrapCanvasText(context, text, maxWidth, maxLines = 4) {
    const normalized = normalizeLabelText(text);
    if (!normalized) {
      return [];
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      return [fitCanvasLabelText(context, normalized, maxWidth)];
    }

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
    clipped[clipped.length - 1] = fitCanvasLabelText(context, `${clipped[clipped.length - 1]}...`, maxWidth);
    return clipped;
  }

  function drawTextFaceToCanvas(context, x, y, width, height, faceModel) {
    const primaryText = normalizeLabelText(faceModel?.primary || "Tarot");
    const secondaryText = normalizeLabelText(faceModel?.secondary);
    const maxWidth = width - 20;

    context.save();
    context.fillStyle = "#f4f4f5";
    const primaryFontSize = faceModel?.className === "is-top-hebrew" && primaryText.length <= 3 ? 24 : 13;
    const primaryFontFamily = faceModel?.className === "is-top-hebrew"
      ? "'Segoe UI Symbol', 'Noto Sans Hebrew', 'Segoe UI', sans-serif"
      : "'Segoe UI', sans-serif";
    context.font = `700 ${primaryFontSize}px ${primaryFontFamily}`;
    const primaryLines = wrapCanvasText(context, primaryText, maxWidth, secondaryText ? 3 : 4);

    context.fillStyle = "rgba(250, 250, 250, 0.84)";
    context.font = "500 9px 'Segoe UI', sans-serif";
    const secondaryLines = secondaryText ? wrapCanvasText(context, secondaryText, maxWidth, 2) : [];

    const primaryLineHeight = faceModel?.className === "is-top-hebrew" && primaryText.length <= 3 ? 24 : 16;
    const secondaryLineHeight = 12;
    const totalHeight = (primaryLines.length * primaryLineHeight)
      + (secondaryLines.length ? 8 + (secondaryLines.length * secondaryLineHeight) : 0);
    let currentY = y + ((height - totalHeight) / 2) + primaryLineHeight;

    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#f4f4f5";
    context.font = `700 ${primaryFontSize}px ${primaryFontFamily}`;
    primaryLines.forEach((line) => {
      context.fillText(line, x + (width / 2), currentY, maxWidth);
      currentY += primaryLineHeight;
    });

    if (secondaryLines.length) {
      currentY += 4;
      context.fillStyle = "rgba(250, 250, 250, 0.84)";
      context.font = "500 9px 'Segoe UI', sans-serif";
      secondaryLines.forEach((line) => {
        context.fillText(line, x + (width / 2), currentY, maxWidth);
        currentY += secondaryLineHeight;
      });
    }
    context.restore();
  }

  function drawCardLabelToCanvas(context, x, y, width, height, label) {
    if (!label?.primary) {
      return;
    }

    const hasSecondary = Boolean(label.secondary);
    const overlayHeight = hasSecondary ? 34 : 24;
    const overlayX = x + 4;
    const overlayY = y + height - overlayHeight - 4;
    const overlayWidth = width - 8;
    const gradient = context.createLinearGradient(overlayX, overlayY, overlayX, overlayY + overlayHeight);
    gradient.addColorStop(0, "rgba(9, 9, 11, 0.18)");
    gradient.addColorStop(1, "rgba(9, 9, 11, 0.9)");

    context.save();
    drawRoundedRectPath(context, overlayX, overlayY, overlayWidth, overlayHeight, 6);
    context.fillStyle = gradient;
    context.fill();
    context.textAlign = "center";

    const primaryFontSize = label.className === "is-top-hebrew" && label.primary.length <= 3 ? 14 : 11;
    context.textBaseline = hasSecondary ? "alphabetic" : "middle";
    context.fillStyle = "#fafafa";
    context.font = `700 ${primaryFontSize}px 'Segoe UI Symbol', 'Segoe UI', sans-serif`;
    const primaryText = fitCanvasLabelText(context, label.primary, overlayWidth - 10);
    if (hasSecondary) {
      context.fillText(primaryText, x + width / 2, overlayY + 14, overlayWidth - 10);
      context.fillStyle = "rgba(250, 250, 250, 0.84)";
      context.font = "500 9px 'Segoe UI', sans-serif";
      const secondaryText = fitCanvasLabelText(context, label.secondary, overlayWidth - 10);
      context.fillText(secondaryText, x + width / 2, overlayY + overlayHeight - 8, overlayWidth - 10);
    } else {
      context.fillText(primaryText, x + width / 2, overlayY + (overlayHeight / 2), overlayWidth - 10);
    }
    context.restore();
  }

  function drawCardToCanvas(context, x, y, width, height, card, image) {
    const label = buildHouseCardLabel(card);
    const showImage = isHouseCardImageVisible(card);
    drawRoundedRectPath(context, x, y, width, height, 8);
    context.fillStyle = EXPORT_PANEL;
    context.fill();

    if (showImage && image) {
      context.save();
      drawRoundedRectPath(context, x, y, width, height, 8);
      context.clip();
      context.drawImage(image, x, y, width, height);
      context.restore();
    } else if (showImage) {
      context.fillStyle = "#09090b";
      context.fillRect(x, y, width, height);
      context.fillStyle = EXPORT_FALLBACK_TEXT;
      context.font = "600 12px 'Segoe UI', sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";

      const label = card ? (config.getDisplayCardName(card) || card.name || "Tarot") : "Missing";
      const words = String(label).split(/\s+/).filter(Boolean);
      const lines = [];
      let current = "";
      words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length > 14 && current) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      });
      if (current) {
        lines.push(current);
      }

      const lineHeight = 16;
      const startY = y + (height / 2) - ((lines.length - 1) * lineHeight / 2);
      lines.slice(0, 4).forEach((line, index) => {
        context.fillText(line, x + width / 2, startY + (index * lineHeight), width - 16);
      });
    } else {
      drawTextFaceToCanvas(context, x, y, width, height, buildHouseCardTextFaceModel(card, label));
    }

    if (showImage) {
      drawCardLabelToCanvas(context, x, y, width, height, label);
    }

    drawRoundedRectPath(context, x, y, width, height, 8);
    context.lineWidth = 2;
    context.strokeStyle = EXPORT_BORDER;
    context.stroke();
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Canvas export failed."));
      }, "image/png");
    });
  }

  function isExportFormatSupported(format) {
    const exportFormat = EXPORT_FORMATS[format];
    if (!exportFormat) {
      return false;
    }

    if (format === "png") {
      return true;
    }

    const probeCanvas = document.createElement("canvas");
    const dataUrl = probeCanvas.toDataURL(exportFormat.mimeType);
    return dataUrl.startsWith(`data:${exportFormat.mimeType}`);
  }

  function canvasToBlobByFormat(canvas, format) {
    const exportFormat = EXPORT_FORMATS[format] || EXPORT_FORMATS.png;

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

  async function exportImage(format = "png") {
    const exportFormat = EXPORT_FORMATS[format] || EXPORT_FORMATS.png;
    const cards = config.getCards();
    const cardLookupMap = getCardLookupMap(cards);
    const houseRows = buildHouseRows(cards, cardLookupMap);

    const majorRowWidth = (11 * EXPORT_CARD_WIDTH) + (10 * EXPORT_CARD_GAP);
    const leftColumnWidth = (3 * EXPORT_CARD_WIDTH) + (2 * EXPORT_CARD_GAP);
    const middleColumnWidth = (4 * EXPORT_CARD_WIDTH) + (3 * EXPORT_CARD_GAP);
    const rightColumnWidth = leftColumnWidth;
    const usedBottomWidth = leftColumnWidth + middleColumnWidth + rightColumnWidth;
    const betweenColumnGap = Math.max(0, (majorRowWidth - usedBottomWidth) / 2);
    const contentWidth = majorRowWidth;
    const trumpHeight = (houseRows.trumpRows.length * EXPORT_CARD_HEIGHT) + ((houseRows.trumpRows.length - 1) * EXPORT_ROW_GAP);
    const bottomHeight = (houseRows.leftRows.length * EXPORT_CARD_HEIGHT) + ((houseRows.leftRows.length - 1) * EXPORT_ROW_GAP);
    const contentHeight = trumpHeight + EXPORT_SECTION_GAP + bottomHeight;

    const scale = Math.max(2, Math.min(3, Number(window.devicePixelRatio) || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil((contentWidth + (EXPORT_PADDING * 2)) * scale);
    canvas.height = Math.ceil((contentHeight + (EXPORT_PADDING * 2)) * scale);
    canvas.style.width = `${contentWidth + (EXPORT_PADDING * 2)}px`;
    canvas.style.height = `${contentHeight + (EXPORT_PADDING * 2)}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context is unavailable.");
    }

    context.scale(scale, scale);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = EXPORT_BACKGROUND;
    context.fillRect(0, 0, contentWidth + (EXPORT_PADDING * 2), contentHeight + (EXPORT_PADDING * 2));

    const imageCache = new Map();
    const imageUrlByCardId = new Map();
    cards.forEach((card) => {
      const url = typeof config.resolveTarotCardImage === "function"
        ? config.resolveTarotCardImage(card.name, buildHouseCardDeckOptions(card) || undefined)
        : null;
      imageUrlByCardId.set(card.id, url || "");
      if (url && !imageCache.has(url)) {
        imageCache.set(url, loadCardImage(url));
      }
    });

    const resolvedImageByCardId = new Map();
    await Promise.all(cards.map(async (card) => {
      const url = imageUrlByCardId.get(card.id);
      const image = url ? await imageCache.get(url) : null;
      resolvedImageByCardId.set(card.id, image || null);
    }));

    let currentY = EXPORT_PADDING;
    houseRows.trumpRows.forEach((row) => {
      const rowWidth = (row.length * EXPORT_CARD_WIDTH) + ((Math.max(0, row.length - 1)) * EXPORT_CARD_GAP);
      let currentX = EXPORT_PADDING + ((contentWidth - rowWidth) / 2);
      row.forEach((card) => {
        drawCardToCanvas(context, currentX, currentY, EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT, card, card ? resolvedImageByCardId.get(card.id) : null);
        currentX += EXPORT_CARD_WIDTH + EXPORT_CARD_GAP;
      });
      currentY += EXPORT_CARD_HEIGHT + EXPORT_ROW_GAP;
    });

    currentY = EXPORT_PADDING + trumpHeight + EXPORT_SECTION_GAP;
    const columnXs = [
      EXPORT_PADDING,
      EXPORT_PADDING + leftColumnWidth + betweenColumnGap,
      EXPORT_PADDING + leftColumnWidth + betweenColumnGap + middleColumnWidth + betweenColumnGap
    ];
    [houseRows.leftRows, houseRows.middleRows, houseRows.rightRows].forEach((columnRows, columnIndex) => {
      let columnY = currentY;
      columnRows.forEach((row) => {
        let currentX = columnXs[columnIndex];
        row.forEach((card) => {
          drawCardToCanvas(context, currentX, columnY, EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT, card, card ? resolvedImageByCardId.get(card.id) : null);
          currentX += EXPORT_CARD_WIDTH + EXPORT_CARD_GAP;
        });
        columnY += EXPORT_CARD_HEIGHT + EXPORT_ROW_GAP;
      });
    });

    const blob = await canvasToBlobByFormat(canvas, format);
    const blobUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadLink.href = blobUrl;
    downloadLink.download = `tarot-house-of-cards-${stamp}.${exportFormat.extension}`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  function appendHouseMinorRow(columnEl, cardLookupMap, numbers, suit, elements) {
    const rowEl = document.createElement("div");
    rowEl.className = "tarot-house-row";

    numbers.forEach((rankNumber) => {
      const cardName = buildMinorCardName(rankNumber, suit);
      const card = findCardByLookupName(cardLookupMap, cardName);
      rowEl.appendChild(createHouseCardButton(card, elements));
    });

    columnEl.appendChild(rowEl);
  }

  function appendHouseCourtRow(columnEl, cardLookupMap, rank, elements) {
    const rowEl = document.createElement("div");
    rowEl.className = "tarot-house-row";

    HOUSE_MIDDLE_SUITS.forEach((suit) => {
      const cardName = buildCourtCardName(rank, suit);
      const card = findCardByLookupName(cardLookupMap, cardName);
      rowEl.appendChild(createHouseCardButton(card, elements));
    });

    columnEl.appendChild(rowEl);
  }

  function appendHouseTrumpRow(containerEl, trumpNumbers, elements, cards) {
    const rowEl = document.createElement("div");
    rowEl.className = "tarot-house-trump-row";

    (trumpNumbers || []).forEach((trumpNumber) => {
      const card = findMajorCardByTrumpNumber(cards, trumpNumber);
      rowEl.appendChild(createHouseCardButton(card, elements));
    });

    containerEl.appendChild(rowEl);
  }

  function render(elements) {
    if (!elements?.tarotHouseOfCardsEl) {
      return;
    }

    const cards = config.getCards();
    disconnectHouseImageObserver();
    config.clearChildren(elements.tarotHouseOfCardsEl);
    const cardLookupMap = getCardLookupMap(cards);

    const trumpSectionEl = document.createElement("div");
    trumpSectionEl.className = "tarot-house-trumps";
    HOUSE_TRUMP_ROWS.forEach((trumpRow) => {
      appendHouseTrumpRow(trumpSectionEl, trumpRow, elements, cards);
    });

    const bottomGridEl = document.createElement("div");
    bottomGridEl.className = "tarot-house-bottom-grid";

    const leftColumnEl = document.createElement("div");
    leftColumnEl.className = "tarot-house-column";
    HOUSE_MINOR_NUMBER_BANDS.forEach((numbers, rowIndex) => {
      appendHouseMinorRow(leftColumnEl, cardLookupMap, numbers, HOUSE_LEFT_SUITS[rowIndex], elements);
    });

    const middleColumnEl = document.createElement("div");
    middleColumnEl.className = "tarot-house-column";
    HOUSE_MIDDLE_RANKS.forEach((rank) => {
      appendHouseCourtRow(middleColumnEl, cardLookupMap, rank, elements);
    });

    const rightColumnEl = document.createElement("div");
    rightColumnEl.className = "tarot-house-column";
    HOUSE_MINOR_NUMBER_BANDS.forEach((numbers, rowIndex) => {
      appendHouseMinorRow(rightColumnEl, cardLookupMap, numbers, HOUSE_RIGHT_SUITS[rowIndex], elements);
    });

    bottomGridEl.append(leftColumnEl, middleColumnEl, rightColumnEl);
    elements.tarotHouseOfCardsEl.append(trumpSectionEl, bottomGridEl);
    updateSelection(elements);
  }

  window.TarotHouseUi = {
    init,
    render,
    updateSelection,
    exportImage,
    isExportFormatSupported
  };
})();