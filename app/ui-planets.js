(function () {
  "use strict";

  const { getTarotCardDisplayName, getTarotCardSearchAliases } = window.TarotCardImages || {};
  const planetReferenceBuilders = window.PlanetReferenceBuilders || {};

  if (
    typeof planetReferenceBuilders.buildMonthReferencesByPlanet !== "function"
    || typeof planetReferenceBuilders.buildCubePlacementsByPlanet !== "function"
  ) {
    throw new Error("PlanetReferenceBuilders module must load before ui-planets.js");
  }

  const state = {
    initialized: false,
    entries: [],
    filteredEntries: [],
    searchQuery: "",
    selectedId: "",
    kabbalahTargetsByPlanetId: {},
    monthRefsByPlanetId: new Map(),
    cubePlacementsByPlanetId: new Map(),
    hexagramsByInfluence: new Map()
  };
  let detailNavigator = null;

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function normalizePlanetToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  function toPlanetId(value) {
    const token = normalizePlanetToken(value);
    if (!token) return null;

    if (token === "sun") return "sol";
    if (token === "moon") return "luna";
    if (["saturn", "jupiter", "mars", "sol", "venus", "mercury", "luna"].includes(token)) {
      return token;
    }
    return null;
  }

  function appendKabbalahTarget(map, planetId, target) {
    if (!planetId || !target) return;
    if (!map[planetId]) map[planetId] = [];
    const key = `${target.kind}:${target.number}`;
    if (map[planetId].some((entry) => `${entry.kind}:${entry.number}` === key)) return;
    map[planetId].push(target);
  }

  function buildKabbalahTargetsByPlanet(magickDataset) {
    const tree = magickDataset?.grouped?.kabbalah?.["kabbalah-tree"];
    const map = {};
    if (!tree) return map;

    (tree.sephiroth || []).forEach((seph) => {
      const planetId = toPlanetId(seph?.planet);
      if (!planetId) return;
      appendKabbalahTarget(map, planetId, {
        kind: "sephirah",
        number: seph.number,
        label: `Sephirah ${seph.number} · ${seph.name}`
      });
    });

    (tree.paths || []).forEach((path) => {
      if (path?.astrology?.type !== "planet") return;
      const planetId = toPlanetId(path?.astrology?.name);
      if (!planetId) return;
      appendKabbalahTarget(map, planetId, {
        kind: "path",
        number: path.pathNumber,
        label: `Path ${path.pathNumber} · ${path?.tarot?.card || path?.hebrewLetter?.transliteration || ""}`.trim()
      });
    });

    return map;
  }

  function getElements() {
    return {
      planetSectionEl: document.getElementById("planet-section"),
      planetCardListEl: document.getElementById("planet-card-list"),
      planetSearchInputEl: document.getElementById("planet-search-input"),
      planetSearchClearEl: document.getElementById("planet-search-clear"),
      planetCountEl: document.getElementById("planet-card-count"),
      planetDetailNameEl: document.getElementById("planet-detail-name"),
      planetDetailTypeEl: document.getElementById("planet-detail-type"),
      planetDetailPrevEl: document.getElementById("planet-detail-prev"),
      planetDetailPositionEl: document.getElementById("planet-detail-position"),
      planetDetailNextEl: document.getElementById("planet-detail-next"),
      planetDetailSummaryEl: document.getElementById("planet-detail-summary"),
      planetDetailFactsEl: document.getElementById("planet-detail-facts"),
      planetDetailAtmosphereEl: document.getElementById("planet-detail-atmosphere"),
      planetDetailNotableEl: document.getElementById("planet-detail-notable"),
      planetDetailCorrespondenceEl: document.getElementById("planet-detail-correspondence")
    };
  }

  function normalizeSearchValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function buildPlanetSearchText(entry) {
    const correspondence = entry?.correspondence || {};
    const factValues = buildFactRows(entry).map(([, value]) => String(value || ""));
    const tarotAliases = correspondence?.tarot?.majorArcana && typeof getTarotCardSearchAliases === "function"
      ? getTarotCardSearchAliases(correspondence.tarot.majorArcana)
      : [];
    const rawNumbers = [
      entry?.meanDistanceFromSun?.kmMillions,
      entry?.meanDistanceFromSun?.au,
      entry?.orbitalPeriod?.days,
      entry?.orbitalPeriod?.years,
      entry?.rotationPeriodHours,
      entry?.radiusKm,
      entry?.diameterKm,
      entry?.massKg,
      entry?.gravityMs2,
      entry?.escapeVelocityKms,
      entry?.axialTiltDeg,
      entry?.averageTempC,
      entry?.moons
    ]
      .filter((value) => Number.isFinite(value))
      .map((value) => String(value));

    const parts = [
      entry?.name,
      entry?.symbol,
      entry?.classification,
      entry?.summary,
      entry?.atmosphere,
      ...(Array.isArray(entry?.notableFacts) ? entry.notableFacts : []),
      ...factValues,
      ...rawNumbers,
      correspondence?.name,
      correspondence?.symbol,
      correspondence?.weekday,
      correspondence?.tarot?.majorArcana,
      ...tarotAliases,
      {
        type: "planet",
        id: entry?.id,
        label: entry?.name,
        data: {
          planetId: entry?.id,
          weekday: correspondence?.weekday,
          tarot: correspondence?.tarot?.majorArcana
        }
      }
    ];

    if (typeof window.TarotSearchText?.buildSearchText === "function") {
      return window.TarotSearchText.buildSearchText(parts);
    }

    return normalizeSearchValue(parts.filter(Boolean).join(" "));
  }

  function applySearchFilter(elements) {
    const query = normalizeSearchValue(state.searchQuery);
    state.filteredEntries = query
      ? state.entries.filter((entry) => buildPlanetSearchText(entry).includes(query))
      : [...state.entries];

    if (elements?.planetSearchClearEl) {
      elements.planetSearchClearEl.disabled = !query;
    }

    renderList(elements);

    if (!state.filteredEntries.some((entry) => entry.id === state.selectedId)) {
      if (state.filteredEntries.length > 0) {
        selectById(state.filteredEntries[0].id, elements);
      } else {
        syncDetailNavigation(elements);
      }
      return;
    }

    updateSelection(elements);
    syncDetailNavigation(elements);
  }

  function clearChildren(element) {
    if (element) {
      element.replaceChildren();
    }
  }

  function toNumber(value) {
    return Number.isFinite(value) ? value : null;
  }

  function formatNumber(value, maximumFractionDigits = 2) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits,
      minimumFractionDigits: 0
    }).format(value);
  }

  function formatSignedHours(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    const absValue = Math.abs(value);
    const formatted = `${formatNumber(absValue, 2)} h`;
    return value < 0 ? `${formatted} (retrograde)` : formatted;
  }

  function formatMass(value) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    return value.toExponential(3).replace("e+", " × 10^") + " kg";
  }

  function buildFactRows(entry) {
    return [
      ["Mean distance from Sun", Number.isFinite(entry?.meanDistanceFromSun?.kmMillions) && Number.isFinite(entry?.meanDistanceFromSun?.au)
        ? `${formatNumber(entry.meanDistanceFromSun.kmMillions, 1)} million km (${formatNumber(entry.meanDistanceFromSun.au, 3)} AU)`
        : "--"],
      ["Orbital period", Number.isFinite(entry?.orbitalPeriod?.days) && Number.isFinite(entry?.orbitalPeriod?.years)
        ? `${formatNumber(entry.orbitalPeriod.days, 2)} days (${formatNumber(entry.orbitalPeriod.years, 3)} years)`
        : "--"],
      ["Rotation period", formatSignedHours(toNumber(entry?.rotationPeriodHours))],
      ["Radius", Number.isFinite(entry?.radiusKm) ? `${formatNumber(entry.radiusKm, 1)} km` : "--"],
      ["Diameter", Number.isFinite(entry?.diameterKm) ? `${formatNumber(entry.diameterKm, 1)} km` : "--"],
      ["Mass", formatMass(toNumber(entry?.massKg))],
      ["Surface gravity", Number.isFinite(entry?.gravityMs2) ? `${formatNumber(entry.gravityMs2, 3)} m/s²` : "--"],
      ["Escape velocity", Number.isFinite(entry?.escapeVelocityKms) ? `${formatNumber(entry.escapeVelocityKms, 2)} km/s` : "--"],
      ["Axial tilt", Number.isFinite(entry?.axialTiltDeg) ? `${formatNumber(entry.axialTiltDeg, 2)}°` : "--"],
      ["Average temperature", Number.isFinite(entry?.averageTempC) ? `${formatNumber(entry.averageTempC, 0)} °C` : "--"],
      ["Moons", Number.isFinite(entry?.moons) ? formatNumber(entry.moons, 0) : "--"]
    ];
  }

  function getDisplayTarotName(cardName, trumpNumber) {
    if (!cardName) {
      return "";
    }

    if (typeof getTarotCardDisplayName !== "function") {
      return cardName;
    }

    if (Number.isFinite(Number(trumpNumber))) {
      return getTarotCardDisplayName(cardName, { trumpNumber: Number(trumpNumber) }) || cardName;
    }

    return getTarotCardDisplayName(cardName) || cardName;
  }

  function appendInlineParts(target, parts) {
    (Array.isArray(parts) ? parts : []).forEach((part) => {
      if (part instanceof Node) {
        target.appendChild(part);
        return;
      }

      const text = String(part ?? "");
      if (text) {
        target.appendChild(document.createTextNode(text));
      }
    });
  }

  function createInlineButton(label, onActivate) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-inline-link";
    button.textContent = String(label || "—");
    button.addEventListener("click", () => {
      onActivate?.();
    });
    return button;
  }

  function appendInlineLine(containerEl, prefix, parts) {
    const line = document.createElement("p");
    line.className = "body-text detail-inline-value";
    if (prefix) {
      line.appendChild(document.createTextNode(prefix));
    }
    appendInlineParts(line, parts);
    containerEl.appendChild(line);
  }

  function renderCorrespondence(entry, containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    const correspondence = entry?.correspondence;

    if (!correspondence || typeof correspondence !== "object") {
      const fallback = document.createElement("span");
      fallback.className = "body-text";
      fallback.textContent = "No day correspondence in current local dataset.";
      containerEl.appendChild(fallback);
      return;
    }

    const symbol  = correspondence?.symbol  || "";
    const weekday = correspondence?.weekday || "";
    const arcana  = correspondence?.tarot?.majorArcana || "";
    const trumpNo = correspondence?.tarot?.number;
    const arcanaLabel = getDisplayTarotName(arcana, trumpNo);

    // Symbol + weekday line
    if (symbol || weekday) {
      const line = document.createElement("span");
      line.className = "body-text";
      line.textContent = [symbol, weekday].filter(Boolean).join(" \u00b7 ");
      containerEl.appendChild(line);
    }

    if (arcana && hasTarotAccess()) {
      const btn = createInlineButton(
        trumpNo != null ? `${arcanaLabel} · Trump ${trumpNo}` : arcanaLabel,
        () => {
          document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
            detail: { trumpNumber: trumpNo ?? null, cardName: arcana }
          }));
        }
      );
      btn.title = "Open in Tarot section";
      appendInlineLine(containerEl, "Tarot ", [btn]);
    }

    const planetId = toPlanetId(correspondence?.id || entry?.id || entry?.name) ||
      normalizePlanetToken(correspondence?.id || entry?.id || entry?.name);
    const kabbalahTargets = state.kabbalahTargetsByPlanetId[planetId] || [];
    if (kabbalahTargets.length) {
      const parts = [];
      kabbalahTargets.forEach((target, index) => {
        if (index > 0) {
          parts.push(", ");
        }
        parts.push(createInlineButton(target.label, () => {
          document.dispatchEvent(new CustomEvent("nav:kabbalah-path", {
            detail: { pathNo: Number(target.number) }
          }));
        }));
      });
      appendInlineLine(containerEl, "Kabbalah ", parts);
    }

    const monthRefs = state.monthRefsByPlanetId.get(planetId) || [];
    if (monthRefs.length) {
      const parts = [];
      monthRefs.forEach((month, index) => {
        if (index > 0) {
          parts.push(", ");
        }
        parts.push(createInlineButton(month.label || month.name, () => {
          document.dispatchEvent(new CustomEvent("nav:calendar-month", {
            detail: { monthId: month.id }
          }));
        }));
      });
      appendInlineLine(containerEl, "Calendar months ", parts);
    }

    const cubePlacements = state.cubePlacementsByPlanetId.get(planetId) || [];
    if (cubePlacements.length) {
      const parts = [];
      cubePlacements.forEach((placement, index) => {
        if (index > 0) {
          parts.push(", ");
        }
        parts.push(createInlineButton(placement.label, () => {
          document.dispatchEvent(new CustomEvent("nav:cube", {
            detail: {
              planetId,
              wallId: placement.wallId,
              edgeId: placement.edgeId
            }
          }));
        }));
      });
      appendInlineLine(containerEl, "Cube placements ", parts);
    }

    const planetName = String(correspondence?.name || entry?.name || "").trim();
    const ichingInfluence = planetName.toLowerCase();
    const ichingHexagrams = state.hexagramsByInfluence.get(ichingInfluence) || [];
    if (ichingHexagrams.length) {
      const parts = [];
      ichingHexagrams.forEach((hx, index) => {
        if (index > 0) {
          parts.push(", ");
        }
        parts.push(createInlineButton(
          `#${hx.number} ${hx.name}`,
          () => {
            document.dispatchEvent(new CustomEvent("nav:iching", {
              detail: { hexagramNumber: hx.number }
            }));
          }
        ));
      });
      appendInlineLine(containerEl, "I Ching ", parts);
    }
  }

  function renderDetail(entry, elements) {
    if (!entry || !elements) {
      return;
    }

    if (elements.planetDetailNameEl) {
      const symbol = entry.symbol ? `${entry.symbol} ` : "";
      elements.planetDetailNameEl.textContent = `${symbol}${entry.name || "--"}`;
    }

    if (elements.planetDetailTypeEl) {
      elements.planetDetailTypeEl.textContent = entry.classification || "--";
    }

    if (elements.planetDetailSummaryEl) {
      elements.planetDetailSummaryEl.textContent = entry.summary || "--";
    }

    clearChildren(elements.planetDetailFactsEl);
    buildFactRows(entry).forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "planet-fact-row";

      const labelEl = document.createElement("span");
      labelEl.className = "planet-fact-label";
      labelEl.textContent = label;

      const valueEl = document.createElement("span");
      valueEl.className = "planet-fact-value";
      valueEl.textContent = value;

      row.append(labelEl, valueEl);
      elements.planetDetailFactsEl?.appendChild(row);
    });

    if (elements.planetDetailAtmosphereEl) {
      elements.planetDetailAtmosphereEl.textContent = entry.atmosphere || "--";
    }

    clearChildren(elements.planetDetailNotableEl);
    const notableFacts = Array.isArray(entry.notableFacts) ? entry.notableFacts : [];
    notableFacts.forEach((fact) => {
      const item = document.createElement("li");
      item.textContent = fact;
      elements.planetDetailNotableEl?.appendChild(item);
    });

    if (elements.planetDetailCorrespondenceEl) {
      renderCorrespondence(entry, elements.planetDetailCorrespondenceEl);
    }
  }

  function updateSelection(elements) {
    if (!elements?.planetCardListEl) {
      return;
    }

    const buttons = elements.planetCardListEl.querySelectorAll(".list-item");
    buttons.forEach((button) => {
      const isSelected = button.dataset.planetId === state.selectedId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function getSequenceState() {
    const total = state.filteredEntries.length;
    const currentIndex = state.filteredEntries.findIndex((entry) => entry.id === state.selectedId);

    return {
      total,
      currentIndex,
      previousId: currentIndex > 0 ? state.filteredEntries[currentIndex - 1].id : "",
      nextId: currentIndex >= 0 && currentIndex < total - 1 ? state.filteredEntries[currentIndex + 1].id : ""
    };
  }

  function getDetailNavigator() {
    if (detailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return detailNavigator;
    }

    detailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.planetSectionEl && elements.planetSectionEl.hidden === false),
      getSequenceState,
      getPrevButton: (elements) => elements?.planetDetailPrevEl,
      getNextButton: (elements) => elements?.planetDetailNextEl,
      getPositionEl: (elements) => elements?.planetDetailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          const suffix = state.searchQuery ? " shown" : "";
          return `${currentIndex + 1} of ${total}${suffix}`;
        }

        return total > 0 ? `${total} bodies` : "No bodies";
      },
      selectTarget: (targetId, elements) => {
        selectById(targetId, elements);
        return true;
      },
      afterSelect: (targetId, elements) => {
        scrollEntryIntoView(targetId, elements);
      }
    });

    return detailNavigator;
  }

  function syncDetailNavigation(elements) {
    getDetailNavigator()?.sync(elements);
  }

  function scrollEntryIntoView(id, elements) {
    elements?.planetCardListEl
      ?.querySelector(`[data-planet-id="${id}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function selectAdjacentEntry(offset, elements) {
    return getDetailNavigator()?.step(offset, elements) === true;
  }

  function bindKeyboardNavigation(elements) {
    getDetailNavigator()?.bind(elements);
  }

  function selectById(id, elements) {
    const entry = state.entries.find((planet) => planet.id === id);
    if (!entry) {
      return;
    }

    state.selectedId = entry.id;
    updateSelection(elements);
    renderDetail(entry, elements);
    syncDetailNavigation(elements);
  }

  function renderList(elements) {
    if (!elements?.planetCardListEl) {
      return;
    }

    clearChildren(elements.planetCardListEl);

    state.filteredEntries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item";
      button.dataset.planetId = entry.id;
      button.setAttribute("role", "option");

      const nameEl = document.createElement("span");
      nameEl.className = "list-name";
      const symbol = entry.symbol ? `${entry.symbol} ` : "";
      nameEl.textContent = `${symbol}${entry.name || "--"}`;

      const metaEl = document.createElement("span");
      metaEl.className = "list-meta";
      metaEl.textContent = entry.classification || "--";

      button.append(nameEl, metaEl);
      elements.planetCardListEl.appendChild(button);
    });

    if (elements.planetCountEl) {
      elements.planetCountEl.textContent = state.searchQuery
        ? `${state.filteredEntries.length} of ${state.entries.length} bodies`
        : `${state.entries.length} bodies`;
    }
  }

  function ensurePlanetSection(referenceData, magickDataset = null) {
    if (state.initialized) {
      return;
    }

    const elements = getElements();
    if (!elements.planetCardListEl || !elements.planetDetailNameEl) {
      return;
    }

    const baseList = Array.isArray(referenceData?.planetScience)
      ? referenceData.planetScience
      : [];

    if (baseList.length === 0) {
      if (elements.planetDetailNameEl) {
        elements.planetDetailNameEl.textContent = "Planet data unavailable";
      }
      if (elements.planetDetailSummaryEl) {
        elements.planetDetailSummaryEl.textContent = "Could not load local science facts dataset.";
      }
      return;
    }

    const correspondences = referenceData?.planets && typeof referenceData.planets === "object"
      ? referenceData.planets
      : {};

    const correspondenceByName = Object.values(correspondences).reduce((acc, value) => {
      const key = String(value?.name || "").trim().toLowerCase();
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});

    state.kabbalahTargetsByPlanetId = buildKabbalahTargetsByPlanet(magickDataset);
    state.monthRefsByPlanetId = planetReferenceBuilders.buildMonthReferencesByPlanet({
      referenceData,
      toPlanetId,
      normalizePlanetToken
    });
    state.cubePlacementsByPlanetId = planetReferenceBuilders.buildCubePlacementsByPlanet({
      magickDataset,
      toPlanetId
    });

    state.hexagramsByInfluence.clear();
    const ichingHexagrams = Array.isArray(referenceData?.iChing?.hexagrams) ? referenceData.iChing.hexagrams : [];
    ichingHexagrams.forEach((hx) => {
      const influence = String(hx?.planetaryInfluence || "").trim().toLowerCase();
      if (influence) {
        if (!state.hexagramsByInfluence.has(influence)) {
          state.hexagramsByInfluence.set(influence, []);
        }
        state.hexagramsByInfluence.get(influence).push(hx);
      }
    });

    state.entries = baseList.map((entry) => {
      const byId = correspondences[entry.id] || null;
      const byName = correspondenceByName[String(entry?.name || "").trim().toLowerCase()] || null;
      return {
        ...entry,
        correspondence: byId || byName || null
      };
    });
    state.filteredEntries = [...state.entries];

    renderList(elements);

    if (state.entries.length > 0) {
      selectById(state.entries[0].id, elements);
    }

    elements.planetCardListEl.addEventListener("click", (event) => {
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

      const selectedId = button.dataset.planetId;
      if (!selectedId) {
        return;
      }

      selectById(selectedId, elements);
    });

    if (elements.planetSearchInputEl) {
      elements.planetSearchInputEl.addEventListener("input", () => {
        state.searchQuery = elements.planetSearchInputEl.value || "";
        applySearchFilter(elements);
      });
    }

    if (elements.planetSearchClearEl && elements.planetSearchInputEl) {
      elements.planetSearchClearEl.addEventListener("click", () => {
        elements.planetSearchInputEl.value = "";
        state.searchQuery = "";
        applySearchFilter(elements);
        elements.planetSearchInputEl.focus();
      });
    }

    bindKeyboardNavigation(elements);

    state.initialized = true;
  }

  function selectByPlanetId(planetId) {
    if (!state.initialized) return;
    const el = getElements();
    const needle = String(planetId || "").toLowerCase();
    const entry = state.entries.find(e =>
      String(e.id || "").toLowerCase() === needle ||
      String(e.correspondence?.id || "").toLowerCase() === needle ||
      String(e.name || "").toLowerCase() === needle
    );
    if (!entry) return;
    selectById(entry.id, el);
    scrollEntryIntoView(entry.id, el);
  }

  window.PlanetSectionUi = {
    ensurePlanetSection,
    selectByPlanetId
  };
})();
