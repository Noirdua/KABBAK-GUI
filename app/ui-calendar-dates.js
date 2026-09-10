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

  let config = {};

  function getSelectedYear() {
    return Number(config.getSelectedYear?.()) || new Date().getFullYear();
  }

  function getSelectedCalendar() {
    return String(config.getSelectedCalendar?.() || "gregorian").trim().toLowerCase();
  }

  function getIslamicMonths() {
    return config.getIslamicMonths?.() || [];
  }

  function parseMonthDayToken(token) {
    const [month, day] = String(token || "").split("-").map((part) => Number(part));
    if (!Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    return { month, day };
  }

  function monthDayDate(monthDay, year) {
    const parsed = parseMonthDayToken(monthDay);
    if (!parsed) {
      return null;
    }
    return new Date(year, parsed.month - 1, parsed.day);
  }

  function buildSignDateBounds(sign) {
    const start = monthDayDate(sign?.start, 2025);
    const endBase = monthDayDate(sign?.end, 2025);
    if (!start || !endBase) {
      return null;
    }

    const wrapsYear = endBase.getTime() < start.getTime();
    const end = wrapsYear ? monthDayDate(sign?.end, 2026) : endBase;
    if (!end) {
      return null;
    }

    return { start, end };
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function formatDateLabel(date) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function monthDayOrdinal(month, day) {
    if (!Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    const base = new Date(2025, Math.trunc(month) - 1, Math.trunc(day), 12, 0, 0, 0);
    if (Number.isNaN(base.getTime())) {
      return null;
    }
    const start = new Date(2025, 0, 1, 12, 0, 0, 0);
    const diff = base.getTime() - start.getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
  }

  function isMonthDayInRange(targetMonth, targetDay, startMonth, startDay, endMonth, endDay) {
    const target = monthDayOrdinal(targetMonth, targetDay);
    const start = monthDayOrdinal(startMonth, startDay);
    const end = monthDayOrdinal(endMonth, endDay);
    if (!Number.isFinite(target) || !Number.isFinite(start) || !Number.isFinite(end)) {
      return false;
    }

    if (end >= start) {
      return target >= start && target <= end;
    }
    return target >= start || target <= end;
  }

  function parseMonthDayTokensFromText(value) {
    const text = String(value || "");
    const matches = [...text.matchAll(/(\d{2})-(\d{2})/g)];
    return matches
      .map((match) => ({ month: Number(match[1]), day: Number(match[2]) }))
      .filter((token) => Number.isFinite(token.month) && Number.isFinite(token.day));
  }

  function parseDayRangeFromText(value) {
    const text = String(value || "");
    const range = text.match(/\b(\d{1,2})\s*[–-]\s*(\d{1,2})\b/);
    if (!range) {
      return null;
    }

    const startDay = Number(range[1]);
    const endDay = Number(range[2]);
    if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) {
      return null;
    }

    return { startDay, endDay };
  }

  function isoToDateAtNoon(iso) {
    const text = String(iso || "").trim();
    if (!text) {
      return null;
    }
    const parsed = new Date(`${text}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function getDaysInMonth(year, monthOrder) {
    if (!Number.isFinite(year) || !Number.isFinite(monthOrder)) {
      return null;
    }
    return new Date(year, monthOrder, 0).getDate();
  }

  function getMonthStartWeekday(year, monthOrder) {
    const date = new Date(year, monthOrder - 1, 1);
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }

  function parseMonthRange(month) {
    const startText = String(month?.start || "").trim();
    const endText = String(month?.end || "").trim();
    if (!startText || !endText) {
      return "--";
    }
    return `${startText} to ${endText}`;
  }

  function getGregorianMonthOrderFromId(monthId) {
    if (!monthId) {
      return null;
    }
    const key = String(monthId).trim().toLowerCase();
    const value = GREGORIAN_MONTH_ID_TO_ORDER[key];
    return Number.isFinite(value) ? value : null;
  }

  function normalizeCalendarText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['`´ʻ’]/g, "")
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

  function getGregorianMonthStartDate(monthOrder, year = getSelectedYear()) {
    if (!Number.isFinite(monthOrder) || !Number.isFinite(year)) {
      return null;
    }

    return new Date(Math.trunc(year), Math.trunc(monthOrder) - 1, 1, 12, 0, 0, 0);
  }

  function getHebrewMonthAliases(month) {
    const aliases = [];
    const idAliases = HEBREW_MONTH_ALIAS_BY_ID[String(month?.id || "").toLowerCase()] || [];
    aliases.push(...idAliases);

    const nameAlias = normalizeCalendarText(month?.name);
    if (nameAlias) {
      aliases.push(nameAlias);
    }

    return Array.from(new Set(aliases.map((alias) => normalizeCalendarText(alias)).filter(Boolean)));
  }

  function findHebrewMonthStartInGregorianYear(month, year) {
    const aliases = getHebrewMonthAliases(month);
    if (!aliases.length || !Number.isFinite(year)) {
      return null;
    }

    const formatter = new Intl.DateTimeFormat("en-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const cursor = new Date(Math.trunc(year), 0, 1, 12, 0, 0, 0);
    const end = new Date(Math.trunc(year), 11, 31, 12, 0, 0, 0);

    while (cursor.getTime() <= end.getTime()) {
      const parts = formatter.formatToParts(cursor);
      const day = readNumericPart(parts, "day");
      const monthName = normalizeCalendarText(parts.find((part) => part.type === "month")?.value);
      if (day === 1 && aliases.includes(monthName)) {
        return new Date(cursor);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return null;
  }

  function findIslamicMonthStartInGregorianYear(month, year) {
    const targetOrder = Number(month?.order);
    if (!Number.isFinite(targetOrder) || !Number.isFinite(year)) {
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
      const day = readNumericPart(parts, "day");
      const monthNo = readNumericPart(parts, "month");
      if (day === 1 && monthNo === Math.trunc(targetOrder)) {
        return new Date(cursor);
      }
      cursor.setDate(cursor.getDate() + 1);
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

  function resolveGregorianDateRule(rule, year = getSelectedYear()) {
    const key = String(rule || "").trim().toLowerCase();
    if (!key) {
      return null;
    }

    if (key === "gregorian-easter-sunday") {
      return computeWesternEasterDate(year);
    }

    if (key === "gregorian-good-friday") {
      const easter = computeWesternEasterDate(year);
      if (!(easter instanceof Date) || Number.isNaN(easter.getTime())) {
        return null;
      }
      return createDateAtNoon(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2);
    }

    if (key === "gregorian-thanksgiving-us") {
      return computeNthWeekdayOfMonth(year, 10, 4, 4);
    }

    return null;
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

  function getIslamicMonthOrderById(monthId) {
    const month = getIslamicMonths().find((item) => item?.id === monthId);
    const order = Number(month?.order);
    return Number.isFinite(order) ? Math.trunc(order) : null;
  }

  function findIslamicMonthDayInGregorianYear(monthId, day, year) {
    const monthOrder = getIslamicMonthOrderById(monthId);
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

  function resolveHolidayGregorianDate(holiday) {
    if (!holiday || typeof holiday !== "object") {
      return null;
    }

    const calendarId = String(holiday.calendarId || "").trim().toLowerCase();
    const monthId = String(holiday.monthId || "").trim().toLowerCase();
    const day = Number(holiday.day);
    const selectedYear = getSelectedYear();

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
      return findIslamicMonthDayInGregorianYear(monthId, day, selectedYear);
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

  function findWheelMonthStartInGregorianYear(month, year) {
    const parsed = parseFirstMonthDayFromText(month?.date);
    if (!parsed || !Number.isFinite(year)) {
      return null;
    }

    return new Date(Math.trunc(year), parsed.monthIndex, parsed.day, 12, 0, 0, 0);
  }

  function getGregorianReferenceDateForCalendarMonth(month) {
    const calId = getSelectedCalendar();
    const selectedYear = getSelectedYear();
    if (calId === "gregorian") {
      return getGregorianMonthStartDate(Number(month?.order), selectedYear);
    }
    if (calId === "hebrew") {
      return findHebrewMonthStartInGregorianYear(month, selectedYear);
    }
    if (calId === "islamic") {
      return findIslamicMonthStartInGregorianYear(month, selectedYear);
    }
    if (calId === "wheel-of-year") {
      return findWheelMonthStartInGregorianYear(month, selectedYear);
    }
    return null;
  }

  function formatIsoDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function resolveCalendarDayToGregorian(month, dayNumber) {
    const calId = getSelectedCalendar();
    const selectedYear = getSelectedYear();
    const day = Math.trunc(Number(dayNumber));
    if (!Number.isFinite(day) || day <= 0) {
      return null;
    }

    if (calId === "gregorian") {
      const monthOrder = Number(month?.order);
      if (!Number.isFinite(monthOrder)) {
        return null;
      }
      return new Date(selectedYear, monthOrder - 1, day, 12, 0, 0, 0);
    }

    if (calId === "hebrew") {
      return findHebrewMonthDayInGregorianYear(month?.id, day, selectedYear);
    }

    if (calId === "islamic") {
      return findIslamicMonthDayInGregorianYear(month?.id, day, selectedYear);
    }

    return null;
  }

  function intersectDateRanges(startA, endA, startB, endB) {
    const start = startA.getTime() > startB.getTime() ? startA : startB;
    const end = endA.getTime() < endB.getTime() ? endA : endB;
    return start.getTime() <= end.getTime() ? { start, end } : null;
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig
    };
  }

  window.TarotCalendarDates = {
    ...(window.TarotCalendarDates || {}),
    init,
    parseMonthDayToken,
    buildSignDateBounds,
    addDays,
    formatDateLabel,
    isMonthDayInRange,
    parseMonthDayTokensFromText,
    parseDayRangeFromText,
    isoToDateAtNoon,
    getDaysInMonth,
    getMonthStartWeekday,
    parseMonthRange,
    normalizeCalendarText,
    formatGregorianReferenceDate,
    formatCalendarDateFromGregorian,
    getGregorianMonthStartDate,
    findHebrewMonthStartInGregorianYear,
    findIslamicMonthStartInGregorianYear,
    parseFirstMonthDayFromText,
    parseMonthDayStartToken,
    resolveHolidayGregorianDate,
    findWheelMonthStartInGregorianYear,
    getGregorianReferenceDateForCalendarMonth,
    formatIsoDate,
    resolveCalendarDayToGregorian,
    intersectDateRanges
  };
})();