(function () {
  "use strict";

  function createCubeSelectionHelpers(dependencies) {
    const {
      state,
      normalizeId,
      normalizeEdgeId,
      normalizeLetterKey,
      toFiniteNumber,
      getWalls,
      getWallById,
      getEdges,
      getEdgeById,
      getEdgeWalls,
      getEdgesForWall,
      getEdgeLetterId,
      getWallFaceLetterId,
      getEdgePathEntry,
      getConnectorById,
      snapRotationToWall,
      render,
      getElements
    } = dependencies || {};

    function applyPlacement(placement) {
      const fallbackWallId = normalizeId(getWalls()[0]?.id);
      const nextWallId = normalizeId(placement?.wallId || placement?.wall?.id || state.selectedWallId || fallbackWallId);
      const wall = getWallById(nextWallId);
      if (!wall) {
        return false;
      }

      state.selectedWallId = normalizeId(wall.id);

      const candidateEdgeId = normalizeEdgeId(placement?.edgeId || placement?.edge?.id);
      const wallEdges = getEdgesForWall(state.selectedWallId);
      const resolvedEdgeId = candidateEdgeId && getEdgeById(candidateEdgeId)
        ? candidateEdgeId
        : normalizeEdgeId(wallEdges[0]?.id || getEdges()[0]?.id);
      const wantsEdgeDetail = Boolean(candidateEdgeId) || normalizeId(placement?.nodeType) === "edge";

      state.selectedEdgeId = resolvedEdgeId;
      state.selectedNodeType = wantsEdgeDetail ? "edge" : "wall";
      state.selectedConnectorId = null;
      render(getElements());
      return true;
    }

    function selectEdgeById(edgeId, preferredWallId = "") {
      const edge = getEdgeById(edgeId);
      if (!edge) {
        return false;
      }

      const currentWallId = normalizeId(state.selectedWallId);
      const preferredId = normalizeId(preferredWallId);
      const edgeWalls = getEdgeWalls(edge);
      const nextWallId = preferredId && edgeWalls.includes(preferredId)
        ? preferredId
        : (edgeWalls.includes(currentWallId) ? currentWallId : (edgeWalls[0] || currentWallId));

      state.selectedEdgeId = normalizeEdgeId(edge.id);
      state.selectedNodeType = "edge";
      state.selectedConnectorId = null;

      if (nextWallId) {
        if (nextWallId !== currentWallId) {
          state.selectedWallId = nextWallId;
          snapRotationToWall(nextWallId);
        } else if (!state.selectedWallId) {
          state.selectedWallId = nextWallId;
        }
      }

      render(getElements());
      return true;
    }

    function selectWallById(wallId) {
      if (!state.initialized) {
        return false;
      }

      const wall = getWallById(wallId);
      if (!wall) {
        return false;
      }

      state.selectedWallId = normalizeId(wall.id);
      state.selectedEdgeId = normalizeEdgeId(getEdgesForWall(state.selectedWallId)[0]?.id || getEdges()[0]?.id);
      state.selectedNodeType = "wall";
      state.selectedConnectorId = null;
      snapRotationToWall(state.selectedWallId);
      render(getElements());
      return true;
    }

    function selectConnectorById(connectorId) {
      if (!state.initialized) {
        return false;
      }

      const connector = getConnectorById(connectorId);
      if (!connector) {
        return false;
      }

      const fromWallId = normalizeId(connector.fromWallId);
      if (fromWallId && getWallById(fromWallId)) {
        state.selectedWallId = fromWallId;
        state.selectedEdgeId = normalizeEdgeId(getEdgesForWall(fromWallId)[0]?.id || getEdges()[0]?.id);
        snapRotationToWall(fromWallId);
      }

      state.showConnectorLines = true;
      state.selectedNodeType = "connector";
      state.selectedConnectorId = normalizeId(connector.id);
      render(getElements());
      return true;
    }

    function selectCenterNode() {
      if (!state.initialized) {
        return false;
      }

      state.showPrimalPoint = true;
      state.selectedNodeType = "center";
      state.selectedConnectorId = null;
      render(getElements());
      return true;
    }

    function selectPlacement(criteria = {}) {
      if (!state.initialized) {
        return false;
      }

      const wallId = normalizeId(criteria.wallId);
      const connectorId = normalizeId(criteria.connectorId);
      const edgeId = normalizeEdgeId(criteria.edgeId || criteria.directionId);
      const hebrewLetterId = normalizeLetterKey(criteria.hebrewLetterId);
      const signId = normalizeId(criteria.signId || criteria.zodiacSignId);
      const planetId = normalizeId(criteria.planetId);
      const pathNo = toFiniteNumber(criteria.pathNo || criteria.kabbalahPathNumber);
      const trumpNo = toFiniteNumber(criteria.trumpNumber || criteria.tarotTrumpNumber);
      const nodeType = normalizeId(criteria.nodeType);
      const centerRequested = nodeType === "center"
        || Boolean(criteria.center)
        || Boolean(criteria.primalPoint)
        || normalizeId(criteria.centerId) === "primal-point";
      const edges = getEdges();

      const findEdgeBy = (predicate) => edges.find((edge) => predicate(edge)) || null;

      const findWallForEdge = (edge, preferredWallId) => {
        const edgeWalls = getEdgeWalls(edge);
        if (preferredWallId && edgeWalls.includes(preferredWallId)) {
          return preferredWallId;
        }
        return edgeWalls[0] || normalizeId(getWalls()[0]?.id);
      };

      if (connectorId) {
        return selectConnectorById(connectorId);
      }

      if (centerRequested) {
        return selectCenterNode();
      }

      if (edgeId) {
        const edge = getEdgeById(edgeId);
        if (!edge) {
          return false;
        }
        return applyPlacement({
          wallId: findWallForEdge(edge, wallId),
          edgeId
        });
      }

      if (wallId) {
        const wall = getWallById(wallId);
        if (!wall) {
          return false;
        }

        if (!edgeId) {
          return selectWallById(wallId);
        }

        const firstEdge = getEdgesForWall(wallId)[0] || null;
        return applyPlacement({ wallId, edgeId: firstEdge?.id });
      }

      if (hebrewLetterId) {
        const byHebrew = findEdgeBy((edge) => getEdgeLetterId(edge) === hebrewLetterId);
        if (byHebrew) {
          return applyPlacement({
            wallId: findWallForEdge(byHebrew),
            edgeId: byHebrew.id
          });
        }

        const byWallFace = getWalls().find((wall) => getWallFaceLetterId(wall) === hebrewLetterId) || null;
        if (byWallFace) {
          const byWallFaceId = normalizeId(byWallFace.id);
          const firstEdge = getEdgesForWall(byWallFaceId)[0] || null;
          return applyPlacement({ wallId: byWallFaceId, edgeId: firstEdge?.id });
        }
      }

      if (signId) {
        const bySign = findEdgeBy((edge) => {
          const astrology = getEdgePathEntry(edge)?.astrology || {};
          return normalizeId(astrology.type) === "zodiac" && normalizeId(astrology.name) === signId;
        });
        if (bySign) {
          return applyPlacement({
            wallId: findWallForEdge(bySign),
            edgeId: bySign.id
          });
        }
      }

      if (pathNo != null) {
        const byPath = findEdgeBy((edge) => toFiniteNumber(getEdgePathEntry(edge)?.pathNumber) === pathNo);
        if (byPath) {
          return applyPlacement({
            wallId: findWallForEdge(byPath),
            edgeId: byPath.id
          });
        }
      }

      if (trumpNo != null) {
        const byTrump = findEdgeBy((edge) => {
          const tarot = getEdgePathEntry(edge)?.tarot || {};
          return toFiniteNumber(tarot.trumpNumber) === trumpNo;
        });
        if (byTrump) {
          return applyPlacement({
            wallId: findWallForEdge(byTrump),
            edgeId: byTrump.id
          });
        }
      }

      if (planetId) {
        const wall = getWalls().find((entry) => normalizeId(entry?.associations?.planetId) === planetId);
        if (wall) {
          const wallIdByPlanet = normalizeId(wall.id);
          return applyPlacement({
            wallId: wallIdByPlanet,
            edgeId: getEdgesForWall(wallIdByPlanet)[0]?.id
          });
        }
      }

      return false;
    }

    return {
      applyPlacement,
      selectEdgeById,
      selectWallById,
      selectConnectorById,
      selectCenterNode,
      selectPlacement
    };
  }

  window.CubeSelectionHelpers = {
    createCubeSelectionHelpers
  };
})();