(function () {
  "use strict";

  function createCubeMathHelpers(dependencies) {
    const {
      state,
      CUBE_VERTICES,
      FACE_GEOMETRY,
      EDGE_GEOMETRY,
      EDGE_GEOMETRY_KEYS,
      CUBE_VIEW_CENTER,
      WALL_FRONT_ROTATIONS,
      LOCAL_DIRECTION_VIEW_MAP,
      normalizeId,
      normalizeLetterKey,
      normalizeEdgeId,
      formatDirectionName,
      getEdgesForWall,
      getEdgePathEntry,
      getEdgeLetterId,
      getCubeCenterData
    } = dependencies || {};

    function normalizeAngle(angle) {
      let next = angle;
      while (next > 180) {
        next -= 360;
      }
      while (next <= -180) {
        next += 360;
      }
      return next;
    }

    function setRotation(nextX, nextY) {
      state.rotationX = normalizeAngle(nextX);
      state.rotationY = normalizeAngle(nextY);
    }

    function snapRotationToWall(wallId) {
      const target = WALL_FRONT_ROTATIONS[normalizeId(wallId)];
      if (!target) {
        return;
      }
      setRotation(target.x, target.y);
    }

    function facePoint(quad, u, v) {
      const weight0 = ((1 - u) * (1 - v)) / 4;
      const weight1 = ((1 + u) * (1 - v)) / 4;
      const weight2 = ((1 + u) * (1 + v)) / 4;
      const weight3 = ((1 - u) * (1 + v)) / 4;

      return {
        x: quad[0].x * weight0 + quad[1].x * weight1 + quad[2].x * weight2 + quad[3].x * weight3,
        y: quad[0].y * weight0 + quad[1].y * weight1 + quad[2].y * weight2 + quad[3].y * weight3
      };
    }

    function projectVerticesForRotation(rotationX, rotationY) {
      const yaw = (rotationY * Math.PI) / 180;
      const pitch = (rotationX * Math.PI) / 180;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosX = Math.cos(pitch);
      const sinX = Math.sin(pitch);

      const centerX = CUBE_VIEW_CENTER.x;
      const centerY = CUBE_VIEW_CENTER.y;
      const scale = 54;
      const camera = 4.6;

      return CUBE_VERTICES.map(([x, y, z]) => {
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        const perspective = camera / (camera - z2);

        return {
          x: centerX + x1 * scale * perspective,
          y: centerY + y2 * scale * perspective,
          z: z2
        };
      });
    }

    function projectVertices() {
      return projectVerticesForRotation(state.rotationX, state.rotationY);
    }

    function getEdgeGeometryById(edgeId) {
      const canonicalId = normalizeEdgeId(edgeId);
      const geometryIndex = EDGE_GEOMETRY_KEYS.indexOf(canonicalId);
      if (geometryIndex < 0) {
        return null;
      }
      return EDGE_GEOMETRY[geometryIndex] || null;
    }

    function getWallEdgeDirections(wallOrWallId) {
      const wallId = normalizeId(typeof wallOrWallId === "string" ? wallOrWallId : wallOrWallId?.id);
      const faceIndices = FACE_GEOMETRY[wallId];
      if (!Array.isArray(faceIndices) || faceIndices.length !== 4) {
        return new Map();
      }

      const frontRotation = WALL_FRONT_ROTATIONS[wallId] || {
        x: state.rotationX,
        y: state.rotationY
      };
      const projectedVertices = projectVerticesForRotation(frontRotation.x, frontRotation.y);
      const quad = faceIndices.map((index) => projectedVertices[index]);
      const center = facePoint(quad, 0, 0);
      const directionsByEdgeId = new Map();

      getEdgesForWall(wallId).forEach((edge) => {
        const geometry = getEdgeGeometryById(edge?.id);
        if (!geometry) {
          return;
        }

        const [fromIndex, toIndex] = geometry;
        const from = projectedVertices[fromIndex];
        const to = projectedVertices[toIndex];
        if (!from || !to) {
          return;
        }

        const midpointX = (from.x + to.x) / 2;
        const midpointY = (from.y + to.y) / 2;
        const dx = midpointX - center.x;
        const dy = midpointY - center.y;

        const directionByPosition = Math.abs(dx) >= Math.abs(dy)
          ? (dx >= 0 ? "east" : "west")
          : (dy >= 0 ? "south" : "north");
        const direction = LOCAL_DIRECTION_VIEW_MAP[directionByPosition] || directionByPosition;

        directionsByEdgeId.set(normalizeEdgeId(edge?.id), direction);
      });

      return directionsByEdgeId;
    }

    function getEdgeDirectionForWall(wallId, edgeId) {
      const wallKey = normalizeId(wallId);
      const edgeKey = normalizeEdgeId(edgeId);
      if (!wallKey || !edgeKey) {
        return "";
      }

      const directions = getWallEdgeDirections(wallKey);
      return directions.get(edgeKey) || "";
    }

    function getEdgeDirectionLabelForWall(wallId, edgeId) {
      return formatDirectionName(getEdgeDirectionForWall(wallId, edgeId));
    }

    function getHebrewLetterSymbol(hebrewLetterId) {
      const id = normalizeLetterKey(hebrewLetterId);
      if (!id || !state.hebrewLetters) {
        return "";
      }

      const entry = state.hebrewLetters[id];
      if (!entry || typeof entry !== "object") {
        return "";
      }

      const symbol = String(
        entry?.letter?.he || entry?.he || entry?.glyph || entry?.symbol || ""
      ).trim();

      return symbol;
    }

    function getHebrewLetterName(hebrewLetterId) {
      const id = normalizeLetterKey(hebrewLetterId);
      if (!id || !state.hebrewLetters) {
        return "";
      }

      const entry = state.hebrewLetters[id];
      if (!entry || typeof entry !== "object") {
        return "";
      }

      const name = String(entry?.letter?.name || entry?.name || "").trim();
      return name;
    }

    function getAstrologySymbol(type, name) {
      const normalizedType = normalizeId(type);
      const normalizedName = normalizeId(name);

      const planetSymbols = {
        mercury: "☿︎",
        venus: "♀︎",
        mars: "♂︎",
        jupiter: "♃︎",
        saturn: "♄︎",
        sol: "☉︎",
        sun: "☉︎",
        luna: "☾︎",
        moon: "☾︎",
        earth: "⊕",
        uranus: "♅︎",
        neptune: "♆︎",
        pluto: "♇︎"
      };

      const zodiacSymbols = {
        aries: "♈︎",
        taurus: "♉︎",
        gemini: "♊︎",
        cancer: "♋︎",
        leo: "♌︎",
        virgo: "♍︎",
        libra: "♎︎",
        scorpio: "♏︎",
        sagittarius: "♐︎",
        capricorn: "♑︎",
        aquarius: "♒︎",
        pisces: "♓︎"
      };

      const elementSymbols = {
        fire: "🜂",
        water: "🜄",
        air: "🜁",
        earth: "🜃",
        spirit: "🜀"
      };

      if (normalizedType === "planet") {
        return planetSymbols[normalizedName] || "";
      }

      if (normalizedType === "zodiac") {
        return zodiacSymbols[normalizedName] || "";
      }

      if (normalizedType === "element") {
        return elementSymbols[normalizedName] || "";
      }

      return "";
    }

    function getCenterLetterId(center = null) {
      const entry = center || getCubeCenterData();
      return normalizeLetterKey(entry?.hebrewLetterId || entry?.associations?.hebrewLetterId || entry?.letter);
    }

    function getCenterLetterSymbol(center = null) {
      const centerLetterId = getCenterLetterId(center);
      if (!centerLetterId) {
        return "";
      }
      return getHebrewLetterSymbol(centerLetterId);
    }

    function getEdgeAstrologySymbol(edge) {
      const pathEntry = getEdgePathEntry(edge);
      const astrology = pathEntry?.astrology || {};
      return getAstrologySymbol(astrology.type, astrology.name);
    }

    function getEdgeLetter(edge) {
      const hebrewLetterId = getEdgeLetterId(edge);
      if (!hebrewLetterId) {
        return "";
      }

      return getHebrewLetterSymbol(hebrewLetterId);
    }

    function getEdgeMarkerDisplay(edge) {
      const letter = getEdgeLetter(edge);
      const astro = getEdgeAstrologySymbol(edge);

      if (state.markerDisplayMode === "letter") {
        return letter
          ? { text: letter, isMissing: false }
          : { text: "!", isMissing: true };
      }

      if (state.markerDisplayMode === "astro") {
        return astro
          ? { text: astro, isMissing: false }
          : { text: "!", isMissing: true };
      }

      if (letter && astro) {
        return { text: `${letter} ${astro}`, isMissing: false };
      }

      return { text: "!", isMissing: true };
    }

    return {
      normalizeAngle,
      setRotation,
      snapRotationToWall,
      facePoint,
      projectVerticesForRotation,
      projectVertices,
      getEdgeGeometryById,
      getWallEdgeDirections,
      getEdgeDirectionForWall,
      getEdgeDirectionLabelForWall,
      getHebrewLetterSymbol,
      getHebrewLetterName,
      getAstrologySymbol,
      getCenterLetterId,
      getCenterLetterSymbol,
      getEdgeAstrologySymbol,
      getEdgeMarkerDisplay,
      getEdgeLetter
    };
  }

  window.CubeMathHelpers = {
    createCubeMathHelpers
  };
})();