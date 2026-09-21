(function () {
  "use strict";

  let config = {
    getAlphabets: () => null,
    getGematriaDb: () => null,
    getGematriaElements: () => ({
      cipherEl: null,
      inputEl: null,
      resultEl: null,
      breakdownEl: null,
      modeEls: [],
      matchesEl: null,
      inputLabelEl: null,
      cipherLabelEl: null,
      reverseCiphersEl: null,
      reverseCipherHintEl: null,
      reverseLanguageFieldEl: null,
      reverseLanguageEl: null,
      methodFieldEl: null,
      methodEl: null,
      optionsButtonEl: null,
      optionsSummaryEl: null,
      keyboardEl: null,
      keyboardScriptEl: null,
      keyboardGridEl: null,
      keyboardActionsEl: null,
      keyboardToggleEl: null
    })
  };

  const state = {
    loadingPromise: null,
    db: null,
    listenersBound: false,
    activeCipherId: "",
    forwardInputText: "",
    reverseInputText: "",
    reverseSelectedCipherIds: null,
    reverseLanguage: "english",
    reverseMethod: "",
    methodOptions: null,
    forwardRequestId: 0,
    anagramInputText: "",
    dictionaryInputText: "",
    activeMode: "forward",
    scriptCharMap: new Map(),
    reverseLookupCache: new Map(),
    anagramLookupCache: new Map(),
    dictionaryLookupCache: new Map(),
    reverseRequestId: 0,
    anagramRequestId: 0,
    dictionaryRequestId: 0,
    keyboardScriptId: "english",
    keyboardCase: null
  };

  const ENGLISH_LETTER_NAMES = {
    a: "Ay",
    b: "Bee",
    c: "See",
    d: "Dee",
    e: "Ee",
    f: "Eff",
    g: "Gee",
    h: "Aitch",
    i: "Eye",
    j: "Jay",
    k: "Kay",
    l: "Ell",
    m: "Em",
    n: "En",
    o: "Oh",
    p: "Pee",
    q: "Cue",
    r: "Ar",
    s: "Ess",
    t: "Tee",
    u: "You",
    v: "Vee",
    w: "Double-U",
    x: "Ex",
    y: "Why",
    z: "Zed"
  };

  function getAlphabets() {
    return config.getAlphabets?.() || null;
  }

  function getConfiguredGematriaDb() {
    return config.getGematriaDb?.() || null;
  }

  function getElements() {
    return config.getGematriaElements?.() || {
      cipherEl: null,
      inputEl: null,
      resultEl: null,
      breakdownEl: null,
      modeEls: [],
      matchesEl: null,
      inputLabelEl: null,
      cipherLabelEl: null,
      reverseCiphersEl: null,
      reverseCipherHintEl: null,
      reverseLanguageFieldEl: null,
      reverseLanguageEl: null,
      methodFieldEl: null,
      methodEl: null,
      optionsButtonEl: null,
      optionsSummaryEl: null,
      keyboardEl: null,
      keyboardScriptEl: null,
      keyboardGridEl: null,
      keyboardActionsEl: null,
      keyboardToggleEl: null
    };
  }

  function uniqueChars(values) {
    return Array.from(new Set((Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)));
  }

  function collectAlphabetChars(entries, keys) {
    const sourceEntries = Array.isArray(entries) ? entries : [];
    const sourceKeys = Array.isArray(keys) ? keys : [];
    const chars = [];

    sourceEntries.forEach((entry) => {
      sourceKeys.forEach((key) => {
        const value = String(entry?.[key] || "").trim();
        if (!value) {
          return;
        }

        const firstChar = [...value][0] || "";
        if (firstChar) {
          chars.push(firstChar);
        }
      });
    });

    return uniqueChars(chars);
  }

  function buildLetterNameMap(alphabetId) {
    const map = {};

    if (alphabetId === "english") {
      Object.entries(ENGLISH_LETTER_NAMES).forEach(([lower, name]) => {
        map[lower] = name;
        map[lower.toUpperCase()] = name;
      });
      return map;
    }

    const alphabets = getAlphabets() || {};
    const sourceIds = alphabetId === "greek" ? ["greek", "greekArchaic"] : [alphabetId];
    sourceIds.forEach((sourceId) => {
      const entries = Array.isArray(alphabets[sourceId]) ? alphabets[sourceId] : [];
      entries.forEach((entry) => {
        const label = sourceId === "greek" || sourceId === "greekArchaic"
          ? String(entry?.displayName || entry?.name || "").trim()
          : String(entry?.name || entry?.transliteration || "").trim();
        if (!label) {
          return;
        }

        ["char", "charLower", "charFinal", "letter"].forEach((key) => {
          const value = String(entry?.[key] || "").trim();
          if (value) {
            map[value] = label;
          }
        });
      });
    });

    return map;
  }

  function getKeyboardLayouts() {
    const db = state.db || getFallbackGematriaDb();
    const alphabets = getAlphabets() || {};
    const englishLower = uniqueChars(String(db.baseAlphabet || "abcdefghijklmnopqrstuvwxyz").toLowerCase().split(""));
    const englishUpper = englishLower.map((char) => char.toUpperCase());
    const hebrewChars = collectAlphabetChars(alphabets.hebrew, ["char"]);
    const greekEntries = [...(alphabets.greek || []), ...(alphabets.greekArchaic || [])];
    const greekUpper = collectAlphabetChars(greekEntries, ["char"]);
    const greekLower = collectAlphabetChars(greekEntries, ["charLower"]);
    const arabicChars = collectAlphabetChars(alphabets.arabic, ["char"]);

    return [
      { id: "english", label: "English", defaultCase: "lower", cases: { lower: englishLower, upper: englishUpper }, nameByChar: buildLetterNameMap("english") },
      { id: "hebrew", label: "Hebrew", defaultCase: "single", cases: { single: hebrewChars }, nameByChar: buildLetterNameMap("hebrew") },
      { id: "greek", label: "Greek", defaultCase: "upper", cases: { upper: greekUpper, lower: greekLower }, nameByChar: buildLetterNameMap("greek") },
      { id: "arabic", label: "Arabic", defaultCase: "single", cases: { single: arabicChars }, nameByChar: buildLetterNameMap("arabic") }
    ].filter((layout) => Object.values(layout.cases || {}).some((chars) => Array.isArray(chars) && chars.length > 0));
  }

  function setGematriaInputValue(nextValue, options = {}) {
    const { inputEl } = getElements();
    if (!(inputEl instanceof HTMLTextAreaElement)) {
      return;
    }

    const shouldFocus = options?.focus !== false;
    inputEl.value = String(nextValue || "");
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    if (shouldFocus) {
      inputEl.focus({ preventScroll: true });
    }
  }

  function insertGematriaText(insertValue, options = {}) {
    const { inputEl } = getElements();
    if (!(inputEl instanceof HTMLTextAreaElement)) {
      return;
    }

    const text = String(insertValue || "");
    if (!text) {
      return;
    }

    const isInputFocused = document.activeElement === inputEl;
    const useSelection = options?.preserveSelection !== false && isInputFocused;
    const start = useSelection && Number.isFinite(inputEl.selectionStart) ? inputEl.selectionStart : inputEl.value.length;
    const end = useSelection && Number.isFinite(inputEl.selectionEnd) ? inputEl.selectionEnd : start;
    const nextValue = `${inputEl.value.slice(0, start)}${text}${inputEl.value.slice(end)}`;
    setGematriaInputValue(nextValue, { focus: options?.focus });

    const nextCaret = start + text.length;
    if (useSelection) {
      inputEl.setSelectionRange(nextCaret, nextCaret);
    }
  }

  function backspaceGematriaText(options = {}) {
    const { inputEl } = getElements();
    if (!(inputEl instanceof HTMLTextAreaElement)) {
      return;
    }

    const isInputFocused = document.activeElement === inputEl;
    const useSelection = options?.preserveSelection !== false && isInputFocused;
    const start = useSelection && Number.isFinite(inputEl.selectionStart) ? inputEl.selectionStart : inputEl.value.length;
    const end = useSelection && Number.isFinite(inputEl.selectionEnd) ? inputEl.selectionEnd : start;
    if (start === 0 && end === 0) {
      return;
    }

    let nextStart = start;
    let nextEnd = end;
    if (start === end) {
      nextStart = Math.max(0, start - 1);
    }

    const nextValue = `${inputEl.value.slice(0, nextStart)}${inputEl.value.slice(nextEnd)}`;
    setGematriaInputValue(nextValue, { focus: options?.focus });
    if (useSelection) {
      inputEl.setSelectionRange(nextStart, nextStart);
    }
  }

  function syncKeyboardCaseToggle(keyboardActionsEl, activeLayout) {
    if (!(keyboardActionsEl instanceof HTMLElement)) {
      return;
    }

    const toggleEl = keyboardActionsEl.querySelector('[data-keyboard-action="shift"]');
    if (!(toggleEl instanceof HTMLButtonElement)) {
      return;
    }

    const caseKeys = Object.keys(activeLayout?.cases || {});
    const hasCaseToggle = caseKeys.length > 1;
    toggleEl.hidden = !hasCaseToggle;
    toggleEl.disabled = !hasCaseToggle;
    toggleEl.setAttribute("aria-pressed", state.keyboardCase === "upper" ? "true" : "false");
  }

  function renderKeyboardLayout() {
    const { keyboardScriptEl, keyboardGridEl, keyboardActionsEl } = getElements();
    if (!(keyboardScriptEl instanceof HTMLSelectElement) || !(keyboardGridEl instanceof HTMLElement)) {
      return;
    }

    const layouts = getKeyboardLayouts();
    if (!layouts.length) {
      keyboardScriptEl.replaceChildren();
      keyboardGridEl.replaceChildren();
      syncKeyboardCaseToggle(keyboardActionsEl, null);
      return;
    }

    const preferredLayoutId = String(state.keyboardScriptId || "english").trim();
    const activeLayout = layouts.find((layout) => layout.id === preferredLayoutId) || layouts[0];
    state.keyboardScriptId = activeLayout.id;

    const caseKeys = Object.keys(activeLayout.cases || {});
    if (!caseKeys.includes(state.keyboardCase)) {
      state.keyboardCase = activeLayout.defaultCase || caseKeys[0] || "";
    }
    const activeChars = activeLayout.cases?.[state.keyboardCase] || [];

    keyboardScriptEl.replaceChildren();
    layouts.forEach((layout) => {
      const optionEl = document.createElement("option");
      optionEl.value = layout.id;
      optionEl.textContent = layout.label;
      keyboardScriptEl.appendChild(optionEl);
    });
    keyboardScriptEl.value = state.keyboardScriptId;

    const fragment = document.createDocumentFragment();
    activeChars.forEach((char) => {
      const buttonEl = document.createElement("button");
      buttonEl.type = "button";
      buttonEl.className = "alpha-gematria-keyboard-key";
      buttonEl.dataset.keyboardInsert = char;
      buttonEl.textContent = char;
      const name = String(activeLayout.nameByChar?.[char] || "").trim();
      if (name) {
        buttonEl.title = name;
      }
      fragment.appendChild(buttonEl);
    });
    keyboardGridEl.replaceChildren(fragment);
    keyboardGridEl.setAttribute("lang", state.keyboardScriptId);

    syncKeyboardCaseToggle(keyboardActionsEl, activeLayout);
  }

  function toggleKeyboardCase() {
    const layouts = getKeyboardLayouts();
    const activeLayout = layouts.find((layout) => layout.id === state.keyboardScriptId);
    if (!activeLayout) {
      return;
    }

    const caseKeys = Object.keys(activeLayout.cases || {});
    if (caseKeys.length < 2) {
      return;
    }

    const currentIndex = caseKeys.indexOf(String(state.keyboardCase || ""));
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % caseKeys.length;
    state.keyboardCase = caseKeys[nextIndex];
    renderKeyboardLayout();
  }

  function handleKeyboardAction(action, options = {}) {
    const normalizedAction = String(action || "").trim().toLowerCase();
    if (!normalizedAction) {
      return;
    }

    if (normalizedAction === "backspace") {
      backspaceGematriaText(options);
      return;
    }

    if (normalizedAction === "space") {
      insertGematriaText(" ", options);
      return;
    }

    if (normalizedAction === "star") {
      insertGematriaText("*", options);
      return;
    }

    if (normalizedAction === "question") {
      insertGematriaText("?", options);
      return;
    }

    if (normalizedAction === "shift") {
      toggleKeyboardCase();
      return;
    }

    if (normalizedAction === "clear") {
      setGematriaInputValue("", { focus: options?.focus });
    }
  }

  function isReverseMode() {
    return state.activeMode === "reverse";
  }

  function isAnagramMode() {
    return state.activeMode === "anagram";
  }

  function isDictionaryMode() {
    return state.activeMode === "dictionary";
  }

  function getCurrentInputText() {
    if (isReverseMode()) {
      return state.reverseInputText;
    }

    if (isAnagramMode()) {
      return state.anagramInputText;
    }

    if (isDictionaryMode()) {
      return state.dictionaryInputText;
    }

    return state.forwardInputText;
  }

  function formatCount(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return "0";
    }
    return numericValue.toLocaleString();
  }

  function getFallbackGematriaDb() {
    return {
      baseAlphabet: "abcdefghijklmnopqrstuvwxyz",
      ciphers: [
        {
          id: "simple-ordinal",
          name: "Simple Ordinal",
          description: "A=1 ... Z=26",
          values: Array.from({ length: 26 }, (_, index) => index + 1)
        },
        {
          id: "decadic-cipher",
          name: "Decadic Cipher",
          description: "A=1 ... I=9, J=10 ... R=90, S=100 ... Z=800",
          values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800]
        }
      ]
    };
  }

  function normalizeGematriaText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function transliterationToBaseLetters(transliteration, baseAlphabet) {
    const normalized = normalizeGematriaText(transliteration);
    if (!normalized) {
      return "";
    }

    const primaryVariant = normalized.split(/[\/,;|]/)[0] || normalized;
    const primaryLetters = [...primaryVariant].filter((char) => baseAlphabet.includes(char));
    if (primaryLetters.length) {
      return primaryLetters[0];
    }

    const allLetters = [...normalized].filter((char) => baseAlphabet.includes(char));
    return allLetters[0] || "";
  }

  function addScriptCharMapEntry(map, scriptChar, mappedLetters) {
    const key = String(scriptChar || "").trim();
    if (!key) {
      return;
    }

    const value = typeof mappedLetters === "string"
      ? { mappedLetters: String(mappedLetters || "").trim() }
      : mappedLetters;
    if (!value || (typeof value === "object" && !Number.isFinite(Number(value.ordinal)) && !String(value.mappedLetters || "").trim())) {
      return;
    }

    map.set(key, value);
  }

  function getEntryOrdinal(entry, fallbackOrdinal) {
    const explicitOrdinal = Number(entry?.index);
    if (Number.isFinite(explicitOrdinal) && explicitOrdinal > 0) {
      return Math.trunc(explicitOrdinal);
    }
    return Math.trunc(Number(fallbackOrdinal) || 0);
  }

  function addScriptOrdinalEntries(map, entries, charKeys) {
    const sourceEntries = Array.isArray(entries) ? entries : [];
    const sourceCharKeys = Array.isArray(charKeys) ? charKeys : [];

    sourceEntries.forEach((entry, entryIndex) => {
      const ordinal = getEntryOrdinal(entry, entryIndex + 1);
      if (!ordinal) {
        return;
      }

      sourceCharKeys.forEach((charKey) => {
        const charValue = String(entry?.[charKey] || "").trim();
        if (!charValue) {
          return;
        }

        const firstChar = [...charValue][0] || "";
        if (!firstChar) {
          return;
        }

        addScriptCharMapEntry(map, firstChar, {
          ordinal,
          displayChar: firstChar
        });
      });
    });
  }

  function buildGematriaScriptMap(baseAlphabet) {
    const map = new Map();
    const alphabets = getAlphabets() || {};
    const hebrewLetters = Array.isArray(alphabets.hebrew) ? alphabets.hebrew : [];
    const greekClassicalLetters = Array.isArray(alphabets.greek) ? alphabets.greek : [];
    const greekArchaicLetters = Array.isArray(alphabets.greekArchaic) ? alphabets.greekArchaic : [];
    const greekLetters = [...greekClassicalLetters, ...greekArchaicLetters];
    const arabicLetters = Array.isArray(alphabets.arabic) ? alphabets.arabic : [];
    const enochianLetters = Array.isArray(alphabets.enochian) ? alphabets.enochian : [];

    addScriptOrdinalEntries(map, hebrewLetters, ["char"]);
    addScriptOrdinalEntries(map, greekLetters, ["char", "charLower", "charFinal"]);
    addScriptOrdinalEntries(map, arabicLetters, ["char"]);
    addScriptOrdinalEntries(map, enochianLetters, ["char"]);

    hebrewLetters.forEach((entry) => {
      const mapped = transliterationToBaseLetters(entry?.transliteration, baseAlphabet);
      if (!map.has(String(entry?.char || "").trim())) {
        addScriptCharMapEntry(map, entry?.char, mapped);
      }
    });

    greekLetters.forEach((entry) => {
      const mapped = transliterationToBaseLetters(entry?.transliteration, baseAlphabet);
      if (!map.has(String(entry?.char || "").trim())) {
        addScriptCharMapEntry(map, entry?.char, mapped);
      }
      if (!map.has(String(entry?.charLower || "").trim())) {
        addScriptCharMapEntry(map, entry?.charLower, mapped);
      }
      if (!map.has(String(entry?.charFinal || "").trim())) {
        addScriptCharMapEntry(map, entry?.charFinal, mapped);
      }
    });

    const hebrewFinalForms = {
      ך: "כ",
      ם: "מ",
      ן: "נ",
      ף: "פ",
      ץ: "צ"
    };

    Object.entries(hebrewFinalForms).forEach(([char, sourceChar]) => {
      const sourceEntry = map.get(sourceChar);
      if (!map.has(char) && sourceEntry) {
        addScriptCharMapEntry(map, char, sourceEntry);
      }
    });

    if (!map.has("ς") && map.has("σ")) {
      addScriptCharMapEntry(map, "ς", map.get("σ"));
    }

    return map;
  }

  function refreshScriptMap(baseAlphabetOverride = "") {
    const db = state.db || getFallbackGematriaDb();
    const baseAlphabet = String(baseAlphabetOverride || db.baseAlphabet || "abcdefghijklmnopqrstuvwxyz").toLowerCase();
    state.scriptCharMap = buildGematriaScriptMap(baseAlphabet);
  }

  function sanitizeGematriaDb(db) {
    const baseAlphabet = String(db?.baseAlphabet || "abcdefghijklmnopqrstuvwxyz").toLowerCase();
    const ciphers = Array.isArray(db?.ciphers)
      ? db.ciphers
        .map((cipher) => {
          const id = String(cipher?.id || "").trim();
          const name = String(cipher?.name || "").trim();
          const values = Array.isArray(cipher?.values)
            ? cipher.values.map((value) => Number(value))
            : [];

          if (!id || !name || values.length !== baseAlphabet.length || values.some((value) => !Number.isFinite(value))) {
            return null;
          }

          return {
            id,
            name,
            description: String(cipher?.description || "").trim(),
            values
          };
        })
        .filter(Boolean)
      : [];

    if (!ciphers.length) {
      return getFallbackGematriaDb();
    }

    return {
      baseAlphabet,
      ciphers
    };
  }

  async function loadGematriaDb() {
    if (state.db) {
      return state.db;
    }

    if (state.loadingPromise) {
      return state.loadingPromise;
    }

    state.loadingPromise = Promise.resolve()
      .then(async () => {
        const configuredDb = getConfiguredGematriaDb();
        if (configuredDb) {
          return configuredDb;
        }

        const referenceData = await window.TarotDataService?.loadReferenceData?.();
        return referenceData?.gematriaCiphers || null;
      })
      .then((db) => {
        if (!db) {
          throw new Error("Gematria cipher data unavailable from API.");
        }
        state.db = sanitizeGematriaDb(db);
        return state.db;
      })
      .catch(() => {
        state.db = getFallbackGematriaDb();
        return state.db;
      })
      .finally(() => {
        state.loadingPromise = null;
      });

    return state.loadingPromise;
  }

  function getActiveGematriaCipher() {
    const db = state.db || getFallbackGematriaDb();
    const ciphers = Array.isArray(db.ciphers) ? db.ciphers : [];
    if (!ciphers.length) {
      return null;
    }

    const selectedId = state.activeCipherId || ciphers[0].id;
    return ciphers.find((cipher) => cipher.id === selectedId) || ciphers[0];
  }

  function getGematriaCiphers() {
    const db = state.db || getFallbackGematriaDb();
    return Array.isArray(db.ciphers) ? db.ciphers : [];
  }

  function normalizeSelectedReverseCipherIds(rawCipherIds) {
    const ciphers = getGematriaCiphers();
    const requestedIds = Array.isArray(rawCipherIds)
      ? rawCipherIds.map((cipherId) => String(cipherId || "").trim()).filter(Boolean)
      : [];
    const requestedIdSet = new Set(requestedIds);

    return ciphers
      .map((cipher) => cipher.id)
      .filter((cipherId) => requestedIdSet.has(cipherId));
  }

  function getDefaultReverseCipherIds() {
    const activeCipher = getActiveGematriaCipher();
    if (activeCipher?.id) {
      return [activeCipher.id];
    }

    const firstCipher = getGematriaCiphers()[0];
    return firstCipher?.id ? [firstCipher.id] : [];
  }

  function getSelectedReverseCipherIds() {
    if (state.reverseSelectedCipherIds === null) {
      return getDefaultReverseCipherIds();
    }

    return normalizeSelectedReverseCipherIds(state.reverseSelectedCipherIds);
  }

  function setSelectedReverseCipherIds(rawCipherIds) {
    state.reverseSelectedCipherIds = normalizeSelectedReverseCipherIds(rawCipherIds);
  }

  function renderReverseCipherOptions() {
    const { reverseCiphersEl } = getElements();
    if (!reverseCiphersEl) {
      return;
    }

    const ciphers = getGematriaCiphers();
    const selectedCipherIds = new Set(getSelectedReverseCipherIds());
    const fragment = document.createDocumentFragment();

    ciphers.forEach((cipher) => {
      const optionEl = document.createElement("label");
      optionEl.className = "alpha-gematria-reverse-cipher-option";

      const checkboxEl = document.createElement("input");
      checkboxEl.type = "checkbox";
      checkboxEl.value = cipher.id;
      checkboxEl.checked = selectedCipherIds.has(cipher.id);
      checkboxEl.setAttribute("aria-label", cipher.name);
      optionEl.appendChild(checkboxEl);

      const textEl = document.createElement("span");
      textEl.className = "alpha-gematria-reverse-cipher-name";
      textEl.textContent = cipher.name;
      if (cipher.description) {
        textEl.title = cipher.description;
      }
      optionEl.appendChild(textEl);

      fragment.appendChild(optionEl);
    });

    reverseCiphersEl.replaceChildren(fragment);
  }

  function renderGematriaCipherOptions() {
    const { cipherEl } = getElements();
    if (!cipherEl) {
      return;
    }

    const db = state.db || getFallbackGematriaDb();
    const ciphers = Array.isArray(db.ciphers) ? db.ciphers : [];

    cipherEl.innerHTML = "";
    ciphers.forEach((cipher) => {
      const option = document.createElement("option");
      option.value = cipher.id;
      option.textContent = cipher.name;
      if (cipher.description) {
        option.title = cipher.description;
      }
      cipherEl.appendChild(option);
    });

    const activeCipher = getActiveGematriaCipher();
    state.activeCipherId = activeCipher?.id || "";
    cipherEl.value = state.activeCipherId;

    if (state.reverseSelectedCipherIds === null) {
      state.reverseSelectedCipherIds = getDefaultReverseCipherIds();
    } else {
      state.reverseSelectedCipherIds = normalizeSelectedReverseCipherIds(state.reverseSelectedCipherIds);
    }

    renderReverseCipherOptions();
  }

  function setMatchesMessage(matchesEl, message) {
    if (!matchesEl) {
      return;
    }

    matchesEl.replaceChildren();
    const emptyEl = document.createElement("div");
    emptyEl.className = "alpha-gematria-match-empty";
    emptyEl.textContent = message;
    matchesEl.appendChild(emptyEl);
  }

  function clearReverseMatches(matchesEl) {
    if (!matchesEl) {
      return;
    }

    matchesEl.replaceChildren();
    matchesEl.hidden = true;
  }

  function getModeElements(modeEls) {
    return Array.isArray(modeEls)
      ? modeEls.filter((element) => element instanceof HTMLInputElement)
      : [];
  }

  function getMethodOptions(language) {
    const options = state.methodOptions?.[language];
    return Array.isArray(options) ? options : [];
  }

  function getSelectedMethod() {
    const options = getMethodOptions(state.reverseLanguage);
    if (!options.length) return state.reverseMethod || "";
    if (options.some((option) => option.id === state.reverseMethod)) {
      return state.reverseMethod;
    }
    return options[0].id;
  }

  function populateMethodSelect() {
    const { methodFieldEl, methodEl } = getElements();
    if (methodFieldEl) {
      methodFieldEl.hidden = state.reverseLanguage === "english";
    }
    if (!methodEl) return;
    const options = getMethodOptions(state.reverseLanguage);
    methodEl.replaceChildren();
    options.forEach((option) => {
      const optionEl = document.createElement("option");
      optionEl.value = option.id;
      optionEl.textContent = option.label || option.id;
      if (option.description) optionEl.title = option.description;
      methodEl.appendChild(optionEl);
    });
    const nextMethod = getSelectedMethod();
    if (nextMethod) {
      state.reverseMethod = nextMethod;
      methodEl.value = nextMethod;
    }
  }

  async function loadMethodOptions() {
    if (state.methodOptions) return state.methodOptions;
    let payload = null;
    try {
      payload = await window.TarotDataService?.loadGematriaMethods?.();
    } catch (_error) {
      payload = null;
    }
    state.methodOptions = {
      hebrew: Array.isArray(payload?.hebrew) ? payload.hebrew : [],
      greek: Array.isArray(payload?.greek) ? payload.greek : []
    };
    populateMethodSelect();
    renderOptionsSummary();
    return state.methodOptions;
  }

  const MODE_LABELS = {
    forward: "Gematria",
    reverse: "Reverse Lookup",
    dictionary: "Dictionary",
    anagram: "Anagram Maker"
  };

  function renderOptionsSummary() {
    const { optionsSummaryEl, cipherEl } = getElements();
    if (!optionsSummaryEl) return;
    // Tool, script, and ciphers all live in the settings overlay now, so the
    // summary is the only place that shows the current selection inline.
    const scriptSelectEl = document.getElementById("alpha-script-select");
    const scriptLabel = scriptSelectEl?.selectedOptions?.[0]?.textContent || "";
    const modeLabel = MODE_LABELS[state.activeMode] || MODE_LABELS.forward;

    let detail;
    if (state.reverseLanguage === "english") {
      const cipherName = cipherEl?.selectedOptions?.[0]?.textContent || "Cipher";
      const count = getSelectedReverseCipherIds().length;
      detail = `English · ${cipherName}${count ? ` · ${count} cipher${count === 1 ? "" : "s"}` : ""}`;
    } else {
      const options = getMethodOptions(state.reverseLanguage);
      const method = options.find((option) => option.id === getSelectedMethod());
      const languageLabel = state.reverseLanguage === "hebrew" ? "Hebrew (Strong's)" : "Greek (Strong's)";
      detail = `${languageLabel} · ${method?.label || "Method"}`;
    }

    optionsSummaryEl.textContent = [modeLabel, detail, scriptLabel].filter(Boolean).join(" · ");
  }

  // On-screen keyboard show/hide, remembered per device. Phones start with it
  // hidden so the lookup input and results get the screen.
  const KEYBOARD_PREF_KEY = "kabbak-alpha-keyboard";

  function defaultKeyboardVisible() {
    try {
      return !window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches;
    } catch (_error) {
      return true;
    }
  }

  function keyboardVisible() {
    try {
      const raw = window.localStorage.getItem(KEYBOARD_PREF_KEY);
      if (raw === "1") return true;
      if (raw === "0") return false;
    } catch (_error) {}
    return defaultKeyboardVisible();
  }

  function setKeyboardVisible(show) {
    try {
      window.localStorage.setItem(KEYBOARD_PREF_KEY, show ? "1" : "0");
    } catch (_error) {}
    updateModeUi();
    renderOptionsSummary();
  }

  // The settings button/panel are wired by app/ui-page-settings.js; refresh the
  // inline summary after the shared overlay closes.
  function bindOptionsSummaryRefresh() {
    const { optionsButtonEl } = getElements();
    if (!optionsButtonEl) return;
    document.addEventListener("page-settings:closed", (event) => {
      if (event.target === optionsButtonEl) {
        renderOptionsSummary();
      }
    });
  }

  function updateModeUi() {
    const {
      cipherEl,
      inputEl,
      modeEls,
      matchesEl,
      inputLabelEl,
      cipherLabelEl,
      reverseCiphersEl,
      reverseCipherHintEl,
      reverseLanguageFieldEl,
      reverseLanguageEl,
      keyboardEl,
      keyboardScriptEl,
      keyboardGridEl,
      keyboardActionsEl
    } = getElements();

    const reverseMode = isReverseMode();
    const anagramMode = isAnagramMode();
    const dictionaryMode = isDictionaryMode();
    const radioEls = getModeElements(modeEls);

    radioEls.forEach((element) => {
      element.checked = String(element.value || "") === state.activeMode;
    });

    if (inputLabelEl) {
      inputLabelEl.textContent = reverseMode
        ? "Value"
        : (anagramMode ? "Letters" : (dictionaryMode ? "Pattern" : "Text"));
    }

    const scriptLanguage = state.reverseLanguage !== "english";
    const languageLabel = state.reverseLanguage === "hebrew"
      ? "Hebrew (Strong's)"
      : (state.reverseLanguage === "greek" ? "Greek (Strong's)" : "English");

    if (cipherLabelEl) {
      cipherLabelEl.textContent = reverseMode && !scriptLanguage
        ? "Ciphers"
        : ((anagramMode || dictionaryMode) ? "Cipher (not used in this mode)" : "Cipher");
    }

    if (cipherEl) {
      const hideCipherField = anagramMode || dictionaryMode || scriptLanguage;
      cipherEl.disabled = reverseMode || anagramMode || dictionaryMode || scriptLanguage;
      cipherEl.hidden = scriptLanguage || reverseMode;
      cipherEl.closest(".alpha-gematria-field")?.classList.toggle("is-disabled", hideCipherField);
    }

    if (reverseLanguageFieldEl) {
      reverseLanguageFieldEl.hidden = false;
    }
    if (reverseLanguageEl && reverseLanguageEl.value !== state.reverseLanguage) {
      reverseLanguageEl.value = state.reverseLanguage;
    }
    populateMethodSelect();
    renderOptionsSummary();

    if (reverseCiphersEl) {
      if (reverseMode && !scriptLanguage) {
        renderReverseCipherOptions();
      }
      reverseCiphersEl.hidden = !reverseMode || scriptLanguage;
    }

    if (reverseCipherHintEl) {
      reverseCipherHintEl.hidden = !reverseMode || scriptLanguage;
      reverseCipherHintEl.textContent = scriptLanguage
        ? `${languageLabel} words are matched with the selected method; ciphers are not used.`
        : "Select one or more ciphers to narrow reverse lookup results.";
    }

    if (inputEl) {
      inputEl.placeholder = reverseMode
        ? "Enter a whole number, e.g. 33"
        : (anagramMode ? "Type letters or a word, e.g. listen" : (dictionaryMode ? "Type a pattern, e.g. lo, *ende, d?nkey" : "Type or paste text"));
      inputEl.inputMode = reverseMode ? "numeric" : "text";
      inputEl.spellcheck = !(reverseMode || anagramMode || dictionaryMode);

      const nextValue = getCurrentInputText();
      if (inputEl.value !== nextValue) {
        inputEl.value = nextValue;
      }
    }

    if (keyboardEl) {
      keyboardEl.hidden = reverseMode || !keyboardVisible();
    }

    if (keyboardScriptEl) {
      keyboardScriptEl.disabled = reverseMode;
    }

    if (keyboardGridEl) {
      keyboardGridEl.classList.toggle("is-disabled", reverseMode);
    }

    if (keyboardActionsEl) {
      keyboardActionsEl.classList.toggle("is-disabled", reverseMode);
    }

    if (!reverseMode && !anagramMode && !dictionaryMode) {
      clearReverseMatches(matchesEl);
    }

    if (!reverseMode) {
      renderKeyboardLayout();
    }

    renderOptionsSummary();
  }

  function parseReverseLookupValue(rawValue) {
    const normalizedValue = String(rawValue || "").trim();
    if (!normalizedValue) {
      return null;
    }

    if (!/^\d+$/.test(normalizedValue)) {
      return Number.NaN;
    }

    const numericValue = Number(normalizedValue);
    if (!Number.isSafeInteger(numericValue)) {
      return Number.NaN;
    }

    return numericValue;
  }

  async function loadReverseLookup(value) {
    const language = state.reverseLanguage;
    const method = language === "english" ? "" : getSelectedMethod();
    const selectedCipherIds = language === "english" ? getSelectedReverseCipherIds() : [];
    const cacheKey = `${language}::${method}::${String(value)}::${selectedCipherIds.join(",")}`;
    if (state.reverseLookupCache.has(cacheKey)) {
      return state.reverseLookupCache.get(cacheKey);
    }

    const payload = await window.TarotDataService?.loadGematriaWordsByValue?.(value, {
      ciphers: selectedCipherIds,
      language,
      method
    });
    state.reverseLookupCache.set(cacheKey, payload);
    return payload;
  }

  async function loadAnagramLookup(text) {
    const cacheKey = String(text || "").trim().toLowerCase();
    if (state.anagramLookupCache.has(cacheKey)) {
      return state.anagramLookupCache.get(cacheKey);
    }

    const payload = await window.TarotDataService?.loadWordAnagrams?.(text);
    state.anagramLookupCache.set(cacheKey, payload);
    return payload;
  }

  async function loadDictionaryLookup(prefix) {
    const cacheKey = String(prefix || "").trim().toLowerCase();
    if (state.dictionaryLookupCache.has(cacheKey)) {
      return state.dictionaryLookupCache.get(cacheKey);
    }

    const payload = await window.TarotDataService?.loadWordsByPrefix?.(prefix);
    state.dictionaryLookupCache.set(cacheKey, payload);
    return payload;
  }

  function appendWordMetadata(cardEl, match) {
    if (!(cardEl instanceof HTMLElement) || !match || typeof match !== "object") {
      return;
    }

    const gematriaValue = Number(match?.gematriaValue);
    const syllableValue = Number(match?.syllableValue);
    if (!Number.isFinite(gematriaValue) && !Number.isFinite(syllableValue)) {
      return;
    }

    const metaEl = document.createElement("div");
    metaEl.className = "alpha-gematria-match-meta";

    if (Number.isFinite(gematriaValue)) {
      const gematriaEl = document.createElement("span");
      gematriaEl.className = "alpha-gematria-match-meta-chip";
      gematriaEl.textContent = `Simple Ordinal ${formatCount(gematriaValue)}`;
      metaEl.appendChild(gematriaEl);
    }

    if (Number.isFinite(syllableValue)) {
      const syllableEl = document.createElement("span");
      syllableEl.className = "alpha-gematria-match-meta-chip";
      syllableEl.textContent = `Syllables ${formatCount(syllableValue)}`;
      metaEl.appendChild(syllableEl);
    }

    if (metaEl.childElementCount) {
      cardEl.appendChild(metaEl);
    }
  }

  function renderDictionaryReverseMatches(payload, numericValue, language) {
    const { resultEl, breakdownEl, matchesEl } = getElements();
    if (!resultEl || !breakdownEl || !matchesEl) {
      return;
    }

    const matches = Array.isArray(payload?.matches) ? payload.matches : [];
    const count = Number(payload?.count);
    const displayCount = Number.isFinite(count) ? count : matches.length;
    const visibleMatches = matches.slice(0, 120);
    const label = language === "hebrew" ? "Hebrew (Strong's)" : "Greek (Strong's)";
    const valueLabel = language === "hebrew" ? "Hebrew gematria" : "Greek isopsephy";
    const source = String(payload?.meta?.source || "").trim();
    const methodId = String(payload?.method || payload?.meta?.method || "").trim();
    const methodInfo = getMethodOptions(language).find((option) => option.id === methodId);
    const methodLabel = methodInfo?.label || methodId;

    resultEl.textContent = `Value: ${formatCount(numericValue)}`;

    if (!displayCount) {
      breakdownEl.textContent = `No ${label} dictionary words matched this value${methodLabel ? ` under ${methodLabel}` : ""}.`;
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, `No matches in ${source || `the ${label} dictionary`}.`);
      return;
    }

    breakdownEl.textContent = `Found ${formatCount(displayCount)} ${label} ${displayCount === 1 ? "word" : "words"} with ${methodLabel ? `${methodLabel} ` : `${valueLabel} `}${formatCount(numericValue)}${source ? ` in ${source}` : ""}.${displayCount > visibleMatches.length ? ` Showing first ${formatCount(visibleMatches.length)}.` : ""}`;

    const fragment = document.createDocumentFragment();
    visibleMatches.forEach((match) => {
      const cardEl = document.createElement("article");
      cardEl.className = "alpha-gematria-match";

      const wordEl = document.createElement("div");
      wordEl.className = "alpha-gematria-match-word";
      wordEl.textContent = String(match?.word || "--");
      if (language === "hebrew") {
        wordEl.setAttribute("dir", "rtl");
        wordEl.setAttribute("lang", "he");
      }
      cardEl.appendChild(wordEl);

      const transliteration = String(match?.transliteration || "").trim();
      const lemma = String(match?.lemma || "").trim();
      const grammar = String(match?.grammar || "").trim();
      const subParts = [transliteration, lemma && lemma !== match?.word ? lemma : "", grammar].filter(Boolean);
      if (subParts.length) {
        const subEl = document.createElement("div");
        subEl.className = "alpha-gematria-match-meta";
        const chipEl = document.createElement("span");
        chipEl.className = "alpha-gematria-match-meta-chip";
        chipEl.textContent = subParts.join(" · ");
        subEl.appendChild(chipEl);
        cardEl.appendChild(subEl);
      }

      const definition = String(match?.definition || "").trim();
      if (definition) {
        const definitionEl = document.createElement("div");
        definitionEl.className = "alpha-gematria-match-definition";
        definitionEl.textContent = definition;
        cardEl.appendChild(definitionEl);
      }

      const metaEl = document.createElement("div");
      metaEl.className = "alpha-gematria-match-meta";
      const valueChip = document.createElement("span");
      valueChip.className = "alpha-gematria-match-meta-chip";
      valueChip.textContent = `${methodLabel || valueLabel} ${formatCount(Number(match?.gematriaValue) || numericValue)}`;
      metaEl.appendChild(valueChip);
      cardEl.appendChild(metaEl);

      fragment.appendChild(cardEl);
    });

    matchesEl.replaceChildren(fragment);
    matchesEl.hidden = false;
  }

  function renderReverseLookupMatches(payload, numericValue) {
    const { resultEl, breakdownEl, matchesEl } = getElements();
    if (!resultEl || !breakdownEl || !matchesEl) {
      return;
    }

    const language = String(payload?.language || "english").toLowerCase();
    if (language === "hebrew" || language === "greek") {
      renderDictionaryReverseMatches(payload, numericValue, language);
      return;
    }

    const matches = Array.isArray(payload?.matches) ? payload.matches : [];
    const count = Number(payload?.count);
    const displayCount = Number.isFinite(count) ? count : matches.length;
    const ciphers = Array.isArray(payload?.ciphers) ? payload.ciphers : [];
    const cipherCount = Number(payload?.cipherCount);
    const displayCipherCount = Number.isFinite(cipherCount) ? cipherCount : ciphers.length;
    const visibleMatches = matches.slice(0, 120);

    resultEl.textContent = `Value: ${formatCount(numericValue)}`;

    if (!displayCount) {
      breakdownEl.textContent = "No words matched this reverse gematria value.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, "No matches found in the reverse gematria index.");
      return;
    }

    const topCipherSummary = ciphers
      .slice(0, 6)
      .map((cipher) => `${String(cipher?.name || cipher?.id || "Unknown")} ${formatCount(cipher?.count)}`)
      .join(" · ");

    breakdownEl.textContent = `Found ${formatCount(displayCount)} matches across ${formatCount(displayCipherCount)} selected ciphers.${topCipherSummary ? ` Top ciphers: ${topCipherSummary}.` : ""}${displayCount > visibleMatches.length ? ` Showing first ${formatCount(visibleMatches.length)}.` : ""}`;

    const fragment = document.createDocumentFragment();
    visibleMatches.forEach((match) => {
      const cardEl = document.createElement("article");
      cardEl.className = "alpha-gematria-match";

      const wordEl = document.createElement("div");
      wordEl.className = "alpha-gematria-match-word";
      wordEl.textContent = String(match?.word || "--");
      cardEl.appendChild(wordEl);

      const definition = String(match?.definition || "").trim();
      if (definition) {
        const definitionEl = document.createElement("div");
        definitionEl.className = "alpha-gematria-match-definition";
        definitionEl.textContent = definition;
        cardEl.appendChild(definitionEl);
      }

      appendWordMetadata(cardEl, match);

      const ciphersEl = document.createElement("div");
      ciphersEl.className = "alpha-gematria-match-ciphers";
      const matchCiphers = Array.isArray(match?.ciphers) ? match.ciphers : [];
      matchCiphers.slice(0, 6).forEach((cipher) => {
        const chipEl = document.createElement("span");
        chipEl.className = "alpha-gematria-match-cipher";
        chipEl.textContent = String(cipher?.name || cipher?.id || "Unknown");
        ciphersEl.appendChild(chipEl);
      });
      if (matchCiphers.length > 6) {
        const extraEl = document.createElement("span");
        extraEl.className = "alpha-gematria-match-cipher";
        extraEl.textContent = `+${matchCiphers.length - 6} more`;
        ciphersEl.appendChild(extraEl);
      }
      cardEl.appendChild(ciphersEl);

      fragment.appendChild(cardEl);
    });

    matchesEl.replaceChildren(fragment);
    matchesEl.hidden = false;
  }

  async function renderReverseLookupResult() {
    const { resultEl, breakdownEl, matchesEl } = getElements();
    if (!resultEl || !breakdownEl || !matchesEl) {
      return;
    }

    const rawValue = state.reverseInputText;
    const language = state.reverseLanguage;
    const dictionaryLanguage = language !== "english";
    const selectedCipherIds = dictionaryLanguage ? [] : getSelectedReverseCipherIds();
    const languageLabel = language === "hebrew" ? "Hebrew (Strong's)" : (language === "greek" ? "Greek (Strong's)" : "English");

    if (!String(rawValue || "").trim()) {
      resultEl.textContent = "Value: --";
      breakdownEl.textContent = dictionaryLanguage
        ? `Enter a whole number to find ${languageLabel} dictionary words with that value.`
        : "Enter a whole number and choose one or more ciphers to narrow reverse matches.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, dictionaryLanguage
        ? `Reverse lookup values the installed ${languageLabel} dictionary with its own script values.`
        : "Reverse lookup searches the API-backed gematria word index using the selected ciphers only.");
      return;
    }

    if (!dictionaryLanguage && !selectedCipherIds.length) {
      resultEl.textContent = "Value: --";
      breakdownEl.textContent = "Choose at least one cipher before running reverse lookup.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, "Select one or more ciphers to limit reverse gematria matches.");
      return;
    }

    const numericValue = parseReverseLookupValue(rawValue);
    if (!Number.isFinite(numericValue)) {
      resultEl.textContent = "Value: --";
      breakdownEl.textContent = "Enter digits only to search the reverse gematria index.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, "Use a whole number such as 33 or 418.");
      return;
    }

    const requestId = state.reverseRequestId + 1;
    state.reverseRequestId = requestId;
    resultEl.textContent = `Value: ${formatCount(numericValue)}`;
    breakdownEl.textContent = "Searching reverse gematria index...";
    matchesEl.hidden = false;
    setMatchesMessage(matchesEl, "Loading matching words...");

    try {
      const payload = await loadReverseLookup(numericValue);
      if (requestId !== state.reverseRequestId || !isReverseMode()) {
        return;
      }
      renderReverseLookupMatches(payload, numericValue);
    } catch {
      if (requestId !== state.reverseRequestId || !isReverseMode()) {
        return;
      }
      resultEl.textContent = `Value: ${formatCount(numericValue)}`;
      breakdownEl.textContent = "Reverse lookup is unavailable right now.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, "Unable to load reverse gematria words from the API.");
    }
  }

  function renderAnagramMatches(payload) {
    const { resultEl, breakdownEl, matchesEl } = getElements();
    if (!resultEl || !breakdownEl || !matchesEl) {
      return;
    }

    const matches = Array.isArray(payload?.matches) ? payload.matches : [];
    const count = Number(payload?.count);
    const displayCount = Number.isFinite(count) ? count : matches.length;
    const visibleMatches = matches.slice(0, 120);
    const letterCount = Number(payload?.letterCount);

    resultEl.textContent = `Anagrams: ${formatCount(displayCount)}`;

    if (!displayCount) {
      breakdownEl.textContent = "No exact dictionary anagrams matched these letters.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, "Try another letter set or a different spelling.");
      return;
    }

    breakdownEl.textContent = `Found ${formatCount(displayCount)} anagrams for ${formatCount(letterCount)} letters.${displayCount > visibleMatches.length ? ` Showing first ${formatCount(visibleMatches.length)}.` : ""}`;

    const fragment = document.createDocumentFragment();
    visibleMatches.forEach((match) => {
      const cardEl = document.createElement("article");
      cardEl.className = "alpha-gematria-match";

      const wordEl = document.createElement("div");
      wordEl.className = "alpha-gematria-match-word";
      wordEl.textContent = String(match?.word || "--");
      cardEl.appendChild(wordEl);

      const definition = String(match?.definition || "").trim();
      if (definition) {
        const definitionEl = document.createElement("div");
        definitionEl.className = "alpha-gematria-match-definition";
        definitionEl.textContent = definition;
        cardEl.appendChild(definitionEl);
      }

      appendWordMetadata(cardEl, match);

      fragment.appendChild(cardEl);
    });

    matchesEl.replaceChildren(fragment);
    matchesEl.hidden = false;
  }

  function renderDictionaryMatches(payload) {
    const { resultEl, breakdownEl, matchesEl } = getElements();
    if (!resultEl || !breakdownEl || !matchesEl) {
      return;
    }

    const matches = Array.isArray(payload?.matches) ? payload.matches : [];
    const count = Number(payload?.count);
    const displayCount = Number.isFinite(count) ? count : matches.length;
    const normalizedPattern = String(payload?.normalized || state.dictionaryInputText || "").trim().toLowerCase();
    const hasWildcard = Boolean(payload?.hasWildcard) || normalizedPattern.includes("*") || normalizedPattern.includes("?");

    resultEl.textContent = normalizedPattern ? `Pattern: ${normalizedPattern}` : "Pattern: --";

    if (!displayCount) {
      breakdownEl.textContent = hasWildcard
        ? "No dictionary words matched this pattern."
        : "No dictionary words matched this prefix.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, hasWildcard
        ? "Try another pattern such as *ion, *ende, w*rd, or d?nkey."
        : "Try another word start such as lo, arc, or the.");
      return;
    }

    breakdownEl.textContent = hasWildcard
      ? `Found ${formatCount(displayCount)} words that match \"${normalizedPattern}\".`
      : `Found ${formatCount(displayCount)} words that start with \"${normalizedPattern}\".`;

    const fragment = document.createDocumentFragment();
    matches.forEach((match) => {
      const cardEl = document.createElement("article");
      cardEl.className = "alpha-gematria-match";

      const wordEl = document.createElement("div");
      wordEl.className = "alpha-gematria-match-word";
      wordEl.textContent = String(match?.word || "--");
      cardEl.appendChild(wordEl);

      const definition = String(match?.definition || "").trim();
      if (definition) {
        const definitionEl = document.createElement("div");
        definitionEl.className = "alpha-gematria-match-definition";
        definitionEl.textContent = definition;
        cardEl.appendChild(definitionEl);
      }

      appendWordMetadata(cardEl, match);

      fragment.appendChild(cardEl);
    });

    matchesEl.replaceChildren(fragment);
    matchesEl.hidden = false;
  }

  async function renderAnagramResult() {
    const { resultEl, breakdownEl, matchesEl } = getElements();
    if (!resultEl || !breakdownEl || !matchesEl) {
      return;
    }

    const rawText = state.anagramInputText;
    if (!String(rawText || "").trim()) {
      resultEl.textContent = "Anagrams: --";
      breakdownEl.textContent = "Enter letters to search for exact dictionary anagrams.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, "Anagram Maker finds exact word anagrams from the API word index.");
      return;
    }

    const requestId = state.anagramRequestId + 1;
    state.anagramRequestId = requestId;
    resultEl.textContent = "Anagrams: --";
    breakdownEl.textContent = "Searching anagram index...";
    matchesEl.hidden = false;
    setMatchesMessage(matchesEl, "Loading anagrams...");

    try {
      const payload = await loadAnagramLookup(rawText);
      if (requestId !== state.anagramRequestId || !isAnagramMode()) {
        return;
      }
      renderAnagramMatches(payload);
    } catch {
      if (requestId !== state.anagramRequestId || !isAnagramMode()) {
        return;
      }
      resultEl.textContent = "Anagrams: --";
      breakdownEl.textContent = "Anagram lookup is unavailable right now.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, "Unable to load anagrams from the API.");
    }
  }

  async function renderDictionaryResult() {
    const { resultEl, breakdownEl, matchesEl } = getElements();
    if (!resultEl || !breakdownEl || !matchesEl) {
      return;
    }

    const rawText = state.dictionaryInputText;
    if (!String(rawText || "").trim()) {
      resultEl.textContent = "Pattern: --";
      breakdownEl.textContent = "Enter opening letters or use * and ? wildcards to search dictionary words.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, "Dictionary mode supports starts-with searches and wildcards such as lo, *ende, w*rd, or d?nkey.");
      return;
    }

    const requestId = state.dictionaryRequestId + 1;
    state.dictionaryRequestId = requestId;
    resultEl.textContent = "Pattern: --";
    breakdownEl.textContent = "Searching dictionary index...";
    matchesEl.hidden = false;
    setMatchesMessage(matchesEl, "Loading matching words...");

    try {
      const payload = await loadDictionaryLookup(rawText);
      if (requestId !== state.dictionaryRequestId || !isDictionaryMode()) {
        return;
      }
      renderDictionaryMatches(payload);
    } catch {
      if (requestId !== state.dictionaryRequestId || !isDictionaryMode()) {
        return;
      }
      resultEl.textContent = "Pattern: --";
      breakdownEl.textContent = "Dictionary lookup is unavailable right now.";
      matchesEl.hidden = false;
      setMatchesMessage(matchesEl, "Unable to load dictionary matches from the API.");
    }
  }

  function computeGematria(text, cipher, baseAlphabet) {
    const normalizedInput = normalizeGematriaText(text);
    const scriptMap = state.scriptCharMap instanceof Map
      ? state.scriptCharMap
      : new Map();

    const letterParts = [];
    let total = 0;
    let count = 0;

    [...normalizedInput].forEach((char) => {
      if (baseAlphabet.includes(char)) {
        const index = baseAlphabet.indexOf(char);
        if (index < 0) {
          return;
        }

        const value = Number(cipher.values[index]);
        if (!Number.isFinite(value)) {
          return;
        }

        count += 1;
        total += value;
        letterParts.push(`${char.toUpperCase()}(${value})`);
        return;
      }

      const mappedEntry = scriptMap.get(char);
      if (!mappedEntry) {
        return;
      }

      const ordinal = Number(mappedEntry.ordinal);
      if (Number.isFinite(ordinal) && ordinal > 0) {
        const index = Math.trunc(ordinal) - 1;
        const value = Number(cipher.values[index]);
        if (!Number.isFinite(value)) {
          return;
        }

        const displayChar = String(mappedEntry.displayChar || char || "").trim() || char;
        count += 1;
        total += value;
        letterParts.push(`${displayChar}(${value})`);
        return;
      }

      const mappedLetters = String(mappedEntry.mappedLetters || "");
      if (!mappedLetters) {
        return;
      }

      [...mappedLetters].forEach((mappedChar) => {
        const index = baseAlphabet.indexOf(mappedChar);
        if (index < 0) {
          return;
        }

        const value = Number(cipher.values[index]);
        if (!Number.isFinite(value)) {
          return;
        }

        count += 1;
        total += value;
        letterParts.push(`${mappedChar.toUpperCase()}(${value})`);
      });
    });

    return {
      total,
      count,
      breakdown: letterParts.join(" + ")
    };
  }

  async function renderForwardGematriaResult() {
    const { resultEl, breakdownEl } = getElements();
    if (!resultEl || !breakdownEl) {
      return;
    }

    const language = state.reverseLanguage;
    if (language !== "english") {
      const languageLabel = language === "hebrew" ? "Hebrew" : "Greek";
      const method = getSelectedMethod();
      const text = state.forwardInputText;
      if (!String(text || "").trim()) {
        resultEl.textContent = "Total: --";
        breakdownEl.textContent = `Using ${languageLabel} ${method || "method"}. Enter ${languageLabel} letters to calculate.`;
        return;
      }
      const requestId = state.forwardRequestId + 1;
      state.forwardRequestId = requestId;
      resultEl.textContent = "Total: …";
      breakdownEl.textContent = `Calculating ${languageLabel} ${method || "method"}…`;
      try {
        const payload = await window.TarotDataService?.calculateGematriaValue?.(text, { language, method });
        if (requestId !== state.forwardRequestId || state.reverseLanguage !== language) {
          return;
        }
        const value = Number(payload?.value);
        const methodLabel = String(payload?.method || method || "");
        resultEl.textContent = `Total: ${Number.isFinite(value) ? formatCount(value) : "--"}`;
        breakdownEl.textContent = `${languageLabel} · ${methodLabel} · ${Number.isFinite(value) ? formatCount(value) : "—"}`;
      } catch (_error) {
        if (requestId !== state.forwardRequestId || state.reverseLanguage !== language) {
          return;
        }
        resultEl.textContent = "Total: --";
        breakdownEl.textContent = "Unable to calculate with the selected method.";
      }
      return;
    }

    const db = state.db || getFallbackGematriaDb();
    if (!(state.scriptCharMap instanceof Map) || !state.scriptCharMap.size) {
      refreshScriptMap(db.baseAlphabet);
    }

    const cipher = getActiveGematriaCipher();
    if (!cipher) {
      resultEl.textContent = "Total: --";
      breakdownEl.textContent = "No ciphers available.";
      return;
    }

    const { total, count, breakdown } = computeGematria(state.forwardInputText, cipher, db.baseAlphabet);

    resultEl.textContent = `Total: ${total}`;
    if (!count) {
      breakdownEl.textContent = `Using ${cipher.name}. Enter English, Greek, or Hebrew letters to calculate.`;
      return;
    }

    breakdownEl.textContent = `${cipher.name} · ${count} letters · ${breakdown} = ${total}`;
  }

  function renderGematriaResult() {
    updateModeUi();

    if (isReverseMode()) {
      void renderReverseLookupResult();
      return;
    }

    if (isAnagramMode()) {
      void renderAnagramResult();
      return;
    }

    if (isDictionaryMode()) {
      void renderDictionaryResult();
      return;
    }

    void renderForwardGematriaResult();
  }

  function bindGematriaListeners() {
    const { cipherEl, inputEl, modeEls, reverseCiphersEl, reverseLanguageEl, methodEl, optionsButtonEl, keyboardScriptEl, keyboardGridEl, keyboardActionsEl, keyboardToggleEl } = getElements();
    if (state.listenersBound || !cipherEl || !inputEl) {
      return;
    }

    if (keyboardToggleEl) {
      keyboardToggleEl.checked = keyboardVisible();
      keyboardToggleEl.addEventListener("change", () => setKeyboardVisible(keyboardToggleEl.checked));
    }
    // Script moved into the settings overlay; keep the summary in step.
    document.getElementById("alpha-script-select")?.addEventListener("change", renderOptionsSummary);

    cipherEl.addEventListener("change", () => {
      state.activeCipherId = String(cipherEl.value || "").trim();
      renderGematriaResult();
    });

    inputEl.addEventListener("input", () => {
      if (isReverseMode()) {
        state.reverseInputText = inputEl.value || "";
      } else if (isAnagramMode()) {
        state.anagramInputText = inputEl.value || "";
      } else if (isDictionaryMode()) {
        state.dictionaryInputText = inputEl.value || "";
      } else {
        state.forwardInputText = inputEl.value || "";
      }
      renderGematriaResult();
    });

    getModeElements(modeEls).forEach((modeEl) => {
      modeEl.addEventListener("change", () => {
        if (!modeEl.checked) {
          return;
        }

        state.activeMode = String(modeEl.value || "forward").trim() || "forward";
        updateModeUi();
        renderGematriaResult();
      });
    });

    reverseCiphersEl?.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
        return;
      }

      const nextSelectedCipherIds = Array.from(reverseCiphersEl.querySelectorAll("input[type='checkbox']:checked"))
        .map((element) => String(element.value || "").trim())
        .filter(Boolean);
      setSelectedReverseCipherIds(nextSelectedCipherIds);
      renderReverseCipherOptions();
      renderGematriaResult();
    });

    reverseLanguageEl?.addEventListener("change", () => {
      state.reverseLanguage = String(reverseLanguageEl.value || "english").trim() || "english";
      state.reverseMethod = "";
      updateModeUi();
      renderGematriaResult();
    });

    methodEl?.addEventListener("change", () => {
      state.reverseMethod = String(methodEl.value || "").trim();
      renderOptionsSummary();
      renderGematriaResult();
    });

    bindOptionsSummaryRefresh();

    keyboardScriptEl?.addEventListener("change", () => {
      state.keyboardScriptId = String(keyboardScriptEl.value || "english").trim() || "english";
      state.keyboardCase = null;
      renderKeyboardLayout();
    });

    keyboardGridEl?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const keyButton = target.closest("[data-keyboard-insert]");
      if (!(keyButton instanceof HTMLButtonElement) || keyButton.disabled) {
        return;
      }

      insertGematriaText(String(keyButton.dataset.keyboardInsert || ""), {
        focus: false,
        preserveSelection: false
      });
    });

    keyboardActionsEl?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const actionButton = target.closest("[data-keyboard-action]");
      if (!(actionButton instanceof HTMLButtonElement) || actionButton.disabled) {
        return;
      }

      handleKeyboardAction(actionButton.dataset.keyboardAction, {
        focus: false,
        preserveSelection: false
      });
    });

    state.listenersBound = true;
  }

  function ensureCalculator() {
    const { cipherEl, inputEl, resultEl, breakdownEl } = getElements();
    if (!cipherEl || !inputEl || !resultEl || !breakdownEl) {
      return;
    }

    bindGematriaListeners();
    updateModeUi();
    void loadMethodOptions();

    void loadGematriaDb().then(() => {
      refreshScriptMap((state.db || getFallbackGematriaDb()).baseAlphabet);
      renderGematriaCipherOptions();
      renderKeyboardLayout();
      renderGematriaResult();
    });
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig
    };

    const configuredDb = getConfiguredGematriaDb();
    if (configuredDb) {
      state.db = sanitizeGematriaDb(configuredDb);
    }
  }

  window.AlphabetGematriaUi = {
    ...(window.AlphabetGematriaUi || {}),
    init,
    refreshScriptMap,
    ensureCalculator
  };
})();