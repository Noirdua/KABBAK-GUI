/* ui-theme.js — color theme presets plus user-created/saved custom themes.
 * Applies by setting the --tt-* CSS custom properties (defined in styles.css)
 * inline on <html>. Clearing the overrides restores the "Midnight" defaults
 * baked into styles.css, so the default look never depends on this script.
 */
(function () {
  "use strict";

  const ACTIVE_THEME_STORAGE_KEY = "tarot-time-active-theme-v1";
  const CUSTOM_THEMES_STORAGE_KEY = "tarot-time-custom-themes-v1";
  const DEFAULT_THEME_ID = "midnight";

  // Base tokens a theme (built-in or custom) must supply. Every other --tt-*
  // variable is derived from these so the create-your-own UI only needs a
  // handful of pickers instead of the full ~20-token palette.
  const BASE_TOKEN_KEYS = ["bg", "surface", "border", "text", "muted", "accent", "brand"];

  const BUILT_IN_THEMES = [
    {
      id: "midnight",
      name: "Midnight",
      description: "The original KABBAK palette: zinc grays with an indigo accent and gold brand mark.",
      base: { bg: "#18181b", surface: "#27272a", border: "#3f3f46", text: "#f4f4f5", muted: "#a1a1aa", accent: "#6366f1", brand: "#fbbf24" }
    },
    {
      id: "amethyst",
      name: "Amethyst",
      description: "Deep violet surfaces with a bright fuchsia accent.",
      base: { bg: "#1a1625", surface: "#2b2340", border: "#4c3d6b", text: "#f5f0ff", muted: "#b3a3d6", accent: "#a855f7", brand: "#f0abfc" }
    },
    {
      id: "emerald",
      name: "Emerald",
      description: "Forest greens with a warm gold brand mark.",
      base: { bg: "#0f1912", surface: "#1b2b20", border: "#335140", text: "#eafff2", muted: "#9fc9ac", accent: "#10b981", brand: "#facc15" }
    },
    {
      id: "crimson",
      name: "Crimson",
      description: "Charcoal reds with a bold scarlet accent.",
      base: { bg: "#1a1214", surface: "#2b1c1f", border: "#5a2f35", text: "#ffeef0", muted: "#d9a3ac", accent: "#ef4444", brand: "#fbbf24" }
    },
    {
      id: "ocean",
      name: "Ocean",
      description: "Deep-sea blues with a bright cyan brand mark.",
      base: { bg: "#0d1620", surface: "#16283a", border: "#2c4a63", text: "#eaf6ff", muted: "#9fc3dd", accent: "#0ea5e9", brand: "#67e8f9" }
    },
    {
      id: "solar",
      name: "Solar",
      description: "Warm amber surfaces for a sunlit take on the same layout.",
      base: { bg: "#1c1608", surface: "#2e2410", border: "#5c4a1e", text: "#fff8e6", muted: "#d9c48a", accent: "#f59e0b", brand: "#fde047" }
    },
    {
      id: "matrix",
      name: "Matrix",
      description: "Phosphor green on black, CRT terminal palette.",
      base: { bg: "#03140a", surface: "#0a2414", border: "#14532d", text: "#d1fae5", muted: "#6ee7b7", accent: "#22c55e", brand: "#86efac" }
    }
  ];

  let state = {
    customThemes: [],
    activeThemeId: DEFAULT_THEME_ID
  };

  function clamp01(value) {
    return Math.min(1, Math.max(0, value));
  }

  function normalizeHexColor(value, fallback) {
    const normalized = String(value || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback;
  }

  function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex, "#000000").slice(1);
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function rgbToHex({ r, g, b }) {
    const toByte = (channel) => Math.round(clamp01(channel / 255) * 255).toString(16).padStart(2, "0");
    return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
  }

  // Linear-blends hexA toward hexB by percentB (0-100). Used to derive the
  // full ~20-token palette from the small set of colors a theme defines.
  function mixHex(hexA, hexB, percentB) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    const weight = clamp01(percentB / 100);
    return rgbToHex({
      r: a.r + (b.r - a.r) * weight,
      g: a.g + (b.g - a.g) * weight,
      b: a.b + (b.b - a.b) * weight
    });
  }

  function normalizeBaseTokens(base) {
    const defaults = BUILT_IN_THEMES[0].base;
    return BASE_TOKEN_KEYS.reduce((result, key) => {
      result[key] = normalizeHexColor(base?.[key], defaults[key]);
      return result;
    }, {});
  }

  // Expands the 7 base tokens into the full set of --tt-* CSS variables.
  function deriveThemeTokens(rawBase) {
    const base = normalizeBaseTokens(rawBase);
    const white = "#ffffff";
    const black = "#000000";

    return {
      "page-bg": mixHex(base.bg, black, 25),
      bg: base.bg,
      "bg-deep": mixHex(base.bg, black, 12),
      "bg-deepest": mixHex(base.bg, black, 38),
      surface: base.surface,
      "surface-alt": mixHex(base.surface, white, 14),
      border: base.border,
      "border-soft": mixHex(base.border, white, 22),
      text: base.text,
      "text-bright": mixHex(base.text, white, 35),
      "text-soft": mixHex(base.text, base.muted, 35),
      "text-softer": mixHex(base.text, base.muted, 18),
      "text-cool": mixHex(base.muted, base.accent, 30),
      "text-cool-bright": mixHex(base.text, base.accent, 16),
      "text-muted": base.muted,
      "text-dim": mixHex(base.muted, base.bg, 30),
      accent: base.accent,
      "accent-strong": mixHex(base.accent, white, 22),
      "accent-soft": mixHex(base.accent, white, 40),
      "accent-pale": mixHex(base.accent, white, 78),
      brand: base.brand,
      "scroll-track": mixHex(base.bg, black, 38),
      "scroll-thumb": base.border,
      "scroll-thumb-hover": base.accent
    };
  }

  function readJsonFromStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function writeJsonToStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function normalizeCustomThemeRecord(entry) {
    const id = String(entry?.id || "").trim();
    const name = String(entry?.name || "").trim().slice(0, 40);
    if (!id || !name) {
      return null;
    }

    return {
      id,
      name,
      base: normalizeBaseTokens(entry?.base),
      createdAt: String(entry?.createdAt || new Date().toISOString())
    };
  }

  function loadCustomThemes() {
    const raw = readJsonFromStorage(CUSTOM_THEMES_STORAGE_KEY, []);
    state.customThemes = Array.isArray(raw)
      ? raw.map(normalizeCustomThemeRecord).filter(Boolean)
      : [];
  }

  function persistCustomThemes() {
    return writeJsonToStorage(CUSTOM_THEMES_STORAGE_KEY, state.customThemes);
  }

  function loadActiveThemeId() {
    const stored = String(window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || "").trim();
    state.activeThemeId = stored || DEFAULT_THEME_ID;
  }

  function persistActiveThemeId(themeId) {
    try {
      window.localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, themeId);
    } catch {
      // Ignore storage failures (private browsing, quota, etc.) — the theme
      // still applies for this session via the in-memory state.
    }
  }

  function findCustomTheme(themeId) {
    return state.customThemes.find((theme) => theme.id === themeId) || null;
  }

  function resolveThemeById(themeId) {
    const builtIn = BUILT_IN_THEMES.find((theme) => theme.id === themeId);
    if (builtIn) {
      return builtIn;
    }

    const custom = findCustomTheme(themeId);
    return custom ? { ...custom, isCustom: true } : null;
  }

  function clearThemeOverrides() {
    const rootStyle = document.documentElement.style;
    Object.keys(deriveThemeTokens(BUILT_IN_THEMES[0].base)).forEach((tokenKey) => {
      rootStyle.removeProperty(`--tt-${tokenKey}`);
    });
  }

  function applyThemeTokens(base) {
    const tokens = deriveThemeTokens(base);
    const rootStyle = document.documentElement.style;
    Object.entries(tokens).forEach(([tokenKey, value]) => {
      rootStyle.setProperty(`--tt-${tokenKey}`, value);
    });
  }

  function applyThemeById(themeId, options = {}) {
    const { persist = true } = options;
    const normalizedId = String(themeId || "").trim() || DEFAULT_THEME_ID;

    if (normalizedId === DEFAULT_THEME_ID) {
      clearThemeOverrides();
    } else {
      const theme = resolveThemeById(normalizedId);
      if (!theme) {
        // Unknown theme (e.g. a deleted custom theme referenced by a stale
        // saved id) — fall back to the default rather than showing nothing.
        clearThemeOverrides();
        state.activeThemeId = DEFAULT_THEME_ID;
        if (persist) {
          persistActiveThemeId(DEFAULT_THEME_ID);
        }
        return DEFAULT_THEME_ID;
      }
      applyThemeTokens(theme.base);
    }

    state.activeThemeId = normalizedId;
    if (persist) {
      persistActiveThemeId(normalizedId);
    }
    return normalizedId;
  }

  function hasStoredActiveTheme() {
    try {
      return Boolean(String(window.localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || "").trim());
    } catch {
      return false;
    }
  }

  function registerServerTheme(themeConfig = null) {
    if (!themeConfig || typeof themeConfig !== "object") {
      return null;
    }

    const base = normalizeBaseTokens(themeConfig.base || themeConfig);
    const name = String(themeConfig.name || "Server Theme").trim().slice(0, 40) || "Server Theme";
    const preferredId = String(themeConfig.id || "server-default").trim().toLowerCase() || "server-default";
    const id = preferredId.startsWith("custom-") || preferredId.startsWith("server-")
      ? preferredId
      : `server-${preferredId}`;

    const record = {
      id,
      name,
      base,
      createdAt: new Date().toISOString(),
      isServerDefault: true
    };

    state.customThemes = [
      ...state.customThemes.filter((theme) => theme.id !== record.id && theme.isServerDefault !== true),
      record
    ];
    // Do not persist server-injected themes into custom theme storage.
    return record;
  }

  function applyServerThemeDefaults(defaults = null, options = {}) {
    const { onlyIfUnset = true } = options;
    if (onlyIfUnset && hasStoredActiveTheme()) {
      return getActiveThemeId();
    }

    const source = defaults && typeof defaults === "object" ? defaults : {};
    if (source.theme && typeof source.theme === "object") {
      const registered = registerServerTheme(source.theme);
      if (registered) {
        return applyThemeById(registered.id, { persist: onlyIfUnset });
      }
    }

    const themeId = String(source.themeId || source.theme || "").trim();
    if (!themeId) {
      return getActiveThemeId();
    }

    return applyThemeById(themeId, { persist: onlyIfUnset });
  }

  function previewThemeTokens(base) {
    applyThemeTokens(base);
  }

  function getAllThemeOptions() {
    return [
      ...BUILT_IN_THEMES.map((theme) => ({ ...theme, isCustom: false })),
      ...state.customThemes.map((theme) => ({ ...theme, isCustom: true }))
    ];
  }

  function slugifyThemeName(name) {
    const base = String(name || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return base || "custom-theme";
  }

  function generateCustomThemeId(name) {
    const slug = slugifyThemeName(name);
    let candidate = `custom-${slug}`;
    let suffix = 2;
    while (BUILT_IN_THEMES.some((theme) => theme.id === candidate) || findCustomTheme(candidate)) {
      candidate = `custom-${slug}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  function saveCustomTheme(name, base, existingId = "") {
    const normalizedName = String(name || "").trim().slice(0, 40);
    if (!normalizedName) {
      return { ok: false, message: "Enter a name for this theme before saving." };
    }

    const normalizedBase = normalizeBaseTokens(base);
    const existing = existingId ? findCustomTheme(existingId) : null;
    const record = {
      id: existing ? existing.id : generateCustomThemeId(normalizedName),
      name: normalizedName,
      base: normalizedBase,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    };

    state.customThemes = [...state.customThemes.filter((theme) => theme.id !== record.id), record];
    persistCustomThemes();
    return { ok: true, theme: record };
  }

  function deleteCustomTheme(themeId) {
    const normalizedId = String(themeId || "").trim();
    if (!normalizedId) {
      return false;
    }

    const existed = state.customThemes.some((theme) => theme.id === normalizedId);
    state.customThemes = state.customThemes.filter((theme) => theme.id !== normalizedId);
    persistCustomThemes();

    if (existed && state.activeThemeId === normalizedId) {
      applyThemeById(DEFAULT_THEME_ID);
    }

    return existed;
  }

  function getActiveThemeId() {
    return state.activeThemeId;
  }

  function getActiveThemeBase() {
    const theme = resolveThemeById(state.activeThemeId);
    return theme ? theme.base : BUILT_IN_THEMES[0].base;
  }

  // --- Settings-page editor wiring -----------------------------------------

  const COLOR_INPUT_IDS_BY_TOKEN = {
    bg: "theme-color-bg",
    surface: "theme-color-surface",
    border: "theme-color-border",
    text: "theme-color-text",
    muted: "theme-color-muted",
    accent: "theme-color-accent",
    brand: "theme-color-brand"
  };

  // Tracks which custom theme (if any) the editor's colors currently match,
  // so "Update This Theme" only appears once an existing custom theme is loaded.
  let editingCustomThemeId = "";

  function getEditorElements() {
    return {
      presetListEl: document.getElementById("theme-preset-list"),
      nameInputEl: document.getElementById("theme-custom-name"),
      saveNewBtnEl: document.getElementById("theme-save-new-btn"),
      updateBtnEl: document.getElementById("theme-update-btn"),
      resetBtnEl: document.getElementById("theme-reset-btn"),
      statusEl: document.getElementById("theme-custom-status"),
      colorInputEls: BASE_TOKEN_KEYS.reduce((result, tokenKey) => {
        result[tokenKey] = document.getElementById(COLOR_INPUT_IDS_BY_TOKEN[tokenKey]);
        return result;
      }, {})
    };
  }

  function setEditorStatus(message) {
    const { statusEl } = getEditorElements();
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  function readEditorBaseTokens() {
    const { colorInputEls } = getEditorElements();
    return normalizeBaseTokens(BASE_TOKEN_KEYS.reduce((result, tokenKey) => {
      result[tokenKey] = colorInputEls[tokenKey]?.value;
      return result;
    }, {}));
  }

  function syncEditorInputsFromBase(base) {
    const { colorInputEls } = getEditorElements();
    const normalized = normalizeBaseTokens(base);
    BASE_TOKEN_KEYS.forEach((tokenKey) => {
      if (colorInputEls[tokenKey]) {
        colorInputEls[tokenKey].value = normalized[tokenKey];
      }
    });
  }

  function syncUpdateButtonVisibility() {
    const { updateBtnEl } = getEditorElements();
    if (!updateBtnEl) {
      return;
    }
    const editingTheme = editingCustomThemeId ? findCustomTheme(editingCustomThemeId) : null;
    updateBtnEl.hidden = !editingTheme;
    if (editingTheme) {
      updateBtnEl.textContent = `Update "${editingTheme.name}"`;
    }
  }

  function createColorSwatchPreview(base) {
    const swatchEl = document.createElement("div");
    swatchEl.className = "theme-preset-swatch";
    ["bg", "surface", "accent", "brand"].forEach((tokenKey) => {
      const chipEl = document.createElement("span");
      chipEl.style.background = base[tokenKey];
      swatchEl.appendChild(chipEl);
    });
    return swatchEl;
  }

  function createPresetOptionButton(theme, isActive) {
    const buttonEl = document.createElement("button");
    buttonEl.type = "button";
    buttonEl.className = "theme-preset-option";
    buttonEl.classList.toggle("is-active", isActive);
    buttonEl.setAttribute("role", "radio");
    buttonEl.setAttribute("aria-checked", isActive ? "true" : "false");
    buttonEl.dataset.themeId = theme.id;

    buttonEl.appendChild(createColorSwatchPreview(theme.base));

    const nameEl = document.createElement("strong");
    nameEl.textContent = theme.name;
    buttonEl.appendChild(nameEl);

    if (theme.description) {
      const descriptionEl = document.createElement("small");
      descriptionEl.textContent = theme.description;
      buttonEl.appendChild(descriptionEl);
    }

    buttonEl.addEventListener("click", () => {
      applyThemeById(theme.id);
      editingCustomThemeId = theme.isCustom ? theme.id : "";
      syncEditorInputsFromBase(theme.base);
      renderPresetList();
      syncUpdateButtonVisibility();
      setEditorStatus(theme.isCustom
        ? `Editing "${theme.name}". Adjust colors and save changes, or start a new theme.`
        : `Applied "${theme.name}". Tweak the colors below to start your own theme.`);
    });

    return buttonEl;
  }

  function renderPresetList() {
    const { presetListEl } = getEditorElements();
    if (!(presetListEl instanceof HTMLElement)) {
      return;
    }

    presetListEl.replaceChildren();

    getAllThemeOptions().forEach((theme) => {
      const isActive = theme.id === state.activeThemeId;

      if (!theme.isCustom) {
        presetListEl.appendChild(createPresetOptionButton(theme, isActive));
        return;
      }

      const rowEl = document.createElement("div");
      rowEl.className = "theme-preset-entry";
      rowEl.appendChild(createPresetOptionButton(theme, isActive));

      const deleteBtnEl = document.createElement("button");
      deleteBtnEl.type = "button";
      deleteBtnEl.className = "theme-preset-delete-btn";
      deleteBtnEl.textContent = "Delete";
      deleteBtnEl.setAttribute("aria-label", `Delete saved theme ${theme.name}`);
      deleteBtnEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!window.confirm(`Delete the saved theme "${theme.name}"?`)) {
          return;
        }
        const wasEditing = editingCustomThemeId === theme.id;
        deleteCustomTheme(theme.id);
        if (wasEditing) {
          editingCustomThemeId = "";
          syncEditorInputsFromBase(getActiveThemeBase());
        }
        renderPresetList();
        syncUpdateButtonVisibility();
        setEditorStatus(`Deleted "${theme.name}".`);
      });
      rowEl.appendChild(deleteBtnEl);
      presetListEl.appendChild(rowEl);
    });
  }

  function bindEditorEvents() {
    const { colorInputEls, nameInputEl, saveNewBtnEl, updateBtnEl, resetBtnEl } = getEditorElements();

    BASE_TOKEN_KEYS.forEach((tokenKey) => {
      const inputEl = colorInputEls[tokenKey];
      if (!inputEl) {
        return;
      }
      inputEl.addEventListener("input", () => {
        previewThemeTokens(readEditorBaseTokens());
        setEditorStatus("Previewing unsaved colors — save them to keep and reuse this theme.");
      });
    });

    if (saveNewBtnEl) {
      saveNewBtnEl.addEventListener("click", () => {
        const name = String(nameInputEl?.value || "").trim();
        const result = saveCustomTheme(name, readEditorBaseTokens());
        if (!result.ok) {
          setEditorStatus(result.message);
          return;
        }
        editingCustomThemeId = result.theme.id;
        applyThemeById(result.theme.id);
        if (nameInputEl) {
          nameInputEl.value = result.theme.name;
        }
        renderPresetList();
        syncUpdateButtonVisibility();
        setEditorStatus(`Saved "${result.theme.name}".`);
      });
    }

    if (updateBtnEl) {
      updateBtnEl.addEventListener("click", () => {
        if (!editingCustomThemeId) {
          return;
        }
        const name = String(nameInputEl?.value || "").trim() || findCustomTheme(editingCustomThemeId)?.name || "";
        const result = saveCustomTheme(name, readEditorBaseTokens(), editingCustomThemeId);
        if (!result.ok) {
          setEditorStatus(result.message);
          return;
        }
        applyThemeById(result.theme.id);
        renderPresetList();
        syncUpdateButtonVisibility();
        setEditorStatus(`Updated "${result.theme.name}".`);
      });
    }

    if (resetBtnEl) {
      resetBtnEl.addEventListener("click", () => {
        const activeBase = getActiveThemeBase();
        syncEditorInputsFromBase(activeBase);
        previewThemeTokens(activeBase);
        setEditorStatus("Colors reset to the active theme.");
      });
    }
  }

  function init() {
    loadCustomThemes();
    loadActiveThemeId();
    applyThemeById(state.activeThemeId, { persist: false });
  }

  function initSettingsEditor() {
    editingCustomThemeId = resolveThemeById(state.activeThemeId)?.isCustom ? state.activeThemeId : "";
    syncEditorInputsFromBase(getActiveThemeBase());
    renderPresetList();
    syncUpdateButtonVisibility();
    bindEditorEvents();
  }

  init();
  initSettingsEditor();

  window.TarotUiTheme = {
    ...(window.TarotUiTheme || {}),
    BUILT_IN_THEMES,
    BASE_TOKEN_KEYS,
    getAllThemeOptions,
    getActiveThemeId,
    getActiveThemeBase,
    resolveThemeById,
    applyThemeById,
    applyServerThemeDefaults,
    registerServerTheme,
    hasStoredActiveTheme,
    previewThemeTokens,
    saveCustomTheme,
    deleteCustomTheme,
    normalizeBaseTokens
  };
})();
