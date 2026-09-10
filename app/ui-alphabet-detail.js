(function () {
  "use strict";

  const { html, raw } = window.HtmlSafe;

  function computeDigitalRoot(value) {
    let current = Math.abs(Math.trunc(Number(value)));
    if (!Number.isFinite(current)) {
      return null;
    }

    while (current >= 10) {
      current = String(current)
        .split("")
        .reduce((sum, digit) => sum + Number(digit), 0);
    }

    return current;
  }

  function describeDigitalRootReduction(value, digitalRoot) {
    const normalized = Math.abs(Math.trunc(Number(value)));
    if (!Number.isFinite(normalized) || !Number.isFinite(digitalRoot)) {
      return "";
    }

    if (normalized < 10) {
      return String(normalized);
    }

    return `${String(normalized).split("").join(" + ")} = ${digitalRoot}`;
  }

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function renderPositionDigitalRootCard(letter, alphabet, context, orderLabel) {
    const index = Number(letter?.index);
    if (!Number.isFinite(index)) {
      return "";
    }

    const position = Math.trunc(index);
    if (position <= 0) {
      return "";
    }

    const digitalRoot = computeDigitalRoot(position);
    if (!Number.isFinite(digitalRoot)) {
      return "";
    }

    const entries = Array.isArray(context.alphabets?.[alphabet]) ? context.alphabets[alphabet] : [];
    const countText = entries.length ? ` of ${entries.length}` : "";
    const orderText = orderLabel ? ` (${orderLabel})` : "";
    const reductionText = describeDigitalRootReduction(position, digitalRoot);
    const openNumberBtn = context.inlineNavBtn(`${digitalRoot}`, "nav:number", { value: digitalRoot });

    return context.card("Position Digital Root", html`
      <dl class="alpha-dl">
        <dt>Position</dt><dd>#${position}${countText}${orderText}</dd>
        <dt>Digital Root</dt><dd>${openNumberBtn}${reductionText ? ` (${reductionText})` : ""}</dd>
      </dl>
    `);
  }

  function monthRefsForLetter(letter, context) {
    const hebrewLetterId = context.normalizeId(letter?.hebrewLetterId);
    if (!hebrewLetterId) {
      return [];
    }
    return context.monthRefsByHebrewId.get(hebrewLetterId) || [];
  }

  function calendarMonthsCard(monthRefs, titleLabel, context) {
    if (!monthRefs.length) {
      return "";
    }

    const monthButtons = raw(monthRefs
      .map((month) => context.inlineNavBtn(month.label || month.name, "nav:calendar-month", { "month-id": month.id }))
      .join(", "));

    return context.card("Calendar Months", html`
      <div class="body-text">${titleLabel} ${monthButtons}</div>
    `);
  }

  function renderAstrologyCard(astrology, context) {
    if (!astrology) return "";
    const { type, name } = astrology;
    const id = (name || "").toLowerCase();

    if (type === "planet") {
      const sym = context.PLANET_SYMBOLS[id] || "";
      const cubePlacement = context.getCubePlacementForPlanet(id);
      const cubeBtn = context.cubePlacementInlineBtn(cubePlacement, { "planet-id": id });
      return context.card("Astrology", html`
        <dl class="alpha-dl">
          <dt>Type</dt><dd>Planet</dd>
          <dt>Ruler</dt><dd>${sym} ${context.inlineNavBtn(context.cap(id), "nav:planet", { "planet-id": id })}</dd>
        </dl>
        ${cubeBtn ? html`<div class="body-text">Cube placement ${cubeBtn}</div>` : ""}
      `);
    }
    if (type === "zodiac") {
      const sym = context.ZODIAC_SYMBOLS[id] || "";
      const cubePlacement = context.getCubePlacementForSign(id);
      const cubeBtn = context.cubePlacementInlineBtn(cubePlacement, { "sign-id": id });
      return context.card("Astrology", html`
        <dl class="alpha-dl">
          <dt>Type</dt><dd>Zodiac Sign</dd>
          <dt>Sign</dt><dd>${sym} ${context.inlineNavBtn(context.cap(id), "nav:zodiac", { "sign-id": id })}</dd>
        </dl>
        ${cubeBtn ? html`<div class="body-text">Cube placement ${cubeBtn}</div>` : ""}
      `);
    }
    if (type === "element") {
      const elemEmoji = { air: "💨", water: "💧", fire: "🔥", earth: "🌍" };
      return context.card("Astrology", html`
        <dl class="alpha-dl">
          <dt>Type</dt><dd>Element</dd>
          <dt>Element</dt><dd>${elemEmoji[id] || ""} ${context.inlineNavBtn(context.cap(id), "nav:elements", { "element-id": id })}</dd>
        </dl>
      `);
    }
    return context.card("Astrology", html`
      <dl class="alpha-dl">
        <dt>Type</dt><dd>${context.cap(type)}</dd>
        <dt>Name</dt><dd>${context.cap(name)}</dd>
      </dl>
    `);
  }

  function renderElementOrPlanetValue(value, context) {
    const token = context.normalizeId(value);
    if (!token) {
      return "—";
    }

    if (context.PLANET_SYMBOLS[token]) {
      return `${context.PLANET_SYMBOLS[token]} ${context.inlineNavBtn(context.cap(token), "nav:planet", { "planet-id": token })}`;
    }

    if (["air", "water", "fire", "earth"].includes(token)) {
      return context.inlineNavBtn(context.cap(token), "nav:elements", { "element-id": token });
    }

    return value || "—";
  }

  function renderTarotValue(value, context) {
    if (!hasTarotAccess()) {
      return "";
    }

    const label = String(value || "").trim();
    if (!label) {
      return "—";
    }

    return context.inlineNavBtn(label, "nav:tarot-trump", { "card-name": label });
  }

  function renderHebrewDualityCard(letter, context) {
    const duality = context.HEBREW_DOUBLE_DUALITY[context.normalizeId(letter?.hebrewLetterId)];
    if (!duality) {
      return "";
    }

    return context.card("Duality", html`
      <dl class="alpha-dl">
        <dt>Polarity</dt><dd>${duality.left} / ${duality.right}</dd>
      </dl>
    `);
  }

  function renderHebrewFourWorldsCard(letter, context) {
    const letterId = context.normalizeLetterId(letter?.hebrewLetterId || letter?.transliteration || letter?.char);
    if (!letterId) {
      return "";
    }

    const rows = (Array.isArray(context.fourWorldLayers) ? context.fourWorldLayers : [])
      .filter((entry) => entry?.hebrewLetterId === letterId);

    if (!rows.length) {
      return "";
    }

    const body = raw(rows.map((entry) => {
      const pathBtn = Number.isFinite(Number(entry?.pathNumber))
        ? context.inlineNavBtn(`Path ${entry.pathNumber}`, "nav:kabbalah-path", { "path-no": Number(entry.pathNumber) })
        : "";

      return html`
        <div class="cal-item-row">
          <div class="cal-item-head">
            <span class="cal-item-name">${entry.slot}: ${entry.letterChar} — ${entry.world}</span>
            <span class="list-meta">${entry.soulLayer}</span>
          </div>
          <div class="body-text">${entry.worldLayer}${entry.worldDescription ? ` · ${entry.worldDescription}` : ""}</div>
          <div class="body-text">${entry.soulLayer}${entry.soulTitle ? ` — ${entry.soulTitle}` : ""}${entry.soulDescription ? `: ${entry.soulDescription}` : ""}</div>
          ${pathBtn ? html`<div class="body-text">Linked path ${pathBtn}</div>` : ""}
        </div>
      `;
    }).join(""));

    return context.card("Qabalistic Worlds & Soul Layers", html`<div class="cal-item-stack">${body}</div>`);
  }

  function normalizeLatinLetter(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
  }

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

  function greekNativeNamesByLetter(letter) {
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

  function formatGreekNativeNamesByLetter(letter) {
    const names = greekNativeNamesByLetter(letter);
    if (names.classical && names.koine && names.classical !== names.koine) {
      return `${names.classical} / ${names.koine}`;
    }

    return names.classical || names.koine || "";
  }

  function toGreekUppercase(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

  function formatGreekNativeUppercaseByLetter(letter) {
    const names = greekNativeNamesByLetter(letter);
    const classicalName = toGreekUppercase(names.classical);
    const koineName = toGreekUppercase(names.koine);
    if (classicalName && koineName && classicalName !== koineName) {
      return `${classicalName} / ${koineName}`;
    }

    return classicalName || koineName || "";
  }

  function greekTransliterationVariantsByLetter(letter) {
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

  function formatGreekTransliterationByLetter(letter) {
    const variants = greekTransliterationVariantsByLetter(letter);
    if (variants.classical && variants.koine && variants.classical !== variants.koine) {
      return `${variants.classical} / ${variants.koine}`;
    }

    return variants.classical || variants.koine || String(letter?.transliteration || "").trim();
  }

  function greekPlaceValueByIndex(index) {
    const value = Number(index);
    if (!Number.isFinite(value)) {
      return null;
    }

    const position = Math.trunc(value);
    if (position <= 0) {
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

  function buildGreekGematriaMap(alphabets, mode = "orderly") {
    const map = new Map();
    const greekClassical = Array.isArray(alphabets?.greek) ? alphabets.greek : [];
    const greekArchaic = Array.isArray(alphabets?.greekArchaic) ? alphabets.greekArchaic : [];

    [...greekClassical, ...greekArchaic].forEach((entry) => {
      const usePlaceValue = mode === "place-value";
      const value = usePlaceValue && !entry?.archaic
        ? greekPlaceValueByIndex(entry?.index)
        : Number(entry?.numerology);
      if (!Number.isFinite(value)) {
        return;
      }

      [entry?.char, entry?.charLower, entry?.charFinal].forEach((glyph) => {
        const key = String(glyph || "").trim();
        if (!key) {
          return;
        }
        map.set(key, Math.trunc(value));
      });
    });

    if (!map.has("ς") && map.has("σ")) {
      map.set("ς", map.get("σ"));
    }

    return map;
  }

  function buildHebrewGematriaMap(alphabets) {
    const map = new Map();
    const hebrewLetters = Array.isArray(alphabets?.hebrew) ? alphabets.hebrew : [];

    hebrewLetters.forEach((entry) => {
      const value = Number(entry?.numerology);
      const glyph = String(entry?.char || "").trim();
      if (!glyph || !Number.isFinite(value)) {
        return;
      }
      map.set(glyph, Math.trunc(value));
    });

    const finals = {
      ך: "כ",
      ם: "מ",
      ן: "נ",
      ף: "פ",
      ץ: "צ"
    };

    Object.entries(finals).forEach(([finalForm, baseForm]) => {
      if (!map.has(finalForm) && map.has(baseForm)) {
        map.set(finalForm, map.get(baseForm));
      }
    });

    return map;
  }

  function computeNameGematria(name, valueMap, options = {}) {
    if (!(valueMap instanceof Map) || valueMap.size === 0) {
      return null;
    }

    const normalizeGreek = options?.normalizeGreek === true;
    const normalized = normalizeGreek
      ? String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      : String(name || "");

    let sum = 0;
    let matched = 0;
    for (const glyph of normalized) {
      const key = String(glyph || "").trim();
      if (!key) {
        continue;
      }
      const value = valueMap.get(key);
      if (!Number.isFinite(value)) {
        continue;
      }
      sum += value;
      matched += 1;
    }

    if (!matched) {
      return null;
    }

    return sum;
  }

  function computeNameGematriaWithBreakdown(name, valueMap, options = {}) {
    if (!(valueMap instanceof Map) || valueMap.size === 0) {
      return null;
    }

    const normalizeGreek = options?.normalizeGreek === true;
    const normalized = normalizeGreek
      ? String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      : String(name || "");

    let total = 0;
    const parts = [];

    for (const glyph of normalized) {
      const key = String(glyph || "").trim();
      if (!key) {
        continue;
      }

      const value = valueMap.get(key);
      if (!Number.isFinite(value)) {
        continue;
      }

      const numericValue = Math.trunc(value);
      total += numericValue;
      parts.push(`${key}(${numericValue})`);
    }

    if (!parts.length) {
      return null;
    }

    return {
      total,
      breakdown: `${parts.join(" + ")} = ${total}`
    };
  }

  function hebrewNativeNameByLetter(letter) {
    const key = String(letter?.hebrewLetterId || "").trim().toLowerCase();
    return HEBREW_NATIVE_NAMES[key] || "";
  }

  function findGreekEquivalentForHebrew(letter, greekLetters) {
    const greekEquivalentKey = String(letter?.greekEquivalent || "").trim().toLowerCase();
    if (greekEquivalentKey) {
      return greekLetters.find((entry) => String(entry?.name || "").trim().toLowerCase() === greekEquivalentKey) || null;
    }

    const hebrewId = String(letter?.hebrewLetterId || "").trim().toLowerCase();
    if (!hebrewId) {
      return null;
    }

    return greekLetters.find((entry) => String(entry?.hebrewLetterId || "").trim().toLowerCase() === hebrewId) || null;
  }

  function extractEnglishLetterRefs(value) {
    if (Array.isArray(value)) {
      return [...new Set(value.map((entry) => normalizeLatinLetter(entry)).filter(Boolean))];
    }

    return [...new Set(
      String(value || "")
        .split(/[\s,;|\/]+/)
        .map((entry) => normalizeLatinLetter(entry))
        .filter(Boolean)
    )];
  }

  function renderAlphabetEquivalentCard(activeAlphabet, letter, context) {
    const hebrewLetters = Array.isArray(context.alphabets?.hebrew) ? context.alphabets.hebrew : [];
    const greekClassicalLetters = Array.isArray(context.alphabets?.greek) ? context.alphabets.greek : [];
    const greekArchaicLetters = Array.isArray(context.alphabets?.greekArchaic) ? context.alphabets.greekArchaic : [];
    const greekLetters = [...greekClassicalLetters, ...greekArchaicLetters];
    const englishLetters = Array.isArray(context.alphabets?.english) ? context.alphabets.english : [];
    const arabicLetters = Array.isArray(context.alphabets?.arabic) ? context.alphabets.arabic : [];
    const enochianLetters = Array.isArray(context.alphabets?.enochian) ? context.alphabets.enochian : [];
    const linkedHebrewIds = new Set();
    const linkedEnglishLetters = new Set();
    const buttons = [];

    function addHebrewId(value) {
      const id = context.normalizeId(value);
      if (id) {
        linkedHebrewIds.add(id);
      }
    }

    function addEnglishLetter(value) {
      const code = normalizeLatinLetter(value);
      if (!code) {
        return;
      }

      linkedEnglishLetters.add(code);
      englishLetters
        .filter((entry) => normalizeLatinLetter(entry?.letter) === code)
        .forEach((entry) => addHebrewId(entry?.hebrewLetterId));
    }

    if (activeAlphabet === "hebrew") {
      addHebrewId(letter?.hebrewLetterId);
    } else if (activeAlphabet === "greek" || activeAlphabet === "greekArchaic") {
      addHebrewId(letter?.hebrewLetterId);
      englishLetters
        .filter((entry) => context.normalizeId(entry?.greekEquivalent) === context.normalizeId(letter?.name))
        .forEach((entry) => addEnglishLetter(entry?.letter));
    } else if (activeAlphabet === "english") {
      addEnglishLetter(letter?.letter);
      addHebrewId(letter?.hebrewLetterId);
    } else if (activeAlphabet === "arabic") {
      addHebrewId(letter?.hebrewLetterId);
    } else if (activeAlphabet === "enochian") {
      extractEnglishLetterRefs(letter?.englishLetters).forEach((code) => addEnglishLetter(code));
      addHebrewId(letter?.hebrewLetterId);
    }

    if (!linkedHebrewIds.size && !linkedEnglishLetters.size) {
      return "";
    }

    const activeHebrewKey = context.normalizeId(letter?.hebrewLetterId);
    const activeGreekKey = context.normalizeId(letter?.name);
    const activeEnglishKey = normalizeLatinLetter(letter?.letter);
    const activeArabicKey = context.normalizeId(letter?.name);
    const activeEnochianKey = context.normalizeId(letter?.id || letter?.char || letter?.title);

    hebrewLetters.forEach((heb) => {
      const key = context.normalizeId(heb?.hebrewLetterId);
      if (!key || !linkedHebrewIds.has(key)) {
        return;
      }
      if (activeAlphabet === "hebrew" && key === activeHebrewKey) {
        return;
      }

      buttons.push(html`<button class="alpha-sister-btn" data-alpha="hebrew" data-key="${heb.hebrewLetterId}">
        <span class="alpha-sister-glyph">${heb.char}</span>
        <span class="alpha-sister-name">Hebrew: ${heb.name} (${heb.transliteration}) · gematria ${heb.numerology}</span>
      </button>`);
    });

    greekLetters.forEach((grk) => {
      const key = context.normalizeId(grk?.name);
      const viaHebrew = linkedHebrewIds.has(context.normalizeId(grk?.hebrewLetterId));
      const viaEnglish = englishLetters.some((eng) => (
        linkedEnglishLetters.has(normalizeLatinLetter(eng?.letter))
        && context.normalizeId(eng?.greekEquivalent) === key
      ));
      if (!(viaHebrew || viaEnglish)) {
        return;
      }
      const greekAlphabet = grk?.archaic ? "greekArchaic" : "greek";
      if ((activeAlphabet === "greek" || activeAlphabet === "greekArchaic") && key === activeGreekKey) {
        return;
      }

      buttons.push(html`<button class="alpha-sister-btn" data-alpha="${greekAlphabet}" data-key="${grk.name}">
        <span class="alpha-sister-glyph">${grk.char}</span>
        <span class="alpha-sister-name">Greek${grk?.archaic ? " (Archaic)" : ""}: ${grk.displayName} (${formatGreekTransliterationByLetter(grk)}) · isopsephy ${grk.numerology}</span>
      </button>`);
    });

    englishLetters.forEach((eng) => {
      const key = normalizeLatinLetter(eng?.letter);
      const viaLetter = linkedEnglishLetters.has(key);
      const viaHebrew = linkedHebrewIds.has(context.normalizeId(eng?.hebrewLetterId));
      if (!(viaLetter || viaHebrew)) {
        return;
      }
      if (activeAlphabet === "english" && key === activeEnglishKey) {
        return;
      }

      buttons.push(html`<button class="alpha-sister-btn" data-alpha="english" data-key="${eng.letter}">
        <span class="alpha-sister-glyph">${eng.letter}</span>
        <span class="alpha-sister-name">English: ${eng.letter} · pythagorean ${eng.pythagorean}</span>
      </button>`);
    });

    arabicLetters.forEach((arb) => {
      const key = context.normalizeId(arb?.name);
      if (!linkedHebrewIds.has(context.normalizeId(arb?.hebrewLetterId))) {
        return;
      }
      if (activeAlphabet === "arabic" && key === activeArabicKey) {
        return;
      }

      buttons.push(html`<button class="alpha-sister-btn" data-alpha="arabic" data-key="${arb.name}">
        <span class="alpha-sister-glyph alpha-list-glyph--arabic">${arb.char}</span>
        <span class="alpha-sister-name">Arabic: ${context.arabicDisplayName(arb)} — ${arb.nameArabic} (${arb.transliteration}) · abjad ${arb.abjad}</span>
      </button>`);
    });

    enochianLetters.forEach((eno) => {
      const key = context.normalizeId(eno?.id || eno?.char || eno?.title);
      const englishRefs = extractEnglishLetterRefs(eno?.englishLetters);
      const viaHebrew = linkedHebrewIds.has(context.normalizeId(eno?.hebrewLetterId));
      const viaEnglish = englishRefs.some((code) => linkedEnglishLetters.has(code));
      if (!(viaHebrew || viaEnglish)) {
        return;
      }
      if (activeAlphabet === "enochian" && key === activeEnochianKey) {
        return;
      }

      buttons.push(html`<button class="alpha-sister-btn" data-alpha="enochian" data-key="${eno.id}">
        ${context.enochianGlyphImageHtml(eno, "alpha-enochian-glyph-img alpha-enochian-glyph-img--sister")}
        <span class="alpha-sister-name">Enochian: ${eno.title} (${eno.transliteration}) · English ${englishRefs.join("/") || "—"}</span>
      </button>`);
    });

    if (!buttons.length) {
      return "";
    }

    return context.card("ALPHABET EQUIVALENT", html`<div class="alpha-sister-wrap">${buttons}</div>`);
  }

  function renderHebrewDetail(context) {
    const { letter, detailSubEl, detailBodyEl } = context;
    const greekClassicalLetters = Array.isArray(context.alphabets?.greek) ? context.alphabets.greek : [];
    const greekArchaicLetters = Array.isArray(context.alphabets?.greekArchaic) ? context.alphabets.greekArchaic : [];
    const greekLetters = [...greekClassicalLetters, ...greekArchaicLetters];
    const greekEquivalent = findGreekEquivalentForHebrew(letter, greekLetters);
    const greekEquivalentNativeName = formatGreekNativeNamesByLetter(greekEquivalent);
    const hebrewNativeName = hebrewNativeNameByLetter(letter);
    const hebrewNameGematria = computeNameGematriaWithBreakdown(hebrewNativeName, buildHebrewGematriaMap(context.alphabets));

    detailSubEl.textContent = `${letter.name} — ${letter.transliteration}`;
    detailBodyEl.innerHTML = "";

    const sections = [];
    sections.push(context.card("Letter Details", html`
      <dl class="alpha-dl">
        <dt>Character</dt><dd>${letter.char}${letter.charFinal ? ` ${letter.charFinal}` : ""}</dd>
        <dt>Rashi Script</dt><dd class="alpha-rashi-glyph">${letter.char}${letter.charFinal ? ` ${letter.charFinal}` : ""}</dd>
        <dt>Name (English)</dt><dd>${letter.name}</dd>
        <dt>Name (Hebrew)</dt><dd>${hebrewNativeName || "—"}</dd>
        <dt>Name Gematria (Hebrew)</dt><dd>${Number.isFinite(hebrewNameGematria?.total) ? hebrewNameGematria.total : "—"}</dd>
        <dt>Name Gematria Breakdown (Hebrew)</dt><dd>${hebrewNameGematria?.breakdown || "—"}</dd>
        <dt>Transliteration</dt><dd>${letter.transliteration}</dd>
        <dt>Greek Equivalent</dt><dd>${greekEquivalent ? `${greekEquivalent.char} ${greekEquivalent.displayName}${greekEquivalentNativeName ? ` (${greekEquivalentNativeName})` : ""}` : "—"}</dd>
        <dt>Meaning</dt><dd>${letter.meaning}</dd>
        <dt>Gematria Value</dt><dd>${letter.numerology}</dd>
        <dt>Letter Type</dt><dd class="alpha-badge alpha-badge--${letter.letterType}">${letter.letterType}</dd>
        <dt>Position</dt><dd>#${letter.index} of 22</dd>
      </dl>
    `));

    const positionRootCard = renderPositionDigitalRootCard(letter, "hebrew", context);
    if (positionRootCard) {
      sections.push(positionRootCard);
    }

    if (letter.letterType === "double") {
      const dualityCard = renderHebrewDualityCard(letter, context);
      if (dualityCard) {
        sections.push(dualityCard);
      }
    }

    const fourWorldsCard = renderHebrewFourWorldsCard(letter, context);
    if (fourWorldsCard) {
      sections.push(fourWorldsCard);
    }

    if (letter.astrology) {
      sections.push(renderAstrologyCard(letter.astrology, context));
    }

    if (letter.kabbalahPathNumber) {
      const tarotAccessEnabled = hasTarotAccess();
      const kabBtn = context.inlineNavBtn(`Path ${letter.kabbalahPathNumber}`, "tarot:view-kab-path", { "path-number": letter.kabbalahPathNumber });
      const tarotBtn = tarotAccessEnabled && letter.tarot
        ? context.inlineNavBtn(letter.tarot.card, "kab:view-trump", { "trump-number": letter.tarot.trumpNumber })
        : "";
      const cubePlacement = context.getCubePlacementForHebrewLetter(letter.hebrewLetterId, letter.kabbalahPathNumber);
      const cubeBtn = context.cubePlacementInlineBtn(cubePlacement, {
        "hebrew-letter-id": letter.hebrewLetterId,
        "path-no": letter.kabbalahPathNumber
      });
      sections.push(context.card(tarotAccessEnabled ? "Kabbalah & Tarot" : "Kabbalah", html`
        <dl class="alpha-dl">
          <dt>Path Number</dt><dd>${kabBtn}</dd>
          ${tarotAccessEnabled && letter.tarot ? html`<dt>Tarot Card</dt><dd>${tarotBtn} (Trump ${letter.tarot.trumpNumber})</dd>` : ""}
        </dl>
        ${cubeBtn ? html`<div class="body-text">Cube placement ${cubeBtn}</div>` : ""}
      `));
    }

    const monthRefs = monthRefsForLetter(letter, context);
    const monthCard = calendarMonthsCard(monthRefs, `Calendar correspondences linked to ${letter.name}.`, context);
    if (monthCard) {
      sections.push(monthCard);
    }

    const equivalentsCard = renderAlphabetEquivalentCard("hebrew", letter, context);
    if (equivalentsCard) {
      sections.push(equivalentsCard);
    }

    detailBodyEl.innerHTML = sections.join("");
    context.attachDetailListeners();
  }

  function renderGreekDetail(context, alphabetKey = "greek") {
    const { letter, detailSubEl, detailBodyEl } = context;
    const archaicBadge = letter.archaic ? ' <span class="alpha-badge alpha-badge--archaic">archaic</span>' : "";
    const setLabel = alphabetKey === "greekArchaic" ? "Archaic" : "Classical/Koine";
    const greekNativeNames = greekNativeNamesByLetter(letter);
    const greekNativeNameCombined = formatGreekNativeNamesByLetter(letter);
    const greekNativeUppercase = formatGreekNativeUppercaseByLetter(letter);
    const greekClassicalUppercase = toGreekUppercase(greekNativeNames.classical);
    const greekKoineUppercase = toGreekUppercase(greekNativeNames.koine);
    const greekTranslit = greekTransliterationVariantsByLetter(letter);
    const greekTranslitCombined = formatGreekTransliterationByLetter(letter);
    const greekOrderlyMap = buildGreekGematriaMap(context.alphabets, "orderly");
    const greekPlaceValueMap = buildGreekGematriaMap(context.alphabets, "place-value");
    const greekClassicalNameGematriaOrderly = computeNameGematriaWithBreakdown(greekNativeNames.classical, greekOrderlyMap, { normalizeGreek: true });
    const greekClassicalNameGematriaPlace = computeNameGematriaWithBreakdown(greekNativeNames.classical, greekPlaceValueMap, { normalizeGreek: true });
    const greekKoineNameGematriaOrderly = computeNameGematriaWithBreakdown(greekNativeNames.koine, greekOrderlyMap, { normalizeGreek: true });
    const greekKoineNameGematriaPlace = computeNameGematriaWithBreakdown(greekNativeNames.koine, greekPlaceValueMap, { normalizeGreek: true });
    const orderlyLetterValue = Number.isFinite(Number(letter?.numerology)) ? Math.trunc(Number(letter.numerology)) : null;
    const placeLetterValue = letter?.archaic ? orderlyLetterValue : greekPlaceValueByIndex(letter?.index);
    detailSubEl.textContent = `${letter.displayName}${letter.archaic ? " (archaic)" : ""} — ${greekTranslitCombined} · ${setLabel}`;
    detailBodyEl.innerHTML = "";

    const sections = [];
    const charRow = letter.charFinal
      ? html`<dt>Form (final)</dt><dd>${letter.charFinal}</dd>`
      : "";
    sections.push(context.card("Letter Details", html`
      <dl class="alpha-dl">
        <dt>Uppercase</dt><dd>${letter.char}</dd>
        <dt>Lowercase</dt><dd>${letter.charLower || "—"}</dd>
        ${charRow}
        <dt>Name (English)</dt><dd>${letter.displayName}${archaicBadge}</dd>
        <dt>Name (Greek)</dt><dd>${greekNativeNameCombined || "—"}</dd>
        <dt>Name (Greek Uppercase)</dt><dd>${greekNativeUppercase || "—"}</dd>
        <dt>Name (Greek Classical)</dt><dd>${greekNativeNames.classical || "—"}</dd>
        <dt>Name (Greek Classical Uppercase)</dt><dd>${greekClassicalUppercase || "—"}</dd>
        <dt>Name (Greek Koine)</dt><dd>${greekNativeNames.koine || "—"}</dd>
        <dt>Name (Greek Koine Uppercase)</dt><dd>${greekKoineUppercase || "—"}</dd>
        <dt>Transliteration</dt><dd>${greekTranslitCombined || "—"}</dd>
        <dt>Transliteration (Classical)</dt><dd>${greekTranslit.classical || "—"}</dd>
        <dt>Transliteration (Koine)</dt><dd>${greekTranslit.koine || "—"}</dd>
        <dt>IPA</dt><dd>${letter.ipa || "—"}</dd>
        <dt>Isopsephy Value (Orderly)</dt><dd>${Number.isFinite(orderlyLetterValue) ? orderlyLetterValue : "—"}</dd>
        <dt>Isopsephy Value (1-10-100)</dt><dd>${Number.isFinite(placeLetterValue) ? placeLetterValue : "—"}</dd>
        <dt>Name Gematria (Greek Classical)</dt><dd>orderly ${Number.isFinite(greekClassicalNameGematriaOrderly?.total) ? greekClassicalNameGematriaOrderly.total : "—"} · 1-10-100 ${Number.isFinite(greekClassicalNameGematriaPlace?.total) ? greekClassicalNameGematriaPlace.total : "—"}</dd>
        <dt>Name Breakdown (Greek Classical)</dt><dd>orderly: ${greekClassicalNameGematriaOrderly?.breakdown || "—"} · 1-10-100: ${greekClassicalNameGematriaPlace?.breakdown || "—"}</dd>
        <dt>Name Gematria (Greek Koine)</dt><dd>orderly ${Number.isFinite(greekKoineNameGematriaOrderly?.total) ? greekKoineNameGematriaOrderly.total : "—"} · 1-10-100 ${Number.isFinite(greekKoineNameGematriaPlace?.total) ? greekKoineNameGematriaPlace.total : "—"}</dd>
        <dt>Name Breakdown (Greek Koine)</dt><dd>orderly: ${greekKoineNameGematriaOrderly?.breakdown || "—"} · 1-10-100: ${greekKoineNameGematriaPlace?.breakdown || "—"}</dd>
        <dt>Meaning / Origin</dt><dd>${letter.meaning || "—"}</dd>
      </dl>
    `));

    const positionRootCard = renderPositionDigitalRootCard(letter, alphabetKey, context);
    if (positionRootCard) {
      sections.push(positionRootCard);
    }

    const equivalentsCard = renderAlphabetEquivalentCard(alphabetKey, letter, context);
    if (equivalentsCard) {
      sections.push(equivalentsCard);
    }

    const monthRefs = monthRefsForLetter(letter, context);
    const monthCard = calendarMonthsCard(monthRefs, `Calendar correspondences inherited via ${letter.displayName}'s Hebrew origin.`, context);
    if (monthCard) {
      sections.push(monthCard);
    }

    detailBodyEl.innerHTML = sections.join("");
    context.attachDetailListeners();
  }

  function renderEnglishDetail(context) {
    const { letter, detailSubEl, detailBodyEl } = context;
    detailSubEl.textContent = `Letter ${letter.letter} · position #${letter.index}`;
    detailBodyEl.innerHTML = "";

    const sections = [];
    sections.push(context.card("Letter Details", html`
      <dl class="alpha-dl">
        <dt>Letter</dt><dd>${letter.letter}</dd>
        <dt>Position</dt><dd>#${letter.index} of 26</dd>
        <dt>IPA</dt><dd>${letter.ipa || "—"}</dd>
        <dt>Pythagorean Value</dt><dd>${letter.pythagorean}</dd>
      </dl>
    `));

    const positionRootCard = renderPositionDigitalRootCard(letter, "english", context);
    if (positionRootCard) {
      sections.push(positionRootCard);
    }

    const equivalentsCard = renderAlphabetEquivalentCard("english", letter, context);
    if (equivalentsCard) {
      sections.push(equivalentsCard);
    }

    const monthRefs = monthRefsForLetter(letter, context);
    const monthCard = calendarMonthsCard(monthRefs, "Calendar correspondences linked through this letter's Hebrew correspondence.", context);
    if (monthCard) {
      sections.push(monthCard);
    }

    detailBodyEl.innerHTML = sections.join("");
    context.attachDetailListeners();
  }

  function renderArabicDetail(context) {
    const { letter, detailSubEl, detailBodyEl } = context;
    detailSubEl.textContent = `${context.arabicDisplayName(letter)} — ${letter.transliteration}`;
    detailBodyEl.innerHTML = "";

    const sections = [];
    const forms = letter.forms || {};
    const formParts = [
      forms.isolated ? html`<span class="alpha-arabic-form"><span class="alpha-arabic-glyph">${forms.isolated}</span><br>isolated</span>` : "",
      forms.final ? html`<span class="alpha-arabic-form"><span class="alpha-arabic-glyph">${forms.final}</span><br>final</span>` : "",
      forms.medial ? html`<span class="alpha-arabic-form"><span class="alpha-arabic-glyph">${forms.medial}</span><br>medial</span>` : "",
      forms.initial ? html`<span class="alpha-arabic-form"><span class="alpha-arabic-glyph">${forms.initial}</span><br>initial</span>` : ""
    ].filter(Boolean);

    sections.push(context.card("Letter Details", html`
      <dl class="alpha-dl">
        <dt>Arabic Name</dt><dd class="alpha-arabic-inline">${letter.nameArabic}</dd>
        <dt>Transliteration</dt><dd>${letter.transliteration}</dd>
        <dt>IPA</dt><dd>${letter.ipa || "—"}</dd>
        <dt>Abjad Value</dt><dd>${letter.abjad}</dd>
        <dt>Meaning</dt><dd>${letter.meaning || "—"}</dd>
        <dt>Category</dt><dd class="alpha-badge alpha-badge--${letter.category}">${letter.category}</dd>
        <dt>Position</dt><dd>#${letter.index} of 28 (Abjad order)</dd>
      </dl>
    `));

    const positionRootCard = renderPositionDigitalRootCard(letter, "arabic", context, "Abjad order");
    if (positionRootCard) {
      sections.push(positionRootCard);
    }

    if (formParts.length) {
      sections.push(context.card("Letter Forms", html`<div class="alpha-arabic-forms">${formParts}</div>`));
    }

    const equivalentsCard = renderAlphabetEquivalentCard("arabic", letter, context);
    if (equivalentsCard) {
      sections.push(equivalentsCard);
    }

    detailBodyEl.innerHTML = sections.join("");
    context.attachDetailListeners();
  }

  function renderEnochianDetail(context) {
    const { letter, detailSubEl, detailBodyEl } = context;
    const englishRefs = extractEnglishLetterRefs(letter?.englishLetters);
    detailSubEl.textContent = `${letter.title} — ${letter.transliteration}`;
    detailBodyEl.innerHTML = "";

    const sections = [];
    sections.push(context.card("Letter Details", html`
      <dl class="alpha-dl">
        <dt>Character</dt><dd>${context.enochianGlyphImageHtml(letter, "alpha-enochian-glyph-img alpha-enochian-glyph-img--detail-row")}</dd>
        <dt>Name</dt><dd>${letter.title}</dd>
        <dt>English Letters</dt><dd>${englishRefs.join(" / ") || "—"}</dd>
        <dt>Transliteration</dt><dd>${letter.transliteration || "—"}</dd>
        <dt>Element / Planet</dt><dd>${renderElementOrPlanetValue(letter.elementOrPlanet, context)}</dd>
        ${hasTarotAccess() ? html`<dt>Tarot</dt><dd>${renderTarotValue(letter.tarot, context)}</dd>` : ""}
        <dt>Numerology</dt><dd>${letter.numerology || "—"}</dd>
          <dt>Glyph Source</dt><dd>API asset: img/enochian (sourced from dCode set)</dd>
        <dt>Position</dt><dd>#${letter.index} of 21</dd>
      </dl>
    `));

    const positionRootCard = renderPositionDigitalRootCard(letter, "enochian", context);
    if (positionRootCard) {
      sections.push(positionRootCard);
    }

    const equivalentsCard = renderAlphabetEquivalentCard("enochian", letter, context);
    if (equivalentsCard) {
      sections.push(equivalentsCard);
    }

    const monthRefs = monthRefsForLetter(letter, context);
    const monthCard = calendarMonthsCard(monthRefs, "Calendar correspondences linked through this letter's Hebrew correspondence.", context);
    if (monthCard) {
      sections.push(monthCard);
    }

    detailBodyEl.innerHTML = sections.join("");
    context.attachDetailListeners();
  }

  function renderDetail(context) {
    const alphabet = context.alphabet;
    if (alphabet === "hebrew") {
      renderHebrewDetail(context);
    } else if (alphabet === "greek" || alphabet === "greekArchaic") {
      renderGreekDetail(context, alphabet);
    } else if (alphabet === "english") {
      renderEnglishDetail(context);
    } else if (alphabet === "arabic") {
      renderArabicDetail(context);
    } else if (alphabet === "enochian") {
      renderEnochianDetail(context);
    }
  }

  window.AlphabetDetailUi = { renderDetail };
})();