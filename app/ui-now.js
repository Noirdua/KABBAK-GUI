(function () {
  "use strict";

  const dataService = window.TarotDataService || {};

  const {
    DAY_IN_MS,
    getDateKey,
    getDecanForDate,
    getMoonPhaseName,
    calcPlanetaryHoursForDayAndLocation
  } = window.TarotCalc;
  const nowUiHelpers = window.NowUiHelpers || {};

  if (
    typeof nowUiHelpers.findNextDecanTransition !== "function"
    || typeof nowUiHelpers.findNextMoonPhaseTransition !== "function"
    || typeof nowUiHelpers.formatCountdown !== "function"
    || typeof nowUiHelpers.getSignStartDate !== "function"
    || typeof nowUiHelpers.getDisplayTarotName !== "function"
    || typeof nowUiHelpers.setNowCardImage !== "function"
    || typeof nowUiHelpers.renderNowPlanetPositions !== "function"
    || typeof nowUiHelpers.updateNowStats !== "function"
  ) {
    throw new Error("NowUiHelpers module must load before ui-now.js");
  }
  
  let moonCountdownCache = null;
  let decanCountdownCache = null;
  let latestSnapshot = null;
  let latestElements = null;
  let latestTimeFormat = "minutes";
  let countdownTickerId = null;
  let lastRenderedSkyKey = "";

  function joinSabianPhrases(phrases) {
    const parts = (Array.isArray(phrases) ? phrases : [])
      .map((phrase) => String(phrase || "").trim())
      .filter(Boolean);

    if (!parts.length) {
      return "--";
    }

    return parts.join(" ");
  }

  function renderNowStatsFromSnapshot(elements, stats) {
    if (elements.nowStatsPlanetsEl) {
      nowUiHelpers.renderNowPlanetPositions(
        elements.nowStatsPlanetsEl,
        Array.isArray(stats?.planetPositions) ? stats.planetPositions : []
      );
    }

    if (elements.nowStatsSabianEl) {
      const sunSabianSymbol = stats?.sunSabianSymbol || null;
      const moonSabianSymbol = stats?.moonSabianSymbol || null;
      elements.nowStatsSabianEl.textContent = joinSabianPhrases([
        moonSabianSymbol?.phrase,
        sunSabianSymbol?.phrase
      ]);
    }
  }

  function setNowTarotVisibility(imageEl, labelEl, visible) {
    if (imageEl) {
      imageEl.hidden = !visible;
    }

    if (labelEl) {
      labelEl.hidden = !visible;
    }
  }

  function parseDeadlineMs(value) {
    if (value instanceof Date) {
      const ms = value.getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getRemainingMs(deadlineMs, fallbackMs) {
    if (Number.isFinite(deadlineMs)) {
      return Math.max(0, deadlineMs - Date.now());
    }
    const fallback = Number(fallbackMs);
    return Number.isFinite(fallback) ? Math.max(0, fallback) : null;
  }

  function tickNowCountdowns() {
    if (!latestElements || !latestSnapshot) {
      return;
    }

    const hourEndMs = parseDeadlineMs(latestSnapshot?.currentHour?.end);
    const hourRemaining = getRemainingMs(hourEndMs, latestSnapshot?.currentHour?.msRemaining);
    if (latestElements.nowCountdownEl) {
      latestElements.nowCountdownEl.textContent = hourRemaining === null
        ? "--"
        : nowUiHelpers.formatCountdown(hourRemaining, latestTimeFormat);
    }

    const moonChangeMs = parseDeadlineMs(latestSnapshot?.moon?.countdown?.changeAt);
    const moonRemaining = getRemainingMs(moonChangeMs, latestSnapshot?.moon?.countdown?.msRemaining);
    if (latestElements.nowMoonCountdownEl) {
      latestElements.nowMoonCountdownEl.textContent = moonRemaining === null
        ? "--"
        : nowUiHelpers.formatCountdown(moonRemaining, latestTimeFormat);
    }

    const decanChangeMs = parseDeadlineMs(latestSnapshot?.decan?.countdown?.changeAt);
    const decanRemaining = getRemainingMs(decanChangeMs, latestSnapshot?.decan?.countdown?.msRemaining);
    if (latestElements.nowDecanCountdownEl) {
      latestElements.nowDecanCountdownEl.textContent = decanRemaining === null
        ? "--"
        : nowUiHelpers.formatCountdown(decanRemaining, latestTimeFormat);
    }
  }

  function stopCountdownTicker() {
    if (!countdownTickerId) {
      return;
    }
    clearInterval(countdownTickerId);
    countdownTickerId = null;
  }

  function startCountdownTicker() {
    stopCountdownTicker();
    if ((window.TarotSectionStateUi?.getActiveSection?.() || "home") !== "sky") {
      return;
    }
    if (typeof document !== "undefined" && document.hidden === true) {
      return;
    }
    countdownTickerId = setInterval(tickNowCountdowns, 1000);
    tickNowCountdowns();
  }

  function applyNowSnapshot(elements, snapshot, timeFormat, options = {}) {
    const timestamp = snapshot?.timestamp ? new Date(snapshot.timestamp) : new Date();
    const dayKey = String(snapshot?.dayKey || getDateKey(timestamp));
    const skyRefreshKey = String(snapshot?.skyRefreshKey || "");
    const currentHour = snapshot?.currentHour || null;
    const tarotAccessEnabled = window.TarotAppConfig?.hasTarotAccess?.() === true;
    const forceCards = options.forceCards === true;
    const contentKey = `${skyRefreshKey}|${tarotAccessEnabled ? "tarot" : "basic"}|${window.TarotCardImages?.getActiveDeck?.() || ""}`;
    const shouldRenderStaticContent = forceCards || contentKey !== lastRenderedSkyKey;

    latestSnapshot = snapshot || null;
    latestElements = elements || null;
    latestTimeFormat = timeFormat || "minutes";

    if (shouldRenderStaticContent) {
      setNowTarotVisibility(elements.nowHourCardEl, elements.nowHourTarotEl, tarotAccessEnabled);
      setNowTarotVisibility(elements.nowMoonCardEl, elements.nowMoonTarotEl, tarotAccessEnabled);
      setNowTarotVisibility(elements.nowDecanCardEl, elements.nowDecanTarotEl, tarotAccessEnabled);

      if (currentHour?.planet) {
        elements.nowHourEl.textContent = `${currentHour.planet.symbol} ${currentHour.planet.name}`;
        if (tarotAccessEnabled && elements.nowHourTarotEl) {
          const hourCardName = currentHour.planet?.tarot?.majorArcana || "";
          const hourTrumpNumber = currentHour.planet?.tarot?.number;
          elements.nowHourTarotEl.textContent = hourCardName
            ? nowUiHelpers.getDisplayTarotName(hourCardName, hourTrumpNumber)
            : "--";
        }

        if (elements.nowHourNextEl) {
          const nextPlanet = currentHour.nextHourPlanet;
          elements.nowHourNextEl.textContent = nextPlanet
            ? `> ${nextPlanet.name}`
            : "> --";
        }

        nowUiHelpers.setNowCardImage(
          elements.nowHourCardEl,
          tarotAccessEnabled ? currentHour.planet?.tarot?.majorArcana : null,
          "Current planetary hour card",
          currentHour.planet?.tarot?.number
        );
      } else {
        elements.nowHourEl.textContent = "--";
        if (elements.nowHourTarotEl) {
          elements.nowHourTarotEl.textContent = tarotAccessEnabled ? "--" : "";
        }
        if (elements.nowHourNextEl) {
          elements.nowHourNextEl.textContent = "> --";
        }
        nowUiHelpers.setNowCardImage(elements.nowHourCardEl, null, "Current planetary hour card");
      }

      const moon = snapshot?.moon || null;
      const illuminationFraction = Number(moon?.illuminationFraction || 0);
      const moonTarot = moon?.tarot?.majorArcana || "The High Priestess";
      elements.nowMoonEl.textContent = moon
        ? `${moon.phase} (${Math.round(illuminationFraction * 100)}%)`
        : "--";
      if (elements.nowMoonTarotEl) {
        elements.nowMoonTarotEl.textContent = tarotAccessEnabled
          ? (moon ? nowUiHelpers.getDisplayTarotName(moonTarot, moon?.tarot?.number) : "--")
          : "";
      }
      nowUiHelpers.setNowCardImage(
        elements.nowMoonCardEl,
        tarotAccessEnabled ? moon?.tarot?.majorArcana : null,
        "Current moon phase card",
        moon?.tarot?.number
      );

      if (elements.nowMoonNextEl) {
        elements.nowMoonNextEl.textContent = moon?.countdown?.nextPhase
          ? `> ${moon.countdown.nextPhase}`
          : "> --";
      }

      const decanInfo = snapshot?.decan || null;
      if (decanInfo?.sign) {
        const signMajorName = nowUiHelpers.getDisplayTarotName(
          decanInfo.sign?.tarot?.majorArcana,
          decanInfo.sign?.tarot?.number
        );
        const signDegree = Number.isFinite(Number(decanInfo.signDegree))
          ? Number(decanInfo.signDegree).toFixed(1)
          : "0.0";

        elements.nowDecanEl.textContent = tarotAccessEnabled
          ? `${decanInfo.sign.symbol} ${decanInfo.sign.name} · ${signMajorName} (${signDegree}°)`
          : `${decanInfo.sign.symbol} ${decanInfo.sign.name} (${signDegree}°)`;

        if (tarotAccessEnabled && decanInfo.decan?.tarotMinorArcana) {
          elements.nowDecanTarotEl.textContent = nowUiHelpers.getDisplayTarotName(decanInfo.decan.tarotMinorArcana);
          nowUiHelpers.setNowCardImage(elements.nowDecanCardEl, decanInfo.decan.tarotMinorArcana, "Current decan card");
        } else if (tarotAccessEnabled) {
          const signTarotName = decanInfo.sign?.tarot?.majorArcana || "--";
          elements.nowDecanTarotEl.textContent = signTarotName === "--"
            ? "--"
            : nowUiHelpers.getDisplayTarotName(signTarotName, decanInfo.sign?.tarot?.number);
          nowUiHelpers.setNowCardImage(
            elements.nowDecanCardEl,
            decanInfo.sign?.tarot?.majorArcana,
            "Current decan card",
            decanInfo.sign?.tarot?.number
          );
        } else {
          elements.nowDecanTarotEl.textContent = "";
          nowUiHelpers.setNowCardImage(elements.nowDecanCardEl, null, "Current decan card");
        }

        if (elements.nowDecanNextEl) {
          elements.nowDecanNextEl.textContent = decanInfo.countdown?.nextLabel
            ? `> ${nowUiHelpers.getDisplayTarotName(decanInfo.countdown.nextLabel)}`
            : "> --";
        }
      } else {
        elements.nowDecanEl.textContent = "--";
        if (elements.nowDecanTarotEl) {
          elements.nowDecanTarotEl.textContent = tarotAccessEnabled ? "--" : "";
        }
        nowUiHelpers.setNowCardImage(elements.nowDecanCardEl, null, "Current decan card");
        if (elements.nowDecanNextEl) {
          elements.nowDecanNextEl.textContent = "> --";
        }
      }

      renderNowStatsFromSnapshot(elements, snapshot?.stats || {});
      lastRenderedSkyKey = contentKey;
    }

    tickNowCountdowns();
    startCountdownTicker();

    return {
      dayKey,
      skyRefreshKey
    };
  }

  async function updateNowPanel(referenceData, geo, elements, timeFormat = "minutes", options = {}) {
    if (!referenceData || !geo || !elements) {
      return { dayKey: getDateKey(new Date()), skyRefreshKey: "" };
    }

    const snapshot = await dataService.fetchNowSnapshot?.(geo, new Date());
    return applyNowSnapshot(elements, snapshot || {}, timeFormat, options);
  }

  window.TarotNowUi = {
    updateNowPanel,
    startCountdownTicker,
    stopCountdownTicker,
    tickNowCountdowns
  };

  try {
    const nowSettingsToggle = document.getElementById("now-settings-toggle");
    const nowSettingsPanel = document.getElementById("now-settings-panel");
    const nowDeckFieldEl = document.getElementById("now-deck-field");

    function hydrateSkySettingsPanel() {
      const saved = window.TarotSettingsUi?.loadSavedSettings?.()
        || window.TarotSettingsUi?.normalizeSettings?.(
          JSON.parse(window.localStorage.getItem("tarot-time-settings-v1") || "{}")
        )
        || null;

      if (saved && typeof window.TarotSettingsUi?.normalizeSettings === "function") {
        // Re-apply known values into Sky controls without emitting a full save cycle.
        const latEl = document.getElementById("now-lat");
        const lngEl = document.getElementById("now-lng");
        const stellariumToggle = document.getElementById("now-stellarium-toggle");
        const timeFormatEl = document.getElementById("now-time-format");
        const deckEl = document.getElementById("now-tarot-deck");

        if (latEl) latEl.value = String(saved.latitude);
        if (lngEl) lngEl.value = String(saved.longitude);
        if (stellariumToggle) stellariumToggle.checked = Boolean(saved.stellariumBackgroundEnabled);
        if (timeFormatEl) timeFormatEl.value = saved.timeFormat || "minutes";
        try { window.TarotSettingsUi?.syncTarotDeckInputOptions?.(); } catch (_) {}
        if (deckEl && saved.tarotDeck) {
          deckEl.value = saved.tarotDeck;
        }
      } else {
        try { window.TarotSettingsUi?.syncTarotDeckInputOptions?.(); } catch (_) {}
      }

      if (nowDeckFieldEl) {
        nowDeckFieldEl.hidden = window.TarotAppConfig?.hasTarotAccess?.() !== true;
      }
      try { window.TarotSettingsUi?.syncStellariumBackgroundAvailability?.(); } catch (_) {}
      try { window.TarotSettingsUi?.setNowSettingsStatus?.(""); } catch (_) {}
    }

    if (nowSettingsToggle && nowSettingsPanel) {
      nowSettingsToggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const willOpen = Boolean(nowSettingsPanel.hidden);
        nowSettingsPanel.hidden = !willOpen;
        nowSettingsToggle.setAttribute("aria-expanded", String(willOpen));
        nowSettingsToggle.textContent = willOpen ? "Hide Settings" : "Settings";
        if (willOpen) {
          hydrateSkySettingsPanel();
          const focusTarget = document.getElementById("now-lat");
          if (focusTarget && typeof focusTarget.focus === "function") {
            focusTarget.focus();
          }
        }
      });
    }

    document.addEventListener("settings:updated", (event) => {
      if ((window.TarotSectionStateUi?.getActiveSection?.() || "home") !== "sky") {
        return;
      }
      const forceCards = Boolean(event?.detail?.settings?.tarotDeck);
      window.TarotAppRuntime?.refreshNowPanel?.({
        forceSky: true,
        forceCards
      });
    });

    document.addEventListener("connection:access-updated", () => {
      if (nowDeckFieldEl) {
        nowDeckFieldEl.hidden = window.TarotAppConfig?.hasTarotAccess?.() !== true;
      }
      try { window.TarotSettingsUi?.syncTarotDeckInputOptions?.(); } catch (_) {}
    });

    document.addEventListener("section:changed", (event) => {
      if (event?.detail?.activeSection === "sky") {
        hydrateSkySettingsPanel();
        startCountdownTicker();
      } else {
        stopCountdownTicker();
        if (nowSettingsPanel && nowSettingsToggle) {
          nowSettingsPanel.hidden = true;
          nowSettingsToggle.setAttribute("aria-expanded", "false");
          nowSettingsToggle.textContent = "Settings";
        }
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopCountdownTicker();
      } else if ((window.TarotSectionStateUi?.getActiveSection?.() || "home") === "sky") {
        startCountdownTicker();
      }
    });
  } catch (_) {
    // Silently ignore - Sky page UI is non-critical
  }
})();
