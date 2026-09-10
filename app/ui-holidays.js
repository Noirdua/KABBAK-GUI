/* ui-holidays.js - Standalone holiday repository browser */
(function () {
  "use strict";

  const { getTarotCardDisplayName, getTarotCardSearchAliases } = window.TarotCardImages || {};
  const holidayDataUi = window.HolidayDataUi || {};
  const holidayRenderUi = window.HolidayRenderUi || {};

  if (
    typeof holidayDataUi.buildAllHolidays !== "function"
    || typeof holidayDataUi.buildCalendarData !== "function"
    || typeof holidayDataUi.buildGodsMap !== "function"
    || typeof holidayDataUi.buildHebrewMap !== "function"
    || typeof holidayDataUi.buildPlanetMap !== "function"
    || typeof holidayDataUi.buildSignsMap !== "function"
    || typeof holidayDataUi.calendarLabel !== "function"
    || typeof holidayDataUi.formatCalendarDateFromGregorian !== "function"
    || typeof holidayDataUi.formatGregorianReferenceDate !== "function"
    || typeof holidayDataUi.monthLabelForCalendar !== "function"
    || typeof holidayDataUi.normalizeSourceFilter !== "function"
    || typeof holidayDataUi.resolveHolidayGregorianDate !== "function"
    || typeof holidayRenderUi.holidaySearchText !== "function"
    || typeof holidayRenderUi.renderList !== "function"
    || typeof holidayRenderUi.renderHolidayDetail !== "function"
  ) {
    throw new Error("HolidayDataUi and HolidayRenderUi modules must load before ui-holidays.js");
  }

  const state = {
    initialized: false,
    referenceData: null,
    magickDataset: null,
    selectedYear: new Date().getFullYear(),
    selectedSource: "all",
    searchQuery: "",
    holidays: [],
    filteredHolidays: [],
    selectedHolidayId: null,
    planetsById: new Map(),
    signsById: new Map(),
    godsById: new Map(),
    hebrewById: new Map(),
    calendarData: {}
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

  function getElements() {
    return {
      sectionEl: document.getElementById("holiday-section"),
      sourceSelectEl: document.getElementById("holiday-source-select"),
      yearInputEl: document.getElementById("holiday-year-input"),
      searchInputEl: document.getElementById("holiday-search-input"),
      searchClearEl: document.getElementById("holiday-search-clear"),
      countEl: document.getElementById("holiday-count"),
      listEl: document.getElementById("holiday-list"),
      detailNameEl: document.getElementById("holiday-detail-name"),
      detailSubEl: document.getElementById("holiday-detail-sub"),
      detailPrevEl: document.getElementById("holiday-detail-prev"),
      detailPositionEl: document.getElementById("holiday-detail-position"),
      detailNextEl: document.getElementById("holiday-detail-next"),
      detailBodyEl: document.getElementById("holiday-detail-body")
    };
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeSearchValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function cap(value) {
    const text = normalizeText(value);
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function normalizeTarotName(value) {
    return String(value || "")
      .trim()
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

  function getRenderContext(elements = getElements()) {
    return {
      elements,
      state,
      cap,
      normalizeSearchValue,
      getDisplayTarotName,
      resolveTarotTrumpNumber,
      getTarotCardSearchAliases,
      calendarLabel: holidayDataUi.calendarLabel,
      monthLabelForCalendar: (calendarId, monthId) => holidayDataUi.monthLabelForCalendar(state.calendarData, calendarId, monthId),
      normalizeSourceFilter: holidayDataUi.normalizeSourceFilter,
      filterBySource,
      resolveHolidayGregorianDate: (holiday) => holidayDataUi.resolveHolidayGregorianDate(holiday, {
        selectedYear: state.selectedYear,
        calendarData: state.calendarData
      }),
      formatGregorianReferenceDate: holidayDataUi.formatGregorianReferenceDate,
      formatCalendarDateFromGregorian: holidayDataUi.formatCalendarDateFromGregorian,
      selectByHolidayId
    };
  }

  function getSelectedHoliday() {
    return state.holidays.find((holiday) => holiday.id === state.selectedHolidayId) || null;
  }

  function filterBySource(holidays) {
    const source = holidayDataUi.normalizeSourceFilter(state.selectedSource);
    if (source === "all") {
      return [...holidays];
    }
    return holidays.filter((holiday) => String(holiday?.calendarId || "").trim().toLowerCase() === source);
  }

  function syncControls(elements) {
    if (elements.sourceSelectEl) {
      elements.sourceSelectEl.value = holidayDataUi.normalizeSourceFilter(state.selectedSource);
    }
    if (elements.yearInputEl) {
      elements.yearInputEl.value = String(state.selectedYear);
    }
    if (elements.searchInputEl) {
      elements.searchInputEl.value = state.searchQuery;
    }
    if (elements.searchClearEl) {
      elements.searchClearEl.disabled = !state.searchQuery;
    }
  }

  function renderList(elements) {
    holidayRenderUi.renderList(getRenderContext(elements));
  }

  function renderHolidayDetail(holiday) {
    return holidayRenderUi.renderHolidayDetail(holiday, getRenderContext());
  }

  function renderDetail(elements) {
    const { detailNameEl, detailSubEl, detailBodyEl } = elements;
    if (!detailNameEl || !detailSubEl || !detailBodyEl) {
      return;
    }

    const holiday = getSelectedHoliday();
    if (!holiday) {
      detailNameEl.textContent = "--";
      detailSubEl.textContent = "Select a holiday to explore";
      detailBodyEl.innerHTML = "";
      syncDetailNavigation(elements);
      return;
    }

    detailNameEl.textContent = holiday?.name || holiday?.id || "Holiday";
    detailSubEl.textContent = `${holidayDataUi.calendarLabel(holiday?.calendarId)} - ${holidayDataUi.monthLabelForCalendar(state.calendarData, holiday?.calendarId, holiday?.monthId)}`;
    detailBodyEl.innerHTML = renderHolidayDetail(holiday);
    attachNavHandlers(detailBodyEl);
    syncDetailNavigation(elements);
  }

  function getHolidaySequenceState() {
    const total = state.filteredHolidays.length;
    const currentIndex = state.filteredHolidays.findIndex((holiday) => holiday.id === state.selectedHolidayId);

    return {
      total,
      currentIndex,
      previousId: currentIndex > 0 ? state.filteredHolidays[currentIndex - 1].id : "",
      nextId: currentIndex >= 0 && currentIndex < total - 1 ? state.filteredHolidays[currentIndex + 1].id : ""
    };
  }

  function getDetailNavigator() {
    if (detailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return detailNavigator;
    }

    detailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.sectionEl && elements.sectionEl.hidden === false),
      getSequenceState: getHolidaySequenceState,
      getPrevButton: (elements) => elements?.detailPrevEl,
      getNextButton: (elements) => elements?.detailNextEl,
      getPositionEl: (elements) => elements?.detailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          const suffix = state.searchQuery ? " shown" : "";
          return `${currentIndex + 1} of ${total}${suffix}`;
        }

        return total > 0 ? `${total} holidays` : "No holidays";
      },
      selectTarget: (targetId, elements) => selectByHolidayId(targetId, elements) !== false,
      afterSelect: (targetId, elements) => {
        scrollHolidayIntoView(targetId, elements);
      }
    });

    return detailNavigator;
  }

  function syncDetailNavigation(elements = getElements()) {
    getDetailNavigator()?.sync(elements);
  }

  function scrollHolidayIntoView(holidayId, elements = getElements()) {
    elements?.listEl
      ?.querySelector(`[data-holiday-id="${holidayId}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function selectAdjacentHoliday(offset, elements = getElements()) {
    return getDetailNavigator()?.step(offset, elements) === true;
  }

  function bindKeyboardNavigation(elements) {
    getDetailNavigator()?.bind(elements);
  }

  function applyFilters(elements) {
    const sourceFiltered = filterBySource(state.holidays);
    state.filteredHolidays = state.searchQuery
      ? sourceFiltered.filter((holiday) => holidayRenderUi.holidaySearchText(holiday, getRenderContext()).includes(state.searchQuery))
      : sourceFiltered;

    if (!state.filteredHolidays.some((holiday) => holiday.id === state.selectedHolidayId)) {
      state.selectedHolidayId = state.filteredHolidays[0]?.id || null;
    }

    syncControls(elements);
    renderList(elements);
    renderDetail(elements);
  }

  function selectByHolidayId(holidayId, elements = getElements()) {
    const target = state.holidays.find((holiday) => holiday.id === holidayId);
    if (!target) {
      return false;
    }

    const targetCalendar = String(target.calendarId || "").trim().toLowerCase();
    const activeFilter = holidayDataUi.normalizeSourceFilter(state.selectedSource);
    if (activeFilter !== "all" && activeFilter !== targetCalendar) {
      state.selectedSource = targetCalendar || "all";
    }

    if (state.searchQuery && !holidayRenderUi.holidaySearchText(target, getRenderContext()).includes(state.searchQuery)) {
      state.searchQuery = "";
    }

    state.selectedHolidayId = target.id;
    applyFilters(elements);
    return true;
  }

  function bindControls(elements) {
    if (elements.sourceSelectEl) {
      elements.sourceSelectEl.addEventListener("change", () => {
        state.selectedSource = holidayDataUi.normalizeSourceFilter(elements.sourceSelectEl.value);
        applyFilters(elements);
      });
    }

    if (elements.yearInputEl) {
      elements.yearInputEl.addEventListener("change", () => {
        const nextYear = Number(elements.yearInputEl.value);
        if (!Number.isFinite(nextYear)) {
          elements.yearInputEl.value = String(state.selectedYear);
          return;
        }

        state.selectedYear = Math.min(2500, Math.max(1900, Math.round(nextYear)));
        elements.yearInputEl.value = String(state.selectedYear);
        renderDetail(elements);
      });
    }

    if (elements.searchInputEl) {
      elements.searchInputEl.addEventListener("input", () => {
        state.searchQuery = normalizeSearchValue(elements.searchInputEl.value);
        applyFilters(elements);
      });
    }

    if (elements.searchClearEl && elements.searchInputEl) {
      elements.searchClearEl.addEventListener("click", () => {
        state.searchQuery = "";
        elements.searchInputEl.value = "";
        applyFilters(elements);
        elements.searchInputEl.focus();
      });
    }

    bindKeyboardNavigation(elements);
  }

  function attachNavHandlers(detailBodyEl) {
    if (!detailBodyEl) {
      return;
    }

    detailBodyEl.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const navType = button.dataset.nav;

        if (navType === "planet" && button.dataset.planetId) {
          document.dispatchEvent(new CustomEvent("nav:planet", {
            detail: { planetId: button.dataset.planetId }
          }));
          return;
        }

        if (navType === "zodiac" && button.dataset.signId) {
          document.dispatchEvent(new CustomEvent("nav:zodiac", {
            detail: { signId: button.dataset.signId }
          }));
          return;
        }

        if (navType === "number" && button.dataset.numberValue) {
          document.dispatchEvent(new CustomEvent("nav:number", {
            detail: { value: Number(button.dataset.numberValue) }
          }));
          return;
        }

        if (navType === "tarot-card" && button.dataset.cardName) {
          const trumpNumber = Number(button.dataset.trumpNumber);
          document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
            detail: {
              cardName: button.dataset.cardName,
              trumpNumber: Number.isFinite(trumpNumber) ? trumpNumber : undefined
            }
          }));
          return;
        }

        if (navType === "god") {
          document.dispatchEvent(new CustomEvent("nav:gods", {
            detail: {
              godId: button.dataset.godId || undefined,
              godName: button.dataset.godName || undefined
            }
          }));
          return;
        }

        if (navType === "alphabet" && button.dataset.hebrewLetterId) {
          document.dispatchEvent(new CustomEvent("nav:alphabet", {
            detail: {
              alphabet: "hebrew",
              hebrewLetterId: button.dataset.hebrewLetterId
            }
          }));
          return;
        }

        if (navType === "kabbalah" && button.dataset.pathNo) {
          document.dispatchEvent(new CustomEvent("nav:kabbalah-path", {
            detail: { pathNo: Number(button.dataset.pathNo) }
          }));
          return;
        }

        if (navType === "iching" && button.dataset.planetaryInfluence) {
          document.dispatchEvent(new CustomEvent("nav:iching", {
            detail: {
              planetaryInfluence: button.dataset.planetaryInfluence
            }
          }));
          return;
        }

        if (navType === "calendar-month" && button.dataset.monthId) {
          document.dispatchEvent(new CustomEvent("nav:calendar-month", {
            detail: {
              calendarId: button.dataset.calendarId || undefined,
              monthId: button.dataset.monthId
            }
          }));
        }
      });
    });
  }

  function ensureHolidaySection(referenceData, magickDataset) {
    if (!referenceData) {
      return;
    }

    state.referenceData = referenceData;
    state.magickDataset = magickDataset || null;
    state.planetsById = holidayDataUi.buildPlanetMap(referenceData.planets);
    state.signsById = holidayDataUi.buildSignsMap(referenceData.signs);
    state.godsById = holidayDataUi.buildGodsMap(state.magickDataset);
    state.hebrewById = holidayDataUi.buildHebrewMap(state.magickDataset);

    state.calendarData = holidayDataUi.buildCalendarData(referenceData);
    state.holidays = holidayDataUi.buildAllHolidays(state.referenceData);
    if (!state.selectedHolidayId || !state.holidays.some((holiday) => holiday.id === state.selectedHolidayId)) {
      state.selectedHolidayId = state.holidays[0]?.id || null;
    }

    const elements = getElements();

    if (!state.initialized) {
      state.initialized = true;
      bindControls(elements);
    }

    applyFilters(elements);
  }

  window.HolidaySectionUi = {
    ensureHolidaySection,
    selectByHolidayId
  };
})();
