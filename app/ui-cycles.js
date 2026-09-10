// app/ui-cycles.js
(function () {
  "use strict";

  const state = {
    initialized: false,
    referenceData: null,
    entries: [],
    filteredEntries: [],
    searchQuery: "",
    selectedId: ""
  };

  function getElements() {
    return {
      searchInputEl: document.getElementById("cycles-search-input"),
      searchClearEl: document.getElementById("cycles-search-clear"),
      countEl: document.getElementById("cycles-count"),
      listEl: document.getElementById("cycles-list"),
      detailNameEl: document.getElementById("cycles-detail-name"),
      detailTypeEl: document.getElementById("cycles-detail-type"),
      detailSummaryEl: document.getElementById("cycles-detail-summary"),
      detailBodyEl: document.getElementById("cycles-detail-body")
    };
  }

  function normalizeSearchValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeLookupToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizeCycle(raw, index) {
    const name = String(raw?.name || "").trim();
    if (!name) {
      return null;
    }

    const id = String(raw?.id || `cycle-${index + 1}`).trim();
    const category = String(raw?.category || "Uncategorized").trim();
    const period = String(raw?.period || "").trim();
    const description = String(raw?.description || "").trim();
    const significance = String(raw?.significance || "").trim();
    const related = Array.isArray(raw?.related)
      ? raw.related.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const periodDaysRaw = Number(raw?.periodDays);
    const periodDays = Number.isFinite(periodDaysRaw) ? periodDaysRaw : null;

    const searchText = typeof window.TarotSearchText?.buildSearchText === "function"
      ? window.TarotSearchText.buildSearchText(
        name,
        category,
        period,
        description,
        significance,
        related,
        {
          type: "cycle",
          id,
          label: name,
          data: { category, related }
        }
      )
      : normalizeSearchValue([
        name,
        category,
        period,
        description,
        significance,
        related.join(" ")
      ].join(" "));

    return {
      id,
      name,
      category,
      period,
      periodDays,
      description,
      significance,
      related,
      searchText
    };
  }

  function buildEntries(referenceData) {
    const rows = Array.isArray(referenceData?.astronomyCycles?.cycles)
      ? referenceData.astronomyCycles.cycles
      : [];

    return rows
      .map((row, index) => normalizeCycle(row, index))
      .filter(Boolean)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  function formatDays(value) {
    if (!Number.isFinite(value)) {
      return "";
    }
    return value >= 1000
      ? Math.round(value).toLocaleString()
      : value.toFixed(3).replace(/\.0+$/, "");
  }

  const { html, raw } = window.HtmlSafe;

  function cssEscape(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }
    return String(value || "").replace(/[^a-zA-Z0-9_\-]/g, "\\$&");
  }

  function setSelectedCycle(nextId) {
    const normalized = String(nextId || "").trim();
    if (normalized && state.entries.some((entry) => entry.id === normalized)) {
      state.selectedId = normalized;
      return;
    }
    state.selectedId = state.filteredEntries[0]?.id || state.entries[0]?.id || "";
  }

  function selectedEntry() {
    return state.filteredEntries.find((entry) => entry.id === state.selectedId)
      || state.entries.find((entry) => entry.id === state.selectedId)
      || state.filteredEntries[0]
      || state.entries[0]
      || null;
  }

  function findEntryByReference(reference) {
    const token = normalizeLookupToken(reference);
    if (!token) {
      return null;
    }

    return state.entries.find((entry) => {
      const idToken = normalizeLookupToken(entry.id);
      const nameToken = normalizeLookupToken(entry.name);
      return token === idToken || token === nameToken;
    }) || null;
  }

  function applyFilter() {
    const query = state.searchQuery;
    if (!query) {
      state.filteredEntries = state.entries.slice();
    } else {
      state.filteredEntries = state.entries.filter((entry) => entry.searchText.includes(query));
    }

    if (!state.filteredEntries.some((entry) => entry.id === state.selectedId)) {
      state.selectedId = state.filteredEntries[0]?.id || "";
    }
  }

  function syncControls(elements) {
    const { searchInputEl, searchClearEl } = elements;
    if (searchInputEl) {
      searchInputEl.value = state.searchQuery;
    }
    if (searchClearEl) {
      searchClearEl.disabled = !state.searchQuery;
    }
  }

  function renderList(elements) {
    const { listEl, countEl } = elements;
    if (!(listEl instanceof HTMLElement)) {
      return;
    }

    if (countEl) {
      countEl.textContent = state.searchQuery
        ? `${state.filteredEntries.length} of ${state.entries.length}`
        : `${state.entries.length}`;
    }

    if (!state.filteredEntries.length) {
      listEl.innerHTML = '<div class="empty">No cycles match your search.</div>';
      return;
    }

    listEl.innerHTML = "";

    state.filteredEntries.forEach((entry) => {
      const itemEl = document.createElement("div");
      const isSelected = entry.id === state.selectedId;
      itemEl.className = `list-item${isSelected ? " is-selected" : ""}`;
      itemEl.setAttribute("role", "option");
      itemEl.setAttribute("aria-selected", isSelected ? "true" : "false");
      itemEl.dataset.cycleId = entry.id;

      const periodMeta = entry.period ? ` · ${entry.period}` : "";
      itemEl.innerHTML = [
        html`<div class="list-name">${entry.name}</div>`,
        html`<div class="list-meta">${entry.category}${periodMeta}</div>`
      ].join("\n");

      itemEl.addEventListener("click", () => {
        setSelectedCycle(entry.id);
        renderAll();
      });

      listEl.appendChild(itemEl);
    });
  }

  function renderDetail(elements) {
    const {
      detailNameEl,
      detailTypeEl,
      detailSummaryEl,
      detailBodyEl
    } = elements;

    const entry = selectedEntry();

    if (!entry) {
      if (detailNameEl) detailNameEl.textContent = "No cycle selected";
      if (detailTypeEl) detailTypeEl.textContent = "";
      if (detailSummaryEl) detailSummaryEl.textContent = "Select a cycle from the list.";
      if (detailBodyEl) detailBodyEl.innerHTML = "";
      return;
    }

    if (detailNameEl) detailNameEl.textContent = entry.name;
    if (detailTypeEl) detailTypeEl.textContent = entry.category;
    if (detailSummaryEl) detailSummaryEl.textContent = entry.description || "No description available.";

    const body = [];

    if (entry.period) {
      body.push(html`<p><strong>Period:</strong> ${entry.period}</p>`);
    }

    if (Number.isFinite(entry.periodDays)) {
      body.push(html`<p><strong>Approx days:</strong> ${formatDays(entry.periodDays)}</p>`);
    }

    if (entry.significance) {
      body.push(html`<p><strong>Significance:</strong> ${entry.significance}</p>`);
    }

    if (entry.related.length) {
      const relatedButtons = raw(entry.related
        .map((label) => {
          const relatedEntry = findEntryByReference(label);
          if (!relatedEntry) {
            return html`<span class="list-meta">${label}</span>`;
          }
          return html`<button class="detail-inline-link" type="button" data-related-cycle-id="${relatedEntry.id}">${relatedEntry.name}</button>`;
        })
        .join(", "));

      body.push([
        "<div>",
        html`  <p class="body-text detail-inline-value"><strong>Related:</strong> ${relatedButtons}</p>`,
        "</div>"
      ].join("\n"));
    }

    if (detailBodyEl) {
      detailBodyEl.innerHTML = body.join("\n");
    }
  }

  function renderAll() {
    const elements = getElements();
    syncControls(elements);
    renderList(elements);
    renderDetail(elements);
  }

  function handleSearchInput() {
    const { searchInputEl } = getElements();
    state.searchQuery = normalizeSearchValue(searchInputEl?.value);
    applyFilter();
    renderAll();
  }

  function handleSearchClear() {
    const { searchInputEl } = getElements();
    if (searchInputEl) {
      searchInputEl.value = "";
      searchInputEl.focus();
    }
    state.searchQuery = "";
    applyFilter();
    renderAll();
  }

  function handleRelatedClick(event) {
    const target = event.target instanceof Element
      ? event.target.closest("[data-related-cycle-id]")
      : null;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const nextId = target.getAttribute("data-related-cycle-id");
    setSelectedCycle(nextId);
    renderAll();
  }

  function bindEvents() {
    const { searchInputEl, searchClearEl, detailBodyEl } = getElements();

    if (searchInputEl) {
      searchInputEl.addEventListener("input", handleSearchInput);
    }

    if (searchClearEl) {
      searchClearEl.addEventListener("click", handleSearchClear);
    }

    if (detailBodyEl) {
      detailBodyEl.addEventListener("click", handleRelatedClick);
    }
  }

  function ensureCyclesSection(referenceData) {
    state.referenceData = referenceData || {};
    state.entries = buildEntries(state.referenceData);
    applyFilter();

    if (!state.initialized) {
      bindEvents();
      state.initialized = true;
    }

    setSelectedCycle(state.selectedId);
    renderAll();
  }

  function selectCycleById(cycleId) {
    setSelectedCycle(cycleId);
    renderAll();
  }

  window.CyclesSectionUi = {
    ensureCyclesSection,
    selectCycleById
  };
})();
