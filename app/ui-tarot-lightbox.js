(function () {
  "use strict";

  let overlayEl = null;
  let backdropEl = null;
  let toolbarEl = null;
  let settingsButtonEl = null;
  let settingsPanelEl = null;
  let notesControlEl = null;
  let helpButtonEl = null;
  let helpPanelEl = null;
  let helpTitleEl = null;
  let helpListEl = null;
  let compareButtonEl = null;
  let deckCompareButtonEl = null;
  let mobileInfoButtonEl = null;
  let mobileInfoPrimaryTabEl = null;
  let mobileInfoSecondaryTabEl = null;
  let deckComparePanelEl = null;
  let deckCompareMessageEl = null;
  let deckCompareDeckListEl = null;
  let zoomControlEl = null;
  let zoomSliderEl = null;
  let zoomValueEl = null;
  let opacityControlEl = null;
  let opacitySliderEl = null;
  let opacityValueEl = null;
  let exportButtonEl = null;
  let stageEl = null;
  let frameEl = null;
  let baseLayerEl = null;
  let overlayLayerEl = null;
  let compareGridEl = null;
  let imageEl = null;
  let overlayImageEl = null;
  let primaryInfoEl = null;
  let primaryTitleEl = null;
  let primaryGroupsEl = null;
  let primaryHintEl = null;
  let secondaryInfoEl = null;
  let secondaryTitleEl = null;
  let secondaryGroupsEl = null;
  let secondaryHintEl = null;
  let mobileInfoPanelEl = null;
  let mobileInfoTitleEl = null;
  let mobileInfoGroupsEl = null;
  let mobileInfoHintEl = null;
  let mobilePrevButtonEl = null;
  let mobileNextButtonEl = null;
  let variantSwitcherEl = null;
  let variantPrevButtonEl = null;
  let variantNextButtonEl = null;
  let variantCounterEl = null;
  let compareGridSlots = [];
  let zoomed = false;
  let lastNotesCardId = "";
  let previousFocusedEl = null;
  let activePointerId = null;
  let activePointerStartX = 0;
  let activePointerStartY = 0;
  let activePointerMoved = false;
  let activePinchGesture = null;
  let suppressNextCardClick = false;
  let suppressDeckCompareToggleUntil = 0;
  let primaryImageRequestToken = 0;
  let overlayImageRequestToken = 0;

  const LIGHTBOX_ZOOM_SCALE = 6.66;
  const LIGHTBOX_ZOOM_STEP = 0.1;
  const LIGHTBOX_PAN_STEP = 4;
  const LIGHTBOX_COMPARE_DEFAULT_OVERLAY_OPACITY = 0.5;
  const LIGHTBOX_COMPACT_MAX_COMPARE_DECKS = 3;
  const LIGHTBOX_COMPARE_SEQUENCE_STEP_KEYS = new Set(["ArrowLeft", "ArrowRight"]);
  const LIGHTBOX_EXPORT_MIME_TYPE = "image/webp";
  const LIGHTBOX_EXPORT_QUALITY = 1;
  const LIGHTBOX_INFO_VISIBLE_STORAGE_KEY = "tarot-lightbox-info-visible-v1";
  const LIGHTBOX_ZOOM_SCALE_STORAGE_KEY = "tarot-lightbox-zoom-scale-v1";

  const lightboxState = {
    isOpen: false,
    compareMode: false,
    deckCompareMode: false,
    allowOverlayCompare: false,
    allowDeckCompare: false,
    primaryCard: null,
    secondaryCard: null,
    activeDeckId: "",
    activeDeckLabel: "",
    availableCompareDecks: [],
    selectedCompareDeckIds: [],
    deckCompareCards: [],
    maxCompareDecks: 2,
    deckComparePickerOpen: false,
    deckCompareMessage: "",
    sequenceIds: [],
    resolveCardById: null,
    resolveDeckCardById: null,
    onSelectCardId: null,
    overlayOpacity: LIGHTBOX_COMPARE_DEFAULT_OVERLAY_OPACITY,
    zoomScale: LIGHTBOX_ZOOM_SCALE,
    settingsMenuOpen: false,
    helpOpen: false,
    primaryRotated: false,
    overlayRotated: false,
    originRect: null,
    onClose: null,
    mobileInfoOpen: false,
    mobileInfoView: "primary",
    zoomOriginX: 50,
    zoomOriginY: 50,
    exportInProgress: false,
    primaryVariants: [],
    primaryVariantIndex: 0,
    resolveCardVariants: null
  };

  function hasSecondaryCard() {
    return Boolean(lightboxState.secondaryCard?.src);
  }

  function isCompactLightboxLayout() {
    if (typeof window === "undefined") {
      return false;
    }

    if (typeof window.matchMedia === "function") {
      return window.matchMedia("(max-width: 900px)").matches;
    }

    return Number(window.innerWidth) <= 900;
  }

  function getLightboxHelpTitle() {
    return isCompactLightboxLayout() ? "Lightbox Gestures" : "Lightbox Shortcuts";
  }

  function getLightboxHelpLines() {
    if (isCompactLightboxLayout()) {
      return [
        "Pinch the card: zoom in or out",
        "Drag while zoomed: pan around the card",
        "Tap the side arrows: move between cards, or move the overlay card in compare mode",
        "Tap Overlay: choose a second card to compare",
        "Tap Compare: show the same card from other registered decks",
        "Tap outside the card or use Close Lightbox to exit"
      ];
    }

    return [
      "Click card: toggle zoom at the clicked point",
      "Left / Right: move cards, or move overlay card in compare mode",
      "Overlay: pick a second card to compare",
      "Compare: show the same card from other registered decks",
      "Space: swap base and overlay cards",
      "R: rotate base card, or rotate overlay card in compare mode",
      "+ / -: zoom in or out in steps",
      "W A S D: pan while zoomed",
      "Escape or backdrop click: close"
    ];
  }

  function syncHelpContent() {
    if (!helpTitleEl || !helpListEl) {
      return;
    }

    helpTitleEl.textContent = getLightboxHelpTitle();
    helpListEl.replaceChildren();

    getLightboxHelpLines().forEach((line) => {
      const lineEl = document.createElement("div");
      lineEl.textContent = line;
      helpListEl.appendChild(lineEl);
    });
  }

  function hasSequenceNavigation() {
    return Array.isArray(lightboxState.sequenceIds)
      && lightboxState.sequenceIds.length > 1
      && typeof lightboxState.resolveCardById === "function";
  }

  function getActiveMobileInfoView() {
    return lightboxState.compareMode && hasSecondaryCard() && lightboxState.mobileInfoView === "overlay"
      ? "overlay"
      : "primary";
  }

  function getEffectiveMaxCompareDecks() {
    return isCompactLightboxLayout()
      ? LIGHTBOX_COMPACT_MAX_COMPARE_DECKS
      : lightboxState.maxCompareDecks;
  }

  function getCompareDeckLimitMessage() {
    return `Choose up to ${getEffectiveMaxCompareDecks()} extra decks.`;
  }

  function shouldHandleCompactPointerGesture(event) {
    return Boolean(
      lightboxState.isOpen
      && isCompactLightboxLayout()
      && event?.pointerType
      && event.pointerType !== "mouse"
    );
  }

  function clearActivePointerGesture() {
    activePointerId = null;
    activePointerStartX = 0;
    activePointerStartY = 0;
    activePointerMoved = false;
  }

  function clearActivePinchGesture() {
    if (activePinchGesture) {
      persistZoomScale();
    }
    activePinchGesture = null;
  }

  function getTouchMidpoint(touches) {
    if (!touches || touches.length < 2) {
      return null;
    }

    const first = touches[0];
    const second = touches[1];
    if (!first || !second) {
      return null;
    }

    return {
      x: (Number(first.clientX) + Number(second.clientX)) / 2,
      y: (Number(first.clientY) + Number(second.clientY)) / 2
    };
  }

  function getTouchDistance(touches) {
    if (!touches || touches.length < 2) {
      return 0;
    }

    const first = touches[0];
    const second = touches[1];
    if (!first || !second) {
      return 0;
    }

    return Math.hypot(Number(first.clientX) - Number(second.clientX), Number(first.clientY) - Number(second.clientY));
  }

  function consumeSuppressedCardClick() {
    if (!suppressNextCardClick) {
      return false;
    }

    suppressNextCardClick = false;
    return true;
  }

  function clampOverlayOpacity(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return LIGHTBOX_COMPARE_DEFAULT_OVERLAY_OPACITY;
    }

    return Math.min(1, Math.max(0.05, numericValue));
  }

  function clampZoomScale(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 1;
    }

    return Math.min(LIGHTBOX_ZOOM_SCALE, Math.max(1, numericValue));
  }

  function readStorageValue(key) {
    try {
      return window.localStorage?.getItem?.(key) ?? "";
    } catch (_error) {
      return "";
    }
  }

  function writeStorageValue(key, value) {
    try {
      window.localStorage?.setItem?.(key, value);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function getPersistedInfoPanelVisibility() {
    return String(readStorageValue(LIGHTBOX_INFO_VISIBLE_STORAGE_KEY) || "") === "1";
  }

  function getPersistedZoomScale() {
    const numericValue = Number.parseFloat(String(readStorageValue(LIGHTBOX_ZOOM_SCALE_STORAGE_KEY) || ""));
    if (!Number.isFinite(numericValue)) {
      return LIGHTBOX_ZOOM_SCALE;
    }
    return clampZoomScale(numericValue);
  }

  let lastPersistedZoomScale = null;
  let lightboxProfileSaveTimer = 0;

  const LIGHTBOX_PROFILE_PLUGIN_ID = "tarot-lightbox";
  const LIGHTBOX_OVERLAY_OPACITY_STORAGE_KEY = "tarot-lightbox-overlay-opacity-v1";

  function canUseLightboxProfileStore() {
    return window.TarotAppConfig?.isProfileAuthorized?.() === true
      && typeof window.TarotDataService?.requestJson === "function";
  }

  function persistLightboxProfileState() {
    if (!canUseLightboxProfileStore()) {
      return;
    }
    window.clearTimeout(lightboxProfileSaveTimer);
    lightboxProfileSaveTimer = window.setTimeout(() => {
      void window.TarotDataService.requestJson(
        "PUT",
        window.TarotDataService.buildApiUrl(`/api/v1/profile/plugin-state/${LIGHTBOX_PROFILE_PLUGIN_ID}`),
        { state: { zoomScale: lightboxState.zoomScale, overlayOpacity: lightboxState.overlayOpacity } }
      ).catch(() => {});
    }, 700);
  }

  // Zoom + overlay opacity are saved to the profile so they follow the user
  // across devices (localStorage remains as the per-browser fallback).
  async function hydrateLightboxProfileState() {
    if (!canUseLightboxProfileStore()) {
      return;
    }
    try {
      const payload = await window.TarotDataService.requestJson(
        "GET",
        window.TarotDataService.buildApiUrl(`/api/v1/profile/plugin-state/${LIGHTBOX_PROFILE_PLUGIN_ID}`)
      );
      const remote = payload?.state && typeof payload.state === "object" ? payload.state : null;
      if (!remote) {
        return;
      }
      if (Number.isFinite(Number(remote.zoomScale))) {
        lightboxState.zoomScale = clampZoomScale(Number(remote.zoomScale));
        applyZoomTransform();
      }
      if (Number.isFinite(Number(remote.overlayOpacity))) {
        setOverlayOpacity(Number(remote.overlayOpacity));
      }
      persistZoomScale();
    } catch (_error) {
      // Optional enhancement; localStorage defaults remain.
    }
  }

  function persistZoomScale() {
    const zoomScale = lightboxState.zoomScale;
    if (zoomScale === lastPersistedZoomScale) {
      return;
    }
    lastPersistedZoomScale = zoomScale;
    writeStorageValue(LIGHTBOX_ZOOM_SCALE_STORAGE_KEY, String(zoomScale));
    persistLightboxProfileState();
  }

  function setInfoPanelOpen(nextOpen, options = {}) {
    const persist = options.persist !== false;
    lightboxState.mobileInfoOpen = Boolean(nextOpen);
    if (persist) {
      writeStorageValue(LIGHTBOX_INFO_VISIBLE_STORAGE_KEY, lightboxState.mobileInfoOpen ? "1" : "0");
    }
  }

  function sanitizeExportToken(value, fallback = "tarot") {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    return normalized || fallback;
  }

  function canvasToBlobByFormat(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Canvas export failed."));
      }, mimeType, quality);
    });
  }

  function getVisibleElementRect(element) {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display === "none" || computedStyle.visibility === "hidden") {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

  function getCssPixelNumber(value, fallback = 0) {
    const numericValue = Number.parseFloat(String(value || ""));
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  function drawRoundedRectPath(context, x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.arcTo(x + width, y, x + width, y + height, safeRadius);
    context.arcTo(x + width, y + height, x, y + height, safeRadius);
    context.arcTo(x, y + height, x, y, safeRadius);
    context.arcTo(x, y, x + width, y, safeRadius);
    context.closePath();
  }

  function wrapCanvasText(context, text, maxWidth) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return [];
    }

    const words = normalized.split(" ");
    const lines = [];
    let currentLine = words.shift() || "";

    words.forEach((word) => {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
        currentLine = nextLine;
        return;
      }

      lines.push(currentLine);
      currentLine = word;
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  function extractPanelSections(panelEl) {
    if (!(panelEl instanceof HTMLElement)) {
      return null;
    }

    const title = String(panelEl.children[0]?.textContent || "").trim();
    const groupsRoot = panelEl.children[1] instanceof HTMLElement ? panelEl.children[1] : null;
    const hint = String(panelEl.children[2]?.textContent || "").trim();
    const groups = groupsRoot
      ? Array.from(groupsRoot.children).map((sectionEl) => {
          const titleEl = sectionEl.children[0];
          const valuesEl = sectionEl.children[1];
          return {
            title: String(titleEl?.textContent || "").trim(),
            items: valuesEl instanceof HTMLElement
              ? Array.from(valuesEl.children).map((itemEl) => String(itemEl.textContent || "").trim()).filter(Boolean)
              : []
          };
        }).filter((group) => group.title && group.items.length)
      : [];

    return { title, hint, groups };
  }

  function hdExportSrc(url) {
    return String(url || "").trim().replace(/\/thumbs\/([^/?#]+)(\?.*)?$/i, "/$1$2");
  }

  function resolveCardExportSrc(card, fallback) {
    return hdExportSrc(card?.src || fallback || card?.previewSrc || "");
  }

  async function loadExportImageAsset(source, cache) {
    const normalizedSource = String(source || "").trim();
    if (!normalizedSource) {
      return null;
    }

    if (cache.has(normalizedSource)) {
      return cache.get(normalizedSource);
    }

    const pending = (async () => {
      const sameOrigin = normalizedSource.startsWith("blob:")
        || normalizedSource.startsWith("data:")
        || normalizedSource.startsWith(window.location.origin);
      if (sameOrigin) {
        const liveImage = [imageEl, overlayImageEl].find((node) => (
          node instanceof HTMLImageElement
          && (node.currentSrc === normalizedSource || node.src === normalizedSource)
          && node.naturalWidth
        ));
        if (liveImage) {
          return liveImage;
        }
      }

      const headers = {};
      const apiKey = window.TarotDataService?.getApiKey?.();
      if (apiKey) {
        headers["x-api-key"] = apiKey;
      }
      const response = await fetch(normalizedSource, { headers, mode: "cors" });
      if (!response.ok) {
        throw new Error(`Failed to load export image: ${normalizedSource}`);
      }

      const blob = await response.blob();
      if (typeof createImageBitmap === "function") {
        try {
          return await createImageBitmap(blob);
        } catch (_error) {
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      try {
        return await new Promise((resolve, reject) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error(`Failed to decode export image: ${normalizedSource}`));
          image.src = blobUrl;
        });
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    })();

    cache.set(normalizedSource, pending);
    return pending;
  }

  function buildLightboxExportLayout() {
    const items = [];
    const pushPrimaryFrame = () => {
      const src = resolveCardExportSrc(
        lightboxState.primaryCard,
        imageEl?.currentSrc || imageEl?.src || ""
      );
      const rect = getVisibleElementRect(imageEl) || getVisibleElementRect(frameEl) || getVisibleElementRect(stageEl);
      const width = Math.max(1, rect?.width || imageEl?.naturalWidth || 520);
      const height = Math.max(1, rect?.height || imageEl?.naturalHeight || 780);
      const usedRect = rect || {
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        width,
        height
      };
      items.push({
        type: "frame",
        rect: usedRect,
        backgroundColor: "transparent",
        borderRadius: 0,
        primarySrc: src,
        primaryMissingReason: String(lightboxState.primaryCard?.missingReason || "Card image unavailable.").trim(),
        overlaySrc: "",
        overlayMissingReason: "",
        primaryRotated: Boolean(isPrimaryRotationActive()),
        overlayRotated: false,
        overlayOpacity: 1
      });
    };
    const pushPanel = (panelEl) => {
      const rect = getVisibleElementRect(panelEl);
      if (!rect) {
        return;
      }

      const sections = extractPanelSections(panelEl);
      if (!sections?.title) {
        return;
      }

      const computedStyle = window.getComputedStyle(panelEl);
      items.push({
        type: "panel",
        rect,
        title: sections.title,
        hint: sections.hint,
        groups: sections.groups,
        backgroundColor: computedStyle.backgroundColor || "rgba(2, 6, 23, 0.86)",
        borderColor: computedStyle.borderColor || "rgba(148, 163, 184, 0.16)",
        borderRadius: getCssPixelNumber(computedStyle.borderTopLeftRadius, 18)
      });
    };

    if (lightboxState.deckCompareMode) {
      const visibleCards = [lightboxState.primaryCard, ...lightboxState.deckCompareCards].filter(Boolean);
      compareGridSlots.forEach((slot, index) => {
        const cardRequest = visibleCards[index] || null;
        const rect = getVisibleElementRect(slot?.slotEl);
        const headerRect = getVisibleElementRect(slot?.headerEl);
        const mediaRect = getVisibleElementRect(slot?.mediaEl);
        if (!cardRequest || !rect) {
          return;
        }
        const usedHeaderRect = headerRect || rect;
        const usedMediaRect = mediaRect || rect;

        items.push({
          type: "deck-card",
          rect,
          headerRect: usedHeaderRect,
          mediaRect: usedMediaRect,
          badge: String(slot.badgeEl?.textContent || cardRequest.deckLabel || "Deck").trim(),
          label: String(slot.cardLabelEl?.textContent || cardRequest.label || "Tarot card").trim(),
          src: resolveCardExportSrc(cardRequest),
          missingReason: String(cardRequest.missingReason || slot.fallbackEl?.textContent || "Card image unavailable.").trim(),
          rotated: Boolean(lightboxState.primaryRotated)
        });
      });
    } else {
      const rect = getVisibleElementRect(frameEl) || getVisibleElementRect(imageEl) || getVisibleElementRect(stageEl);
      const primarySrc = resolveCardExportSrc(
        lightboxState.primaryCard,
        imageEl?.currentSrc || imageEl?.src || ""
      );
      if (rect || primarySrc) {
        const frameStyle = frameEl instanceof HTMLElement ? window.getComputedStyle(frameEl) : null;
        const fallbackWidth = imageEl?.naturalWidth || 520;
        const fallbackHeight = imageEl?.naturalHeight || 780;
        const usedRect = rect || {
          left: 0,
          top: 0,
          right: fallbackWidth,
          bottom: fallbackHeight,
          width: fallbackWidth,
          height: fallbackHeight
        };
        items.push({
          type: "frame",
          rect: usedRect,
          backgroundColor: frameStyle?.backgroundColor || "transparent",
          borderRadius: getCssPixelNumber(frameStyle?.borderTopLeftRadius, 0),
          primarySrc,
          primaryMissingReason: String(lightboxState.primaryCard?.missingReason || "Card image unavailable.").trim(),
          overlaySrc: hasSecondaryCard() && overlayImageEl && window.getComputedStyle(overlayImageEl).display !== "none"
            ? resolveCardExportSrc(
              lightboxState.secondaryCard,
              overlayImageEl.currentSrc || overlayImageEl.src || ""
            )
            : "",
          overlayMissingReason: String(lightboxState.secondaryCard?.missingReason || "Overlay image unavailable.").trim(),
          primaryRotated: Boolean(isPrimaryRotationActive()),
          overlayRotated: Boolean(isOverlayRotationActive()),
          overlayOpacity: Number(lightboxState.overlayOpacity) || LIGHTBOX_COMPARE_DEFAULT_OVERLAY_OPACITY
        });
      }
    }

    pushPanel(primaryInfoEl);
    pushPanel(secondaryInfoEl);
    pushPanel(mobileInfoPanelEl);

    if (!items.length) {
      pushPrimaryFrame();
    }

    if (!items.length) {
      return null;
    }

    const padding = 16;
    const minLeft = Math.min(...items.map((item) => item.rect.left));
    const minTop = Math.min(...items.map((item) => item.rect.top));
    const maxRight = Math.max(...items.map((item) => item.rect.right));
    const maxBottom = Math.max(...items.map((item) => item.rect.bottom));

    return {
      padding,
      minLeft,
      minTop,
      width: Math.max(1, Math.ceil((maxRight - minLeft) + (padding * 2))),
      height: Math.max(1, Math.ceil((maxBottom - minTop) + (padding * 2))),
      items
    };
  }

  function toExportRect(layout, rect) {
    return {
      x: Math.round((rect.left - layout.minLeft) + layout.padding),
      y: Math.round((rect.top - layout.minTop) + layout.padding),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function drawContainedVisual(context, asset, rect, options = {}) {
    const inset = Number(options.inset) || 0;
    const opacity = Number.isFinite(Number(options.opacity)) ? Number(options.opacity) : 1;
    const rotation = options.rotation === 180 ? Math.PI : 0;
    const innerWidth = Math.max(1, rect.width - (inset * 2));
    const innerHeight = Math.max(1, rect.height - (inset * 2));
    const sourceWidth = asset?.width || asset?.naturalWidth || 0;
    const sourceHeight = asset?.height || asset?.naturalHeight || 0;

    if (!sourceWidth || !sourceHeight) {
      return;
    }

    const scale = Math.min(innerWidth / sourceWidth, innerHeight / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = rect.x + inset + ((innerWidth - drawWidth) / 2);
    const drawY = rect.y + inset + ((innerHeight - drawHeight) / 2);

    context.save();
    context.globalAlpha = opacity;
    context.translate(drawX + (drawWidth / 2), drawY + (drawHeight / 2));
    if (rotation) {
      context.rotate(rotation);
    }
    context.drawImage(asset, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
  }

  function drawFallbackText(context, rect, text) {
    context.save();
    drawRoundedRectPath(context, rect.x, rect.y, rect.width, rect.height, 16);
    context.fillStyle = "rgba(15, 23, 42, 0.82)";
    context.fill();
    context.fillStyle = "rgba(226, 232, 240, 0.9)";
    context.font = "600 14px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lines = wrapCanvasText(context, text, Math.max(80, rect.width - 32));
    const lineHeight = 18;
    const startY = rect.y + (rect.height / 2) - (((lines.length - 1) * lineHeight) / 2);
    lines.forEach((line, index) => {
      context.fillText(line, rect.x + (rect.width / 2), startY + (index * lineHeight));
    });
    context.restore();
  }

  function drawPanel(context, item, layout) {
    const rect = toExportRect(layout, item.rect);
    context.save();
    drawRoundedRectPath(context, rect.x, rect.y, rect.width, rect.height, item.borderRadius || 18);
    context.fillStyle = item.backgroundColor || "rgba(2, 6, 23, 0.86)";
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = item.borderColor || "rgba(148, 163, 184, 0.16)";
    context.stroke();

    const contentX = rect.x + 16;
    const contentWidth = Math.max(80, rect.width - 32);
    let cursorY = rect.y + 18;

    context.fillStyle = "#f8fafc";
    context.font = "700 13px sans-serif";
    context.textBaseline = "top";
    wrapCanvasText(context, item.title, contentWidth).forEach((line) => {
      context.fillText(line, contentX, cursorY);
      cursorY += 16;
    });
    cursorY += 6;

    item.groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        context.strokeStyle = "rgba(148, 163, 184, 0.14)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(contentX, cursorY + 2);
        context.lineTo(contentX + contentWidth, cursorY + 2);
        context.stroke();
        cursorY += 10;
      }

      context.fillStyle = "rgba(148, 163, 184, 0.92)";
      context.font = "600 10px sans-serif";
      wrapCanvasText(context, String(group.title || "").toUpperCase(), contentWidth).forEach((line) => {
        context.fillText(line, contentX, cursorY);
        cursorY += 12;
      });
      cursorY += 4;

      context.fillStyle = "#f8fafc";
      context.font = "500 12px sans-serif";
      group.items.forEach((entry) => {
        wrapCanvasText(context, entry, contentWidth).forEach((line) => {
          context.fillText(line, contentX, cursorY);
          cursorY += 16;
        });
      });
      cursorY += 2;
    });

    if (item.hint) {
      cursorY += 4;
      context.fillStyle = "rgba(226, 232, 240, 0.82)";
      context.font = "500 11px sans-serif";
      wrapCanvasText(context, item.hint, contentWidth).forEach((line) => {
        context.fillText(line, contentX, cursorY);
        cursorY += 14;
      });
    }

    context.restore();
  }

  function drawDeckCompareCard(context, item, layout, asset) {
    const slotRect = toExportRect(layout, item.rect);
    const headerRect = toExportRect(layout, item.headerRect);
    const mediaRect = toExportRect(layout, item.mediaRect);

    context.save();
    drawRoundedRectPath(context, slotRect.x, slotRect.y, slotRect.width, slotRect.height, 22);
    context.fillStyle = "rgba(11, 15, 26, 0.76)";
    context.fill();

    drawRoundedRectPath(context, headerRect.x, headerRect.y, headerRect.width, headerRect.height, 0);
    context.fillStyle = "rgba(15, 23, 42, 0.72)";
    context.fill();

    context.fillStyle = "#f8fafc";
    context.font = "700 11px sans-serif";
    context.textBaseline = "top";
    context.fillText(item.badge, headerRect.x + 12, headerRect.y + 10);

    context.fillStyle = "rgba(226, 232, 240, 0.84)";
    context.font = "500 11px sans-serif";
    const labelLines = wrapCanvasText(context, item.label, Math.max(80, headerRect.width - 24));
    const labelText = labelLines.slice(0, 2).join(" ");
    context.fillText(labelText, headerRect.x + 12, headerRect.y + 26);

    if (asset) {
      drawContainedVisual(context, asset, mediaRect, {
        inset: 16,
        rotation: item.rotated ? 180 : 0,
        opacity: 1
      });
    } else {
      drawFallbackText(context, {
        x: mediaRect.x + 16,
        y: mediaRect.y + 16,
        width: Math.max(1, mediaRect.width - 32),
        height: Math.max(1, mediaRect.height - 32)
      }, item.missingReason);
    }

    context.restore();
  }

  function drawFrameVisual(context, item, layout, primaryAsset, overlayAsset) {
    const rect = toExportRect(layout, item.rect);
    context.save();

    if (item.backgroundColor && item.backgroundColor !== "rgba(0, 0, 0, 0)" && item.backgroundColor !== "transparent") {
      drawRoundedRectPath(context, rect.x, rect.y, rect.width, rect.height, item.borderRadius || 0);
      context.fillStyle = item.backgroundColor;
      context.fill();
    }

    if (primaryAsset) {
      drawContainedVisual(context, primaryAsset, rect, {
        inset: 0,
        rotation: item.primaryRotated ? 180 : 0,
        opacity: 1
      });
    } else {
      drawFallbackText(context, rect, item.primaryMissingReason);
    }

    if (overlayAsset) {
      drawContainedVisual(context, overlayAsset, rect, {
        inset: 0,
        rotation: item.overlayRotated ? 180 : 0,
        opacity: item.overlayOpacity
      });
    }

    context.restore();
  }

  function syncExportButton() {
    if (!exportButtonEl) {
      return;
    }

    const canShow = lightboxState.isOpen && !zoomed;
    exportButtonEl.style.display = canShow ? "inline-flex" : "none";
    exportButtonEl.disabled = !canShow || lightboxState.exportInProgress;
    exportButtonEl.textContent = lightboxState.exportInProgress ? "Exporting..." : "Export WebP";
    exportButtonEl.style.opacity = exportButtonEl.disabled ? "0.6" : "1";
    exportButtonEl.style.cursor = exportButtonEl.disabled ? "progress" : "pointer";
  }

  async function exportCurrentLightboxView() {
    if (!lightboxState.isOpen || lightboxState.exportInProgress) {
      return;
    }

    lightboxState.exportInProgress = true;
    syncExportButton();

    try {
      closeSettingsMenu();
      applyComparePresentation();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const layout = buildLightboxExportLayout();
      if (!layout) {
        throw new Error("Lightbox scene is not ready to export.");
      }

      const imageCache = new Map();
      const assetEntries = await Promise.all(layout.items
        .filter((item) => item.type === "frame" || item.type === "deck-card")
        .flatMap((item) => {
          const sources = item.type === "frame"
            ? [item.primarySrc, item.overlaySrc]
            : [item.src];
          return sources.filter(Boolean);
        })
        .map(async (source) => [source, await loadExportImageAsset(hdExportSrc(source), imageCache)]));
      const assetsBySource = new Map(assetEntries);
      const getAsset = (url) => assetsBySource.get(url) || assetsBySource.get(hdExportSrc(url)) || null;

      let scale = Math.max(2, Number(window.devicePixelRatio) || 1);
      layout.items.forEach((item) => {
        const asset = item.type === "frame"
          ? getAsset(item.primarySrc)
          : item.type === "deck-card"
            ? getAsset(item.src)
            : null;
        const nativeWidth = Number(asset?.width || asset?.naturalWidth) || 0;
        const drawWidth = item.type === "deck-card"
          ? (item.mediaRect?.width || item.rect?.width || 0)
          : (item.rect?.width || 0);
        if (nativeWidth && drawWidth) {
          scale = Math.max(scale, nativeWidth / drawWidth);
        }
      });
      const maxDim = 8192;
      if (layout.width * scale > maxDim) {
        scale = maxDim / layout.width;
      }
      if (layout.height * scale > maxDim) {
        scale = maxDim / layout.height;
      }
      scale = Math.max(1, scale);

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(layout.width * scale));
      canvas.height = Math.max(1, Math.ceil(layout.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context is unavailable.");
      }

      context.scale(scale, scale);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = lightboxState.deckCompareMode || lightboxState.compareMode
        ? "rgba(0, 0, 0, 0.88)"
        : "rgba(0, 0, 0, 0.82)";
      context.fillRect(0, 0, layout.width, layout.height);

      layout.items.forEach((item) => {
        if (item.type === "frame") {
          drawFrameVisual(
            context,
            item,
            layout,
            item.primarySrc ? getAsset(item.primarySrc) : null,
            item.overlaySrc ? getAsset(item.overlaySrc) : null
          );
          return;
        }

        if (item.type === "deck-card") {
          drawDeckCompareCard(
            context,
            item,
            layout,
            item.src ? getAsset(item.src) : null
          );
          return;
        }

        if (item.type === "panel") {
          drawPanel(context, item, layout);
        }
      });

      const blob = await canvasToBlobByFormat(canvas, LIGHTBOX_EXPORT_MIME_TYPE, LIGHTBOX_EXPORT_QUALITY);
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      const baseCardToken = sanitizeExportToken(lightboxState.primaryCard?.label || lightboxState.primaryCard?.cardId || "tarot-lightbox", "tarot-lightbox");
      downloadLink.href = blobUrl;
      downloadLink.download = `${baseCardToken}-${stamp}.webp`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.alert(error?.message || "Lightbox export failed.");
    } finally {
      lightboxState.exportInProgress = false;
      syncExportButton();
      restoreLightboxFocus();
    }
  }

  function normalizeCompareDetails(compareDetails) {
    if (!Array.isArray(compareDetails)) {
      return [];
    }

    return compareDetails
      .map((group) => ({
        title: String(group?.title || "").trim(),
        items: Array.isArray(group?.items)
          ? [...new Set(group.items.map((item) => String(item || "").trim()).filter(Boolean))]
          : []
      }))
      .filter((group) => group.title && group.items.length);
  }

  function normalizeOpenRequest(srcOrOptions, altText, extraOptions) {
    if (srcOrOptions && typeof srcOrOptions === "object" && !Array.isArray(srcOrOptions)) {
      return {
        ...srcOrOptions
      };
    }

    return {
      ...(extraOptions || {}),
      src: srcOrOptions,
      altText
    };
  }

  function normalizeCardRequest(request) {
    const normalized = normalizeOpenRequest(request);
    const label = String(normalized.label || normalized.altText || "Tarot card enlarged image").trim() || "Tarot card enlarged image";
    const cardId = String(normalized.cardId || "").trim();
    return {
      src: String(normalized.src || "").trim(),
      previewSrc: String(normalized.previewSrc || "").trim(),
      altText: String(normalized.altText || label).trim() || label,
      label,
      cardId,
      sequenceId: String(normalized.sequenceId || cardId).trim(),
      deckId: String(normalized.deckId || "").trim(),
      deckLabel: String(normalized.deckLabel || normalized.deckId || "").trim(),
      missingReason: String(normalized.missingReason || "").trim(),
      compareDetails: normalizeCompareDetails(normalized.compareDetails)
    };
  }

  function getImageRequestToken(layer = "primary") {
    if (layer === "overlay") {
      overlayImageRequestToken += 1;
      return overlayImageRequestToken;
    }

    primaryImageRequestToken += 1;
    return primaryImageRequestToken;
  }

  function getCurrentImageRequestToken(layer = "primary") {
    return layer === "overlay" ? overlayImageRequestToken : primaryImageRequestToken;
  }

  function applyCardImageToElement(targetImageEl, cardRequest, layer = "primary") {
    if (!(targetImageEl instanceof HTMLImageElement)) {
      return;
    }

    const normalizedCard = normalizeCardRequest(cardRequest);
    const fullSrc = String(normalizedCard.src || "").trim();
    const previewSrc = String(normalizedCard.previewSrc || "").trim();
    const normalizedPreviewSrc = previewSrc && previewSrc !== fullSrc ? previewSrc : "";
    const imageCache = window.TarotCardImages || {};
    const fullImageLoaded = typeof imageCache.isImageLoaded === "function"
      ? imageCache.isImageLoaded(fullSrc)
      : false;
    const requestToken = getImageRequestToken(layer);
    const initialSrc = fullSrc && (!normalizedPreviewSrc || fullImageLoaded)
      ? fullSrc
      : (normalizedPreviewSrc || fullSrc);

    if (initialSrc) {
      targetImageEl.src = initialSrc;
      targetImageEl.alt = normalizedCard.altText;
    } else {
      targetImageEl.removeAttribute("src");
      targetImageEl.alt = normalizedCard.altText;
      return;
    }

    if (!fullSrc || initialSrc === fullSrc || typeof imageCache.ensureImageLoaded !== "function") {
      return;
    }

    imageCache.ensureImageLoaded(fullSrc)
      .then((loadedImage) => {
        if (!loadedImage || getCurrentImageRequestToken(layer) !== requestToken || !lightboxState.isOpen) {
          return;
        }

        if (targetImageEl.src !== fullSrc) {
          targetImageEl.src = fullSrc;
          targetImageEl.alt = normalizedCard.altText;
        }
      })
      .catch(() => {
      });
  }

  function normalizeDeckOptions(deckOptions) {
    if (!Array.isArray(deckOptions)) {
      return [];
    }

    return deckOptions
      .map((deck) => ({
        id: String(deck?.id || "").trim(),
        label: String(deck?.label || deck?.id || "").trim()
      }))
      .filter((deck) => deck.id);
  }

  function getDeckLabel(deckId) {
    const normalizedDeckId = String(deckId || "").trim();
    if (!normalizedDeckId) {
      return "";
    }

    if (normalizedDeckId === lightboxState.activeDeckId && lightboxState.activeDeckLabel) {
      return lightboxState.activeDeckLabel;
    }

    const match = lightboxState.availableCompareDecks.find((deck) => deck.id === normalizedDeckId);
    return match?.label || normalizedDeckId;
  }

  function resolveDeckCardRequest(cardId, deckId) {
    if (!cardId || !deckId || typeof lightboxState.resolveDeckCardById !== "function") {
      return null;
    }

    const resolved = lightboxState.resolveDeckCardById(cardId, deckId);
    if (!resolved) {
      return normalizeCardRequest({
        cardId,
        deckId,
        deckLabel: getDeckLabel(deckId),
        label: lightboxState.primaryCard?.label || "Tarot card",
        altText: lightboxState.primaryCard?.altText || "Tarot card",
        missingReason: "Card image unavailable for this deck."
      });
    }

    return normalizeCardRequest({
      ...resolved,
      cardId,
      deckId,
      deckLabel: resolved.deckLabel || getDeckLabel(deckId)
    });
  }

  function syncDeckCompareCards() {
    if (!lightboxState.deckCompareMode || !lightboxState.primaryCard?.cardId) {
      lightboxState.deckCompareCards = [];
      return;
    }

    const compareDeckLimit = getEffectiveMaxCompareDecks();
    lightboxState.deckCompareCards = lightboxState.selectedCompareDeckIds
      .slice(0, compareDeckLimit)
      .map((deckId) => resolveDeckCardRequest(lightboxState.primaryCard.cardId, deckId))
      .filter(Boolean);

    if (lightboxState.selectedCompareDeckIds.length > compareDeckLimit) {
      lightboxState.selectedCompareDeckIds = lightboxState.selectedCompareDeckIds.slice(0, compareDeckLimit);
    }
  }

  function hasDeckCompareCards() {
    return lightboxState.deckCompareMode && lightboxState.deckCompareCards.length > 0;
  }

  function restoreLightboxFocus() {
    if (!overlayEl || !lightboxState.isOpen) {
      return;
    }

    requestAnimationFrame(() => {
      if (overlayEl && lightboxState.isOpen) {
        overlayEl.focus({ preventScroll: true });
      }
    });
  }

  function resolveCardRequestById(sequenceId) {
    if (!sequenceId || typeof lightboxState.resolveCardById !== "function") {
      return null;
    }

    const resolved = lightboxState.resolveCardById(sequenceId);
    if (!resolved) {
      return null;
    }

    return normalizeCardRequest({
      ...resolved,
      sequenceId: String(resolved.sequenceId || sequenceId).trim() || String(sequenceId),
      cardId: String(resolved.cardId || sequenceId).trim()
    });
  }

  function clearSecondaryCard() {
    lightboxState.secondaryCard = null;
    lightboxState.mobileInfoView = "primary";
    if (overlayImageEl) {
      overlayImageEl.removeAttribute("src");
      overlayImageEl.alt = "";
      overlayImageEl.style.display = "none";
    }

    syncComparePanels();
    syncOpacityControl();
  }

  function clearDeckCompareState() {
    lightboxState.deckCompareMode = false;
    lightboxState.selectedCompareDeckIds = [];
    lightboxState.deckCompareCards = [];
    closeDeckComparePanel();
    lightboxState.deckCompareMessage = "";
  }

  function closeDeckComparePanel() {
    lightboxState.deckComparePickerOpen = false;
    if (deckComparePanelEl) {
      deckComparePanelEl.style.display = "none";
    }
    if (deckCompareDeckListEl) {
      deckCompareDeckListEl.replaceChildren();
    }
  }

  function closeSettingsMenu() {
    lightboxState.settingsMenuOpen = false;
    if (settingsPanelEl) {
      settingsPanelEl.style.display = "none";
    }
  }

  function toggleSettingsMenu() {
    if (!lightboxState.isOpen || zoomed) {
      return;
    }

    const nextOpen = !lightboxState.settingsMenuOpen;
    lightboxState.settingsMenuOpen = nextOpen;
    if (nextOpen) {
      lightboxState.helpOpen = false;
      closeDeckComparePanel();
    }
    applyComparePresentation();
  }

  function suppressDeckCompareToggle(durationMs = 400) {
    suppressDeckCompareToggleUntil = Date.now() + Math.max(0, Number(durationMs) || 0);
  }

  function shouldSuppressDeckCompareToggle() {
    return Date.now() < suppressDeckCompareToggleUntil;
  }

  function getSelectableCompareDecks() {
    return lightboxState.availableCompareDecks.filter((deck) => deck.id !== lightboxState.activeDeckId);
  }

  // Stepping through deck variants moves the primary onto another deck, so the
  // compare selection has to follow or you end up comparing a deck with itself.
  // When the primary lands on a deck that is already compared we hand that slot
  // to the deck we just left instead of collapsing out of compare mode.
  function syncActiveDeckFromPrimaryCard() {
    const nextDeckId = String(lightboxState.primaryCard?.deckId || "").trim();
    if (!nextDeckId || nextDeckId === lightboxState.activeDeckId) {
      return false;
    }

    const previousDeckId = lightboxState.activeDeckId;
    lightboxState.activeDeckId = nextDeckId;
    lightboxState.activeDeckLabel = String(lightboxState.primaryCard?.deckLabel || nextDeckId).trim();

    if (!lightboxState.selectedCompareDeckIds.includes(nextDeckId)) {
      return false;
    }

    const canReusePreviousDeck = Boolean(previousDeckId)
      && lightboxState.availableCompareDecks.some((deck) => deck.id === previousDeckId);

    const nextSelection = lightboxState.selectedCompareDeckIds
      .map((deckId) => (deckId === nextDeckId && canReusePreviousDeck ? previousDeckId : deckId))
      .filter((deckId) => deckId !== nextDeckId);

    updateDeckCompareMode(nextSelection);
    return true;
  }

  function updateDeckCompareMode(deckIds, preservePanel = true) {
    const compareDeckLimit = getEffectiveMaxCompareDecks();
    const uniqueDeckIds = [...new Set((Array.isArray(deckIds) ? deckIds : []).map((deckId) => String(deckId || "").trim()).filter(Boolean))]
      .filter((deckId) => deckId !== lightboxState.activeDeckId)
      .slice(0, compareDeckLimit);

    lightboxState.selectedCompareDeckIds = uniqueDeckIds;
    lightboxState.deckCompareMode = uniqueDeckIds.length > 0;
    lightboxState.deckCompareMessage = "";
    setInfoPanelOpen(getPersistedInfoPanelVisibility(), { persist: false });
    lightboxState.mobileInfoView = "primary";

    if (!lightboxState.deckCompareMode) {
      lightboxState.deckCompareCards = [];
      if (!preservePanel) {
        closeDeckComparePanel();
      }
      return;
    }

    lightboxState.compareMode = false;
    clearSecondaryCard();
    syncDeckCompareCards();
  }

  function toggleDeckCompareSelection(deckId) {
    const normalizedDeckId = String(deckId || "").trim();
    if (!normalizedDeckId) {
      return;
    }

    const compareDeckLimit = getEffectiveMaxCompareDecks();

    const nextSelection = [...lightboxState.selectedCompareDeckIds];
    const existingIndex = nextSelection.indexOf(normalizedDeckId);
    if (existingIndex >= 0) {
      nextSelection.splice(existingIndex, 1);
      updateDeckCompareMode(nextSelection);
      suppressDeckCompareToggle();
      // Keep the picker open so several decks can be toggled in one go.
      applyComparePresentation();
      return;
    }

    if (nextSelection.length >= compareDeckLimit) {
      lightboxState.deckCompareMessage = `You can compare up to ${compareDeckLimit} decks at once.`;
      applyComparePresentation();
      return;
    }

    nextSelection.push(normalizedDeckId);
    updateDeckCompareMode(nextSelection);
    suppressDeckCompareToggle();
    // Keep the picker open for multi-select.
    applyComparePresentation();
  }

  function toggleDeckComparePanel() {
    if (!lightboxState.allowDeckCompare) {
      closeSettingsMenu();
      lightboxState.deckComparePickerOpen = true;
      lightboxState.deckCompareMessage = "Add another registered deck to use deck compare.";
      applyComparePresentation();
      return;
    }

    if (lightboxState.deckComparePickerOpen) {
      closeDeckComparePanel();
    } else {
      closeSettingsMenu();
      lightboxState.deckComparePickerOpen = true;
    }
    lightboxState.deckCompareMessage = getSelectableCompareDecks().length
      ? ""
      : "Add another registered deck to use deck compare.";
    applyComparePresentation();
  }

  function setOverlayOpacity(value) {
    const opacity = clampOverlayOpacity(value);
    lightboxState.overlayOpacity = opacity;

    if (overlayImageEl) {
      overlayImageEl.style.opacity = String(opacity);
    }

    if (opacitySliderEl) {
      opacitySliderEl.value = String(Math.round(opacity * 100));
      opacitySliderEl.disabled = !lightboxState.compareMode || !hasSecondaryCard();
    }

    if (opacityValueEl) {
      opacityValueEl.textContent = `${Math.round(opacity * 100)}%`;
    }

    writeStorageValue(LIGHTBOX_OVERLAY_OPACITY_STORAGE_KEY, String(opacity));
    persistLightboxProfileState();
  }

  function getPersistedOverlayOpacity() {
    const numericValue = Number.parseFloat(String(readStorageValue(LIGHTBOX_OVERLAY_OPACITY_STORAGE_KEY) || ""));
    if (!Number.isFinite(numericValue)) {
      return LIGHTBOX_COMPARE_DEFAULT_OVERLAY_OPACITY;
    }
    return clampOverlayOpacity(numericValue);
  }

  function updateImageCursor() {
    const nextCursor = zoomed ? "zoom-out" : "zoom-in";
    if (lightboxState.deckCompareMode) {
      compareGridSlots.forEach((slot) => {
        if (slot?.imageEl) {
          slot.imageEl.style.cursor = nextCursor;
        }
      });
      return;
    }

    if (!imageEl) {
      return;
    }

    imageEl.style.cursor = nextCursor;
  }

  function buildRotationTransform(rotated) {
    return rotated ? "rotate(180deg)" : "rotate(0deg)";
  }

  function isPrimaryRotationActive() {
    return !lightboxState.compareMode && lightboxState.primaryRotated;
  }

  function isOverlayRotationActive() {
    return lightboxState.compareMode && hasSecondaryCard() && lightboxState.overlayRotated;
  }

  function applyTransformOrigins(originX = lightboxState.zoomOriginX, originY = lightboxState.zoomOriginY) {
    const nextOrigin = `${originX}% ${originY}%`;

    if (lightboxState.deckCompareMode) {
      compareGridSlots.forEach((slot) => {
        if (slot?.zoomLayerEl) {
          slot.zoomLayerEl.style.transformOrigin = nextOrigin;
        }
      });
      return;
    }

    if (baseLayerEl) {
      baseLayerEl.style.transformOrigin = nextOrigin;
    }

    if (overlayLayerEl) {
      overlayLayerEl.style.transformOrigin = nextOrigin;
    }
  }

  function applyZoomTransform() {
    const activeZoomScale = zoomed ? lightboxState.zoomScale : 1;
    const showPrimaryRotation = isPrimaryRotationActive();
    const showOverlayRotation = isOverlayRotationActive();

    if (lightboxState.deckCompareMode) {
      compareGridSlots.forEach((slot) => {
        if (!slot?.imageEl || !slot?.zoomLayerEl) {
          return;
        }

        slot.zoomLayerEl.style.transform = `scale(${activeZoomScale})`;
        slot.imageEl.style.transform = buildRotationTransform(lightboxState.primaryRotated);
      });

      applyTransformOrigins();
      updateImageCursor();
      return;
    }

    if (baseLayerEl) {
      baseLayerEl.style.transform = `scale(${activeZoomScale})`;
    }

    if (overlayLayerEl) {
      overlayLayerEl.style.transform = `scale(${activeZoomScale})`;
    }

    if (imageEl) {
      imageEl.style.transform = buildRotationTransform(showPrimaryRotation);
    }

    if (overlayImageEl) {
      overlayImageEl.style.transform = buildRotationTransform(showOverlayRotation);
    }

    applyTransformOrigins();

    updateImageCursor();
  }

  function setZoomScale(value, options = {}) {
    const persist = options.persist !== false;
    const zoomScale = clampZoomScale(value);
    lightboxState.zoomScale = zoomScale;
    if (persist) {
      persistZoomScale();
    }

    if (zoomSliderEl) {
      zoomSliderEl.value = String(Math.round(zoomScale * 100));
    }

    if (zoomValueEl) {
      zoomValueEl.textContent = `${Math.round(zoomScale * 100)}%`;
    }

    if (lightboxState.isOpen) {
      applyComparePresentation();
      return;
    }

    applyZoomTransform();
  }

  function isZoomInKey(event) {
    return event.key === "+"
      || event.key === "="
      || event.code === "NumpadAdd";
  }

  function isZoomOutKey(event) {
    return event.key === "-"
      || event.key === "_"
      || event.code === "NumpadSubtract";
  }

  function isRotateKey(event) {
    return event.code === "KeyR" || String(event.key || "").toLowerCase() === "r";
  }

  function isVariantCycleKey(event) {
    return event.code === "KeyV" || String(event.key || "").toLowerCase() === "v";
  }

  function stepZoom(direction) {
    if (!lightboxState.isOpen) {
      return;
    }

    const activeScale = zoomed ? lightboxState.zoomScale : 1;
    const nextScale = clampZoomScale(activeScale + (direction * LIGHTBOX_ZOOM_STEP));
    zoomed = nextScale > 1;
    setZoomScale(nextScale);

    if (!zoomed && imageEl) {
      lightboxState.zoomOriginX = 50;
      lightboxState.zoomOriginY = 50;
    }

    if (!zoomed && overlayImageEl) {
      lightboxState.zoomOriginX = 50;
      lightboxState.zoomOriginY = 50;
    }
  }

  function isPanUpKey(event) {
    return event.code === "KeyW" || String(event.key || "").toLowerCase() === "w";
  }

  function isPanLeftKey(event) {
    return event.code === "KeyA" || String(event.key || "").toLowerCase() === "a";
  }

  function isPanDownKey(event) {
    return event.code === "KeyS" || String(event.key || "").toLowerCase() === "s";
  }

  function isPanRightKey(event) {
    return event.code === "KeyD" || String(event.key || "").toLowerCase() === "d";
  }

  function stepPan(deltaX, deltaY) {
    if (!lightboxState.isOpen || !zoomed || !imageEl) {
      return;
    }

    lightboxState.zoomOriginX = Math.min(100, Math.max(0, lightboxState.zoomOriginX + deltaX));
    lightboxState.zoomOriginY = Math.min(100, Math.max(0, lightboxState.zoomOriginY + deltaY));
    applyTransformOrigins();
  }

  function toggleRotation() {
    if (!lightboxState.isOpen) {
      return;
    }

    if (lightboxState.deckCompareMode) {
      lightboxState.primaryRotated = !lightboxState.primaryRotated;
      applyZoomTransform();
      return;
    }

    if (lightboxState.compareMode && hasSecondaryCard()) {
      lightboxState.overlayRotated = !lightboxState.overlayRotated;
    } else {
      lightboxState.primaryRotated = !lightboxState.primaryRotated;
    }

    applyZoomTransform();
  }

  function createCompareGroupElement(group) {
    const sectionEl = document.createElement("section");
    sectionEl.style.display = "flex";
    sectionEl.style.flexDirection = "column";
    sectionEl.style.gap = "5px";
    sectionEl.style.paddingTop = "8px";
    sectionEl.style.borderTop = "1px solid rgba(148, 163, 184, 0.14)";

    const titleEl = document.createElement("div");
    titleEl.textContent = group.title;
    titleEl.style.font = "600 10px/1.2 sans-serif";
    titleEl.style.letterSpacing = "0.1em";
    titleEl.style.textTransform = "uppercase";
    titleEl.style.color = "rgba(148, 163, 184, 0.92)";

    const valuesEl = document.createElement("div");
    valuesEl.style.display = "flex";
    valuesEl.style.flexDirection = "column";
    valuesEl.style.gap = "3px";

    group.items.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.textContent = item;
      itemEl.style.font = "500 12px/1.35 sans-serif";
      itemEl.style.color = "#f8fafc";
      valuesEl.appendChild(itemEl);
    });

    sectionEl.append(titleEl, valuesEl);
    return sectionEl;
  }

  function normalizeCompareGroupTitle(title) {
    return String(title || "").trim().toUpperCase();
  }

  function renderDeckCompareInfoPanel(panelEl, titleEl, groupsEl, hintEl, cardRequest, roleLabel, hintText, isVisible, horizontal = false) {
    if (!panelEl || !titleEl || !groupsEl || !hintEl) {
      return;
    }

    if (!isVisible || !cardRequest?.label) {
      panelEl.style.display = "none";
      titleEl.textContent = "";
      hintEl.textContent = "";
      groupsEl.replaceChildren();
      return;
    }

    panelEl.style.display = "flex";
    titleEl.textContent = roleLabel ? `${roleLabel}: ${cardRequest.label}` : cardRequest.label;
    groupsEl.replaceChildren();

    const compareGroups = Array.isArray(cardRequest?.compareDetails) ? cardRequest.compareDetails : [];
    if (compareGroups.length) {
      groupsEl.style.display = horizontal ? "grid" : "flex";
      groupsEl.style.gridTemplateColumns = horizontal ? "repeat(2, minmax(0, 1fr))" : "none";
      groupsEl.style.gridAutoFlow = horizontal ? "row" : "initial";
      groupsEl.style.flexDirection = horizontal ? "row" : "column";
      groupsEl.style.flexWrap = horizontal ? "wrap" : "nowrap";
      groupsEl.style.gap = horizontal ? "10px 14px" : "0";
      groupsEl.style.alignItems = horizontal ? "start" : "stretch";

      compareGroups.forEach((group) => {
        const sectionEl = createCompareGroupElement(group);
        sectionEl.style.minWidth = "0";
        sectionEl.style.width = "100%";
        if (horizontal && normalizeCompareGroupTitle(group.title) === "TETRAGRAMMATON") {
          sectionEl.style.gridColumn = "1 / -1";
        }
        groupsEl.appendChild(sectionEl);
      });
    } else {
      groupsEl.style.display = "flex";
      groupsEl.style.flexDirection = "column";
      groupsEl.style.gap = "0";
      const emptyEl = document.createElement("div");
      emptyEl.textContent = "No compare metadata available.";
      emptyEl.style.font = "500 12px/1.35 sans-serif";
      emptyEl.style.color = "rgba(226, 232, 240, 0.8)";
      groupsEl.appendChild(emptyEl);
    }

    hintEl.textContent = hintText;
    hintEl.style.display = hintText ? "block" : "none";
  }

  function renderComparePanel(panelEl, titleEl, groupsEl, hintEl, cardRequest, roleLabel, hintText, isVisible) {
    if (!panelEl || !titleEl || !groupsEl || !hintEl) {
      return;
    }

    if (!isVisible || !cardRequest?.label) {
      panelEl.style.display = "none";
      titleEl.textContent = "";
      hintEl.textContent = "";
      groupsEl.replaceChildren();
      return;
    }

    panelEl.style.display = "flex";
    titleEl.textContent = roleLabel ? `${roleLabel}: ${cardRequest.label}` : cardRequest.label;
    groupsEl.replaceChildren();

    if (Array.isArray(cardRequest.compareDetails) && cardRequest.compareDetails.length) {
      cardRequest.compareDetails.forEach((group) => {
        groupsEl.appendChild(createCompareGroupElement(group));
      });
    } else {
      const emptyEl = document.createElement("div");
      emptyEl.textContent = "No compare metadata available.";
      emptyEl.style.font = "500 12px/1.35 sans-serif";
      emptyEl.style.color = "rgba(226, 232, 240, 0.8)";
      groupsEl.appendChild(emptyEl);
    }

    hintEl.textContent = hintText;
    hintEl.style.display = hintText ? "block" : "none";
  }

  function renderMobileInfoPanel(cardRequest, roleLabel, hintText, isVisible) {
    renderComparePanel(
      mobileInfoPanelEl,
      mobileInfoTitleEl,
      mobileInfoGroupsEl,
      mobileInfoHintEl,
      cardRequest,
      roleLabel,
      hintText,
      isVisible
    );
  }

  function syncInfoPanelContentLayout(panelEl, groupsEl, hintEl, options = {}) {
    if (!panelEl || !groupsEl || !hintEl) {
      return;
    }

    const horizontal = Boolean(options.horizontal);
    groupsEl.style.display = horizontal ? "grid" : "flex";
    groupsEl.style.gridTemplateColumns = horizontal ? "repeat(auto-fit, minmax(220px, 1fr))" : "none";
    groupsEl.style.flexDirection = horizontal ? "row" : "column";
    groupsEl.style.flexWrap = horizontal ? "wrap" : "nowrap";
    groupsEl.style.gap = horizontal ? "10px 14px" : "0";
    hintEl.style.marginTop = horizontal ? "2px" : "0";

    Array.from(groupsEl.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) {
        return;
      }

      if (child.tagName === "SECTION") {
        child.style.flex = horizontal ? "1 1 auto" : "0 0 auto";
        child.style.minWidth = horizontal ? "0" : "0";
        child.style.paddingTop = horizontal ? "10px" : "8px";
        return;
      }

      child.style.flex = horizontal ? "1 1 100%" : "0 0 auto";
      child.style.minWidth = "0";
    });
  }

  function syncMobileInfoControls() {
    if (!mobileInfoButtonEl || !mobileInfoPrimaryTabEl || !mobileInfoSecondaryTabEl || !mobileInfoPanelEl) {
      return;
    }

    const isCompact = isCompactLightboxLayout();
    const canShowDeckCompareInfo = Boolean(
      lightboxState.isOpen
      && !zoomed
      && lightboxState.deckCompareMode
      && lightboxState.primaryCard?.label
    );
    const canShowOverlayInfo = Boolean(
      lightboxState.isOpen
      && isCompact
      && !zoomed
      && !lightboxState.deckCompareMode
      && lightboxState.allowOverlayCompare
      && lightboxState.primaryCard?.label
    );
    const canShowInfo = canShowDeckCompareInfo || canShowOverlayInfo;
    const hasOverlayInfo = Boolean(lightboxState.compareMode && hasSecondaryCard() && lightboxState.secondaryCard?.label);
    const activeView = getActiveMobileInfoView();

    mobileInfoButtonEl.style.display = canShowInfo ? "inline-flex" : "none";
    mobileInfoButtonEl.textContent = lightboxState.mobileInfoOpen ? "Hide Info" : "Info";
    mobileInfoButtonEl.setAttribute("aria-pressed", lightboxState.mobileInfoOpen ? "true" : "false");

    mobileInfoPrimaryTabEl.style.display = canShowOverlayInfo && lightboxState.mobileInfoOpen && hasOverlayInfo ? "inline-flex" : "none";
    mobileInfoSecondaryTabEl.style.display = canShowOverlayInfo && lightboxState.mobileInfoOpen && hasOverlayInfo ? "inline-flex" : "none";

    mobileInfoPrimaryTabEl.setAttribute("aria-pressed", activeView === "primary" ? "true" : "false");
    mobileInfoSecondaryTabEl.setAttribute("aria-pressed", activeView === "overlay" ? "true" : "false");

    mobileInfoPrimaryTabEl.style.background = activeView === "primary" ? "rgba(51, 65, 85, 0.96)" : "rgba(15, 23, 42, 0.84)";
    mobileInfoSecondaryTabEl.style.background = activeView === "overlay" ? "rgba(51, 65, 85, 0.96)" : "rgba(15, 23, 42, 0.84)";
    mobileInfoPanelEl.style.pointerEvents = canShowInfo && lightboxState.mobileInfoOpen ? "auto" : "none";
  }

  function syncMobileNavigationControls() {
    if (!mobilePrevButtonEl || !mobileNextButtonEl) {
      return;
    }

    const canNavigate = Boolean(
      lightboxState.isOpen
      && isCompactLightboxLayout()
      && !zoomed
      && !lightboxState.deckComparePickerOpen
      && hasSequenceNavigation()
    );
    const isCompact = isCompactLightboxLayout();
    const previousLabel = lightboxState.compareMode
      ? "Previous overlay card"
      : (lightboxState.deckCompareMode ? "Previous compared card" : "Previous card");
    const nextLabel = lightboxState.compareMode
      ? "Next overlay card"
      : (lightboxState.deckCompareMode ? "Next compared card" : "Next card");

    mobilePrevButtonEl.style.display = canNavigate ? "inline-flex" : "none";
    mobileNextButtonEl.style.display = canNavigate ? "inline-flex" : "none";
    mobilePrevButtonEl.setAttribute("aria-label", previousLabel);
    mobileNextButtonEl.setAttribute("aria-label", nextLabel);
    mobilePrevButtonEl.style.width = isCompact ? "60px" : "44px";
    mobileNextButtonEl.style.width = isCompact ? "60px" : "44px";
    mobilePrevButtonEl.style.height = isCompact ? "60px" : "44px";
    mobileNextButtonEl.style.height = isCompact ? "60px" : "44px";
    mobilePrevButtonEl.style.font = isCompact ? "800 26px/1 sans-serif" : "700 20px/1 sans-serif";
    mobileNextButtonEl.style.font = isCompact ? "800 26px/1 sans-serif" : "700 20px/1 sans-serif";

    if (isCompact && canNavigate && toolbarEl instanceof HTMLElement) {
      toolbarEl.style.display = "grid";
      toolbarEl.style.gridTemplateColumns = "60px minmax(0, auto) 60px";
      toolbarEl.style.columnGap = "12px";
      toolbarEl.style.justifyContent = "stretch";
      toolbarEl.style.justifyItems = "center";
      toolbarEl.style.alignItems = "center";

      if (mobilePrevButtonEl.parentElement !== toolbarEl) {
        toolbarEl.insertBefore(mobilePrevButtonEl, settingsButtonEl || null);
      }

      if (mobileNextButtonEl.parentElement !== toolbarEl) {
        toolbarEl.appendChild(mobileNextButtonEl);
      }

      if (settingsButtonEl instanceof HTMLElement) {
        settingsButtonEl.style.gridColumn = "2";
        settingsButtonEl.style.justifySelf = "center";
      }

      mobilePrevButtonEl.style.position = "relative";
      mobileNextButtonEl.style.position = "relative";
      mobilePrevButtonEl.style.top = "auto";
      mobileNextButtonEl.style.top = "auto";
      mobilePrevButtonEl.style.right = "auto";
      mobileNextButtonEl.style.right = "auto";
      mobilePrevButtonEl.style.left = "auto";
      mobileNextButtonEl.style.left = "auto";
      mobilePrevButtonEl.style.bottom = "auto";
      mobileNextButtonEl.style.bottom = "auto";
      mobilePrevButtonEl.style.gridColumn = "1";
      mobileNextButtonEl.style.gridColumn = "3";
      mobilePrevButtonEl.style.justifySelf = "start";
      mobileNextButtonEl.style.justifySelf = "end";
      mobilePrevButtonEl.style.alignSelf = "center";
      mobileNextButtonEl.style.alignSelf = "center";
      mobilePrevButtonEl.style.transform = "none";
      mobileNextButtonEl.style.transform = "none";
      return;
    }

    if (mobilePrevButtonEl.parentElement !== overlayEl) {
      overlayEl.appendChild(mobilePrevButtonEl);
    }

    if (mobileNextButtonEl.parentElement !== overlayEl) {
      overlayEl.appendChild(mobileNextButtonEl);
    }

    if (toolbarEl instanceof HTMLElement) {
      toolbarEl.style.gridTemplateColumns = "";
      toolbarEl.style.columnGap = "";
      toolbarEl.style.justifyItems = "";
    }

    if (settingsButtonEl instanceof HTMLElement) {
      settingsButtonEl.style.gridColumn = "";
      settingsButtonEl.style.justifySelf = "";
    }

    if (!canNavigate) {
      mobilePrevButtonEl.style.position = "fixed";
      mobileNextButtonEl.style.position = "fixed";
      return;
    }

    const toolbarBottom = isCompact
      ? "calc(12px + env(safe-area-inset-bottom, 0px))"
      : null;
    const mobileInfoPanelVisible = Boolean(
      lightboxState.mobileInfoOpen
      && mobileInfoPanelEl
      && mobileInfoPanelEl.style.display !== "none"
    );
    const settingsPanelVisible = Boolean(
      lightboxState.settingsMenuOpen
      && settingsPanelEl
      && settingsPanelEl.style.display !== "none"
    );
    const helpPanelVisible = Boolean(
      lightboxState.helpOpen
      && helpPanelEl
      && helpPanelEl.style.display !== "none"
    );
    const deckPickerVisible = Boolean(
      lightboxState.deckComparePickerOpen
      && deckComparePanelEl
      && deckComparePanelEl.style.display !== "none"
    );
    const toolbarHeight = toolbarEl instanceof HTMLElement && toolbarEl.style.display !== "none"
      ? toolbarEl.offsetHeight
      : 0;
    const infoPanelHeight = mobileInfoPanelVisible && mobileInfoPanelEl instanceof HTMLElement
      ? mobileInfoPanelEl.offsetHeight
      : 0;
    const floatingPanelHeight = Math.max(
      settingsPanelVisible && settingsPanelEl instanceof HTMLElement ? settingsPanelEl.offsetHeight + 12 : 0,
      helpPanelVisible && helpPanelEl instanceof HTMLElement ? helpPanelEl.offsetHeight + 12 : 0,
      deckPickerVisible && deckComparePanelEl instanceof HTMLElement ? deckComparePanelEl.offsetHeight + 12 : 0
    );
    const bottomOffset = isCompact
      ? toolbarBottom
      : `${toolbarHeight + floatingPanelHeight + (mobileInfoPanelVisible ? infoPanelHeight + 32 : 24)}px`;

    mobilePrevButtonEl.style.position = "fixed";
    mobileNextButtonEl.style.position = "fixed";
    mobilePrevButtonEl.style.top = "auto";
    mobileNextButtonEl.style.top = "auto";
    mobilePrevButtonEl.style.bottom = isCompact ? bottomOffset : bottomOffset;
    mobileNextButtonEl.style.bottom = isCompact ? bottomOffset : bottomOffset;
    mobilePrevButtonEl.style.transform = "none";
    mobileNextButtonEl.style.transform = "none";
  }

  function syncComparePanels() {
    if (lightboxState.deckCompareMode) {
      const isCompact = isCompactLightboxLayout();
      const sharedHint = isCompact
        ? "Use the side arrows to move through compared decks."
        : "Shared card info for all compared decks.";
      const showDesktopPanel = Boolean(
        !isCompact
        && lightboxState.isOpen
        && lightboxState.mobileInfoOpen
        && lightboxState.primaryCard?.label
        && !zoomed
      );
      const showMobilePanel = Boolean(
        isCompact
        && lightboxState.isOpen
        && lightboxState.mobileInfoOpen
        && lightboxState.primaryCard?.label
        && !zoomed
      );

      renderDeckCompareInfoPanel(
        primaryInfoEl,
        primaryTitleEl,
        primaryGroupsEl,
        primaryHintEl,
        lightboxState.primaryCard,
        "Card",
        sharedHint,
        showDesktopPanel,
        true
      );
      renderComparePanel(secondaryInfoEl, secondaryTitleEl, secondaryGroupsEl, secondaryHintEl, null, "", "", false);
      renderDeckCompareInfoPanel(
        mobileInfoPanelEl,
        mobileInfoTitleEl,
        mobileInfoGroupsEl,
        mobileInfoHintEl,
        lightboxState.primaryCard,
        "Card",
        sharedHint,
        showMobilePanel,
        false
      );
      return;
    }

    syncInfoPanelContentLayout(primaryInfoEl, primaryGroupsEl, primaryHintEl, {
      horizontal: false
    });
    syncInfoPanelContentLayout(secondaryInfoEl, secondaryGroupsEl, secondaryHintEl, {
      horizontal: false
    });
    syncInfoPanelContentLayout(mobileInfoPanelEl, mobileInfoGroupsEl, mobileInfoHintEl, {
      horizontal: false
    });

    const isCompact = isCompactLightboxLayout();
    const isComparing = lightboxState.compareMode;
    const overlaySelected = hasSecondaryCard();
    const primaryHint = isComparing
      ? (overlaySelected
        ? "Use the side arrows to move through the overlaid card."
        : "Use the side arrows to pick the first overlay card.")
      : "Use the side arrows to move through cards. Tap Overlay to compare.";
    const secondaryHint = overlaySelected ? "Use the side arrows to swap the overlay card." : "";
    const showPrimaryPanel = Boolean(
      !isCompact
      && lightboxState.isOpen
      && lightboxState.allowOverlayCompare
      && lightboxState.primaryCard?.label
      && !zoomed
    );
    const showSecondaryPanel = Boolean(
      !isCompact
      && isComparing
      && overlaySelected
      && lightboxState.secondaryCard?.label
      && !zoomed
    );

    renderComparePanel(
      primaryInfoEl,
      primaryTitleEl,
      primaryGroupsEl,
      primaryHintEl,
      lightboxState.primaryCard,
      "Base",
      primaryHint,
      showPrimaryPanel
    );

    renderComparePanel(
      secondaryInfoEl,
      secondaryTitleEl,
      secondaryGroupsEl,
      secondaryHintEl,
      lightboxState.secondaryCard,
      "Overlay",
      secondaryHint,
      showSecondaryPanel
    );

    if (!isCompact) {
      renderMobileInfoPanel(null, "", "", false);
      return;
    }

    const activeView = getActiveMobileInfoView();
    const mobileCard = activeView === "overlay" ? lightboxState.secondaryCard : lightboxState.primaryCard;
    const mobileRole = activeView === "overlay" ? "Overlay" : (isComparing ? "Base" : "Card");
    const mobileHint = activeView === "overlay" ? secondaryHint : primaryHint;
    const showMobileInfo = Boolean(
      lightboxState.isOpen
      && lightboxState.mobileInfoOpen
      && !zoomed
      && lightboxState.allowOverlayCompare
      && mobileCard?.label
    );

    renderMobileInfoPanel(mobileCard, mobileRole, mobileHint, showMobileInfo);
  }

  function syncOpacityControl() {
    if (!opacityControlEl) {
      return;
    }

    if (lightboxState.deckCompareMode) {
      opacityControlEl.style.display = "none";
      return;
    }

    opacityControlEl.style.display = lightboxState.compareMode && hasSecondaryCard() && !zoomed ? "flex" : "none";
    setOverlayOpacity(lightboxState.overlayOpacity);
  }

  function syncSettingsUi() {
    if (!settingsButtonEl || !settingsPanelEl) {
      return;
    }

    const canShow = lightboxState.isOpen && !zoomed;
    settingsButtonEl.style.display = canShow ? "inline-flex" : "none";
    settingsButtonEl.textContent = lightboxState.settingsMenuOpen ? "Hide Settings" : "Settings";
    settingsButtonEl.setAttribute("aria-expanded", canShow && lightboxState.settingsMenuOpen ? "true" : "false");
    settingsPanelEl.style.display = canShow && lightboxState.settingsMenuOpen ? "flex" : "none";
    settingsPanelEl.style.pointerEvents = canShow && lightboxState.settingsMenuOpen ? "auto" : "none";
  }

  function syncNotesButton() {
    if (!notesControlEl) {
      return;
    }

    const isSingleCard = lightboxState.isOpen
      && !zoomed
      && !lightboxState.compareMode
      && !lightboxState.deckCompareMode
      && Boolean(lightboxState.primaryCard?.cardId);

    if (!isSingleCard) {
      notesControlEl.style.display = "none";
      lastNotesCardId = "";
      return;
    }

    const cardId = String(lightboxState.primaryCard.cardId || "").trim();
    if (!cardId) {
      notesControlEl.style.display = "none";
      lastNotesCardId = "";
      return;
    }

    notesControlEl.style.display = "block";
    if (cardId === lastNotesCardId) {
      return;
    }

    lastNotesCardId = cardId;
    window.KabbakLibraryMarks?.attachControls?.(notesControlEl, {
      type: "tarot",
      key: cardId,
      title: String(lightboxState.primaryCard.label || cardId),
      meta: { cardId }
    });
  }

  function syncDeckComparePicker() {
    if (!deckCompareButtonEl || !deckComparePanelEl || !deckCompareMessageEl || !deckCompareDeckListEl) {
      return;
    }

    const canShowButton = lightboxState.isOpen && !zoomed && !lightboxState.compareMode;
    deckCompareButtonEl.style.display = canShowButton && lightboxState.allowDeckCompare
      ? "inline-flex"
      : "none";
    deckCompareButtonEl.textContent = lightboxState.selectedCompareDeckIds.length
      ? `Compare (${lightboxState.selectedCompareDeckIds.length})`
      : "Compare";
    deckCompareButtonEl.classList.toggle("is-active", lightboxState.deckCompareMode);
    deckCompareButtonEl.setAttribute("aria-pressed", lightboxState.deckComparePickerOpen ? "true" : "false");

    if (!lightboxState.deckComparePickerOpen || zoomed || lightboxState.compareMode) {
      deckComparePanelEl.style.display = "none";
      deckCompareDeckListEl.replaceChildren();
      return;
    }

    deckComparePanelEl.style.display = "flex";
    const selectableDecks = getSelectableCompareDecks();
    deckCompareMessageEl.textContent = lightboxState.deckCompareMessage
      || (selectableDecks.length
        ? getCompareDeckLimitMessage()
        : "Add another registered deck to use deck compare.");

    deckCompareDeckListEl.replaceChildren();

    if (!selectableDecks.length) {
      return;
    }

    selectableDecks.forEach((deck) => {
      const isSelected = lightboxState.selectedCompareDeckIds.includes(deck.id);
      const isDisabled = !isSelected && lightboxState.selectedCompareDeckIds.length >= getEffectiveMaxCompareDecks();
      const deckButtonEl = document.createElement("button");
      deckButtonEl.type = "button";
      deckButtonEl.textContent = deck.label;
      deckButtonEl.disabled = isDisabled;
      deckButtonEl.setAttribute("aria-pressed", isSelected ? "true" : "false");
      deckButtonEl.style.padding = "10px 12px";
      deckButtonEl.style.borderRadius = "12px";
      deckButtonEl.style.border = isSelected
        ? "1px solid rgba(148, 163, 184, 0.7)"
        : "1px solid rgba(148, 163, 184, 0.22)";
      deckButtonEl.style.background = isSelected ? "rgba(30, 41, 59, 0.92)" : "rgba(15, 23, 42, 0.58)";
      deckButtonEl.style.color = isDisabled ? "rgba(148, 163, 184, 0.52)" : "#f8fafc";
      deckButtonEl.style.cursor = isDisabled ? "not-allowed" : "pointer";
      deckButtonEl.style.font = "600 12px/1.3 sans-serif";
      deckButtonEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleDeckCompareSelection(deck.id);
        restoreLightboxFocus();
      });
      deckCompareDeckListEl.appendChild(deckButtonEl);
    });

    if (lightboxState.selectedCompareDeckIds.length) {
      const clearButtonEl = document.createElement("button");
      clearButtonEl.type = "button";
      clearButtonEl.textContent = "Clear Compare";
      clearButtonEl.style.marginTop = "4px";
      clearButtonEl.style.padding = "9px 12px";
      clearButtonEl.style.borderRadius = "12px";
      clearButtonEl.style.border = "1px solid rgba(248, 250, 252, 0.16)";
      clearButtonEl.style.background = "rgba(15, 23, 42, 0.44)";
      clearButtonEl.style.color = "rgba(248, 250, 252, 0.92)";
      clearButtonEl.style.cursor = "pointer";
      clearButtonEl.style.font = "600 12px/1.3 sans-serif";
      clearButtonEl.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        updateDeckCompareMode([]);
        suppressDeckCompareToggle();
        closeDeckComparePanel();
        applyComparePresentation();
        restoreLightboxFocus();
      });
      deckCompareDeckListEl.appendChild(clearButtonEl);
    }
  }

  function resolveSlotVariants(cardRequest) {
    if (!cardRequest?.cardId || typeof lightboxState.resolveCardVariants !== "function") {
      return [];
    }

    const variants = lightboxState.resolveCardVariants(cardRequest.cardId, String(cardRequest.deckId || "").trim());
    return Array.isArray(variants)
      ? variants
        .map((variant) => ({
          src: String(variant?.src || "").trim(),
          previewSrc: String(variant?.previewSrc || variant?.src || "").trim()
        }))
        .filter((variant) => variant.src)
      : [];
  }

  function syncSlotVariant(slot) {
    if (!slot) {
      return;
    }

    const variants = Array.isArray(slot.variants) ? slot.variants : [];
    const index = slot.variantIndex || 0;
    const activeVariant = variants[index];
    if (activeVariant?.src) {
      slot.imageEl.src = activeVariant.src;
    }
    if (slot.variantCounterEl) {
      slot.variantCounterEl.textContent = `${index + 1} / ${variants.length}`;
    }
  }

  function stepSlotVariant(slot, direction) {
    if (!slot) {
      return;
    }

    const variants = Array.isArray(slot.variants) ? slot.variants : [];
    if (variants.length < 2) {
      return;
    }

    slot.variantIndex = ((slot.variantIndex || 0) + direction + variants.length) % variants.length;
    syncSlotVariant(slot);
  }

  function renderDeckCompareGrid() {
    if (!compareGridEl || !compareGridSlots.length) {
      return;
    }

    const isCompact = isCompactLightboxLayout();

    syncDeckCompareCards();

    if (!lightboxState.deckCompareMode) {
      compareGridEl.style.display = "none";
      compareGridSlots.forEach((slot) => {
        slot.slotEl.style.display = "none";
        slot.imageEl.removeAttribute("src");
        slot.imageEl.alt = "Tarot compare image";
        if (slot.zoomLayerEl) {
          slot.zoomLayerEl.style.display = "none";
        }
        if (slot.variantEl) {
          slot.variantEl.style.display = "none";
        }
        slot.imageEl.style.display = "none";
        slot.fallbackEl.style.display = "none";
      });
      return;
    }

    const visibleCards = [lightboxState.primaryCard, ...lightboxState.deckCompareCards].filter(Boolean);
    const cardCount = Math.max(1, visibleCards.length);
    compareGridEl.style.display = "grid";
    compareGridEl.style.gap = isCompact ? "6px" : "8px";
    compareGridEl.style.padding = isCompact
      ? (lightboxState.mobileInfoOpen ? "18px 12px 260px" : "8px 6px 88px")
      : "12px 12px 12px";
    if (isCompact) {
      const compactColumns = 2;
      const compactRows = cardCount > 2 ? 2 : 1;
      const compactGap = 6;
      const paddingX = lightboxState.mobileInfoOpen ? 24 : 12;
      const paddingY = lightboxState.mobileInfoOpen ? 278 : 96;
      const availableWidth = Math.max(80, compareGridEl.clientWidth - paddingX);
      const availableHeight = Math.max(140, compareGridEl.clientHeight - paddingY);
      const cellWidth = (availableWidth - compactGap * (compactColumns - 1)) / compactColumns;
      const cellHeight = (availableHeight - compactGap * (compactRows - 1)) / compactRows;
      const cardWidth = Math.min(cellWidth, cellHeight * (2 / 3), compactRows === 1 ? 220 : cellWidth);
      const cardHeight = cardWidth * (3 / 2);
      compareGridEl.style.gridTemplateColumns = `repeat(${compactColumns}, minmax(0, ${cardWidth}px))`;
      compareGridEl.style.gridTemplateRows = `repeat(${compactRows}, minmax(0, ${cardHeight}px))`;
      compareGridEl.style.justifyContent = "center";
      compareGridEl.style.alignItems = "stretch";
      compareGridEl.style.alignContent = "center";
    } else {
      // Size columns to the contained card (2:3) so the cards sit tight side by
      // side and fill the height instead of floating in over-wide columns. The
      // info panel floats on top, so it never affects card spacing.
      const availableHeight = Math.max(140, compareGridEl.clientHeight - 24);
      const cardWidth = availableHeight * (2 / 3);
      compareGridEl.style.gridTemplateColumns = `repeat(${cardCount}, minmax(0, ${cardWidth}px))`;
      compareGridEl.style.gridTemplateRows = "none";
      compareGridEl.style.justifyContent = "center";
      compareGridEl.style.alignItems = "stretch";
      compareGridEl.style.alignContent = "stretch";
    }

    compareGridSlots.forEach((slot, index) => {
      const cardRequest = visibleCards[index] || null;
      if (!cardRequest) {
        slot.slotEl.style.display = "none";
        slot.imageEl.removeAttribute("src");
        if (slot.zoomLayerEl) {
          slot.zoomLayerEl.style.display = "none";
        }
        if (slot.variantEl) {
          slot.variantEl.style.display = "none";
        }
        slot.imageEl.style.display = "none";
        slot.fallbackEl.style.display = "none";
        return;
      }

      slot.slotEl.style.display = "flex";
      slot.slotEl.style.width = "100%";
      slot.slotEl.style.height = "100%";
      slot.slotEl.style.maxWidth = "none";
      slot.slotEl.style.justifySelf = "stretch";
      slot.slotEl.style.alignSelf = "stretch";
      slot.slotEl.style.borderRadius = isCompact ? "12px" : "10px";
      slot.slotEl.style.background = isCompact ? "rgba(11, 15, 26, 0.6)" : "transparent";
      slot.slotEl.style.border = isCompact ? "1px solid rgba(148, 163, 184, 0.12)" : "1px solid rgba(148, 163, 184, 0.1)";
      slot.slotEl.style.boxShadow = isCompact ? "0 8px 18px rgba(0, 0, 0, 0.22)" : "none";
      slot.headerEl.style.display = "none";
      slot.headerEl.style.padding = isCompact ? "6px 8px" : "10px 12px";
      slot.headerEl.style.gap = isCompact ? "4px" : "10px";
      slot.badgeEl.style.font = isCompact ? "700 9px/1.15 sans-serif" : "700 11px/1.2 sans-serif";
      slot.cardLabelEl.style.font = isCompact ? "500 9px/1.2 sans-serif" : "500 11px/1.3 sans-serif";
      slot.mediaEl.style.flex = "1 1 auto";
      slot.mediaEl.style.minHeight = "0";
      slot.mediaEl.style.aspectRatio = "auto";
      slot.mediaEl.style.padding = isCompact ? "4px" : "0px";
      slot.zoomLayerEl.style.inset = isCompact ? "4px" : "0px";
      slot.fallbackEl.style.maxWidth = isCompact ? "100%" : "260px";
      slot.fallbackEl.style.padding = isCompact ? "12px 8px" : "16px";
      slot.badgeEl.textContent = cardRequest.deckLabel || (index === 0 ? "Active Deck" : "Compare Deck");
      slot.cardLabelEl.textContent = cardRequest.label || "Tarot card";

      slot.variants = resolveSlotVariants(cardRequest);
      const cardKey = `${String(cardRequest.cardId || "")}|${String(cardRequest.deckId || "").trim().toLowerCase()}`;
      if (slot.cardKey !== cardKey) {
        slot.cardKey = cardKey;
        slot.variantIndex = 0;
      } else if (slot.variantIndex >= slot.variants.length) {
        slot.variantIndex = 0;
      }

      if (slot.variants.length > 0) {
        syncSlotVariant(slot);
        slot.imageEl.alt = cardRequest.altText || cardRequest.label || "Tarot compare image";
        if (slot.zoomLayerEl) {
          slot.zoomLayerEl.style.display = "flex";
        }
        slot.imageEl.style.display = "block";
        slot.fallbackEl.style.display = "none";
      } else if (cardRequest.src) {
        slot.imageEl.src = cardRequest.src;
        slot.imageEl.alt = cardRequest.altText || cardRequest.label || "Tarot compare image";
        if (slot.zoomLayerEl) {
          slot.zoomLayerEl.style.display = "flex";
        }
        slot.imageEl.style.display = "block";
        slot.fallbackEl.style.display = "none";
      } else {
        slot.imageEl.removeAttribute("src");
        slot.imageEl.alt = "";
        if (slot.zoomLayerEl) {
          slot.zoomLayerEl.style.display = "none";
        }
        slot.imageEl.style.display = "none";
        slot.fallbackEl.textContent = cardRequest.missingReason || "Card image unavailable for this deck.";
        slot.fallbackEl.style.display = "block";
      }

      if (slot.variantEl) {
        slot.variantEl.style.display = slot.variants.length > 1 ? "inline-flex" : "none";
      }
    });

    applyZoomTransform();
  }

  function syncHelpUi() {
    if (!helpButtonEl || !helpPanelEl) {
      return;
    }

    syncHelpContent();

    const canShow = lightboxState.isOpen && !zoomed;
    helpButtonEl.style.display = canShow ? "inline-flex" : "none";
    helpPanelEl.style.display = canShow && lightboxState.helpOpen ? "flex" : "none";
    helpButtonEl.textContent = lightboxState.helpOpen ? "Hide Help" : "Help";
  }

  function syncZoomControl() {
    if (!zoomControlEl) {
      return;
    }

    zoomControlEl.style.display = lightboxState.isOpen && !zoomed ? "flex" : "none";
    if (zoomSliderEl) {
      zoomSliderEl.value = String(Math.round(lightboxState.zoomScale * 100));
    }

    if (zoomValueEl) {
      zoomValueEl.textContent = `${Math.round(lightboxState.zoomScale * 100)}%`;
    }
  }

  function syncPrimaryVariants() {
    const card = lightboxState.primaryCard;
    const rawVariants = (card?.cardId && typeof lightboxState.resolveCardVariants === "function")
      ? lightboxState.resolveCardVariants(card.cardId, String(card.deckId || "").trim())
      : [];

    lightboxState.primaryVariants = Array.isArray(rawVariants)
      ? rawVariants
        .map((variant) => ({
          src: String(variant?.src || "").trim(),
          previewSrc: String(variant?.previewSrc || variant?.src || "").trim()
        }))
        .filter((variant) => variant.src)
      : [];
    lightboxState.primaryVariantIndex = 0;
    syncVariantSwitcher();
  }

  function syncVariantSwitcher() {
    if (!variantSwitcherEl || !variantCounterEl || !variantPrevButtonEl || !variantNextButtonEl) {
      return;
    }

    const variants = Array.isArray(lightboxState.primaryVariants) ? lightboxState.primaryVariants : [];
    const showSwitcher = variants.length > 1
      && lightboxState.isOpen
      && !zoomed
      && !lightboxState.deckCompareMode;

    variantSwitcherEl.style.display = showSwitcher ? "inline-flex" : "none";
    if (!showSwitcher) {
      return;
    }

    const index = lightboxState.primaryVariantIndex || 0;
    variantCounterEl.textContent = `${index + 1} / ${variants.length}`;
    variantPrevButtonEl.disabled = false;
    variantNextButtonEl.disabled = false;
  }

  function stepPrimaryVariant(direction) {
    const variants = Array.isArray(lightboxState.primaryVariants) ? lightboxState.primaryVariants : [];
    if (variants.length < 2 || !lightboxState.primaryCard) {
      return;
    }

    const nextIndex = (lightboxState.primaryVariantIndex + direction + variants.length) % variants.length;
    lightboxState.primaryVariantIndex = nextIndex;

    const activeVariant = variants[nextIndex];
    if (activeVariant?.src) {
      lightboxState.primaryCard.src = activeVariant.src;
      lightboxState.primaryCard.previewSrc = activeVariant.previewSrc || activeVariant.src;
      applyCardImageToElement(imageEl, lightboxState.primaryCard, "primary");
      resetZoom();
    }

    syncVariantSwitcher();
  }

  function applyComparePresentation() {
    if (!overlayEl || !backdropEl || !toolbarEl || !stageEl || !frameEl || !imageEl || !overlayImageEl || !compareButtonEl || !deckCompareButtonEl) {
      return;
    }

    const isCompact = isCompactLightboxLayout();
    syncVariantSwitcher();

    if (!isCompact) {
      settingsPanelEl.style.top = "72px";
      settingsPanelEl.style.right = "24px";
      settingsPanelEl.style.bottom = "auto";
      settingsPanelEl.style.left = "auto";
      settingsPanelEl.style.width = "min(320px, calc(100vw - 48px))";
      settingsPanelEl.style.maxHeight = "none";
      settingsPanelEl.style.overflowY = "visible";
      helpPanelEl.style.top = "72px";
      helpPanelEl.style.right = "24px";
      helpPanelEl.style.bottom = "auto";
      helpPanelEl.style.left = "auto";
      helpPanelEl.style.width = "min(320px, calc(100vw - 48px))";
      helpPanelEl.style.maxHeight = "none";
      helpPanelEl.style.overflowY = "visible";
      deckComparePanelEl.style.top = "72px";
      deckComparePanelEl.style.right = "24px";
      deckComparePanelEl.style.bottom = "auto";
      deckComparePanelEl.style.left = "auto";
      deckComparePanelEl.style.width = "min(280px, calc(100vw - 48px))";
      deckComparePanelEl.style.maxHeight = "none";
      deckComparePanelEl.style.overflowY = "visible";
    }

    // Overlay and Compare are mutually exclusive: hide Overlay while the deck
    // compare grid is active. Use style.display because an inline display would
    // otherwise override the [hidden] attribute.
    const showOverlayButton = !(
      zoomed
      || !lightboxState.allowOverlayCompare
      || lightboxState.deckCompareMode
      || (!isCompact && lightboxState.compareMode && !hasSecondaryCard())
    );
    compareButtonEl.hidden = !showOverlayButton;
    compareButtonEl.style.display = showOverlayButton ? "inline-flex" : "none";
    compareButtonEl.textContent = lightboxState.compareMode ? "Done Overlay" : "Overlay";
    compareButtonEl.classList.toggle("is-active", lightboxState.compareMode);
    syncSettingsUi();
    syncNotesButton();
    syncHelpUi();
    syncZoomControl();
    syncExportButton();
    syncOpacityControl();
    syncDeckComparePicker();
    syncComparePanels();
    syncMobileInfoControls();

    if (lightboxState.deckCompareMode) {
      overlayEl.style.pointerEvents = "none";
      backdropEl.style.display = "block";
      backdropEl.style.pointerEvents = "auto";
      backdropEl.style.background = "";
      toolbarEl.style.top = isCompact ? "auto" : "24px";
      toolbarEl.style.right = isCompact ? "12px" : "24px";
      toolbarEl.style.bottom = isCompact ? "calc(12px + env(safe-area-inset-bottom, 0px))" : "auto";
      toolbarEl.style.left = isCompact ? "12px" : "auto";
      toolbarEl.style.flexDirection = isCompact ? "row" : "column";
      toolbarEl.style.flexWrap = isCompact ? "wrap" : "nowrap";
      toolbarEl.style.alignItems = isCompact ? "center" : "flex-end";
      toolbarEl.style.justifyContent = isCompact ? "center" : "flex-start";
      stageEl.style.top = "0";
      stageEl.style.right = "0";
      stageEl.style.bottom = "0";
      stageEl.style.left = "0";
      stageEl.style.display = "block";
      stageEl.style.alignItems = "stretch";
      stageEl.style.justifyContent = "stretch";
      stageEl.style.width = "auto";
      stageEl.style.height = "auto";
      stageEl.style.transform = "none";
      stageEl.style.pointerEvents = "auto";
      compareGridEl.style.padding = isCompact
        ? (lightboxState.mobileInfoOpen ? "18px 12px 260px" : "18px 12px 84px")
        : "12px 12px 12px";
      frameEl.style.display = "none";
      primaryInfoEl.style.left = "50%";
      primaryInfoEl.style.right = "auto";
      primaryInfoEl.style.top = "auto";
      primaryInfoEl.style.bottom = "18px";
      primaryInfoEl.style.width = "min(620px, calc(100vw - 48px))";
      primaryInfoEl.style.maxHeight = "min(40vh, 360px)";
      primaryInfoEl.style.transform = "translateX(-50%)";
      secondaryInfoEl.style.display = "none";
      if (mobileInfoPanelEl && !isCompact) {
        mobileInfoPanelEl.style.display = "none";
      }
      syncMobileNavigationControls();
      renderDeckCompareGrid();
      return;
    }

    frameEl.style.display = "block";
    compareGridEl.style.display = "none";

    if (isCompact) {
      overlayEl.style.pointerEvents = "none";
      backdropEl.style.display = "block";
      backdropEl.style.pointerEvents = "auto";
      backdropEl.style.background = "";
      toolbarEl.style.top = "auto";
      toolbarEl.style.right = "12px";
      toolbarEl.style.bottom = "calc(12px + env(safe-area-inset-bottom, 0px))";
      toolbarEl.style.left = "12px";
      toolbarEl.style.flexDirection = "row";
      toolbarEl.style.flexWrap = "wrap";
      toolbarEl.style.alignItems = "center";
      toolbarEl.style.justifyContent = "center";
      settingsPanelEl.style.top = "auto";
      settingsPanelEl.style.right = "12px";
      settingsPanelEl.style.bottom = "calc(72px + env(safe-area-inset-bottom, 0px))";
      settingsPanelEl.style.left = "12px";
      settingsPanelEl.style.width = "auto";
      settingsPanelEl.style.maxHeight = "min(56svh, 440px)";
      settingsPanelEl.style.overflowY = "auto";
      helpPanelEl.style.top = "auto";
      helpPanelEl.style.right = "12px";
      helpPanelEl.style.bottom = "calc(72px + env(safe-area-inset-bottom, 0px))";
      helpPanelEl.style.left = "12px";
      helpPanelEl.style.width = "auto";
      helpPanelEl.style.maxHeight = "min(42svh, 360px)";
      helpPanelEl.style.overflowY = "auto";
      deckComparePanelEl.style.top = "auto";
      deckComparePanelEl.style.right = "12px";
      deckComparePanelEl.style.bottom = "calc(72px + env(safe-area-inset-bottom, 0px))";
      deckComparePanelEl.style.left = "12px";
      deckComparePanelEl.style.width = "auto";
      deckComparePanelEl.style.maxHeight = "min(42svh, 360px)";
      deckComparePanelEl.style.overflowY = "auto";
      stageEl.style.top = "calc(12px + env(safe-area-inset-top, 0px))";
      stageEl.style.right = "12px";
      stageEl.style.bottom = "calc(84px + env(safe-area-inset-bottom, 0px))";
      stageEl.style.left = "12px";
      stageEl.style.display = "flex";
      stageEl.style.alignItems = "center";
      stageEl.style.justifyContent = "center";
      stageEl.style.width = "auto";
      stageEl.style.height = "auto";
      stageEl.style.transform = "none";
      stageEl.style.pointerEvents = "auto";
      frameEl.style.position = "relative";
      frameEl.style.width = "min(100%, 520px)";
      frameEl.style.height = "100%";
      frameEl.style.maxWidth = "520px";
      frameEl.style.maxHeight = "100%";
      frameEl.style.borderRadius = zoomed && hasSecondaryCard() ? "0" : "24px";
      frameEl.style.background = zoomed && hasSecondaryCard() ? "transparent" : "rgba(11, 15, 26, 0.92)";
      frameEl.style.boxShadow = zoomed && hasSecondaryCard() ? "none" : "0 24px 64px rgba(0, 0, 0, 0.44)";
      frameEl.style.overflow = "hidden";
      imageEl.style.width = "100%";
      imageEl.style.height = "100%";
      imageEl.style.maxWidth = "none";
      imageEl.style.maxHeight = "none";
      imageEl.style.objectFit = "contain";
      overlayImageEl.style.display = hasSecondaryCard() ? "block" : "none";
      primaryInfoEl.style.maxHeight = "min(78vh, 760px)";
      primaryInfoEl.style.display = "none";
      secondaryInfoEl.style.display = "none";
      applyZoomTransform();
      setOverlayOpacity(lightboxState.overlayOpacity);
      syncMobileNavigationControls();
      return;
    }

    if (!lightboxState.compareMode) {
      overlayEl.style.pointerEvents = "none";
      backdropEl.style.display = "block";
      backdropEl.style.pointerEvents = "auto";
      backdropEl.style.background = "";
      toolbarEl.style.top = "24px";
      toolbarEl.style.right = "24px";
      toolbarEl.style.bottom = "auto";
      toolbarEl.style.left = "auto";
      toolbarEl.style.flexDirection = "column";
      toolbarEl.style.flexWrap = "nowrap";
      toolbarEl.style.alignItems = "flex-end";
      toolbarEl.style.justifyContent = "flex-start";
      stageEl.style.top = "0";
      stageEl.style.right = "0";
      stageEl.style.bottom = "0";
      stageEl.style.left = "0";
      stageEl.style.display = "block";
      stageEl.style.alignItems = "stretch";
      stageEl.style.justifyContent = "stretch";
      stageEl.style.width = "auto";
      stageEl.style.height = "auto";
      stageEl.style.transform = "none";
      stageEl.style.pointerEvents = "auto";
      frameEl.style.position = "relative";
      frameEl.style.width = "100%";
      frameEl.style.height = "100%";
      frameEl.style.maxWidth = "none";
      frameEl.style.maxHeight = "none";
      frameEl.style.borderRadius = "0";
      frameEl.style.background = "transparent";
      frameEl.style.boxShadow = "none";
      frameEl.style.overflow = "hidden";
      primaryInfoEl.style.left = "auto";
      primaryInfoEl.style.right = "18px";
      primaryInfoEl.style.top = "50%";
      primaryInfoEl.style.bottom = "auto";
      primaryInfoEl.style.width = "clamp(220px, 20vw, 320px)";
      primaryInfoEl.style.maxHeight = "min(78vh, 760px)";
      primaryInfoEl.style.transform = "translateY(-50%)";
      imageEl.style.width = "100%";
      imageEl.style.height = "100%";
      imageEl.style.maxWidth = "none";
      imageEl.style.maxHeight = "none";
      imageEl.style.objectFit = "contain";
      overlayImageEl.style.display = "none";
      secondaryInfoEl.style.display = "none";
      applyZoomTransform();
      syncMobileNavigationControls();
      return;
    }

    overlayEl.style.pointerEvents = "none";
    backdropEl.style.display = "none";
    backdropEl.style.pointerEvents = "none";
    toolbarEl.style.top = "18px";
    toolbarEl.style.right = "18px";
    toolbarEl.style.bottom = "auto";
    toolbarEl.style.left = "auto";
    toolbarEl.style.flexDirection = "column";
    toolbarEl.style.flexWrap = "nowrap";
    toolbarEl.style.alignItems = "flex-end";
    toolbarEl.style.justifyContent = "flex-start";
    stageEl.style.display = "block";
    stageEl.style.alignItems = "stretch";
    stageEl.style.justifyContent = "stretch";
    stageEl.style.pointerEvents = "auto";
    frameEl.style.position = "relative";
    frameEl.style.width = "100%";
    frameEl.style.height = "100%";
    frameEl.style.maxWidth = "none";
    frameEl.style.maxHeight = "none";
    frameEl.style.overflow = "hidden";
    imageEl.style.width = "100%";
    imageEl.style.height = "100%";
    imageEl.style.maxWidth = "none";
    imageEl.style.maxHeight = "none";
    imageEl.style.objectFit = "contain";
    updateImageCursor();

    if (zoomed && hasSecondaryCard()) {
      stageEl.style.top = "0";
      stageEl.style.right = "0";
      stageEl.style.bottom = "0";
      stageEl.style.left = "0";
      stageEl.style.width = "auto";
      stageEl.style.height = "auto";
      stageEl.style.transform = "none";
      frameEl.style.borderRadius = "0";
      frameEl.style.background = "transparent";
      frameEl.style.boxShadow = "none";
    } else if (!hasSecondaryCard()) {
      stageEl.style.top = "auto";
      stageEl.style.right = "18px";
      stageEl.style.bottom = "18px";
      stageEl.style.left = "auto";
      stageEl.style.width = "clamp(180px, 18vw, 280px)";
      stageEl.style.height = "min(44vh, 520px)";
      stageEl.style.transform = "none";
      frameEl.style.borderRadius = "22px";
      frameEl.style.background = "rgba(13, 13, 20, 0.9)";
      frameEl.style.boxShadow = "0 24px 64px rgba(0, 0, 0, 0.5)";
      primaryInfoEl.style.left = "auto";
      primaryInfoEl.style.right = "calc(100% + 16px)";
      primaryInfoEl.style.top = "50%";
      primaryInfoEl.style.bottom = "auto";
      primaryInfoEl.style.width = "clamp(220px, 22vw, 320px)";
      primaryInfoEl.style.maxHeight = "min(78vh, 760px)";
      primaryInfoEl.style.transform = "translateY(-50%)";
    } else {
      stageEl.style.top = "50%";
      stageEl.style.right = "auto";
      stageEl.style.bottom = "auto";
      stageEl.style.left = "50%";
      stageEl.style.width = "min(44vw, 560px)";
      stageEl.style.height = "min(92vh, 1400px)";
      stageEl.style.transform = "translate(-50%, -50%)";
      frameEl.style.borderRadius = "28px";
      frameEl.style.background = "rgba(11, 15, 26, 0.88)";
      frameEl.style.boxShadow = "0 30px 90px rgba(0, 0, 0, 0.56)";
      primaryInfoEl.style.left = "auto";
      primaryInfoEl.style.right = "calc(100% + 10px)";
      primaryInfoEl.style.top = "50%";
      primaryInfoEl.style.bottom = "auto";
      primaryInfoEl.style.width = "clamp(180px, 15vw, 220px)";
      primaryInfoEl.style.maxHeight = "min(78vh, 760px)";
      primaryInfoEl.style.transform = "translateY(-50%)";
      secondaryInfoEl.style.left = "calc(100% + 10px)";
      secondaryInfoEl.style.right = "auto";
      secondaryInfoEl.style.top = "50%";
      secondaryInfoEl.style.bottom = "auto";
      secondaryInfoEl.style.width = "clamp(180px, 15vw, 220px)";
      secondaryInfoEl.style.transform = "translateY(-50%)";
    }

    if (hasSecondaryCard()) {
      overlayImageEl.style.display = "block";
    } else {
      overlayImageEl.style.display = "none";
      secondaryInfoEl.style.display = "none";
    }

    applyZoomTransform();
    setOverlayOpacity(lightboxState.overlayOpacity);
    syncMobileNavigationControls();
  }

  function resetZoom() {
    if (!imageEl && !overlayImageEl) {
      return;
    }

    clearActivePointerGesture();
    clearActivePinchGesture();
    suppressNextCardClick = false;
    lightboxState.zoomOriginX = 50;
    lightboxState.zoomOriginY = 50;
    applyTransformOrigins();

    zoomed = false;
    applyZoomTransform();
  }

  function updateZoomOrigin(clientX, clientY, targetImage = imageEl, targetFrame = null) {
    const referenceEl = targetFrame || targetImage;
    if (!zoomed || !referenceEl) {
      return;
    }

    const rect = referenceEl.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    lightboxState.zoomOriginX = x;
    lightboxState.zoomOriginY = y;
    applyTransformOrigins();
  }

  function handleCompactPointerDown(event) {
    if (!shouldHandleCompactPointerGesture(event)) {
      return false;
    }

    activePointerId = event.pointerId;
    activePointerStartX = Number(event.clientX) || 0;
    activePointerStartY = Number(event.clientY) || 0;
    activePointerMoved = false;

    if (zoomed) {
      event.preventDefault();
    }

    return true;
  }

  function handleCompactPointerMove(event, targetImage = imageEl, targetFrame = null) {
    if (!shouldHandleCompactPointerGesture(event) || event.pointerId !== activePointerId || !zoomed) {
      return;
    }

    const deltaX = Math.abs((Number(event.clientX) || 0) - activePointerStartX);
    const deltaY = Math.abs((Number(event.clientY) || 0) - activePointerStartY);
    if (!activePointerMoved && Math.max(deltaX, deltaY) < 6) {
      event.preventDefault();
      return;
    }

    activePointerMoved = true;
    suppressNextCardClick = true;
    event.preventDefault();
    updateZoomOrigin(event.clientX, event.clientY, targetImage, targetFrame);
  }

  function handleCompactPointerEnd(event, targetImage = imageEl) {
    if (!shouldHandleCompactPointerGesture(event) || event.pointerId !== activePointerId) {
      return;
    }

    if (activePointerMoved) {
      suppressNextCardClick = true;
    }

    if (typeof targetImage?.releasePointerCapture === "function" && targetImage.hasPointerCapture?.(event.pointerId)) {
      targetImage.releasePointerCapture(event.pointerId);
    }

    clearActivePointerGesture();
  }

  function handleCompactPinchStart(event, targetImage = imageEl, targetFrame = null) {
    if (!lightboxState.isOpen || !isCompactLightboxLayout() || !targetImage || event.touches.length < 2) {
      return false;
    }

    const midpoint = getTouchMidpoint(event.touches);
    const distance = getTouchDistance(event.touches);
    if (!midpoint || !(distance > 0)) {
      return false;
    }

    clearActivePointerGesture();
    activePinchGesture = {
      targetImage,
      targetFrame,
      startDistance: distance,
      startScale: zoomed ? lightboxState.zoomScale : 1
    };
    suppressNextCardClick = true;
    event.preventDefault();
    return true;
  }

  function handleCompactPinchMove(event) {
    if (!activePinchGesture || event.touches.length < 2) {
      return false;
    }

    const midpoint = getTouchMidpoint(event.touches);
    const distance = getTouchDistance(event.touches);
    if (!midpoint || !(distance > 0)) {
      return false;
    }

    const nextScale = clampZoomScale(activePinchGesture.startScale * (distance / activePinchGesture.startDistance));
    zoomed = nextScale > 1;
    setZoomScale(nextScale, { persist: false });
    if (zoomed) {
      updateZoomOrigin(midpoint.x, midpoint.y, activePinchGesture.targetImage, activePinchGesture.targetFrame);
    } else {
      lightboxState.zoomOriginX = 50;
      lightboxState.zoomOriginY = 50;
      applyTransformOrigins();
    }

    suppressNextCardClick = true;
    event.preventDefault();
    return true;
  }

  function handleCompactPinchEnd(event) {
    if (!activePinchGesture) {
      return false;
    }

    if (event.touches.length >= 2) {
      const targetImage = activePinchGesture.targetImage;
      const targetFrame = activePinchGesture.targetFrame;
      clearActivePinchGesture();
      handleCompactPinchStart(event, targetImage, targetFrame);
      return true;
    }

    clearActivePinchGesture();
    return true;
  }

  function preventCompactTouchScroll(event) {
    if (!lightboxState.isOpen || !isCompactLightboxLayout() || (!zoomed && !activePinchGesture)) {
      return;
    }

    event.preventDefault();
  }

  function preventBrowserZoomGesture(event) {
    if (!lightboxState.isOpen) {
      return;
    }

    if (event.type === "wheel" && !event.ctrlKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  function isPointOnCard(clientX, clientY, targetImage = imageEl, targetFrame = null) {
    const frameElForHitTest = targetFrame || targetImage;
    if (!targetImage || !frameElForHitTest) {
      return false;
    }

    const rect = frameElForHitTest.getBoundingClientRect();
    const naturalWidth = targetImage.naturalWidth;
    const naturalHeight = targetImage.naturalHeight;

    if (!rect.width || !rect.height || !naturalWidth || !naturalHeight) {
      return true;
    }

    const frameAspect = rect.width / rect.height;
    const imageAspect = naturalWidth / naturalHeight;

    let renderWidth = rect.width;
    let renderHeight = rect.height;
    if (imageAspect > frameAspect) {
      renderHeight = rect.width / imageAspect;
    } else {
      renderWidth = rect.height * imageAspect;
    }

    const left = rect.left + (rect.width - renderWidth) / 2;
    const top = rect.top + (rect.height - renderHeight) / 2;
    const right = left + renderWidth;
    const bottom = top + renderHeight;

    return clientX >= left && clientX <= right && clientY >= top && clientY <= bottom;
  }

  function ensure() {
    if (overlayEl && imageEl && overlayImageEl) {
      return;
    }

    overlayEl = document.createElement("div");
    overlayEl.setAttribute("aria-hidden", "true");
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.tabIndex = -1;
    overlayEl.style.position = "fixed";
    overlayEl.style.inset = "0";
    overlayEl.style.display = "none";
    overlayEl.style.zIndex = "9999";
    overlayEl.style.pointerEvents = "none";
    overlayEl.style.overscrollBehavior = "contain";

    settingsButtonEl = document.createElement("button");
    settingsButtonEl.type = "button";
    settingsButtonEl.textContent = "Settings";
    settingsButtonEl.className = "tt-lb-btn";
    settingsButtonEl.style.display = "none";

    helpButtonEl = document.createElement("button");
    helpButtonEl.type = "button";
    helpButtonEl.textContent = "Help";
    helpButtonEl.className = "tt-lb-btn";
    helpButtonEl.style.display = "none";

    settingsPanelEl = document.createElement("div");
    settingsPanelEl.className = "tt-lb-panel";
    settingsPanelEl.style.position = "fixed";
    settingsPanelEl.style.top = "72px";
    settingsPanelEl.style.right = "24px";
    settingsPanelEl.style.display = "none";
    settingsPanelEl.style.flexDirection = "column";
    settingsPanelEl.style.gap = "8px";
    settingsPanelEl.style.width = "min(320px, calc(100vw - 48px))";
    settingsPanelEl.style.padding = "10px";
    settingsPanelEl.style.pointerEvents = "auto";
    settingsPanelEl.style.zIndex = "3";

    const settingsTitleEl = document.createElement("div");
    settingsTitleEl.textContent = "Lightbox Settings";
    settingsTitleEl.style.font = "700 12px/1.3 sans-serif";
    settingsTitleEl.style.color = "var(--tt-text-muted)";
    settingsTitleEl.style.textTransform = "uppercase";
    settingsTitleEl.style.letterSpacing = "0.06em";

    helpPanelEl = document.createElement("div");
    helpPanelEl.className = "tt-lb-panel";
    helpPanelEl.style.position = "fixed";
    helpPanelEl.style.top = "72px";
    helpPanelEl.style.left = "24px";
    helpPanelEl.style.display = "none";
    helpPanelEl.style.flexDirection = "column";
    helpPanelEl.style.gap = "8px";
    helpPanelEl.style.width = "min(320px, calc(100vw - 48px))";
    helpPanelEl.style.padding = "14px 16px";
    helpPanelEl.style.pointerEvents = "auto";
    helpPanelEl.style.zIndex = "2";

    helpTitleEl = document.createElement("div");
    helpTitleEl.textContent = "Lightbox Shortcuts";
    helpTitleEl.style.font = "700 13px/1.3 sans-serif";

    helpListEl = document.createElement("div");
    helpListEl.style.display = "flex";
    helpListEl.style.flexDirection = "column";
    helpListEl.style.gap = "6px";
    helpListEl.style.font = "500 12px/1.4 sans-serif";
    helpListEl.style.color = "rgba(226, 232, 240, 0.92)";

    syncHelpContent();

    helpPanelEl.append(helpTitleEl, helpListEl);

    backdropEl = document.createElement("button");
    backdropEl.type = "button";
    backdropEl.setAttribute("aria-label", "Close enlarged tarot card");
    backdropEl.style.position = "absolute";
    backdropEl.style.inset = "0";
    backdropEl.style.border = "none";
    backdropEl.style.padding = "0";
    backdropEl.style.margin = "0";
    backdropEl.className = "tarot-lightbox-backdrop";
    backdropEl.style.cursor = "pointer";

    toolbarEl = document.createElement("div");
    toolbarEl.style.position = "fixed";
    toolbarEl.style.top = "24px";
    toolbarEl.style.right = "24px";
    toolbarEl.style.display = "flex";
    toolbarEl.style.flexDirection = "column";
    toolbarEl.style.alignItems = "flex-end";
    toolbarEl.style.gap = "8px";
    toolbarEl.style.pointerEvents = "auto";
    toolbarEl.style.zIndex = "2";

    compareButtonEl = document.createElement("button");
    compareButtonEl.type = "button";
    compareButtonEl.textContent = "Overlay";
    compareButtonEl.className = "tt-lb-btn";

    deckCompareButtonEl = document.createElement("button");
    deckCompareButtonEl.type = "button";
    deckCompareButtonEl.textContent = "Compare";
    deckCompareButtonEl.className = "tt-lb-btn";

    zoomControlEl = document.createElement("label");
    zoomControlEl.className = "tt-lb-control";

    const zoomTextEl = document.createElement("span");
    zoomTextEl.textContent = "Zoom";

    zoomSliderEl = document.createElement("input");
    zoomSliderEl.type = "range";
    zoomSliderEl.min = "100";
    zoomSliderEl.max = String(Math.round(LIGHTBOX_ZOOM_SCALE * 100));
    zoomSliderEl.step = "10";
    zoomSliderEl.value = String(Math.round(LIGHTBOX_ZOOM_SCALE * 100));

    zoomValueEl = document.createElement("span");
    zoomValueEl.className = "tt-lb-value";
    zoomValueEl.textContent = `${Math.round(LIGHTBOX_ZOOM_SCALE * 100)}%`;

    zoomControlEl.append(zoomTextEl, zoomSliderEl, zoomValueEl);

    opacityControlEl = document.createElement("label");
    opacityControlEl.className = "tt-lb-control";
    opacityControlEl.style.display = "none";

    const opacityTextEl = document.createElement("span");
    opacityTextEl.textContent = "Opacity";

    opacitySliderEl = document.createElement("input");
    opacitySliderEl.type = "range";
    opacitySliderEl.min = "5";
    opacitySliderEl.max = "100";
    opacitySliderEl.step = "5";
    opacitySliderEl.value = String(Math.round(LIGHTBOX_COMPARE_DEFAULT_OVERLAY_OPACITY * 100));

    opacityValueEl = document.createElement("span");
    opacityValueEl.className = "tt-lb-value";
    opacityValueEl.textContent = `${Math.round(LIGHTBOX_COMPARE_DEFAULT_OVERLAY_OPACITY * 100)}%`;

    opacityControlEl.append(opacityTextEl, opacitySliderEl, opacityValueEl);

    exportButtonEl = document.createElement("button");
    exportButtonEl.type = "button";
    exportButtonEl.textContent = "Export WebP";
    exportButtonEl.className = "tt-lb-btn";
    exportButtonEl.style.display = "none";

    const closeLightboxButtonEl = document.createElement("button");
    closeLightboxButtonEl.type = "button";
    closeLightboxButtonEl.textContent = "Close";
    closeLightboxButtonEl.className = "tt-lb-btn is-danger";

    deckComparePanelEl = document.createElement("div");
    deckComparePanelEl.className = "tt-lb-panel";
    deckComparePanelEl.style.position = "fixed";
    deckComparePanelEl.style.top = "24px";
    deckComparePanelEl.style.right = "176px";
    deckComparePanelEl.style.display = "none";
    deckComparePanelEl.style.flexDirection = "column";
    deckComparePanelEl.style.gap = "10px";
    deckComparePanelEl.style.width = "min(280px, calc(100vw - 48px))";
    deckComparePanelEl.style.padding = "14px 16px";
    deckComparePanelEl.style.pointerEvents = "auto";
    deckComparePanelEl.style.touchAction = "manipulation";
    deckComparePanelEl.style.zIndex = "2";

    const deckCompareHeaderEl = document.createElement("div");
    deckCompareHeaderEl.style.display = "flex";
    deckCompareHeaderEl.style.alignItems = "center";
    deckCompareHeaderEl.style.justifyContent = "space-between";
    deckCompareHeaderEl.style.gap = "10px";

    const deckCompareTitleEl = document.createElement("div");
    deckCompareTitleEl.textContent = "Compare Registered Decks";
    deckCompareTitleEl.style.font = "700 13px/1.3 sans-serif";

    const deckCompareCloseButtonEl = document.createElement("button");
    deckCompareCloseButtonEl.type = "button";
    deckCompareCloseButtonEl.textContent = "Close";
    deckCompareCloseButtonEl.className = "tt-lb-btn";

    deckCompareHeaderEl.append(deckCompareTitleEl, deckCompareCloseButtonEl);

    deckCompareMessageEl = document.createElement("div");
    deckCompareMessageEl.style.font = "500 12px/1.4 sans-serif";
    deckCompareMessageEl.style.color = "rgba(226, 232, 240, 0.84)";

    deckCompareDeckListEl = document.createElement("div");
    deckCompareDeckListEl.style.display = "flex";
    deckCompareDeckListEl.style.flexDirection = "column";
    deckCompareDeckListEl.style.gap = "8px";

    deckComparePanelEl.append(deckCompareHeaderEl, deckCompareMessageEl, deckCompareDeckListEl);

    mobileInfoButtonEl = document.createElement("button");
    mobileInfoButtonEl.type = "button";
    mobileInfoButtonEl.textContent = "Info";
    mobileInfoButtonEl.className = "tt-lb-btn";
    mobileInfoButtonEl.style.display = "none";

    mobileInfoPrimaryTabEl = document.createElement("button");
    mobileInfoPrimaryTabEl.type = "button";
    mobileInfoPrimaryTabEl.textContent = "Base";
    mobileInfoPrimaryTabEl.className = "tt-lb-btn";
    mobileInfoPrimaryTabEl.style.display = "none";

    mobileInfoSecondaryTabEl = document.createElement("button");
    mobileInfoSecondaryTabEl.type = "button";
    mobileInfoSecondaryTabEl.textContent = "Overlay";
    mobileInfoSecondaryTabEl.className = "tt-lb-btn";
    mobileInfoSecondaryTabEl.style.display = "none";

    notesControlEl = document.createElement("div");
    notesControlEl.style.display = "none";
    notesControlEl.style.width = "100%";

    const infoRowEl = document.createElement("div");
    infoRowEl.className = "tt-lb-row";
    infoRowEl.append(mobileInfoButtonEl, helpButtonEl, exportButtonEl, closeLightboxButtonEl);

    const mobileInfoTabsRowEl = document.createElement("div");
    mobileInfoTabsRowEl.className = "tt-lb-row";
    mobileInfoTabsRowEl.append(mobileInfoPrimaryTabEl, mobileInfoSecondaryTabEl);

    const compareRowEl = document.createElement("div");
    compareRowEl.className = "tt-lb-row";
    compareRowEl.append(deckCompareButtonEl, compareButtonEl);

    const viewRowEl = document.createElement("div");
    viewRowEl.className = "tt-lb-row";
    viewRowEl.append(zoomControlEl, opacityControlEl);

    settingsPanelEl.append(
      settingsTitleEl,
      infoRowEl,
      mobileInfoTabsRowEl,
      compareRowEl,
      viewRowEl,
      notesControlEl
    );
    toolbarEl.append(settingsButtonEl);

    stageEl = document.createElement("div");
    stageEl.style.position = "fixed";
    stageEl.style.top = "0";
    stageEl.style.right = "0";
    stageEl.style.bottom = "0";
    stageEl.style.left = "0";
    stageEl.style.pointerEvents = "auto";
    stageEl.style.overflow = "visible";
    stageEl.style.overscrollBehavior = "contain";
    stageEl.style.transition = "top 220ms ease, right 220ms ease, bottom 220ms ease, left 220ms ease, width 220ms ease, height 220ms ease, transform 220ms ease";
    stageEl.style.transform = "none";
    stageEl.style.zIndex = "1";

    frameEl = document.createElement("div");
    frameEl.style.position = "relative";
    frameEl.style.width = "100%";
    frameEl.style.height = "100%";
    frameEl.style.overflow = "hidden";
    frameEl.style.touchAction = "none";
    frameEl.style.overscrollBehavior = "contain";
    frameEl.style.transition = "border-radius 220ms ease, background 220ms ease, box-shadow 220ms ease";

    baseLayerEl = document.createElement("div");
    baseLayerEl.style.position = "absolute";
    baseLayerEl.style.inset = "0";
    baseLayerEl.style.transform = "scale(1)";
    baseLayerEl.style.transformOrigin = "50% 50%";
    baseLayerEl.style.transition = "transform 120ms ease-out";

    overlayLayerEl = document.createElement("div");
    overlayLayerEl.style.position = "absolute";
    overlayLayerEl.style.inset = "0";
    overlayLayerEl.style.transform = "scale(1)";
    overlayLayerEl.style.transformOrigin = "50% 50%";
    overlayLayerEl.style.transition = "transform 120ms ease-out";
    overlayLayerEl.style.pointerEvents = "none";

    compareGridEl = document.createElement("div");
    compareGridEl.style.position = "absolute";
    compareGridEl.style.inset = "0";
    compareGridEl.style.display = "none";
    compareGridEl.style.gridTemplateColumns = "repeat(1, minmax(0, 1fr))";
    compareGridEl.style.gap = "14px";
    compareGridEl.style.alignItems = "stretch";
    compareGridEl.style.padding = "76px 24px 24px";
    compareGridEl.style.boxSizing = "border-box";

    function createCompareGridSlot() {
      const slotEl = document.createElement("div");
      slotEl.style.display = "none";
      slotEl.style.flexDirection = "column";
      slotEl.style.minWidth = "0";
      slotEl.style.minHeight = "0";
      slotEl.style.borderRadius = "22px";
      slotEl.style.background = "rgba(11, 15, 26, 0.76)";
      slotEl.style.border = "1px solid rgba(148, 163, 184, 0.12)";
      slotEl.style.boxShadow = "0 24px 64px rgba(0, 0, 0, 0.36)";
      slotEl.style.overflow = "hidden";

      const headerEl = document.createElement("div");
      headerEl.style.display = "flex";
      headerEl.style.alignItems = "center";
      headerEl.style.justifyContent = "space-between";
      headerEl.style.gap = "10px";
      headerEl.style.padding = "10px 12px";
      headerEl.style.background = "rgba(15, 23, 42, 0.72)";
      headerEl.style.borderBottom = "1px solid rgba(148, 163, 184, 0.1)";

      const badgeEl = document.createElement("span");
      badgeEl.style.font = "700 11px/1.2 sans-serif";
      badgeEl.style.letterSpacing = "0.08em";
      badgeEl.style.textTransform = "uppercase";
      badgeEl.style.color = "#f8fafc";

      const cardLabelEl = document.createElement("span");
      cardLabelEl.style.font = "500 11px/1.3 sans-serif";
      cardLabelEl.style.color = "rgba(226, 232, 240, 0.84)";
      cardLabelEl.style.textAlign = "right";
      cardLabelEl.style.whiteSpace = "nowrap";
      cardLabelEl.style.overflow = "hidden";
      cardLabelEl.style.textOverflow = "ellipsis";

      headerEl.append(badgeEl, cardLabelEl);

      const mediaEl = document.createElement("div");
      mediaEl.style.position = "relative";
      mediaEl.style.flex = "1 1 auto";
      mediaEl.style.minHeight = "0";
      mediaEl.style.display = "flex";
      mediaEl.style.alignItems = "center";
      mediaEl.style.justifyContent = "center";
      mediaEl.style.padding = "16px";
      mediaEl.style.background = "rgba(2, 6, 23, 0.4)";
      mediaEl.style.overflow = "hidden";
      mediaEl.style.touchAction = "none";
      mediaEl.style.overscrollBehavior = "contain";

      const zoomLayerEl = document.createElement("div");
      zoomLayerEl.style.position = "absolute";
      zoomLayerEl.style.inset = "16px";
      zoomLayerEl.style.display = "flex";
      zoomLayerEl.style.alignItems = "center";
      zoomLayerEl.style.justifyContent = "center";
      zoomLayerEl.style.transform = "scale(1)";
      zoomLayerEl.style.transformOrigin = "50% 50%";
      zoomLayerEl.style.transition = "transform 120ms ease-out";

      const compareImageEl = document.createElement("img");
      compareImageEl.alt = "Tarot compare image";
      compareImageEl.style.width = "100%";
      compareImageEl.style.height = "100%";
      compareImageEl.style.objectFit = "contain";
      compareImageEl.style.cursor = "zoom-in";
      compareImageEl.style.transform = "rotate(0deg)";
      compareImageEl.style.transformOrigin = "center center";
      compareImageEl.style.transition = "transform 120ms ease-out";
      compareImageEl.style.touchAction = "none";
      compareImageEl.style.userSelect = "none";

      const fallbackEl = document.createElement("div");
      fallbackEl.style.display = "none";
      fallbackEl.style.maxWidth = "260px";
      fallbackEl.style.padding = "16px";
      fallbackEl.style.textAlign = "center";
      fallbackEl.style.font = "600 13px/1.45 sans-serif";
      fallbackEl.style.color = "rgba(226, 232, 240, 0.88)";

      const variantEl = document.createElement("div");
      variantEl.style.position = "absolute";
      variantEl.style.left = "50%";
      variantEl.style.bottom = "6px";
      variantEl.style.transform = "translateX(-50%)";
      variantEl.style.display = "none";
      variantEl.style.alignItems = "center";
      variantEl.style.gap = "6px";
      variantEl.style.padding = "4px";
      variantEl.style.borderRadius = "999px";
      variantEl.style.background = "rgba(15, 23, 42, 0.84)";
      variantEl.style.border = "1px solid rgba(255, 255, 255, 0.2)";
      variantEl.style.backdropFilter = "blur(12px)";
      variantEl.style.pointerEvents = "auto";
      variantEl.style.zIndex = "4";
      variantEl.setAttribute("role", "group");
      variantEl.setAttribute("aria-label", "Card variants");

      function createCompareVariantButton(label, ariaLabel) {
        const buttonEl = document.createElement("button");
        buttonEl.type = "button";
        buttonEl.textContent = label;
        buttonEl.setAttribute("aria-label", ariaLabel);
        buttonEl.style.minWidth = "26px";
        buttonEl.style.height = "26px";
        buttonEl.style.display = "inline-flex";
        buttonEl.style.alignItems = "center";
        buttonEl.style.justifyContent = "center";
        buttonEl.style.border = "none";
        buttonEl.style.borderRadius = "999px";
        buttonEl.style.background = "rgba(255, 255, 255, 0.14)";
        buttonEl.style.color = "#f8fafc";
        buttonEl.style.font = "800 14px/1 sans-serif";
        buttonEl.style.cursor = "pointer";
        return buttonEl;
      }

      const variantPrevEl = createCompareVariantButton("<", "Previous variant");
      const variantNextEl = createCompareVariantButton(">", "Next variant");

      const variantCounterEl = document.createElement("span");
      variantCounterEl.style.minWidth = "36px";
      variantCounterEl.style.textAlign = "center";
      variantCounterEl.style.font = "600 11px/1.2 sans-serif";
      variantCounterEl.style.color = "#f8fafc";
      variantCounterEl.style.fontVariantNumeric = "tabular-nums";

      const slot = {
        slotEl,
        headerEl,
        badgeEl,
        cardLabelEl,
        mediaEl,
        zoomLayerEl,
        imageEl: compareImageEl,
        fallbackEl,
        variantEl,
        variantPrevEl,
        variantNextEl,
        variantCounterEl,
        variants: [],
        variantIndex: 0,
        cardKey: ""
      };

      variantPrevEl.addEventListener("click", () => stepSlotVariant(slot, -1));
      variantNextEl.addEventListener("click", () => stepSlotVariant(slot, 1));

      variantEl.append(variantPrevEl, variantCounterEl, variantNextEl);

      zoomLayerEl.appendChild(compareImageEl);
      mediaEl.append(zoomLayerEl, fallbackEl, variantEl);
      slotEl.append(headerEl, mediaEl);

      return slot;
    }

    compareGridSlots = [
      createCompareGridSlot(),
      createCompareGridSlot(),
      createCompareGridSlot(),
      createCompareGridSlot()
    ];
    compareGridSlots.forEach((slot) => {
      compareGridEl.appendChild(slot.slotEl);
    });

    imageEl = document.createElement("img");
    imageEl.alt = "Tarot card enlarged image";
    imageEl.style.width = "100%";
    imageEl.style.height = "100%";
    imageEl.style.objectFit = "contain";
    imageEl.style.cursor = "zoom-in";
    imageEl.style.transform = "rotate(0deg)";
    imageEl.style.transformOrigin = "center center";
    imageEl.style.transition = "transform 120ms ease-out, opacity 180ms ease";
    imageEl.style.touchAction = "none";
    imageEl.style.userSelect = "none";

    overlayImageEl = document.createElement("img");
    overlayImageEl.alt = "Tarot card overlay image";
    overlayImageEl.style.width = "100%";
    overlayImageEl.style.height = "100%";
    overlayImageEl.style.objectFit = "contain";
      overlayImageEl.style.opacity = String(lightboxState.overlayOpacity);
    overlayImageEl.style.pointerEvents = "none";
    overlayImageEl.style.display = "none";
    overlayImageEl.style.transform = "rotate(0deg)";
    overlayImageEl.style.transformOrigin = "center center";
    overlayImageEl.style.transition = "opacity 180ms ease";

    function createInfoPanel() {
      const panelEl = document.createElement("div");
      panelEl.style.position = "absolute";
      panelEl.style.display = "none";
      panelEl.style.flexDirection = "column";
      panelEl.style.gap = "10px";
      panelEl.style.padding = "14px 16px";
      panelEl.style.borderRadius = "18px";
      panelEl.style.background = "rgba(2, 6, 23, 0.8)";
      panelEl.style.border = "1px solid rgba(148, 163, 184, 0.16)";
      panelEl.style.color = "#f8fafc";
      panelEl.style.backdropFilter = "blur(12px)";
      panelEl.style.boxShadow = "0 16px 42px rgba(0, 0, 0, 0.34)";
      panelEl.style.transition = "opacity 180ms ease, transform 180ms ease";
      panelEl.style.transform = "translateY(-50%)";
      panelEl.style.pointerEvents = "none";
      panelEl.style.maxHeight = "min(78vh, 760px)";
      panelEl.style.overflowY = "auto";

      const titleEl = document.createElement("div");
      titleEl.style.font = "700 13px/1.3 sans-serif";
      titleEl.style.color = "#f8fafc";

      const groupsEl = document.createElement("div");
      groupsEl.style.display = "flex";
      groupsEl.style.flexDirection = "column";
      groupsEl.style.gap = "0";

      const hintEl = document.createElement("div");
      hintEl.style.font = "500 11px/1.35 sans-serif";
      hintEl.style.color = "rgba(226, 232, 240, 0.82)";

      panelEl.append(titleEl, groupsEl, hintEl);
      return { panelEl, titleEl, groupsEl, hintEl };
    }

    const primaryPanel = createInfoPanel();
    primaryInfoEl = primaryPanel.panelEl;
    primaryTitleEl = primaryPanel.titleEl;
    primaryGroupsEl = primaryPanel.groupsEl;
    primaryHintEl = primaryPanel.hintEl;

    const secondaryPanel = createInfoPanel();
    secondaryInfoEl = secondaryPanel.panelEl;
    secondaryTitleEl = secondaryPanel.titleEl;
    secondaryGroupsEl = secondaryPanel.groupsEl;
    secondaryHintEl = secondaryPanel.hintEl;

    mobileInfoPanelEl = document.createElement("div");
    mobileInfoPanelEl.style.position = "absolute";
    mobileInfoPanelEl.style.left = "12px";
    mobileInfoPanelEl.style.right = "12px";
    mobileInfoPanelEl.style.bottom = "12px";
    mobileInfoPanelEl.style.display = "none";
    mobileInfoPanelEl.style.flexDirection = "column";
    mobileInfoPanelEl.style.gap = "10px";
    mobileInfoPanelEl.style.padding = "14px 16px";
    mobileInfoPanelEl.style.borderRadius = "18px";
    mobileInfoPanelEl.style.background = "rgba(2, 6, 23, 0.86)";
    mobileInfoPanelEl.style.border = "1px solid rgba(148, 163, 184, 0.16)";
    mobileInfoPanelEl.style.color = "#f8fafc";
    mobileInfoPanelEl.style.backdropFilter = "blur(12px)";
    mobileInfoPanelEl.style.boxShadow = "0 16px 42px rgba(0, 0, 0, 0.34)";
    mobileInfoPanelEl.style.maxHeight = "min(46%, 320px)";
    mobileInfoPanelEl.style.overflowY = "auto";
    mobileInfoPanelEl.style.pointerEvents = "auto";
    mobileInfoPanelEl.style.zIndex = "3";

    mobileInfoTitleEl = document.createElement("div");
    mobileInfoTitleEl.style.font = "700 13px/1.3 sans-serif";
    mobileInfoTitleEl.style.color = "#f8fafc";

    mobileInfoGroupsEl = document.createElement("div");
    mobileInfoGroupsEl.style.display = "flex";
    mobileInfoGroupsEl.style.flexDirection = "column";
    mobileInfoGroupsEl.style.gap = "0";

    mobileInfoHintEl = document.createElement("div");
    mobileInfoHintEl.style.font = "500 11px/1.35 sans-serif";
    mobileInfoHintEl.style.color = "rgba(226, 232, 240, 0.82)";

    mobileInfoPanelEl.append(mobileInfoTitleEl, mobileInfoGroupsEl, mobileInfoHintEl);

    function createMobileNavButton(label, ariaLabel) {
      const buttonEl = document.createElement("button");
      buttonEl.type = "button";
      buttonEl.textContent = label;
      buttonEl.setAttribute("aria-label", ariaLabel);
      buttonEl.style.position = "fixed";
      buttonEl.style.top = "auto";
      buttonEl.style.display = "none";
      buttonEl.style.alignItems = "center";
      buttonEl.style.justifyContent = "center";
      buttonEl.style.width = "56px";
      buttonEl.style.height = "56px";
      buttonEl.style.border = "1px solid rgba(255, 255, 255, 0.2)";
      buttonEl.style.borderRadius = "999px";
      buttonEl.style.background = "rgba(15, 23, 42, 0.84)";
      buttonEl.style.color = "#f8fafc";
      buttonEl.style.font = "800 24px/1 sans-serif";
      buttonEl.style.cursor = "pointer";
      buttonEl.style.backdropFilter = "blur(12px)";
      buttonEl.style.transform = "none";
      buttonEl.style.touchAction = "manipulation";
      buttonEl.style.pointerEvents = "auto";
      buttonEl.style.zIndex = "6";
      return buttonEl;
    }

    mobilePrevButtonEl = createMobileNavButton("<", "Previous card");
    mobilePrevButtonEl.style.left = "12px";
    mobileNextButtonEl = createMobileNavButton(">", "Next card");
    mobileNextButtonEl.style.right = "12px";

    variantSwitcherEl = document.createElement("div");
    variantSwitcherEl.style.position = "fixed";
    variantSwitcherEl.style.left = "50%";
    variantSwitcherEl.style.bottom = "18px";
    variantSwitcherEl.style.transform = "translateX(-50%)";
    variantSwitcherEl.style.display = "none";
    variantSwitcherEl.style.alignItems = "center";
    variantSwitcherEl.style.gap = "8px";
    variantSwitcherEl.style.padding = "6px";
    variantSwitcherEl.style.borderRadius = "999px";
    variantSwitcherEl.style.background = "rgba(15, 23, 42, 0.84)";
    variantSwitcherEl.style.border = "1px solid rgba(255, 255, 255, 0.2)";
    variantSwitcherEl.style.backdropFilter = "blur(12px)";
    variantSwitcherEl.style.pointerEvents = "auto";
    variantSwitcherEl.style.touchAction = "manipulation";
    variantSwitcherEl.style.zIndex = "6";
    variantSwitcherEl.setAttribute("role", "group");
    variantSwitcherEl.setAttribute("aria-label", "Card variants");

    function createVariantSwitchButton(label, ariaLabel) {
      const buttonEl = document.createElement("button");
      buttonEl.type = "button";
      buttonEl.textContent = label;
      buttonEl.setAttribute("aria-label", ariaLabel);
      buttonEl.style.display = "inline-flex";
      buttonEl.style.alignItems = "center";
      buttonEl.style.justifyContent = "center";
      buttonEl.style.minWidth = "36px";
      buttonEl.style.height = "36px";
      buttonEl.style.border = "none";
      buttonEl.style.borderRadius = "999px";
      buttonEl.style.background = "rgba(255, 255, 255, 0.12)";
      buttonEl.style.color = "#f8fafc";
      buttonEl.style.font = "800 16px/1 sans-serif";
      buttonEl.style.cursor = "pointer";
      return buttonEl;
    }

    variantPrevButtonEl = createVariantSwitchButton("<", "Previous variant");
    variantNextButtonEl = createVariantSwitchButton(">", "Next variant");

    variantCounterEl = document.createElement("span");
    variantCounterEl.style.minWidth = "46px";
    variantCounterEl.style.textAlign = "center";
    variantCounterEl.style.font = "600 12px/1.2 sans-serif";
    variantCounterEl.style.color = "#f8fafc";
    variantCounterEl.style.padding = "0 4px";
    variantCounterEl.style.fontVariantNumeric = "tabular-nums";

    variantPrevButtonEl.addEventListener("click", () => stepPrimaryVariant(-1));
    variantNextButtonEl.addEventListener("click", () => stepPrimaryVariant(1));

    variantSwitcherEl.append(variantPrevButtonEl, variantCounterEl, variantNextButtonEl);

    baseLayerEl.appendChild(imageEl);
    overlayLayerEl.appendChild(overlayImageEl);
    frameEl.append(baseLayerEl, overlayLayerEl, mobileInfoPanelEl);
    stageEl.append(frameEl, compareGridEl, primaryInfoEl, secondaryInfoEl);
    overlayEl.append(backdropEl, stageEl, toolbarEl, settingsPanelEl, deckComparePanelEl, helpPanelEl, mobilePrevButtonEl, mobileNextButtonEl, variantSwitcherEl);

    const close = () => {
      if (!overlayEl || !imageEl || !overlayImageEl) {
        return;
      }
      if (overlayEl.dataset.closing === "true") {
        return;
      }

      overlayEl.dataset.closing = "true";
      playLightboxCloseAnimation().then(() => {
        overlayEl.dataset.closing = "";
        finishClose();
      });
    };

    const finishClose = () => {
      if (!overlayEl || !imageEl || !overlayImageEl) {
        return;
      }

      lightboxState.isOpen = false;
      lightboxState.compareMode = false;
      lightboxState.deckCompareMode = false;
      lightboxState.allowOverlayCompare = false;
      lightboxState.allowDeckCompare = false;
      lightboxState.primaryCard = null;
      lightboxState.secondaryCard = null;
      lightboxState.activeDeckId = "";
      lightboxState.activeDeckLabel = "";
      lightboxState.availableCompareDecks = [];
      lightboxState.selectedCompareDeckIds = [];
      lightboxState.deckCompareCards = [];
      lightboxState.maxCompareDecks = 2;
      lightboxState.deckComparePickerOpen = false;
      lightboxState.deckCompareMessage = "";
      lightboxState.sequenceIds = [];
      lightboxState.resolveCardById = null;
      lightboxState.resolveDeckCardById = null;
      lightboxState.resolveCardVariants = null;
      lightboxState.primaryVariants = [];
      lightboxState.primaryVariantIndex = 0;
      lightboxState.onSelectCardId = null;
      lightboxState.overlayOpacity = getPersistedOverlayOpacity();
      lightboxState.zoomScale = LIGHTBOX_ZOOM_SCALE;
      lightboxState.settingsMenuOpen = false;
      lightboxState.helpOpen = false;
      lastNotesCardId = "";
      if (notesControlEl) {
        notesControlEl.replaceChildren();
      }
      lightboxState.primaryRotated = false;
      lightboxState.overlayRotated = false;
      lightboxState.originRect = null;
      if (frameEl) {
        frameEl.style.transition = "";
        frameEl.style.transform = "none";
      }
      if (backdropEl) {
        backdropEl.style.opacity = "1";
      }
      if (toolbarEl) {
        toolbarEl.style.opacity = "1";
      }
      setInfoPanelOpen(false, { persist: false });
      lightboxState.mobileInfoView = "primary";
      lightboxState.exportInProgress = false;
      clearActivePointerGesture();
      suppressNextCardClick = false;
      overlayEl.style.display = "none";
      overlayEl.setAttribute("aria-hidden", "true");
      imageEl.removeAttribute("src");
      imageEl.alt = "Tarot card enlarged image";
      overlayImageEl.removeAttribute("src");
      overlayImageEl.alt = "";
      overlayImageEl.style.display = "none";
      resetZoom();
      syncHelpUi();
      syncComparePanels();
      syncOpacityControl();
      syncDeckComparePicker();
      renderDeckCompareGrid();
      syncVariantSwitcher();

      if (typeof lightboxState.onClose === "function") {
        lightboxState.onClose();
      }
      lightboxState.onClose = null;
      clearLightboxFlyer();

      if (previousFocusedEl instanceof HTMLElement) {
        previousFocusedEl.focus({ preventScroll: true });
      }
      previousFocusedEl = null;
    };

    function toggleCompareMode() {
      if (!lightboxState.allowOverlayCompare || !lightboxState.primaryCard) {
        return;
      }

      lightboxState.compareMode = !lightboxState.compareMode;
      if (lightboxState.compareMode) {
        // Overlay stacks two cards on one frame, so the side-by-side deck grid
        // has to stand down or both presentations fight over the same viewport.
        if (lightboxState.deckCompareMode) {
          updateDeckCompareMode([], false);
        }
        // Overlay a card immediately so the transparent card is visible right
        // away; arrow keys then step it.
        if (!hasSecondaryCard()) {
          pickInitialSecondaryCard();
        }
      } else {
        clearSecondaryCard();
      }
      applyComparePresentation();
    }

    // Pick the next card in the sequence as the overlay the moment Overlay is
    // turned on (without changing the base card selection).
    function pickInitialSecondaryCard() {
      const sequence = Array.isArray(lightboxState.sequenceIds) ? lightboxState.sequenceIds : [];
      const primarySequenceId = lightboxState.primaryCard?.sequenceId || lightboxState.primaryCard?.cardId;
      const primaryIndex = sequence.indexOf(primarySequenceId);
      if (sequence.length < 2 || primaryIndex < 0) {
        return false;
      }
      for (let offset = 1; offset <= sequence.length; offset += 1) {
        const nextSequenceId = sequence[(primaryIndex + offset) % sequence.length];
        if (!nextSequenceId || nextSequenceId === primarySequenceId) {
          continue;
        }
        const nextCard = resolveCardRequestById(nextSequenceId);
        if (nextCard && setSecondaryCard(nextCard, false)) {
          return true;
        }
      }
      return false;
    }

    function setSecondaryCard(cardRequest, syncSelection = false) {
      const normalizedCard = normalizeCardRequest(cardRequest);
      // Deck variants share one cardId, so identity has to come from the sequence
      // entry. Comparing cardId alone blocked overlaying a card across decks.
      const primarySequenceId = lightboxState.primaryCard?.sequenceId || lightboxState.primaryCard?.cardId;
      const nextSequenceId = normalizedCard.sequenceId || normalizedCard.cardId;
      if (!normalizedCard.src || !normalizedCard.cardId || nextSequenceId === primarySequenceId) {
        return false;
      }

      lightboxState.secondaryCard = normalizedCard;
      if (isCompactLightboxLayout()) {
        lightboxState.mobileInfoView = "overlay";
      }
      applyCardImageToElement(overlayImageEl, normalizedCard, "overlay");
      overlayImageEl.style.display = "block";
      overlayImageEl.style.opacity = String(lightboxState.overlayOpacity);
      if (syncSelection && typeof lightboxState.onSelectCardId === "function") {
        lightboxState.onSelectCardId(normalizedCard.cardId);
      }
      applyComparePresentation();
      return true;
    }

    function stepSecondaryCard(direction) {
      const sequence = Array.isArray(lightboxState.sequenceIds) ? lightboxState.sequenceIds : [];
      if (!lightboxState.compareMode || sequence.length < 2 || typeof lightboxState.resolveCardById !== "function") {
        return;
      }

      const anchorId = lightboxState.secondaryCard?.sequenceId
        || lightboxState.secondaryCard?.cardId
        || lightboxState.primaryCard?.sequenceId
        || lightboxState.primaryCard?.cardId;
      const startIndex = sequence.indexOf(anchorId);
      if (startIndex < 0) {
        return;
      }

      for (let offset = 1; offset <= sequence.length; offset += 1) {
        const nextIndex = (startIndex + direction * offset + sequence.length) % sequence.length;
        const nextSequenceId = sequence[nextIndex];
        const primarySequenceId = lightboxState.primaryCard?.sequenceId || lightboxState.primaryCard?.cardId;
        if (!nextSequenceId || nextSequenceId === primarySequenceId) {
          continue;
        }

        const nextCard = resolveCardRequestById(nextSequenceId);
        if (nextCard && setSecondaryCard(nextCard, true)) {
          break;
        }
      }
    }

    function stepPrimaryCard(direction) {
      const sequence = Array.isArray(lightboxState.sequenceIds) ? lightboxState.sequenceIds : [];
      if (lightboxState.compareMode || sequence.length < 2 || typeof lightboxState.resolveCardById !== "function") {
        return;
      }

      const primarySequenceId = lightboxState.primaryCard?.sequenceId || lightboxState.primaryCard?.cardId;
      const startIndex = sequence.indexOf(primarySequenceId);
      if (startIndex < 0) {
        return;
      }

      const nextIndex = (startIndex + direction + sequence.length) % sequence.length;
      const nextSequenceId = sequence[nextIndex];
      const nextCard = resolveCardRequestById(nextSequenceId);
      if (!nextCard?.src) {
        return;
      }

      lightboxState.primaryCard = nextCard;
  applyCardImageToElement(imageEl, nextCard, "primary");
      resetZoom();
      syncActiveDeckFromPrimaryCard();
      if (lightboxState.deckCompareMode) {
        syncDeckCompareCards();
      } else {
        clearSecondaryCard();
      }
      if (typeof lightboxState.onSelectCardId === "function") {
        lightboxState.onSelectCardId(nextCard.cardId);
      }
      syncPrimaryVariants();
      applyComparePresentation();
    }

    function swapCompareCards() {
      if (!lightboxState.compareMode || !lightboxState.primaryCard?.src || !lightboxState.secondaryCard?.src) {
        return;
      }

      const nextPrimaryCard = lightboxState.secondaryCard;
      const nextSecondaryCard = lightboxState.primaryCard;

      lightboxState.primaryCard = nextPrimaryCard;
      lightboxState.secondaryCard = nextSecondaryCard;

      applyCardImageToElement(imageEl, nextPrimaryCard, "primary");
      applyCardImageToElement(overlayImageEl, nextSecondaryCard, "overlay");
      overlayImageEl.style.display = "block";
      overlayImageEl.style.opacity = String(lightboxState.overlayOpacity);

      if (typeof lightboxState.onSelectCardId === "function") {
        lightboxState.onSelectCardId(nextPrimaryCard.cardId);
      }

      syncPrimaryVariants();
      applyComparePresentation();
    }

    function shouldIgnoreGlobalKeydown(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      if (!overlayEl?.contains(target)) {
        return false;
      }

      return target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLButtonElement;
    }

    function restoreLightboxFocus() {
      if (!overlayEl || !lightboxState.isOpen) {
        return;
      }

      requestAnimationFrame(() => {
        if (overlayEl && lightboxState.isOpen) {
          overlayEl.focus({ preventScroll: true });
        }
      });
    }

    backdropEl.addEventListener("click", close);
    helpButtonEl.addEventListener("click", () => {
      lightboxState.helpOpen = !lightboxState.helpOpen;
      if (lightboxState.helpOpen) {
        closeSettingsMenu();
      }
      syncHelpUi();
      restoreLightboxFocus();
    });
    settingsButtonEl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleSettingsMenu();
      restoreLightboxFocus();
    });
    settingsPanelEl.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    settingsPanelEl.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    compareButtonEl.addEventListener("click", () => {
      toggleCompareMode();
      restoreLightboxFocus();
    });
    deckCompareButtonEl.addEventListener("click", () => {
      if (shouldSuppressDeckCompareToggle()) {
        restoreLightboxFocus();
        return;
      }
      toggleDeckComparePanel();
      restoreLightboxFocus();
    });
    deckComparePanelEl.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    deckComparePanelEl.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    deckCompareCloseButtonEl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      suppressDeckCompareToggle();
      closeDeckComparePanel();
      applyComparePresentation();
      restoreLightboxFocus();
    });
    mobileInfoButtonEl.addEventListener("click", () => {
      setInfoPanelOpen(!lightboxState.mobileInfoOpen);
      applyComparePresentation();
      restoreLightboxFocus();
    });
    mobileInfoPrimaryTabEl.addEventListener("click", () => {
      lightboxState.mobileInfoView = "primary";
      applyComparePresentation();
      restoreLightboxFocus();
    });
    mobileInfoSecondaryTabEl.addEventListener("click", () => {
      lightboxState.mobileInfoView = "overlay";
      applyComparePresentation();
      restoreLightboxFocus();
    });
    zoomSliderEl.addEventListener("input", () => {
      setZoomScale(Number(zoomSliderEl.value) / 100, { persist: false });
    });
    zoomSliderEl.addEventListener("change", () => {
      persistZoomScale();
      restoreLightboxFocus();
    });
    zoomSliderEl.addEventListener("pointerup", () => {
      persistZoomScale();
      restoreLightboxFocus();
    });
    opacitySliderEl.addEventListener("input", () => {
      setOverlayOpacity(Number(opacitySliderEl.value) / 100);
    });
    exportButtonEl.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await exportCurrentLightboxView();
    });
    closeLightboxButtonEl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      close();
    });
    opacitySliderEl.addEventListener("change", restoreLightboxFocus);
    opacitySliderEl.addEventListener("pointerup", restoreLightboxFocus);
    mobilePrevButtonEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (lightboxState.compareMode) {
        stepSecondaryCard(-1);
      } else {
        stepPrimaryCard(-1);
      }
      restoreLightboxFocus();
    });
    mobileNextButtonEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (lightboxState.compareMode) {
        stepSecondaryCard(1);
      } else {
        stepPrimaryCard(1);
      }
      restoreLightboxFocus();
    });

    imageEl.addEventListener("click", (event) => {
      event.stopPropagation();
      if (consumeSuppressedCardClick()) {
        return;
      }

      if (!isPointOnCard(event.clientX, event.clientY)) {
        if (lightboxState.compareMode) {
          return;
        }

        close();
        return;
      }

      if (!zoomed) {
        zoomed = true;
        applyZoomTransform();
        updateZoomOrigin(event.clientX, event.clientY);
        applyComparePresentation();
        return;
      }

      resetZoom();
      applyComparePresentation();
    });

    imageEl.addEventListener("mousemove", (event) => {
      updateZoomOrigin(event.clientX, event.clientY);
    });

    imageEl.addEventListener("pointerdown", (event) => {
      if (handleCompactPointerDown(event)) {
        imageEl.setPointerCapture?.(event.pointerId);
      }
    });

    imageEl.addEventListener("pointermove", (event) => {
      handleCompactPointerMove(event, imageEl, null);
    });

    imageEl.addEventListener("pointerup", (event) => {
      handleCompactPointerEnd(event, imageEl);
    });

    imageEl.addEventListener("pointercancel", (event) => {
      handleCompactPointerEnd(event, imageEl);
    });

    imageEl.addEventListener("touchstart", (event) => {
      handleCompactPinchStart(event, imageEl, null);
    }, { passive: false });

    imageEl.addEventListener("touchmove", preventCompactTouchScroll, { passive: false });
    imageEl.addEventListener("touchmove", (event) => {
      handleCompactPinchMove(event);
    }, { passive: false });
    imageEl.addEventListener("touchend", (event) => {
      handleCompactPinchEnd(event);
    }, { passive: false });
    imageEl.addEventListener("touchcancel", (event) => {
      handleCompactPinchEnd(event);
    }, { passive: false });

    imageEl.addEventListener("mouseleave", () => {
      if (zoomed) {
        lightboxState.zoomOriginX = 50;
        lightboxState.zoomOriginY = 50;
        applyTransformOrigins();
      }
    });

    compareGridSlots.forEach((slot) => {
      slot.imageEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (consumeSuppressedCardClick()) {
          return;
        }

        if (!isPointOnCard(event.clientX, event.clientY, slot.imageEl, slot.mediaEl)) {
          close();
          return;
        }

        if (!zoomed) {
          zoomed = true;
          applyZoomTransform();
          updateZoomOrigin(event.clientX, event.clientY, slot.imageEl, slot.mediaEl);
          applyComparePresentation();
          return;
        }

        resetZoom();
        applyComparePresentation();
      });

      slot.imageEl.addEventListener("mousemove", (event) => {
        updateZoomOrigin(event.clientX, event.clientY, slot.imageEl, slot.mediaEl);
      });

      slot.imageEl.addEventListener("pointerdown", (event) => {
        if (handleCompactPointerDown(event)) {
          slot.imageEl.setPointerCapture?.(event.pointerId);
        }
      });

      slot.imageEl.addEventListener("pointermove", (event) => {
        handleCompactPointerMove(event, slot.imageEl, slot.mediaEl);
      });

      slot.imageEl.addEventListener("pointerup", (event) => {
        handleCompactPointerEnd(event, slot.imageEl);
      });

      slot.imageEl.addEventListener("pointercancel", (event) => {
        handleCompactPointerEnd(event, slot.imageEl);
      });

      slot.imageEl.addEventListener("touchstart", (event) => {
        handleCompactPinchStart(event, slot.imageEl, slot.mediaEl);
      }, { passive: false });

      slot.imageEl.addEventListener("touchmove", preventCompactTouchScroll, { passive: false });
      slot.imageEl.addEventListener("touchmove", (event) => {
        handleCompactPinchMove(event);
      }, { passive: false });
      slot.imageEl.addEventListener("touchend", (event) => {
        handleCompactPinchEnd(event);
      }, { passive: false });
      slot.imageEl.addEventListener("touchcancel", (event) => {
        handleCompactPinchEnd(event);
      }, { passive: false });

      slot.imageEl.addEventListener("mouseleave", () => {
        if (zoomed) {
          lightboxState.zoomOriginX = 50;
          lightboxState.zoomOriginY = 50;
          applyTransformOrigins();
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (shouldIgnoreGlobalKeydown(event)) {
        return;
      }

      if (lightboxState.isOpen && event.code === "Space" && lightboxState.compareMode && hasSecondaryCard()) {
        event.preventDefault();
        swapCompareCards();
        return;
      }

      if (lightboxState.isOpen && isRotateKey(event)) {
        event.preventDefault();
        toggleRotation();
        return;
      }

      if (lightboxState.isOpen && isVariantCycleKey(event)) {
        event.preventDefault();
        if (lightboxState.deckCompareMode && compareGridSlots.length > 0) {
          stepSlotVariant(compareGridSlots[0], 1);
        } else {
          stepPrimaryVariant(1);
        }
        return;
      }

      if (lightboxState.isOpen && isZoomInKey(event)) {
        event.preventDefault();
        stepZoom(1);
        return;
      }

      if (lightboxState.isOpen && isZoomOutKey(event)) {
        event.preventDefault();
        stepZoom(-1);
        return;
      }

      if (lightboxState.isOpen && zoomed && isPanUpKey(event)) {
        event.preventDefault();
        stepPan(0, -LIGHTBOX_PAN_STEP);
        return;
      }

      if (lightboxState.isOpen && zoomed && isPanLeftKey(event)) {
        event.preventDefault();
        stepPan(-LIGHTBOX_PAN_STEP, 0);
        return;
      }

      if (lightboxState.isOpen && zoomed && isPanDownKey(event)) {
        event.preventDefault();
        stepPan(0, LIGHTBOX_PAN_STEP);
        return;
      }

      if (lightboxState.isOpen && zoomed && isPanRightKey(event)) {
        event.preventDefault();
        stepPan(LIGHTBOX_PAN_STEP, 0);
        return;
      }

      if (!lightboxState.isOpen || !LIGHTBOX_COMPARE_SEQUENCE_STEP_KEYS.has(event.key)) {
        return;
      }

      event.preventDefault();
      if (lightboxState.compareMode) {
        stepSecondaryCard(event.key === "ArrowRight" ? 1 : -1);
        return;
      }

      stepPrimaryCard(event.key === "ArrowRight" ? 1 : -1);
    });

    document.addEventListener("wheel", preventBrowserZoomGesture, {
      capture: true,
      passive: false
    });
    ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
      document.addEventListener(eventName, preventBrowserZoomGesture, {
        capture: true,
        passive: false
      });
    });

    window.addEventListener("resize", () => {
      if (!lightboxState.isOpen) {
        return;
      }

      applyComparePresentation();
    });

    document.body.appendChild(overlayEl);

    overlayEl.closeLightbox = close;
    overlayEl.setSecondaryCard = setSecondaryCard;
    overlayEl.applyComparePresentation = applyComparePresentation;
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  }

  function normalizeOriginRect(value) {
    const left = Number(value?.left);
    const top = Number(value?.top);
    const width = Number(value?.width);
    const height = Number(value?.height);
    if (![left, top, width, height].every(Number.isFinite) || !(width > 2) || !(height > 2)) {
      return null;
    }
    return { left, top, width, height };
  }

  function clearLightboxFlyer() {
    overlayEl?.querySelectorAll?.(".tarot-lightbox-flyer").forEach((node) => node.remove());
  }

  function createLightboxFlyer(rect, src, rotated) {
    const flyer = document.createElement("img");
    flyer.className = "tarot-lightbox-flyer";
    flyer.alt = "";
    flyer.draggable = false;
    if (src) {
      flyer.src = src;
    }
    flyer.style.position = "fixed";
    flyer.style.left = `${rect.left}px`;
    flyer.style.top = `${rect.top}px`;
    flyer.style.width = `${rect.width}px`;
    flyer.style.height = `${rect.height}px`;
    flyer.style.objectFit = "cover";
    flyer.style.objectPosition = "center";
    flyer.style.zIndex = "3";
    flyer.style.pointerEvents = "none";
    flyer.style.borderRadius = "8px";
    flyer.style.boxShadow = "0 24px 64px rgba(0, 0, 0, 0.45)";
    flyer.style.transformOrigin = "center center";
    flyer.style.willChange = "transform";
    flyer.style.transform = rotated ? "rotate(180deg)" : "none";
    flyer.decoding = "async";
    flyer.loading = "eager";
    overlayEl.appendChild(flyer);
    return flyer;
  }

  function getContainedImageRect(image) {
    if (!(image instanceof HTMLImageElement)) {
      return null;
    }
    const box = image.getBoundingClientRect();
    if (!(box.width > 2) || !(box.height > 2)) {
      return null;
    }
    const naturalWidth = Number(image.naturalWidth) || 0;
    const naturalHeight = Number(image.naturalHeight) || 0;
    // Card images are 2:3; fall back to that ratio before the full image loads so
    // the fly-in lands on the true contained size instead of the whole viewport.
    const aspect = (naturalWidth > 0 && naturalHeight > 0)
      ? (naturalWidth / naturalHeight)
      : (2 / 3);
    let width = box.width;
    let height = width / aspect;
    if (height > box.height) {
      height = box.height;
      width = height * aspect;
    }
    return {
      left: box.left + ((box.width - width) / 2),
      top: box.top + ((box.height - height) / 2),
      width,
      height
    };
  }

  function playLightboxOpenAnimation(originRect) {
    clearLightboxFlyer();
    if (!overlayEl || !frameEl || !backdropEl) {
      return;
    }

    if (!originRect || prefersReducedMotion() || typeof imageEl?.animate !== "function") {
      if (backdropEl) {
        backdropEl.style.opacity = "1";
      }
      if (frameEl) {
        frameEl.style.opacity = "1";
        frameEl.style.transform = "none";
      }
      if (toolbarEl) {
        toolbarEl.style.opacity = "1";
      }
      return;
    }

    // Defer rect measurement + fly start by one frame so layout (display:block, image sizing)
    // has settled. This prevents wrong dest rects and stuttery or mis-landing animations.
    requestAnimationFrame(() => {
      const dest = getContainedImageRect(imageEl);
      if (!dest) {
        if (frameEl) {
          frameEl.style.opacity = "1";
        }
        if (backdropEl) {
          backdropEl.style.opacity = "1";
        }
        return;
      }

      const src = String(imageEl.currentSrc || imageEl.src || "").trim();
      const rotated = Boolean(lightboxState.primaryRotated);
      if (toolbarEl) {
        toolbarEl.style.opacity = "0";
      }
      if (!src) {
        frameEl.style.opacity = "1";
        backdropEl.style.opacity = "1";
        return;
      }
      frameEl.style.opacity = "0";
      backdropEl.style.opacity = "0";
      backdropEl.animate?.(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 280, easing: "ease-out", fill: "forwards" }
      );

      // FLIP on transform only (GPU-composited). Position the flyer at the final
      // frame and pull it back to the card with translate+scale, then release.
      // transform-origin is center, so translate by CENTER deltas (top-left deltas
      // would offset the start by half the size difference).
      const flyer = createLightboxFlyer(dest, src, rotated);
      const dx = (originRect.left + originRect.width / 2) - (dest.left + dest.width / 2);
      const dy = (originRect.top + originRect.height / 2) - (dest.top + dest.height / 2);
      const s = dest.width > 0 ? (originRect.width / dest.width) : 1;
      const rot = rotated ? " rotate(180deg)" : "";
      const fromTransform = `translate3d(${dx}px, ${dy}px, 0) scale(${s})${rot}`;
      const toTransform = rotated ? "rotate(180deg)" : "none";
      flyer.style.transform = fromTransform;

      const startFly = () => {
        const animation = flyer.animate(
          [
            { transform: fromTransform },
            { transform: toTransform }
          ],
          {
            duration: 420,
            easing: "cubic-bezier(0.16, 0.84, 0.32, 1)",
            fill: "forwards"
          }
        );

        animation.finished.catch(() => {}).then(() => {
          if (!lightboxState.isOpen) {
            flyer.remove();
            return;
          }
          // Hand off on next frame + brief fade of flyer to avoid any style-jank or pop exactly on last anim frame.
          requestAnimationFrame(() => {
            frameEl.style.opacity = "1";
            if (toolbarEl) {
              toolbarEl.style.opacity = "1";
            }
            if (flyer.animate) {
              const fade = flyer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 60, easing: "linear", fill: "forwards" });
              fade.finished.catch(() => {}).finally(() => flyer.remove());
            } else {
              flyer.remove();
            }
          });
        });
      };

      if (typeof flyer.decode === "function") {
        flyer.decode().catch(() => {}).then(startFly);
      } else {
        startFly();
      }
    });
  }

  function playLightboxCloseAnimation() {
    const originRect = lightboxState.originRect;
    if (!overlayEl || !imageEl || !originRect || prefersReducedMotion() || typeof imageEl.animate !== "function") {
      return Promise.resolve();
    }

    const dest = getContainedImageRect(imageEl);
    if (!dest) {
      return Promise.resolve();
    }

    const src = String(imageEl.currentSrc || imageEl.src || "").trim();
    const rotated = Boolean(lightboxState.primaryRotated);
    if (toolbarEl) {
      toolbarEl.style.opacity = "0";
    }
    if (frameEl) {
      frameEl.style.opacity = "0";
    }
    backdropEl?.animate?.(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 240, easing: "ease-in", fill: "forwards" }
    );

    clearLightboxFlyer();
    const flyer = createLightboxFlyer(dest, src, rotated);
    // Center deltas because the flyer's transform-origin is center.
    const dx = (originRect.left + originRect.width / 2) - (dest.left + dest.width / 2);
    const dy = (originRect.top + originRect.height / 2) - (dest.top + dest.height / 2);
    const s = dest.width > 0 ? (originRect.width / dest.width) : 1;
    const rot = rotated ? " rotate(180deg)" : "";
    const fromTransform = rotated ? "rotate(180deg)" : "none";
    const toTransform = `translate3d(${dx}px, ${dy}px, 0) scale(${s})${rot}`;
    flyer.style.transform = fromTransform;

    return new Promise((resolve) => {
      const startFly = () => {
        const animation = flyer.animate(
          [
            { transform: fromTransform },
            { transform: toTransform }
          ],
          {
            duration: 320,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "forwards"
          }
        );

        animation.finished.catch(() => {}).finally(() => {
          flyer.remove();
          resolve();
        });
      };

      if (typeof flyer.decode === "function") {
        flyer.decode().catch(() => {}).then(startFly);
      } else {
        startFly();
      }
    });
  }

  function open(srcOrOptions, altText, extraOptions) {
    const request = normalizeOpenRequest(srcOrOptions, altText, extraOptions);
    const normalizedPrimary = normalizeCardRequest(request);

    if (!normalizedPrimary.src) {
      return;
    }

    ensure();
    if (!overlayEl || !imageEl || !overlayImageEl) {
      return;
    }

    const canCompare = Boolean(
      request.allowOverlayCompare
      && normalizedPrimary.cardId
      && Array.isArray(request.sequenceIds)
      && request.sequenceIds.length > 1
      && typeof request.resolveCardById === "function"
    );
    const canDeckCompare = Boolean(
      request.allowDeckCompare
      && normalizedPrimary.cardId
      && typeof request.resolveDeckCardById === "function"
    );

    if (lightboxState.isOpen && lightboxState.compareMode && lightboxState.allowOverlayCompare && canCompare && normalizedPrimary.cardId) {
      if (normalizedPrimary.cardId === lightboxState.primaryCard?.cardId) {
        return;
      }
      overlayEl.setSecondaryCard?.(normalizedPrimary, false);
      return;
    }

    lightboxState.isOpen = true;
    lightboxState.compareMode = false;
    lightboxState.deckCompareMode = false;
    lightboxState.allowOverlayCompare = canCompare;
    lightboxState.allowDeckCompare = canDeckCompare;
    lightboxState.primaryCard = normalizedPrimary;
    lightboxState.activeDeckId = String(request.activeDeckId || normalizedPrimary.deckId || "").trim();
    lightboxState.activeDeckLabel = String(request.activeDeckLabel || normalizedPrimary.deckLabel || lightboxState.activeDeckId).trim();
    lightboxState.availableCompareDecks = canDeckCompare
      ? normalizeDeckOptions(request.availableCompareDecks)
      : [];
    lightboxState.selectedCompareDeckIds = [];
    lightboxState.deckCompareCards = [];
    lightboxState.maxCompareDecks = Number.isInteger(Number(request.maxCompareDecks)) && Number(request.maxCompareDecks) > 0
      ? Number(request.maxCompareDecks)
      : 2;
    lightboxState.deckComparePickerOpen = false;
    lightboxState.deckCompareMessage = "";
    lightboxState.sequenceIds = canCompare ? [...request.sequenceIds] : [];
    lightboxState.resolveCardById = canCompare ? request.resolveCardById : null;
    lightboxState.resolveDeckCardById = canDeckCompare ? request.resolveDeckCardById : null;
    lightboxState.resolveCardVariants = typeof request.resolveCardVariants === "function"
      ? request.resolveCardVariants
      : null;
    lightboxState.onSelectCardId = canCompare && typeof request.onSelectCardId === "function"
      ? request.onSelectCardId
      : null;
    lightboxState.overlayOpacity = getPersistedOverlayOpacity();
    lightboxState.zoomScale = getPersistedZoomScale();
    void hydrateLightboxProfileState();
    lightboxState.settingsMenuOpen = false;
    lightboxState.helpOpen = false;
    lightboxState.primaryRotated = Boolean(request.rotated);
    lightboxState.overlayRotated = false;
    lightboxState.originRect = normalizeOriginRect(request.originRect);
    lightboxState.onClose = typeof request.onClose === "function" ? request.onClose : null;
    setInfoPanelOpen(getPersistedInfoPanelVisibility(), { persist: false });
    lightboxState.mobileInfoView = "primary";

    applyCardImageToElement(imageEl, normalizedPrimary, "primary");
    clearSecondaryCard();
    resetZoom();
    syncPrimaryVariants();
    previousFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (frameEl && lightboxState.originRect && !prefersReducedMotion()) {
      frameEl.style.opacity = "0";
    }
    if (toolbarEl && lightboxState.originRect && !prefersReducedMotion()) {
      toolbarEl.style.opacity = "0";
    }
    overlayEl.style.display = "block";
    overlayEl.setAttribute("aria-hidden", "false");
    overlayEl.applyComparePresentation?.();
    overlayEl.focus({ preventScroll: true });
    playLightboxOpenAnimation(lightboxState.originRect);
  }

  window.TarotUiLightbox = {
    ...(window.TarotUiLightbox || {}),
    open
  };
})();