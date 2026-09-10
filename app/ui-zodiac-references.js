/* ui-zodiac-references.js — Month and cube reference builders for the zodiac section */
(function () {
  "use strict";

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function cap(value) {
    return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
  }

  function formatDateRange(rulesFrom) {
    if (!Array.isArray(rulesFrom) || rulesFrom.length < 2) return "—";
    const [from, to] = rulesFrom;
    const fMonth = MONTH_NAMES[(from[0] || 1) - 1];
    const tMonth = MONTH_NAMES[(to[0] || 1) - 1];
    return `${fMonth} ${from[1]} – ${tMonth} ${to[1]}`;
  }

  function buildMonthReferencesBySign(referenceData) {
    const map = new Map();
    const months = Array.isArray(referenceData?.calendarMonths) ? referenceData.calendarMonths : [];
    const holidays = Array.isArray(referenceData?.celestialHolidays) ? referenceData.celestialHolidays : [];
    const signs = Array.isArray(referenceData?.signs) ? referenceData.signs : [];
    const monthById = new Map(months.map((month) => [month.id, month]));
    const monthByOrder = new Map(
      months
        .filter((month) => Number.isFinite(Number(month?.order)))
        .map((month) => [Number(month.order), month])
    );

    function parseMonthDay(value) {
      const [month, day] = String(value || "").split("-").map((part) => Number(part));
      if (!Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
      }
      return { month, day };
    }

    function monthOrdersInRange(startMonth, endMonth) {
      const orders = [];
      let cursor = startMonth;
      let guard = 0;

      while (guard < 13) {
        orders.push(cursor);
        if (cursor === endMonth) {
          break;
        }
        cursor = cursor === 12 ? 1 : cursor + 1;
        guard += 1;
      }

      return orders;
    }

    function pushRef(signId, month) {
      const key = String(signId || "").trim().toLowerCase();
      if (!key || !month?.id) {
        return;
      }

      if (!map.has(key)) {
        map.set(key, []);
      }

      const rows = map.get(key);
      if (rows.some((entry) => entry.id === month.id)) {
        return;
      }

      rows.push({
        id: month.id,
        name: month.name || month.id,
        order: Number.isFinite(Number(month.order)) ? Number(month.order) : 999
      });
    }

    months.forEach((month) => {
      pushRef(month?.associations?.zodiacSignId, month);
      const events = Array.isArray(month?.events) ? month.events : [];
      events.forEach((event) => {
        pushRef(event?.associations?.zodiacSignId, month);
      });
    });

    holidays.forEach((holiday) => {
      const month = monthById.get(holiday?.monthId);
      if (!month) {
        return;
      }
      pushRef(holiday?.associations?.zodiacSignId, month);
    });

    signs.forEach((sign) => {
      const start = parseMonthDay(sign?.start);
      const end = parseMonthDay(sign?.end);
      if (!start || !end || !sign?.id) {
        return;
      }

      monthOrdersInRange(start.month, end.month).forEach((monthOrder) => {
        const month = monthByOrder.get(monthOrder);
        if (month) {
          pushRef(sign.id, month);
        }
      });
    });

    map.forEach((rows, key) => {
      rows.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
      map.set(key, rows);
    });

    return map;
  }

  function buildCubeSignPlacements(magickDataset) {
    const placements = new Map();
    const cube = magickDataset?.grouped?.kabbalah?.cube || {};
    const walls = Array.isArray(cube?.walls)
      ? cube.walls
      : [];
    const edges = Array.isArray(cube?.edges)
      ? cube.edges
      : [];
    const paths = Array.isArray(magickDataset?.grouped?.kabbalah?.["kabbalah-tree"]?.paths)
      ? magickDataset.grouped.kabbalah["kabbalah-tree"].paths
      : [];

    function normalizeLetterId(value) {
      const key = String(value || "").toLowerCase().replace(/[^a-z]/g, "").trim();
      const aliases = {
        aleph: "alef",
        beth: "bet",
        heh: "he",
        zain: "zayin",
        cheth: "het",
        chet: "het",
        daleth: "dalet",
        teth: "tet",
        peh: "pe",
        tzaddi: "tsadi",
        tzadi: "tsadi",
        tzade: "tsadi",
        tsaddi: "tsadi",
        qoph: "qof",
        taw: "tav",
        tau: "tav"
      };
      return aliases[key] || key;
    }

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
        .map((part) => cap(part))
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

    const wallById = new Map(
      walls.map((wall) => [String(wall?.id || "").trim().toLowerCase(), wall])
    );

    const pathByLetterId = new Map(
      paths
        .map((path) => [normalizeLetterId(path?.hebrewLetter?.transliteration), path])
        .filter(([letterId]) => Boolean(letterId))
    );

    edges.forEach((edge) => {
      const letterId = normalizeLetterId(edge?.hebrewLetterId || edge?.associations?.hebrewLetterId);
      const path = pathByLetterId.get(letterId) || null;
      const signId = path?.astrology?.type === "zodiac"
        ? String(path?.astrology?.name || "").trim().toLowerCase()
        : "";

      if (!signId || placements.has(signId)) {
        return;
      }

      const wallsForEdge = edgeWalls(edge);
      const primaryWallId = wallsForEdge[0] || "";
      const primaryWall = wallById.get(primaryWallId);

      placements.set(signId, {
        wallId: primaryWallId,
        edgeId: String(edge?.id || "").trim().toLowerCase(),
        wallName: primaryWall?.name || cap(primaryWallId || "wall"),
        edgeName: resolveCubeDirectionLabel(primaryWallId, edge)
      });
    });

    return placements;
  }

  function cubePlacementLabel(placement) {
    const wallName = placement?.wallName || "Wall";
    const edgeName = placement?.edgeName || "Direction";
    return `Cube: ${wallName} Wall - ${edgeName}`;
  }

  window.ZodiacReferenceBuilders = {
    buildCubeSignPlacements,
    buildMonthReferencesBySign,
    cubePlacementLabel,
    formatDateRange
  };
})();