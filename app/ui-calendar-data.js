(function () {
  "use strict";

  function formatDegreeLabel(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "--";
    }

    return String(Math.trunc(numeric)).padStart(2, "0");
  }

  function buildDecanWindow(context, sign, decanIndex) {
    const { buildSignDateBounds, addDays, formatDateLabel } = context;
    const bounds = buildSignDateBounds(sign);
    const index = Number(decanIndex);
    if (!bounds || !Number.isFinite(index)) {
      return null;
    }

    const start = addDays(bounds.start, (index - 1) * 10);
    const nominalEnd = addDays(start, 9);
    const end = nominalEnd.getTime() > bounds.end.getTime() ? bounds.end : nominalEnd;

    return {
      start,
      end,
      label: `${formatDateLabel(start)}–${formatDateLabel(end)}`
    };
  }

  function listMonthNumbersBetween(start, end) {
    const result = [];
    const seen = new Set();
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const limit = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor.getTime() <= limit.getTime()) {
      const monthNo = cursor.getMonth() + 1;
      if (!seen.has(monthNo)) {
        seen.add(monthNo);
        result.push(monthNo);
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return result;
  }

  function buildDecanTarotRowsForMonth(context, month) {
    const { state, normalizeMinorTarotCardName } = context;
    const monthOrder = Number(month?.order);
    if (!Number.isFinite(monthOrder)) {
      return [];
    }

    const rows = [];
    const seen = new Set();
    const decansBySign = state.referenceData?.decansBySign || {};

    Object.entries(decansBySign).forEach(([signId, decans]) => {
      const sign = state.signsById.get(signId);
      if (!sign || !Array.isArray(decans)) {
        return;
      }

      decans.forEach((decan) => {
        const window = buildDecanWindow(context, sign, decan?.index);
        if (!window) {
          return;
        }

        const monthsTouched = listMonthNumbersBetween(window.start, window.end);
        if (!monthsTouched.includes(monthOrder)) {
          return;
        }

        const cardName = normalizeMinorTarotCardName(decan?.tarotMinorArcana);
        if (!cardName) {
          return;
        }

        const key = `${cardName}|${signId}|${decan.index}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);

        const startDegree = (Number(decan.index) - 1) * 10;
        const endDegree = startDegree + 9;
        const signName = sign?.name?.en || sign?.name || signId;

        rows.push({
          cardName,
          signId,
          signName,
          signSymbol: sign?.symbol || "",
          decanIndex: Number(decan.index),
          startDegree,
          endDegree,
          degreeRangeLabel: `${formatDegreeLabel(startDegree)}°–${formatDegreeLabel(endDegree)}°`,
          startTime: window.start.getTime(),
          endTime: window.end.getTime(),
          startMonth: window.start.getMonth() + 1,
          startDay: window.start.getDate(),
          endMonth: window.end.getMonth() + 1,
          endDay: window.end.getDate(),
          dateRange: window.label
        });
      });
    });

    rows.sort((left, right) => {
      if (left.startTime !== right.startTime) {
        return left.startTime - right.startTime;
      }
      if (left.decanIndex !== right.decanIndex) {
        return left.decanIndex - right.decanIndex;
      }
      return left.cardName.localeCompare(right.cardName);
    });

    return rows;
  }

  function getMonthDayLinkRows(context, month) {
    const { state, getDaysInMonth, resolveCalendarDayToGregorian, formatIsoDate } = context;
    const cacheKey = `${state.selectedCalendar}|${state.selectedYear}|${month?.id || ""}`;
    if (state.dayLinksCache.has(cacheKey)) {
      return state.dayLinksCache.get(cacheKey);
    }

    let dayCount = null;
    if (state.selectedCalendar === "gregorian") {
      dayCount = getDaysInMonth(state.selectedYear, Number(month?.order));
    } else if (state.selectedCalendar === "hebrew" || state.selectedCalendar === "islamic") {
      const baseDays = Number(month?.days);
      const variantDays = Number(month?.daysVariant);
      if (Number.isFinite(baseDays) && Number.isFinite(variantDays)) {
        dayCount = Math.max(Math.trunc(baseDays), Math.trunc(variantDays));
      } else if (Number.isFinite(baseDays)) {
        dayCount = Math.trunc(baseDays);
      } else if (Number.isFinite(variantDays)) {
        dayCount = Math.trunc(variantDays);
      }
    }

    if (!Number.isFinite(dayCount) || dayCount <= 0) {
      state.dayLinksCache.set(cacheKey, []);
      return [];
    }

    const rows = [];
    for (let day = 1; day <= dayCount; day += 1) {
      const gregorianDate = resolveCalendarDayToGregorian(month, day);
      rows.push({
        day,
        gregorianDate: formatIsoDate(gregorianDate),
        isResolved: Boolean(gregorianDate && !Number.isNaN(gregorianDate.getTime()))
      });
    }

    state.dayLinksCache.set(cacheKey, rows);
    return rows;
  }

  function associationSearchText(context, associations) {
    const { getTarotCardSearchAliases } = context;
    if (!associations || typeof associations !== "object") {
      return "";
    }

    const tarotAliases = associations.tarotCard && typeof getTarotCardSearchAliases === "function"
      ? getTarotCardSearchAliases(associations.tarotCard, { trumpNumber: associations.tarotTrumpNumber })
      : [];

    const linkParts = [
      associations.planetId,
      associations.zodiacSignId,
      associations.numberValue,
      associations.tarotCard,
      associations.tarotTrumpNumber,
      tarotAliases,
      associations.godId,
      associations.godName,
      associations.hebrewLetterId,
      associations.kabbalahPathNumber,
      associations.iChingPlanetaryInfluence,
      {
        type: "planet",
        id: associations.planetId,
        data: { planetId: associations.planetId }
      },
      {
        type: "zodiac",
        id: associations.zodiacSignId,
        data: { signId: associations.zodiacSignId }
      },
      {
        type: "element",
        id: associations.element || associations.elementId,
        data: { elementId: associations.element || associations.elementId }
      },
      {
        type: "modality",
        id: associations.modality || associations.quadruplicity,
        data: { modality: associations.modality || associations.quadruplicity }
      },
      {
        type: "tarotCard",
        id: associations.tarotCard,
        data: { cardName: associations.tarotCard }
      },
      {
        type: "hebrewLetter",
        id: associations.hebrewLetterId,
        data: { hebrewLetterId: associations.hebrewLetterId }
      },
      {
        type: "kabbalahPath",
        id: associations.kabbalahPathNumber,
        data: { pathNumber: associations.kabbalahPathNumber }
      }
    ];

    if (typeof window.TarotSearchText?.buildSearchText === "function") {
      return window.TarotSearchText.buildSearchText(linkParts);
    }

    return linkParts.flat(Infinity).filter(Boolean).join(" ");
  }

  function eventSearchText(context, event) {
    const { normalizeSearchValue } = context;
    const parts = [
      event?.name,
      event?.date,
      event?.dateRange,
      event?.description,
      associationSearchText(context, event?.associations)
    ];

    if (typeof window.TarotSearchText?.buildSearchText === "function") {
      return window.TarotSearchText.buildSearchText(parts);
    }

    return normalizeSearchValue(parts.filter(Boolean).join(" "));
  }

  function holidaySearchText(context, holiday) {
    const { normalizeSearchValue } = context;
    const parts = [
      holiday?.name,
      holiday?.kind,
      holiday?.date,
      holiday?.dateRange,
      holiday?.dateText,
      holiday?.monthDayStart,
      holiday?.calendarId,
      holiday?.description,
      associationSearchText(context, holiday?.associations)
    ];

    if (typeof window.TarotSearchText?.buildSearchText === "function") {
      return window.TarotSearchText.buildSearchText(parts);
    }

    return normalizeSearchValue(parts.filter(Boolean).join(" "));
  }

  function buildHolidayList(context, month) {
    const { state, normalizeText, resolveHolidayGregorianDate } = context;
    const calendarId = state.selectedCalendar;
    const monthOrder = Number(month?.order);

    const fromRepo = state.calendarHolidays.filter((holiday) => {
      const holidayCalendarId = normalizeText(holiday?.calendarId).toLowerCase();
      if (holidayCalendarId !== calendarId) {
        return false;
      }

      const isDirectMonthMatch = normalizeText(holiday?.monthId).toLowerCase() === normalizeText(month?.id).toLowerCase();
      if (isDirectMonthMatch) {
        return true;
      }

      if (calendarId === "gregorian" && holiday?.dateRule && Number.isFinite(monthOrder)) {
        const computedDate = resolveHolidayGregorianDate(holiday);
        return computedDate instanceof Date
          && !Number.isNaN(computedDate.getTime())
          && (computedDate.getMonth() + 1) === Math.trunc(monthOrder);
      }

      return false;
    });

    if (fromRepo.length) {
      return [...fromRepo].sort((left, right) => {
        const leftDate = resolveHolidayGregorianDate(left);
        const rightDate = resolveHolidayGregorianDate(right);
        const leftDay = Number.isFinite(Number(left?.day))
          ? Number(left.day)
          : ((leftDate instanceof Date && !Number.isNaN(leftDate.getTime())) ? leftDate.getDate() : NaN);
        const rightDay = Number.isFinite(Number(right?.day))
          ? Number(right.day)
          : ((rightDate instanceof Date && !Number.isNaN(rightDate.getTime())) ? rightDate.getDate() : NaN);
        if (Number.isFinite(leftDay) && Number.isFinite(rightDay) && leftDay !== rightDay) {
          return leftDay - rightDay;
        }
        return normalizeText(left?.name).localeCompare(normalizeText(right?.name));
      });
    }

    const seen = new Set();
    const ordered = [];

    (month?.holidayIds || []).forEach((holidayId) => {
      const holiday = state.holidays.find((item) => item.id === holidayId);
      if (holiday && !seen.has(holiday.id)) {
        seen.add(holiday.id);
        ordered.push(holiday);
      }
    });

    state.holidays.forEach((holiday) => {
      if (holiday?.monthId === month.id && !seen.has(holiday.id)) {
        seen.add(holiday.id);
        ordered.push(holiday);
      }
    });

    return ordered;
  }

  function buildMonthSearchText(context, month) {
    const { state, normalizeSearchValue } = context;
    const monthHolidays = buildHolidayList(context, month);
    const holidayText = monthHolidays.map((holiday) => holidaySearchText(context, holiday)).join(" ");
    const buildText = typeof window.TarotSearchText?.buildSearchText === "function"
      ? (...parts) => window.TarotSearchText.buildSearchText(...parts)
      : (...parts) => normalizeSearchValue(parts.flat(Infinity).filter(Boolean).join(" "));

    if (state.selectedCalendar === "gregorian") {
      const events = Array.isArray(month?.events) ? month.events : [];
      return buildText(
        month?.name,
        month?.id,
        month?.start,
        month?.end,
        month?.coreTheme,
        month?.seasonNorth,
        month?.seasonSouth,
        associationSearchText(context, month?.associations),
        events.map((event) => eventSearchText(context, event)),
        holidayText
      );
    }

    return buildText(
      month?.name,
      month?.id,
      month?.nativeName,
      month?.meaning,
      month?.season,
      month?.description,
      month?.zodiacSign,
      month?.tribe,
      month?.element,
      month?.type,
      month?.date,
      month?.hebrewLetter,
      holidayText,
      month?.associations?.themes,
      month?.associations?.deities,
      month?.associations?.element,
      month?.associations?.direction,
      {
        type: "element",
        id: month?.element || month?.associations?.element,
        data: { elementId: month?.element || month?.associations?.element }
      },
      {
        type: "zodiac",
        id: month?.zodiacSign,
        data: { signId: month?.zodiacSign, signName: month?.zodiacSign }
      }
    );
  }

  window.CalendarDataUi = {
    getMonthDayLinkRows,
    buildDecanTarotRowsForMonth,
    associationSearchText,
    eventSearchText,
    holidaySearchText,
    buildHolidayList,
    buildMonthSearchText
  };
})();