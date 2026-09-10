(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PRIMARY_ORDER = ["akasha", "vayu", "tejas", "apas", "prithivi"];
  const PRIMARY_DEFS = [
    { id: "akasha", sanskrit: "Ākāśa", name: { en: "Akasha" }, elementId: "spirit", elementName: "Spirit", kind: "primary", shape: "egg", color: "#1a1035", colorName: "indigo-black", tanmatra: "sound", quality: "space", parentId: "", childId: "", summary: "Golden Dawn tattva of Spirit: a black or indigo egg." },
    { id: "vayu", sanskrit: "Vāyu", name: { en: "Vayu" }, elementId: "air", elementName: "Air", kind: "primary", shape: "circle", color: "#2563eb", colorName: "blue", tanmatra: "touch", quality: "motion", parentId: "", childId: "", summary: "Golden Dawn tattva of Air: a blue circle." },
    { id: "tejas", sanskrit: "Tejas", name: { en: "Tejas" }, elementId: "fire", elementName: "Fire", kind: "primary", shape: "triangle", color: "#c41e3a", colorName: "red", tanmatra: "form", quality: "heat", parentId: "", childId: "", summary: "Golden Dawn tattva of Fire: a red equilateral triangle." },
    { id: "apas", sanskrit: "Āpas", name: { en: "Apas" }, elementId: "water", elementName: "Water", kind: "primary", shape: "crescent", color: "#d4d4d8", colorName: "silver", tanmatra: "taste", quality: "fluidity", parentId: "", childId: "", summary: "Golden Dawn tattva of Water: a silver crescent." },
    { id: "prithivi", sanskrit: "Pṛthivī", name: { en: "Prithivi" }, elementId: "earth", elementName: "Earth", kind: "primary", shape: "square", color: "#eab308", colorName: "yellow", tanmatra: "smell", quality: "solidity", parentId: "", childId: "", summary: "Golden Dawn tattva of Earth: a yellow square." }
  ];

  const STROKE_BY_ID = {
    akasha: "#c4b5fd",
    vayu: "#1e3a8a",
    tejas: "#7f1d1d",
    apas: "#52525b",
    prithivi: "#854d0e"
  };

  const state = {
    initialized: false,
    entries: [],
    primaries: {},
    filteredEntries: [],
    selectedId: "",
    searchQuery: ""
  };

  function getElements() {
    return {
      listEl: document.getElementById("tattvas-list"),
      countEl: document.getElementById("tattvas-count"),
      searchEl: document.getElementById("tattvas-search-input"),
      searchClearEl: document.getElementById("tattvas-search-clear"),
      detailNameEl: document.getElementById("tattvas-detail-name"),
      detailSubEl: document.getElementById("tattvas-detail-sub"),
      detailBodyEl: document.getElementById("tattvas-detail-body")
    };
  }

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function localizedName(record) {
    if (!record) {
      return "";
    }
    if (typeof record.name === "string") {
      return record.name;
    }
    return record.name?.en || record.id || "";
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      node.setAttribute(key, String(value));
    });
    return node;
  }

  const NEST = {
    circle: { x: 0, y: 0, scale: 0.48 },
    square: { x: 0, y: 0, scale: 0.48 },
    egg: { x: 0, y: 3, scale: 0.4 },
    triangle: { x: 0, y: 8, scale: 0.36 },
    crescent: { x: 0, y: -12, scale: 0.52 }
  };

  function appendShape(group, shape, fill, stroke, scale) {
    const s = Number(scale) || 1;
    const sw = String(2.2 / Math.max(s, 0.45));
    if (shape === "egg") {
      group.appendChild(svgEl("ellipse", {
        cx: "0",
        cy: "0",
        rx: String(32 * s),
        ry: String(46 * s),
        fill,
        stroke,
        "stroke-width": sw
      }));
      return;
    }
    if (shape === "circle") {
      group.appendChild(svgEl("circle", {
        cx: "0",
        cy: "0",
        r: String(42 * s),
        fill,
        stroke,
        "stroke-width": sw
      }));
      return;
    }
    if (shape === "triangle") {
      const h = 48 * s;
      const w = 54 * s;
      group.appendChild(svgEl("polygon", {
        points: `0,${-h} ${w},${h * 0.72} ${-w},${h * 0.72}`,
        fill,
        stroke,
        "stroke-width": sw,
        "stroke-linejoin": "round"
      }));
      return;
    }
    if (shape === "crescent") {
      const cup = svgEl("g", {
        fill,
        stroke,
        "stroke-width": sw,
        "fill-rule": "evenodd"
      });
      cup.appendChild(svgEl("circle", { cx: "0", cy: String(6 * s), r: String(44 * s) }));
      cup.appendChild(svgEl("circle", { cx: "0", cy: String(-12 * s), r: String(30 * s) }));
      group.appendChild(cup);
      return;
    }
    const size = 80 * s;
    group.appendChild(svgEl("rect", {
      x: String(-size / 2),
      y: String(-size / 2),
      width: String(size),
      height: String(size),
      fill,
      stroke,
      "stroke-width": sw
    }));
  }

  function createTattvaSvg(entry, size) {
    const svg = svgEl("svg", {
      viewBox: "0 0 120 120",
      width: String(size || 120),
      height: String(size || 120),
      class: "tattva-glyph",
      "aria-hidden": "true"
    });
    svg.appendChild(svgEl("rect", {
      x: "0",
      y: "0",
      width: "120",
      height: "120",
      fill: "#111113",
      rx: "10"
    }));

    const parent = entry.kind === "compound"
      ? state.primaries[entry.parentId]
      : entry;
    const child = entry.kind === "compound"
      ? state.primaries[entry.childId]
      : null;
    if (!parent) {
      return svg;
    }

    const parentGroup = svgEl("g", { transform: "translate(60 60)" });
    appendShape(
      parentGroup,
      parent.shape,
      parent.color,
      STROKE_BY_ID[parent.id] || "#e4e4e7",
      1
    );
    svg.appendChild(parentGroup);

    if (child) {
      const nest = NEST[parent.shape] || NEST.circle;
      const childGroup = svgEl("g", {
        transform: `translate(${60 + nest.x} ${60 + nest.y})`
      });
      appendShape(
        childGroup,
        child.shape,
        child.color,
        STROKE_BY_ID[child.id] || "#e4e4e7",
        nest.scale
      );
      svg.appendChild(childGroup);
    }

    return svg;
  }

  function svgToDataUrl(svg) {
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);
    const xml = new XMLSerializer().serializeToString(clone);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  }

  function openTattvaLightbox(entry, originEl) {
    const openLightbox = window.TarotUiLightbox?.open;
    if (typeof openLightbox !== "function" || !entry) {
      return;
    }
    const preview = createTattvaSvg(entry, 640);
    const src = svgToDataUrl(preview);
    const originRect = originEl instanceof Element ? originEl.getBoundingClientRect() : null;
    openLightbox({
      src,
      altText: entry.name,
      label: entry.name,
      originRect,
      allowOverlayCompare: false,
      allowDeckCompare: false
    });
  }

  function bindGlyphOpen(glyph, entry) {
    if (!(glyph instanceof Element) || !entry) {
      return glyph;
    }
    glyph.classList.add("is-clickable");
    glyph.setAttribute("role", "button");
    glyph.setAttribute("tabindex", "0");
    glyph.setAttribute("aria-label", `Open ${entry.name} tattva`);
    const open = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTattvaLightbox(entry, glyph);
    };
    glyph.addEventListener("click", open);
    glyph.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        open(event);
      }
    });
    return glyph;
  }

  function buildFallbackRecords() {
    const records = PRIMARY_DEFS.map((record) => ({ ...record }));
    PRIMARY_ORDER.forEach((parentId) => {
      PRIMARY_ORDER.forEach((childId) => {
        if (parentId === childId) {
          return;
        }
        const parent = PRIMARY_DEFS.find((item) => item.id === parentId);
        const child = PRIMARY_DEFS.find((item) => item.id === childId);
        records.push({
          id: `${childId}-of-${parentId}`,
          sanskrit: `${child.sanskrit} of ${parent.sanskrit}`,
          name: { en: `${child.name.en} of ${parent.name.en}` },
          elementId: parent.elementId,
          elementName: `${child.elementName} of ${parent.elementName}`,
          kind: "compound",
          shape: child.shape,
          color: child.color,
          colorName: `${child.colorName} on ${parent.colorName}`,
          tanmatra: child.tanmatra,
          quality: `${child.quality} in ${parent.quality}`,
          parentId,
          childId,
          summary: `Compound Golden Dawn card: small ${child.colorName} ${child.shape} of ${child.name.en} on the ${parent.colorName} ${parent.shape} of ${parent.name.en}.`
        });
      });
    });
    return records;
  }

  function loadRecords(magickDataset) {
    const source = magickDataset?.grouped?.alchemy?.tattvas;
    if (source && typeof source === "object") {
      const records = Object.values(source).filter((record) => record && record.id);
      if (records.length) {
        return records;
      }
    }
    return buildFallbackRecords();
  }

  function toEntry(record) {
    const name = localizedName(record);
    return {
      id: String(record.id),
      name,
      sanskrit: record.sanskrit || "",
      elementId: record.elementId || "",
      elementName: record.elementName || "",
      kind: record.kind === "compound" ? "compound" : "primary",
      shape: record.shape || "square",
      color: record.color || "#71717a",
      colorName: record.colorName || "",
      tanmatra: record.tanmatra || "",
      quality: record.quality || "",
      parentId: record.parentId || "",
      childId: record.childId || "",
      summary: record.summary || "",
      searchText: normalize([
        record.id,
        name,
        record.sanskrit,
        record.elementId,
        record.elementName,
        record.kind,
        record.shape,
        record.colorName,
        record.tanmatra,
        record.quality,
        record.summary
      ].join(" "))
    };
  }

  function sortEntries(entries) {
    const rank = new Map(PRIMARY_ORDER.map((id, index) => [id, index]));
    return entries.slice().sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "primary" ? -1 : 1;
      }
      const leftParent = left.kind === "primary" ? left.id : left.parentId;
      const rightParent = right.kind === "primary" ? right.id : right.parentId;
      const parentDelta = (rank.get(leftParent) ?? 99) - (rank.get(rightParent) ?? 99);
      if (parentDelta !== 0) {
        return parentDelta;
      }
      if (left.kind === "primary") {
        return 0;
      }
      return (rank.get(left.childId) ?? 99) - (rank.get(right.childId) ?? 99);
    });
  }

  function applySearch() {
    const query = normalize(state.searchQuery);
    state.filteredEntries = query
      ? state.entries.filter((entry) => entry.searchText.includes(query))
      : state.entries.slice();
    if (state.selectedId && !state.filteredEntries.some((entry) => entry.id === state.selectedId)) {
      state.selectedId = state.filteredEntries[0]?.id || "";
    }
  }

  function findEntryById(id) {
    const normalizedId = normalize(id);
    return state.entries.find((entry) => entry.id === normalizedId) || null;
  }

  function createInlineButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-nav-btn";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function renderList(elements) {
    if (!elements?.listEl) {
      return;
    }
    elements.listEl.replaceChildren();
    state.filteredEntries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item tattva-list-item";
      button.dataset.tattvaId = entry.id;
      button.setAttribute("role", "option");
      const isSelected = entry.id === state.selectedId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");

      const glyph = bindGlyphOpen(createTattvaSvg(entry, 36), entry);
      const name = document.createElement("span");
      name.className = "list-name";
      name.textContent = entry.name;
      const meta = document.createElement("span");
      meta.className = "list-meta";
      meta.textContent = entry.kind === "primary"
        ? `${entry.colorName} ${entry.shape} · ${entry.elementName}`
        : `${entry.elementName} · compound`;
      const copy = document.createElement("span");
      copy.className = "tattva-list-copy";
      copy.append(name, meta);
      button.append(glyph, copy);
      elements.listEl.appendChild(button);
    });

    if (elements.countEl) {
      elements.countEl.textContent = `${state.filteredEntries.length} tattvas`;
    }
    if (!state.filteredEntries.length) {
      const empty = document.createElement("div");
      empty.className = "body-text";
      empty.style.padding = "16px";
      empty.style.color = "#71717a";
      empty.textContent = "No tattvas match your search.";
      elements.listEl.appendChild(empty);
    }
  }

  function appendDetailRow(list, label, value) {
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    if (value instanceof Node) {
      detail.appendChild(value);
    } else {
      detail.textContent = String(value || "--");
    }
    list.append(term, detail);
  }

  function renderDetail(elements) {
    if (!elements?.detailNameEl || !elements.detailSubEl || !elements.detailBodyEl) {
      return;
    }
    const entry = findEntryById(state.selectedId);
    elements.detailBodyEl.replaceChildren();
    if (!entry) {
      elements.detailNameEl.textContent = "--";
      elements.detailSubEl.textContent = "Select a tattva to explore";
      return;
    }

    elements.detailNameEl.textContent = entry.name;
    elements.detailSubEl.textContent = entry.kind === "primary"
      ? `Golden Dawn · ${entry.elementName}`
      : `Golden Dawn compound · ${entry.elementName}`;

    const grid = document.createElement("div");
    grid.className = "meta-grid";

    const card = document.createElement("div");
    card.className = "meta-card tattva-card";
    const title = document.createElement("strong");
    title.textContent = "Tattva Card";
    const figure = document.createElement("div");
    figure.className = "tattva-card-figure";
    figure.appendChild(bindGlyphOpen(createTattvaSvg(entry, 220), entry));
    card.append(title, figure);

    const detailsCard = document.createElement("div");
    detailsCard.className = "meta-card";
    const detailsTitle = document.createElement("strong");
    detailsTitle.textContent = "Correspondences";
    const detailsList = document.createElement("dl");
    detailsList.className = "alpha-dl";
    appendDetailRow(detailsList, "Sanskrit", entry.sanskrit || "--");
    appendDetailRow(
      detailsList,
      "Western element",
      entry.elementId
        ? createInlineButton(entry.elementName || entry.elementId, () => {
          document.dispatchEvent(new CustomEvent("nav:elements", {
            detail: { elementId: entry.elementId }
          }));
        })
        : (entry.elementName || "--")
    );
    appendDetailRow(detailsList, "Shape", entry.shape);
    appendDetailRow(detailsList, "Color", entry.colorName || entry.color);
    appendDetailRow(detailsList, "Tanmatra", entry.tanmatra || "--");
    appendDetailRow(detailsList, "Quality", entry.quality || "--");
    if (entry.kind === "compound") {
      const parent = state.primaries[entry.parentId];
      const child = state.primaries[entry.childId];
      if (parent) {
        appendDetailRow(detailsList, "Field (large)", createInlineButton(parent.name, () => {
          selectByTattvaId(parent.id);
        }));
      }
      if (child) {
        appendDetailRow(detailsList, "Seed (small)", createInlineButton(child.name, () => {
          selectByTattvaId(child.id);
        }));
      }
    }
    detailsCard.append(detailsTitle, detailsList);

    const noteCard = document.createElement("div");
    noteCard.className = "meta-card";
    const noteTitle = document.createElement("strong");
    noteTitle.textContent = "Tattva vision";
    const note = document.createElement("p");
    note.className = "body-text";
    note.textContent = entry.summary || "";
    noteCard.append(noteTitle, note);

    grid.append(card, detailsCard, noteCard);
    elements.detailBodyEl.appendChild(grid);
  }

  function render() {
    const elements = getElements();
    renderList(elements);
    renderDetail(elements);
  }

  function selectByTattvaId(id) {
    const entry = findEntryById(id);
    if (!entry) {
      return;
    }
    state.selectedId = entry.id;
    render();
  }

  function bindOnce() {
    if (state.initialized) {
      return;
    }
    const elements = getElements();
    if (elements.listEl) {
      elements.listEl.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        const button = target.closest("[data-tattva-id]");
        if (!(button instanceof HTMLElement)) {
          return;
        }
        selectByTattvaId(button.dataset.tattvaId);
      });
    }
    if (elements.searchEl) {
      elements.searchEl.addEventListener("input", () => {
        state.searchQuery = elements.searchEl.value || "";
        if (elements.searchClearEl) {
          elements.searchClearEl.disabled = !state.searchQuery;
        }
        applySearch();
        render();
      });
    }
    if (elements.searchClearEl) {
      elements.searchClearEl.addEventListener("click", () => {
        state.searchQuery = "";
        if (elements.searchEl) {
          elements.searchEl.value = "";
        }
        elements.searchClearEl.disabled = true;
        applySearch();
        render();
      });
    }
    state.initialized = true;
  }

  function ensureTattvasSection(magickDataset) {
    bindOnce();
    const records = loadRecords(magickDataset);
    state.entries = sortEntries(records.map(toEntry));
    state.primaries = {};
    state.entries.forEach((entry) => {
      if (entry.kind === "primary") {
        state.primaries[entry.id] = entry;
      }
    });
    if (!state.selectedId) {
      state.selectedId = state.entries[0]?.id || "";
    }
    applySearch();
    render();
  }

  window.TattvasSectionUi = {
    ensureTattvasSection,
    selectByTattvaId
  };
})();
