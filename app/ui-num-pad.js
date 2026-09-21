(function () {
  "use strict";

  const grid = window.NumPadGrid;
  const model = window.NumPadModel;

  if (!grid || typeof grid.createSlot !== "function") {
    throw new Error("NumPadGrid module must load before ui-num-pad.js");
  }
  if (!model || typeof model.createState !== "function") {
    throw new Error("NumPadModel module must load before ui-num-pad.js");
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

    const state = {
    initialized: false,
    keyboardBound: false,
    resizeBound: false,
    pad: model.createState(),
    drawnChainFactor: null,
    pathSlots: null,
    pathLinkMessage: "",
    pathAnimToken: 0,
    pathAnimTimer: 0,
    filtersOpen: false,
    chainsOpen: false,
    actionsOpen: false,
    pickedChainFactor: null
  };

  let config = {
    getActiveSection: () => "home"
  };

  function getElements() {
    return {
      stageEl: document.getElementById("num-pad-stage"),
      pathEl: document.getElementById("num-pad-path"),
      statusEl: document.getElementById("num-pad-status"),
      resetEl: document.getElementById("num-pad-reset"),
      chainsEl: document.getElementById("num-pad-chains"),
      productToggleEl: document.getElementById("num-pad-toggle-product"),
      rootToggleEl: document.getElementById("num-pad-toggle-root"),
      chainProductToggleEl: document.getElementById("num-pad-chain-toggle-product"),
      chainRootToggleEl: document.getElementById("num-pad-chain-toggle-root"),
      placeFullEl: document.getElementById("num-pad-place-full"),
      placeTensEl: document.getElementById("num-pad-place-tens"),
      placeOnesEl: document.getElementById("num-pad-place-ones"),
      chainPlaceFullEl: document.getElementById("num-pad-chain-place-full"),
      chainPlaceHunsEl: document.getElementById("num-pad-chain-place-huns"),
      chainPlaceTensEl: document.getElementById("num-pad-chain-place-tens"),
      chainPlaceOnesEl: document.getElementById("num-pad-chain-place-ones"),
      pathNoteEl: document.getElementById("num-pad-path-note"),
      placeHunsEl: document.getElementById("num-pad-place-huns"),
      degreeDownEl: document.getElementById("num-pad-degree-down"),
      degreeUpEl: document.getElementById("num-pad-degree-up"),
      degreeValueEl: document.getElementById("num-pad-degree-value"),
      degreeRangeEl: document.getElementById("num-pad-degree-range"),
      sectionEl: document.getElementById("num-pad-section"),
      mobileChainsEl: document.getElementById("num-pad-mobile-chains"),
      chainsBackdropEl: document.getElementById("num-pad-chains-backdrop"),
      settingsPanelEl: document.getElementById("num-pad-settings-panel"),
      actionFactorsEl: document.getElementById("num-pad-action-factors"),
      actionTargetEl: document.getElementById("num-pad-action-target"),
      actionFillEl: document.getElementById("num-pad-action-fill"),
      actionDrawEl: document.getElementById("num-pad-action-draw"),
      actionKeypadEl: document.getElementById("num-pad-action-keypad"),
      filterGridSlotEl: document.getElementById("num-pad-filter-grid-slot"),
      filterChainSlotEl: document.getElementById("num-pad-filter-chain-slot"),
      openNumPadEl: document.getElementById("open-numbers-num-pad")
    };
  }

  function isNumPadActive() {
    return config.getActiveSection?.() === "num-pad";
  }

  function applyMenuState() {
    const { openNumPadEl } = getElements();
    if (openNumPadEl) {
      openNumPadEl.classList.toggle("is-active", isNumPadActive());
    }
  }

  function describeState() {
    const flags = model.normalizeDisplayFlags(state.pad);
    const views = [];
    if (flags.showProduct) {
      views.push("product");
    }
    if (flags.showDigitalRoot) {
      views.push("root");
    }
    const viewLabel = views.join(" + ");
    const placeName = (place) => (place === model.PLACE_ONES
      ? "ones"
      : (place === model.PLACE_TENS
        ? "tens"
        : (place === model.PLACE_HUNDREDS ? "huns" : "full")));
    const placeLabel = `grid ${placeName(flags.gridPlaceValue)}`;

    const range = model.getDegreeRange(state.pad.degree);
    if (state.pad.mode === model.MODE_TIMES_TABLE && state.pad.factor !== null) {
      return `${state.pad.factor} × ${range.start}–${range.end} · ${viewLabel} · ${placeLabel}`;
    }
    return `Keys ${range.start}–${range.end} · degree ${range.degree} · ${viewLabel} · ${placeLabel}`;
  }

  function applyCellDataset(button, cell) {
    const { slot } = cell;
    button.dataset.slotIndex = String(slot.index);
    button.dataset.slotRow = String(slot.row);
    button.dataset.slotColumn = String(slot.column);
    button.dataset.slotKey = slot.key;
    button.dataset.mode = cell.mode;
    button.dataset.degree = String(cell.degree);
    button.dataset.multiplier = String(cell.multiplier);
    button.dataset.product = String(cell.product);
    if (cell.digitalRoot === null) {
      delete button.dataset.digitalRoot;
    } else {
      button.dataset.digitalRoot = String(cell.digitalRoot);
    }
    if (cell.onesDigit === null) {
      delete button.dataset.onesDigit;
    } else {
      button.dataset.onesDigit = String(cell.onesDigit);
    }
    if (cell.tensDigit === null) {
      delete button.dataset.tensDigit;
    } else {
      button.dataset.tensDigit = String(cell.tensDigit);
    }
    if (cell.hundredsDigit === null) {
      delete button.dataset.hundredsDigit;
    } else {
      button.dataset.hundredsDigit = String(cell.hundredsDigit);
    }
    if (cell.factor === null) {
      delete button.dataset.factor;
    } else {
      button.dataset.factor = String(cell.factor);
    }
  }

  function appendPlaceDigits(targetEl, digits, placeValue) {
    const highlight = placeValue && placeValue !== model.PLACE_FULL;
    (digits || []).forEach((digit) => {
      const digitEl = document.createElement("span");
      digitEl.className = "num-pad-digit";
      digitEl.dataset.place = digit.place;
      digitEl.textContent = digit.value;
      if (highlight) {
        digitEl.classList.toggle("is-active", Boolean(digit.emphasized));
        digitEl.classList.toggle("is-dimmed", !digit.emphasized);
      }
      targetEl.appendChild(digitEl);
    });
  }

  function createLayerValue(layer, flags) {
    const layerEl = document.createElement("span");
    layerEl.className = `num-pad-cell-value num-pad-cell-value--${layer.id}`;
    layerEl.dataset.displayLayer = layer.id;

    const labelEl = document.createElement("span");
    labelEl.className = "num-pad-cell-value-label";
    labelEl.textContent = layer.label;

    const numberEl = document.createElement("span");
    numberEl.className = "num-pad-cell-value-number";
    if (
      layer.id === model.DISPLAY_PRODUCT
      && flags.placeValue !== model.PLACE_FULL
      && Array.isArray(layer.digits)
      && layer.digits.length
    ) {
      appendPlaceDigits(numberEl, layer.digits, flags.placeValue);
    } else {
      numberEl.textContent = layer.value;
    }

    layerEl.append(labelEl, numberEl);
    return layerEl;
  }

  function createCellButton(cell) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `num-pad-cell${cell.selectable ? "" : " is-product"}`;
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-rowindex", String(cell.slot.row));
    button.setAttribute("aria-colindex", String(cell.slot.column));
    button.setAttribute("aria-selected", cell.factor !== null && cell.slot.index === cell.factor ? "true" : "false");
    applyCellDataset(button, cell);

    const flags = model.normalizeDisplayFlags(state.pad);
    const gridFlags = {
      ...flags,
      showProduct: flags.gridShowProduct,
      showDigitalRoot: flags.gridShowDigitalRoot,
      placeValue: flags.gridPlaceValue
    };
    const layers = model.getDisplayLayers(cell, gridFlags);
    const productLayers = layers.filter((layer) => layer.id === model.DISPLAY_PRODUCT);
    const rootLayers = layers.filter((layer) => layer.id === model.DISPLAY_DIGITAL_ROOT);
    const pinRootBelow = productLayers.length > 0 && rootLayers.length > 0;
    button.classList.toggle("has-dual-values", layers.length > 1 && !pinRootBelow);
    button.classList.toggle("has-root-foot", pinRootBelow);
    button.classList.toggle("is-root-only", gridFlags.showDigitalRoot && !gridFlags.showProduct);

    const indexEl = document.createElement("span");
    indexEl.className = "num-pad-cell-slot";
    indexEl.textContent = String(cell.slot.index);

    const valuesEl = document.createElement("span");
    valuesEl.className = "num-pad-cell-values";
    const mainLayers = pinRootBelow ? productLayers : layers;
    mainLayers.forEach((layer) => {
      valuesEl.appendChild(createLayerValue(layer, gridFlags));
    });

    const metaEl = document.createElement("span");
    metaEl.className = "num-pad-cell-meta";
    let metaText = cell.mode === model.MODE_TIMES_TABLE && cell.factor !== null
      ? `${cell.factor} × ${cell.multiplier}`
      : `Slot ${cell.slot.index}`;
    if (state.pathSlots && state.pathSlots.has(cell.slot.index)) {
      const covered = (pinRootBelow ? productLayers[0] : layers[0]);
      if (covered && covered.value) {
        metaText = `${metaText} = ${covered.value}`;
      }
    }
    metaEl.textContent = metaText;

    const spokenValues = layers.map((layer) => `${layer.label} ${layer.value}`).join(", ");
    button.setAttribute(
      "aria-label",
      cell.mode === model.MODE_TIMES_TABLE && cell.factor !== null
        ? `Grid slot ${cell.slot.index}, ${cell.factor} times ${cell.multiplier}, ${spokenValues}`
        : `Grid slot ${cell.slot.index}, ${spokenValues}`
    );

    button.append(indexEl, valuesEl, metaEl);

    if (pinRootBelow) {
      rootLayers.forEach((layer) => {
        const rootFootEl = document.createElement("span");
        rootFootEl.className = "num-pad-cell-root-foot";
        rootFootEl.textContent = layer.value;
        button.appendChild(rootFootEl);
      });
    }

    return button;
  }

  function createChainStep(chain, cell, flags) {
    const chainFlags = {
      ...flags,
      showProduct: flags.chainShowProduct,
      showDigitalRoot: flags.chainShowDigitalRoot,
      placeValue: flags.chainPlaceValue
    };
    const layers = model.getDisplayLayers(cell, chainFlags);
    const stepEl = document.createElement("span");
    stepEl.className = `num-pad-chain-step${layers.length > 1 ? " has-dual-values" : ""}`;
    stepEl.dataset.chainFactor = String(chain.factor);
    stepEl.dataset.slotIndex = String(cell.slot.index);
    stepEl.dataset.product = String(cell.product);
    if (cell.digitalRoot !== null) {
      stepEl.dataset.digitalRoot = String(cell.digitalRoot);
    }

    layers.forEach((layer) => {
      const valueEl = document.createElement("span");
      valueEl.className = `num-pad-chain-step-value num-pad-chain-step-value--${layer.id}`;
      valueEl.dataset.displayLayer = layer.id;
      if (
        layer.id === model.DISPLAY_PRODUCT
        && chainFlags.placeValue !== model.PLACE_FULL
        && Array.isArray(layer.digits)
        && layer.digits.length
      ) {
        appendPlaceDigits(valueEl, layer.digits, chainFlags.placeValue);
      } else {
        valueEl.textContent = layer.value;
      }
      stepEl.appendChild(valueEl);
    });

    return stepEl;
  }

  function createChainActionButton(action, label, pressed) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `num-pad-chain-action${pressed ? " is-active" : ""}`;
    button.dataset.chainAction = action;
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    button.textContent = label;
    return button;
  }

  function createChainRow(chain, flags) {
    const isFilled = state.pad.factor === chain.factor;
    const isDrawn = state.drawnChainFactor === chain.factor;
    const isPicked = state.pickedChainFactor === chain.factor;
    const rowEl = document.createElement("div");
    rowEl.className = `num-pad-chain${isFilled ? " is-selected" : ""}${isDrawn ? " is-drawn" : ""}${isPicked ? " is-picked" : ""}`;
    rowEl.dataset.chainFactor = String(chain.factor);
    rowEl.dataset.chainKey = chain.key;

    const factorEl = document.createElement("span");
    factorEl.className = "num-pad-chain-factor";
    factorEl.textContent = String(chain.factor);

    const stepsEl = document.createElement("span");
    stepsEl.className = "num-pad-chain-steps";
    chain.cells.forEach((cell) => {
      stepsEl.appendChild(createChainStep(chain, cell, flags));
    });

    const actionsEl = document.createElement("span");
    actionsEl.className = "num-pad-chain-actions";
    actionsEl.append(
      createChainActionButton("fill", "Fill", isFilled),
      createChainActionButton("draw", "Draw", isDrawn)
    );

    rowEl.append(factorEl, stepsEl, actionsEl);
    if (isDrawn && state.pathLinkMessage) {
      const noteEl = document.createElement("span");
      noteEl.className = "num-pad-chain-link-note";
      noteEl.textContent = state.pathLinkMessage;
      rowEl.appendChild(noteEl);
    }
    return rowEl;
  }

  function renderChains() {
    const { chainsEl } = getElements();
    if (!chainsEl) {
      return;
    }

    const flags = model.normalizeDisplayFlags(state.pad);
    const fragment = document.createDocumentFragment();

    const headingEl = document.createElement("div");
    headingEl.className = "num-pad-chains-heading";

    const titleEl = document.createElement("strong");
    titleEl.textContent = "Chains";

    const hintEl = document.createElement("span");
    hintEl.className = "list-count";
    const range = model.getDegreeRange(model.MIN_DEGREE);
    hintEl.textContent = `1–9 × ${range.start}–${range.end}`;

    headingEl.append(titleEl, hintEl);
    fragment.appendChild(headingEl);

    model.buildAllChains(model.MIN_DEGREE).forEach((chain) => {
      fragment.appendChild(createChainRow(chain, flags));
    });

    chainsEl.replaceChildren(fragment);
    chainsEl.dataset.showProduct = flags.showProduct ? "true" : "false";
    chainsEl.dataset.showDigitalRoot = flags.showDigitalRoot ? "true" : "false";
    if (state.drawnChainFactor === null) {
      delete chainsEl.dataset.drawnFactor;
    } else {
      chainsEl.dataset.drawnFactor = String(state.drawnChainFactor);
    }
  }

  function getCellCenter(stageEl, slotIndex) {
    const cellEl = stageEl.querySelector(`.num-pad-cell[data-slot-index="${slotIndex}"]`);
    if (!(cellEl instanceof HTMLElement)) {
      return null;
    }

    const stageRect = stageEl.getBoundingClientRect();
    const cellRect = cellEl.getBoundingClientRect();
    return {
      x: cellRect.left - stageRect.left + (cellRect.width / 2),
      y: cellRect.top - stageRect.top + (cellRect.height / 2),
      width: stageRect.width,
      height: stageRect.height
    };
  }

  function cancelPathAnimation() {
    state.pathAnimToken += 1;
    if (state.pathAnimTimer) {
      window.clearTimeout(state.pathAnimTimer);
      state.pathAnimTimer = 0;
    }
  }

  function clearPathLayer() {
    cancelPathAnimation();
    const { pathEl, stageEl } = getElements();
    if (pathEl) {
      pathEl.replaceChildren();
    }
    if (!stageEl) {
      return;
    }
    stageEl.querySelectorAll(".num-pad-cell.is-on-path").forEach((cellEl) => {
      cellEl.classList.remove("is-on-path");
      delete cellEl.dataset.pathOrder;
    });
  }

  const PATH_NODE_RADIUS = 16;

  function ensurePathLayers(pathEl) {
    const defs = document.createElementNS(SVG_NS, "defs");
    const marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id", "num-pad-path-arrow");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto");
    const arrow = document.createElementNS(SVG_NS, "path");
    arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    arrow.setAttribute("class", "num-pad-path-arrow");
    marker.appendChild(arrow);
    defs.appendChild(marker);
    pathEl.appendChild(defs);

    const lineGroup = document.createElementNS(SVG_NS, "g");
    lineGroup.setAttribute("class", "num-pad-path-lines");
    const nodeGroup = document.createElementNS(SVG_NS, "g");
    nodeGroup.setAttribute("class", "num-pad-path-nodes");
    pathEl.append(lineGroup, nodeGroup);
    return { lineGroup, nodeGroup };
  }

  function insetLine(from, to, inset) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= inset * 2) {
      return null;
    }
    const ux = dx / length;
    const uy = dy / length;
    return {
      x1: from.x + (ux * inset),
      y1: from.y + (uy * inset),
      x2: to.x - (ux * inset),
      y2: to.y - (uy * inset)
    };
  }

  function appendPathLine(lineGroup, from, to) {
    if (!from || !to || from.slotIndex === to.slotIndex) {
      return;
    }
    const segment = insetLine(from, to, PATH_NODE_RADIUS);
    if (!segment) {
      return;
    }
    const halo = document.createElementNS(SVG_NS, "line");
    halo.setAttribute("x1", String(segment.x1));
    halo.setAttribute("y1", String(segment.y1));
    halo.setAttribute("x2", String(segment.x2));
    halo.setAttribute("y2", String(segment.y2));
    halo.setAttribute("class", "num-pad-path-line-halo is-entering");
    lineGroup.appendChild(halo);

    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(segment.x1));
    line.setAttribute("y1", String(segment.y1));
    line.setAttribute("x2", String(segment.x2));
    line.setAttribute("y2", String(segment.y2));
    line.setAttribute("class", "num-pad-path-line is-entering");
    line.setAttribute("marker-end", "url(#num-pad-path-arrow)");
    lineGroup.appendChild(line);
  }

  function appendPathNode(nodeGroup, point) {
    const node = document.createElementNS(SVG_NS, "circle");
    node.setAttribute("cx", String(point.x));
    node.setAttribute("cy", String(point.y));
    node.setAttribute("r", String(PATH_NODE_RADIUS));
    node.setAttribute("class", "num-pad-path-node is-entering");
    nodeGroup.appendChild(node);

    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", String(point.x));
    label.setAttribute("y", String(point.y + 5));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "num-pad-path-order is-entering");
    label.textContent = String(point.order);
    nodeGroup.appendChild(label);
  }

  function markPathCell(stageEl, point) {
    const cellEl = stageEl.querySelector(`.num-pad-cell[data-slot-index="${point.slotIndex}"]`);
    if (!(cellEl instanceof HTMLElement)) {
      return;
    }
    cellEl.classList.add("is-on-path");
    const existing = cellEl.dataset.pathOrder
      ? `${cellEl.dataset.pathOrder},${point.order}`
      : String(point.order);
    cellEl.dataset.pathOrder = existing;
  }

  function collectPathResult(stageEl) {
    const factor = model.normalizeFactor(state.drawnChainFactor);
    if (factor === null) {
      return {
        points: [],
        message: ""
      };
    }

    const flags = model.normalizeDisplayFlags(state.pad);
    const chain = model.buildChain(factor, model.MIN_DEGREE);
    const path = model.buildChainPath(chain, model.getCells(state.pad), flags.gridPlaceValue);
    const points = [];

    path.steps.forEach((step) => {
      const center = getCellCenter(stageEl, step.slot.index);
      if (!center) {
        return;
      }
      points.push({
        ...center,
        order: step.order,
        slotIndex: step.slot.index,
        value: step.value
      });
    });

    return {
      points,
      message: path.message || ""
    };
  }

  function applyPathNote(message) {
    const { pathNoteEl, chainsEl } = getElements();
    const text = String(message || "");
    state.pathLinkMessage = text;
    if (pathNoteEl) {
      pathNoteEl.hidden = !text;
      pathNoteEl.textContent = text;
    }
    if (!chainsEl) {
      return;
    }
    chainsEl.querySelectorAll(".num-pad-chain-link-note").forEach((noteEl) => {
      noteEl.remove();
    });
    if (!text || state.drawnChainFactor === null) {
      return;
    }
    const row = chainsEl.querySelector(`.num-pad-chain[data-chain-factor="${state.drawnChainFactor}"]`);
    if (!(row instanceof HTMLElement)) {
      return;
    }
    const noteEl = document.createElement("span");
    noteEl.className = "num-pad-chain-link-note";
    noteEl.textContent = text;
    row.appendChild(noteEl);
  }

  function renderDrawnPath(options = {}) {
    const animate = options.animate !== false;
    const { stageEl, pathEl } = getElements();
    if (!stageEl || !pathEl) {
      return;
    }

    clearPathLayer();
    const pathResult = collectPathResult(stageEl);
    applyPathNote(pathResult.message);
    const points = pathResult.points;
    if (!points.length) {
      return;
    }

    const width = points[0].width;
    const height = points[0].height;
    pathEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    pathEl.setAttribute("width", String(width));
    pathEl.setAttribute("height", String(height));
    const layers = ensurePathLayers(pathEl);

    const revealThrough = (count) => {
      for (let index = 0; index < count; index += 1) {
        const point = points[index];
        if (index > 0) {
          appendPathLine(layers.lineGroup, points[index - 1], point);
        }
        appendPathNode(layers.nodeGroup, point);
        markPathCell(stageEl, point);
      }
    };

    if (!animate) {
      revealThrough(points.length);
      return;
    }

    const token = state.pathAnimToken;
    let shown = 0;
    const step = () => {
      if (token !== state.pathAnimToken) {
        return;
      }
      const point = points[shown];
      if (shown > 0) {
        appendPathLine(layers.lineGroup, points[shown - 1], point);
      }
      appendPathNode(layers.nodeGroup, point);
      markPathCell(stageEl, point);
      shown += 1;
      if (shown < points.length) {
        state.pathAnimTimer = window.setTimeout(step, 280);
      }
    };
    step();
  }

  function updatePathSlots() {
    if (state.drawnChainFactor === null) {
      state.pathSlots = null;
      return;
    }
    const flags = model.normalizeDisplayFlags(state.pad);
    const chain = model.buildChain(state.drawnChainFactor, model.MIN_DEGREE);
    const path = model.buildChainPath(chain, model.getCells(state.pad), flags.gridPlaceValue);
    state.pathSlots = new Set(path.steps.map((step) => step.slot.index));
  }

  function renderPad() {
    const { stageEl, statusEl, resetEl } = getElements();
    if (!stageEl) {
      return;
    }

    updatePathSlots();
    const cells = model.getCells(state.pad);
    const fragment = document.createDocumentFragment();
    cells.forEach((cell) => {
      fragment.appendChild(createCellButton(cell));
    });
    stageEl.replaceChildren(fragment);
    const flags = model.normalizeDisplayFlags(state.pad);
    stageEl.setAttribute("data-mode", state.pad.mode);
    stageEl.dataset.showProduct = flags.showProduct ? "true" : "false";
    stageEl.dataset.showDigitalRoot = flags.showDigitalRoot ? "true" : "false";
    stageEl.dataset.placeValue = flags.gridPlaceValue;
    stageEl.dataset.gridPlaceValue = flags.gridPlaceValue;
    stageEl.dataset.chainPlaceValue = flags.chainPlaceValue;
    stageEl.dataset.degree = String(model.normalizeDegree(state.pad.degree));
    if (state.pad.factor === null) {
      delete stageEl.dataset.factor;
    } else {
      stageEl.dataset.factor = String(state.pad.factor);
    }

    if (statusEl) {
      statusEl.textContent = describeState();
    }

    applyDisplayToggleState();
    applyDegreeState();

    if (resetEl) {
      resetEl.disabled = state.pad.mode === model.MODE_KEYPAD;
    }

    renderChains();
    applyMenuState();
    applyMobileChrome();
    window.requestAnimationFrame(() => {
      renderDrawnPath({ animate: true });
    });
  }

  function chooseFactor(factor) {
    model.selectFactor(state.pad, factor);
    renderPad();
  }

  function resetPad() {
    model.reset(state.pad);
    renderPad();
  }

  function applyDisplayToggleState() {
    const {
      productToggleEl,
      rootToggleEl,
      chainProductToggleEl,
      chainRootToggleEl,
      placeFullEl,
      placeHunsEl,
      placeTensEl,
      placeOnesEl,
      chainPlaceFullEl,
      chainPlaceHunsEl,
      chainPlaceTensEl,
      chainPlaceOnesEl
    } = getElements();
    const flags = model.normalizeDisplayFlags(state.pad);

    if (productToggleEl) {
      productToggleEl.setAttribute("aria-pressed", flags.gridShowProduct ? "true" : "false");
      productToggleEl.classList.toggle("is-active", flags.gridShowProduct);
    }

    if (rootToggleEl) {
      rootToggleEl.setAttribute("aria-pressed", flags.gridShowDigitalRoot ? "true" : "false");
      rootToggleEl.classList.toggle("is-active", flags.gridShowDigitalRoot);
    }

    if (chainProductToggleEl) {
      chainProductToggleEl.setAttribute("aria-pressed", flags.chainShowProduct ? "true" : "false");
      chainProductToggleEl.classList.toggle("is-active", flags.chainShowProduct);
    }

    if (chainRootToggleEl) {
      chainRootToggleEl.setAttribute("aria-pressed", flags.chainShowDigitalRoot ? "true" : "false");
      chainRootToggleEl.classList.toggle("is-active", flags.chainShowDigitalRoot);
    }

    const placeButtons = [
      [placeFullEl, model.PLACE_FULL],
      [placeHunsEl, model.PLACE_HUNDREDS],
      [placeTensEl, model.PLACE_TENS],
      [placeOnesEl, model.PLACE_ONES]
    ];
    placeButtons.forEach(([buttonEl, placeValue]) => {
      if (!buttonEl) {
        return;
      }
      const pressed = flags.gridPlaceValue === placeValue;
      buttonEl.setAttribute("aria-pressed", pressed ? "true" : "false");
      buttonEl.classList.toggle("is-active", pressed);
    });

    const chainPlaceButtons = [
      [chainPlaceFullEl, model.PLACE_FULL],
      [chainPlaceHunsEl, model.PLACE_HUNDREDS],
      [chainPlaceTensEl, model.PLACE_TENS],
      [chainPlaceOnesEl, model.PLACE_ONES]
    ];
    chainPlaceButtons.forEach(([buttonEl, placeValue]) => {
      if (!buttonEl) {
        return;
      }
      const pressed = flags.chainPlaceValue === placeValue;
      buttonEl.setAttribute("aria-pressed", pressed ? "true" : "false");
      buttonEl.classList.toggle("is-active", pressed);
    });
  }

  function toggleDisplayFlag(flag, target) {
    const flags = model.normalizeDisplayFlags(state.pad);
    const isChain = target === "chain";
    const nextEnabled = flag === model.DISPLAY_DIGITAL_ROOT
      ? !(isChain ? flags.chainShowDigitalRoot : flags.gridShowDigitalRoot)
      : !(isChain ? flags.chainShowProduct : flags.gridShowProduct);
    model.setDisplayFlag(state.pad, flag, nextEnabled, isChain ? "chain" : "grid");
    renderPad();
  }

  function choosePlaceValue(placeValue) {
    model.setGridPlaceValue(state.pad, placeValue);
    renderPad();
  }

  function chooseChainPlaceValue(placeValue) {
    model.setChainPlaceValue(state.pad, placeValue);
    renderPad();
  }

  function applyDegreeState() {
    const { degreeDownEl, degreeUpEl, degreeValueEl, degreeRangeEl } = getElements();
    const range = model.getDegreeRange(state.pad.degree);

    if (degreeValueEl) {
      degreeValueEl.textContent = String(range.degree);
    }
    if (degreeRangeEl) {
      degreeRangeEl.textContent = `× ${range.start}–${range.end}`;
    }
    if (degreeDownEl) {
      degreeDownEl.disabled = range.degree <= model.MIN_DEGREE;
    }
    if (degreeUpEl) {
      degreeUpEl.disabled = range.degree >= model.MAX_DEGREE;
    }
  }

  function shiftDegree(delta) {
    model.shiftDegree(state.pad, delta);
    renderPad();
  }

  function handleStageClick(event) {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const button = target instanceof Element ? target.closest(".num-pad-cell") : null;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const slotIndex = Number(button.dataset.slotIndex);
    const cell = model.getCellAt(state.pad, slotIndex);
    if (!cell || !cell.selectable) {
      return;
    }

    chooseFactor(cell.slot.index);
  }

  function fillChain(factor) {
    if (state.pad.factor === factor) {
      resetPad();
      return;
    }
    chooseFactor(factor);
  }

  function drawChain(factor) {
    if (state.drawnChainFactor === factor) {
      state.drawnChainFactor = null;
    } else {
      state.drawnChainFactor = factor;
    }
    renderPad();
  }

  function isCompactNumPad() {
    // Match the phone-skin breakpoint so small screens dock the toolbars into
    // the filter sheet instead of showing them inline.
    return typeof window.matchMedia === "function"
      && window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)").matches;
  }

  function dockFilterToolbars(inSheet) {
    const { filterGridSlotEl, filterChainSlotEl, sectionEl } = getElements();
    const gridPanel = sectionEl?.querySelector(".num-pad-grid-panel");
    const chainPanel = sectionEl?.querySelector(".num-pad-chain-panel");
    const gridToolbar = document.querySelector("#num-pad-section .num-pad-panel-toolbar[aria-label='Grid settings']");
    const chainToolbar = document.querySelector("#num-pad-section .num-pad-panel-toolbar[aria-label='Chain settings']");
    if (inSheet) {
      if (gridToolbar && filterGridSlotEl) {
        filterGridSlotEl.appendChild(gridToolbar);
      }
      if (chainToolbar && filterChainSlotEl) {
        filterChainSlotEl.appendChild(chainToolbar);
      }
      return;
    }
    if (gridToolbar && gridPanel && gridToolbar.parentElement !== gridPanel) {
      gridPanel.insertBefore(gridToolbar, gridPanel.firstChild);
    }
    if (chainToolbar && chainPanel && chainToolbar.parentElement !== chainPanel) {
      chainPanel.insertBefore(chainToolbar, chainPanel.firstChild);
    }
  }

  // Grid/chain display options and chain actions live in one shared-overlay
  // settings panel (app/ui-page-settings.js). Both the old "filters" and
  // "actions" entry points now open that single panel.
  function openNumPadSettings() {
    const { sectionEl, settingsPanelEl } = getElements();
    const trigger = document.getElementById("num-pad-settings");
    if (!settingsPanelEl || !trigger) {
      return;
    }

    state.filtersOpen = true;
    state.actionsOpen = true;
    state.chainsOpen = false;
    if (sectionEl) {
      sectionEl.classList.remove("is-chains-open");
    }
    renderActionFactors();
    dockFilterToolbars(true);
    applyMobileChrome();

    window.TaroOverlay?.openPageSettings?.({
      title: "Num Pad Settings",
      panel: settingsPanelEl,
      trigger,
      restoreTo: sectionEl || settingsPanelEl.parentElement,
      onClose: () => {
        state.filtersOpen = false;
        state.actionsOpen = false;
        dockFilterToolbars(false);
        applyMobileChrome();
      }
    });
  }

  function closeNumPadSettings() {
    window.TaroOverlay?.close?.();
  }

  function setFiltersOpen(open) {
    if (open) {
      openNumPadSettings();
    } else {
      closeNumPadSettings();
    }
  }

  function setChainsOpen(open) {
    const { sectionEl, mobileChainsEl } = getElements();
    state.chainsOpen = Boolean(open);
    if (state.chainsOpen) {
      closeNumPadSettings();
      state.filtersOpen = false;
      state.actionsOpen = false;
    }
    if (sectionEl) {
      sectionEl.classList.toggle("is-chains-open", state.chainsOpen);
    }
    if (mobileChainsEl) {
      mobileChainsEl.setAttribute("aria-expanded", state.chainsOpen ? "true" : "false");
    }
  }

  // The Actions overlay picks its own chain, so it works without reaching the
  // Chains overlay (which it covers).
  function renderActionFactors() {
    const { actionFactorsEl } = getElements();
    if (!actionFactorsEl || actionFactorsEl.dataset.built === "true") {
      return;
    }

    const fragment = document.createDocumentFragment();
    model.buildAllChains(model.MIN_DEGREE).forEach((chain) => {
      const factor = model.normalizeFactor(chain?.factor);
      if (factor === null) {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "num-pad-toggle";
      button.dataset.actionFactor = String(factor);
      button.setAttribute("aria-pressed", "false");
      button.textContent = String(factor);
      fragment.appendChild(button);
    });

    actionFactorsEl.replaceChildren(fragment);
    actionFactorsEl.dataset.built = "true";
  }

  function applyMobileChrome() {
    const { mobileChainsEl, actionTargetEl, actionFillEl, actionDrawEl, actionFactorsEl } = getElements();
    const picked = state.pickedChainFactor || state.pad.factor || state.drawnChainFactor;
    if (mobileChainsEl) {
      mobileChainsEl.textContent = picked ? `Chain ${picked}` : "Chains";
    }
    if (actionTargetEl) {
      actionTargetEl.textContent = picked ? `Chain ${picked}` : "Pick a chain first";
    }
    if (actionFillEl) {
      actionFillEl.disabled = !picked;
      actionFillEl.classList.toggle("is-active", Boolean(picked && state.pad.factor === picked));
    }
    if (actionDrawEl) {
      actionDrawEl.disabled = !picked;
      actionDrawEl.classList.toggle("is-active", Boolean(picked && state.drawnChainFactor === picked));
    }
    if (actionFactorsEl) {
      actionFactorsEl.querySelectorAll("[data-action-factor]").forEach((button) => {
        const isPicked = picked !== null && Number(button.dataset.actionFactor) === picked;
        button.classList.toggle("is-active", isPicked);
        button.setAttribute("aria-pressed", isPicked ? "true" : "false");
      });
    }
  }

  function setActionsOpen(open) {
    // Actions are part of the same Num Pad settings panel.
    setFiltersOpen(open);
  }

  function resolvePickedChain() {
    return model.normalizeFactor(state.pickedChainFactor || state.pad.factor || state.drawnChainFactor);
  }

  function closeMobileOverlays() {
    setChainsOpen(false);
    setActionsOpen(false);
    setFiltersOpen(false);
  }

  function handleChainsClick(event) {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const actionEl = target instanceof Element ? target.closest("[data-chain-action]") : null;
    const row = target instanceof Element ? target.closest(".num-pad-chain") : null;
    if (!(row instanceof HTMLElement)) {
      return;
    }

    const factor = model.normalizeFactor(row.dataset.chainFactor);
    if (factor === null) {
      return;
    }

    if (isCompactNumPad() && !(actionEl instanceof HTMLElement)) {
      state.pickedChainFactor = factor;
      setChainsOpen(false);
      renderChains();
      applyMobileChrome();
      return;
    }

    const action = actionEl instanceof HTMLElement
      ? String(actionEl.dataset.chainAction || "fill")
      : "fill";

    if (action === "draw") {
      drawChain(factor);
      return;
    }

    fillChain(factor);
  }

  function handleKeydown(event) {
    // The shared settings overlay handles Escape in the capture phase; without
    // this the same keypress would also fall through and reset the pad.
    if (event.defaultPrevented || window.TaroOverlay?.isOpen?.()) {
      return;
    }
    if (!isNumPadActive() || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "Escape" || event.key === "Backspace") {
      if (state.filtersOpen || state.chainsOpen || state.actionsOpen) {
        event.preventDefault();
        closeMobileOverlays();
        return;
      }
      event.preventDefault();
      resetPad();
      return;
    }

    const factor = model.normalizeFactor(event.key);
    if (factor === null) {
      return;
    }

    event.preventDefault();
    chooseFactor(factor);
  }

  function ensureNumPadSection() {
    const {
      stageEl,
      resetEl,
      chainsEl,
      productToggleEl,
      rootToggleEl,
      chainProductToggleEl,
      chainRootToggleEl,
      placeFullEl,
      placeHunsEl,
      placeTensEl,
      placeOnesEl,
      chainPlaceFullEl,
      chainPlaceHunsEl,
      chainPlaceTensEl,
      chainPlaceOnesEl,
      degreeDownEl,
      degreeUpEl
    } = getElements();
    if (!stageEl) {
      applyMenuState();
      return;
    }

    if (!state.initialized) {
      stageEl.addEventListener("click", handleStageClick);
      if (chainsEl) {
        chainsEl.addEventListener("click", handleChainsClick);
      }
      if (resetEl) {
        resetEl.addEventListener("click", () => {
          resetPad();
        });
      }
      if (productToggleEl) {
        productToggleEl.addEventListener("click", () => {
          toggleDisplayFlag(model.DISPLAY_PRODUCT, "grid");
        });
      }
      if (rootToggleEl) {
        rootToggleEl.addEventListener("click", () => {
          toggleDisplayFlag(model.DISPLAY_DIGITAL_ROOT, "grid");
        });
      }
      if (chainProductToggleEl) {
        chainProductToggleEl.addEventListener("click", () => {
          toggleDisplayFlag(model.DISPLAY_PRODUCT, "chain");
        });
      }
      if (chainRootToggleEl) {
        chainRootToggleEl.addEventListener("click", () => {
          toggleDisplayFlag(model.DISPLAY_DIGITAL_ROOT, "chain");
        });
      }
      if (placeFullEl) {
        placeFullEl.addEventListener("click", () => {
          choosePlaceValue(model.PLACE_FULL);
        });
      }
      if (placeHunsEl) {
        placeHunsEl.addEventListener("click", () => {
          choosePlaceValue(model.PLACE_HUNDREDS);
        });
      }
      if (placeTensEl) {
        placeTensEl.addEventListener("click", () => {
          choosePlaceValue(model.PLACE_TENS);
        });
      }
      if (placeOnesEl) {
        placeOnesEl.addEventListener("click", () => {
          choosePlaceValue(model.PLACE_ONES);
        });
      }
      if (chainPlaceFullEl) {
        chainPlaceFullEl.addEventListener("click", () => {
          chooseChainPlaceValue(model.PLACE_FULL);
        });
      }
      if (chainPlaceHunsEl) {
        chainPlaceHunsEl.addEventListener("click", () => {
          chooseChainPlaceValue(model.PLACE_HUNDREDS);
        });
      }
      if (chainPlaceTensEl) {
        chainPlaceTensEl.addEventListener("click", () => {
          chooseChainPlaceValue(model.PLACE_TENS);
        });
      }
      if (chainPlaceOnesEl) {
        chainPlaceOnesEl.addEventListener("click", () => {
          chooseChainPlaceValue(model.PLACE_ONES);
        });
      }
      if (degreeDownEl) {
        degreeDownEl.addEventListener("click", () => {
          shiftDegree(-1);
        });
      }
      if (degreeUpEl) {
        degreeUpEl.addEventListener("click", () => {
          shiftDegree(1);
        });
      }
      const {
        mobileChainsEl,
        chainsBackdropEl,
        actionFactorsEl,
        actionFillEl,
        actionDrawEl,
        actionKeypadEl
      } = getElements();
      // The settings panel is opened through openNumPadSettings() so the panel
      // toolbars are docked and the action list rebuilt (the shared listener
      // would otherwise just move the panel).
      const numPadSettingsEl = document.getElementById("num-pad-settings");
      if (numPadSettingsEl) {
        numPadSettingsEl.addEventListener("click", () => {
          if (state.filtersOpen || state.actionsOpen) {
            closeNumPadSettings();
          } else {
            openNumPadSettings();
          }
        });
      }
      if (mobileChainsEl) {
        mobileChainsEl.addEventListener("click", () => {
          setChainsOpen(!state.chainsOpen);
        });
      }
      if (chainsBackdropEl) {
        chainsBackdropEl.addEventListener("click", () => {
          setChainsOpen(false);
        });
      }
      if (actionFactorsEl) {
        renderActionFactors();
        actionFactorsEl.addEventListener("click", (event) => {
          const button = event.target instanceof Element
            ? event.target.closest("[data-action-factor]")
            : null;
          if (!(button instanceof HTMLElement)) {
            return;
          }

          const factor = model.normalizeFactor(button.dataset.actionFactor);
          if (factor === null) {
            return;
          }

          state.pickedChainFactor = factor;
          renderChains();
          applyMobileChrome();
        });
      }
      if (actionFillEl) {
        actionFillEl.addEventListener("click", () => {
          const factor = resolvePickedChain();
          if (factor === null) {
            return;
          }
          fillChain(factor);
          setActionsOpen(false);
        });
      }
      if (actionDrawEl) {
        actionDrawEl.addEventListener("click", () => {
          const factor = resolvePickedChain();
          if (factor === null) {
            return;
          }
          drawChain(factor);
          setActionsOpen(false);
        });
      }
      if (actionKeypadEl) {
        actionKeypadEl.addEventListener("click", () => {
          resetPad();
          setActionsOpen(false);
        });
      }
      state.initialized = true;
    }

    if (!state.keyboardBound) {
      document.addEventListener("keydown", handleKeydown);
      state.keyboardBound = true;
    }

    if (!state.resizeBound) {
      const redrawPath = () => {
        if (state.drawnChainFactor === null || state.pathAnimTimer) {
          return;
        }
        renderDrawnPath({ animate: false });
      };
      window.addEventListener("resize", redrawPath);
      if (typeof ResizeObserver === "function" && stageEl) {
        const observer = new ResizeObserver(redrawPath);
        observer.observe(stageEl);
      }
      state.resizeBound = true;
    }

    renderPad();
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig
    };
    applyMenuState();
  }

  window.NumPadUi = {
    init,
    ensureNumPadSection,
    chooseFactor,
    resetPad,
    getState() {
      const flags = model.normalizeDisplayFlags(state.pad);
      return {
        mode: state.pad.mode,
        factor: state.pad.factor,
        showProduct: flags.gridShowProduct,
        showDigitalRoot: flags.gridShowDigitalRoot,
        gridShowProduct: flags.gridShowProduct,
        gridShowDigitalRoot: flags.gridShowDigitalRoot,
        chainShowProduct: flags.chainShowProduct,
        chainShowDigitalRoot: flags.chainShowDigitalRoot,
        placeValue: flags.gridPlaceValue,
        gridPlaceValue: flags.gridPlaceValue,
        chainPlaceValue: flags.chainPlaceValue,
        degree: model.normalizeDegree(state.pad.degree),
        drawnChainFactor: state.drawnChainFactor
      };
    },
    getCellAt(slotIndex) {
      return model.getCellAt(state.pad, slotIndex);
    }
  };
})();
