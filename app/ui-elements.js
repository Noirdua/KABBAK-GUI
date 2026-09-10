(function () {
  "use strict";

  const { html } = window.HtmlSafe;

  const { getTarotCardSearchAliases } = window.TarotCardImages || {};

  const CLASSICAL_ELEMENT_IDS = ["fire", "water", "air", "earth"];

  const ACE_BY_ELEMENT_ID = {
    water: "Ace of Cups",
    fire: "Ace of Wands",
    air: "Ace of Swords",
    earth: "Ace of Disks"
  };

  const HEBREW_LETTER_NAME_BY_ELEMENT_ID = {
    fire: "Yod",
    water: "Heh",
    air: "Vav",
    earth: "Heh"
  };

  const HEBREW_LETTER_CHAR_BY_ELEMENT_ID = {
    fire: "י",
    water: "ה",
    air: "ו",
    earth: "ה"
  };

  const COURT_RANK_BY_ELEMENT_ID = {
    fire: "Knight",
    water: "Queen",
    air: "Prince",
    earth: "Princess"
  };

  const COURT_SUITS = ["Wands", "Cups", "Swords", "Disks"];

  const SUIT_BY_ELEMENT_ID = {
    fire: "Wands",
    water: "Cups",
    air: "Swords",
    earth: "Disks"
  };

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  const SMALL_CARD_GROUPS = [
    { label: "2–4", modality: "Cardinal", numbers: [2, 3, 4] },
    { label: "5–7", modality: "Fixed", numbers: [5, 6, 7] },
    { label: "8–10", modality: "Mutable", numbers: [8, 9, 10] }
  ];

  const SIGN_BY_ELEMENT_AND_MODALITY = {
    fire: { cardinal: "aries", fixed: "leo", mutable: "sagittarius" },
    water: { cardinal: "cancer", fixed: "scorpio", mutable: "pisces" },
    air: { cardinal: "libra", fixed: "aquarius", mutable: "gemini" },
    earth: { cardinal: "capricorn", fixed: "taurus", mutable: "virgo" }
  };

  const state = {
    initialized: false,
    entries: [],
    filteredEntries: [],
    selectedId: "",
    searchQuery: ""
  };

  function getElements() {
    return {
      listEl: document.getElementById("elements-list"),
      countEl: document.getElementById("elements-count"),
      searchEl: document.getElementById("elements-search-input"),
      searchClearEl: document.getElementById("elements-search-clear"),
      detailNameEl: document.getElementById("elements-detail-name"),
      detailSubEl: document.getElementById("elements-detail-sub"),
      detailBodyEl: document.getElementById("elements-detail-body")
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

  function resolveHebrewLetterId(letterName) {
    const token = normalize(letterName).replace(/[^a-z]/g, "");
    if (!token) {
      return "";
    }

    if (token === "yod") return "yod";
    if (token === "vav") return "vav";
    if (token === "heh") return "he";
    return token;
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
    appendInlineParts(line, parts);
    return line;
  }

  function buildTarotAliasText(cardNames) {
    if (typeof getTarotCardSearchAliases !== "function") {
      return Array.isArray(cardNames) ? cardNames.join(" ") : "";
    }

    const aliases = new Set();
    (Array.isArray(cardNames) ? cardNames : []).forEach((cardName) => {
      getTarotCardSearchAliases(cardName).forEach((alias) => aliases.add(alias));
    });
    return Array.from(aliases).join(" ");
  }

  function buildSmallCardGroupsForElement(elementId) {
    const suit = SUIT_BY_ELEMENT_ID[elementId] || "";
    const signByModality = SIGN_BY_ELEMENT_AND_MODALITY[elementId] || {};

    return SMALL_CARD_GROUPS.map((group) => {
      const signId = String(signByModality[String(group.modality || "").toLowerCase()] || "").trim();
      const signName = titleCase(signId);
      const cardNames = group.numbers.map((number) => `${number} of ${suit}`);

      return {
        rangeLabel: group.label,
        modality: group.modality,
        signId,
        signName,
        cardNames
      };
    });
  }

  function buildEntries(magickDataset) {
    const source = magickDataset?.grouped?.alchemy?.elements;
    if (!source || typeof source !== "object") {
      return [];
    }

    return CLASSICAL_ELEMENT_IDS
      .map((id) => {
        const item = source[id];
        if (!item || typeof item !== "object") {
          return null;
        }

        const name = String(item?.name?.en || item?.name || titleCase(id)).trim() || titleCase(id);
        const symbol = String(item?.symbol || "").trim();
        const aceCardName = ACE_BY_ELEMENT_ID[id] || "";
        const hebrewLetter = HEBREW_LETTER_CHAR_BY_ELEMENT_ID[id] || "";
        const hebrewLetterName = HEBREW_LETTER_NAME_BY_ELEMENT_ID[id] || "";
        const hebrewLetterId = resolveHebrewLetterId(hebrewLetterName);
        const courtRank = COURT_RANK_BY_ELEMENT_ID[id] || "";
        const courtCardNames = courtRank
          ? COURT_SUITS.map((suit) => `${courtRank} of ${suit}`)
          : [];
        const smallCardGroups = buildSmallCardGroupsForElement(id);
        const smallCardNames = smallCardGroups.flatMap((group) => group.cardNames || []);
        const tarotAliasText = buildTarotAliasText([aceCardName, ...courtCardNames, ...smallCardNames]);

        return {
          id,
          name,
          symbol,
          elementalId: String(item?.elementalId || "").trim(),
          aceCardName,
          hebrewLetter,
          hebrewLetterName,
          hebrewLetterId,
          courtRank,
          courtCardNames,
          smallCardGroups,
          searchText: (typeof window.TarotSearchText?.buildSearchText === "function"
            ? window.TarotSearchText.buildSearchText(
              id,
              name,
              symbol,
              aceCardName,
              hebrewLetter,
              hebrewLetterName,
              courtRank,
              courtCardNames,
              smallCardGroups,
              tarotAliasText,
              {
                type: "element",
                id,
                label: `Element: ${name}`,
                data: { elementId: id, name }
              }
            )
            : normalize(`${id} ${name} ${symbol} ${aceCardName} ${hebrewLetter} ${hebrewLetterName} ${courtRank} ${courtCardNames.join(" ")} ${smallCardGroups.map((group) => `${group.modality} ${group.signName} ${group.cardNames.join(" ")}`).join(" ")} ${tarotAliasText}`))
        };
      })
      .filter(Boolean);
  }

  function findEntryById(id) {
    const normalizedId = normalize(id);
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
      button.dataset.elementId = entry.id;
      button.setAttribute("role", "option");

      const isSelected = entry.id === state.selectedId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");

      const name = document.createElement("span");
      name.className = "list-name";
      name.textContent = `${entry.symbol} ${entry.name}`.trim();

      const meta = document.createElement("span");
      meta.className = "list-meta";
      meta.textContent = `Letter: ${entry.hebrewLetter || "--"} · Ace: ${entry.aceCardName || "--"} · Court: ${entry.courtRank || "--"}`;

      button.append(name, meta);
      elements.listEl.appendChild(button);
    });

    if (elements.countEl) {
      elements.countEl.textContent = `${state.filteredEntries.length} elements`;
    }

    if (!state.filteredEntries.length) {
      const empty = document.createElement("div");
      empty.className = "body-text";
      empty.style.padding = "16px";
      empty.style.color = "#71717a";
      empty.textContent = "No elements match your search.";
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
      elements.detailSubEl.textContent = "Select an element to explore";
      return;
    }

    elements.detailNameEl.textContent = `${entry.symbol} ${entry.name}`.trim();
    elements.detailSubEl.textContent = "Classical Element";

    const grid = document.createElement("div");
    grid.className = "meta-grid";

    const detailsCard = document.createElement("div");
    detailsCard.className = "meta-card";
    const detailsTitle = document.createElement("strong");
    detailsTitle.textContent = "Element Details";

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
    appendDetailRow("Symbol", entry.symbol || "--");

    const hebrewLetterLabel = `${entry.hebrewLetter || ""} ${entry.hebrewLetterName || ""}`.trim() || "--";
    appendDetailRow(
      "Hebrew Letter",
      entry.hebrewLetterId
        ? createInlineButton(hebrewLetterLabel, () => {
          document.dispatchEvent(new CustomEvent("nav:alphabet", {
            detail: {
              alphabet: "hebrew",
              hebrewLetterId: entry.hebrewLetterId
            }
          }));
        })
        : hebrewLetterLabel
    );

    appendDetailRow("Court Rank", entry.courtRank || "--");
    appendDetailRow("ID", entry.id);

    detailsCard.append(detailsTitle, detailsList);

    const detailCards = [detailsCard];

    if (hasTarotAccess()) {
      const tarotCard = document.createElement("div");
      tarotCard.className = "meta-card";

      const tarotTitle = document.createElement("strong");
      tarotTitle.textContent = "Tarot Correspondence";

      const tarotParts = [];
      if (entry.aceCardName) {
        tarotParts.push(
          "Ace: ",
          createInlineButton(entry.aceCardName, () => {
            document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
              detail: { cardName: entry.aceCardName }
            }));
          })
        );
      }
      if (entry.courtRank) {
        if (tarotParts.length) {
          tarotParts.push(" · ");
        }
        tarotParts.push(`Court Rank: ${entry.courtRank} (all suits)`);
      }

      const tarotText = tarotParts.length
        ? createInlineParagraph(tarotParts)
        : document.createTextNode("--");

      tarotCard.append(tarotTitle, tarotText);

      if (entry.courtCardNames.length) {
        const courtParts = ["Court cards: "];
        entry.courtCardNames.forEach((cardName, index) => {
          if (index > 0) {
            courtParts.push(", ");
          }
          courtParts.push(createInlineButton(cardName, () => {
            document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
              detail: { cardName }
            }));
          }));
        });

        tarotCard.appendChild(createInlineParagraph(courtParts));
      }

      const smallCardCard = document.createElement("div");
      smallCardCard.className = "meta-card";

      const smallCardTitle = document.createElement("strong");
      smallCardTitle.textContent = "Small Card Sign Types";
      smallCardCard.appendChild(smallCardTitle);

      const smallCardStack = document.createElement("div");
      smallCardStack.className = "cal-item-stack";

      (entry.smallCardGroups || []).forEach((group) => {
        const row = document.createElement("div");
        row.className = "cal-item-row";

        const head = document.createElement("div");
        head.className = "cal-item-head";
        head.innerHTML = html`
        <span class="cal-item-name">${group.rangeLabel}</span>
        <span class="list-meta">${group.signName || "--"}</span>
      `;
        row.appendChild(head);

        row.appendChild(createInlineParagraph([
          "Modality: ",
          createInlineButton(group.modality, () => {
            document.dispatchEvent(new CustomEvent("nav:modalities", {
              detail: { modalityId: String(group.modality || "").toLowerCase() }
            }));
          })
        ]));

        if (group.signId) {
          row.appendChild(createInlineParagraph([
            "Sign: ",
            createInlineButton(group.signName, () => {
              document.dispatchEvent(new CustomEvent("nav:zodiac", {
                detail: { signId: group.signId }
              }));
            })
          ]));
        }

        if ((group.cardNames || []).length) {
          const cardParts = ["Cards: "];
          group.cardNames.forEach((cardName, index) => {
            if (index > 0) {
              cardParts.push(", ");
            }
            cardParts.push(createInlineButton(cardName, () => {
              document.dispatchEvent(new CustomEvent("nav:tarot-trump", {
                detail: { cardName }
              }));
            }));
          });
          row.appendChild(createInlineParagraph(cardParts));
        }

        smallCardStack.appendChild(row);
      });

      smallCardCard.appendChild(smallCardStack);
      detailCards.push(tarotCard, smallCardCard);
    }

    grid.append(...detailCards);
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

  function selectByElementId(elementId) {
    const target = findEntryById(elementId);
    if (!target) {
      return false;
    }

    const elements = getElements();
    state.selectedId = target.id;
    renderList(elements);
    renderDetail(elements);

    const listItem = elements.listEl?.querySelector(`[data-element-id="${target.id}"]`);
    listItem?.scrollIntoView({ block: "nearest" });

    return true;
  }

  function ensureElementsSection(magickDataset) {
    const elements = getElements();
    if (!elements.listEl || !elements.detailBodyEl) {
      return;
    }

    state.entries = buildEntries(magickDataset);

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

      const elementId = target.dataset.elementId;
      if (!elementId) {
        return;
      }

      state.selectedId = elementId;
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

  window.ElementsSectionUi = {
    ensureElementsSection,
    selectByElementId
  };
})();
