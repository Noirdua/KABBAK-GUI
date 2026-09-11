(function () {
  "use strict";

  // Generic overlay used by the app and by DLC plugins (via helpers.overlay).
  // One overlay at a time; Escape and backdrop click dismiss when allowed.
  let active = null;

  function close() {
    if (!active) return;
    const { overlay, onKeydown, onClose } = active;
    active = null;
    document.removeEventListener("keydown", onKeydown, true);
    overlay.remove();
    if (typeof onClose === "function") {
      try {
        onClose();
      } catch (_error) {
        // A close handler must never break teardown.
      }
    }
  }

  function open(options = {}) {
    close();
    const {
      title = "",
      body = null,
      actions = [],
      size = "medium",
      dismissible = true,
      showClose = true,
      className = "",
      onClose = null
    } = options || {};

    const overlay = document.createElement("div");
    overlay.className = `taro-overlay taro-overlay--${size}${className ? ` ${className}` : ""}`;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    if (title) {
      overlay.setAttribute("aria-label", String(title));
    }

    const panel = document.createElement("div");
    panel.className = "taro-overlay-panel";

    const head = document.createElement("div");
    head.className = "taro-overlay-head";
    const heading = document.createElement("strong");
    heading.className = "taro-overlay-title";
    heading.textContent = String(title || "");
    head.appendChild(heading);

    const bodyEl = document.createElement("div");
    bodyEl.className = "taro-overlay-body";
    if (body instanceof Node) {
      bodyEl.appendChild(body);
    } else if (typeof body === "string" && body) {
      bodyEl.innerHTML = body;
    }

    const footer = document.createElement("div");
    footer.className = "taro-overlay-actions";

    const controller = {
      overlay,
      panel,
      body: bodyEl,
      footer,
      close,
      setTitle(text) {
        heading.textContent = String(text || "");
      }
    };

    if (showClose) {
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "taro-overlay-close";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.title = "Close (Esc)";
      closeBtn.textContent = "✕";
      closeBtn.addEventListener("click", close);
      head.appendChild(closeBtn);
    }

    (Array.isArray(actions) ? actions : []).forEach((action) => {
      if (!action) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "taro-overlay-btn"
        + (action.primary ? " is-primary" : "")
        + (action.danger ? " is-danger" : "");
      button.textContent = String(action.label || "OK");
      if (action.disabled) {
        button.disabled = true;
      }
      button.addEventListener("click", () => {
        const result = typeof action.onClick === "function" ? action.onClick(controller) : undefined;
        if (action.closeOnClick !== false && result !== false) {
          close();
        }
      });
      footer.appendChild(button);
    });

    panel.appendChild(head);
    panel.appendChild(bodyEl);
    if (footer.childElementCount) {
      panel.appendChild(footer);
    }
    overlay.appendChild(panel);

    const onKeydown = (event) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeydown, true);

    if (dismissible) {
      overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) {
          close();
        }
      });
    }

    document.body.appendChild(overlay);
    active = { overlay, onKeydown, onClose };
    return controller;
  }

  function isOpen() {
    return Boolean(active);
  }

  window.TaroOverlay = { open, close, isOpen };
})();
