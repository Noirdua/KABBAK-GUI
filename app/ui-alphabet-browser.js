(function () {
  "use strict";

  const { html } = window.HtmlSafe;

  const ARABIC_DISPLAY_NAMES = {
    alif: "Alif", ba: "Ba", jeem: "Jeem", dal: "Dal", ha: "Ha",
    waw: "Waw", zayn: "Zayn", ha_khaa: "Haa", ta_tay: "Tta", ya: "Ya",
    kaf: "Kaf", lam: "Lam", meem: "Meem", nun: "Nun", seen: "Seen",
    ayn: "Ayn", fa: "Fa", sad: "Sad", qaf: "Qaf", ra: "Ra",
    sheen: "Sheen", ta: "Ta", tha: "Tha", kha: "Kha",
    dhal: "Dhal", dad: "Dad", dha: "Dha", ghayn: "Ghayn"
  };

  const GREEK_NATIVE_NAMES = {
    alpha: { classical: "ἄλφα", koine: "άλφα" },
    beta: { classical: "βῆτα", koine: "βήτα" },
    gamma: { classical: "γάμμα", koine: "γάμμα" },
    delta: { classical: "δέλτα", koine: "δέλτα" },
    epsilon: { classical: "ἒ ψιλόν", koine: "έψιλον" },
    zeta: { classical: "ζῆτα", koine: "ζήτα" },
    eta: { classical: "ἦτα", koine: "ήτα" },
    theta: { classical: "θῆτα", koine: "θήτα" },
    iota: { classical: "ἰῶτα", koine: "ιώτα" },
    kappa: { classical: "κάππα", koine: "κάππα" },
    lambda: { classical: "λάμβδα", koine: "λάμδα" },
    mu: { classical: "μῦ", koine: "μι" },
    nu: { classical: "νῦ", koine: "νι" },
    xi: { classical: "ξῖ", koine: "ξι" },
    omicron: { classical: "ὂ μικρόν", koine: "όμικρον" },
    pi: { classical: "πῖ", koine: "πι" },
    rho: { classical: "ῥῶ", koine: "ρω" },
    sigma: { classical: "σῖγμα", koine: "σίγμα" },
    tau: { classical: "ταῦ", koine: "ταυ" },
    upsilon: { classical: "ὖ ψιλόν", koine: "ύψιλον" },
    phi: { classical: "φῖ", koine: "φι" },
    chi: { classical: "χῖ", koine: "χι" },
    psi: { classical: "ψῖ", koine: "ψι" },
    omega: { classical: "ὦ μέγα", koine: "ωμέγα" },
    digamma: { classical: "δίγαμμα", koine: "δίγαμμα" },
    qoppa: { classical: "κόππα", koine: "κόππα" },
    sampi: { classical: "σαμπί", koine: "σαμπί" }
  };

  const GREEK_TRANSLITERATIONS = {
    alpha: { classical: "A", koine: "A" },
    beta: { classical: "B", koine: "V" },
    gamma: { classical: "G", koine: "G" },
    delta: { classical: "D", koine: "Th" },
    epsilon: { classical: "E", koine: "E" },
    zeta: { classical: "Z", koine: "Z" },
    eta: { classical: "E", koine: "I" },
    theta: { classical: "Th", koine: "Th" },
    iota: { classical: "I", koine: "I" },
    kappa: { classical: "K", koine: "K" },
    lambda: { classical: "L", koine: "L" },
    mu: { classical: "M", koine: "M" },
    nu: { classical: "N", koine: "N" },
    xi: { classical: "X", koine: "X" },
    omicron: { classical: "O", koine: "O" },
    pi: { classical: "P", koine: "P" },
    rho: { classical: "R", koine: "R" },
    sigma: { classical: "S", koine: "S" },
    tau: { classical: "T", koine: "T" },
    upsilon: { classical: "U/Y", koine: "I" },
    phi: { classical: "Ph", koine: "F" },
    chi: { classical: "Kh/Ch", koine: "Ch" },
    psi: { classical: "Ps", koine: "Ps" },
    omega: { classical: "O", koine: "O" },
    digamma: { classical: "W", koine: "V" },
    qoppa: { classical: "Q", koine: "Q" },
    sampi: { classical: "Ss/Ts", koine: "Ss/Ts" }
  };

  const HEBREW_NATIVE_NAMES = {
    alef: "אלף",
    bet: "בית",
    gimel: "גימל",
    dalet: "דלת",
    he: "הא",
    vav: "וו",
    zayin: "זין",
    het: "חית",
    tet: "טית",
    yod: "יוד",
    kaf: "כף",
    lamed: "למד",
    mem: "מם",
    nun: "נון",
    samekh: "סמך",
    ayin: "עין",
    pe: "פה",
    tsadi: "צדי",
    qof: "קוף",
    resh: "ריש",
    shin: "שין",
    tav: "תו"
  };

  function createAlphabetBrowser(dependencies) {
    const {
      state,
      normalizeId,
      getDomRefs,
      renderDetail,
      onStateChange
    } = dependencies || {};

    function notifyStateChange() {
      if (typeof onStateChange === "function") {
        onStateChange();
      }
    }

    function capitalize(value) {
      return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
    }

    function alphabetDisplayLabel(alphabet) {
      if (alphabet === "greek") return "Greek (Classical/Koine)";
      if (alphabet === "greekArchaic") return "Greek (Archaic)";
      return capitalize(alphabet);
    }

    function arabicDisplayName(letter) {
      return ARABIC_DISPLAY_NAMES[letter && letter.name]
        || (String(letter && letter.name || "").charAt(0).toUpperCase() + String(letter && letter.name || "").slice(1));
    }

    function greekNativeNames(letter) {
      const key = String(letter?.name || "").trim().toLowerCase();
      const names = GREEK_NATIVE_NAMES[key];
      if (!names) {
        return { classical: "", koine: "" };
      }

      return {
        classical: String(names.classical || "").trim(),
        koine: String(names.koine || "").trim()
      };
    }

    function toGreekUppercase(value) {
      return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
    }

    function formatGreekNativeNames(letter, options = {}) {
      const useUppercase = options?.uppercase === true;
      const names = greekNativeNames(letter);
      const classicalName = useUppercase ? toGreekUppercase(names.classical) : names.classical;
      const koineName = useUppercase ? toGreekUppercase(names.koine) : names.koine;
      if (classicalName && koineName && classicalName !== koineName) {
        return `${classicalName} / ${koineName}`;
      }

      return classicalName || koineName || "";
    }

    function hebrewNativeName(letter) {
      const key = String(letter?.hebrewLetterId || "").trim().toLowerCase();
      return HEBREW_NATIVE_NAMES[key] || "";
    }

    function greekTransliterationVariants(letter) {
      const key = String(letter?.name || "").trim().toLowerCase();
      const variants = GREEK_TRANSLITERATIONS[key];
      if (!variants) {
        const fallback = String(letter?.transliteration || "").trim();
        return {
          classical: fallback,
          koine: fallback
        };
      }

      return {
        classical: String(variants.classical || "").trim(),
        koine: String(variants.koine || "").trim()
      };
    }

    function formatGreekTransliteration(letter) {
      const variants = greekTransliterationVariants(letter);
      if (variants.classical && variants.koine && variants.classical !== variants.koine) {
        return `${variants.classical} / ${variants.koine}`;
      }
      return variants.classical || variants.koine || String(letter?.transliteration || "").trim();
    }

    function greekPlaceValueByIndex(index, alphabet) {
      const value = Number(index);
      if (!Number.isFinite(value)) {
        return null;
      }

      const position = Math.trunc(value);
      if (position <= 0) {
        return null;
      }

      if (alphabet === "greekArchaic") {
        return null;
      }

      if (position <= 9) {
        return position;
      }

      if (position <= 18) {
        return (position - 9) * 10;
      }

      return (position - 18) * 100;
    }

    function getLetters() {
      if (!state.alphabets) return [];
      if (state.activeAlphabet === "all") {
        const alphabetOrder = ["hebrew", "greek", "greekArchaic", "english", "arabic", "enochian"];
        return alphabetOrder.flatMap((alphabet) => {
          const rows = Array.isArray(state.alphabets?.[alphabet]) ? state.alphabets[alphabet] : [];
          return rows.map((row) => ({ ...row, __alphabet: alphabet }));
        });
      }
      return state.alphabets[state.activeAlphabet] || [];
    }

    function alphabetForLetter(letter) {
      if (state.activeAlphabet === "all") {
        return String(letter?.__alphabet || "").trim().toLowerCase();
      }
      return state.activeAlphabet;
    }

    function letterKeyByAlphabet(alphabet, letter) {
      if (alphabet === "hebrew") return letter.hebrewLetterId;
      if (alphabet === "greek") return letter.name;
      if (alphabet === "greekArchaic") return letter.name;
      if (alphabet === "english") return letter.letter;
      if (alphabet === "arabic") return letter.name;
      if (alphabet === "enochian") return letter.id;
      return String(letter.index);
    }

    function letterKey(letter) {
      const alphabet = alphabetForLetter(letter);
      const key = letterKeyByAlphabet(alphabet, letter);
      if (state.activeAlphabet === "all") {
        return `${alphabet}:${key}`;
      }
      return key;
    }

    function displayGlyph(letter) {
      const alphabet = alphabetForLetter(letter);
      if (alphabet === "hebrew") return letter.char;
      if (alphabet === "greek") return letter.char;
      if (alphabet === "greekArchaic") return letter.char;
      if (alphabet === "english") return letter.letter;
      if (alphabet === "arabic") return letter.char;
      if (alphabet === "enochian") return letter.char;
      return "?";
    }

    function displayLabel(letter) {
      const alphabet = alphabetForLetter(letter);
      if (alphabet === "hebrew") return letter.name;
      if (alphabet === "greek") return letter.displayName;
      if (alphabet === "greekArchaic") return letter.displayName;
      if (alphabet === "english") return letter.letter;
      if (alphabet === "arabic") return arabicDisplayName(letter);
      if (alphabet === "enochian") return letter.title;
      return "?";
    }

    function displaySub(letter) {
      const alphabet = alphabetForLetter(letter);
      if (alphabet === "hebrew") {
        const nativeName = hebrewNativeName(letter);
        return `${nativeName ? `${nativeName} · ` : ""}${letter.transliteration} · ${letter.letterType} · ${letter.numerology}`;
      }
      if (alphabet === "greek") {
        const nativeName = formatGreekNativeNames(letter, { uppercase: true });
        const transliteration = formatGreekTransliteration(letter);
        const orderlyValue = Number.isFinite(Number(letter?.numerology)) ? Math.trunc(Number(letter.numerology)) : "—";
        const placeValue = greekPlaceValueByIndex(letter?.index, alphabet);
        return `${nativeName ? `${nativeName} · ` : ""}${transliteration} · isopsephy orderly ${orderlyValue}${Number.isFinite(placeValue) ? ` · 1-10-100 ${placeValue}` : ""}${letter.archaic ? " · archaic" : ""}`;
      }
      if (alphabet === "greekArchaic") {
        const nativeName = formatGreekNativeNames(letter, { uppercase: true });
        const transliteration = formatGreekTransliteration(letter);
        const orderlyValue = Number.isFinite(Number(letter?.numerology)) ? Math.trunc(Number(letter.numerology)) : "—";
        return `${nativeName ? `${nativeName} · ` : ""}${transliteration} · isopsephy orderly ${orderlyValue} · 1-10-100 ${orderlyValue} · archaic`;
      }
      if (alphabet === "english") return `Pythagorean ${letter.pythagorean}`;
      if (alphabet === "arabic") return `${letter.transliteration} · abjad ${letter.abjad} · ${letter.nameArabic}`;
      if (alphabet === "enochian") return `${letter.transliteration} · ${Array.isArray(letter.englishLetters) ? letter.englishLetters.join("/") : ""} · value ${letter.numerology}`;
      return "";
    }

    function normalizeLetterType(value) {
      const key = String(value || "").trim().toLowerCase();
      if (["mother", "double", "simple"].includes(key)) {
        return key;
      }
      return "";
    }

    function getHebrewLetterTypeMap() {
      const map = new Map();
      const hebrewLetters = Array.isArray(state.alphabets?.hebrew) ? state.alphabets.hebrew : [];
      hebrewLetters.forEach((entry) => {
        const hebrewId = normalizeId(entry?.hebrewLetterId);
        const letterType = normalizeLetterType(entry?.letterType);
        if (hebrewId && letterType) {
          map.set(hebrewId, letterType);
        }
      });
      return map;
    }

    function resolveLetterType(letter) {
      const direct = normalizeLetterType(letter?.letterType);
      if (direct) {
        return direct;
      }

      const hebrewId = normalizeId(letter?.hebrewLetterId);
      if (!hebrewId) {
        return "";
      }

      return getHebrewLetterTypeMap().get(hebrewId) || "";
    }

    function buildLetterSearchText(letter) {
      const chunks = [];

      chunks.push(String(displayLabel(letter) || ""));
      chunks.push(String(displayGlyph(letter) || ""));
      chunks.push(String(displaySub(letter) || ""));
      chunks.push(String(letter?.transliteration || ""));
      chunks.push(String(letter?.meaning || ""));
      chunks.push(String(letter?.nameArabic || ""));
      chunks.push(String(letter?.title || ""));
      chunks.push(String(letter?.letter || ""));
      chunks.push(String(letter?.displayName || ""));
      chunks.push(String(letter?.name || ""));
      chunks.push(String(letter?.index || ""));
      chunks.push(String(resolveLetterType(letter) || ""));

      return chunks.join(" ").toLowerCase();
    }

    function getFilteredLetters() {
      const letters = getLetters();
      const query = String(state.filters.query || "").trim().toLowerCase();
      const letterTypeFilter = normalizeLetterType(state.filters.letterType);
      const numericPosition = /^\d+$/.test(query) ? Number(query) : null;

      return letters.filter((letter) => {
        if (letterTypeFilter) {
          const entryType = resolveLetterType(letter);
          if (entryType !== letterTypeFilter) {
            return false;
          }
        }

        if (!query) {
          return true;
        }

        const index = Number(letter?.index);
        if (Number.isFinite(numericPosition) && Number.isFinite(index) && index === numericPosition) {
          return true;
        }

        return buildLetterSearchText(letter).includes(query);
      });
    }

    function syncFilterControls() {
      const { searchInputEl, typeFilterEl, searchClearEl } = getDomRefs();

      if (searchInputEl && searchInputEl.value !== state.filters.query) {
        searchInputEl.value = state.filters.query;
      }

      if (typeFilterEl && typeFilterEl.value !== state.filters.letterType) {
        typeFilterEl.value = state.filters.letterType;
      }

      if (searchClearEl) {
        const hasFilter = Boolean(String(state.filters.query || "").trim()) || Boolean(state.filters.letterType);
        searchClearEl.disabled = !hasFilter;
      }
    }

    function applyFiltersAndRender() {
      const filteredLetters = getFilteredLetters();
      const selectedInFiltered = filteredLetters.some((letter) => letterKey(letter) === state.selectedKey);

      if (!selectedInFiltered) {
        state.selectedKey = filteredLetters[0] ? letterKey(filteredLetters[0]) : null;
      }

      renderList();

      const selected = filteredLetters.find((letter) => letterKey(letter) === state.selectedKey)
        || filteredLetters[0]
        || null;

      if (selected) {
        renderDetail(selected);
        notifyStateChange();
        return;
      }

      resetDetail();
      const { detailSubEl } = getDomRefs();
      if (detailSubEl) {
        detailSubEl.textContent = "No letters match the current filter.";
      }
      notifyStateChange();
    }

    function bindFilterControls() {
      const { searchInputEl, typeFilterEl, searchClearEl } = getDomRefs();

      if (searchInputEl) {
        searchInputEl.addEventListener("input", () => {
          state.filters.query = String(searchInputEl.value || "");
          syncFilterControls();
          applyFiltersAndRender();
        });
      }

      if (typeFilterEl) {
        typeFilterEl.addEventListener("change", () => {
          state.filters.letterType = normalizeLetterType(typeFilterEl.value);
          syncFilterControls();
          applyFiltersAndRender();
        });
      }

      if (searchClearEl) {
        searchClearEl.addEventListener("click", () => {
          state.filters.query = "";
          state.filters.letterType = "";
          syncFilterControls();
          applyFiltersAndRender();
        });
      }
    }

    function enochianGlyphKey(letter) {
      return String(letter?.id || letter?.char || "").trim().toUpperCase();
    }

    function enochianGlyphCode(letter) {
      const key = enochianGlyphKey(letter);
      return key ? key.codePointAt(0) || 0 : 0;
    }

    function enochianGlyphUrl(letter) {
      const code = enochianGlyphCode(letter);
      return code ? (window.TarotDataService?.toApiAssetUrl?.(`img/enochian/char(${code}).png`) || "") : "";
    }

    function enochianGlyphImageHtml(letter, className) {
      const src = enochianGlyphUrl(letter);
      const key = enochianGlyphKey(letter) || "?";
      if (!src) {
        return html`<span class="${className}">${key}</span>`;
      }
      return html`<img class="${className}" src="${src}" alt="Enochian ${key}" loading="lazy" decoding="async">`;
    }

    function renderList() {
      const { listEl, countEl } = getDomRefs();
      if (!listEl) return;
      const allLetters = getLetters();
      const letters = getFilteredLetters();
      if (countEl) {
        countEl.textContent = letters.length === allLetters.length
          ? `${letters.length}`
          : `${letters.length}/${allLetters.length}`;
      }

      listEl.innerHTML = "";
      letters.forEach((letter) => {
        const key = letterKey(letter);
        const item = document.createElement("div");
        item.className = "list-item alpha-list-item" + (key === state.selectedKey ? " is-selected" : "");
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", key === state.selectedKey ? "true" : "false");
        item.dataset.key = key;

        const glyph = document.createElement("span");
        const alphabet = alphabetForLetter(letter);
        const glyphVariantClass = alphabet === "arabic"
          ? " alpha-list-glyph--arabic"
          : alphabet === "enochian"
            ? " alpha-list-glyph--enochian"
            : "";
        glyph.className = "alpha-list-glyph" + glyphVariantClass;
        if (alphabet === "enochian") {
          const image = document.createElement("img");
          image.className = "alpha-enochian-glyph-img alpha-enochian-glyph-img--list";
          image.src = enochianGlyphUrl(letter);
          image.alt = `Enochian ${enochianGlyphKey(letter) || "?"}`;
          image.loading = "lazy";
          image.decoding = "async";
          image.addEventListener("error", () => {
            glyph.textContent = enochianGlyphKey(letter) || "?";
          });
          glyph.appendChild(image);
        } else {
          glyph.textContent = displayGlyph(letter);
        }

        const meta = document.createElement("span");
        meta.className = "alpha-list-meta";
        const alphaLabel = alphabet ? `${alphabetDisplayLabel(alphabet)} · ` : "";
        meta.innerHTML = html`<strong>${alphaLabel}${displayLabel(letter)}</strong><br><span class="alpha-list-sub">${displaySub(letter)}</span>`;

        item.appendChild(glyph);
        item.appendChild(meta);
        item.addEventListener("click", () => selectLetter(key));
        listEl.appendChild(item);
      });
    }

    function resetDetail() {
      const { detailNameEl, detailSubEl, detailBodyEl } = getDomRefs();
      if (detailNameEl) {
        detailNameEl.textContent = "--";
        detailNameEl.classList.remove("alpha-detail-glyph");
      }
      if (detailSubEl) detailSubEl.textContent = "Select a letter to explore";
      if (detailBodyEl) detailBodyEl.innerHTML = "";
      notifyStateChange();
    }

    function selectLetter(key) {
      state.selectedKey = key;
      renderList();
      const letters = getFilteredLetters();
      const letter = letters.find((entry) => letterKey(entry) === key) || getLetters().find((entry) => letterKey(entry) === key);
      if (letter) {
        renderDetail(letter);
      } else {
        notifyStateChange();
      }
    }

    function updateTabs() {
      const { tabAll, tabHebrew, tabGreek, tabGreekArchaic, tabEnglish, tabArabic, tabEnochian } = getDomRefs();
      [tabAll, tabHebrew, tabGreek, tabGreekArchaic, tabEnglish, tabArabic, tabEnochian].forEach((btn) => {
        if (!btn) return;
        btn.classList.toggle("alpha-tab-active", btn.dataset.alpha === state.activeAlphabet);
      });
    }

    function switchAlphabet(alpha, selectKey) {
      state.activeAlphabet = alpha;
      state.selectedKey = selectKey || null;
      updateTabs();
      syncFilterControls();
      renderList();
      if (selectKey) {
        const letters = getFilteredLetters();
        const letter = letters.find((entry) => letterKey(entry) === selectKey) || getLetters().find((entry) => letterKey(entry) === selectKey);
        if (letter) {
          renderDetail(letter);
        } else {
          notifyStateChange();
        }
      } else {
        resetDetail();
      }

      notifyStateChange();
    }

    return {
      arabicDisplayName,
      getLetters,
      alphabetForLetter,
      letterKeyByAlphabet,
      letterKey,
      displayGlyph,
      displayLabel,
      displaySub,
      normalizeLetterType,
      getHebrewLetterTypeMap,
      resolveLetterType,
      buildLetterSearchText,
      getFilteredLetters,
      syncFilterControls,
      applyFiltersAndRender,
      bindFilterControls,
      enochianGlyphKey,
      enochianGlyphCode,
      enochianGlyphUrl,
      enochianGlyphImageHtml,
      renderList,
      resetDetail,
      selectLetter,
      switchAlphabet,
      updateTabs
    };
  }

  window.AlphabetBrowserUi = {
    createAlphabetBrowser
  };
})();