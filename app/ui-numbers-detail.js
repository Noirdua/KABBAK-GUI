(function () {
  "use strict";

  const THEORY_DEFAULT_INPUT = "108";
  const THEORY_MAX_FACTORIZATION_ABS = 10000000000;
  const THEORY_MAX_COLLATZ_START = 10000000;
  const theoryState = {
    inputValue: THEORY_DEFAULT_INPUT
  };

  function formatTheoryNumber(value, fractionDigits = 12) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    if (Object.is(value, -0)) {
      return "0";
    }

    const abs = Math.abs(value);
    if (abs !== 0 && (abs >= 1e15 || abs < 1e-6)) {
      return value.toExponential(8);
    }

    const formatter = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: fractionDigits
    });
    return formatter.format(value);
  }

  function formatTheoryList(values) {
    if (!Array.isArray(values) || !values.length) {
      return "--";
    }
    return values.join(", ");
  }

  function parseTheoryInput(rawInput) {
    const text = String(rawInput ?? "").trim();
    if (!text) {
      return {
        ok: false,
        message: "Enter a number to analyze."
      };
    }

    const normalized = text.replace(/[,_\s]/g, "");
    const value = Number(normalized);
    if (!Number.isFinite(value)) {
      return {
        ok: false,
        message: "Could not parse that value as a finite number."
      };
    }

    return {
      ok: true,
      raw: text,
      normalized,
      value
    };
  }

  function gcd(a, b) {
    let x = Math.abs(Math.trunc(a));
    let y = Math.abs(Math.trunc(b));
    while (y !== 0) {
      const next = x % y;
      x = y;
      y = next;
    }
    return x;
  }

  function getDigitStats(integerValue) {
    const absInt = Math.abs(integerValue);
    const digits = String(absInt);
    const digitArray = digits.split("").map((digit) => Number(digit));
    const digitSum = digitArray.reduce((sum, digit) => sum + digit, 0);

    let additivePersistence = 0;
    let additiveCurrent = absInt;
    while (additiveCurrent >= 10) {
      additiveCurrent = String(additiveCurrent)
        .split("")
        .reduce((sum, digit) => sum + Number(digit), 0);
      additivePersistence += 1;
    }

    let multiplicativePersistence = 0;
    let multiplicativeCurrent = absInt;
    while (multiplicativeCurrent >= 10) {
      multiplicativeCurrent = String(multiplicativeCurrent)
        .split("")
        .reduce((product, digit) => product * Number(digit), 1);
      multiplicativePersistence += 1;

      if (multiplicativePersistence > 20) {
        break;
      }
    }

    return {
      digits,
      digitCount: digits.length,
      digitSum,
      digitalRoot: additiveCurrent,
      additivePersistence,
      multiplicativePersistence
    };
  }

  function factorizeInteger(absInteger) {
    if (!Number.isSafeInteger(absInteger) || absInteger < 2) {
      return [];
    }

    let remainder = absInteger;
    const factors = [];

    let exponent = 0;
    while (remainder % 2 === 0) {
      remainder /= 2;
      exponent += 1;
    }
    if (exponent > 0) {
      factors.push({ prime: 2, exponent });
    }

    let divisor = 3;
    while (divisor * divisor <= remainder) {
      exponent = 0;
      while (remainder % divisor === 0) {
        remainder /= divisor;
        exponent += 1;
      }
      if (exponent > 0) {
        factors.push({ prime: divisor, exponent });
      }
      divisor += 2;
    }

    if (remainder > 1) {
      factors.push({ prime: remainder, exponent: 1 });
    }

    return factors;
  }

  function createDivisorsFromFactors(factors) {
    if (!Array.isArray(factors) || !factors.length) {
      return [1];
    }

    let divisors = [1];
    factors.forEach(({ prime, exponent }) => {
      const next = [];
      divisors.forEach((existing) => {
        let multiplier = 1;
        for (let power = 0; power <= exponent; power += 1) {
          next.push(existing * multiplier);
          multiplier *= prime;
        }
      });
      divisors = next;
    });

    return divisors.sort((left, right) => left - right);
  }

  function getRomanNumeral(value) {
    const integer = Math.trunc(value);
    if (!Number.isFinite(integer) || integer < 1 || integer > 3999) {
      return "--";
    }

    const symbols = [
      [1000, "M"],
      [900, "CM"],
      [500, "D"],
      [400, "CD"],
      [100, "C"],
      [90, "XC"],
      [50, "L"],
      [40, "XL"],
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"]
    ];

    let remainder = integer;
    let output = "";
    symbols.forEach(([weight, glyph]) => {
      while (remainder >= weight) {
        remainder -= weight;
        output += glyph;
      }
    });

    return output;
  }

  function isPerfectSquare(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
      return false;
    }

    const root = Math.trunc(Math.sqrt(value));
    return root * root === value;
  }

  function isPerfectCube(value) {
    if (!Number.isSafeInteger(value)) {
      return false;
    }

    const root = Math.round(Math.cbrt(value));
    return root * root * root === value;
  }

  function fibonacciMembership(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
      return false;
    }

    const candidateA = 5 * value * value + 4;
    const candidateB = 5 * value * value - 4;
    return isPerfectSquare(candidateA) || isPerfectSquare(candidateB);
  }

  function factorialMembership(value) {
    if (!Number.isSafeInteger(value) || value < 1) {
      return null;
    }

    let current = 1;
    let index = 1;
    while (current < value && current <= Number.MAX_SAFE_INTEGER) {
      index += 1;
      current *= index;
    }

    return current === value ? index : null;
  }

  function collatzStats(value) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > THEORY_MAX_COLLATZ_START) {
      return {
        available: false,
        reason: `Available for positive integers up to ${formatTheoryNumber(THEORY_MAX_COLLATZ_START, 0)}.`
      };
    }

    let current = value;
    let steps = 0;
    let peak = value;
    while (current !== 1 && steps < 20000) {
      if (current % 2 === 0) {
        current /= 2;
      } else {
        current = (3 * current) + 1;
      }
      if (current > peak) {
        peak = current;
      }
      steps += 1;
    }

    return {
      available: true,
      steps,
      peak,
      completed: current === 1
    };
  }

  function happyNumberStats(value) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      return {
        available: false,
        isHappy: false
      };
    }

    const seen = new Set();
    let current = value;
    while (current !== 1 && !seen.has(current)) {
      seen.add(current);
      current = String(current)
        .split("")
        .reduce((sum, digit) => {
          const numberDigit = Number(digit);
          return sum + (numberDigit * numberDigit);
        }, 0);
    }

    return {
      available: true,
      isHappy: current === 1
    };
  }

  function getIntegerProperties(integerValue) {
    const absInteger = Math.abs(integerValue);
    const digitStats = getDigitStats(integerValue);
    const canFactorExactly = absInteger <= THEORY_MAX_FACTORIZATION_ABS;
    const factors = canFactorExactly ? factorizeInteger(absInteger) : [];

    let divisorCount = null;
    let sigma = null;
    let properDivisorSum = null;
    let divisors = null;
    let eulerPhi = null;
    let mobius = null;
    let liouville = null;
    let isPrime = false;
    let isComposite = false;
    let semiprime = false;

    if (canFactorExactly && absInteger >= 1) {
      divisorCount = factors.reduce((product, item) => product * (item.exponent + 1), 1);
      sigma = factors.reduce((product, item) => {
        const numerator = (item.prime ** (item.exponent + 1)) - 1;
        return product * (numerator / (item.prime - 1));
      }, 1);
      properDivisorSum = absInteger === 1 ? 0 : sigma - absInteger;
      eulerPhi = absInteger === 1
        ? 1
        : factors.reduce((product, item) => product * ((item.prime - 1) * (item.prime ** (item.exponent - 1))), 1);
      const hasSquareFactor = factors.some((item) => item.exponent > 1);
      mobius = absInteger === 1 ? 1 : (hasSquareFactor ? 0 : (factors.length % 2 === 0 ? 1 : -1));
      liouville = absInteger === 1
        ? 1
        : (factors.reduce((sum, item) => sum + item.exponent, 0) % 2 === 0 ? 1 : -1);

      isPrime = absInteger > 1 && factors.length === 1 && factors[0].exponent === 1;
      isComposite = absInteger > 1 && !isPrime;
      semiprime = absInteger > 1 && factors.reduce((sum, item) => sum + item.exponent, 0) === 2;
      if (divisorCount <= 256) {
        divisors = createDivisorsFromFactors(factors);
      }
    }

    const abundanceClass = properDivisorSum == null
      ? "Unknown"
      : (properDivisorSum === absInteger ? "Perfect" : (properDivisorSum > absInteger ? "Abundant" : "Deficient"));

    const triangularIndex = absInteger >= 0
      ? ((Math.sqrt((8 * absInteger) + 1) - 1) / 2)
      : null;
    const pentagonalIndex = absInteger >= 0
      ? ((1 + Math.sqrt((24 * absInteger) + 1)) / 6)
      : null;
    const hexagonalIndex = absInteger >= 0
      ? ((1 + Math.sqrt((8 * absInteger) + 1)) / 4)
      : null;

    const factorialIndex = factorialMembership(absInteger);
    const collatz = collatzStats(absInteger);
    const happy = happyNumberStats(absInteger);

    const residueMods = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      .map((modulus) => `mod ${modulus}: ${((integerValue % modulus) + modulus) % modulus}`);

    const divisibility = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
      .map((modulus) => `${modulus}:${integerValue % modulus === 0 ? "Y" : "N"}`);

    const parity = integerValue % 2 === 0 ? "Even" : "Odd";
    const powerOfTwo = absInteger > 0 ? Number.isInteger(Math.log2(absInteger)) : false;
    const powerOfTen = absInteger > 0 ? Number.isInteger(Math.log10(absInteger)) : false;

    const binary = absInteger <= Number.MAX_SAFE_INTEGER
      ? integerValue.toString(2)
      : "--";
    const octal = absInteger <= Number.MAX_SAFE_INTEGER
      ? integerValue.toString(8)
      : "--";
    const hex = absInteger <= Number.MAX_SAFE_INTEGER
      ? integerValue.toString(16).toUpperCase()
      : "--";

    const decimalText = String(absInteger);
    const isPalindrome = decimalText === decimalText.split("").reverse().join("");
    const isHarshad = digitStats.digitSum > 0 ? absInteger % digitStats.digitSum === 0 : false;
    const armstrongPower = digitStats.digitCount;
    const armstrongSum = decimalText
      .split("")
      .reduce((sum, digit) => sum + (Number(digit) ** armstrongPower), 0);
    const isArmstrong = armstrongSum === absInteger;

    const theoryRows = {
      integerMeta: [
        ["Parity", parity],
        ["Safe integer", Number.isSafeInteger(integerValue) ? "Yes" : "No"],
        ["GCD(n, 360)", formatTheoryNumber(gcd(integerValue, 360), 0)],
        ["Power of 2", powerOfTwo ? "Yes" : "No"],
        ["Power of 10", powerOfTen ? "Yes" : "No"]
      ],
      digits: [
        ["Digits", digitStats.digits],
        ["Digit count", formatTheoryNumber(digitStats.digitCount, 0)],
        ["Digit sum", formatTheoryNumber(digitStats.digitSum, 0)],
        ["Digital root", formatTheoryNumber(digitStats.digitalRoot, 0)],
        ["Additive persistence", formatTheoryNumber(digitStats.additivePersistence, 0)],
        ["Multiplicative persistence", formatTheoryNumber(digitStats.multiplicativePersistence, 0)]
      ],
      numberTheory: [
        ["Prime", isPrime ? "Yes" : "No"],
        ["Composite", isComposite ? "Yes" : "No"],
        ["Semiprime", semiprime ? "Yes" : "No"],
        ["Prime factorization", factors.length ? factors.map((item) => `${item.prime}^${item.exponent}`).join(" x ") : (absInteger < 2 ? "--" : "Unavailable")],
        ["Divisor count (tau)", divisorCount == null ? "Unavailable" : formatTheoryNumber(divisorCount, 0)],
        ["Sum of divisors (sigma)", sigma == null ? "Unavailable" : formatTheoryNumber(sigma, 0)],
        ["Proper divisor sum", properDivisorSum == null ? "Unavailable" : formatTheoryNumber(properDivisorSum, 0)],
        ["Abundance class", abundanceClass],
        ["Euler totient phi(n)", eulerPhi == null ? "Unavailable" : formatTheoryNumber(eulerPhi, 0)],
        ["Mobius mu(n)", mobius == null ? "Unavailable" : formatTheoryNumber(mobius, 0)],
        ["Liouville lambda(n)", liouville == null ? "Unavailable" : formatTheoryNumber(liouville, 0)]
      ],
      sequences: [
        ["Triangular", Number.isInteger(triangularIndex) ? `Yes (T_${formatTheoryNumber(triangularIndex, 0)})` : "No"],
        ["Square", isPerfectSquare(absInteger) ? "Yes" : "No"],
        ["Cube", isPerfectCube(integerValue) ? "Yes" : "No"],
        ["Pentagonal", Number.isInteger(pentagonalIndex) ? `Yes (P_${formatTheoryNumber(pentagonalIndex, 0)})` : "No"],
        ["Hexagonal", Number.isInteger(hexagonalIndex) ? `Yes (H_${formatTheoryNumber(hexagonalIndex, 0)})` : "No"],
        ["Fibonacci", fibonacciMembership(absInteger) ? "Yes" : "No"],
        ["Factorial", factorialIndex ? `Yes (${formatTheoryNumber(factorialIndex, 0)}!)` : "No"]
      ],
      digitTraits: [
        ["Palindrome (base 10)", isPalindrome ? "Yes" : "No"],
        ["Harshad", isHarshad ? "Yes" : "No"],
        ["Armstrong/Narcissistic", isArmstrong ? "Yes" : "No"],
        ["Happy", happy.available ? (happy.isHappy ? "Yes" : "No") : "Unavailable"]
      ],
      modular: [
        ["Divisibility (2..12)", formatTheoryList(divisibility)],
        ["Residues", formatTheoryList(residueMods)]
      ],
      representations: [
        ["Binary", binary],
        ["Octal", octal],
        ["Hex", hex],
        ["Roman numeral", getRomanNumeral(absInteger)]
      ],
      dynamic: [
        ["Collatz", collatz.available
          ? `${formatTheoryNumber(collatz.steps, 0)} steps, peak ${formatTheoryNumber(collatz.peak, 0)}${collatz.completed ? "" : " (stopped early)"}`
          : collatz.reason],
        ["Divisors", divisors
          ? formatTheoryList(divisors.map((item) => formatTheoryNumber(item, 0)))
          : (canFactorExactly
            ? "List omitted (over 256 divisors)."
            : `Unavailable above |n| > ${formatTheoryNumber(THEORY_MAX_FACTORIZATION_ABS, 0)}.`)]
      ]
    };

    return {
      absInteger,
      canFactorExactly,
      rows: theoryRows
    };
  }

  function buildTheorySection(title, rows) {
    const sectionEl = document.createElement("section");
    sectionEl.className = "numbers-theory-section";

    const headingEl = document.createElement("h4");
    headingEl.className = "numbers-theory-section-heading";
    headingEl.textContent = title;

    const bodyEl = document.createElement("div");
    bodyEl.className = "numbers-theory-grid";

    rows.forEach((row) => {
      if (!Array.isArray(row) || row.length < 2) {
        return;
      }

      const labelEl = document.createElement("div");
      labelEl.className = "numbers-theory-label";
      labelEl.textContent = String(row[0]);

      const valueEl = document.createElement("div");
      valueEl.className = "numbers-theory-value";
      valueEl.textContent = String(row[1]);

      bodyEl.append(labelEl, valueEl);
    });

    sectionEl.append(headingEl, bodyEl);
    return sectionEl;
  }

  function buildTheoryAnalysisView(rawInput) {
    const parsed = parseTheoryInput(rawInput);
    const fragment = document.createDocumentFragment();

    if (!parsed.ok) {
      const messageEl = document.createElement("div");
      messageEl.className = "numbers-detail-text numbers-detail-text--muted";
      messageEl.textContent = parsed.message;
      fragment.appendChild(messageEl);
      return fragment;
    }

    const { value } = parsed;
    const abs = Math.abs(value);
    const isInteger = Number.isInteger(value);
    const reciprocal = value !== 0 ? (1 / value) : null;
    const integerPart = Math.trunc(value);
    const fractionalPart = value - integerPart;

    fragment.appendChild(buildTheorySection("General", [
      ["Input", parsed.raw],
      ["Normalized", formatTheoryNumber(value)],
      ["Sign", value > 0 ? "Positive" : (value < 0 ? "Negative" : "Zero")],
      ["Absolute value", formatTheoryNumber(abs)],
      ["Integer", isInteger ? "Yes" : "No"],
      ["Whole number", isInteger && value >= 0 ? "Yes" : "No"],
      ["Natural number", isInteger && value >= 1 ? "Yes" : "No"],
      ["Opposite", formatTheoryNumber(-value)],
      ["Reciprocal", reciprocal == null ? "Undefined" : formatTheoryNumber(reciprocal)],
      ["Floor", formatTheoryNumber(Math.floor(value), 0)],
      ["Ceiling", formatTheoryNumber(Math.ceil(value), 0)],
      ["Truncated", formatTheoryNumber(integerPart, 0)],
      ["Fractional part", formatTheoryNumber(fractionalPart)],
      ["Scientific notation", value.toExponential(8)]
    ]));

    if (!isInteger) {
      fragment.appendChild(buildTheorySection("Non-integer notes", [
        ["Detail", "Integer-only number theory metrics are shown for integers. Enter a whole number for full analysis."]
      ]));
      return fragment;
    }

    if (!Number.isSafeInteger(value)) {
      fragment.appendChild(buildTheorySection("Safe integer limit", [
        ["Detail", "This value is outside JavaScript safe integer precision. Exact factor/divisor properties are skipped."]
      ]));
      return fragment;
    }

    const integerProperties = getIntegerProperties(value);
    fragment.appendChild(buildTheorySection("Integer metadata", integerProperties.rows.integerMeta));
    fragment.appendChild(buildTheorySection("Digit analysis", integerProperties.rows.digits));
    fragment.appendChild(buildTheorySection("Number theory", integerProperties.rows.numberTheory));
    fragment.appendChild(buildTheorySection("Sequence membership", integerProperties.rows.sequences));
    fragment.appendChild(buildTheorySection("Digit traits", integerProperties.rows.digitTraits));
    fragment.appendChild(buildTheorySection("Modular arithmetic", integerProperties.rows.modular));
    fragment.appendChild(buildTheorySection("Representations", integerProperties.rows.representations));
    fragment.appendChild(buildTheorySection("Dynamic behavior", integerProperties.rows.dynamic));

    return fragment;
  }

  function buildTheoryCard(selectedNumberValue) {
    const cardEl = document.createElement("div");
    cardEl.className = "numbers-detail-card numbers-theory-card";

    const headingEl = document.createElement("strong");
    headingEl.textContent = "Theory";

    const introEl = document.createElement("div");
    introEl.className = "numbers-detail-text numbers-detail-text--muted";
    introEl.textContent = "Enter any number to inspect deep number theory and arithmetic properties.";

    const controlsEl = document.createElement("div");
    controlsEl.className = "numbers-theory-controls";

    const inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.inputMode = "decimal";
    inputEl.className = "numbers-theory-input";
    inputEl.placeholder = "e.g. 108, 137, -42, 12.5";
    inputEl.value = theoryState.inputValue || "";
    inputEl.setAttribute("aria-label", "Number to analyze");

    const analyzeBtn = document.createElement("button");
    analyzeBtn.type = "button";
    analyzeBtn.className = "numbers-nav-btn";
    analyzeBtn.textContent = "Analyze";

    const selectedBtn = document.createElement("button");
    selectedBtn.type = "button";
    selectedBtn.className = "numbers-nav-btn";
    selectedBtn.textContent = `Use Selected Number (${selectedNumberValue})`;

    controlsEl.append(inputEl, analyzeBtn, selectedBtn);

    const outputEl = document.createElement("div");
    outputEl.className = "numbers-theory-output";

    const renderOutput = () => {
      theoryState.inputValue = inputEl.value;
      const content = buildTheoryAnalysisView(inputEl.value);
      outputEl.replaceChildren(content);
    };

    analyzeBtn.addEventListener("click", renderOutput);
    inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        renderOutput();
      }
    });

    selectedBtn.addEventListener("click", () => {
      inputEl.value = String(selectedNumberValue);
      renderOutput();
    });

    renderOutput();

    cardEl.append(headingEl, introEl, controlsEl, outputEl);
    return cardEl;
  }

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function getCalendarMonthLinksForNumber(context, value) {
    const { getReferenceData, normalizeNumberValue, computeDigitalRoot } = context;
    const referenceData = getReferenceData();
    const normalized = normalizeNumberValue(value);
    const calendarGroups = [
      {
        calendarId: "gregorian",
        calendarLabel: "Gregorian",
        months: Array.isArray(referenceData?.calendarMonths) ? referenceData.calendarMonths : []
      },
      {
        calendarId: "hebrew",
        calendarLabel: "Hebrew",
        months: Array.isArray(referenceData?.hebrewCalendar?.months) ? referenceData.hebrewCalendar.months : []
      },
      {
        calendarId: "islamic",
        calendarLabel: "Islamic",
        months: Array.isArray(referenceData?.islamicCalendar?.months) ? referenceData.islamicCalendar.months : []
      },
      {
        calendarId: "wheel-of-year",
        calendarLabel: "Wheel of the Year",
        months: Array.isArray(referenceData?.wheelOfYear?.months) ? referenceData.wheelOfYear.months : []
      }
    ];

    const links = [];
    calendarGroups.forEach((group) => {
      group.months.forEach((month) => {
        const monthOrder = Number(month?.order);
        const normalizedOrder = Number.isFinite(monthOrder) ? Math.trunc(monthOrder) : null;
        const monthRoot = normalizedOrder != null ? computeDigitalRoot(normalizedOrder) : null;
        if (monthRoot !== normalized) {
          return;
        }

        links.push({
          calendarId: group.calendarId,
          calendarLabel: group.calendarLabel,
          monthId: String(month.id || "").trim(),
          monthName: String(month.name || month.id || "Month").trim(),
          monthOrder: normalizedOrder
        });
      });
    });

    return links.filter((link) => link.monthId);
  }

  function buildFallbackPlayingDeckEntries(context) {
    const { PLAYING_SUIT_SYMBOL, PLAYING_SUIT_LABEL, PLAYING_SUIT_TO_TAROT, PLAYING_RANKS, rankLabelToTarotMinorRank } = context;
    const entries = [];
    Object.keys(PLAYING_SUIT_SYMBOL).forEach((suit) => {
      PLAYING_RANKS.forEach((rank) => {
        const tarotSuit = PLAYING_SUIT_TO_TAROT[suit];
        const tarotRank = rankLabelToTarotMinorRank(rank.rankLabel);
        entries.push({
          id: `${rank.rank}${PLAYING_SUIT_SYMBOL[suit]}`,
          suit,
          suitLabel: PLAYING_SUIT_LABEL[suit],
          suitSymbol: PLAYING_SUIT_SYMBOL[suit],
          rank: rank.rank,
          rankLabel: rank.rankLabel,
          rankValue: rank.rankValue,
          tarotSuit,
          tarotCard: `${tarotRank} of ${tarotSuit}`
        });
      });
    });
    return entries;
  }

  function getPlayingDeckEntries(context) {
    const {
      getMagickDataset,
      PLAYING_SUIT_SYMBOL,
      PLAYING_SUIT_LABEL,
      PLAYING_SUIT_TO_TAROT,
      rankLabelToTarotMinorRank
    } = context;
    const deckData = getMagickDataset()?.grouped?.["playing-cards-52"];
    const rawEntries = Array.isArray(deckData)
      ? deckData
      : (Array.isArray(deckData?.entries) ? deckData.entries : []);

    if (!rawEntries.length) {
      return buildFallbackPlayingDeckEntries(context);
    }

    return rawEntries
      .map((entry) => {
        const suit = String(entry?.suit || "").trim().toLowerCase();
        const rankLabel = String(entry?.rankLabel || "").trim();
        const rank = String(entry?.rank || "").trim();
        if (!suit || !rank) {
          return null;
        }

        const suitSymbol = String(entry?.suitSymbol || PLAYING_SUIT_SYMBOL[suit] || "").trim();
        const tarotSuit = String(entry?.tarotSuit || PLAYING_SUIT_TO_TAROT[suit] || "").trim();
        const tarotCard = String(entry?.tarotCard || "").trim();
        const rankValueRaw = Number(entry?.rankValue);
        const rankValue = Number.isFinite(rankValueRaw) ? Math.trunc(rankValueRaw) : null;

        return {
          id: String(entry?.id || `${rank}${suitSymbol}`).trim(),
          suit,
          suitLabel: String(entry?.suitLabel || PLAYING_SUIT_LABEL[suit] || suit).trim(),
          suitSymbol,
          rank,
          rankLabel: rankLabel || rank,
          rankValue,
          tarotSuit,
          tarotCard: tarotCard || `${rankLabelToTarotMinorRank(rankLabel || rank)} of ${tarotSuit}`
        };
      })
      .filter(Boolean);
  }

  function findPlayingCardBySuitAndValue(entries, suit, value) {
    const normalizedSuit = String(suit || "").trim().toLowerCase();
    const targetValue = Number(value);
    return entries.find((entry) => entry.suit === normalizedSuit && Number(entry.rankValue) === targetValue) || null;
  }

  function buildNumbersSpecialCardSlots(context, playingSuit) {
    const {
      PLAYING_SUIT_LABEL,
      PLAYING_SUIT_TO_TAROT,
      NUMBERS_SPECIAL_BASE_VALUES,
      numbersSpecialFlipState
    } = context;
    const suit = String(playingSuit || "hearts").trim().toLowerCase();
    const selectedSuit = ["hearts", "diamonds", "clubs", "spades"].includes(suit) ? suit : "hearts";
    const deckEntries = getPlayingDeckEntries(context);

    const cardEl = document.createElement("div");
    cardEl.className = "numbers-detail-card numbers-special-card-section";

    const headingEl = document.createElement("strong");
    headingEl.textContent = "4 Card Arrangement";

    const subEl = document.createElement("div");
    subEl.className = "numbers-detail-text numbers-detail-text--muted";
    subEl.textContent = `Click a card to flip to its opposite (${PLAYING_SUIT_LABEL[selectedSuit]} ↔ ${PLAYING_SUIT_TO_TAROT[selectedSuit]}).`;

    const boardEl = document.createElement("div");
    boardEl.className = "numbers-special-board";

    NUMBERS_SPECIAL_BASE_VALUES.forEach((baseValue) => {
      const oppositeValue = 9 - baseValue;
      const frontCard = findPlayingCardBySuitAndValue(deckEntries, selectedSuit, baseValue);
      const backCard = findPlayingCardBySuitAndValue(deckEntries, selectedSuit, oppositeValue);
      if (!frontCard || !backCard) {
        return;
      }

      const slotKey = `${selectedSuit}:${baseValue}`;
      const isFlipped = Boolean(numbersSpecialFlipState.get(slotKey));

      const faceBtn = document.createElement("button");
      faceBtn.type = "button";
      faceBtn.className = `numbers-special-card${isFlipped ? " is-flipped" : ""}`;
      faceBtn.setAttribute("aria-pressed", isFlipped ? "true" : "false");
      faceBtn.setAttribute("aria-label", `${frontCard.rankLabel} of ${frontCard.suitLabel}. Click to flip to ${backCard.rankLabel}.`);
      faceBtn.dataset.suit = selectedSuit;

      const innerEl = document.createElement("div");
      innerEl.className = "numbers-special-card-inner";

      const frontFaceEl = document.createElement("div");
      frontFaceEl.className = "numbers-special-card-face numbers-special-card-face--front";

      const frontRankEl = document.createElement("div");
      frontRankEl.className = "numbers-special-card-rank";
      frontRankEl.textContent = frontCard.rankLabel;

      const frontSuitEl = document.createElement("div");
      frontSuitEl.className = "numbers-special-card-suit";
      frontSuitEl.textContent = frontCard.suitSymbol;

      const frontMetaEl = document.createElement("div");
      frontMetaEl.className = "numbers-special-card-meta";
      frontMetaEl.textContent = frontCard.tarotCard;

      frontFaceEl.append(frontRankEl, frontSuitEl, frontMetaEl);

      const backFaceEl = document.createElement("div");
      backFaceEl.className = "numbers-special-card-face numbers-special-card-face--back";

      const backTagEl = document.createElement("div");
      backTagEl.className = "numbers-special-card-tag";
      backTagEl.textContent = "Opposite";

      const backRankEl = document.createElement("div");
      backRankEl.className = "numbers-special-card-rank";
      backRankEl.textContent = backCard.rankLabel;

      const backSuitEl = document.createElement("div");
      backSuitEl.className = "numbers-special-card-suit";
      backSuitEl.textContent = backCard.suitSymbol;

      const backMetaEl = document.createElement("div");
      backMetaEl.className = "numbers-special-card-meta";
      backMetaEl.textContent = backCard.tarotCard;

      backFaceEl.append(backTagEl, backRankEl, backSuitEl, backMetaEl);

      innerEl.append(frontFaceEl, backFaceEl);
      faceBtn.append(innerEl);

      faceBtn.addEventListener("click", () => {
        const next = !Boolean(numbersSpecialFlipState.get(slotKey));
        numbersSpecialFlipState.set(slotKey, next);
        faceBtn.classList.toggle("is-flipped", next);
        faceBtn.setAttribute("aria-pressed", next ? "true" : "false");
      });

      boardEl.appendChild(faceBtn);
    });

    if (!boardEl.childElementCount) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "numbers-detail-text numbers-detail-text--muted";
      emptyEl.textContent = "No card slots available for this mapping yet.";
      boardEl.appendChild(emptyEl);
    }

    cardEl.append(headingEl, subEl, boardEl);
    return cardEl;
  }

  function renderNumbersSpecialPanel(context, value, entry) {
    const { specialPanelEl } = context.elements;
    if (!specialPanelEl) {
      return;
    }

    const isTheoryView = context.activeNumbersView === "theory";
    specialPanelEl.hidden = isTheoryView;
    if (isTheoryView) {
      specialPanelEl.replaceChildren();
      return;
    }

    const playingSuit = entry?.associations?.playingSuit || "hearts";
    const boardCardEl = buildNumbersSpecialCardSlots(context, playingSuit);
    specialPanelEl.replaceChildren(boardCardEl);
  }

  function parseTarotCardNumber(rawValue) {
    if (typeof rawValue === "number") {
      return Number.isFinite(rawValue) ? Math.trunc(rawValue) : null;
    }

    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      if (!trimmed || !/^-?\d+$/.test(trimmed)) {
        return null;
      }
      return Number(trimmed);
    }

    return null;
  }

  function extractTarotCardNumericValue(context, card) {
    const { TAROT_RANK_NUMBER_MAP } = context;
    const directNumber = parseTarotCardNumber(card?.number);
    if (directNumber !== null) {
      return directNumber;
    }

    const rankKey = String(card?.rank || "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(TAROT_RANK_NUMBER_MAP, rankKey)) {
      return TAROT_RANK_NUMBER_MAP[rankKey];
    }

    const numerologyRelation = Array.isArray(card?.relations)
      ? card.relations.find((relation) => String(relation?.type || "").trim().toLowerCase() === "numerology")
      : null;
    const relationValue = Number(numerologyRelation?.data?.value);
    if (Number.isFinite(relationValue)) {
      return Math.trunc(relationValue);
    }

    return null;
  }

  function getAlphabetPositionLinksForDigitalRoot(context, targetRoot) {
    const { getMagickDataset, computeDigitalRoot } = context;
    const alphabets = getMagickDataset()?.grouped?.alphabets;
    if (!alphabets || typeof alphabets !== "object") {
      return [];
    }

    const links = [];

    const addLink = (alphabetLabel, entry, buttonLabel, detail) => {
      const index = Number(entry?.index);
      if (!Number.isFinite(index)) {
        return;
      }

      const normalizedIndex = Math.trunc(index);
      if (computeDigitalRoot(normalizedIndex) !== targetRoot) {
        return;
      }

      links.push({
        alphabet: alphabetLabel,
        index: normalizedIndex,
        label: buttonLabel,
        detail
      });
    };

    const toTitle = (value) => String(value || "")
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .replace(/\b([a-z])/g, (match, ch) => ch.toUpperCase());

    const englishEntries = Array.isArray(alphabets.english) ? alphabets.english : [];
    englishEntries.forEach((entry) => {
      const letter = String(entry?.letter || "").trim();
      if (!letter) {
        return;
      }

      addLink("English", entry, `${letter}`, {
        alphabet: "english",
        englishLetter: letter
      });
    });

    const greekEntries = Array.isArray(alphabets.greek) ? alphabets.greek : [];
    greekEntries.forEach((entry) => {
      const greekName = String(entry?.name || "").trim();
      if (!greekName) {
        return;
      }

      const glyph = String(entry?.char || "").trim();
      const displayName = String(entry?.displayName || toTitle(greekName)).trim();
      addLink("Greek", entry, glyph ? `${displayName} - ${glyph}` : displayName, {
        alphabet: "greek",
        greekName
      });
    });

    const hebrewEntries = Array.isArray(alphabets.hebrew) ? alphabets.hebrew : [];
    hebrewEntries.forEach((entry) => {
      const hebrewLetterId = String(entry?.hebrewLetterId || "").trim();
      if (!hebrewLetterId) {
        return;
      }

      const glyph = String(entry?.char || "").trim();
      const name = String(entry?.name || hebrewLetterId).trim();
      const displayName = toTitle(name);
      addLink("Hebrew", entry, glyph ? `${displayName} - ${glyph}` : displayName, {
        alphabet: "hebrew",
        hebrewLetterId
      });
    });

    const arabicEntries = Array.isArray(alphabets.arabic) ? alphabets.arabic : [];
    arabicEntries.forEach((entry) => {
      const arabicName = String(entry?.name || "").trim();
      if (!arabicName) {
        return;
      }

      const glyph = String(entry?.char || "").trim();
      const displayName = toTitle(arabicName);
      addLink("Arabic", entry, glyph ? `${displayName} - ${glyph}` : displayName, {
        alphabet: "arabic",
        arabicName
      });
    });

    const enochianEntries = Array.isArray(alphabets.enochian) ? alphabets.enochian : [];
    enochianEntries.forEach((entry) => {
      const enochianId = String(entry?.id || "").trim();
      if (!enochianId) {
        return;
      }

      const title = String(entry?.title || enochianId).trim();
      const displayName = toTitle(title);
      addLink("Enochian", entry, `${displayName}`, {
        alphabet: "enochian",
        enochianId
      });
    });

    return links.sort((left, right) => {
      if (left.index !== right.index) {
        return left.index - right.index;
      }
      const alphabetCompare = left.alphabet.localeCompare(right.alphabet);
      if (alphabetCompare !== 0) {
        return alphabetCompare;
      }
      return left.label.localeCompare(right.label);
    });
  }

  function getTarotCardsForDigitalRoot(context, targetRoot, numberEntry = null) {
    if (!hasTarotAccess()) {
      return [];
    }

    const { getReferenceData, getMagickDataset, ensureTarotSection, computeDigitalRoot } = context;
    const referenceData = getReferenceData();
    const magickDataset = getMagickDataset();
    if (typeof ensureTarotSection === "function" && referenceData) {
      ensureTarotSection(referenceData, magickDataset);
    }

    const allCards = window.TarotSectionUi?.getCards?.() || [];
    const explicitTrumpNumbers = Array.isArray(numberEntry?.associations?.tarotTrumpNumbers)
      ? numberEntry.associations.tarotTrumpNumbers
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .map((value) => Math.trunc(value))
      : [];

    const filteredCards = explicitTrumpNumbers.length
      ? allCards.filter((card) => {
          const numberValue = parseTarotCardNumber(card?.number);
          return card?.arcana === "Major" && numberValue !== null && explicitTrumpNumbers.includes(numberValue);
        })
      : allCards.filter((card) => {
          const numberValue = extractTarotCardNumericValue(context, card);
          return numberValue !== null && computeDigitalRoot(numberValue) === targetRoot;
        });

    return filteredCards.sort((left, right) => {
      const leftNumber = extractTarotCardNumericValue(context, left);
      const rightNumber = extractTarotCardNumericValue(context, right);
      if (leftNumber !== rightNumber) {
        return (leftNumber ?? 0) - (rightNumber ?? 0);
      }
      if (left?.arcana !== right?.arcana) {
        return left?.arcana === "Major" ? -1 : 1;
      }
      return String(left?.name || "").localeCompare(String(right?.name || ""));
    });
  }

  function renderNumberDetail(context) {
    const { elements, getNumberEntryByValue, normalizeNumberValue, selectNumberEntry } = context;
    const { detailNameEl, detailTypeEl, detailSummaryEl, detailBodyEl } = elements;
    const entry = getNumberEntryByValue(context.value);
    if (!entry) {
      return;
    }

    const isTheoryView = context.activeNumbersView === "theory";

    const detailHeadingEl = detailNameEl instanceof HTMLElement
      ? detailNameEl.closest(".detail-heading")
      : null;
    const sequenceNavEl = detailHeadingEl instanceof HTMLElement
      ? detailHeadingEl.querySelector(".detail-sequence-nav")
      : null;
    if (sequenceNavEl instanceof HTMLElement) {
      sequenceNavEl.hidden = isTheoryView;
    }

    const normalized = entry.value;
    const opposite = entry.opposite;
    const rootTarget = normalizeNumberValue(entry.digitalRoot);

    if (detailNameEl) {
      detailNameEl.textContent = `Number ${normalized} · ${entry.label}`;
    }

    if (detailTypeEl) {
      detailTypeEl.textContent = isTheoryView ? "Theory Analyzer" : `Opposite: ${opposite}`;
    }

    if (detailSummaryEl) {
      detailSummaryEl.textContent = isTheoryView
        ? "Analyze any value with an extensive set of arithmetic and number theory properties."
        : (entry.summary || "");
    }

    renderNumbersSpecialPanel(context, normalized, entry);

    if (!detailBodyEl) {
      return;
    }

    detailBodyEl.replaceChildren();

    const theoryCardEl = buildTheoryCard(normalized);
    if (isTheoryView) {
      detailBodyEl.append(theoryCardEl);
      return;
    }

    const pairCardEl = document.createElement("div");
    pairCardEl.className = "numbers-detail-card";

    const pairHeadingEl = document.createElement("strong");
    pairHeadingEl.textContent = "Number Pair";

    const pairTextEl = document.createElement("div");
    pairTextEl.className = "numbers-detail-text";
    pairTextEl.textContent = `Opposite: ${opposite}`;

    const keywordText = entry.keywords.length
      ? `Keywords: ${entry.keywords.join(", ")}`
      : "Keywords: --";
    const pairKeywordsEl = document.createElement("div");
    pairKeywordsEl.className = "numbers-detail-text numbers-detail-text--muted";
    pairKeywordsEl.textContent = keywordText;

    const oppositeBtn = document.createElement("button");
    oppositeBtn.type = "button";
    oppositeBtn.className = "numbers-nav-btn";
    oppositeBtn.textContent = `Open Opposite Number ${opposite}`;
    oppositeBtn.addEventListener("click", () => {
      selectNumberEntry(opposite);
    });

    pairCardEl.append(pairHeadingEl, pairTextEl, pairKeywordsEl, oppositeBtn);

    const kabbalahCardEl = document.createElement("div");
    kabbalahCardEl.className = "numbers-detail-card";

    const kabbalahHeadingEl = document.createElement("strong");
    kabbalahHeadingEl.textContent = "Kabbalah Link";

    const kabbalahNode = Number(entry?.associations?.kabbalahNode);
    const kabbalahTextEl = document.createElement("div");
    kabbalahTextEl.className = "numbers-detail-text";
    kabbalahTextEl.textContent = `Tree node target: ${kabbalahNode}`;

    const kabbalahBtn = document.createElement("button");
    kabbalahBtn.type = "button";
    kabbalahBtn.className = "numbers-nav-btn";
    kabbalahBtn.textContent = `Open Kabbalah Tree Node ${kabbalahNode}`;
    kabbalahBtn.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("nav:kabbalah-path", {
        detail: { pathNo: kabbalahNode }
      }));
    });

    kabbalahCardEl.append(kabbalahHeadingEl, kabbalahTextEl, kabbalahBtn);

    const alphabetCardEl = document.createElement("div");
    alphabetCardEl.className = "numbers-detail-card";

    const alphabetHeadingEl = document.createElement("strong");
    alphabetHeadingEl.textContent = "Alphabet Links";

    const alphabetLinksWrapEl = document.createElement("div");
    alphabetLinksWrapEl.className = "numbers-links-wrap";

    const alphabetLinks = getAlphabetPositionLinksForDigitalRoot(context, rootTarget);
    if (!alphabetLinks.length) {
      const emptyAlphabetEl = document.createElement("div");
      emptyAlphabetEl.className = "numbers-detail-text numbers-detail-text--muted";
      emptyAlphabetEl.textContent = "No alphabet position entries found for this digital root yet.";
      alphabetLinksWrapEl.appendChild(emptyAlphabetEl);
    } else {
      alphabetLinks.forEach((link) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "numbers-nav-btn";
        button.textContent = `${link.alphabet}: ${link.label}`;
        button.addEventListener("click", () => {
          document.dispatchEvent(new CustomEvent("nav:alphabet", {
            detail: link.detail
          }));
        });
        alphabetLinksWrapEl.appendChild(button);
      });
    }

    alphabetCardEl.append(alphabetHeadingEl, alphabetLinksWrapEl);

    const calendarCardEl = document.createElement("div");
    calendarCardEl.className = "numbers-detail-card";

    const calendarHeadingEl = document.createElement("strong");
    calendarHeadingEl.textContent = "Calendar Links";

    const calendarLinksWrapEl = document.createElement("div");
    calendarLinksWrapEl.className = "numbers-links-wrap";

    const calendarLinks = getCalendarMonthLinksForNumber(context, normalized);
    if (!calendarLinks.length) {
      const emptyCalendarEl = document.createElement("div");
      emptyCalendarEl.className = "numbers-detail-text numbers-detail-text--muted";
      emptyCalendarEl.textContent = "No calendar months currently mapped to this number.";
      calendarLinksWrapEl.appendChild(emptyCalendarEl);
    } else {
      calendarLinks.forEach((link) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "numbers-nav-btn";
        button.textContent = `${link.calendarLabel}: ${link.monthName} (Month ${link.monthOrder})`;
        button.addEventListener("click", () => {
          document.dispatchEvent(new CustomEvent("nav:calendar-month", {
            detail: {
              calendarId: link.calendarId,
              monthId: link.monthId
            }
          }));
        });
        calendarLinksWrapEl.appendChild(button);
      });
    }

    calendarCardEl.append(calendarHeadingEl, calendarLinksWrapEl);

    const detailCards = [theoryCardEl, pairCardEl, kabbalahCardEl, alphabetCardEl];

    if (hasTarotAccess()) {
      const tarotCardEl = document.createElement("div");
      tarotCardEl.className = "numbers-detail-card";

      const tarotHeadingEl = document.createElement("strong");
      tarotHeadingEl.textContent = "Tarot Links";

      const tarotLinksWrapEl = document.createElement("div");
      tarotLinksWrapEl.className = "numbers-links-wrap";

      const tarotCards = getTarotCardsForDigitalRoot(context, rootTarget, entry);
      if (!tarotCards.length) {
        const emptyEl = document.createElement("div");
        emptyEl.className = "numbers-detail-text numbers-detail-text--muted";
        emptyEl.textContent = "No tarot numeric entries found yet for this root. Add card numbers to map them.";
        tarotLinksWrapEl.appendChild(emptyEl);
      } else {
        tarotCards.forEach((card) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "numbers-nav-btn";
          button.textContent = `${card.name}`;
          button.addEventListener("click", () => {
            document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
              detail: { cardName: card.name }
            }));
          });
          tarotLinksWrapEl.appendChild(button);
        });
      }

      tarotCardEl.append(tarotHeadingEl, tarotLinksWrapEl);
      detailCards.push(tarotCardEl);
    }

    detailCards.push(calendarCardEl);
    detailBodyEl.append(...detailCards);
  }

  window.NumbersDetailUi = {
    renderNumberDetail
  };
})();