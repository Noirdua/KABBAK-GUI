(function () {
  "use strict";

  const { html, raw } = window.HtmlSafe;

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function findSignIdByAstrologyName(name, context) {
    const { api, getState } = context;
    const token = api.normalizeCalendarText(name);
    if (!token) {
      return null;
    }

    for (const [signId, sign] of getState().signsById || []) {
      const idToken = api.normalizeCalendarText(signId);
      const nameToken = api.normalizeCalendarText(sign?.name?.en || sign?.name || "");
      if (token === idToken || token === nameToken) {
        return signId;
      }
    }

    return null;
  }

  function inlineNavButton(label, nav, attrs = {}, extraClass = "") {
    const dataAttrs = raw(Object.entries(attrs)
      .map(([key, value]) => html`data-${key}="${value}"`)
      .join(" "));
    const className = ["detail-inline-link", extraClass].filter(Boolean).join(" ");
    return html`<button class="${className}" data-nav="${nav}" ${dataAttrs}>${label}</button>`;
  }

  function buildSignInlineButton(signId, signName, signSymbol) {
    if (!signId) {
      return `${signSymbol ? `${signSymbol} ` : ""}${signName || "--"}`.trim();
    }

    const label = `${signSymbol ? `${signSymbol} ` : ""}${signName || signId}`.trim();
    return inlineNavButton(label, "zodiac", { "sign-id": signId });
  }

  function buildHebrewInlineButton(hebrewLetterId, label) {
    if (!hebrewLetterId) {
      return label || "--";
    }

    return inlineNavButton(label || hebrewLetterId, "alphabet", {
      alphabet: "hebrew",
      "hebrew-letter-id": hebrewLetterId
    });
  }

  function buildMajorArcanaRowsForMonth(context) {
    const { month, api, getState } = context;
    const currentState = getState();
    if (currentState.selectedCalendar !== "gregorian") {
      return [];
    }

    const monthOrder = Number(month?.order);
    if (!Number.isFinite(monthOrder)) {
      return [];
    }

    const monthStart = new Date(currentState.selectedYear, monthOrder - 1, 1, 12, 0, 0, 0);
    const monthEnd = new Date(currentState.selectedYear, monthOrder, 0, 12, 0, 0, 0);
    const rows = [];

    currentState.hebrewById?.forEach((letter) => {
      const astrologyType = api.normalizeCalendarText(letter?.astrology?.type);
      if (astrologyType !== "zodiac") {
        return;
      }

      const signId = findSignIdByAstrologyName(letter?.astrology?.name, context);
      const sign = signId ? currentState.signsById?.get(signId) : null;
      if (!sign) {
        return;
      }

      const startToken = api.parseMonthDayToken(sign?.start);
      const endToken = api.parseMonthDayToken(sign?.end);
      if (!startToken || !endToken) {
        return;
      }

      const spanStart = new Date(currentState.selectedYear, startToken.month - 1, startToken.day, 12, 0, 0, 0);
      const spanEnd = new Date(currentState.selectedYear, endToken.month - 1, endToken.day, 12, 0, 0, 0);
      const wraps = spanEnd.getTime() < spanStart.getTime();

      const segments = wraps
        ? [
            {
              start: spanStart,
              end: new Date(currentState.selectedYear, 11, 31, 12, 0, 0, 0)
            },
            {
              start: new Date(currentState.selectedYear, 0, 1, 12, 0, 0, 0),
              end: spanEnd
            }
          ]
        : [{ start: spanStart, end: spanEnd }];

      segments.forEach((segment) => {
        const overlap = api.intersectDateRanges(segment.start, segment.end, monthStart, monthEnd);
        if (!overlap) {
          return;
        }

        const rangeStartDay = overlap.start.getDate();
        const rangeEndDay = overlap.end.getDate();
        const cardName = String(letter?.tarot?.card || "").trim();
        const trumpNumber = Number(letter?.tarot?.trumpNumber);
        if (!cardName) {
          return;
        }

        rows.push({
          id: `${signId}-${rangeStartDay}-${rangeEndDay}`,
          signId,
          signName: sign?.name?.en || sign?.name || signId,
          signSymbol: sign?.symbol || "",
          cardName,
          trumpNumber: Number.isFinite(trumpNumber) ? Math.trunc(trumpNumber) : null,
          hebrewLetterId: String(letter?.hebrewLetterId || "").trim(),
          hebrewLetterName: String(letter?.name || "").trim(),
          hebrewLetterChar: String(letter?.char || "").trim(),
          dayStart: rangeStartDay,
          dayEnd: rangeEndDay,
          rangeLabel: `${month?.name || "Month"} ${rangeStartDay}-${rangeEndDay}`
        });
      });
    });

    rows.sort((left, right) => {
      if (left.dayStart !== right.dayStart) {
        return left.dayStart - right.dayStart;
      }
      return left.cardName.localeCompare(right.cardName);
    });

    return rows;
  }

  function renderMajorArcanaCard(context) {
    if (!hasTarotAccess()) {
      return "";
    }

    const { month, api } = context;
    const selectedDay = api.getSelectedDayFilterContext(month);
    const allRows = buildMajorArcanaRowsForMonth(context);

    const rows = selectedDay
      ? allRows.filter((row) => selectedDay.entries.some((entry) => entry.dayNumber >= row.dayStart && entry.dayNumber <= row.dayEnd))
      : allRows;

    if (!rows.length) {
      return `
        <div class="meta-card">
          <strong>Major Arcana Windows</strong>
          <div class="body-text">No major arcana windows for this month.</div>
        </div>
      `;
    }

    const list = raw(rows.map((row) => {
      const label = row.hebrewLetterId
        ? `${row.hebrewLetterChar ? `${row.hebrewLetterChar} ` : ""}${row.hebrewLetterName || row.hebrewLetterId}`
        : "--";
      const displayCardName = api.getDisplayTarotName(row.cardName, row.trumpNumber);
      const signLabel = buildSignInlineButton(row.signId, row.signName, row.signSymbol);
      const hebrewLabel = buildHebrewInlineButton(row.hebrewLetterId, label);

      return html`
        <div class="cal-item-row">
          <div class="cal-item-head">
            <span class="cal-item-name">${displayCardName}${row.trumpNumber != null ? ` · Trump ${row.trumpNumber}` : ""}</span>
            <span class="list-meta">${row.rangeLabel}</span>
          </div>
          <div class="list-meta">${signLabel} · Hebrew: ${hebrewLabel}</div>
          <div class="body-text detail-inline-value">
            Days ${inlineNavButton(row.rangeLabel, "calendar-day-range", { "range-start": row.dayStart, "range-end": row.dayEnd })}
            · Tarot ${inlineNavButton(displayCardName, "tarot-card", { "card-name": row.cardName, "trump-number": row.trumpNumber ?? "" })}
            ${row.hebrewLetterId ? html` · Hebrew ${hebrewLabel}` : ""}
            ${row.signId ? html` · Zodiac ${signLabel}` : ""}
          </div>
        </div>
      `;
    }).join(""));

    return html`
      <div class="meta-card">
        <strong>Major Arcana Windows</strong>
        <div class="cal-item-stack">${list}</div>
      </div>
    `;
  }

  function renderDecanTarotCard(context) {
    if (!hasTarotAccess()) {
      return "";
    }

    const { month, api } = context;
    const selectedDay = api.getSelectedDayFilterContext(month);
    const allRows = api.buildDecanTarotRowsForMonth(month);
    const rows = selectedDay
      ? allRows.filter((row) => selectedDay.entries.some((entry) => {
          const targetDate = entry.gregorianDate;
          if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) {
            return false;
          }

          const targetMonth = targetDate.getMonth() + 1;
          const targetDayNo = targetDate.getDate();
          return api.isMonthDayInRange(
            targetMonth,
            targetDayNo,
            row.startMonth,
            row.startDay,
            row.endMonth,
            row.endDay
          );
        }))
      : allRows;

    if (!rows.length) {
      return `
        <div class="meta-card">
          <strong>Decan Tarot Windows</strong>
          <div class="body-text">No decan tarot windows for this month.</div>
        </div>
      `;
    }

    const list = raw(rows.map((row) => {
      const displayCardName = api.getDisplayTarotName(row.cardName);
      const signLabel = buildSignInlineButton(row.signId, row.signName, row.signSymbol);
      return html`
      <div class="cal-item-row">
        <div class="cal-item-head">
          <span class="cal-item-name">${signLabel} · Decan ${row.decanIndex}</span>
          <span class="list-meta">${row.degreeRangeLabel || `${row.startDegree}°–${row.endDegree}°`} · ${row.dateRange}</span>
        </div>
        <div class="body-text detail-inline-value">Tarot ${inlineNavButton(displayCardName, "tarot-card", { "card-name": row.cardName })} · Zodiac ${signLabel}</div>
      </div>
    `;
    }).join(""));

    return html`
      <div class="meta-card">
        <strong>Decan Tarot Windows</strong>
        <div class="cal-item-stack">${list}</div>
      </div>
    `;
  }

  function renderDayLinksCard(context) {
    const { month, api } = context;
    const rows = api.getMonthDayLinkRows(month);
    if (!rows.length) {
      return "";
    }

    const selectedContext = api.getSelectedDayFilterContext(month);
    const selectedDaySet = selectedContext?.dayNumbers || new Set();
    const selectedDays = selectedContext?.entries?.map((entry) => entry.dayNumber) || [];
    const selectedSummary = selectedDays.length ? selectedDays.join(", ") : "";

    const links = raw(rows.map((row) => {
      if (!row.isResolved) {
        return html`<span class="list-meta">${row.day}</span>`;
      }

      const isSelected = selectedDaySet.has(Number(row.day));
      return raw(String(inlineNavButton(String(row.day), "calendar-day", {
        "day-number": row.day,
        "gregorian-date": row.gregorianDate,
        "aria-pressed": isSelected ? "true" : "false"
      }, isSelected ? "is-selected" : "")).replace("data-aria-pressed", "aria-pressed"));
    }).join(""));

    const clearButton = selectedContext
      ? inlineNavButton("Show All Days", "calendar-day-clear")
      : "";

    const helperText = selectedContext
      ? html`<div class="list-meta">Filtered to days: ${selectedSummary}</div>`
      : "";

    return html`
      <div class="meta-card">
        <strong>Day Links</strong>
        <div class="body-text">Filter this month to events, holidays, and data connected to a specific day.</div>
        ${helperText}
        <div class="body-text detail-inline-value">Days ${links}</div>
        ${clearButton ? html`<div class="body-text detail-inline-value">${clearButton}</div>` : ""}
      </div>
    `;
  }

  function renderGregorianMonthDetail(context) {
    const {
      renderFactsCard,
      renderAssociationsCard,
      renderEventsCard,
      renderHolidaysCard,
      month
    } = context;

    return html`
      <div class="meta-grid">
        ${renderFactsCard(month)}
        ${renderDayLinksCard(context)}
        ${renderAssociationsCard(month)}
        ${renderMajorArcanaCard(context)}
        ${renderDecanTarotCard(context)}
        ${renderEventsCard(month)}
        ${renderHolidaysCard(month, "Holiday Repository")}
      </div>
    `;
  }

  function renderHebrewMonthDetail(context) {
    const { month, api, getState, buildAssociationButtons, renderHolidaysCard } = context;
    const currentState = getState();
    const gregorianStartDate = api.getGregorianReferenceDateForCalendarMonth(month);
    const zodiacSignId = month?.associations?.zodiacSignId || findSignIdByAstrologyName(month?.zodiacSign, context);
    const zodiacLabel = buildSignInlineButton(zodiacSignId, api.cap(month.zodiacSign) || "--", "");
    const hebrewLetterId = month?.associations?.hebrewLetterId || String(month?.hebrewLetterId || "").trim();
    const hebrewLabel = buildHebrewInlineButton(hebrewLetterId, month.hebrewLetter || "--");
    const factsRows = raw([
      ["Hebrew Name", month.nativeName || "--"],
      ["Month Order", month.leapYearOnly ? `${month.order} (leap year only)` : String(month.order)],
      ["Gregorian Reference Year", String(currentState.selectedYear)],
      ["Month Start (Gregorian)", api.formatGregorianReferenceDate(gregorianStartDate)],
      ["Days", month.daysVariant ? `${month.days}–${month.daysVariant} (varies)` : String(month.days || "--")],
      ["Season", month.season || "--"],
      ["Zodiac Sign", zodiacLabel],
      ["Tribe of Israel", month.tribe || "--"],
      ["Sense", month.sense || "--"],
      ["Hebrew Letter", hebrewLabel]
    ].map(([dt, dd]) => html`<dt>${dt}</dt><dd>${dd}</dd>`).join(""));

    const monthOrder = Number(month?.order);
    const navButtons = buildAssociationButtons({
      ...(month?.associations || {}),
      ...(Number.isFinite(monthOrder) ? { numberValue: Math.trunc(monthOrder) } : {})
    });
    const connectionsCard = navButtons
      ? html`<div class="meta-card"><strong>Connections</strong>${navButtons}</div>`
      : "";

    return html`
      <div class="meta-grid">
        <div class="meta-card">
          <strong>Month Facts</strong>
          <div class="body-text">
            <dl class="alpha-dl">${factsRows}</dl>
          </div>
        </div>
        ${connectionsCard}
        <div class="meta-card">
          <strong>About ${month.name}</strong>
          <div class="body-text">${month.description || "--"}</div>
        </div>
        ${renderDayLinksCard(context)}
        ${renderHolidaysCard(month, "Holiday Repository")}
      </div>
    `;
  }

  function renderIslamicMonthDetail(context) {
    const { month, api, getState, buildAssociationButtons, renderHolidaysCard } = context;
    const currentState = getState();
    const gregorianStartDate = api.getGregorianReferenceDateForCalendarMonth(month);
    const factsRows = raw([
      ["Arabic Name", month.nativeName || "--"],
      ["Month Order", String(month.order)],
      ["Gregorian Reference Year", String(currentState.selectedYear)],
      ["Month Start (Gregorian)", api.formatGregorianReferenceDate(gregorianStartDate)],
      ["Meaning", month.meaning || "--"],
      ["Days", month.daysVariant ? `${month.days}–${month.daysVariant} (varies)` : String(month.days || "--")],
      ["Sacred Month", month.sacred ? "Yes - warfare prohibited" : "No"]
    ].map(([dt, dd]) => html`<dt>${dt}</dt><dd>${dd}</dd>`).join(""));

    const monthOrder = Number(month?.order);
    const hasNumberLink = Number.isFinite(monthOrder) && monthOrder >= 0;
    const navButtons = hasNumberLink
      ? buildAssociationButtons({ numberValue: Math.trunc(monthOrder) })
      : "";
    const connectionsCard = hasNumberLink
      ? html`<div class="meta-card"><strong>Connections</strong>${navButtons}</div>`
      : "";

    return html`
      <div class="meta-grid">
        <div class="meta-card">
          <strong>Month Facts</strong>
          <div class="body-text">
            <dl class="alpha-dl">${factsRows}</dl>
          </div>
        </div>
        ${connectionsCard}
        <div class="meta-card">
          <strong>About ${month.name}</strong>
          <div class="body-text">${month.description || "--"}</div>
        </div>
        ${renderDayLinksCard(context)}
        ${renderHolidaysCard(month, "Holiday Repository")}
      </div>
    `;
  }

  function buildWheelDeityButtons(deities, context) {
    const { api, getState } = context;
    const buttons = [];
    (Array.isArray(deities) ? deities : []).forEach((rawName) => {
      const cleanName = String(rawName || "").replace(/\s*\/.*$/, "").replace(/\s*\(.*\)$/, "").trim();
      const godId = api.findGodIdByName(cleanName) || api.findGodIdByName(rawName);
      if (!godId) {
        return;
      }

      const god = getState().godsById?.get(godId);
      const label = god?.name || cleanName;
      buttons.push(inlineNavButton(label, "god", { "god-id": godId, "god-name": label }));
    });
    return buttons;
  }

  function renderWheelMonthDetail(context) {
    const { month, api, getState, buildAssociationButtons, renderHolidaysCard } = context;
    const currentState = getState();
    const gregorianStartDate = api.getGregorianReferenceDateForCalendarMonth(month);
    const assoc = month?.associations;
    const themes = Array.isArray(assoc?.themes) ? assoc.themes.join(", ") : "--";
    const deities = Array.isArray(assoc?.deities) ? assoc.deities.join(", ") : "--";
    const colors = Array.isArray(assoc?.colors) ? assoc.colors.join(", ") : "--";
    const herbs = Array.isArray(assoc?.herbs) ? assoc.herbs.join(", ") : "--";

    const factsRows = raw([
      ["Date", month.date || "--"],
      ["Type", api.cap(month.type) || "--"],
      ["Gregorian Reference Year", String(currentState.selectedYear)],
      ["Start (Gregorian)", api.formatGregorianReferenceDate(gregorianStartDate)],
      ["Season", month.season || "--"],
      ["Element", api.cap(month.element) || "--"],
      ["Direction", assoc?.direction || "--"]
    ].map(([dt, dd]) => html`<dt>${dt}</dt><dd>${dd}</dd>`).join(""));

    const assocRows = raw([
      ["Themes", themes],
      ["Deities", deities],
      ["Colors", colors],
      ["Herbs", herbs]
    ].map(([dt, dd]) => html`<dt>${dt}</dt><dd class="body-text">${dd}</dd>`).join(""));

    const deityButtons = buildWheelDeityButtons(assoc?.deities, context);
    const deityLinksCard = deityButtons.length
      ? html`<div class="meta-card"><strong>Linked Deities</strong><div class="body-text detail-inline-value">${raw(deityButtons.join(", "))}</div></div>`
      : "";

    const monthOrder = Number(month?.order);
    const hasNumberLink = Number.isFinite(monthOrder) && monthOrder >= 0;
    const numberButtons = hasNumberLink
      ? buildAssociationButtons({ numberValue: Math.trunc(monthOrder) })
      : "";
    const numberLinksCard = hasNumberLink
      ? html`<div class="meta-card"><strong>Connections</strong>${numberButtons}</div>`
      : "";

    return html`
      <div class="meta-grid">
        <div class="meta-card">
          <strong>Sabbat Facts</strong>
          <div class="body-text">
            <dl class="alpha-dl">${factsRows}</dl>
          </div>
        </div>
        <div class="meta-card">
          <strong>About ${month.name}</strong>
          <div class="body-text">${month.description || "--"}</div>
        </div>
        <div class="meta-card">
          <strong>Associations</strong>
          <div class="body-text">
            <dl class="alpha-dl">${assocRows}</dl>
          </div>
        </div>
        ${renderDayLinksCard(context)}
        ${numberLinksCard}
        ${deityLinksCard}
        ${renderHolidaysCard(month, "Holiday Repository")}
      </div>
    `;
  }

  window.CalendarDetailPanelsUi = {
    renderGregorianMonthDetail,
    renderHebrewMonthDetail,
    renderIslamicMonthDetail,
    renderWheelMonthDetail
  };
})();