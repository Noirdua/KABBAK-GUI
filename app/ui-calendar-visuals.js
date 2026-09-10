(function () {
  "use strict";

  const { html } = window.HtmlSafe;

  let config = {};
  let monthStripResizeFrame = null;
  let initialized = false;

  function getCalendar() {
    return config.calendar || null;
  }

  function getMonthStripEl() {
    return config.monthStripEl || null;
  }

  function getCurrentGeo() {
    return config.getCurrentGeo?.() || null;
  }

  function getFormattingUi() {
    return window.TarotCalendarFormatting || {};
  }

  function normalizeCalendarDateLike(value) {
    const formattingUi = getFormattingUi();
    if (typeof formattingUi.normalizeDateLike === "function") {
      return formattingUi.normalizeDateLike(value);
    }

    if (value instanceof Date) {
      return value;
    }

    if (value && typeof value.getTime === "function") {
      return new Date(value.getTime());
    }

    return new Date(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(start, end, t) {
    return start + (end - start) * t;
  }

  function lerpRgb(from, to, t) {
    return [
      Math.round(lerp(from[0], to[0], t)),
      Math.round(lerp(from[1], to[1], t)),
      Math.round(lerp(from[2], to[2], t))
    ];
  }

  function rgbString(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  function getActiveGeoForRuler() {
    const currentGeo = getCurrentGeo();
    if (currentGeo) {
      return currentGeo;
    }

    try {
      return config.parseGeoInput?.() || null;
    } catch {
      return null;
    }
  }

  function buildSunRulerGradient(geo, date) {
    if (!window.SunCalc || !geo || !date) {
      return null;
    }

    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const sampleCount = 48;
    const samples = [];

    for (let index = 0; index <= sampleCount; index += 1) {
      const sampleDate = new Date(dayStart.getTime() + index * 30 * 60 * 1000);
      const position = window.SunCalc.getPosition(sampleDate, geo.latitude, geo.longitude);
      const altitudeDeg = (position.altitude * 180) / Math.PI;
      samples.push(altitudeDeg);
    }

    const maxAltitude = Math.max(...samples);

    const NIGHT = [6, 7, 10];
    const PRE_DAWN = [22, 26, 38];
    const SUN_RED = [176, 45, 36];
    const SUN_ORANGE = [246, 133, 54];
    const SKY_BLUE = [58, 134, 255];

    const nightFloor = -8;
    const twilightEdge = -2;
    const redToOrangeEdge = 2;
    const orangeToBlueEdge = 8;
    const daylightRange = Math.max(1, maxAltitude - orangeToBlueEdge);

    const stops = samples.map((altitudeDeg, index) => {
      let color;

      if (altitudeDeg <= nightFloor) {
        color = NIGHT;
      } else if (altitudeDeg <= twilightEdge) {
        const t = clamp((altitudeDeg - nightFloor) / (twilightEdge - nightFloor), 0, 1);
        color = lerpRgb(NIGHT, PRE_DAWN, t);
      } else if (altitudeDeg <= redToOrangeEdge) {
        const t = clamp((altitudeDeg - twilightEdge) / (redToOrangeEdge - twilightEdge), 0, 1);
        color = lerpRgb(PRE_DAWN, SUN_RED, t);
      } else if (altitudeDeg <= orangeToBlueEdge) {
        const t = clamp((altitudeDeg - redToOrangeEdge) / (orangeToBlueEdge - redToOrangeEdge), 0, 1);
        color = lerpRgb(SUN_RED, SUN_ORANGE, t);
      } else {
        const t = clamp((altitudeDeg - orangeToBlueEdge) / daylightRange, 0, 1);
        color = lerpRgb(SUN_ORANGE, SKY_BLUE, t);
      }

      const pct = ((index / sampleCount) * 100).toFixed(2);
      return `${rgbString(color)} ${pct}%`;
    });

    return `linear-gradient(to bottom, ${stops.join(", ")})`;
  }

  function applySunRulerGradient(referenceDate = new Date()) {
    const geo = getActiveGeoForRuler();
    if (!geo) {
      return;
    }

    const gradient = buildSunRulerGradient(geo, referenceDate);
    if (!gradient) {
      return;
    }

    const rulerColumns = document.querySelectorAll(".toastui-calendar-timegrid-time-column");
    rulerColumns.forEach((column) => {
      column.style.backgroundImage = gradient;
      column.style.backgroundRepeat = "no-repeat";
      column.style.backgroundSize = "100% 100%";
    });
  }

  function getMoonPhaseGlyph(phaseName) {
    if (phaseName === "New Moon") return "🌑";
    if (phaseName === "Waxing Crescent") return "🌒";
    if (phaseName === "First Quarter") return "🌓";
    if (phaseName === "Waxing Gibbous") return "🌔";
    if (phaseName === "Full Moon") return "🌕";
    if (phaseName === "Waning Gibbous") return "🌖";
    if (phaseName === "Last Quarter") return "🌗";
    return "🌘";
  }

  function applyDynamicNowIndicatorVisual(referenceDate = new Date()) {
    const currentGeo = getCurrentGeo();
    if (!currentGeo || !window.SunCalc) {
      return;
    }

    const labelEl = document.querySelector(
      ".toastui-calendar-timegrid-time-column .toastui-calendar-timegrid-current-time"
    );
    const markerEl = document.querySelector(
      ".toastui-calendar-timegrid .toastui-calendar-timegrid-now-indicator .toastui-calendar-timegrid-now-indicator-marker"
    );

    if (!labelEl || !markerEl) {
      return;
    }

    const sunPosition = window.SunCalc.getPosition(referenceDate, currentGeo.latitude, currentGeo.longitude);
    const sunAltitudeDeg = (sunPosition.altitude * 180) / Math.PI;
    const isSunMode = sunAltitudeDeg >= -4;

    let icon = "☀️";
    let visualKey = "sun-0";

    labelEl.classList.remove("is-sun", "is-moon");
    markerEl.classList.remove("is-sun", "is-moon");

    if (isSunMode) {
      const intensity = clamp((sunAltitudeDeg + 4) / 70, 0, 1);
      const intensityPercent = Math.round(intensity * 100);

      icon = "☀️";
      visualKey = `sun-${intensityPercent}`;

      labelEl.classList.add("is-sun");
      markerEl.classList.add("is-sun");

      labelEl.style.setProperty("--sun-glow-size", `${Math.round(8 + intensity * 16)}px`);
      labelEl.style.setProperty("--sun-glow-alpha", (0.35 + intensity * 0.55).toFixed(2));
      markerEl.style.setProperty("--sun-marker-glow-size", `${Math.round(10 + intensity * 24)}px`);
      markerEl.style.setProperty("--sun-marker-ray-opacity", (0.45 + intensity * 0.5).toFixed(2));

      labelEl.title = `Sun altitude ${sunAltitudeDeg.toFixed(1)}°`;
    } else {
      const moonIllum = window.SunCalc.getMoonIllumination(referenceDate);
      const moonPct = Math.round(moonIllum.fraction * 100);
      const moonPhaseName = config.getMoonPhaseName?.(moonIllum.phase) || "Waning Crescent";

      icon = getMoonPhaseGlyph(moonPhaseName);
      visualKey = `moon-${moonPct}-${moonPhaseName}`;

      labelEl.classList.add("is-moon");
      markerEl.classList.add("is-moon");

      labelEl.style.setProperty("--moon-glow-alpha", (0.2 + moonIllum.fraction * 0.45).toFixed(2));
      markerEl.style.setProperty("--moon-glow-alpha", (0.2 + moonIllum.fraction * 0.45).toFixed(2));

      labelEl.title = `${moonPhaseName} (${moonPct}%)`;
    }

    if (labelEl.dataset.celestialKey !== visualKey) {
      labelEl.innerHTML = [
        '<span class="toastui-calendar-template-timegridNowIndicatorLabel now-celestial-chip">',
        html`<span class="now-celestial-icon">${icon}</span>`,
        "</span>"
      ].join("");
      labelEl.dataset.celestialKey = visualKey;
    }
  }

  function getVisibleWeekDates() {
    const calendar = getCalendar();
    if (!calendar || typeof calendar.getDateRangeStart !== "function") {
      return [];
    }

    const rangeStart = calendar.getDateRangeStart();
    if (!rangeStart) {
      return [];
    }

    const startDateLike = normalizeCalendarDateLike(rangeStart);
    const startDate = new Date(
      startDateLike.getFullYear(),
      startDateLike.getMonth(),
      startDateLike.getDate(),
      0,
      0,
      0,
      0
    );

    return Array.from({ length: 7 }, (_, dayOffset) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + dayOffset);
      return day;
    });
  }

  function buildMonthSpans(days) {
    if (!Array.isArray(days) || days.length === 0) {
      return [];
    }

    const monthFormatter = new Intl.DateTimeFormat(undefined, {
      month: "long",
      year: "numeric"
    });

    const spans = [];
    let currentStart = 1;
    let currentMonth = days[0].getMonth();
    let currentYear = days[0].getFullYear();

    for (let index = 1; index <= days.length; index += 1) {
      const day = days[index];
      const monthChanged = !day || day.getMonth() !== currentMonth || day.getFullYear() !== currentYear;

      if (!monthChanged) {
        continue;
      }

      const spanEnd = index;
      spans.push({
        start: currentStart,
        end: spanEnd,
        label: monthFormatter.format(new Date(currentYear, currentMonth, 1))
      });

      if (day) {
        currentStart = index + 1;
        currentMonth = day.getMonth();
        currentYear = day.getFullYear();
      }
    }

    return spans;
  }

  function syncMonthStripGeometry() {
    const monthStripEl = getMonthStripEl();
    if (!monthStripEl) {
      return;
    }

    const calendarEl = document.getElementById("calendar");
    if (!calendarEl) {
      return;
    }

    const dayNameItems = calendarEl.querySelectorAll(
      ".toastui-calendar-week-view-day-names .toastui-calendar-day-name-item.toastui-calendar-week"
    );

    if (dayNameItems.length < 7) {
      monthStripEl.style.paddingLeft = "0";
      monthStripEl.style.paddingRight = "0";
      return;
    }

    const calendarRect = calendarEl.getBoundingClientRect();
    const firstRect = dayNameItems[0].getBoundingClientRect();
    const lastRect = dayNameItems[6].getBoundingClientRect();

    const leftPad = Math.max(0, firstRect.left - calendarRect.left);
    const rightPad = Math.max(0, calendarRect.right - lastRect.right);

    monthStripEl.style.paddingLeft = `${leftPad}px`;
    monthStripEl.style.paddingRight = `${rightPad}px`;
  }

  function updateMonthStrip() {
    const monthStripEl = getMonthStripEl();
    if (!monthStripEl) {
      return;
    }

    const days = getVisibleWeekDates();
    const spans = buildMonthSpans(days);

    monthStripEl.replaceChildren();

    if (!spans.length) {
      return;
    }

    const trackEl = document.createElement("div");
    trackEl.className = "month-strip-track";

    spans.forEach((span) => {
      const segmentEl = document.createElement("div");
      segmentEl.className = "month-strip-segment";
      segmentEl.style.gridColumn = `${span.start} / ${span.end + 1}`;
      segmentEl.textContent = span.label;
      trackEl.appendChild(segmentEl);
    });

    monthStripEl.appendChild(trackEl);
    syncMonthStripGeometry();
  }

  function applyTimeFormatTemplates() {
    const calendar = getCalendar();
    const formattingUi = getFormattingUi();
    if (!calendar) {
      return;
    }

    calendar.setOptions({
      template: formattingUi.createCalendarTemplates?.() || {}
    });
    calendar.render();

    requestAnimationFrame(() => {
      formattingUi.forceAxisLabelFormat?.();
      applySunRulerGradient();
      applyDynamicNowIndicatorVisual();
      updateMonthStrip();
      requestAnimationFrame(() => {
        formattingUi.forceAxisLabelFormat?.();
        applySunRulerGradient();
        applyDynamicNowIndicatorVisual();
        updateMonthStrip();
      });
    });
  }

  function bindWindowResize() {
    window.addEventListener("resize", () => {
      if (monthStripResizeFrame) {
        cancelAnimationFrame(monthStripResizeFrame);
      }
      monthStripResizeFrame = requestAnimationFrame(() => {
        monthStripResizeFrame = null;
        updateMonthStrip();
      });
    });
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig
    };

    if (initialized) {
      return;
    }

    initialized = true;
    bindWindowResize();
  }

  window.TarotCalendarVisuals = {
    ...(window.TarotCalendarVisuals || {}),
    init,
    applySunRulerGradient,
    applyDynamicNowIndicatorVisual,
    updateMonthStrip,
    applyTimeFormatTemplates
  };
})();
