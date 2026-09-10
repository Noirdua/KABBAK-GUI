(function () {
  const DAY_IN_MS = 24 * 60 * 60 * 1000;

  let referenceDataCache = null;
  let natalSummaryEl = null;

  function getNatalSummaryEl() {
    if (!natalSummaryEl) {
      natalSummaryEl = document.getElementById("natal-chart-summary")
        || document.getElementById("now-natal-summary");
    }
    return natalSummaryEl;
  }

  function parseMonthDay(monthDay) {
    const [month, day] = String(monthDay || "").split("-").map(Number);
    if (!Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    return { month, day };
  }

  function parseBirthDateAsLocalNoon(isoDate) {
    const [year, month, day] = String(isoDate || "").split("-").map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function isDateInSign(date, sign) {
    const start = parseMonthDay(sign?.start);
    const end = parseMonthDay(sign?.end);
    if (!start || !end) {
      return false;
    }

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const wrapsYear = start.month > end.month;

    if (!wrapsYear) {
      const afterStart = month > start.month || (month === start.month && day >= start.day);
      const beforeEnd = month < end.month || (month === end.month && day <= end.day);
      return afterStart && beforeEnd;
    }

    const afterStart = month > start.month || (month === start.month && day >= start.day);
    const beforeEnd = month < end.month || (month === end.month && day <= end.day);
    return afterStart || beforeEnd;
  }

  function getSignStartDate(date, sign) {
    const start = parseMonthDay(sign?.start);
    const end = parseMonthDay(sign?.end);
    if (!start || !end) {
      return null;
    }

    const wrapsYear = start.month > end.month;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    let year = date.getFullYear();

    if (wrapsYear && (month < start.month || (month === start.month && day < start.day))) {
      year -= 1;
    }

    return new Date(year, start.month - 1, start.day, 12, 0, 0, 0);
  }

  function getSunSignAnchor(referenceData, birthDate) {
    const signs = Array.isArray(referenceData?.signs) ? referenceData.signs : [];
    if (!signs.length || !birthDate) {
      return null;
    }

    const sign = signs.find((candidate) => isDateInSign(birthDate, candidate)) || null;
    if (!sign) {
      return null;
    }

    return {
      id: sign.id,
      name: sign.name,
      symbol: sign.symbol || "",
      tarotMajorArcana: sign?.tarot?.majorArcana || ""
    };
  }

  function getSunDecanAnchor(referenceData, signId, birthDate) {
    if (!signId || !birthDate) {
      return null;
    }

    const sign = (referenceData?.signs || []).find((entry) => entry.id === signId) || null;
    if (!sign) {
      return null;
    }

    const signStartDate = getSignStartDate(birthDate, sign);
    if (!signStartDate) {
      return null;
    }

    const daysSinceSignStart = Math.max(0, Math.floor((birthDate.getTime() - signStartDate.getTime()) / DAY_IN_MS));
    const decanIndex = Math.max(1, Math.min(3, Math.floor(daysSinceSignStart / 10) + 1));

    const decans = referenceData?.decansBySign?.[signId] || [];
    const decan = decans.find((entry) => Number(entry.index) === decanIndex) || null;

    return {
      index: decanIndex,
      tarotMinorArcana: decan?.tarotMinorArcana || ""
    };
  }

  function buildNatalScaffoldSummary() {
    const context = window.TarotNatal?.getContext?.() || null;
    if (!context) {
      return "Natal Chart Scaffold: unavailable";
    }

    const birthDate = context.birthDateParts?.isoDate
      ? parseBirthDateAsLocalNoon(context.birthDateParts.isoDate)
      : null;

    if (!birthDate) {
      return [
        "Natal Chart Scaffold",
        "Birth Date: --",
        `Geo Anchor: ${context.latitude.toFixed(4)}, ${context.longitude.toFixed(4)}`,
        "Sun Sign Anchor: --",
        "Sun Decan Anchor: --",
        "House Scaffold: 12 houses ready (Equal House placeholder), Ascendant/cusps pending birth time"
      ].join("\n");
    }

    const sunSign = getSunSignAnchor(referenceDataCache, birthDate);
    const sunDecan = getSunDecanAnchor(referenceDataCache, sunSign?.id, birthDate);

    const signLabel = sunSign
      ? `${sunSign.symbol} ${sunSign.name}${sunSign.tarotMajorArcana ? ` · ${sunSign.tarotMajorArcana}` : ""}`
      : "--";

    const decanLabel = sunDecan
      ? `Decan ${sunDecan.index}${sunDecan.tarotMinorArcana ? ` · ${sunDecan.tarotMinorArcana}` : ""}`
      : "--";

    return [
      "Natal Chart Scaffold",
      `Birth Date: ${context.birthDateParts.isoDate} (${context.timeZone})`,
      `Geo Anchor: ${context.latitude.toFixed(4)}, ${context.longitude.toFixed(4)}`,
      `Sun Sign Anchor: ${signLabel}`,
      `Sun Decan Anchor: ${decanLabel}`,
      "House Scaffold: 12 houses ready (Equal House placeholder), Ascendant/cusps pending birth time"
    ].join("\n");
  }

  function renderNatalSummary() {
    const outputEl = getNatalSummaryEl();
    if (!outputEl) {
      return;
    }

    outputEl.textContent = buildNatalScaffoldSummary();
  }

  function ensureNatalPanel(referenceData) {
    if (referenceData && typeof referenceData === "object") {
      referenceDataCache = referenceData;
    }

    renderNatalSummary();
  }

  document.addEventListener("settings:updated", () => {
    renderNatalSummary();
  });

  window.TarotNatalUi = {
    ensureNatalPanel,
    renderNatalSummary
  };
})();
