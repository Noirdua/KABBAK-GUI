/* plugins-host.js — DLC plugin loader and host.
 * Plugins are installed server-side from the DLC catalog. This host fetches the
 * installed plugin list, injects each plugin's entry script and stylesheet, and
 * mounts widget plugins into the top bar, section plugins as extra pages, and
 * role:"skin" plugins as a full UI overhaul (custom chrome/layout).
 */
(function () {
  "use strict";

  const registered = new Map();
  const mounted = new Set();
  const loadedAssets = new Set();
  const relocatedNodes = [];
  const pendingCatalog = new Map();
  const SKIN_ROLES = new Set(["skin", "overhaul", "ui"]);
  const ACTIVE_SKIN_STORAGE_KEY = "kabbak-active-skin";
  const DEFAULT_SKIN_ID = "layout-default";
  const NATIVE_SKIN_ID = "layout-phone";
  let refreshPromise = null;
  let activeSkinId = null;
  // Set while loading opted-in "public" plugins before the app is authenticated,
  // so their assets load straight from the API (no key/blob).
  let publicAssetBaseUrl = "";

  function normalizeApiBase(raw) {
    let value = String(raw || "").trim().replace(/\/+$/, "");
    if (!value || !/^https?:\/\//i.test(value)) {
      return "";
    }
    if (!/\/api\/v1$/i.test(value)) {
      value += "/api/v1";
    }
    return value;
  }

  function publicPluginBaseUrl() {
    const service = window.TarotDataService;
    const fromGate = normalizeApiBase(document.getElementById("connection-gate-base-url")?.value || "");
    if (fromGate) return fromGate;
    return normalizeApiBase(service?.getApiBaseUrl?.() || "");
  }

  function getHostEl() {
    return document.getElementById("plugin-topbar-host") || null;
  }

  function normalizePluginRole(plugin) {
    const role = String(plugin?.role || "").trim().toLowerCase();
    if (SKIN_ROLES.has(role) || plugin?.overhaul === true) {
      return "skin";
    }
    if (plugin?.section || plugin?.kind === "api" || role === "section") {
      return "section";
    }
    return "widget";
  }

  function isSkinPlugin(plugin) {
    return normalizePluginRole(plugin) === "skin";
  }

  function readStoredSkinId() {
    try {
      return String(window.localStorage.getItem(ACTIVE_SKIN_STORAGE_KEY) || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function persistSkinId(id) {
    try {
      const value = String(id || "").trim();
      if (value) {
        window.localStorage.setItem(ACTIVE_SKIN_STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(ACTIVE_SKIN_STORAGE_KEY);
      }
    } catch (_error) {}
  }

  function isNativeShell() {
    try {
      if (document.documentElement.getAttribute("data-kabbak-native") === "1") {
        return true;
      }
    } catch (_error) {}
    try {
      return window.Capacitor?.isNativePlatform?.() === true;
    } catch (_error) {
      return false;
    }
  }

  function preservesDefaultChrome(plugin) {
    return plugin?.preserveChrome === true
      || String(plugin?.chrome || "").trim().toLowerCase() === "default"
      || plugin?.id === DEFAULT_SKIN_ID;
  }

  function listSkins() {
    const skins = [];
    for (const plugin of registered.values()) {
      if (!isSkinPlugin(plugin)) continue;
      skins.push({
        id: plugin.id,
        name: plugin.name || plugin.id,
        version: plugin.version || "",
        preserveChrome: preservesDefaultChrome(plugin)
      });
    }
    skins.sort((a, b) => {
      if (a.id === DEFAULT_SKIN_ID) return -1;
      if (b.id === DEFAULT_SKIN_ID) return 1;
      return String(a.name || a.id).localeCompare(String(b.name || b.id));
    });
    return skins;
  }

  function resolveSkinId(id) {
    const skins = listSkins();
    const requested = String(id || "").trim();
    if (requested && requested !== "default" && skins.some((skin) => skin.id === requested)) {
      return requested;
    }
    if (isNativeShell() && skins.some((skin) => skin.id === NATIVE_SKIN_ID)) {
      return NATIVE_SKIN_ID;
    }
    if (skins.some((skin) => skin.id === DEFAULT_SKIN_ID)) {
      return DEFAULT_SKIN_ID;
    }
    return skins[0]?.id || "";
  }

  function selectedSkinId() {
    return resolveSkinId(readStoredSkinId());
  }

  function emitSkinChanged() {
    document.dispatchEvent(new CustomEvent("taro-skin-changed", {
      detail: {
        activeSkin: activeSkinId || "",
        skins: listSkins()
      }
    }));
  }

  function setActiveSkin(id) {
    const next = resolveSkinId(id);
    persistSkinId(next);
    if ((activeSkinId || "") === next) {
      emitSkinChanged();
      return next;
    }
    if (activeSkinId) {
      unmountPlugin(activeSkinId);
    }
    if (next) {
      mountPlugin(next);
    }
    emitSkinChanged();
    return next;
  }

  function getShellEl() {
    return document.getElementById("plugin-ui-shell") || null;
  }

  function ensureShellEl() {
    let el = getShellEl();
    if (el) return el;
    el = document.createElement("div");
    el.id = "plugin-ui-shell";
    el.className = "plugin-ui-shell";
    const topbar = document.querySelector(".topbar");
    if (topbar?.parentNode) {
      topbar.parentNode.insertBefore(el, topbar.nextSibling);
    } else {
      document.body.insertBefore(el, document.body.firstChild);
    }
    return el;
  }

  function hideDefaultChrome(pluginName) {
    document.documentElement.dataset.pluginSkin = pluginName;
  }

  function showDefaultChrome(pluginName) {
    if (document.documentElement.dataset.pluginSkin === pluginName) {
      delete document.documentElement.dataset.pluginSkin;
    }
  }

  function relocateNode(el, target) {
    if (!(el instanceof HTMLElement) || !(target instanceof HTMLElement) || el === target) {
      return;
    }
    relocatedNodes.push({ el, parent: el.parentNode, next: el.nextSibling });
    target.appendChild(el);
  }

  function restoreRelocated() {
    for (let i = relocatedNodes.length - 1; i >= 0; i -= 1) {
      const { el, parent, next } = relocatedNodes[i];
      if (parent) {
        parent.insertBefore(el, next);
      }
    }
    relocatedNodes.length = 0;
  }

  function attachPages(target) {
    if (!(target instanceof HTMLElement)) return;
    const nodes = [
      ...document.querySelectorAll("body > section"),
      document.getElementById("home-welcome")
    ].filter((el) => el instanceof HTMLElement && el !== target && !target.contains(el));
    nodes.forEach((el) => relocateNode(el, target));
  }

  function attachWidgets(target) {
    const hostEl = getHostEl();
    if (hostEl) relocateNode(hostEl, target);
  }

  function listNav() {
    const fromMenu = window.TaroTimeMenuPlugin?.getNavItems?.();
    if (Array.isArray(fromMenu) && fromMenu.length) {
      return fromMenu;
    }
    const actions = document.getElementById("topbar-actions");
    if (!actions) return [];
    const itemFromButton = (button) => {
      if (!(button instanceof HTMLElement)) return null;
      const id = String(button.id || "").trim();
      if (!id) return null;
      return {
        id,
        label: String(button.textContent || "").replace("▾", "").trim(),
        hidden: Boolean(button.hidden)
      };
    };
    const items = [];
    for (const child of actions.children) {
      if (child.classList.contains("topbar-dropdown")) {
        const trigger = child.querySelector(":scope > button.settings-trigger");
        const menu = child.querySelector(".topbar-dropdown-menu");
        const item = itemFromButton(trigger);
        if (!item) continue;
        item.children = [...(menu?.querySelectorAll(":scope > button") || [])]
          .map(itemFromButton)
          .filter(Boolean);
        items.push(item);
      } else if (child.matches("button")) {
        const item = itemFromButton(child);
        if (item) items.push(item);
      }
    }
    return items;
  }

  function openNav(id) {
    const el = document.getElementById(String(id || "").trim());
    if (el) el.click();
  }

  async function fetchPluginAssetObjectUrl(pluginName, fileName) {
    // Public (pre-auth) load: fetch the asset directly, no API key needed.
    if (publicAssetBaseUrl) {
      return `${publicAssetBaseUrl}/plugins/${encodeURIComponent(pluginName)}/${encodeURIComponent(fileName)}`;
    }
    const service = window.TarotDataService;
    if (!service?.requestBlob || !service?.buildApiUrl) {
      return "";
    }
    const blob = await service.requestBlob(
      "GET",
      service.buildApiUrl(`/api/v1/plugins/${encodeURIComponent(pluginName)}/${encodeURIComponent(fileName)}`)
    );
    return URL.createObjectURL(blob);
  }

  function dropPluginDomAssets(pluginName) {
    document.querySelectorAll(`[data-plugin-asset="${pluginName}"]`).forEach((el) => {
      const href = el.getAttribute("href") || el.getAttribute("src") || "";
      if (href.startsWith("blob:")) {
        try { URL.revokeObjectURL(href); } catch (_error) {}
      }
      el.remove();
    });
    for (const key of [...loadedAssets]) {
      if (key.startsWith(`${pluginName}:`)) {
        loadedAssets.delete(key);
      }
    }
  }

  function assetUrl(pluginName, fileName) {
    const service = window.TarotDataService;
    if (!service || typeof service.buildApiUrl !== "function") {
      return "";
    }
    return service.buildApiUrl(
      `/api/v1/plugins/${encodeURIComponent(pluginName)}/${encodeURIComponent(fileName)}`,
      { apiKey: service.getApiKey?.() || "" }
    );
  }

  function fileUrl(pluginName, dirName, fileName) {
    const service = window.TarotDataService;
    if (!service || typeof service.buildApiUrl !== "function") {
      return "";
    }
    return service.buildApiUrl(
      `/api/v1/plugins/${encodeURIComponent(pluginName)}/files/${encodeURIComponent(dirName)}/${encodeURIComponent(fileName)}`,
      { apiKey: service.getApiKey?.() || "" }
    );
  }

  async function listFiles(pluginName, dirName) {
    const service = window.TarotDataService;
    if (!service || typeof service.requestJson !== "function" || typeof service.buildApiUrl !== "function") {
      return [];
    }
    try {
      const payload = await service.requestJson(
        "GET",
        service.buildApiUrl(`/api/v1/plugins/${encodeURIComponent(pluginName)}/contents`, { dir: dirName || "" })
      );
      return Array.isArray(payload?.files) ? payload.files : [];
    } catch (_error) {
      return [];
    }
  }

  // Subfolders of the plugin root — used by folder-based playlists.
  async function listDirs(pluginName) {
    const service = window.TarotDataService;
    if (!service || typeof service.requestJson !== "function" || typeof service.buildApiUrl !== "function") {
      return [];
    }
    try {
      const payload = await service.requestJson(
        "GET",
        service.buildApiUrl(`/api/v1/plugins/${encodeURIComponent(pluginName)}/contents`, { dir: "" })
      );
      return Array.isArray(payload?.dirs) ? payload.dirs : [];
    } catch (_error) {
      return [];
    }
  }

  async function injectCss(pluginName, cssFile) {
    const normalized = String(cssFile || "").trim();
    if (!normalized) return;
    const key = `${pluginName}:css:${normalized}`;
    if (loadedAssets.has(key)) return;
    try {
      const href = await fetchPluginAssetObjectUrl(pluginName, normalized);
      if (!href) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.pluginAsset = pluginName;
      document.head.appendChild(link);
      loadedAssets.add(key);
    } catch (error) {
      console.warn(`[plugins] failed to load ${pluginName}/${normalized}`, error);
    }
  }

  async function injectScript(pluginName, entryFile) {
    const normalized = String(entryFile || "").trim();
    if (!normalized) return;
    const key = `${pluginName}:js:${normalized}`;
    if (loadedAssets.has(key)) return;
    try {
      const src = await fetchPluginAssetObjectUrl(pluginName, normalized);
      if (!src) return;
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.pluginAsset = pluginName;
        script.onload = () => {
          loadedAssets.add(key);
          resolve();
        };
        script.onerror = () => {
          reject(new Error(`failed to load ${pluginName}/${normalized}`));
        };
        document.head.appendChild(script);
      });
    } catch (error) {
      console.warn(`[plugins] failed to load ${pluginName}/${normalized}`, error);
    }
  }

  function pluginHelpers(pluginName) {
    const service = window.TarotDataService;
    return {
      assetUrl: (fileName) => assetUrl(pluginName, fileName),
      fileUrl: (dirName, fileName) => fileUrl(pluginName, dirName, fileName),
      listFiles: (dirName) => listFiles(pluginName, dirName),
      listDirs: () => listDirs(pluginName),
      pluginName,
      kabbakUrl: (path) => service?.buildApiUrl?.(path) || "",
      requestJson: (method, path, body) => {
        if (!service?.requestJson || !service?.buildApiUrl) {
          return Promise.reject(new Error("API is not connected."));
        }
        return service.requestJson(method, service.buildApiUrl(path), body);
      },
      requestBlob: (method, path) => {
        if (!service?.buildApiUrl) {
          return Promise.reject(new Error("API is not connected."));
        }
        if (typeof service.requestBlob === "function") {
          return service.requestBlob(method, service.buildApiUrl(path));
        }
        return Promise.reject(new Error("File download is not available."));
      },
      // Generic overlay shared by every plugin (and the app).
      overlay: () => window.TaroOverlay,
      openOverlay: (options) => window.TaroOverlay?.open?.(options) || null,
      ui: {
        hideDefaultChrome: () => hideDefaultChrome(pluginName),
        showDefaultChrome: () => showDefaultChrome(pluginName),
        listNav,
        openNav,
        openSection: (sectionId) => window.TarotSectionStateUi?.setActiveSection?.(sectionId),
        getActiveSection: () => window.TarotSectionStateUi?.getActiveSection?.() || "home",
        goBack: () => window.TarotSectionStateUi?.goBack?.(),
        sectionLabel: (sectionId) => window.TarotSectionStateUi?.sectionLabel?.(sectionId) || sectionId,
        attachPages,
        attachWidgets,
        onSectionChange(handler) {
          const listener = (event) => handler(event?.detail || {});
          document.addEventListener("section:changed", listener);
          return () => document.removeEventListener("section:changed", listener);
        }
      }
    };
  }

  function mountSkin(plugin, helpers) {
    if (activeSkinId && activeSkinId !== plugin.id) {
      unmountPlugin(activeSkinId);
    }
    const shellEl = ensureShellEl();
    shellEl.dataset.pluginName = plugin.id;
    if (preservesDefaultChrome(plugin)) {
      shellEl.hidden = true;
      delete document.documentElement.dataset.pluginSkin;
      const result = plugin.mount(shellEl, helpers);
      if (typeof result === "function") {
        shellEl._pluginUnmount = result;
      }
      activeSkinId = plugin.id;
      return;
    }
    shellEl.hidden = false;
    try {
      const result = plugin.mount(shellEl, helpers);
      if (typeof result === "function") {
        shellEl._pluginUnmount = result;
      }
      hideDefaultChrome(plugin.id);
      activeSkinId = plugin.id;
    } catch (error) {
      restoreRelocated();
      delete document.documentElement.dataset.pluginSkin;
      shellEl.remove();
      throw error;
    }
  }

  function mountApiSection(plugin, helpers) {
    const sectionId = String(plugin.section?.id || plugin.id || "").trim();
    const label = String(plugin.section?.label || plugin.name || plugin.id || sectionId).trim();
    if (!sectionId) return;
    // Built-in sections win over a plugin claiming the same id.
    if (window.TarotSectionStateUi?.isBuiltinSection?.(sectionId)) {
      return;
    }
    window.TarotSectionStateUi?.registerSection?.(sectionId);

    let sectionEl = document.getElementById(`${sectionId}-section`);
    if (!sectionEl) {
      sectionEl = document.createElement("section");
      sectionEl.id = `${sectionId}-section`;
      sectionEl.className = "plugin-api-section";
      sectionEl.dataset.pluginSection = sectionId;
      sectionEl.hidden = true;
      const anchor = document.getElementById("settings-section");
      if (anchor?.parentNode) {
        anchor.parentNode.insertBefore(sectionEl, anchor);
      } else {
        document.body.appendChild(sectionEl);
      }
    }

    const actions = document.getElementById("topbar-actions");
    if (actions && !document.getElementById(`open-${sectionId}`)) {
      const button = document.createElement("button");
      button.id = `open-${sectionId}`;
      button.className = "settings-trigger topbar-menu-plugin-api";
      button.type = "button";
      button.dataset.pluginSectionOpen = sectionId;
      button.textContent = label;
      button.addEventListener("click", () => {
        window.TarotSectionStateUi?.setActiveSection?.(sectionId);
      });
      const settingsBtn = document.getElementById("open-settings");
      actions.insertBefore(button, settingsBtn || null);
    }

    sectionEl.dataset.pluginName = plugin.id;
    const active = window.TarotSectionStateUi?.getActiveSection?.() || "home";
    if (active !== sectionId) {
      sectionEl.hidden = true;
    }

    let didMountUi = false;
    const ensurePluginUi = () => {
      if (didMountUi) {
        return;
      }
      didMountUi = true;
      const result = plugin.mount(sectionEl, helpers);
      if (typeof result === "function") {
        sectionEl._pluginUnmount = result;
      }
    };

    const onSection = (event) => {
      if (String(event?.detail?.activeSection || "") === sectionId) {
        ensurePluginUi();
      }
    };
    document.addEventListener("section:changed", onSection);
    sectionEl._pluginSectionListen = onSection;
    if (active === sectionId) {
      ensurePluginUi();
    }
  }

  function mountPlugin(pluginName) {
    const plugin = registered.get(pluginName);
    if (!plugin) {
      return;
    }
    const role = normalizePluginRole(plugin);
    const shouldBeSection = role === "section";
    const shouldBeSkin = role === "skin";
    if (mounted.has(pluginName)) {
      const widget = getHostEl()?.querySelector(`[data-plugin-name="${pluginName}"]`);
      if ((shouldBeSection || shouldBeSkin) && widget) {
        unmountPlugin(pluginName);
      } else {
        return;
      }
    }
    const helpers = pluginHelpers(pluginName);
    let container = null;
    try {
      if (shouldBeSkin) {
        if (selectedSkinId() !== pluginName) {
          return;
        }
        mountSkin(plugin, helpers);
        mounted.add(pluginName);
        return;
      }
      if (shouldBeSection) {
        mountApiSection(plugin, helpers);
        mounted.add(pluginName);
        return;
      }
      const hostEl = getHostEl();
      if (!hostEl) return;
      container = document.createElement("div");
      container.className = "plugin-widget";
      container.dataset.pluginName = pluginName;
      hostEl.appendChild(container);
      const result = plugin.mount(container, helpers);
      if (typeof result === "function") {
        container._pluginUnmount = result;
      }
      mounted.add(pluginName);
    } catch (error) {
      console.warn(`[plugins] ${pluginName} failed to mount`, error);
      container?.remove?.();
    }
  }

  function unmountPlugin(pluginName) {
    const plugin = registered.get(pluginName);
    const hostEl = getHostEl();
    if (hostEl) {
      const container = hostEl.querySelector(`[data-plugin-name="${pluginName}"]`);
      if (typeof container?._pluginUnmount === "function") {
        try { container._pluginUnmount(); } catch (_error) {}
      }
      if (container) container.remove();
    }
    dropPluginDomAssets(pluginName);
    if (activeSkinId === pluginName) {
      const shellEl = getShellEl();
      restoreRelocated();
      if (typeof shellEl?._pluginUnmount === "function") {
        try { shellEl._pluginUnmount(); } catch (_error) {}
      }
      showDefaultChrome(pluginName);
      shellEl?.remove();
      activeSkinId = null;
    }
    const sectionId = String(plugin?.section?.id || pluginName).trim();
    const sectionEl = document.getElementById(`${sectionId}-section`);
    if (typeof sectionEl?._pluginSectionListen === "function") {
      document.removeEventListener("section:changed", sectionEl._pluginSectionListen);
      delete sectionEl._pluginSectionListen;
    }
    if (typeof sectionEl?._pluginUnmount === "function") {
      try { sectionEl._pluginUnmount(); } catch (_error) {}
    }
    sectionEl?.remove();
    document.getElementById(`open-${sectionId}`)?.remove();
    window.TarotSectionStateUi?.unregisterSection?.(sectionId);
    mounted.delete(pluginName);
  }

  async function refresh() {
    if (refreshPromise) {
      return refreshPromise;
    }
    const service = window.TarotDataService;
    const access = window.TarotAppConfig?.getConnectionAccess?.();
    if (!service || typeof service.requestJson !== "function" || typeof service.buildApiUrl !== "function") {
      return [];
    }
    const authenticated = access?.authenticated === true;
    const publicBase = authenticated ? "" : publicPluginBaseUrl();
    // Before login, only opted-in "public" plugins can load (from the gate URL).
    if (!authenticated && !publicBase) {
      return [];
    }
    refreshPromise = (async () => {
      try {
        let plugins = [];
        if (authenticated) {
          publicAssetBaseUrl = "";
          const payload = await service.requestJson("GET", service.buildApiUrl("/api/v1/plugins"));
          plugins = Array.isArray(payload?.plugins) ? payload.plugins : [];
        } else {
          // Public (pre-auth): fetch the public list and load assets directly.
          publicAssetBaseUrl = publicBase;
          const response = await fetch(`${publicBase}/plugins`, { cache: "no-store" });
          const payload = response.ok ? await response.json().catch(() => null) : null;
          plugins = (Array.isArray(payload?.data?.plugins) ? payload.data.plugins : [])
            .filter((plugin) => normalizePluginRole(plugin) === "widget");
        }
        const desiredNames = plugins.map((plugin) => String(plugin?.name || "").trim()).filter(Boolean);

        for (const name of [...mounted]) {
          if (!desiredNames.includes(name)) {
            if (registered.get(name)?.bundled) {
              continue;
            }
            unmountPlugin(name);
            // Forget the old registration and assets so a reinstall (with
            // possibly new code) loads fresh instead of reusing stale closures.
            registered.delete(name);
            dropPluginDomAssets(name);
          }
        }

        for (const plugin of plugins) {
          pendingCatalog.set(plugin.name, {
            section: plugin.section,
            kind: plugin.kind,
            role: plugin.role,
            overhaul: plugin.overhaul,
            preserveChrome: plugin.preserveChrome
          });
          await injectCss(plugin.name, plugin.css);
          await injectScript(plugin.name, plugin.entry);
          pendingCatalog.delete(plugin.name);
          const local = registered.get(plugin.name);
          if (local) {
            if (plugin.section) local.section = plugin.section;
            if (plugin.kind) local.kind = plugin.kind;
            if (plugin.role) local.role = plugin.role;
            if (plugin.overhaul != null) local.overhaul = plugin.overhaul;
            if (plugin.preserveChrome != null) local.preserveChrome = plugin.preserveChrome;
          }
          mountPlugin(plugin.name);
        }
        const resolvedSkin = selectedSkinId();
        if (resolvedSkin && readStoredSkinId() !== resolvedSkin) {
          persistSkinId(resolvedSkin);
        }
        if (activeSkinId && selectedSkinId() !== activeSkinId) {
          unmountPlugin(activeSkinId);
        }
        document.dispatchEvent(new CustomEvent("taro-plugins-ready"));
        emitSkinChanged();
        return plugins;
      } catch (error) {
        console.warn("[plugins] refresh failed", error);
        return [];
      }
    })().finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  window.TaroTimePluginHost = {
    register(plugin) {
      if (!plugin || !plugin.id) {
        return;
      }
      const id = String(plugin.id).trim();
      if (!id) return;
      const catalog = pendingCatalog.get(id) || {};
      const previous = registered.get(id);
      registered.set(id, {
        ...catalog,
        ...plugin,
        id,
        bundled: Boolean(plugin.bundled || previous?.bundled)
      });
      mountPlugin(id);
    },
    refresh,
    assetUrl,
    listNav,
    listSkins,
    getActiveSkin() {
      return activeSkinId || "";
    },
    setActiveSkin,
    isMounted(pluginName) {
      return mounted.has(pluginName);
    },
    activeSkin() {
      return activeSkinId;
    }
  };

  document.addEventListener("connection:access-updated", () => {
    void refresh();
  });
  document.addEventListener("connection:updated", () => {
    void refresh();
  });
})();
