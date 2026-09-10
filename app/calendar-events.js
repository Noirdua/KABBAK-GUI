(function () {
  const dataService = window.TarotDataService || {};
  const { toTitleCase } = window.TarotCalc || {};

  function toDate(value) {
    if (value instanceof Date) {
      return value;
    }
    if (!value) {
      return value;
    }
    return new Date(value);
  }

  function expandCompactEvent(event, referenceData) {
    if (!event || typeof event !== "object") {
      return event;
    }

    const planets = referenceData?.planets || {};
    const signs = Array.isArray(referenceData?.signs) ? referenceData.signs : [];
    const decansBySign = referenceData?.decansBySign || {};
    const kind = String(event.kind || "").trim();

    if (!kind) {
      // Backward-compatible full events from older API builds.
      return {
        ...event,
        start: toDate(event.start),
        end: toDate(event.end)
      };
    }

    if (kind === "moon") {
      const moonTarot = planets.luna?.tarot?.majorArcana || "The High Priestess";
      const moonPhase = event.moonPhase || "Moon";
      const pct = Number.isFinite(Number(event.moonIlluminationPct))
        ? Number(event.moonIlluminationPct)
        : 0;
      return {
        id: event.id,
        calendarId: event.calendarId || "astrology",
        category: event.category || "allday",
        title: `Moon: ${moonPhase} (${pct}%) · ${moonTarot}`,
        start: toDate(event.start),
        end: toDate(event.end),
        isReadOnly: event.isReadOnly !== false
      };
    }

    if (kind === "sun") {
      const sign = signs.find((entry) => entry?.id === event.signId) || null;
      if (!sign) {
        return null;
      }

      const rulerPlanet = planets[sign.rulingPlanetId] || null;
      const bodyParts = [
        `${sign.symbol || ""} ${toTitleCase?.(sign.element) || sign.element || ""} ${toTitleCase?.(sign.modality) || sign.modality || ""}`.trim(),
        rulerPlanet
          ? `Sign ruler: ${rulerPlanet.symbol} ${rulerPlanet.name}`
          : `Sign ruler: ${sign.rulingPlanetId || "--"}`
      ];

      const decanList = Array.isArray(decansBySign?.[sign.id]) ? decansBySign[sign.id] : [];
      const decan = decanList.find((entry) => Number(entry?.index) === Number(event.decanIndex)) || null;
      if (decan) {
        const decanRuler = planets[decan.rulerPlanetId] || null;
        bodyParts.unshift(
          decanRuler
            ? `Decan ${decan.index}: ${decan.tarotMinorArcana} (${decanRuler.symbol} ${decanRuler.name})`
            : `Decan ${decan.index}: ${decan.tarotMinorArcana || ""}`
        );
      }

      return {
        id: event.id,
        calendarId: event.calendarId || "astrology",
        category: event.category || "allday",
        title: `Sun in ${sign.name} · ${sign.tarot?.majorArcana || ""}`.trim(),
        body: bodyParts.join("\n"),
        start: toDate(event.start),
        end: toDate(event.end),
        isReadOnly: event.isReadOnly !== false
      };
    }

    if (kind === "planetaryHour") {
      const planet = planets[event.planetId] || null;
      if (!planet) {
        return null;
      }

      return {
        id: event.id,
        calendarId: event.calendarId || "planetary",
        category: event.category || "time",
        title: `${planet.symbol} ${planet.name} · ${planet.tarot?.majorArcana || ""}`.trim(),
        body: `${planet.weekday || ""} current · ${event.isDaylight ? "Day" : "Night"} hour\n${planet.magickTypes || ""}`.trim(),
        raw: {
          planetSymbol: planet.symbol,
          planetName: planet.name,
          tarotName: planet.tarot?.majorArcana || ""
        },
        start: toDate(event.start),
        end: toDate(event.end),
        isReadOnly: event.isReadOnly !== false
      };
    }

    return {
      ...event,
      start: toDate(event.start),
      end: toDate(event.end)
    };
  }

  async function buildWeekEvents(geo, referenceData, anchorDate) {
    const payload = await dataService.fetchWeekEvents?.(geo, anchorDate);
    const events = Array.isArray(payload?.events)
      ? payload.events
      : (Array.isArray(payload) ? payload : []);

    return events
      .map((event) => expandCompactEvent(event, referenceData))
      .filter(Boolean);
  }

  window.TarotEventBuilder = {
    buildWeekEvents
  };
})();
