(function () {
  "use strict";

  const STACKS = ["main", "display", "arabic", "enochian", "cjk"];
  let catalog = null;
  let loadedBase = "";
  let loadPromise = null;
  const loadedSymbolScripts = new Set();

  function families() {
    return Array.isArray(catalog?.families) ? catalog.families : [];
  }

  function findFamily(script) {
    return families().find((family) => (
      Array.isArray(family?.scripts)
      && family.scripts.includes(script)
      && family.family
    )) || null;
  }

  function familyForScript(script) {
    return findFamily(script)?.family || "";
  }

  function symbol(script, group, key) {
    const symbols = findFamily(script)?.symbols;
    if (!symbols || key == null || key === "") {
      return "";
    }
    const table = symbols[group];
    if (table && table[String(key)]) {
      return String(table[String(key)]);
    }
    if (group !== "binary" && symbols.binary && symbols.binary[String(key)]) {
      return String(symbols.binary[String(key)]);
    }
    return "";
  }

  function applyStacks() {
    const root = document.documentElement;
    const grouped = {};
    for (const family of families()) {
      if (family.role === "symbol" || !family.family) {
        continue;
      }
      for (const stack of family.stacks || []) {
        if (!STACKS.includes(stack)) {
          continue;
        }
        grouped[stack] = grouped[stack] || [];
        if (!grouped[stack].includes(family.family)) {
          grouped[stack].push(family.family);
        }
      }
    }
    for (const stack of STACKS) {
      const names = grouped[stack];
      if (names?.length) {
        root.style.setProperty(`--font-custom-${stack}`, names.map((name) => `"${name}"`).join(", "));
      } else {
        root.style.removeProperty(`--font-custom-${stack}`);
      }
    }
    const iching = findFamily("iching");
    if (iching?.role === "symbol") {
      root.style.setProperty("--font-family-iching", `"${iching.family}"`);
    }
  }

  function createGlyph(script, group, key, className) {
    const family = findFamily(script);
    if (!family || family.role !== "symbol" || !loadedSymbolScripts.has(script)) {
      return null;
    }
    const character = symbol(script, group, key);
    if (!character) {
      return null;
    }
    const element = document.createElement("span");
    element.className = `kabbak-symbol-glyph ${className || "iching-font-glyph"}`.trim();
    element.style.fontFamily = `"${family.family}", sans-serif`;
    element.setAttribute("aria-hidden", "true");
    element.dataset.glyph = character;
    return element;
  }

  function currentBase() {
    return String(
      window.TarotDataService?.getApiBaseUrl?.()
      || window.TarotAppConfig?.getApiBaseUrl?.()
      || ""
    ).trim().replace(/\/+$/, "");
  }

  async function fontFileReady(base, family) {
    const fileUrl = String(family?.files?.[0]?.url || "").trim();
    if (!fileUrl) {
      return false;
    }
    try {
      const response = await fetch(new URL(fileUrl, `${base}/`), { cache: "force-cache" });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function confirmSymbolFont(family) {
    if (!family || !document.fonts?.load) {
      return false;
    }
    try {
      const faces = await document.fonts.load(`400 32px "${family}"`);
      return faces.length > 0 || document.fonts.check(`32px "${family}"`);
    } catch {
      return false;
    }
  }

  function load(baseUrl) {
    const base = String(baseUrl || currentBase() || "").trim().replace(/\/+$/, "");
    if (!base) {
      return Promise.resolve(catalog);
    }
    if (loadPromise && loadedBase === base) {
      return loadPromise;
    }
    loadedBase = base;
    loadedSymbolScripts.clear();
    document.documentElement.removeAttribute("data-font-iching");
    loadPromise = (async () => {
      const response = await fetch(`${base}/api/v1/fonts`, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error("fonts unavailable");
      }
      const payload = await response.json();
      catalog = payload?.data && typeof payload.data === "object" ? payload.data : payload;
      applyStacks();
      let link = document.getElementById("kabbak-fonts");
      if (!link) {
        link = document.createElement("link");
        link.id = "kabbak-fonts";
        link.rel = "stylesheet";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }
      const revision = encodeURIComponent(catalog?.revision || Date.now());
      const href = `${base}/api/v1/fonts.css?v=${revision}`;
      if (link.href !== href) {
        await new Promise((resolve, reject) => {
          link.onload = () => resolve();
          link.onerror = () => reject(new Error("font css failed"));
          link.href = href;
        });
      }
      loadedSymbolScripts.clear();
      for (const family of families()) {
        if (family.role !== "symbol") {
          continue;
        }
        const loaded = await fontFileReady(base, family) || await confirmSymbolFont(family.family);
        if (!loaded) {
          continue;
        }
        for (const script of family.scripts || []) {
          loadedSymbolScripts.add(script);
        }
      }
      const iching = findFamily("iching");
      if (iching?.role === "symbol" && loadedSymbolScripts.has("iching")) {
        document.documentElement.setAttribute("data-font-iching", iching.family);
      } else {
        document.documentElement.removeAttribute("data-font-iching");
      }
      document.dispatchEvent(new CustomEvent("fonts:loaded", { detail: { base } }));
      return catalog;
    })().catch((error) => {
      loadedBase = "";
      loadPromise = null;
      loadedSymbolScripts.clear();
      document.documentElement.removeAttribute("data-font-iching");
      document.dispatchEvent(new CustomEvent("fonts:loaded", { detail: { base } }));
      throw error;
    });
    return loadPromise;
  }

  function boot() {
    const base = currentBase();
    if (base) {
      void load(base).catch(() => {});
    }
  }

  document.addEventListener("config:defaults-loaded", boot);
  document.addEventListener("connection:access-updated", boot);
  boot();

  window.KabbakFonts = {
    load,
    symbol,
    familyForScript,
    isSymbolLoaded(script) {
      const family = findFamily(script);
      return Boolean(family && family.role === "symbol" && loadedSymbolScripts.has(script));
    },
    createGlyph,
    getCatalog() {
      return catalog;
    }
  };
})();
