/* ui-calendar.js — Month and celestial holiday browser */
(function () {
  "use strict";

  const { html } = window.HtmlSafe;

  const { getTarotCardDisplayName, getTarotCardSearchAliases } = window.TarotCardImages || {};
  const calendarDatesUi = window.TarotCalendarDates || {};
  const calendarDetailUi = window.TarotCalendarDetail || {};
  const calendarDataUi = window.CalendarDataUi || {};
  const {
    addDays,
    buildSignDateBounds,
    formatCalendarDateFromGregorian,
    formatDateLabel,
    formatGregorianReferenceDate,
    formatIsoDate,
    getDaysInMonth,
    getGregorianMonthStartDate,
    getGregorianReferenceDateForCalendarMonth,
    getMonthStartWeekday,
    intersectDateRanges,
    isMonthDayInRange,
    isoToDateAtNoon,
    normalizeCalendarText,
    parseDayRangeFromText,
    parseMonthDayStartToken,
    parseMonthDayToken,
    parseMonthDayTokensFromText,
    parseMonthRange,
    resolveCalendarDayToGregorian,
    resolveHolidayGregorianDate
  } = calendarDatesUi;

  if (
    typeof calendarDataUi.getMonthDayLinkRows !== "function"
    || typeof calendarDataUi.buildDecanTarotRowsForMonth !== "function"
    || typeof calendarDataUi.eventSearchText !== "function"
    || typeof calendarDataUi.holidaySearchText !== "function"
    || typeof calendarDataUi.buildHolidayList !== "function"
    || typeof calendarDataUi.buildMonthSearchText !== "function"
  ) {
    throw new Error("CalendarDataUi module must load before ui-calendar.js");
  }

  const state = {
    initialized: false,
    referenceData: null,
    magickDataset: null,
    selectedCalendar: "gregorian",
    calendarData: {},
    months: [],
    filteredMonths: [],
    holidays: [],
    calendarHolidays: [],
    selectedMonthId: null,
    searchQuery: "",
    selectedYear: new Date().getFullYear(),
    selectedDayMonthId: null,
    selectedDayCalendarId: null,
    selectedDayEntries: [],
    planetsById: new Map(),
    signsById: new Map(),
    godsById: new Map(),
    hebrewById: new Map(),
    dayLinksCache: new Map()
  };
  let detailNavigator = null;

  const TAROT_TRUMP_NUMBER_BY_NAME = {
    "the fool": 0,
    fool: 0,
    "the magus": 1,
    magus: 1,
    magician: 1,
    "the high priestess": 2,
    "high priestess": 2,
    "the empress": 3,
    empress: 3,
    "the emperor": 4,
    emperor: 4,
    "the hierophant": 5,
    hierophant: 5,
    "the lovers": 6,
    lovers: 6,
    "the chariot": 7,
    chariot: 7,
    strength: 8,
    lust: 8,
    "the hermit": 9,
    hermit: 9,
    fortune: 10,
    "wheel of fortune": 10,
    justice: 11,
    "the hanged man": 12,
    "hanged man": 12,
    death: 13,
    temperance: 14,
    art: 14,
    "the devil": 15,
    devil: 15,
    "the tower": 16,
    tower: 16,
    "the star": 17,
    star: 17,
    "the moon": 18,
    moon: 18,
    "the sun": 19,
    sun: 19,
    aeon: 20,
    judgement: 20,
    judgment: 20,
    universe: 21,
    world: 21,
    "the world": 21
  };

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeSearchValue(value) {
    return normalizeText(value).toLowerCase();
  }

  function cap(value) {
    const text = normalizeText(value);
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function normalizeTarotName(value) {
    return normalizeText(value)
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function resolveTarotTrumpNumber(cardName) {
    const key = normalizeTarotName(cardName);
    if (!key) {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(TAROT_TRUMP_NUMBER_BY_NAME, key)) {
      return TAROT_TRUMP_NUMBER_BY_NAME[key];
    }

    const withoutLeadingThe = key.replace(/^the\s+/, "");
    if (Object.prototype.hasOwnProperty.call(TAROT_TRUMP_NUMBER_BY_NAME, withoutLeadingThe)) {
      return TAROT_TRUMP_NUMBER_BY_NAME[withoutLeadingThe];
    }

    return null;
  }

  function getDisplayTarotName(cardName, trumpNumber) {
    if (!cardName) {
      return "";
    }

    if (typeof getTarotCardDisplayName !== "function") {
      return cardName;
    }

    if (Number.isFinite(Number(trumpNumber))) {
      return getTarotCardDisplayName(cardName, { trumpNumber: Number(trumpNumber) }) || cardName;
    }

    return getTarotCardDisplayName(cardName) || cardName;
  }

  function normalizeMinorTarotCardName(value) {
    return normalizeTarotName(value)
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function normalizeDayFilterEntry(dayNumber, gregorianIso) {
    const nextDayNumber = Math.trunc(Number(dayNumber));
    const nextIso = normalizeText(gregorianIso);
    if (!Number.isFinite(nextDayNumber) || nextDayNumber <= 0 || !nextIso) {
      return null;
    }

    return {
      dayNumber: nextDayNumber,
      gregorianIso: nextIso
    };
  }

  function sortDayFilterEntries(entries) {
    const deduped = new Map();
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const normalized = normalizeDayFilterEntry(entry?.dayNumber, entry?.gregorianIso);
      if (normalized) {
        deduped.set(normalized.dayNumber, normalized);
      }
    });

    return [...deduped.values()].sort((left, right) => left.dayNumber - right.dayNumber);
  }

  function getElements() {
    return {
      sectionEl: document.getElementById("calendar-section"),
      monthListEl: document.getElementById("calendar-month-list"),
      monthCountEl: document.getElementById("calendar-month-count"),
      listTitleEl: document.getElementById("calendar-list-title"),
      calendarTypeEl: document.getElementById("calendar-type-select"),
      calendarYearWrapEl: document.getElementById("calendar-year-wrap"),
      yearInputEl: document.getElementById("calendar-year-input"),
      searchInputEl: document.getElementById("calendar-search-input"),
      searchClearEl: document.getElementById("calendar-search-clear"),
      detailNameEl: document.getElementById("calendar-detail-name"),
      detailSubEl: document.getElementById("calendar-detail-sub"),
      detailPrevEl: document.getElementById("calendar-detail-prev"),
      detailPositionEl: document.getElementById("calendar-detail-position"),
      detailNextEl: document.getElementById("calendar-detail-next"),
      detailBodyEl: document.getElementById("calendar-detail-body")
    };
  }

  function ensureDayFilterContext(month) {
    if (!month) {
      return;
    }

    const sameContext = state.selectedDayMonthId === month.id
      && state.selectedDayCalendarId === state.selectedCalendar;

    if (!sameContext) {
      state.selectedDayMonthId = month.id;
      state.selectedDayCalendarId = state.selectedCalendar;
      state.selectedDayEntries = [];
    }
  }

  function clearSelectedDayFilter() {
    state.selectedDayMonthId = null;
    state.selectedDayCalendarId = null;
    state.selectedDayEntries = [];
  }

  function toggleDayFilterEntry(month, dayNumber, gregorianIso) {
    ensureDayFilterContext(month);

    const next = normalizeDayFilterEntry(dayNumber, gregorianIso);
    if (!next) {
      return;
    }

    const entries = [...state.selectedDayEntries];
    const existingIndex = entries.findIndex((entry) => entry.dayNumber === next.dayNumber);
    if (existingIndex >= 0) {
      entries.splice(existingIndex, 1);
    } else {
      entries.push(next);
    }

    state.selectedDayEntries = sortDayFilterEntries(entries);
  }

  function toggleDayRangeFilter(month, startDay, endDay) {
    ensureDayFilterContext(month);

    const start = Math.trunc(Number(startDay));
    const end = Math.trunc(Number(endDay));
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0) {
      return;
    }

    const minDay = Math.min(start, end);
    const maxDay = Math.max(start, end);
    const rows = getMonthDayLinkRows(month)
      .filter((row) => row.isResolved && row.day >= minDay && row.day <= maxDay)
      .map((row) => normalizeDayFilterEntry(row.day, row.gregorianDate))
      .filter(Boolean);

    if (!rows.length) {
      return;
    }

    const existingSet = new Set(state.selectedDayEntries.map((entry) => entry.dayNumber));
    const allSelected = rows.every((row) => existingSet.has(row.dayNumber));

    if (allSelected) {
      const removeSet = new Set(rows.map((row) => row.dayNumber));
      state.selectedDayEntries = state.selectedDayEntries.filter((entry) => !removeSet.has(entry.dayNumber));
      return;
    }

    rows.forEach((row) => {
      if (!existingSet.has(row.dayNumber)) {
        state.selectedDayEntries.push(row);
      }
    });

    state.selectedDayEntries = sortDayFilterEntries(state.selectedDayEntries);
  }

  function getSelectedDayFilterContext(month) {
    if (!month) {
      return null;
    }
    if (state.selectedDayMonthId !== month.id) {
      return null;
    }
    if (state.selectedDayCalendarId !== state.selectedCalendar) {
      return null;
    }
    if (!Array.isArray(state.selectedDayEntries) || !state.selectedDayEntries.length) {
      return null;
    }

    const entries = state.selectedDayEntries
      .map((entry) => {
        const normalized = normalizeDayFilterEntry(entry.dayNumber, entry.gregorianIso);
        if (!normalized) {
          return null;
        }
        return {
          ...normalized,
          gregorianDate: isoToDateAtNoon(normalized.gregorianIso)
        };
      })
      .filter(Boolean);

    if (!entries.length) {
      return null;
    }

    return {
      entries,
      dayNumbers: new Set(entries.map((entry) => entry.dayNumber))
    };
  }

  function buildPlanetMap(planetsObj) {
    const map = new Map();
    if (!planetsObj || typeof planetsObj !== "object") {
      return map;
    }

    Object.values(planetsObj).forEach((planet) => {
      if (planet?.id) {
        map.set(planet.id, planet);
      }
    });

    return map;
  }

  function buildSignsMap(signs) {
    const map = new Map();
    if (!Array.isArray(signs)) {
      return map;
    }

    signs.forEach((sign) => {
      if (sign?.id) {
        map.set(sign.id, sign);
      }
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
      if (god?.id) {
        map.set(god.id, god);
      }
    });

    return map;
  }

  function findGodIdByName(name) {
    if (!name) {
      return null;
    }

    const normalized = normalizeText(name).toLowerCase().replace(/^the\s+/, "");
    for (const [id, god] of state.godsById) {
      const godName = normalizeText(god?.name).toLowerCase().replace(/^the\s+/, "");
      if (godName === normalized || id.toLowerCase() === normalized) {
        return id;
      }
    }

    return null;
  }

  function buildHebrewMap(magickDataset) {
    const map = new Map();
    const letters = magickDataset?.grouped?.alphabets?.hebrew;
    if (!Array.isArray(letters)) {
      return map;
    }

    letters.forEach((letter) => {
      if (letter?.hebrewLetterId) {
        map.set(letter.hebrewLetterId, letter);
      }
    });

    return map;
  }

  function sortMonths(months) {
    return [...months].sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0));
  }

  function getSelectedMonth() {
    return state.months.find((month) => month.id === state.selectedMonthId) || null;
  }

  function getMonthSubtitle(month) {
    if (state.selectedCalendar === "hebrew" || state.selectedCalendar === "islamic") {
      const native = month.nativeName ? ` · ${month.nativeName}` : "";
      const days = month.days ? ` · ${month.days} days` : "";
      return `${month.season || ""}${native}${days}`;
    }
    if (state.selectedCalendar === "wheel-of-year") {
      return [month.date, month.type, month.season].filter(Boolean).join(" · ");
    }
    return parseMonthRange(month);
  }

  function renderList(elements) {
    const { monthListEl, monthCountEl, listTitleEl } = elements;
    if (!monthListEl) {
      return;
    }

    monthListEl.innerHTML = "";

    state.filteredMonths.forEach((month) => {
      const isSelected = month.id === state.selectedMonthId;
      const itemEl = document.createElement("div");
      itemEl.className = `list-item${isSelected ? " is-selected" : ""}`;
      itemEl.setAttribute("role", "option");
      itemEl.setAttribute("aria-selected", isSelected ? "true" : "false");
      itemEl.dataset.monthId = month.id;
      itemEl.innerHTML = html`
        <div class="list-name">${month.name || month.id}</div>
        <div class="list-meta">${getMonthSubtitle(month)}</div>
      `;
      itemEl.addEventListener("click", () => {
        selectByMonthId(month.id, elements);
      });
      monthListEl.appendChild(itemEl);
    });

    if (monthCountEl) {
      monthCountEl.textContent = state.searchQuery
        ? `${state.filteredMonths.length} of ${state.months.length} months`
        : `${state.months.length} months`;
    }

    if (listTitleEl) {
      listTitleEl.textContent = "Calendar > Months";
    }
  }


  function getCalendarDataContext() {
    return {
      state,
      normalizeText,
      normalizeSearchValue,
      normalizeMinorTarotCardName,
      getTarotCardSearchAliases,
      addDays,
      buildSignDateBounds,
      formatDateLabel,
      formatIsoDate,
      getDaysInMonth,
      resolveCalendarDayToGregorian,
      resolveHolidayGregorianDate
    };
  }

  function buildDecanTarotRowsForMonth(month) {
    return calendarDataUi.buildDecanTarotRowsForMonth(getCalendarDataContext(), month);
  }

  function getMonthDayLinkRows(month) {
    return calendarDataUi.getMonthDayLinkRows(getCalendarDataContext(), month);
  }

  function eventSearchText(event) {
    return calendarDataUi.eventSearchText(getCalendarDataContext(), event);
  }

  function holidaySearchText(holiday) {
    return calendarDataUi.holidaySearchText(getCalendarDataContext(), holiday);
  }

  function buildHolidayList(month) {
    return calendarDataUi.buildHolidayList(getCalendarDataContext(), month);
  }

  function buildMonthSearchText(month) {
    return calendarDataUi.buildMonthSearchText(getCalendarDataContext(), month);
  }

  function matchesSearch(searchText) {
    if (!state.searchQuery) {
      return true;
    }
    return searchText.includes(state.searchQuery);
  }

  function syncSearchControls(elements) {
    if (elements.searchInputEl) {
      elements.searchInputEl.value = state.searchQuery;
    }
    if (elements.searchClearEl) {
      elements.searchClearEl.disabled = !state.searchQuery;
    }
  }

  function renderDetail(elements) {
    calendarDetailUi.renderDetail?.(elements);
    syncDetailNavigation(elements);
  }

  function getMonthSequenceState() {
    const total = state.filteredMonths.length;
    const currentIndex = state.filteredMonths.findIndex((month) => month.id === state.selectedMonthId);

    return {
      total,
      currentIndex,
      previousId: currentIndex > 0 ? state.filteredMonths[currentIndex - 1].id : "",
      nextId: currentIndex >= 0 && currentIndex < total - 1 ? state.filteredMonths[currentIndex + 1].id : ""
    };
  }

  function getDetailNavigator() {
    if (detailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return detailNavigator;
    }

    detailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.sectionEl && elements.sectionEl.hidden === false),
      getSequenceState: getMonthSequenceState,
      getPrevButton: (elements) => elements?.detailPrevEl,
      getNextButton: (elements) => elements?.detailNextEl,
      getPositionEl: (elements) => elements?.detailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          const suffix = state.searchQuery ? " shown" : "";
          return `${currentIndex + 1} of ${total}${suffix}`;
        }

        return total > 0 ? `${total} months` : "No months";
      },
      selectTarget: (targetId, elements) => selectByMonthId(targetId, elements) !== false,
      afterSelect: (targetId, elements) => {
        scrollMonthIntoView(targetId, elements);
      }
    });

    return detailNavigator;
  }

  function syncDetailNavigation(elements = getElements()) {
    getDetailNavigator()?.sync(elements);
  }

  function scrollMonthIntoView(monthId, elements = getElements()) {
    elements?.monthListEl
      ?.querySelector(`[data-month-id="${monthId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function selectAdjacentMonth(offset, elements = getElements()) {
    return getDetailNavigator()?.step(offset, elements) === true;
  }

  function bindKeyboardNavigation(elements) {
    getDetailNavigator()?.bind(elements);
  }

  function applySearchFilter(elements) {
    state.filteredMonths = state.searchQuery
      ? state.months.filter((month) => matchesSearch(buildMonthSearchText(month)))
      : [...state.months];

    if (!state.filteredMonths.some((month) => month.id === state.selectedMonthId)) {
      state.selectedMonthId = state.filteredMonths[0]?.id || null;
    }

    syncSearchControls(elements);
    renderList(elements);
    renderDetail(elements);
  }

  function selectByMonthId(monthId, elements = getElements()) {
    const target = state.months.find((month) => month.id === monthId);
    if (!target) {
      return false;
    }

    if (state.searchQuery && !state.filteredMonths.some((month) => month.id === target.id)) {
      state.searchQuery = "";
      state.filteredMonths = [...state.months];
    }

    if (state.selectedMonthId !== target.id) {
      clearSelectedDayFilter();
    }

    state.selectedMonthId = target.id;
    syncSearchControls(elements);
    renderList(elements);
    renderDetail(elements);
    return true;
  }

  function selectCalendarType(calendarId, elements = getElements()) {
    if (!state.calendarData || !Array.isArray(state.calendarData[calendarId])) {
      return false;
    }

    if (elements.calendarTypeEl) {
      elements.calendarTypeEl.value = calendarId;
    }

    loadCalendarType(calendarId, elements);
    return true;
  }

  function bindYearInput(elements) {
    if (!elements.yearInputEl) {
      return;
    }

    elements.yearInputEl.value = String(state.selectedYear);
    elements.yearInputEl.addEventListener("change", () => {
      const nextYear = Number(elements.yearInputEl.value);
      if (!Number.isFinite(nextYear)) {
        elements.yearInputEl.value = String(state.selectedYear);
        return;
      }

      state.selectedYear = Math.min(2500, Math.max(1900, Math.round(nextYear)));
      elements.yearInputEl.value = String(state.selectedYear);
      state.dayLinksCache = new Map();
      clearSelectedDayFilter();
      renderDetail(elements);
    });
  }

  function bindSearchInput(elements) {
    if (elements.searchInputEl) {
      elements.searchInputEl.addEventListener("input", () => {
        state.searchQuery = normalizeSearchValue(elements.searchInputEl.value);
        applySearchFilter(elements);
      });
    }

    if (elements.searchClearEl && elements.searchInputEl) {
      elements.searchClearEl.addEventListener("click", () => {
        state.searchQuery = "";
        elements.searchInputEl.value = "";
        applySearchFilter(elements);
        elements.searchInputEl.focus();
      });
    }
  }

  function bindDetailNavigation(elements) {
    getDetailNavigator()?.bind(elements);
  }

  function loadCalendarType(calendarId, elements) {
    const months = state.calendarData[calendarId];
    if (!Array.isArray(months)) {
      return;
    }

    state.selectedCalendar = calendarId;
    state.dayLinksCache = new Map();
    clearSelectedDayFilter();
    state.months = sortMonths(months);
    state.filteredMonths = [...state.months];
    state.selectedMonthId = state.months[0]?.id || null;
    state.searchQuery = "";

    if (elements.calendarYearWrapEl) {
      elements.calendarYearWrapEl.hidden = false;
    }

    syncSearchControls(elements);
    applySearchFilter(elements);
  }

  function bindCalendarTypeSelect(elements) {
    if (!elements.calendarTypeEl) {
      return;
    }

    elements.calendarTypeEl.value = state.selectedCalendar;
    elements.calendarTypeEl.addEventListener("change", () => {
      loadCalendarType(String(elements.calendarTypeEl.value || "gregorian"), elements);
    });
  }

  function ensureCalendarSection(referenceData, magickDataset) {
    if (!referenceData) {
      return;
    }

    calendarDatesUi.init?.({
      getSelectedYear: () => state.selectedYear,
      getSelectedCalendar: () => state.selectedCalendar,
      getIslamicMonths: () => state.calendarData?.islamic || []
    });

    calendarDetailUi.init?.({
      getState: () => state,
      getElements,
      getSelectedMonth,
      getSelectedDayFilterContext,
      clearSelectedDayFilter,
      toggleDayFilterEntry,
      toggleDayRangeFilter,
      getMonthSubtitle,
      getMonthDayLinkRows,
      buildDecanTarotRowsForMonth,
      buildHolidayList,
      matchesSearch,
      eventSearchText,
      holidaySearchText,
      getDisplayTarotName,
      cap,
      formatGregorianReferenceDate,
      getDaysInMonth,
      getMonthStartWeekday,
      getGregorianMonthStartDate,
      formatCalendarDateFromGregorian,
      parseMonthDayToken,
      parseMonthDayTokensFromText,
      parseMonthDayStartToken,
      parseDayRangeFromText,
      parseMonthRange,
      formatIsoDate,
      resolveHolidayGregorianDate,
      isMonthDayInRange,
      intersectDateRanges,
      getGregorianReferenceDateForCalendarMonth,
      normalizeCalendarText,
      findGodIdByName
    });

    state.referenceData = referenceData;
    state.magickDataset = magickDataset || null;
    state.dayLinksCache = new Map();
    clearSelectedDayFilter();
    state.holidays = Array.isArray(referenceData.celestialHolidays) ? referenceData.celestialHolidays : [];
    state.calendarHolidays = Array.isArray(referenceData.calendarHolidays) ? referenceData.calendarHolidays : [];
    state.planetsById = buildPlanetMap(referenceData.planets);
    state.signsById = buildSignsMap(referenceData.signs);
    state.godsById = buildGodsMap(state.magickDataset);
    state.hebrewById = buildHebrewMap(state.magickDataset);

    state.calendarData = {
      gregorian: Array.isArray(referenceData.calendarMonths) ? referenceData.calendarMonths : [],
      hebrew: Array.isArray(referenceData.hebrewCalendar?.months) ? referenceData.hebrewCalendar.months : [],
      islamic: Array.isArray(referenceData.islamicCalendar?.months) ? referenceData.islamicCalendar.months : [],
      "wheel-of-year": Array.isArray(referenceData.wheelOfYear?.months) ? referenceData.wheelOfYear.months : []
    };

    const currentCalMonths = state.calendarData[state.selectedCalendar] || state.calendarData.gregorian || [];
    state.months = sortMonths(currentCalMonths);
    state.filteredMonths = [...state.months];

    const elements = getElements();
    if (elements.calendarYearWrapEl) {
      elements.calendarYearWrapEl.hidden = false;
    }

    if (!state.months.length) {
      if (elements.detailNameEl) {
        elements.detailNameEl.textContent = "Calendar";
      }
      if (elements.detailSubEl) {
        elements.detailSubEl.textContent = "No month data available.";
      }
      if (elements.detailBodyEl) {
        elements.detailBodyEl.innerHTML = "";
      }
      if (elements.monthListEl) {
        elements.monthListEl.innerHTML = "";
      }
      return;
    }

    if (!state.selectedMonthId || !state.months.some((month) => month.id === state.selectedMonthId)) {
      state.selectedMonthId = state.months[0].id;
    }

    if (!state.initialized) {
      state.initialized = true;
      bindYearInput(elements);
      bindSearchInput(elements);
      bindCalendarTypeSelect(elements);
      bindDetailNavigation(elements);
      bindKeyboardNavigation(elements);
    }

    applySearchFilter(elements);
  }

  window.CalendarSectionUi = {
    ensureCalendarSection,
    selectByMonthId,
    selectCalendarType
  };
})();
