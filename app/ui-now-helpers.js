/* ui-now-helpers.js — Lightbox and astronomy/countdown helpers for the Now panel */
(function () {
  "use strict";

  const { DAY_IN_MS, getMoonPhaseName, getDecanForDate } = window.TarotCalc || {};
  const { resolveTarotCardImage, resolveTarotCardThumbnail, getTarotCardDisplayName } = window.TarotCardImages || {};

  let nowLightboxOverlayEl = null;
  let nowLightboxImageEl = null;
  let nowLightboxZoomed = false;

  const LIGHTBOX_ZOOM_SCALE = 6.66;

  const PLANETARY_BODIES = [
    { id: "sol", astronomyBody: "Sun", fallbackName: "Sun", fallbackSymbol: "☉︎" },
    { id: "luna", astronomyBody: "Moon", fallbackName: "Moon", fallbackSymbol: "☾︎" },
    { id: "mercury", astronomyBody: "Mercury", fallbackName: "Mercury", fallbackSymbol: "☿︎" },
    { id: "venus", astronomyBody: "Venus", fallbackName: "Venus", fallbackSymbol: "♀︎" },
    { id: "mars", astronomyBody: "Mars", fallbackName: "Mars", fallbackSymbol: "♂︎" },
    { id: "jupiter", astronomyBody: "Jupiter", fallbackName: "Jupiter", fallbackSymbol: "♃︎" },
    { id: "saturn", astronomyBody: "Saturn", fallbackName: "Saturn", fallbackSymbol: "♄︎" },
    { id: "uranus", astronomyBody: "Uranus", fallbackName: "Uranus", fallbackSymbol: "♅︎" },
    { id: "neptune", astronomyBody: "Neptune", fallbackName: "Neptune", fallbackSymbol: "♆︎" },
    { id: "pluto", astronomyBody: "Pluto", fallbackName: "Pluto", fallbackSymbol: "♇︎" }
  ];

  const NOW_PLANET_SIGN_LAYOUT = [
    { id: "aries", name: "Aries", symbol: "♈" },
    { id: "libra", name: "Libra", symbol: "♎" },
    { id: "taurus", name: "Taurus", symbol: "♉" },
    { id: "scorpio", name: "Scorpio", symbol: "♏" },
    { id: "gemini", name: "Gemini", symbol: "♊" },
    { id: "sagittarius", name: "Sagittarius", symbol: "♐" },
    { id: "cancer", name: "Cancer", symbol: "♋" },
    { id: "capricorn", name: "Capricorn", symbol: "♑" },
    { id: "leo", name: "Leo", symbol: "♌" },
    { id: "aquarius", name: "Aquarius", symbol: "♒" },
    { id: "virgo", name: "Virgo", symbol: "♍" },
    { id: "pisces", name: "Pisces", symbol: "♓" }
  ];

  function resetNowLightboxZoom() {
    if (!nowLightboxImageEl) {
      return;
    }

    nowLightboxZoomed = false;
    nowLightboxImageEl.style.transform = "scale(1)";
    nowLightboxImageEl.style.transformOrigin = "center center";
    nowLightboxImageEl.style.cursor = "zoom-in";
  }

  function updateNowLightboxZoomOrigin(clientX, clientY) {
    if (!nowLightboxZoomed || !nowLightboxImageEl) {
      return;
    }

    const rect = nowLightboxImageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    nowLightboxImageEl.style.transformOrigin = `${x}% ${y}%`;
  }

  function isNowLightboxPointOnCard(clientX, clientY) {
    if (!nowLightboxImageEl) {
      return false;
    }

    const rect = nowLightboxImageEl.getBoundingClientRect();
    const naturalWidth = nowLightboxImageEl.naturalWidth;
    const naturalHeight = nowLightboxImageEl.naturalHeight;

    if (!rect.width || !rect.height || !naturalWidth || !naturalHeight) {
      return true;
    }

    const frameAspect = rect.width / rect.height;
    const imageAspect = naturalWidth / naturalHeight;

    let renderWidth = rect.width;
    let renderHeight = rect.height;
    if (imageAspect > frameAspect) {
      renderHeight = rect.width / imageAspect;
    } else {
      renderWidth = rect.height * imageAspect;
    }

    const left = rect.left + (rect.width - renderWidth) / 2;
    const top = rect.top + (rect.height - renderHeight) / 2;
    const right = left + renderWidth;
    const bottom = top + renderHeight;

    return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
  }

  function ensureNowImageLightbox() {
    if (nowLightboxOverlayEl && nowLightboxImageEl) {
      return;
    }

    nowLightboxOverlayEl = document.createElement("div");
    nowLightboxOverlayEl.setAttribute("aria-hidden", "true");
    nowLightboxOverlayEl.style.position = "fixed";
    nowLightboxOverlayEl.style.inset = "0";
    nowLightboxOverlayEl.style.background = "rgba(0, 0, 0, 0.82)";
    nowLightboxOverlayEl.style.display = "none";
    nowLightboxOverlayEl.style.alignItems = "center";
    nowLightboxOverlayEl.style.justifyContent = "center";
    nowLightboxOverlayEl.style.zIndex = "9999";
    nowLightboxOverlayEl.style.padding = "0";

    const image = document.createElement("img");
    image.alt = "Now card enlarged image";
    image.style.maxWidth = "100vw";
    image.style.maxHeight = "100vh";
    image.style.width = "100vw";
    image.style.height = "100vh";
    image.style.objectFit = "contain";
    image.style.borderRadius = "0";
    image.style.boxShadow = "none";
    image.style.border = "none";
    image.style.cursor = "zoom-in";
    image.style.transform = "scale(1)";
    image.style.transformOrigin = "center center";
    image.style.transition = "transform 120ms ease-out";
    image.style.userSelect = "none";

    nowLightboxImageEl = image;
    nowLightboxOverlayEl.appendChild(image);

    const closeLightbox = () => {
      if (!nowLightboxOverlayEl || !nowLightboxImageEl) {
        return;
      }
      nowLightboxOverlayEl.style.display = "none";
      nowLightboxOverlayEl.setAttribute("aria-hidden", "true");
      nowLightboxImageEl.removeAttribute("src");
      resetNowLightboxZoom();
    };

    nowLightboxOverlayEl.addEventListener("click", (event) => {
      if (event.target === nowLightboxOverlayEl) {
        closeLightbox();
      }
    });

    nowLightboxImageEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!isNowLightboxPointOnCard(event.clientX, event.clientY)) {
        closeLightbox();
        return;
      }
      if (!nowLightboxZoomed) {
        nowLightboxZoomed = true;
        nowLightboxImageEl.style.transform = `scale(${LIGHTBOX_ZOOM_SCALE})`;
        nowLightboxImageEl.style.cursor = "zoom-out";
        updateNowLightboxZoomOrigin(event.clientX, event.clientY);
        return;
      }
      resetNowLightboxZoom();
    });

    nowLightboxImageEl.addEventListener("mousemove", (event) => {
      updateNowLightboxZoomOrigin(event.clientX, event.clientY);
    });

    nowLightboxImageEl.addEventListener("mouseleave", () => {
      if (nowLightboxZoomed) {
        nowLightboxImageEl.style.transformOrigin = "center center";
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeLightbox();
      }
    });

    document.body.appendChild(nowLightboxOverlayEl);
  }

  function openNowImageLightbox(src, altText) {
    if (!src) {
      return;
    }

    ensureNowImageLightbox();
    if (!nowLightboxOverlayEl || !nowLightboxImageEl) {
      return;
    }

    nowLightboxImageEl.src = src;
    nowLightboxImageEl.alt = altText || "Now card enlarged image";
    resetNowLightboxZoom();
    nowLightboxOverlayEl.style.display = "flex";
    nowLightboxOverlayEl.setAttribute("aria-hidden", "false");
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

  function bindNowCardLightbox(imageEl) {
    if (!(imageEl instanceof HTMLImageElement) || imageEl.dataset.lightboxBound === "true") {
      return;
    }

    imageEl.dataset.lightboxBound = "true";
    imageEl.style.cursor = "zoom-in";
    imageEl.title = "Click to enlarge";
    imageEl.addEventListener("click", () => {
      const src = imageEl.dataset.fullSrc || imageEl.getAttribute("src");
      if (!src || imageEl.style.display === "none") {
        return;
      }
      openNowImageLightbox(src, imageEl.alt || "Now card enlarged image");
    });
  }

  function normalizeLongitude(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return ((numeric % 360) + 360) % 360;
  }

  function getSortedSigns(signs) {
    if (!Array.isArray(signs)) {
      return [];
    }

    return [...signs].sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  function getSignForLongitude(longitude, signs) {
    const normalized = normalizeLongitude(longitude);
    if (normalized === null) {
      return null;
    }

    const sortedSigns = getSortedSigns(signs);
    if (!sortedSigns.length) {
      return null;
    }

    const signIndex = Math.min(sortedSigns.length - 1, Math.floor(normalized / 30));
    const sign = sortedSigns[signIndex] || null;
    if (!sign) {
      return null;
    }

    return {
      sign,
      degreeInSign: normalized - signIndex * 30,
      absoluteLongitude: normalized
    };
  }

  function getSabianSymbolForLongitude(longitude, sabianSymbols) {
    const normalized = normalizeLongitude(longitude);
    if (normalized === null || !Array.isArray(sabianSymbols) || !sabianSymbols.length) {
      return null;
    }

    const absoluteDegree = Math.floor(normalized) + 1;
    return sabianSymbols.find((entry) => Number(entry?.absoluteDegree) === absoluteDegree) || null;
  }

  function calculatePlanetPositions(referenceData, now) {
    if (!window.Astronomy || !referenceData) {
      return [];
    }

    const positions = [];

    PLANETARY_BODIES.forEach((body) => {
      try {
        const geoVector = window.Astronomy.GeoVector(body.astronomyBody, now, true);
        const ecliptic = window.Astronomy.Ecliptic(geoVector);
        const signInfo = getSignForLongitude(ecliptic?.elon, referenceData.signs);
        if (!signInfo?.sign) {
          return;
        }

        const planetInfo = referenceData.planets?.[body.id] || null;
        const symbol = planetInfo?.symbol || body.fallbackSymbol;
        const name = planetInfo?.name || body.fallbackName;

        positions.push({
          id: body.id,
          symbol,
          name,
          longitude: signInfo.absoluteLongitude,
          sign: signInfo.sign,
          degreeInSign: signInfo.degreeInSign,
          label: `${symbol} ${name}: ${signInfo.sign.symbol} ${signInfo.sign.name} ${signInfo.degreeInSign.toFixed(1)}°`
        });
      } catch {
      }
    });

    return positions;
  }

  function normalizeNowSignId(sign) {
    if (!sign) {
      return "";
    }

    const signId = String(sign?.id || sign).trim().toLowerCase();
    if (signId) {
      return signId;
    }

    return String(sign?.name || "").trim().toLowerCase();
  }

  function buildNowPlanetSignBuckets(planetPositions = []) {
    const positionsBySign = new Map();

    planetPositions.forEach((position) => {
      const signId = normalizeNowSignId(position?.sign);
      if (!signId) {
        return;
      }

      if (!positionsBySign.has(signId)) {
        positionsBySign.set(signId, []);
      }

      positionsBySign.get(signId).push(position);
    });

    return NOW_PLANET_SIGN_LAYOUT.map((signMeta) => ({
      ...signMeta,
      positions: (positionsBySign.get(signMeta.id) || [])
        .slice()
        .sort((left, right) => Number(left?.degreeInSign || 0) - Number(right?.degreeInSign || 0))
    })).filter((signBucket) => signBucket.positions.length > 0);
  }

  function formatNowPlanetEntry(position) {
    const symbol = String(position?.symbol || "").trim();
    const name = String(position?.name || "").trim() || "--";
    const degree = Number(position?.degreeInSign);
    const degreeLabel = Number.isFinite(degree) ? `${degree.toFixed(1)}°` : "--";

    return `${symbol ? `${symbol} ` : ""}${name} ${degreeLabel}`.trim();
  }

  function renderNowPlanetPositions(containerEl, planetPositions = []) {
    if (!containerEl) {
      return;
    }

    containerEl.replaceChildren();

    const positions = Array.isArray(planetPositions) ? planetPositions.filter(Boolean) : [];
    if (!positions.length) {
      containerEl.textContent = "--";
      return;
    }

    buildNowPlanetSignBuckets(positions).forEach((signBucket) => {
      const item = document.createElement("div");
      item.className = "now-stats-planet";

      const title = document.createElement("div");
      title.className = "now-stats-planet-sign";
      title.textContent = `${signBucket.symbol} ${signBucket.name}`;
      item.appendChild(title);

      const list = document.createElement("div");
      list.className = "now-stats-planet-list";

      signBucket.positions.forEach((position) => {
        const entry = document.createElement("div");
        entry.className = "now-stats-planet-entry";
        entry.textContent = formatNowPlanetEntry(position);
        list.appendChild(entry);
      });

      item.appendChild(list);
      containerEl.appendChild(item);
    });
  }

  function updateNowStats(referenceData, elements, now) {
    const planetPositions = calculatePlanetPositions(referenceData, now);

    if (elements.nowStatsPlanetsEl) {
      renderNowPlanetPositions(elements.nowStatsPlanetsEl, planetPositions);
    }

    if (elements.nowStatsSabianEl) {
      const sunPosition = planetPositions.find((entry) => entry.id === "sol") || null;
      const moonPosition = planetPositions.find((entry) => entry.id === "luna") || null;
      const sunSabianSymbol = sunPosition
        ? getSabianSymbolForLongitude(sunPosition.longitude, referenceData.sabianSymbols)
        : null;
      const moonSabianSymbol = moonPosition
        ? getSabianSymbolForLongitude(moonPosition.longitude, referenceData.sabianSymbols)
        : null;

      const sunLine = sunSabianSymbol?.phrase
        ? `Sun Sabian ${sunSabianSymbol.absoluteDegree}: ${sunSabianSymbol.phrase}`
        : "Sun Sabian: --";
      const moonLine = moonSabianSymbol?.phrase
        ? `Moon Sabian ${moonSabianSymbol.absoluteDegree}: ${moonSabianSymbol.phrase}`
        : "Moon Sabian: --";

      elements.nowStatsSabianEl.textContent = `${sunLine}\n${moonLine}`;
    }
  }

  function formatCountdown(ms, mode) {
    if (!Number.isFinite(ms) || ms <= 0) {
      if (mode === "hours") {
        return "0.0 hours";
      }
      if (mode === "seconds") {
        return "0s";
      }
      return "0m";
    }

    if (mode === "hours") {
      return `${(ms / 3600000).toFixed(1)} hours`;
    }

    if (mode === "seconds") {
      return `${Math.floor(ms / 1000)}s`;
    }

    return `${Math.floor(ms / 60000)}m`;
  }

  function parseMonthDay(monthDay) {
    const [month, day] = String(monthDay || "").split("-").map(Number);
    return { month, day };
  }

  function getCurrentPhaseName(date) {
    return getMoonPhaseName(window.SunCalc.getMoonIllumination(date).phase);
  }

  function findNextMoonPhaseTransition(now) {
    const currentPhase = getCurrentPhaseName(now);
    const stepMs = 15 * 60 * 1000;
    const maxMs = 40 * DAY_IN_MS;

    let previousTime = now.getTime();
    let previousPhase = currentPhase;

    for (let t = previousTime + stepMs; t <= previousTime + maxMs; t += stepMs) {
      const phaseName = getCurrentPhaseName(new Date(t));
      if (phaseName !== previousPhase) {
        let low = previousTime;
        let high = t;
        while (high - low > 1000) {
          const mid = Math.floor((low + high) / 2);
          const midPhase = getCurrentPhaseName(new Date(mid));
          if (midPhase === currentPhase) {
            low = mid;
          } else {
            high = mid;
          }
        }

        const transitionAt = new Date(high);
        const nextPhase = getCurrentPhaseName(new Date(high + 1000));
        return {
          fromPhase: currentPhase,
          nextPhase,
          changeAt: transitionAt
        };
      }
      previousTime = t;
      previousPhase = phaseName;
    }

    return null;
  }

  function getSignStartDate(now, sign) {
    const { month: startMonth, day: startDay } = parseMonthDay(sign.start);
    const { month: endMonth } = parseMonthDay(sign.end);
    const wrapsYear = startMonth > endMonth;

    let year = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    const nowDay = now.getDate();

    if (wrapsYear && (nowMonth < startMonth || (nowMonth === startMonth && nowDay < startDay))) {
      year -= 1;
    }

    return new Date(year, startMonth - 1, startDay);
  }

  function getNextSign(signs, currentSign) {
    const sorted = [...signs].sort((a, b) => (a.order || 0) - (b.order || 0));
    const index = sorted.findIndex((entry) => entry.id === currentSign.id);
    if (index < 0) {
      return null;
    }
    return sorted[(index + 1) % sorted.length] || null;
  }

  function getDecanByIndex(decansBySign, signId, index) {
    const signDecans = decansBySign[signId] || [];
    return signDecans.find((entry) => entry.index === index) || null;
  }

  function findNextDecanTransition(now, signs, decansBySign) {
    const currentInfo = getDecanForDate(now, signs, decansBySign);
    if (!currentInfo?.sign) {
      return null;
    }

    const currentIndex = currentInfo.decan?.index || 1;
    const signStart = getSignStartDate(now, currentInfo.sign);

    if (currentIndex < 3) {
      const changeAt = new Date(signStart.getTime() + currentIndex * 10 * DAY_IN_MS);
      const nextDecan = getDecanByIndex(decansBySign, currentInfo.sign.id, currentIndex + 1);
      const nextLabel = nextDecan?.tarotMinorArcana || `${currentInfo.sign.name} Decan ${currentIndex + 1}`;

      return {
        key: `${currentInfo.sign.id}-${currentIndex}`,
        changeAt,
        nextLabel
      };
    }

    const nextSign = getNextSign(signs, currentInfo.sign);
    if (!nextSign) {
      return null;
    }

    const { month: nextMonth, day: nextDay } = parseMonthDay(nextSign.start);
    let year = now.getFullYear();
    let changeAt = new Date(year, nextMonth - 1, nextDay);
    if (changeAt.getTime() <= now.getTime()) {
      changeAt = new Date(year + 1, nextMonth - 1, nextDay);
    }

    const nextDecan = getDecanByIndex(decansBySign, nextSign.id, 1);

    return {
      key: `${currentInfo.sign.id}-${currentIndex}`,
      changeAt,
      nextLabel: nextDecan?.tarotMinorArcana || `${nextSign.name} Decan 1`
    };
  }

  function setNowCardImage(imageEl, cardName, fallbackLabel, trumpNumber) {
    if (!imageEl) {
      return;
    }

    bindNowCardLightbox(imageEl);

    if (!cardName || (typeof resolveTarotCardThumbnail !== "function" && typeof resolveTarotCardImage !== "function")) {
      imageEl.style.display = "none";
      imageEl.removeAttribute("src");
      delete imageEl.dataset.fullSrc;
      delete imageEl.dataset.deckId;
      return;
    }

    const activeDeckId = String(window.TarotCardImages?.getActiveDeck?.() || "").trim();
    const deckOptions = {
      deckId: activeDeckId || undefined,
      trumpNumber
    };
    const fullSrc = typeof resolveTarotCardImage === "function"
      ? resolveTarotCardImage(cardName, deckOptions)
      : null;
    const thumbnailSrc = typeof resolveTarotCardThumbnail === "function"
      ? (resolveTarotCardThumbnail(cardName, deckOptions) || fullSrc)
      : fullSrc;
    if (!thumbnailSrc) {
      imageEl.style.display = "none";
      imageEl.removeAttribute("src");
      delete imageEl.dataset.fullSrc;
      delete imageEl.dataset.deckId;
      return;
    }

    // Force a visual refresh when the deck changes even if the browser would
    // otherwise keep a cached image for a reused element.
    if (imageEl.dataset.deckId !== activeDeckId || imageEl.getAttribute("src") !== thumbnailSrc) {
      imageEl.src = thumbnailSrc;
    }
    imageEl.dataset.fullSrc = fullSrc || thumbnailSrc;
    imageEl.dataset.deckId = activeDeckId;
    const displayName = getDisplayTarotName(cardName, trumpNumber);
    imageEl.alt = `${fallbackLabel}: ${displayName}`;
    imageEl.style.display = "block";
    imageEl.decoding = "async";
  }

  window.NowUiHelpers = {
    getSignStartDate,
    findNextDecanTransition,
    findNextMoonPhaseTransition,
    formatCountdown,
    getDisplayTarotName,
    setNowCardImage,
    renderNowPlanetPositions,
    updateNowStats
  };
})();