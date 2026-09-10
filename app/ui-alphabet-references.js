/* ui-alphabet-references.js — Alphabet calendar and cube reference builders */
(function () {
  "use strict";

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function cap(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
  }

  function buildMonthReferencesByHebrew(referenceData, alphabets) {
    const map = new Map();
    const months = Array.isArray(referenceData?.calendarMonths) ? referenceData.calendarMonths : [];
    const holidays = Array.isArray(referenceData?.celestialHolidays) ? referenceData.celestialHolidays : [];
    const monthById = new Map(months.map((month) => [month.id, month]));
    const hebrewLetters = Array.isArray(alphabets?.hebrew) ? alphabets.hebrew : [];

    const profiles = hebrewLetters
      .filter((letter) => letter?.hebrewLetterId)
      .map((letter) => {
        const astrologyType = normalizeId(letter?.astrology?.type);
        const astrologyName = normalizeId(letter?.astrology?.name);
        return {
          hebrewLetterId: normalizeId(letter.hebrewLetterId),
          tarotTrumpNumber: Number.isFinite(Number(letter?.tarot?.trumpNumber))
            ? Number(letter.tarot.trumpNumber)
            : null,
          kabbalahPathNumber: Number.isFinite(Number(letter?.kabbalahPathNumber))
            ? Number(letter.kabbalahPathNumber)
            : null,
          planetId: astrologyType === "planet" ? astrologyName : "",
          zodiacSignId: astrologyType === "zodiac" ? astrologyName : ""
        };
      });

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

    function pushRef(hebrewLetterId, month, options = {}) {
      if (!hebrewLetterId || !month?.id) {
        return;
      }

      if (!map.has(hebrewLetterId)) {
        map.set(hebrewLetterId, []);
      }

      const rows = map.get(hebrewLetterId);
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
      if (!associations || typeof associations !== "object") {
        return;
      }

      const assocHebrewId = normalizeId(associations.hebrewLetterId);
      const assocTarotTrump = Number.isFinite(Number(associations.tarotTrumpNumber))
        ? Number(associations.tarotTrumpNumber)
        : null;
      const assocPath = Number.isFinite(Number(associations.kabbalahPathNumber))
        ? Number(associations.kabbalahPathNumber)
        : null;
      const assocPlanetId = normalizeId(associations.planetId);
      const assocSignId = normalizeId(associations.zodiacSignId);

      profiles.forEach((profile) => {
        if (!profile.hebrewLetterId) {
          return;
        }

        const matchesDirect = assocHebrewId && assocHebrewId === profile.hebrewLetterId;
        const matchesTarot = assocTarotTrump != null && profile.tarotTrumpNumber === assocTarotTrump;
        const matchesPath = assocPath != null && profile.kabbalahPathNumber === assocPath;
        const matchesPlanet = profile.planetId && assocPlanetId && profile.planetId === assocPlanetId;
        const matchesZodiac = profile.zodiacSignId && assocSignId && profile.zodiacSignId === assocSignId;

        if (matchesDirect || matchesTarot || matchesPath || matchesPlanet || matchesZodiac) {
          pushRef(profile.hebrewLetterId, month, options);
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

  function createEmptyCubeRefs() {
    return {
      hebrewPlacementById: new Map(),
      signPlacementById: new Map(),
      planetPlacementById: new Map(),
      pathPlacementByNo: new Map()
    };
  }

  function normalizeLetterId(value) {
    const key = normalizeId(value).replace(/[^a-z]/g, "");
    const aliases = {
      aleph: "alef",
      beth: "bet",
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
      ? edge.walls.map((wallId) => normalizeId(wallId)).filter(Boolean)
      : [];

    if (explicitWalls.length >= 2) {
      return explicitWalls.slice(0, 2);
    }

    return normalizeId(edge?.id)
      .split("-")
      .map((wallId) => normalizeId(wallId))
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
    const normalizedWallId = normalizeId(wallId);
    const edgeId = normalizeId(edge?.id);
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

  function makeCubePlacement(wall, edge = null) {
    const wallId = normalizeId(wall?.id);
    const edgeId = normalizeId(edge?.id);
    return {
      wallId,
      edgeId,
      wallName: wall?.name || cap(wallId),
      edgeName: resolveCubeDirectionLabel(wallId, edge)
    };
  }

  function setPlacementIfMissing(map, key, placement) {
    if (!key || map.has(key) || !placement?.wallId) {
      return;
    }
    map.set(key, placement);
  }

  function buildCubeReferences(magickDataset) {
    const refs = createEmptyCubeRefs();
    const cube = magickDataset?.grouped?.kabbalah?.cube || {};
    const walls = Array.isArray(cube?.walls) ? cube.walls : [];
    const edges = Array.isArray(cube?.edges) ? cube.edges : [];
    const paths = Array.isArray(magickDataset?.grouped?.kabbalah?.["kabbalah-tree"]?.paths)
      ? magickDataset.grouped.kabbalah["kabbalah-tree"].paths
      : [];

    const wallById = new Map(
      walls.map((wall) => [normalizeId(wall?.id), wall])
    );
    const firstEdgeByWallId = new Map();

    const pathByLetterId = new Map(
      paths
        .map((path) => [normalizeLetterId(path?.hebrewLetter?.transliteration), path])
        .filter(([letterId]) => Boolean(letterId))
    );

    edges.forEach((edge) => {
      edgeWalls(edge).forEach((wallId) => {
        if (!firstEdgeByWallId.has(wallId)) {
          firstEdgeByWallId.set(wallId, edge);
        }
      });
    });

    walls.forEach((wall) => {
      const wallHebrewLetterId = normalizeLetterId(wall?.hebrewLetterId || wall?.associations?.hebrewLetterId);

      let wallPlacement;
      if (wallHebrewLetterId) {
        wallPlacement = {
          wallId: normalizeId(wall?.id),
          edgeId: "",
          wallName: wall?.name || cap(normalizeId(wall?.id)),
          edgeName: "Face"
        };
      } else {
        const placementEdge = firstEdgeByWallId.get(normalizeId(wall?.id)) || null;
        wallPlacement = makeCubePlacement(wall, placementEdge);
      }

      setPlacementIfMissing(refs.hebrewPlacementById, wallHebrewLetterId, wallPlacement);

      const wallPath = pathByLetterId.get(wallHebrewLetterId) || null;
      const wallSignId = normalizeId(wallPath?.astrology?.type) === "zodiac"
        ? normalizeId(wallPath?.astrology?.name)
        : "";
      setPlacementIfMissing(refs.signPlacementById, wallSignId, wallPlacement);

      const wallPathNo = Number(wallPath?.pathNumber);
      if (Number.isFinite(wallPathNo)) {
        setPlacementIfMissing(refs.pathPlacementByNo, wallPathNo, wallPlacement);
      }

      const wallPlanet = normalizeId(wall?.associations?.planetId);
      if (wallPlanet) {
        setPlacementIfMissing(refs.planetPlacementById, wallPlanet, wallPlacement);
      }
    });

    edges.forEach((edge) => {
      const wallsForEdge = edgeWalls(edge);
      const primaryWallId = wallsForEdge[0];
      const primaryWall = wallById.get(primaryWallId) || {
        id: primaryWallId,
        name: cap(primaryWallId)
      };

      const placement = makeCubePlacement(primaryWall, edge);
      const hebrewLetterId = normalizeLetterId(edge?.hebrewLetterId || edge?.associations?.hebrewLetterId);
      setPlacementIfMissing(refs.hebrewPlacementById, hebrewLetterId, placement);

      const path = pathByLetterId.get(hebrewLetterId) || null;
      const signId = normalizeId(path?.astrology?.type) === "zodiac"
        ? normalizeId(path?.astrology?.name)
        : "";
      setPlacementIfMissing(refs.signPlacementById, signId, placement);

      const pathNo = Number(path?.pathNumber);
      if (Number.isFinite(pathNo)) {
        setPlacementIfMissing(refs.pathPlacementByNo, pathNo, placement);
      }
    });

    return refs;
  }

  window.AlphabetReferenceBuilders = {
    buildMonthReferencesByHebrew,
    buildCubeReferences
  };
})();