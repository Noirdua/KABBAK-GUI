/* ui-cube-detail.js — Cube detail pane rendering */
(function () {
  "use strict";

  function toDisplayText(value) {
    return String(value ?? "").trim();
  }

  const escapeHtml = window.HtmlSafe.escapeHtml;

  function toDetailValueMarkup(value) {
    const text = toDisplayText(value);
    return text ? escapeHtml(text) : '<span class="cube-missing-value">!</span>';
  }

  function createMetaCard(title, bodyContent) {
    const card = document.createElement("div");
    card.className = "meta-card";

    const titleEl = document.createElement("strong");
    titleEl.textContent = title;
    card.appendChild(titleEl);

    if (typeof bodyContent === "string") {
      const bodyEl = document.createElement("p");
      bodyEl.className = "body-text";
      bodyEl.textContent = bodyContent;
      card.appendChild(bodyEl);
    } else if (bodyContent instanceof Node) {
      card.appendChild(bodyContent);
    }

    return card;
  }

  function appendInlineParts(target, parts) {
    (Array.isArray(parts) ? parts : []).forEach((part) => {
      if (part instanceof Node) {
        target.appendChild(part);
        return;
      }

      const text = String(part ?? "");
      if (text) {
        target.appendChild(document.createTextNode(text));
      }
    });
  }

  function createInlineEventLink(label, eventName, detail) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-inline-link";
    button.textContent = String(label || "—");
    button.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    });
    return button;
  }

  function createInlineActionLink(label, onActivate) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-inline-link";
    button.textContent = String(label || "—");
    button.addEventListener("click", () => {
      onActivate?.();
    });
    return button;
  }

  function createInlineValue(parts) {
    const value = document.createElement("span");
    value.className = "detail-inline-value";
    appendInlineParts(value, parts);
    return value;
  }

  function createDetailList(rows) {
    const list = document.createElement("dl");
    list.className = "alpha-dl";

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const term = document.createElement("dt");
      term.textContent = String(row?.label || "").trim();

      const detail = document.createElement("dd");
      if (row?.value instanceof Node) {
        detail.appendChild(row.value);
      } else {
        detail.innerHTML = toDetailValueMarkup(row?.value);
      }

      list.append(term, detail);
    });

    return list;
  }

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function createAstrologyValue(astrology, context) {
    const type = toDisplayText(astrology?.type).toLowerCase();
    const name = toDisplayText(astrology?.name);

    if (!name) {
      return "";
    }

    if (type === "planet") {
      return createInlineEventLink(name, "nav:planet", {
        planetId: context.normalizeId(name)
      });
    }

    if (type === "zodiac") {
      return createInlineEventLink(name, "nav:zodiac", {
        signId: context.normalizeId(name)
      });
    }

    return name;
  }

  function createElementValue(elementName, context) {
    const label = toDisplayText(elementName);
    const elementId = context.normalizeId(label);

    if (!elementId) {
      return label;
    }

    return createInlineEventLink(label, "nav:elements", { elementId });
  }

  function appendPathAssociationRows(rows, pathEntry, context) {
    if (!Array.isArray(rows) || !pathEntry) {
      return;
    }

    const astrologyValue = createAstrologyValue(pathEntry?.astrology, context);
    if (astrologyValue) {
      rows.push({ label: "Astrology", value: astrologyValue });
    }

    const tarotCard = toDisplayText(pathEntry?.tarot?.card);
    const tarotTrumpNumber = context.toFiniteNumber(pathEntry?.tarot?.trumpNumber);
    if (hasTarotAccess() && (tarotCard || tarotTrumpNumber != null)) {
      rows.push({
        label: "Tarot",
        value: createInlineEventLink(tarotCard || `Trump ${tarotTrumpNumber}`, "nav:tarot-trump", {
          cardName: tarotCard,
          trumpNumber: tarotTrumpNumber
        })
      });
    }

    const pathNo = context.toFiniteNumber(pathEntry?.pathNumber);
    if (pathNo != null) {
      rows.push({
        label: "Path",
        value: createInlineEventLink(`Path ${pathNo}`, "nav:kabbalah-path", { pathNo })
      });
    }
  }

  function createNavButton(label, eventName, detail) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kab-god-link";
    button.textContent = `${label} ↗`;
    button.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    });
    return button;
  }

  function renderCenterDetail(context) {
    const { state, elements, getCubeCenterData, getCenterLetterId, getCenterLetterSymbol, toFiniteNumber } = context;
    if (!state.showPrimalPoint) {
      return false;
    }

    const center = getCubeCenterData();
    if (!center || !elements?.detailNameEl || !elements?.detailSubEl || !elements?.detailBodyEl) {
      return false;
    }

    const centerLetterId = getCenterLetterId(center);
    const centerLetter = getCenterLetterSymbol(center);
    const centerLetterText = centerLetterId
      ? `${centerLetter ? `${centerLetter} ` : ""}${toDisplayText(centerLetterId)}`
      : "";
    const centerElement = toDisplayText(center?.element);

    elements.detailNameEl.textContent = "Primal Point";
    elements.detailSubEl.textContent = [centerLetterText, centerElement].filter(Boolean).join(" · ") || "Center of the Cube";

    const bodyEl = elements.detailBodyEl;
    bodyEl.innerHTML = "";

    const associations = center?.associations || {};

    const centerTrumpNo = toFiniteNumber(associations?.tarotTrumpNumber);
    const centerTarotCard = toDisplayText(associations?.tarotCard);
    const centerPathNo = toFiniteNumber(associations?.kabbalahPathNumber);
    const summaryRows = [
      { label: "Name", value: center?.name },
      {
        label: "Letter",
        value: centerLetterId
          ? createInlineEventLink(centerLetterText, "nav:alphabet", {
            alphabet: "hebrew",
            hebrewLetterId: centerLetterId
          })
          : centerLetterText
      },
      { label: "Element", value: createElementValue(center?.element, context) || center?.element }
    ];

    if (hasTarotAccess() && (centerTarotCard || centerTrumpNo != null)) {
      summaryRows.push({
        label: "Tarot",
        value: createInlineEventLink(centerTarotCard || `Trump ${centerTrumpNo}`, "nav:tarot-trump", {
          cardName: centerTarotCard,
          trumpNumber: centerTrumpNo
        })
      });
    }

    if (centerPathNo != null) {
      summaryRows.push({
        label: "Path",
        value: createInlineEventLink(`Path ${centerPathNo}`, "nav:kabbalah-path", {
          pathNo: centerPathNo
        })
      });
    }

    bodyEl.appendChild(createMetaCard("Center Details", createDetailList(summaryRows)));

    if (Array.isArray(center?.keywords) && center.keywords.length) {
      bodyEl.appendChild(createMetaCard("Keywords", center.keywords.join(", ")));
    }

    if (center?.description) {
      bodyEl.appendChild(createMetaCard("Description", center.description));
    }

    return true;
  }

  function renderConnectorDetail(context) {
    const {
      state,
      elements,
      walls,
      normalizeId,
      normalizeLetterKey,
      formatDirectionName,
      getWallById,
      getConnectorById,
      getConnectorPathEntry,
      getHebrewLetterSymbol,
      toFiniteNumber
    } = context;

    const connector = getConnectorById(state.selectedConnectorId);
    if (!connector || !elements?.detailNameEl || !elements?.detailSubEl || !elements?.detailBodyEl) {
      return false;
    }

    const fromWallId = normalizeId(connector?.fromWallId);
    const toWallId = normalizeId(connector?.toWallId);
    const fromWall = getWallById(fromWallId) || walls.find((entry) => normalizeId(entry?.id) === fromWallId) || null;
    const toWall = getWallById(toWallId) || walls.find((entry) => normalizeId(entry?.id) === toWallId) || null;
    const connectorPath = getConnectorPathEntry(connector);

    const letterId = normalizeLetterKey(connector?.hebrewLetterId);
    const letterSymbol = getHebrewLetterSymbol(letterId);
    const letterText = letterId
      ? `${letterSymbol ? `${letterSymbol} ` : ""}${toDisplayText(letterId)}`
      : "";

    const pathNo = toFiniteNumber(connectorPath?.pathNumber);
    const tarotCard = toDisplayText(connectorPath?.tarot?.card);
    const tarotTrumpNumber = toFiniteNumber(connectorPath?.tarot?.trumpNumber);
    const astrologySummary = createAstrologyValue(connectorPath?.astrology, context)
      || [toDisplayText(connectorPath?.astrology?.type), toDisplayText(connectorPath?.astrology?.name)].filter(Boolean).join(": ");

    elements.detailNameEl.textContent = connector?.name || "Mother Connector";
    elements.detailSubEl.textContent = ["Mother Letter", letterText].filter(Boolean).join(" · ") || "Mother Letter";

    const bodyEl = elements.detailBodyEl;
    bodyEl.innerHTML = "";

    const connectorRows = [
      {
        label: "Letter",
        value: letterId
          ? createInlineEventLink(letterText, "nav:alphabet", {
            alphabet: "hebrew",
            hebrewLetterId: letterId
          })
          : letterText
      },
      {
        label: "From",
        value: fromWall
          ? createInlineActionLink(fromWall?.name || formatDirectionName(fromWallId), () => {
            context.onSelectWall?.(fromWallId);
          })
          : (fromWall?.name || formatDirectionName(fromWallId))
      },
      {
        label: "To",
        value: toWall
          ? createInlineActionLink(toWall?.name || formatDirectionName(toWallId), () => {
            context.onSelectWall?.(toWallId);
          })
          : (toWall?.name || formatDirectionName(toWallId))
      }
    ];

    if (hasTarotAccess() && (tarotCard || tarotTrumpNumber != null)) {
      connectorRows.push({
        label: "Tarot",
        value: createInlineEventLink(tarotCard || `Trump ${tarotTrumpNumber}`, "nav:tarot-trump", {
          cardName: tarotCard,
          trumpNumber: tarotTrumpNumber
        })
      });
    }

    if (pathNo != null) {
      connectorRows.push({
        label: "Path",
        value: createInlineEventLink(`Path ${pathNo}`, "nav:kabbalah-path", { pathNo })
      });
    }

    bodyEl.appendChild(createMetaCard("Connector Details", createDetailList(connectorRows)));

    if (astrologySummary) {
      bodyEl.appendChild(createMetaCard("Astrology", astrologySummary));
    }

    return true;
  }

  function renderEdgeCard(context, wall, detailBodyEl, wallEdgeDirections) {
    const {
      state,
      normalizeId,
      normalizeEdgeId,
      formatDirectionName,
      formatEdgeName,
      getEdgeById,
      getEdgesForWall,
      getEdges,
      getEdgeWalls,
      getEdgeLetterId,
      getEdgeLetter,
      getEdgePathEntry,
      getEdgeAstrologySymbol,
      toFiniteNumber
    } = context;

    const wallId = normalizeId(wall?.id);
    const selectedEdge = getEdgeById(state.selectedEdgeId)
      || getEdgesForWall(wallId)[0]
      || getEdges()[0]
      || null;
    if (!selectedEdge) {
      return;
    }

    state.selectedEdgeId = normalizeEdgeId(selectedEdge.id);

    const edgeDirection = wallEdgeDirections.get(normalizeEdgeId(selectedEdge.id));
    const edgeName = edgeDirection
      ? formatDirectionName(edgeDirection)
      : (toDisplayText(selectedEdge.name) || formatEdgeName(selectedEdge.id));
    const edgeWalls = getEdgeWalls(selectedEdge)
      .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1))
      .join(" · ");

    const edgeLetterId = getEdgeLetterId(selectedEdge);
    const edgeLetter = getEdgeLetter(selectedEdge);
    const edgePath = getEdgePathEntry(selectedEdge);
    const astrologySymbol = getEdgeAstrologySymbol(selectedEdge);
    const astrologyName = toDisplayText(edgePath?.astrology?.name);
    const astrologyText = astrologySymbol && astrologyName
      ? `${astrologySymbol} ${astrologyName}`
      : astrologySymbol || astrologyName;

    const pathNo = toFiniteNumber(edgePath?.pathNumber);
    const tarotCard = toDisplayText(edgePath?.tarot?.card);
    const tarotTrumpNumber = toFiniteNumber(edgePath?.tarot?.trumpNumber);

    const edgeCard = document.createElement("div");
    edgeCard.className = "meta-card";

    const title = document.createElement("strong");
    title.textContent = `Edge · ${edgeName}`;
    edgeCard.appendChild(title);

    const edgeRows = [
      { label: "Direction", value: edgeName },
      { label: "Edge", value: edgeWalls },
      {
        label: "Letter",
        value: edgeLetterId
          ? createInlineEventLink(edgeLetter || edgeLetterId, "nav:alphabet", {
            alphabet: "hebrew",
            hebrewLetterId: edgeLetterId
          })
          : edgeLetter
      },
      {
        label: "Astrology",
        value: createAstrologyValue(edgePath?.astrology, context) || astrologyText
      }
    ];

    if (hasTarotAccess() && (tarotCard || tarotTrumpNumber != null)) {
      edgeRows.push({
        label: "Tarot",
        value: createInlineEventLink(tarotCard || `Trump ${tarotTrumpNumber}`, "nav:tarot-trump", {
          cardName: tarotCard,
          trumpNumber: tarotTrumpNumber
        })
      });
    }

    if (pathNo != null) {
      edgeRows.push({
        label: "Path",
        value: createInlineEventLink(`Path ${pathNo}`, "nav:kabbalah-path", { pathNo })
      });
    }

    edgeCard.appendChild(createDetailList(edgeRows));

    if (Array.isArray(selectedEdge.keywords) && selectedEdge.keywords.length) {
      const keywords = document.createElement("p");
      keywords.className = "body-text";
      keywords.textContent = selectedEdge.keywords.join(", ");
      edgeCard.appendChild(keywords);
    }

    if (selectedEdge.description) {
      const description = document.createElement("p");
      description.className = "body-text";
      description.textContent = selectedEdge.description;
      edgeCard.appendChild(description);
    }

    detailBodyEl.appendChild(edgeCard);
  }

  function renderWallDetail(context) {
    const {
      state,
      elements,
      walls,
      normalizeId,
      normalizeEdgeId,
      formatDirectionName,
      formatEdgeName,
      getWallById,
      getEdgesForWall,
      getWallEdgeDirections,
      getWallFaceLetterId,
      getWallFaceLetter,
      getPathEntryByLetterId,
      getHebrewLetterName,
      getEdgeLetter,
      localDirectionOrder,
      localDirectionRank,
      onSelectWall,
      onSelectEdge
    } = context;

    const wall = getWallById(state.selectedWallId) || walls[0] || null;
    if (!wall || !elements?.detailNameEl || !elements?.detailSubEl || !elements?.detailBodyEl) {
      if (elements?.detailNameEl) {
        elements.detailNameEl.textContent = "Cube data unavailable";
      }
      if (elements?.detailSubEl) {
        elements.detailSubEl.textContent = "Could not load cube dataset.";
      }
      if (elements?.detailBodyEl) {
        elements.detailBodyEl.innerHTML = "";
      }
      return;
    }

    state.selectedWallId = normalizeId(wall.id);

    const wallPlanet = toDisplayText(wall?.planet) || "!";
    const wallElement = toDisplayText(wall?.element) || "!";
    const wallFaceLetterId = getWallFaceLetterId(wall);
    const wallFaceLetter = getWallFaceLetter(wall);
    const wallFaceLetterText = wallFaceLetterId
      ? `${wallFaceLetter ? `${wallFaceLetter} ` : ""}${toDisplayText(wallFaceLetterId)}`
      : "";
    elements.detailNameEl.textContent = `${wall.name} Wall`;
    elements.detailSubEl.textContent = `${wallElement} · ${wallPlanet}`;

    const bodyEl = elements.detailBodyEl;
    bodyEl.innerHTML = "";

    const wallAssociations = wall.associations || {};
    const faceLetterPath = getPathEntryByLetterId(wallFaceLetterId);
    const wallFaceLetterName = getHebrewLetterName(wallFaceLetterId) || toDisplayText(wallFaceLetterId);
    const faceLetterLabel = [wallFaceLetter, wallFaceLetterName].filter(Boolean).join(" ");
    const wallRows = [
      {
        label: "Opposite",
        value: wall.oppositeWallId
          ? createInlineActionLink(getWallById(wall.oppositeWallId)?.name || wall.oppositeWallId, () => {
            onSelectWall(wall.oppositeWallId);
          })
          : wall.opposite
      },
      {
        label: "Face Letter",
        value: wallFaceLetterId
          ? createInlineEventLink(faceLetterLabel || "!", "nav:alphabet", {
            alphabet: "hebrew",
            hebrewLetterId: wallFaceLetterId
          })
          : wallFaceLetterText
      },
      { label: "Element", value: createElementValue(wall.element, context) || wall.element },
      {
        label: "Planet",
        value: wallAssociations.planetId
          ? createInlineEventLink(toDisplayText(wall.planet) || "!", "nav:planet", {
            planetId: wallAssociations.planetId
          })
          : wall.planet
      },
      {
        label: "Archangel",
        value: wallAssociations.godName
          ? createInlineEventLink(wallAssociations.godName, "nav:gods", {
            godName: wallAssociations.godName
          })
          : wall.archangel
      }
    ];

    if (faceLetterPath) {
      appendPathAssociationRows(wallRows, faceLetterPath, context);
    } else {
      const directTarotCard = toDisplayText(wallAssociations?.tarotCard || wall?.tarotCard);
      const directTrumpNumber = toFiniteNumber(wallAssociations?.tarotTrumpNumber);
      if (hasTarotAccess() && (directTarotCard || directTrumpNumber != null)) {
        wallRows.push({
          label: "Tarot",
          value: createInlineEventLink(directTarotCard || `Trump ${directTrumpNumber}`, "nav:tarot-trump", {
            cardName: directTarotCard,
            trumpNumber: directTrumpNumber
          })
        });
      }
    }

    bodyEl.appendChild(createMetaCard("Wall Details", createDetailList(wallRows)));

    if (Array.isArray(wall.keywords) && wall.keywords.length) {
      bodyEl.appendChild(createMetaCard("Keywords", wall.keywords.join(", ")));
    }

    if (wall.description) {
      bodyEl.appendChild(createMetaCard("Description", wall.description));
    }

    const edgesCard = document.createElement("div");
    edgesCard.className = "meta-card";
    edgesCard.innerHTML = "<strong>Wall Edges</strong>";

    const chips = document.createElement("div");
    chips.className = "kab-chips";

    const wallEdgeDirections = getWallEdgeDirections(wall);
    const wallEdges = getEdgesForWall(wall)
      .slice()
      .sort((left, right) => {
        const leftDirection = wallEdgeDirections.get(normalizeEdgeId(left?.id));
        const rightDirection = wallEdgeDirections.get(normalizeEdgeId(right?.id));
        const leftRank = localDirectionRank[leftDirection] ?? localDirectionOrder.length;
        const rightRank = localDirectionRank[rightDirection] ?? localDirectionOrder.length;
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }
        return normalizeEdgeId(left?.id).localeCompare(normalizeEdgeId(right?.id));
      });

    wallEdges.forEach((edge) => {
      const id = normalizeEdgeId(edge.id);
      const chipLetter = getEdgeLetter(edge);
      const chipIsMissing = !chipLetter;
      const direction = wallEdgeDirections.get(id);
      const directionLabel = direction
        ? formatDirectionName(direction)
        : (toDisplayText(edge.name) || formatEdgeName(edge.id));
      const chip = document.createElement("span");
      chip.className = `kab-chip${id === normalizeEdgeId(state.selectedEdgeId) ? " is-active" : ""}${chipIsMissing ? " is-missing" : ""}`;
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.textContent = `${directionLabel} · ${chipLetter || "!"}`;

      const selectEdge = () => {
        onSelectEdge(id, wall.id);
      };

      chip.addEventListener("click", selectEdge);
      chip.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectEdge();
        }
      });

      chips.appendChild(chip);
    });

    edgesCard.appendChild(chips);
    bodyEl.appendChild(edgesCard);

    renderEdgeCard(context, wall, bodyEl, wallEdgeDirections);
  }

  function renderEdgeDetail(context) {
    const {
      state,
      elements,
      normalizeId,
      normalizeEdgeId,
      formatEdgeName,
      getWallById,
      getEdgeById,
      getEdges,
      getEdgeWalls,
      getEdgeLetterId,
      getEdgeLetter,
      getEdgePathEntry,
      getEdgeAstrologySymbol,
      getHebrewLetterName,
      toFiniteNumber,
      onSelectWall
    } = context;

    const edge = getEdgeById(state.selectedEdgeId) || getEdges()[0] || null;
    if (!edge || !elements?.detailNameEl || !elements?.detailSubEl || !elements?.detailBodyEl) {
      return false;
    }

    const edgeId = normalizeEdgeId(edge.id);
    const edgeWalls = getEdgeWalls(edge);
    const currentWallId = normalizeId(state.selectedWallId);
    const preferredWallId = edgeWalls.includes(currentWallId)
      ? currentWallId
      : normalizeId(edgeWalls[0]);

    if (preferredWallId) {
      state.selectedWallId = preferredWallId;
    }
    state.selectedEdgeId = edgeId;

    const wallNames = edgeWalls
      .map((wallId) => getWallById(wallId)?.name || wallId)
      .filter(Boolean)
      .join(" ↔ ");
    const edgeName = toDisplayText(edge?.name) || formatEdgeName(edgeId);
    const edgeLetterId = getEdgeLetterId(edge);
    const edgeLetter = getEdgeLetter(edge);
    const edgeLetterName = edgeLetterId ? (getHebrewLetterName(edgeLetterId) || edgeLetterId) : "";
    const edgeLetterText = edgeLetterId
      ? [edgeLetter, edgeLetterName].filter(Boolean).join(" ")
      : "";
    const edgePath = getEdgePathEntry(edge);
    const astrologySymbol = getEdgeAstrologySymbol(edge);
    const astrologyName = toDisplayText(edgePath?.astrology?.name);
    const astrologyText = astrologySymbol && astrologyName
      ? `${astrologySymbol} ${astrologyName}`
      : astrologySymbol || astrologyName;
    const tarotCard = toDisplayText(edgePath?.tarot?.card);
    const tarotTrumpNumber = toFiniteNumber(edgePath?.tarot?.trumpNumber);
    const pathNo = toFiniteNumber(edgePath?.pathNumber);

    elements.detailNameEl.textContent = `${edgeName} Edge`;
    elements.detailSubEl.textContent = [edgeLetterText, astrologyText].filter(Boolean).join(" · ") || "Cube Edge";

    const bodyEl = elements.detailBodyEl;
    bodyEl.innerHTML = "";

    const edgeRows = [
      { label: "Name", value: edgeName },
      {
        label: "Between",
        value: createInlineValue(edgeWalls.flatMap((wallId, index) => {
          const wall = getWallById(wallId);
          const parts = [];
          if (index > 0) {
            parts.push(" ↔ ");
          }
          parts.push(createInlineActionLink(wall?.name || wallId, () => {
            onSelectWall(wallId);
          }));
          return parts;
        }))
      },
      {
        label: "Letter",
        value: edgeLetterId
          ? createInlineEventLink(edgeLetterText || edgeLetterId, "nav:alphabet", {
            alphabet: "hebrew",
            hebrewLetterId: edgeLetterId
          })
          : edgeLetterText
      },
      {
        label: "Astrology",
        value: createAstrologyValue(edgePath?.astrology, context) || astrologyText
      }
    ];

    if (hasTarotAccess() && (tarotCard || tarotTrumpNumber != null)) {
      edgeRows.push({
        label: "Tarot",
        value: createInlineEventLink(tarotCard || `Trump ${tarotTrumpNumber}`, "nav:tarot-trump", {
          cardName: tarotCard,
          trumpNumber: tarotTrumpNumber
        })
      });
    }

    if (pathNo != null) {
      edgeRows.push({
        label: "Path",
        value: createInlineEventLink(`Path ${pathNo}`, "nav:kabbalah-path", { pathNo })
      });
    }

    bodyEl.appendChild(createMetaCard("Edge Details", createDetailList(edgeRows)));

    if (Array.isArray(edge?.keywords) && edge.keywords.length) {
      bodyEl.appendChild(createMetaCard("Keywords", edge.keywords.join(", ")));
    }

    if (edge?.description) {
      bodyEl.appendChild(createMetaCard("Description", edge.description));
    }

    return true;
  }

  function renderDetail(context) {
    if (context.state.selectedNodeType === "connector" && renderConnectorDetail(context)) {
      return;
    }

    if (context.state.selectedNodeType === "center" && renderCenterDetail(context)) {
      return;
    }

    if (context.state.selectedNodeType === "edge" && renderEdgeDetail(context)) {
      return;
    }

    renderWallDetail(context);
  }

  window.CubeDetailUi = {
    renderDetail
  };
})();