(function () {
  "use strict";

  function renderFaceSvg(context) {
    const {
      state,
      containerEl,
      walls,
      normalizeId,
      projectVertices,
      FACE_GEOMETRY,
      facePoint,
      normalizeEdgeId,
      getEdges,
      EDGE_GEOMETRY,
      EDGE_GEOMETRY_KEYS,
      formatEdgeName,
      getEdgeWalls,
      getElements,
      render,
      snapRotationToWall,
      getWallFaceLetter,
      getWallTarotCard,
      resolveCardImageUrl,
      openTarotCardInfo,
      openTarotCardLightbox,
      MOTHER_CONNECTORS,
      formatDirectionName,
      getConnectorTarotCard,
      getHebrewLetterSymbol,
      toDisplayText,
      CUBE_VIEW_CENTER,
      getEdgeMarkerDisplay,
      getEdgeTarotCard,
      getCubeCenterData,
      getCenterTarotCard,
      getCenterLetterSymbol
    } = context;

    if (!containerEl) {
      return;
    }

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 240 220");
    svg.setAttribute("width", "100%");
    svg.setAttribute("class", "cube-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Cube of Space interactive chassis");

    function openTarotTarget(cardName, fallbackSrc, fallbackLabel) {
      if (typeof openTarotCardInfo === "function" && openTarotCardInfo(cardName) === true) {
        return true;
      }

      if (typeof openTarotCardLightbox === "function") {
        return openTarotCardLightbox(cardName, fallbackSrc, fallbackLabel);
      }

      return false;
    }

    const wallById = new Map(walls.map((wall) => [normalizeId(wall?.id), wall]));
    const projectedVertices = projectVertices();
    const faces = Object.entries(FACE_GEOMETRY)
      .map(([wallId, indices]) => {
        const wall = wallById.get(wallId);
        if (!wall) {
          return null;
        }

        const quad = indices.map((index) => projectedVertices[index]);
        const avgDepth = quad.reduce((sum, point) => sum + point.z, 0) / quad.length;

        return {
          wallId,
          wall,
          quad,
          depth: avgDepth,
          pointsText: quad.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.depth - right.depth);

    faces.forEach((faceData) => {
      const { wallId, wall, quad, pointsText } = faceData;

      const isActive = wallId === normalizeId(state.selectedWallId);
      const polygon = document.createElementNS(svgNS, "polygon");
      polygon.setAttribute("points", pointsText);
      polygon.setAttribute("class", `cube-face${isActive ? " is-active" : ""}`);
      polygon.setAttribute("fill", "#000");
      polygon.setAttribute("fill-opacity", isActive ? "0.78" : "0.62");
      polygon.setAttribute("stroke", "currentColor");
      polygon.setAttribute("stroke-opacity", isActive ? "0.92" : "0.68");
      polygon.setAttribute("stroke-width", isActive ? "2.5" : "1");
      polygon.setAttribute("data-wall-id", wallId);
      polygon.setAttribute("role", "button");
      polygon.setAttribute("tabindex", "0");
      polygon.setAttribute("aria-label", `Cube wall ${wall?.name || wallId}`);

      const selectWall = () => {
        state.selectedWallId = wallId;
        state.selectedEdgeId = normalizeEdgeId(context.getEdgesForWall(wallId)[0]?.id || getEdges()[0]?.id);
        state.selectedNodeType = "wall";
        state.selectedConnectorId = null;
        snapRotationToWall(wallId);
        render(getElements());
      };

      polygon.addEventListener("click", selectWall);
      polygon.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectWall();
        }
      });

      svg.appendChild(polygon);

      const wallFaceLetter = getWallFaceLetter(wall);
      const faceGlyphAnchor = facePoint(quad, 0, 0);

      if (state.markerDisplayMode === "tarot") {
        const cardUrl = resolveCardImageUrl(getWallTarotCard(wall));
        if (cardUrl) {
          let defs = svg.querySelector("defs");
          if (!defs) {
            defs = document.createElementNS(svgNS, "defs");
            svg.insertBefore(defs, svg.firstChild);
          }
          const clipId = `face-clip-${wallId}`;
          const clipPath = document.createElementNS(svgNS, "clipPath");
          clipPath.setAttribute("id", clipId);
          const clipPoly = document.createElementNS(svgNS, "polygon");
          clipPoly.setAttribute("points", pointsText);
          clipPath.appendChild(clipPoly);
          defs.appendChild(clipPath);

          const cardW = 40;
          const cardH = 60;
          const wallTarotCard = getWallTarotCard(wall);
          const cardImg = document.createElementNS(svgNS, "image");
          cardImg.setAttribute("class", "cube-tarot-image cube-face-card");
          cardImg.setAttribute("href", cardUrl);
          cardImg.setAttribute("x", String((faceGlyphAnchor.x - cardW / 2).toFixed(2)));
          cardImg.setAttribute("y", String((faceGlyphAnchor.y - cardH / 2).toFixed(2)));
          cardImg.setAttribute("width", String(cardW));
          cardImg.setAttribute("height", String(cardH));
          cardImg.setAttribute("clip-path", `url(#${clipId})`);
          cardImg.setAttribute("role", "button");
          cardImg.setAttribute("tabindex", "0");
          cardImg.setAttribute("aria-label", `Open ${wallTarotCard || (wall?.name || wallId)} card image`);
          cardImg.setAttribute("preserveAspectRatio", "xMidYMid meet");
          cardImg.addEventListener("click", (event) => {
            event.stopPropagation();
            selectWall();
            openTarotTarget(wallTarotCard, cardUrl, `${wall?.name || wallId} wall tarot card`);
          });
          cardImg.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              selectWall();
              openTarotTarget(wallTarotCard, cardUrl, `${wall?.name || wallId} wall tarot card`);
            }
          });
          svg.appendChild(cardImg);
        }
      } else {
        const faceGlyph = document.createElementNS(svgNS, "text");
        faceGlyph.setAttribute(
          "class",
          `cube-face-symbol${isActive ? " is-active" : ""}${wallFaceLetter ? "" : " is-missing"}`
        );
        faceGlyph.setAttribute("x", String(faceGlyphAnchor.x));
        faceGlyph.setAttribute("y", String(faceGlyphAnchor.y));
        faceGlyph.setAttribute("text-anchor", "middle");
        faceGlyph.setAttribute("dominant-baseline", "middle");
        faceGlyph.setAttribute("pointer-events", "none");
        faceGlyph.textContent = wallFaceLetter || "!";
        svg.appendChild(faceGlyph);
      }

      const labelAnchor = facePoint(quad, 0, 0.9);
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("class", `cube-face-label${isActive ? " is-active" : ""}`);
      label.setAttribute("x", String(labelAnchor.x));
      label.setAttribute("y", String(labelAnchor.y));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "middle");
      label.setAttribute("pointer-events", "none");
      label.textContent = wall?.name || wallId;
      svg.appendChild(label);
    });

    const faceCenterByWallId = new Map(
      faces.map((faceData) => [faceData.wallId, facePoint(faceData.quad, 0, 0)])
    );

    if (state.showConnectorLines) {
      MOTHER_CONNECTORS.forEach((connector, connectorIndex) => {
        const fromWallId = normalizeId(connector?.fromWallId);
        const toWallId = normalizeId(connector?.toWallId);
        const from = faceCenterByWallId.get(fromWallId);
        const to = faceCenterByWallId.get(toWallId);
        if (!from || !to) {
          return;
        }

        const connectorId = normalizeId(connector?.id);
        const isActive = state.selectedNodeType === "connector"
          && normalizeId(state.selectedConnectorId) === connectorId;
        const connectorLetter = getHebrewLetterSymbol(connector?.hebrewLetterId);
        const connectorCardUrl = state.markerDisplayMode === "tarot"
          ? resolveCardImageUrl(getConnectorTarotCard(connector))
          : null;

        const group = document.createElementNS(svgNS, "g");
        group.setAttribute("class", `cube-connector${isActive ? " is-active" : ""}`);
        group.setAttribute("role", "button");
        group.setAttribute("tabindex", "0");
        group.setAttribute(
          "aria-label",
          `Mother connector ${formatDirectionName(fromWallId)} to ${formatDirectionName(toWallId)}`
        );

        const connectorLine = document.createElementNS(svgNS, "line");
        connectorLine.setAttribute("class", `cube-connector-line${isActive ? " is-active" : ""}`);
        connectorLine.setAttribute("x1", from.x.toFixed(2));
        connectorLine.setAttribute("y1", from.y.toFixed(2));
        connectorLine.setAttribute("x2", to.x.toFixed(2));
        connectorLine.setAttribute("y2", to.y.toFixed(2));
        group.appendChild(connectorLine);

        const connectorHit = document.createElementNS(svgNS, "line");
        connectorHit.setAttribute("class", "cube-connector-hit");
        connectorHit.setAttribute("x1", from.x.toFixed(2));
        connectorHit.setAttribute("y1", from.y.toFixed(2));
        connectorHit.setAttribute("x2", to.x.toFixed(2));
        connectorHit.setAttribute("y2", to.y.toFixed(2));
        group.appendChild(connectorHit);

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const length = Math.hypot(dx, dy) || 1;
        const perpX = -dy / length;
        const perpY = dx / length;
        const shift = (connectorIndex - 1) * 12;
        const labelX = ((from.x + to.x) / 2) + (perpX * shift);
        const labelY = ((from.y + to.y) / 2) + (perpY * shift);

        const selectConnector = () => {
          state.selectedNodeType = "connector";
          state.selectedConnectorId = connectorId;
          render(getElements());
        };

        if (state.markerDisplayMode === "tarot" && connectorCardUrl) {
          const cardW = 18;
          const cardH = 27;
          const connectorTarotCard = getConnectorTarotCard(connector);
          const connectorImg = document.createElementNS(svgNS, "image");
          connectorImg.setAttribute("class", "cube-tarot-image cube-connector-card");
          connectorImg.setAttribute("href", connectorCardUrl);
          connectorImg.setAttribute("x", String((labelX - cardW / 2).toFixed(2)));
          connectorImg.setAttribute("y", String((labelY - cardH / 2).toFixed(2)));
          connectorImg.setAttribute("width", String(cardW));
          connectorImg.setAttribute("height", String(cardH));
          connectorImg.setAttribute("role", "button");
          connectorImg.setAttribute("tabindex", "0");
          connectorImg.setAttribute("aria-label", `Open ${connectorTarotCard || connector?.name || "connector"} card image`);
          connectorImg.setAttribute("preserveAspectRatio", "xMidYMid meet");
          connectorImg.addEventListener("click", (event) => {
            event.stopPropagation();
            selectConnector();
            openTarotTarget(connectorTarotCard, connectorCardUrl, connector?.name || "Mother connector");
          });
          connectorImg.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              selectConnector();
              openTarotTarget(connectorTarotCard, connectorCardUrl, connector?.name || "Mother connector");
            }
          });
          group.appendChild(connectorImg);
        } else {
          const connectorText = document.createElementNS(svgNS, "text");
          connectorText.setAttribute(
            "class",
            `cube-connector-symbol${isActive ? " is-active" : ""}${connectorLetter ? "" : " is-missing"}`
          );
          connectorText.setAttribute("x", String(labelX));
          connectorText.setAttribute("y", String(labelY));
          connectorText.setAttribute("text-anchor", "middle");
          connectorText.setAttribute("dominant-baseline", "middle");
          connectorText.setAttribute("pointer-events", "none");
          connectorText.textContent = connectorLetter || "!";
          group.appendChild(connectorText);
        }

        group.addEventListener("click", selectConnector);
        group.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectConnector();
          }
        });

        svg.appendChild(group);
      });
    }

    const edgeById = new Map(
      getEdges().map((edge) => [normalizeEdgeId(edge?.id), edge])
    );

    EDGE_GEOMETRY.forEach(([fromIndex, toIndex], edgeIndex) => {
      const edgeId = EDGE_GEOMETRY_KEYS[edgeIndex];
      const edge = edgeById.get(edgeId) || {
        id: edgeId,
        name: formatEdgeName(edgeId),
        walls: edgeId.split("-")
      };
      const markerDisplay = getEdgeMarkerDisplay(edge);
      const edgeWalls = getEdgeWalls(edge);

      const wallIsActive = edgeWalls.includes(normalizeId(state.selectedWallId));
      const edgeIsActive = normalizeEdgeId(state.selectedEdgeId) === edgeId;

      const from = projectedVertices[fromIndex];
      const to = projectedVertices[toIndex];

      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", from.x.toFixed(2));
      line.setAttribute("y1", from.y.toFixed(2));
      line.setAttribute("x2", to.x.toFixed(2));
      line.setAttribute("y2", to.y.toFixed(2));
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-opacity", edgeIsActive ? "0.94" : (wallIsActive ? "0.70" : "0.32"));
      line.setAttribute("stroke-width", edgeIsActive ? "2.4" : (wallIsActive ? "1.9" : "1.4"));
      line.setAttribute("class", `cube-edge-line${edgeIsActive ? " is-active" : ""}`);
      line.setAttribute("role", "button");
      line.setAttribute("tabindex", "0");
      line.setAttribute("aria-label", `Cube edge ${toDisplayText(edge?.name) || formatEdgeName(edgeId)}`);

      const selectEdge = () => {
        state.selectedEdgeId = edgeId;
        state.selectedNodeType = "edge";
        state.selectedConnectorId = null;
        if (!edgeWalls.includes(normalizeId(state.selectedWallId)) && edgeWalls[0]) {
          state.selectedWallId = edgeWalls[0];
          snapRotationToWall(state.selectedWallId);
        }
        render(getElements());
      };

      line.addEventListener("click", selectEdge);
      line.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectEdge();
        }
      });
      svg.appendChild(line);

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      const normalX = -dy / length;
      const normalY = dx / length;
      const midpointX = (from.x + to.x) / 2;
      const midpointY = (from.y + to.y) / 2;

      const centerVectorX = midpointX - CUBE_VIEW_CENTER.x;
      const centerVectorY = midpointY - CUBE_VIEW_CENTER.y;
      const normalSign = (centerVectorX * normalX + centerVectorY * normalY) >= 0 ? 1 : -1;

      const markerOffset = edgeIsActive ? 17 : (wallIsActive ? 13 : 12);
      const labelX = midpointX + (normalX * markerOffset * normalSign);
      const labelY = midpointY + (normalY * markerOffset * normalSign);

      const marker = document.createElementNS(svgNS, "g");
      marker.setAttribute(
        "class",
        `cube-direction${wallIsActive ? " is-wall-active" : ""}${edgeIsActive ? " is-active" : ""}`
      );
      marker.setAttribute("role", "button");
      marker.setAttribute("tabindex", "0");
      marker.setAttribute("aria-label", `Cube edge ${toDisplayText(edge?.name) || formatEdgeName(edgeId)}`);

      if (state.markerDisplayMode === "tarot") {
        const edgeCardUrl = resolveCardImageUrl(getEdgeTarotCard(edge));
        if (edgeCardUrl) {
          const cardW = edgeIsActive ? 28 : 20;
          const cardH = edgeIsActive ? 42 : 30;
          const edgeTarotCard = getEdgeTarotCard(edge);
          const cardImg = document.createElementNS(svgNS, "image");
          cardImg.setAttribute("class", `cube-tarot-image cube-direction-card${edgeIsActive ? " is-active" : ""}`);
          cardImg.setAttribute("href", edgeCardUrl);
          cardImg.setAttribute("x", String((labelX - cardW / 2).toFixed(2)));
          cardImg.setAttribute("y", String((labelY - cardH / 2).toFixed(2)));
          cardImg.setAttribute("width", String(cardW));
          cardImg.setAttribute("height", String(cardH));
          cardImg.setAttribute("role", "button");
          cardImg.setAttribute("tabindex", "0");
          cardImg.setAttribute("aria-label", `Open ${edgeTarotCard || edge?.name || "edge"} card image`);
          cardImg.setAttribute("preserveAspectRatio", "xMidYMid meet");
          cardImg.addEventListener("click", (event) => {
            event.stopPropagation();
            selectEdge();
            openTarotTarget(edgeTarotCard, edgeCardUrl, edge?.name || "Cube edge");
          });
          cardImg.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              selectEdge();
              openTarotTarget(edgeTarotCard, edgeCardUrl, edge?.name || "Cube edge");
            }
          });
          marker.appendChild(cardImg);
        } else {
          const markerText = document.createElementNS(svgNS, "text");
          markerText.setAttribute("class", "cube-direction-letter is-missing");
          markerText.setAttribute("x", String(labelX));
          markerText.setAttribute("y", String(labelY));
          markerText.setAttribute("text-anchor", "middle");
          markerText.setAttribute("dominant-baseline", "middle");
          markerText.textContent = "!";
          marker.appendChild(markerText);
        }
      } else {
        const markerText = document.createElementNS(svgNS, "text");
        markerText.setAttribute(
          "class",
          `cube-direction-letter${markerDisplay.isMissing ? " is-missing" : ""}`
        );
        markerText.setAttribute("x", String(labelX));
        markerText.setAttribute("y", String(labelY));
        markerText.setAttribute("text-anchor", "middle");
        markerText.setAttribute("dominant-baseline", "middle");
        markerText.textContent = markerDisplay.text;
        marker.appendChild(markerText);
      }

      marker.addEventListener("click", selectEdge);
      marker.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectEdge();
        }
      });

      svg.appendChild(marker);
    });

    const center = getCubeCenterData();
    if (center && state.showPrimalPoint) {
      const centerLetter = getCenterLetterSymbol(center);
      const centerCardUrl = state.markerDisplayMode === "tarot"
        ? resolveCardImageUrl(getCenterTarotCard(center))
        : null;
      const centerActive = state.selectedNodeType === "center";

      const centerMarker = document.createElementNS(svgNS, "g");
      centerMarker.setAttribute("class", `cube-center${centerActive ? " is-active" : ""}`);
      centerMarker.setAttribute("role", "button");
      centerMarker.setAttribute("tabindex", "0");
      centerMarker.setAttribute("aria-label", "Cube primal point");

      const centerHit = document.createElementNS(svgNS, "circle");
      centerHit.setAttribute("class", "cube-center-hit");
      centerHit.setAttribute("cx", String(CUBE_VIEW_CENTER.x));
      centerHit.setAttribute("cy", String(CUBE_VIEW_CENTER.y));
      centerHit.setAttribute("r", "18");
      centerMarker.appendChild(centerHit);

      if (state.markerDisplayMode === "tarot" && centerCardUrl) {
        const cardW = 24;
        const cardH = 36;
        const centerTarotCard = getCenterTarotCard(center);
        const centerImg = document.createElementNS(svgNS, "image");
        centerImg.setAttribute("class", "cube-tarot-image cube-center-card");
        centerImg.setAttribute("href", centerCardUrl);
        centerImg.setAttribute("x", String((CUBE_VIEW_CENTER.x - cardW / 2).toFixed(2)));
        centerImg.setAttribute("y", String((CUBE_VIEW_CENTER.y - cardH / 2).toFixed(2)));
        centerImg.setAttribute("width", String(cardW));
        centerImg.setAttribute("height", String(cardH));
        centerImg.setAttribute("role", "button");
        centerImg.setAttribute("tabindex", "0");
        centerImg.setAttribute("aria-label", `Open ${centerTarotCard || "Primal Point"} card image`);
        centerImg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        centerImg.addEventListener("click", (event) => {
          event.stopPropagation();
          state.selectedNodeType = "center";
          state.selectedConnectorId = null;
          render(getElements());
          openTarotTarget(centerTarotCard, centerCardUrl, "Primal Point");
        });
        centerImg.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            state.selectedNodeType = "center";
            state.selectedConnectorId = null;
            render(getElements());
            openTarotTarget(centerTarotCard, centerCardUrl, "Primal Point");
          }
        });
        centerMarker.appendChild(centerImg);
      } else {
        const centerText = document.createElementNS(svgNS, "text");
        centerText.setAttribute(
          "class",
          `cube-center-symbol${centerActive ? " is-active" : ""}${centerLetter ? "" : " is-missing"}`
        );
        centerText.setAttribute("x", String(CUBE_VIEW_CENTER.x));
        centerText.setAttribute("y", String(CUBE_VIEW_CENTER.y));
        centerText.setAttribute("text-anchor", "middle");
        centerText.setAttribute("dominant-baseline", "middle");
        centerText.setAttribute("pointer-events", "none");
        centerText.textContent = centerLetter || "!";
        centerMarker.appendChild(centerText);
      }

      const selectCenter = () => {
        state.selectedNodeType = "center";
        state.selectedConnectorId = null;
        render(getElements());
      };

      centerMarker.addEventListener("click", selectCenter);
      centerMarker.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCenter();
        }
      });

      svg.appendChild(centerMarker);
    }

    if (state.markerDisplayMode === "tarot") {
      Array.from(svg.querySelectorAll("g.cube-direction")).forEach((group) => {
        svg.appendChild(group);
      });

      if (state.showConnectorLines) {
        Array.from(svg.querySelectorAll("g.cube-connector")).forEach((group) => {
          svg.appendChild(group);
        });
      }
    }

    containerEl.replaceChildren(svg);
  }

  window.CubeChassisUi = { renderFaceSvg };
})();