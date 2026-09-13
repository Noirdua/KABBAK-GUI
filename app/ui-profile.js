(function () {
  "use strict";

  const state = {
    initialized: false,
    loading: false,
    view: "hub",
    notesMode: "list",
    notes: [],
    quickNotes: [],
    activeNoteId: "",
    editing: false,
    kind: "waking",
    occurredOn: "",
    autoTitle: "",
    preferredDeck: "",
    filter: "all",
    scenes: [],
    saving: false,
    location: null,
    clientId: "",
    authName: "",
    displayName: "",
    journalPageMode: false,
    journalHelpers: null,
    journalView: "",
    journalOnBack: null,
    sleptAt: "",
    awokeAt: ""
  };

  let draggedSceneCard = null;
  let referenceDataPromise = null;

  function getElements() {
    return {
      hubEl: document.getElementById("profile-hub"),
      notesPanelEl: document.getElementById("profile-notes-panel"),
      notesCountEl: document.getElementById("profile-notes-count"),
      filtersEl: document.getElementById("profile-note-filters"),
      clientLabelEl: document.getElementById("profile-client-label"),
      storageUsedEl: document.getElementById("profile-storage-used"),
      storageQuotaEl: document.getElementById("profile-storage-quota"),
      storageFillEl: document.getElementById("profile-storage-fill"),
      noteListEl: document.getElementById("profile-note-list"),
      noteEditorEl: document.getElementById("profile-note-editor"),
      noteTitleEl: document.getElementById("profile-note-title"),
      noteDateEl: document.getElementById("profile-note-date"),
      sleptAtEl: document.getElementById("profile-slept-at"),
      awokeAtEl: document.getElementById("profile-awoke-at"),
      sleepRowEl: document.getElementById("profile-sleep-row"),
      sleepHoursEl: document.getElementById("profile-sleep-hours"),
      profileDeckEl: document.getElementById("profile-deck-select"),
      profileDeckStatusEl: document.getElementById("profile-deck-status"),
      cacheStatusEl: document.getElementById("profile-cache-status"),
      cacheNowBtn: document.getElementById("profile-cache-now"),
      cacheClearBtn: document.getElementById("profile-cache-clear"),
      kindDreamBtn: document.getElementById("profile-kind-dream"),
      kindWakingBtn: document.getElementById("profile-kind-waking"),
      sceneListEl: document.getElementById("profile-scene-list"),
      noteStatusEl: document.getElementById("profile-note-status"),
      noteNewBtn: document.getElementById("profile-note-new"),
      quickNoteInputEl: document.getElementById("profile-quicknote-input"),
      quickNoteTimeEl: document.getElementById("profile-quicknote-time"),
      quickNoteSaveBtn: document.getElementById("profile-quicknote-save"),
      quickNotesListEl: document.getElementById("profile-quicknotes-list"),
      quizAccuracyEl: document.getElementById("profile-quiz-accuracy"),
      quizAttemptsEl: document.getElementById("profile-quiz-attempts"),
      quizCorrectEl: document.getElementById("profile-quiz-correct"),
      quizQuestionsEl: document.getElementById("profile-quiz-questions"),
      quizCategoriesEl: document.getElementById("profile-quiz-categories"),
      quizEmptyEl: document.getElementById("profile-quiz-empty"),
      locationLatEl: document.getElementById("profile-location-lat"),
      locationLngEl: document.getElementById("profile-location-lng"),
      locationLabelEl: document.getElementById("profile-location-label"),
      locationCountryEl: document.getElementById("profile-location-country"),
      locationRegionEl: document.getElementById("profile-location-region"),
      locationCityEl: document.getElementById("profile-location-city"),
      locationDetectBtn: document.getElementById("profile-location-detect"),
      locationSaveBtn: document.getElementById("profile-location-save"),
      locationStatusEl: document.getElementById("profile-location-status"),
      displayNameEl: document.getElementById("profile-display-name"),
      displayNameSaveBtn: document.getElementById("profile-display-name-save"),
      displayNameStatusEl: document.getElementById("profile-display-name-status")
    };
  }

  function isProfileAvailable() {
    return window.TarotAppConfig?.isProfileAuthorized?.() === true;
  }

  function setStatus(text) {
    const { noteStatusEl } = getElements();
    if (noteStatusEl) {
      noteStatusEl.textContent = text;
      noteStatusEl.classList.toggle("is-error", false);
    }
  }

  function setError(text) {
    const { noteStatusEl } = getElements();
    if (noteStatusEl) {
      noteStatusEl.textContent = text;
      noteStatusEl.classList.toggle("is-error", true);
    }
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function todayDateValue() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  function nowTimeValue() {
    const now = new Date();
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  }

  function toTimeInputValue(value) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) {
      return "";
    }
    return `${pad2(Number(match[1]))}:${match[2]}`;
  }

  function parseSceneTimeToMinutes(t) {
    const v = toTimeInputValue(t);
    const m = /^(\d{2}):(\d{2})$/.exec(v);
    if (!m) return null;
    return (parseInt(m[1], 10) * 60) + parseInt(m[2], 10);
  }

  function findSceneTimeOverlap(scenes) {
    if (state.kind !== "waking") return null;
    const ranges = [];
    (Array.isArray(scenes) ? scenes : []).forEach((scene, index) => {
      const start = parseSceneTimeToMinutes(scene?.time);
      let end = parseSceneTimeToMinutes(scene?.endTime);
      if (start == null || end == null) return; // full ranges only
      if (end <= start) end += 24 * 60; // crossed midnight
      ranges.push({ index, start, end });
    });
    for (let i = 0; i < ranges.length; i += 1) {
      for (let j = i + 1; j < ranges.length; j += 1) {
        const a = ranges[i];
        const b = ranges[j];
        if (a.start < b.end && b.start < a.end) {
          return { a, b };
        }
      }
    }
    return null;
  }

  function formatDuration(mins) {
    if (mins == null || !Number.isFinite(mins) || mins < 0) return "";
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return "";
  }

  function getSceneTransition(prev, next, kind) {
    if (kind === "dream") {
      return { graphic: "✧", label: "dream sequence", deltaMins: null };
    }
    const gapStart = (prev && (prev.endTime || prev.time)) || "";
    const p = parseSceneTimeToMinutes(gapStart);
    const n = parseSceneTimeToMinutes(next && next.time);
    if (p == null || n == null) {
      return { graphic: "→", label: "later", deltaMins: null };
    }
    let delta = n - p;
    if (delta < 0) delta += 24 * 60; // crossed midnight
    const dur = formatDuration(delta);
    return {
      graphic: "●",
      label: dur ? `${dur} later` : "later",
      deltaMins: delta
    };
  }

  function formatBytes(bytes) {
    const numeric = Number(bytes);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "0 KB";
    }
    if (numeric < 1024) {
      return `${numeric} B`;
    }
    if (numeric < 1024 * 1024) {
      return `${(numeric / 1024).toFixed(1)} KB`;
    }
    return `${(numeric / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(value) {
    const parsed = new Date(String(value || ""));
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatEntryDate(value) {
    const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return formatDate(value);
    }
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function kindLabel(kind) {
    return kind === "dream" ? "Dream" : "Waking";
  }

  function buildAutoTitle(kind, occurredOn) {
    const dateLabel = formatEntryDate(occurredOn) || formatEntryDate(todayDateValue());
    return `${kindLabel(kind)} · ${dateLabel}`;
  }

  function renderStorage(storage) {
    const { storageUsedEl, storageQuotaEl, storageFillEl } = getElements();
    const usedBytes = Number(storage?.usedBytes) || 0;
    const quotaBytes = Number(storage?.quotaBytes) || 50 * 1024 * 1024;
    const percent = Math.min(100, Math.max(0, (usedBytes / quotaBytes) * 100));

    if (storageUsedEl) {
      storageUsedEl.textContent = formatBytes(usedBytes);
    }
    if (storageQuotaEl) {
      storageQuotaEl.textContent = `of ${formatBytes(quotaBytes)}`;
    }
    if (storageFillEl) {
      storageFillEl.style.width = `${percent}%`;
    }
  }

  function createEmptyScene(withNow = false) {
    return {
      id: `scene_local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      time: withNow ? nowTimeValue() : "",
      endTime: "",
      place: "",
      scenario: "",
      mood: "",
      emotion: "",
      atmosphere: "",
      steps: "",
      thoughts: "",
      notes: "",
      attachments: [],
      createdAt: new Date().toISOString()
    };
  }

  // The notebook is published as the standalone "Journal" section plugin. Open
  // that page when it is available; otherwise fall back to the in-profile view.
  function openJournalOrNotes() {
    if (document.getElementById("journal-section")) {
      window.TarotSectionStateUi?.setActiveSection?.("journal");
      return;
    }
    setView("notes");
  }

  function handleNotesBack() {
    if (state.journalPageMode) {
      if (state.journalView !== "diary" && state.notesMode === "editor") {
        closeEditor();
        return;
      }
      if (typeof state.journalOnBack === "function") {
        state.journalOnBack();
        return;
      }
      if (typeof window.TarotSectionStateUi?.goBack === "function") {
        window.TarotSectionStateUi.goBack();
      } else {
        window.TarotSectionStateUi?.setActiveSection?.("home");
      }
      return;
    }
    setView("hub");
  }

  function setView(view) {
    state.view = view === "notes" ? "notes" : "hub";
    const { hubEl, notesPanelEl } = getElements();
    if (hubEl) {
      hubEl.hidden = state.view !== "hub";
    }
    if (notesPanelEl) {
      notesPanelEl.hidden = state.view !== "notes";
    }
    if (state.view === "notes") {
      fillQuickNoteComposerTime();
    }

    // The profile head (display name editor, badges) belongs to the hub only.
    const nameEditEl = document.querySelector(".profile-name-edit");
    if (nameEditEl) {
      nameEditEl.hidden = state.view !== "hub";
    }
    const badgesEl = document.getElementById("profile-access-badges");
    if (badgesEl) {
      badgesEl.hidden = state.view !== "hub";
    }
    const profileSubEl = document.getElementById("profile-client-label");
    if (profileSubEl) {
      profileSubEl.hidden = state.view !== "hub";
    }

    if (state.view === "hub") {
      state.notesMode = "list";
      state.activeNoteId = "";
      state.editing = false;
    }
    syncNotesMode();
    populateProfileDeckSelect();
  }

  function syncNotesMode() {
    const { filtersEl, noteListEl, noteEditorEl, noteNewBtn } = getElements();
    const editing = state.notesMode === "editor";
    const diary = state.journalView === "diary";

    if (filtersEl) {
      filtersEl.hidden = diary ? false : editing;
    }
    if (noteListEl) {
      noteListEl.hidden = diary ? false : editing;
    }
    if (noteEditorEl) {
      noteEditorEl.hidden = diary ? false : !editing;
    }
    if (noteNewBtn) {
      noteNewBtn.hidden = diary || editing;
    }
    const deleteBtn = document.getElementById("profile-note-delete");
    if (deleteBtn) {
      deleteBtn.hidden = !state.editing;
    }
    syncInterpretButton();
  }

  function syncKindButtons() {
    const { kindDreamBtn, kindWakingBtn } = getElements();
    kindDreamBtn?.classList.toggle("is-active", state.kind === "dream");
    kindWakingBtn?.classList.toggle("is-active", state.kind === "waking");
  }

  function syncDateField() {
    const { noteDateEl } = getElements();
    if (noteDateEl) {
      noteDateEl.value = state.occurredOn || todayDateValue();
    }
  }

  function maybeRefreshAutoTitle() {
    const { noteTitleEl } = getElements();
    if (!noteTitleEl) {
      return;
    }
    const current = String(noteTitleEl.value || "").trim();
    if (!current || current === state.autoTitle) {
      state.autoTitle = buildAutoTitle(state.kind, state.occurredOn);
      noteTitleEl.value = state.autoTitle;
    }
  }

  function sleepDurationLabel(slept, awoke) {
    const start = parseSceneTimeToMinutes(slept);
    const end = parseSceneTimeToMinutes(awoke);
    if (start == null || end == null) {
      return "";
    }
    let mins = end - start;
    if (mins <= 0) {
      mins += 24 * 60;
    }
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  function syncSleepRow() {
    const { sleepRowEl, sleptAtEl, awokeAtEl, sleepHoursEl } = getElements();
    const isDream = state.kind === "dream";
    if (sleepRowEl) {
      sleepRowEl.hidden = !isDream;
    }
    if (sleptAtEl && sleptAtEl.value !== (state.sleptAt || "")) {
      sleptAtEl.value = state.sleptAt || "";
    }
    if (awokeAtEl && awokeAtEl.value !== (state.awokeAt || "")) {
      awokeAtEl.value = state.awokeAt || "";
    }
    if (sleepHoursEl) {
      const label = sleepDurationLabel(state.sleptAt, state.awokeAt);
      sleepHoursEl.textContent = label ? `${label} asleep` : "";
    }
    const scenesLabel = document.querySelector(".profile-scenes-label");
    const addBtn = document.getElementById("profile-scene-add");
    if (scenesLabel) {
      scenesLabel.textContent = isDream ? "Passages" : "Scenes";
    }
    if (addBtn) {
      addBtn.textContent = isDream ? "+ Passage" : "+ New Scene";
    }
  }

  let dreamSymbolTimer = null;
  let dreamSymbolRefId = "";
  let dreamSymbolCatalog = null;

  function stripHtmlText(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function dreamHaystack() {
    syncScenesFromDom();
    const title = String(document.getElementById("profile-note-title")?.value || "").trim();
    const parts = [title];
    (state.scenes || []).forEach((scene) => {
      parts.push(
        stripHtmlText(scene.thoughts),
        stripHtmlText(scene.steps),
        stripHtmlText(scene.notes),
        scene.atmosphere,
        scene.scenario,
        scene.place,
        scene.emotion
      );
    });
    return parts.filter(Boolean).join("\n");
  }

  function syncInterpretButton() {
    const btn = document.getElementById("profile-note-interpret");
    if (!btn) return;
    const isDream = state.kind === "dream";
    btn.hidden = !isDream;
    btn.disabled = !isDream || !state.editing || !state.activeNoteId;
    btn.title = btn.disabled ? "Save the dream first" : "Read matching dream symbols";
  }

  async function resolveDreamSymbolReference() {
    if (dreamSymbolCatalog?.id) {
      return dreamSymbolCatalog;
    }
    try {
      const payload = await window.TarotDataService.requestJson(
        "GET",
        window.TarotDataService.buildApiUrl("/api/v1/texts/references")
      );
      const refs = Array.isArray(payload?.references) ? payload.references : [];
      dreamSymbolCatalog = refs.find((entry) => entry.id === "dream-symbols")
        || refs.find((entry) => /dream/i.test(`${entry.id || ""} ${entry.title || ""}`))
        || null;
      dreamSymbolRefId = dreamSymbolCatalog?.id || "";
    } catch (_error) {
      dreamSymbolCatalog = null;
      dreamSymbolRefId = "";
    }
    return dreamSymbolCatalog;
  }

  async function matchDreamSymbols(limit = 12) {
    const haystack = dreamHaystack();
    const reference = await resolveDreamSymbolReference();
    const refId = reference?.id || "";
    if (!refId || !haystack) {
      return { reference, matches: [], haystack };
    }
    const payload = await window.TarotDataService.requestJson(
      "POST",
      window.TarotDataService.buildApiUrl(`/api/v1/texts/references/${encodeURIComponent(refId)}/match`),
      { text: haystack, limit }
    );
    return {
      reference: payload?.reference || reference,
      matches: Array.isArray(payload?.matches) ? payload.matches : [],
      haystack
    };
  }

  function interpretFieldConfig(reference) {
    return reference?.fieldConfig && typeof reference.fieldConfig === "object" ? reference.fieldConfig : {};
  }

  function interpretHumanize(field) {
    return String(field || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
  }

  function interpretIsTable(value) {
    return Array.isArray(value)
      && value.length
      && value.every((item) => item && typeof item === "object" && !Array.isArray(item));
  }

  function interpretFieldValue(entry, key) {
    if (!entry || typeof entry !== "object") return null;
    if (entry[key] != null && entry[key] !== "") return entry[key];
    if (key === "keyword" || key === "term") return entry.title || null;
    if (key === "summary" || key === "definition") return entry.body || null;
    return null;
  }

  function renderInterpretValue(value, fieldKey, reference) {
    if (value == null || value === "") {
      return document.createTextNode("—");
    }
    if (interpretIsTable(value)) {
      const columnConfig = interpretFieldConfig(reference)[fieldKey]?.columns || {};
      const columns = [...new Set(value.flatMap((row) => Object.keys(row || {})))]
        .filter((column) => columnConfig[column]?.visible !== false);
      const table = document.createElement("table");
      table.className = "dlc-ref-matrix";
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      columns.forEach((column) => {
        const th = document.createElement("th");
        th.textContent = columnConfig[column]?.label || interpretHumanize(column);
        headRow.appendChild(th);
      });
      head.appendChild(headRow);
      const body = document.createElement("tbody");
      value.forEach((row) => {
        const tr = document.createElement("tr");
        columns.forEach((column) => {
          const td = document.createElement("td");
          td.textContent = String(row[column] == null ? "" : row[column]);
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
      wrap.className = "profile-interpret-list";
      value.forEach((item) => {
        const row = document.createElement("div");
        row.textContent = item && typeof item === "object"
          ? Object.values(item).filter(Boolean).join(" · ")
          : String(item);
        wrap.appendChild(row);
      });
      return wrap;
    }
    if (typeof value === "object") {
      return renderInterpretValue(Object.entries(value).map(([key, val]) => `${key}: ${val}`), fieldKey, reference);
    }
    const text = document.createElement("p");
    text.textContent = String(value);
    return text;
  }

  function renderInterpretEntry(match, reference) {
    const details = document.createElement("details");
    details.className = "profile-interpret-entry";
    details.dataset.entryId = match.entryId || "";
    const summary = document.createElement("summary");
    summary.textContent = `${match.entry?.icon ? `${match.entry.icon} ` : ""}${match.title || match.entryId}`;
    details.appendChild(summary);
    const body = document.createElement("div");
    body.className = "profile-interpret-entry-body";
    const entry = match.entry && typeof match.entry === "object" ? match.entry : {};
    const config = interpretFieldConfig(reference);
    const hidden = new Set(["slug", "date", "url", "id"]);
    const keys = Object.keys(config).length ? Object.keys(config) : Object.keys(entry);
    keys.forEach((key) => {
      if (hidden.has(key) || config[key]?.visible === false) return;
      const value = interpretFieldValue(entry, key);
      if (value == null || value === "") return;
      const block = document.createElement("section");
      block.className = "alpha-reference-entry-field";
      const heading = document.createElement("strong");
      heading.textContent = config[key]?.label || interpretHumanize(key);
      block.append(heading, renderInterpretValue(value, key, reference));
      body.appendChild(block);
    });
    details.appendChild(body);
    return details;
  }

  function closeDreamInterpretation() {
    document.querySelector(".profile-interpret-overlay")?.remove();
  }

  async function openDreamInterpretation({ focusId = "", requireSaved = true } = {}) {
    if (state.kind !== "dream") return;
    if (requireSaved && (!state.editing || !state.activeNoteId)) {
      setError("Save the dream first, then Interpret.");
      return;
    }
    closeDreamInterpretation();
    const pop = document.createElement("div");
    pop.className = "dlc-settings-overlay profile-interpret-overlay";
    pop.innerHTML = `
      <div class="dlc-settings-overlay-panel">
        <div class="dlc-settings-overlay-head">
          <strong>Dream interpretation</strong>
          <button type="button" class="dlc-shop-btn" data-action="interpret-close">Close</button>
        </div>
        <div class="dlc-settings-overlay-body profile-interpret-body">Reading symbols…</div>
      </div>
    `;
    document.body.appendChild(pop);
    const close = () => pop.remove();
    pop.querySelector("[data-action='interpret-close']").addEventListener("click", close);
    pop.addEventListener("click", (event) => {
      if (event.target === pop) close();
    });
    const body = pop.querySelector(".profile-interpret-body");
    try {
      const { reference, matches } = await matchDreamSymbols(24);
      body.replaceChildren();
      if (!reference?.id) {
        body.textContent = "Install the Dream Symbols reference DLC to interpret this entry.";
        return;
      }
      if (!matches.length) {
        body.textContent = "No matching symbols in this dream yet. Name objects, animals, places, or actions.";
        return;
      }
      const intro = document.createElement("p");
      intro.className = "settings-field-hint";
      intro.textContent = `${matches.length} symbol${matches.length === 1 ? "" : "s"} from ${reference.title || "Dream Symbols"}.`;
      body.appendChild(intro);
      matches.forEach((match) => {
        const card = renderInterpretEntry(match, reference);
        if (focusId && String(match.entryId) === String(focusId)) {
          card.open = true;
        }
        body.appendChild(card);
      });
      if (!focusId && body.querySelector("details")) {
        body.querySelector("details").open = true;
      }
    } catch (error) {
      body.textContent = error?.message || "Could not interpret this dream.";
    }
  }

  async function refreshDreamSymbols() {
    const host = document.getElementById("profile-dream-symbols");
    if (!host || state.kind !== "dream") {
      if (host) host.hidden = true;
      return;
    }
    const haystack = dreamHaystack();
    if (!String(haystack || "").trim()) {
      host.hidden = true;
      host.replaceChildren();
      return;
    }
    try {
      const { matches } = await matchDreamSymbols(12);
      host.replaceChildren();
      host.hidden = matches.length === 0;
      matches.forEach((match) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "profile-dream-symbol";
        const title = document.createElement("strong");
        title.textContent = `${match.entry?.icon ? `${match.entry.icon} ` : ""}${match.title || match.entryId}`;
        const body = document.createElement("span");
        body.textContent = String(match.entry?.summary || match.entry?.body || "").slice(0, 180);
        card.append(title, body);
        card.addEventListener("click", () => {
          void openDreamInterpretation({ focusId: match.entryId, requireSaved: false });
        });
        host.appendChild(card);
      });
    } catch (_error) {
      host.hidden = true;
    }
  }

  function scheduleDreamSymbolLookup() {
    if (state.kind !== "dream") {
      return;
    }
    window.clearTimeout(dreamSymbolTimer);
    dreamSymbolTimer = window.setTimeout(() => {
      void refreshDreamSymbols();
    }, 450);
  }

  function syncDreamPrompts() {
    const el = document.getElementById("profile-dream-prompts");
    if (el) {
      el.hidden = state.kind !== "dream";
    }
    const symbols = document.getElementById("profile-dream-symbols");
    if (symbols && state.kind !== "dream") {
      symbols.hidden = true;
    }
    syncSleepRow();
    if (state.kind === "dream") {
      scheduleDreamSymbolLookup();
    }
    syncInterpretButton();
  }

  function setKind(kind) {
    state.kind = kind === "dream" ? "dream" : "waking";
    syncKindButtons();
    maybeRefreshAutoTitle();
    syncDreamPrompts();
    if (state.notesMode === "editor") {
      syncScenesFromDom();
      renderScenes();
    } else {
      refreshSceneTransitions();
      void updateSceneSkyCards();
    }
  }

  function renderScenes() {
    const { sceneListEl } = getElements();
    if (!sceneListEl) {
      return;
    }

    sceneListEl.innerHTML = "";
    if (!sceneListEl._dndBound) {
      sceneListEl._dndBound = true;
      sceneListEl.addEventListener("dragover", handleSceneDragOver);
      sceneListEl.addEventListener("drop", handleSceneDrop);
      sceneListEl.addEventListener("dragenter", (e) => e.preventDefault());
      sceneListEl.addEventListener("input", () => scheduleDreamSymbolLookup());
    }
    state.scenes.forEach((scene, index) => {
      const isDream = state.kind === "dream";
      const card = document.createElement("div");
      card.className = "profile-scene";
      card.dataset.sceneId = scene.id;

      const head = document.createElement("div");
      head.className = "profile-scene-head";
      const grip = document.createElement("span");
      grip.className = "profile-scene-drag";
      grip.textContent = "⠿";
      grip.draggable = true;
      grip.addEventListener("dragstart", (e) => handleSceneDragStart(e, card));
      grip.addEventListener("dragend", handleSceneDragEnd);
      const label = document.createElement("span");
      label.className = "profile-scene-index";
      label.textContent = isDream ? `Passage ${index + 1}` : `Scene ${index + 1}`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "profile-scene-remove";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeScene(scene.id));
      const logged = document.createElement("span");
      logged.className = "profile-scene-logged";
      const loggedLabel = formatDate(scene.createdAt);
      logged.textContent = loggedLabel ? `Logged ${loggedLabel}` : "";
      logged.title = "When this scene was written, not the scene start time";
      head.appendChild(grip);
      head.appendChild(label);
      head.appendChild(logged);
      head.appendChild(removeBtn);

      const grid = document.createElement("div");
      grid.className = "profile-scene-grid";
      if (isDream) {
        grid.appendChild(buildSceneField("Atmosphere", "scene-atmosphere", scene.atmosphere, "fog, night, empty street, gold light…"));
        grid.appendChild(buildSceneMoodField(scene.mood));
        grid.appendChild(buildSceneEmotionField(scene.emotion));
      } else {
        grid.appendChild(buildSceneTimeField(scene.time, "scene-time", "Start"));
        grid.appendChild(buildSceneTimeField(scene.endTime, "scene-end-time", "End"));
        grid.appendChild(buildSceneField("Scenario", "scene-scenario", scene.scenario, "She goes to buy shoes. An unexpected visitor walks in."));
        grid.appendChild(buildSceneField("Scenery", "scene-place", scene.place, "sun out, dogs on the sidewalk, flowers in buckets"));
        grid.appendChild(buildSceneMoodField(scene.mood));
        grid.appendChild(buildSceneEmotionField(scene.emotion));
      }

      const steps = isDream
        ? buildSceneArea("The thread", "scene-steps", scene.steps, "cafe → taxi → the alley behind…")
        : null;
      const thoughts = buildSceneArea(
        isDream ? "The dream" : "Act",
        "scene-thoughts",
        scene.thoughts,
        isDream ? "What do you remember…" : "Tell the story",
        { notesPicker: true }
      );
      const notes = buildSceneArea(
        isDream ? "Aftertaste" : "Direction",
        "scene-notes",
        scene.notes,
        isDream ? "What lingered when you woke…" : "Stage direction, asides, extra beats…",
        { notesPicker: true }
      );
      const attachments = buildSceneAttachments(scene);

      card.appendChild(head);
      card.appendChild(grid);
      if (steps) {
        card.appendChild(steps);
      }
      card.appendChild(thoughts);
      card.appendChild(notes);
      card.appendChild(attachments);
      sceneListEl.appendChild(card);

      if (index < state.scenes.length - 1) {
        const nextScene = state.scenes[index + 1];
        const trans = getSceneTransition(scene, nextScene, state.kind || "waking");
        const tEl = document.createElement("div");
        tEl.className = "scene-transition";
        tEl.innerHTML = `
          <div class="trans-meta">
            <span class="trans-graphic">${trans.graphic}</span>
            <span class="trans-label">${escapeHtml(trans.label)}</span>
            <span class="trans-hours"></span>
          </div>
          <div class="trans-horizon" hidden></div>
        `;
        sceneListEl.appendChild(tEl);
      }
    });

    // Live update transition labels when time inputs change (no full re-render)
    sceneListEl.querySelectorAll(".scene-time, .scene-end-time").forEach((inp) => {
      inp.addEventListener("input", refreshSceneTransitions);
      inp.addEventListener("change", refreshSceneTransitions);
    });
    refreshSceneTransitions();
    void updateSceneSkyCards();
    syncActiveRecordingUi();
  }

  function refreshSceneTransitions() {
    const { sceneListEl } = getElements();
    if (!sceneListEl) return;
    const cards = Array.from(sceneListEl.querySelectorAll(".profile-scene"));
    const transEls = Array.from(sceneListEl.querySelectorAll(".scene-transition"));
    for (let i = 0; i < transEls.length; i++) {
      const prevCard = cards[i];
      const nextCard = cards[i + 1];
      if (!prevCard || !nextCard) continue;
      const prevTime = prevCard.querySelector(".scene-end-time")?.value
        || prevCard.querySelector(".scene-time")?.value
        || "";
      const nextTime = nextCard.querySelector(".scene-time")?.value || "";
      const trans = getSceneTransition({ time: prevTime }, { time: nextTime }, state.kind || "waking");
      const labelEl = transEls[i].querySelector(".trans-label");
      if (labelEl) labelEl.textContent = trans.label;
    }
    void updateSceneSkyCards();
  }

  function handleSceneDragStart(e, targetCard) {
    draggedSceneCard = targetCard || e.currentTarget;
    if (draggedSceneCard && draggedSceneCard.classList.contains("profile-scene")) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedSceneCard.dataset.sceneId || "");
      setTimeout(() => draggedSceneCard.classList.add("dragging"), 0);
    } else if (draggedSceneCard) {
      // fallback if called without target
      draggedSceneCard = draggedSceneCard.closest ? draggedSceneCard.closest(".profile-scene") : null;
      if (draggedSceneCard) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", draggedSceneCard.dataset.sceneId || "");
        setTimeout(() => draggedSceneCard.classList.add("dragging"), 0);
      }
    }
  }

  function handleSceneDragEnd() {
    if (draggedSceneCard) {
      draggedSceneCard.classList.remove("dragging");
    }
    draggedSceneCard = null;
  }

  function handleSceneDragOver(e) {
    e.preventDefault();
    const container = e.currentTarget;
    if (!draggedSceneCard) return;
    const afterElement = getDragAfterSceneElement(container, e.clientY);
    if (afterElement == null) {
      container.appendChild(draggedSceneCard);
    } else {
      container.insertBefore(draggedSceneCard, afterElement);
    }
  }

  function handleSceneDrop(e) {
    e.preventDefault();
    if (draggedSceneCard) {
      draggedSceneCard.classList.remove("dragging");
    }
    draggedSceneCard = null;
    syncScenesFromDom();
    renderScenes();
  }

  function getDragAfterSceneElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".profile-scene:not(.dragging)")];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
  }

  function buildSceneTimeField(value, fieldClass = "scene-time", labelText = "Time") {
    const label = document.createElement("label");
    label.className = "profile-field";
    const span = document.createElement("span");
    span.textContent = labelText;
    const input = document.createElement("input");
    input.className = fieldClass;
    const clockValue = toTimeInputValue(value);
    if (value && !clockValue) {
      // Legacy free-text times cannot fit a time picker; keep them visible
      // and editable so they round-trip instead of being wiped on save.
      input.type = "text";
      input.placeholder = "HH:MM";
      input.value = value;
    } else {
      input.type = "time";
      input.step = "60";
      input.value = clockValue;
    }
    label.appendChild(span);
    label.appendChild(input);
    return label;
  }

  function buildSceneField(labelText, fieldClass, value, placeholder) {
    const label = document.createElement("label");
    label.className = "profile-field";
    const span = document.createElement("span");
    span.textContent = labelText;
    const input = document.createElement("input");
    input.type = "text";
    input.className = fieldClass;
    input.placeholder = placeholder;
    input.value = value || "";
    label.appendChild(span);
    label.appendChild(input);
    return label;
  }

  function getMoodCardNames() {
    const names = window.TarotCardImages?.getStandardDeckCardNames?.();
    return Array.isArray(names) && names.length ? names : [];
  }

  function normalizeSuggestionText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getMoodCardImageUrl(moodValue, explicitDeck = null) {
    if (!moodValue) return null;
    const trimmed = canonicalCardName(moodValue);
    if (!trimmed) return null;
    const names = getMoodCardNames();
    const match = names.find((n) => n.toLowerCase() === trimmed.toLowerCase());
    if (!match) return null;
    try {
      const deckArg = explicitDeck || state.preferredDeck || undefined;
      const opts = deckArg ? { deckId: deckArg } : undefined;
      return window.TarotCardImages?.resolveTarotCardImage?.(match, opts) || null;
    } catch {
      return null;
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showAttachmentPreview(att) {
    if (!att || !att.data) return;
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99999;";
    const name = escapeHtml(att.name || "attachment");
    const size = att.size ? ` (${(att.size / 1024).toFixed(1)} KB)` : "";
    modal.innerHTML = `
      <div style="background:#1a1a1a;padding:16px;border-radius:8px;max-width:92vw;max-height:92vh;overflow:auto;text-align:center;color:#eee;box-shadow:0 10px 30px rgba(0,0,0,0.6);">
        <img src="${att.data}" style="max-width:85vw;max-height:75vh;display:block;margin:0 auto 10px;border:1px solid #444;border-radius:4px;" />
        <div style="font-size:13px;opacity:0.9;">${name}${size}</div>
        <button style="margin-top:12px;padding:6px 14px;background:#333;color:#eee;border:1px solid #555;border-radius:4px;cursor:pointer;">Close</button>
      </div>
    `;
    const close = () => {
      modal.remove();
      document.removeEventListener("keydown", onEsc, true);
    };
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    const btn = modal.querySelector("button");
    if (btn) btn.addEventListener("click", close);
    const onEsc = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onEsc, true);
    document.body.appendChild(modal);
  }

  const RANK_WORD = {
    "1": "Ace", "2": "Two", "3": "Three", "4": "Four", "5": "Five",
    "6": "Six", "7": "Seven", "8": "Eight", "9": "Nine", "10": "Ten"
  };

  function canonicalCardName(raw) {
    if (!raw) return "";
    let name = String(raw).trim();
    name = name.replace(/^(\d+)\s+of\s+(.+)$/i, (_, num, suit) => {
      const word = RANK_WORD[num] || num;
      const s = suit.charAt(0).toUpperCase() + suit.slice(1).toLowerCase();
      return `${word} of ${s}`;
    });
    if (/^(knight|queen|prince|princess) of /i.test(name)) {
      name = name.replace(/^(knight|queen|prince|princess)/i, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
    }
    return name;
  }

  function setDeckStatus(text, isError = false) {
    const { profileDeckStatusEl } = getElements();
    if (!profileDeckStatusEl) return;
    profileDeckStatusEl.textContent = text;
    profileDeckStatusEl.classList.toggle("is-error", isError);
  }

  async function loadCacheStatus() {
    const { cacheStatusEl } = getElements();
    if (!cacheStatusEl) return;
    if (!window.TaroTimeCache) {
      cacheStatusEl.textContent = "Cache manager not available.";
      return;
    }
    try {
      const status = await window.TaroTimeCache.getStatus();
      if (!status.supported) {
        cacheStatusEl.textContent = "Caching is not supported in this browser.";
        return;
      }
      const parts = [status.sizeText];
      if (status.mode === "http") parts.push("browser site data");
      else if (status.controlled) parts.push("active in this session");
      else if (status.registered) parts.push("ready (takes effect after reload)");
      cacheStatusEl.textContent = `Local cache: ${parts.join(" · ")}`;
    } catch (error) {
      cacheStatusEl.textContent = `Could not read cache status. ${error?.message || ""}`;
    }
  }

  async function cacheAppNow() {
    const { cacheNowBtn, cacheStatusEl } = getElements();
    if (cacheNowBtn) cacheNowBtn.disabled = true;
    if (cacheStatusEl) {
      cacheStatusEl.textContent = "Caching app assets…";
      cacheStatusEl.classList.remove("is-error");
    }
    try {
      if (!window.TaroTimeCache) throw new Error("Cache manager not available.");
      const result = await window.TaroTimeCache.precache({
        onProgress: (cached, total) => {
          if (cacheStatusEl) {
            cacheStatusEl.textContent = `Caching… ${cached}/${total} files`;
          }
        }
      });
      await loadCacheStatus();
      const status = await window.TaroTimeCache.getStatus();
      const cachedNow = status.count || Number(result?.cached) || 0;
      if (cacheStatusEl) {
        cacheStatusEl.textContent = cachedNow
          ? `Local cache: ${cachedNow} files${status.count ? ` · ${status.sizeText}` : ""}`
          : "Caching finished, but no files were stored.";
      }
      setStatus(cachedNow
        ? `Cached ${cachedNow} files. They load from the local cache on future visits.`
        : "Caching finished, but no files were stored.");
    } catch (error) {
      if (cacheStatusEl) {
        cacheStatusEl.textContent = `Could not cache the app. ${error?.message || ""}`;
        cacheStatusEl.classList.add("is-error");
      }
      setStatus(`Could not cache the app. ${error?.message || ""}`);
    } finally {
      if (cacheNowBtn) cacheNowBtn.disabled = false;
    }
  }

  async function clearAppCache() {
    const { cacheClearBtn } = getElements();
    if (!window.confirm("Clear the local app cache? The next visit will download everything again.")) return;
    if (cacheClearBtn) cacheClearBtn.disabled = true;
    try {
      if (window.TaroTimeCache) await window.TaroTimeCache.clearCache();
      await loadCacheStatus();
      setStatus("Local app cache cleared.");
    } catch (error) {
      setStatus(`Could not clear the cache. ${error?.message || ""}`);
    } finally {
      if (cacheClearBtn) cacheClearBtn.disabled = false;
    }
  }

  function applyPreferredDeckGlobally(deckId) {
    const normalized = String(deckId || "").trim();
    if (!normalized) {
      return;
    }
    try {
      window.TarotCardImages?.setActiveDeck?.(normalized);
    } catch (_error) {}
    try {
      const settingsUi = window.TarotSettingsUi;
      const current = typeof settingsUi?.loadSavedSettings === "function"
        ? settingsUi.loadSavedSettings()
        : {};
      const normalizedSettings = typeof settingsUi?.normalizeSettings === "function"
        ? settingsUi.normalizeSettings({ ...(current || {}), tarotDeck: normalized })
        : { ...(current || {}), tarotDeck: normalized };
      document.dispatchEvent(new CustomEvent("settings:updated", {
        detail: { settings: normalizedSettings }
      }));
    } catch (_error) {}
  }

  async function savePreferredDeck(deckId) {
    const normalized = String(deckId || "").trim();
    try {
      const service = window.TarotDataService;
      const result = await service.requestJson(
        "PATCH",
        service.buildApiUrl("/api/v1/profile/preferred-deck"),
        { preferredDeck: normalized }
      );
      state.preferredDeck = String(result?.preferredDeck ?? normalized).trim();
      applyPreferredDeckGlobally(state.preferredDeck);
      setDeckStatus(state.preferredDeck
        ? `Saved: ${state.preferredDeck} (applied across the app).`
        : "Saved. Using the app default deck.");
    } catch (error) {
      setDeckStatus(`Could not save preferred deck. ${error?.message || "Please try again."}`, true);
    }
  }

  function populateProfileDeckSelect() {
    const { profileDeckEl } = getElements();
    if (!profileDeckEl) return;
    const deckOptions = window.TarotCardImages?.getDeckOptions?.() || [];
    const current = state.preferredDeck || "";
    profileDeckEl.innerHTML = "";
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "(app default)";
    profileDeckEl.appendChild(def);
    deckOptions.forEach((opt) => {
      const id = (opt && typeof opt === "object" ? opt.id : opt) || "";
      if (!id) return;
      const label = (opt && typeof opt === "object" ? (opt.label || opt.id) : opt) || id;
      const o = document.createElement("option");
      o.value = id;
      o.textContent = label;
      profileDeckEl.appendChild(o);
    });
    profileDeckEl.value = current || "";
    profileDeckEl.onchange = () => {
      void savePreferredDeck(profileDeckEl.value || "");
    };
  }

  const COURT_DATE_RANGES = {
    "Knight of Wands": { start: "11-13", end: "12-12" },
    "Queen of Disks": { start: "12-13", end: "01-09" },
    "Prince of Swords": { start: "01-10", end: "02-08" },
    "Knight of Cups": { start: "02-09", end: "03-11" },
    "Queen of Wands": { start: "03-11", end: "04-10" },
    "Prince of Disks": { start: "04-11", end: "05-10" },
    "Knight of Swords": { start: "05-11", end: "06-10" },
    "Queen of Cups": { start: "06-11", end: "07-11" },
    "Prince of Wands": { start: "07-12", end: "08-11" },
    "Knight of Disks": { start: "08-12", end: "09-11" },
    "Queen of Swords": { start: "09-12", end: "10-12" },
    "Prince of Cups": { start: "10-13", end: "11-12" }
  };

  function isMMDDInRange(mmdd, start, end) {
    if (start <= end) {
      return mmdd >= start && mmdd <= end;
    }
    return mmdd >= start || mmdd <= end;
  }

  function getCourtCardForDate(dateStr, ranges = COURT_DATE_RANGES) {
    if (!dateStr) return null;
    const m = String(dateStr).match(/(\d{2})-(\d{2})$/);
    if (!m) return null;
    const mmdd = `${m[1]}-${m[2]}`;
    for (const [card, range] of Object.entries(ranges)) {
      if (isMMDDInRange(mmdd, range.start, range.end)) {
        return card;
      }
    }
    return null;
  }

  async function getDayTarotCards(dateStr) {
    let court = getCourtCardForDate(dateStr);
    let decanTarot = null;
    let courtDecanTarots = [];
    let activeDecan = null;
    try {
      const service = window.TarotDataService;
      if (service && typeof service.loadReferenceData === "function") {
        const ref = await service.loadReferenceData();
        if (ref) {
          const tarotDb = ref.tarotDatabase || {};
          const courtRanges = tarotDb.courtDateRanges && typeof tarotDb.courtDateRanges === "object"
            ? tarotDb.courtDateRanges
            : COURT_DATE_RANGES;
          court = canonicalCardName(getCourtCardForDate(dateStr, courtRanges));

          const signs = Array.isArray(ref.signs) ? ref.signs : [];
          const decansBySign = ref.decansBySign || {};
          const allDecans = Object.values(decansBySign).flatMap(v => Array.isArray(v) ? v : []);
          const calc = window.TarotCalc;
          let decanObj = null;
          if (calc && typeof calc.getDecanForDate === "function") {
            const res = calc.getDecanForDate(new Date(dateStr), signs, decansBySign) || {};
            decanObj = res.decan || null;
          }
          decanTarot = canonicalCardName(decanObj?.tarotMinorArcana || null);
          activeDecan = decanTarot;

          const windowIds = (tarotDb.courtDecanWindows && tarotDb.courtDecanWindows[court]) || [];
          courtDecanTarots = windowIds.map((id) => {
            const d = allDecans.find((dd) => dd && dd.id === id);
            return canonicalCardName(d ? d.tarotMinorArcana : null);
          }).filter(Boolean);
        }
      }
    } catch (_) {
      // fallback to court only
    }
    return {
      court,
      decan: decanTarot,
      decans: courtDecanTarots.length ? courtDecanTarots : (decanTarot ? [decanTarot] : []),
      activeDecan
    };
  }

  async function getReferenceDataOnce() {
    if (referenceDataPromise) {
      return referenceDataPromise;
    }
    const service = window.TarotDataService;
    if (!service || typeof service.loadReferenceData !== "function") {
      referenceDataPromise = Promise.resolve(null);
      return referenceDataPromise;
    }
    referenceDataPromise = service.loadReferenceData().catch(() => null);
    return referenceDataPromise;
  }

  function buildSceneDateTime(occurredOn, timeValue) {
    const dateMatch = String(occurredOn || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = String(timeValue || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!dateMatch || !timeMatch) {
      return null;
    }
    return new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      timeMatch[3] ? Number(timeMatch[3]) : 0
    );
  }

  function computeSceneSky(sceneTime, occurredOn, geo, refData) {
    if (!geo || !refData || state.kind !== "waking") {
      return null;
    }
    const calc = window.TarotCalc;
    if (!calc || typeof calc.calcPlanetaryHoursForDayAndLocation !== "function") {
      return null;
    }
    const dateTime = buildSceneDateTime(occurredOn, sceneTime);
    if (!dateTime || Number.isNaN(dateTime.getTime())) {
      return null;
    }

    const DAY_IN_MS = calc.DAY_IN_MS || 86400000;
    const findHour = (list) => (Array.isArray(list) ? list.find((h) => dateTime >= h.start && dateTime < h.end) || null : null);

    let hours = calc.calcPlanetaryHoursForDayAndLocation(dateTime, geo);
    let hour = findHour(hours);
    let pool = Array.isArray(hours) ? hours.slice() : [];
    let yesterdayHours = null;
    let tomorrowHours = null;

    if (!hour) {
      yesterdayHours = calc.calcPlanetaryHoursForDayAndLocation(new Date(dateTime.getTime() - DAY_IN_MS), geo);
      hour = findHour(yesterdayHours);
      if (hour) {
        pool = [...yesterdayHours, ...pool];
      }
    }
    if (!hour) {
      tomorrowHours = calc.calcPlanetaryHoursForDayAndLocation(new Date(dateTime.getTime() + DAY_IN_MS), geo);
      hour = findHour(tomorrowHours);
      if (hour) {
        pool = [...pool, ...tomorrowHours];
      }
    }
    if (!hour) {
      return null;
    }

    const currentEnd = hour.end.getTime();
    let nextHour = pool.find((h) => h.start.getTime() >= currentEnd - 1000) || null;
    if (!nextHour) {
      tomorrowHours = tomorrowHours || calc.calcPlanetaryHoursForDayAndLocation(new Date(dateTime.getTime() + DAY_IN_MS), geo);
      nextHour = (tomorrowHours && tomorrowHours[0]) || null;
    }

    const planet = refData.planets?.[hour.planetId] || null;
    const nextPlanet = nextHour ? (refData.planets?.[nextHour.planetId] || null) : null;
    const tarot = planet?.tarot || null;
    return {
      planetId: hour.planetId,
      planet,
      nextPlanet,
      tarotName: tarot?.majorArcana || "",
      tarotNumber: tarot?.number != null ? tarot.number : null,
      isDaylight: hour.isDaylight === true,
      hour,
      nextHour
    };
  }

  function getSceneSkyText(sky) {
    if (!sky || !sky.planet) {
      return "";
    }
    const parts = [`${sky.planet.symbol || ""} ${sky.planet.name || sky.planetId}`];
    if (sky.tarotName) {
      parts.push(sky.tarotName);
    }
    if (sky.nextPlanet) {
      parts.push(`next ${sky.nextPlanet.name}`);
    }
    parts.push(sky.isDaylight ? "day" : "night");
    return parts.join(" · ");
  }

  function findHourContaining(dateTime, geo) {
    const calc = window.TarotCalc;
    if (!calc || typeof calc.calcPlanetaryHoursForDayAndLocation !== "function") {
      return null;
    }
    const DAY_IN_MS = calc.DAY_IN_MS || 86400000;
    const todayHours = calc.calcPlanetaryHoursForDayAndLocation(dateTime, geo);
    let hour = (Array.isArray(todayHours) ? todayHours : []).find((h) => dateTime >= h.start && dateTime < h.end) || null;
    if (hour) {
      return hour;
    }
    const yesterdayHours = calc.calcPlanetaryHoursForDayAndLocation(new Date(dateTime.getTime() - DAY_IN_MS), geo);
    hour = (Array.isArray(yesterdayHours) ? yesterdayHours : []).find((h) => dateTime >= h.start && dateTime < h.end) || null;
    if (hour) {
      return hour;
    }
    const tomorrowHours = calc.calcPlanetaryHoursForDayAndLocation(new Date(dateTime.getTime() + DAY_IN_MS), geo);
    return (Array.isArray(tomorrowHours) ? tomorrowHours : []).find((h) => dateTime >= h.start && dateTime < h.end) || null;
  }

  function computeHourSequenceBetween(startDateTime, endDateTime, geo, refData) {
    if (!geo || !refData) {
      return null;
    }
    if (!(startDateTime instanceof Date) || Number.isNaN(startDateTime.getTime())
      || !(endDateTime instanceof Date) || Number.isNaN(endDateTime.getTime())
      || endDateTime <= startDateTime) {
      return null;
    }
    const first = findHourContaining(startDateTime, geo);
    if (!first) {
      return null;
    }
    const planets = refData.planets || {};
    const list = [];
    let cursor = new Date(first.end.getTime());
    let guard = 0;
    while (cursor < endDateTime && guard < 72) {
      const hour = findHourContaining(cursor, geo);
      if (!hour) {
        break;
      }
      list.push(hour.planetId);
      cursor = new Date(hour.end.getTime());
      guard += 1;
    }
    const unique = [];
    list.forEach((id) => {
      if (unique[unique.length - 1] !== id) {
        unique.push(id);
      }
    });
    const planetList = unique.map((id) => {
      const p = planets[id] || null;
      return {
        id,
        symbol: p?.symbol || "",
        name: p?.name || id,
        tarotName: p?.tarot?.majorArcana || ""
      };
    });
    return { count: list.length, planets: planetList };
  }

  const PLANET_ORB_COLORS = {
    saturn: "#c4b896",
    jupiter: "#d4924a",
    mars: "#c45c48",
    sol: "#f0c430",
    venus: "#e8d5a3",
    mercury: "#9aa3ad",
    luna: "#dce3ea"
  };

  function formatHourSequenceText(seq) {
    if (!seq || seq.count <= 0 || !seq.planets.length) {
      return "";
    }
    const word = seq.count === 1 ? "planet" : "planets";
    return `${seq.count} ${word} passed`;
  }

  function buildPlanetHorizonHtml(seq, { pdf = false } = {}) {
    if (!seq || !Array.isArray(seq.planets) || !seq.planets.length) {
      return "";
    }
    const planets = seq.planets.slice(0, 12);
    const n = planets.length;
    const orbSize = pdf ? "9mm" : "28px";
    const nodes = planets.map((planet, index) => {
      const t = n === 1 ? 0.5 : index / (n - 1);
      const lift = Math.sin(t * Math.PI);
      const liftCss = pdf
        ? `transform:translateY(-${(lift * 8).toFixed(1)}mm)`
        : `transform:translateY(-${(lift * 14).toFixed(1)}px)`;
      const color = PLANET_ORB_COLORS[planet.id] || "#bbb";
      const tarotUrl = planet.tarotName ? getMoodCardImageUrl(planet.tarotName) : null;
      const face = tarotUrl
        ? `<img src="${tarotUrl}" alt="${escapeHtml(planet.name)}" style="width:100%;height:100%;object-fit:cover;display:block;" crossorigin="anonymous" />`
        : `<span style="font-size:${pdf ? "10px" : "13px"};line-height:1;color:#222;">${escapeHtml(planet.symbol || planet.name.slice(0, 1))}</span>`;
      return `<div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:2px;${liftCss};flex:1;min-width:0;">
        <div style="width:${orbSize};height:${orbSize};border-radius:50%;overflow:hidden;border:1px solid rgba(0,0,0,0.22);background:radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), transparent 46%), ${color};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.18);">${face}</div>
        <div style="font-size:${pdf ? "6px" : "9px"};opacity:0.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${escapeHtml(planet.name || planet.id)}</div>
      </div>`;
    }).join("");
    const lineColor = pdf ? "#888" : "var(--tt-border-soft)";
    const line = `<div style="position:absolute;left:5%;right:5%;bottom:${pdf ? "7mm" : "18px"};border-top:1.6px dotted ${lineColor};opacity:0.9;"></div>`;
    return `<div class="planet-horizon" style="position:relative;display:flex;align-items:flex-end;justify-content:space-between;min-height:${pdf ? "18mm" : "54px"};padding:${pdf ? "1mm 1mm 0" : "8px 4px 0"};">${line}${nodes}</div>`;
  }

  async function updateSceneSkyCards() {
    const { sceneListEl } = getElements();
    if (!sceneListEl) {
      return;
    }
    const cards = Array.from(sceneListEl.querySelectorAll(".profile-scene"));
    const geo = state.location;
    if (!geo || state.kind !== "waking") {
      cards.forEach((card) => {
        card.querySelector(".profile-scene-sky")?.remove();
      });
      sceneListEl.querySelectorAll(".scene-transition .trans-hours").forEach((el) => {
        el.textContent = "";
      });
      return;
    }

    const refData = await getReferenceDataOnce();
    cards.forEach((card) => {
      const timeEl = card.querySelector(".scene-time");
      const endTimeEl = card.querySelector(".scene-end-time");
      const head = card.querySelector(".profile-scene-head");
      const existing = card.querySelector(".profile-scene-sky");
      const sky = computeSceneSky(timeEl?.value || "", state.occurredOn, geo, refData);
      if (existing) {
        existing.remove();
      }
      if (!sky || !head) {
        return;
      }

      let durationText = "";
      const endValue = endTimeEl?.value || "";
      if (endValue) {
        const start = buildSceneDateTime(state.occurredOn, timeEl?.value || "");
        let end = buildSceneDateTime(state.occurredOn, endValue);
        if (start && end) {
          if (end <= start) {
            end = new Date(end.getTime() + 86400000); // crossed midnight
          }
          const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);
          const seq = computeHourSequenceBetween(start, end, geo, refData);
          const parts = [];
          if (durationMins > 0) {
            parts.push(`scene ${formatDuration(durationMins)}`);
          }
          const seqText = formatHourSequenceText(seq);
          if (seqText) {
            parts.push(seqText);
          }
          if (parts.length) {
            durationText = parts.join(" · ");
          }
        }
      }

      const imgUrl = sky.tarotName ? getMoodCardImageUrl(sky.tarotName) : null;
      const chip = document.createElement("div");
      chip.className = "profile-scene-sky";
      chip.title = sky.isDaylight ? "Planetary hour (day)" : "Planetary hour (night)";
      chip.innerHTML = `${imgUrl ? `<img src="${imgUrl}" crossorigin="anonymous" alt="" />` : ""}<span>${escapeHtml(getSceneSkyText(sky))}${durationText ? ` · ${escapeHtml(durationText)}` : ""}</span>`;
      head.insertAdjacentElement("afterend", chip);
    });

    const transEls = Array.from(sceneListEl.querySelectorAll(".scene-transition"));
    for (let i = 0; i < transEls.length; i++) {
      const hoursEl = transEls[i].querySelector(".trans-hours");
      const horizonEl = transEls[i].querySelector(".trans-horizon");
      if (!hoursEl) {
        continue;
      }
      const prevCard = cards[i];
      const nextCard = cards[i + 1];
      let text = "";
      let seq = null;
      if (prevCard && nextCard) {
        const gapStartValue = prevCard.querySelector(".scene-end-time")?.value
          || prevCard.querySelector(".scene-time")?.value
          || "";
        const gapEndValue = nextCard.querySelector(".scene-time")?.value || "";
        const start = buildSceneDateTime(state.occurredOn, gapStartValue);
        let end = buildSceneDateTime(state.occurredOn, gapEndValue);
        if (start && end && end <= start) {
          end = new Date(end.getTime() + 86400000); // crossed midnight
        }
        if (start && end && end > start) {
          seq = computeHourSequenceBetween(start, end, geo, refData);
          text = formatHourSequenceText(seq);
        }
      }
      hoursEl.textContent = text;
      if (horizonEl) {
        const html = buildPlanetHorizonHtml(seq);
        horizonEl.innerHTML = html;
        horizonEl.hidden = !html;
      }
    }
  }

  async function updateDayCardsDisplay() {
    const el = document.getElementById("profile-day-cards");
    if (!el) return;
    const cards = await getDayTarotCards(state.occurredOn);
    el.innerHTML = "";
    el.style.display = "none";

    const hasCourt = !!cards.court;
    const hasDecan = !!(cards.activeDecan || cards.decan);
    if (!hasCourt && !hasDecan) {
      return;
    }

    el.style.display = "flex";

    if (hasCourt) {
      const courtChip = document.createElement("span");
      courtChip.className = "profile-day-card";
      courtChip.innerHTML = `<span class="dc-label">Court</span><span class="dc-name">${escapeHtml(cards.court)}</span>`;
      courtChip.title = `Click to set mood to ${cards.court}`;
      courtChip.addEventListener("click", () => {
        if (state.scenes.length) {
          const target = state.scenes[0];
          if (target) {
            target.mood = cards.court;
            renderScenes();
            setStatus(`Set mood to ${cards.court} (date court card)`);
          }
        }
      });
      el.appendChild(courtChip);
    }

    if (hasDecan) {
      const decanName = cards.activeDecan || cards.decan;
      const decanChip = document.createElement("span");
      decanChip.className = "profile-day-card";
      decanChip.innerHTML = `<span class="dc-label">Decan</span><span class="dc-name">${escapeHtml(decanName)}</span>`;
      decanChip.title = `Click to set mood to ${decanName} (active for this date among ${cards.decans.join(" / ")})`;
      decanChip.addEventListener("click", () => {
        if (state.scenes.length) {
          const target = state.scenes[0];
          if (target) {
            target.mood = decanName;
            renderScenes();
            setStatus(`Set mood to ${decanName} (date decan card)`);
          }
        }
      });
      el.appendChild(decanChip);
    }
  }

  function buildSceneMoodField(value) {
    const label = document.createElement("label");
    label.className = "profile-field";
    const span = document.createElement("span");
    span.textContent = "Mood card";
    const wrap = document.createElement("span");
    wrap.className = "profile-mood-wrap";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "scene-mood";
    input.placeholder = "Which tarot card captures the mood?";
    input.autocomplete = "off";
    input.value = value || "";
    const list = document.createElement("span");
    list.className = "profile-mood-suggestions";
    list.hidden = true;
    wrap.appendChild(input);
    wrap.appendChild(list);
    label.appendChild(span);
    label.appendChild(wrap);

    function closeSuggestions() {
      list.hidden = true;
      list.innerHTML = "";
    }

    function openSuggestions() {
      const query = normalizeSuggestionText(input.value);
      if (!query) {
        closeSuggestions();
        return;
      }

      const matches = getMoodCardNames()
        .filter((name) => normalizeSuggestionText(name).includes(query))
        .slice(0, 8);
      if (!matches.length) {
        closeSuggestions();
        return;
      }

      list.innerHTML = "";
      matches.forEach((name) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "profile-mood-suggestion";
        option.textContent = name;
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        option.addEventListener("click", () => {
          input.value = name;
          closeSuggestions();
          input.focus();
        });
        list.appendChild(option);
      });
      list.hidden = false;
    }

    function moveActive(direction) {
      if (list.hidden) {
        return;
      }
      const options = Array.from(list.querySelectorAll(".profile-mood-suggestion"));
      if (!options.length) {
        return;
      }
      let index = options.findIndex((option) => option.classList.contains("is-active"));
      index = index === -1 ? (direction < 0 ? options.length : -1) : index;
      index = (index + direction + options.length) % options.length;
      options.forEach((option, optionIndex) => {
        option.classList.toggle("is-active", optionIndex === index);
      });
      options[index].scrollIntoView({ block: "nearest" });
    }

    function chooseActive() {
      const active = list.querySelector(".profile-mood-suggestion.is-active");
      if (active) {
        input.value = active.textContent || "";
        closeSuggestions();
      }
    }

    input.addEventListener("input", openSuggestions);
    input.addEventListener("focus", openSuggestions);
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      } else if (event.key === "Enter" && !list.hidden) {
        const active = list.querySelector(".profile-mood-suggestion.is-active");
        if (active) {
          event.preventDefault();
          chooseActive();
        }
      } else if (event.key === "Escape") {
        closeSuggestions();
      }
    });
    input.addEventListener("blur", () => {
      window.setTimeout(closeSuggestions, 120);
    });

    return label;
  }

  const EMOTION_VIRTUES = [
    "Chastity", "Temperance", "Charity", "Diligence", "Patience", "Kindness", "Humility"
  ];
  const EMOTION_SINS = [
    "Pride", "Greed", "Lust", "Envy", "Gluttony", "Wrath", "Sloth"
  ];

  function buildSceneEmotionField(value) {
    const label = document.createElement("label");
    label.className = "profile-field";
    const span = document.createElement("span");
    span.textContent = "Emotion";
    const select = document.createElement("select");
    select.className = "scene-emotion";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "—";
    select.appendChild(emptyOption);

    const sinsGroup = document.createElement("optgroup");
    sinsGroup.label = "☹ Frown · Seven Deadly Sins";
    EMOTION_SINS.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      sinsGroup.appendChild(option);
    });
    select.appendChild(sinsGroup);

    const virtuesGroup = document.createElement("optgroup");
    virtuesGroup.label = "☺ Smile · Seven Virtues";
    EMOTION_VIRTUES.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      virtuesGroup.appendChild(option);
    });
    select.appendChild(virtuesGroup);

    const normalizedValue = String(value || "").trim();
    if (normalizedValue
      && !EMOTION_SINS.includes(normalizedValue)
      && !EMOTION_VIRTUES.includes(normalizedValue)) {
      const customOption = document.createElement("option");
      customOption.value = normalizedValue;
      customOption.textContent = normalizedValue;
      select.appendChild(customOption);
    }
    select.value = normalizedValue || "";

    label.appendChild(span);
    label.appendChild(select);
    return label;
  }

  function insertTextIntoEditor(editor, text) {
    if (!editor || !String(text || "").trim()) {
      return;
    }
    editor.focus();
    const selection = window.getSelection();
    const range = selection && selection.rangeCount
      ? selection.getRangeAt(0)
      : document.createRange();
    if (!editor.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("insertText", false, text);
  }

  function openQuickNotePicker(anchor, editor) {
    document.querySelector(".journal-note-picker")?.remove();
    const notes = Array.isArray(state.quickNotes) ? state.quickNotes : [];
    const pop = document.createElement("div");
    pop.className = "journal-note-picker";
    if (!notes.length) {
      const empty = document.createElement("span");
      empty.textContent = "No notes yet.";
      pop.appendChild(empty);
    } else {
      notes.slice(0, 40).forEach((note) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = String(note.text || "").trim() || "(empty)";
        btn.addEventListener("click", () => {
          insertTextIntoEditor(editor, String(note.text || "").trim());
          pop.remove();
        });
        pop.appendChild(btn);
      });
    }
    document.body.appendChild(pop);
    const rect = anchor.getBoundingClientRect();
    pop.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
    pop.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 220)}px`;
    const close = (event) => {
      if (!pop.contains(event.target) && event.target !== anchor) {
        pop.remove();
        document.removeEventListener("mousedown", close);
      }
    };
    window.setTimeout(() => document.addEventListener("mousedown", close), 0);
  }

  function buildSceneArea(labelText, fieldClass, value, placeholder, options = {}) {
    const label = document.createElement("label");
    label.className = "profile-field";
    const span = document.createElement("span");
    span.textContent = labelText;

    const toolbar = document.createElement("div");
    toolbar.className = "profile-rich-toolbar";
    const richCmds = [
      { cmd: "bold", label: "B", title: "Bold" },
      { cmd: "italic", label: "I", title: "Italic" },
      { cmd: "underline", label: "U", title: "Underline" },
      { cmd: "strikeThrough", label: "S", title: "Strikethrough" },
      { cmd: "justifyLeft", label: "L", title: "Left align" },
      { cmd: "justifyCenter", label: "C", title: "Center" },
      { cmd: "justifyRight", label: "R", title: "Right align" }
    ];
    richCmds.forEach(({ cmd, label: btnLabel, title }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = btnLabel;
      btn.title = title || cmd;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const ed = label.querySelector("." + fieldClass);
        if (ed) {
          ed.focus();
          document.execCommand(cmd, false, null);
        }
      });
      toolbar.appendChild(btn);
    });

    // Color picker for text
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.title = "Text color";
    colorInput.style.width = "22px";
    colorInput.style.height = "16px";
    colorInput.style.padding = "0";
    colorInput.style.border = "1px solid #4c3d7a";
    colorInput.style.verticalAlign = "middle";
    colorInput.addEventListener("input", (e) => {
      e.preventDefault();
      const ed = label.querySelector("." + fieldClass);
      if (ed) {
        ed.focus();
        document.execCommand("foreColor", false, e.target.value);
      }
    });
    toolbar.appendChild(colorInput);

    // Quote
    const quoteBtn = document.createElement("button");
    quoteBtn.type = "button";
    quoteBtn.textContent = "❝";
    quoteBtn.title = "Blockquote";
    quoteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const ed = label.querySelector("." + fieldClass);
      if (ed) {
        ed.focus();
        document.execCommand("formatBlock", false, "blockquote");
      }
    });
    toolbar.appendChild(quoteBtn);

    // Inline code
    const codeBtn = document.createElement("button");
    codeBtn.type = "button";
    codeBtn.textContent = "<>";
    codeBtn.title = "Inline code";
    codeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const ed = label.querySelector("." + fieldClass);
      if (!ed) return;
      ed.focus();
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const selectedText = range.toString();
        const codeEl = document.createElement("code");
        if (selectedText) {
          codeEl.textContent = selectedText;
          range.deleteContents();
          range.insertNode(codeEl);
          const newRange = document.createRange();
          newRange.selectNodeContents(codeEl);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else {
          codeEl.textContent = "code";
          range.insertNode(codeEl);
        }
      }
    });
    toolbar.appendChild(codeBtn);

    // Code block (pre)
    const preBtn = document.createElement("button");
    preBtn.type = "button";
    preBtn.textContent = "pre";
    preBtn.title = "Code block";
    preBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const ed = label.querySelector("." + fieldClass);
      if (ed) {
        ed.focus();
        document.execCommand("formatBlock", false, "pre");
      }
    });
    toolbar.appendChild(preBtn);

    // Clear formatting
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = "⌫";
    clearBtn.title = "Remove formatting";
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const ed = label.querySelector("." + fieldClass);
      if (ed) {
        ed.focus();
        document.execCommand("removeFormat", false, null);
      }
    });
    toolbar.appendChild(clearBtn);

    if (options.notesPicker) {
      const noteBtn = document.createElement("button");
      noteBtn.type = "button";
      noteBtn.textContent = "Note";
      noteBtn.title = "Insert a saved note";
      noteBtn.addEventListener("click", (event) => {
        event.preventDefault();
        const ed = label.querySelector("." + fieldClass);
        if (ed) {
          openQuickNotePicker(noteBtn, ed);
        }
      });
      toolbar.appendChild(noteBtn);
    }

    const editor = document.createElement("div");
    editor.className = fieldClass;
    editor.contentEditable = "true";
    editor.setAttribute("data-placeholder", placeholder);
    if (value && /<[^>]+>/.test(value)) {
      editor.innerHTML = value;
    } else if (value) {
      editor.innerHTML = escapeHtml(value).replace(/\n/g, "<br>");
    } else {
      editor.innerHTML = "";
    }

    // Quick notes can be dragged from the Quick Notes list and dropped here.
    editor.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types?.includes?.("application/x-quicknote") && !event.dataTransfer?.types?.includes?.("text/plain")) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      editor.classList.add("is-drop-target");
    });
    editor.addEventListener("dragleave", (event) => {
      if (!editor.contains(event.relatedTarget)) {
        editor.classList.remove("is-drop-target");
      }
    });
    editor.addEventListener("drop", (event) => {
      event.preventDefault();
      editor.classList.remove("is-drop-target");
      let payload = "";
      try {
        const raw = event.dataTransfer?.getData?.("application/x-quicknote") || "";
        if (raw) {
          const data = JSON.parse(raw);
          payload = `${data.timeText ? `[${data.timeText}] ` : ""}${data.text || ""}${data.skyText ? `\n${data.skyText}` : ""}`;
        } else {
          payload = event.dataTransfer?.getData?.("text/plain") || "";
        }
      } catch (_error) {
        payload = event.dataTransfer?.getData?.("text/plain") || "";
      }
      if (!payload.trim()) return;
      editor.focus();
      const selection = window.getSelection();
      const range = selection && selection.rangeCount
        ? selection.getRangeAt(0)
        : document.createRange();
      if (!editor.contains(range.commonAncestorContainer)) {
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("insertText", false, payload);
    });

    label.appendChild(span);
    label.appendChild(toolbar);
    label.appendChild(editor);
    return label;
  }

  let activeRecording = null; // { sceneId, recorder, chunks, timer, seconds, stream }

  function formatRecordingTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function appendFileAttachment(scene, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large (max 5MB per attachment)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const att = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        data: e.target.result
      };
      if (!Array.isArray(scene.attachments)) scene.attachments = [];
      scene.attachments.push(att);
      renderScenes();
    };
    reader.readAsDataURL(file);
  }

  function stopActiveRecording() {
    if (!activeRecording) return;
    const recording = activeRecording;
    activeRecording = null;
    window.clearInterval(recording.timer);
    if (recording.recorder && recording.recorder.state !== "inactive") {
      recording.recorder.stop();
    }
    if (recording.stream) {
      recording.stream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
    }
    syncActiveRecordingUi();
  }

  function startRecording(scene) {
    if (activeRecording) {
      alert("A recording is already in progress in another scene.");
      return;
    }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert("Audio recording is not supported in this browser.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const mimeType = MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : (MediaRecorder.isTypeSupported?.("audio/mp4") ? "audio/mp4" : "");
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        const chunks = [];
        let seconds = 0;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        recorder.onstop = () => {
          window.clearInterval(activeRecording?.timer);
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const file = new File([blob], `recording-${stamp}.${(recorder.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm"}`, {
            type: recorder.mimeType || "audio/webm"
          });
          appendFileAttachment(scene, file);
        };

        activeRecording = {
          sceneId: scene.id,
          recorder,
          stream,
          timer: null,
          seconds: 0
        };
        recorder.start(1000);
        activeRecording.timer = window.setInterval(() => {
          if (!activeRecording) return;
          activeRecording.seconds += 1;
          syncActiveRecordingUi();
          // Hard cap: stop after 60s to stay inside attachment limits.
          if (activeRecording.seconds >= 60) {
            stopActiveRecording();
          }
        }, 1000);
        syncActiveRecordingUi();
      })
      .catch(() => {
        alert("Microphone access was denied or unavailable.");
      });
  }

  function syncActiveRecordingUi() {
    const { sceneListEl } = getElements();
    if (!sceneListEl) return;
    const buttons = sceneListEl.querySelectorAll(".att-record-btn");
    buttons.forEach((btn) => {
      const sceneId = btn.closest(".profile-scene")?.dataset.sceneId || "";
      if (activeRecording && activeRecording.sceneId === sceneId) {
        btn.classList.add("is-recording");
        btn.textContent = `⏹ Stop ${formatRecordingTime(activeRecording.seconds)}`;
      } else {
        btn.classList.remove("is-recording");
        btn.textContent = "🎙 Record";
      }
    });
  }

  function openWebcamCapture(scene) {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Camera access is not supported in this browser.");
      return;
    }
    const modal = document.createElement("div");
    modal.className = "profile-cam-modal";
    modal.innerHTML = `
      <div class="profile-cam-card">
        <strong>Take a photo</strong>
        <video class="profile-cam-video" autoplay playsinline muted></video>
        <div class="profile-cam-actions">
          <button type="button" class="profile-btn profile-btn-primary" data-action="capture">Capture</button>
          <button type="button" class="profile-btn" data-action="cancel">Cancel</button>
        </div>
      </div>
    `;
    const video = modal.querySelector(".profile-cam-video");
    let stream = null;

    const close = () => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          try { track.stop(); } catch {}
        });
      }
      modal.remove();
      document.removeEventListener("keydown", onEsc, true);
    };
    const onEsc = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onEsc, true);

    modal.querySelector('[data-action="cancel"]').addEventListener("click", close);
    modal.querySelector('[data-action="capture"]').addEventListener("click", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        close();
        if (!blob) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const file = new File([blob], `webcam-${stamp}.png`, { type: "image/png" });
        appendFileAttachment(scene, file);
      }, "image/png");
    });

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      .then((mediaStream) => {
        stream = mediaStream;
        video.srcObject = mediaStream;
        void video.play().catch(() => {});
      })
      .catch(() => {
        close();
        alert("Camera access was denied or unavailable.");
      });

    document.body.appendChild(modal);
  }

  function buildSceneAttachments(scene) {
    const container = document.createElement("div");
    container.className = "profile-field profile-attachments";
    const span = document.createElement("span");
    span.textContent = "Attachments";
    const list = document.createElement("div");
    list.className = "attachment-list";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "profile-btn profile-attachment-btn";
    addBtn.textContent = "+ Attach file";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    addBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      Array.from(fileInput.files || []).forEach((file) => {
        appendFileAttachment(scene, file);
      });
      fileInput.value = "";
    });

    // Camera: native capture on touch devices, webcam modal on desktop.
    const cameraBtn = document.createElement("button");
    cameraBtn.type = "button";
    cameraBtn.className = "profile-btn profile-attachment-btn";
    cameraBtn.textContent = "📷 Camera";
    cameraBtn.title = "Take a photo (camera on mobile, webcam on desktop)";
    const captureInput = document.createElement("input");
    captureInput.type = "file";
    captureInput.accept = "image/*";
    captureInput.setAttribute("capture", "environment");
    captureInput.style.display = "none";
    cameraBtn.addEventListener("click", () => {
      const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
      if (isTouch) {
        captureInput.click();
      } else {
        openWebcamCapture(scene);
      }
    });
    captureInput.addEventListener("change", () => {
      Array.from(captureInput.files || []).forEach((file) => {
        appendFileAttachment(scene, file);
      });
      captureInput.value = "";
    });

    // Audio recording.
    const recordBtn = document.createElement("button");
    recordBtn.type = "button";
    recordBtn.className = "profile-btn profile-attachment-btn att-record-btn";
    recordBtn.textContent = "🎙 Record";
    recordBtn.title = "Record an audio note (max 60 seconds)";
    recordBtn.addEventListener("click", () => {
      if (activeRecording && activeRecording.sceneId === scene.id) {
        stopActiveRecording();
      } else {
        startRecording(scene);
      }
    });

    function renderList() {
      list.innerHTML = "";
      const atts = Array.isArray(scene.attachments) ? scene.attachments : [];
      atts.forEach((att, idx) => {
        const item = document.createElement("div");
        item.className = "attachment-item";
        let preview = "";
        if (att.type && att.type.startsWith("image/") && att.data) {
          preview = `<img src="${att.data}" style="max-height:36px; max-width:50px; vertical-align:middle; margin-right:4px; border:1px solid #ccc; border-radius:2px; cursor:pointer;" />`;
        } else if (att.type && att.type.startsWith("audio/") && att.data) {
          preview = `<audio src="${att.data}" controls style="max-width:180px; height:28px; vertical-align:middle; margin-right:4px;"></audio>`;
        }
        item.innerHTML = `
          ${preview}
          <span class="att-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)} (${(att.size / 1024).toFixed(1)}KB)</span>
          <button type="button" class="profile-scene-remove" style="margin-left:4px; font-size:11px;">×</button>
        `;
        const del = item.querySelector("button");
        del.addEventListener("click", () => {
          scene.attachments.splice(idx, 1);
          renderScenes();
        });
        const imgEl = item.querySelector("img");
        if (imgEl) {
          imgEl.addEventListener("click", (e) => {
            e.stopPropagation();
            showAttachmentPreview(att);
          });
        }
        const nameEl = item.querySelector(".att-name");
        if (nameEl) {
          nameEl.style.cursor = "pointer";
          nameEl.addEventListener("click", () => showAttachmentPreview(att));
        }
        list.appendChild(item);
      });
      if (atts.length === 0) {
        const empty = document.createElement("span");
        empty.style.fontSize = "11px";
        empty.style.color = "#888";
        empty.textContent = "No attachments yet";
        list.appendChild(empty);
      }
    }
    renderList();
    const actions = document.createElement("div");
    actions.className = "profile-attachment-actions";
    actions.appendChild(addBtn);
    actions.appendChild(cameraBtn);
    actions.appendChild(recordBtn);
    actions.appendChild(fileInput);
    actions.appendChild(captureInput);
    container.appendChild(span);
    container.appendChild(list);
    container.appendChild(actions);
    return container;
  }

  function syncScenesFromDom() {
    const { sceneListEl } = getElements();
    if (!sceneListEl) {
      return;
    }

    const cards = Array.from(sceneListEl.querySelectorAll(".profile-scene"));
    if (!cards.length) {
      state.scenes = [];
      return;
    }

    state.scenes = cards.map((card) => {
      const existing = state.scenes.find((scene) => scene.id === card.dataset.sceneId) || {};
      const timeEl = card.querySelector(".scene-time");
      const endTimeEl = card.querySelector(".scene-end-time");
      const placeEl = card.querySelector(".scene-place");
      const stepsEl = card.querySelector(".scene-steps");
      const atmosphereEl = card.querySelector(".scene-atmosphere");
      return {
        id: String(card.dataset.sceneId || "").trim() || createEmptyScene().id,
        time: timeEl
          ? (timeEl.type === "text"
            ? String(timeEl.value || "").trim()
            : toTimeInputValue(timeEl?.value || ""))
          : (existing.time || ""),
        endTime: endTimeEl
          ? (endTimeEl.type === "text"
            ? String(endTimeEl.value || "").trim()
            : toTimeInputValue(endTimeEl?.value || ""))
          : (existing.endTime || ""),
        place: placeEl ? String(placeEl.value || "").trim() : (existing.place || ""),
        scenario: card.querySelector(".scene-scenario")
          ? String(card.querySelector(".scene-scenario").value || "").trim()
          : (existing.scenario || ""),
        mood: canonicalCardName(String(card.querySelector(".scene-mood")?.value || "").trim()),
        emotion: String(card.querySelector(".scene-emotion")?.value || "").trim(),
        atmosphere: atmosphereEl ? String(atmosphereEl.value || "").trim() : (existing.atmosphere || ""),
        steps: stepsEl ? String(stepsEl.innerHTML || "") : (existing.steps || ""),
        thoughts: String(card.querySelector(".scene-thoughts")?.innerHTML || ""),
        notes: String(card.querySelector(".scene-notes")?.innerHTML || ""),
        attachments: existing.attachments || [],
        createdAt: existing.createdAt || ""
      };
    });
  }

  function addScene() {
    syncScenesFromDom();
    state.scenes.push(createEmptyScene(state.kind !== "dream"));
    renderScenes();
    setStatus("");
  }

  function removeScene(sceneId) {
    syncScenesFromDom();
    if (state.scenes.length <= 1) {
      setError("An entry needs at least one scene.");
      return;
    }
    state.scenes = state.scenes.filter((scene) => scene.id !== sceneId);
    renderScenes();
  }

  function collectScenes() {
    syncScenesFromDom();
    return state.scenes;
  }

  function visibleNotes() {
    if (state.filter === "dream" || state.filter === "waking") {
      return state.notes.filter((note) => note.kind === state.filter);
    }
    return state.notes;
  }

  function toDatetimeLocalValue(isoValue) {
    const date = isoValue ? new Date(isoValue) : new Date();
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function fromDatetimeLocalValue(value) {
    const parsed = new Date(String(value || ""));
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    return parsed.toISOString();
  }

  function fillQuickNoteComposerTime() {
    const { quickNoteTimeEl } = getElements();
    if (quickNoteTimeEl && !quickNoteTimeEl.value) {
      quickNoteTimeEl.value = toDatetimeLocalValue();
    }
  }

  async function captureSkyAt(isoValue) {
    if (!state.location) {
      return null;
    }
    try {
      const service = window.TarotDataService;
      const snapshot = await service.requestJson("GET", service.buildApiUrl("/api/v1/now", {
        latitude: state.location.latitude,
        longitude: state.location.longitude,
        ...(isoValue ? { date: isoValue } : {})
      }));
      const hour = snapshot?.currentHour || null;
      const positions = Array.isArray(snapshot?.stats?.planetPositions) ? snapshot.stats.planetPositions : [];
      return {
        hourPlanet: String(hour?.planet?.name || ""),
        hourTarot: String(hour?.planet?.tarot?.majorArcana || ""),
        isDaylight: hour?.isDaylight === true,
        summary: positions.slice(0, 8).map((entry) => `${entry.symbol || ""} ${entry.sign?.name || ""} ${Number(entry.degreeInSign).toFixed(1)}°`).join(" · ")
      };
    } catch (_error) {
      return null;
    }
  }

  function quickNoteDayKey(isoValue) {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
  }

  function quickNoteDayLabel(isoValue) {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return "Notes";
    const today = new Date();
    const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const key = quickNoteDayKey(isoValue);
    if (key === todayKey) return "Today";
    if (key === yesterday.toISOString()) return "Yesterday";
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function quickNoteSkyText(note) {
    if (!note?.sky) return "";
    return [note.sky.hourPlanet, note.sky.hourTarot, note.sky.summary].filter(Boolean).join(" · ");
  }

  function openQuickNoteDetail(note) {
    const overlayApi = window.TaroOverlay;
    if (!overlayApi?.open) return;

    const body = document.createElement("div");
    body.className = "journal-quicknote-detail";

    const timeLabel = document.createElement("label");
    timeLabel.className = "journal-field";
    timeLabel.textContent = "When";
    const timeInput = document.createElement("input");
    timeInput.type = "datetime-local";
    timeInput.value = toDatetimeLocalValue(note.createdAt);
    timeLabel.appendChild(timeInput);

    const textLabel = document.createElement("label");
    textLabel.className = "journal-field";
    textLabel.textContent = "Note";
    const textArea = document.createElement("textarea");
    textArea.rows = 4;
    textArea.maxLength = 1000;
    textArea.value = note.text || "";
    textLabel.appendChild(textArea);

    body.append(timeLabel, textLabel);

    const skyText = quickNoteSkyText(note);
    if (skyText) {
      const skyEl = document.createElement("p");
      skyEl.className = "journal-quicknote-sky";
      skyEl.textContent = skyText;
      body.appendChild(skyEl);
    }

    let controller = null;
    controller = overlayApi.open({
      title: "Quick note",
      body,
      size: "small",
      actions: [
        {
          label: "Delete",
          danger: true,
          closeOnClick: false,
          onClick: async () => {
            await deleteQuickNote(note.id);
            controller?.close();
          }
        },
        {
          label: "Save",
          primary: true,
          closeOnClick: false,
          onClick: async () => {
            const nextIso = fromDatetimeLocalValue(timeInput.value);
            const changes = { text: textArea.value };
            if (nextIso && nextIso !== note.createdAt) {
              changes.createdAt = nextIso;
              changes.recalcSky = true;
            }
            await updateQuickNote(note.id, changes);
            controller?.close();
          }
        },
        { label: "Close" }
      ]
    });
  }

  function renderQuickNotes() {
    const { quickNotesListEl } = getElements();
    if (!quickNotesListEl) return;
    const notes = Array.isArray(state.quickNotes) ? [...state.quickNotes] : [];
    notes.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    quickNotesListEl.innerHTML = "";

    if (!notes.length) {
      const empty = document.createElement("span");
      empty.className = "profile-quicknote-empty";
      empty.textContent = "No quick notes yet — jot something down above.";
      quickNotesListEl.appendChild(empty);
      return;
    }

    const table = document.createElement("div");
    table.className = "journal-quicknotes-table";
    table.setAttribute("role", "table");

    let currentDayKey = "";
    notes.forEach((note) => {
      const dayKey = quickNoteDayKey(note.createdAt);
      if (dayKey !== currentDayKey) {
        currentDayKey = dayKey;
        const header = document.createElement("div");
        header.className = "journal-quicknotes-day";
        header.setAttribute("role", "row");
        header.textContent = quickNoteDayLabel(note.createdAt);
        table.appendChild(header);
      }

      const time = new Date(note.createdAt);
      const timeText = Number.isNaN(time.getTime())
        ? ""
        : time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      const skyText = quickNoteSkyText(note);
      const noteText = String(note.text || "");

      const row = document.createElement("div");
      row.className = "journal-quicknotes-row";
      row.setAttribute("role", "row");

      const timeEl = document.createElement("span");
      timeEl.className = "journal-quicknotes-time";
      timeEl.textContent = timeText;

      const iconBtn = document.createElement("button");
      iconBtn.type = "button";
      iconBtn.className = "journal-quicknotes-icon";
      iconBtn.title = "Open quick note";
      iconBtn.setAttribute("aria-label", `Open quick note${timeText ? ` from ${timeText}` : ""}`);
      iconBtn.textContent = "🗒";
      iconBtn.addEventListener("click", () => openQuickNoteDetail(note));

      const textEl = document.createElement("span");
      textEl.className = "journal-quicknotes-text";
      textEl.textContent = noteText;
      textEl.title = skyText ? `${noteText}\n${skyText}` : noteText;

      row.append(timeEl, iconBtn, textEl);

      // Drag a note into any scene's Thoughts or Notes editor.
      row.draggable = true;
      row.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-quicknote", JSON.stringify({ text: noteText, timeText, skyText }));
        event.dataTransfer.setData("text/plain", `${timeText ? `[${timeText}] ` : ""}${noteText}`);
        row.classList.add("is-dragging");
      });
      row.addEventListener("dragend", () => row.classList.remove("is-dragging"));

      table.appendChild(row);
    });

    quickNotesListEl.appendChild(table);
  }

  async function saveQuickNote() {
    const { quickNoteInputEl, quickNoteTimeEl, quickNoteSaveBtn } = getElements();
    const text = String(quickNoteInputEl?.value || "").trim();
    if (!text) {
      setStatus("Write a quick note first.");
      return;
    }
    fillQuickNoteComposerTime();
    const createdAt = fromDatetimeLocalValue(quickNoteTimeEl?.value) || new Date().toISOString();
    const sky = await captureSkyAt(createdAt);

    if (quickNoteSaveBtn) quickNoteSaveBtn.disabled = true;
    try {
      const service = window.TarotDataService;
      const result = await service.requestJson(
        "POST",
        service.buildApiUrl("/api/v1/profile/quick-notes"),
        { text, sky, createdAt }
      );
      state.quickNotes = Array.isArray(result?.quickNotes)
        ? result.quickNotes
        : [result?.quickNote, ...state.quickNotes].filter(Boolean);
      if (quickNoteInputEl) quickNoteInputEl.value = "";
      fillQuickNoteComposerTime();
      if (quickNoteTimeEl) quickNoteTimeEl.value = toDatetimeLocalValue();
      renderQuickNotes();
      setStatus("Quick note saved.");
    } catch (error) {
      setStatus(`Could not save quick note. ${error?.message || ""}`);
    } finally {
      if (quickNoteSaveBtn) quickNoteSaveBtn.disabled = false;
    }
  }

  async function updateQuickNote(quickNoteId, changes = {}) {
    const existing = (state.quickNotes || []).find((note) => note.id === quickNoteId);
    if (!existing) {
      return;
    }
    const nextText = changes.text !== undefined ? String(changes.text || "").trim() : existing.text;
    if (!nextText) {
      setStatus("Quick note text is required.");
      return;
    }
    const nextCreatedAt = changes.createdAt || existing.createdAt;
    let nextSky = existing.sky;
    if (changes.recalcSky === true) {
      setStatus("Recalculating planet degrees…");
      nextSky = await captureSkyAt(nextCreatedAt);
    }
    try {
      const service = window.TarotDataService;
      const result = await service.requestJson(
        "PUT",
        service.buildApiUrl(`/api/v1/profile/quick-notes/${encodeURIComponent(quickNoteId)}`),
        { text: nextText, createdAt: nextCreatedAt, sky: nextSky }
      );
      const updated = result?.quickNote;
      if (updated) {
        state.quickNotes = (state.quickNotes || []).map((note) => note.id === quickNoteId ? updated : note);
      }
      renderQuickNotes();
      setStatus(changes.recalcSky === true ? "Time updated — planet degrees recalculated." : "Quick note updated.");
    } catch (error) {
      setStatus(`Could not update quick note. ${error?.message || ""}`);
    }
  }

  async function deleteQuickNote(quickNoteId) {
    try {
      const service = window.TarotDataService;
      await service.requestJson(
        "DELETE",
        service.buildApiUrl(`/api/v1/profile/quick-notes/${encodeURIComponent(quickNoteId)}`)
      );
      state.quickNotes = state.quickNotes.filter((note) => note.id !== quickNoteId);
      renderQuickNotes();
      setStatus("Quick note deleted.");
    } catch (error) {
      setStatus(`Could not delete quick note. ${error?.message || ""}`);
    }
  }

  function renderNoteFilters() {    const { filtersEl } = getElements();
    if (!filtersEl) {
      return;
    }
    Array.from(filtersEl.querySelectorAll("[data-filter]")).forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === state.filter);
    });
  }

  function renderNoteList() {
    const { noteListEl, notesCountEl } = getElements();
    const total = state.notes.length;
    if (notesCountEl) {
      notesCountEl.textContent = total === 1 ? "1 entry" : `${total} entries`;
    }
    if (!noteListEl) {
      return;
    }

    noteListEl.innerHTML = "";
    const notes = visibleNotes();

    if (!notes.length) {
      const empty = document.createElement("div");
      empty.className = "profile-note-empty";
      empty.textContent = total
        ? "No entries in this view yet."
        : "No entries yet. Start with a dream or waking note.";
      noteListEl.appendChild(empty);
      return;
    }

    notes.forEach((note) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "profile-note-card";
      if (note.id === state.activeNoteId) {
        button.classList.add("is-active");
      }

      const top = document.createElement("span");
      top.className = "profile-note-card-top";
      const badge = document.createElement("span");
      badge.className = `profile-kind-badge is-${note.kind === "dream" ? "dream" : "waking"}`;
      badge.textContent = kindLabel(note.kind);
      const date = document.createElement("span");
      date.className = "profile-note-card-date";
      date.textContent = formatEntryDate(note.occurredOn) || formatDate(note.updatedAt);
      top.appendChild(badge);
      top.appendChild(date);

      const title = document.createElement("span");
      title.className = "profile-note-card-title";
      title.textContent = note.title || "Untitled";

      const meta = document.createElement("span");
      meta.className = "profile-note-card-meta";
      const sceneCount = Number(note.sceneCount) || 1;
      let metaText = `${sceneCount} scene${sceneCount === 1 ? "" : "s"}`;
      const attCount = Number(note.attachmentCount) || 0;
      if (attCount > 0) {
        metaText += ` • ${attCount} attach${attCount === 1 ? "" : "s"}`;
      }
      meta.textContent = metaText;

      button.appendChild(top);
      button.appendChild(title);
      button.appendChild(meta);
      button.addEventListener("click", () => {
        state.activeNoteId = note.id;
        state.editing = true;
        void loadNoteIntoEditor(note.id);
      });
      noteListEl.appendChild(button);
    });
  }

  function renderQuizProgress(progress) {
    const {
      quizAccuracyEl,
      quizAttemptsEl,
      quizCorrectEl,
      quizQuestionsEl,
      quizCategoriesEl,
      quizEmptyEl
    } = getElements();

    const overall = progress?.stats?.overall || {};
    const attempts = Number(progress?.count) || 0;

    if (quizEmptyEl) {
      quizEmptyEl.hidden = attempts > 0;
    }

    if (quizAccuracyEl) {
      quizAccuracyEl.textContent = overall.accuracy != null ? `${Math.round(overall.accuracy * 100)}%` : "--";
    }
    if (quizAttemptsEl) {
      quizAttemptsEl.textContent = String(overall.attempts ?? attempts);
    }
    if (quizCorrectEl) {
      quizCorrectEl.textContent = String(overall.totalCorrect ?? 0);
    }
    if (quizQuestionsEl) {
      quizQuestionsEl.textContent = String(overall.totalQuestions ?? 0);
    }

    if (quizCategoriesEl) {
      quizCategoriesEl.innerHTML = "";
      const categories = Array.isArray(progress?.stats?.categories) ? progress.stats.categories : [];
      categories.forEach((category) => {
        const row = document.createElement("div");
        row.className = "profile-quiz-category";

        const label = document.createElement("span");
        label.className = "profile-quiz-category-label";
        label.textContent = category.categoryId || "General";

        const bar = document.createElement("span");
        bar.className = "profile-quiz-category-bar";
        const fill = document.createElement("span");
        fill.className = "profile-quiz-category-fill";
        fill.style.width = `${Math.round((category.accuracy || 0) * 100)}%`;
        bar.appendChild(fill);

        const value = document.createElement("span");
        value.className = "profile-quiz-category-value";
        value.textContent = `${Math.round((category.accuracy || 0) * 100)}% (${category.totalCorrect}/${category.totalQuestions})`;

        row.appendChild(label);
        row.appendChild(bar);
        row.appendChild(value);
        quizCategoriesEl.appendChild(row);
      });
    }
  }

  async function openEditor() {
    const { noteTitleEl } = getElements();
    state.notesMode = "editor";
    if (noteTitleEl && !String(noteTitleEl.value || "").trim()) {
      state.autoTitle = buildAutoTitle(state.kind, state.occurredOn);
      noteTitleEl.value = state.autoTitle;
    }
    syncKindButtons();
    syncDateField();
    renderScenes();
    syncNotesMode();
    syncDreamPrompts();
    populateProfileDeckSelect();
    await updateDayCardsDisplay();
    setStatus("");

    // Attach export listener defensively (in case init ran before button or cached bundle)
    const expBtn = document.getElementById("profile-note-export-pdf");
    if (expBtn && !expBtn._pdfExportBound) {
      expBtn._pdfExportBound = true;
      expBtn.addEventListener("click", () => void exportCurrentNoteAsPdf());
    }
  }

  async function loadNoteIntoEditor(noteId) {
    let note = null;
    try {
      const service = window.TarotDataService;
      note = await service.requestJson(
        "GET",
        service.buildApiUrl(`/api/v1/profile/notes/${encodeURIComponent(noteId)}`)
      );
    } catch (error) {
      setError(`Could not load the entry. ${error?.message || "Please try again."}`);
      return;
    }

    // The user may have picked a different entry (or started a new one) while
    // this request was in flight; never apply a stale response.
    if (state.activeNoteId !== noteId || !state.editing) {
      return;
    }

    state.kind = note?.kind === "dream" ? "dream" : "waking";
    state.occurredOn = String(note?.occurredOn || "").trim() || todayDateValue();
    state.sleptAt = String(note?.sleptAt || "").trim();
    state.awokeAt = String(note?.awokeAt || "").trim();
    state.scenes = Array.isArray(note?.scenes) && note.scenes.length
      ? note.scenes.map((scene) => ({ 
          ...scene, 
          mood: canonicalCardName(scene?.mood),
          emotion: String(scene?.emotion || ""),
          atmosphere: String(scene?.atmosphere || ""),
          steps: String(scene?.steps || ""),
          endTime: String(scene?.endTime || ""),
          scenario: String(scene?.scenario || ""),
          createdAt: String(scene?.createdAt || ""),
          attachments: Array.isArray(scene?.attachments) ? scene.attachments : []
        }))
      : [createEmptyScene(true)];
    state.autoTitle = buildAutoTitle(state.kind, state.occurredOn);
    // deck is now notebook-level (outside individual notes)

    const { noteTitleEl } = getElements();
    if (noteTitleEl) {
      noteTitleEl.value = note?.title || state.autoTitle;
    }
    await updateDayCardsDisplay();
    await openEditor();

    // Defensive attach for export button
    const expBtn2 = document.getElementById("profile-note-export-pdf");
    if (expBtn2 && !expBtn2._pdfExportBound) {
      expBtn2._pdfExportBound = true;
      expBtn2.addEventListener("click", () => void exportCurrentNoteAsPdf());
    }
  }

  function wrapDiaryHistory(panel) {
    if (!(panel instanceof HTMLElement) || panel.querySelector(".journal-diary-history")) {
      return;
    }
    const filters = document.getElementById("profile-note-filters");
    const list = document.getElementById("profile-note-list");
    const details = document.createElement("details");
    details.className = "journal-diary-history";
    const summary = document.createElement("summary");
    summary.textContent = "History";
    const body = document.createElement("div");
    body.className = "journal-diary-history-body";
    if (filters) body.appendChild(filters);
    if (list) body.appendChild(list);
    details.append(summary, body);
    panel.appendChild(details);
  }

  function unwrapDiaryHistory(panel) {
    const details = panel?.querySelector?.(".journal-diary-history");
    if (!details) return;
    const filters = document.getElementById("profile-note-filters");
    const list = document.getElementById("profile-note-list");
    const heading = panel.querySelector(".profile-notebook-head");
    if (filters) {
      heading ? heading.after(filters) : details.before(filters);
    }
    if (list) {
      filters ? filters.after(list) : (heading ? heading.after(list) : details.before(list));
    }
    details.remove();
  }

  function startNewEntry() {
    state.activeNoteId = "";
    state.editing = false;
    setStatus("");

    if (state.journalView === "diary") {
      void beginNewEntry(state.kind || "waking");
      return;
    }

    const overlayApi = window.TaroOverlay;
    if (!overlayApi?.open) {
      // Fallback if the overlay module failed to load.
      void beginNewEntry("waking");
      return;
    }

    const body = document.createElement("div");
    body.className = "journal-kind-choices";
    let controller = null;
    [
      { kind: "dream", label: "Dream", hint: "What happened while you slept" },
      { kind: "waking", label: "Waking", hint: "What happened while you were awake" }
    ].forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "journal-kind-card";
      const strong = document.createElement("span");
      strong.textContent = choice.label;
      const small = document.createElement("small");
      small.textContent = choice.hint;
      button.append(strong, small);
      button.addEventListener("click", () => {
        controller?.close();
        void beginNewEntry(choice.kind);
      });
      body.appendChild(button);
    });

    controller = overlayApi.open({
      title: "New journal entry",
      body,
      size: "small",
      actions: [{ label: "Cancel" }]
    });
  }

  async function beginNewEntry(kind) {
    state.kind = kind === "dream" ? "dream" : "waking";
    state.occurredOn = todayDateValue();
    state.sleptAt = "";
    state.awokeAt = "";
    state.scenes = [createEmptyScene(kind !== "dream")];
    state.autoTitle = buildAutoTitle(state.kind, state.occurredOn);
    const { noteTitleEl } = getElements();
    if (noteTitleEl) {
      noteTitleEl.value = state.autoTitle;
    }
    await updateDayCardsDisplay();
    await openEditor();
  }

  function closeEditor() {
    closeDreamInterpretation();
    if (state.journalView === "diary") {
      void beginNewEntry(state.kind || "waking");
      return;
    }
    state.activeNoteId = "";
    state.editing = false;
    state.notesMode = "list";
    syncNotesMode();
    setStatus("");
    renderNoteList();
  }

  async function refreshProfile() {
    if (!isProfileAvailable() || state.loading) {
      return;
    }

    state.loading = true;
    try {
      const service = window.TarotDataService;
      const summary = await service.requestJson("GET", service.buildApiUrl("/api/v1/profile"));
      const notesPayload = await service.requestJson("GET", service.buildApiUrl("/api/v1/profile/notes"));
      const quickNotesPayload = await service.requestJson("GET", service.buildApiUrl("/api/v1/profile/quick-notes"));
      const progress = await service.requestJson("GET", service.buildApiUrl("/api/v1/profile/quiz-progress"));

      const { clientLabelEl } = getElements();
      state.clientId = String(summary?.clientId || "").trim();
      state.authName = String(summary?.authName || "").trim();
      state.displayName = String(summary?.displayName || "").trim();
      syncDisplayNameUi();
      updateClientLabel();

      state.notes = Array.isArray(notesPayload?.notes) ? notesPayload.notes : [];
      state.quickNotes = Array.isArray(quickNotesPayload?.quickNotes) ? quickNotesPayload.quickNotes : [];
      renderQuickNotes();
      state.location = summary?.location && typeof summary.location === "object"
        ? { ...summary.location }
        : null;
      await loadLocationCountries();
      await syncLocationUi();
      state.preferredDeck = String(summary?.preferredDeck || "").trim();
      populateProfileDeckSelect();
      applyPreferredDeckGlobally(state.preferredDeck);
      void loadCacheStatus();
      renderStorage(summary?.storage);
      renderNoteFilters();
      renderNoteList();
      renderQuizProgress(progress);
      syncNotesMode();
      if (state.editing) {
        void updateSceneSkyCards();
      }
    } catch (error) {
      setError(`Could not load your profile. ${error?.message || "Please try again."}`);
    } finally {
      state.loading = false;
    }
  }

  function fillSelect(selectEl, items, placeholder, selectedId) {
    if (!selectEl) return;
    const current = selectedId != null ? String(selectedId) : String(selectEl.value || "");
    selectEl.innerHTML = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = placeholder;
    selectEl.appendChild(blank);
    (Array.isArray(items) ? items : []).forEach((item) => {
      const option = document.createElement("option");
      option.value = String(item.id || "");
      option.textContent = String(item.name || item.label || item.id || "");
      selectEl.appendChild(option);
    });
    if (current && [...selectEl.options].some((option) => option.value === current)) {
      selectEl.value = current;
    }
  }

  async function loadLocationCountries() {
    const { locationCountryEl } = getElements();
    if (!locationCountryEl) return;
    try {
      const service = window.TarotDataService;
      const payload = await service.fetchJson(service.buildApiUrl("/api/v1/locations/countries"));
      fillSelect(locationCountryEl, payload?.countries, "Select a country…", state.location?.countryId);
    } catch (_error) {
      fillSelect(locationCountryEl, [], "Location list unavailable", "");
    }
  }

  async function loadLocationRegions() {
    const { locationCountryEl, locationRegionEl, locationCityEl } = getElements();
    const countryId = String(locationCountryEl?.value || "").trim();
    if (!locationRegionEl) return [];
    if (!countryId) {
      fillSelect(locationRegionEl, [], "Select a region…", "");
      locationRegionEl.disabled = true;
      fillSelect(locationCityEl, [], "Select a city…", "");
      if (locationCityEl) locationCityEl.disabled = true;
      return [];
    }
    try {
      const service = window.TarotDataService;
      const payload = await service.fetchJson(service.buildApiUrl("/api/v1/locations/regions", { country: countryId }));
      const regions = Array.isArray(payload?.regions) ? payload.regions : [];
      fillSelect(locationRegionEl, regions, regions.length ? "Select a region…" : "No regions — pick a city", state.location?.regionId);
      locationRegionEl.disabled = regions.length === 0;
      return regions;
    } catch (_error) {
      fillSelect(locationRegionEl, [], "Could not load regions", "");
      locationRegionEl.disabled = true;
      return [];
    }
  }

  async function loadLocationCities() {
    const { locationCountryEl, locationRegionEl, locationCityEl } = getElements();
    const countryId = String(locationCountryEl?.value || "").trim();
    const regionId = String(locationRegionEl?.value || "").trim();
    if (!locationCityEl) return;
    if (!countryId) {
      fillSelect(locationCityEl, [], "Select a city…", "");
      locationCityEl.disabled = true;
      return;
    }
    try {
      const service = window.TarotDataService;
      const payload = await service.fetchJson(service.buildApiUrl("/api/v1/locations/cities", {
        country: countryId,
        region: regionId
      }));
      const cities = Array.isArray(payload?.cities) ? payload.cities : [];
      fillSelect(locationCityEl, cities, "Select a city…", state.location?.cityId);
      locationCityEl.disabled = cities.length === 0;
    } catch (_error) {
      fillSelect(locationCityEl, [], "Could not load cities", "");
      locationCityEl.disabled = true;
    }
  }

  async function applySelectedPlace() {
    const { locationCountryEl, locationRegionEl, locationCityEl, locationLatEl, locationLngEl, locationLabelEl } = getElements();
    const country = String(locationCountryEl?.value || "").trim();
    const region = String(locationRegionEl?.value || "").trim();
    const city = String(locationCityEl?.value || "").trim();
    if (!country && !region && !city) return;
    try {
      const service = window.TarotDataService;
      const place = await service.fetchJson(service.buildApiUrl("/api/v1/locations/resolve", { country, region, city }));
      if (locationLatEl && Number.isFinite(Number(place?.latitude))) locationLatEl.value = String(place.latitude);
      if (locationLngEl && Number.isFinite(Number(place?.longitude))) locationLngEl.value = String(place.longitude);
      if (locationLabelEl && place?.label) locationLabelEl.value = place.label;
    } catch (_error) {
      // Keep any manual coordinates already entered.
    }
  }

  async function syncLocationUi() {
    const { locationLatEl, locationLngEl, locationLabelEl, locationCountryEl } = getElements();
    const loc = state.location || null;
    if (locationLatEl) {
      locationLatEl.value = loc?.latitude != null ? String(loc.latitude) : "";
    }
    if (locationLngEl) {
      locationLngEl.value = loc?.longitude != null ? String(loc.longitude) : "";
    }
    if (locationLabelEl) {
      locationLabelEl.value = loc?.label || "";
    }
    if (locationCountryEl && loc?.countryId) {
      locationCountryEl.value = loc.countryId;
      await loadLocationRegions();
      await loadLocationCities();
    }
  }

  function updateClientLabel() {
    const { clientLabelEl } = getElements();
    if (!clientLabelEl) return;
    const displayName = String(state.displayName || state.authName || "").trim();
    const clientId = String(state.clientId || "").trim();
    clientLabelEl.textContent = displayName
      ? `Signed in as ${displayName}. Your notes and quiz progress are stored on the server.`
      : clientId
        ? `Signed in as ${clientId}. Your notes and quiz progress are stored on the server.`
        : "Signed in with your API key.";
    renderAccessBadges();
  }

  function renderAccessBadges() {
    let badgesEl = document.getElementById("profile-access-badges");
    if (!badgesEl) {
      badgesEl = document.createElement("div");
      badgesEl.id = "profile-access-badges";
      badgesEl.className = "profile-access-badges";
      const { clientLabelEl } = getElements();
      if (clientLabelEl?.parentElement) {
        clientLabelEl.insertAdjacentElement("afterend", badgesEl);
      } else {
        return;
      }
    }

    const access = window.TarotAppConfig?.getConnectionAccess?.() || {};
    const badges = [];
    if (access.accessLevel) {
      badges.push({ label: String(access.accessLevel), cls: "is-level" });
    }
    (Array.isArray(access.roles) ? access.roles : []).forEach((role) => {
      const label = String(role || "").trim();
      if (label) {
        badges.push({ label, cls: label === "admin" ? "is-admin" : "is-role" });
      }
    });
    (Array.isArray(access.scopes) ? access.scopes : []).forEach((scope) => {
      const label = String(scope || "").trim();
      if (label === "api:admin") {
        badges.push({ label, cls: "is-admin" });
      }
    });

    badgesEl.innerHTML = "";
    badges.forEach(({ label, cls }) => {
      const chip = document.createElement("span");
      chip.className = `profile-access-badge ${cls}`;
      chip.textContent = label;
      badgesEl.appendChild(chip);
    });
    badgesEl.hidden = badges.length === 0;
  }

  function syncDisplayNameUi() {
    const { displayNameEl } = getElements();
    if (displayNameEl) {
      displayNameEl.value = String(state.displayName || "");
    }
  }

  function setDisplayNameStatus(text, isError = false) {
    const { displayNameStatusEl } = getElements();
    if (!displayNameStatusEl) return;
    displayNameStatusEl.textContent = text;
    displayNameStatusEl.classList.toggle("is-error", isError);
  }

  async function saveDisplayName() {
    const { displayNameEl, displayNameSaveBtn } = getElements();
    const displayName = String(displayNameEl?.value || "").trim().slice(0, 100);
    if (displayNameSaveBtn) {
      displayNameSaveBtn.disabled = true;
    }
    try {
      const service = window.TarotDataService;
      const result = await service.requestJson(
        "PATCH",
        service.buildApiUrl("/api/v1/profile/display-name"),
        { displayName }
      );
      state.displayName = String(result?.displayName ?? displayName).trim();
      syncDisplayNameUi();
      updateClientLabel();
      setDisplayNameStatus(state.displayName ? "Display name saved." : "Display name cleared.");
    } catch (error) {
      setDisplayNameStatus(`Could not save display name. ${error?.message || "Please try again."}`, true);
    } finally {
      if (displayNameSaveBtn) {
        displayNameSaveBtn.disabled = false;
      }
    }
  }

  function readLocationInputs() {
    const {
      locationLatEl,
      locationLngEl,
      locationLabelEl,
      locationCountryEl,
      locationRegionEl,
      locationCityEl
    } = getElements();
    const latitude = Number(String(locationLatEl?.value || "").trim());
    const longitude = Number(String(locationLngEl?.value || "").trim());
    return {
      latitude,
      longitude,
      label: String(locationLabelEl?.value || "").trim(),
      country: String(locationCountryEl?.value || "").trim(),
      region: String(locationRegionEl?.value || "").trim(),
      city: String(locationCityEl?.value || "").trim()
    };
  }

  function setLocationStatus(text, isError = false) {
    const { locationStatusEl } = getElements();
    if (!locationStatusEl) return;
    locationStatusEl.textContent = text;
    locationStatusEl.classList.toggle("is-error", isError);
  }

  async function saveLocation() {
    const { locationSaveBtn } = getElements();
    const input = readLocationInputs();
    const hasPlace = Boolean(input.country || input.region || input.city);
    const hasCoords = Number.isFinite(input.latitude) && Number.isFinite(input.longitude)
      && input.latitude >= -90 && input.latitude <= 90
      && input.longitude >= -180 && input.longitude <= 180;
    if (!hasPlace && !hasCoords) {
      setLocationStatus("Pick a country/city or enter latitude and longitude.", true);
      return;
    }
    if (locationSaveBtn) {
      locationSaveBtn.disabled = true;
    }
    try {
      const service = window.TarotDataService;
      const result = await service.requestJson(
        "PATCH",
        service.buildApiUrl("/api/v1/profile/location"),
        input
      );
      state.location = result?.location ? { ...result.location } : { latitude: input.latitude, longitude: input.longitude, label: input.label };
      syncLocationUi();
      setLocationStatus(state.location.label ? `Saved: ${state.location.label}` : "Location saved.");
      void updateSceneSkyCards();
    } catch (error) {
      setLocationStatus(`Could not save location. ${error?.message || "Please try again."}`, true);
    } finally {
      if (locationSaveBtn) {
        locationSaveBtn.disabled = false;
      }
    }
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not available in this browser.", true);
      return;
    }
    setLocationStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { locationLatEl, locationLngEl, locationLabelEl } = getElements();
        const lat = Number(position.coords.latitude.toFixed(5));
        const lng = Number(position.coords.longitude.toFixed(5));
        if (locationLatEl) locationLatEl.value = String(lat);
        if (locationLngEl) locationLngEl.value = String(lng);
        if (locationLabelEl && !String(locationLabelEl.value || "").trim()) {
          locationLabelEl.value = "My location";
        }
        setLocationStatus("Found. Press Save to keep it.");
      },
      () => {
        setLocationStatus("Could not determine location. Enter coordinates manually.", true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function saveNote() {
    if (state.saving) {
      return;
    }

    const { noteTitleEl, noteDateEl } = getElements();
    const saveBtn = document.getElementById("profile-note-save");
    const occurredOn = String(noteDateEl?.value || state.occurredOn || todayDateValue()).trim();
    let title = String(noteTitleEl?.value || "").trim();
    if (!title) {
      title = buildAutoTitle(state.kind, occurredOn);
      if (noteTitleEl) {
        noteTitleEl.value = title;
      }
    }
    const scenes = collectScenes();

    const overlap = findSceneTimeOverlap(scenes);
    if (overlap) {
      setError(
        `Scene ${overlap.a.index + 1} and Scene ${overlap.b.index + 1} overlap in time. `
        + "Adjust their start/end times so scenes don't conflict."
      );
      return;
    }

    state.saving = true;
    if (saveBtn) {
      saveBtn.disabled = true;
    }

    try {
      const service = window.TarotDataService;
      const payload = {
        title,
        kind: state.kind,
        occurredOn,
        sleptAt: state.kind === "dream" ? String(getElements().sleptAtEl?.value || state.sleptAt || "").trim() : "",
        awokeAt: state.kind === "dream" ? String(getElements().awokeAtEl?.value || state.awokeAt || "").trim() : "",
        scenes
      };
      let savedNote;
      if (state.editing && state.activeNoteId) {
        savedNote = await service.requestJson(
          "PATCH",
          service.buildApiUrl(`/api/v1/profile/notes/${encodeURIComponent(state.activeNoteId)}`),
          payload
        );
      } else {
        savedNote = await service.requestJson(
          "POST",
          service.buildApiUrl("/api/v1/profile/notes"),
          payload
        );
      }

      state.activeNoteId = savedNote?.id || "";
      state.editing = true;
      state.occurredOn = savedNote?.occurredOn || occurredOn;
      state.kind = savedNote?.kind === "dream" ? "dream" : state.kind;
      state.sleptAt = String(savedNote?.sleptAt || payload.sleptAt || "").trim();
      state.awokeAt = String(savedNote?.awokeAt || payload.awokeAt || "").trim();
      await refreshProfile();
      syncInterpretButton();
      setStatus(state.kind === "dream" ? "Entry saved. Interpret when you are ready." : "Entry saved.");
    } catch (error) {
      setError(`Could not save the entry. ${error?.message || "Please try again."}`);
    } finally {
      state.saving = false;
      if (saveBtn) {
        saveBtn.disabled = false;
      }
    }
  }

  async function deleteNote() {
    if (!state.editing || !state.activeNoteId) {
      return;
    }

    try {
      const service = window.TarotDataService;
      await service.requestJson(
        "DELETE",
        service.buildApiUrl(`/api/v1/profile/notes/${encodeURIComponent(state.activeNoteId)}`)
      );
      closeEditor();
      await refreshProfile();
      setStatus("Entry deleted.");
    } catch (error) {
      setError(`Could not delete the entry. ${error?.message || "Please try again."}`);
    }
  }

  async function recordQuizAttempt({ categoryId = "", templateKey = "", difficulty = "", score = 0, total = 0 } = {}) {
    if (!isProfileAvailable()) {
      return false;
    }

    try {
      const service = window.TarotDataService;
      await service.requestJson(
        "POST",
        service.buildApiUrl("/api/v1/profile/quiz-progress"),
        { categoryId, templateKey, difficulty, score, total }
      );
      return true;
    } catch (_error) {
      return false;
    }
  }

  function ensureProfileSection() {
    if (state.initialized) {
      void refreshProfile();
      return;
    }

    state.initialized = true;
    const elements = getElements();

    document.getElementById("profile-open-notes")?.addEventListener("click", openJournalOrNotes);
    document.getElementById("profile-notes-back")?.addEventListener("click", handleNotesBack);
    document.getElementById("profile-note-new")?.addEventListener("click", startNewEntry);
    document.getElementById("profile-note-save")?.addEventListener("click", () => {
      void saveNote();
    });
    document.getElementById("profile-note-interpret")?.addEventListener("click", () => {
      void openDreamInterpretation();
    });
    document.getElementById("profile-note-cancel")?.addEventListener("click", closeEditor);
    document.getElementById("profile-note-delete")?.addEventListener("click", () => {
      void deleteNote();
    });
    document.getElementById("profile-note-export-pdf")?.addEventListener("click", () => {
      void exportCurrentNoteAsPdf();
    });
    document.getElementById("profile-scene-add")?.addEventListener("click", addScene);
    elements.kindDreamBtn?.addEventListener("click", () => setKind("dream"));
    elements.kindWakingBtn?.addEventListener("click", () => setKind("waking"));
    const onSleepChange = () => {
      state.sleptAt = String(elements.sleptAtEl?.value || "").trim();
      state.awokeAt = String(elements.awokeAtEl?.value || "").trim();
      syncSleepRow();
    };
    elements.sleptAtEl?.addEventListener("change", onSleepChange);
    elements.awokeAtEl?.addEventListener("change", onSleepChange);
    elements.sleptAtEl?.addEventListener("input", onSleepChange);
    elements.awokeAtEl?.addEventListener("input", onSleepChange);
    elements.locationSaveBtn?.addEventListener("click", () => {
      void saveLocation();
    });
    elements.locationDetectBtn?.addEventListener("click", detectLocation);
    elements.locationCountryEl?.addEventListener("change", () => {
      void loadLocationRegions().then(() => loadLocationCities()).then(() => applySelectedPlace());
    });
    elements.locationRegionEl?.addEventListener("change", () => {
      void loadLocationCities().then(() => applySelectedPlace());
    });
    elements.locationCityEl?.addEventListener("change", () => {
      void applySelectedPlace();
    });
    elements.displayNameSaveBtn?.addEventListener("click", () => {
      void saveDisplayName();
    });
    elements.quickNoteSaveBtn?.addEventListener("click", () => {
      void saveQuickNote();
    });
    elements.cacheNowBtn?.addEventListener("click", () => {
      void cacheAppNow();
    });
    elements.cacheClearBtn?.addEventListener("click", () => {
      void clearAppCache();
    });
    elements.quickNoteInputEl?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void saveQuickNote();
      }
    });
    elements.noteDateEl?.addEventListener("change", () => {
      state.occurredOn = String(elements.noteDateEl.value || todayDateValue());
      maybeRefreshAutoTitle();
      updateDayCardsDisplay();
      void updateSceneSkyCards();
    });
    elements.filtersEl?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) {
        return;
      }
      state.filter = button.dataset.filter === "dream" || button.dataset.filter === "waking"
        ? button.dataset.filter
        : "all";
      renderNoteFilters();
      renderNoteList();
    });

    if (elements.noteTitleEl) {
      elements.noteTitleEl.addEventListener("input", () => {
        const current = String(elements.noteTitleEl.value || "").trim();
        if (current && current !== state.autoTitle) {
          state.autoTitle = "";
        }
      });
      elements.noteTitleEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void saveNote();
        }
      });
    }

    document.addEventListener("connection:updated", () => {
      void refreshProfile();
    });

    document.addEventListener("connection:access-updated", () => {
      populateProfileDeckSelect();
      if (state.preferredDeck) {
        applyPreferredDeckGlobally(state.preferredDeck);
      }
    });

    setView("hub");
    void refreshProfile();
  }

  async function exportCurrentNoteAsPdf() {
    const exportBtn = document.getElementById("profile-note-export-pdf");
    if (exportBtn) exportBtn.disabled = true;

    setStatus("Preparing PDF export…");

    const titleEl = document.getElementById("profile-note-title");
    const dateEl = document.getElementById("profile-note-date");

    const title = String(titleEl?.value || "Untitled Entry").trim();
    const occurredOn = String(state.occurredOn || dateEl?.value || "").trim();
    const kind = state.kind === "dream" ? "dream" : "waking";

    syncScenesFromDom();
    const scenes = (state.scenes || []).slice();
    const dayCards = await getDayTarotCards(occurredOn);

    if (!scenes.length) {
      setError("Nothing to export.");
      if (exportBtn) exportBtn.disabled = false;
      return;
    }

    // Make sure we have the PDF loader
    if (!window.TarotLazySections || typeof window.TarotLazySections.ensureJsPDF !== "function") {
      setError("PDF export requires the updated lazy loader. Hard refresh the page (Ctrl+Shift+R).");
      if (exportBtn) exportBtn.disabled = false;
      return;
    }

    let JsPDF;
    let html2canvas;
    try {
      JsPDF = await window.TarotLazySections.ensureJsPDF();
      html2canvas = await window.TarotLazySections.ensureHtml2Canvas();
    } catch (e) {
      setError("Export libraries failed to load. Run `npm install` in the KABBAK folder and reload. " + (e?.message || ""));
      if (exportBtn) exportBtn.disabled = false;
      return;
    }

    if (typeof JsPDF !== "function" || typeof html2canvas !== "function") {
      setError("Could not initialize PDF exporter.");
      if (exportBtn) exportBtn.disabled = false;
      return;
    }

    const USE_FANCY_PDF = false; // set true to restore the original radial-gradient magical notebook background + fancy header (kept for future)

    // Build export container (A4-ish width for good layout)
    const root = document.createElement("div");
    const rootBg = USE_FANCY_PDF
      ? "background:radial-gradient(circle at 30% 20%, #1a1433 0%, #0f0a1f 60%); color:#e0d4ff;"
      : "background:#ffffff; color:#222222;";
    root.style.cssText = [
      "position:fixed",
      "left:-99999px",
      "top:0",
      "width:210mm",
      "padding:8mm 10mm 10mm",
      "box-sizing:border-box",
      rootBg,
      "font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "line-height:1.35"
    ].join(";");

    // Base styles for rich text content inside the export (so blockquote, pre, code, etc render decently)
    const richStyle = document.createElement("style");
    richStyle.textContent = `
      blockquote { border-left: 3px solid #888; margin: 3px 0; padding-left: 6px; font-style: italic; color: #555; }
      pre { background: #f4f4f4; padding: 3px 5px; border-radius: 2px; font-family: monospace; font-size: 8px; white-space: pre-wrap; overflow: auto; }
      code { font-family: monospace; background: #f0f0f0; padding: 0 2px; border-radius: 2px; font-size: 8px; }
      .scene-thoughts, .scene-notes { white-space: pre-wrap; }
    `;
    root.appendChild(richStyle);

    // Header (simplified; fancy version kept behind flag)
    const header = document.createElement("div");
    const kindLabel = kind === "dream" ? "DREAM" : "WAKING";
    if (USE_FANCY_PDF) {
      const kindColor = kind === "dream" ? "#7dd3fc" : "#f9a8d4";
      header.style.cssText = "text-align:center; margin-bottom:6mm; border-bottom:1px solid #4c3d7a; padding-bottom:4mm;";
      header.innerHTML = `
        <div style="font-size:9px; letter-spacing:3px; opacity:0.6;">KABBAK</div>
        <div style="font-size:22px; font-weight:700; margin:1mm 0; background:linear-gradient(90deg,#c4b5fd,#f9a8d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Magical Notebook</div>
        <div style="display:inline-block; padding:1px 8px; border-radius:999px; font-size:9px; font-weight:700; letter-spacing:0.5px; background:${kindColor}; color:#120d22;">${kindLabel}</div>
        <div style="margin-top:2mm; font-size:11px; opacity:0.8;">${escapeHtml(formatEntryDate(occurredOn) || occurredOn)}</div>
         <div style="margin-top:1mm; font-size:14px; font-weight:600;">${escapeHtml(title)}</div>
         ${kind === "dream" && (state.sleptAt || state.awokeAt) ? `<div style="margin-top:1.5mm; font-size:10px; opacity:0.75;">Slept ${escapeHtml(state.sleptAt || "—")} · Awoke ${escapeHtml(state.awokeAt || "—")}${sleepDurationLabel(state.sleptAt, state.awokeAt) ? ` · ${escapeHtml(sleepDurationLabel(state.sleptAt, state.awokeAt))}` : ""}</div>` : ""}
      `;
    } else {
      header.style.cssText = "margin-bottom:4mm; border-bottom:1px solid #ddd; padding-bottom:3mm;";
      header.innerHTML = `
        <div style="font-size:10px; color:#666; letter-spacing:1px;">${kindLabel} — ${escapeHtml(formatEntryDate(occurredOn) || occurredOn)}</div>
        <div style="font-size:15px; font-weight:600; margin-top:1mm;">${escapeHtml(title)}</div>
      `;
    }
    root.appendChild(header);

    const tarotCardImg = (url, alt, widthMm) =>
      `<img src="${url}" style="width:${widthMm}mm; aspect-ratio:2.75/4.75; object-fit:contain; height:auto; border-radius:2px; border:1px solid #aaa; display:block; background:#f3f3f3;" crossorigin="anonymous" alt="${escapeHtml(alt)}" />`;

    const stackedField = (label, value) =>
      `<div style="margin-top:1.6mm;"><div style="font-size:7px; opacity:0.6; letter-spacing:0.4px;">${label}</div><div style="font-size:9px; line-height:1.25; word-break:break-word;">${escapeHtml(String(value || "—").trim() || "—")}</div></div>`;

    // Date tarot cards (court + decan) — true card ratio
    if (dayCards && (dayCards.court || dayCards.decan || dayCards.activeDecan)) {
      const dcWrap = document.createElement("div");
      const dcBg = USE_FANCY_PDF ? "background:rgba(26,20,51,0.4); border:1px solid #4c3d7a; color:#e0d4ff;" : "background:#f8f8f8; border:1px solid #ddd; color:#333;";
      dcWrap.style.cssText = `margin:2mm 0 3mm; padding:2.5mm 3mm; border-radius:4px; ${dcBg}`;
      const cName = dayCards.court || "";
      const dName = dayCards.activeDecan || dayCards.decan || "";
      let dcHtml = `<div style="font-size:8px; margin-bottom:1.5mm; opacity:0.7;">DATE CARDS — ${escapeHtml(formatEntryDate(occurredOn) || occurredOn)}</div>`;
      dcHtml += `<div style="display:flex; gap:4mm; align-items:flex-start;">`;
      if (cName) {
        const cUrl = getMoodCardImageUrl(cName);
        dcHtml += `
          <div style="flex:0 0 40mm; font-size:8px; text-align:center;">
            <div style="font-size:7px; opacity:0.6;">COURT</div>
            ${cUrl ? tarotCardImg(cUrl, cName, 40) : `<strong style="font-size:9px;">${escapeHtml(cName)}</strong>`}
            <div style="margin-top:0.8mm; font-size:8px; font-weight:600; word-break:break-word;">${escapeHtml(cName)}</div>
          </div>`;
      }
      if (dName) {
        const dUrl = getMoodCardImageUrl(dName);
        dcHtml += `
          <div style="flex:0 0 40mm; font-size:8px; text-align:center;">
            <div style="font-size:7px; opacity:0.6;">DECAN</div>
            ${dUrl ? tarotCardImg(dUrl, dName, 40) : `<strong style="font-size:9px;">${escapeHtml(dName)}</strong>`}
            <div style="margin-top:0.8mm; font-size:8px; font-weight:600; word-break:break-word;">${escapeHtml(dName)}</div>
          </div>`;
      }
      dcHtml += `</div>`;
      dcWrap.innerHTML = dcHtml;
      root.appendChild(dcWrap);
    }

    // Scenes — tightened: card on left (smaller), text wraps next to it, minimal padding/margins, no wasted space
    const scenesWrap = document.createElement("div");
    scenesWrap.style.marginTop = "2mm";
    const skyGeo = state.location || null;
    const refData = await getReferenceDataOnce();

    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const block = document.createElement("div");
      const blockBg = USE_FANCY_PDF
        ? "background:rgba(26,20,51,0.5); border:1px solid #4c3d7a; color:#e0d4ff;"
        : "background:#fff; border:1px solid #ccc; color:#222;";
      block.style.cssText = `margin:2mm 0; padding:3mm; border-radius:3px; ${blockBg}`;

      let hourHtml = "";
      let positionsHtml = "";
      if (kind === "waking" && skyGeo && s.time) {
        const sky = computeSceneSky(s.time, occurredOn, skyGeo, refData);
        if (sky) {
          let durationSuffix = "";
          if (s.endTime) {
            const startDt = buildSceneDateTime(occurredOn, s.time);
            let endDt = buildSceneDateTime(occurredOn, s.endTime);
            if (startDt && endDt) {
              if (endDt <= startDt) {
                endDt = new Date(endDt.getTime() + 86400000); // crossed midnight
              }
              const durationMins = Math.round((endDt.getTime() - startDt.getTime()) / 60000);
              const seq = computeHourSequenceBetween(startDt, endDt, skyGeo, refData);
              const parts = [];
              if (durationMins > 0) {
                parts.push(`scene ${formatDuration(durationMins)}`);
              }
              const seqText = formatHourSequenceText(seq);
              if (seqText) {
                parts.push(seqText);
              }
              if (parts.length) {
                durationSuffix = ` · ${parts.join(" · ")}`;
              }
            }
          }
          const hourImg = sky.tarotName ? getMoodCardImageUrl(sky.tarotName) : null;
          hourHtml = `<div style="margin-top:2mm; font-size:8px; color:#444;">
            <div style="font-size:7px; opacity:0.6; letter-spacing:0.4px;">PLANETARY HOUR</div>
            ${hourImg ? `<div style="margin:1mm 0;">${tarotCardImg(hourImg, sky.tarotName || "hour", 32)}</div>` : ""}
            <div style="font-size:8px; line-height:1.3;">${escapeHtml(getSceneSkyText(sky))}${escapeHtml(durationSuffix)}</div>
          </div>`;
          const dateTime = buildSceneDateTime(occurredOn, s.time);
          if (dateTime) {
            try {
              const service = window.TarotDataService;
              const snapshot = await service.requestJson("GET", service.buildApiUrl("/api/v1/now", {
                latitude: skyGeo.latitude,
                longitude: skyGeo.longitude,
                date: dateTime.toISOString()
              }));
              const positions = Array.isArray(snapshot?.stats?.planetPositions) ? snapshot.stats.planetPositions : [];
              if (positions.length) {
                positionsHtml = `<div style="font-size:7px; color:#666; margin-bottom:1mm;">SKY · ${positions.map((p) => `${escapeHtml(p.symbol || "")} ${escapeHtml(p.sign?.name || "")} ${Number(p.degreeInSign).toFixed(1)}°`).join(" · ")}</div>`;
              }
            } catch (_err) {
              // Planet positions are optional; skip silently if the API cannot answer.
            }
          }
        }
      }

      const mood = String(s.mood || "").trim();
      const cardUrl = getMoodCardImageUrl(mood);
      let moodHtml = "";
      if (cardUrl) {
        moodHtml = `
          <div style="text-align:center;">
            <div style="font-size:7px; opacity:0.6; margin-bottom:1mm;">MOOD</div>
            ${tarotCardImg(cardUrl, mood, 44)}
            <div style="margin-top:1mm; font-size:8px; font-weight:600; word-break:break-word; line-height:1.15;">${escapeHtml(mood)}</div>
          </div>`;
      } else if (mood) {
        moodHtml = `<div style="font-size:8px;"><span style="opacity:0.6;">MOOD</span><br><strong style="font-size:9px;">${escapeHtml(mood)}</strong></div>`;
      }

      let attachmentsHtml = "";
      if (s.attachments && s.attachments.length) {
        const imageAtts = s.attachments.filter(a => a && a.data && a.data.startsWith('data:image/'));
        const nonImageAtts = s.attachments.filter(a => !(a && a.data && a.data.startsWith('data:image/')));
        let content = '';
        if (imageAtts.length) {
          const imgBlocks = imageAtts.map(a => {
            const name = escapeHtml(a.name || 'attachment');
            const size = a.size ? ` (${(a.size/1024).toFixed(0)}KB)` : '';
            return `<div style="margin:2mm 0 0; text-align:left;">
              <img src="${a.data}" style="max-width:78mm; max-height:92mm; width:auto; height:auto; object-fit:contain; border:1px solid #aaa; border-radius:3px; display:block;" crossorigin="anonymous" alt="${name}" />
              <div style="font-size:7px; color:#555; margin-top:1px;">${name}${size}</div>
            </div>`;
          }).join('');
          content += `<div style="margin-top:1mm;">${imgBlocks}</div>`;
        }
        if (nonImageAtts.length) {
          const list = nonImageAtts.map(a => escapeHtml(a.name + (a.size ? ` (${(a.size/1024).toFixed(0)}KB)` : ''))).join(' • ');
          content += `<div style="font-size:8px; color:#555; margin-top:1mm;">${list}</div>`;
        } else if (!imageAtts.length) {
          const list = s.attachments.map(a => escapeHtml(a.name + (a.size ? ` (${(a.size/1024).toFixed(0)}KB)` : ''))).join(' • ');
          content = `<div style="font-size:8px; color:#555;">${list}</div>`;
        }
        attachmentsHtml = `<div style="margin-top:2.5mm;"><div style="font-size:7px; opacity:0.6;">ATTACHMENTS</div>${content}</div>`;
      }

      const leftMetaHtml = kind === "dream"
        ? `${stackedField("ATMOSPHERE", s.atmosphere)}${stackedField("EMOTION", s.emotion)}${s.steps ? `<div style="margin-top:1.6mm;"><div style="font-size:7px; opacity:0.6;">THE THREAD</div><div style="font-size:9px; white-space:pre-wrap;">${s.steps}</div></div>` : ""}`
        : `${stackedField("TIME", `${s.time || "—"}${s.endTime ? ` – ${s.endTime}` : ""}`)}${stackedField("SCENARIO", s.scenario)}${stackedField("SCENERY", s.place)}${stackedField("EMOTION", s.emotion)}`;

      const leftColumn = `
        <div style="flex:0 0 48mm; margin-right:4mm;">
          ${moodHtml}
          ${hourHtml}
          ${positionsHtml}
          ${leftMetaHtml}
        </div>`;

      const rightContent = `
        <div style="flex:1; min-width:0;">
          ${s.thoughts ? `<div style="margin-bottom:2.5mm;"><div style="font-size:7px; opacity:0.6;">${kind === "dream" ? "THE DREAM" : "ACT"}</div><div style="font-size:9px; white-space:pre-wrap;">${s.thoughts}</div></div>` : ""}
          ${s.notes ? `<div style="margin-bottom:2.5mm;"><div style="font-size:7px; opacity:0.6;">${kind === "dream" ? "AFTERTASTE" : "DIRECTION"}</div><div style="font-size:9px; white-space:pre-wrap;">${s.notes}</div></div>` : ""}
          ${attachmentsHtml}
        </div>`;

      block.innerHTML = `
         <div style="font-size:8px; opacity:0.6; margin-bottom:1.5mm;">${kind === "dream" ? "PASSAGE" : "SCENE"} ${i + 1}</div>
        <div style="display:flex; align-items:flex-start;">
          ${leftColumn}
          ${rightContent}
        </div>
      `;
      scenesWrap.appendChild(block);

      if (i < scenes.length - 1) {
        const nextS = scenes[i + 1];
        const trans = getSceneTransition(s, nextS, kind);
        let seq = null;
        if (kind === "waking" && skyGeo) {
          const start = buildSceneDateTime(occurredOn, s.endTime || s.time);
          let end = buildSceneDateTime(occurredOn, nextS.time);
          if (start && end && end <= start) {
            end = new Date(end.getTime() + 86400000); // crossed midnight
          }
          if (start && end && end > start) {
            seq = computeHourSequenceBetween(start, end, skyGeo, refData);
          }
        }
        const seqText = formatHourSequenceText(seq);
        const horizonHtml = buildPlanetHorizonHtml(seq, { pdf: true });
        const tDiv = document.createElement("div");
        tDiv.style.cssText = "margin:2mm 4mm 3mm; color:#555;";
        tDiv.innerHTML = `<div style="font-size:8px; display:flex; align-items:center; gap:4px; margin-bottom:1mm;">
          <span>${escapeHtml(trans.label)}</span>
          ${seqText ? `<span style="color:#777;">· ${escapeHtml(seqText)}</span>` : ""}
        </div>${horizonHtml}`;
        scenesWrap.appendChild(tDiv);
      }
    }
    root.appendChild(scenesWrap);

    // Footer
    const foot = document.createElement("div");
    const footColor = USE_FANCY_PDF ? "#6b5b9a" : "#888";
    foot.style.cssText = `margin-top:5mm; text-align:center; font-size:7px; color:${footColor}; letter-spacing:0.5px;`;
    foot.textContent = `Exported from KABBAK • ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
    root.appendChild(foot);

    document.body.appendChild(root);

    // Ensure images are loaded for html2canvas
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth > 0) return resolve();
            const done = () => resolve();
            img.onload = done;
            img.onerror = done;
            // force reload if needed
            if (img.src) {
              const orig = img.src;
              img.src = orig;
            }
          })
      )
    );

    try {
      const canvas = await html2canvas(root, {
        scale: 2,
        backgroundColor: "#0f0a1f",
        logging: false,
        useCORS: true
      });

      document.body.removeChild(root);

      // Multi-page PDF
      const pdf = new JsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageSize = pdf.internal.pageSize;
      const pageW = typeof pageSize.getWidth === "function" ? pageSize.getWidth() : (pageSize.width || 210);
      const pageH = typeof pageSize.getHeight === "function" ? pageSize.getHeight() : (pageSize.height || 297);
      const margin = 8;
      const usableW = pageW - margin * 2;
      const imgW = usableW;
      const imgH = (canvas.height / canvas.width) * imgW;

      const pxPerPage = (pageH - margin * 2) * (canvas.width / imgW);
      let srcY = 0;

      while (srcY < canvas.height) {
        const sliceH = Math.min(pxPerPage, canvas.height - srcY);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext("2d");
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        const pageImg = pageCanvas.toDataURL("image/png");

        if (srcY > 0) pdf.addPage();
        const drawH = (sliceH / canvas.width) * imgW;
        pdf.addImage(pageImg, "PNG", margin, margin, imgW, drawH);

        srcY += sliceH;
      }

      const safeTitle = title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 40) || "entry";
      const fileDate = occurredOn ? occurredOn.replace(/-/g, "") : "note";
      pdf.save(`KABBAK-${kind}-${fileDate}-${safeTitle}.pdf`);
      setStatus("PDF exported.");
    } catch (err) {
      if (root && root.parentNode) root.parentNode.removeChild(root);
      setError("Failed to generate PDF. " + (err?.message || ""));
    } finally {
      if (exportBtn) exportBtn.disabled = false;
    }
  }

  // Mount the notebook into the Journal plugin page. The existing panel is
  // relocated (listeners and state intact) so the whole feature is reused.
  function mountJournal(root, helpers, options) {
    if (!(root instanceof HTMLElement)) {
      return () => {};
    }
    ensureProfileSection();
    const { notesPanelEl } = getElements();
    if (!notesPanelEl) {
      return () => {};
    }

    const originalParent = notesPanelEl.parentNode;
    const originalNextSibling = notesPanelEl.nextSibling;
    const mode = String(options?.mode || "diary") === "note" ? "note" : "diary";

    state.journalPageMode = true;
    state.journalHelpers = helpers || null;
    state.journalView = mode;
    state.journalOnBack = typeof options?.onBack === "function" ? options.onBack : null;
    notesPanelEl.hidden = false;
    notesPanelEl.classList.add("profile-notes-panel--page");
    notesPanelEl.classList.toggle("journal-view-diary", mode === "diary");
    notesPanelEl.classList.toggle("journal-view-note", mode === "note");
    const heading = notesPanelEl.querySelector(".profile-notebook-head h2");
    if (heading) {
      heading.textContent = mode === "note" ? "Note" : "Diary";
    }
    root.appendChild(notesPanelEl);
    if (mode === "diary") {
      wrapDiaryHistory(notesPanelEl);
    }

    fillQuickNoteComposerTime();
    renderNoteList();
    renderQuickNotes();
    syncNotesMode();
    if (mode === "diary") {
      void beginNewEntry("waking");
    }

    return () => {
      unwrapDiaryHistory(notesPanelEl);
      notesPanelEl.classList.remove("profile-notes-panel--page", "journal-view-diary", "journal-view-note");
      if (heading) {
        heading.textContent = "Journal";
      }
      if (originalParent) {
        originalParent.insertBefore(notesPanelEl, originalNextSibling);
      }
      notesPanelEl.hidden = true;
      state.journalPageMode = false;
      state.journalHelpers = null;
      state.journalView = "";
      state.journalOnBack = null;
    };
  }

  window.ProfileUi = {
    ...(window.ProfileUi || {}),
    ensureProfileSection,
    mountJournal,
    recordQuizAttempt,
    refreshProfile
  };
})();
