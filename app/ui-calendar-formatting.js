(function () {
  "use strict";

  const { html } = window.HtmlSafe;

  const DEFAULT_WEEKDAY_RULERS = {
    0: { symbol: "☉", name: "Sol" },
    1: { symbol: "☾", name: "Luna" },
    2: { symbol: "♂", name: "Mars" },
    3: { symbol: "☿", name: "Mercury" },
    4: { symbol: "♃", name: "Jupiter" },
    5: { symbol: "♀", name: "Venus" },
    6: { symbol: "♄", name: "Saturn" }
  };

  let config = {};

  function getCurrentTimeFormat() {
    return config.getCurrentTimeFormat?.() || "minutes";
  }

  function getReferenceData() {
    return config.getReferenceData?.() || null;
  }

  function getWeekdayIndexFromName(weekdayName) {
    const normalized = String(weekdayName || "").trim().toLowerCase();
    if (normalized === "sunday") return 0;
    if (normalized === "monday") return 1;
    if (normalized === "tuesday") return 2;
    if (normalized === "wednesday") return 3;
    if (normalized === "thursday") return 4;
    if (normalized === "friday") return 5;
    if (normalized === "saturday") return 6;
    return null;
  }

  function buildWeekdayRulerLookup(planets) {
    const lookup = { ...DEFAULT_WEEKDAY_RULERS };
    if (!planets || typeof planets !== "object") {
      return lookup;
    }

    Object.values(planets).forEach((planet) => {
      const weekdayIndex = getWeekdayIndexFromName(planet?.weekday);
      if (weekdayIndex === null) {
        return;
      }

      lookup[weekdayIndex] = {
        symbol: planet?.symbol || lookup[weekdayIndex].symbol,
        name: planet?.name || lookup[weekdayIndex].name
      };
    });

    return lookup;
  }

  function normalizeDateLike(value) {
    if (value instanceof Date) {
      return value;
    }
    if (value && typeof value.getTime === "function") {
      return new Date(value.getTime());
    }
    return new Date(value);
  }

  function getTimeParts(dateLike) {
    const date = normalizeDateLike(dateLike);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return {
      hours,
      minutes,
      totalMinutes: hours * 60 + minutes
    };
  }

  function formatHourStyle(dateLike) {
    const { totalMinutes } = getTimeParts(dateLike);
    return `${Math.floor(totalMinutes / 60)}hr`;
  }

  function formatMinuteStyle(dateLike) {
    const { totalMinutes } = getTimeParts(dateLike);
    return `${totalMinutes}m`;
  }

  function formatSecondStyle(dateLike) {
    const { totalMinutes } = getTimeParts(dateLike);
    const totalSeconds = totalMinutes * 60;
    return `${totalSeconds}s`;
  }

  function formatCalendarTime(dateLike) {
    const currentTimeFormat = getCurrentTimeFormat();
    if (currentTimeFormat === "hours") {
      return formatHourStyle(dateLike);
    }
    if (currentTimeFormat === "seconds") {
      return formatSecondStyle(dateLike);
    }
    return formatMinuteStyle(dateLike);
  }

  function formatCalendarTimeFromTemplatePayload(payload) {
    const currentTimeFormat = getCurrentTimeFormat();
    if (payload && typeof payload.hour === "number") {
      const hours = payload.hour;
      const minutes = typeof payload.minutes === "number" ? payload.minutes : 0;
      const totalMinutes = hours * 60 + minutes;

      if (currentTimeFormat === "hours") {
        return `${Math.floor(totalMinutes / 60)}hr`;
      }

      if (currentTimeFormat === "seconds") {
        return `${totalMinutes * 60}s`;
      }

      return `${totalMinutes}m`;
    }

    if (payload && payload.time) {
      return formatCalendarTime(payload.time);
    }

    if (currentTimeFormat === "hours") {
      return "12am";
    }
    if (currentTimeFormat === "seconds") {
      return "0s";
    }
    return "0m";
  }

  function convertAxisTimeToMinutes(text) {
    const normalized = String(text || "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const minuteMatch = normalized.match(/^(\d{1,4})m$/);
    if (minuteMatch) {
      return `${Number(minuteMatch[1])}m`;
    }

    const secondMatch = normalized.match(/^(\d{1,6})s$/);
    if (secondMatch) {
      return `${Math.floor(Number(secondMatch[1]) / 60)}m`;
    }

    const hourMatch = normalized.match(/^(\d{1,2})hr$/);
    if (hourMatch) {
      return `${Number(hourMatch[1]) * 60}m`;
    }

    const ampmMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)$/);
    if (ampmMatch) {
      let hour = Number(ampmMatch[1]) % 12;
      const minutes = Number(ampmMatch[2] || "0");
      const suffix = ampmMatch[4];
      if (suffix === "pm") {
        hour += 12;
      }
      return `${hour * 60 + minutes}m`;
    }

    const twentyFourMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (twentyFourMatch) {
      const hour = Number(twentyFourMatch[1]);
      const minutes = Number(twentyFourMatch[2]);
      return `${hour * 60 + minutes}m`;
    }

    return null;
  }

  function convertAxisTimeToSeconds(text) {
    const minuteLabel = convertAxisTimeToMinutes(text);
    if (!minuteLabel) {
      return null;
    }

    const minutes = Number(minuteLabel.replace("m", ""));
    if (Number.isNaN(minutes)) {
      return null;
    }

    return `${minutes * 60}s`;
  }

  function convertAxisTimeToHours(text) {
    const minuteLabel = convertAxisTimeToMinutes(text);
    if (!minuteLabel) {
      return null;
    }

    const minutes = Number(minuteLabel.replace("m", ""));
    if (Number.isNaN(minutes)) {
      return null;
    }

    return `${Math.floor(minutes / 60)}hr`;
  }

  function forceAxisLabelFormat() {
    const labelNodes = document.querySelectorAll(
      ".toastui-calendar-timegrid-time-column .toastui-calendar-timegrid-time-label"
    );
    const currentTimeFormat = getCurrentTimeFormat();

    labelNodes.forEach((node) => {
      if (!node.dataset.originalLabel) {
        node.dataset.originalLabel = node.textContent;
      }

      if (currentTimeFormat === "minutes") {
        const converted = convertAxisTimeToMinutes(node.dataset.originalLabel);
        if (converted) {
          node.textContent = converted;
        }
      } else if (currentTimeFormat === "seconds") {
        const converted = convertAxisTimeToSeconds(node.dataset.originalLabel);
        if (converted) {
          node.textContent = converted;
        }
      } else if (currentTimeFormat === "hours") {
        const converted = convertAxisTimeToHours(node.dataset.originalLabel);
        if (converted) {
          node.textContent = converted;
        }
      } else {
        node.textContent = node.dataset.originalLabel;
      }
    });
  }

  function createCalendarTemplates() {
    const weekdayRulerLookup = buildWeekdayRulerLookup(getReferenceData()?.planets);

    const getPlateFields = (event) => {
      const fromRawSign = event?.raw?.planetSymbol;
      const fromRawName = event?.raw?.planetName;

      if (fromRawSign || fromRawName) {
        return {
          sign: fromRawSign || "",
          name: fromRawName || ""
        };
      }

      const title = String(event?.title || "").trim();
      const beforeTarot = title.split("·")[0].trim();
      const parts = beforeTarot.split(/\s+/).filter(Boolean);

      if (parts.length >= 2) {
        return {
          sign: parts[0],
          name: parts.slice(1).join(" ")
        };
      }

      return {
        sign: "",
        name: beforeTarot
      };
    };

    const formatEventPlateText = (event) => {
      const timeLabel = formatCalendarTime(event.start);
      const { sign, name } = getPlateFields(event);
      const safeName = name || String(event?.title || "").trim();
      const safeSign = sign || "•";
      return `${timeLabel}\n${safeSign}\n${safeName}`;
    };

    const renderWeekDayHeader = (weekDayNameData) => {
      const dateNumber = String(weekDayNameData?.date ?? "").padStart(2, "0");
      const dayLabel = String(weekDayNameData?.dayName || "");
      const ruler = weekdayRulerLookup[weekDayNameData?.day] || { symbol: "•", name: "" };

      return [
        '<div class="weekday-header-template">',
        html`<span class="weekday-header-number">${dateNumber}</span>`,
        html`<span class="weekday-header-name">${dayLabel}</span>`,
        html`<span class="weekday-header-ruler" title="${ruler.name}">${ruler.symbol}</span>`,
        "</div>"
      ].join("");
    };

    return {
      timegridDisplayPrimaryTime: (props) => formatCalendarTimeFromTemplatePayload(props),
      timegridDisplayTime: (props) => formatCalendarTimeFromTemplatePayload(props),
      timegridNowIndicatorLabel: (props) => formatCalendarTimeFromTemplatePayload(props),
      weekDayName: (weekDayNameData) => renderWeekDayHeader(weekDayNameData),
      time: (event) => formatEventPlateText(event)
    };
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig
    };
  }

  window.TarotCalendarFormatting = {
    ...(window.TarotCalendarFormatting || {}),
    init,
    normalizeDateLike,
    createCalendarTemplates,
    forceAxisLabelFormat
  };
})();