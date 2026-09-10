(function () {
  "use strict";

  const { html, raw } = window.HtmlSafe;

  const api = {
    getState: () => ({}),
    getElements: () => ({}),
    getSelectedMonth: () => null,
    getSelectedDayFilterContext: () => null,
    clearSelectedDayFilter: () => {},
    toggleDayFilterEntry: () => {},
    toggleDayRangeFilter: () => {},
    getMonthSubtitle: () => "",
    getMonthDayLinkRows: () => [],
    buildDecanTarotRowsForMonth: () => [],
    buildHolidayList: () => [],
    matchesSearch: () => true,
    eventSearchText: () => "",
    holidaySearchText: () => "",
    getDisplayTarotName: (cardName) => cardName || "",
    cap: (value) => String(value || "").trim(),
    formatGregorianReferenceDate: () => "--",
    getDaysInMonth: () => null,
    getMonthStartWeekday: () => "--",
    getGregorianMonthStartDate: () => null,
    formatCalendarDateFromGregorian: () => "--",
    parseMonthDayToken: () => null,
    parseMonthDayTokensFromText: () => [],
    parseMonthDayStartToken: () => null,
    parseDayRangeFromText: () => null,
    parseMonthRange: () => "",
    formatIsoDate: () => "",
    resolveHolidayGregorianDate: () => null,
    isMonthDayInRange: () => false,
    intersectDateRanges: () => null,
    getGregorianReferenceDateForCalendarMonth: () => null,
    normalizeCalendarText: (value) => String(value || "").trim().toLowerCase(),
    findGodIdByName: () => null
  };

  const calendarDetailPanelsUi = window.CalendarDetailPanelsUi || {};

  if (
    typeof calendarDetailPanelsUi.renderGregorianMonthDetail !== "function"
    || typeof calendarDetailPanelsUi.renderHebrewMonthDetail !== "function"
    || typeof calendarDetailPanelsUi.renderIslamicMonthDetail !== "function"
    || typeof calendarDetailPanelsUi.renderWheelMonthDetail !== "function"
  ) {
    throw new Error("CalendarDetailPanelsUi module must load before ui-calendar-detail.js");
  }

  function init(config) {
    Object.assign(api, config || {});
  }

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function getState() {
    return api.getState?.() || {};
  }

  function planetLabel(planetId) {
    if (!planetId) {
      return "Planet";
    }

    const planet = getState().planetsById?.get(planetId);
    if (!planet) {
      return api.cap(planetId);
    }

    return `${planet.symbol || ""} ${planet.name || api.cap(planetId)}`.trim();
  }

  function zodiacLabel(signId) {
    if (!signId) {
      return "Zodiac";
    }

    const sign = getState().signsById?.get(signId);
    if (!sign) {
      return api.cap(signId);
    }

    return `${sign.symbol || ""} ${sign.name || api.cap(signId)}`.trim();
  }

  function godLabel(godId, godName) {
    if (godName) {
      return godName;
    }

    if (!godId) {
      return "Deity";
    }

    const god = getState().godsById?.get(godId);
    return god?.name || api.cap(godId);
  }

  function hebrewLabel(hebrewLetterId) {
    if (!hebrewLetterId) {
      return "Hebrew Letter";
    }

    const letter = getState().hebrewById?.get(hebrewLetterId);
    if (!letter) {
      return api.cap(hebrewLetterId);
    }

    return `${letter.char || ""} ${letter.name || api.cap(hebrewLetterId)}`.trim();
  }

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

  function buildInlineNavButton(label, nav, attrs = {}) {
    const dataAttrs = raw(Object.entries(attrs)
      .map(([key, value]) => html`data-${key}="${value}"`)
      .join(" "));
    return html`<button class="detail-inline-link" data-nav="${nav}" ${dataAttrs}>${label}</button>`;
  }

  function buildAssociationButtons(associations) {
    if (!associations || typeof associations !== "object") {
      return raw('<div class="body-text">--</div>');
    }

    const rows = [];

    if (associations.planetId) {
      rows.push(html`<div class="body-text detail-inline-value">Planet ${buildInlineNavButton(planetLabel(associations.planetId), "planet", { "planet-id": associations.planetId })}</div>`);
    }

    if (associations.zodiacSignId) {
      rows.push(html`<div class="body-text detail-inline-value">Zodiac ${buildInlineNavButton(zodiacLabel(associations.zodiacSignId), "zodiac", { "sign-id": associations.zodiacSignId })}</div>`);
    }

    if (Number.isFinite(Number(associations.numberValue))) {
      const rawNumber = Math.trunc(Number(associations.numberValue));
      if (rawNumber >= 0) {
        const numberValue = computeDigitalRoot(rawNumber);
        if (numberValue != null) {
          const label = rawNumber === numberValue
            ? `Number ${numberValue}`
            : `Number ${numberValue} (from ${rawNumber})`;
          rows.push(html`<div class="body-text detail-inline-value">Number ${buildInlineNavButton(label, "number", { "number-value": numberValue })}</div>`);
        }
      }
    }

    if (associations.tarotCard && hasTarotAccess()) {
      const explicitTrumpNumber = Number(associations.tarotTrumpNumber);
      const tarotTrumpNumber = Number.isFinite(explicitTrumpNumber) ? explicitTrumpNumber : null;
      const tarotLabel = api.getDisplayTarotName(associations.tarotCard, tarotTrumpNumber);
      rows.push(html`<div class="body-text detail-inline-value">Tarot ${buildInlineNavButton(tarotLabel, "tarot-card", { "card-name": associations.tarotCard, "trump-number": tarotTrumpNumber ?? "" })}</div>`);
    }

    if (associations.godId || associations.godName) {
      const label = godLabel(associations.godId, associations.godName);
      rows.push(html`<div class="body-text detail-inline-value">Deity ${buildInlineNavButton(label, "god", { "god-id": associations.godId || "", "god-name": associations.godName || label })}</div>`);
    }

    if (associations.hebrewLetterId) {
      rows.push(html`<div class="body-text detail-inline-value">Hebrew ${buildInlineNavButton(hebrewLabel(associations.hebrewLetterId), "alphabet", { alphabet: "hebrew", "hebrew-letter-id": associations.hebrewLetterId })}</div>`);
    }

    if (associations.kabbalahPathNumber != null) {
      rows.push(html`<div class="body-text detail-inline-value">Kabbalah ${buildInlineNavButton(`Path ${associations.kabbalahPathNumber}`, "kabbalah", { "path-no": associations.kabbalahPathNumber })}</div>`);
    }

    if (associations.iChingPlanetaryInfluence) {
      rows.push(html`<div class="body-text detail-inline-value">I Ching ${buildInlineNavButton(associations.iChingPlanetaryInfluence, "iching", { "planetary-influence": associations.iChingPlanetaryInfluence })}</div>`);
    }

    if (!rows.length) {
      return raw('<div class="body-text">--</div>');
    }

    return raw(rows.join(""));
  }

  function renderFactsCard(month) {
    const currentState = getState();
    const monthOrder = Number(month?.order);
    const daysInMonth = api.getDaysInMonth(currentState.selectedYear, monthOrder);
    const hoursInMonth = Number.isFinite(daysInMonth) ? daysInMonth * 24 : null;
    const firstWeekday = Number.isFinite(monthOrder)
      ? api.getMonthStartWeekday(currentState.selectedYear, monthOrder)
      : "--";
    const gregorianStartDate = api.getGregorianMonthStartDate(monthOrder);
    const hebrewStartReference = api.formatCalendarDateFromGregorian(gregorianStartDate, "hebrew");
    const islamicStartReference = api.formatCalendarDateFromGregorian(gregorianStartDate, "islamic");

    return html`
      <div class="meta-card">
        <strong>Month Facts</strong>
        <div class="body-text">
          <dl class="alpha-dl">
            <dt>Year</dt><dd>${currentState.selectedYear}</dd>
            <dt>Start Date (Gregorian)</dt><dd>${api.formatGregorianReferenceDate(gregorianStartDate)}</dd>
            <dt>Days</dt><dd>${daysInMonth ?? "--"}</dd>
            <dt>Hours</dt><dd>${hoursInMonth ?? "--"}</dd>
            <dt>Starts On</dt><dd>${firstWeekday}</dd>
            <dt>Hebrew On 1st</dt><dd>${hebrewStartReference}</dd>
            <dt>Islamic On 1st</dt><dd>${islamicStartReference}</dd>
            <dt>North Season</dt><dd>${month.seasonNorth || "--"}</dd>
            <dt>South Season</dt><dd>${month.seasonSouth || "--"}</dd>
          </dl>
        </div>
      </div>
    `;
  }

  function renderAssociationsCard(month) {
    const monthOrder = Number(month?.order);
    const associations = {
      ...(month?.associations || {}),
      ...(Number.isFinite(monthOrder) ? { numberValue: Math.trunc(monthOrder) } : {})
    };

    return html`
      <div class="meta-card">
        <strong>Associations</strong>
        <div class="body-text">${month.coreTheme || "--"}</div>
        ${buildAssociationButtons(associations)}
      </div>
    `;
  }

  function renderEventsCard(month) {
    const currentState = getState();
    const allEvents = Array.isArray(month?.events) ? month.events : [];
    if (!allEvents.length) {
      return `
        <div class="meta-card">
          <strong>Monthly Events</strong>
          <div class="body-text">No monthly events listed.</div>
        </div>
      `;
    }

    const selectedDay = api.getSelectedDayFilterContext(month);

    function eventMatchesDay(event) {
      if (!selectedDay) {
        return true;
      }

      return selectedDay.entries.some((entry) => {
        const targetDate = entry.gregorianDate;
        const targetMonth = targetDate?.getMonth() + 1;
        const targetDayNo = targetDate?.getDate();

        const explicitDate = api.parseMonthDayToken(event?.date);
        if (explicitDate && Number.isFinite(targetMonth) && Number.isFinite(targetDayNo)) {
          return explicitDate.month === targetMonth && explicitDate.day === targetDayNo;
        }

        const rangeTokens = api.parseMonthDayTokensFromText(event?.dateRange || event?.dateText || "");
        if (rangeTokens.length >= 2 && Number.isFinite(targetMonth) && Number.isFinite(targetDayNo)) {
          const start = rangeTokens[0];
          const end = rangeTokens[1];
          return api.isMonthDayInRange(targetMonth, targetDayNo, start.month, start.day, end.month, end.day);
        }

        const dayRange = api.parseDayRangeFromText(event?.date || event?.dateRange || event?.dateText || "");
        if (dayRange) {
          return entry.dayNumber >= dayRange.startDay && entry.dayNumber <= dayRange.endDay;
        }

        return false;
      });
    }

    const dayFiltered = allEvents.filter((event) => eventMatchesDay(event));
    const events = currentState.searchQuery
      ? dayFiltered.filter((event) => api.matchesSearch(api.eventSearchText(event)))
      : dayFiltered;

    if (!events.length) {
      return `
        <div class="meta-card">
          <strong>Monthly Events</strong>
          <div class="body-text">No monthly events match current search.</div>
        </div>
      `;
    }

    const rows = raw(events.map((event) => {
      const dateText = event?.date || event?.dateRange || "--";
      return html`
        <div class="cal-item-row">
          <div class="cal-item-head">
            <span class="cal-item-name">${event?.name || "Untitled"}</span>
            <span class="list-meta">${dateText}</span>
          </div>
          <div class="body-text">${event?.description || ""}</div>
          ${buildAssociationButtons(event?.associations)}
        </div>
      `;
    }).join(""));

    return html`
      <div class="meta-card">
        <strong>Monthly Events</strong>
        <div class="cal-item-stack">${rows}</div>
      </div>
    `;
  }

  function renderHolidaysCard(month, title = "Holiday Repository") {
    const currentState = getState();
    const allHolidays = api.buildHolidayList(month);
    if (!allHolidays.length) {
      return html`
        <div class="meta-card">
          <strong>${title}</strong>
          <div class="body-text">No holidays listed in the repository for this month.</div>
        </div>
      `;
    }

    const selectedDay = api.getSelectedDayFilterContext(month);

    function holidayMatchesDay(holiday) {
      if (!selectedDay) {
        return true;
      }

      return selectedDay.entries.some((entry) => {
        const targetDate = entry.gregorianDate;
        const targetMonth = targetDate?.getMonth() + 1;
        const targetDayNo = targetDate?.getDate();

        const exactResolved = api.resolveHolidayGregorianDate(holiday);
        if (exactResolved instanceof Date && !Number.isNaN(exactResolved.getTime()) && targetDate instanceof Date) {
          return api.formatIsoDate(exactResolved) === api.formatIsoDate(targetDate);
        }

        if (currentState.selectedCalendar === "gregorian" && Number.isFinite(targetMonth) && Number.isFinite(targetDayNo)) {
          const tokens = api.parseMonthDayTokensFromText(holiday?.dateText || holiday?.dateRange || "");
          if (tokens.length >= 2) {
            const start = tokens[0];
            const end = tokens[1];
            return api.isMonthDayInRange(targetMonth, targetDayNo, start.month, start.day, end.month, end.day);
          }

          if (tokens.length === 1) {
            const single = tokens[0];
            return single.month === targetMonth && single.day === targetDayNo;
          }

          const direct = api.parseMonthDayStartToken(holiday?.monthDayStart || holiday?.dateText || "");
          if (direct) {
            return direct.month === targetMonth && direct.day === targetDayNo;
          }

          if (Number.isFinite(Number(holiday?.day))) {
            return Number(holiday.day) === entry.dayNumber;
          }
        }

        const localRange = api.parseDayRangeFromText(holiday?.dateText || holiday?.dateRange || "");
        if (localRange) {
          return entry.dayNumber >= localRange.startDay && entry.dayNumber <= localRange.endDay;
        }

        return false;
      });
    }

    const dayFiltered = allHolidays.filter((holiday) => holidayMatchesDay(holiday));
    const holidays = currentState.searchQuery
      ? dayFiltered.filter((holiday) => api.matchesSearch(api.holidaySearchText(holiday)))
      : dayFiltered;

    if (!holidays.length) {
      return html`
        <div class="meta-card">
          <strong>${title}</strong>
          <div class="body-text">No holidays match current filters.</div>
        </div>
      `;
    }

    const rows = raw(holidays.map((holiday) => {
      const dateText = holiday?.dateText || holiday?.dateRange || holiday?.date || "--";
      return html`
        <div class="cal-item-row">
          <div class="cal-item-head">
            <span class="cal-item-name">${holiday?.name || "Untitled"}</span>
            <span class="list-meta">${dateText}</span>
          </div>
          <div class="body-text">${holiday?.description || holiday?.kind || ""}</div>
          ${buildAssociationButtons(holiday?.associations)}
        </div>
      `;
    }).join(""));

    return html`
      <div class="meta-card">
        <strong>${title}</strong>
        <div class="cal-item-stack">${rows}</div>
      </div>
    `;
  }

  function getPanelRenderContext(month) {
    return {
      month,
      api,
      getState,
      buildAssociationButtons,
      renderFactsCard,
      renderAssociationsCard,
      renderEventsCard,
      renderHolidaysCard
    };
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
          return;
        }

        if (navType === "calendar-day" && button.dataset.dayNumber) {
          const month = api.getSelectedMonth();
          const dayNumber = Number(button.dataset.dayNumber);
          if (!month || !Number.isFinite(dayNumber)) {
            return;
          }

          api.toggleDayFilterEntry(month, dayNumber, button.dataset.gregorianDate);
          renderDetail(api.getElements());
          return;
        }

        if (navType === "calendar-day-range" && button.dataset.rangeStart && button.dataset.rangeEnd) {
          const month = api.getSelectedMonth();
          if (!month) {
            return;
          }

          api.toggleDayRangeFilter(month, Number(button.dataset.rangeStart), Number(button.dataset.rangeEnd));
          renderDetail(api.getElements());
          return;
        }

        if (navType === "calendar-day-clear") {
          api.clearSelectedDayFilter();
          renderDetail(api.getElements());
        }
      });
    });
  }

  function renderDetail(elements) {
    const { detailNameEl, detailSubEl, detailBodyEl } = elements || {};
    if (!detailBodyEl || !detailNameEl || !detailSubEl) {
      return;
    }

    const month = api.getSelectedMonth();
    if (!month) {
      detailNameEl.textContent = "--";
      detailSubEl.textContent = "Select a month to explore";
      detailBodyEl.innerHTML = "";
      return;
    }

    detailNameEl.textContent = month.name || month.id;

    const currentState = getState();
    const panelContext = getPanelRenderContext(month);
    if (currentState.selectedCalendar === "gregorian") {
      detailSubEl.textContent = `${api.parseMonthRange(month)} · ${month.coreTheme || "Month correspondences"}`;
      detailBodyEl.innerHTML = calendarDetailPanelsUi.renderGregorianMonthDetail(panelContext);
    } else if (currentState.selectedCalendar === "hebrew") {
      detailSubEl.textContent = api.getMonthSubtitle(month);
      detailBodyEl.innerHTML = calendarDetailPanelsUi.renderHebrewMonthDetail(panelContext);
    } else if (currentState.selectedCalendar === "islamic") {
      detailSubEl.textContent = api.getMonthSubtitle(month);
      detailBodyEl.innerHTML = calendarDetailPanelsUi.renderIslamicMonthDetail(panelContext);
    } else {
      detailSubEl.textContent = api.getMonthSubtitle(month);
      detailBodyEl.innerHTML = calendarDetailPanelsUi.renderWheelMonthDetail(panelContext);
    }

    attachNavHandlers(detailBodyEl);
  }

  window.TarotCalendarDetail = {
    init,
    renderDetail,
    attachNavHandlers
  };
})();