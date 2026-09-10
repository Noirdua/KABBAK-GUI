/* ui-gods.js — Divine Pantheons section
 * Individual deity browser: Greek, Roman, Egyptian, Hebrew divine names, Archangels.
 * Kabbalah paths are shown only as a reference at the bottom of each detail view.
 */
(() => {
  "use strict";

  const { html } = window.HtmlSafe;
  const godReferenceBuilders = window.GodReferenceBuilders || {};

  if (typeof godReferenceBuilders.buildMonthReferencesByGod !== "function") {
    throw new Error("GodReferenceBuilders module must load before ui-gods.js");
  }

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    initialized:    false,
    gods:           [],
    godsByName:     new Map(),
    monthRefsByGodId: new Map(),
    filteredGods:   [],
    selectedId:     null,
    activeTab:      "greek",
    searchQuery:    ""
  };

  let listEl, detailNameEl, detailSubEl, detailBodyEl, countEl,
      searchInputEl, searchClearEl;

  // ── Tab definitions ────────────────────────────────────────────────────────
  const TABS = [
    { id: "greek",     label: "Greek",      emoji: "🏛️" },
    { id: "roman",     label: "Roman",      emoji: "🦅" },
    { id: "egyptian",  label: "Egyptian",   emoji: "𓂀" },
    { id: "hebrew",    label: "God Names",  emoji: "✡️" },
    { id: "archangel", label: "Archangels", emoji: "☀️" },
    { id: "all",       label: "All",        emoji: "∞"  },
  ];

  const PANTHEON_LABEL = {
    greek: "Greek", roman: "Roman", egyptian: "Egyptian",
    hebrew: "God Names", archangel: "Archangel"
  };

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function tokenizeEquivalent(value) {
    return String(value || "")
      .replace(/\([^)]*\)/g, " ")
      .split(/\/|,|;|\bor\b|\band\b|·|—|–/i)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function findEquivalentTarget(equivalent, currentGodId) {
    const tokens = tokenizeEquivalent(equivalent);
    for (const token of tokens) {
      const matches = state.godsByName.get(normalizeName(token));
      if (!matches?.length) continue;
      const target = matches.find((x) => x.id !== currentGodId);
      if (target) return target;
    }
    return null;
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  function applyFilter() {
    const q   = state.searchQuery.toLowerCase();
    const tab = state.activeTab;

    state.filteredGods = state.gods.filter((g) => {
      if (tab !== "all" && g.pantheon !== tab) return false;
      if (!q) return true;
      const hay = typeof window.TarotSearchText?.buildSearchText === "function"
        ? window.TarotSearchText.buildSearchText(
          g.name,
          g.epithet,
          g.role,
          g.domains,
          g.parents,
          g.siblings,
          g.children,
          g.symbols,
          g.equivalents,
          g.meaning,
          g.description,
          g.myth,
          g.sephirah,
          g.kabbalahPaths,
          g.pantheon,
          {
            type: "god",
            id: g.id,
            label: g.name,
            data: {
              sephirah: g.sephirah,
              pathNumber: Array.isArray(g.kabbalahPaths) ? g.kabbalahPaths.join(" ") : g.kabbalahPaths,
              pantheon: g.pantheon
            }
          }
        )
        : [
          g.name, g.epithet, g.role,
          ...(g.domains      || []),
          ...(g.parents      || []),
          ...(g.siblings     || []),
          ...(g.children     || []),
          ...(g.symbols      || []),
          ...(g.equivalents  || []),
          g.meaning, g.description, g.myth,
          g.sephirah
        ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });

    const hasSelected = state.filteredGods.some((g) => g.id === state.selectedId);
    if (!hasSelected) {
      state.selectedId = state.filteredGods[0]?.id || null;
    }

    renderList();
    renderDetail(state.selectedId);
  }

  // ── List ───────────────────────────────────────────────────────────────────
  function renderList() {
    if (!listEl) return;
    if (countEl) countEl.textContent = `${state.filteredGods.length} deities`;

    if (!state.filteredGods.length) {
      listEl.innerHTML = `<div style="padding:20px;color:#71717a;font-size:13px;text-align:center">No matches</div>`;
      return;
    }

    listEl.innerHTML = state.filteredGods.map((g) => {
      const isActive = state.selectedId === g.id;
      const tag = PANTHEON_LABEL[g.pantheon] || g.pantheon;
      return html`<div class="gods-list-item${isActive ? " gods-list-active" : ""}" data-id="${g.id}" role="option" tabindex="0" aria-selected="${isActive}">
  <div class="gods-list-main">
    <span class="gods-list-label">${g.name}</span>
    <span class="gods-list-tag">${tag}</span>
  </div>
  <div class="gods-list-sub">${g.role || g.epithet || "—"}</div>
</div>`;
    }).join("");

    listEl.querySelectorAll(".gods-list-item").forEach((el) => {
      el.addEventListener("click",   () => selectGod(el.dataset.id));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") selectGod(el.dataset.id);
      });
    });
  }

  // ── Detail ─────────────────────────────────────────────────────────────────
  function renderDetail(id) {
    if (!detailNameEl) return;
    const g = state.gods.find((x) => x.id === id);
    if (!g) {
      detailNameEl.textContent = "—";
      detailSubEl.textContent  = "Select a deity to explore";
      detailBodyEl.innerHTML   = "";
      return;
    }

    detailNameEl.textContent = g.name;
    detailSubEl.textContent  = g.epithet || g.role || "";

    const cards = [];

    // ── Role & Domains ──
    if (g.role || g.domains?.length) {
      const domHtml = g.domains?.length
        ? html`<div class="gods-domain-row">${g.domains.map(d => html`<span class="gods-domain-tag">${d}</span>`)}</div>`
        : "";
      cards.push(html`<div class="gods-card">
  <div class="gods-card-title">⚡ Role &amp; Domains</div>
  ${g.role ? html`<div class="gods-card-body">${g.role}</div>` : ""}
  ${domHtml}
</div>`);
    }

    // ── Family ──
    const hasFamily = [g.parents, g.siblings, g.consorts, g.children].some(a => a?.length);
    if (hasFamily) {
      const rows = [
        g.parents?.length  ? html`<div class="gods-card-row"><span class="gods-field-label">Parents</span>${g.parents.join(", ")}</div>`   : "",
        g.siblings?.length ? html`<div class="gods-card-row"><span class="gods-field-label">Siblings</span>${g.siblings.join(", ")}</div>`  : "",
        g.consorts?.length ? html`<div class="gods-card-row"><span class="gods-field-label">Consort(s)</span>${g.consorts.join(", ")}</div>` : "",
        g.children?.length ? html`<div class="gods-card-row"><span class="gods-field-label">Children</span>${g.children.join(", ")}</div>`  : "",
      ].filter(Boolean);
      cards.push(html`<div class="gods-card">
  <div class="gods-card-title">👨‍👩‍👧 Family</div>
  ${rows}
</div>`);
    }

    // ── Symbols & Sacred ──
    if (g.symbols?.length || g.sacredAnimals?.length || g.sacredPlaces?.length) {
      const rows = [
        g.symbols?.length      ? html`<div class="gods-card-row"><span class="gods-field-label">Symbols</span>${g.symbols.join(", ")}</div>`       : "",
        g.sacredAnimals?.length ? html`<div class="gods-card-row"><span class="gods-field-label">Sacred animals</span>${g.sacredAnimals.join(", ")}</div>` : "",
        g.sacredPlaces?.length  ? html`<div class="gods-card-row"><span class="gods-field-label">Sacred places</span>${g.sacredPlaces.join(", ")}</div>`   : "",
      ].filter(Boolean);
      cards.push(html`<div class="gods-card">
  <div class="gods-card-title">🔱 Sacred &amp; Symbols</div>
  ${rows}
</div>`);
    }

    // ── Hebrew Name (divine names / archangels) ──
    if (g.hebrew) {
      const title = g.pantheon === "archangel" ? "☀️ Angelic Name" : "✡️ Hebrew Name";
      cards.push(html`<div class="gods-card gods-card--elohim">
  <div class="gods-card-title">${title}</div>
  <div class="gods-card-row" style="align-items:baseline;gap:10px;flex-wrap:wrap">
    <span class="gods-hebrew">${g.hebrew}</span>
    <span class="gods-transliteration">${g.name}</span>
  </div>
  ${g.meaning   ? html`<div class="gods-card-row" style="color:#a1a1aa;font-size:12px">${g.meaning}</div>` : ""}
  ${g.sephirah  ? html`<div class="gods-card-row" style="color:#a1a1aa;font-size:12px">Governs Sephirah ${g.sephirah}</div>` : ""}
</div>`);
    }

    // ── Equivalents ──
    if (g.equivalents?.length) {
      const equivalentHtml = g.equivalents.map((equivalent) => {
        const target = findEquivalentTarget(equivalent, g.id);
        if (target) {
          return html`<button type="button" class="gods-equivalent-link" data-god-id="${target.id}">${equivalent} ↗</button>`;
        }
        return html`<span class="gods-equivalent-text">${equivalent}</span>`;
      });

      cards.push(html`<div class="gods-card">
  <div class="gods-card-title">⟺ Equivalents</div>
  <div class="gods-equivalent-row">${equivalentHtml}</div>
</div>`);
    }

    const monthRefs = state.monthRefsByGodId.get(String(g.id || "").toLowerCase()) || [];
    if (monthRefs.length) {
      const monthButtons = monthRefs.map((month) =>
        html`<button class="gods-nav-btn" data-event="nav:calendar-month" data-month-id="${month.id}">${month.label || month.name} ↗</button>`
      );

      cards.push(html`<div class="gods-card gods-card--kab">
  <div class="gods-card-title">📅 Calendar Months</div>
  <div class="gods-card-row" style="color:#a1a1aa;font-size:12px">Linked month correspondences for ${g.name}</div>
  <div class="gods-nav-row">${monthButtons}</div>
</div>`);
    }

    // ── Description ──
    if (g.description) {
      cards.push(html`<div class="gods-card gods-card--wide">
  <div class="gods-card-title">📖 Description</div>
  <div class="gods-card-body" style="white-space:pre-line">${g.description}</div>
</div>`);
    }

    // ── Myth ──
    if (g.myth) {
      cards.push(html`<div class="gods-card gods-card--wide">
  <div class="gods-card-title">📜 Myth</div>
  <div class="gods-card-body" style="white-space:pre-line">${g.myth}</div>
</div>`);
    }

    // ── Poem ──
    if (g.poem) {
      cards.push(html`<div class="gods-card gods-card--wide">
  <div class="gods-card-title">✍️ Poem</div>
  <div class="gods-card-body" style="white-space:pre-line;font-style:italic">${g.poem}</div>
</div>`);
    }

    // ── Kabbalah reference (small, at bottom) ──
    if (g.kabbalahPaths?.length) {
      const btnHtml = g.kabbalahPaths.map(p =>
        html`<button class="gods-nav-btn" data-event="nav:kabbalah-path" data-path-no="${p}">Path / Sephirah ${p} ↗</button>`
      );
      cards.push(html`<div class="gods-card gods-card--kab">
  <div class="gods-card-title">🌳 Kabbalah Reference</div>
  <div class="gods-card-row" style="color:#a1a1aa;font-size:12px">Paths: ${g.kabbalahPaths.join(", ")}</div>
  <div class="gods-nav-row">${btnHtml}</div>
</div>`);
    }

    detailBodyEl.innerHTML = html`<div class="gods-detail-grid">${cards}</div>`;

    // Attach nav button listeners
    detailBodyEl.querySelectorAll(".gods-nav-btn[data-event]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const evtName = btn.dataset.event;
        const detail  = {};
        Object.entries(btn.dataset).forEach(([key, val]) => {
          if (key === "event") return;
          const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          detail[camel] = isNaN(Number(val)) || val === "" ? val : Number(val);
        });
        document.dispatchEvent(new CustomEvent(evtName, { detail }));
      });
    });

    detailBodyEl.querySelectorAll(".gods-equivalent-link[data-god-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const godId = btn.dataset.godId;
        if (godId) selectGod(godId);
      });
    });
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────
  function renderTabs() {
    const tabsEl = document.getElementById("gods-tabs");
    if (!tabsEl) return;
    tabsEl.innerHTML = TABS.map((t) =>
      html`<button class="gods-tab-btn${state.activeTab === t.id ? " gods-tab-active" : ""}" data-tab="${t.id}">${t.emoji} ${t.label}</button>`
    ).join("");
    tabsEl.querySelectorAll(".gods-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeTab = btn.dataset.tab;
        renderTabs();
        applyFilter();
      });
    });
  }

  // ── Public: select god by id ───────────────────────────────────────────────
  function selectGod(id) {
    const g = state.gods.find((x) => x.id === id);
    if (!g) return false;
    if (g && state.activeTab !== "all" && g.pantheon !== state.activeTab) {
      state.activeTab = "all";
      renderTabs();
    }
    state.selectedId = id;
    applyFilter();
    requestAnimationFrame(() => {
      const item = listEl?.querySelector(`[data-id="${id}"]`);
      if (item) item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return true;
  }

  function selectById(godId) {
    return selectGod(godId);
  }

  function selectByName(name) {
    const tokens = tokenizeEquivalent(name);
    for (const token of tokens) {
      const matches = state.godsByName.get(normalizeName(token));
      const target = matches?.[0];
      if (target?.id) {
        return selectGod(target.id);
      }
    }
    return false;
  }

  // ── Public: navigate here from kabbalah (find first god on that path) ──────
  function selectByPathNo(pathNo) {
    const no = Number(pathNo);
    const g  = state.gods.find((x) => x.kabbalahPaths?.includes(no));
    if (g) return selectGod(g.id);
    return false;
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function ensureGodsSection(magickDataset, referenceData = null) {
    if (referenceData) {
      state.monthRefsByGodId = godReferenceBuilders.buildMonthReferencesByGod(referenceData);
    }

    if (state.initialized) {
      if (state.selectedId) {
        renderDetail(state.selectedId);
      }
      return;
    }
    state.initialized = true;

    listEl        = document.getElementById("gods-list");
    detailNameEl  = document.getElementById("gods-detail-name");
    detailSubEl   = document.getElementById("gods-detail-sub");
    detailBodyEl  = document.getElementById("gods-detail-body");
    countEl       = document.getElementById("gods-count");
    searchInputEl = document.getElementById("gods-search-input");
    searchClearEl = document.getElementById("gods-search-clear");

    const godsData = magickDataset?.grouped?.["gods"];
    if (!godsData?.gods?.length) {
      if (listEl) listEl.innerHTML = `<div style="padding:20px;color:#ef4444">Failed to load gods data.</div>`;
      return;
    }

    state.gods = godsData.gods;
    state.godsByName = state.gods.reduce((map, god) => {
      const key = normalizeName(god.name);
      const row = map.get(key) || [];
      row.push(god);
      map.set(key, row);
      return map;
    }, new Map());

    if (searchInputEl) {
      searchInputEl.addEventListener("input", () => {
        state.searchQuery = searchInputEl.value;
        if (searchClearEl) searchClearEl.disabled = !state.searchQuery;
        applyFilter();
      });
    }
    if (searchClearEl) {
      searchClearEl.disabled = true;
      searchClearEl.addEventListener("click", () => {
        state.searchQuery = "";
        if (searchInputEl) searchInputEl.value = "";
        searchClearEl.disabled = true;
        applyFilter();
      });
    }

    renderTabs();
    applyFilter();
  }

  // ── Expose public API ──────────────────────────────────────────────────────
  window.GodsSectionUi = { ensureGodsSection, selectByPathNo, selectById, selectByName };
})();

