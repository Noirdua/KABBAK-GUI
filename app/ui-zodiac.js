/* ui-zodiac.js — Zodiac sign browser section */
(function () {
  "use strict";

  const { html, raw } = window.HtmlSafe;

  const zodiacReferenceBuilders = window.ZodiacReferenceBuilders || {};

  if (
    typeof zodiacReferenceBuilders.buildCubeSignPlacements !== "function"
    || typeof zodiacReferenceBuilders.buildMonthReferencesBySign !== "function"
    || typeof zodiacReferenceBuilders.cubePlacementLabel !== "function"
    || typeof zodiacReferenceBuilders.formatDateRange !== "function"
  ) {
    throw new Error("ZodiacReferenceBuilders module must load before ui-zodiac.js");
  }

  const ELEMENT_STYLE = {
    fire:  { emoji: "🔥", badge: "zod-badge--fire",  label: "Fire"  },
    earth: { emoji: "🌍", badge: "zod-badge--earth", label: "Earth" },
    air:   { emoji: "💨", badge: "zod-badge--air",   label: "Air"   },
    water: { emoji: "💧", badge: "zod-badge--water", label: "Water" }
  };

  const PLANET_SYMBOLS = {
    saturn: "♄︎", jupiter: "♃︎", mars: "♂︎", sol: "☉︎",
    venus: "♀︎", mercury: "☿︎", luna: "☾︎"
  };

  const state = {
    initialized: false,
    entries: [],
    filteredEntries: [],
    selectedId: null,
    searchQuery: "",
    kabPaths: [],
    decansBySign: {},
    monthRefsBySignId: new Map(),
    cubePlacementBySignId: new Map()
  };
  let detailNavigator = null;

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  // ── Elements ──────────────────────────────────────────────────────────
  function getElements() {
    return {
      sectionEl:     document.getElementById("zodiac-section"),
      listEl:        document.getElementById("zodiac-sign-list"),
      countEl:       document.getElementById("zodiac-sign-count"),
      searchEl:      document.getElementById("zodiac-search-input"),
      searchClearEl: document.getElementById("zodiac-search-clear"),
      detailNameEl:  document.getElementById("zodiac-detail-name"),
      detailSubEl:   document.getElementById("zodiac-detail-sub"),
      detailPrevEl:  document.getElementById("zodiac-detail-prev"),
      detailPositionEl: document.getElementById("zodiac-detail-position"),
      detailNextEl:  document.getElementById("zodiac-detail-next"),
      detailBodyEl:  document.getElementById("zodiac-detail-body")
    };
  }

  // ── Normalise ─────────────────────────────────────────────────────────
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  }

  function cap(s) {
    return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
  }

  function normalizeHebrewLetterId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildSearchText(sign) {
    const searchTextUi = window.TarotSearchText;
    if (typeof searchTextUi?.buildSearchText === "function") {
      return searchTextUi.buildSearchText(
        sign.name?.en,
        sign.meaning?.en,
        sign.elementId,
        sign.quadruplicity,
        sign.planetId,
        sign.id,
        {
          type: "modality",
          id: sign.quadruplicity,
          label: `Modality: ${cap(sign.quadruplicity)}`,
          data: {
            modality: sign.quadruplicity,
            elementId: sign.elementId,
            planetId: sign.planetId
          }
        },
        {
          type: "element",
          id: sign.elementId,
          label: `Element: ${cap(sign.elementId)}`,
          data: { elementId: sign.elementId }
        },
        {
          type: "planet",
          id: sign.planetId,
          label: `Planet: ${cap(sign.planetId)}`,
          data: { planetId: sign.planetId }
        }
      );
    }

    return norm([
      sign.name?.en, sign.meaning?.en, sign.elementId, sign.quadruplicity,
      sign.planetId, sign.id, "modality", "element"
    ].join(" "));
  }

  function formatDateRange(rulesFrom) {
    return zodiacReferenceBuilders.formatDateRange(rulesFrom);
  }

  function buildMonthReferencesBySign(referenceData) {
    return zodiacReferenceBuilders.buildMonthReferencesBySign(referenceData);
  }

  function buildCubeSignPlacements(magickDataset) {
    return zodiacReferenceBuilders.buildCubeSignPlacements(magickDataset);
  }

  function cubePlacementLabel(placement) {
    return zodiacReferenceBuilders.cubePlacementLabel(placement);
  }

  // ── List ──────────────────────────────────────────────────────────────
  function applyFilter() {
    const q = norm(state.searchQuery);
    state.filteredEntries = q
      ? state.entries.filter((s) => buildSearchText(s).includes(q))
      : [...state.entries];
  }

  function renderList(els) {
    if (!els.listEl) return;
    els.listEl.innerHTML = "";
    state.filteredEntries.forEach((sign) => {
      const active = sign.id === state.selectedId;
      const el = document.createElement("div");
      el.className = "list-item" + (active ? " is-selected" : "");
      el.setAttribute("role", "option");
      el.setAttribute("aria-selected", active ? "true" : "false");
      el.dataset.id = sign.id;

      const elemStyle = ELEMENT_STYLE[sign.elementId] || {};
      el.innerHTML = html`
        <div class="zod-list-row">
          <span class="zod-list-symbol">${sign.symbol || "?"}</span>
          <span class="list-name">${sign.name?.en || sign.id}</span>
          <span class="zod-list-elem ${elemStyle.badge || ""}">${elemStyle.emoji || ""}</span>
        </div>
        <div class="list-meta">${cap(sign.elementId)} · ${cap(sign.quadruplicity)} · ${cap(sign.planetId)}</div>
      `;
      el.addEventListener("click", () => { selectById(sign.id, els); });
      els.listEl.appendChild(el);
    });

    if (els.countEl) {
      els.countEl.textContent = state.searchQuery
        ? `${state.filteredEntries.length} of ${state.entries.length} signs`
        : `${state.entries.length} signs`;
    }
  }

  // ── Detail ────────────────────────────────────────────────────────────
  function renderDetail(sign, els) {
    if (!els.detailNameEl) return;

    const elemStyle = ELEMENT_STYLE[sign.elementId] || {};
    const polarity  = ["fire", "air"].includes(sign.elementId) ? "Masculine / Positive" : "Feminine / Negative";
    const kabPath   = state.kabPaths.find(
      (p) => p.astrology?.type === "zodiac" &&
             p.astrology?.name?.toLowerCase() === sign.id
    );
    const decans    = state.decansBySign[sign.id] || [];
    const monthRefs = state.monthRefsBySignId.get(String(sign.id || "").toLowerCase()) || [];
    const cubePlacement = state.cubePlacementBySignId.get(String(sign.id || "").toLowerCase()) || null;

    // Heading
    els.detailNameEl.textContent = sign.symbol || sign.id;
    els.detailSubEl.textContent  = `${sign.name?.en || ""} — ${sign.meaning?.en || ""}`;

    const sections = [];

    // ── Sign Details ──────────────────────────────────────────────────
    const modalityId = String(sign.quadruplicity || "").toLowerCase() === "kerubic"
      ? "fixed"
      : String(sign.quadruplicity || "").toLowerCase();
    const modalityLabel = modalityId === "fixed"
      ? "Fixed"
      : cap(sign.quadruplicity);
    const elemBadge = html`<button class="detail-inline-link zod-badge ${elemStyle.badge || ""}" data-nav="element" data-element-id="${sign.elementId}">${elemStyle.emoji || ""} ${cap(sign.elementId)}</button>`;
    const quadBadge = html`<button class="detail-inline-link zod-badge zod-badge--quad" data-nav="modality" data-modality-id="${modalityId}">${modalityLabel}</button>`;
    sections.push(html`<div class="meta-card">
      <strong>Sign Details</strong>
      <div class="body-text">
        <dl class="alpha-dl">
          <dt>Symbol</dt><dd>${sign.symbol || "—"}</dd>
          <dt>Meaning</dt><dd>${sign.meaning?.en || "—"}</dd>
          <dt>Element</dt><dd>${elemBadge}</dd>
          <dt>Modality</dt><dd>${quadBadge}</dd>
          <dt>Polarity</dt><dd>${polarity}</dd>
          <dt>Dates</dt><dd>${formatDateRange(sign.rulesFrom)}</dd>
          <dt>Position</dt><dd>#${sign.no} of 12</dd>
        </dl>
      </div>
    </div>`);

    // ── Ruling Planet ─────────────────────────────────────────────────
    const planetSym = PLANET_SYMBOLS[sign.planetId] || "";
    sections.push(html`<div class="meta-card">
      <strong>Ruling Planet</strong>
      <div class="body-text">
        <p style="font-size:22px;margin:0">${planetSym} <button class="detail-inline-link" data-nav="planet" data-planet-id="${sign.planetId}">${cap(sign.planetId)}</button></p>
      </div>
    </div>`);

    if (cubePlacement) {
      sections.push(html`<div class="meta-card">
        <strong>Cube of Space</strong>
        <div class="body-text">This sign appears at <button class="detail-inline-link" data-nav="cube-sign" data-sign-id="${sign.id}" data-wall-id="${cubePlacement.wallId}" data-edge-id="${cubePlacement.edgeId}">${cubePlacementLabel(cubePlacement)}</button>.</div>
      </div>`);
    }

    // ── Kabbalah Path + Trump ─────────────────────────────────────────
    const tarotAccessEnabled = hasTarotAccess();

    if (kabPath) {
      const hl = kabPath.hebrewLetter || {};
      const hebrewLetterId = normalizeHebrewLetterId(hl.transliteration);
      const hebrewLetterLabel = hl.transliteration || hl.char || "";
      sections.push(html`<div class="meta-card">
        <strong>${tarotAccessEnabled ? "Kabbalah & Major Arcana" : "Kabbalah Path"}</strong>
        <div class="body-text">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <span class="zod-hebrew-glyph">${hl.char || ""}</span>
            <div>
              <div style="font-weight:600">${hebrewLetterId ? html`<button class="detail-inline-link" data-nav="alphabet" data-hebrew-letter-id="${hebrewLetterId}">${hebrewLetterLabel}</button>` : hebrewLetterLabel}${hl.meaning ? ` (${hl.meaning})` : ""}</div>
              <div class="list-meta">${cap(hl.letterType || "")} letter · <button class="detail-inline-link" data-nav="kab-path" data-path-number="${kabPath.pathNumber}">Path ${kabPath.pathNumber}</button></div>
            </div>
          </div>
          <dl class="alpha-dl">
            ${tarotAccessEnabled ? html`<dt>Trump Card</dt><dd>${kabPath.tarot?.card ? html`<button class="detail-inline-link" data-nav="trump" data-trump-number="${kabPath.tarot?.trumpNumber}">${kabPath.tarot.card}</button>` : "—"}</dd>` : ""}
            <dt>Intelligence</dt><dd>${kabPath.intelligence || "—"}</dd>
          </dl>
        </div>
      </div>`);
    }

    // ── Decans & Minor Arcana ─────────────────────────────────────────
    if (decans.length) {
      const decanRows = raw(decans.map((d) => {
        const ord = ["1st","2nd","3rd"][d.index - 1] || d.index;
        const sym = PLANET_SYMBOLS[d.rulerPlanetId] || "";
        if (!tarotAccessEnabled) {
          return html`<div class="zod-decan-row">
          <span class="zod-decan-ord">${ord}</span>
          <span class="zod-decan-planet">${sym ? `${sym} ` : ""}<button class="detail-inline-link" data-nav="planet" data-planet-id="${d.rulerPlanetId}">${cap(d.rulerPlanetId)}</button></span>
        </div>`;
        }

        return html`<div class="zod-decan-row">
          <span class="zod-decan-ord">${ord}</span>
          <span class="zod-decan-planet">${sym ? `${sym} ` : ""}<button class="detail-inline-link" data-nav="planet" data-planet-id="${d.rulerPlanetId}">${cap(d.rulerPlanetId)}</button></span>
          <button class="detail-inline-link" data-nav="tarot-card" data-card-name="${d.tarotMinorArcana}">
            ${d.tarotMinorArcana}
          </button>
        </div>`;
      }).join(""));
      sections.push(html`<div class="meta-card">
        <strong>${tarotAccessEnabled ? "Decans & Minor Arcana" : "Decans"}</strong>
        <div class="body-text">${decanRows}</div>
      </div>`);
    }

    if (monthRefs.length) {
      const monthButtons = raw(monthRefs.map((month) =>
        html`<button class="detail-inline-link" data-nav="calendar-month" data-month-id="${month.id}">${month.name}</button>`
      ).join(", "));

      sections.push(html`<div class="meta-card">
        <strong>Calendar Months</strong>
        <div class="body-text">Month correspondences linked to ${sign.name?.en || sign.id}: ${monthButtons}</div>
      </div>`);
    }

    // ── Kabbalah extras ───────────────────────────────────────────────
    if (sign.tribeOfIsraelId || sign.tetragrammatonPermutation) {
      sections.push(html`<div class="meta-card">
        <strong>Kabbalah Correspondences</strong>
        <div class="body-text">
          <dl class="alpha-dl">
            ${sign.tribeOfIsraelId ? html`<dt>Tribe of Israel</dt><dd>${cap(sign.tribeOfIsraelId)}</dd>` : ""}
            ${sign.tetragrammatonPermutation ? html`<dt>Tetragrammaton</dt><dd class="zod-tetra">${sign.tetragrammatonPermutation}</dd>` : ""}
          </dl>
        </div>
      </div>`);
    }

    els.detailBodyEl.innerHTML = html`<div class="meta-grid">${sections}</div>`;

    // Attach button listeners
    els.detailBodyEl.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nav = btn.dataset.nav;
        if (nav === "planet") {
          document.dispatchEvent(new CustomEvent("nav:planet", {
            detail: { planetId: btn.dataset.planetId }
          }));
        } else if (nav === "element") {
          document.dispatchEvent(new CustomEvent("nav:elements", {
            detail: { elementId: btn.dataset.elementId }
          }));
        } else if (nav === "modality") {
          document.dispatchEvent(new CustomEvent("nav:modalities", {
            detail: { modalityId: btn.dataset.modalityId }
          }));
        } else if (nav === "alphabet") {
          document.dispatchEvent(new CustomEvent("nav:alphabet", {
            detail: {
              alphabet: "hebrew",
              hebrewLetterId: btn.dataset.hebrewLetterId
            }
          }));
        } else if (nav === "kab-path") {
          document.dispatchEvent(new CustomEvent("tarot:view-kab-path", {
            detail: { pathNumber: Number(btn.dataset.pathNumber) }
          }));
        } else if (nav === "trump") {
          document.dispatchEvent(new CustomEvent("kab:view-trump", {
            detail: { trumpNumber: Number(btn.dataset.trumpNumber) }
          }));
        } else if (nav === "tarot-card") {
          document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
            detail: { cardName: btn.dataset.cardName }
          }));
        } else if (nav === "calendar-month") {
          document.dispatchEvent(new CustomEvent("nav:calendar-month", {
            detail: { monthId: btn.dataset.monthId }
          }));
        } else if (nav === "cube-sign") {
          document.dispatchEvent(new CustomEvent("nav:cube", {
            detail: {
              signId: btn.dataset.signId,
              wallId: btn.dataset.wallId,
              edgeId: btn.dataset.edgeId
            }
          }));
        }
      });
    });
  }

  function resetDetail(els) {
    if (els.detailNameEl) els.detailNameEl.textContent = "--";
    if (els.detailSubEl)  els.detailSubEl.textContent  = "Select a sign to explore";
    if (els.detailBodyEl) els.detailBodyEl.innerHTML   = "";
    syncDetailNavigation(els);
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
      isActive: (elements) => Boolean(elements?.sectionEl && elements.sectionEl.hidden === false),
      getSequenceState,
      getPrevButton: (elements) => elements?.detailPrevEl,
      getNextButton: (elements) => elements?.detailNextEl,
      getPositionEl: (elements) => elements?.detailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          const suffix = state.searchQuery ? " shown" : "";
          return `${currentIndex + 1} of ${total}${suffix}`;
        }

        return total > 0 ? `${total} signs` : "No signs";
      },
      selectTarget: (targetId, elements) => {
        selectById(targetId, elements);
        return true;
      },
      afterSelect: (targetId, elements) => {
        elements?.listEl
          ?.querySelector(`[data-id="${targetId}"]`)
          ?.scrollIntoView({ block: "nearest" });
      }
    });

    return detailNavigator;
  }

  function syncDetailNavigation(elements = getElements()) {
    getDetailNavigator()?.sync(elements);
  }

  function bindKeyboardNavigation(elements = getElements()) {
    getDetailNavigator()?.bind(elements);
  }

  // ── Selection ─────────────────────────────────────────────────────────
  function selectById(id, els) {
    const sign = state.entries.find((s) => s.id === id);
    if (!sign) return;
    state.selectedId = id;
    renderList(els);
    renderDetail(sign, els);
    syncDetailNavigation(els);
  }

  // ── Public select (for incoming navigation) ───────────────────────────
  function selectBySignId(signId) {
    const els = getElements();
    if (!state.initialized) return;
    const sign = state.entries.find((s) => s.id === signId);
    if (sign) selectById(signId, els);
  }

  // ── Init ───────────────────────────────────────────────────────────────
  function ensureZodiacSection(referenceData, magickDataset) {
    state.monthRefsBySignId = buildMonthReferencesBySign(referenceData);
    state.cubePlacementBySignId = buildCubeSignPlacements(magickDataset);

    if (state.initialized) {
      const els = getElements();
      const current = state.entries.find((entry) => entry.id === state.selectedId);
      if (current) {
        renderDetail(current, els);
        syncDetailNavigation(els);
      } else {
        syncDetailNavigation(els);
      }
      return;
    }
    state.initialized = true;

    const zodiacObj = magickDataset?.grouped?.astrology?.zodiac || {};
    state.entries = Object.values(zodiacObj).sort((a, b) => (a.no || 0) - (b.no || 0));

    const kabTree = magickDataset?.grouped?.kabbalah?.["kabbalah-tree"];
    state.kabPaths = Array.isArray(kabTree?.paths) ? kabTree.paths : [];

    state.decansBySign = referenceData?.decansBySign || {};

    const els = getElements();
    applyFilter();
    renderList(els);
    bindKeyboardNavigation(els);

    if (state.entries.length > 0) {
      selectById(state.entries[0].id, els);
    } else {
      syncDetailNavigation(els);
    }

    // Search
    if (els.searchEl) {
      els.searchEl.addEventListener("input", () => {
        state.searchQuery = els.searchEl.value;
        if (els.searchClearEl) els.searchClearEl.disabled = !state.searchQuery;
        applyFilter();
        renderList(els);
        if (!state.filteredEntries.some((s) => s.id === state.selectedId)) {
          if (state.filteredEntries.length > 0) {
            selectById(state.filteredEntries[0].id, els);
          } else {
            state.selectedId = null;
            resetDetail(els);
          }
        } else {
          syncDetailNavigation(els);
        }
      });
    }
    if (els.searchClearEl) {
      els.searchClearEl.addEventListener("click", () => {
        state.searchQuery = "";
        if (els.searchEl) els.searchEl.value = "";
        els.searchClearEl.disabled = true;
        applyFilter();
        renderList(els);
        if (state.entries.length > 0) selectById(state.entries[0].id, els);
      });
    }
  }

  window.ZodiacSectionUi = {
    ensureZodiacSection,
    selectBySignId
  };
})();
