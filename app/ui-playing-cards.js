(function () {
  "use strict";

  const SUIT_ORDER = ["spades", "hearts", "diamonds", "clubs"];
  const RANK_ORDER = { A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13 };

  function rankOrder(card) {
    if (Number.isFinite(card?.rankValue) && card.rankValue > 0) {
      return card.rankValue;
    }
    return RANK_ORDER[String(card?.rank || "").toUpperCase()] || 99;
  }

  const state = {
    initialized: false,
    cards: [],
    filtered: [],
    deckId: "",
    selectedId: "",
    searchQuery: ""
  };

  function getElements() {
    return {
      listEl: document.getElementById("playing-cards-list"),
      countEl: document.getElementById("playing-cards-count"),
      searchInputEl: document.getElementById("playing-cards-search-input"),
      searchClearEl: document.getElementById("playing-cards-search-clear"),
      detailNameEl: document.getElementById("playing-cards-detail-name"),
      detailTypeEl: document.getElementById("playing-cards-detail-type"),
      detailSummaryEl: document.getElementById("playing-cards-detail-summary"),
      detailTarotEl: document.getElementById("playing-cards-detail-tarot"),
      detailNumerologyEl: document.getElementById("playing-cards-detail-numerology"),
      metaDeckCardEl: document.getElementById("playing-cards-meta-deck-card"),
      detailDeckImageEl: document.getElementById("playing-cards-detail-deck-image")
    };
  }

  function clearChildren(node) {
    if (node) {
      node.replaceChildren();
    }
  }

  function normalizeSearchValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function buildCards(entries) {
    const cards = (Array.isArray(entries) ? entries : [])
      .map((entry) => {
        const suit = String(entry?.suit || "").toLowerCase();
        const suitLabel = String(entry?.suitLabel || suit);
        const rankLabel = String(entry?.rankLabel || entry?.rank || "");
        return {
          id: String(entry?.id || `${entry?.rank || ""}${entry?.suit || ""}`).toUpperCase(),
          suit,
          suitLabel,
          suitSymbol: String(entry?.suitSymbol || ""),
          rank: String(entry?.rank || ""),
          rankLabel,
          rankValue: Number.isFinite(Number(entry?.rankValue)) ? Number(entry.rankValue) : null,
          digitalRoot: Number.isFinite(Number(entry?.digitalRoot)) ? Number(entry.digitalRoot) : null,
          tarotSuit: String(entry?.tarotSuit || ""),
          tarotCard: String(entry?.tarotCard || ""),
          name: `${rankLabel} of ${suitLabel}`,
          displayName: `${rankLabel} of ${suitLabel}`,
          isJoker: false,
          variantIndex: 0
        };
      })
      .filter((card) => card.id && card.suit);

    cards.sort((left, right) => {
      const suitDiff = SUIT_ORDER.indexOf(left.suit) - SUIT_ORDER.indexOf(right.suit);
      if (suitDiff) return suitDiff;
      return rankOrder(left) - rankOrder(right);
    });

    cards.push(
      { id: "JOKER-1", suit: "jokers", suitLabel: "Jokers", suitSymbol: "★", rank: "JOKER", rankLabel: "Joker", rankValue: null, digitalRoot: null, tarotSuit: "", tarotCard: "", name: "Joker", displayName: "Joker 1", isJoker: true, variantIndex: 0 },
      { id: "JOKER-2", suit: "jokers", suitLabel: "Jokers", suitSymbol: "★", rank: "JOKER", rankLabel: "Joker", rankValue: null, digitalRoot: null, tarotSuit: "", tarotCard: "", name: "Joker", displayName: "Joker 2", isJoker: true, variantIndex: 1 }
    );

    return cards;
  }

  function cardMatches(card, query) {
    if (!query) return true;
    return [card.displayName, card.suitLabel, card.suitSymbol, card.rankLabel, card.tarotCard, card.id]
      .some((value) => normalizeSearchValue(value).includes(query));
  }

  function getPlayingDecks() {
    const api = window.TarotCardImages;
    return (api?.getDeckOptions?.() || []).filter((deck) => (
      deck?.id && String(deck.system || "").toLowerCase() === "playing-cards"
    ));
  }

  function resolveDeckId() {
    const decks = getPlayingDecks();
    if (state.deckId && decks.some((deck) => deck.id === state.deckId)) {
      return state.deckId;
    }
    state.deckId = decks[0]?.id || "";
    return state.deckId;
  }

  function buildCardRequest(card, deckId) {
    const api = window.TarotCardImages;
    if (!api || !card) return null;
    const variants = (api.resolveTarotCardVariants?.(card.name, { deckId }) || [])
      .map((variant) => ({
        src: String(variant?.assetPath || "").trim(),
        previewSrc: String(variant?.thumbnailPath || variant?.assetPath || "").trim()
      }))
      .filter((variant) => variant.src);
    let src = "";
    if (card.isJoker) {
      src = variants[card.variantIndex || 0]?.src || variants[0]?.src || "";
    } else {
      src = String(api.resolveTarotCardImage?.(card.name, { deckId }) || "").trim();
    }
    if (!src) return null;
    const deck = getPlayingDecks().find((candidate) => candidate.id === deckId);
    return {
      src,
      altText: card.displayName,
      label: card.displayName,
      cardId: card.id,
      deckId,
      deckLabel: deck?.label || deckId,
      compareDetails: [],
      resolveCardVariants: () => variants
    };
  }

  function resolveThumb(card, deckId) {
    const api = window.TarotCardImages;
    if (!api) return "";
    if (card.isJoker) {
      const variants = api.resolveTarotCardVariants?.(card.name, { deckId }) || [];
      const chosen = variants[card.variantIndex || 0] || variants[0];
      return String(chosen?.thumbnailPath || chosen?.assetPath || "").trim();
    }
    return String(
      api.resolveTarotCardThumbnail?.(card.name, { deckId })
      || api.resolveTarotCardImage?.(card.name, { deckId })
      || ""
    ).trim();
  }

  async function ensureCardReader() {
    if (window.TarotUiLightbox?.open) {
      return true;
    }
    try {
      await window.TarotLazySections?.loadScript?.("app/ui-tarot-lightbox.js?v=20260925-fly");
    } catch (_error) {
      // Fall through to the availability check below.
    }
    return Boolean(window.TarotUiLightbox?.open);
  }

  function variantsFor(card, deckId) {
    return (window.TarotCardImages?.resolveTarotCardVariants?.(card.name, { deckId }) || [])
      .map((variant) => ({
        src: String(variant?.assetPath || "").trim(),
        previewSrc: String(variant?.thumbnailPath || variant?.assetPath || "").trim()
      }))
      .filter((variant) => variant.src);
  }

  // Mirrors tarot's deck-variant reader: prev/next steps through the installed
  // decks for the selected card (e.g. Ace of Spades in every deck).
  function openCardInReader(card, deckId, originRect) {
    if (!card) return;
    void ensureCardReader().then((ready) => {
      if (!ready || typeof window.TarotUiLightbox?.open !== "function") return;
      const decks = getPlayingDecks();
      if (!decks.length) return;

      const variants = decks.map((deck) => ({ sequenceId: deck.id, deckId: deck.id }));
      const requested = String(deckId || "").trim().toLowerCase();
      const active = variants.find((variant) => variant.deckId.toLowerCase() === requested) || variants[0];
      const primary = buildCardRequest(card, active.deckId);
      if (!primary) return;

      window.TarotUiLightbox.open({
        ...primary,
        sequenceId: active.sequenceId,
        deckId: active.deckId,
        sequenceIds: variants.map((variant) => variant.sequenceId),
        allowOverlayCompare: true,
        allowDeckCompare: decks.length > 1,
        activeDeckId: active.deckId,
        activeDeckLabel: primary.deckLabel,
        availableCompareDecks: decks.map((deck) => ({ id: deck.id, label: deck.label })),
        resolveCardById: (sequenceId) => {
          const match = variants.find((variant) => variant.sequenceId === sequenceId);
          if (!match) return null;
          const request = buildCardRequest(card, match.deckId);
          return request ? { ...request, sequenceId: match.sequenceId, deckId: match.deckId } : null;
        },
        resolveDeckCardById: (cardId, nextDeckId) => {
          const target = state.cards.find((entry) => entry.id === cardId) || card;
          return buildCardRequest(target, nextDeckId);
        },
        resolveCardVariants: (variantCardId, variantDeckId) => {
          const target = state.cards.find((entry) => entry.id === variantCardId) || card;
          return variantsFor(target, variantDeckId || active.deckId);
        },
        maxCompareDecks: decks.length,
        originRect: originRect || null
      });
    });
  }

  function renderCount(elements) {
    if (elements.countEl) {
      elements.countEl.textContent = String(state.filtered.length);
    }
  }

  function renderList(elements) {
    if (!elements.listEl) return;
    const query = normalizeSearchValue(state.searchQuery);
    state.filtered = state.cards.filter((card) => cardMatches(card, query));
    clearChildren(elements.listEl);

    const deckId = resolveDeckId();
    let currentSuit = "";
    state.filtered.forEach((card) => {
      if (card.suit !== currentSuit) {
        currentSuit = card.suit;
        const groupTitle = document.createElement("div");
        groupTitle.className = "list-group-title";
        groupTitle.textContent = card.isJoker ? "Jokers" : card.suitLabel;
        elements.listEl.appendChild(groupTitle);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item";
      button.dataset.playingCardId = card.id;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");

      const thumb = document.createElement("img");
      thumb.className = "list-thumb";
      thumb.alt = "";
      thumb.loading = "lazy";
      const thumbSrc = resolveThumb(card, deckId);
      if (thumbSrc) {
        thumb.src = thumbSrc;
      } else {
        thumb.className += " is-empty";
      }

      const nameEl = document.createElement("span");
      nameEl.className = "list-name";
      nameEl.textContent = card.displayName;

      const metaEl = document.createElement("span");
      metaEl.className = "list-meta";
      metaEl.textContent = card.isJoker ? "Joker" : `${card.tarotCard || "—"}`;

      button.append(thumb, nameEl, metaEl);
      elements.listEl.appendChild(button);
    });

    renderCount(elements);
    highlightSelection(elements);
  }

  function highlightSelection(elements) {
    if (!elements.listEl) return;
    elements.listEl.querySelectorAll(".list-item").forEach((button) => {
      const isSelected = button.dataset.playingCardId === state.selectedId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");
    });
  }

  function renderDeckGallery(card, elements) {
    const host = elements.detailDeckImageEl;
    if (!host) return;
    clearChildren(host);
    const decks = getPlayingDecks();
    if (!decks.length || !card) {
      if (elements.metaDeckCardEl) elements.metaDeckCardEl.hidden = true;
      return;
    }
    if (elements.metaDeckCardEl) elements.metaDeckCardEl.hidden = false;
    decks.forEach((deck) => {
      const src = resolveThumb(card, deck.id) || buildCardRequest(card, deck.id)?.src || "";
      if (!src) return;
      const item = document.createElement("button");
      item.type = "button";
      item.className = "playing-cards-deck-item";
      item.title = `Open ${deck.label || deck.id} in the Card Reader`;
      const img = document.createElement("img");
      img.className = "playing-cards-deck-image";
      img.src = src;
      img.alt = card.displayName;
      img.loading = "lazy";
      const label = document.createElement("span");
      label.className = "playing-cards-deck-label";
      label.textContent = deck.label || deck.id;
      item.append(img, label);
      item.addEventListener("click", () => {
        state.deckId = deck.id;
        openCardInReader(card, deck.id, img.getBoundingClientRect());
      });
      host.appendChild(item);
    });
  }

  function renderDetail(card, elements) {
    if (!card) return;

    if (elements.detailNameEl) elements.detailNameEl.textContent = card.displayName;
    if (elements.detailTypeEl) {
      elements.detailTypeEl.textContent = card.isJoker
        ? "Joker"
        : `${card.suitLabel} · ${card.rankLabel}`;
    }
    if (elements.detailSummaryEl) {
      elements.detailSummaryEl.textContent = card.isJoker
        ? "Wild card"
        : (card.tarotCard ? `Tarot correspondence: ${card.tarotCard}` : `${card.rankLabel} of ${card.suitLabel}`);
    }

    if (elements.detailTarotEl) {
      elements.detailTarotEl.textContent = card.tarotCard
        ? `${card.tarotSuit || ""}${card.tarotSuit ? " — " : ""}${card.tarotCard}`
        : "—";
    }

    if (elements.detailNumerologyEl) {
      if (card.isJoker) {
        elements.detailNumerologyEl.textContent = "—";
      } else {
        const parts = [];
        if (card.rankValue != null) parts.push(`Rank value ${card.rankValue}`);
        if (card.digitalRoot != null) parts.push(`Digital root ${card.digitalRoot}`);
        elements.detailNumerologyEl.textContent = parts.join(" · ") || "—";
      }
    }

    renderDeckGallery(card, elements);
  }

  function selectCard(cardId, elements) {
    const card = state.cards.find((entry) => entry.id === cardId);
    if (!card) return;
    state.selectedId = card.id;
    renderDetail(card, elements);
    highlightSelection(elements);
    const selectedButton = elements.listEl?.querySelector(`[data-playing-card-id="${card.id}"]`);
    if (typeof selectedButton?.scrollIntoView === "function") {
      selectedButton.scrollIntoView({ block: "nearest" });
    }
  }

  function bindEvents(elements) {
    if (elements.listEl) {
      elements.listEl.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest(".list-item");
        if (!(button instanceof HTMLButtonElement)) return;
        const cardId = button.dataset.playingCardId;
        if (cardId) selectCard(cardId, elements);
      });
    }

    if (elements.searchInputEl) {
      elements.searchInputEl.addEventListener("input", () => {
        state.searchQuery = elements.searchInputEl.value || "";
        if (elements.searchClearEl) elements.searchClearEl.disabled = !state.searchQuery;
        renderList(elements);
      });
    }

    if (elements.searchClearEl && elements.searchInputEl) {
      elements.searchClearEl.addEventListener("click", () => {
        elements.searchInputEl.value = "";
        state.searchQuery = "";
        elements.searchClearEl.disabled = true;
        renderList(elements);
        elements.searchInputEl.focus();
      });
    }

  }

  async function loadCards() {
    let payload = null;
    try {
      payload = await window.TarotDataService?.fetchPlayingCards?.();
    } catch (_error) {
      payload = null;
    }
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];
    return buildCards(entries);
  }

  async function ensurePlayingCardsSection() {
    const elements = getElements();
    if (!elements.listEl) return;

    if (!state.cards.length) {
      // Pick up decks installed since the last page load.
      try {
        window.TarotCardImages?.resetConnectionCaches?.();
      } catch (_error) {}
      state.cards = await loadCards();
      bindEvents(elements);
    }

    renderList(elements);
    if (state.cards.length) {
      selectCard(state.selectedId || state.cards[0].id, elements);
    }
    state.initialized = true;
  }

  window.PlayingCardsSectionUi = {
    ensurePlayingCardsSection,
    selectPlayingCard: (cardId) => selectCard(cardId, getElements())
  };
})();
