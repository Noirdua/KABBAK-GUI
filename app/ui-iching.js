(function () {
  "use strict";

  const iChingReferenceBuilders = window.IChingReferenceBuilders || {};

  if (typeof iChingReferenceBuilders.buildMonthReferencesByHexagram !== "function") {
    throw new Error("IChingReferenceBuilders module must load before ui-iching.js");
  }

  const { getTarotCardSearchAliases } = window.TarotCardImages || {};

  const state = {
    initialized: false,
    hexagrams: [],
    filteredHexagrams: [],
    trigramsByName: {},
    tarotByTrigramName: {},
    monthRefsByHexagramNumber: new Map(),
    searchQuery: "",
    selectedNumber: null
  };

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  const ICHING_PLANET_BY_PLANET_ID = {
    sol: "Sun",
    luna: "Moon",
    mercury: "Mercury",
    venus: "Venus",
    mars: "Mars",
    jupiter: "Jupiter",
    saturn: "Saturn",
    earth: "Earth",
    uranus: "Uranus",
    neptune: "Neptune",
    pluto: "Pluto"
  };

  function getElements() {
    return {
      ichingCardListEl: document.getElementById("iching-card-list"),
      ichingSearchInputEl: document.getElementById("iching-search-input"),
      ichingSearchClearEl: document.getElementById("iching-search-clear"),
      ichingCountEl: document.getElementById("iching-card-count"),
      ichingDetailNameEl: document.getElementById("iching-detail-name"),
      ichingDetailTypeEl: document.getElementById("iching-detail-type"),
      ichingDetailSummaryEl: document.getElementById("iching-detail-summary"),
      ichingDetailJudgementEl: document.getElementById("iching-detail-judgement"),
      ichingDetailImageEl: document.getElementById("iching-detail-image"),
      ichingDetailBinaryEl: document.getElementById("iching-detail-binary"),
      ichingDetailLineEl: document.getElementById("iching-detail-line"),
      ichingDetailKeywordsEl: document.getElementById("iching-detail-keywords"),
      ichingDetailTrigramsEl: document.getElementById("iching-detail-trigrams"),
      ichingDetailPlanetEl: document.getElementById("iching-detail-planet"),
      ichingDetailTarotEl: document.getElementById("iching-detail-tarot"),
      ichingDetailCalendarEl: document.getElementById("iching-detail-calendar")
    };
  }

  function normalizeSearchValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function clearChildren(element) {
    if (element) {
      element.replaceChildren();
    }
  }

  function getTrigramByName(name) {
    const key = normalizeSearchValue(name);
    return key ? state.trigramsByName[key] || null : null;
  }

  function normalizePlanetInfluence(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  function resolveAssociationPlanetInfluence(associations) {
    if (!associations || typeof associations !== "object") {
      return "";
    }

    const explicit = normalizePlanetInfluence(associations.iChingPlanetaryInfluence || associations.planetaryInfluence);
    if (explicit) {
      return explicit;
    }

    const planetId = normalizePlanetInfluence(associations.planetId);
    if (!planetId) {
      return "";
    }

    return normalizePlanetInfluence(ICHING_PLANET_BY_PLANET_ID[planetId]);
  }

  function resolvePlanetId(value) {
    const normalizedValue = normalizePlanetInfluence(value);
    if (!normalizedValue) {
      return "";
    }

    return Object.entries(ICHING_PLANET_BY_PLANET_ID).find(([planetId, label]) => (
      normalizePlanetInfluence(planetId) === normalizedValue
      || normalizePlanetInfluence(label) === normalizedValue
    ))?.[0] || "";
  }

  function getBinaryPattern(value, expectedLength = 0) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    if (/^[01]+$/.test(raw)) {
      if (!expectedLength || raw.length === expectedLength) {
        return raw;
      }
      return "";
    }

    if (/^[|:]+$/.test(raw)) {
      const mapped = raw
        .split("")
        .map((char) => (char === "|" ? "1" : "0"))
        .join("");
      if (!expectedLength || mapped.length === expectedLength) {
        return mapped;
      }
    }

    return "";
  }

  function createLineStack(binaryPattern, variant = "trigram") {
    const container = document.createElement("div");
    container.className = `iching-lines iching-lines-${variant}`;

    binaryPattern.split("").forEach((bit) => {
      const line = document.createElement("div");
      line.className = bit === "1" ? "iching-line is-yang" : "iching-line is-yin";
      container.appendChild(line);
    });

    return container;
  }

  function buildHexagramSearchText(entry) {
    const upper = getTrigramByName(entry?.upperTrigram);
    const lower = getTrigramByName(entry?.lowerTrigram);
    const upperCards = upper ? state.tarotByTrigramName[normalizeSearchValue(upper.name)] || [] : [];
    const lowerCards = lower ? state.tarotByTrigramName[normalizeSearchValue(lower.name)] || [] : [];
    const tarotAliasText = typeof getTarotCardSearchAliases === "function"
      ? [...upperCards, ...lowerCards]
        .flatMap((cardName) => getTarotCardSearchAliases(cardName))
        .join(" ")
      : [...upperCards, ...lowerCards].join(" ");
    const parts = [
      entry?.number,
      entry?.name,
      entry?.chineseName,
      entry?.pinyin,
      entry?.judgement,
      entry?.image,
      entry?.upperTrigram,
      entry?.lowerTrigram,
      entry?.planetaryInfluence,
      entry?.binary,
      entry?.lineDiagram,
      ...(Array.isArray(entry?.keywords) ? entry.keywords : []),
      upper?.name,
      upper?.chineseName,
      upper?.pinyin,
      upper?.element,
      upper?.attribute,
      upper?.binary,
      upper?.description,
      lower?.name,
      lower?.chineseName,
      lower?.pinyin,
      lower?.element,
      lower?.attribute,
      lower?.binary,
      lower?.description,
      upperCards,
      lowerCards,
      tarotAliasText,
      {
        type: "element",
        id: upper?.element,
        label: upper?.element,
        data: { elementId: String(upper?.element || "").toLowerCase() }
      },
      {
        type: "element",
        id: lower?.element,
        label: lower?.element,
        data: { elementId: String(lower?.element || "").toLowerCase() }
      }
    ];

    if (typeof window.TarotSearchText?.buildSearchText === "function") {
      return window.TarotSearchText.buildSearchText(parts);
    }

    return normalizeSearchValue(parts.filter((part) => part !== null && part !== undefined).join(" "));
  }

  function updateSelection(elements) {
    if (!elements?.ichingCardListEl) {
      return;
    }

    const buttons = elements.ichingCardListEl.querySelectorAll(".list-item");
    buttons.forEach((button) => {
      const isSelected = Number(button.dataset.hexagramNumber) === state.selectedNumber;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function renderEmptyDetail(elements, detailName = "No hexagrams found") {
    if (!elements) {
      return;
    }

    if (elements.ichingDetailNameEl) {
      elements.ichingDetailNameEl.textContent = detailName;
    }
    if (elements.ichingDetailTypeEl) {
      elements.ichingDetailTypeEl.textContent = "--";
    }
    if (elements.ichingDetailSummaryEl) {
      elements.ichingDetailSummaryEl.textContent = "--";
    }
    if (elements.ichingDetailJudgementEl) {
      elements.ichingDetailJudgementEl.textContent = "--";
    }
    if (elements.ichingDetailImageEl) {
      elements.ichingDetailImageEl.textContent = "--";
    }
    if (elements.ichingDetailBinaryEl) {
      elements.ichingDetailBinaryEl.textContent = "--";
    }
    if (elements.ichingDetailLineEl) {
      clearChildren(elements.ichingDetailLineEl);
      elements.ichingDetailLineEl.textContent = "--";
    }
    if (elements.ichingDetailPlanetEl) {
      elements.ichingDetailPlanetEl.textContent = "--";
    }
    if (elements.ichingDetailTarotEl) {
      elements.ichingDetailTarotEl.hidden = !hasTarotAccess();
      elements.ichingDetailTarotEl.textContent = hasTarotAccess() ? "--" : "";
    }
    if (elements.ichingDetailCalendarEl) {
      clearChildren(elements.ichingDetailCalendarEl);
      elements.ichingDetailCalendarEl.textContent = "--";
    }

    clearChildren(elements.ichingDetailKeywordsEl);
    clearChildren(elements.ichingDetailTrigramsEl);
  }

  function renderKeywords(entry, elements) {
    clearChildren(elements.ichingDetailKeywordsEl);
    const keywords = Array.isArray(entry?.keywords) ? entry.keywords : [];

    if (!keywords.length) {
      if (elements.ichingDetailKeywordsEl) {
        elements.ichingDetailKeywordsEl.textContent = "--";
      }
      return;
    }

    keywords.forEach((keyword) => {
      const chip = document.createElement("span");
      chip.className = "tarot-keyword-chip";
      chip.textContent = keyword;
      elements.ichingDetailKeywordsEl?.appendChild(chip);
    });
  }

  function createTrigramCard(label, trigram) {
    const card = document.createElement("div");
    card.className = "iching-trigram-card";

    if (!trigram) {
      card.textContent = `${label}: --`;
      return card;
    }

    const title = document.createElement("div");
    title.className = "iching-trigram-title";
    const chinese = trigram.chineseName ? ` (${trigram.chineseName})` : "";
    title.textContent = `${label}: ${trigram.name || "--"}${chinese}`;

    const meta = document.createElement("div");
    meta.className = "iching-trigram-meta";
    const attribute = trigram.attribute || "--";
    const element = trigram.element || "--";
    meta.textContent = `${attribute} · ${element}`;

    const diagram = document.createElement("div");
    diagram.className = "iching-trigram-diagram";
    const binaryPattern = getBinaryPattern(trigram.binary || trigram.lineDiagram, 3);

    if (binaryPattern) {
      const binaryLabel = document.createElement("div");
      binaryLabel.className = "iching-line-label";
      binaryLabel.textContent = binaryPattern;
      diagram.append(binaryLabel, createLineStack(binaryPattern, "trigram"));
    } else {
      diagram.textContent = "--";
    }

    card.append(title, meta, diagram);

    if (trigram.description) {
      const description = document.createElement("div");
      description.className = "body-text";
      description.textContent = trigram.description;
      card.appendChild(description);
    }

    return card;
  }

  function renderTrigrams(entry, elements) {
    clearChildren(elements.ichingDetailTrigramsEl);

    const upper = getTrigramByName(entry?.upperTrigram);
    const lower = getTrigramByName(entry?.lowerTrigram);

    elements.ichingDetailTrigramsEl?.append(
      createTrigramCard("Upper", upper),
      createTrigramCard("Lower", lower)
    );
  }

  function renderTarotCorrespondences(entry, elements) {
    if (!elements?.ichingDetailTarotEl) {
      return;
    }

    if (!hasTarotAccess()) {
      clearChildren(elements.ichingDetailTarotEl);
      elements.ichingDetailTarotEl.hidden = true;
      elements.ichingDetailTarotEl.textContent = "";
      return;
    }

    elements.ichingDetailTarotEl.hidden = false;

    clearChildren(elements.ichingDetailTarotEl);

    const upperKey = normalizeSearchValue(entry?.upperTrigram);
    const lowerKey = normalizeSearchValue(entry?.lowerTrigram);
    const upperCards = upperKey ? state.tarotByTrigramName[upperKey] || [] : [];
    const lowerCards = lowerKey ? state.tarotByTrigramName[lowerKey] || [] : [];

    const upperTrigram = upperKey ? state.trigramsByName[upperKey] : null;
    const lowerTrigram = lowerKey ? state.trigramsByName[lowerKey] : null;
    const upperLabel = upperTrigram?.element || entry?.upperTrigram || "--";
    const lowerLabel = lowerTrigram?.element || entry?.lowerTrigram || "--";

    function buildTarotTarget(cardName) {
      const label = String(cardName || "").trim();
      if (!label) {
        return null;
      }

      const trumpMatch = label.match(/^key\s*(\d{1,2})\s*:/i);
      if (trumpMatch) {
        return {
          label,
          detail: { trumpNumber: Number(trumpMatch[1]) }
        };
      }

      return {
        label,
        detail: { cardName: label }
      };
    }

    function appendTarotGroup(groupLabel, trigramLabel, cards) {
      const group = document.createElement("div");
      group.className = "iching-tarot-group";

      const title = document.createElement("div");
      title.className = "iching-tarot-group-title";
      title.textContent = `${groupLabel} (${trigramLabel}):`;
      group.appendChild(title);

      if (!cards.length) {
        const empty = document.createElement("div");
        empty.className = "body-text";
        empty.textContent = "--";
        group.appendChild(empty);
        elements.ichingDetailTarotEl.appendChild(group);
        return;
      }

      const buttonRow = document.createElement("div");
      buttonRow.className = "body-text detail-inline-value";

      cards.forEach((cardName) => {
        const target = buildTarotTarget(cardName);
        if (!target) {
          return;
        }

        if (buttonRow.childNodes.length) {
          buttonRow.appendChild(document.createTextNode(", "));
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "detail-inline-link";
        button.textContent = target.label;
        button.addEventListener("click", () => {
          document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
            detail: target.detail
          }));
        });
        buttonRow.appendChild(button);
      });

      group.appendChild(buttonRow);
      elements.ichingDetailTarotEl.appendChild(group);
    }

    if (upperKey) {
      appendTarotGroup("Upper", upperLabel, upperCards);
    }
    if (lowerKey) {
      appendTarotGroup("Lower", lowerLabel, lowerCards);
    }

    if (!elements.ichingDetailTarotEl.childElementCount) {
      elements.ichingDetailTarotEl.textContent = "--";
    }
  }

  function renderCalendarMonths(entry, elements) {
    if (!elements?.ichingDetailCalendarEl) {
      return;
    }

    clearChildren(elements.ichingDetailCalendarEl);
    const rows = state.monthRefsByHexagramNumber.get(entry?.number) || [];

    if (!rows.length) {
      elements.ichingDetailCalendarEl.textContent = "--";
      return;
    }

    rows.forEach((month) => {
      if (elements.ichingDetailCalendarEl.childNodes.length) {
        elements.ichingDetailCalendarEl.appendChild(document.createTextNode(", "));
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "detail-inline-link";
      button.textContent = month.label || month.name;
      button.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("nav:calendar-month", {
          detail: { monthId: month.id }
        }));
      });
      elements.ichingDetailCalendarEl.appendChild(button);
    });
  }

  function renderPlanetInfluence(entry, elements) {
    if (!elements?.ichingDetailPlanetEl) {
      return;
    }

    clearChildren(elements.ichingDetailPlanetEl);

    const label = entry?.planetaryInfluence || "--";
    const planetId = resolvePlanetId(entry?.planetaryInfluence)
      || resolvePlanetId(resolveAssociationPlanetInfluence(entry?.associations));

    if (!planetId) {
      elements.ichingDetailPlanetEl.textContent = label;
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-inline-link";
    button.textContent = label;
    button.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("nav:planet", {
        detail: { planetId }
      }));
    });

    elements.ichingDetailPlanetEl.appendChild(button);
  }

  function renderDetail(entry, elements) {
    if (!entry || !elements) {
      return;
    }

    const number = Number.isFinite(entry.number) ? entry.number : "--";
    if (elements.ichingDetailNameEl) {
      elements.ichingDetailNameEl.textContent = `${number} · ${entry.name || "--"}`;
    }

    if (elements.ichingDetailTypeEl) {
      const chinese = entry.chineseName || "--";
      const pinyin = entry.pinyin || "--";
      const upper = entry.upperTrigram || "--";
      const lower = entry.lowerTrigram || "--";
      elements.ichingDetailTypeEl.textContent = `Hexagram · ${chinese} · ${pinyin} · ${upper}/${lower}`;
    }

    if (elements.ichingDetailSummaryEl) {
      elements.ichingDetailSummaryEl.textContent = entry.judgement || "--";
    }

    if (elements.ichingDetailJudgementEl) {
      elements.ichingDetailJudgementEl.textContent = entry.judgement || "--";
    }

    if (elements.ichingDetailImageEl) {
      elements.ichingDetailImageEl.textContent = entry.image || "--";
    }

    if (elements.ichingDetailBinaryEl) {
      const binary = entry.binary || "--";
      elements.ichingDetailBinaryEl.textContent = `Binary: ${binary}`;
    }

    if (elements.ichingDetailLineEl) {
      clearChildren(elements.ichingDetailLineEl);
      const linePattern = getBinaryPattern(entry.binary, 6) || getBinaryPattern(entry.lineDiagram, 6);
      if (linePattern) {
        elements.ichingDetailLineEl.appendChild(createLineStack(linePattern, "hexagram"));
      } else {
        elements.ichingDetailLineEl.textContent = "--";
      }
    }

    renderPlanetInfluence(entry, elements);

    renderKeywords(entry, elements);
    renderTrigrams(entry, elements);
    renderTarotCorrespondences(entry, elements);
    renderCalendarMonths(entry, elements);
  }

  function selectByNumber(number, elements) {
    const numeric = Number(number);
    if (!Number.isFinite(numeric)) {
      return;
    }

    const entry = state.hexagrams.find((hexagram) => hexagram.number === numeric);
    if (!entry) {
      return;
    }

    state.selectedNumber = entry.number;
    updateSelection(elements);
    renderDetail(entry, elements);
  }

  function renderList(elements) {
    if (!elements?.ichingCardListEl) {
      return;
    }

    clearChildren(elements.ichingCardListEl);

    state.filteredHexagrams.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item";
      button.dataset.hexagramNumber = String(entry.number);
      button.setAttribute("role", "option");

      const nameEl = document.createElement("span");
      nameEl.className = "list-name";
      const number = Number.isFinite(entry.number) ? `#${entry.number} ` : "";
      nameEl.textContent = `${number}${entry.name || "--"}`;

      const metaEl = document.createElement("span");
      metaEl.className = "list-meta";
      const upper = entry.upperTrigram || "--";
      const lower = entry.lowerTrigram || "--";
      metaEl.textContent = `${upper}/${lower} · ${entry.planetaryInfluence || "--"}`;

      button.append(nameEl, metaEl);
      elements.ichingCardListEl.appendChild(button);
    });

    if (elements.ichingCountEl) {
      elements.ichingCountEl.textContent = state.searchQuery
        ? `${state.filteredHexagrams.length} of ${state.hexagrams.length} hexagrams`
        : `${state.hexagrams.length} hexagrams`;
    }
  }

  function applySearchFilter(elements) {
    const query = normalizeSearchValue(state.searchQuery);
    state.filteredHexagrams = query
      ? state.hexagrams.filter((entry) => buildHexagramSearchText(entry).includes(query))
      : [...state.hexagrams];

    if (elements?.ichingSearchClearEl) {
      elements.ichingSearchClearEl.disabled = !query;
    }

    renderList(elements);

    if (!state.filteredHexagrams.some((entry) => entry.number === state.selectedNumber)) {
      if (state.filteredHexagrams.length > 0) {
        selectByNumber(state.filteredHexagrams[0].number, elements);
      } else {
        state.selectedNumber = null;
        updateSelection(elements);
        renderEmptyDetail(elements);
      }
      return;
    }

    updateSelection(elements);
  }

  function ensureIChingSection(referenceData) {
    const elements = getElements();

    if (state.initialized) {
      state.monthRefsByHexagramNumber = iChingReferenceBuilders.buildMonthReferencesByHexagram({
        referenceData,
        hexagrams: state.hexagrams,
        normalizePlanetInfluence,
        resolveAssociationPlanetInfluence
      });
      const selected = state.hexagrams.find((hexagram) => hexagram.number === state.selectedNumber);
      if (selected) {
        renderDetail(selected, elements);
      }
      return;
    }

    if (!elements.ichingCardListEl || !elements.ichingDetailNameEl) {
      return;
    }

    const iChing = referenceData?.iChing;
    const trigrams = Array.isArray(iChing?.trigrams) ? iChing.trigrams : [];
    const hexagrams = Array.isArray(iChing?.hexagrams) ? iChing.hexagrams : [];
    const correspondences = iChing?.correspondences;

    if (!hexagrams.length) {
      renderEmptyDetail(elements, "I Ching data unavailable");
      return;
    }

    state.trigramsByName = trigrams.reduce((acc, trigram) => {
      const key = normalizeSearchValue(trigram?.name);
      if (key) {
        acc[key] = trigram;
      }
      return acc;
    }, {});

    const tarotToTrigram = Array.isArray(correspondences?.tarotToTrigram)
      ? correspondences.tarotToTrigram
      : [];

    state.tarotByTrigramName = tarotToTrigram.reduce((acc, row) => {
      const key = normalizeSearchValue(row?.trigram);
      const tarotCard = String(row?.tarot || "").trim();
      if (!key || !tarotCard) {
        return acc;
      }
      if (!Array.isArray(acc[key])) {
        acc[key] = [];
      }
      if (!acc[key].includes(tarotCard)) {
        acc[key].push(tarotCard);
      }
      return acc;
    }, {});

    state.hexagrams = [...hexagrams]
      .map((entry) => ({
        ...entry,
        number: Number(entry?.number)
      }))
      .filter((entry) => Number.isFinite(entry.number))
      .sort((a, b) => a.number - b.number);

    state.monthRefsByHexagramNumber = iChingReferenceBuilders.buildMonthReferencesByHexagram({
      referenceData,
      hexagrams: state.hexagrams,
      normalizePlanetInfluence,
      resolveAssociationPlanetInfluence
    });

    state.filteredHexagrams = [...state.hexagrams];
    renderList(elements);

    if (state.hexagrams.length > 0) {
      selectByNumber(state.hexagrams[0].number, elements);
    }

    elements.ichingCardListEl.addEventListener("click", (event) => {
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

      const selectedNumber = button.dataset.hexagramNumber;
      if (!selectedNumber) {
        return;
      }

      selectByNumber(selectedNumber, elements);
    });

    if (elements.ichingSearchInputEl) {
      elements.ichingSearchInputEl.addEventListener("input", () => {
        state.searchQuery = elements.ichingSearchInputEl.value || "";
        applySearchFilter(elements);
      });
    }

    if (elements.ichingSearchClearEl && elements.ichingSearchInputEl) {
      elements.ichingSearchClearEl.addEventListener("click", () => {
        elements.ichingSearchInputEl.value = "";
        state.searchQuery = "";
        applySearchFilter(elements);
        elements.ichingSearchInputEl.focus();
      });
    }

    state.initialized = true;
  }

  function selectByHexagramNumber(number) {
    if (!state.initialized) {
      return false;
    }

    const elements = getElements();
    const numeric = Number(number);
    if (!Number.isFinite(numeric)) {
      return false;
    }

    const entry = state.hexagrams.find((hexagram) => hexagram.number === numeric);
    if (!entry) {
      return false;
    }

    selectByNumber(entry.number, elements);
    elements.ichingCardListEl
      ?.querySelector(`[data-hexagram-number="${entry.number}"]`)
      ?.scrollIntoView({ block: "nearest" });
    return true;
  }

  function selectByPlanetaryInfluence(planetaryInfluence) {
    if (!state.initialized) {
      return false;
    }

    const targetInfluence = normalizePlanetInfluence(planetaryInfluence);
    if (!targetInfluence) {
      return false;
    }

    const entry = state.hexagrams.find((hexagram) =>
      normalizePlanetInfluence(hexagram?.planetaryInfluence) === targetInfluence
    );

    if (!entry) {
      return false;
    }

    return selectByHexagramNumber(entry.number);
  }

  window.IChingSectionUi = {
    ensureIChingSection,
    selectByHexagramNumber,
    selectByPlanetaryInfluence
  };
})();
