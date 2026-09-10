(function () {
  "use strict";

  const SIDEBAR_COLLAPSE_STORAGE_PREFIX = "tarot-sidebar-collapsed:v2:";
  const DETAIL_COLLAPSE_STORAGE_PREFIX = "tarot-detail-collapsed:v2:";
  const DEFAULT_DATASET_ENTRY_COLLAPSED = false;
  const DEFAULT_DATASET_DETAIL_COLLAPSED = true;
  const sidebarControllers = new WeakMap();
  const sidebarControllerRegistry = new Map();
  const detailControllers = new WeakMap();
  const detailExportInProgress = new WeakSet();
  const AUTO_COLLAPSE_ENTRY_SELECTOR = [
    ".list-item",
    ".list-item",
    "[role='option']",
    ".kab-node[data-sephira]",
    ".kab-path-hit[data-path]",
    ".kab-path-tarot[data-path]",
    ".kab-rose-petal[data-path]",
    ".cube-face[role='button']",
    ".cube-edge-line[role='button']",
    ".cube-direction[role='button']",
    ".cube-connector[role='button']",
    ".cube-center[role='button']",
    ".kab-chip[data-path]"
  ].join(", ");
  const AUTO_COLLAPSE_IGNORE_SELECTOR = [
    ".sidebar-toggle-inline",
    ".sidebar-popout-open",
    "input",
    "select",
    "textarea",
    "label",
    "form",
    ".dataset-search-wrap",
    ".alpha-text-search-controls",
    ".cube-rotation-controls",
    ".cube-rotation-btn",
    ".tarot-house-action-btn"
  ].join(", ");

  function loadSidebarCollapsedState(storageKey) {
    try {
      const raw = window.localStorage?.getItem(storageKey);
      if (raw === "1") {
        return true;
      }
      if (raw === "0") {
        return false;
      }
      return null;
    } catch {
      return null;
    }
  }

  function saveSidebarCollapsedState(storageKey, collapsed) {
    try {
      window.localStorage?.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      // Ignore storage failures silently.
    }
  }

  function resolveLayoutTarget(target) {
    if (target instanceof HTMLElement) {
      if (target.matches(".browse-layout, .kab-layout")) {
        return target;
      }

      return target.closest(".browse-layout, .kab-layout");
    }

    if (typeof target === "string" && target) {
      const element = document.getElementById(target);
      if (element instanceof HTMLElement) {
        if (element.matches(".browse-layout, .kab-layout")) {
          return element;
        }

        return element.querySelector(".browse-layout, .kab-layout")
          || element.closest(".browse-layout, .kab-layout");
      }
    }

    return null;
  }

  function setSidebarCollapsed(target, collapsed, persist = true) {
    const layout = resolveLayoutTarget(target);
    const controller = layout ? sidebarControllers.get(layout) : null;
    if (!controller) {
      return false;
    }

    controller.applyCollapsedState(Boolean(collapsed), persist);
    return true;
  }

  function setDetailCollapsed(target, collapsed, persist = true) {
    const layout = resolveLayoutTarget(target);
    const controller = layout ? detailControllers.get(layout) : null;
    if (!controller) {
      return false;
    }

    controller.applyCollapsedState(Boolean(collapsed), persist);
    return true;
  }

  function showDetailOnly(target, persist = true) {
    const layout = resolveLayoutTarget(target);
    if (!layout) {
      return false;
    }

    const detailChanged = setDetailCollapsed(layout, false, persist);
    const sidebarChanged = setSidebarCollapsed(layout, true, persist);
    return detailChanged || sidebarChanged;
  }

  function showSidebarOnly(target, persist = true) {
    const layout = resolveLayoutTarget(target);
    if (!layout) {
      return false;
    }

    const detailChanged = setDetailCollapsed(layout, true, persist);
    const sidebarChanged = setSidebarCollapsed(layout, false, persist);
    return detailChanged || sidebarChanged;
  }

  function shouldAutoCollapseFromEvent(panel, target) {
    if (!(panel instanceof HTMLElement) || !(target instanceof Element) || !panel.contains(target)) {
      return false;
    }

    if (target.closest(AUTO_COLLAPSE_IGNORE_SELECTOR)) {
      return false;
    }

    return Boolean(target.closest(AUTO_COLLAPSE_ENTRY_SELECTOR));
  }

  function getAutoCollapseLayoutFromTarget(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    if (target.closest(AUTO_COLLAPSE_IGNORE_SELECTOR)) {
      return null;
    }

    const entry = target.closest(AUTO_COLLAPSE_ENTRY_SELECTOR);
    if (!(entry instanceof Element)) {
      return null;
    }

    const panel = entry.closest("aside.list-panel, aside.kab-tree-panel");
    if (!(panel instanceof HTMLElement)) {
      return null;
    }

    return resolveLayoutTarget(panel);
  }

  function isLayoutVisible(layout) {
    if (!(layout instanceof HTMLElement)) {
      return false;
    }

    if (layout.hidden || layout.closest("[hidden]")) {
      return false;
    }

    const section = layout.closest("section");
    if (section instanceof HTMLElement && section.hidden) {
      return false;
    }

    return true;
  }

  function getActiveVisibleSidebarController() {
    for (const controller of sidebarControllerRegistry.values()) {
      if (!isLayoutVisible(controller.layout)) {
        continue;
      }

      return controller;
    }

    return null;
  }

  function getTopbarPanelToggleButton() {
    const { topbarEl, menuToggleEl } = getTopbarElements();
    if (!(topbarEl instanceof HTMLElement) || !(menuToggleEl instanceof HTMLButtonElement)) {
      return null;
    }

    const existingButton = topbarEl.querySelector("#topbar-panel-toggle");
    if (existingButton instanceof HTMLButtonElement) {
      return existingButton;
    }

    const panelToggleEl = document.createElement("button");
    panelToggleEl.id = "topbar-panel-toggle";
    panelToggleEl.type = "button";
    panelToggleEl.className = "topbar-panel-toggle sidebar-popout-open";
    panelToggleEl.textContent = "Show Detail";
    panelToggleEl.setAttribute("aria-label", "Show detail view");
    panelToggleEl.hidden = true;
    panelToggleEl.addEventListener("click", () => {
      const controller = getActiveVisibleSidebarController();
      if (!controller) {
        return;
      }

      if (controller.layout.classList.contains("layout-sidebar-collapsed")) {
        showSidebarOnly(controller.layout);
        return;
      }

      if (detailControllers.has(controller.layout)) {
        showDetailOnly(controller.layout);
      }
    });

    topbarEl.insertBefore(panelToggleEl, menuToggleEl);
    return panelToggleEl;
  }

  function syncTopbarPanelToggleButton() {
    const panelToggleEl = getTopbarPanelToggleButton();
    if (!(panelToggleEl instanceof HTMLButtonElement)) {
      return;
    }

    const controller = getActiveVisibleSidebarController();
    if (!controller) {
      panelToggleEl.hidden = true;
      panelToggleEl.removeAttribute("aria-controls");
      panelToggleEl.setAttribute("aria-expanded", "false");
      return;
    }

    const sidebarCollapsed = controller.layout.classList.contains("layout-sidebar-collapsed");
    const hasDetailController = detailControllers.has(controller.layout);
    if (!sidebarCollapsed && !hasDetailController) {
      panelToggleEl.hidden = true;
      panelToggleEl.removeAttribute("aria-controls");
      panelToggleEl.setAttribute("aria-expanded", "false");
      return;
    }

    panelToggleEl.hidden = false;
    panelToggleEl.setAttribute("aria-controls", controller.panel.id);
    panelToggleEl.setAttribute("aria-expanded", sidebarCollapsed ? "false" : "true");
    panelToggleEl.textContent = sidebarCollapsed ? "Show Panel" : "Show Detail";
    panelToggleEl.setAttribute("aria-label", sidebarCollapsed ? "Show entry panel" : "Show detail view");
  }

  function initializeTopbarPanelToggle() {
    if (!document.body || document.body.dataset.topbarPanelToggleReady === "1") {
      syncTopbarPanelToggleButton();
      return;
    }

    document.body.dataset.topbarPanelToggleReady = "1";
    getTopbarPanelToggleButton();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        syncTopbarPanelToggleButton();
      });
    });

    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "class"]
    });

    window.addEventListener("resize", () => {
      syncTopbarPanelToggleButton();
    });

    syncTopbarPanelToggleButton();
  }

  function scheduleAutoCollapse(layout) {
    if (!(layout instanceof HTMLElement)) {
      return;
    }

    window.requestAnimationFrame(() => {
      showDetailOnly(layout);
    });
  }

  function initializeSidebarAutoCollapse() {
    if (!document.body || document.body.dataset.sidebarAutoCollapseReady === "1") {
      return;
    }

    document.body.dataset.sidebarAutoCollapseReady = "1";

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const layout = getAutoCollapseLayoutFromTarget(target);
      if (!(layout instanceof HTMLElement)) {
        return;
      }

      scheduleAutoCollapse(layout);
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const layout = getAutoCollapseLayoutFromTarget(target);
      if (!(layout instanceof HTMLElement)) {
        return;
      }

      scheduleAutoCollapse(layout);
    }, true);
  }

  function initializeSidebarPopouts() {
    const layouts = document.querySelectorAll(".browse-layout, .kab-layout");

    layouts.forEach((layout, index) => {
      if (!(layout instanceof HTMLElement)) {
        return;
      }

      const panel = Array.from(layout.children).find((child) => (
        child instanceof HTMLElement
        && child.matches("aside.list-panel, aside.kab-tree-panel")
      ));

      if (!(panel instanceof HTMLElement) || panel.dataset.sidebarPopoutReady === "1") {
        return;
      }

      panel.dataset.sidebarPopoutReady = "1";

      const sectionId = layout.closest("section")?.id || `layout-${index + 1}`;
      const panelId = panel.id || `${sectionId}-entry-panel`;
      panel.id = panelId;

      const storageKey = `${SIDEBAR_COLLAPSE_STORAGE_PREFIX}${sectionId}`;

      const applyCollapsedState = (collapsed, persist = true) => {
        layout.classList.toggle("layout-sidebar-collapsed", collapsed);
        syncTopbarPanelToggleButton();

        if (persist) {
          saveSidebarCollapsedState(storageKey, collapsed);
        }
      };

      const controller = {
        layout,
        applyCollapsedState,
        panel,
        storageKey
      };

      sidebarControllers.set(layout, controller);
      sidebarControllerRegistry.set(layout, controller);

      const storedCollapsed = loadSidebarCollapsedState(storageKey);
      applyCollapsedState(storedCollapsed == null ? DEFAULT_DATASET_ENTRY_COLLAPSED : storedCollapsed, false);
    });

    syncTopbarPanelToggleButton();
  }

  function initializeDetailPopouts() {
    const layouts = document.querySelectorAll(".browse-layout, .kab-layout");

    layouts.forEach((layout, index) => {
      if (!(layout instanceof HTMLElement)) {
        return;
      }

      const detailPanel = Array.from(layout.children).find((child) => (
        child instanceof HTMLElement
        && child.matches("section.detail-panel")
      ));

      if (!(detailPanel instanceof HTMLElement) || detailPanel.dataset.detailPopoutReady === "1") {
        return;
      }

      detailPanel.dataset.detailPopoutReady = "1";

      const sectionId = layout.closest("section")?.id || `layout-${index + 1}`;
      const panelId = detailPanel.id || `${sectionId}-detail-panel`;
      detailPanel.id = panelId;
      ensureDetailPaneExportControl(detailPanel, sectionId);

      const detailStorageKey = `${DETAIL_COLLAPSE_STORAGE_PREFIX}${sectionId}`;
      const sidebarStorageKey = `${SIDEBAR_COLLAPSE_STORAGE_PREFIX}${sectionId}`;

      const applyCollapsedState = (collapsed, persist = true) => {
        if (collapsed && layout.classList.contains("layout-sidebar-collapsed")) {
          const sidebarController = sidebarControllers.get(layout);
          if (sidebarController) {
            sidebarController.applyCollapsedState(false, persist);
          } else {
            layout.classList.remove("layout-sidebar-collapsed");
            saveSidebarCollapsedState(sidebarStorageKey, false);
          }
        }

        layout.classList.toggle("layout-detail-collapsed", collapsed);
        detailPanel.setAttribute("aria-hidden", collapsed ? "true" : "false");
        syncTopbarPanelToggleButton();

        if (persist) {
          saveSidebarCollapsedState(detailStorageKey, collapsed);
        }
      };

      detailControllers.set(layout, {
        applyCollapsedState,
        detailPanel,
        detailStorageKey
      });

      const storedCollapsed = loadSidebarCollapsedState(detailStorageKey);
      const initialCollapsed = storedCollapsed == null ? DEFAULT_DATASET_DETAIL_COLLAPSED : storedCollapsed;
      applyCollapsedState(initialCollapsed, false);
    });
  }

  function sanitizeExportToken(value, fallback = "detail") {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
  }

  function canvasToWebpBlob(canvas, quality = 1) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("Detail pane export failed."));
      }, "image/webp", quality);
    });
  }

  async function exportDetailPaneAsWebp(detailPanel, sectionId, buttonEl = null) {
    if (!(detailPanel instanceof HTMLElement) || detailExportInProgress.has(detailPanel)) {
      return;
    }

    detailExportInProgress.add(detailPanel);
    const originalButtonLabel = buttonEl instanceof HTMLButtonElement ? buttonEl.textContent : "";
    if (buttonEl instanceof HTMLButtonElement) {
      buttonEl.disabled = true;
      buttonEl.textContent = "Exporting...";
    }

    let exportBlobUrl = "";
    let sandboxEl = null;

    try {
      let html2canvas = window.html2canvas;
      if (typeof html2canvas !== "function") {
        if (typeof window.TarotLazySections?.ensureHtml2Canvas === "function") {
          html2canvas = await window.TarotLazySections.ensureHtml2Canvas();
        }
      }
      if (typeof html2canvas !== "function") {
        throw new Error("Detail export library is unavailable. Refresh the page and try again.");
      }

      const exportClone = detailPanel.cloneNode(true);
      if (!(exportClone instanceof HTMLElement)) {
        throw new Error("Detail pane is not ready to export.");
      }

      const exportStripSelectors = [
        ".detail-sequence-nav",
        ".detail-pane-export-controls",
        ".alpha-text-reader-nav-btn",
        ".alpha-text-reader-panel",
        ".alpha-text-heading-tools",
        ".alpha-text-search-controls",
        ".alpha-text-controls--heading",
        ".alpha-text-reader-toggle-control",
        ".alpha-text-compare-toggle",
        ".alpha-text-translation-select",
        ".alpha-text-compare-select",
        ".alpha-text-work-select",
        ".alpha-text-section-select",
        ".detail-summary"
      ];

      exportStripSelectors.forEach((selector) => {
        exportClone.querySelectorAll(selector).forEach((node) => node.remove());
      });

      exportClone.querySelectorAll("*").forEach((node) => {
        if (node instanceof HTMLElement && node.hidden) {
          node.remove();
        }
      });

      exportClone.style.position = "fixed";
      exportClone.style.left = "-100000px";
      exportClone.style.top = "0";
      exportClone.style.visibility = "hidden";
      exportClone.style.width = "max-content";
      exportClone.style.maxWidth = "900px";
      exportClone.style.minWidth = "280px";
      exportClone.style.height = "auto";
      exportClone.style.overflow = "visible";
      exportClone.style.padding = "24px";
      exportClone.style.boxSizing = "border-box";
      document.body.appendChild(exportClone);

      const measureWidth = Math.ceil(exportClone.getBoundingClientRect().width || 280);
      document.body.removeChild(exportClone);

      exportClone.style.position = "";
      exportClone.style.left = "";
      exportClone.style.top = "";
      exportClone.style.visibility = "";

      sandboxEl = document.createElement("div");
      sandboxEl.style.position = "fixed";
      sandboxEl.style.left = "-100000px";
      sandboxEl.style.top = "0";
      sandboxEl.style.pointerEvents = "none";
      sandboxEl.style.opacity = "0";

      exportClone.style.width = `${measureWidth}px`;
      exportClone.style.minWidth = "";
      exportClone.style.maxWidth = "";
      exportClone.style.height = "auto";
      exportClone.style.minHeight = "";
      exportClone.style.maxHeight = "";
      exportClone.style.overflow = "visible";
      exportClone.style.padding = "24px";
      exportClone.style.boxSizing = "border-box";

      sandboxEl.appendChild(exportClone);
      document.body.appendChild(sandboxEl);

      const exportScale = 2;
      const canvas = await html2canvas(exportClone, {
        backgroundColor: "#0c0c12",
        scale: exportScale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 12000,
        onclone(clonedDocument) {
          clonedDocument.querySelectorAll(
            ".detail-sequence-nav, .detail-pane-export-controls, .alpha-text-reader-nav-btn, .alpha-text-reader-panel, .alpha-text-heading-tools, .alpha-text-search-controls, .alpha-text-controls--heading, .alpha-text-reader-toggle-control, .alpha-text-compare-toggle, .detail-summary"
          ).forEach((node) => node.remove());
          clonedDocument.querySelectorAll("*").forEach((node) => {
            if (node instanceof HTMLElement && node.hidden) {
              node.remove();
            }
          });
          const detailClone = clonedDocument.querySelector(".detail-panel");
          if (detailClone instanceof HTMLElement) {
            detailClone.style.padding = "24px";
            detailClone.style.boxSizing = "border-box";
            detailClone.style.width = "max-content";
            detailClone.style.maxWidth = "900px";
            detailClone.style.minWidth = "280px";
          }
        }
      });

      const exportBlob = await canvasToWebpBlob(canvas, 1);
      exportBlobUrl = URL.createObjectURL(exportBlob);

      const headingEl = detailPanel.querySelector("h1, h2, h3");
      const labelToken = sanitizeExportToken(headingEl?.textContent || detailPanel.id || "detail-pane", "detail-pane");
      const sectionToken = sanitizeExportToken(sectionId, "section");
      const dateToken = new Date().toISOString().slice(0, 10);

      const downloadLink = document.createElement("a");
      downloadLink.href = exportBlobUrl;
      downloadLink.download = `${sectionToken}-${labelToken}-${dateToken}.webp`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to export this detail pane.");
    } finally {
      detailExportInProgress.delete(detailPanel);
      if (buttonEl instanceof HTMLButtonElement) {
        buttonEl.disabled = false;
        buttonEl.textContent = originalButtonLabel || "Export WebP";
      }

      if (sandboxEl instanceof HTMLElement) {
        sandboxEl.remove();
      }

      if (exportBlobUrl) {
        URL.revokeObjectURL(exportBlobUrl);
      }
    }
  }

  function ensureDetailPaneExportControl(detailPanel, sectionId) {
    if (!(detailPanel instanceof HTMLElement) || detailPanel.querySelector(".detail-pane-export-controls")) {
      return;
    }

    const hostEl = detailPanel.querySelector(".detail-sequence-nav")
      || detailPanel.querySelector(".detail-heading")
      || detailPanel.querySelector(".kab-detail-heading")
      || detailPanel;
    if (!(hostEl instanceof HTMLElement)) {
      return;
    }

    const controlsEl = document.createElement("div");
    controlsEl.className = "detail-pane-export-controls";

    const exportButtonEl = document.createElement("button");
    exportButtonEl.type = "button";
    exportButtonEl.className = "detail-sequence-btn detail-export-btn";
    exportButtonEl.textContent = "Export WebP";
    exportButtonEl.addEventListener("click", () => {
      exportDetailPaneAsWebp(detailPanel, sectionId, exportButtonEl);
    });

    controlsEl.appendChild(exportButtonEl);
    hostEl.appendChild(controlsEl);
  }

  function setTopbarDropdownOpen(dropdownEl, isOpen) {
    if (!(dropdownEl instanceof HTMLElement)) {
      return;
    }

    dropdownEl.classList.toggle("is-open", Boolean(isOpen));
    const trigger = dropdownEl.querySelector("button[aria-haspopup='menu']");
    if (trigger) {
      trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  function getTopbarElements() {
    const topbarEl = document.querySelector(".topbar");
    const actionsEl = document.getElementById("topbar-actions");
    const menuToggleEl = document.getElementById("topbar-menu-toggle");
    const settingsToggleEl = document.getElementById("open-settings");
    const homeButtonEl = document.getElementById("open-home");

    return {
      topbarEl: topbarEl instanceof HTMLElement ? topbarEl : null,
      actionsEl: actionsEl instanceof HTMLElement ? actionsEl : null,
      menuToggleEl: menuToggleEl instanceof HTMLButtonElement ? menuToggleEl : null,
      settingsToggleEl: settingsToggleEl instanceof HTMLButtonElement ? settingsToggleEl : null,
      homeButtonEl: homeButtonEl instanceof HTMLButtonElement ? homeButtonEl : null
    };
  }

  function isDrawerMenuLayout() {
    return document.body?.dataset?.menuLayout === "drawer";
  }

  function setTopbarMenuOpen(isOpen) {
    const { topbarEl, menuToggleEl, homeButtonEl } = getTopbarElements();
    if (!(topbarEl instanceof HTMLElement) || !(menuToggleEl instanceof HTMLButtonElement)) {
      return;
    }

    const nextOpen = Boolean(isOpen);
    topbarEl.classList.toggle("is-menu-open", nextOpen);
    document.body.classList.toggle("topbar-menu-open", nextOpen);
    menuToggleEl.setAttribute("aria-expanded", nextOpen ? "true" : "false");
    menuToggleEl.textContent = nextOpen ? "Close" : "Menu";
    menuToggleEl.setAttribute("aria-label", nextOpen ? "Close navigation menu" : "Open navigation menu");

    // In drawer mode the brand button is the menu trigger, so it carries the state.
    if (homeButtonEl instanceof HTMLButtonElement) {
      if (isDrawerMenuLayout()) {
        homeButtonEl.setAttribute("aria-controls", "topbar-actions");
        homeButtonEl.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        homeButtonEl.setAttribute("aria-label", nextOpen ? "Close navigation menu" : "Open navigation menu");
      } else {
        homeButtonEl.removeAttribute("aria-controls");
        homeButtonEl.removeAttribute("aria-expanded");
        homeButtonEl.removeAttribute("aria-label");
      }
    }

    if (!nextOpen) {
      closeTopbarDropdowns();
    }
  }

  function bindTopbarMobileMenu() {
    const { topbarEl, actionsEl, menuToggleEl, settingsToggleEl } = getTopbarElements();
    if (!(topbarEl instanceof HTMLElement) || !(actionsEl instanceof HTMLElement) || !(menuToggleEl instanceof HTMLButtonElement)) {
      return;
    }

    if (menuToggleEl.dataset.mobileMenuReady === "1") {
      return;
    }

    menuToggleEl.dataset.mobileMenuReady = "1";
    setTopbarMenuOpen(false);

    menuToggleEl.addEventListener("click", (event) => {
      event.stopPropagation();
      const nextOpen = !topbarEl.classList.contains("is-menu-open");
      setTopbarMenuOpen(nextOpen);
    });

    // Capture on the bar so the brand button toggles the drawer instead of
    // reaching its own navigate-home listener.
    topbarEl.addEventListener("click", (event) => {
      if (!isDrawerMenuLayout()) {
        return;
      }

      const target = event.target instanceof Element ? event.target.closest("#open-home") : null;
      if (!target) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setTopbarMenuOpen(!topbarEl.classList.contains("is-menu-open"));
    }, true);

    if (settingsToggleEl instanceof HTMLButtonElement && settingsToggleEl.dataset.topbarSettingsReady !== "1") {
      settingsToggleEl.dataset.topbarSettingsReady = "1";
      settingsToggleEl.addEventListener("click", () => {
        setTopbarMenuOpen(false);
      });
    }

    actionsEl.addEventListener("click", (event) => {
      const button = event.target instanceof Element
        ? event.target.closest("button")
        : null;
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const isDropdownTrigger = button.getAttribute("aria-haspopup") === "menu";
      const isMenuItem = button.getAttribute("role") === "menuitem";

      if (!isDropdownTrigger || isMenuItem) {
        window.requestAnimationFrame(() => {
          setTopbarMenuOpen(false);
        });
      }
    });

    document.addEventListener("click", (event) => {
      const clickTarget = event.target;
      if (clickTarget instanceof Node && topbarEl.contains(clickTarget)) {
        return;
      }

      setTopbarMenuOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setTopbarMenuOpen(false);
      }
    });
  }

  function closeTopbarDropdowns(exceptEl = null) {
    const topbarDropdownEls = Array.from(document.querySelectorAll(".topbar-dropdown"));
    topbarDropdownEls.forEach((dropdownEl) => {
      if (exceptEl && dropdownEl === exceptEl) {
        return;
      }
      setTopbarDropdownOpen(dropdownEl, false);
    });
  }

  function bindTopbarDropdownInteractions() {
    const topbarDropdownEls = Array.from(document.querySelectorAll(".topbar-dropdown"));
    if (!topbarDropdownEls.length) {
      return;
    }

    topbarDropdownEls.forEach((dropdownEl) => {
      const trigger = dropdownEl.querySelector("button[aria-haspopup='menu']");
      if (!(trigger instanceof HTMLElement)) {
        return;
      }

      setTopbarDropdownOpen(dropdownEl, false);

      dropdownEl.addEventListener("focusout", (event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !dropdownEl.contains(nextTarget)) {
          setTopbarDropdownOpen(dropdownEl, false);
        }
      });

      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const nextOpen = !dropdownEl.classList.contains("is-open");
        closeTopbarDropdowns(dropdownEl);
        setTopbarDropdownOpen(dropdownEl, nextOpen);
      });

      const menuItems = dropdownEl.querySelectorAll(".topbar-dropdown-menu [role='menuitem']");
      menuItems.forEach((menuItem) => {
        menuItem.addEventListener("click", () => {
          closeTopbarDropdowns();
        });
      });
    });

    document.addEventListener("click", (event) => {
      const clickTarget = event.target;
      if (clickTarget instanceof Node && topbarDropdownEls.some((dropdownEl) => dropdownEl.contains(clickTarget))) {
        return;
      }

      closeTopbarDropdowns();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeTopbarDropdowns();
      }
    });
  }

  function init() {
    initializeSidebarPopouts();
    initializeDetailPopouts();
    initializeSidebarAutoCollapse();
    bindTopbarMobileMenu();
    bindTopbarDropdownInteractions();
    initializeTopbarPanelToggle();
  }

  window.TarotChromeUi = {
    ...(window.TarotChromeUi || {}),
    init,
    initializeSidebarPopouts,
    initializeDetailPopouts,
    initializeSidebarAutoCollapse,
    bindTopbarMobileMenu,
    initializeTopbarPanelToggle,
    setSidebarCollapsed,
    setDetailCollapsed,
    showDetailOnly,
    showSidebarOnly,
    setTopbarMenuOpen,
    setTopbarDropdownOpen,
    closeTopbarDropdowns,
    bindTopbarDropdownInteractions,
    exportDetailPaneAsWebp
  };
})();
