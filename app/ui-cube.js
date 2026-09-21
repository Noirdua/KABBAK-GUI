(function () {
  "use strict";

  const state = {
    initialized: false,
    controlsBound: false,
    cube: null,
    hebrewLetters: null,
    kabbalahPathsByLetterId: new Map(),
    markerDisplayMode: "both",
    rotationX: 18,
    rotationY: -28,
    zoom: 1,
    selectedNodeType: "wall",
    showConnectorLines: true,
    showPrimalPoint: true,
    showWallFaces: true,
    showCubeEdges: true,
    transparentSides: true,
    selectedConnectorId: null,
    selectedWallId: null,
    selectedEdgeId: null,
    focusMode: false,
    spin: false,
    viewDragging: false,
    exportInProgress: false,
    exportFormat: ""
  };

  const CUBE_EXPORT_FORMATS = {
    webp: {
      mimeType: "image/webp",
      extension: "webp",
      quality: 0.98
    }
  };
  const CUBE_EXPORT_BACKGROUND = "#111118";

  const CUBE_VERTICES = [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1]
  ];

  const FACE_GEOMETRY = {
    north: [4, 5, 6, 7],
    south: [1, 0, 3, 2],
    east: [5, 1, 2, 6],
    west: [0, 4, 7, 3],
    above: [0, 1, 5, 4],
    below: [7, 6, 2, 3]
  };

  const EDGE_GEOMETRY = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  const WALL_ORDER = ["north", "south", "east", "west", "above", "below"];
  const EDGE_ORDER = [
    "north-east",
    "south-east",
    "east-above",
    "east-below",
    "north-above",
    "north-below",
    "north-west",
    "south-west",
    "west-above",
    "west-below",
    "south-above",
    "south-below"
  ];
  const EDGE_GEOMETRY_KEYS = [
    "south-above",
    "south-east",
    "south-below",
    "south-west",
    "north-above",
    "north-east",
    "north-below",
    "north-west",
    "west-above",
    "east-above",
    "east-below",
    "west-below"
  ];
  const CUBE_VIEW_CENTER = { x: 110, y: 108 };
  const LOCAL_DIRECTION_ORDER = ["east", "south", "west", "north"];
  const LOCAL_DIRECTION_RANK = {
    east: 0,
    south: 1,
    west: 2,
    north: 3
  };
  const LOCAL_DIRECTION_VIEW_MAP = {
    north: "east",
    east: "south",
    south: "west",
    west: "north"
  };
  const MOTHER_CONNECTORS = [
    {
      id: "above-below",
      fromWallId: "above",
      toWallId: "below",
      hebrewLetterId: "alef",
      name: "Above ↔ Below"
    },
    {
      id: "east-west",
      fromWallId: "east",
      toWallId: "west",
      hebrewLetterId: "mem",
      name: "East ↔ West"
    },
    {
      id: "south-north",
      fromWallId: "south",
      toWallId: "north",
      hebrewLetterId: "shin",
      name: "South ↔ North"
    }
  ];

  const WALL_FRONT_ROTATIONS = {
    north: { x: 0, y: 0 },
    south: { x: 0, y: 180 },
    east: { x: 0, y: -90 },
    west: { x: 0, y: 90 },
    above: { x: -90, y: 0 },
    below: { x: 90, y: 0 }
  };
  const cubeDetailUi = window.CubeDetailUi || {};
  const cubeChassisUi = window.CubeChassisUi || {};
  const cubeMathHelpers = window.CubeMathHelpers || {};
  const cubeSelectionHelpers = window.CubeSelectionHelpers || {};
  let detailNavigator = null;
  let webpExportSupported = null;

  function getElements() {
    return {
      cubeSectionEl: document.getElementById("cube-section"),
      cubeLayoutEl: document.getElementById("cube-layout"),
      toolbarEl: document.getElementById("cube-toolbar"),
      viewContainerEl: document.getElementById("cube-view-container"),
      rotateLeftEl: document.getElementById("cube-rotate-left"),
      rotateRightEl: document.getElementById("cube-rotate-right"),
      rotateUpEl: document.getElementById("cube-rotate-up"),
      rotateDownEl: document.getElementById("cube-rotate-down"),
      rotateResetEl: document.getElementById("cube-rotate-reset"),
      viewIsoEl: document.getElementById("cube-view-iso"),
      viewFrontEl: document.getElementById("cube-view-front"),
      viewTopEl: document.getElementById("cube-view-top"),
      zoomInEl: document.getElementById("cube-zoom-in"),
      zoomOutEl: document.getElementById("cube-zoom-out"),
      focusToggleEl: document.getElementById("cube-focus-toggle"),
      exportWebpEl: document.getElementById("cube-export-webp"),
      markerModeEl: document.getElementById("cube-marker-mode"),
      connectorToggleEl: document.getElementById("cube-connector-toggle"),
      primalToggleEl: document.getElementById("cube-primal-toggle"),
      facesToggleEl: document.getElementById("cube-faces-toggle"),
      edgesToggleEl: document.getElementById("cube-edges-toggle"),
      sidesToggleEl: document.getElementById("cube-sides-toggle"),
      spinToggleEl: document.getElementById("cube-spin-toggle"),
      rotationReadoutEl: document.getElementById("cube-rotation-readout"),
      detailNameEl: document.getElementById("cube-detail-name"),
      detailSubEl: document.getElementById("cube-detail-sub"),
      detailPrevEl: document.getElementById("cube-detail-prev"),
      detailPositionEl: document.getElementById("cube-detail-position"),
      detailNextEl: document.getElementById("cube-detail-next"),
      detailBodyEl: document.getElementById("cube-detail-body")
    };
  }

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeLetterKey(value) {
    const key = normalizeId(value).replace(/[^a-z]/g, "");
    const aliases = {
      aleph: "alef",
      beth: "bet",
      heh: "he",
      zain: "zayin",
      cheth: "het",
      chet: "het",
      daleth: "dalet",
      kaf: "kaf",
      kaph: "kaf",
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

  function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  function getWalls() {
    const walls = Array.isArray(state.cube?.walls) ? state.cube.walls : [];
    return walls
      .slice()
      .sort((left, right) => WALL_ORDER.indexOf(normalizeId(left?.id)) - WALL_ORDER.indexOf(normalizeId(right?.id)));
  }

  function getWallById(wallId) {
    const target = normalizeId(wallId);
    return getWalls().find((wall) => normalizeId(wall?.id) === target) || null;
  }

  function normalizeEdgeId(value) {
    return normalizeId(value).replace(/[\s_]+/g, "-");
  }

  function formatEdgeName(edgeId) {
    return normalizeEdgeId(edgeId)
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function formatDirectionName(direction) {
    const key = normalizeId(direction);
    return key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : "";
  }

  function getEdges() {
    const configuredEdges = Array.isArray(state.cube?.edges) ? state.cube.edges : [];
    const byId = new Map(
      configuredEdges.map((edge) => [normalizeEdgeId(edge?.id), edge])
    );

    return EDGE_ORDER.map((edgeId) => {
      const configured = byId.get(edgeId);
      if (configured) {
        return configured;
      }
      return {
        id: edgeId,
        name: formatEdgeName(edgeId),
        walls: edgeId.split("-")
      };
    });
  }

  function getEdgeById(edgeId) {
    const target = normalizeEdgeId(edgeId);
    return getEdges().find((edge) => normalizeEdgeId(edge?.id) === target) || null;
  }

  function getEdgeWalls(edge) {
    const explicitWalls = Array.isArray(edge?.walls)
      ? edge.walls.map((wallId) => normalizeId(wallId)).filter(Boolean)
      : [];

    if (explicitWalls.length >= 2) {
      return explicitWalls.slice(0, 2);
    }

    return normalizeEdgeId(edge?.id)
      .split("-")
      .map((wallId) => normalizeId(wallId))
      .filter(Boolean)
      .slice(0, 2);
  }

  function getEdgesForWall(wallOrWallId) {
    const wallId = normalizeId(typeof wallOrWallId === "string" ? wallOrWallId : wallOrWallId?.id);
    return getEdges().filter((edge) => getEdgeWalls(edge).includes(wallId));
  }

  function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (typeof cubeMathHelpers.createCubeMathHelpers !== "function") {
    throw new Error("CubeMathHelpers.createCubeMathHelpers is unavailable. Ensure app/ui-cube-math.js loads before app/ui-cube.js.");
  }

  if (typeof cubeSelectionHelpers.createCubeSelectionHelpers !== "function") {
    throw new Error("CubeSelectionHelpers.createCubeSelectionHelpers is unavailable. Ensure app/ui-cube-selection.js loads before app/ui-cube.js.");
  }

  function normalizeAngle(angle) {
    return cubeMathUi.normalizeAngle(angle);
  }

  function setRotation(nextX, nextY) {
    cubeMathUi.setRotation(nextX, nextY);
  }

  function snapRotationToWall(wallId) {
    cubeMathUi.snapRotationToWall(wallId);
  }

  function facePoint(quad, u, v) {
    return cubeMathUi.facePoint(quad, u, v);
  }

  function projectVerticesForRotation(rotationX, rotationY) {
    return cubeMathUi.projectVerticesForRotation(rotationX, rotationY);
  }

  function projectVertices() {
    return cubeMathUi.projectVertices();
  }

  function getEdgeGeometryById(edgeId) {
    return cubeMathUi.getEdgeGeometryById(edgeId);
  }

  function getWallEdgeDirections(wallOrWallId) {
    return cubeMathUi.getWallEdgeDirections(wallOrWallId);
  }

  function getEdgeDirectionForWall(wallId, edgeId) {
    return cubeMathUi.getEdgeDirectionForWall(wallId, edgeId);
  }

  function getEdgeDirectionLabelForWall(wallId, edgeId) {
    return cubeMathUi.getEdgeDirectionLabelForWall(wallId, edgeId);
  }

  function rotateAndRender(deltaX, deltaY) {
    setRotation(state.rotationX + deltaX, state.rotationY + deltaY);
    render(getElements());
  }

  function resetRotationAndRender() {
    setRotation(18, -28);
    setZoom(1);
    render(getElements());
  }

  function setZoom(value) {
    const next = Number(value);
    state.zoom = Math.min(2, Math.max(0.6, Number.isFinite(next) ? next : 1));
  }

  function zoomAndRender(factor) {
    setZoom(state.zoom * factor);
    render(getElements());
  }

  function applyViewPreset(name) {
    if (name === "iso") {
      setRotation(18, -28);
    } else {
      snapRotationToWall(name);
    }
    render(getElements());
  }

  // Pointer drag to rotate, wheel or pinch to zoom. A short drag still lets a
  // click through so walls and edges stay selectable.
  function bindViewportInteractions(elements) {
    const host = elements?.viewContainerEl;
    if (!(host instanceof HTMLElement) || host.dataset.cubeInteractionsBound === "true") {
      return;
    }
    host.dataset.cubeInteractionsBound = "true";

    const pointers = new Map();
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let travelled = 0;
    let pinchStart = 0;
    let pinchZoomStart = 1;

    const pointerList = () => [...pointers.values()];

    host.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        dragging = true;
        travelled = 0;
        lastX = event.clientX;
        lastY = event.clientY;
        host.setPointerCapture?.(event.pointerId);
      } else if (pointers.size === 2) {
        const [a, b] = pointerList();
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        pinchZoomStart = state.zoom;
        dragging = false;
      }
      state.viewDragging = dragging;
    });

    host.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) {
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size === 2 && pinchStart > 0) {
        const [a, b] = pointerList();
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        setZoom(pinchZoomStart * (distance / pinchStart));
        render(getElements());
        event.preventDefault();
        return;
      }

      if (!dragging) {
        return;
      }
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      travelled += Math.abs(dx) + Math.abs(dy);
      if (travelled < 3) {
        return;
      }
      setRotation(state.rotationX + dy * 0.45, state.rotationY + dx * 0.45);
      render(getElements());
      event.preventDefault();
    });

    const endPointer = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) {
        dragging = false;
      }
      state.viewDragging = dragging;
      if (pointers.size < 2) {
        pinchStart = 0;
      }
    };
    host.addEventListener("pointerup", endPointer);
    host.addEventListener("pointercancel", endPointer);
    host.addEventListener("lostpointercapture", endPointer);

    host.addEventListener("wheel", (event) => {
      zoomAndRender(event.deltaY > 0 ? 0.92 : 1.08);
      event.preventDefault();
    }, { passive: false });
  }

  function isKeyboardEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  }

  function syncFocusControls(elements) {
    if (elements?.cubeLayoutEl instanceof HTMLElement) {
      elements.cubeLayoutEl.classList.toggle("is-cube-focus", Boolean(state.focusMode));
    }

    if (elements?.focusToggleEl instanceof HTMLButtonElement) {
      elements.focusToggleEl.setAttribute("aria-pressed", state.focusMode ? "true" : "false");
      elements.focusToggleEl.textContent = state.focusMode ? "Show Full Cube" : "Focus Cube";
    }
  }

  function isExportFormatSupported(format) {
    const exportFormat = CUBE_EXPORT_FORMATS[format];
    if (!exportFormat) {
      return false;
    }

    if (format === "webp" && typeof webpExportSupported === "boolean") {
      return webpExportSupported;
    }

    const probeCanvas = document.createElement("canvas");
    const dataUrl = probeCanvas.toDataURL(exportFormat.mimeType);
    const isSupported = dataUrl.startsWith(`data:${exportFormat.mimeType}`);
    if (format === "webp") {
      webpExportSupported = isSupported;
    }
    return isSupported;
  }

  function syncExportControls(elements) {
    if (!(elements?.exportWebpEl instanceof HTMLButtonElement)) {
      return;
    }

    const supportsWebp = isExportFormatSupported("webp");
    elements.exportWebpEl.hidden = !supportsWebp;
    elements.exportWebpEl.disabled = Boolean(state.exportInProgress) || !supportsWebp;
    elements.exportWebpEl.textContent = state.exportInProgress && state.exportFormat === "webp"
      ? "Exporting..."
      : "Export WebP";

    if (supportsWebp) {
      elements.exportWebpEl.title = "Download the current cube view as a WebP image.";
    }
  }

  function copyComputedStyles(sourceEl, targetEl) {
    if (!(sourceEl instanceof Element) || !(targetEl instanceof Element)) {
      return;
    }

    const computedStyle = window.getComputedStyle(sourceEl);
    Array.from(computedStyle).forEach((propertyName) => {
      targetEl.style.setProperty(
        propertyName,
        computedStyle.getPropertyValue(propertyName),
        computedStyle.getPropertyPriority(propertyName)
      );
    });

    targetEl.style.setProperty("animation", "none");
    targetEl.style.setProperty("transition", "none");
  }

  function inlineSvgStyles(sourceNode, targetNode) {
    if (!(sourceNode instanceof Element) || !(targetNode instanceof Element)) {
      return;
    }

    copyComputedStyles(sourceNode, targetNode);

    const sourceChildren = Array.from(sourceNode.children);
    const targetChildren = Array.from(targetNode.children);
    const childCount = Math.min(sourceChildren.length, targetChildren.length);
    for (let index = 0; index < childCount; index += 1) {
      inlineSvgStyles(sourceChildren[index], targetChildren[index]);
    }
  }

  function absolutizeSvgImageLinks(svgEl) {
    if (!(svgEl instanceof SVGSVGElement)) {
      return;
    }

    svgEl.querySelectorAll("image").forEach((imageEl) => {
      const href = imageEl.getAttribute("href")
        || imageEl.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (!href) {
        return;
      }

      const absoluteHref = new URL(href, document.baseURI).href;
      imageEl.setAttribute("href", absoluteHref);
      imageEl.setAttributeNS("http://www.w3.org/1999/xlink", "href", absoluteHref);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read the image data."));
      reader.readAsDataURL(blob);
    });
  }

  function buildImageRequestHeaders(url) {
    const apiBase = String(window.TarotDataService?.getApiBaseUrl?.() || "")
      .trim()
      .replace(/\/+$/, "");
    const apiKey = String(window.TarotDataService?.getApiKey?.() || "").trim();
    if (!apiBase || !apiKey || !String(url).startsWith(apiBase)) {
      return {};
    }
    return { "x-api-key": apiKey };
  }

  // An SVG rendered through <img> cannot fetch external images, so card art has
  // to be embedded as data URLs or the export shows broken-image icons.
  async function inlineSvgImagesAsDataUrls(svgEl) {
    const images = Array.from(svgEl.querySelectorAll("image"));
    const cache = new Map();

    for (const imageEl of images) {
      const href = imageEl.getAttribute("href")
        || imageEl.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      if (!href || String(href).startsWith("data:")) {
        continue;
      }

      let absolute;
      try {
        absolute = new URL(href, document.baseURI).href;
      } catch (_error) {
        continue;
      }

      if (!cache.has(absolute)) {
        try {
          const response = await fetch(absolute, {
            headers: buildImageRequestHeaders(absolute),
            cache: "force-cache"
          });
          if (!response.ok) {
            throw new Error(`Image request failed (${response.status}).`);
          }
          cache.set(absolute, await blobToDataUrl(await response.blob()));
        } catch (_error) {
          cache.set(absolute, "");
        }
      }

      const dataUrl = cache.get(absolute);
      if (dataUrl) {
        imageEl.setAttribute("href", dataUrl);
        imageEl.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
      }
    }
  }

  async function prepareSvgMarkupForExport(svgEl) {
    if (!(svgEl instanceof SVGSVGElement)) {
      throw new Error("Cube view is not ready to export yet.");
    }

    const bounds = svgEl.getBoundingClientRect();
    const viewBox = svgEl.viewBox?.baseVal || null;
    const width = Math.max(
      240,
      Math.round(bounds.width),
      Number.isFinite(viewBox?.width) ? Math.round(viewBox.width) : 0
    );
    const height = Math.max(
      220,
      Math.round(bounds.height),
      Number.isFinite(viewBox?.height) ? Math.round(viewBox.height) : 0
    );

    const clone = svgEl.cloneNode(true);
    if (!(clone instanceof SVGSVGElement)) {
      throw new Error("Cube export could not clone the current SVG view.");
    }

    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    inlineSvgStyles(svgEl, clone);
    absolutizeSvgImageLinks(clone);
    await inlineSvgImagesAsDataUrls(clone);

    const backgroundRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    backgroundRect.setAttribute("x", "0");
    backgroundRect.setAttribute("y", "0");
    backgroundRect.setAttribute("width", "100%");
    backgroundRect.setAttribute("height", "100%");
    backgroundRect.setAttribute("fill", CUBE_EXPORT_BACKGROUND);
    backgroundRect.setAttribute("pointer-events", "none");
    clone.insertBefore(backgroundRect, clone.firstChild);

    return {
      width,
      height,
      markup: new XMLSerializer().serializeToString(clone)
    };
  }

  function loadSvgImage(markup) {
    return new Promise((resolve, reject) => {
      const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();

      image.decoding = "async";
      image.onload = () => {
        URL.revokeObjectURL(svgUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        reject(new Error("Cube export renderer could not load the current SVG view."));
      };
      image.src = svgUrl;
    });
  }

  function canvasToBlobByFormat(canvas, format) {
    const exportFormat = CUBE_EXPORT_FORMATS[format];
    if (!exportFormat) {
      return Promise.reject(new Error("Unsupported export format."));
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Canvas export failed."));
      }, exportFormat.mimeType, exportFormat.quality);
    });
  }

  async function exportCubeView(format = "webp") {
    const exportFormat = CUBE_EXPORT_FORMATS[format];
    if (!exportFormat || state.exportInProgress) {
      return;
    }

    const elements = getElements();
    const svgEl = elements.viewContainerEl?.querySelector("svg.cube-svg");
    if (!(svgEl instanceof SVGSVGElement)) {
      window.alert("Cube view is not ready to export yet.");
      return;
    }

    state.exportInProgress = true;
    state.exportFormat = format;
    syncExportControls(elements);

    try {
      const { width, height, markup } = await prepareSvgMarkupForExport(svgEl);
      const image = await loadSvgImage(markup);
      const scale = Math.max(2, Math.min(4, Number(window.devicePixelRatio) || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(width * scale));
      canvas.height = Math.max(1, Math.ceil(height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context is unavailable.");
      }

      context.scale(scale, scale);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = CUBE_EXPORT_BACKGROUND;
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const blob = await canvasToBlobByFormat(canvas, format);
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      downloadLink.href = blobUrl;
      downloadLink.download = `cube-of-space-${stamp}.${exportFormat.extension}`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to export the current cube view.");
    } finally {
      state.exportInProgress = false;
      state.exportFormat = "";
      syncExportControls(getElements());
    }
  }

  function bindRotationControls(elements) {
    if (state.controlsBound) {
      return;
    }

    elements.rotateLeftEl?.addEventListener("click", () => rotateAndRender(0, -9));
    elements.rotateRightEl?.addEventListener("click", () => rotateAndRender(0, 9));
    elements.rotateUpEl?.addEventListener("click", () => rotateAndRender(-9, 0));
    elements.rotateDownEl?.addEventListener("click", () => rotateAndRender(9, 0));
    elements.rotateResetEl?.addEventListener("click", resetRotationAndRender);
    elements.viewIsoEl?.addEventListener("click", () => applyViewPreset("iso"));
    elements.viewFrontEl?.addEventListener("click", () => applyViewPreset("north"));
    elements.viewTopEl?.addEventListener("click", () => applyViewPreset("above"));
    elements.zoomInEl?.addEventListener("click", () => zoomAndRender(1.12));
    elements.zoomOutEl?.addEventListener("click", () => zoomAndRender(0.9));
    bindViewportInteractions(elements);
    elements.focusToggleEl?.addEventListener("click", () => {
      state.focusMode = !state.focusMode;
      syncFocusControls(getElements());
    });
    elements.exportWebpEl?.addEventListener("click", () => {
      void exportCubeView("webp");
    });

    if (elements.spinToggleEl) {
      elements.spinToggleEl.checked = state.spin === true;
      elements.spinToggleEl.addEventListener("change", (event) => {
        state.spin = Boolean(event?.target?.checked);
        if (state.spin) {
          ensureCubeSpin(getElements());
        }
      });
    }

    elements.markerModeEl?.addEventListener("change", (event) => {
      const nextMode = normalizeId(event?.target?.value);
      state.markerDisplayMode = ["both", "letter", "astro", "tarot"].includes(nextMode)
        ? nextMode
        : "both";
      render(getElements());
    });

    if (elements.connectorToggleEl) {
      elements.connectorToggleEl.checked = state.showConnectorLines;
      elements.connectorToggleEl.addEventListener("change", () => {
        state.showConnectorLines = Boolean(elements.connectorToggleEl.checked);
        if (!state.showConnectorLines && state.selectedNodeType === "connector") {
          state.selectedNodeType = "wall";
          state.selectedConnectorId = null;
        }
        render(getElements());
      });
    }

    if (elements.primalToggleEl) {
      elements.primalToggleEl.checked = state.showPrimalPoint;
      elements.primalToggleEl.addEventListener("change", () => {
        state.showPrimalPoint = Boolean(elements.primalToggleEl.checked);
        if (!state.showPrimalPoint && state.selectedNodeType === "center") {
          state.selectedNodeType = "wall";
        }
        render(getElements());
      });
    }

    if (elements.facesToggleEl) {
      elements.facesToggleEl.checked = state.showWallFaces;
      elements.facesToggleEl.addEventListener("change", () => {
        state.showWallFaces = Boolean(elements.facesToggleEl.checked);
        render(getElements());
      });
    }

    if (elements.edgesToggleEl) {
      elements.edgesToggleEl.checked = state.showCubeEdges;
      elements.edgesToggleEl.addEventListener("change", () => {
        state.showCubeEdges = Boolean(elements.edgesToggleEl.checked);
        if (!state.showCubeEdges && state.selectedNodeType === "edge") {
          state.selectedNodeType = "wall";
        }
        render(getElements());
      });
    }

    if (elements.sidesToggleEl) {
      elements.sidesToggleEl.checked = state.transparentSides;
      elements.sidesToggleEl.addEventListener("change", () => {
        state.transparentSides = Boolean(elements.sidesToggleEl.checked);
        render(getElements());
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      // Keyboard shortcuts work whenever the Cube section is on screen, not
      // only in focus mode.
      const cubeSection = getElements().cubeSectionEl;
      if (!(cubeSection instanceof HTMLElement) || cubeSection.hidden) {
        return;
      }

      if (isKeyboardEditableTarget(event.target)) {
        return;
      }

      switch (String(event.key || "").toLowerCase()) {
        case "a":
        case "arrowleft":
          event.preventDefault();
          rotateAndRender(0, -9);
          break;
        case "d":
        case "arrowright":
          event.preventDefault();
          rotateAndRender(0, 9);
          break;
        case "w":
        case "arrowup":
          event.preventDefault();
          rotateAndRender(-9, 0);
          break;
        case "s":
        case "arrowdown":
          event.preventDefault();
          rotateAndRender(9, 0);
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomAndRender(1.12);
          break;
        case "-":
          event.preventDefault();
          zoomAndRender(0.9);
          break;
        case "0":
          event.preventDefault();
          setZoom(1);
          resetRotationAndRender();
          break;
        default:
          break;
      }
    });

    state.controlsBound = true;
  }

  function getHebrewLetterSymbol(hebrewLetterId) {
    return cubeMathUi.getHebrewLetterSymbol(hebrewLetterId);
  }

  function getHebrewLetterName(hebrewLetterId) {
    return cubeMathUi.getHebrewLetterName(hebrewLetterId);
  }

  function getAstrologySymbol(type, name) {
    return cubeMathUi.getAstrologySymbol(type, name);
  }

  function getEdgeLetterId(edge) {
    return normalizeLetterKey(edge?.hebrewLetterId || edge?.associations?.hebrewLetterId);
  }

  function getWallFaceLetterId(wall) {
    return normalizeLetterKey(wall?.hebrewLetterId || wall?.associations?.hebrewLetterId);
  }

  function getWallFaceLetter(wall) {
    const hebrewLetterId = getWallFaceLetterId(wall);
    if (!hebrewLetterId) {
      return "";
    }
    return getHebrewLetterSymbol(hebrewLetterId);
  }

  function getCubeCenterData() {
    const center = state.cube?.center;
    return center && typeof center === "object" ? center : null;
  }

  function getCenterLetterId(center = null) {
    return cubeMathUi.getCenterLetterId(center);
  }

  function getCenterLetterSymbol(center = null) {
    return cubeMathUi.getCenterLetterSymbol(center);
  }

  function getConnectorById(connectorId) {
    const target = normalizeId(connectorId);
    return MOTHER_CONNECTORS.find((entry) => normalizeId(entry?.id) === target) || null;
  }

  function getConnectorPathEntry(connector) {
    const letterId = normalizeLetterKey(connector?.hebrewLetterId);
    if (!letterId) {
      return null;
    }
    return state.kabbalahPathsByLetterId.get(letterId) || null;
  }

  function getEdgePathEntry(edge) {
    const hebrewLetterId = getEdgeLetterId(edge);

    if (!hebrewLetterId) {
      return null;
    }

    return state.kabbalahPathsByLetterId.get(hebrewLetterId) || null;
  }

  function getPathEntryByLetterId(letterId) {
    const normalizedLetterId = normalizeLetterKey(letterId);
    if (!normalizedLetterId) {
      return null;
    }

    return state.kabbalahPathsByLetterId.get(normalizedLetterId) || null;
  }

  const cubeMathUi = cubeMathHelpers.createCubeMathHelpers({
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
  });

  const cubeSelectionUi = cubeSelectionHelpers.createCubeSelectionHelpers({
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
  });

  function getEdgeAstrologySymbol(edge) {
    return cubeMathUi.getEdgeAstrologySymbol(edge);
  }

  function getEdgeMarkerDisplay(edge) {
    return cubeMathUi.getEdgeMarkerDisplay(edge);
  }

  function getEdgeLetter(edge) {
    return cubeMathUi.getEdgeLetter(edge);
  }

  function getWallTarotCard(wall) {
    return toDisplayText(wall?.associations?.tarotCard || wall?.tarotCard);
  }

  function getEdgeTarotCard(edge) {
    const pathEntry = getEdgePathEntry(edge);
    return toDisplayText(pathEntry?.tarot?.card);
  }

  function getConnectorTarotCard(connector) {
    const pathEntry = getConnectorPathEntry(connector);
    return toDisplayText(pathEntry?.tarot?.card);
  }

  function getCenterTarotCard(center = null) {
    const entry = center || getCubeCenterData();
    return toDisplayText(entry?.associations?.tarotCard || entry?.tarotCard);
  }

  function resolveCardImageUrl(cardName) {
    const name = toDisplayText(cardName);
    if (!name || typeof window.TarotCardImages?.resolveTarotCardImage !== "function") {
      return null;
    }
    return window.TarotCardImages.resolveTarotCardImage(name) || null;
  }

  function openTarotCardInfo(cardName, trumpNumber = null) {
    const detail = {};
    const normalizedCardName = toDisplayText(cardName);
    const normalizedTrumpNumber = toFiniteNumber(trumpNumber);

    if (normalizedCardName) {
      detail.cardName = normalizedCardName;
    }

    if (normalizedTrumpNumber != null) {
      detail.trumpNumber = normalizedTrumpNumber;
    }

    if (!detail.cardName && detail.trumpNumber == null) {
      return false;
    }

    document.dispatchEvent(new CustomEvent("nav:tarot-trump", { detail }));
    return true;
  }

  function openTarotCardLightbox(cardName, fallbackSrc = "", fallbackLabel = "") {
    const openLightbox = window.TarotUiLightbox?.open;
    if (typeof openLightbox !== "function") {
      return false;
    }

    const src = toDisplayText(fallbackSrc) || resolveCardImageUrl(cardName);
    if (!src) {
      return false;
    }

    const label = toDisplayText(cardName) || toDisplayText(fallbackLabel) || "Tarot card";
    openLightbox(src, label);
    return true;
  }

  function applyPlacement(placement) {
    return cubeSelectionUi.applyPlacement(placement);
  }

  function toDisplayText(value) {
    return String(value ?? "").trim();
  }

  function renderFaceSvg(containerEl, walls) {
    if (typeof cubeChassisUi.renderFaceSvg !== "function") {
      if (containerEl) {
        containerEl.replaceChildren();
      }
      return;
    }

    cubeChassisUi.renderFaceSvg({
      state,
      containerEl,
      walls,
      normalizeId,
      projectVertices,
      FACE_GEOMETRY,
      facePoint,
      normalizeEdgeId,
      getEdges,
      getEdgesForWall,
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
    });
  }

  function selectEdgeById(edgeId, preferredWallId = "") {
    return cubeSelectionUi.selectEdgeById(edgeId, preferredWallId);
  }

  function renderDetail(elements, walls) {
    if (typeof cubeDetailUi.renderDetail !== "function") {
      if (elements?.detailNameEl) {
        elements.detailNameEl.textContent = "Cube data unavailable";
      }
      if (elements?.detailSubEl) {
        elements.detailSubEl.textContent = "Cube detail renderer missing.";
      }
      if (elements?.detailBodyEl) {
        elements.detailBodyEl.innerHTML = "";
      }
      return;
    }

    cubeDetailUi.renderDetail({
      state,
      elements,
      walls,
      normalizeId,
      normalizeEdgeId,
      normalizeLetterKey,
      formatDirectionName,
      formatEdgeName,
      toFiniteNumber,
      getWallById,
      getEdgeById,
      getEdges,
      getEdgeWalls,
      getEdgesForWall,
      getWallEdgeDirections,
      getConnectorById,
      getConnectorPathEntry,
      getPathEntryByLetterId,
      getCubeCenterData,
      getCenterLetterId,
      getCenterLetterSymbol,
      getEdgeLetterId,
      getEdgeLetter,
      getEdgePathEntry,
      getEdgeAstrologySymbol,
      getWallFaceLetterId,
      getWallFaceLetter,
      getHebrewLetterName,
      getHebrewLetterSymbol,
      localDirectionOrder: LOCAL_DIRECTION_ORDER,
      localDirectionRank: LOCAL_DIRECTION_RANK,
      onSelectWall: selectWallById,
      onSelectEdge: selectEdgeById
    });
  }

  function buildSequenceKey(nodeType, id) {
    const normalizedNodeType = normalizeId(nodeType);
    if (normalizedNodeType === "edge") {
      const normalizedEdgeId = normalizeEdgeId(id);
      return normalizedEdgeId ? `edge:${normalizedEdgeId}` : "";
    }

    if (normalizedNodeType === "wall") {
      const normalizedWallId = normalizeId(id);
      return normalizedWallId ? `wall:${normalizedWallId}` : "";
    }

    return "";
  }

  function getDetailSequenceState() {
    const selectedNodeType = normalizeId(state.selectedNodeType);
    const isEdgeSequence = selectedNodeType === "edge";
    const isWallSequence = selectedNodeType === "wall";

    if (!isEdgeSequence && !isWallSequence) {
      return {
        total: 0,
        currentIndex: -1,
        previousId: "",
        nextId: ""
      };
    }

    const entries = isEdgeSequence
      ? EDGE_ORDER
        .map((edgeId) => getEdgeById(edgeId))
        .filter(Boolean)
      : WALL_ORDER
        .map((wallId) => getWallById(wallId))
        .filter(Boolean);

    const selectedKey = isEdgeSequence
      ? buildSequenceKey("edge", state.selectedEdgeId)
      : buildSequenceKey("wall", state.selectedWallId);
    const keys = entries.map((entry) => buildSequenceKey(selectedNodeType, entry?.id));
    const currentIndex = keys.findIndex((key) => key === selectedKey);

    return {
      total: entries.length,
      currentIndex,
      previousId: currentIndex > 0 ? keys[currentIndex - 1] : "",
      nextId: currentIndex >= 0 && currentIndex < keys.length - 1 ? keys[currentIndex + 1] : ""
    };
  }

  function selectSequenceTarget(targetKey) {
    const [nodeType, rawId] = String(targetKey || "").split(":");
    const normalizedNodeType = normalizeId(nodeType);

    if (normalizedNodeType === "edge") {
      return selectEdgeById(rawId);
    }

    if (normalizedNodeType === "wall") {
      return selectWallById(rawId);
    }

    return false;
  }

  function getDetailNavigator() {
    if (detailNavigator || typeof window.TarotSequenceNav?.createSequenceNavigator !== "function") {
      return detailNavigator;
    }

    detailNavigator = window.TarotSequenceNav.createSequenceNavigator({
      getElements,
      isActive: (elements) => Boolean(elements?.cubeSectionEl && elements.cubeSectionEl.hidden === false),
      getSequenceState: getDetailSequenceState,
      getPrevButton: (elements) => elements?.detailPrevEl,
      getNextButton: (elements) => elements?.detailNextEl,
      getPositionEl: (elements) => elements?.detailPositionEl,
      formatPositionText: ({ total, currentIndex }) => {
        const selectedNodeType = normalizeId(state.selectedNodeType);
        const label = selectedNodeType === "edge"
          ? "edges"
          : (selectedNodeType === "wall" ? "walls" : "items");

        if (total > 0 && currentIndex >= 0) {
          return `${currentIndex + 1} of ${total} ${label}`;
        }

        if (selectedNodeType === "connector") {
          return "Connector";
        }

        if (selectedNodeType === "center") {
          return "Primal Point";
        }

        return total > 0 ? `${total} ${label}` : "No sequence";
      },
      selectTarget: (targetKey) => selectSequenceTarget(targetKey)
    });

    return detailNavigator;
  }

  function syncDetailNavigation(elements = getElements()) {
    getDetailNavigator()?.sync(elements);
  }

  function bindDetailNavigation(elements = getElements()) {
    getDetailNavigator()?.bind(elements);
  }

  function render(elements) {
    syncFocusControls(elements);
    syncExportControls(elements);

    if (elements?.markerModeEl) {
      elements.markerModeEl.value = state.markerDisplayMode;
    }

    if (elements?.connectorToggleEl) {
      elements.connectorToggleEl.checked = state.showConnectorLines;
    }

    if (elements?.primalToggleEl) {
      elements.primalToggleEl.checked = state.showPrimalPoint;
    }

    if (elements?.spinToggleEl) {
      elements.spinToggleEl.checked = state.spin === true;
    }

    if (elements?.rotationReadoutEl) {
      elements.rotationReadoutEl.textContent = `X ${Math.round(state.rotationX)}° · Y ${Math.round(state.rotationY)}° · ${state.zoom.toFixed(2)}×`;
    }

    const walls = getWalls();
    renderFaceSvg(elements.viewContainerEl, walls);
    renderDetail(elements, walls);
    syncDetailNavigation(elements);
  }

  const cubeSpin = { frame: 0, last: 0 };
  const CUBE_SPIN_STEP_MS = 33;

  // Re-rendering the chassis is the expensive part of a frame, so the spin steps
  // at ~30fps instead of once per frame, and pauses while the user is dragging
  // so the two inputs don't fight.
  function ensureCubeSpin(elements) {
    if (cubeSpin.frame) {
      return;
    }

    const step = (timestamp) => {
      cubeSpin.frame = 0;
      const section = elements?.cubeSectionEl || getElements().cubeSectionEl;
      if (!section || section.hidden || state.spin !== true || document.hidden) {
        return;
      }

      if (Number(timestamp) - cubeSpin.last >= CUBE_SPIN_STEP_MS) {
        cubeSpin.last = Number(timestamp);
        if (state.viewDragging !== true) {
          setRotation(state.rotationX, Number(state.rotationY || 0) + 0.7);
          render(getElements());
        }
      }

      cubeSpin.frame = window.requestAnimationFrame(step);
    };

    cubeSpin.frame = window.requestAnimationFrame(step);
  }

  function ensureCubeSection(magickDataset) {
    const cubeData = magickDataset?.grouped?.kabbalah?.cube;
    const elements = getElements();

    state.cube = cubeData || null;
    state.hebrewLetters =
      asRecord(magickDataset?.grouped?.hebrewLetters)
      || asRecord(magickDataset?.grouped?.alphabets?.hebrew)
      || null;

    const pathList = Array.isArray(magickDataset?.grouped?.kabbalah?.["kabbalah-tree"]?.paths)
      ? magickDataset.grouped.kabbalah["kabbalah-tree"].paths
      : [];

    const letterEntries = state.hebrewLetters && typeof state.hebrewLetters === "object"
      ? Object.values(state.hebrewLetters)
      : [];
    const letterIdsByChar = new Map(
      letterEntries
        .map((letterEntry) => [String(letterEntry?.letter?.he || "").trim(), normalizeLetterKey(letterEntry?.id)])
        .filter(([character, letterId]) => Boolean(character) && Boolean(letterId))
    );

    state.kabbalahPathsByLetterId = new Map(
      pathList
        .map((pathEntry) => {
          const transliterationId = normalizeLetterKey(pathEntry?.hebrewLetter?.transliteration);
          const char = String(pathEntry?.hebrewLetter?.char || "").trim();
          const charId = letterIdsByChar.get(char) || "";
          return [charId || transliterationId, pathEntry];
        })
        .filter(([letterId]) => Boolean(letterId))
    );

    if (!state.selectedWallId) {
      state.selectedWallId = normalizeId(getWalls()[0]?.id);
    }

    const initialEdge = getEdgesForWall(state.selectedWallId)[0] || getEdges()[0] || null;
    if (!state.selectedEdgeId || !getEdgeById(state.selectedEdgeId)) {
      state.selectedEdgeId = normalizeEdgeId(initialEdge?.id);
    }

    bindRotationControls(elements);
    bindDetailNavigation(elements);

    render(elements);
    state.initialized = true;
    ensureCubeSpin(elements);
  }

  function selectWallById(wallId) {
    return cubeSelectionUi.selectWallById(wallId);
  }

  function selectConnectorById(connectorId) {
    return cubeSelectionUi.selectConnectorById(connectorId);
  }

  function selectCenterNode() {
    return cubeSelectionUi.selectCenterNode();
  }

  function selectPlacement(criteria = {}) {
    return cubeSelectionUi.selectPlacement(criteria);
  }

  function selectByHebrewLetterId(hebrewLetterId) {
    return selectPlacement({ hebrewLetterId });
  }

  function selectBySignId(signId) {
    return selectPlacement({ signId });
  }

  function selectByPlanetId(planetId) {
    return selectPlacement({ planetId });
  }

  function selectByPathNo(pathNo) {
    return selectPlacement({ pathNo });
  }

  window.CubeSectionUi = {
    ensureCubeSection,
    selectWallById,
    selectPlacement,
    selectByHebrewLetterId,
    selectBySignId,
    selectByPlanetId,
    selectByPathNo,
    getEdgeDirectionForWall,
    getEdgeDirectionLabelForWall
  };
})();
