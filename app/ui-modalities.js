(function () {
  "use strict";

  const { html } = window.HtmlSafe;

  const ELEMENT_STYLE = {
    fire: { emoji: "🔥", badge: "zod-badge--fire", label: "Fire" },
    earth: { emoji: "🌍", badge: "zod-badge--earth", label: "Earth" },
    air: { emoji: "💨", badge: "zod-badge--air", label: "Air" },
    water: { emoji: "💧", badge: "zod-badge--water", label: "Water" }
  };

  const MODALITY_DEFS = [
    {
      id: "cardinal",
      name: "Cardinal",
      aliases: ["cardinal"],
      quality: "Initiating",
      description: "Starts the seasons. Cardinal signs initiate action, set direction, and open cycles.",
      tarotRange: "2–4",
      tarotNumbers: [2, 3, 4]
    },
    {
      id: "fixed",
      name: "Fixed",
      aliases: ["fixed", "kerubic"],
      quality: "Sustaining",
      description: "Holds the middle of each season. Fixed (Kerubic) signs stabilize, concentrate, and preserve.",
      tarotRange: "5–7",
      tarotNumbers: [5, 6, 7]
    },
    {
      id: "mutable",
      name: "Mutable",
      aliases: ["mutable"],
      quality: "Adapting",
      description: "Closes each season. Mutable signs flex, distribute, and prepare transition.",
      tarotRange: "8–10",
      tarotNumbers: [8, 9, 10]
    }
  ];

  const SUIT_BY_ELEMENT_ID = {
    fire: "Wands",
    water: "Cups",
    air: "Swords",
    earth: "Disks"
  };

  const state = {
    initialized: false,
    entries: [],
    filteredEntries: [],
    selectedId: "",
    searchQuery: ""
  };

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function getElements() {
    return {
      sectionEl: document.getElementById("modalities-section"),
      listEl: document.getElementById("modalities-list"),
      countEl: document.getElementById("modalities-count"),
      searchEl: document.getElementById("modalities-search-input"),
      searchClearEl: document.getElementById("modalities-search-clear"),
      detailNameEl: document.getElementById("modalities-detail-name"),
      detailSubEl: document.getElementById("modalities-detail-sub"),
      detailBodyEl: document.getElementById("modalities-detail-body")
    };
  }

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function titleCase(value) {
    return String(value || "")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  function normalizeModalityId(value) {
    const token = normalize(value).replace(/[^a-z]/g, "");
    if (!token) {
      return "";
    }
    if (token === "kerubic" || token === "fixed") {
      return "fixed";
    }
    if (token === "cardinal") {
      return "cardinal";
    }
    if (token === "mutable") {
      return "mutable";
    }
    return token;
  }

  function createInlineButton(label, onActivate) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-inline-link";
    button.textContent = String(label || "—");
    button.addEventListener("click", () => {
      onActivate?.();
    });
    return button;
  }

  function createInlineParagraph(parts) {
    const line = document.createElement("p");
    line.className = "body-text detail-inline-value";
    (Array.isArray(parts) ? parts : []).forEach((part) => {
      if (part instanceof Node) {
        line.appendChild(part);
        return;
      }
      const text = String(part ?? "");
      if (text) {
        line.appendChild(document.createTextNode(text));
      }
    });
    return line;
  }

  function collectSigns(magickDataset, referenceData) {
    const fromMagick = magickDataset?.grouped?.astrology?.zodiac;
    if (fromMagick && typeof fromMagick === "object") {
      return Object.values(fromMagick)
        .filter((sign) => sign && typeof sign === "object")
        .sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0))
        .map((sign) => ({
          id: String(sign.id || "").trim().toLowerCase(),
          name: String(sign.name?.en || sign.name || titleCase(sign.id)).trim(),
          symbol: String(sign.symbol || "").trim(),
          elementId: String(sign.elementId || sign.element || "").trim().toLowerCase(),
          modalityId: normalizeModalityId(sign.quadruplicity || sign.modality || sign.sourceQuadruplicity),
          planetId: String(sign.planetId || sign.rulingPlanetId || "").trim().toLowerCase(),
          order: Number(sign.no || sign.order || 0) || 0
        }))
        .filter((sign) => sign.id && sign.modalityId);
    }

    const signs = Array.isArray(referenceData?.signs) ? referenceData.signs : [];
    return signs
      .map((sign) => ({
        id: String(sign.id || "").trim().toLowerCase(),
        name: String(sign.name || titleCase(sign.id)).trim(),
        symbol: String(sign.symbol || "").trim(),
        elementId: String(sign.element || sign.elementId || "").trim().toLowerCase(),
        modalityId: normalizeModalityId(sign.modality || sign.sourceQuadruplicity || sign.quadruplicity),
        planetId: String(sign.rulingPlanetId || sign.planetId || "").trim().toLowerCase(),
        order: Number(sign.order || sign.no || 0) || 0
      }))
      .filter((sign) => sign.id && sign.modalityId)
      .sort((a, b) => a.order - b.order);
  }

  function buildEntries(magickDataset, referenceData) {
    const signs = collectSigns(magickDataset, referenceData);
    const signsByModality = new Map();

    signs.forEach((sign) => {
      const list = signsByModality.get(sign.modalityId) || [];
      list.push(sign);
      signsByModality.set(sign.modalityId, list);
    });

    return MODALITY_DEFS.map((def) => {
      const modalitySigns = (signsByModality.get(def.id) || []).slice().sort((a, b) => a.order - b.order);
      const signNames = modalitySigns.map((sign) => sign.name);
      const elementNames = modalitySigns.map((sign) => titleCase(sign.elementId));
      const tarotCards = hasTarotAccess()
        ? modalitySigns.flatMap((sign) => {
          const suit = SUIT_BY_ELEMENT_ID[sign.elementId] || "";
          if (!suit) {
            return [];
          }
          return def.tarotNumbers.map((number) => `${number} of ${suit}`);
        })
        : [];

      return {
        id: def.id,
        name: def.name,
        aliases: def.aliases,
        quality: def.quality,
        description: def.description,
        tarotRange: def.tarotRange,
        tarotNumbers: def.tarotNumbers,
        signs: modalitySigns,
        tarotCards,
        searchText: (typeof window.TarotSearchText?.buildSearchText === "function"
          ? window.TarotSearchText.buildSearchText(
            def.id,
            def.name,
            def.quality,
            def.description,
            def.aliases,
            modalitySigns,
            tarotCards,
            {
              type: "modality",
              id: def.id,
              label: `Modality: ${def.name}`,
              data: {
                modality: def.id,
                signs: signNames,
                elements: elementNames
              }
            }
          )
          : normalize([
            def.id,
            def.name,
            def.quality,
            def.description,
            ...(def.aliases || []),
            ...signNames,
            ...elementNames,
            ...tarotCards
          ].join(" ")))
      };
    });
  }

  function findEntryById(id) {
    const normalizedId = normalizeModalityId(id);
    return state.entries.find((entry) => entry.id === normalizedId) || null;
  }

  function renderList(elements) {
    if (!elements?.listEl) {
      return;
    }

    elements.listEl.replaceChildren();

    state.filteredEntries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item";
      button.dataset.modalityId = entry.id;
      button.setAttribute("role", "option");

      const isSelected = entry.id === state.selectedId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");

      const name = document.createElement("span");
      name.className = "list-name";
      name.textContent = entry.name;

      const meta = document.createElement("span");
      meta.className = "list-meta";
      const signSummary = (entry.signs || [])
        .map((sign) => `${sign.symbol || ""} ${sign.name}`.trim())
        .join(" · ");
      meta.textContent = `${entry.quality} · ${(entry.signs || []).length} signs${signSummary ? ` · ${signSummary}` : ""}`;

      button.append(name, meta);
      elements.listEl.appendChild(button);
    });

    if (elements.countEl) {
      elements.countEl.textContent = state.searchQuery
        ? `${state.filteredEntries.length} of ${state.entries.length} modalities`
        : `${state.entries.length} modalities`;
    }

    if (!state.filteredEntries.length) {
      const empty = document.createElement("div");
      empty.className = "body-text";
      empty.style.padding = "16px";
      empty.style.color = "#71717a";
      empty.textContent = "No modalities match your search.";
      elements.listEl.appendChild(empty);
    }
  }

  function renderDetail(elements) {
    if (!elements?.detailNameEl || !elements.detailSubEl || !elements.detailBodyEl) {
      return;
    }

    const entry = findEntryById(state.selectedId);
    elements.detailBodyEl.replaceChildren();

    if (!entry) {
      elements.detailNameEl.textContent = "--";
      elements.detailSubEl.textContent = "Select a modality to explore";
      return;
    }

    elements.detailNameEl.textContent = entry.name;
    elements.detailSubEl.textContent = `${entry.quality} · Zodiac quadruplicity`;

    const grid = document.createElement("div");
    grid.className = "meta-grid";

    const detailsCard = document.createElement("div");
    detailsCard.className = "meta-card";
    const detailsTitle = document.createElement("strong");
    detailsTitle.textContent = "Modality Details";
    const detailsList = document.createElement("dl");
    detailsList.className = "alpha-dl";

    function appendDetailRow(label, value) {
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      if (value instanceof Node) {
        detail.appendChild(value);
      } else {
        detail.textContent = String(value || "--");
      }
      detailsList.append(term, detail);
    }

    appendDetailRow("Name", entry.name);
    appendDetailRow("Quality", entry.quality);
    if (entry.id === "fixed") {
      appendDetailRow("Also called", "Kerubic");
    }
    appendDetailRow("Description", entry.description);
    if (hasTarotAccess()) {
      appendDetailRow("Small cards", `${entry.tarotRange} of each elemental suit`);
    }
    appendDetailRow("ID", entry.id);
    detailsCard.append(detailsTitle, detailsList);
    grid.appendChild(detailsCard);

    const signsCard = document.createElement("div");
    signsCard.className = "meta-card";
    const signsTitle = document.createElement("strong");
    signsTitle.textContent = `${entry.name} Signs`;
    signsCard.appendChild(signsTitle);

    const signsStack = document.createElement("div");
    signsStack.className = "cal-item-stack";

    (entry.signs || []).forEach((sign) => {
      const row = document.createElement("div");
      row.className = "cal-item-row";

      const elemStyle = ELEMENT_STYLE[sign.elementId] || {};
      const head = document.createElement("div");
      head.className = "cal-item-head";
      head.innerHTML = html`
        <span class="cal-item-name">${sign.symbol || ""} ${sign.name}</span>
        <span class="zod-list-elem ${elemStyle.badge || ""}">${elemStyle.emoji || ""} ${titleCase(sign.elementId)}</span>
      `;
      row.appendChild(head);

      const parts = [
        "Sign: ",
        createInlineButton(`${sign.symbol || ""} ${sign.name}`.trim(), () => {
          document.dispatchEvent(new CustomEvent("nav:zodiac", {
            detail: { signId: sign.id }
          }));
        })
      ];

      if (sign.elementId) {
        parts.push(" · Element: ");
        parts.push(createInlineButton(titleCase(sign.elementId), () => {
          document.dispatchEvent(new CustomEvent("nav:elements", {
            detail: { elementId: sign.elementId }
          }));
        }));
      }

      if (sign.planetId) {
        parts.push(` · Ruler: ${titleCase(sign.planetId)}`);
      }

      row.appendChild(createInlineParagraph(parts));

      if (hasTarotAccess()) {
        const suit = SUIT_BY_ELEMENT_ID[sign.elementId] || "";
        if (suit) {
          const cardParts = ["Cards: "];
          entry.tarotNumbers.forEach((number, index) => {
            if (index > 0) {
              cardParts.push(", ");
            }
            const cardName = `${number} of ${suit}`;
            cardParts.push(createInlineButton(cardName, () => {
              document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
                detail: { cardName }
              }));
            }));
          });
          row.appendChild(createInlineParagraph(cardParts));
        }
      }

      signsStack.appendChild(row);
    });

    if (!(entry.signs || []).length) {
      const empty = document.createElement("p");
      empty.className = "body-text";
      empty.textContent = "No signs linked to this modality.";
      signsStack.appendChild(empty);
    }

    signsCard.appendChild(signsStack);
    grid.appendChild(signsCard);
    elements.detailBodyEl.appendChild(grid);
  }

  function applyFilter(elements) {
    const query = normalize(state.searchQuery);
    state.filteredEntries = query
      ? state.entries.filter((entry) => entry.searchText.includes(query))
      : [...state.entries];

    if (elements?.searchClearEl) {
      elements.searchClearEl.disabled = !query;
    }

    if (!state.filteredEntries.some((entry) => entry.id === state.selectedId)) {
      state.selectedId = state.filteredEntries[0]?.id || "";
    }

    renderList(elements);
    renderDetail(elements);
  }

  function selectByModalityId(modalityId) {
    const target = findEntryById(modalityId);
    if (!target) {
      return false;
    }

    const elements = getElements();
    state.selectedId = target.id;
    renderList(elements);
    renderDetail(elements);

    const listItem = elements.listEl?.querySelector(`[data-modality-id="${target.id}"]`);
    listItem?.scrollIntoView({ block: "nearest" });
    return true;
  }

  function ensureModalitiesSection(magickDataset, referenceData) {
    const elements = getElements();
    if (!elements.listEl || !elements.detailBodyEl) {
      return;
    }

    state.entries = buildEntries(magickDataset, referenceData);

    if (!state.selectedId && state.entries.length) {
      state.selectedId = state.entries[0].id;
    }

    applyFilter(elements);

    if (state.initialized) {
      return;
    }

    elements.listEl.addEventListener("click", (event) => {
      const target = event.target instanceof Element
        ? event.target.closest(".list-item")
        : null;

      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const modalityId = target.dataset.modalityId;
      if (!modalityId) {
        return;
      }

      state.selectedId = modalityId;
      renderList(elements);
      renderDetail(elements);
    });

    if (elements.searchEl) {
      elements.searchEl.addEventListener("input", () => {
        state.searchQuery = elements.searchEl.value || "";
        applyFilter(elements);
      });
    }

    if (elements.searchClearEl && elements.searchEl) {
      elements.searchClearEl.addEventListener("click", () => {
        state.searchQuery = "";
        elements.searchEl.value = "";
        applyFilter(elements);
        elements.searchEl.focus();
      });
    }

    state.initialized = true;
  }

  window.ModalitiesSectionUi = {
    ensureModalitiesSection,
    selectByModalityId
  };
})();
