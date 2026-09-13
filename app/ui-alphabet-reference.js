(function () {
  "use strict";

  const TITLE_FIELDS = ["title", "lemma", "term", "word", "headword", "name"];
  const BODY_FIELDS = ["body", "definition", "strongs_def", "description", "text", "kjv_def", "gloss"];

  const STORAGE_KEYS = {
    showReferenceInfo: "kabbak.alphaReference.showReferenceInfo",
    entryFontSize: "kabbak.alphaReference.entryFontSize"
  };

  function readStoredBoolean(key, fallback) {
    try {
      const value = window.localStorage?.getItem?.(key);
      if (value === "true") return true;
      if (value === "false") return false;
    } catch (_error) {
      // Ignore storage failures.
    }
    return fallback;
  }

  function writeStoredBoolean(key, value) {
    try {
      window.localStorage?.setItem?.(key, value ? "true" : "false");
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  function readStoredString(key, fallback) {
    try {
      const value = window.localStorage?.getItem?.(key);
      if (value) return value;
    } catch (_error) {
      // Ignore storage failures.
    }
    return fallback;
  }

  function writeStoredString(key, value) {
    try {
      window.localStorage?.setItem?.(key, value);
    } catch (_error) {
      // Ignore storage failures.
    }
  }

  const state = {
    catalog: null,
    selectedReferenceId: "",
    query: "",
    results: null,
    loading: false,
    error: "",
    requestId: 0,
    searchRequestId: 0,
    expandedEntryId: "",
    showReferenceInfo: readStoredBoolean(STORAGE_KEYS.showReferenceInfo, true),
    entryFontSize: readStoredString(STORAGE_KEYS.entryFontSize, "normal")
  };

  let elements = null;
  let searchDebounceTimer = null;
  let eventsBound = false;

  function getElements() {
    if (elements) {
      return elements;
    }

    elements = {
      countEl: document.getElementById("alpha-reference-count"),
      listEl: document.getElementById("alpha-reference-list"),
      detailNameEl: document.getElementById("alpha-reference-detail-name"),
      detailSubEl: document.getElementById("alpha-reference-detail-sub"),
      settingsBtnEl: document.getElementById("alpha-reference-settings-btn"),
      settingsPopoverEl: document.getElementById("alpha-reference-settings-popover"),
      showInfoEl: document.getElementById("alpha-reference-show-info"),
      fontSizeSelectEl: document.getElementById("alpha-reference-font-size-select"),
      searchFormEl: document.getElementById("alpha-reference-search-form"),
      searchInputEl: document.getElementById("alpha-reference-search-input"),
      searchSubmitEl: document.getElementById("alpha-reference-search-submit"),
      searchClearEl: document.getElementById("alpha-reference-search-clear"),
      detailBodyEl: document.getElementById("alpha-reference-detail-body")
    };
    return elements;
  }

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getReferences() {
    return Array.isArray(state.catalog?.references) ? state.catalog.references : [];
  }

  function referenceById(referenceId) {
    return getReferences().find((reference) => normalizeId(reference.id) === normalizeId(referenceId)) || null;
  }

  function referenceKindLabel(reference) {
    return String(reference?.kind || "dictionary").trim();
  }

  function humanizeField(field) {
    return String(field || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
  }

  function fieldConfigFor(reference) {
    return reference?.fieldConfig && typeof reference.fieldConfig === "object"
      ? reference.fieldConfig
      : {};
  }

  function listKeysFor(reference) {
    const config = fieldConfigFor(reference);
    const listed = Object.keys(config).filter((key) => config[key]?.list);
    const ordered = (Array.isArray(reference?.listOrder) ? reference.listOrder : [])
      .map((key) => String(key || "").trim())
      .filter((key) => listed.includes(key));
    listed.forEach((key) => {
      if (!ordered.includes(key)) ordered.push(key);
    });
    return ordered;
  }

  function fieldLabel(reference, key) {
    const label = fieldConfigFor(reference)[key]?.label;
    return String(label || humanizeField(key)).trim() || humanizeField(key);
  }

  function fieldVisible(reference, key) {
    const config = fieldConfigFor(reference)[key];
    if (!config) return true;
    return config.visible !== false;
  }

  function isRefTable(value) {
    return Array.isArray(value)
      && value.length
      && value.every((item) => item && typeof item === "object" && !Array.isArray(item));
  }

  const ALIAS_FIELDS = {
    keyword: "title",
    term: "title",
    lemma: "title",
    headword: "title",
    word: "title",
    summary: "body",
    definition: "body",
    meaning: "body"
  };

  function fieldValue(entry, key, listedKeys) {
    if (!entry || typeof entry !== "object") return null;
    if (entry[key] != null && entry[key] !== "") return entry[key];
    const alias = ALIAS_FIELDS[key];
    if (alias && Array.isArray(listedKeys) && listedKeys.includes(alias)) return null;
    if (alias && entry[alias] != null && entry[alias] !== "") return entry[alias];
    return null;
  }

  function scalarText(value) {
    if (value == null || value === "") return "";
    if (typeof value === "object") return "";
    return String(value).trim();
  }

  function formatRefCell(value) {
    if (value == null || value === "") return "";
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (item && typeof item === "object") {
          return String(item.word || item.title || item.gloss || "").trim()
            || Object.values(item).filter((part) => part != null && typeof part !== "object").join(" ");
        }
        return String(item);
      }).filter(Boolean).join(", ");
    }
    if (typeof value === "object") {
      return String(value.word || value.title || value.gloss || "").trim();
    }
    return String(value);
  }

  function renderFieldValue(value, fieldKey, reference) {
    if (value == null || value === "") {
      return document.createTextNode("—");
    }
    if (isRefTable(value)) {
      const columnConfig = fieldConfigFor(reference)[fieldKey]?.columns || {};
      const columns = [...new Set(value.flatMap((row) => Object.keys(row || {})))]
        .filter((column) => columnConfig[column]?.visible !== false);
      const table = document.createElement("table");
      table.className = "dlc-ref-matrix";
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      columns.forEach((column) => {
        const th = document.createElement("th");
        th.textContent = columnConfig[column]?.label || humanizeField(column);
        headRow.appendChild(th);
      });
      head.appendChild(headRow);
      const body = document.createElement("tbody");
      value.forEach((row) => {
        const tr = document.createElement("tr");
        columns.forEach((column) => {
          const td = document.createElement("td");
            td.textContent = formatRefCell(row[column]);
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
      table.append(head, body);
      const wrap = document.createElement("div");
      wrap.className = "dlc-ref-matrix-wrap";
      wrap.appendChild(table);
      return wrap;
    }
    if (Array.isArray(value)) {
      const wrap = document.createElement("div");
      wrap.className = "alpha-reference-entry-list-block";
      value.forEach((item) => {
        const row = document.createElement("div");
        row.textContent = formatRefCell(item);
        wrap.appendChild(row);
      });
      return wrap;
    }
    if (typeof value === "object") {
      return renderFieldValue(Object.entries(value).map(([key, val]) => `${key}: ${val}`), fieldKey, reference);
    }
    const text = document.createElement("p");
    text.className = "alpha-reference-entry-body";
    text.textContent = String(value);
    return text;
  }

  function entryTitle(entry, entryId, reference) {
    const keys = listKeysFor(reference);
    if (keys.length) {
      const first = scalarText(fieldValue(entry, keys[0], keys));
      if (first) return first;
    }
    for (const field of TITLE_FIELDS) {
      const value = String(entry?.[field] || "").trim();
      if (value) {
        return value;
      }
    }
    return entryId;
  }

  function entryBody(entry) {
    for (const field of BODY_FIELDS) {
      const value = String(entry?.[field] || "").trim();
      if (value) {
        return value;
      }
    }
    return "";
  }

  function entryExtraRows(entry) {
    const rows = [];
    if (!entry || typeof entry !== "object") {
      return rows;
    }

    for (const [field, value] of Object.entries(entry)) {
      if (TITLE_FIELDS.includes(field) || BODY_FIELDS.includes(field)) {
        continue;
      }
      if (typeof value === "object") {
        continue;
      }
      const text = String(value == null ? "" : value).trim();
      if (!text) {
        continue;
      }
      rows.push([humanizeField(field), text]);
    }
    return rows;
  }

  function createEmptyMessage(text) {
    const empty = document.createElement("p");
    empty.className = "alpha-reference-empty";
    empty.textContent = text;
    return empty;
  }

  function sourceTitleById(sourceId) {
    const sources = Array.isArray(state.catalog?.sources) ? state.catalog.sources : [];
    const source = sources.find((entry) => normalizeId(entry.id) === normalizeId(sourceId));
    return source?.title || "";
  }

  function formatCount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString() : "--";
  }

  function renderReferenceInfoCard() {
    const reference = referenceById(state.selectedReferenceId);
    if (!reference || !state.showReferenceInfo) {
      return null;
    }

    const card = document.createElement("div");
    card.className = "meta-card meta-card alpha-reference-info-card";

    const heading = document.createElement("strong");
    heading.textContent = "Reference Info";
    card.appendChild(heading);

    const rows = [
      ["Title", reference.title || "--"],
      ["Type", referenceKindLabel(reference)],
      ["Key Scheme", String(reference.keyScheme || "word").trim() || "--"],
      ["Entries", formatCount(reference.entryCount)]
    ];

    if (reference.description) {
      rows.push(["Description", reference.description]);
    }

    const sourceIds = Array.isArray(reference.sourceIds) ? reference.sourceIds : [];
    if (sourceIds.length) {
      const titles = sourceIds.map((id) => sourceTitleById(id)).filter(Boolean);
      if (titles.length) {
        rows.push(["Linked Sources", titles.join(", ")]);
      }
    }

    const dl = document.createElement("dl");
    dl.className = "alpha-dl";
    rows.forEach(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      dl.append(dt, dd);
    });
    card.appendChild(dl);
    return card;
  }

  function applyReferenceFontSize(bodyEl) {
    if (!(bodyEl instanceof HTMLElement)) {
      return;
    }
    bodyEl.classList.remove("alpha-reference-font-small", "alpha-reference-font-large", "alpha-reference-font-xlarge");
    if (state.entryFontSize !== "normal") {
      bodyEl.classList.add(`alpha-reference-font-${state.entryFontSize}`);
    }
  }

  function syncReferenceSettings() {
    const { showInfoEl, fontSizeSelectEl, detailBodyEl } = getElements();
    if (showInfoEl instanceof HTMLInputElement) {
      showInfoEl.checked = Boolean(state.showReferenceInfo);
    }
    if (fontSizeSelectEl instanceof HTMLSelectElement) {
      fontSizeSelectEl.value = state.entryFontSize;
    }
    applyReferenceFontSize(detailBodyEl);
  }

  function prependReferenceInfoCard() {
    const { detailBodyEl } = getElements();
    const card = renderReferenceInfoCard();
    if (card && detailBodyEl instanceof HTMLElement) {
      detailBodyEl.prepend(card);
    }
  }

  function renderReferenceList() {
    const { countEl, listEl } = getElements();
    if (!countEl || !listEl) {
      return;
    }

    const references = getReferences();
    countEl.textContent = String(references.length);
    listEl.replaceChildren();

    if (!references.length) {
      listEl.appendChild(createEmptyMessage("No references installed. Install one with npm run dlc -- install."));
      return;
    }

    references.forEach((reference) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item alpha-reference-list-btn";
      button.dataset.referenceId = reference.id;
      button.setAttribute("role", "option");

      const isSelected = normalizeId(reference.id) === normalizeId(state.selectedReferenceId);
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");

      const name = document.createElement("span");
      name.className = "list-name";
      name.textContent = reference.title || reference.id;

      const meta = document.createElement("span");
      meta.className = "alpha-reference-list-meta";
      meta.textContent = referenceKindLabel(reference);

      button.append(name, meta);
      button.addEventListener("click", () => {
        selectReference(reference.id);
      });

      listEl.appendChild(button);
    });
  }

  function selectReference(referenceId) {
    if (!referenceId || normalizeId(referenceId) === normalizeId(state.selectedReferenceId)) {
      return;
    }

    state.selectedReferenceId = referenceId;
    state.query = "";
    state.results = null;
    state.error = "";
    state.expandedEntryId = "";
    const { searchInputEl } = getElements();
    if (searchInputEl) {
      searchInputEl.value = "";
    }
    renderReferenceList();
    renderDetail();
    void runSearch("");
  }

  function renderDetail() {
    const { detailNameEl, detailSubEl, detailBodyEl } = getElements();
    if (!detailNameEl || !detailSubEl || !detailBodyEl) {
      return;
    }

    const reference = referenceById(state.selectedReferenceId);
    if (!reference) {
      detailNameEl.textContent = "--";
      detailSubEl.textContent = "Select a reference to browse";
      detailBodyEl.replaceChildren(createEmptyMessage("Choose a reference from the list to browse its entries."));
      return;
    }

    detailNameEl.textContent = reference.title || reference.id;
    const kind = referenceKindLabel(reference);
    const entryCount = Number.isFinite(Number(reference.entryCount)) ? ` · ${reference.entryCount} entries` : "";
    detailSubEl.textContent = `${kind}${entryCount}`;
    syncReferenceSettings();
  }

  async function runSearch(query) {
    const { detailBodyEl } = getElements();
    if (!detailBodyEl) {
      return;
    }

    const reference = referenceById(state.selectedReferenceId);
    if (!reference) {
      return;
    }

    const normalizedQuery = String(query || "").trim().toLowerCase();
    const requestId = state.searchRequestId + 1;
    state.searchRequestId = requestId;
    state.query = normalizedQuery;
    state.loading = true;
    state.error = "";
    state.expandedEntryId = "";

    renderSearchState("loading");

    try {
      const payload = await window.TarotDataService?.searchTextReference?.(
        reference.id,
        normalizedQuery,
        { limit: 100 }
      );
      if (requestId !== state.searchRequestId) {
        return;
      }

      state.results = payload;
      state.loading = false;
      renderResults();
    } catch (error) {
      if (requestId !== state.searchRequestId) {
        return;
      }
      state.loading = false;
      state.error = error?.message || "Unable to load reference entries.";
      renderSearchState("error");
    }
  }

  function renderSearchState(kind) {
    const { detailBodyEl } = getElements();
    if (!detailBodyEl) {
      return;
    }

    if (kind === "loading") {
      detailBodyEl.replaceChildren(createEmptyMessage("Loading entries..."));
    } else if (kind === "error") {
      detailBodyEl.replaceChildren(createEmptyMessage(state.error || "Unable to load reference entries."));
    }
    prependReferenceInfoCard();
  }

  function renderResults() {
    const { detailBodyEl } = getElements();
    if (!detailBodyEl) {
      return;
    }

    const payload = state.results;
    const results = Array.isArray(payload?.matches) ? payload.matches : [];

    detailBodyEl.replaceChildren();
    prependReferenceInfoCard();

    if (!results.length) {
      const message = state.query
        ? `No entries match "${state.query}".`
        : "This reference has no entries.";
      detailBodyEl.appendChild(createEmptyMessage(message));
      return;
    }

    const listEl = document.createElement("div");
    listEl.className = "alpha-reference-entry-list";

    results.forEach((result) => {
      listEl.appendChild(buildEntryRow(result.entryId, result.entry));
    });

    detailBodyEl.appendChild(listEl);

    if (payload?.truncated) {
      const hint = document.createElement("p");
      hint.className = "alpha-reference-truncated-hint";
      hint.textContent = "Showing a subset of matching entries — refine your search to narrow the list.";
      detailBodyEl.appendChild(hint);
    }
  }

  function buildEntryRow(entryId, entry) {
    const wrapper = document.createElement("div");
    wrapper.className = "alpha-reference-entry-item";

    const row = document.createElement("button");
    row.type = "button";
    row.className = "alpha-reference-entry-row";
    row.setAttribute("aria-expanded", "false");

    const reference = referenceById(state.selectedReferenceId);
    const listKeys = listKeysFor(reference);
    const titleText = entryTitle(entry, entryId, reference);
    const values = listKeys
      .map((key) => scalarText(fieldValue(entry, key, listKeys)))
      .filter((text) => text && text !== titleText);
    if (listKeys.length) {
      row.classList.add("is-stacked");
      const titleEl = document.createElement("strong");
      titleEl.className = "alpha-reference-entry-row-title";
      titleEl.textContent = titleText;
      row.appendChild(titleEl);
      values.forEach((text) => {
        const line = document.createElement("span");
        line.className = "alpha-reference-entry-row-meta";
        line.textContent = text;
        row.appendChild(line);
      });
    } else {
      const idEl = document.createElement("span");
      idEl.className = "alpha-reference-entry-key";
      idEl.textContent = String(entryId || "");

      const titleEl = document.createElement("span");
      titleEl.className = "alpha-reference-entry-row-title";
      titleEl.textContent = entryTitle(entry, entryId, reference);
      row.append(idEl, titleEl);
    }
    wrapper.appendChild(row);

    row.addEventListener("click", () => {
      const isExpanded = wrapper.classList.contains("is-expanded");
      state.expandedEntryId = isExpanded ? "" : String(entryId || "");
      if (isExpanded) {
        const detail = wrapper.querySelector(".alpha-reference-entry-detail");
        if (detail) {
          detail.remove();
        }
        wrapper.classList.remove("is-expanded");
        row.setAttribute("aria-expanded", "false");
        return;
      }
      state.expandedEntryId = String(entryId || "");
      wrapper.appendChild(buildEntryDetail(entryId, entry));
      wrapper.classList.add("is-expanded");
      row.setAttribute("aria-expanded", "true");
    });

    return wrapper;
  }

  function buildEntryDetail(entryId, entry) {
    const detail = document.createElement("div");
    detail.className = "alpha-reference-entry-detail";
    const reference = referenceById(state.selectedReferenceId);
    const config = fieldConfigFor(reference);
    const configuredKeys = Object.keys(config);
    if (configuredKeys.length && entry && typeof entry === "object") {
      const listKeys = listKeysFor(reference);
      const restKeys = Object.keys(entry).filter((key) => !listKeys.includes(key));
      [...listKeys, ...restKeys].forEach((key) => {
        if (!fieldVisible(reference, key)) return;
        const value = fieldValue(entry, key, listKeys);
        if (value == null || value === "") return;
        const block = document.createElement("section");
        block.className = "alpha-reference-entry-field";
        const heading = document.createElement("strong");
        heading.textContent = fieldLabel(reference, key);
        block.append(heading, renderFieldValue(value, key, reference));
        detail.appendChild(block);
      });
    } else {
      const mainBody = entryBody(entry);
      if (mainBody) {
        const body = document.createElement("p");
        body.className = "alpha-reference-entry-body";
        body.textContent = mainBody;
        detail.appendChild(body);
      }

      const rows = entryExtraRows(entry);
      if (rows.length) {
        const dl = document.createElement("dl");
        dl.className = "alpha-dl";
        rows.forEach(([label, value]) => {
          const dt = document.createElement("dt");
          dt.textContent = label;
          const dd = document.createElement("dd");
          dd.textContent = value;
          dl.append(dt, dd);
        });
        detail.appendChild(dl);
      }
    }

    const hasLinkedSources = Array.isArray(reference?.sourceIds) && reference.sourceIds.length;
    if (hasLinkedSources) {
      detail.appendChild(buildOccurrencesSection(entryId));
    }

    return detail;
  }

  function buildOccurrencesSection(entryId) {
    const section = document.createElement("section");
    section.className = "alpha-reference-occurrences";

    const title = document.createElement("strong");
    title.textContent = "Verse Occurrences";
    section.appendChild(title);

    const status = document.createElement("p");
    status.className = "alpha-reference-occurrence-status";
    status.textContent = "Loading verses...";
    section.appendChild(status);

    void loadOccurrences(entryId, section, status);
    return section;
  }

  async function loadOccurrences(entryId, section, status) {
    const reference = referenceById(state.selectedReferenceId);
    if (!reference) {
      return;
    }

    try {
      const payload = await window.TarotDataService?.loadTextReferenceOccurrences?.(reference.id, entryId, { limit: 100 });
      renderOccurrences(section, status, entryId, payload);
    } catch (error) {
      status.textContent = error?.message || "Unable to load verses.";
    }
  }

  function renderOccurrences(section, status, entryId, payload) {
    const total = Number(payload?.total) || 0;
    const shown = Array.isArray(payload?.matches) ? payload.matches.length : 0;
    status.textContent = total
      ? `${total} verse${total === 1 ? "" : "s"} use ${entryId}.${payload?.truncated ? ` Showing the first ${shown} results.` : ""}`
      : `No verses found for ${entryId}.`;

    const results = Array.isArray(payload?.matches) ? payload.matches : [];
    if (!results.length) {
      return;
    }

    const list = document.createElement("div");
    list.className = "alpha-reference-occurrence-list";

    results.forEach((result) => {
      list.appendChild(buildOccurrenceRow(result, entryId));
    });

    section.appendChild(list);
  }

  function buildOccurrenceRow(result, entryId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "alpha-reference-occurrence";

    const head = document.createElement("div");
    head.className = "alpha-text-search-result-head";

    const reference = document.createElement("span");
    reference.className = "alpha-text-search-reference";
    reference.textContent = result.reference || `${result.workTitle} ${result.sectionLabel}:${result.verseNumber}`;

    const location = document.createElement("span");
    location.className = "alpha-text-search-location";
    location.textContent = `${result.sourceShortTitle || result.sourceTitle} · ${result.workTitle} · ${result.sectionLabel}`;

    head.append(reference, location);
    button.appendChild(head);

    const preview = document.createElement("p");
    preview.className = "alpha-text-search-preview alpha-text-search-preview--compact";
    renderOccurrencePreview(preview, result);
    button.appendChild(preview);

    button.addEventListener("click", () => {
      void openOccurrenceVerse(result, entryId);
    });

    return button;
  }

  function renderOccurrencePreview(target, result) {
    const previewTokens = Array.isArray(result?.previewTokens) ? result.previewTokens : [];
    target.replaceChildren();
    if (!previewTokens.length) {
      target.textContent = result?.preview || "";
      return;
    }

    previewTokens.forEach((token, index) => {
      const text = String(token?.text || "").trim();
      if (!text) {
        return;
      }

      const previousText = String(previewTokens[index - 1]?.text || "").trim();
      if (index > 0 && text !== "..." && previousText !== "...") {
        target.appendChild(document.createTextNode(" "));
      }

      if (token?.isMatch) {
        const mark = document.createElement("mark");
        mark.className = "alpha-text-mark alpha-text-mark--strongs";
        mark.textContent = text;
        target.appendChild(mark);
      } else {
        target.appendChild(document.createTextNode(text));
      }
    });
  }

  async function openOccurrenceVerse(result, entryId = "") {
    if (!result?.sourceId) {
      return;
    }

    window.TarotSectionStateUi?.setActiveSection?.("alphabet-text");
    await window.AlphabetTextUi?.openPassage?.(result, entryId);
  }

  function bindEvents() {
    if (eventsBound) {
      return;
    }
    eventsBound = true;

    const {
      searchFormEl,
      searchInputEl,
      searchSubmitEl,
      searchClearEl,
      settingsBtnEl,
      settingsPopoverEl,
      showInfoEl,
      fontSizeSelectEl
    } = getElements();

    searchFormEl?.addEventListener("submit", (event) => {
      event.preventDefault();
      void runSearch(searchInputEl?.value || "");
    });

    searchInputEl?.addEventListener("input", () => {
      window.clearTimeout(searchDebounceTimer);
      searchDebounceTimer = window.setTimeout(() => {
        void runSearch(searchInputEl.value || "");
      }, 220);
    });

    searchClearEl?.addEventListener("click", () => {
      if (searchInputEl) {
        searchInputEl.value = "";
      }
      void runSearch("");
    });

    if (searchSubmitEl) {
      searchSubmitEl.style.display = "none";
    }

    if (settingsBtnEl instanceof HTMLButtonElement && settingsPopoverEl instanceof HTMLElement) {
      settingsBtnEl.addEventListener("click", () => {
        const isOpen = settingsPopoverEl.hidden === false;
        settingsPopoverEl.hidden = isOpen;
        settingsBtnEl.setAttribute("aria-expanded", isOpen ? "false" : "true");
      });

      const closeBtn = settingsPopoverEl.querySelector(".alpha-text-settings-close");
      if (closeBtn instanceof HTMLButtonElement) {
        closeBtn.addEventListener("click", () => {
          settingsPopoverEl.hidden = true;
          settingsBtnEl.setAttribute("aria-expanded", "false");
        });
      }

      document.addEventListener("click", (event) => {
        if (settingsPopoverEl.hidden) {
          return;
        }
        const target = event.target;
        if (target instanceof Node && !settingsPopoverEl.contains(target) && target !== settingsBtnEl) {
          settingsPopoverEl.hidden = true;
          settingsBtnEl.setAttribute("aria-expanded", "false");
        }
      });
    }

    showInfoEl?.addEventListener("change", () => {
      state.showReferenceInfo = Boolean(showInfoEl.checked);
      writeStoredBoolean(STORAGE_KEYS.showReferenceInfo, state.showReferenceInfo);
      renderDetail();
      if (state.selectedReferenceId) {
        void runSearch(state.query);
      }
    });

    fontSizeSelectEl?.addEventListener("change", () => {
      state.entryFontSize = String(fontSizeSelectEl.value || "normal");
      writeStoredString(STORAGE_KEYS.entryFontSize, state.entryFontSize);
      const { detailBodyEl } = getElements();
      applyReferenceFontSize(detailBodyEl);
    });

    document.addEventListener("content:updated", () => {
      state.catalog = null;
      const section = document.getElementById("alphabet-reference-section");
      if (section && !section.hidden) {
        void ensureAlphabetReferenceSection();
      }
    });
  }

  async function loadCatalog(forceRefresh = false) {
    if (!forceRefresh && state.catalog && typeof state.catalog === "object") {
      return state.catalog;
    }

    const payload = await window.TarotDataService?.loadTextLibrary?.(true);
    state.catalog = payload && typeof payload === "object"
      ? payload
      : { meta: {}, sources: [], references: [] };
    return state.catalog;
  }

  async function ensureAlphabetReferenceSection() {
    const { detailNameEl, detailSubEl, detailBodyEl } = getElements();

    bindEvents();

    if (detailNameEl) detailNameEl.textContent = "--";
    if (detailSubEl) detailSubEl.textContent = "Select a reference to browse";
    if (detailBodyEl) detailBodyEl.replaceChildren();

    try {
      await loadCatalog();
    } catch (_error) {
      state.catalog = { meta: {}, sources: [], references: [] };
    }

    const references = getReferences();
    if (!references.some((reference) => normalizeId(reference.id) === normalizeId(state.selectedReferenceId))) {
      state.selectedReferenceId = references.length ? references[0].id : "";
      state.query = "";
      state.results = null;
      state.expandedEntryId = "";
    }

    renderReferenceList();
    renderDetail();

    if (state.selectedReferenceId) {
      void runSearch(state.query);
    }
  }

  window.AlphabetReferenceUi = {
    ensureAlphabetReferenceSection
  };
})();
