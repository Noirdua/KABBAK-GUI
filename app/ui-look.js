(function () {
  "use strict";

  const STORAGE_KEY = "tarot-time-app-look-v1";
  const LOOKS = [
    { id: "default", name: "Classic", description: "Standard KABBAK chrome. Palettes retint every look." },
    { id: "neon", name: "Neon", description: "LED scanlines, glow, and a night-club HUD." },
    { id: "wood", name: "Wood", description: "Carved walnut panels and brass edges." },
    { id: "paper", name: "Paper", description: "Parchment, ink, and a bound-codex feel." },
    { id: "stone", name: "Stone", description: "Cut slate blocks and carved inscriptions." },
    { id: "velvet", name: "Velvet", description: "Deep velvet halls with gold trim." }
  ];
  let activeLookId = "default";

  function persistLook(lookId) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lookId);
    } catch (_error) {}
  }

  function loadLook() {
    try {
      return String(window.localStorage.getItem(STORAGE_KEY) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function applyLook(lookId, options = {}) {
    const look = LOOKS.find((entry) => entry.id === lookId) || LOOKS[0];
    activeLookId = look.id;
    if (!document.body) return look;
    if (look.id === "default") {
      delete document.body.dataset.appLook;
      const menuTheme = window.TaroTimeMenuPlugin?.getConfig?.()?.menuTheme;
      if (menuTheme && menuTheme !== "default") {
        document.body.dataset.menuTheme = menuTheme;
      } else {
        delete document.body.dataset.menuTheme;
      }
    } else {
      document.body.dataset.appLook = look.id;
      delete document.body.dataset.menuTheme;
    }
    if (options.persist !== false) persistLook(look.id);
    renderLookList();
    return look;
  }

  function renderLookList() {
    const listEl = document.getElementById("look-preset-list");
    if (!listEl) return;
    listEl.replaceChildren();
    LOOKS.forEach((look) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "look-preset-option";
      button.classList.toggle("is-active", look.id === activeLookId);
      button.dataset.lookId = look.id;
      const preview = document.createElement("div");
      preview.className = `look-preset-preview is-${look.id}`;
      button.appendChild(preview);
      const name = document.createElement("strong");
      name.textContent = look.name;
      button.appendChild(name);
      const desc = document.createElement("small");
      desc.textContent = look.description;
      button.appendChild(desc);
      button.addEventListener("click", () => applyLook(look.id));
      listEl.appendChild(button);
    });
  }

  applyLook(loadLook() || "default", { persist: false });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderLookList, { once: true });
  } else {
    renderLookList();
  }

  window.TarotUiLook = {
    LOOKS,
    getActiveLookId: () => activeLookId,
    applyLook
  };
})();
