(function () {
  "use strict";

  function buildMonthReferencesByPlanet(context) {
    const { referenceData, toPlanetId, normalizePlanetToken } = context;
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

    function pushRef(planetToken, month, options = {}) {
      const planetId = toPlanetId(planetToken) || normalizePlanetToken(planetToken);
      if (!planetId || !month?.id) {
        return;
      }

      if (!map.has(planetId)) {
        map.set(planetId, []);
      }

      const rows = map.get(planetId);
      const range = resolveRangeForMonth(month, options);
      const key = `${month.id}|${range.startToken || ""}|${range.endToken || ""}`;
      if (rows.some((entry) => entry.key === key)) {
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
        key
      });
    }

    months.forEach((month) => {
      pushRef(month?.associations?.planetId, month);
      const events = Array.isArray(month?.events) ? month.events : [];
      events.forEach((event) => {
        pushRef(event?.associations?.planetId, month, {
          rawDateText: event?.dateRange || event?.date || ""
        });
      });
    });

    holidays.forEach((holiday) => {
      const month = monthById.get(holiday?.monthId);
      if (!month) {
        return;
      }
      pushRef(holiday?.associations?.planetId, month, {
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

  function buildCubePlacementsByPlanet(context) {
    const { magickDataset, toPlanetId } = context;
    const map = new Map();
    const cube = magickDataset?.grouped?.kabbalah?.cube || {};
    const walls = Array.isArray(cube?.walls)
      ? cube.walls
      : [];
    const edges = Array.isArray(cube?.edges)
      ? cube.edges
      : [];

    function edgeWalls(edge) {
      const explicitWalls = Array.isArray(edge?.walls)
        ? edge.walls.map((wallId) => String(wallId || "").trim().toLowerCase()).filter(Boolean)
        : [];

      if (explicitWalls.length >= 2) {
        return explicitWalls.slice(0, 2);
      }

      return String(edge?.id || "")
        .trim()
        .toLowerCase()
        .split("-")
        .map((wallId) => wallId.trim())
        .filter(Boolean)
        .slice(0, 2);
    }

    function edgeLabel(edge) {
      const explicitName = String(edge?.name || "").trim();
      if (explicitName) {
        return explicitName;
      }
      return edgeWalls(edge)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    }

    function resolveCubeDirectionLabel(wallId, edge) {
      const normalizedWallId = String(wallId || "").trim().toLowerCase();
      const edgeId = String(edge?.id || "").trim().toLowerCase();
      if (!normalizedWallId || !edgeId) {
        return "";
      }

      const cubeUi = window.CubeSectionUi;
      if (cubeUi && typeof cubeUi.getEdgeDirectionLabelForWall === "function") {
        const directionLabel = String(cubeUi.getEdgeDirectionLabelForWall(normalizedWallId, edgeId) || "").trim();
        if (directionLabel) {
          return directionLabel;
        }
      }

      return edgeLabel(edge);
    }

    const firstEdgeByWallId = new Map();
    edges.forEach((edge) => {
      edgeWalls(edge).forEach((wallId) => {
        if (!firstEdgeByWallId.has(wallId)) {
          firstEdgeByWallId.set(wallId, edge);
        }
      });
    });

    function pushPlacement(planetId, placement) {
      if (!planetId || !placement?.wallId || !placement?.edgeId) {
        return;
      }

      if (!map.has(planetId)) {
        map.set(planetId, []);
      }

      const rows = map.get(planetId);
      const key = `${placement.wallId}:${placement.edgeId}`;
      if (rows.some((row) => `${row.wallId}:${row.edgeId}` === key)) {
        return;
      }

      rows.push(placement);
    }

    walls.forEach((wall) => {
      const planetId = toPlanetId(wall?.associations?.planetId || wall?.planet);
      if (!planetId) {
        return;
      }

      const wallId = String(wall?.id || "").trim().toLowerCase();
      const edge = firstEdgeByWallId.get(wallId) || null;

      pushPlacement(planetId, {
        wallId,
        edgeId: String(edge?.id || "").trim().toLowerCase(),
        label: `Cube: ${wall?.name || "Wall"} Wall - ${resolveCubeDirectionLabel(wallId, edge) || "Direction"}`
      });
    });

    return map;
  }

  window.PlanetReferenceBuilders = {
    buildMonthReferencesByPlanet,
    buildCubePlacementsByPlanet
  };
})();