(function () {
  "use strict";

  const { html } = window.HtmlSafe;

  const TABLET_META = {
    union: { label: "Enochian Tablet of Union", element: "Spirit", order: 0 },
    spirit: { label: "Enochian Tablet of Union", element: "Spirit", order: 0 },
    earth: { label: "Enochian Tablet of Earth", element: "Earth", order: 1 },
    air: { label: "Enochian Tablet of Air", element: "Air", order: 2 },
    water: { label: "Enochian Tablet of Water", element: "Water", order: 3 },
    fire: { label: "Enochian Tablet of Fire", element: "Fire", order: 4 }
  };

  const TAROT_NAME_ALIASES = {
    juggler: "magus",
    magician: "magus",
    strength: "lust",
    temperance: "art",
    judgement: "aeon",
    judgment: "aeon",
    charit: "chariot"
  };

  const state = {
    initialized: false,
    entries: [],
    filteredEntries: [],
    selectedId: "",
    selectedCell: null,
    searchQuery: "",
    lettersById: new Map()
  };

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  function getElements() {
    return {
      listEl: document.getElementById("enochian-list"),
      countEl: document.getElementById("enochian-count"),
      searchEl: document.getElementById("enochian-search-input"),
      searchClearEl: document.getElementById("enochian-search-clear"),
      detailNameEl: document.getElementById("enochian-detail-name"),
      detailSubEl: document.getElementById("enochian-detail-sub"),
      detailBodyEl: document.getElementById("enochian-detail-body")
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
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function getTabletMeta(id) {
    const normalizedId = normalize(id);
    return TABLET_META[normalizedId] || {
      label: `Enochian Tablet of ${titleCase(normalizedId || "Unknown")}`,
      element: titleCase(normalizedId || "Unknown"),
      order: 99
    };
  }

  function buildSearchText(entry) {
    if (typeof window.TarotSearchText?.buildSearchText === "function") {
      return window.TarotSearchText.buildSearchText(
        entry.id,
        entry.label,
        entry.element,
        entry.rowCount,
        entry.colCount,
        entry.uniqueLetters,
        {
          type: "element",
          id: entry.element,
          label: entry.element,
          data: { elementId: String(entry.element || "").toLowerCase() }
        }
      );
    }

    return normalize([
      entry.id,
      entry.label,
      entry.element,
      entry.rowCount,
      entry.colCount,
      ...entry.uniqueLetters
    ].join(" "));
  }

  function buildEntries(magickDataset) {
    const tablets = magickDataset?.grouped?.enochian?.tablets;
    if (!tablets || typeof tablets !== "object") {
      return [];
    }

    return Object.entries(tablets)
      .map(([key, value]) => {
        const id = normalize(value?.id || key);
        const grid = Array.isArray(value?.grid)
          ? value.grid.map((row) => (Array.isArray(row)
            ? row.map((cell) => String(cell || "").trim())
            : []))
          : [];

        const rowCount = grid.length;
        const colCount = grid.reduce((max, row) => Math.max(max, row.length), 0);
        const uniqueLetters = [...new Set(
          grid
            .flat()
            .map((cell) => String(cell || "").trim().toUpperCase())
            .filter(Boolean)
        )].sort((left, right) => left.localeCompare(right));

        const meta = getTabletMeta(id);

        return {
          id,
          grid,
          rowCount,
          colCount,
          uniqueLetters,
          element: meta.element,
          label: meta.label,
          order: Number(meta.order)
        };
      })
      .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
  }

  function buildLetterMap(magickDataset) {
    const letters = magickDataset?.grouped?.enochian?.letters;
    if (!letters || typeof letters !== "object") {
      return new Map();
    }

    return new Map(
      Object.entries(letters)
        .map(([key, value]) => [String(key || "").trim().toUpperCase(), value])
        .filter(([key]) => Boolean(key))
    );
  }

  function findEntryById(id) {
    return state.entries.find((entry) => entry.id === id) || null;
  }

  function getDefaultCell(entry) {
    if (!entry || !Array.isArray(entry.grid)) {
      return null;
    }

    for (let rowIndex = 0; rowIndex < entry.grid.length; rowIndex += 1) {
      const row = entry.grid[rowIndex];
      for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
        const value = String(row[colIndex] || "").trim();
        if (value) {
          return { rowIndex, colIndex, value };
        }
      }
    }

    return null;
  }

  function renderList(elements) {
    if (!elements?.listEl) {
      return;
    }

    elements.listEl.replaceChildren();

    state.filteredEntries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "enoch-list-item";
      button.dataset.tabletId = entry.id;
      button.setAttribute("role", "option");

      const isSelected = entry.id === state.selectedId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");

      const name = document.createElement("span");
      name.className = "enoch-list-name";
      name.textContent = entry.label;

      const meta = document.createElement("span");
      meta.className = "enoch-list-meta";
      meta.textContent = `${entry.element} · ${entry.rowCount}×${entry.colCount} · ${entry.uniqueLetters.length} letters`;

      button.append(name, meta);
      elements.listEl.appendChild(button);
    });

    if (elements.countEl) {
      elements.countEl.textContent = `${state.filteredEntries.length} tablets`;
    }

    if (!state.filteredEntries.length) {
      const empty = document.createElement("div");
      empty.className = "body-text";
      empty.style.padding = "16px";
      empty.style.color = "#71717a";
      empty.textContent = "No Enochian tablets match your search.";
      elements.listEl.appendChild(empty);
    }
  }

  function resolveTarotCardName(value) {
    const normalized = normalize(value);
    if (!normalized) {
      return "";
    }

    return TAROT_NAME_ALIASES[normalized] || normalized;
  }

  function renderDetail(elements) {
    if (!elements?.detailBodyEl || !elements.detailNameEl || !elements.detailSubEl) {
      return;
    }

    const entry = findEntryById(state.selectedId);
    elements.detailBodyEl.replaceChildren();

    if (!entry) {
      elements.detailNameEl.textContent = "--";
      elements.detailSubEl.textContent = "Select a tablet to explore";
      return;
    }

    elements.detailNameEl.textContent = entry.label;
    elements.detailSubEl.textContent = `${entry.element} Tablet · ${entry.rowCount} rows × ${entry.colCount} columns`;

    if (!state.selectedCell) {
      state.selectedCell = getDefaultCell(entry);
    }

    const detailGrid = document.createElement("div");
    detailGrid.className = "meta-grid";

    const summaryCard = document.createElement("div");
    summaryCard.className = "meta-card";
    summaryCard.innerHTML = html`
      <strong>Tablet Overview</strong>
      <div class="enoch-letter-meta">
        <div>${entry.label}</div>
        <div>${entry.rowCount} rows × ${entry.colCount} columns</div>
        <div>Unique letters: ${entry.uniqueLetters.length}</div>
      </div>
    `;

    const gridCard = document.createElement("div");
    gridCard.className = "meta-card";
    const gridTitle = document.createElement("strong");
    gridTitle.textContent = "Tablet Grid";
    const gridEl = document.createElement("div");
    gridEl.className = "enoch-grid";

    entry.grid.forEach((row, rowIndex) => {
      const rowEl = document.createElement("div");
      rowEl.className = "enoch-grid-row";
      row.forEach((cell, colIndex) => {
        const value = String(cell || "").trim();
        const cellBtn = document.createElement("button");
        cellBtn.type = "button";
        cellBtn.className = "enoch-grid-cell";
        cellBtn.textContent = value || "·";

        const isSelectedCell = state.selectedCell
          && state.selectedCell.rowIndex === rowIndex
          && state.selectedCell.colIndex === colIndex;
        cellBtn.classList.toggle("is-selected", Boolean(isSelectedCell));

        cellBtn.addEventListener("click", () => {
          state.selectedCell = { rowIndex, colIndex, value };
          renderDetail(elements);
        });

        rowEl.appendChild(cellBtn);
      });
      gridEl.appendChild(rowEl);
    });

    gridCard.append(gridTitle, gridEl);

    const letterCard = document.createElement("div");
    letterCard.className = "meta-card";
    const letterTitle = document.createElement("strong");
    letterTitle.textContent = "Selected Letter";

    const selectedLetter = String(state.selectedCell?.value || "").trim().toUpperCase();
    const letterData = selectedLetter ? state.lettersById.get(selectedLetter) : null;

    const letterContent = document.createElement("div");
    letterContent.className = "enoch-letter-meta";

    if (!selectedLetter) {
      letterContent.textContent = "Select any grid cell to inspect its correspondence data.";
    } else {
      const firstRow = document.createElement("div");
      firstRow.className = "enoch-letter-row";
      const chip = document.createElement("span");
      chip.className = "enoch-letter-chip";
      chip.textContent = selectedLetter;
      firstRow.appendChild(chip);

      const title = document.createElement("span");
      title.textContent = letterData?.title
        ? `${letterData.title}${letterData.english ? ` · ${letterData.english}` : ""}`
        : "No letter metadata yet";
      firstRow.appendChild(title);
      letterContent.appendChild(firstRow);

      if (letterData) {
        const detailRows = [
          ["Pronunciation", letterData.pronounciation],
          ["Planet / Element", letterData["planet/element"]],
          ["Gematria", letterData.gematria]
        ];

        if (hasTarotAccess()) {
          detailRows.splice(2, 0, ["Tarot", letterData.tarot]);
        }

        detailRows.forEach(([label, value]) => {
          if (value === undefined || value === null || String(value).trim() === "") {
            return;
          }
          const row = document.createElement("div");
          row.className = "enoch-letter-row";
          row.innerHTML = html`<span style="color:#a1a1aa">${label}:</span><span>${value}</span>`;
          letterContent.appendChild(row);
        });

        const navRow = document.createElement("div");
        navRow.className = "enoch-letter-row";

        const tarotCardName = resolveTarotCardName(letterData.tarot);
        if (hasTarotAccess() && tarotCardName) {
          const tarotBtn = document.createElement("button");
          tarotBtn.type = "button";
          tarotBtn.className = "enoch-nav-btn";
          tarotBtn.textContent = `Open Tarot (${titleCase(tarotCardName)}) ↗`;
          tarotBtn.addEventListener("click", () => {
            document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
              detail: { cardName: tarotCardName }
            }));
          });
          navRow.appendChild(tarotBtn);
        }

        const alphabetBtn = document.createElement("button");
        alphabetBtn.type = "button";
        alphabetBtn.className = "enoch-nav-btn";
        alphabetBtn.textContent = "Open Alphabet ↗";
        alphabetBtn.addEventListener("click", () => {
          document.dispatchEvent(new CustomEvent("nav:alphabet", {
            detail: {
              alphabet: "english",
              englishLetter: selectedLetter
            }
          }));
        });
        navRow.appendChild(alphabetBtn);

        letterContent.appendChild(navRow);
      }
    }

    letterCard.append(letterTitle, letterContent);

    detailGrid.append(summaryCard, letterCard, gridCard);
    elements.detailBodyEl.appendChild(detailGrid);
  }

  function applyFilter(elements) {
    const query = normalize(state.searchQuery);
    state.filteredEntries = query
      ? state.entries.filter((entry) => buildSearchText(entry).includes(query))
      : [...state.entries];

    if (elements?.searchClearEl) {
      elements.searchClearEl.disabled = !query;
    }

    if (!state.filteredEntries.some((entry) => entry.id === state.selectedId)) {
      state.selectedId = state.filteredEntries[0]?.id || "";
      state.selectedCell = state.selectedId ? getDefaultCell(findEntryById(state.selectedId)) : null;
    }

    renderList(elements);
    renderDetail(elements);
  }

  function selectByTabletId(tabletId) {
    const elements = getElements();
    const target = findEntryById(normalize(tabletId));
    if (!target) {
      return false;
    }

    state.selectedId = target.id;
    state.selectedCell = getDefaultCell(target);
    renderList(elements);
    renderDetail(elements);
    return true;
  }

  function ensureEnochianSection(magickDataset) {
    const elements = getElements();
    if (!elements.listEl || !elements.detailBodyEl) {
      return;
    }

    state.entries = buildEntries(magickDataset);
    state.lettersById = buildLetterMap(magickDataset);

    if (!state.selectedId && state.entries.length) {
      state.selectedId = state.entries[0].id;
      state.selectedCell = getDefaultCell(state.entries[0]);
    }

    applyFilter(elements);

    if (state.initialized) {
      return;
    }

    elements.listEl.addEventListener("click", (event) => {
      const target = event.target instanceof Element
        ? event.target.closest(".enoch-list-item")
        : null;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const tabletId = target.dataset.tabletId;
      if (!tabletId) {
        return;
      }

      state.selectedId = tabletId;
      state.selectedCell = getDefaultCell(findEntryById(tabletId));
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

  window.EnochianSectionUi = {
    ensureEnochianSection,
    selectByTabletId
  };
})();
