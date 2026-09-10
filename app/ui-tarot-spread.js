(function () {
  "use strict";

  const dataService = window.TarotDataService || {};

  let initialized = false;
  let activeTarotSpread = null;
  let activeTarotSpreadDraw = [];
  let activeTarotSpreadLoading = false;
  let allowReversedCards = false;
  let config = {
    ensureTarotSection: null,
    getReferenceData: () => null,
    getMagickDataset: () => null,
    getActiveSection: () => "home",
    setActiveSection: null
  };

  const THREE_CARD_POSITIONS = [
    { pos: "past", label: "Past" },
    { pos: "present", label: "Present" },
    { pos: "future", label: "Future" }
  ];

  const CELTIC_CROSS_POSITIONS = [
    { pos: "crown", label: "Crown" },
    { pos: "out", label: "Outcome" },
    { pos: "past", label: "Recent Past" },
    { pos: "present", label: "Present" },
    { pos: "near-fut", label: "Near Future" },
    { pos: "hope", label: "Hopes & Fears" },
    { pos: "chall", label: "Challenge" },
    { pos: "env", label: "Environment" },
    { pos: "found", label: "Foundation" },
    { pos: "self", label: "Self" }
  ];

  function getElements() {
    return {
      openTarotCardsEl: document.getElementById("open-tarot-cards"),
      openTarotSpreadEl: document.getElementById("open-tarot-spread"),
      tarotBrowseViewEl: document.getElementById("tarot-browse-view"),
      tarotSpreadViewEl: document.getElementById("tarot-spread-view"),
      tarotSpreadBackEl: document.getElementById("tarot-spread-back"),
      tarotSpreadBtnThreeEl: document.getElementById("tarot-spread-btn-three"),
      tarotSpreadBtnCelticEl: document.getElementById("tarot-spread-btn-celtic"),
      tarotSpreadBtnReverseEl: document.getElementById("tarot-spread-btn-reverse"),
      tarotSpreadRevealAllEl: document.getElementById("tarot-spread-reveal-all"),
      tarotSpreadRedrawEl: document.getElementById("tarot-spread-redraw"),
      tarotSpreadMeaningsEl: document.getElementById("tarot-spread-meanings"),
      tarotSpreadBoardEl: document.getElementById("tarot-spread-board")
    };
  }

  function ensureTarotBrowseData() {
    const referenceData = typeof config.getReferenceData === "function" ? config.getReferenceData() : null;
    const magickDataset = typeof config.getMagickDataset === "function" ? config.getMagickDataset() : null;
    if (typeof config.ensureTarotSection === "function" && referenceData) {
      config.ensureTarotSection(referenceData, magickDataset);
    }
  }

  // Deck manifests load lazily; kick the build so card images resolve without
  // needing to open the Frame/Cards page first.
  function ensureSpreadDeckSources() {
    try {
      window.TarotCardImages?.getDeckOptions?.();
    } catch (_error) {
      // Deck sources are optional; placeholders render until they arrive.
    }
  }

  function normalizeTarotSpread(value) {
    return value === "celtic-cross" ? "celtic-cross" : "three-card";
  }

  const { html, raw } = window.HtmlSafe;

  function getSpreadPositions(spreadId) {
    return spreadId === "celtic-cross" ? CELTIC_CROSS_POSITIONS : THREE_CARD_POSITIONS;
  }

  async function regenerateTarotSpreadDraw() {
    const normalizedSpread = normalizeTarotSpread(activeTarotSpread);
    const positions = getSpreadPositions(normalizedSpread);

    activeTarotSpreadLoading = true;
    try {
      const payload = await dataService.pullTarotSpread?.(normalizedSpread, {
        reversed: allowReversedCards
      });
      const apiPositions = Array.isArray(payload?.positions) ? payload.positions : [];
      activeTarotSpreadDraw = apiPositions.map((entry, index) => ({
        position: entry?.position || positions[index] || null,
        card: entry?.card
          ? {
              ...entry.card,
              reversed: Boolean(entry?.reversed ?? entry.card?.reversed)
            }
          : null,
        revealed: false
      }));
    } finally {
      activeTarotSpreadLoading = false;
    }
  }

  function renderTarotSpreadMeanings() {
    const { tarotSpreadMeaningsEl } = getElements();
    if (!tarotSpreadMeaningsEl) {
      return;
    }

    if (!activeTarotSpreadDraw.length || activeTarotSpreadDraw.some((entry) => !entry.card)) {
      tarotSpreadMeaningsEl.innerHTML = "";
      return;
    }

    const revealedEntries = activeTarotSpreadDraw.filter((entry) => entry.card && entry.revealed);
    if (!revealedEntries.length) {
      tarotSpreadMeaningsEl.innerHTML = '<div class="tarot-spread-meanings-empty">Cards are face down. Click a card to reveal its meaning.</div>';
      return;
    }

    const hiddenCount = activeTarotSpreadDraw.length - revealedEntries.length;
    const hiddenHintMarkup = hiddenCount > 0
      ? html`<div class="tarot-spread-meanings-empty">${hiddenCount} card${hiddenCount === 1 ? "" : "s"} still face down.</div>`
      : "";

    tarotSpreadMeaningsEl.innerHTML = raw(revealedEntries.map((entry) => {
      const positionLabel = String(entry.position.label || "").toUpperCase();
      const card = entry.card;
      const cardName = card.name || "Unknown Card";
      const meaningText = card.reversed ? (card.meanings?.reversed || card.summary || "--") : (card.meanings?.upright || card.summary || "--");
      const keywords = Array.isArray(card.keywords)
        ? card.keywords.map((keyword) => String(keyword || "").trim()).filter(Boolean)
        : [];
      const keywordMarkup = keywords.length
        ? html`<div class="tarot-spread-meaning-keywords">Keywords: ${keywords.join(", ")}</div>`
        : "";
      const orientationMarkup = card.reversed
        ? raw(' <span class="tarot-spread-meaning-orientation">(Reversed)</span>')
        : "";

      return html`<div class="tarot-spread-meaning-item">`
        + html`<div class="tarot-spread-meaning-head">${positionLabel}: <span class="tarot-spread-meaning-card">${cardName}</span>${orientationMarkup}</div>`
        + html`<div class="tarot-spread-meaning-text">${meaningText}</div>`
        + keywordMarkup
        + `</div>`;
    }).join("")) + hiddenHintMarkup;
  }

  function updateRevealAllButton() {
    const { tarotSpreadRevealAllEl } = getElements();
    if (!tarotSpreadRevealAllEl) return;
    const totalCards = activeTarotSpreadDraw.length;
    const revealedCount = activeTarotSpreadDraw.reduce((count, entry) => (
      count + (entry?.card && entry.revealed ? 1 : 0)
    ), 0);
    tarotSpreadRevealAllEl.disabled = revealedCount >= totalCards || activeTarotSpreadLoading;
    tarotSpreadRevealAllEl.textContent = revealedCount >= totalCards
      ? "All Revealed"
      : `Reveal All (${totalCards - revealedCount})`;
  }

  function updateSpreadCardElement(button, entry, { staggerMs = 0 } = {}) {
    if (!button || !entry?.card) return;
    const isRevealed = Boolean(entry.revealed);
    button.classList.toggle("is-revealed", isRevealed);
    button.classList.toggle("is-facedown", !isRevealed);
    button.classList.toggle("is-reversed", isRevealed && Boolean(entry.card.reversed));

    const inner = button.querySelector(".spread-card-inner");
    if (inner) {
      inner.style.transitionDelay = staggerMs ? `${staggerMs}ms` : "";
    }

    const position = entry.position;
    const card = entry.card;
    const buttonAriaLabel = isRevealed
      ? `Open ${card.name} for ${position.label} in fullscreen`
      : `Reveal ${position.label} card`;
    button.setAttribute("aria-label", buttonAriaLabel);

    const positionEl = button.closest(".spread-position");
    const reversedTag = positionEl?.querySelector(".spread-reversed-tag");
    if (reversedTag) {
      reversedTag.textContent = isRevealed && card.reversed ? "Reversed" : "";
      reversedTag.hidden = !(isRevealed && card.reversed);
    }
  }

  function renderTarotSpread({ animateDeal = false } = {}) {
    const { tarotSpreadBoardEl, tarotSpreadMeaningsEl } = getElements();
    if (!tarotSpreadBoardEl) {
      return;
    }

    const normalizedSpread = normalizeTarotSpread(activeTarotSpread);
    const isCeltic = normalizedSpread === "celtic-cross";
    const cardBackImageSrc = String(
      window.TarotCardImages?.resolveTarotCardBackThumbnail?.()
      || window.TarotCardImages?.resolveTarotCardBackImage?.()
      || ""
    ).trim();

    if (activeTarotSpreadLoading) {
      tarotSpreadBoardEl.innerHTML = '<div class="spread-empty">Loading spread from API...</div>';
      if (tarotSpreadMeaningsEl) {
        tarotSpreadMeaningsEl.innerHTML = "";
      }
      return;
    }

    if (!activeTarotSpreadDraw.length) {
      tarotSpreadBoardEl.innerHTML = '<div class="spread-empty">Loading spread...</div>';
      if (tarotSpreadMeaningsEl) {
        tarotSpreadMeaningsEl.innerHTML = "";
      }
      return;
    }

    tarotSpreadBoardEl.className = [
      "tarot-spread-board",
      `tarot-spread-board--${isCeltic ? "celtic" : "three"}`,
      animateDeal ? "is-dealing" : ""
    ].filter(Boolean).join(" ");

    if (activeTarotSpreadDraw.some((entry) => !entry.card)) {
      tarotSpreadBoardEl.innerHTML = '<div class="spread-empty">Tarot deck not loaded yet - open Cards first, then return to Spread.</div>';
      if (tarotSpreadMeaningsEl) {
        tarotSpreadMeaningsEl.innerHTML = "";
      }
      updateRevealAllButton();
      return;
    }

    updateRevealAllButton();
    renderTarotSpreadMeanings();

    tarotSpreadBoardEl.innerHTML = raw(activeTarotSpreadDraw.map((entry, index) => {
      const position = entry.position;
      const card = entry.card;
      const imgSrc = window.TarotCardImages?.resolveTarotCardThumbnail?.(card.name)
        || window.TarotCardImages?.resolveTarotCardImage?.(card.name);
      const isRevealed = Boolean(entry.revealed);
      const cardBackAttr = cardBackImageSrc
        ? html` data-card-back-src="${cardBackImageSrc}"`
        : "";
      const reversed = card.reversed;
      const wrapClass = [
        "spread-card-wrap",
        isRevealed ? "is-revealed" : "is-facedown",
        (isRevealed && reversed) ? "is-reversed" : ""
      ].filter(Boolean).join(" ");

      const backFaceMarkup = cardBackImageSrc
        ? html`<img class="spread-card-back-img" src="${cardBackImageSrc}" alt="Face-down tarot card" loading="lazy" decoding="async">`
        : raw('<div class="spread-card-back-fallback">CARD BACK</div>');

      const frontFaceMarkup = imgSrc
        ? html`<img class="spread-card-img" src="${imgSrc}" alt="${card.name}" loading="lazy" decoding="async">`
        : html`<div class="spread-card-placeholder">${card.name}</div>`;

      const buttonAriaLabel = isRevealed
        ? `Open ${card.name} for ${position.label} in fullscreen`
        : `Reveal ${position.label} card`;

      return html`<div class="spread-position" data-pos="${position.pos}" style="animation-delay:${index * 110}ms">`
        + html`<div class="spread-pos-label">${position.label}</div>`
        + html`<button type="button" class="${wrapClass}" data-spread-index="${index}" aria-label="${buttonAriaLabel}"${cardBackAttr}>`
        + raw('<span class="spread-card-inner">')
        + html`<span class="spread-card-face spread-card-face--back">${backFaceMarkup}</span>`
        + html`<span class="spread-card-face spread-card-face--front">${frontFaceMarkup}</span>`
        + raw('</span>')
        + `</button>`
        + html`<div class="spread-card-name"><span class="spread-reversed-tag"${(isRevealed && reversed) ? "" : " hidden"}>${(isRevealed && reversed) ? "Reversed" : ""}</span></div>`
        + `</div>`;
    }).join(""));
  }

  function applyViewState() {
    const {
      openTarotCardsEl,
      openTarotSpreadEl,
      tarotBrowseViewEl,
      tarotSpreadViewEl,
      tarotSpreadBtnThreeEl,
      tarotSpreadBtnCelticEl,
      tarotSpreadBtnReverseEl
    } = getElements();
    const isSpreadOpen = activeTarotSpread !== null;
    const isCeltic = activeTarotSpread === "celtic-cross";
    const isTarotActive = typeof config.getActiveSection === "function" && config.getActiveSection() === "tarot";

    if (tarotBrowseViewEl) tarotBrowseViewEl.hidden = isSpreadOpen;
    if (tarotSpreadViewEl) tarotSpreadViewEl.hidden = !isSpreadOpen;

    if (tarotSpreadBtnThreeEl) tarotSpreadBtnThreeEl.classList.toggle("is-active", isSpreadOpen && !isCeltic);
    if (tarotSpreadBtnCelticEl) tarotSpreadBtnCelticEl.classList.toggle("is-active", isSpreadOpen && isCeltic);
    if (tarotSpreadBtnReverseEl) {
      tarotSpreadBtnReverseEl.classList.toggle("is-active", allowReversedCards);
      tarotSpreadBtnReverseEl.setAttribute("aria-pressed", allowReversedCards ? "true" : "false");
    }

    if (openTarotCardsEl) openTarotCardsEl.classList.toggle("is-active", isTarotActive && !isSpreadOpen);
    if (openTarotSpreadEl) openTarotSpreadEl.classList.toggle("is-active", isTarotActive && isSpreadOpen);
  }

  function showCardsView() {
    activeTarotSpread = null;
    activeTarotSpreadDraw = [];
    applyViewState();
    ensureTarotBrowseData();
    const detailPanelEl = document.querySelector("#tarot-browse-view .detail-panel");
    if (detailPanelEl instanceof HTMLElement) {
      detailPanelEl.scrollTop = 0;
    }
  }

  function showTarotSpreadView(spreadId = "three-card") {
    activeTarotSpread = normalizeTarotSpread(spreadId);
    activeTarotSpreadLoading = true;
    activeTarotSpreadDraw = [];
    applyViewState();
    ensureTarotBrowseData();
    ensureSpreadDeckSources();
    renderTarotSpread();
    void regenerateTarotSpreadDraw().then(() => {
      ensureSpreadDeckSources();
      renderTarotSpread({ animateDeal: true });
    });
  }

  function setSpread(spreadId, openTarotSection = false) {
    if (openTarotSection && typeof config.setActiveSection === "function") {
      config.setActiveSection("tarot");
    }
    showTarotSpreadView(spreadId);
  }

  function revealAll() {
    if (activeTarotSpreadLoading || !activeTarotSpreadDraw.length) {
      return;
    }

    const { tarotSpreadBoardEl } = getElements();
    let staggerIndex = 0;
    activeTarotSpreadDraw.forEach((entry, index) => {
      if (!entry?.card || entry.revealed) return;
      entry.revealed = true;
      const button = tarotSpreadBoardEl?.querySelector(`.spread-card-wrap[data-spread-index="${index}"]`);
      if (button) {
        updateSpreadCardElement(button, entry, { staggerMs: staggerIndex * 90 });
        staggerIndex += 1;
      }
    });

    renderTarotSpreadMeanings();
    updateRevealAllButton();
  }

  function handleBoardClick(event) {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const button = target instanceof Element
      ? target.closest(".spread-card-wrap[data-spread-index]")
      : null;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const spreadIndex = Number(button.dataset.spreadIndex);
    if (!Number.isInteger(spreadIndex) || spreadIndex < 0 || spreadIndex >= activeTarotSpreadDraw.length) {
      return;
    }

    const spreadEntry = activeTarotSpreadDraw[spreadIndex];
    if (!spreadEntry?.card) {
      return;
    }

    if (!spreadEntry.revealed) {
      spreadEntry.revealed = true;
      updateSpreadCardElement(button, spreadEntry);
      renderTarotSpreadMeanings();
      updateRevealAllButton();
      return;
    }

    const imageSrc = window.TarotCardImages?.resolveTarotCardImage?.(spreadEntry.card.name);
    if (imageSrc) {
      window.TarotUiLightbox?.open?.(imageSrc, `${spreadEntry.card.name} (${spreadEntry.position?.label || "Spread"})`);
    }
  }

  function bindEvents() {
    const {
      tarotSpreadBackEl,
      tarotSpreadBtnThreeEl,
      tarotSpreadBtnCelticEl,
      tarotSpreadBtnReverseEl,
      tarotSpreadRevealAllEl,
      tarotSpreadRedrawEl,
      tarotSpreadBoardEl
    } = getElements();

    // Note: the topbar Cards / Draw Spread buttons are wired in ui-navigation
    // (they also activate the tarot section before the module exists).

    if (tarotSpreadBackEl) {
      tarotSpreadBackEl.addEventListener("click", () => {
        showCardsView();
      });
    }

    if (tarotSpreadBtnThreeEl) {
      tarotSpreadBtnThreeEl.addEventListener("click", () => {
        showTarotSpreadView("three-card");
      });
    }

    if (tarotSpreadBtnCelticEl) {
      tarotSpreadBtnCelticEl.addEventListener("click", () => {
        showTarotSpreadView("celtic-cross");
      });
    }

    if (tarotSpreadBtnReverseEl) {
      tarotSpreadBtnReverseEl.addEventListener("click", () => {
        allowReversedCards = !allowReversedCards;
        applyViewState();
      });
    }

    if (tarotSpreadRedrawEl) {
      tarotSpreadRedrawEl.addEventListener("click", () => {
        activeTarotSpreadLoading = true;
        activeTarotSpreadDraw = [];
        renderTarotSpread();
        void regenerateTarotSpreadDraw().then(() => {
          renderTarotSpread({ animateDeal: true });
        });
      });
    }

    if (tarotSpreadRevealAllEl) {
      tarotSpreadRevealAllEl.addEventListener("click", revealAll);
    }

    if (tarotSpreadBoardEl) {
      tarotSpreadBoardEl.addEventListener("click", handleBoardClick);
    }

    // Deck manifests may finish loading after the spread rendered; re-render
    // so real card images replace placeholders without any user action.
    document.addEventListener("tarot:deck-cache-status", () => {
      if (activeTarotSpread !== null && !activeTarotSpreadLoading) {
        renderTarotSpread({ animateDeal: false });
      }
    });
  }

  function handleSectionActivated() {
    ensureTarotBrowseData();
    ensureSpreadDeckSources();
    applyViewState();
    if (activeTarotSpread !== null) {
      renderTarotSpread({ animateDeal: false });
    }
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig
    };

    if (initialized) {
      applyViewState();
      return;
    }

    bindEvents();
    applyViewState();
    initialized = true;
  }

  window.TarotSpreadUi = {
    ...(window.TarotSpreadUi || {}),
    init,
    applyViewState,
    showCardsView,
    showTarotSpreadView,
    setSpread,
    handleSectionActivated,
    renderTarotSpread,
    isSpreadOpen() {
      return activeTarotSpread !== null;
    }
  };
})();
