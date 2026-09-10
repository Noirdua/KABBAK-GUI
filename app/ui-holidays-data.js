/* ui-holidays-data.js - Holiday data and date resolution helpers */
(function () {
  "use strict";

  const HEBREW_MONTH_ALIAS_BY_ID = {
    nisan: ["nisan"],
    iyar: ["iyar"],
    sivan: ["sivan"],
    tammuz: ["tamuz", "tammuz"],
    av: ["av"],
    elul: ["elul"],
    tishrei: ["tishri", "tishrei"],
    cheshvan: ["heshvan", "cheshvan", "marcheshvan"],
    kislev: ["kislev"],
    tevet: ["tevet"],
    shvat: ["shevat", "shvat"],
    adar: ["adar", "adar i", "adar 1"],
    "adar-ii": ["adar ii", "adar 2"]
  };

  const MONTH_NAME_TO_INDEX = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
  };

  const GREGORIAN_MONTH_ID_TO_ORDER = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12
  };

  function normalizeCalendarText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['`]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function readNumericPart(parts, partType) {
    const raw = parts.find((part) => part.type === partType)?.value;
    if (!raw) {
      return null;
    }

    const digits = String(raw).replace(/[^0-9]/g, "");
    if (!digits) {
      return null;
    }

    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getGregorianMonthOrderFromId(monthId) {
    if (!monthId) {
      return null;
    }
    const key = String(monthId).trim().toLowerCase();
    const value = GREGORIAN_MONTH_ID_TO_ORDER[key];
    return Number.isFinite(value) ? value : null;
  }

  function parseMonthDayStartToken(token) {
    const match = String(token || "").match(/(\d{2})-(\d{2})/);
    if (!match) {
      return null;
    }

    const month = Number(match[1]);
    const day = Number(match[2]);
    if (!Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    return { month, day };
  }

  function createDateAtNoon(year, monthIndex, dayOfMonth) {
    return new Date(Math.trunc(year), monthIndex, Math.trunc(dayOfMonth), 12, 0, 0, 0);
  }

  function computeWesternEasterDate(year) {
    const y = Math.trunc(Number(year));
    if (!Number.isFinite(y)) {
      return null;
    }

    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return createDateAtNoon(y, month - 1, day);
  }

  function computeNthWeekdayOfMonth(year, monthIndex, weekday, ordinal) {
    const y = Math.trunc(Number(year));
    if (!Number.isFinite(y)) {
      return null;
    }

    const first = createDateAtNoon(y, monthIndex, 1);
    const firstWeekday = first.getDay();
    const offset = (weekday - firstWeekday + 7) % 7;
    const dayOfMonth = 1 + offset + (Math.trunc(ordinal) - 1) * 7;
    const daysInMonth = new Date(y, monthIndex + 1, 0).getDate();
    if (dayOfMonth > daysInMonth) {
      return null;
    }
    return createDateAtNoon(y, monthIndex, dayOfMonth);
  }

  function resolveGregorianDateRule(rule, selectedYear) {
    const key = String(rule || "").trim().toLowerCase();
    if (!key) {
      return null;
    }

    if (key === "gregorian-easter-sunday") {
      return computeWesternEasterDate(selectedYear);
    }

    if (key === "gregorian-good-friday") {
      const easter = computeWesternEasterDate(selectedYear);
      if (!(easter instanceof Date) || Number.isNaN(easter.getTime())) {
        return null;
      }
      return createDateAtNoon(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2);
    }

    if (key === "gregorian-thanksgiving-us") {
      return computeNthWeekdayOfMonth(selectedYear, 10, 4, 4);
    }

    return null;
  }

  function parseFirstMonthDayFromText(dateText) {
    const text = String(dateText || "").replace(/~/g, " ");
    const firstSegment = text.split("/")[0] || text;
    const match = firstSegment.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i);
    if (!match) {
      return null;
    }

    const monthIndex = MONTH_NAME_TO_INDEX[String(match[1]).toLowerCase()];
    const day = Number(match[2]);
    if (!Number.isFinite(monthIndex) || !Number.isFinite(day)) {
      return null;
    }

    return { monthIndex, day };
  }

  function findHebrewMonthDayInGregorianYear(monthId, day, year) {
    const aliases = HEBREW_MONTH_ALIAS_BY_ID[String(monthId || "").toLowerCase()] || [];
    const targetDay = Number(day);
    if (!aliases.length || !Number.isFinite(targetDay) || !Number.isFinite(year)) {
      return null;
    }

    const normalizedAliases = aliases.map((alias) => normalizeCalendarText(alias)).filter(Boolean);
    const formatter = new Intl.DateTimeFormat("en-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const cursor = new Date(Math.trunc(year), 0, 1, 12, 0, 0, 0);
    const end = new Date(Math.trunc(year), 11, 31, 12, 0, 0, 0);

    while (cursor.getTime() <= end.getTime()) {
      const parts = formatter.formatToParts(cursor);
      const currentDay = readNumericPart(parts, "day");
      const monthName = normalizeCalendarText(parts.find((part) => part.type === "month")?.value);
      if (currentDay === Math.trunc(targetDay) && normalizedAliases.includes(monthName)) {
        return new Date(cursor);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return null;
  }

  function getIslamicMonthOrderById(monthId, calendarData) {
    const month = (calendarData?.islamic || []).find((item) => item?.id === monthId);
    const order = Number(month?.order);
    return Number.isFinite(order) ? Math.trunc(order) : null;
  }

  function findIslamicMonthDayInGregorianYear(monthId, day, year, calendarData) {
    const monthOrder = getIslamicMonthOrderById(monthId, calendarData);
    const targetDay = Number(day);
    if (!Number.isFinite(monthOrder) || !Number.isFinite(targetDay) || !Number.isFinite(year)) {
      return null;
    }

    const formatter = new Intl.DateTimeFormat("en-u-ca-islamic", {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    });

    const cursor = new Date(Math.trunc(year), 0, 1, 12, 0, 0, 0);
    const end = new Date(Math.trunc(year), 11, 31, 12, 0, 0, 0);

    while (cursor.getTime() <= end.getTime()) {
      const parts = formatter.formatToParts(cursor);
      const currentDay = readNumericPart(parts, "day");
      const currentMonth = readNumericPart(parts, "month");
      if (currentDay === Math.trunc(targetDay) && currentMonth === monthOrder) {
        return new Date(cursor);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return null;
  }

  function resolveHolidayGregorianDate(holiday, options = {}) {
    if (!holiday || typeof holiday !== "object") {
      return null;
    }

    const selectedYear = Number(options.selectedYear);
    const calendarData = options.calendarData || {};
    const calendarId = String(holiday.calendarId || "").trim().toLowerCase();
    const monthId = String(holiday.monthId || "").trim().toLowerCase();
    const day = Number(holiday.day);

    if (calendarId === "gregorian") {
      if (holiday?.dateRule) {
        const ruledDate = resolveGregorianDateRule(holiday.dateRule, selectedYear);
        if (ruledDate) {
          return ruledDate;
        }
      }

      const monthDay = parseMonthDayStartToken(holiday.monthDayStart) || parseMonthDayStartToken(holiday.dateText);
      if (monthDay) {
        return new Date(selectedYear, monthDay.month - 1, monthDay.day, 12, 0, 0, 0);
      }
      const order = getGregorianMonthOrderFromId(monthId);
      if (Number.isFinite(order) && Number.isFinite(day)) {
        return new Date(selectedYear, order - 1, Math.trunc(day), 12, 0, 0, 0);
      }
      return null;
    }

    if (calendarId === "hebrew") {
      return findHebrewMonthDayInGregorianYear(monthId, day, selectedYear);
    }

    if (calendarId === "islamic") {
      return findIslamicMonthDayInGregorianYear(monthId, day, selectedYear, calendarData);
    }

    if (calendarId === "wheel-of-year") {
      const monthDay = parseMonthDayStartToken(holiday.monthDayStart) || parseFirstMonthDayFromText(holiday.dateText);
      if (monthDay?.month && monthDay?.day) {
        return new Date(selectedYear, monthDay.month - 1, monthDay.day, 12, 0, 0, 0);
      }
      if (monthDay?.monthIndex != null && monthDay?.day) {
        return new Date(selectedYear, monthDay.monthIndex, monthDay.day, 12, 0, 0, 0);
      }
    }

    return null;
  }

  function formatGregorianReferenceDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "--";
    }

    return date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function formatCalendarDateFromGregorian(date, calendarId) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "--";
    }

    const locale = calendarId === "hebrew"
      ? "en-u-ca-hebrew"
      : (calendarId === "islamic" ? "en-u-ca-islamic" : "en");

    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date);
  }

  function buildPlanetMap(planetsObj) {
    const map = new Map();
    if (!planetsObj || typeof planetsObj !== "object") {
      return map;
    }

    Object.values(planetsObj).forEach((planet) => {
      if (!planet?.id) {
        return;
      }
      map.set(planet.id, planet);
    });

    return map;
  }

  function buildSignsMap(signs) {
    const map = new Map();
    if (!Array.isArray(signs)) {
      return map;
    }

    signs.forEach((sign) => {
      if (!sign?.id) {
        return;
      }
      map.set(sign.id, sign);
    });

    return map;
  }

  function buildGodsMap(magickDataset) {
    const gods = magickDataset?.grouped?.gods?.gods;
    const map = new Map();

    if (!Array.isArray(gods)) {
      return map;
    }

    gods.forEach((god) => {
      if (!god?.id) {
        return;
      }
      map.set(god.id, god);
    });

    return map;
  }

  function buildHebrewMap(magickDataset) {
    const map = new Map();
    const letters = magickDataset?.grouped?.alphabets?.hebrew;
    if (!Array.isArray(letters)) {
      return map;
    }

    letters.forEach((letter) => {
      if (!letter?.hebrewLetterId) {
        return;
      }
      map.set(letter.hebrewLetterId, letter);
    });

    return map;
  }

  function buildCalendarData(referenceData) {
    return {
      gregorian: Array.isArray(referenceData?.calendarMonths) ? referenceData.calendarMonths : [],
      hebrew: Array.isArray(referenceData?.hebrewCalendar?.months) ? referenceData.hebrewCalendar.months : [],
      islamic: Array.isArray(referenceData?.islamicCalendar?.months) ? referenceData.islamicCalendar.months : [],
      "wheel-of-year": Array.isArray(referenceData?.wheelOfYear?.months) ? referenceData.wheelOfYear.months : []
    };
  }

  function calendarLabel(calendarId) {
    const key = String(calendarId || "").trim().toLowerCase();
    if (key === "hebrew") return "Hebrew";
    if (key === "islamic") return "Islamic";
    if (key === "wheel-of-year") return "Wheel of the Year";
    return "Gregorian";
  }

  function monthLabelForCalendar(calendarData, calendarId, monthId) {
    const months = calendarData?.[calendarId];
    if (!Array.isArray(months)) {
      return monthId || "--";
    }

    const month = months.find((entry) => String(entry?.id || "").toLowerCase() === String(monthId || "").toLowerCase());
    return month?.name || monthId || "--";
  }

  function normalizeSourceFilter(value) {
    const key = String(value || "").trim().toLowerCase();
    if (key === "gregorian" || key === "hebrew" || key === "islamic" || key === "wheel-of-year") {
      return key;
    }
    return "all";
  }

  function buildAllHolidays(referenceData) {
    if (Array.isArray(referenceData?.calendarHolidays) && referenceData.calendarHolidays.length) {
      return [...referenceData.calendarHolidays].sort((left, right) => {
        const calCmp = calendarLabel(left?.calendarId).localeCompare(calendarLabel(right?.calendarId));
        if (calCmp !== 0) return calCmp;

        const leftDay = Number(left?.day);
        const rightDay = Number(right?.day);
        if (Number.isFinite(leftDay) && Number.isFinite(rightDay) && leftDay !== rightDay) {
          return leftDay - rightDay;
        }

        return String(left?.name || "").localeCompare(String(right?.name || ""));
      });
    }

    const legacy = Array.isArray(referenceData?.celestialHolidays) ? referenceData.celestialHolidays : [];
    return legacy.map((holiday) => ({
      ...holiday,
      calendarId: "gregorian",
      dateText: holiday?.date || holiday?.dateRange || ""
    }));
  }

  window.HolidayDataUi = {
    buildAllHolidays,
    buildCalendarData,
    buildGodsMap,
    buildHebrewMap,
    buildPlanetMap,
    buildSignsMap,
    calendarLabel,
    formatCalendarDateFromGregorian,
    formatGregorianReferenceDate,
    monthLabelForCalendar,
    normalizeSourceFilter,
    resolveHolidayGregorianDate
  };
})();