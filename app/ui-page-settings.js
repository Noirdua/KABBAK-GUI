(function () {
  "use strict";

  // Unified per-page settings button.
  //
  // Any page that has options/filters declares one button and one panel:
  //
  //   <button class="page-settings-btn" type="button"
  //           data-page-settings
  //           data-settings-panel="#my-panel"
  //           data-settings-title="My Page Settings">⚙ Settings</button>
  //   ...
  //   <div id="my-panel" hidden> ...controls... </div>
  //
  // This module opens the panel in the shared overlay (TaroOverlay.openPageSettings)
  // and toggles aria-expanded. It is delegated on the document, so dynamically
  // created pages work with the same markup and no extra wiring.
  // JS-built pages can call TaroPageSettings.createButton(...) to get the
  // exact same control.

  // Only a plain #id is accepted, and only inside the page that owns the
  // trigger. User-authored content can carry data-* attributes, so a global
  // selector here would let injected markup hide or relocate arbitrary app DOM.
  const SIMPLE_ID = /^#[A-Za-z][\w-]*$/;

  function resolvePanel(button) {
    const selector = String(button?.getAttribute?.("data-settings-panel") || "").trim();
    if (!SIMPLE_ID.test(selector)) return null;
    const scope = button.closest("section, [data-settings-scope]") || document;
    const panel = scope.querySelector(selector);
    return panel instanceof HTMLElement ? panel : null;
  }

  function openFor(button) {
    if (!(button instanceof HTMLElement)) return false;
    const panel = resolvePanel(button);
    if (!(panel instanceof HTMLElement)) return false;
    if (typeof window.TaroOverlay?.openPageSettings !== "function") return false;

    window.TaroOverlay.openPageSettings({
      title: String(button.getAttribute("data-settings-title") || "Settings"),
      panel,
      trigger: button,
      restoreTo: panel.parentElement,
      onClose: () => {
        button.dispatchEvent(new CustomEvent("page-settings:closed", { bubbles: true }));
      }
    });
    return true;
  }

  function createButton({
    id = "",
    label = "Settings",
    panelId = "",
    title = "Settings",
    className = ""
  } = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `page-settings-btn${className ? ` ${className}` : ""}`;
    if (id) button.id = String(id);
    button.setAttribute("data-page-settings", "");
    if (panelId) {
      const selector = String(panelId).startsWith("#") ? String(panelId) : `#${panelId}`;
      button.setAttribute("data-settings-panel", selector);
    }
    button.setAttribute("data-settings-title", String(title));
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");

    const icon = document.createElement("span");
    icon.className = "page-settings-btn-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "⚙";
    const text = document.createElement("span");
    text.textContent = String(label);
    button.append(icon, text);
    return button;
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-page-settings]")
      : null;
    if (!(target instanceof HTMLElement)) return;
    if (openFor(target)) {
      event.preventDefault();
    }
  });

  window.TaroPageSettings = { createButton, openFor };
})();
