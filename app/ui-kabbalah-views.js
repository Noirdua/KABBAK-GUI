(function () {
  "use strict";

  function resolvePathTarotImage(path) {
    const cardName = String(path?.tarot?.card || "").trim();
    if (!cardName || typeof window.TarotCardImages?.resolveTarotCardImage !== "function") {
      return null;
    }

    return window.TarotCardImages.resolveTarotCardImage(cardName);
  }

  function getSvgImageHref(imageEl) {
    if (!(imageEl instanceof SVGElement)) {
      return "";
    }

    return String(
      imageEl.getAttribute("href")
      || imageEl.getAttributeNS("http://www.w3.org/1999/xlink", "href")
      || ""
    ).trim();
  }

  function openTarotLightboxForPath(path, fallbackSrc = "") {
    const openLightbox = window.TarotUiLightbox?.open;
    if (typeof openLightbox !== "function") {
      return false;
    }

    const cardName = String(path?.tarot?.card || "").trim();
    const src = String(fallbackSrc || resolvePathTarotImage(path) || "").trim();
    if (!src) {
      return false;
    }

    const fallbackLabel = Number.isFinite(Number(path?.pathNumber))
      ? `Path ${path.pathNumber} tarot card`
      : "Path tarot card";
    openLightbox(src, cardName || fallbackLabel);
    return true;
  }

  function getPathLabel(context, path) {
    const glyph = String(path?.hebrewLetter?.char || "").trim();
    const pathNumber = Number(path?.pathNumber);
    const parts = [];

    if (context.state.showPathLetters && glyph) {
      parts.push(glyph);
    }

    if (context.state.showPathAstrology) {
      const astrologySymbol = context.getPathAstrologySymbol?.(path) || "";
      if (astrologySymbol) {
        parts.push(astrologySymbol);
      }
    }

    if (context.state.showPathNumbers && Number.isFinite(pathNumber)) {
      parts.push(String(pathNumber));
    }

    return parts.join(" ");
  }

  function svgEl(context, tag, attrs, text) {
    const el = document.createElementNS(context.NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      el.setAttribute(key, String(value));
    }
    if (text != null) {
      el.textContent = text;
    }
    return el;
  }

  const treeOrbit = { dragging: false, lastX: 0, lastY: 0, raf: 0, moved: false };
  const treePointers = new Map();
  const treePinch = { distance: 0 };

  const TREE_ZOOM_MIN = 0.35;
  const TREE_ZOOM_MAX = 2.4;
  let lastZoomReadout = "";

  function normalizeTreeZoom(value) {
    const zoom = Number(value);
    if (!Number.isFinite(zoom) || zoom <= 0) {
      return 1;
    }
    return Math.min(TREE_ZOOM_MAX, Math.max(TREE_ZOOM_MIN, zoom));
  }

  function syncTreeZoomReadout(state) {
    const label = `${Math.round(normalizeTreeZoom(state?.treeZoom) * 100)}%`;
    if (label === lastZoomReadout) {
      return;
    }

    lastZoomReadout = label;
    const readout = document.getElementById("kab-tree-zoom-readout");
    if (readout) {
      readout.textContent = label;
    }
  }

  // Zoom lives in the SVG viewBox rather than in a CSS scale, so every step
  // re-renders vectors instead of magnifying a rasterised layer.
  let treeZoomFrame = 0;
  const TREE_VIEWBOX_WIDTH = 240;
  const TREE_VIEWBOX_HEIGHT = 470;

  function scheduleTreeRender(context) {
    if (treeZoomFrame) {
      return;
    }
    treeZoomFrame = window.requestAnimationFrame(() => {
      treeZoomFrame = 0;
      renderTree(context);
    });
  }

  function setTreeZoom(context, nextZoom, options = {}) {
    const state = context?.state;
    if (!state) {
      return;
    }

    const zoom = normalizeTreeZoom(nextZoom);
    if (zoom === normalizeTreeZoom(state.treeZoom)) {
      return;
    }
    state.treeZoom = zoom;

    if (options.immediate) {
      renderTree(context);
    } else {
      scheduleTreeRender(context);
    }
  }

  function zoomTreeBy(context, factor) {
    setTreeZoom(context, normalizeTreeZoom(context?.state?.treeZoom) * factor);
  }

  // Fits the diagram against the viewport it is currently sitting in, which is
  // half the screen in the Tree + Cube pairing.
  function fitTreeZoom(context) {
    const container = document.getElementById("kab-tree-container");
    const viewport = container?.closest(".kab-tree-viewport") || container;
    const svg = container?.querySelector("svg.kab-svg");
    const boxWidth = Number(svg?.clientWidth) || 0;
    const boxHeight = Number(svg?.clientHeight) || 0;
    const available = Number(viewport?.clientHeight) || 0;
    // Height of the diagram at 100% once preserveAspectRatio has fitted it.
    const contentHeight = Math.min(boxWidth * (TREE_VIEWBOX_HEIGHT / TREE_VIEWBOX_WIDTH), boxHeight);
    if (!(contentHeight > 0) || !(available > 0)) {
      setTreeZoom(context, 1, { immediate: true });
      return;
    }

    setTreeZoom(context, (available - 12) / contentHeight, { immediate: true });
  }

  function treeSignature(context) {
    return [
      Boolean(context.state.showSephirot),
      Boolean(context.state.showPaths),
      Boolean(context.state.showPathLetters),
      Boolean(context.state.showPathNumbers),
      Boolean(context.state.showPathAstrology),
      Boolean(context.state.showPathTarotCards),
      normalizeTreeZoom(context.state.treeZoom),
      context.tree?.paths?.length || 0
    ].join(":");
  }

  function applyTreeTransform(state) {
    const world = document.getElementById("kab-tree-world");
    if (!world) {
      return;
    }
    const rotX = Number.isFinite(Number(state?.treeRotX)) ? Number(state.treeRotX) : 12;
    const rotY = Number.isFinite(Number(state?.treeRotY)) ? Number(state.treeRotY) : -18;
    world.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    syncTreeZoomReadout(state);
  }

  function buildTreeSVG(context) {
    const {
      tree,
      state,
      NODE_POS,
      SEPH_FILL,
      DARK_TEXT,
      DAAT,
      PATH_LABEL_FONT_SIZE,
      PATH_TAROT_WIDTH,
      PATH_TAROT_HEIGHT,
      PATH_LABEL_OFFSET_WITH_TAROT,
      PATH_TAROT_OFFSET_WITH_LABEL,
      PATH_TAROT_OFFSET_NO_LABEL,
      R
    } = context;
    // Zoom is a viewBox change, so the browser re-renders the vectors at the new
    // scale instead of upscaling a cached bitmap.
    const zoom = normalizeTreeZoom(state?.treeZoom);
    const viewWidth = TREE_VIEWBOX_WIDTH / zoom;
    const viewHeight = TREE_VIEWBOX_HEIGHT / zoom;
    const svg = svgEl(context, "svg", {
      viewBox: [
        (TREE_VIEWBOX_WIDTH / 2 - viewWidth / 2).toFixed(2),
        (TREE_VIEWBOX_HEIGHT / 2 - viewHeight / 2).toFixed(2),
        viewWidth.toFixed(2),
        viewHeight.toFixed(2)
      ].join(" "),
      width: "100%",
      role: "img",
      "aria-label": "Kabbalah Tree of Life diagram",
      class: "kab-svg"
    });

    svg.appendChild(svgEl(context, "rect", {
      x: 113, y: 30, width: 14, height: 420,
      rx: 7, fill: "#ffffff07", "pointer-events": "none"
    }));
    svg.appendChild(svgEl(context, "rect", {
      x: 33, y: 88, width: 14, height: 255,
      rx: 7, fill: "#ff220010", "pointer-events": "none"
    }));
    svg.appendChild(svgEl(context, "rect", {
      x: 193, y: 88, width: 14, height: 255,
      rx: 7, fill: "#2244ff10", "pointer-events": "none"
    }));

    tree.paths.forEach((path) => {
      // Hiding the paths hides everything attached to them: the line, the hit
      // area, the letter/number label, and the tarot card.
      if (state.showPaths === false) {
        return;
      }

      const [x1, y1] = NODE_POS[path.connects.from];
      const [x2, y2] = NODE_POS[path.connects.to];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const tarotImage = state.showPathTarotCards ? resolvePathTarotImage(path) : null;
      const hasTarotImage = Boolean(tarotImage);
      const pathLabel = getPathLabel(context, path);
      const hasLabel = Boolean(pathLabel);
      const labelY = hasTarotImage && hasLabel ? my - PATH_LABEL_OFFSET_WITH_TAROT : my;

      svg.appendChild(svgEl(context, "line", {
        x1, y1, x2, y2,
        class: "kab-path-line",
        "data-path": path.pathNumber,
        stroke: "#8a8ab8",
        "stroke-width": "1.5",
        "pointer-events": "none"
      }));
      svg.appendChild(svgEl(context, "line", {
        x1, y1, x2, y2,
        class: "kab-path-hit",
        "data-path": path.pathNumber,
        stroke: "transparent",
        "stroke-width": String(12 * context.PATH_MARKER_SCALE),
        role: "button",
        tabindex: "0",
        "aria-label": `Path ${path.pathNumber}: ${path.hebrewLetter?.transliteration || ""} — ${path.tarot?.card || ""}`,
        style: "cursor:pointer"
      }));
      // Labels are plain coloured text, like the cube's edge markers, with the
      // colour doing the work instead of a backing disc.
      if (hasLabel) {
        svg.appendChild(svgEl(context, "text", {
          x: mx, y: labelY + 1,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          class: "kab-path-lbl",
          "data-path": path.pathNumber,
          "font-size": PATH_LABEL_FONT_SIZE.toFixed(2),
          "pointer-events": "none"
        }, pathLabel));
      }
      if (hasTarotImage) {
        const tarotY = hasLabel
          ? my + PATH_TAROT_OFFSET_WITH_LABEL
          : my - PATH_TAROT_OFFSET_NO_LABEL;
        svg.appendChild(svgEl(context, "image", {
          href: tarotImage,
          x: (mx - (PATH_TAROT_WIDTH / 2)).toFixed(2),
          y: tarotY.toFixed(2),
          width: PATH_TAROT_WIDTH.toFixed(2),
          height: PATH_TAROT_HEIGHT.toFixed(2),
          preserveAspectRatio: "xMidYMid meet",
          class: "kab-path-tarot",
          "data-path": path.pathNumber,
          role: "button",
          tabindex: "0",
          "aria-label": `Path ${path.pathNumber} Tarot card ${path.tarot?.card || ""}`,
          style: "cursor:pointer"
        }));
      }
    });

    // Da'at and the ten sephirot share the node layer, so hiding the sephirot
    // hides the node circles, their numbers, and their name labels with them.
    if (state.showSephirot !== false) {
      svg.appendChild(svgEl(context, "circle", {
        cx: DAAT[0], cy: DAAT[1], r: "9",
        fill: "none", stroke: "#8b7ec8",
        "stroke-dasharray": "3 2", "stroke-width": "1",
        "pointer-events": "none"
      }));
      svg.appendChild(svgEl(context, "text", {
        x: DAAT[0] + 13, y: DAAT[1] + 1,
        "text-anchor": "start", "dominant-baseline": "middle",
        fill: "#9b8fd4", "font-size": "6.5", "pointer-events": "none"
      }, "Da'at"));
    }

    tree.sephiroth.forEach((seph) => {
      if (state.showSephirot === false) {
        return;
      }

      const [cx, cy] = NODE_POS[seph.number];
      const fill = SEPH_FILL[seph.number] || "#555";
      const isLeft = cx < 80;
      const isMid = cx === 120;
      svg.appendChild(svgEl(context, "circle", {
        cx, cy, r: "16",
        fill, opacity: "0.12",
        class: "kab-node-glow",
        "data-sephira": seph.number,
        "pointer-events": "none"
      }));
      svg.appendChild(svgEl(context, "circle", {
        cx, cy, r: R,
        fill, stroke: "#00000040", "stroke-width": "1",
        class: "kab-node",
        "data-sephira": seph.number,
        role: "button",
        tabindex: "0",
        "aria-label": `Sephira ${seph.number}: ${seph.name}`,
        style: "cursor:pointer"
      }));
      svg.appendChild(svgEl(context, "text", {
        x: cx, y: cy + 0.5,
        "text-anchor": "middle", "dominant-baseline": "middle",
        fill: DARK_TEXT.has(seph.number) ? "#111" : "#fff",
        "font-size": "8", "font-weight": "bold",
        "pointer-events": "none"
      }, String(seph.number)));
      const lx = isLeft ? cx - R - 4 : cx + R + 4;
      svg.appendChild(svgEl(context, "text", {
        x: isMid ? cx : lx,
        y: isMid ? cy + R + 8 : cy,
        "text-anchor": isMid ? "middle" : (isLeft ? "end" : "start"),
        "dominant-baseline": isMid ? "auto" : "middle",
        fill: "#efe9ff",
        "font-size": "7.5", "pointer-events": "none",
        class: "kab-node-lbl"
      }, seph.name));
    });

    return svg;
  }

  function bindTreeOrbit(context) {
    const viewport = context.elements?.treeContainerEl?.closest(".kab-tree-viewport")
      || context.elements?.treeContainerEl;
    if (!viewport || viewport.dataset.orbitBound === "true") {
      return;
    }
    viewport.dataset.orbitBound = "true";

    const pointerDistance = () => {
      const points = [...treePointers.values()];
      if (points.length < 2) {
        return 0;
      }
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    };

    const onMove = (event) => {
      if (treePointers.has(event.pointerId)) {
        treePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      // Two pointers pinch to zoom instead of orbiting.
      const distance = pointerDistance();
      if (distance > 0) {
        if (treePinch.distance > 0) {
          zoomTreeBy(context, distance / treePinch.distance);
        }
        treePinch.distance = distance;
        treeOrbit.moved = true;
        return;
      }

      if (!treeOrbit.dragging) {
        return;
      }
      const dx = event.clientX - treeOrbit.lastX;
      const dy = event.clientY - treeOrbit.lastY;
      treeOrbit.lastX = event.clientX;
      treeOrbit.lastY = event.clientY;
      context.state.treeRotY = Number(context.state.treeRotY || -18) + dx * 0.45;
      context.state.treeRotX = Math.max(-48, Math.min(48, Number(context.state.treeRotX || 12) - dy * 0.35));
      treeOrbit.moved = true;
      applyTreeTransform(context.state);
    };

    const onUp = (event) => {
      treePointers.delete(event.pointerId);
      treePinch.distance = pointerDistance();

      if (!treeOrbit.dragging) {
        return;
      }
      treeOrbit.dragging = false;
      viewport.classList.remove("is-dragging");
      try {
        viewport.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // ignore
      }
    };

    viewport.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) {
        return;
      }
      treePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      treeOrbit.dragging = true;
      treeOrbit.moved = false;
      treeOrbit.lastX = event.clientX;
      treeOrbit.lastY = event.clientY;
      viewport.classList.add("is-dragging");
      viewport.setPointerCapture(event.pointerId);
    });

    viewport.addEventListener("wheel", (event) => {
      event.preventDefault();
      const delta = event.deltaMode === 1 ? Number(event.deltaY || 0) * 16 : Number(event.deltaY || 0);
      zoomTreeBy(context, Math.exp(-delta * 0.0016));
    }, { passive: false });

    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);
  }

  // Zoom / fit / reset live in the toolbar's View menu.
  function bindTreeViewControls(context) {
    const controls = [
      ["kab-tree-zoom-out", () => zoomTreeBy(context, 0.85)],
      ["kab-tree-zoom-in", () => zoomTreeBy(context, 1.18)],
      ["kab-tree-fit", () => fitTreeZoom(context)],
      ["kab-tree-view-reset", () => {
        context.state.treeRotX = 12;
        context.state.treeRotY = -18;
        setTreeZoom(context, 1, { immediate: true });
      }]
    ];

    controls.forEach(([id, handler]) => {
      const button = document.getElementById(id);
      if (!(button instanceof HTMLButtonElement) || button.dataset.bound === "true") {
        return;
      }
      button.dataset.bound = "true";
      button.addEventListener("click", handler);
    });
  }

  function ensureTreeSpin(context) {
    if (treeOrbit.raf) {
      return;
    }
    const step = () => {
      treeOrbit.raf = 0;
      const section = document.getElementById("kabbalah-tree-section");
      if (!section || section.hidden || context.state.treeSpin === false || document.hidden) {
        return;
      }
      if (!treeOrbit.dragging) {
        context.state.treeRotY = (Number(context.state.treeRotY || -18) + 0.28) % 360;
        applyTreeTransform(context.state);
      }
      treeOrbit.raf = requestAnimationFrame(step);
    };
    if (context.state.treeSpin === false) {
      return;
    }
    treeOrbit.raf = requestAnimationFrame(step);
  }

  function bindTreeInteractions(context, root) {
    if (!root || root.dataset.treeClicksBound === "true") {
      return;
    }
    root.dataset.treeClicksBound = "true";
    const { tree, openSephiraFromTree, openPathFromTree } = context;
    root.addEventListener("click", (event) => {
      if (treeOrbit.moved) {
        return;
      }
      const clickTarget = event.target instanceof Element ? event.target : null;
      const sephNum = clickTarget?.dataset?.sephira;
      const pathNum = clickTarget?.dataset?.path;

      if (pathNum != null && clickTarget?.classList?.contains("kab-path-tarot")) {
        const path = tree.paths.find((entry) => entry.pathNumber === Number(pathNum));
        if (path) {
          openTarotLightboxForPath(path, getSvgImageHref(clickTarget));
        }
        return;
      }

      if (sephNum != null) {
        const seph = tree.sephiroth.find((entry) => entry.number === Number(sephNum));
        if (seph) {
          openSephiraFromTree?.(seph);
        }
      } else if (pathNum != null) {
        const path = tree.paths.find((entry) => entry.pathNumber === Number(pathNum));
        if (path) {
          openPathFromTree?.(path);
        }
      }
    });
  }

  function bindRoseCrossInteractions(context, svg, roseElements) {
    const { tree, renderPathDetail } = context;
    if (!svg || !roseElements?.detailBodyEl) {
      return;
    }

    const openPathFromTarget = (targetEl) => {
      if (!(targetEl instanceof Element)) {
        return;
      }

      const petal = targetEl.closest(".kab-rose-petal[data-path]");
      if (!(petal instanceof SVGElement)) {
        return;
      }

      const pathNumber = Number(petal.dataset.path);
      if (!Number.isFinite(pathNumber)) {
        return;
      }

      const path = tree.paths.find((entry) => entry.pathNumber === pathNumber);
      if (path) {
        renderPathDetail(path, tree, roseElements);
      }
    };

    svg.addEventListener("click", (event) => {
      openPathFromTarget(event.target);
    });

    svg.querySelectorAll(".kab-rose-petal[data-path]").forEach((petal) => {
      petal.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPathFromTarget(petal);
        }
      });
    });
  }

  function renderRoseCross(context) {
    const { state, elements, getRoseDetailElements } = context;
    if (!state.tree || !elements?.roseCrossContainerEl) {
      return;
    }

    const roseElements = getRoseDetailElements(elements);
    if (!roseElements?.detailBodyEl) {
      return;
    }

    const roseBuilder = window.KabbalahRosicrucianCross?.buildRosicrucianCrossSVG;
    if (typeof roseBuilder !== "function") {
      return;
    }

    const roseSvg = roseBuilder(state.tree);
    elements.roseCrossContainerEl.innerHTML = "";
    elements.roseCrossContainerEl.appendChild(roseSvg);
    bindRoseCrossInteractions(context, roseSvg, roseElements);
  }

  function renderTree(context) {
    const { state, elements } = context;
    if (!state.tree || !elements?.treeContainerEl) {
      return;
    }

    const signature = treeSignature(context);
    if (!elements.treeContainerEl.querySelector(".kab-svg") || elements.treeContainerEl.dataset.treeSig !== signature) {
      const svg = buildTreeSVG(context);
      elements.treeContainerEl.innerHTML = "";
      elements.treeContainerEl.appendChild(svg);
      elements.treeContainerEl.dataset.treeSig = signature;
    }
    applyTreeTransform(state);
    bindTreeInteractions(context, elements.treeContainerEl);
    bindTreeOrbit(context);
    bindTreeViewControls(context);
    ensureTreeSpin(context);
  }

  window.KabbalahViewsUi = {
    renderTree,
    renderRoseCross
  };
})();