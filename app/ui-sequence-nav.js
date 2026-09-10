(function () {
  "use strict";

  function normalizeSequenceState(sequence) {
    return {
      total: Math.max(0, Number(sequence?.total) || 0),
      currentIndex: Number.isFinite(Number(sequence?.currentIndex)) ? Number(sequence.currentIndex) : -1,
      previousKey: String(sequence?.previousKey ?? sequence?.previousId ?? "").trim(),
      nextKey: String(sequence?.nextKey ?? sequence?.nextId ?? "").trim()
    };
  }

  function isEditableKeyTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || target.isContentEditable
      || Boolean(target.closest("[contenteditable='true']"));
  }

  function hasOpenModalDialog() {
    return Boolean(document.querySelector("[role='dialog'][aria-modal='true'][aria-hidden='false']"));
  }

  function isHiddenElement(element) {
    if (!(element instanceof HTMLElement)) {
      return true;
    }

    if (element.hidden || element.getAttribute("aria-hidden") === "true") {
      return true;
    }

    return false;
  }

  function getAutoSequenceOptions(listEl) {
    if (!(listEl instanceof HTMLElement)) {
      return [];
    }

    return Array.from(listEl.querySelectorAll("[role='option']"))
      .filter((option) => option instanceof HTMLElement)
      .filter((option) => !isHiddenElement(option));
  }

  function getAutoSelectedIndex(options) {
    const selectedIndex = options.findIndex((option) => {
      if (!(option instanceof HTMLElement)) {
        return false;
      }

      return option.getAttribute("aria-selected") === "true"
        || option.classList.contains("is-selected");
    });

    return selectedIndex;
  }

  function createAutomaticSequenceControls(sectionEl, headingEl) {
    if (!(headingEl instanceof HTMLElement)) {
      return null;
    }

    if (headingEl.querySelector(".detail-sequence-nav")
      || sectionEl?.querySelector(".detail-panel .detail-sequence-nav")) {
      return null;
    }

    const titleText = String(headingEl.querySelector("h2")?.textContent || "items").trim() || "items";
    const normalizedTitle = titleText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const sectionId = String(sectionEl?.id || "section").trim() || "section";
    const navPrefix = `${sectionId}-${normalizedTitle || "items"}`;

    const navEl = document.createElement("div");
    navEl.className = "detail-sequence-nav";
    navEl.dataset.autoSequenceNav = "true";
    navEl.setAttribute("aria-label", `Browse ${titleText}`);

    const prevButton = document.createElement("button");
    prevButton.type = "button";
    prevButton.id = `${navPrefix}-detail-prev-auto`;
    prevButton.className = "detail-sequence-btn";
    prevButton.textContent = "Back";
    prevButton.setAttribute("aria-label", `Previous ${titleText}`);

    const positionEl = document.createElement("div");
    positionEl.id = `${navPrefix}-detail-position-auto`;
    positionEl.className = "detail-sequence-position";
    positionEl.setAttribute("aria-live", "polite");
    positionEl.textContent = "--";

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.id = `${navPrefix}-detail-next-auto`;
    nextButton.className = "detail-sequence-btn";
    nextButton.textContent = "Next";
    nextButton.setAttribute("aria-label", `Next ${titleText}`);

    navEl.append(prevButton, positionEl, nextButton);

    const summaryEl = headingEl.querySelector(".detail-summary");
    if (summaryEl && summaryEl.parentElement === headingEl) {
      headingEl.insertBefore(navEl, summaryEl);
    } else {
      headingEl.appendChild(navEl);
    }

    return {
      sectionEl,
      listEl: sectionEl.querySelector(".list-panel [role='listbox']"),
      prevButton,
      nextButton,
      positionEl
    };
  }

  const automaticNavigators = new WeakMap();
  let autoScanObserver = null;
  let autoScanQueued = false;
  let autoNavigationEnabled = false;

  function createAutomaticNavigatorForSection(sectionEl) {
    if (!(sectionEl instanceof HTMLElement) || automaticNavigators.has(sectionEl)) {
      return;
    }

    const listEl = sectionEl.querySelector(".list-panel [role='listbox']");
    const headingEl = sectionEl.querySelector(".detail-panel .detail-heading");
    if (!(listEl instanceof HTMLElement) || !(headingEl instanceof HTMLElement)) {
      return;
    }

    if (headingEl.querySelector(".detail-sequence-nav")
      || sectionEl.querySelector(".detail-panel .detail-sequence-nav")) {
      return;
    }

    const controls = createAutomaticSequenceControls(sectionEl, headingEl);
    if (!controls || !(controls.listEl instanceof HTMLElement)) {
      return;
    }

    const navigator = createSequenceNavigator({
      getElements: () => controls,
      isActive: (elements) => Boolean(elements?.sectionEl && elements.sectionEl.hidden === false),
      getSequenceState: () => {
        const options = getAutoSequenceOptions(controls.listEl);
        const total = options.length;
        const currentIndex = getAutoSelectedIndex(options);

        if (!total) {
          return {
            total: 0,
            currentIndex: -1,
            previousKey: "",
            nextKey: ""
          };
        }

        return {
          total,
          currentIndex,
          previousKey: currentIndex > 0 ? String(currentIndex - 1) : "",
          nextKey: currentIndex >= 0 && currentIndex < total - 1
            ? String(currentIndex + 1)
            : currentIndex < 0
              ? "0"
              : ""
        };
      },
      getPrevButton: (elements) => elements?.prevButton,
      getNextButton: (elements) => elements?.nextButton,
      getPositionEl: (elements) => elements?.positionEl,
      formatPositionText: ({ total, currentIndex }) => {
        if (total > 0 && currentIndex >= 0) {
          return `${currentIndex + 1} of ${total}`;
        }

        return total > 0 ? `${total} items` : "No items";
      },
      selectTarget: (targetKey) => {
        const options = getAutoSequenceOptions(controls.listEl);
        const targetIndex = Number(targetKey);
        if (!Number.isFinite(targetIndex) || targetIndex < 0 || targetIndex >= options.length) {
          return false;
        }

        const targetOption = options[targetIndex];
        if (!(targetOption instanceof HTMLElement)) {
          return false;
        }

        if (targetOption instanceof HTMLButtonElement && targetOption.disabled) {
          return false;
        }

        targetOption.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        }));

        return true;
      },
      afterSelect: (targetKey) => {
        const options = getAutoSequenceOptions(controls.listEl);
        const targetIndex = Number(targetKey);
        if (!Number.isFinite(targetIndex) || targetIndex < 0 || targetIndex >= options.length) {
          return;
        }

        const targetOption = options[targetIndex];
        if (targetOption instanceof HTMLElement) {
          targetOption.scrollIntoView({ block: "nearest" });
        }
      }
    });

    navigator.bind(controls);

    const listObserver = new MutationObserver(() => {
      navigator.sync(controls);
    });

    listObserver.observe(controls.listEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-selected", "class", "hidden", "aria-hidden"]
    });

    automaticNavigators.set(sectionEl, {
      controls,
      navigator,
      listObserver
    });
  }

  function scanForAutomaticNavigators() {
    document.querySelectorAll("section").forEach((sectionEl) => {
      createAutomaticNavigatorForSection(sectionEl);
    });
  }

  function queueAutomaticNavigationScan() {
    if (autoScanQueued) {
      return;
    }

    autoScanQueued = true;
    window.requestAnimationFrame(() => {
      autoScanQueued = false;
      scanForAutomaticNavigators();
    });
  }

  function enableAutomaticSequenceNavigation() {
    if (!autoNavigationEnabled) {
      autoNavigationEnabled = true;

      if (document.body && !autoScanObserver) {
        autoScanObserver = new MutationObserver(() => {
          queueAutomaticNavigationScan();
        });

        autoScanObserver.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    }

    // Always rescan so lazy-loaded sections (Elements/Gods/etc.) pick up nav.
    scanForAutomaticNavigators();
  }

  function createSequenceNavigator(config = {}) {
    const getElements = typeof config.getElements === "function"
      ? config.getElements
      : () => ({});

    let buttonsBound = false;
    let keyboardBound = false;

    function getSequenceState() {
      return normalizeSequenceState(
        typeof config.getSequenceState === "function"
          ? config.getSequenceState()
          : null
      );
    }

    function getPrevButton(elements) {
      return typeof config.getPrevButton === "function" ? config.getPrevButton(elements) : null;
    }

    function getNextButton(elements) {
      return typeof config.getNextButton === "function" ? config.getNextButton(elements) : null;
    }

    function getPositionEl(elements) {
      return typeof config.getPositionEl === "function" ? config.getPositionEl(elements) : null;
    }

    function isActive(elements) {
      return typeof config.isActive === "function" ? config.isActive(elements) !== false : true;
    }

    function getTargetKey(sequence, offset) {
      return offset < 0 ? sequence.previousKey : sequence.nextKey;
    }

    function formatPositionText(sequence, elements) {
      return typeof config.formatPositionText === "function"
        ? String(config.formatPositionText(sequence, elements) || "")
        : "";
    }

    function selectTarget(targetKey, elements, offset) {
      if (!targetKey || typeof config.selectTarget !== "function") {
        return false;
      }

      return config.selectTarget(targetKey, elements, offset) !== false;
    }

    function afterSelect(targetKey, elements, offset) {
      if (typeof config.afterSelect === "function") {
        config.afterSelect(targetKey, elements, offset);
      }
    }

    function shouldHandleKeyEvent(event, elements) {
      if (!isActive(elements)) {
        return false;
      }

      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return false;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return false;
      }

      if (hasOpenModalDialog()) {
        return false;
      }

      return !isEditableKeyTarget(event.target);
    }

    function sync(elements = getElements()) {
      const sequence = getSequenceState();
      const previousKey = getTargetKey(sequence, -1);
      const nextKey = getTargetKey(sequence, 1);
      const prevButton = getPrevButton(elements);
      const nextButton = getNextButton(elements);
      const positionEl = getPositionEl(elements);

      if (prevButton) {
        prevButton.disabled = !previousKey;
      }

      if (nextButton) {
        nextButton.disabled = !nextKey;
      }

      if (positionEl) {
        positionEl.textContent = formatPositionText(sequence, elements);
      }
    }

    function step(offset, elements = getElements()) {
      const sequence = getSequenceState();
      const targetKey = getTargetKey(sequence, offset);
      if (!targetKey) {
        return false;
      }

      const didSelect = selectTarget(targetKey, elements, offset);
      if (didSelect) {
        afterSelect(targetKey, elements, offset);
      }

      return didSelect;
    }

    function bind(elements = getElements()) {
      if (!buttonsBound) {
        getPrevButton(elements)?.addEventListener("click", () => {
          step(-1, getElements());
        });

        getNextButton(elements)?.addEventListener("click", () => {
          step(1, getElements());
        });

        buttonsBound = true;
      }

      if (!keyboardBound) {
        document.addEventListener("keydown", (event) => {
          const latestElements = getElements();
          if (!shouldHandleKeyEvent(event, latestElements)) {
            return;
          }

          const offset = event.key === "ArrowRight" ? 1 : -1;
          const sequence = getSequenceState();
          if (!getTargetKey(sequence, offset)) {
            return;
          }

          event.preventDefault();
          step(offset, latestElements);
        });

        keyboardBound = true;
      }

      sync(elements);
    }

    return {
      bind,
      step,
      sync,
      getSequenceState
    };
  }

  window.TarotSequenceNav = {
    ...(window.TarotSequenceNav || {}),
    createSequenceNavigator,
    enableAutomaticSequenceNavigation
  };

  enableAutomaticSequenceNavigation();
})();