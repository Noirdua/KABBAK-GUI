(function () {
  "use strict";

  const dataService = window.TarotDataService || {};
  const { html } = window.HtmlSafe;
  const STORAGE_KEYS = {
    showVerseHeads: "kabbak.alphaText.showVerseHeads",
    showSourceOverview: "kabbak.alphaText.showSourceOverview",
    showEntryTotals: "kabbak.alphaText.showEntryTotals",
    showLocalSearch: "kabbak.alphaText.showLocalSearch",
    showWorkSection: "kabbak.alphaText.showWorkSection",
    showExtraCard: "kabbak.alphaText.showExtraCard",
    readerFontSize: "kabbak.alphaText.readerFontSize",
    gematriaCipher: "kabbak.alphaText.gematriaCipher"
  };

  function readStoredBoolean(key, fallback) {
    try {
      const value = window.localStorage?.getItem?.(key);
      if (value === "true") {
        return true;
      }
      if (value === "false") {
        return false;
      }
    } catch (error) {
      // Ignore storage failures and keep in-memory defaults.
    }

    return fallback;
  }

  function writeStoredBoolean(key, value) {
    try {
      window.localStorage?.setItem?.(key, value ? "true" : "false");
    } catch (error) {
      // Ignore storage failures and keep in-memory state.
    }
  }

  function readStoredString(key, fallback) {
    try {
      const value = window.localStorage?.getItem?.(key);
      if (value) {
        return value;
      }
    } catch (error) {
      // Ignore storage failures.
    }

    return fallback;
  }

  function writeStoredString(key, value) {
    try {
      window.localStorage?.setItem?.(key, value);
    } catch (error) {
      // Ignore storage failures.
    }
  }

  const state = {
    initialized: false,
    catalog: null,
    selectedSourceGroupId: "",
    selectedSourceId: "",
    selectedSourceIdByGroup: {},
    compareSourceIdByGroup: {},
    compareModeByGroup: {},
    selectedWorkId: "",
    selectedSectionId: "",
    currentPassage: null,
    comparePassage: null,
    lexiconEntry: null,
    lexiconRequestId: 0,
    lexiconOccurrenceResults: null,
    lexiconOccurrenceLoading: false,
    lexiconOccurrenceError: "",
    lexiconOccurrenceVisible: false,
    lexiconOccurrenceRequestId: 0,
    globalSearchQuery: "",
    localSearchQuery: "",
    activeSearchScope: "global",
    searchQuery: "",
    searchResults: null,
    searchLoading: false,
    searchError: "",
    searchRequestId: 0,
    passageRequestId: 0,
    highlightedVerseId: "",
    highlightedStrongsId: "",
    highlightedVerseFresh: false,
    displayPreferencesBySource: {},
    showVerseHeads: readStoredBoolean(STORAGE_KEYS.showVerseHeads, true),
    showSourceOverview: readStoredBoolean(STORAGE_KEYS.showSourceOverview, true),
    showEntryTotals: readStoredBoolean(STORAGE_KEYS.showEntryTotals, true),
    showLocalSearch: readStoredBoolean(STORAGE_KEYS.showLocalSearch, true),
    showWorkSection: readStoredBoolean(STORAGE_KEYS.showWorkSection, true),
    showExtraCard: readStoredBoolean(STORAGE_KEYS.showExtraCard, true),
    readerFontSize: readStoredString(STORAGE_KEYS.readerFontSize, "normal"),
    gematriaCipher: readStoredString(STORAGE_KEYS.gematriaCipher, "ordinal"),
    gematriaDb: null
  };

  let sourceListEl;
  let sourceCountEl;
  let globalSearchFormEl;
  let globalSearchInputEl;
  let globalSearchClearEl;
  let localSearchFormEl;
  let localSearchInputEl;
  let localSearchClearEl;
  let translationSelectEl;
  let translationControlEl;
  let compareSelectEl;
  let compareControlEl;
  let compareToggleEl;
  let compareToggleControlEl;
  let workSelectEl;
  let sectionSelectEl;
  let detailHeadingEl;
  let detailNameEl;
  let detailSubEl;
  let detailHeadingToolsEl;
  let detailBodyEl;
  let textLayoutEl;
  let showVerseHeadsEl;
  let showSourceOverviewEl;
  let showEntryTotalsEl;
  let showLocalSearchEl;
  let showWorkSectionEl;
  let showExtraCardEl;
  let readerFontSizeSelectEl;
  let gematriaCipherSelectEl;
  let exportButtonEl;
  let lexiconPopupEl;
  let lexiconPopupTitleEl;
  let lexiconPopupSubtitleEl;
  let lexiconPopupBodyEl;
  let lexiconPopupCloseEl;
  let lexiconReturnFocusEl = null;

  let searchTimer = null;

  function debounceRunSearch(scope) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      void runSearch(scope);
    }, 300);
  }

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getElements() {
    sourceListEl = document.getElementById("alpha-text-source-list");
    sourceCountEl = document.getElementById("alpha-text-source-count");
    globalSearchFormEl = document.getElementById("alpha-text-global-search-form");
    globalSearchInputEl = document.getElementById("alpha-text-global-search-input");
    globalSearchClearEl = document.getElementById("alpha-text-global-search-clear");
    localSearchFormEl = document.getElementById("alpha-text-local-search-form");
    localSearchInputEl = document.getElementById("alpha-text-local-search-input");
    localSearchClearEl = document.getElementById("alpha-text-local-search-clear");
    showVerseHeadsEl = document.getElementById("alpha-text-show-verse-heads");
    showSourceOverviewEl = document.getElementById("alpha-text-show-source-overview");
    showEntryTotalsEl = document.getElementById("alpha-text-show-entry-totals");
    showLocalSearchEl = document.getElementById("alpha-text-show-local-search");
    showWorkSectionEl = document.getElementById("alpha-text-show-work-section");
    showExtraCardEl = document.getElementById("alpha-text-show-extra-card");
    readerFontSizeSelectEl = document.getElementById("alpha-text-font-size-select");
    gematriaCipherSelectEl = document.getElementById("alpha-text-gematria-cipher-select");
    exportButtonEl = document.querySelector("#alphabet-text-section .detail-export-btn");
    translationSelectEl = document.getElementById("alpha-text-translation-select");
    translationControlEl = translationSelectEl?.closest?.(".alpha-text-control") || null;
    compareSelectEl = document.getElementById("alpha-text-compare-select");
    compareControlEl = compareSelectEl?.closest?.(".alpha-text-control") || null;
    compareToggleEl = document.getElementById("alpha-text-compare-toggle");
    compareToggleControlEl = document.getElementById("alpha-text-compare-toggle-control");
    workSelectEl = document.getElementById("alpha-text-work-select");
    sectionSelectEl = document.getElementById("alpha-text-section-select");
    detailHeadingEl = document.querySelector("#alphabet-text-section .alpha-text-detail-heading");
    detailNameEl = document.getElementById("alpha-text-detail-name");
    detailSubEl = document.getElementById("alpha-text-detail-sub");
    detailHeadingToolsEl = document.querySelector("#alphabet-text-section .alpha-text-heading-tools");
    detailBodyEl = document.getElementById("alpha-text-detail-body");
    textLayoutEl = sourceListEl?.closest?.(".browse-layout") || detailBodyEl?.closest?.(".browse-layout") || null;
    syncReaderDisplayControls();
    ensureLexiconPopup();
  }

  function toggleLocalSearchForm() {
    if (localSearchFormEl) {
      localSearchFormEl.style.display = state.showLocalSearch ? "" : "none";
    }
  }

  function toggleWorkSectionSelects() {
    const card = document.querySelector("#alphabet-text-section .alpha-text-controls--heading:not(.alpha-text-reader-panel)");
    const workControl = workSelectEl?.closest?.(".alpha-text-control");
    const sectionControl = sectionSelectEl?.closest?.(".alpha-text-control");
    if (workControl instanceof HTMLElement) {
      workControl.style.display = state.showWorkSection ? "" : "none";
    }
    if (sectionControl instanceof HTMLElement) {
      sectionControl.style.display = state.showWorkSection ? "" : "none";
    }
    if (card instanceof HTMLElement) {
      card.style.display = state.showWorkSection ? "" : "none";
    }
  }

  function syncReaderDisplayControls() {
    if (showVerseHeadsEl instanceof HTMLInputElement) {
      showVerseHeadsEl.checked = Boolean(state.showVerseHeads);
    }

    if (showSourceOverviewEl instanceof HTMLInputElement) {
      showSourceOverviewEl.checked = Boolean(state.showSourceOverview);
    }

    if (showEntryTotalsEl instanceof HTMLInputElement) {
      showEntryTotalsEl.checked = Boolean(state.showEntryTotals);
    }

    if (showLocalSearchEl instanceof HTMLInputElement) {
      showLocalSearchEl.checked = Boolean(state.showLocalSearch);
    }

    if (showWorkSectionEl instanceof HTMLInputElement) {
      showWorkSectionEl.checked = Boolean(state.showWorkSection);
    }

    if (showExtraCardEl instanceof HTMLInputElement) {
      showExtraCardEl.checked = Boolean(state.showExtraCard);
    }

    if (readerFontSizeSelectEl instanceof HTMLSelectElement) {
      readerFontSizeSelectEl.value = state.readerFontSize;
    }

    if (gematriaCipherSelectEl instanceof HTMLSelectElement) {
      gematriaCipherSelectEl.value = state.gematriaCipher;
    }

    toggleLocalSearchForm();
    toggleWorkSectionSelects();

    if (textLayoutEl instanceof HTMLElement) {
      textLayoutEl.classList.toggle("alpha-text-hide-verse-heads", !state.showVerseHeads);
      textLayoutEl.setAttribute("data-show-verse-heads", state.showVerseHeads ? "true" : "false");
      textLayoutEl.classList.remove("alpha-text-font-small", "alpha-text-font-large", "alpha-text-font-xlarge");
      if (state.readerFontSize !== "normal") {
        textLayoutEl.classList.add(`alpha-text-font-${state.readerFontSize}`);
      }
    }
  }

  function setGlobalSearchHeadingMode(isGlobalSearchOnly) {
    if (textLayoutEl instanceof HTMLElement) {
      textLayoutEl.classList.toggle("alpha-text-global-search-only", Boolean(isGlobalSearchOnly));
      textLayoutEl.setAttribute("data-global-search-only", isGlobalSearchOnly ? "true" : "false");
    }

    if (detailHeadingEl instanceof HTMLElement) {
      detailHeadingEl.hidden = Boolean(isGlobalSearchOnly);
      detailHeadingEl.setAttribute("aria-hidden", isGlobalSearchOnly ? "true" : "false");
    }

    if (!(detailHeadingToolsEl instanceof HTMLElement)) {
      return;
    }

    detailHeadingToolsEl.hidden = Boolean(isGlobalSearchOnly);
    detailHeadingToolsEl.setAttribute("aria-hidden", isGlobalSearchOnly ? "true" : "false");
  }

  function showDetailOnlyMode() {
    if (!(textLayoutEl instanceof HTMLElement)) {
      return;
    }

    window.TarotChromeUi?.initializeSidebarPopouts?.();
    window.TarotChromeUi?.initializeDetailPopouts?.();
    window.TarotChromeUi?.initializeSidebarAutoCollapse?.();
    window.TarotChromeUi?.showDetailOnly?.(textLayoutEl);
  }

  function showSidebarOnlyMode(persist = false) {
    if (!(textLayoutEl instanceof HTMLElement)) {
      return;
    }

    window.TarotChromeUi?.initializeSidebarPopouts?.();
    window.TarotChromeUi?.initializeDetailPopouts?.();
    window.TarotChromeUi?.showSidebarOnly?.(textLayoutEl, persist);
  }

  function ensureLexiconPopup() {
    if (lexiconPopupEl instanceof HTMLElement) {
      return;
    }

    const popup = document.createElement("div");
    popup.className = "alpha-text-lexicon-popup";
    popup.hidden = true;
    popup.setAttribute("aria-hidden", "true");

    const backdrop = document.createElement("div");
    backdrop.className = "alpha-text-lexicon-popup-backdrop";
    backdrop.addEventListener("click", closeLexiconEntry);

    const card = document.createElement("section");
    card.className = "alpha-text-lexicon-popup-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "alpha-text-lexicon-popup-title");
    card.setAttribute("tabindex", "-1");

    const header = document.createElement("div");
    header.className = "alpha-text-lexicon-popup-header";

    const headingWrap = document.createElement("div");
    headingWrap.className = "alpha-text-lexicon-popup-heading";

    const title = document.createElement("h3");
    title.id = "alpha-text-lexicon-popup-title";
    title.textContent = "Lexicon Entry";

    const subtitle = document.createElement("p");
    subtitle.className = "alpha-text-lexicon-popup-subtitle";
    subtitle.textContent = "Strong's definition";

    headingWrap.append(title, subtitle);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "alpha-text-lexicon-popup-close";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", closeLexiconEntry);

    header.append(headingWrap, closeButton);

    const body = document.createElement("div");
    body.className = "alpha-text-lexicon-popup-body";

    card.append(header, body);
    popup.append(backdrop, card);
    document.body.appendChild(popup);

    lexiconPopupEl = popup;
    lexiconPopupTitleEl = title;
    lexiconPopupSubtitleEl = subtitle;
    lexiconPopupBodyEl = body;
    lexiconPopupCloseEl = closeButton;
  }

  function getSources() {
    return Array.isArray(state.catalog?.sources) ? state.catalog.sources : [];
  }

  function getSourceGroupId(source) {
    const metadata = getSourceMetadata(source);
    return normalizeId(metadata.workKey || source?.id || source?.title);
  }

  function buildSourceGroups(sources) {
    const groupsById = new Map();

    (Array.isArray(sources) ? sources : []).forEach((source, index) => {
      const groupId = getSourceGroupId(source) || `source-group-${index + 1}`;
      if (!groupsById.has(groupId)) {
        groupsById.set(groupId, {
          id: groupId,
          title: normalizeTextValue(source?.title) || normalizeTextValue(source?.shortTitle) || "Untitled Source",
          order: index,
          variants: []
        });
      }

      groupsById.get(groupId).variants.push(source);
    });

    return [...groupsById.values()].sort((left, right) => left.order - right.order);
  }

  function getSourceGroups() {
    return Array.isArray(state.catalog?.sourceGroups) ? state.catalog.sourceGroups : [];
  }

  function findById(entries, value) {
    const needle = normalizeId(value);
    return (Array.isArray(entries) ? entries : []).find((entry) => normalizeId(entry?.id) === needle) || null;
  }

  function getSelectedSourceGroup() {
    return findById(getSourceGroups(), state.selectedSourceGroupId);
  }

  function getSourceVariants(group = getSelectedSourceGroup()) {
    return Array.isArray(group?.variants) ? group.variants : [];
  }

  function getSourceForGroup(group = getSelectedSourceGroup(), sourceId = state.selectedSourceId) {
    return findById(getSourceVariants(group), sourceId) || getSourceVariants(group)[0] || null;
  }

  function findSourceGroupBySourceId(sourceId) {
    const needle = normalizeId(sourceId);
    return getSourceGroups().find((group) => getSourceVariants(group).some((source) => normalizeId(source?.id) === needle)) || null;
  }

  function rememberSelectedSource(group, sourceId) {
    const groupId = normalizeId(group?.id);
    const normalizedSourceId = normalizeTextValue(sourceId);
    if (!groupId || !normalizedSourceId) {
      return;
    }

    state.selectedSourceIdByGroup[groupId] = normalizedSourceId;
  }

  function rememberCompareSource(group, sourceId) {
    const groupId = normalizeId(group?.id);
    const normalizedSourceId = normalizeTextValue(sourceId);
    if (!groupId || !normalizedSourceId) {
      return;
    }

    state.compareSourceIdByGroup[groupId] = normalizedSourceId;
  }

  function isCompareAvailable(group = getSelectedSourceGroup()) {
    return getSourceVariants(group).length > 1;
  }

  function isCompareModeEnabled(group = getSelectedSourceGroup()) {
    const groupId = normalizeId(group?.id);
    return Boolean(groupId && state.compareModeByGroup[groupId] && isCompareAvailable(group));
  }

  function setCompareModeEnabled(group, isEnabled) {
    const groupId = normalizeId(group?.id);
    if (!groupId) {
      return;
    }

    state.compareModeByGroup[groupId] = Boolean(isEnabled);
  }

  function getCompareCandidates(group = getSelectedSourceGroup()) {
    const activeSourceId = normalizeId(state.selectedSourceId);
    return getSourceVariants(group).filter((source) => normalizeId(source?.id) !== activeSourceId);
  }

  function getCompareSource(group = getSelectedSourceGroup()) {
    const groupId = normalizeId(group?.id);
    const candidates = getCompareCandidates(group);
    const rememberedSourceId = groupId ? state.compareSourceIdByGroup[groupId] : "";
    return findById(candidates, rememberedSourceId) || candidates[0] || null;
  }

  function syncCompareSelection(group = getSelectedSourceGroup()) {
    const groupId = normalizeId(group?.id);
    if (!groupId) {
      return;
    }

    if (!isCompareAvailable(group)) {
      delete state.compareSourceIdByGroup[groupId];
      delete state.compareModeByGroup[groupId];
      return;
    }

    const compareSource = getCompareSource(group);
    if (compareSource?.id) {
      rememberCompareSource(group, compareSource.id);
    }
  }

  function getSelectedSource() {
    return getSourceForGroup(getSelectedSourceGroup(), state.selectedSourceId)
      || findById(getSources(), state.selectedSourceId);
  }

  function getSelectedWork(source = getSelectedSource()) {
    return findById(source?.works, state.selectedWorkId);
  }

  function getSelectedSection(source = getSelectedSource(), work = getSelectedWork(source)) {
    return findById(work?.sections, state.selectedSectionId);
  }

  function normalizeTextValue(value) {
    return String(value || "").trim();
  }

  function buildTranslationOptionLabel(source) {
    const metadata = getSourceMetadata(source);
    return normalizeTextValue(metadata.translator)
      || normalizeTextValue(metadata.versionLabel || metadata.version)
      || normalizeTextValue(source?.shortTitle)
      || normalizeTextValue(source?.title)
      || "Translation";
  }

  function getSourceMetadata(source) {
    return source?.metadata && typeof source.metadata === "object" ? source.metadata : {};
  }

  function includesNormalizedText(container, value) {
    const containerText = normalizeTextValue(container).toLowerCase();
    const valueText = normalizeTextValue(value).toLowerCase();
    return Boolean(containerText && valueText && containerText.includes(valueText));
  }

  function formatCountLabel(count, label) {
    const normalizedCount = Number(count) || 0;
    const baseLabel = normalizeTextValue(label) || "item";
    if (normalizedCount === 1) {
      return `${normalizedCount} ${baseLabel}`;
    }
    if (/[^aeiou]y$/i.test(baseLabel)) {
      return `${normalizedCount} ${baseLabel.slice(0, -1)}ies`;
    }
    return `${normalizedCount} ${baseLabel.endsWith("s") ? baseLabel : `${baseLabel}s`}`;
  }

  function getSourceEditionLabel(source) {
    const metadata = getSourceMetadata(source);
    const version = normalizeTextValue(metadata.versionLabel || metadata.version);
    const translator = normalizeTextValue(metadata.translator);

    if (
      version
      && translator
      && normalizeId(version) !== normalizeId(translator)
      && !includesNormalizedText(version, translator)
      && !includesNormalizedText(translator, version)
    ) {
      return `${version} · ${translator}`;
    }

    return version || translator;
  }

  function buildSourceListMeta(source) {
    const shortTitle = normalizeTextValue(source?.shortTitle);
    const title = normalizeTextValue(source?.title);
    const editionLabel = getSourceEditionLabel(source);
    const parts = [];

    if (shortTitle && normalizeId(shortTitle) !== normalizeId(title)) {
      parts.push(shortTitle);
    }

    if (editionLabel && !parts.some((part) => includesNormalizedText(part, editionLabel) || includesNormalizedText(editionLabel, part))) {
      parts.push(editionLabel);
    }

    parts.push(formatCountLabel(source?.stats?.workCount, source?.workLabel || "Work"));
    parts.push(formatCountLabel(source?.stats?.sectionCount, source?.sectionLabel || "Section"));
    return parts.join(" · ");
  }

  function buildSourceGroupListMeta(group) {
    const activeSource = getSourceForGroup(group);
    if (!group || getSourceVariants(group).length <= 1) {
      return buildSourceListMeta(activeSource);
    }

    const translators = Array.from(new Set(
      getSourceVariants(group)
        .map((source) => normalizeTextValue(getSourceMetadata(source).translator))
        .filter(Boolean)
    ));

    const parts = [];
    if (translators.length) {
      parts.push(translators.join(" / "));
    }
    parts.push(formatCountLabel(getSourceVariants(group).length, "translation"));
    parts.push(formatCountLabel(activeSource?.stats?.sectionCount, activeSource?.sectionLabel || "Section"));
    return parts.join(" · ");
  }

  function buildSourceDetailSubtitle(source, work) {
    const parts = [normalizeTextValue(source?.title) || "--"];
    const editionLabel = getSourceEditionLabel(source);
    const workTitle = normalizeTextValue(work?.title);

    if (editionLabel) {
      parts.push(editionLabel);
    }

    if (workTitle && normalizeId(workTitle) !== normalizeId(source?.title)) {
      parts.push(workTitle);
    }

    return parts.join(" · ");
  }

  function buildCompareCardTitle(passage) {
    const source = passage?.source || getSelectedSource();
    const section = passage?.section || getSelectedSection(source, getSelectedWork(source));
    return `${buildTranslationOptionLabel(source)} · ${section?.title || section?.label || "--"}`;
  }

  function extractVerseCountText(verse, source, displayPreferences, translationText = "") {
    const mode = displayPreferences?.textMode || "translation";
    const originalText = normalizeTextValue(verse?.originalText);
    const transliterationText = getVerseTransliteration(verse, source);

    if (mode === "original") {
      return originalText || normalizeTextValue(translationText);
    }
    if (mode === "transliteration") {
      return transliterationText || normalizeTextValue(translationText);
    }
    return normalizeTextValue(translationText)
      || originalText
      || transliterationText;
  }

  function computeVerseGematria(value, cipher = "ordinal") {
    const normalized = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    if (!normalized || !cipher) {
      return 0;
    }

    const db = state.gematriaDb;
    if (!db || !db.ciphers || !db.baseAlphabet) {
      if (cipher === "ordinal") {
        return [...normalized].reduce((total, char) => total + (char.charCodeAt(0) - 96), 0);
      }
      return 0;
    }

    const cipherDef = db.ciphers.find((c) => c?.id === cipher);
    if (!cipherDef || !Array.isArray(cipherDef.values)) {
      return 0;
    }

    const alphabet = String(db.baseAlphabet).toUpperCase();
    const valueMap = {};
    for (let i = 0; i < Math.min(alphabet.length, cipherDef.values.length); i++) {
      valueMap[alphabet[i]] = cipherDef.values[i];
    }

    let total = 0;
    for (const char of normalized) {
      total += valueMap[char.toUpperCase()] || 0;
    }
    return total;
  }

  function getTextCounts(value, cipher = "ordinal") {
    const normalized = String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const words = normalized.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
    const letters = normalized.match(/\p{L}/gu) || [];
    const vowels = normalized.match(/[AEIOUYaeiouy]/g) || [];
    const consonants = letters.length - vowels.length;

    return {
      words: words.length,
      letters: letters.length,
      consonants: Math.max(0, consonants),
      vowels: vowels.length,
      gematria: computeVerseGematria(value, cipher)
    };
  }

  function formatCountSummary(counts) {
    const parts = [`W:${counts.words}`, `L:${counts.letters}`, `C:${counts.consonants}`, `V:${counts.vowels}`];
    if (Number.isFinite(counts.gematria) && counts.gematria > 0) {
      parts.push(`G:${counts.gematria}`);
    }
    return parts.join(" ");
  }

  function sumPassageCounts(passage, source, displayPreferences) {
    const verses = Array.isArray(passage?.verses) ? passage.verses : [];
    const cipher = state.gematriaCipher || "ordinal";

    return verses.reduce((totals, verse) => {
      const translationText = getVerseTranslationText(verse);
      const counts = getTextCounts(extractVerseCountText(verse, source, displayPreferences, translationText), cipher);

      totals.words += counts.words;
      totals.letters += counts.letters;
      totals.consonants += counts.consonants;
      totals.vowels += counts.vowels;
      totals.gematria += counts.gematria;
      return totals;
    }, {
      words: 0,
      letters: 0,
      consonants: 0,
      vowels: 0,
      gematria: 0
    });
  }

  const GREEK_TRANSLITERATION_MAP = {
    α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "e", θ: "th",
    ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
    ρ: "r", σ: "s", ς: "s", τ: "t", υ: "u", φ: "ph", χ: "ch", ψ: "ps",
    ω: "o"
  };

  const HEBREW_TRANSLITERATION_MAP = {
    א: "a", ב: "b", ג: "g", ד: "d", ה: "h", ו: "v", ז: "z", ח: "ch",
    ט: "t", י: "y", כ: "k", ך: "k", ל: "l", מ: "m", ם: "m", נ: "n",
    ן: "n", ס: "s", ע: "a", פ: "p", ף: "p", צ: "ts", ץ: "ts", ק: "q",
    ר: "r", ש: "sh", ת: "t"
  };

  function stripSourceScriptMarks(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f\u0591-\u05c7]/g, "");
  }

  function transliterateSourceScriptText(value) {
    const stripped = stripSourceScriptMarks(value);
    let result = "";

    for (const character of stripped) {
      const lowerCharacter = character.toLowerCase();
      const mapped = GREEK_TRANSLITERATION_MAP[lowerCharacter]
        || HEBREW_TRANSLITERATION_MAP[character]
        || HEBREW_TRANSLITERATION_MAP[lowerCharacter];
      result += mapped != null ? mapped : character;
    }

    return result
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildTokenDerivedTransliteration(verse) {
    const tokenText = (Array.isArray(verse?.tokens) ? verse.tokens : [])
      .map((token) => normalizeTextValue(token?.original))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();

    return tokenText ? transliterateSourceScriptText(tokenText) : "";
  }

  function getVerseTransliteration(verse, source = null) {
    const metadata = verse?.metadata && typeof verse.metadata === "object" ? verse.metadata : {};
    const explicit = [
      verse?.transliteration,
      verse?.xlit,
      metadata?.transliteration,
      metadata?.transliterationText,
      metadata?.xlit,
      metadata?.romanizedText,
      metadata?.romanized
    ].map(normalizeTextValue).find(Boolean) || "";

    if (explicit) {
      return explicit;
    }

    if (source?.features?.hasTokenAnnotations) {
      return buildTokenDerivedTransliteration(verse);
    }

    return "";
  }

  function getSearchInput(scope) {
    return scope === "source" ? localSearchInputEl : globalSearchInputEl;
  }

  function getStoredSearchQuery(scope) {
    return scope === "source" ? state.localSearchQuery : state.globalSearchQuery;
  }

  function setStoredSearchQuery(scope, value) {
    if (scope === "source") {
      state.localSearchQuery = value;
      return;
    }

    state.globalSearchQuery = value;
  }

  function updateSearchControls() {
    const globalQuery = String(globalSearchInputEl?.value || state.globalSearchQuery || "").trim();
    const localQuery = String(localSearchInputEl?.value || state.localSearchQuery || "").trim();
    const hasGlobalSearch = Boolean(globalQuery) || (state.activeSearchScope === "global" && Boolean(state.searchQuery));
    const hasLocalSearch = Boolean(localQuery) || (state.activeSearchScope === "source" && Boolean(state.searchQuery));

    if (globalSearchClearEl instanceof HTMLButtonElement) {
      globalSearchClearEl.disabled = !hasGlobalSearch;
    }

    if (localSearchClearEl instanceof HTMLButtonElement) {
      localSearchClearEl.disabled = !hasLocalSearch;
    }
  }

  function clearActiveSearchUi(options = {}) {
    const preserveHighlight = options.preserveHighlight === true;
    const scope = state.activeSearchScope === "source" ? "source" : "global";

    setStoredSearchQuery(scope, "");
    const input = getSearchInput(scope);
    if (input instanceof HTMLInputElement) {
      input.value = "";
    }

    const keepQuery = preserveHighlight && state.searchQuery ? state.searchQuery : "";

    state.searchQuery = preserveHighlight ? keepQuery : "";
    state.searchResults = null;
    state.searchLoading = false;
    state.searchError = "";
    state.searchRequestId += 1;

    if (!preserveHighlight) {
      state.highlightedVerseId = "";
      state.highlightedStrongsId = "";
    }
  }

  function getSourceDisplayCapabilities(source, passage) {
    const verses = Array.isArray(passage?.verses) ? passage.verses : [];
    const hasOriginal = verses.some((verse) => normalizeTextValue(verse?.originalText));
    const hasTransliteration = verses.some((verse) => getVerseTransliteration(verse, source));
    const hasInterlinear = Boolean(source?.features?.hasTokenAnnotations);
    const textModeCount = 1 + (hasOriginal ? 1 : 0) + (hasTransliteration ? 1 : 0);

    return {
      hasTranslation: true,
      hasOriginal,
      hasTransliteration,
      hasInterlinear,
      hasAnyExtras: hasOriginal || hasTransliteration || hasInterlinear,
      supportsAllTextMode: textModeCount > 1
    };
  }

  function getDefaultTextDisplayMode(capabilities) {
    if (capabilities?.hasTranslation) {
      return "translation";
    }
    if (capabilities?.hasOriginal) {
      return "original";
    }
    if (capabilities?.hasTransliteration) {
      return "transliteration";
    }
    return "translation";
  }

  function getAvailableTextDisplayModes(capabilities) {
    const modes = [];
    if (capabilities?.hasTranslation) {
      modes.push("translation");
    }
    if (capabilities?.hasOriginal) {
      modes.push("original");
    }
    if (capabilities?.hasTransliteration) {
      modes.push("transliteration");
    }
    if (capabilities?.supportsAllTextMode) {
      modes.push("all");
    }
    return modes;
  }

  function getSourceDisplayPreferences(source, passage) {
    const sourceId = normalizeId(source?.id);
    const capabilities = getSourceDisplayCapabilities(source, passage);
    const availableTextModes = getAvailableTextDisplayModes(capabilities);
    const stored = sourceId ? state.displayPreferencesBySource[sourceId] : null;

    let textMode = stored?.textMode;
    if (!availableTextModes.includes(textMode)) {
      textMode = getDefaultTextDisplayMode(capabilities);
    }

    const preferences = {
      textMode,
      showInterlinear: capabilities.hasInterlinear ? Boolean(stored?.showInterlinear) : false
    };

    if (sourceId) {
      state.displayPreferencesBySource[sourceId] = preferences;
    }

    return {
      ...preferences,
      capabilities,
      availableTextModes
    };
  }

  function updateSourceDisplayPreferences(source, patch) {
    const sourceId = normalizeId(source?.id);
    if (!sourceId) {
      return;
    }

    const current = state.displayPreferencesBySource[sourceId] || {};
    state.displayPreferencesBySource[sourceId] = {
      ...current,
      ...patch
    };
  }

  function formatTextDisplayModeLabel(mode) {
    switch (mode) {
      case "translation":
        return "Translation";
      case "original":
        return "Original";
      case "transliteration":
        return "Transliteration";
      case "all":
        return "All";
      default:
        return "Display";
    }
  }

  function clearSearchState() {
    state.searchQuery = "";
    state.searchResults = null;
    state.searchLoading = false;
    state.searchError = "";
    state.highlightedVerseId = "";
    state.highlightedStrongsId = "";
    state.searchRequestId += 1;

    updateSearchControls();
  }

  function clearScopedSearch(scope) {
    setStoredSearchQuery(scope, "");

    const input = getSearchInput(scope);
    if (input instanceof HTMLInputElement) {
      input.value = "";
    }

    if (state.activeSearchScope === scope) {
      clearSearchState();
    } else {
      updateSearchControls();
    }
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildWholeWordMatcher(query, flags = "iu") {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) {
      return null;
    }

    return new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(normalizedQuery)})(?=$|[^\\p{L}\\p{N}])`, flags);
  }

  function appendHighlightedText(target, text, query) {
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const sourceText = String(text || "");
    const normalizedQuery = String(query || "").trim();
    target.replaceChildren();
    if (!normalizedQuery) {
      target.textContent = sourceText;
      return;
    }

    const matcher = buildWholeWordMatcher(normalizedQuery, "giu");
    if (!matcher) {
      target.textContent = sourceText;
      return;
    }

    let lastIndex = 0;
    let match = matcher.exec(sourceText);
    while (match) {
      const prefixLength = String(match[1] || "").length;
      const matchedText = String(match[2] || "");
      const matchStart = match.index + prefixLength;
      const matchEnd = matchStart + matchedText.length;

      if (matchStart > lastIndex) {
        target.appendChild(document.createTextNode(sourceText.slice(lastIndex, matchStart)));
      }

      const mark = document.createElement("mark");
      mark.className = "alpha-text-mark";
      mark.textContent = sourceText.slice(matchStart, matchEnd);
      target.appendChild(mark);

      lastIndex = matchEnd;
      match = matcher.exec(sourceText);
    }

    if (lastIndex < sourceText.length) {
      target.appendChild(document.createTextNode(sourceText.slice(lastIndex)));
    }
  }

  function isHighlightedVerse(verse) {
    return normalizeId(verse?.id) && normalizeId(verse?.id) === normalizeId(state.highlightedVerseId);
  }

  function strongIdMatches(token, strongsId) {
    const normalizedMatch = String(strongsId || "").trim().toUpperCase();
    if (!normalizedMatch) {
      return false;
    }
    return (Array.isArray(token?.strongs) ? token.strongs : []).some((id) => (
      String(id || "").trim().toUpperCase() === normalizedMatch
    ));
  }

  function scrollHighlightedVerseIntoView() {
    const highlightedVerse = detailBodyEl?.querySelector?.(".alpha-text-verse.is-highlighted");
    const detailPanel = highlightedVerse?.closest?.(".detail-panel");
    if (!(highlightedVerse instanceof HTMLElement) || !(detailPanel instanceof HTMLElement)) {
      return;
    }

    const verseRect = highlightedVerse.getBoundingClientRect();
    const panelRect = detailPanel.getBoundingClientRect();
    const targetTop = detailPanel.scrollTop
      + (verseRect.top - panelRect.top)
      - (detailPanel.clientHeight / 2)
      + (verseRect.height / 2);

    detailPanel.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });
  }

  function createCard(title) {
    const card = document.createElement("div");
    card.className = "meta-card meta-card";
    if (title) {
      const heading = document.createElement("strong");
      heading.textContent = title;
      card.appendChild(heading);
    }
    return card;
  }

  function createEmptyMessage(text) {
    const message = document.createElement("div");
    message.className = "alpha-text-empty";
    message.textContent = text;
    return message;
  }

  function renderPlaceholder(title, subtitle, message) {
    if (detailNameEl) {
      detailNameEl.textContent = title;
    }
    if (detailSubEl) {
      detailSubEl.textContent = subtitle;
    }
    if (!detailBodyEl) {
      return;
    }

    detailBodyEl.replaceChildren();
    const card = createCard("Text Reader");
    card.appendChild(createEmptyMessage(message));
    detailBodyEl.appendChild(card);
  }

  function navigateToPassageTarget(target) {
    if (!target) {
      return;
    }

    state.selectedWorkId = target.workId;
    state.selectedSectionId = target.sectionId;
    state.lexiconEntry = null;
    renderSelectors();
    void loadSelectedPassage();
  }

  function getPassageLocationLabel(passage) {
    const source = passage?.source || getSelectedSource();
    const work = passage?.work || getSelectedWork(source);
    const section = passage?.section || getSelectedSection(source, work);
    return `${work?.title || "--"} · ${section?.title || section?.label || "--"}`;
  }

  function syncSelectionForSource(source) {
    const works = Array.isArray(source?.works) ? source.works : [];
    if (!works.length) {
      state.selectedWorkId = "";
      state.selectedSectionId = "";
      return;
    }

    if (!findById(works, state.selectedWorkId)) {
      state.selectedWorkId = works[0].id;
    }

    const work = getSelectedWork(source);
    const sections = Array.isArray(work?.sections) ? work.sections : [];
    if (!findById(sections, state.selectedSectionId)) {
      state.selectedSectionId = sections[0]?.id || "";
    }
  }

  function syncSelectionForGroup(group = getSelectedSourceGroup()) {
    const variants = getSourceVariants(group);
    if (!variants.length) {
      state.selectedSourceGroupId = "";
      state.selectedSourceId = "";
      state.selectedWorkId = "";
      state.selectedSectionId = "";
      return;
    }

    state.selectedSourceGroupId = group.id;
    const rememberedSourceId = state.selectedSourceIdByGroup[normalizeId(group.id)] || "";
    const source = findById(variants, state.selectedSourceId)
      || findById(variants, rememberedSourceId)
      || variants[0];

    state.selectedSourceId = source?.id || "";
    rememberSelectedSource(group, state.selectedSourceId);
    syncSelectionForSource(source);
    syncCompareSelection(group);
  }

  async function ensureCatalogLoaded(forceRefresh = false) {
    if (!forceRefresh && state.catalog) {
      return state.catalog;
    }

    const payload = await dataService.loadTextLibrary?.(forceRefresh);
    state.catalog = payload && typeof payload === "object"
      ? payload
      : { meta: {}, sources: [], references: [] };

    state.catalog.sourceGroups = buildSourceGroups(getSources());

    if (!state.selectedSourceGroupId && state.selectedSourceId) {
      state.selectedSourceGroupId = findSourceGroupBySourceId(state.selectedSourceId)?.id || "";
    }

    if (!state.selectedSourceGroupId) {
      state.selectedSourceGroupId = getSourceGroups()[0]?.id || "";
    }

    syncSelectionForGroup(getSelectedSourceGroup());
    return state.catalog;
  }

  function fillSelect(selectEl, entries, selectedValue, labelBuilder) {
    if (!(selectEl instanceof HTMLSelectElement)) {
      return;
    }

    selectEl.replaceChildren();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = typeof labelBuilder === "function" ? labelBuilder(entry) : String(entry?.label || entry?.title || entry?.id || "");
      option.selected = normalizeId(entry.id) === normalizeId(selectedValue);
      selectEl.appendChild(option);
    });

    selectEl.disabled = !selectEl.options.length;
  }

  function renderSourceList() {
    if (!sourceListEl) {
      return;
    }

    sourceListEl.replaceChildren();
    const sourceGroups = getSourceGroups();
    sourceGroups.forEach((group) => {
      const source = getSourceForGroup(group);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item alpha-text-source-btn";
      button.dataset.sourceGroupId = group.id;
      button.setAttribute("role", "option");

      const isSelected = normalizeId(group.id) === normalizeId(state.selectedSourceGroupId);
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");

      const name = document.createElement("span");
      name.className = "list-name";
      name.textContent = group.title;

      const meta = document.createElement("span");
      meta.className = "alpha-text-source-meta";
      meta.textContent = buildSourceGroupListMeta(group);

      button.append(name, meta);
      button.addEventListener("click", () => {
        if (normalizeId(group.id) === normalizeId(state.selectedSourceGroupId)) {
          showDetailOnlyMode();
          return;
        }

        state.selectedSourceGroupId = group.id;
        state.currentPassage = null;
        state.lexiconEntry = null;
        state.highlightedVerseId = "";
      state.highlightedStrongsId = "";
        syncSelectionForGroup(group);
        renderSourceList();
        renderSelectors();
        showDetailOnlyMode();

        if (state.searchQuery && state.activeSearchScope === "source") {
          void Promise.all([loadSelectedPassage(), runSearch("source")]);
          return;
        }

        void loadSelectedPassage();
      });

      sourceListEl.appendChild(button);
    });

    if (!sourceGroups.length) {
      sourceListEl.appendChild(createEmptyMessage("No text sources are available."));
    }

    if (sourceCountEl) {
      sourceCountEl.textContent = `${sourceGroups.length} sources`;
    }
  }

  function renderSelectors() {
    const group = getSelectedSourceGroup();
    const source = getSelectedSource();
    const work = getSelectedWork(source);
    const variants = getSourceVariants(group);
    const compareCandidates = getCompareCandidates(group);
    const compareSource = getCompareSource(group);
    const compareEnabled = isCompareModeEnabled(group);
    const works = Array.isArray(source?.works) ? source.works : [];
    const sections = Array.isArray(work?.sections) ? work.sections : [];

    fillSelect(translationSelectEl, variants, state.selectedSourceId, (entry) => buildTranslationOptionLabel(entry));
    fillSelect(compareSelectEl, compareCandidates, compareSource?.id || "", (entry) => buildTranslationOptionLabel(entry));
    fillSelect(workSelectEl, works, state.selectedWorkId, (entry) => `${entry.title} (${formatCountLabel(entry.sectionCount, String(source?.sectionLabel || "section").toLowerCase())})`);
    fillSelect(sectionSelectEl, sections, state.selectedSectionId, (entry) => `${entry.label} · ${entry.verseCount} verses`);

    if (translationSelectEl instanceof HTMLSelectElement) {
      translationSelectEl.disabled = variants.length <= 1;
    }

    if (translationControlEl instanceof HTMLElement) {
      translationControlEl.hidden = variants.length <= 1;
    }

    if (compareToggleEl instanceof HTMLButtonElement) {
      compareToggleEl.textContent = compareEnabled ? "On" : "Off";
      compareToggleEl.setAttribute("aria-pressed", compareEnabled ? "true" : "false");
      compareToggleEl.classList.toggle("is-selected", compareEnabled);
    }

    if (compareToggleControlEl instanceof HTMLElement) {
      compareToggleControlEl.hidden = !isCompareAvailable(group);
    }

    if (compareSelectEl instanceof HTMLSelectElement) {
      compareSelectEl.disabled = !compareEnabled || compareCandidates.length === 0;
    }

    if (compareControlEl instanceof HTMLElement) {
      compareControlEl.hidden = !compareEnabled || compareCandidates.length === 0;
    }
  }

  function closeLexiconEntry() {
    dismissLexiconEntry();
  }

  function clearLexiconOccurrenceState() {
    state.lexiconOccurrenceResults = null;
    state.lexiconOccurrenceLoading = false;
    state.lexiconOccurrenceError = "";
    state.lexiconOccurrenceVisible = false;
    state.lexiconOccurrenceRequestId += 1;
  }

  function dismissLexiconEntry(options = {}) {
    const shouldRestoreFocus = options.restoreFocus !== false;
    state.lexiconRequestId += 1;
    state.lexiconEntry = null;
    clearLexiconOccurrenceState();
    renderLexiconPopup();

    const returnFocusEl = lexiconReturnFocusEl;
    lexiconReturnFocusEl = null;

    if (shouldRestoreFocus && returnFocusEl instanceof HTMLElement && returnFocusEl.isConnected) {
      requestAnimationFrame(() => {
        if (returnFocusEl.isConnected) {
          returnFocusEl.focus();
        }
      });
    }
  }

  async function toggleLexiconOccurrences() {
    const lexiconId = state.lexiconEntry?.reference?.id || state.lexiconEntry?.lexiconId || "";
    const entryId = state.lexiconEntry?.entryId || "";
    if (!lexiconId || !entryId) {
      return;
    }

    if (state.lexiconOccurrenceVisible && !state.lexiconOccurrenceLoading) {
      state.lexiconOccurrenceVisible = false;
      renderLexiconPopup();
      return;
    }

    state.lexiconOccurrenceVisible = true;
    if (state.lexiconOccurrenceResults || state.lexiconOccurrenceError) {
      renderLexiconPopup();
      return;
    }

    const requestId = state.lexiconOccurrenceRequestId + 1;
    state.lexiconOccurrenceRequestId = requestId;
    state.lexiconOccurrenceLoading = true;
    state.lexiconOccurrenceError = "";
    renderLexiconPopup();

    try {
      const payload = await dataService.loadTextReferenceOccurrences?.(lexiconId, entryId, { limit: 100 });
      if (requestId !== state.lexiconOccurrenceRequestId) {
        return;
      }

      state.lexiconOccurrenceResults = payload;
      state.lexiconOccurrenceLoading = false;
      renderLexiconPopup();
    } catch (error) {
      if (requestId !== state.lexiconOccurrenceRequestId) {
        return;
      }

      state.lexiconOccurrenceLoading = false;
      state.lexiconOccurrenceError = error?.message || "Unable to load verse occurrences for this Strong's entry.";
      renderLexiconPopup();
    }
  }

  async function openLexiconOccurrence(result) {
    dismissLexiconEntry({ restoreFocus: false });
    await openSearchResult(result);
  }

  function appendLexiconOccurrencePreview(target, result) {
    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.replaceChildren();

    const previewTokens = Array.isArray(result?.previewTokens) ? result.previewTokens : [];
    if (!previewTokens.length) {
      target.textContent = result?.preview || result?.reference || "";
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
        mark.className = "alpha-text-mark alpha-text-mark--lexicon";
        mark.textContent = text;
        target.appendChild(mark);
        return;
      }

      target.appendChild(document.createTextNode(text));
    });
  }

  function renderLexiconPopup() {
    ensureLexiconPopup();

    if (!(lexiconPopupEl instanceof HTMLElement) || !(lexiconPopupBodyEl instanceof HTMLElement)) {
      return;
    }

    const payload = state.lexiconEntry;
    const wasHidden = lexiconPopupEl.hidden;

    if (!payload) {
      lexiconPopupEl.hidden = true;
      lexiconPopupEl.setAttribute("aria-hidden", "true");
      lexiconPopupTitleEl.textContent = "Reference Entry";
      lexiconPopupSubtitleEl.textContent = "Strong's definition";
      lexiconPopupBodyEl.replaceChildren();
      return;
    }

    lexiconPopupTitleEl.textContent = payload.entryId ? `Strong's ${payload.entryId}` : "Reference Entry";
    lexiconPopupSubtitleEl.textContent = payload.loading
      ? "Loading definition..."
      : "Strong's definition";
    lexiconPopupBodyEl.replaceChildren();

    if (payload.loading) {
      lexiconPopupBodyEl.appendChild(createEmptyMessage(`Loading ${payload.entryId}...`));
    } else if (payload.error) {
      lexiconPopupBodyEl.appendChild(createEmptyMessage(payload.error));
    } else {
      const entry = payload.entry || {};
      const head = document.createElement("div");
      head.className = "alpha-text-lexicon-head";

      const idPill = document.createElement("button");
      idPill.type = "button";
      idPill.className = "alpha-text-lexicon-id alpha-text-lexicon-id--button";
      idPill.textContent = payload.entryId || "--";
      idPill.setAttribute("aria-expanded", state.lexiconOccurrenceVisible ? "true" : "false");
      idPill.addEventListener("click", () => {
        void toggleLexiconOccurrences();
      });
      head.appendChild(idPill);

      if (entry.lemma) {
        const lemma = document.createElement("span");
        lemma.className = "alpha-text-token-original";
        lemma.textContent = entry.lemma;
        head.appendChild(lemma);
      }

      lexiconPopupBodyEl.appendChild(head);

      const rows = [
        ["Transliteration", entry.xlit],
        ["Pronunciation", entry.pron],
        ["Derivation", entry.derivation],
        ["Strong's Definition", entry.strongs_def],
        ["KJV Definition", entry.kjv_def]
      ].filter(([, value]) => String(value || "").trim());

      if (rows.length) {
        const dl = document.createElement("dl");
        dl.className = "alpha-dl";
        rows.forEach(([label, value]) => {
          const dt = document.createElement("dt");
          dt.textContent = label;
          const dd = document.createElement("dd");
          dd.textContent = String(value || "").trim();
          dl.append(dt, dd);
        });
        lexiconPopupBodyEl.appendChild(dl);
      }

      const occurrenceHint = document.createElement("p");
      occurrenceHint.className = "alpha-text-lexicon-hint";
      occurrenceHint.textContent = "Click the Strong's number to show verses that use this entry.";
      lexiconPopupBodyEl.appendChild(occurrenceHint);

      if (state.lexiconOccurrenceVisible) {
        const occurrenceSection = document.createElement("section");
        occurrenceSection.className = "alpha-text-lexicon-occurrences";

        const occurrenceTitle = document.createElement("strong");
        occurrenceTitle.textContent = "Verse Occurrences";
        occurrenceSection.appendChild(occurrenceTitle);

        if (state.lexiconOccurrenceLoading) {
          occurrenceSection.appendChild(createEmptyMessage(`Loading verses for ${payload.entryId}...`));
        } else if (state.lexiconOccurrenceError) {
          occurrenceSection.appendChild(createEmptyMessage(state.lexiconOccurrenceError));
        } else {
          const occurrencePayload = state.lexiconOccurrenceResults;
          const total = Number(occurrencePayload?.total) || 0;
          const shown = Array.isArray(occurrencePayload?.matches) ? occurrencePayload.matches.length : 0;
          const summary = document.createElement("p");
          summary.className = "alpha-text-search-summary";
          summary.textContent = total
            ? `${total} verses use ${payload.entryId}.${occurrencePayload?.truncated ? ` Showing the first ${shown} results.` : ""}`
            : `No verses found for ${payload.entryId}.`;
          occurrenceSection.appendChild(summary);

          if (Array.isArray(occurrencePayload?.matches) && occurrencePayload.matches.length) {
            const occurrenceList = document.createElement("div");
            occurrenceList.className = "alpha-text-lexicon-occurrence-list";

            occurrencePayload.matches.forEach((result) => {
              const button = document.createElement("button");
              button.type = "button";
              button.className = "alpha-text-lexicon-occurrence";

              const headRow = document.createElement("div");
              headRow.className = "alpha-text-search-result-head";

              const reference = document.createElement("span");
              reference.className = "alpha-text-search-reference";
              reference.textContent = result.reference || `${result.workTitle} ${result.sectionLabel}:${result.verseNumber}`;

              const location = document.createElement("span");
              location.className = "alpha-text-search-location";
              location.textContent = `${result.sourceShortTitle || result.sourceTitle} · ${result.workTitle} · ${result.sectionLabel}`;

              const preview = document.createElement("p");
              preview.className = "alpha-text-search-preview alpha-text-search-preview--compact";
              appendLexiconOccurrencePreview(preview, result);

              button.addEventListener("click", () => {
                void openLexiconOccurrence(result);
              });

              headRow.append(reference, location);
              button.append(headRow, preview);
              occurrenceList.appendChild(button);
            });

            occurrenceSection.appendChild(occurrenceList);
          }
        }

        lexiconPopupBodyEl.appendChild(occurrenceSection);
      }
    }

    lexiconPopupEl.hidden = false;
    lexiconPopupEl.setAttribute("aria-hidden", "false");

    if (wasHidden && lexiconPopupCloseEl instanceof HTMLButtonElement) {
      requestAnimationFrame(() => {
        lexiconPopupCloseEl.focus();
      });
    }
  }

  async function loadLexiconEntry(lexiconId, entryId, triggerElement) {
    if (!lexiconId || !entryId) {
      return;
    }

    if (triggerElement instanceof HTMLElement) {
      lexiconReturnFocusEl = triggerElement;
    }

    const requestId = state.lexiconRequestId + 1;
    state.lexiconRequestId = requestId;
    clearLexiconOccurrenceState();
    state.lexiconEntry = {
      loading: true,
      lexiconId,
      entryId: String(entryId).toUpperCase()
    };
    renderDetail();

    try {
      const payload = await dataService.loadTextReferenceEntry?.(lexiconId, entryId);
      if (requestId !== state.lexiconRequestId) {
        return;
      }
      state.lexiconEntry = payload;
      renderDetail();
    } catch (error) {
      if (requestId !== state.lexiconRequestId) {
        return;
      }
      state.lexiconEntry = {
        error: error?.message || "Unable to load lexicon entry.",
        lexiconId,
        entryId: String(entryId).toUpperCase()
      };
      renderDetail();
    }
  }

  function createMetaGrid(passage) {
    const sourceGroup = getSelectedSourceGroup();
    const source = passage?.source || getSelectedSource();
    const work = passage?.work || getSelectedWork(source);
    const section = passage?.section || getSelectedSection(source, work);
    const metadata = getSourceMetadata(source);
    const version = normalizeTextValue(metadata.versionLabel || metadata.version);
    const translator = normalizeTextValue(metadata.translator);
    const compareSource = getCompareSource(sourceGroup);
    const displayPreferences = getSourceDisplayPreferences(source, passage);
    const metaGrid = document.createElement("div");
    metaGrid.className = "alpha-text-meta-grid";

    const overviewCard = createCard("Source Overview");
    overviewCard.hidden = !state.showSourceOverview;
    overviewCard.innerHTML += html`
      <dl class="alpha-dl">
        <dt>Source</dt><dd>${source?.title || "--"}</dd>
        ${version ? html`<dt>Version</dt><dd>${version}</dd>` : ""}
        ${translator ? html`<dt>Translator</dt><dd>${translator}</dd>` : ""}
        ${getSourceVariants(sourceGroup).length > 1 ? html`<dt>Translations</dt><dd>${getSourceVariants(sourceGroup).map((entry) => buildTranslationOptionLabel(entry)).join(" / ")}</dd>` : ""}
        ${isCompareModeEnabled(sourceGroup) && compareSource ? html`<dt>Compare</dt><dd>${buildTranslationOptionLabel(compareSource)}</dd>` : ""}
        <dt>Tradition</dt><dd>${source?.tradition || "--"}</dd>
        <dt>Language</dt><dd>${source?.language || "--"}</dd>
        <dt>Script</dt><dd>${source?.script || "--"}</dd>
        <dt>${source?.workLabel || "Work"}</dt><dd>${work?.title || "--"}</dd>
        <dt>${source?.sectionLabel || "Section"}</dt><dd>${section?.label || "--"}</dd>
      </dl>
    `;
    metaGrid.appendChild(overviewCard);

    const totalsCard = createCard("Entry Totals");
    totalsCard.hidden = !state.showEntryTotals;
    const totals = sumPassageCounts(passage, source, displayPreferences);
    totalsCard.innerHTML += html`
      <dl class="alpha-dl">
        <dt>Words</dt><dd>${totals.words}</dd>
        <dt>Letters</dt><dd>${totals.letters}</dd>
        <dt>Consonants</dt><dd>${totals.consonants}</dd>
        <dt>Vowels</dt><dd>${totals.vowels}</dd>
        <dt>Gematria</dt><dd>${totals.gematria}</dd>
      </dl>
    `;
    metaGrid.appendChild(totalsCard);

    if (displayPreferences.capabilities.hasAnyExtras) {
      const extraCard = createCard("Extra");
      extraCard.classList.add("alpha-text-extra-card");
      extraCard.hidden = !state.showExtraCard;


      if (displayPreferences.availableTextModes.length > 1) {
        const displayGroup = document.createElement("div");
        displayGroup.className = "alpha-text-extra-group";

        const displayLabel = document.createElement("span");
        displayLabel.className = "alpha-text-extra-label";
        displayLabel.textContent = "Display";

        const displayButtons = document.createElement("div");
        displayButtons.className = "alpha-nav-btns alpha-text-extra-actions";

        displayPreferences.availableTextModes.forEach((mode) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "alpha-nav-btn";
          button.textContent = formatTextDisplayModeLabel(mode);
          button.setAttribute("aria-pressed", displayPreferences.textMode === mode ? "true" : "false");
          button.classList.toggle("is-selected", displayPreferences.textMode === mode);
          button.addEventListener("click", () => {
            updateSourceDisplayPreferences(source, { textMode: mode });
            renderDetail();
          });
          displayButtons.appendChild(button);
        });

        displayGroup.append(displayLabel, displayButtons);
        extraCard.appendChild(displayGroup);
      }

      if (displayPreferences.capabilities.hasInterlinear) {
        const interlinearGroup = document.createElement("div");
        interlinearGroup.className = "alpha-text-extra-group";

        const interlinearLabel = document.createElement("span");
        interlinearLabel.className = "alpha-text-extra-label";
        interlinearLabel.textContent = "Reader";

        const interlinearButtons = document.createElement("div");
        interlinearButtons.className = "alpha-nav-btns alpha-text-extra-actions";

        const interlinearButton = document.createElement("button");
        interlinearButton.type = "button";
        interlinearButton.className = "alpha-nav-btn";
        interlinearButton.textContent = "Interlinear";
        interlinearButton.setAttribute("aria-pressed", displayPreferences.showInterlinear ? "true" : "false");
        interlinearButton.classList.toggle("is-selected", displayPreferences.showInterlinear);
        interlinearButton.addEventListener("click", () => {
          updateSourceDisplayPreferences(source, { showInterlinear: !displayPreferences.showInterlinear });
          renderDetail();
        });

        interlinearButtons.appendChild(interlinearButton);
        interlinearGroup.append(interlinearLabel, interlinearButtons);
        extraCard.appendChild(interlinearGroup);
      }

      metaGrid.appendChild(extraCard);
    }

    return metaGrid;
  }

  function attachVerseLibraryControls(head, verse, source) {
    const sourceId = String(source?.id || state.selectedSourceId || "").trim();
    const workId = String(state.selectedWorkId || "").trim();
    const sectionId = String(state.selectedSectionId || "").trim();
    const verseId = String(verse?.id || verse?.number || "").trim();
    if (!sourceId || !verseId) {
      return;
    }
    window.KabbakLibraryMarks?.attachControls?.(head, {
      type: "text",
      key: `${sourceId}|${workId}|${sectionId}|${verseId}`,
      title: `${verse.reference || verseId} · ${source?.title || sourceId}`,
      body: String(verse?.text || "").trim(),
      meta: { sourceId, workId, sectionId, verseId }
    });
  }

  function createPlainVerse(verse, source, displayPreferences, options = {}) {
    const translationText = verse.text || "";
    const verseCounts = getTextCounts(extractVerseCountText(verse, source, displayPreferences, translationText), state.gematriaCipher || "ordinal");
    const isHighlighted = options.highlight !== false && isHighlightedVerse(verse);
    const article = document.createElement("article");
    article.className = "alpha-text-verse";
    article.classList.toggle("is-highlighted", isHighlighted);

    const head = document.createElement("div");
    head.className = "alpha-text-verse-head";

    const reference = document.createElement("span");
    reference.className = "alpha-text-verse-reference";
    reference.textContent = verse.reference || (verse.number ? `Verse ${verse.number}` : "");

    const stats = document.createElement("span");
    stats.className = "alpha-text-verse-counts";
    stats.textContent = formatCountSummary(verseCounts);

    head.append(reference, stats);
    attachVerseLibraryControls(head, verse, source);
    article.append(head);
    appendVerseTextLines(article, verse, source, displayPreferences, translationText, isHighlighted ? state.searchQuery : "");
    return article;
  }

  function buildTokenTranslationText(tokens, fallbackText) {
    const glossText = (Array.isArray(tokens) ? tokens : [])
      .map((token) => String(token?.gloss || "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();

    return glossText || String(fallbackText || "").trim();
  }

  function getVerseTranslationText(verse) {
    const translationText = normalizeTextValue(verse?.text);
    if (translationText) {
      return translationText;
    }
    return buildTokenTranslationText(verse?.tokens, "");
  }

  function appendStrongsHighlightedTranslation(target, verse) {
    const tokens = Array.isArray(verse?.tokens) ? verse.tokens : [];
    let first = true;

    tokens.forEach((token) => {
      const gloss = String(token?.gloss || "").trim();
      if (!gloss) {
        return;
      }

      if (!first && !/^[,.;:!?]/.test(gloss)) {
        target.appendChild(document.createTextNode(" "));
      }

      if (strongIdMatches(token, state.highlightedStrongsId)) {
        const mark = document.createElement("mark");
        mark.className = "alpha-text-mark alpha-text-mark--strongs";
        mark.textContent = gloss;
        target.appendChild(mark);
      } else {
        target.appendChild(document.createTextNode(gloss));
      }
      first = false;
    });
  }

  function appendVerseTextLines(target, verse, source, displayPreferences, translationText, highlightQuery = "") {
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const mode = displayPreferences?.textMode || "translation";
    const originalText = normalizeTextValue(verse?.originalText);
    const transliterationText = getVerseTransliteration(verse, source);
    const lines = [];

    const appendLine = (text, variant) => {
      const normalizedText = normalizeTextValue(text);
      if (!normalizedText || lines.some((entry) => entry.text === normalizedText)) {
        return;
      }
      lines.push({ text: normalizedText, variant });
    };

    if (mode === "all") {
      appendLine(translationText, "translation");
      appendLine(originalText, "original");
      appendLine(transliterationText, "transliteration");
    } else if (mode === "original") {
      appendLine(originalText || translationText, originalText ? "original" : "translation");
    } else if (mode === "transliteration") {
      appendLine(transliterationText || translationText, transliterationText ? "transliteration" : "translation");
    } else {
      appendLine(translationText, "translation");
    }

    if (!lines.length) {
      appendLine(translationText, "translation");
    }

    lines.forEach((line) => {
      const text = document.createElement("p");
      text.className = `alpha-text-verse-text alpha-text-verse-text--${line.variant}`;
      if (line.variant === "translation" && Boolean(state.highlightedStrongsId)) {
        appendStrongsHighlightedTranslation(text, verse);
      } else {
        appendHighlightedText(text, line.text, highlightQuery);
      }
      target.appendChild(text);
    });
  }

  function getSourceLexiconId(source) {
    const features = source?.features && typeof source.features === "object" ? source.features : {};
    const referenceIds = Array.isArray(features.referenceIds) ? features.referenceIds : [];
    const lexiconIds = Array.isArray(features.lexiconIds) ? features.lexiconIds : [];
    return String((referenceIds[0] || lexiconIds[0] || "")).trim();
  }

  function createTokenVerse(verse, lexiconId, displayPreferences, source, options = {}) {
    const translationText = getVerseTranslationText(verse);
    const verseCounts = getTextCounts(extractVerseCountText(verse, source, displayPreferences, translationText), state.gematriaCipher || "ordinal");
    const isHighlighted = options.highlight !== false && isHighlightedVerse(verse);
    const article = document.createElement("article");
    article.className = "alpha-text-verse";
    article.classList.toggle("alpha-text-verse--interlinear", Boolean(displayPreferences?.showInterlinear));
    article.classList.toggle("is-highlighted", isHighlighted);

    const head = document.createElement("div");
    head.className = "alpha-text-verse-head";

    const reference = document.createElement("span");
    reference.className = "alpha-text-verse-reference";
    reference.textContent = verse.reference || (verse.number ? `Verse ${verse.number}` : "");

    const stats = document.createElement("span");
    stats.className = "alpha-text-verse-counts";
    stats.textContent = formatCountSummary(verseCounts);

    const tokenGrid = document.createElement("div");
    tokenGrid.className = "alpha-text-token-grid";

    (Array.isArray(verse?.tokens) ? verse.tokens : []).forEach((token) => {
      const strongId = Array.isArray(token?.strongs) ? token.strongs[0] : "";
      // Without a lexicon there is nothing to open, so keep the token inert.
      const canLookUp = Boolean(strongId && lexiconId);
      const isStrongsMatch = Boolean(state.highlightedStrongsId && strongIdMatches(token, state.highlightedStrongsId));
      const tokenEl = document.createElement(canLookUp ? "button" : "div");
      tokenEl.className = `alpha-text-token${canLookUp ? " alpha-text-token--interactive" : ""}${isStrongsMatch ? " is-strongs-match" : ""}`;
      if (tokenEl instanceof HTMLButtonElement) {
        tokenEl.type = "button";
        tokenEl.addEventListener("click", () => {
          void loadLexiconEntry(lexiconId, strongId, tokenEl);
        });
      }

      const glossEl = document.createElement("span");
      glossEl.className = "alpha-text-token-gloss";
      glossEl.textContent = token?.gloss || "—";

      const originalEl = document.createElement("span");
      originalEl.className = "alpha-text-token-original";
      originalEl.textContent = token?.original || "—";

      tokenEl.append(glossEl, originalEl);

      if (strongId) {
        const strongsEl = document.createElement("span");
        strongsEl.className = "alpha-text-token-strongs";
        strongsEl.textContent = Array.isArray(token.strongs) ? token.strongs.join(" · ") : strongId;
        tokenEl.appendChild(strongsEl);
      }

      tokenGrid.appendChild(tokenEl);
    });

    head.append(reference, stats);
    attachVerseLibraryControls(head, verse, source);
    article.append(head);
    appendVerseTextLines(article, verse, source, displayPreferences, translationText, isHighlighted ? state.searchQuery : "");
    if (displayPreferences?.showInterlinear) {
      article.appendChild(tokenGrid);
    }
    return article;
  }

  function createReaderNavigation(passage) {
    const navigation = document.createElement("div");
    navigation.className = "alpha-text-reader-navigation";

    const passageSourceId = passage?.source?.id;
    const passageWorkId = passage?.work?.id;
    const passageSectionId = passage?.section?.id;
    if (!passageSourceId || !passageWorkId || !passageSectionId) {
      return null;
    }

    const catalogSource = findById(getSources(), passageSourceId);
    if (!catalogSource) {
      return null;
    }

    const catalogWork = findById(catalogSource.works, passageWorkId);
    if (!catalogWork) {
      return null;
    }

    const sections = Array.isArray(catalogWork.sections) ? catalogWork.sections : [];
    const currentIndex = sections.findIndex(
      (section) => normalizeId(section.id) === normalizeId(passageSectionId)
    );
    if (currentIndex < 0) {
      return null;
    }

    if (currentIndex > 0) {
      const previousSection = sections[currentIndex - 1];
      const previousButton = document.createElement("button");
      previousButton.type = "button";
      previousButton.className = "alpha-nav-btn alpha-text-reader-nav-btn";
      previousButton.textContent = "← Previous";
      previousButton.addEventListener("click", () => {
        state.selectedSectionId = previousSection.id;
        state.selectedWorkId = passageWorkId;
        state.selectedSourceId = passageSourceId;
        state.lexiconEntry = null;
        renderSelectors();
        void loadSelectedPassage();
      });
      navigation.appendChild(previousButton);
    }

    if (currentIndex >= 0 && currentIndex < sections.length - 1) {
      const nextSection = sections[currentIndex + 1];
      const nextButton = document.createElement("button");
      nextButton.type = "button";
      nextButton.className = "alpha-nav-btn alpha-text-reader-nav-btn alpha-text-reader-nav-btn--next";
      nextButton.textContent = "Next →";
      nextButton.addEventListener("click", () => {
        state.selectedSectionId = nextSection.id;
        state.selectedWorkId = passageWorkId;
        state.selectedSourceId = passageSourceId;
        state.lexiconEntry = null;
        renderSelectors();
        void loadSelectedPassage();
      });
      navigation.appendChild(nextButton);
    }

    return navigation.childElementCount ? navigation : null;
  }

  function createReaderCard(passage, options = {}) {
    const source = passage?.source || getSelectedSource();
    const displayPreferences = getSourceDisplayPreferences(source, passage);
    const card = createCard(options.title || getPassageLocationLabel(passage));
    card.classList.add("alpha-text-reader-card");
    if (options.compare) {
      card.classList.add("alpha-text-reader-card--compare");
    }
    const reader = document.createElement("div");
    reader.className = "alpha-text-reader";

    if (passage?.errorMessage) {
      reader.appendChild(createEmptyMessage(passage.errorMessage));
      card.appendChild(reader);
      return card;
    }

    const verses = Array.isArray(passage?.verses) ? passage.verses : [];
    if (!verses.length) {
      reader.appendChild(createEmptyMessage("No verses were found for this section."));
      card.appendChild(reader);
      return card;
    }

    verses.forEach((verse) => {
      const verseEl = source?.features?.hasTokenAnnotations
        ? createTokenVerse(verse, getSourceLexiconId(source), displayPreferences, source, options)
        : createPlainVerse(verse, source, displayPreferences, options);
      reader.appendChild(verseEl);
    });

    card.appendChild(reader);

    const navigation = options.showNavigation === false ? null : createReaderNavigation(passage);
    if (navigation) {
      card.appendChild(navigation);
    }

    return card;
  }

  function createCompareReaderGrid(primaryPassage, comparePassage) {
    const wrapper = document.createElement("div");
    wrapper.className = "alpha-text-reader-compare";
    wrapper.appendChild(createReaderCard(primaryPassage, {
      title: buildCompareCardTitle(primaryPassage),
      showNavigation: false
    }));

    if (comparePassage) {
      wrapper.appendChild(createReaderCard(comparePassage, {
        title: buildCompareCardTitle(comparePassage),
        compare: true,
        highlight: false,
        showNavigation: false
      }));
    }

    return wrapper;
  }

  let searchOverlayKeydownHandler = null;

  function removeSearchOverlay() {
    document.getElementById("alpha-text-search-overlay")?.remove();
    if (searchOverlayKeydownHandler) {
      document.removeEventListener("keydown", searchOverlayKeydownHandler);
      searchOverlayKeydownHandler = null;
    }
  }

  function closeSearchOverlay() {
    removeSearchOverlay();
    clearTimeout(searchTimer);
    clearSearchState();
    clearScopedSearch("global");
    clearScopedSearch("source");
    state.searchRequestId += 1;
    setGlobalSearchHeadingMode(false);
    void loadSelectedPassage();
  }

  function createSearchDiagnostic(scopeLabel) {
    const payload = state.searchResults;
    const total = Number(payload?.total) || 0;
    const shown = Array.isArray(payload?.matches) ? payload.matches.length : 0;
    const diagnostic = document.createElement("div");
    diagnostic.className = "alpha-text-search-diagnostic";
    diagnostic.style.cssText = "padding:12px 16px;border:2px solid #ef4444;border-radius:8px;margin-bottom:12px;font-size:13px;line-height:1.6;color:#fca5a5;background:#1a0a0a";

    const lines = [
      html`<strong>Query:</strong> <em>"${state.searchQuery || "--"}"</em>`,
      html`<strong>Scope:</strong> ${scopeLabel}`,
      state.searchLoading
        ? html`<strong>Status:</strong> Searching...`
        : state.searchError
          ? html`<strong>Status:</strong> <span style="color:#f87171">Error: ${state.searchError}</span>`
          : total > 0
            ? html`<strong>Status:</strong> Found <strong>${total}</strong> match${total !== 1 ? "es" : ""}${payload?.truncated ? ` (showing ${shown})` : ""}`
            : html`<strong>Status:</strong> No matches found`,
      payload ? html`<strong>API Response:</strong> total=${total} truncated=${payload.truncated} matches.length=${shown}` : ""
    ].filter(Boolean);

    diagnostic.innerHTML = lines.join("<br>");
    return diagnostic;
  }

  function createSearchResultList(payload) {
    const resultsEl = document.createElement("div");
    resultsEl.className = "alpha-text-search-results";

    payload.matches.forEach((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "alpha-text-search-result";
      button.classList.toggle(
        "is-active",
        normalizeId(result?.sourceId) === normalizeId(state.selectedSourceId)
          && normalizeId(result?.workId) === normalizeId(state.selectedWorkId)
          && normalizeId(result?.sectionId) === normalizeId(state.selectedSectionId)
          && normalizeId(result?.verseId) === normalizeId(state.highlightedVerseId)
      );

      const head = document.createElement("div");
      head.className = "alpha-text-search-result-head";

      const reference = document.createElement("span");
      reference.className = "alpha-text-search-reference";
      reference.textContent = result.reference || `${result.workTitle} ${result.sectionLabel}:${result.verseNumber}`;

      const location = document.createElement("span");
      location.className = "alpha-text-search-location";
      location.textContent = state.activeSearchScope === "global"
        ? `${result.sourceShortTitle || result.sourceTitle} · ${result.workTitle} · ${result.sectionLabel}`
        : `${result.workTitle} · ${result.sectionLabel}`;

      const preview = document.createElement("p");
      preview.className = "alpha-text-search-preview";
      appendHighlightedText(preview, result.preview || result.reference || "", state.searchQuery);

      button.addEventListener("click", () => {
        state.highlightedVerseFresh = true;
        removeSearchOverlay();
        void openSearchResult(result);
      });

      head.append(reference, location);
      button.append(head, preview);
      resultsEl.appendChild(button);
    });

    return resultsEl;
  }

  function renderSearchOverlay() {
    removeSearchOverlay();

    const payload = state.searchResults;
    const scopeLabel = state.activeSearchScope === "global"
      ? "all texts"
      : (payload?.scope?.source?.title || getSelectedSource()?.title || "current source");

    const overlay = document.createElement("div");
    overlay.id = "alpha-text-search-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Text search results");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:#0c0c12;overflow:auto;padding:24px";

    const header = document.createElement("div");
    header.style.cssText = "margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px";

    const title = document.createElement("h2");
    title.style.cssText = "color:#e4e4e7;margin:0;font-size:20px";
    title.textContent = state.searchQuery ? `Search: "${state.searchQuery}"` : "Search Results";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "alpha-nav-btn";
    closeButton.textContent = "✕ Close";
    closeButton.addEventListener("click", closeSearchOverlay);
    header.append(title, closeButton);

    const content = document.createElement("div");

    if (window.TarotAppConfig?.isFeatureEnabled?.("textSearchDiagnostics")) {
      content.appendChild(createSearchDiagnostic(scopeLabel));
    }

    const summary = document.createElement("p");
    summary.className = "alpha-text-search-summary";
    content.appendChild(summary);

    if (state.searchLoading) {
      summary.textContent = `Searching ${scopeLabel} for "${state.searchQuery}"…`;
    } else if (state.searchError) {
      summary.textContent = `Search scope: ${scopeLabel}`;
      content.appendChild(createEmptyMessage(state.searchError));
    } else if (Array.isArray(payload?.matches) && payload.matches.length) {
      const shownCount = payload.matches.length;
      const matchCount = payload.truncated ? shownCount : payload.total;
      summary.textContent = `${matchCount}${payload.truncated ? "+" : ""} match${matchCount !== 1 ? "es" : ""} in ${scopeLabel}`;
      content.appendChild(createSearchResultList(payload));
    } else {
      summary.textContent = `Search scope: ${scopeLabel}`;
      content.appendChild(createEmptyMessage(`No matches found for "${state.searchQuery}".`));
    }

    searchOverlayKeydownHandler = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeSearchOverlay();
      }
    };
    document.addEventListener("keydown", searchOverlayKeydownHandler);

    overlay.append(header, content);
    document.body.appendChild(overlay);
    closeButton.focus();
  }

  function isGlobalSearchOnlyMode() {
    return (state.activeSearchScope === "global" || state.activeSearchScope === "source")
      && Boolean(state.searchQuery)
      && !state.highlightedVerseId;
  }

  function renderDetail() {
    const source = getSelectedSource();
    const work = getSelectedWork(source);
    const section = getSelectedSection(source, work);
    const compareEnabled = isCompareModeEnabled(getSelectedSourceGroup());
    const globalSearchOnlyMode = isGlobalSearchOnlyMode();
    setGlobalSearchHeadingMode(globalSearchOnlyMode);

    if (!detailBodyEl) {
      return;
    }

    if (!globalSearchOnlyMode && (!source || !work || !section)) {
      if (state.searchQuery) {
        const fallbackCard = createCard("Search");
        fallbackCard.appendChild(createEmptyMessage(`Searching for "${state.searchQuery}"...`));
        detailBodyEl.replaceChildren();
        detailBodyEl.appendChild(fallbackCard);
        return;
      }
      renderPlaceholder("Text Reader", "Select a source to begin", "Choose a text source and section from the left panel.");
      renderLexiconPopup();
      return;
    }

    if (detailNameEl) {
      detailNameEl.textContent = globalSearchOnlyMode
        ? `Global Search${state.searchQuery ? `: ${state.searchQuery}` : ""}`
        : (state.currentPassage?.section?.title || section.title);
    }
    if (detailSubEl) {
      detailSubEl.textContent = globalSearchOnlyMode
        ? "All text sources"
        : buildSourceDetailSubtitle(source, work);
    }
    if (!detailBodyEl) {
      return;
    }

    if (globalSearchOnlyMode) {
      renderSearchOverlay();
      return;
    }

    removeSearchOverlay();
    detailBodyEl.replaceChildren();

    if (!state.currentPassage) {
      const loadingCard = createCard("Text Reader");
      loadingCard.appendChild(createEmptyMessage("Loading section…"));
      detailBodyEl.appendChild(loadingCard);
      renderLexiconPopup();
      return;
    }

    detailBodyEl.appendChild(createMetaGrid(state.currentPassage));

    if (compareEnabled && state.comparePassage) {
      detailBodyEl.appendChild(createCompareReaderGrid(state.currentPassage, state.comparePassage));
      const compareNavigation = createReaderNavigation(state.currentPassage);
      if (compareNavigation) {
        detailBodyEl.appendChild(compareNavigation);
      }
    } else {
      detailBodyEl.appendChild(createReaderCard(state.currentPassage));
    }
    renderLexiconPopup();
  }

  function getComparableWork(source, work) {
    const works = Array.isArray(source?.works) ? source.works : [];
    return findById(works, work?.id)
      || works.find((entry) => normalizeId(entry?.title) === normalizeId(work?.title))
      || works[0]
      || null;
  }

  function getComparableSection(work, section) {
    const sections = Array.isArray(work?.sections) ? work.sections : [];
    return findById(sections, section?.id)
      || sections.find((entry) => Number(entry?.number || 0) === Number(section?.number || 0))
      || sections.find((entry) => normalizeId(entry?.title) === normalizeId(section?.title))
      || sections.find((entry) => normalizeId(entry?.label) === normalizeId(section?.label))
      || sections[0]
      || null;
  }

  function buildPassageLoadError(source, work, section, message) {
    return {
      source,
      work,
      section,
      verses: [],
      errorMessage: message
    };
  }

  async function loadComparablePassage(compareSource, currentWork, currentSection) {
    const compareWork = getComparableWork(compareSource, currentWork);
    const compareSection = getComparableSection(compareWork, currentSection);
    if (!compareWork || !compareSection) {
      return buildPassageLoadError(compareSource, compareWork, compareSection, "Unable to align this comparison section.");
    }

    try {
      return await dataService.loadTextSection?.(compareSource.id, compareWork.id, compareSection.id);
    } catch (error) {
      return buildPassageLoadError(compareSource, compareWork, compareSection, error?.message || "Unable to load the comparison translation.");
    }
  }

  async function loadSelectedPassage() {
    const source = getSelectedSource();
    const work = getSelectedWork(source);
    const section = getSelectedSection(source, work);
    const compareSource = isCompareModeEnabled(getSelectedSourceGroup()) ? getCompareSource() : null;
    if (!source || !work || !section) {
      state.currentPassage = null;
      state.comparePassage = null;
      renderDetail();
      return;
    }

    const requestId = state.passageRequestId + 1;
    state.passageRequestId = requestId;
    state.currentPassage = null;
    state.comparePassage = null;
    renderDetail();

    const [primaryResult, compareResult] = await Promise.allSettled([
      dataService.loadTextSection?.(source.id, work.id, section.id),
      compareSource ? loadComparablePassage(compareSource, work, section) : Promise.resolve(null)
    ]);

    if (requestId !== state.passageRequestId) {
      return;
    }

    if (primaryResult.status === "fulfilled") {
      state.currentPassage = primaryResult.value;
    } else {
      state.currentPassage = buildPassageLoadError(source, work, section, primaryResult.reason?.message || "Unable to load this section.");
    }

    if (compareResult.status === "fulfilled") {
      state.comparePassage = compareResult.value;
    } else if (compareSource) {
      const compareWork = getComparableWork(compareSource, work);
      const compareSection = getComparableSection(compareWork, section);
      state.comparePassage = buildPassageLoadError(compareSource, compareWork, compareSection, compareResult.reason?.message || "Unable to load the comparison translation.");
    }

    renderDetail();
    if (state.highlightedVerseId) {
      requestAnimationFrame(() => {
        scrollHighlightedVerseIntoView();
        if (state.highlightedVerseFresh) {
          const verseEl = detailBodyEl?.querySelector?.(".alpha-text-verse.is-highlighted");
          if (verseEl instanceof HTMLElement) {
            verseEl.classList.add("is-highlighted-fresh");
            setTimeout(() => {
              verseEl.classList.remove("is-highlighted-fresh");
            }, 2600);
          }
          state.highlightedVerseFresh = false;
        }
      });
    }
  }

  async function runSearch(scope, forceRefresh = false) {
    const searchFn = dataService.searchTextLibrary;
    if (typeof searchFn !== "function") {
      state.searchError = "Text search is unavailable.";
      state.searchLoading = false;
      state.searchResults = null;
      renderDetail();
      return;
    }

    const normalizedScope = scope === "source" ? "source" : "global";
    const query = String(getSearchInput(normalizedScope)?.value || getStoredSearchQuery(normalizedScope) || "").trim();
    setStoredSearchQuery(normalizedScope, query);
    state.activeSearchScope = normalizedScope;
    state.searchQuery = query;
    state.searchError = "";
    state.searchResults = null;
    state.highlightedVerseId = "";
    state.highlightedStrongsId = "";
    updateSearchControls();

    if (!query) {
      state.searchLoading = false;
      state.searchError = `Search query is empty (scope: ${normalizedScope}, input: ${getSearchInput(normalizedScope) ? "found" : "missing"}, stored: "${getStoredSearchQuery(normalizedScope) || "none"}")`;
      state.searchResults = null;
      renderDetail();
      return;
    }

    const requestId = state.searchRequestId + 1;
    state.searchRequestId = requestId;
    state.searchLoading = true;
    renderDetail();

    try {
      const payload = await searchFn(query, {
        sourceId: normalizedScope === "source" ? state.selectedSourceId : "",
        limit: 50
      }, forceRefresh);

      if (requestId !== state.searchRequestId) {
        return;
      }

      state.searchResults = payload;
      state.searchLoading = false;
      renderDetail();
    } catch (error) {
      if (requestId !== state.searchRequestId) {
        return;
      }

      state.searchLoading = false;
      state.searchError = error?.message || "Unable to search this text library.";
      renderDetail();
    }
  }

  async function openSearchResult(result, strongsId = "") {
    if (!result) {
      return;
    }

    const sourceGroup = findSourceGroupBySourceId(result.sourceId);
    state.selectedSourceGroupId = sourceGroup?.id || "";
    state.selectedSourceId = result.sourceId;
    rememberSelectedSource(sourceGroup, result.sourceId);
    state.selectedWorkId = result.workId;
    state.selectedSectionId = result.sectionId;
    state.highlightedVerseId = result.verseId;
    state.highlightedStrongsId = String(strongsId || "").trim().toUpperCase();
    dismissLexiconEntry({ restoreFocus: false });
    syncSelectionForSource(getSelectedSource());
    renderSourceList();
    renderSelectors();
    await loadSelectedPassage();
    showDetailOnlyMode();
    clearActiveSearchUi({ preserveHighlight: true });
    updateSearchControls();
  }

  function bindControls() {
    if (state.initialized) {
      return;
    }

    if (globalSearchFormEl instanceof HTMLFormElement) {
      globalSearchFormEl.addEventListener("submit", (event) => {
        event.preventDefault();
        debounceRunSearch("global");
      });
    }

    if (globalSearchInputEl instanceof HTMLInputElement) {
      globalSearchInputEl.addEventListener("input", () => {
        state.globalSearchQuery = String(globalSearchInputEl.value || "").trim();
        updateSearchControls();
        if (!state.globalSearchQuery && state.activeSearchScope === "global" && state.searchQuery) {
          clearSearchState();
          renderDetail();
        }
      });
    }

    if (globalSearchClearEl instanceof HTMLButtonElement) {
      globalSearchClearEl.addEventListener("click", () => {
        clearScopedSearch("global");
        renderDetail();
      });
    }

    if (localSearchFormEl instanceof HTMLFormElement) {
      localSearchFormEl.addEventListener("submit", (event) => {
        event.preventDefault();
        void debounceRunSearch("source");
      });
    }

    if (localSearchClearEl instanceof HTMLButtonElement) {
      localSearchClearEl.addEventListener("click", () => {
        clearScopedSearch("source");
        renderDetail();
      });
    }

    if (localSearchInputEl instanceof HTMLInputElement) {
      localSearchInputEl.addEventListener("input", () => {
        state.localSearchQuery = String(localSearchInputEl.value || "").trim();
        updateSearchControls();
        if (!state.localSearchQuery && state.activeSearchScope === "source" && state.searchQuery) {
          clearSearchState();
          renderDetail();
        }
      });
    }

    if (showVerseHeadsEl instanceof HTMLInputElement) {
      showVerseHeadsEl.addEventListener("change", () => {
        state.showVerseHeads = Boolean(showVerseHeadsEl.checked);
        writeStoredBoolean(STORAGE_KEYS.showVerseHeads, state.showVerseHeads);
        syncReaderDisplayControls();
      });
    }

    if (showSourceOverviewEl instanceof HTMLInputElement) {
      showSourceOverviewEl.addEventListener("change", () => {
        state.showSourceOverview = Boolean(showSourceOverviewEl.checked);
        writeStoredBoolean(STORAGE_KEYS.showSourceOverview, state.showSourceOverview);
        renderDetail();
      });
    }

    if (showEntryTotalsEl instanceof HTMLInputElement) {
      showEntryTotalsEl.addEventListener("change", () => {
        state.showEntryTotals = Boolean(showEntryTotalsEl.checked);
        writeStoredBoolean(STORAGE_KEYS.showEntryTotals, state.showEntryTotals);
        renderDetail();
      });
    }

    if (showLocalSearchEl instanceof HTMLInputElement) {
      showLocalSearchEl.addEventListener("change", () => {
        state.showLocalSearch = Boolean(showLocalSearchEl.checked);
        writeStoredBoolean(STORAGE_KEYS.showLocalSearch, state.showLocalSearch);
        toggleLocalSearchForm();
      });
    }

    if (showWorkSectionEl instanceof HTMLInputElement) {
      showWorkSectionEl.addEventListener("change", () => {
        state.showWorkSection = Boolean(showWorkSectionEl.checked);
        writeStoredBoolean(STORAGE_KEYS.showWorkSection, state.showWorkSection);
        toggleWorkSectionSelects();
      });
    }

    if (showExtraCardEl instanceof HTMLInputElement) {
      showExtraCardEl.addEventListener("change", () => {
        state.showExtraCard = Boolean(showExtraCardEl.checked);
        writeStoredBoolean(STORAGE_KEYS.showExtraCard, state.showExtraCard);
        renderDetail();
      });
    }

    if (readerFontSizeSelectEl instanceof HTMLSelectElement) {
      readerFontSizeSelectEl.addEventListener("change", () => {
        state.readerFontSize = readerFontSizeSelectEl.value;
        writeStoredString(STORAGE_KEYS.readerFontSize, state.readerFontSize);
        syncReaderDisplayControls();
      });
    }

    if (gematriaCipherSelectEl instanceof HTMLSelectElement) {
      gematriaCipherSelectEl.addEventListener("change", () => {
        state.gematriaCipher = gematriaCipherSelectEl.value;
        writeStoredString(STORAGE_KEYS.gematriaCipher, state.gematriaCipher);
        renderDetail();
      });
    }

    if (translationSelectEl instanceof HTMLSelectElement) {
      translationSelectEl.addEventListener("change", () => {
        const sourceGroup = getSelectedSourceGroup();
        state.selectedSourceId = String(translationSelectEl.value || "");
        rememberSelectedSource(sourceGroup, state.selectedSourceId);
        syncSelectionForSource(getSelectedSource());
        state.currentPassage = null;
        state.comparePassage = null;
        state.lexiconEntry = null;
        state.highlightedVerseId = "";
      state.highlightedStrongsId = "";
        syncCompareSelection(sourceGroup);
        renderSourceList();
        renderSelectors();
        showDetailOnlyMode();

        if (state.searchQuery && state.activeSearchScope === "source") {
          void Promise.all([loadSelectedPassage(), runSearch("source")]);
          return;
        }

        void loadSelectedPassage();
      });
    }

    if (compareToggleEl instanceof HTMLButtonElement) {
      compareToggleEl.addEventListener("click", () => {
        const sourceGroup = getSelectedSourceGroup();
        setCompareModeEnabled(sourceGroup, !isCompareModeEnabled(sourceGroup));
        syncCompareSelection(sourceGroup);
        state.comparePassage = null;
        renderSelectors();
        void loadSelectedPassage();
      });
    }

    if (compareSelectEl instanceof HTMLSelectElement) {
      compareSelectEl.addEventListener("change", () => {
        const sourceGroup = getSelectedSourceGroup();
        rememberCompareSource(sourceGroup, String(compareSelectEl.value || ""));
        state.comparePassage = null;
        renderSelectors();
        void loadSelectedPassage();
      });
    }

    if (workSelectEl) {
      workSelectEl.addEventListener("change", () => {
        state.selectedWorkId = String(workSelectEl.value || "");
        const source = getSelectedSource();
        syncSelectionForSource(source);
        state.currentPassage = null;
        state.comparePassage = null;
        state.lexiconEntry = null;
        state.highlightedVerseId = "";
      state.highlightedStrongsId = "";
        renderSelectors();
        void loadSelectedPassage();
      });
    }

    if (sectionSelectEl) {
      sectionSelectEl.addEventListener("change", () => {
        state.selectedSectionId = String(sectionSelectEl.value || "");
        state.currentPassage = null;
        state.comparePassage = null;
        state.lexiconEntry = null;
        state.highlightedVerseId = "";
      state.highlightedStrongsId = "";
        void loadSelectedPassage();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.lexiconEntry) {
        closeLexiconEntry();
      }
    });

    if (exportButtonEl instanceof HTMLButtonElement) {
      exportButtonEl.addEventListener("click", () => {
        const detailPanel = document.querySelector("#alphabet-text-section .detail-panel");
        if (detailPanel instanceof HTMLElement) {
          window.TarotChromeUi?.exportDetailPaneAsWebp?.(detailPanel, "alphabet-text-section", exportButtonEl);
        }
      });
    }

    // Reader settings use the shared page-settings button/overlay
    // (app/ui-page-settings.js) via data-page-settings attributes.

    state.initialized = true;
  }

  async function ensureGematriaCiphers() {
    if (state.gematriaDb) {
      return;
    }

    try {
      const ref = await dataService.loadReferenceData?.();
      state.gematriaDb = ref?.gematriaCiphers || null;
    } catch (_error) {
      state.gematriaDb = null;
    }

    if (gematriaCipherSelectEl instanceof HTMLSelectElement && state.gematriaDb?.ciphers) {
      const selectedValue = gematriaCipherSelectEl.value || state.gematriaCipher || "";
      gematriaCipherSelectEl.replaceChildren();

      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = "None";
      gematriaCipherSelectEl.appendChild(noneOpt);

      state.gematriaDb.ciphers.forEach((cipher) => {
        if (!cipher?.id || !cipher?.name) {
          return;
        }
        const opt = document.createElement("option");
        opt.value = cipher.id;
        opt.textContent = cipher.name;
        gematriaCipherSelectEl.appendChild(opt);
      });

      if (state.gematriaDb.ciphers.some((c) => c?.id === selectedValue)) {
        gematriaCipherSelectEl.value = selectedValue;
        state.gematriaCipher = selectedValue;
      }
    }
  }

  async function ensureAlphabetTextSection() {
    getElements();
    bindControls();
    ensureZenReaderButton();
    window.TarotChromeUi?.initializeSidebarPopouts?.();
    window.TarotChromeUi?.initializeDetailPopouts?.();

    if (!sourceListEl || !detailBodyEl) {
      return;
    }

    await ensureCatalogLoaded();
    await ensureGematriaCiphers();
    syncReaderDisplayControls();
    renderSourceList();
    renderSelectors();
    updateSearchControls();
    showSidebarOnlyMode(false);

    if (!state.currentPassage) {
      await loadSelectedPassage();
      return;
    }

    renderDetail();
  }

  function resetState() {
    state.catalog = null;
    state.currentPassage = null;
    state.comparePassage = null;
    state.lexiconEntry = null;
    state.selectedSourceGroupId = "";
    state.selectedSourceId = "";
    state.selectedSourceIdByGroup = {};
    state.compareSourceIdByGroup = {};
    state.compareModeByGroup = {};
    state.selectedWorkId = "";
    state.selectedSectionId = "";
    state.lexiconRequestId = 0;
    state.lexiconOccurrenceResults = null;
    state.lexiconOccurrenceLoading = false;
    state.lexiconOccurrenceError = "";
    state.lexiconOccurrenceVisible = false;
    state.lexiconOccurrenceRequestId = 0;
    state.globalSearchQuery = "";
    state.localSearchQuery = "";
    state.activeSearchScope = "global";
    state.searchQuery = "";
    state.searchResults = null;
    state.searchLoading = false;
    state.searchError = "";
    state.searchRequestId = 0;
    state.highlightedVerseId = "";
    state.highlightedStrongsId = "";
    lexiconReturnFocusEl = null;

    if (globalSearchInputEl instanceof HTMLInputElement) {
      globalSearchInputEl.value = "";
    }

    if (localSearchInputEl instanceof HTMLInputElement) {
      localSearchInputEl.value = "";
    }

    updateSearchControls();
    renderLexiconPopup();
  }

  document.addEventListener("connection:updated", resetState);

  // The overlay is mounted on document.body, so it must be torn down explicitly
  // when another section takes over.
  document.addEventListener("section:changed", (event) => {
    if (event?.detail?.activeSection !== "alphabet-text") {
      removeSearchOverlay();
      closeZenReader();
    }
  });

  // Open a specific verse from another section (e.g. a reference occurrence link).
  async function openPassage(result, strongsId = "") {
    if (!result?.sourceId) {
      return;
    }

    await ensureAlphabetTextSection();
    await openSearchResult(result, strongsId);
  }

  // --- Zen Reader ------------------------------------------------------------
  // Fullscreen, reflowable reading view over the current section (or whole
  // text) with resizable text, line width, and a speed-reading (RSVP) mode.
  const ZEN_STORAGE = {
    fontSize: "kabbak.zenReader.fontSize",
    lineWidth: "kabbak.zenReader.lineWidth",
    wpm: "kabbak.zenReader.wpm",
    scope: "kabbak.zenReader.scope",
    headings: "kabbak.zenReader.headings"
  };
  const zenState = {
    overlay: null,
    flowEl: null,
    headingEl: null,
    rsvpEl: null,
    wordEl: null,
    settingsEl: null,
    fontSize: 20,
    lineWidth: 46,
    wpm: 300,
    scope: "section",
    showHeadings: false,
    blocks: [],
    rsvp: { running: false, words: [], index: 0, timer: 0 },
    onKey: null
  };

  function zenNumber(key, fallback) {
    const value = Number(window.localStorage?.getItem?.(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function zenWrite(key, value) {
    try {
      window.localStorage?.setItem?.(key, String(value));
    } catch (_error) {
      // Storage can be unavailable; ignore.
    }
  }

  function ensureZenReaderButton() {
    const host = document.querySelector("#alphabet-text-section .detail-pane-export-controls")
      || document.querySelector("#alphabet-text-section .alpha-text-heading-tools");
    if (!(host instanceof HTMLElement) || host.querySelector(".zen-reader-open")) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-sequence-btn zen-reader-open";
    button.textContent = "Zen Reader";
    button.title = "Open a fullscreen, reflowable reading view";
    button.addEventListener("click", () => openZenReader());
    host.appendChild(button);
  }

  function zenVerseBlocks(scope) {
    const blocks = [];
    const pushVerses = (verses, workTitle, heading) => {
      (Array.isArray(verses) ? verses : []).forEach((verse) => {
        const text = String(verse?.text || "").trim();
        if (!text) return;
        blocks.push({
          workTitle: String(workTitle || "").trim(),
          heading: String(heading || "").trim(),
          reference: String(verse.reference || (verse.number ? `Verse ${verse.number}` : "")).trim(),
          text
        });
      });
    };

    // The loaded passage carries the verses; the cached catalog sections often
    // don't, so always prefer it for the current section.
    const passage = state.currentPassage;
    const passageHeading = passage?.section?.label || passage?.section?.title || getSelectedSection(getSelectedSource(), getSelectedWork())?.label || "";

    if (scope === "text") {
      const source = getSelectedSource();
      (Array.isArray(source?.works) ? source.works : []).forEach((work) => {
        (Array.isArray(work?.sections) ? work.sections : []).forEach((section) => {
          pushVerses(section.verses, work.title || work.label || "", section.label || section.title || "");
        });
      });
    }
    if (!blocks.length) {
      pushVerses(passage?.verses, "", passageHeading);
    }
    return blocks;
  }

  function zenApplyTypography() {
    if (!zenState.flowEl) return;
    zenState.flowEl.style.fontSize = `${zenState.fontSize}px`;
    zenState.flowEl.style.maxWidth = `${zenState.lineWidth}ch`;
  }

  function zenRenderFlow() {
    if (!zenState.flowEl) return;
    zenState.flowEl.replaceChildren();
    let lastWork = "";
    let lastHeading = "";
    zenState.blocks.forEach((block) => {
      if (zenState.showHeadings && block.workTitle && block.workTitle !== lastWork) {
        lastWork = block.workTitle;
        lastHeading = "";
        const workHead = document.createElement("h3");
        workHead.className = "zen-reader-work";
        workHead.textContent = block.workTitle;
        zenState.flowEl.appendChild(workHead);
      }
      if (zenState.showHeadings && block.heading && block.heading !== lastHeading) {
        lastHeading = block.heading;
        const heading = document.createElement("h4");
        heading.className = "zen-reader-section";
        heading.textContent = block.heading;
        zenState.flowEl.appendChild(heading);
      }
      const para = document.createElement("p");
      para.className = "zen-reader-verse";
      if (zenState.showHeadings && block.reference) {
        const ref = document.createElement("span");
        ref.className = "zen-reader-ref";
        ref.textContent = block.reference;
        para.appendChild(ref);
      }
      para.appendChild(document.createTextNode(block.text));
      zenState.flowEl.appendChild(para);
    });
    zenApplyTypography();
  }

  function zenStopRsvp() {
    zenState.rsvp.running = false;
    if (zenState.rsvp.timer) {
      window.clearTimeout(zenState.rsvp.timer);
      zenState.rsvp.timer = 0;
    }
  }

  function zenRsvpTick() {
    if (!zenState.rsvp.running || !zenState.wordEl) return;
    const words = zenState.rsvp.words;
    if (zenState.rsvp.index >= words.length) {
      zenStopRsvp();
      zenState.wordEl.textContent = "— done —";
      return;
    }
    const word = words[zenState.rsvp.index];
    zenState.rsvp.index += 1;
    const focus = Math.max(0, Math.min(word.length - 1, Math.floor(word.length / 3)));
    zenState.wordEl.replaceChildren(
      document.createTextNode(word.slice(0, focus)),
      Object.assign(document.createElement("span"), { className: "zen-reader-orp", textContent: word.charAt(focus) || "" }),
      document.createTextNode(word.slice(focus + 1))
    );
    zenState.rsvp.timer = window.setTimeout(zenRsvpTick, Math.round(60000 / Math.max(60, zenState.wpm)));
  }

  function zenStartRsvp() {
    const words = zenState.blocks
      .map((block) => block.text)
      .join(" ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);
    if (!words.length) return;
    zenState.rsvp.words = words;
    zenState.rsvp.index = 0;
    zenState.rsvp.running = true;
    zenRsvpTick();
  }

  function zenToggleRsvp() {
    if (zenState.rsvp.running) {
      zenStopRsvp();
      if (zenState.wordEl) zenState.wordEl.textContent = "Paused";
    } else {
      zenStartRsvp();
    }
  }

  function zenSetScope(scope) {
    zenState.scope = scope === "text" ? "text" : "section";
    zenWrite(ZEN_STORAGE.scope, zenState.scope);
    zenState.blocks = zenVerseBlocks(zenState.scope);
    zenStopRsvp();
    if (zenState.overlay) {
      zenState.overlay.classList.toggle("is-text-scope", zenState.scope === "text");
    }
    zenRenderFlow();
    const scopeSelect = zenState.overlay?.querySelector(".zen-reader-scope");
    if (scopeSelect) scopeSelect.value = zenState.scope;
  }

  function closeZenReader() {
    zenStopRsvp();
    if (zenState.onKey) {
      document.removeEventListener("keydown", zenState.onKey);
      zenState.onKey = null;
    }
    zenState.overlay?.remove();
    zenState.overlay = null;
    zenState.flowEl = null;
  }

  function openZenReader() {
    closeZenReader();
    zenState.fontSize = zenNumber(ZEN_STORAGE.fontSize, 20);
    zenState.lineWidth = zenNumber(ZEN_STORAGE.lineWidth, 46);
    zenState.wpm = zenNumber(ZEN_STORAGE.wpm, 300);
    zenState.scope = window.localStorage?.getItem?.(ZEN_STORAGE.scope) === "text" ? "text" : "section";
    zenState.showHeadings = window.localStorage?.getItem?.(ZEN_STORAGE.headings) === "1";
    zenState.blocks = zenVerseBlocks(zenState.scope);
    if (!zenState.blocks.length) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "zen-reader";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="zen-reader-bar">
        <strong class="zen-reader-title"></strong>
        <div class="zen-reader-tools">
          <button type="button" class="zen-reader-btn" data-action="font-smaller" title="Smaller text">A−</button>
          <button type="button" class="zen-reader-btn" data-action="font-bigger" title="Larger text">A+</button>
          <button type="button" class="zen-reader-btn" data-action="rsvp" title="Speed reading (space)">Speed</button>
          <button type="button" class="zen-reader-btn" data-action="settings" title="Reader settings">Settings</button>
          <button type="button" class="zen-reader-btn" data-action="close" title="Close (Esc)">Close</button>
        </div>
      </div>
      <div class="zen-reader-rsvp" hidden>
        <div class="zen-reader-word">Ready</div>
        <div class="zen-reader-rsvp-controls">
          <button type="button" class="zen-reader-btn" data-action="rsvp-toggle">Start</button>
          <label class="zen-reader-rsvp-wpm">WPM
            <input type="range" min="120" max="700" step="10" class="zen-reader-wpm">
            <span class="zen-reader-wpm-value"></span>
          </label>
        </div>
      </div>
      <div class="zen-reader-scroll">
        <div class="zen-reader-flow"></div>
      </div>
      <div class="zen-reader-settings" hidden>
        <label>Text size <input type="range" min="14" max="36" step="1" class="zen-reader-font"></label>
        <label>Line width <input type="range" min="28" max="80" step="2" class="zen-reader-width"></label>
        <label>Speed <input type="range" min="120" max="700" step="10" class="zen-reader-settings-wpm"></label>
        <label>Scope
          <select class="zen-reader-scope">
            <option value="section">This section</option>
            <option value="text">Whole text</option>
          </select>
        </label>
        <label class="zen-reader-check"><input type="checkbox" class="zen-reader-headings"> Show headings &amp; verse numbers</label>
      </div>`;
    document.body.appendChild(overlay);

    zenState.overlay = overlay;
    zenState.flowEl = overlay.querySelector(".zen-reader-flow");
    zenState.rsvpEl = overlay.querySelector(".zen-reader-rsvp");
    zenState.wordEl = overlay.querySelector(".zen-reader-word");
    zenState.settingsEl = overlay.querySelector(".zen-reader-settings");
    overlay.querySelector(".zen-reader-title").textContent = detailNameEl?.textContent?.trim() || detailSubEl?.textContent?.trim() || "Zen Reader";

    const fontInput = overlay.querySelector(".zen-reader-font");
    const widthInput = overlay.querySelector(".zen-reader-width");
    const wpmInput = overlay.querySelector(".zen-reader-wpm");
    const settingsWpm = overlay.querySelector(".zen-reader-settings-wpm");
    const wpmValue = overlay.querySelector(".zen-reader-wpm-value");
    fontInput.value = String(zenState.fontSize);
    widthInput.value = String(zenState.lineWidth);
    wpmInput.value = String(zenState.wpm);
    settingsWpm.value = String(zenState.wpm);
    wpmValue.textContent = `${zenState.wpm}`;
    overlay.querySelector(".zen-reader-scope").value = zenState.scope;
    const headingsInput = overlay.querySelector(".zen-reader-headings");
    headingsInput.checked = zenState.showHeadings;

    const setFont = (value) => {
      zenState.fontSize = Math.max(14, Math.min(36, Number(value) || zenState.fontSize));
      zenWrite(ZEN_STORAGE.fontSize, zenState.fontSize);
      fontInput.value = String(zenState.fontSize);
      zenApplyTypography();
    };
    const setWidth = (value) => {
      zenState.lineWidth = Math.max(28, Math.min(80, Number(value) || zenState.lineWidth));
      zenWrite(ZEN_STORAGE.lineWidth, zenState.lineWidth);
      widthInput.value = String(zenState.lineWidth);
      zenApplyTypography();
    };
    const setWpm = (value) => {
      zenState.wpm = Math.max(120, Math.min(700, Number(value) || zenState.wpm));
      zenWrite(ZEN_STORAGE.wpm, zenState.wpm);
      wpmInput.value = String(zenState.wpm);
      settingsWpm.value = String(zenState.wpm);
      wpmValue.textContent = `${zenState.wpm}`;
    };

    overlay.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-action]");
      if (!(button instanceof HTMLElement)) return;
      const action = button.dataset.action;
      if (action === "close") closeZenReader();
      else if (action === "font-smaller") setFont(zenState.fontSize - 2);
      else if (action === "font-bigger") setFont(zenState.fontSize + 2);
      else if (action === "settings") zenState.settingsEl.hidden = !zenState.settingsEl.hidden;
      else if (action === "rsvp") {
        zenState.rsvpEl.hidden = !zenState.rsvpEl.hidden;
        if (zenState.rsvpEl.hidden) zenStopRsvp();
      } else if (action === "rsvp-toggle") {
        zenToggleRsvp();
        button.textContent = zenState.rsvp.running ? "Pause" : "Start";
      }
    });
    overlay.addEventListener("input", (event) => {
      if (event.target === fontInput) setFont(fontInput.value);
      else if (event.target === widthInput) setWidth(widthInput.value);
      else if (event.target === wpmInput) setWpm(wpmInput.value);
      else if (event.target === settingsWpm) setWpm(settingsWpm.value);
    });
    overlay.querySelector(".zen-reader-scope").addEventListener("change", (event) => {
      zenSetScope(event.target.value);
    });
    headingsInput.addEventListener("change", () => {
      zenState.showHeadings = headingsInput.checked;
      zenWrite(ZEN_STORAGE.headings, zenState.showHeadings ? "1" : "0");
      zenRenderFlow();
    });

    zenState.onKey = (event) => {
      if (event.key === "Escape") closeZenReader();
      else if (event.key === " ") {
        event.preventDefault();
        zenToggleRsvp();
      } else if (event.key === "=" || event.key === "+") setFont(zenState.fontSize + 2);
      else if (event.key === "-" || event.key === "_") setFont(zenState.fontSize - 2);
    };
    document.addEventListener("keydown", zenState.onKey);

    zenRenderFlow();
  }

  window.AlphabetTextUi = {
    ensureAlphabetTextSection,
    openPassage,
    openZenReader
  };
})();