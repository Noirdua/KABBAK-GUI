/* quiz-calendars.js — Dynamic quiz category plugin for calendar systems */
/* Registers Hebrew, Islamic, and Wheel of the Year quiz categories with the quiz engine */
(function () {
  "use strict";

  const quizPluginHelpers = window.QuizPluginHelpers || {};
  const {
    normalizeOption,
    normalizeKey,
    toUniqueOptionList,
    makeTemplate
  } = quizPluginHelpers;

  if (
    typeof normalizeOption !== "function"
    || typeof normalizeKey !== "function"
    || typeof toUniqueOptionList !== "function"
    || typeof makeTemplate !== "function"
  ) {
    throw new Error("QuizPluginHelpers must load before quiz-calendars.js");
  }

  function ordinal(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    const s = ["th", "st", "nd", "rd"];
    const v = num % 100;
    return num + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function getCalendarHolidayEntries(referenceData, calendarId) {
    const all = Array.isArray(referenceData?.calendarHolidays) ? referenceData.calendarHolidays : [];
    const target = String(calendarId || "").trim().toLowerCase();
    return all.filter((holiday) => String(holiday?.calendarId || "").trim().toLowerCase() === target);
  }

  // ---- Hebrew Calendar Quiz --------------------------------------------------------

  function buildHebrewCalendarQuiz(referenceData) {
    const months = Array.isArray(referenceData?.hebrewCalendar?.months)
      ? referenceData.hebrewCalendar.months
      : [];

    if (months.length < 4) return [];

    const bank = [];
    const categoryId = "hebrew-calendar-months";
    const category = "Hebrew Calendar";

    const regularMonths = months.filter((m) => !m.leapYearOnly);

    const namePool = toUniqueOptionList(regularMonths.map((m) => m.name));
    const orderPool = toUniqueOptionList(regularMonths.map((m) => ordinal(m.order)));
    const nativeNamePool = toUniqueOptionList(regularMonths.map((m) => m.nativeName).filter(Boolean));
    const zodiacPool = toUniqueOptionList(
      regularMonths.map((m) => m.zodiacSign ? m.zodiacSign.charAt(0).toUpperCase() + m.zodiacSign.slice(1) : "").filter(Boolean)
    );
    const tribePool = toUniqueOptionList(regularMonths.map((m) => m.tribe).filter(Boolean));
    const sensePool = toUniqueOptionList(regularMonths.map((m) => m.sense).filter(Boolean));

    regularMonths.forEach((month) => {
      const name = month.name;
      const orderStr = ordinal(month.order);
      const nativeName = month.nativeName;
      const zodiac = month.zodiacSign
        ? month.zodiacSign.charAt(0).toUpperCase() + month.zodiacSign.slice(1)
        : null;

      // "Which month is Nisan in the Hebrew calendar?" → "1st"
      if (namePool.length >= 4 && orderPool.length >= 4) {
        const t = makeTemplate(
          `hebrew-month-order:${month.id}`,
          categoryId,
          category,
          `${name} is the ___ month of the Hebrew religious year`,
          orderStr,
          orderPool
        );
        if (t) bank.push(t);
      }

      // "The 1st month of the Hebrew calendar is" → "Nisan"
      if (namePool.length >= 4 && orderPool.length >= 4) {
        const t = makeTemplate(
          `hebrew-order-to-name:${month.id}`,
          categoryId,
          category,
          `The ${orderStr} month of the Hebrew religious year is`,
          name,
          namePool
        );
        if (t) bank.push(t);
      }

      // Native name → month name
      if (nativeName && nativeNamePool.length >= 4) {
        const t = makeTemplate(
          `hebrew-native-name:${month.id}`,
          categoryId,
          category,
          `The Hebrew month written as "${nativeName}" is`,
          name,
          namePool
        );
        if (t) bank.push(t);
      }

      // Zodiac association
      if (zodiac && zodiacPool.length >= 4) {
        const t = makeTemplate(
          `hebrew-month-zodiac:${month.id}`,
          categoryId,
          category,
          `The Hebrew month of ${name} corresponds to the zodiac sign`,
          zodiac,
          zodiacPool
        );
        if (t) bank.push(t);
      }

      // Tribe of Israel
      if (month.tribe && tribePool.length >= 4) {
        const t = makeTemplate(
          `hebrew-month-tribe:${month.id}`,
          categoryId,
          category,
          `The Hebrew month of ${name} is associated with the tribe of`,
          month.tribe,
          tribePool
        );
        if (t) bank.push(t);
      }

      // Sense
      if (month.sense && sensePool.length >= 4) {
        const t = makeTemplate(
          `hebrew-month-sense:${month.id}`,
          categoryId,
          category,
          `The sense associated with the Hebrew month of ${name} is`,
          month.sense,
          sensePool
        );
        if (t) bank.push(t);
      }
    });

    // Holiday repository-based questions (which month does X fall in?)
    const monthNameById = new Map(regularMonths.map((month) => [String(month.id), month.name]));
    const allObservances = getCalendarHolidayEntries(referenceData, "hebrew")
      .map((holiday) => {
        const monthName = monthNameById.get(String(holiday?.monthId || ""));
        const obsName = String(holiday?.name || "").trim();
        if (!monthName || !obsName) {
          return null;
        }
        return { obsName, monthName };
      })
      .filter(Boolean);

    if (namePool.length >= 4) {
      allObservances.forEach(({ obsName, monthName }) => {
        const t = makeTemplate(
          `hebrew-obs-month:${obsName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`,
          categoryId,
          category,
          `${obsName} occurs in which Hebrew month`,
          monthName,
          namePool
        );
        if (t) bank.push(t);
      });
    }

    return bank;
  }

  // ---- Islamic Calendar Quiz -------------------------------------------------------

  function buildIslamicCalendarQuiz(referenceData) {
    const months = Array.isArray(referenceData?.islamicCalendar?.months)
      ? referenceData.islamicCalendar.months
      : [];

    if (months.length < 4) return [];

    const bank = [];
    const categoryId = "islamic-calendar-months";
    const category = "Islamic Calendar";

    const namePool = toUniqueOptionList(months.map((m) => m.name));
    const orderPool = toUniqueOptionList(months.map((m) => ordinal(m.order)));
    const meaningPool = toUniqueOptionList(months.map((m) => m.meaning).filter(Boolean));

    months.forEach((month) => {
      const name = month.name;
      const orderStr = ordinal(month.order);

      // Order → name
      const t1 = makeTemplate(
        `islamic-order-to-name:${month.id}`,
        categoryId,
        category,
        `The ${orderStr} month of the Islamic calendar is`,
        name,
        namePool
      );
      if (t1) bank.push(t1);

      // Name → order
      const t2 = makeTemplate(
        `islamic-month-order:${month.id}`,
        categoryId,
        category,
        `${name} is the ___ month of the Islamic calendar`,
        orderStr,
        orderPool
      );
      if (t2) bank.push(t2);

      // Meaning of name
      if (month.meaning && meaningPool.length >= 4) {
        const t3 = makeTemplate(
          `islamic-month-meaning:${month.id}`,
          categoryId,
          category,
          `The name "${name}" in Arabic means`,
          month.meaning,
          meaningPool
        );
        if (t3) bank.push(t3);
      }

      // Sacred month identification
      if (month.sacred) {
        const yesNoPool = ["Yes — warfare prohibited", "No", "Partially sacred", "Conditionally sacred"];
        const t4 = makeTemplate(
          `islamic-sacred-${month.id}`,
          categoryId,
          category,
          `Is ${name} one of the four sacred months (Al-Ashhur Al-Hurum)?`,
          "Yes — warfare prohibited",
          yesNoPool
        );
        if (t4) bank.push(t4);
      }
    });

    // Observance-based: "Ramadan is the Islamic month of ___" type
    const observanceFacts = [
      { q: "The Islamic month of obligatory fasting (Sawm) is", a: "Ramadan" },
      { q: "Eid al-Fitr is celebrated in which Islamic month", a: "Shawwal" },
      { q: "Eid al-Adha falls in which Islamic month", a: "Dhu al-Hijja" },
      { q: "The Hajj pilgrimage takes place in which month", a: "Dhu al-Hijja" },
      { q: "The Prophet Muhammad's birth (Mawlid al-Nabi) is in", a: "Rabi' al-Awwal" },
      { q: "Ashura falls in which Islamic month", a: "Muharram" },
      { q: "Laylat al-Mi'raj (Night of Ascension) is in which month", a: "Rajab" },
      { q: "The Islamic New Year (Hijri New Year) begins in", a: "Muharram" }
    ];

    observanceFacts.forEach(({ q, a }) => {
      if (namePool.some((n) => normalizeKey(n) === normalizeKey(a))) {
        const t = makeTemplate(
          `islamic-fact:${q.slice(0, 30).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`,
          categoryId,
          category,
          q,
          a,
          namePool
        );
        if (t) bank.push(t);
      }
    });

    return bank;
  }

  // ---- Wheel of the Year Quiz ------------------------------------------------------

  function buildWheelOfYearQuiz(referenceData) {
    const months = Array.isArray(referenceData?.wheelOfYear?.months)
      ? referenceData.wheelOfYear.months
      : [];

    if (months.length < 4) return [];

    const bank = [];
    const categoryId = "wheel-of-year";
    const category = "Wheel of the Year";

    const namePool = toUniqueOptionList(months.map((m) => m.name));
    const typePool = toUniqueOptionList(months.map((m) => m.type ? m.type.charAt(0).toUpperCase() + m.type.slice(1) : "").filter(Boolean));
    const elementPool = toUniqueOptionList(
      months.map((m) => m.element || (m.associations && m.associations.element) || "").filter(Boolean)
    );
    const datePool = toUniqueOptionList(months.map((m) => m.date).filter(Boolean));

    months.forEach((month) => {
      const name = month.name;
      const date = month.date;
      const element = month.element || "";
      const direction = month.associations?.direction || "";
      const directionPool = toUniqueOptionList(months.map((m) => m.associations?.direction || "").filter(Boolean));

      // Date → Sabbat name
      if (date && datePool.length >= 4) {
        const t1 = makeTemplate(
          `wheel-date-name:${month.id}`,
          categoryId,
          category,
          `The Sabbat on ${date} is`,
          name,
          namePool
        );
        if (t1) bank.push(t1);
      }

      // Sabbat name → date
      if (date && datePool.length >= 4) {
        const t2 = makeTemplate(
          `wheel-name-date:${month.id}`,
          categoryId,
          category,
          `${name} falls on`,
          date,
          datePool
        );
        if (t2) bank.push(t2);
      }

      // Festival type (solar / cross-quarter)
      if (month.type && typePool.length >= 2) {
        const capType = month.type.charAt(0).toUpperCase() + month.type.slice(1);
        const t3 = makeTemplate(
          `wheel-type:${month.id}`,
          categoryId,
          category,
          `${name} is a ___ festival`,
          capType,
          typePool
        );
        if (t3) bank.push(t3);
      }

      // Element association
      if (element && elementPool.length >= 4) {
        const t4 = makeTemplate(
          `wheel-element:${month.id}`,
          categoryId,
          category,
          `The primary element associated with ${name} is`,
          element,
          elementPool
        );
        if (t4) bank.push(t4);
      }

      // Direction
      if (direction && directionPool.length >= 4) {
        const t5 = makeTemplate(
          `wheel-direction:${month.id}`,
          categoryId,
          category,
          `The direction associated with ${name} is`,
          direction,
          directionPool
        );
        if (t5) bank.push(t5);
      }

      // Deities pool question
      const deities = Array.isArray(month.associations?.deities) ? month.associations.deities : [];
      const allDeities = toUniqueOptionList(
        months.flatMap((m) => Array.isArray(m.associations?.deities) ? m.associations.deities : [])
      );
      if (deities.length > 0 && allDeities.length >= 4) {
        const mainDeity = deities[0];
        const t6 = makeTemplate(
          `wheel-deity:${month.id}`,
          categoryId,
          category,
          `${mainDeity} is primarily associated with which Sabbat`,
          name,
          namePool
        );
        if (t6) bank.push(t6);
      }
    });

    // Fixed knowledge questions
    const wheelFacts = [
      { q: "The Celtic New Year Sabbat is", a: "Samhain" },
      { q: "Which Sabbat marks the longest night of the year", a: "Yule (Winter Solstice)" },
      { q: "The Spring Equinox Sabbat is called", a: "Ostara (Spring Equinox)" },
      { q: "The Summer Solstice Sabbat is called", a: "Litha (Summer Solstice)" },
      { q: "Which Sabbat is the first harvest festival", a: "Lughnasadh" },
      { q: "The Autumn Equinox Sabbat is called", a: "Mabon (Autumn Equinox)" },
      { q: "Which Sabbat is associated with the goddess Brigid", a: "Imbolc" },
      { q: "Beltane celebrates the beginning of which season", a: "Summer" }
    ];

    wheelFacts.forEach(({ q, a }, index) => {
      const pool = index < 7 ? namePool : toUniqueOptionList(["Spring", "Summer", "Autumn / Fall", "Winter"]);
      if (pool.some((p) => normalizeKey(p) === normalizeKey(a))) {
        const t = makeTemplate(
          `wheel-fact-${index}`,
          categoryId,
          category,
          q,
          a,
          pool
        );
        if (t) bank.push(t);
      }
    });

    return bank;
  }

  // ---- Registration ----------------------------------------------------------------

  function registerCalendarQuizCategories() {
    const { registerQuizCategory } = window.QuizSectionUi || {};
    if (typeof registerQuizCategory !== "function") {
      return;
    }

    registerQuizCategory(
      "hebrew-calendar-months",
      "Hebrew Calendar",
      (referenceData) => buildHebrewCalendarQuiz(referenceData)
    );

    registerQuizCategory(
      "islamic-calendar-months",
      "Islamic Calendar",
      (referenceData) => buildIslamicCalendarQuiz(referenceData)
    );

    registerQuizCategory(
      "wheel-of-year",
      "Wheel of the Year",
      (referenceData) => buildWheelOfYearQuiz(referenceData)
    );
  }

  // Register immediately — ui-quiz.js loads before this file
  registerCalendarQuizCategories();

  window.QuizCalendarsPlugin = {
    registerCalendarQuizCategories
  };
})();
