/* ui-scriber.js — Scriber: writing studio for poetry and short stories.
 * Every typed letter can be hovered or clicked to reveal its relations:
 * gematria across ciphers, meaning, tarot, astrology, kabbalah path, and
 * sister letters across alphabets. Documents save to the Scriber API.
 */
(function () {
  "use strict";

  const { html } = window.HtmlSafe || { html: (parts, ...values) => String(parts.join("")) };

  const service = window.TarotDataService || {};
  const API_DOCUMENTS_PATH = "/api/v1/scriber/documents";
  const LOCAL_DOCUMENTS_KEY = "scriber:documents";
  const MAX_SPAN_RENDER_LENGTH = 120000;

  const PLANET_SYMBOLS = {
    mercury: "☿︎", luna: "☾︎", venus: "♀︎", sol: "☉︎",
    jupiter: "♃︎", mars: "♂︎", saturn: "♄︎"
  };
  const ZODIAC_SYMBOLS = {
    aries: "♈︎", taurus: "♉︎", gemini: "♊︎", cancer: "♋︎",
    leo: "♌︎", virgo: "♍︎", libra: "♎︎", scorpio: "♏︎",
    sagittarius: "♐︎", capricorn: "♑︎", aquarius: "♒︎", pisces: "♓︎"
  };
  const ELEMENT_EMOJI = { air: "💨", water: "💧", fire: "🔥", earth: "🌍" };
  const HEBREW_DOUBLE_DUALITY = {
    bet: { left: "Life", right: "Death" },
    gimel: { left: "Peace", right: "War" },
    dalet: { left: "Wisdom", right: "Folly" },
    kaf: { left: "Wealth", right: "Poverty" },
    pe: { left: "Beauty", right: "Ugliness" },
    resh: { left: "Fruitfulness", right: "Sterility" },
    tav: { left: "Dominion", right: "Slavery" }
  };
  const HEBREW_FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
  const ALPHABET_LABELS = {
    hebrew: "Hebrew",
    greek: "Greek",
    greekArchaic: "Archaic Greek",
    english: "English",
    arabic: "Arabic",
    enochian: "Enochian"
  };

  const FALLBACK_CIPHERS = [
    { id: "simple-ordinal", name: "Simple Ordinal", description: "A=1 … Z=26", values: Array.from({ length: 26 }, (_v, index) => index + 1) },
    { id: "decadic-cipher", name: "Decadic Cipher", description: "A=1 … I=9, J=10 … Z=800", values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800] }
  ];

  const state = {
    initialized: false,
    alphabets: null,
    ciphers: FALLBACK_CIPHERS,
    baseAlphabet: "abcdefghijklmnopqrstuvwxyz",
    glyphMap: new Map(),
    hebrewById: new Map(),
    hebrewByChar: new Map(),
    greekByName: new Map(),
    englishByHebId: new Map(),
    arabicByHebId: new Map(),
    enochianByHebId: new Map(),
    documents: [],
    storageMode: "api",
    currentId: "",
    title: "",
    text: "",
    savedSnapshot: "\u0000",
    pinned: null,
    pinnedWord: "",
    dictionaryCache: new Map(),
    isComposing: false,
    dictRequestSeq: 0,
    lastCaretOffset: 0,
    assistEnabled: true,
    suggestSeq: 0,
    defSeq: 0,
    suggestTimer: 0,
    lastSuggestWord: ""
  };

  let sectionEl;
  let docCountEl, docListEl, newBtn, saveBtn, deleteBtn;
  let titleInput, writingArea, writingShellEl, wordCountEl, saveStatusEl, editorMetaEl;
  let pinClearBtn, relationsBodyEl;
  let assistToggleEl, suggestEl, suggestGemEl, suggestWordsEl;
  let dictInput, dictResults, gemInput, gemResults, revgemInput, revgemResults, anagramInput, anagramResults;

  function getElements() {
    sectionEl = document.getElementById("scriber-section");
    docCountEl = document.getElementById("scriber-doc-count");
    docListEl = document.getElementById("scriber-doc-list");
    newBtn = document.getElementById("scriber-new-btn");
    saveBtn = document.getElementById("scriber-save-btn");
    deleteBtn = document.getElementById("scriber-delete-btn");
    titleInput = document.getElementById("scriber-title");
    writingArea = document.getElementById("scriber-writing-area");
    writingShellEl = writingArea.closest(".scriber-writing-shell") || writingArea.parentElement;
    wordCountEl = document.getElementById("scriber-word-count");
    saveStatusEl = document.getElementById("scriber-save-status");
    editorMetaEl = document.getElementById("scriber-editor-meta");
    pinClearBtn = document.getElementById("scriber-pin-clear");
    relationsBodyEl = document.getElementById("scriber-relations-body");
    assistToggleEl = document.getElementById("scriber-assist-toggle");
    suggestEl = document.getElementById("scriber-suggest");
    suggestGemEl = document.getElementById("scriber-suggest-gem");
    suggestWordsEl = document.getElementById("scriber-suggest-words");
    dictInput = document.getElementById("scriber-dict-input");
    dictResults = document.getElementById("scriber-dict-results");
    gemInput = document.getElementById("scriber-gem-input");
    gemResults = document.getElementById("scriber-gem-results");
    revgemInput = document.getElementById("scriber-revgem-input");
    revgemResults = document.getElementById("scriber-revgem-results");
    anagramInput = document.getElementById("scriber-anagram-input");
    anagramResults = document.getElementById("scriber-anagram-results");
  }

  function cap(value) {
    const text = String(value || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  }

  function baseHebId(hebrewLetterId) {
    return String(hebrewLetterId || "").replace(/-sofit$/, "");
  }

  const HEBREW_SCRIPT_RE = /[\u0590-\u05FF]/;
  const GREEK_SCRIPT_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;

  function detectWordScript(text) {
    if (HEBREW_SCRIPT_RE.test(String(text || ""))) return "hebrew";
    if (GREEK_SCRIPT_RE.test(String(text || ""))) return "greek";
    return "latin";
  }

  // --- Letter mapping ---------------------------------------------------------

  function addGlyphMapEntry(glyph, alphabet, entry) {
    const trimmed = String(glyph || "").trim();
    if (!trimmed) return;
    state.glyphMap.set(trimmed, { alphabet, entry });
    const lower = trimmed.toLowerCase();
    if (lower !== trimmed) {
      state.glyphMap.set(lower, { alphabet, entry });
    }
  }

  function buildLetterMaps() {
    state.glyphMap.clear();
    state.hebrewById.clear();
    state.hebrewByChar.clear();
    state.greekByName.clear();
    state.englishByHebId.clear();
    state.arabicByHebId.clear();
    state.enochianByHebId.clear();

    const alphabets = state.alphabets || {};

    (Array.isArray(alphabets.enochian) ? alphabets.enochian : []).forEach((entry) => {
      if (entry.char) addGlyphMapEntry(entry.char, "enochian", entry);
      const hebrewLetterId = String(entry.hebrewLetterId || "").trim();
      if (hebrewLetterId && !state.enochianByHebId.has(hebrewLetterId)) {
        state.enochianByHebId.set(hebrewLetterId, entry);
      }
    });

    (Array.isArray(alphabets.arabic) ? alphabets.arabic : []).forEach((entry) => {
      if (entry.char) addGlyphMapEntry(entry.char, "arabic", entry);
      const forms = entry.forms || {};
      Object.values(forms).forEach((form) => addGlyphMapEntry(form, "arabic", entry));
      const hebrewLetterId = String(entry.hebrewLetterId || "").trim();
      if (hebrewLetterId && !state.arabicByHebId.has(hebrewLetterId)) {
        state.arabicByHebId.set(hebrewLetterId, entry);
      }
    });

    [...(Array.isArray(alphabets.greekArchaic) ? alphabets.greekArchaic : []), ...(Array.isArray(alphabets.greek) ? alphabets.greek : [])].forEach((entry) => {
      const alphabet = entry.archaic === true ? "greekArchaic" : "greek";
      if (entry.char) addGlyphMapEntry(entry.char, alphabet, entry);
      if (entry.charLower) addGlyphMapEntry(entry.charLower, alphabet, entry);
      if (entry.charFinal) addGlyphMapEntry(entry.charFinal, alphabet, entry);
      const name = String(entry.name || "").trim().toLowerCase();
      if (name && !state.greekByName.has(name)) {
        state.greekByName.set(name, entry);
      }
    });

    (Array.isArray(alphabets.hebrew) ? alphabets.hebrew : []).forEach((entry) => {
      if (entry.char) {
        addGlyphMapEntry(entry.char, "hebrew", entry);
        state.hebrewByChar.set(entry.char, entry);
      }
      const hebrewLetterId = String(entry.hebrewLetterId || "").trim();
      if (hebrewLetterId && !state.hebrewById.has(hebrewLetterId)) {
        state.hebrewById.set(hebrewLetterId, entry);
      }
    });

    (Array.isArray(alphabets.english) ? alphabets.english : []).forEach((entry) => {
      if (entry.letter) addGlyphMapEntry(entry.letter, "english", entry);
      const hebrewLetterId = String(entry.hebrewLetterId || "").trim();
      if (hebrewLetterId && !state.englishByHebId.has(hebrewLetterId)) {
        state.englishByHebId.set(hebrewLetterId, entry);
      }
    });
  }

  function resolveLetter(glyph) {
    const trimmed = String(glyph || "");
    if (!trimmed) return null;
    const direct = state.glyphMap.get(trimmed);
    if (direct) return direct;
    const lower = trimmed.toLowerCase();
    if (lower !== trimmed) return state.glyphMap.get(lower) || null;
    return null;
  }

  function basePositionFor(letterRecord) {
    const entry = letterRecord?.entry || {};
    const alphabet = letterRecord?.alphabet || "";
    const rawIndex = Number(entry.index);
    let position = Number.isFinite(rawIndex) && rawIndex > 0 ? Math.floor(rawIndex) : 0;

    if (alphabet === "hebrew" && entry.letterType === "final" && HEBREW_FINALS[entry.char]) {
      const baseEntry = state.hebrewByChar.get(HEBREW_FINALS[entry.char]);
      if (baseEntry && Number.isFinite(Number(baseEntry.index))) {
        position = Math.floor(Number(baseEntry.index));
      }
    }

    return Math.min(position, state.baseAlphabet.length);
  }

  function letterCipherValues(letterRecord) {
    const position = basePositionFor(letterRecord);
    if (position < 1) return [];
    return state.ciphers.map((cipher) => {
      const values = Array.isArray(cipher.values) ? cipher.values : [];
      const raw = Number(values[Math.min(position, values.length) - 1]);
      return { id: cipher.id, name: cipher.name, value: Number.isFinite(raw) ? raw : 0 };
    });
  }

  function wordCipherTotals(word) {
    const totals = state.ciphers.map((cipher) => ({ id: cipher.id, name: cipher.name, value: 0 }));
    const valueById = new Map(totals.map((entry) => [entry.id, entry]));
    let count = 0;
    [...String(word || "")].forEach((glyph) => {
      const resolved = resolveLetter(glyph);
      if (resolved) {
        letterCipherValues(resolved).forEach(({ id, value }) => {
          const target = valueById.get(id);
          if (target) target.value += value;
        });
        count += 1;
        return;
      }
      const lower = String(glyph).toLowerCase();
      const position = state.baseAlphabet.indexOf(lower) + 1;
      if (lower.length === 1 && position >= 1) {
        state.ciphers.forEach((cipher) => {
          const values = Array.isArray(cipher.values) ? cipher.values : [];
          const raw = Number(values[Math.min(position, values.length) - 1]);
          const target = valueById.get(cipher.id);
          if (target) target.value += Number.isFinite(raw) ? raw : 0;
        });
        count += 1;
      }
    });
    return { count, totals };
  }

  // --- Relations ---------------------------------------------------------------

  function hebrewEntryFor(letterRecord) {
    const { alphabet, entry } = letterRecord || {};
    if (alphabet === "hebrew") return entry || null;
    const hebrewLetterId = String(entry?.hebrewLetterId || "").trim();
    if (!hebrewLetterId) return null;
    return state.hebrewById.get(hebrewLetterId)
      || state.hebrewById.get(baseHebId(hebrewLetterId))
      || null;
  }

  function sisterLetters(letterRecord) {
    const { alphabet, entry } = letterRecord || {};
    const hebrew = hebrewEntryFor(letterRecord);
    const hebrewId = baseHebId(String(hebrew?.hebrewLetterId || entry?.hebrewLetterId || ""));

    const greek = alphabet === "greek" || alphabet === "greekArchaic"
      ? entry
      : (hebrew?.greekEquivalent ? state.greekByName.get(String(hebrew.greekEquivalent).toLowerCase()) || null : null);

    const english = alphabet === "english"
      ? entry
      : (hebrewId ? state.englishByHebId.get(hebrewId) || null : null);

    const arabic = alphabet === "arabic"
      ? entry
      : (hebrewId ? state.arabicByHebId.get(hebrewId) || null : null);

    const enochian = alphabet === "enochian"
      ? entry
      : (hebrewId ? state.enochianByHebId.get(hebrewId) || null : null);

    return { hebrew, greek, english, arabic, enochian };
  }

  function buildLetterRelations(letterRecord) {
    const { alphabet, entry } = letterRecord || {};
    const sisters = sisterLetters(letterRecord);
    const hebrew = sisters.hebrew;
    const letterType = entry?.letterType || hebrew?.letterType || "";
    const duality = hebrew && letterType === "double"
      ? HEBREW_DOUBLE_DUALITY[baseHebId(hebrew.hebrewLetterId)] || null
      : null;

    return {
      alphabet,
      entry,
      glyph: entry?.char || entry?.charLower || entry?.letter || "",
      name: entry?.name || entry?.displayName || entry?.title || entry?.letter || "",
      transliteration: entry?.transliteration || "",
      meaning: entry?.meaning || "",
      numerology: entry?.numerology ?? entry?.abjad ?? entry?.pythagorean ?? null,
      letterType,
      index: entry?.index ?? null,
      ipa: entry?.ipa || "",
      category: entry?.category || "",
      duality,
      tarot: hebrew?.tarot || null,
      astrology: hebrew?.astrology || null,
      kabbalahPathNumber: hebrew?.kabbalahPathNumber ?? null,
      sisters
    };
  }

  function identityLabel(relations) {
    const { alphabet } = relations;
    if (alphabet === "hebrew") return "Hebrew Letter";
    if (alphabet === "greek") return "Greek Letter";
    if (alphabet === "greekArchaic") return "Archaic Greek Letter";
    if (alphabet === "arabic") return "Arabic Letter";
    if (alphabet === "enochian") return "Enochian Letter";
    return "English Letter";
  }

  function letterNavDetail(sisters, alphabet) {
    if (alphabet === "hebrew") return { alphabet: "hebrew", hebrewLetterId: baseHebId(sisters.hebrew?.hebrewLetterId) };
    if (alphabet === "greek" || alphabet === "greekArchaic") return { alphabet: "greek", greekName: sisters.greek?.name };
    if (alphabet === "english") return { alphabet: "english", englishLetter: sisters.english?.letter };
    if (alphabet === "arabic") return { alphabet: "arabic", arabicName: sisters.arabic?.name };
    if (alphabet === "enochian") return { alphabet: "enochian", enochianId: sisters.enochian?.id };
    return {};
  }

  async function openLetterInAlphabet(detail) {
    try {
      await window.TarotLazySections?.ensureSectionScripts?.("alphabet-letters");
      await window.TarotAppRuntime?.ensureMagickDatasetLoaded?.();
      window.TarotEnsureDeferredUiInits?.();
    } catch (_error) {}
    const magickDataset = window.TarotAppRuntime?.getMagickDataset?.() || null;
    const referenceData = window.TarotAppRuntime?.getReferenceData?.() || null;
    window.AlphabetSectionUi?.ensureAlphabetSection?.(magickDataset, referenceData);
    window.TarotSectionStateUi?.setActiveSection?.("alphabet-letters");
    const ui = window.AlphabetSectionUi;
    requestAnimationFrame(() => {
      if (detail.alphabet === "hebrew" && detail.hebrewLetterId) {
        ui?.selectLetterByHebrewId?.(detail.hebrewLetterId);
        return;
      }
      if ((detail.alphabet === "greek" || detail.alphabet === "greekArchaic") && detail.greekName) {
        ui?.selectGreekLetterByName?.(detail.greekName);
        return;
      }
      if (detail.alphabet === "english" && detail.englishLetter) {
        ui?.selectEnglishLetter?.(detail.englishLetter);
        return;
      }
      if (detail.alphabet === "arabic" && detail.arabicName) {
        ui?.selectArabicLetter?.(detail.arabicName);
        return;
      }
      if (detail.alphabet === "enochian" && detail.enochianId) {
        ui?.selectEnochianLetter?.(detail.enochianId);
      }
    });
  }

  function sisterSummary(record, alphabet) {
    if (!record) return null;
    if (alphabet === "hebrew") return { glyph: record.char || "", label: `${record.name || ""} ${record.numerology ?? ""}`.trim() };
    if (alphabet === "greek" || alphabet === "greekArchaic") return { glyph: record.char || record.charLower || "", label: `${record.displayName || record.name || ""} ${record.numerology ?? ""}`.trim() };
    if (alphabet === "english") return { glyph: record.letter || "", label: `${record.letter || ""} ${record.pythagorean ?? ""}`.trim() };
    if (alphabet === "arabic") return { glyph: record.char || "", label: `${record.name || ""} ${record.abjad ?? ""}`.trim() };
    if (alphabet === "enochian") return { glyph: record.char || "", label: `${record.title || ""} ${record.numerology ?? ""}`.trim() };
    return null;
  }

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function relCard(title, builder) {
    const card = document.createElement("div");
    card.className = "meta-card scriber-rel-card";
    const head = document.createElement("strong");
    head.textContent = title;
    card.appendChild(head);
    const body = document.createElement("div");
    body.className = "body-text";
    card.appendChild(body);
    builder(body);
    return card;
  }

  function relRow(body, term, description) {
    const dl = body.querySelector("dl") || (() => {
      const created = document.createElement("dl");
      created.className = "alpha-dl";
      body.appendChild(created);
      return created;
    })();
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    if (typeof description === "string") {
      dd.textContent = description;
    } else {
      dd.appendChild(description);
    }
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function navButton(label, eventName, detail) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-inline-link";
    button.textContent = `${label} ↗`;
    button.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    });
    return button;
  }

  function mixedContent(parts) {
    const wrapper = document.createElement("span");
    parts.forEach((part) => {
      if (part == null || part === "") return;
      if (part instanceof Node) {
        wrapper.appendChild(part);
        return;
      }
      wrapper.appendChild(document.createTextNode(String(part)));
    });
    return wrapper;
  }

  function renderRelations(letterRecord, word, options = {}) {
    if (!letterRecord || !relationsBodyEl) return;
    const relations = buildLetterRelations(letterRecord);
    const { pinned } = options;
    relationsBodyEl.innerHTML = "";
    pinClearBtn.hidden = !pinned;

    const hero = document.createElement("div");
    hero.className = "scriber-rel-hero";
    const glyphEl = document.createElement("span");
    glyphEl.className = `scriber-rel-glyph scriber-rel-glyph--${relations.alphabet}`;
    glyphEl.textContent = relations.glyph || "?";
    hero.appendChild(glyphEl);
    const heroText = document.createElement("div");
    heroText.className = "scriber-rel-hero-text";
    const heroName = document.createElement("div");
    heroName.className = "scriber-rel-name";
    heroName.textContent = relations.name || "Unknown";
    heroText.appendChild(heroName);
    if (relations.transliteration) {
      const heroTrans = document.createElement("div");
      heroTrans.className = "scriber-rel-sub";
      heroTrans.textContent = `Transliteration: ${relations.transliteration}`;
      heroText.appendChild(heroTrans);
    }
    if (relations.meaning) {
      const heroMeaning = document.createElement("div");
      heroMeaning.className = "scriber-rel-sub";
      heroMeaning.textContent = `Mystical: ${relations.meaning}`;
      heroText.appendChild(heroMeaning);
    }
    hero.appendChild(heroText);
    relationsBodyEl.appendChild(hero);

    if (word && word.trim()) {
      const totals = wordCipherTotals(word);
      relationsBodyEl.appendChild(relCard(`Word — “${word.slice(0, 48)}”`, (body) => {
        const chips = document.createElement("div");
        chips.className = "scriber-chip-row";
        totals.totals.forEach((entry) => {
          const chip = document.createElement("span");
          chip.className = "scriber-chip";
          chip.textContent = `${entry.name}: ${entry.value}`;
          chip.title = entry.name;
          chips.appendChild(chip);
        });
        body.appendChild(chips);
        if (isDictionaryWord(word)) {
          const dictSlot = document.createElement("div");
          dictSlot.className = "scriber-word-dict";
          const note = document.createElement("span");
          note.className = "settings-field-hint";
          note.textContent = "Looking up the word…";
          dictSlot.appendChild(note);
          body.appendChild(dictSlot);
          void fillWordDictionary(word, dictSlot);
        }
      }));
    }

    const values = letterCipherValues(letterRecord);
    if (values.length) {
      relationsBodyEl.appendChild(relCard("Gematria", (body) => {
        values.forEach((entry) => {
          relRow(body, entry.name, String(entry.value));
        });
      }));
    }

    relationsBodyEl.appendChild(relCard("Identity", (body) => {
      relRow(body, "Alphabet", identityLabel(relations));
      if (relations.index != null) {
        relRow(body, "Position", `${relations.index} of ${letterPositionTotal(relations)}`);
      }
      if (relations.numerology != null && String(relations.numerology) !== "") {
        relRow(body, "Value", String(relations.numerology));
      }
      if (relations.letterType) {
        relRow(body, "Type", cap(relations.letterType));
      }
      if (relations.ipa) {
        relRow(body, "Pronunciation", relations.ipa);
      }
      if (relations.category) {
        relRow(body, "Category", cap(relations.category));
      }
    }));

    if (relations.duality) {
      relationsBodyEl.appendChild(relCard("Duality", (body) => {
        relRow(body, "Polarity", `${relations.duality.left} / ${relations.duality.right}`);
      }));
    }

    const associationRows = [];
    if (relations.astrology) {
      const { type, name } = relations.astrology;
      const id = String(name || "").toLowerCase();
      if (type === "planet") {
        const sym = PLANET_SYMBOLS[id] || "";
        associationRows.push({ term: "Planet", content: mixedContent([`${sym} `, navButton(cap(name), "nav:planet", { planetId: id })]) });
      } else if (type === "zodiac") {
        const sym = ZODIAC_SYMBOLS[id] || "";
        associationRows.push({ term: "Sign", content: mixedContent([`${sym} `, navButton(cap(name), "nav:zodiac", { signId: id })]) });
      } else if (type === "element") {
        associationRows.push({ term: "Element", content: mixedContent([`${ELEMENT_EMOJI[id] || ""} `, navButton(cap(name), "nav:elements", { elementId: id })]) });
      } else {
        associationRows.push({ term: cap(type || "Astrology"), content: cap(name) });
      }
    }
    if (relations.tarot && relations.tarot.card) {
      const tarotLabel = relations.tarot.trumpNumber != null
        ? `${relations.tarot.card} (${relations.tarot.trumpNumber})`
        : relations.tarot.card;
      associationRows.push({
        term: "Tarot",
        content: hasTarotAccess()
          ? navButton(tarotLabel, "kab:view-trump", { trumpNumber: relations.tarot.trumpNumber })
          : tarotLabel
      });
    }
    if (relations.kabbalahPathNumber != null) {
      associationRows.push({
        term: "Kabbalah Path",
        content: navButton(String(relations.kabbalahPathNumber), "tarot:view-kab-path", { pathNumber: relations.kabbalahPathNumber })
      });
    }
    if (associationRows.length) {
      relationsBodyEl.appendChild(relCard("Associations", (body) => {
        associationRows.forEach((row) => relRow(body, row.term, row.content));
      }));
    }

    const sisterEntries = [
      { key: "hebrew", label: "Hebrew" },
      { key: "greek", label: "Greek" },
      { key: "english", label: "English" },
      { key: "arabic", label: "Arabic" },
      { key: "enochian", label: "Enochian" }
    ];
    const sisterCards = [];
    sisterEntries.forEach(({ key, label }) => {
      if (key === relations.alphabet) return;
      if (key === "greek" && relations.alphabet === "greekArchaic") return;
      if (key === "greekArchaic") return;
      const summary = sisterSummary(relations.sisters[key], key);
      if (!summary || !summary.glyph) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scriber-sister-btn";
      const glyphSpan = document.createElement("span");
      glyphSpan.className = "scriber-sister-glyph";
      glyphSpan.textContent = summary.glyph;
      const labelSpan = document.createElement("span");
      labelSpan.className = "scriber-sister-label";
      labelSpan.textContent = `${label}: ${summary.label}`;
      button.appendChild(glyphSpan);
      button.appendChild(labelSpan);
      button.addEventListener("click", () => {
        void openLetterInAlphabet(letterNavDetail(relations.sisters, key));
      });
      sisterCards.push(button);
    });
    if (sisterCards.length) {
      relationsBodyEl.appendChild(relCard("Sister Letters", (body) => {
        sisterCards.forEach((button) => body.appendChild(button));
      }));
    }

  }

  function letterPositionTotal(relations) {
    const alphabets = state.alphabets || {};
    const list = alphabets[relations.alphabet];
    return Array.isArray(list) ? list.length : 0;
  }

  function countWordLetters(text) {
    return [...String(text || "")].filter((glyph) => isWordChar(glyph)).length;
  }

  function isDictionaryWord(text) {
    return countWordLetters(text) >= 2;
  }

  function latinWordKey(text) {
    return String(text || "").toLowerCase();
  }

  async function lookupWordEntry(word) {
    const trimmed = String(word || "").trim();
    if (!isDictionaryWord(trimmed)) {
      return null;
    }
    const script = detectWordScript(trimmed);
    const cacheKey = `word:${script}:${trimmed}`;
    if (state.dictionaryCache.has(cacheKey)) {
      return state.dictionaryCache.get(cacheKey);
    }

    let entry = null;
    try {
      if (script === "hebrew" || script === "greek") {
        const payload = await service.loadWordTranslations(trimmed, { mode: "exact", limit: 5 });
        const matches = Array.isArray(payload?.matches) ? payload.matches : [];
        entry = matches[0] || null;
        if (entry) {
          entry = {
            word: entry.lemma || entry.word || trimmed,
            definition: entry.definition || "",
            etymology: [entry.transliteration ? `transliteration: ${entry.transliteration}` : "", entry.etymology || ""]
              .filter(Boolean)
              .join(" · "),
            grammar: entry.grammar || ""
          };
        }
      } else {
        const payload = await service.loadWordLookup(latinWordKey(trimmed));
        entry = payload?.match || null;
      }
    } catch (_error) {
      entry = null;
    }

    state.dictionaryCache.set(cacheKey, entry);
    return entry;
  }

  function appendLabeledChips(bodyEl, label, values, onClick) {
    if (!values.length) return;
    const wrap = document.createElement("div");
    wrap.className = "scriber-word-extra";
    const head = document.createElement("span");
    head.className = "scriber-suggest-label";
    head.textContent = label;
    wrap.appendChild(head);
    const row = document.createElement("div");
    row.className = "scriber-chip-row";
    values.forEach((value) => {
      const chip = document.createElement(onClick ? "button" : "span");
      if (onClick) {
        chip.type = "button";
        chip.addEventListener("click", () => onClick(value));
      }
      chip.className = onClick ? "scriber-suggest-chip" : "scriber-chip";
      chip.textContent = typeof value === "string" ? value : value.word;
      chip.title = typeof value === "string" ? value : (value.definition || value.word);
      row.appendChild(chip);
    });
    wrap.appendChild(row);
    bodyEl.appendChild(wrap);
  }

  async function fillWordDictionary(word, bodyEl) {
    if (!bodyEl) return;
    const requestSeq = ++state.dictRequestSeq;
    const script = detectWordScript(word);
    const [entry, anagramPayload] = await Promise.all([
      lookupWordEntry(word),
      script === "latin"
        ? service.loadWordAnagrams(word).catch(() => ({ matches: [] }))
        : Promise.resolve({ matches: [] })
    ]);
    if (requestSeq !== state.dictRequestSeq || !bodyEl.isConnected) return;
    bodyEl.innerHTML = "";
    if (!entry) {
      const note = document.createElement("span");
      note.className = "settings-field-hint";
      note.textContent = "This word is not in the dictionary.";
      bodyEl.appendChild(note);
    } else {
      bodyEl.appendChild(dictionaryCardRow(entry));
      appendLabeledChips(bodyEl, "Synonyms", Array.isArray(entry.synonyms) ? entry.synonyms : []);
    }
    const selfKey = latinWordKey(word);
    const anagrams = (Array.isArray(anagramPayload?.matches) ? anagramPayload.matches : [])
      .filter((match) => latinWordKey(match.word) !== selfKey)
      .slice(0, 12);
    appendLabeledChips(bodyEl, "Anagrams", anagrams, (match) => {
      insertTextAtCaret(`${match.word} `);
    });
    if (!entry && !anagrams.length) {
      return;
    }
  }

  function dictionaryCardRow(match) {
    const row = document.createElement("div");
    row.className = "scriber-dict-row";
    const head = document.createElement("span");
    head.className = "scriber-dict-word";
    head.textContent = match.word || match.lemma || "";
    row.appendChild(head);
    if (match.definition) {
      const definition = document.createElement("span");
      definition.className = "scriber-dict-def";
      definition.textContent = match.definition;
      row.appendChild(definition);
    }
    if (match.etymology) {
      const etymology = document.createElement("span");
      etymology.className = "scriber-dict-etym";
      etymology.textContent = match.etymology;
      row.appendChild(etymology);
    }
    return row;
  }

  // --- Editor ------------------------------------------------------------------

  function isWordChar(glyph) {
    return Boolean(glyph) && !/[\s\p{P}\p{S}]/u.test(String(glyph));
  }

  function editorPlainText() {
    const children = Array.from(writingArea.childNodes || []);
    const parts = [];
    children.forEach((child, index) => {
      if (child.nodeType === Node.TEXT_NODE) {
        parts.push(child.nodeValue);
        return;
      }
      if (child.nodeName === "BR") {
        parts.push("\n");
        return;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        let line = "";
        const walk = (node) => {
          Array.from(node.childNodes || []).forEach((inner) => {
            if (inner.nodeType === Node.TEXT_NODE) {
              line += inner.nodeValue;
              return;
            }
            if (inner.nodeType === Node.ELEMENT_NODE && inner.nodeName !== "BR") {
              walk(inner);
            }
          });
        };
        walk(child);
        parts.push(line);
        if (index < children.length - 1) {
          parts.push("\n");
        }
      }
    });
    return parts.join("");
  }

  function lineInnerTextLength(node) {
    let length = 0;
    const walk = (current) => {
      Array.from(current.childNodes || []).forEach((inner) => {
        if (inner.nodeType === Node.TEXT_NODE) {
          length += inner.nodeValue.length;
          return;
        }
        if (inner.nodeType === Node.ELEMENT_NODE && inner.nodeName !== "BR") {
          walk(inner);
        }
      });
    };
    walk(node);
    return length;
  }

  function setCaretInElement(element, innerOffset) {
    const range = document.createRange();
    let remaining = innerOffset;
    let done = false;
    const walk = (node) => {
      if (done) return;
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue.length >= remaining) {
          range.setStart(node, remaining);
          range.collapse(true);
          done = true;
          return;
        }
        remaining -= node.nodeValue.length;
        return;
      }
      if (node.nodeName === "BR") {
        range.setStartBefore(node);
        range.collapse(true);
        done = true;
        return;
      }
      Array.from(node.childNodes || []).forEach(walk);
    };
    walk(element);
    if (!done) {
      if (element.lastChild && element.lastChild.nodeName === "BR") {
        range.setStartBefore(element.lastChild);
        range.collapse(true);
      } else {
        range.selectNodeContents(element);
        range.collapse(false);
      }
    }
    return range;
  }

  function caretTextOffset() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!writingArea.contains(range.startContainer)) return null;

    let offset = 0;
    const containerAnchored = range.startContainer === writingArea;
    const children = Array.from(writingArea.childNodes || []);
    const walkableChildren = containerAnchored
      ? children.slice(0, Math.max(range.startOffset, 0))
      : children;
    for (let index = 0; index < walkableChildren.length; index += 1) {
      const child = walkableChildren[index];
      if (child === range.startContainer) {
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          offset += Math.min(range.startOffset, range.startContainer.nodeValue.length);
        } else {
          let innerOffset = 0;
          const walk = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              innerOffset += node.nodeValue.length;
              return;
            }
            if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== "BR") {
              Array.from(node.childNodes || []).forEach(walk);
            }
          };
          Array.from(range.startContainer.childNodes || [])
            .slice(0, range.startOffset)
            .forEach(walk);
          offset += innerOffset;
        }
        return offset;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        offset += child.nodeValue.length;
      } else if (child.nodeName === "BR") {
        offset += 1;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        offset += lineInnerTextLength(child);
        if (index < children.length - 1) {
          offset += 1;
        }
      }
    }
    return offset;
  }

  function setCaretTextOffset(targetOffset) {
    const selection = window.getSelection();
    let range = null;
    let remaining = targetOffset;
    const children = Array.from(writingArea.childNodes || []);
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (index > 0 && child.nodeType === Node.ELEMENT_NODE) {
        if (remaining <= 0) {
          range = document.createRange();
          range.setStart(child, 0);
          range.collapse(true);
          break;
        }
        remaining -= 1;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.nodeValue.length >= remaining) {
          range = document.createRange();
          range.setStart(child, remaining);
          range.collapse(true);
          break;
        }
        remaining -= child.nodeValue.length;
        continue;
      }
      if (child.nodeName === "BR") {
        if (remaining <= 0) {
          range = document.createRange();
          range.setStartBefore(child);
          range.collapse(true);
          break;
        }
        remaining -= 1;
        continue;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        const innerLength = lineInnerTextLength(child);
        if (remaining <= innerLength) {
          range = setCaretInElement(child, remaining);
          break;
        }
        remaining -= innerLength;
      }
    }
    if (!range) {
      range = setCaretInElement(writingArea, Math.max(remaining, 0));
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function createLineElement(line) {
    const lineEl = document.createElement("div");
    lineEl.className = "scriber-line";
    if (!line) {
      lineEl.appendChild(document.createElement("br"));
      return lineEl;
    }
    if (line.length > MAX_SPAN_RENDER_LENGTH) {
      lineEl.appendChild(document.createTextNode(line));
      return lineEl;
    }
    [...line].forEach((glyph) => {
      const span = document.createElement("span");
      span.className = "scriber-letter";
      span.dataset.glyph = glyph;
      if (/\s/.test(glyph)) {
        span.classList.add("scriber-letter--space");
      }
      const resolved = resolveLetter(glyph);
      if (resolved) {
        span.dataset.resolved = "1";
        span.classList.add(`scriber-letter--${resolved.alphabet}`);
      }
      if (/[\u0590-\u05FF\u0600-\u06FF\u0370-\u03FF]/.test(glyph)) {
        span.setAttribute("dir", "auto");
      }
      span.textContent = glyph;
      lineEl.appendChild(span);
    });
    return lineEl;
  }

  function renderEditorText() {
    const fragment = document.createDocumentFragment();
    const text = String(state.text || "");
    if (!text) {
      writingArea.replaceChildren(fragment);
      return;
    }
    text.split("\n").forEach((line) => {
      fragment.appendChild(createLineElement(line));
    });
    writingArea.replaceChildren(fragment);
  }

  function updateWordCount() {
    const text = String(state.text || "");
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCountEl.textContent = `${words} word${words === 1 ? "" : "s"} · ${text.length} char${text.length === 1 ? "" : "s"}`;
    editorMetaEl.textContent = state.currentId ? `Editing ${state.title || "Untitled"}` : "New document";
  }

  function setSaveStatus(text, isError = false) {
    saveStatusEl.textContent = text;
    saveStatusEl.classList.toggle("is-error", Boolean(isError));
  }

  function markDirty() {
    setSaveStatus("Unsaved changes");
  }

  function clearSaveStatus() {
    setSaveStatus("");
  }

  let inputRenderPending = false;

  function handleEditorInput() {
    if (state.isComposing) return;
    if (inputRenderPending) return;
    inputRenderPending = true;
    queueMicrotask(() => {
      inputRenderPending = false;
      const next = editorPlainText();
      if (next === state.text) return;
      const caret = caretTextOffset();
      state.text = next;
      if (caret != null) {
        state.lastCaretOffset = caret;
      }
      renderEditorText();
      if (caret != null) {
        setCaretTextOffset(caret);
      }
      updateWordCount();
      markDirty();
      scheduleSuggestRefresh();
    });
  }

  function insertTextAtCaret(text) {
    const offset = caretTextOffset() ?? state.lastCaretOffset ?? String(state.text || "").length;
    const next = String(state.text || "");
    const insertAt = Math.min(Math.max(offset, 0), next.length);
    state.text = next.slice(0, insertAt) + text + next.slice(insertAt);
    renderEditorText();
    setCaretTextOffset(insertAt + text.length);
    writingArea.focus();
    updateWordCount();
    markDirty();
  }

  function wordAtSpan(span) {
    const letters = [span.dataset.glyph];
    let node = span.previousSibling;
    while (node && node.nodeType === Node.ELEMENT_NODE && node.dataset.glyph !== undefined && isWordChar(node.dataset.glyph)) {
      letters.unshift(node.dataset.glyph);
      node = node.previousSibling;
    }
    node = span.nextSibling;
    while (node && node.nodeType === Node.ELEMENT_NODE && node.dataset.glyph !== undefined && isWordChar(node.dataset.glyph)) {
      letters.push(node.dataset.glyph);
      node = node.nextSibling;
    }
    return letters.join("");
  }

  function highlightWord(span) {
    writingArea.querySelectorAll(".scriber-letter.is-word").forEach((entry) => entry.classList.remove("is-word"));
    let node = span.previousSibling;
    while (node && node.nodeType === Node.ELEMENT_NODE && node.dataset.glyph !== undefined && isWordChar(node.dataset.glyph)) {
      node.classList.add("is-word");
      node = node.previousSibling;
    }
    node = span.nextSibling;
    while (node && node.nodeType === Node.ELEMENT_NODE && node.dataset.glyph !== undefined && isWordChar(node.dataset.glyph)) {
      node.classList.add("is-word");
      node = node.nextSibling;
    }
    span.classList.add("is-word");
  }

  function clearWordHighlight() {
    writingArea.querySelectorAll(".scriber-letter.is-word").forEach((entry) => entry.classList.remove("is-word"));
  }

  function showRelationsHint() {
    relationsBodyEl.innerHTML = "";
    pinClearBtn.hidden = true;
    const hint = document.createElement("div");
    hint.className = "scriber-relations-hint";
    const line1 = document.createElement("p");
    line1.textContent = "Hover a letter in your writing to see everything it is connected to.";
    const line2 = document.createElement("p");
    line2.textContent = "Click a letter to pin it. Press Esc to unpin.";
    hint.appendChild(line1);
    hint.appendChild(line2);
    relationsBodyEl.appendChild(hint);
  }

  function showRelationsForSpan(span, pinned) {
    const glyph = span.dataset.glyph;
    const resolved = resolveLetter(glyph);
    if (!resolved) {
      showRelationsHint();
      return;
    }
    const word = wordAtSpan(span);
    if (pinned) {
      state.pinned = glyph;
      state.pinnedWord = word;
    }
    renderRelations(resolved, word, { pinned: pinned || Boolean(state.pinned) });
  }

  function unpin() {
    state.pinned = null;
    state.pinnedWord = "";
    showRelationsHint();
  }

  // --- Documents ---------------------------------------------------------------

  function readLocalDocuments() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(LOCAL_DOCUMENTS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function writeLocalDocuments(documents) {
    try {
      window.localStorage.setItem(LOCAL_DOCUMENTS_KEY, JSON.stringify(documents));
    } catch (_error) {}
  }

  function documentsUrl(documentId = "") {
    return service.buildApiUrl(documentId ? `${API_DOCUMENTS_PATH}/${encodeURIComponent(documentId)}` : API_DOCUMENTS_PATH);
  }

  async function refreshDocuments() {
    try {
      const payload = await service.requestJson("GET", documentsUrl());
      state.documents = Array.isArray(payload?.documents) ? payload.documents : [];
      state.storageMode = "api";
      setSaveStatus("");
    } catch (_error) {
      state.documents = readLocalDocuments();
      state.storageMode = "local";
      setSaveStatus("API unavailable — documents are stored locally.", true);
    }
    renderDocList();
  }

  function renderDocList() {
    if (!docListEl) return;
    docListEl.innerHTML = "";
    docCountEl.textContent = String(state.documents.length);
    deleteBtn.disabled = !state.currentId;
    if (!state.documents.length) {
      const empty = document.createElement("span");
      empty.className = "settings-field-hint";
      empty.textContent = "No documents yet.";
      docListEl.appendChild(empty);
      return;
    }
    state.documents.forEach((entry) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "list-item scriber-doc-item";
      item.classList.toggle("is-active", entry.id === state.currentId);
      const name = document.createElement("span");
      name.className = "list-name";
      name.textContent = entry.title || "Untitled";
      const meta = document.createElement("span");
      meta.className = "list-meta";
      const updated = entry.updatedAt ? new Date(entry.updatedAt) : null;
      const when = updated && !Number.isNaN(updated.getTime()) ? updated.toLocaleDateString() : "";
      meta.textContent = `${entry.wordCount ?? 0} words${when ? ` · ${when}` : ""}`;
      item.appendChild(name);
      item.appendChild(meta);
      item.addEventListener("click", () => {
        void openDocument(entry.id);
      });
      docListEl.appendChild(item);
    });
  }

  async function openDocument(documentId) {
    if (hasUnsavedChanges() && !window.confirm("Discard unsaved changes and open another document?")) {
      return;
    }
    if (state.storageMode === "api") {
      try {
        const opened = await service.requestJson("GET", documentsUrl(documentId));
        applyDocument(opened);
        return;
      } catch (error) {
        setSaveStatus(`Could not open the document. ${error?.message || ""}`, true);
        return;
      }
    }
    const local = readLocalDocuments().find((entry) => entry.id === documentId);
    if (local) {
      applyDocument(local);
    }
  }

  function applyDocument(entry) {
    state.currentId = String(entry?.id || "");
    state.title = String(entry?.title || "").trim();
    state.text = String(entry?.text || "");
    state.savedSnapshot = `${state.title}\u0000${state.text}`;
    titleInput.value = state.title;
    renderEditorText();
    updateWordCount();
    clearSaveStatus();
    renderDocList();
    unpin();
    hideSuggestStrip();
    hideWordSuggest();
  }

  function hasUnsavedChanges() {
    return `${state.title}\u0000${state.text}` !== state.savedSnapshot;
  }

  function newDocument() {
    if (hasUnsavedChanges() && !window.confirm("Discard unsaved changes and start a new document?")) {
      return;
    }
    state.currentId = "";
    state.title = "";
    state.text = "";
    state.savedSnapshot = "\u0000";
    titleInput.value = "";
    renderEditorText();
    updateWordCount();
    clearSaveStatus();
    renderDocList();
    unpin();
    hideSuggestStrip();
    hideWordSuggest();
    writingArea.focus();
  }

  function collectCurrentDocument() {
    return {
      title: String(titleInput.value || "").trim() || "Untitled",
      text: String(state.text || "")
    };
  }

  function upsertLocalDocument(entry) {
    const documents = readLocalDocuments();
    const nowIso = new Date().toISOString();
    if (state.currentId) {
      const index = documents.findIndex((item) => item.id === state.currentId);
      if (index >= 0) {
        documents[index] = { ...documents[index], ...entry, id: state.currentId, updatedAt: nowIso };
      } else {
        documents.push({ ...entry, id: state.currentId, createdAt: nowIso, updatedAt: nowIso });
      }
    } else {
      const created = {
        ...entry,
        id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      documents.push(created);
      state.currentId = created.id;
    }
    writeLocalDocuments(documents);
    state.documents = documents;
  }

  async function saveDocument() {
    const payload = collectCurrentDocument();
    state.title = payload.title;
    state.text = payload.text;
    state.savedSnapshot = `${state.title}\u0000${state.text}`;

    if (state.storageMode !== "api") {
      upsertLocalDocument(payload);
      updateWordCount();
      renderDocList();
      setSaveStatus("Saved locally.");
      return;
    }

    saveBtn.disabled = true;
    try {
      if (state.currentId) {
        await service.requestJson("PUT", documentsUrl(state.currentId), payload);
      } else {
        const created = await service.requestJson("POST", documentsUrl(), payload);
        state.currentId = String(created?.id || "");
      }
      updateWordCount();
      await refreshDocuments();
      setSaveStatus("Saved to the API.");
    } catch (error) {
      state.storageMode = "local";
      upsertLocalDocument(payload);
      renderDocList();
      setSaveStatus(`API unavailable — saved locally. ${error?.message || ""}`, true);
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function deleteDocument() {
    if (!state.currentId) return;
    if (!window.confirm("Delete this document?")) return;
    if (state.storageMode === "api") {
      try {
        await service.requestJson("DELETE", documentsUrl(state.currentId));
      } catch (error) {
        setSaveStatus(`Could not delete the document. ${error?.message || ""}`, true);
        return;
      }
    } else {
      writeLocalDocuments(readLocalDocuments().filter((item) => item.id !== state.currentId));
    }
    newDocument();
    void refreshDocuments();
    setSaveStatus("Document deleted.");
  }

  // --- Tools -------------------------------------------------------------------

  function toolWordRow(match, allowInsert) {
    const row = document.createElement("div");
    row.className = "scriber-tool-row";
    const textColumn = document.createElement("span");
    textColumn.className = "scriber-dict-text";
    const text = document.createElement("span");
    text.className = "scriber-dict-word";
    text.textContent = match.word || match.name || "";
    text.title = match.definition || "";
    textColumn.appendChild(text);
    if (match.definition) {
      const definition = document.createElement("span");
      definition.className = "scriber-dict-def";
      definition.textContent = match.definition;
      textColumn.appendChild(definition);
    }
    if (match.etymology) {
      const etymology = document.createElement("span");
      etymology.className = "scriber-dict-etym";
      etymology.textContent = match.etymology;
      textColumn.appendChild(etymology);
    }
    row.appendChild(textColumn);
    if (allowInsert && match.word) {
      const insert = document.createElement("button");
      insert.type = "button";
      insert.className = "scriber-btn scriber-btn-insert";
      insert.textContent = "Insert";
      insert.addEventListener("click", () => insertTextAtCaret(`${match.word} `));
      row.appendChild(insert);
    }
    return row;
  }

  function renderToolResults(containerEl, rows, emptyText) {
    if (!containerEl) return;
    containerEl.innerHTML = "";
    if (!rows.length) {
      const note = document.createElement("span");
      note.className = "settings-field-hint";
      note.textContent = emptyText;
      containerEl.appendChild(note);
      return;
    }
    rows.slice(0, 12).forEach((row) => containerEl.appendChild(row));
  }

  function bindTools() {
    let dictTimer = 0;
    dictInput.addEventListener("input", () => {
      window.clearTimeout(dictTimer);
      const prefix = String(dictInput.value || "").trim();
      if (!prefix) {
        dictResults.innerHTML = "";
        return;
      }
      dictTimer = window.setTimeout(async () => {
        try {
          if (detectWordScript(prefix) !== "latin") {
            if (countWordLetters(prefix) < 2) {
              renderToolResults(dictResults, [], "Type a full Hebrew or Greek word.");
              return;
            }
            const payload = await service.loadWordTranslations(prefix);
            const matches = Array.isArray(payload?.matches) ? payload.matches : [];
            renderToolResults(dictResults, matches.map((match) => toolWordRow({
              word: match.lemma || match.word,
              definition: match.definition,
              etymology: match.transliteration ? `transliteration: ${match.transliteration}` : ""
            }, true)), "No dictionary matches.");
            return;
          }
          const hasWildcard = /[*?]/.test(prefix);
          const letters = prefix.replace(/[^a-zA-Z]/g, "");
          if (!hasWildcard && letters.length >= 2) {
            const exact = await service.loadWordLookup(prefix);
            if (exact?.match) {
              const rows = [toolWordRow(exact.match, true)];
              (Array.isArray(exact.match.synonyms) ? exact.match.synonyms : []).forEach((synonym) => {
                rows.push(toolWordRow({ word: synonym, definition: "synonym" }, true));
              });
              renderToolResults(dictResults, rows, "No words found.");
              return;
            }
          }
          if (!hasWildcard && letters.length < 2) {
            renderToolResults(dictResults, [], "Type a full word, or use * for prefix search.");
            return;
          }
          const payload = await service.loadWordsByPrefix(prefix);
          const matches = Array.isArray(payload?.matches) ? payload.matches : [];
          renderToolResults(dictResults, matches.map((match) => toolWordRow(match, true)), "No words found.");
        } catch (error) {
          dictResults.innerHTML = "";
          const note = document.createElement("span");
          note.className = "settings-field-hint is-error";
          note.textContent = String(error?.message || "Lookup failed.");
          dictResults.appendChild(note);
        }
      }, 250);
    });

    gemInput.addEventListener("input", () => {
      const text = String(gemInput.value || "").trim();
      gemResults.innerHTML = "";
      if (!text) return;
      const totals = wordCipherTotals(text);
      const rows = totals.totals
        .filter((entry) => entry.value > 0 || totals.count === 0)
        .map((entry) => {
          const row = document.createElement("div");
          row.className = "scriber-tool-row";
          const name = document.createElement("span");
          name.className = "scriber-dict-word";
          name.textContent = entry.name;
          const value = document.createElement("span");
          value.className = "scriber-chip";
          value.textContent = String(entry.value);
          row.appendChild(name);
          row.appendChild(value);
          return row;
        });
      renderToolResults(gemResults, rows, "");
    });

    let revgemTimer = 0;
    revgemInput.addEventListener("input", () => {
      window.clearTimeout(revgemTimer);
      const value = String(revgemInput.value || "").trim();
      if (!value) {
        revgemResults.innerHTML = "";
        return;
      }
      revgemTimer = window.setTimeout(async () => {
        try {
          const payload = await service.loadGematriaWordsByValue(value, { ciphers: "simple-ordinal" });
          const matches = Array.isArray(payload?.matches) ? payload.matches : [];
          renderToolResults(revgemResults, matches.map((match) => toolWordRow(match, true)), "No words with that value.");
        } catch (error) {
          revgemResults.innerHTML = "";
          const note = document.createElement("span");
          note.className = "settings-field-hint is-error";
          note.textContent = String(error?.message || "Lookup failed.");
          revgemResults.appendChild(note);
        }
      }, 300);
    });

    let anagramTimer = 0;
    anagramInput.addEventListener("input", () => {
      window.clearTimeout(anagramTimer);
      const text = String(anagramInput.value || "").trim();
      if (!text) {
        anagramResults.innerHTML = "";
        return;
      }
      anagramTimer = window.setTimeout(async () => {
        try {
          const payload = await service.loadWordAnagrams(text);
          const matches = Array.isArray(payload?.matches) ? payload.matches : [];
          renderToolResults(anagramResults, matches.map((match) => toolWordRow(match, true)), "No anagrams found.");
        } catch (error) {
          anagramResults.innerHTML = "";
          const note = document.createElement("span");
          note.className = "settings-field-hint is-error";
          note.textContent = String(error?.message || "Lookup failed.");
          anagramResults.appendChild(note);
        }
      }, 250);
    });
  }

  // --- Live word assist --------------------------------------------------------

  function currentWordAtCaret() {
    const offset = caretTextOffset() ?? state.lastCaretOffset;
    if (offset == null) return null;
    const text = String(state.text || "");
    let start = offset;
    while (start > 0 && isWordChar(text[start - 1])) {
      start -= 1;
    }
    let end = offset;
    while (end < text.length && isWordChar(text[end])) {
      end += 1;
    }
    const word = text.slice(start, end);
    if (!word) return null;
    return { word, start, end };
  }

  function showSuggestStrip() {
    suggestEl.hidden = false;
  }

  function hideSuggestStrip() {
    suggestEl.hidden = true;
  }

  function renderSuggestGematria(word) {
    suggestGemEl.innerHTML = "";
    const label = document.createElement("span");
    label.className = "scriber-suggest-label";
    label.textContent = `“${word.slice(0, 24)}”`;
    suggestGemEl.appendChild(label);
    const totals = wordCipherTotals(word);
    totals.totals.forEach((entry) => {
      const chip = document.createElement("span");
      chip.className = "scriber-suggest-chip is-static";
      chip.textContent = `${entry.name}: ${entry.value}`;
      chip.title = entry.name;
      suggestGemEl.appendChild(chip);
    });
  }

  function hideWordSuggest() {
    suggestWordsEl.hidden = true;
    suggestWordsEl.innerHTML = "";
  }

  function positionWordSuggest() {
    if (suggestWordsEl.hidden) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) {
      hideWordSuggest();
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.top === 0 && rect.left === 0 && rect.width === 0 && rect.height === 0)) {
      hideWordSuggest();
      return;
    }
    const shellRect = writingShellEl.getBoundingClientRect();
    const panelWidth = suggestWordsEl.offsetWidth || 0;
    const panelHeight = suggestWordsEl.offsetHeight || 0;
    let left = rect.left - shellRect.left;
    let top = rect.bottom - shellRect.top + 6;
    if (top + panelHeight > shellRect.height - 4 && rect.top - shellRect.top > panelHeight + 8) {
      top = rect.top - shellRect.top - panelHeight - 6;
    }
    top = Math.max(4, Math.min(top, Math.max(4, shellRect.height - panelHeight - 4)));
    left = Math.max(6, Math.min(left, Math.max(6, shellRect.width - panelWidth - 6)));
    suggestWordsEl.style.top = `${top}px`;
    suggestWordsEl.style.left = `${left}px`;
  }

  function clearWordDefinitionLine() {
    suggestEl.querySelectorAll(".scriber-suggest-def").forEach((node) => node.remove());
  }

  function renderWordDefinitionLine(exactMatch) {
    clearWordDefinitionLine();
    if (!exactMatch) return;
    const line = document.createElement("div");
    line.className = "scriber-suggest-def";
    let text = exactMatch.word || "";
    if (exactMatch.definition) {
      text += ` — ${exactMatch.definition}`;
    }
    if (exactMatch.etymology) {
      text += `  [${exactMatch.etymology}]`;
    }
    line.textContent = text;
    line.title = text;
    suggestEl.appendChild(line);
  }

  function renderSuggestWords(wordInfo) {
    hideWordSuggest();
    const prefix = String(wordInfo.word || "").toLowerCase();
    if (!state.assistEnabled || prefix.length < 2 || detectWordScript(prefix) !== "latin") {
      return;
    }
    const seq = ++state.suggestSeq;
    const cacheKey = `sug:${prefix}`;
    const cached = state.dictionaryCache.get(cacheKey);
    const matchesPromise = cached
      ? Promise.resolve(cached)
      : service.loadWordsByPrefix(prefix, { limit: 40 })
          .then((payload) => {
            const matches = Array.isArray(payload?.matches) ? payload.matches : [];
            state.dictionaryCache.set(cacheKey, matches);
            return matches;
          })
          .catch(() => []);

    matchesPromise.then((rawMatches) => {
      if (seq !== state.suggestSeq || !suggestWordsEl.isConnected) return;
      const candidates = rawMatches
        .map((match) => String(match?.word || "").toLowerCase())
        .filter((word) => word.startsWith(prefix) && word.length > prefix.length)
        .sort((left, right) => {
          const lengthDelta = left.length - right.length;
          if (lengthDelta !== 0) return lengthDelta;
          return left.localeCompare(right);
        });

      const seen = new Set();
      const fragments = [];
      for (const word of candidates) {
        const fragment = word.slice(prefix.length, prefix.length + 3);
        if (seen.has(fragment)) continue;
        seen.add(fragment);
        fragments.push({ fragment, word });
        if (fragments.length >= 8) break;
      }
      if (!fragments.length) return;

      fragments.forEach(({ fragment, word }) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "scriber-suggest-chip";
        chip.textContent = fragment;
        const exact = rawMatches.find((match) => String(match?.word || "").toLowerCase() === word);
        let chipTitle = `${word}`;
        if (exact?.definition) {
          chipTitle += ` — ${exact.definition}`;
        }
        if (exact?.etymology) {
          chipTitle += `  [${exact.etymology}]`;
        }
        chip.title = chipTitle;
        chip.addEventListener("click", () => {
          insertTextAtCaret(fragment);
          scheduleSuggestRefresh();
        });
        suggestWordsEl.appendChild(chip);
      });
      suggestWordsEl.hidden = false;
      requestAnimationFrame(positionWordSuggest);
    });
  }

  function renderWordAssist(wordInfo) {
    const word = String(wordInfo.word || "");
    if (!isDictionaryWord(word)) {
      renderWordDefinitionLine(null);
      return;
    }
    const seq = ++state.defSeq;
    void lookupWordEntry(word).then((entry) => {
      if (seq !== state.defSeq) return;
      renderWordDefinitionLine(entry);
    });
  }

  function refreshSuggestions() {
    const info = currentWordAtCaret();
    if (!info || !info.word) {
      state.lastSuggestWord = "";
      hideSuggestStrip();
      hideWordSuggest();
      clearWordDefinitionLine();
      return;
    }
    state.lastSuggestWord = info.word;
    showSuggestStrip();
    renderSuggestGematria(info.word);
    renderWordAssist(info);
    renderSuggestWords(info);
  }

  function scheduleSuggestRefresh() {
    window.clearTimeout(state.suggestTimer);
    state.suggestTimer = window.setTimeout(() => {
      if (writingArea && sectionEl && !sectionEl.hidden) {
        refreshSuggestions();
      }
    }, 200);
  }

  function acceptFirstSuggestion() {
    if (suggestWordsEl.hidden || !state.assistEnabled) return false;
    const first = suggestWordsEl.querySelector(".scriber-suggest-chip");
    if (!first) return false;
    const info = currentWordAtCaret();
    if (!info) return false;
    insertTextAtCaret(first.textContent);
    scheduleSuggestRefresh();
    return true;
  }

  function updateAssistToggle() {
    assistToggleEl.setAttribute("aria-pressed", String(state.assistEnabled));
    assistToggleEl.textContent = state.assistEnabled ? "Dictionary assist: On" : "Dictionary assist: Off";
    try {
      window.localStorage.setItem("scriber:dictionary-assist", state.assistEnabled ? "on" : "off");
    } catch (_error) {}
  }

  function restoreAssistPreference() {
    try {
      state.assistEnabled = window.localStorage.getItem("scriber:dictionary-assist") !== "off";
    } catch (_error) {
      state.assistEnabled = true;
    }
  }

  // --- Events ------------------------------------------------------------------

  function bindEvents() {
    newBtn.addEventListener("click", newDocument);
    saveBtn.addEventListener("click", () => void saveDocument());
    deleteBtn.addEventListener("click", () => void deleteDocument());
    pinClearBtn.addEventListener("click", unpin);

    assistToggleEl.addEventListener("click", () => {
      state.assistEnabled = !state.assistEnabled;
      updateAssistToggle();
      scheduleSuggestRefresh();
    });

    titleInput.addEventListener("input", () => {
      state.title = titleInput.value;
      markDirty();
      updateWordCount();
    });

    writingArea.addEventListener("input", handleEditorInput);

    writingArea.addEventListener("keydown", (event) => {
      if (event.key === "Tab" && !event.isComposing) {
        if (acceptFirstSuggestion()) {
          event.preventDefault();
        }
        return;
      }
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        insertTextAtCaret("\n");
        return;
      }
      if (event.key === "Escape") {
        unpin();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDocument();
      }
    });

    writingArea.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      if (text) {
        insertTextAtCaret(text);
      }
    });

    writingArea.addEventListener("compositionstart", () => {
      state.isComposing = true;
    });
    writingArea.addEventListener("compositionend", () => {
      state.isComposing = false;
      handleEditorInput();
    });

    writingArea.addEventListener("mouseover", (event) => {
      const span = event.target instanceof Element ? event.target.closest(".scriber-letter") : null;
      if (!span || !span.dataset.resolved) return;
      if (state.pinned) return;
      highlightWord(span);
      showRelationsForSpan(span, false);
    });

    writingArea.addEventListener("mouseout", (event) => {
      const span = event.target instanceof Element ? event.target.closest(".scriber-letter") : null;
      if (!span) return;
      clearWordHighlight();
      if (!state.pinned) {
        showRelationsHint();
      }
    });

    writingArea.addEventListener("click", (event) => {
      scheduleSuggestRefresh();
      const span = event.target instanceof Element ? event.target.closest(".scriber-letter") : null;
      if (!span || !span.dataset.resolved) {
        if (state.pinned) {
          unpin();
        }
        return;
      }
      showRelationsForSpan(span, true);
    });

    writingArea.addEventListener("keyup", (event) => {
      if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
        scheduleSuggestRefresh();
      }
    });

    writingArea.addEventListener("scroll", () => {
      if (!suggestWordsEl.hidden) {
        positionWordSuggest();
      }
    });

    writingArea.addEventListener("focusout", () => {
      window.setTimeout(() => {
        if (document.activeElement !== writingArea) {
          hideWordSuggest();
        }
      }, 0);
    });

    suggestWordsEl.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    window.addEventListener("resize", () => {
      if (!suggestWordsEl.hidden) {
        positionWordSuggest();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.pinned) {
        unpin();
      }
    });

    document.addEventListener("selectionchange", () => {
      const offset = caretTextOffset();
      if (offset != null) {
        state.lastCaretOffset = offset;
      }
      scheduleSuggestRefresh();
    });

    document.addEventListener("section:changed", () => {
      unpin();
      hideSuggestStrip();
      hideWordSuggest();
    });

    bindTools();
  }

  // --- Init --------------------------------------------------------------------

  function ensureScriberSection(magickDataset, referenceData) {
    const alphabetData = magickDataset?.grouped?.alphabets || null;
    if (alphabetData && alphabetData !== state.alphabets) {
      state.alphabets = alphabetData;
      const gematriaCiphers = referenceData?.gematriaCiphers || null;
      if (gematriaCiphers) {
        state.baseAlphabet = String(gematriaCiphers.baseAlphabet || "abcdefghijklmnopqrstuvwxyz");
        state.ciphers = Array.isArray(gematriaCiphers.ciphers) && gematriaCiphers.ciphers.length
          ? gematriaCiphers.ciphers
          : FALLBACK_CIPHERS;
      }
      buildLetterMaps();
      state.dictionaryCache.clear();
    }

    if (!state.initialized) {
      state.initialized = true;
      getElements();
      restoreAssistPreference();
      bindEvents();
      updateAssistToggle();
      renderEditorText();
      updateWordCount();
      showRelationsHint();
      void refreshDocuments();
    }
  }

  window.ScriberSectionUi = {
    ...(window.ScriberSectionUi || {}),
    ensureScriberSection,
    openDocument,
    focusEditor() {
      writingArea?.focus();
    }
  };
})();
