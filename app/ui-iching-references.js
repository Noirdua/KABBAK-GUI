/* ui-iching-references.js — Month reference builders for the I Ching section */
(function () {
  "use strict";

  function buildMonthReferencesByHexagram(context) {
    const {
      referenceData,
      hexagrams,
      normalizePlanetInfluence,
      resolveAssociationPlanetInfluence
    } = context || {};

    if (
      typeof normalizePlanetInfluence !== "function"
      || typeof resolveAssociationPlanetInfluence !== "function"
    ) {
      return new Map();
    }

    const map = new Map();
    const months = Array.isArray(referenceData?.calendarMonths) ? referenceData.calendarMonths : [];
    const holidays = Array.isArray(referenceData?.celestialHolidays) ? referenceData.celestialHolidays : [];
    const monthById = new Map(months.map((month) => [month.id, month]));

    function parseMonthDayToken(value) {
      const text = String(value || "").trim();
      const match = text.match(/^(\d{1,2})-(\d{1,2})$/);
      if (!match) {
        return null;
      }

      const monthNo = Number(match[1]);
      const dayNo = Number(match[2]);
      if (!Number.isInteger(monthNo) || !Number.isInteger(dayNo) || monthNo < 1 || monthNo > 12 || dayNo < 1 || dayNo > 31) {
        return null;
      }

      return { month: monthNo, day: dayNo };
    }

    function parseMonthDayTokensFromText(value) {
      const text = String(value || "");
      const matches = [...text.matchAll(/(\d{1,2})-(\d{1,2})/g)];
      return matches
        .map((match) => ({ month: Number(match[1]), day: Number(match[2]) }))
        .filter((token) => Number.isInteger(token.month) && Number.isInteger(token.day) && token.month >= 1 && token.month <= 12 && token.day >= 1 && token.day <= 31);
    }

    function toDateToken(token, year) {
      if (!token) {
        return null;
      }
      return new Date(year, token.month - 1, token.day, 12, 0, 0, 0);
    }

    function splitMonthDayRangeByMonth(startToken, endToken) {
      const startDate = toDateToken(startToken, 2025);
      const endBase = toDateToken(endToken, 2025);
      if (!startDate || !endBase) {
        return [];
      }

      const wrapsYear = endBase.getTime() < startDate.getTime();
      const endDate = wrapsYear ? toDateToken(endToken, 2026) : endBase;
      if (!endDate) {
        return [];
      }

      const segments = [];
      let cursor = new Date(startDate);
      while (cursor.getTime() <= endDate.getTime()) {
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12, 0, 0, 0);
        const segmentEnd = monthEnd.getTime() < endDate.getTime() ? monthEnd : endDate;

        segments.push({
          monthNo: cursor.getMonth() + 1,
          startDay: cursor.getDate(),
          endDay: segmentEnd.getDate()
        });

        cursor = new Date(segmentEnd.getFullYear(), segmentEnd.getMonth(), segmentEnd.getDate() + 1, 12, 0, 0, 0);
      }

      return segments;
    }

    function tokenToString(monthNo, dayNo) {
      return `${String(monthNo).padStart(2, "0")}-${String(dayNo).padStart(2, "0")}`;
    }

    function formatRangeLabel(monthName, startDay, endDay) {
      if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) {
        return monthName;
      }
      if (startDay === endDay) {
        return `${monthName} ${startDay}`;
      }
      return `${monthName} ${startDay}-${endDay}`;
    }

    function resolveRangeForMonth(month, options = {}) {
      const monthOrder = Number(month?.order);
      const monthStart = parseMonthDayToken(month?.start);
      const monthEnd = parseMonthDayToken(month?.end);
      if (!Number.isFinite(monthOrder) || !monthStart || !monthEnd) {
        return {
          startToken: String(month?.start || "").trim() || null,
          endToken: String(month?.end || "").trim() || null,
          label: month?.name || month?.id || "",
          isFullMonth: true
        };
      }

      let startToken = parseMonthDayToken(options.startToken);
      let endToken = parseMonthDayToken(options.endToken);

      if (!startToken || !endToken) {
        const tokens = parseMonthDayTokensFromText(options.rawDateText);
        if (tokens.length >= 2) {
          startToken = tokens[0];
          endToken = tokens[1];
        } else if (tokens.length === 1) {
          startToken = tokens[0];
          endToken = tokens[0];
        }
      }

      if (!startToken || !endToken) {
        startToken = monthStart;
        endToken = monthEnd;
      }

      const segments = splitMonthDayRangeByMonth(startToken, endToken);
      const segment = segments.find((entry) => entry.monthNo === monthOrder) || null;

      const useStart = segment ? { month: monthOrder, day: segment.startDay } : startToken;
      const useEnd = segment ? { month: monthOrder, day: segment.endDay } : endToken;
      const startText = tokenToString(useStart.month, useStart.day);
      const endText = tokenToString(useEnd.month, useEnd.day);
      const isFullMonth = startText === month.start && endText === month.end;

      return {
        startToken: startText,
        endToken: endText,
        label: isFullMonth
          ? (month.name || month.id)
          : formatRangeLabel(month.name || month.id, useStart.day, useEnd.day),
        isFullMonth
      };
    }

    function pushRef(hexagramNumber, month, options = {}) {
      if (!Number.isFinite(hexagramNumber) || !month?.id) {
        return;
      }

      if (!map.has(hexagramNumber)) {
        map.set(hexagramNumber, []);
      }

      const rows = map.get(hexagramNumber);
      const range = resolveRangeForMonth(month, options);
      const rowKey = `${month.id}|${range.startToken || ""}|${range.endToken || ""}`;
      if (rows.some((entry) => entry.key === rowKey)) {
        return;
      }

      rows.push({
        id: month.id,
        name: month.name || month.id,
        order: Number.isFinite(Number(month.order)) ? Number(month.order) : 999,
        label: range.label,
        startToken: range.startToken,
        endToken: range.endToken,
        isFullMonth: range.isFullMonth,
        key: rowKey
      });
    }

    function collectRefs(associations, month, options = {}) {
      const associationInfluence = resolveAssociationPlanetInfluence(associations);
      if (!associationInfluence) {
        return;
      }

      (hexagrams || []).forEach((hexagram) => {
        const hexagramInfluence = normalizePlanetInfluence(hexagram?.planetaryInfluence);
        if (hexagramInfluence && hexagramInfluence === associationInfluence) {
          pushRef(hexagram.number, month, options);
        }
      });
    }

    months.forEach((month) => {
      collectRefs(month?.associations, month);
      const events = Array.isArray(month?.events) ? month.events : [];
      events.forEach((event) => {
        collectRefs(event?.associations, month, {
          rawDateText: event?.dateRange || event?.date || ""
        });
      });
    });

    holidays.forEach((holiday) => {
      const month = monthById.get(holiday?.monthId);
      if (!month) {
        return;
      }
      collectRefs(holiday?.associations, month, {
        rawDateText: holiday?.dateRange || holiday?.date || ""
      });
    });

    map.forEach((rows, key) => {
      const preciseMonthIds = new Set(
        rows
          .filter((entry) => !entry.isFullMonth)
          .map((entry) => entry.id)
      );

      const filtered = rows.filter((entry) => {
        if (!entry.isFullMonth) {
          return true;
        }
        return !preciseMonthIds.has(entry.id);
      });

      filtered.sort((left, right) => {
        if (left.order !== right.order) {
          return left.order - right.order;
        }

        const startLeft = parseMonthDayToken(left.startToken);
        const startRight = parseMonthDayToken(right.startToken);
        const dayLeft = startLeft ? startLeft.day : 999;
        const dayRight = startRight ? startRight.day : 999;
        if (dayLeft !== dayRight) {
          return dayLeft - dayRight;
        }

        return String(left.label || left.name || "").localeCompare(String(right.label || right.name || ""));
      });

      map.set(key, filtered);
    });

    return map;
  }

  window.IChingReferenceBuilders = {
    buildMonthReferencesByHexagram
  };
})();