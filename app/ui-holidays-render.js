/* ui-holidays-render.js - Render/search helpers for the holiday repository */
(function () {
  "use strict";

  const { html, raw } = window.HtmlSafe;

  function planetLabel(planetId, context) {
    const { state, cap } = context;
    if (!planetId) {
      return "Planet";
    }

    const planet = state.planetsById.get(planetId);
    if (!planet) {
      return cap(planetId);
    }

    return `${planet.symbol || ""} ${planet.name || cap(planetId)}`.trim();
  }

  function zodiacLabel(signId, context) {
    const { state, cap } = context;
    if (!signId) {
      return "Zodiac";
    }

    const sign = state.signsById.get(signId);
    if (!sign) {
      return cap(signId);
    }

    return `${sign.symbol || ""} ${sign.name || cap(signId)}`.trim();
  }

  function godLabel(godId, godName, context) {
    const { state, cap } = context;
    if (godName) {
      return godName;
    }

    if (!godId) {
      return "Deity";
    }

    const god = state.godsById.get(godId);
    return god?.name || cap(godId);
  }

  function hebrewLabel(hebrewLetterId, context) {
    const { state, cap } = context;
    if (!hebrewLetterId) {
      return "Hebrew Letter";
    }

    const letter = state.hebrewById.get(hebrewLetterId);
    if (!letter) {
      return cap(hebrewLetterId);
    }

    return `${letter.char || ""} ${letter.name || cap(hebrewLetterId)}`.trim();
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

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function buildInlineNavButton(label, nav, attrs = {}) {
    const dataAttrs = raw(Object.entries(attrs)
      .map(([key, value]) => html`data-${key}="${value}"`)
      .join(" "));
    return html`<button class="detail-inline-link" data-nav="${nav}" ${dataAttrs}>${label}</button>`;
  }

  function buildAssociationButtons(associations, context) {
    const { getDisplayTarotName, resolveTarotTrumpNumber } = context;
    if (!associations || typeof associations !== "object") {
      return raw('<div class="body-text">--</div>');
    }

    const rows = [];

    if (associations.planetId) {
      rows.push(html`<div class="body-text detail-inline-value">Planet ${buildInlineNavButton(planetLabel(associations.planetId, context), "planet", { "planet-id": associations.planetId })}</div>`);
    }

    if (associations.zodiacSignId) {
      rows.push(html`<div class="body-text detail-inline-value">Zodiac ${buildInlineNavButton(zodiacLabel(associations.zodiacSignId, context), "zodiac", { "sign-id": associations.zodiacSignId })}</div>`);
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
      const trumpNumber = resolveTarotTrumpNumber(associations.tarotCard);
      const explicitTrumpNumber = Number(associations.tarotTrumpNumber);
      const tarotTrumpNumber = Number.isFinite(explicitTrumpNumber) ? explicitTrumpNumber : trumpNumber;
      const tarotLabel = getDisplayTarotName(associations.tarotCard, tarotTrumpNumber);
      rows.push(html`<div class="body-text detail-inline-value">Tarot ${buildInlineNavButton(tarotLabel, "tarot-card", { "card-name": associations.tarotCard, "trump-number": tarotTrumpNumber ?? "" })}</div>`);
    }

    if (associations.godId || associations.godName) {
      const label = godLabel(associations.godId, associations.godName, context);
      rows.push(html`<div class="body-text detail-inline-value">Deity ${buildInlineNavButton(label, "god", { "god-id": associations.godId || "", "god-name": associations.godName || label })}</div>`);
    }

    if (associations.hebrewLetterId) {
      rows.push(html`<div class="body-text detail-inline-value">Hebrew ${buildInlineNavButton(hebrewLabel(associations.hebrewLetterId, context), "alphabet", { alphabet: "hebrew", "hebrew-letter-id": associations.hebrewLetterId })}</div>`);
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

  function associationSearchText(associations, context) {
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

  function holidaySearchText(holiday, context) {
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
      associationSearchText(holiday?.associations, context)
    ];

    if (typeof window.TarotSearchText?.buildSearchText === "function") {
      return window.TarotSearchText.buildSearchText(parts);
    }

    return normalizeSearchValue(parts.filter(Boolean).join(" "));
  }

  function renderList(context) {
    const {
      elements,
      state,
      filterBySource,
      normalizeSourceFilter,
      calendarLabel,
      monthLabelForCalendar,
      selectByHolidayId
    } = context;
    const { listEl, countEl } = elements;
    if (!listEl) {
      return;
    }

    listEl.innerHTML = "";

    state.filteredHolidays.forEach((holiday) => {
      const isSelected = holiday.id === state.selectedHolidayId;
      const itemEl = document.createElement("div");
      itemEl.className = `list-item${isSelected ? " is-selected" : ""}`;
      itemEl.setAttribute("role", "option");
      itemEl.setAttribute("aria-selected", isSelected ? "true" : "false");
      itemEl.dataset.holidayId = holiday.id;

      const sourceCalendar = calendarLabel(holiday.calendarId);
      const sourceMonth = monthLabelForCalendar(holiday.calendarId, holiday.monthId);
      const sourceDate = holiday?.dateText || holiday?.date || holiday?.dateRange || "--";

      itemEl.innerHTML = html`
        <div class="list-name">${holiday?.name || holiday?.id || "Holiday"}</div>
        <div class="list-meta">${sourceCalendar} - ${sourceMonth} - ${sourceDate}</div>
      `;

      itemEl.addEventListener("click", () => {
        selectByHolidayId(holiday.id, elements);
      });

      listEl.appendChild(itemEl);
    });

    if (countEl) {
      const sourceFiltered = filterBySource(state.holidays);
      const activeFilter = normalizeSourceFilter(state.selectedSource);
      const sourceLabel = activeFilter === "all"
        ? ""
        : ` (${calendarLabel(activeFilter)})`;
      countEl.textContent = state.searchQuery
        ? `${state.filteredHolidays.length} of ${sourceFiltered.length} holidays${sourceLabel}`
        : `${sourceFiltered.length} holidays${sourceLabel}`;
    }
  }

  function renderHolidayDetail(holiday, context) {
    const {
      state,
      calendarLabel,
      monthLabelForCalendar,
      resolveHolidayGregorianDate,
      formatGregorianReferenceDate,
      formatCalendarDateFromGregorian
    } = context;
    const gregorianDate = resolveHolidayGregorianDate(holiday);
    const gregorianRef = formatGregorianReferenceDate(gregorianDate);
    const hebrewRef = formatCalendarDateFromGregorian(gregorianDate, "hebrew");
    const islamicRef = formatCalendarDateFromGregorian(gregorianDate, "islamic");
    const confidence = String(holiday?.conversionConfidence || holiday?.datePrecision || "approximate").toLowerCase();
    const confidenceLabel = (!(gregorianDate instanceof Date) || Number.isNaN(gregorianDate.getTime()))
      ? "unresolved"
      : (confidence === "exact" ? "exact" : "approximate");
    const monthName = monthLabelForCalendar(holiday?.calendarId, holiday?.monthId);
    const holidayDate = holiday?.dateText || holiday?.date || holiday?.dateRange || "--";
    const sourceMonthValue = holiday?.monthId
      ? buildInlineNavButton(monthName, "calendar-month", { "calendar-id": holiday.calendarId || "", "month-id": holiday.monthId })
      : monthName;

    return html`
      <div class="meta-grid">
        <div class="meta-card">
          <strong>Holiday Facts</strong>
          <div class="body-text">
            <dl class="alpha-dl">
              <dt>Source Calendar</dt><dd>${calendarLabel(holiday?.calendarId)}</dd>
              <dt>Source Month</dt><dd>${sourceMonthValue}</dd>
              <dt>Source Date</dt><dd>${holidayDate}</dd>
              <dt>Reference Year</dt><dd>${state.selectedYear}</dd>
              <dt>Conversion</dt><dd>${confidenceLabel}</dd>
            </dl>
          </div>
        </div>
        <div class="meta-card">
          <strong>Cross-Calendar Dates</strong>
          <div class="body-text">
            <dl class="alpha-dl">
              <dt>Gregorian</dt><dd>${gregorianRef}</dd>
              <dt>Hebrew</dt><dd>${hebrewRef}</dd>
              <dt>Islamic</dt><dd>${islamicRef}</dd>
            </dl>
          </div>
        </div>
        <div class="meta-card">
          <strong>Description</strong>
          <div class="body-text">${holiday?.description || "--"}</div>
        </div>
        <div class="meta-card">
          <strong>Associations</strong>
          ${buildAssociationButtons(holiday?.associations, context)}
        </div>
      </div>
    `;
  }

  window.HolidayRenderUi = {
    holidaySearchText,
    renderList,
    renderHolidayDetail
  };
})();