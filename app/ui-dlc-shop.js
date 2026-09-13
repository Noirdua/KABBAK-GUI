/* ui-dlc-shop.js — DLC Shop & Plugins panel in Settings.
 * Lists installed plugins and catalog plugins; admins can install/uninstall.
 */
(function () {
  "use strict";

  function getElements() {
    return {
      installedEl: document.getElementById("dlc-plugins-installed"),
      availableEl: document.getElementById("dlc-plugins-available"),
      reloadBtn: document.getElementById("dlc-plugins-reload"),
      statusEl: document.getElementById("dlc-plugins-status")
    };
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isAdmin() {
    return window.TarotAppConfig?.hasAdminApiManagementAccess?.() === true;
  }

  // XHR-based upload so we can report transfer progress and speed (fetch has no
  // upload progress events).
  function uploadPluginFileWithProgress({ url, body, onProgress }) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      const service = window.TarotDataService;
      const apiKey = service?.getApiKey?.();
      if (apiKey) {
        xhr.setRequestHeader("x-api-key", apiKey);
      }

      let lastLoaded = 0;
      let lastTime = 0;
      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const now = performance.now();
        const deltaSeconds = lastTime > 0 ? (now - lastTime) / 1000 : 0;
        const deltaBytes = event.loaded - lastLoaded;
        const speed = deltaSeconds > 0 ? deltaBytes / deltaSeconds : 0;
        lastLoaded = event.loaded;
        lastTime = now;
        if (typeof onProgress === "function") {
          onProgress(event.loaded, event.total, speed);
        }
      });

      xhr.onload = () => {
        let payload = null;
        try {
          payload = JSON.parse(xhr.responseText || "{}");
        } catch (_error) {
          payload = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload?.data ?? payload ?? {});
          return;
        }
        if (xhr.status === 413) {
          reject(new Error("Upload too large (413) — the server's request body limit is smaller than this file. Raise KABBAK_JSON_BODY_LIMIT on the server."));
          return;
        }
        const message = payload?.data?.message
          || payload?.error?.message
          || payload?.message
          || `Upload failed (HTTP ${xhr.status}).`;
        reject(new Error(message));
      };
      xhr.onerror = () => reject(new Error("Network error during upload."));
      xhr.ontimeout = () => reject(new Error("Upload timed out."));
      xhr.send(JSON.stringify(body));
    });
  }

  function setStatus(text, isError = false) {
    const { statusEl } = getElements();
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle("is-error", Boolean(isError));
  }

  function createPluginCard({ title, description, version, badge, actionLabel, onAction }) {
    const card = document.createElement("div");
    card.className = "dlc-plugin-card";
    const info = document.createElement("div");
    info.className = "dlc-plugin-info";
    const nameRow = document.createElement("div");
    nameRow.className = "dlc-plugin-name-row";
    const nameEl = document.createElement("strong");
    nameEl.textContent = title || "Untitled plugin";
    nameRow.appendChild(nameEl);
    if (version) {
      const versionEl = document.createElement("span");
      versionEl.className = "dlc-plugin-version";
      versionEl.textContent = `v${version}`;
      nameRow.appendChild(versionEl);
    }
    info.appendChild(nameRow);
    if (description) {
      const descriptionEl = document.createElement("span");
      descriptionEl.className = "dlc-plugin-description";
      descriptionEl.textContent = description;
      info.appendChild(descriptionEl);
    }
    card.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "dlc-plugin-actions";
    if (badge) {
      const badgeEl = document.createElement("span");
      badgeEl.className = "dlc-plugin-badge";
      badgeEl.textContent = badge;
      actions.appendChild(badgeEl);
    }
    if (actionLabel && typeof onAction === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dlc-shop-btn";
      button.textContent = actionLabel;
      button.addEventListener("click", () => {
        void onAction(button);
      });
      actions.appendChild(button);
    }
    card.appendChild(actions);
    return card;
  }

  function renderInstalled(listEl, plugins) {
    listEl.innerHTML = "";
    if (!plugins.length) {
      const empty = document.createElement("span");
      empty.className = "settings-field-hint";
      empty.textContent = "No plugins installed.";
      listEl.appendChild(empty);
      return;
    }
    plugins.forEach((plugin) => {
      const card = createPluginCard({
        title: plugin.title,
        description: plugin.description,
        version: plugin.version,
        badge: plugin.role === "skin" ? "UI overhaul" : "installed",
        actionLabel: isAdmin() ? "Uninstall" : "",
        onAction: async (button) => {
          button.disabled = true;
          setStatus(`Uninstalling ${plugin.name}…`);
          try {
            await window.TarotDataService.requestJson(
              "POST",
              window.TarotDataService.buildApiUrl("/api/v1/dlc/uninstall"),
              { kind: plugin.kind || "plugin", name: plugin.name }
            );
            await refreshShop();
            await window.TaroTimePluginHost?.refresh?.();
            setStatus(`Uninstalled ${plugin.name}.`);
          } catch (error) {
            setStatus(`Could not uninstall ${plugin.name}. ${error?.message || ""}`, true);
          } finally {
            button.disabled = false;
          }
        }
      });

      const settingsBtn = document.createElement("button");
      settingsBtn.type = "button";
      settingsBtn.className = "dlc-shop-btn";
      settingsBtn.textContent = "Settings";
      settingsBtn.title = `Configure ${plugin.title || plugin.name}`;
      card.querySelector(".dlc-plugin-actions")?.appendChild(settingsBtn);
      settingsBtn.addEventListener("click", () => {
        openPluginSettings(card, plugin);
      });

      if (plugin.role === "skin") {
        const activeSkin = window.TaroTimePluginHost?.getActiveSkin?.() || "";
        const useBtn = document.createElement("button");
        useBtn.type = "button";
        useBtn.className = "dlc-shop-btn";
        const isActive = activeSkin === plugin.name || activeSkin === plugin.id;
        useBtn.textContent = isActive ? "Active layout" : "Use layout";
        useBtn.disabled = isActive;
        card.querySelector(".dlc-plugin-actions")?.appendChild(useBtn);
        useBtn.addEventListener("click", () => {
          window.TaroTimePluginHost?.setActiveSkin?.(plugin.name || plugin.id);
          useBtn.textContent = "Active layout";
          useBtn.disabled = true;
        });
      }

      listEl.appendChild(card);
    });
  }

  function collectTopbarUnits() {
    if (window.TaroTimeMenuPlugin && typeof window.TaroTimeMenuPlugin.getTopbarUnits === "function") {
      const units = window.TaroTimeMenuPlugin.getTopbarUnits();
      if (units.length) return units;
    }
    const actions = document.getElementById("topbar-actions");
    if (!actions) return [];
    return Array.from(actions.children)
      .map((child) => {
        const isDropdown = child.classList?.contains("topbar-dropdown");
        const trigger = isDropdown
          ? child.querySelector("button.settings-trigger")
          : (child.tagName === "BUTTON" ? child : null);
        return {
          id: trigger?.id || "",
          label: (trigger?.textContent || "").trim()
        };
      })
      .filter((unit) => unit.id);
  }

  async function openMenuEditor() {
    const settingsEl = openSettingsOverlay("Menu Order");
    const editor = document.createElement("div");
    editor.className = "dlc-menu-editor";
    settingsEl.appendChild(editor);

    const loadingEl = document.createElement("span");
    loadingEl.className = "settings-field-hint";
    loadingEl.textContent = "Loading menu configuration…";
    editor.appendChild(loadingEl);

    let config = { showUnlisted: false, items: [] };
    try {
      const payload = await window.TarotDataService.requestJson(
        "GET",
        window.TarotDataService.buildApiUrl("/api/v1/plugins/menu-plugin/config")
      );
      if (payload?.config && typeof payload.config === "object") {
        config = { ...config, ...payload.config };
      }
    } catch (_error) {
      // Keep defaults.
    }

    const menuPlugin = window.TaroTimeMenuPlugin || null;
    const allUnits = typeof menuPlugin?.getAllUnits === "function" ? menuPlugin.getAllUnits() : { topLevel: collectTopbarUnits(), subpages: [], byId: new Map() };
    const datasetMap = typeof menuPlugin?.getSectionDatasets === "function" ? menuPlugin.getSectionDatasets() : {};

    function datasetForId(id) {
      const normalized = String(id || "").replace(/^open-/, "").toLowerCase();
      return datasetMap[normalized] || "";
    }

    const resolveMenuId = (raw) => {
      if (menuPlugin && typeof menuPlugin.resolveMenuId === "function") {
        return menuPlugin.resolveMenuId(raw);
      }
      return String(raw || "").trim();
    };
    const displayMenuId = (id) => {
      if (menuPlugin && typeof menuPlugin.displayMenuId === "function") {
        return menuPlugin.displayMenuId(id);
      }
      return String(id || "").replace(/^open-/, "");
    };
    const isMenuGroupId = (id) => {
      if (menuPlugin && typeof menuPlugin.isMenuGroupId === "function") {
        return menuPlugin.isMenuGroupId(id);
      }
      return false;
    };
    const describeMenuId = (id) => {
      const display = displayMenuId(id);
      if (isMenuGroupId(id)) {
        return `${display} → menu group — add children to make it a submenu`;
      }
      const dataset = datasetForId(id);
      return `${display}${dataset ? ` → opens: ${dataset}` : " → unknown target (broken link?)"}`;
    };

    // Rows come from the config order so admins can nest children freely.
    // Header entries ({ type: "header" }) are non-clickable group labels.
    const rows = (Array.isArray(config.items) ? config.items : []).map((item) => ({
      type: item?.type === "header" ? "header" : item?.type === "search" || String(item?.id || "") === "mp-menu-search" ? "search" : "item",
      id: String(item?.id || "").trim(),
      label: String(item?.label || "").trim(),
      enabled: item?.enabled !== false,
      keywords: String(item?.keywords || "").trim(),
      children: (Array.isArray(item?.children) ? item.children : []).map((child) => ({
        id: String(child?.id || "").trim(),
        label: String(child?.label || "").trim(),
        enabled: child?.enabled !== false,
        keywords: String(child?.keywords || "").trim()
      }))
    })).filter((row) => row.type === "header" || row.type === "search" || (row.id && row.id !== "undefined"));
    if (config.showSearch === true && !rows.some((row) => row.type === "search")) {
      rows.push({ type: "search", id: "mp-menu-search", label: "Search menu…", enabled: true, keywords: "", children: [] });
    }

    const isRequiredMenuId = (id) => {
      if (menuPlugin && typeof menuPlugin.isRequiredMenuId === "function") {
        return menuPlugin.isRequiredMenuId(id);
      }
      const raw = String(id || "").trim();
      return raw === "open-settings" || raw === "open-profile" || raw === "open-admin"
        || raw === "settings" || raw === "profile" || raw === "admin";
    };
    const REQUIRED_MENU_ITEMS = [
      { id: "open-settings", label: "Settings" },
      { id: "open-profile", label: "Profile" },
      { id: "open-admin", label: "Admin" }
    ];
    function treeHasId(id) {
      return rows.some((row) => row.id === id || row.children.some((child) => child.id === id));
    }
    function ensureRequiredRows() {
      REQUIRED_MENU_ITEMS.forEach((item) => {
        if (!treeHasId(item.id)) {
          rows.push({
            type: "item",
            id: item.id,
            label: item.label,
            enabled: true,
            keywords: "",
            children: []
          });
        }
      });
    }
    ensureRequiredRows();

    const head = document.createElement("div");
    head.className = "dlc-menu-editor-head";
    const headControls = document.createElement("div");
    headControls.className = "dlc-menu-editor-head-controls";
    const titleLabel = document.createElement("label");
    titleLabel.className = "dlc-menu-hide-label";
    const menuTitleInput = document.createElement("input");
    menuTitleInput.type = "text";
    menuTitleInput.maxLength = 40;
    menuTitleInput.placeholder = "KABBAK";
    menuTitleInput.value = String(config.menuTitle || "");
    menuTitleInput.title = "Menu banner title shown in the top bar (blank restores the app default)";
    titleLabel.appendChild(document.createTextNode("Title:"));
    titleLabel.appendChild(menuTitleInput);
    headControls.appendChild(titleLabel);
    const hideUnlisted = document.createElement("label");
    hideUnlisted.className = "dlc-menu-hide-label";
    const hideCheckbox = document.createElement("input");
    hideCheckbox.type = "checkbox";
    hideCheckbox.checked = config.showUnlisted === false;
    hideUnlisted.appendChild(hideCheckbox);
    hideUnlisted.appendChild(document.createTextNode("Hide unlisted entries"));
    headControls.appendChild(hideUnlisted);

    const hideMenuButtonLabel = document.createElement("label");
    hideMenuButtonLabel.className = "dlc-menu-hide-label";
    const hideMenuButtonCheckbox = document.createElement("input");
    hideMenuButtonCheckbox.type = "checkbox";
    hideMenuButtonCheckbox.checked = config.hideMenuButton === true;
    hideMenuButtonCheckbox.title = "Hide the 'Menu' button and open the navigation menu by clicking the banner title";
    hideMenuButtonLabel.appendChild(hideMenuButtonCheckbox);
    hideMenuButtonLabel.appendChild(document.createTextNode("Use title as menu button"));
    headControls.appendChild(hideMenuButtonLabel);

    const showSearchLabel = document.createElement("label");
    showSearchLabel.className = "dlc-menu-hide-label";
    const showSearchCheckbox = document.createElement("input");
    showSearchCheckbox.type = "checkbox";
    showSearchCheckbox.checked = config.showSearch === true;
    showSearchCheckbox.title = "Show a search box in the menu bar that filters entries by label, id, dataset, and keywords";
    showSearchLabel.appendChild(showSearchCheckbox);
    showSearchLabel.appendChild(document.createTextNode("Menu search bar"));
    headControls.appendChild(showSearchLabel);
    showSearchCheckbox.addEventListener("change", () => {
      if (showSearchCheckbox.checked) {
        if (!rows.some((row) => row.type === "search")) {
          rows.push({ type: "search", id: "mp-menu-search", label: "Search menu…", enabled: true, keywords: "", children: [] });
        }
      } else {
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (rows[index].type === "search") {
            rows.splice(index, 1);
          }
        }
      }
      renderRows();
      renderLinkReport();
    });

    const spacingLabel = document.createElement("label");
    spacingLabel.className = "dlc-menu-hide-label";
    spacingLabel.appendChild(document.createTextNode("Spacing:"));
    const spacingSelect = document.createElement("select");
    spacingSelect.className = "dlc-menu-preset-select";
    ["compact", "normal", "roomy"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
      spacingSelect.appendChild(option);
    });
    spacingSelect.value = config.menuSpacing === "compact" || config.menuSpacing === "roomy" ? config.menuSpacing : "normal";
    spacingLabel.appendChild(spacingSelect);
    headControls.appendChild(spacingLabel);

    const themeLabel = document.createElement("label");
    themeLabel.className = "dlc-menu-hide-label";
    themeLabel.appendChild(document.createTextNode("Theme:"));
    const themeSelect = document.createElement("select");
    themeSelect.className = "dlc-menu-preset-select";
    const themeOptions = [
      ["default", "Default"],
      ["led", "LED neon"],
      ["wood", "Wood"],
      ["paper", "Paper"],
      ["stone", "Stone"],
      ["velvet", "Velvet"]
    ];
    themeOptions.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      themeSelect.appendChild(option);
    });
    const currentTheme = String(config.menuTheme || "default");
    themeSelect.value = themeOptions.some(([value]) => value === currentTheme) ? currentTheme : "default";
    themeLabel.appendChild(themeSelect);
    headControls.appendChild(themeLabel);

    const logoLabel = document.createElement("label");
    logoLabel.className = "dlc-menu-hide-label";
    logoLabel.appendChild(document.createTextNode("Logo:"));
    const logoInput = document.createElement("input");
    logoInput.type = "text";
    logoInput.maxLength = 120;
    logoInput.placeholder = "logo.png";
    logoInput.value = String(config.logo || "");
    logoInput.title = "Image file in the plugin folder shown next to the KABBAK banner";
    logoLabel.appendChild(logoInput);
    headControls.appendChild(logoLabel);

    const uploadLogoBtn = document.createElement("button");
    uploadLogoBtn.type = "button";
    uploadLogoBtn.className = "dlc-shop-btn";
    uploadLogoBtn.textContent = "Upload Logo";
    uploadLogoBtn.title = "Upload an image to the plugin folder and use it as the banner logo";
    const logoFileInput = document.createElement("input");
    logoFileInput.type = "file";
    logoFileInput.accept = "image/*,.png,.jpg,.jpeg,.webp,.svg,.gif";
    logoFileInput.style.display = "none";
    uploadLogoBtn.addEventListener("click", () => logoFileInput.click());
    logoFileInput.addEventListener("change", async () => {
      const file = logoFileInput.files?.[0];
      logoFileInput.value = "";
      if (!file || !file.type || !file.type.startsWith("image/")) return;
      uploadLogoBtn.disabled = true;
      try {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
        if (!dataUrl) return;
        await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl("/api/v1/plugins/menu-plugin/files"),
          { fileName: file.name, data: dataUrl }
        );
        logoInput.value = file.name;
        setStatus(`Logo '${file.name}' uploaded. Press Save Menu to apply it.`);
      } catch (error) {
        setStatus(`Could not upload the logo. ${error?.message || ""}`, true);
      } finally {
        uploadLogoBtn.disabled = false;
      }
    });
    headControls.appendChild(uploadLogoBtn);

    const overlayLabel = document.createElement("label");
    overlayLabel.className = "dlc-menu-hide-label";
    overlayLabel.appendChild(document.createTextNode("Drawer overlay:"));
    const overlayInput = document.createElement("input");
    overlayInput.type = "text";
    overlayInput.maxLength = 160;
    overlayInput.placeholder = "overlay.jpg";
    overlayInput.value = String(config.overlayBackground || "");
    overlayInput.title = "Image in the plugin folder used behind the side drawer";
    overlayLabel.appendChild(overlayInput);
    headControls.appendChild(overlayLabel);
    const uploadOverlayBtn = document.createElement("button");
    uploadOverlayBtn.type = "button";
    uploadOverlayBtn.className = "dlc-shop-btn";
    uploadOverlayBtn.textContent = "Upload Overlay";
    const overlayFileInput = document.createElement("input");
    overlayFileInput.type = "file";
    overlayFileInput.accept = "image/*,.png,.jpg,.jpeg,.webp,.svg,.gif";
    overlayFileInput.style.display = "none";
    uploadOverlayBtn.addEventListener("click", () => overlayFileInput.click());
    overlayFileInput.addEventListener("change", async () => {
      const file = overlayFileInput.files?.[0];
      overlayFileInput.value = "";
      if (!file || !file.type || !file.type.startsWith("image/")) return;
      uploadOverlayBtn.disabled = true;
      try {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
        if (!dataUrl) return;
        await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl("/api/v1/plugins/menu-plugin/files"),
          { fileName: file.name, data: dataUrl }
        );
        overlayInput.value = file.name;
        setStatus(`Overlay '${file.name}' uploaded. Press Save Menu to apply it.`);
      } catch (error) {
        setStatus(`Could not upload the overlay. ${error?.message || ""}`, true);
      } finally {
        uploadOverlayBtn.disabled = false;
      }
    });
    headControls.appendChild(uploadOverlayBtn);
    head.appendChild(headControls);
    editor.appendChild(head);

    const hint = document.createElement("span");
    hint.className = "settings-field-hint";
    hint.textContent = "Settings, Profile, and Admin are required menu items — reorder them anywhere, but they cannot be removed. Add children to make a submenu. Keywords make items findable from the menu search bar. Plugin sections (Links, Urantia, …) appear in the link report once loaded.";
    editor.appendChild(hint);

    // Warn when the app menu can't be read — usually the Menu Order plugin
    // hasn't loaded in this session (plugins load after connecting).
    if (!allUnits.topLevel || allUnits.topLevel.length === 0) {
      const warning = document.createElement("div");
      warning.className = "dlc-menu-warning";
      warning.textContent = "Could not read the app menu — the Menu Order plugin may not be loaded yet. Hard refresh, or use Reload Plugins, then reopen this editor.";
      editor.appendChild(warning);
    }

    const listEl = document.createElement("div");
    listEl.className = "dlc-menu-rows";
    editor.appendChild(listEl);

    const moveRow = (index, direction) => {
      const next = index + direction;
      if (next < 0 || next >= rows.length) return;
      [rows[index], rows[next]] = [rows[next], rows[index]];
      renderRows();
      renderLinkReport();
    };

    let dragSourceIndex = -1;
    // Rows whose submenu editor is expanded (keyed by row object).
    const expandedSubmenuRows = new Set();
    const moveRowTo = (fromIndex, toIndex) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= rows.length || toIndex >= rows.length) return;
      const [moved] = rows.splice(fromIndex, 1);
      rows.splice(toIndex, 0, moved);
      renderRows();
      renderLinkReport();
    };

    function attachDragHandlers(rowEl, index) {
      const handle = rowEl.querySelector(".dlc-menu-drag-handle");
      if (!handle) return;
      handle.draggable = true;
      handle.addEventListener("dragstart", (event) => {
        dragSourceIndex = index;
        rowEl.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        try {
          event.dataTransfer.setData("text/plain", String(index));
        } catch (_error) {}
      });
      handle.addEventListener("dragend", () => {
        dragSourceIndex = -1;
        rowEl.classList.remove("is-dragging");
      });
      rowEl.addEventListener("dragover", (event) => {
        if (dragSourceIndex < 0 || dragSourceIndex === index) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        rowEl.classList.add("is-drag-over");
      });
      rowEl.addEventListener("dragleave", () => {
        rowEl.classList.remove("is-drag-over");
      });
      rowEl.addEventListener("drop", (event) => {
        event.preventDefault();
        rowEl.classList.remove("is-drag-over");
        const fromIndex = dragSourceIndex;
        dragSourceIndex = -1;
        moveRowTo(fromIndex, index);
      });
    }

    const removeRow = (index) => {
      rows.splice(index, 1);
      renderRows();
      renderLinkReport();
    };

    function renderRows() {
      listEl.innerHTML = "";
      if (!rows.length) {
        const empty = document.createElement("span");
        empty.className = "settings-field-hint";
        empty.textContent = "No menu items configured. Add entries below or from the link report.";
        listEl.appendChild(empty);
        return;
      }
      rows.forEach((row, index) => {
        const rowEl = document.createElement("div");
        rowEl.className = "dlc-menu-row dlc-menu-row-block";

        if (row.type === "search") {
          rowEl.classList.add("dlc-menu-row-header");
          const rowTop = document.createElement("div");
          rowTop.className = "dlc-menu-row-top";
          const dragHandle = document.createElement("button");
          dragHandle.type = "button";
          dragHandle.className = "dlc-menu-drag-handle";
          dragHandle.textContent = "⋮⋮";
          dragHandle.title = "Drag to reorder";
          const labelInput = document.createElement("input");
          labelInput.type = "text";
          labelInput.value = row.label;
          labelInput.placeholder = "Search placeholder";
          labelInput.maxLength = 60;
          labelInput.addEventListener("input", () => {
            row.label = labelInput.value.trim();
          });
          const upBtn = document.createElement("button");
          upBtn.type = "button";
          upBtn.className = "dlc-shop-btn";
          upBtn.textContent = "↑";
          upBtn.disabled = index === 0;
          upBtn.addEventListener("click", () => moveRow(index, -1));
          const downBtn = document.createElement("button");
          downBtn.type = "button";
          downBtn.className = "dlc-shop-btn";
          downBtn.textContent = "↓";
          downBtn.disabled = index === rows.length - 1;
          downBtn.addEventListener("click", () => moveRow(index, 1));
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "dlc-shop-btn";
          removeBtn.textContent = "×";
          removeBtn.title = "Remove search bar";
          removeBtn.addEventListener("click", () => {
            showSearchCheckbox.checked = false;
            removeRow(index);
          });
          rowTop.appendChild(dragHandle);
          rowTop.appendChild(labelInput);
          rowTop.appendChild(upBtn);
          rowTop.appendChild(downBtn);
          rowTop.appendChild(removeBtn);
          rowEl.appendChild(rowTop);
          labelInput.title = "Menu search bar — drag to place it in the side panel";
          attachDragHandlers(rowEl, index);
          listEl.appendChild(rowEl);
          return;
        }

        if (row.type === "header") {
          rowEl.classList.add("dlc-menu-row-header");
          const rowTop = document.createElement("div");
          rowTop.className = "dlc-menu-row-top";
          const dragHandle = document.createElement("button");
          dragHandle.type = "button";
          dragHandle.className = "dlc-menu-drag-handle";
          dragHandle.textContent = "⋮⋮";
          dragHandle.title = "Drag to reorder";
          const labelInput = document.createElement("input");
          labelInput.type = "text";
          labelInput.value = row.label;
          labelInput.placeholder = "Header label (e.g. CORE)";
          labelInput.maxLength = 60;
          labelInput.addEventListener("input", () => {
            row.label = labelInput.value.trim();
          });
          const upBtn = document.createElement("button");
          upBtn.type = "button";
          upBtn.className = "dlc-shop-btn";
          upBtn.textContent = "↑";
          upBtn.disabled = index === 0;
          upBtn.addEventListener("click", () => moveRow(index, -1));
          const downBtn = document.createElement("button");
          downBtn.type = "button";
          downBtn.className = "dlc-shop-btn";
          downBtn.textContent = "↓";
          downBtn.disabled = index === rows.length - 1;
          downBtn.addEventListener("click", () => moveRow(index, 1));
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "dlc-shop-btn";
          removeBtn.textContent = "×";
          removeBtn.title = "Remove header";
          removeBtn.addEventListener("click", () => removeRow(index));
          rowTop.appendChild(dragHandle);
          rowTop.appendChild(labelInput);
          rowTop.appendChild(upBtn);
          rowTop.appendChild(downBtn);
          rowTop.appendChild(removeBtn);
          rowEl.appendChild(rowTop);
          labelInput.title = "Non-clickable group header";
          attachDragHandlers(rowEl, index);
          listEl.appendChild(rowEl);
          return;
        }

        const rowTop = document.createElement("div");
        rowTop.className = "dlc-menu-row-top";

        const dragHandle = document.createElement("button");
        dragHandle.type = "button";
        dragHandle.className = "dlc-menu-drag-handle";
        dragHandle.textContent = "⋮⋮";
        dragHandle.title = "Drag to reorder";

        const labelInput = document.createElement("input");
        labelInput.type = "text";
        labelInput.value = row.label;
        labelInput.placeholder = row.id;
        labelInput.maxLength = 60;
        labelInput.addEventListener("input", () => {
          row.label = labelInput.value.trim();
        });

        const required = isRequiredMenuId(row.id);
        const enabledCheckbox = document.createElement("input");
        enabledCheckbox.type = "checkbox";
        enabledCheckbox.checked = required ? true : row.enabled;
        enabledCheckbox.disabled = required;
        enabledCheckbox.title = required ? "Required — always in the menu" : "Show in menu";
        enabledCheckbox.addEventListener("change", () => {
          if (!required) row.enabled = enabledCheckbox.checked;
        });
        if (required) row.enabled = true;

        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "dlc-shop-btn";
        upBtn.textContent = "↑";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", () => moveRow(index, -1));

        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "dlc-shop-btn";
        downBtn.textContent = "↓";
        downBtn.disabled = index === rows.length - 1;
        downBtn.addEventListener("click", () => moveRow(index, 1));

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "dlc-shop-btn";
        removeBtn.textContent = "×";
        removeBtn.title = required ? "Required — cannot remove" : "Remove from menu";
        removeBtn.disabled = required;
        removeBtn.addEventListener("click", () => {
          if (!required) removeRow(index);
        });

        rowTop.appendChild(dragHandle);
        rowTop.appendChild(labelInput);
        rowTop.appendChild(enabledCheckbox);
        rowTop.appendChild(upBtn);
        rowTop.appendChild(downBtn);
        rowTop.appendChild(removeBtn);
        rowEl.appendChild(rowTop);

        const keywordsRow = document.createElement("div");
        keywordsRow.className = "dlc-menu-row-keywords";
        const keywordsLabel = document.createElement("span");
        keywordsLabel.className = "settings-field-hint";
        keywordsLabel.textContent = "Keywords:";
        const keywordsInput = document.createElement("input");
        keywordsInput.type = "text";
        keywordsInput.value = row.keywords;
        keywordsInput.maxLength = 160;
        keywordsInput.placeholder = "comma-separated search terms";
        keywordsInput.title = "Extra search terms matched by the menu search bar";
        keywordsInput.addEventListener("input", () => {
          row.keywords = keywordsInput.value.trim();
        });
        keywordsRow.appendChild(keywordsLabel);
        keywordsRow.appendChild(keywordsInput);
        rowEl.appendChild(keywordsRow);

        labelInput.title = describeMenuId(row.id) || row.id;

        // Submenu editing is tucked into an expandable panel instead of an
        // always-visible input so rows stay compact.
        const submenuBtn = document.createElement("button");
        submenuBtn.type = "button";
        submenuBtn.className = "dlc-shop-btn dlc-menu-submenu-toggle";
        submenuBtn.textContent = row.children.length ? `Submenu (${row.children.length})` : "Submenu";
        submenuBtn.title = row.children.length
          ? "Edit this entry's dropdown children"
          : "Add children to turn this entry into a dropdown submenu";
        submenuBtn.classList.toggle("is-active", expandedSubmenuRows.has(row));
        submenuBtn.addEventListener("click", () => {
          if (expandedSubmenuRows.has(row)) {
            expandedSubmenuRows.delete(row);
          } else {
            expandedSubmenuRows.add(row);
          }
          renderRows();
        });
        rowTop.insertBefore(submenuBtn, upBtn);

        if (expandedSubmenuRows.has(row)) {
          const submenuPanel = document.createElement("div");
          submenuPanel.className = "dlc-menu-row-submenu";
          const childrenHint = document.createElement("span");
          childrenHint.className = "settings-field-hint";
          childrenHint.textContent = "Comma-separated child ids (existing menu buttons or sections):";
          submenuPanel.appendChild(childrenHint);
          const childrenInput = document.createElement("input");
          childrenInput.type = "text";
          childrenInput.maxLength = 500;
          childrenInput.placeholder = "Submenu children: tarot-cards, gods …";
          childrenInput.value = row.children.map((child) => displayMenuId(child.id)).join(", ");
          childrenInput.addEventListener("input", () => {
            row.children = childrenInput.value
              .split(",")
              .map((id) => String(id).trim())
              .filter(Boolean)
              .map((id) => {
                const resolved = resolveMenuId(id);
                const existingChild = row.children.find((child) => child.id === resolved || child.id === id);
                return { id: resolved, label: existingChild?.label || "", enabled: existingChild?.enabled !== false, keywords: existingChild?.keywords || "" };
              });
          });
          submenuPanel.appendChild(childrenInput);
          if (row.children.length) {
            const childrenInfo = document.createElement("div");
            childrenInfo.className = "dlc-menu-children-info";
            row.children.forEach((child) => {
              const childDataset = datasetForId(child.id);
              const childLine = document.createElement("div");
              childLine.className = "dlc-menu-children-line";
              const childText = document.createElement("span");
              if (isMenuGroupId(child.id)) {
                childText.textContent = `└ ${displayMenuId(child.id)} → menu group — use its subpages instead`;
              } else {
                childText.textContent = `└ ${displayMenuId(child.id)}${childDataset ? ` → ${childDataset}` : " → unknown target (broken link?)"}`;
              }
              const childKeywords = document.createElement("input");
              childKeywords.type = "text";
              childKeywords.value = child.keywords || "";
              childKeywords.maxLength = 160;
              childKeywords.placeholder = "keywords";
              childKeywords.title = "Extra search terms matched by the menu search bar";
              childKeywords.addEventListener("input", () => {
                child.keywords = childKeywords.value.trim();
              });
              childLine.appendChild(childText);
              childLine.appendChild(childKeywords);
              childrenInfo.appendChild(childLine);
            });
            submenuPanel.appendChild(childrenInfo);
          }
          rowEl.appendChild(submenuPanel);
        }

        attachDragHandlers(rowEl, index);
        listEl.appendChild(rowEl);
      });
    }

    function renderLinkReport() {
      let report = menuPlugin && typeof menuPlugin.getLinkReport === "function"
        ? menuPlugin.getLinkReport({ showUnlisted: !hideCheckbox.checked, items: rows.map((row) => ({ id: row.id, children: row.children.map((child) => ({ id: child.id })) })) })
        : { missing: [], broken: [] };

      // Fallback report when the plugin API is unavailable.
      if (!menuPlugin) {
        const ALWAYS_VISIBLE = new Set(["open-settings", "open-profile", "open-admin"]);
        const configuredIds = new Set();
        rows.forEach((row) => {
          const resolved = resolveMenuId(row.id);
          if (resolved && resolved !== "undefined") configuredIds.add(resolved);
          row.children.forEach((child) => {
            const resolvedChild = resolveMenuId(child.id);
            if (resolvedChild && resolvedChild !== "undefined") configuredIds.add(resolvedChild);
          });
        });
        const topUnits = collectTopbarUnits();
        report = {
          missing: topUnits
            .filter((unit) => unit.id && !ALWAYS_VISIBLE.has(unit.id) && !configuredIds.has(unit.id) && !configuredIds.has(String(unit.id).replace(/^open-/, "")))
            .map((unit) => ({ id: unit.id, label: unit.label || unit.id, dataset: datasetForId(unit.id) })),
          broken: [...configuredIds].filter((id) => !topUnits.some((unit) => unit.id === id || String(unit.id).replace(/^open-/, "") === id) && !datasetForId(id))
        };
      }

      reportEl.innerHTML = "";

      reportSummary.textContent = `Link report — ${report.missing.length} not in menu · ${report.broken.length} broken`;
      if (report.broken.length) {
        reportDetails.open = true;
      }

      const unitCount = (allUnits.topLevel || []).length;
      if (unitCount === 0) {
        const warning = document.createElement("span");
        warning.className = "settings-field-hint is-error";
        warning.textContent = "Could not read the app menu entries — the Menu Order plugin may not be loaded. Hard refresh (or use Reload Plugins) and reopen this editor.";
        reportEl.appendChild(warning);
        return;
      }

      if (report.missing.length) {
        const missingHead = document.createElement("strong");
        missingHead.className = "dlc-menu-report-head";
        missingHead.textContent = `Not in menu (${report.missing.length})`;
        reportEl.appendChild(missingHead);
        if (report.missing.length > 1) {
          const addAllRow = document.createElement("div");
          addAllRow.className = "dlc-menu-report-row";
          const addAllBtn = document.createElement("button");
          addAllBtn.type = "button";
          addAllBtn.className = "dlc-shop-btn";
          addAllBtn.textContent = "＋ Add All";
          addAllBtn.title = "Add every missing entry to the menu";
          addAllBtn.addEventListener("click", () => {
            report.missing.forEach((entry) => {
              const displayId = entry.displayId || displayMenuId(entry.id);
              if (!rows.some((existing) => existing.id === resolveMenuId(entry.id))) {
                rows.push({ type: "item", id: resolveMenuId(entry.id), label: entry.label || displayId, enabled: true, children: [] });
              }
            });
            renderRows();
            renderLinkReport();
          });
          addAllRow.appendChild(addAllBtn);
          reportEl.appendChild(addAllRow);
        }
        report.missing.forEach((entry) => {
          const row = document.createElement("div");
          row.className = "dlc-menu-report-row";
          const text = document.createElement("span");
          text.className = "settings-field-hint";
          const displayId = entry.displayId || displayMenuId(entry.id);
          text.textContent = `${displayId}${entry.isSubpage ? " (subpage)" : ""}${entry.dataset ? ` → ${entry.dataset}` : ""}`;
          row.appendChild(text);
          const addBtn = document.createElement("button");
          addBtn.type = "button";
          addBtn.className = "dlc-shop-btn";
          addBtn.textContent = "Add";
          addBtn.addEventListener("click", () => {
            rows.push({ type: "item", id: resolveMenuId(entry.id), label: entry.label || displayId, enabled: true, children: [] });
            renderRows();
            renderLinkReport();
          });
          row.appendChild(addBtn);
          reportEl.appendChild(row);
        });
      } else {
        const ok = document.createElement("span");
        ok.className = "settings-field-hint";
        ok.textContent = "Every app entry is in the menu.";
        reportEl.appendChild(ok);
      }

      if (report.broken.length) {
        const brokenHead = document.createElement("strong");
        brokenHead.className = "dlc-menu-report-head is-error";
        brokenHead.textContent = `Broken links (${report.broken.length})`;
        reportEl.appendChild(brokenHead);
        report.broken.forEach((entry) => {
          const row = document.createElement("div");
          row.className = "dlc-menu-report-row";
          const text = document.createElement("span");
          text.className = "settings-field-hint is-error";
          text.textContent = `${entry.id} — not an app entry or known section`;
          row.appendChild(text);
          reportEl.appendChild(row);
        });
      }
    }

    const reportDetails = document.createElement("details");
    reportDetails.className = "dlc-menu-report-details";
    const reportSummary = document.createElement("summary");
    reportSummary.className = "dlc-menu-report-head";
    reportSummary.textContent = "Link report";
    reportDetails.appendChild(reportSummary);
    const reportEl = document.createElement("div");
    reportEl.className = "dlc-menu-report";
    reportDetails.appendChild(reportEl);
    editor.appendChild(reportDetails);

    loadingEl.remove();
    renderRows();
    renderLinkReport();

    // --- Menu presets (shareable) --------------------------------------------

    function buildCurrentConfig() {
      return {
        showUnlisted: !hideCheckbox.checked,
        menuTitle: String(menuTitleInput.value ?? "").trim(),
        menuSpacing: spacingSelect.value === "compact" || spacingSelect.value === "roomy" ? spacingSelect.value : "normal",
        menuTheme: themeSelect.value || "default",
        logo: String(logoInput.value ?? "").trim(),
        overlayBackground: String(overlayInput.value ?? "").trim(),
        hideMenuButton: hideMenuButtonCheckbox.checked === true,
        showSearch: showSearchCheckbox.checked === true || rows.some((row) => row.type === "search"),
        items: rows
          .filter((row) => row.type === "header" || row.type === "search" || resolveMenuId(row.id))
          .map((row) => {
            if (row.type === "header") {
              return { type: "header", label: row.label };
            }
            if (row.type === "search") {
              return { type: "search", id: "mp-menu-search", label: row.label || "Search menu…" };
            }
            const keywords = String(row.keywords || "").trim();
            return {
              id: resolveMenuId(row.id),
              label: row.label,
              enabled: row.enabled,
              ...(keywords ? { keywords } : {}),
              children: row.children.length
                ? row.children
                    .filter((child) => resolveMenuId(child.id))
                    .map((child) => {
                      const childKeywords = String(child.keywords || "").trim();
                      return {
                        id: resolveMenuId(child.id),
                        label: child.label,
                        enabled: child.enabled,
                        ...(childKeywords ? { keywords: childKeywords } : {})
                      };
                    })
                : []
            };
          })
      };
    }

    async function readMenuPresets() {
      try {
        const listing = await window.TarotDataService.requestJson(
          "GET",
          window.TarotDataService.buildApiUrl("/api/v1/plugins/menu-plugin/contents")
        );
        const files = Array.isArray(listing?.files) ? listing.files : [];
        const hasPresets = files.some((file) => String(file?.name || file || "").toLowerCase() === "presets.json");
        if (!hasPresets) return {};
        const payload = await window.TarotDataService.requestJson(
          "GET",
          window.TarotDataService.buildApiUrl("/api/v1/plugins/menu-plugin/presets.json")
        );
        const presets = payload?.presets || payload?.data?.presets;
        return presets && typeof presets === "object" ? presets : {};
      } catch (_error) {
        return {};
      }
    }

    async function writeMenuPresets(presets) {
      const bytes = new TextEncoder().encode(JSON.stringify({ presets }, null, 2));
      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      const base64 = btoa(binary);
      try {
        await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl("/api/v1/plugins/menu-plugin/files"),
          { fileName: "presets.json", data: base64 }
        );
      } catch (error) {
        const message = String(error?.message || "");
        if (/unsupported file type/i.test(message)) {
          throw new Error("This server does not accept .json plugin uploads yet — restart the API server to enable presets.");
        }
        throw error;
      }
    }

    function applyPresetToRows(preset) {
      rows.splice(0, rows.length, ...(Array.isArray(preset?.items) ? preset.items : []).map((item) => {
        if (item?.type === "header") {
          return { type: "header", id: "", label: String(item?.label || "").trim(), enabled: true, keywords: "", children: [] };
        }
        if (item?.type === "search" || String(item?.id || "") === "mp-menu-search") {
          return { type: "search", id: "mp-menu-search", label: String(item?.label || "Search menu…").trim(), enabled: true, keywords: "", children: [] };
        }
        return {
          type: "item",
          id: resolveMenuId(String(item?.id || "")),
          label: String(item?.label || "").trim(),
          enabled: item?.enabled !== false,
          keywords: String(item?.keywords || "").trim(),
          children: (Array.isArray(item?.children) ? item.children : []).map((child) => ({
            id: resolveMenuId(String(child?.id || "")),
            label: String(child?.label || "").trim(),
            enabled: child?.enabled !== false,
            keywords: String(child?.keywords || "").trim()
          }))
        };
      }).filter((row) => row.type === "header" || row.type === "search" || (row.id && row.id !== "undefined")));
      hideCheckbox.checked = preset?.showUnlisted === false;
      menuTitleInput.value = String(preset?.menuTitle || "");
      spacingSelect.value = preset?.menuSpacing === "compact" || preset?.menuSpacing === "roomy" ? preset.menuSpacing : "normal";
      themeSelect.value = themeOptions.some(([value]) => value === preset?.menuTheme) ? preset.menuTheme : "default";
      ensureRequiredRows();
      logoInput.value = String(preset?.logo || "");
      overlayInput.value = String(preset?.overlayBackground || "");
      hideMenuButtonCheckbox.checked = preset?.hideMenuButton === true;
      showSearchCheckbox.checked = preset?.showSearch === true;
      renderRows();
      renderLinkReport();
    }

    async function loadPreset(name, presets) {
      if (!name || !presets[name]) {
        setStatus("Choose a preset to load.", true);
        return;
      }
      if (!window.confirm(`Load preset '${name}'? This replaces the menu editor rows and applies it to the live menu.`)) return;
      applyPresetToRows(presets[name]);
      // Apply the preset to the actual menu right away so users can see it and
      // keep editing from this state.
      try {
        await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl("/api/v1/plugins/menu-plugin/config"),
          { config: buildCurrentConfig() }
        );
        document.dispatchEvent(new CustomEvent("taro-plugin-config-updated", {
          detail: { pluginName: "menu-plugin", config: buildCurrentConfig() }
        }));
        setStatus(`Loaded preset '${name}' and applied it to the menu.`);
      } catch (error) {
        setStatus(`Loaded preset '${name}' into the editor, but could not apply it live. ${error?.message || ""}`, true);
      }
    }

    // --- Compact presets toolbar ----------------------------------------------

    const presetsToolbar = document.createElement("div");
    presetsToolbar.className = "dlc-menu-presets-toolbar";
    const presetsLabel = document.createElement("span");
    presetsLabel.className = "dlc-menu-hide-label";
    presetsLabel.textContent = "Presets:";
    presetsToolbar.appendChild(presetsLabel);
    const presetsSelect = document.createElement("select");
    presetsSelect.className = "dlc-menu-preset-select";
    presetsSelect.title = "Saved menu presets";
    presetsToolbar.appendChild(presetsSelect);
    const loadPresetBtn = document.createElement("button");
    loadPresetBtn.type = "button";
    loadPresetBtn.className = "dlc-shop-btn";
    loadPresetBtn.textContent = "Load";
    loadPresetBtn.title = "Load the selected preset into the editor and apply it to the live menu";
    loadPresetBtn.disabled = true;
    presetsToolbar.appendChild(loadPresetBtn);
    const saveAsBtn = document.createElement("button");
    saveAsBtn.type = "button";
    saveAsBtn.className = "dlc-shop-btn";
    saveAsBtn.textContent = "Save As…";
    saveAsBtn.title = "Save the current menu as a named preset";
    presetsToolbar.appendChild(saveAsBtn);
    const deletePresetBtn = document.createElement("button");
    deletePresetBtn.type = "button";
    deletePresetBtn.className = "dlc-shop-btn";
    deletePresetBtn.textContent = "×";
    deletePresetBtn.title = "Delete the selected preset";
    deletePresetBtn.disabled = true;
    presetsToolbar.appendChild(deletePresetBtn);
    editor.appendChild(presetsToolbar);

    function renderPresetsList(presets) {
      const names = Object.keys(presets || {}).sort();
      presetsSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = names.length ? "— choose a preset —" : "— no presets yet —";
      presetsSelect.appendChild(placeholder);
      names.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        presetsSelect.appendChild(option);
      });
      loadPresetBtn.disabled = !names.length;
      deletePresetBtn.disabled = !presetsSelect.value;
    }

    presetsSelect.addEventListener("change", () => {
      deletePresetBtn.disabled = !presetsSelect.value;
    });

    loadPresetBtn.addEventListener("click", async () => {
      const presets = await readMenuPresets();
      await loadPreset(presetsSelect.value, presets);
    });

    deletePresetBtn.addEventListener("click", async () => {
      const name = String(presetsSelect.value || "");
      if (!name) return;
      if (!window.confirm(`Delete preset '${name}'?`)) return;
      deletePresetBtn.disabled = true;
      try {
        const presets = await readMenuPresets();
        delete presets[name];
        await writeMenuPresets(presets);
        renderPresetsList(presets);
        setStatus(`Deleted preset '${name}'.`);
      } catch (error) {
        setStatus(`Could not delete preset. ${error?.message || ""}`, true);
      } finally {
        deletePresetBtn.disabled = !presetsSelect.value;
      }
    });

    saveAsBtn.addEventListener("click", () => {
      const existing = presetsToolbar.querySelector(".dlc-menu-save-as");
      if (existing) {
        existing.remove();
        return;
      }
      const saveAsRow = document.createElement("span");
      saveAsRow.className = "dlc-menu-save-as";
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.maxLength = 60;
      nameInput.placeholder = "Preset name (e.g. guest-menu)";
      const okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "dlc-shop-btn";
      okBtn.textContent = "Save";
      saveAsRow.appendChild(nameInput);
      saveAsRow.appendChild(okBtn);
      presetsToolbar.appendChild(saveAsRow);
      nameInput.focus();
      const finishSave = async () => {
        const name = String(nameInput.value || "").trim() || "default";
        okBtn.disabled = true;
        try {
          const presets = await readMenuPresets();
          presets[name] = buildCurrentConfig();
          await writeMenuPresets(presets);
          saveAsRow.remove();
          renderPresetsList(presets);
          setStatus(`Preset '${name}' saved.`);
        } catch (error) {
          setStatus(`Could not save preset. ${error?.message || ""}`, true);
          okBtn.disabled = false;
        }
      };
      okBtn.addEventListener("click", finishSave);
      nameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void finishSave();
        }
      });
    });

    void readMenuPresets().then(renderPresetsList);

    const actions = document.createElement("div");
    actions.className = "dlc-menu-editor-actions";
    const addHeaderBtn = document.createElement("button");
    addHeaderBtn.type = "button";
    addHeaderBtn.className = "dlc-shop-btn";
    addHeaderBtn.textContent = "＋ Add Header";
    addHeaderBtn.title = "Add a non-clickable group header";
    addHeaderBtn.addEventListener("click", () => {
      rows.push({ type: "header", id: "", label: "", enabled: true, children: [] });
      renderRows();
      renderLinkReport();
    });
    const addSearchBtn = document.createElement("button");
    addSearchBtn.type = "button";
    addSearchBtn.className = "dlc-shop-btn";
    addSearchBtn.textContent = "＋ Add Search";
    addSearchBtn.title = "Add a menu search bar you can drag into place";
    addSearchBtn.addEventListener("click", () => {
      if (!rows.some((row) => row.type === "search")) {
        rows.push({ type: "search", id: "mp-menu-search", label: "Search menu…", enabled: true, keywords: "", children: [] });
      }
      showSearchCheckbox.checked = true;
      renderRows();
      renderLinkReport();
    });
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "dlc-shop-btn";
    saveBtn.textContent = "Save Menu";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "dlc-shop-btn";
    cancelBtn.textContent = "Close";
    actions.appendChild(addHeaderBtn);
    actions.appendChild(addSearchBtn);
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    editor.appendChild(actions);

    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      setStatus("Saving menu order…");
      const nextConfig = buildCurrentConfig();
      try {
        await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl("/api/v1/plugins/menu-plugin/config"),
          { config: nextConfig }
        );
        document.dispatchEvent(new CustomEvent("taro-plugin-config-updated", {
          detail: { pluginName: "menu-plugin", config: nextConfig }
        }));
        setStatus("Menu order saved.");
        closeOverlay();
      } catch (error) {
        setStatus(`Could not save menu order. ${error?.message || ""}`, true);
      } finally {
        saveBtn.disabled = false;
      }
    });

    cancelBtn.addEventListener("click", () => {
      closeOverlay();
    });
  }

  function closeSettingsOverlay() {
    document.querySelector(".dlc-settings-overlay")?.remove();
    document.querySelector(".dlc-menu-overlay")?.remove();
  }

  function openSettingsOverlay(title) {
    closeSettingsOverlay();
    const overlay = document.createElement("div");
    overlay.className = "dlc-settings-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", title || "Plugin Settings");
    const panel = document.createElement("div");
    panel.className = "dlc-settings-overlay-panel";
    const head = document.createElement("div");
    head.className = "dlc-settings-overlay-head";
    const headTitle = document.createElement("strong");
    headTitle.textContent = title || "Plugin Settings";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dlc-shop-btn";
    closeBtn.textContent = "Close ✕";
    closeBtn.title = "Close settings (Esc)";
    head.append(headTitle, closeBtn);
    const body = document.createElement("div");
    body.className = "dlc-plugin-settings dlc-settings-overlay-body";
    panel.append(head, body);
    overlay.appendChild(panel);
    const onKeydown = (event) => {
      if (event.key === "Escape") closeOverlay();
    };
    function closeOverlay() {
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
    }
    document.addEventListener("keydown", onKeydown);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) closeOverlay();
    });
    closeBtn.addEventListener("click", closeOverlay);
    document.body.appendChild(overlay);
    return body;
  }

  function createPluginSettingsShell(_cardEl, title) {
    return openSettingsOverlay(title);
  }

  function createSettingsStatus(settingsEl) {
    const status = document.createElement("span");
    status.className = "settings-field-hint";
    status.setAttribute("aria-live", "polite");
    settingsEl.appendChild(status);
    return {
      set(text, isError = false) {
        status.textContent = text;
        status.classList.toggle("is-error", Boolean(isError));
      }
    };
  }

  async function renderMusicPlayerSettings(settingsEl, plugin) {
    const status = createSettingsStatus(settingsEl);
    const service = window.TarotDataService;
    const adminMode = isAdmin();
    const settingsBody = document.createElement("div");
    settingsBody.className = "dlc-plugin-settings-body";
    settingsEl.appendChild(settingsBody);

    const LIBRARY_DIR = "library";
    const AUDIO_EXTENSIONS = new Set([
      ".mp3", ".ogg", ".oga", ".wav", ".webm", ".weba", ".m4a", ".m4b", ".mp4",
      ".flac", ".aac", ".opus", ".aiff", ".aif", ".wma", ".alac", ".amr", ".wv"
    ]);
    const isAudio = (file) => {
      const name = String(file?.name || "").toLowerCase();
      if (!name || name.startsWith(".")) return false;
      return AUDIO_EXTENSIONS.has(`.${name.split(".").pop()}`);
    };
    const slugPlaylist = (name) => String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "playlist";

    let config = { align: "center", playlists: [] };
    try {
      const payload = await service.requestJson("GET", service.buildApiUrl(`/api/v1/plugins/${plugin.name}/config`));
      if (payload?.config && typeof payload.config === "object") {
        config = { align: "center", playlists: [], ...payload.config };
      }
    } catch (_error) {}
    if (!Array.isArray(config.playlists)) {
      const migrated = [];
      Object.entries(config.playlistOrder || {}).forEach(([name, tracks]) => {
        migrated.push({
          id: slugPlaylist(name),
          name,
          tracks: Array.isArray(tracks) ? tracks.map((entry) => String(entry || "").trim()).filter(Boolean) : []
        });
      });
      config.playlists = migrated;
    }

    let uploadLimitBytes = 0;
    try {
      const pluginsPayload = await service.requestJson("GET", service.buildApiUrl("/api/v1/plugins"));
      const configured = Number(pluginsPayload?.uploadLimitBytes);
      if (Number.isFinite(configured) && configured > 0) uploadLimitBytes = Math.floor(configured);
    } catch (_error) {}

    let library = [];
    let currentPlaylistId = config.playlists[0]?.id || "";

    async function saveConfig(next, message) {
      await service.requestJson(
        "POST",
        service.buildApiUrl(`/api/v1/plugins/${plugin.name}/config`),
        { config: next }
      );
      config = next;
      document.dispatchEvent(new CustomEvent("taro-plugin-content-updated", {
        detail: { pluginName: plugin.name }
      }));
      if (message) status.set(message);
    }

    async function loadLibrary() {
      const byName = new Map();
      const addFiles = (files, dir) => {
        (Array.isArray(files) ? files : []).filter(isAudio).forEach((file) => {
          const key = String(file.name || "").toLowerCase();
          if (key && !byName.has(key)) byName.set(key, { ...file, dir });
        });
      };
      try {
        const lib = await service.requestJson("GET", service.buildApiUrl(`/api/v1/plugins/${plugin.name}/contents`, { dir: LIBRARY_DIR }));
        addFiles(lib?.files, LIBRARY_DIR);
      } catch (_error) {}
      try {
        const root = await service.requestJson("GET", service.buildApiUrl(`/api/v1/plugins/${plugin.name}/contents`, { dir: "" }));
        const dirs = (Array.isArray(root?.dirs) ? root.dirs : []).map((entry) => String(entry?.name || "")).filter(Boolean);
        for (const dir of dirs) {
          if (dir === LIBRARY_DIR) continue;
          try {
            const extra = await service.requestJson("GET", service.buildApiUrl(`/api/v1/plugins/${plugin.name}/contents`, { dir }));
            addFiles(extra?.files, dir);
          } catch (_error) {}
        }
      } catch (_error) {}
      library = [...byName.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    const playlistHead = document.createElement("div");
    playlistHead.className = "dlc-settings-row-head";
    playlistHead.innerHTML = "<strong>Playlists</strong><span class=\"settings-field-hint\">Songs live in one shared library. Check the tracks that belong to the selected playlist, then save.</span>";
    settingsBody.appendChild(playlistHead);

    const playlistRow = document.createElement("div");
    playlistRow.className = "dlc-menu-presets-toolbar";
    const playlistSelect = document.createElement("select");
    playlistSelect.className = "dlc-menu-preset-select";
    playlistSelect.title = "Playlist";
    playlistRow.appendChild(playlistSelect);
    const newPlaylistBtn = document.createElement("button");
    newPlaylistBtn.type = "button";
    newPlaylistBtn.className = "dlc-shop-btn";
    newPlaylistBtn.textContent = "＋ New Playlist";
    newPlaylistBtn.disabled = !adminMode;
    playlistRow.appendChild(newPlaylistBtn);
    const deletePlaylistBtn = document.createElement("button");
    deletePlaylistBtn.type = "button";
    deletePlaylistBtn.className = "dlc-shop-btn";
    deletePlaylistBtn.textContent = "×";
    deletePlaylistBtn.title = "Remove this playlist (songs stay in the library)";
    deletePlaylistBtn.disabled = !adminMode;
    playlistRow.appendChild(deletePlaylistBtn);
    const alignLabel = document.createElement("span");
    alignLabel.className = "dlc-menu-hide-label";
    alignLabel.textContent = "Align:";
    playlistRow.appendChild(alignLabel);
    const alignSelect = document.createElement("select");
    alignSelect.className = "dlc-menu-preset-select";
    ["left", "center", "right"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.charAt(0).toUpperCase() + value.slice(1);
      alignSelect.appendChild(option);
    });
    alignSelect.value = ["left", "center", "right"].includes(String(config.align || "")) ? String(config.align) : "center";
    alignSelect.addEventListener("change", async () => {
      try {
        await saveConfig({ ...config, align: alignSelect.value }, `Player aligned ${alignSelect.value}.`);
      } catch (error) {
        status.set(`Could not save alignment. ${error?.message || ""}`, true);
        alignSelect.value = String(config.align || "center");
      }
    });
    playlistRow.appendChild(alignSelect);
    settingsBody.appendChild(playlistRow);

    const listHead = document.createElement("div");
    listHead.className = "dlc-settings-row-head";
    listHead.innerHTML = `<strong>Library</strong><span class="settings-field-hint">${adminMode ? "Upload once. Check songs for this playlist, then Save Playlist." : "Songs assigned to the selected playlist."}</span>`;
    settingsBody.appendChild(listHead);

    const listEl = document.createElement("div");
    listEl.className = "mp-admin-file-list";
    settingsBody.appendChild(listEl);

    const actionsRow = document.createElement("div");
    actionsRow.className = "dlc-shop-actions";
    settingsBody.appendChild(actionsRow);

    function currentPlaylist() {
      return (config.playlists || []).find((entry) => entry.id === currentPlaylistId) || null;
    }

    function refreshPlaylistSelect() {
      playlistSelect.innerHTML = "";
      (config.playlists || []).forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = entry.name || entry.id;
        playlistSelect.appendChild(option);
      });
      if (!currentPlaylist()) currentPlaylistId = config.playlists[0]?.id || "";
      playlistSelect.value = currentPlaylistId;
      deletePlaylistBtn.disabled = !adminMode || !currentPlaylist();
    }

    function renderLibraryList() {
      listEl.innerHTML = "";
      const selected = new Set((currentPlaylist()?.tracks || []).map((name) => String(name).toLowerCase()));
      if (!library.length) {
        const empty = document.createElement("span");
        empty.className = "settings-field-hint";
        empty.textContent = "No songs in the library yet.";
        listEl.appendChild(empty);
        return;
      }
      library.forEach((file) => {
        const row = document.createElement("label");
        row.className = "mp-admin-file-row";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = selected.has(String(file.name).toLowerCase());
        box.disabled = !adminMode || !currentPlaylist();
        box.dataset.track = file.name;
        const name = document.createElement("span");
        name.className = "mp-admin-file-name";
        name.textContent = file.name;
        row.append(box, name);
        if (adminMode) {
          const del = document.createElement("button");
          del.type = "button";
          del.className = "mp-track-delete";
          del.textContent = "×";
          del.title = "Remove from library";
          del.addEventListener("click", async (event) => {
            event.preventDefault();
            if (!window.confirm(`Delete '${file.name}' from the library?`)) return;
            try {
              await service.requestJson(
                "DELETE",
                service.buildApiUrl(`/api/v1/plugins/${plugin.name}/files/${encodeURIComponent(file.dir)}/${encodeURIComponent(file.name)}`)
              );
              config = {
                ...config,
                playlists: (config.playlists || []).map((entry) => ({
                  ...entry,
                  tracks: (entry.tracks || []).filter((track) => String(track).toLowerCase() !== String(file.name).toLowerCase())
                }))
              };
              await saveConfig(config);
              await loadLibrary();
              renderLibraryList();
              status.set(`Deleted '${file.name}'.`);
            } catch (error) {
              status.set(`Could not delete ${file.name}. ${error?.message || ""}`, true);
            }
          });
          row.appendChild(del);
        }
        listEl.appendChild(row);
      });
    }

    playlistSelect.addEventListener("change", () => {
      currentPlaylistId = playlistSelect.value;
      renderLibraryList();
    });

    newPlaylistBtn.addEventListener("click", async () => {
      if (!adminMode) return;
      const name = String(window.prompt("New playlist name:") || "").trim();
      if (!name) return;
      let id = slugPlaylist(name);
      const used = new Set((config.playlists || []).map((entry) => entry.id));
      let suffix = 2;
      while (used.has(id)) id = `${slugPlaylist(name)}-${suffix++}`;
      const next = { ...config, playlists: [...(config.playlists || []), { id, name, tracks: [] }] };
      try {
        await saveConfig(next, `Playlist '${name}' created.`);
        currentPlaylistId = id;
        refreshPlaylistSelect();
        renderLibraryList();
      } catch (error) {
        status.set(`Could not create playlist. ${error?.message || ""}`, true);
      }
    });

    deletePlaylistBtn.addEventListener("click", async () => {
      const target = currentPlaylist();
      if (!target || !window.confirm(`Remove playlist '${target.name}'? Songs stay in the library.`)) return;
      const next = { ...config, playlists: (config.playlists || []).filter((entry) => entry.id !== target.id) };
      try {
        await saveConfig(next, `Removed playlist '${target.name}'.`);
        currentPlaylistId = next.playlists[0]?.id || "";
        refreshPlaylistSelect();
        renderLibraryList();
      } catch (error) {
        status.set(`Could not remove playlist. ${error?.message || ""}`, true);
      }
    });

    if (adminMode) {
      const uploadLabel = document.createElement("label");
      uploadLabel.className = "mp-upload-btn";
      uploadLabel.textContent = "＋ Upload to library";
      const uploadInput = document.createElement("input");
      uploadInput.type = "file";
      uploadInput.multiple = true;
      uploadInput.accept = "audio/*,.mp3,.ogg,.oga,.wav,.webm,.weba,.m4a,.m4b,.mp4,.flac,.aac,.opus,.aiff,.aif,.wma,.alac,.amr,.wv";
      uploadInput.style.display = "none";
      uploadLabel.appendChild(uploadInput);
      uploadInput.addEventListener("change", async () => {
        const fileList = Array.from(uploadInput.files || []).filter((file) => file.type && file.type.startsWith("audio/"));
        uploadInput.value = "";
        if (!fileList.length) return;
        let uploaded = 0;
        let lastError = "";
        for (const file of fileList) {
          if (uploadLimitBytes && file.size > uploadLimitBytes) {
            lastError = `Skipped '${file.name}' — over the server upload limit.`;
            status.set(lastError, true);
            continue;
          }
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          });
          if (!dataUrl) {
            lastError = `Could not read '${file.name}'.`;
            status.set(lastError, true);
            continue;
          }
          try {
            await service.requestJson(
              "POST",
              service.buildApiUrl(`/api/v1/plugins/${plugin.name}/files/${LIBRARY_DIR}`),
              { fileName: file.name, data: dataUrl }
            );
            uploaded += 1;
          } catch (error) {
            lastError = `Upload failed for '${file.name}'. ${error?.message || ""}`;
            status.set(lastError, true);
            break;
          }
        }
        await loadLibrary();
        renderLibraryList();
        status.set(uploaded
          ? `Uploaded ${uploaded} song(s) to the library.`
          : (lastError || "Nothing uploaded."), !uploaded);
        document.dispatchEvent(new CustomEvent("taro-plugin-content-updated", { detail: { pluginName: plugin.name } }));
      });
      actionsRow.appendChild(uploadLabel);

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "dlc-shop-btn";
      saveBtn.textContent = "Save Playlist";
      saveBtn.addEventListener("click", async () => {
        const playlist = currentPlaylist();
        if (!playlist) {
          status.set("Create a playlist first.", true);
          return;
        }
        const tracks = [...listEl.querySelectorAll("input[type='checkbox']:checked")].map((box) => box.dataset.track);
        const next = {
          ...config,
          playlists: (config.playlists || []).map((entry) => (
            entry.id === playlist.id ? { ...entry, tracks } : entry
          ))
        };
        try {
          await saveConfig(next, `Saved ${tracks.length} song(s) to '${playlist.name}'.`);
        } catch (error) {
          status.set(`Could not save playlist. ${error?.message || ""}`, true);
        }
      });
      actionsRow.appendChild(saveBtn);
    } else {
      const hint = document.createElement("span");
      hint.className = "settings-field-hint";
      hint.textContent = "Admin key required to edit playlists.";
      actionsRow.appendChild(hint);
    }

    await loadLibrary();
    refreshPlaylistSelect();
    renderLibraryList();
  }


  async function renderLinksSettings(settingsEl, plugin) {
    const status = createSettingsStatus(settingsEl);
    const service = window.TarotDataService;
    const adminMode = isAdmin();
    const body = document.createElement("div");
    body.className = "dlc-plugin-settings-body";
    settingsEl.appendChild(body);

    const hint = document.createElement("span");
    hint.className = "settings-field-hint";
    hint.textContent = "Each entry is one bookmark. Upload an image to store it in the plugin images/ folder.";
    body.appendChild(hint);

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Directory title";
    titleInput.readOnly = !adminMode;
    body.appendChild(titleInput);

    const subtitleInput = document.createElement("input");
    subtitleInput.type = "text";
    subtitleInput.placeholder = "Subtitle";
    subtitleInput.readOnly = !adminMode;
    body.appendChild(subtitleInput);

    const listEl = document.createElement("div");
    listEl.className = "dlc-link-entries";
    body.appendChild(listEl);

    const actions = document.createElement("div");
    actions.className = "dlc-shop-actions";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "dlc-shop-btn";
    addBtn.textContent = "Add link";
    addBtn.disabled = !adminMode;
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "dlc-shop-btn";
    saveBtn.textContent = adminMode ? "Save links" : "Admin key required to edit";
    saveBtn.disabled = !adminMode;
    actions.append(addBtn, saveBtn);
    body.appendChild(actions);

    const IMAGE_DIR = "images";

    function imageUrl(fileName) {
      const name = String(fileName || "").trim();
      if (!name) return "";
      if (/^https?:\/\//i.test(name)) return name;
      return service.buildApiUrl(`/api/v1/plugins/${plugin.name}/files/${IMAGE_DIR}/${encodeURIComponent(name)}`);
    }

    function collectLinks() {
      return [...listEl.querySelectorAll(".dlc-link-entry")].map((row) => ({
        title: String(row.querySelector("[data-field='title']")?.value || "").trim(),
        url: String(row.querySelector("[data-field='url']")?.value || "").trim(),
        group: String(row.querySelector("[data-field='group']")?.value || "").trim(),
        note: String(row.querySelector("[data-field='note']")?.value || "").trim(),
        image: String(row.dataset.image || "").trim()
      })).filter((link) => link.url);
    }

    function addEntry(link = {}) {
      const row = document.createElement("div");
      row.className = "dlc-link-entry";
      row.dataset.image = String(link.image || "");
      row.innerHTML = `
        <div class="dlc-link-entry-media">
          <img class="dlc-link-entry-preview" alt="" ${link.image ? `src="${escapeHtml(imageUrl(link.image))}"` : ""}>
          <button type="button" class="dlc-shop-btn" data-action="upload" ${adminMode ? "" : "disabled"}>Image</button>
        </div>
        <div class="dlc-settings-config-row">
          <label class="settings-field">Title<input data-field="title" type="text" ${adminMode ? "" : "readonly"}></label>
          <label class="settings-field">URL<input data-field="url" type="url" placeholder="https://" ${adminMode ? "" : "readonly"}></label>
        </div>
        <div class="dlc-settings-config-row">
          <label class="settings-field">Group<input data-field="group" type="text" ${adminMode ? "" : "readonly"}></label>
          <label class="settings-field">Note<input data-field="note" type="text" ${adminMode ? "" : "readonly"}></label>
        </div>
        <div class="dlc-shop-actions">
          <button type="button" class="dlc-shop-btn" data-action="remove" ${adminMode ? "" : "disabled"}>Remove</button>
        </div>
      `;
      row.querySelector("[data-field='title']").value = String(link.title || "");
      row.querySelector("[data-field='url']").value = String(link.url || "");
      row.querySelector("[data-field='group']").value = String(link.group || "");
      row.querySelector("[data-field='note']").value = String(link.note || "");
      const preview = row.querySelector(".dlc-link-entry-preview");
      if (!link.image) preview.hidden = true;

      row.querySelector("[data-action='remove']").addEventListener("click", () => row.remove());
      row.querySelector("[data-action='upload']").addEventListener("click", () => {
        const picker = document.createElement("input");
        picker.type = "file";
        picker.accept = "image/*,.png,.jpg,.jpeg,.webp,.svg,.gif";
        picker.addEventListener("change", async () => {
          const file = picker.files?.[0];
          if (!file) return;
          const ext = (file.name.match(/\.[a-z0-9]+$/i) || [".png"])[0].toLowerCase();
          const safeBase = String(file.name || "image").replace(/[^a-z0-9._-]+/gi, "-").replace(/^\.+/, "").slice(0, 40) || "image";
          const fileName = `link-${Date.now()}-${safeBase}${safeBase.toLowerCase().endsWith(ext) ? "" : ext}`;
          try {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(new Error("Could not read image."));
              reader.readAsDataURL(file);
            });
            await service.requestJson(
              "POST",
              service.buildApiUrl(`/api/v1/plugins/${plugin.name}/files/${IMAGE_DIR}`),
              { fileName, data: dataUrl }
            );
            row.dataset.image = fileName;
            preview.src = imageUrl(fileName);
            preview.hidden = false;
            status.set(`Uploaded ${fileName}.`);
          } catch (error) {
            status.set(`Could not upload image. ${error?.message || ""}`, true);
          }
        });
        picker.click();
      });
      listEl.appendChild(row);
    }

    addBtn.addEventListener("click", () => addEntry({}));

    try {
      const payload = await service.requestJson("GET", service.buildApiUrl(`/api/v1/plugins/${plugin.name}/config`));
      const config = payload?.config && typeof payload.config === "object" ? payload.config : {};
      titleInput.value = String(config.title || "Links");
      subtitleInput.value = String(config.subtitle || "");
      const links = Array.isArray(config.links) ? config.links : [];
      if (links.length) links.forEach((link) => addEntry(link));
      else addEntry({});
    } catch (error) {
      status.set(`Could not load links. ${error?.message || ""}`, true);
      addEntry({});
    }

    saveBtn.addEventListener("click", async () => {
      if (!adminMode) return;
      saveBtn.disabled = true;
      try {
        const links = collectLinks();
        await service.requestJson("POST", service.buildApiUrl(`/api/v1/plugins/${plugin.name}/config`), {
          config: {
            title: String(titleInput.value || "Links").trim() || "Links",
            subtitle: String(subtitleInput.value || "").trim(),
            links
          }
        });
        status.set(`Saved ${links.length} link${links.length === 1 ? "" : "s"}.`);
        document.dispatchEvent(new CustomEvent("taro-plugin-content-updated", {
          detail: { pluginName: plugin.name }
        }));
      } catch (error) {
        status.set(`Could not save links. ${error?.message || ""}`, true);
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  async function renderHydrusNetworkSettings(settingsEl, plugin) {
    const status = createSettingsStatus(settingsEl);
    const service = window.TarotDataService;
    const adminMode = isAdmin();
    const body = document.createElement("div");
    body.className = "dlc-plugin-settings-body";
    settingsEl.appendChild(body);

    const hint = document.createElement("span");
    hint.className = "settings-field-hint";
    hint.textContent = "Point Origin at the Hydrus client that holds the database you want. API key is that client's access key.";
    body.appendChild(hint);

    const originLabel = document.createElement("label");
    originLabel.className = "settings-field";
    originLabel.appendChild(document.createTextNode("Origin"));
    const originInput = document.createElement("input");
    originInput.type = "url";
    originInput.autocomplete = "off";
    originInput.placeholder = "http://localhost:45869";
    originInput.readOnly = !adminMode;
    originLabel.appendChild(originInput);
    body.appendChild(originLabel);

    const apiKeyLabel = document.createElement("label");
    apiKeyLabel.className = "settings-field";
    apiKeyLabel.appendChild(document.createTextNode("API key"));
    const apiKeyInput = document.createElement("input");
    apiKeyInput.type = "password";
    apiKeyInput.autocomplete = "off";
    apiKeyInput.placeholder = "Hydrus Client API access key";
    apiKeyInput.readOnly = !adminMode;
    apiKeyLabel.appendChild(apiKeyInput);
    body.appendChild(apiKeyLabel);

    const allowLabel = document.createElement("label");
    allowLabel.className = "dlc-menu-hide-label";
    const allowSearch = document.createElement("input");
    allowSearch.type = "checkbox";
    allowSearch.disabled = !adminMode;
    allowLabel.appendChild(allowSearch);
    allowLabel.appendChild(document.createTextNode("Allow search"));
    body.appendChild(allowLabel);

    const collapseLabel = document.createElement("label");
    collapseLabel.className = "dlc-menu-hide-label";
    const collapseTags = document.createElement("input");
    collapseTags.type = "checkbox";
    collapseTags.disabled = !adminMode;
    collapseLabel.appendChild(collapseTags);
    collapseLabel.appendChild(document.createTextNode("Collapse tags (title only until expanded)"));
    body.appendChild(collapseLabel);

    const listEl = document.createElement("div");
    listEl.className = "dlc-link-entries";
    body.appendChild(listEl);

    const actions = document.createElement("div");
    actions.className = "dlc-shop-actions";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "dlc-shop-btn";
    addBtn.textContent = "Add category";
    addBtn.disabled = !adminMode;
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "dlc-shop-btn";
    saveBtn.textContent = adminMode ? "Save" : "Admin key required to edit";
    saveBtn.disabled = !adminMode;
    actions.append(addBtn, saveBtn);
    body.appendChild(actions);

    function collectCategories() {
      return [...listEl.querySelectorAll(".dlc-link-entry")].map((row) => ({
        name: String(row.querySelector("[data-field='name']")?.value || "").trim(),
        search: String(row.querySelector("[data-field='search']")?.value || "").trim()
      })).filter((item) => item.name && item.search);
    }

    function addEntry(category = {}) {
      const row = document.createElement("div");
      row.className = "dlc-link-entry";
      row.innerHTML = `
        <div class="dlc-settings-config-row">
          <label class="settings-field">Name<input data-field="name" type="text" placeholder="Music" ${adminMode ? "" : "readonly"}></label>
          <label class="settings-field">Search<input data-field="search" type="text" placeholder="album:*,artist:*" ${adminMode ? "" : "readonly"}></label>
        </div>
        <div class="dlc-shop-actions">
          <button type="button" class="dlc-shop-btn" data-action="remove" ${adminMode ? "" : "disabled"}>Remove</button>
        </div>
      `;
      row.querySelector("[data-field='name']").value = String(category.name || "");
      row.querySelector("[data-field='search']").value = String(category.search || "");
      row.querySelector("[data-action='remove']").addEventListener("click", () => row.remove());
      listEl.appendChild(row);
    }

    try {
      const payload = await service.requestJson("GET", service.buildApiUrl(`/api/v1/plugins/${plugin.name}/config`));
      const config = payload?.config && typeof payload.config === "object" ? payload.config : {};
      allowSearch.checked = Boolean(config.allowSearch);
      collapseTags.checked = config.collapseTags !== false;
      originInput.value = String(config.origin || "");
      apiKeyInput.value = String(config.apiKey || "");
      (Array.isArray(config.categories) ? config.categories : []).forEach((item) => addEntry(item));
    } catch (_error) {
      allowSearch.checked = false;
    }

    addBtn.addEventListener("click", () => addEntry());
    saveBtn.addEventListener("click", async () => {
      if (!isAdmin()) {
        status.set("Admin key required to save plugin config.", true);
        return;
      }
      saveBtn.disabled = true;
      try {
        await service.requestJson(
          "POST",
          service.buildApiUrl(`/api/v1/plugins/${plugin.name}/config`),
          {
            config: {
              allowSearch: allowSearch.checked,
              collapseTags: collapseTags.checked,
              origin: String(originInput.value || "").trim(),
              apiKey: String(apiKeyInput.value || "").trim(),
              categories: collectCategories()
            }
          }
        );
        status.set("Saved.");
        document.dispatchEvent(new CustomEvent("taro-plugin-content-updated", {
          detail: { pluginName: plugin.name }
        }));
      } catch (error) {
        status.set(`Could not save. ${error?.message || ""}`, true);
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  async function renderGenericConfigSettings(settingsEl, plugin) {
    const status = createSettingsStatus(settingsEl);
    const service = window.TarotDataService;
    const adminMode = isAdmin();
    const settingsBody = document.createElement("div");
    settingsBody.className = "dlc-plugin-settings-body";
    settingsEl.appendChild(settingsBody);

    const hint = document.createElement("span");
    hint.className = "settings-field-hint";
    hint.textContent = `config.json for ${plugin.name}. ${adminMode ? "Changes apply when the plugin reloads." : "Admin key required to save."}`;
    settingsBody.appendChild(hint);

    const configLabel = document.createElement("strong");
    configLabel.className = "dlc-settings-subhead";
    configLabel.textContent = "Config (config.json)";
    settingsBody.appendChild(configLabel);

    const textarea = document.createElement("textarea");
    textarea.className = "dlc-settings-json";
    textarea.rows = 8;
    textarea.spellcheck = false;
    textarea.readOnly = !adminMode;
    settingsBody.appendChild(textarea);

    const actions = document.createElement("div");
    actions.className = "dlc-shop-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "dlc-shop-btn";
    saveBtn.textContent = adminMode ? "Save Config" : "Admin key required to edit";
    saveBtn.disabled = !adminMode;
    actions.appendChild(saveBtn);
    settingsBody.appendChild(actions);

    let entryFile = "";
    if (plugin.entry) {
      entryFile = String(plugin.entry || "").trim();
      const entryLabel = document.createElement("strong");
      entryLabel.className = "dlc-settings-subhead";
      entryLabel.textContent = `Entry script (${entryFile})`;
      settingsBody.appendChild(entryLabel);

      const entryTextarea = document.createElement("textarea");
      entryTextarea.className = "dlc-settings-json";
      entryTextarea.rows = 12;
      entryTextarea.spellcheck = false;
      entryTextarea.readOnly = !adminMode;
      settingsBody.appendChild(entryTextarea);

      const entryActions = document.createElement("div");
      entryActions.className = "dlc-shop-actions";
      const entrySaveBtn = document.createElement("button");
      entrySaveBtn.type = "button";
      entrySaveBtn.className = "dlc-shop-btn";
      entrySaveBtn.textContent = adminMode ? "Save Script" : "Admin key required to edit";
      entrySaveBtn.disabled = !adminMode;
      entryActions.appendChild(entrySaveBtn);
      settingsBody.appendChild(entryActions);

      try {
        const url = window.TaroTimePluginHost?.assetUrl
          ? window.TaroTimePluginHost.assetUrl(plugin.name, entryFile)
          : service.buildApiUrl(`/api/v1/plugins/${encodeURIComponent(plugin.name)}/${encodeURIComponent(entryFile)}`);
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) {
          entryTextarea.value = await response.text();
        }
      } catch (_error) {
        entryTextarea.value = "";
      }

      entrySaveBtn.addEventListener("click", async () => {
        const bytes = new TextEncoder().encode(entryTextarea.value || "");
        let binary = "";
        for (const byte of bytes) {
          binary += String.fromCharCode(byte);
        }
        const base64 = btoa(binary);
        entrySaveBtn.disabled = true;
        try {
          await service.requestJson(
            "POST",
            service.buildApiUrl(`/api/v1/plugins/${encodeURIComponent(plugin.name)}/files`),
            { fileName: entryFile, data: base64 }
          );
          status.set("Entry script saved.");
          document.dispatchEvent(new CustomEvent("taro-plugin-content-updated", {
            detail: { pluginName: plugin.name }
          }));
        } catch (error) {
          status.set(`Could not save script. ${error?.message || ""}`, true);
        } finally {
          entrySaveBtn.disabled = false;
        }
      });
    }

    try {
      const payload = await service.requestJson("GET", service.buildApiUrl(`/api/v1/plugins/${plugin.name}/config`));
      textarea.value = JSON.stringify(payload?.config ?? {}, null, 2);
    } catch (_error) {
      textarea.value = "{}";
    }

    saveBtn.addEventListener("click", async () => {
      if (!isAdmin()) {
        status.set("Admin key required to save plugin config.", true);
        return;
      }
      let parsed = null;
      try {
        parsed = JSON.parse(textarea.value || "{}");
      } catch (error) {
        status.set(`Invalid JSON. ${error.message}`, true);
        return;
      }
      saveBtn.disabled = true;
      try {
        await service.requestJson(
          "POST",
          service.buildApiUrl(`/api/v1/plugins/${plugin.name}/config`),
          { config: parsed }
        );
        status.set("Config saved.");
        document.dispatchEvent(new CustomEvent("taro-plugin-content-updated", {
          detail: { pluginName: plugin.name }
        }));
      } catch (error) {
        status.set(`Could not save config. ${error?.message || ""}`, true);
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  async function renderHomepageSettings(settingsEl, plugin) {
    const status = createSettingsStatus(settingsEl);
    const service = window.TarotDataService;
    const adminMode = isAdmin();
    const settingsBody = document.createElement("div");
    settingsBody.className = "dlc-plugin-settings-body";
    settingsEl.appendChild(settingsBody);

    const hint = document.createElement("span");
    hint.className = "settings-field-hint";
    hint.textContent = "This page replaces the app's welcome content. Any HTML works — it is injected into the home section.";
    settingsBody.appendChild(hint);

    const textarea = document.createElement("textarea");
    textarea.className = "dlc-settings-json";
    textarea.rows = 14;
    textarea.spellcheck = false;
    textarea.placeholder = "<h1>Welcome</h1>…";
    textarea.readOnly = !adminMode;
    settingsBody.appendChild(textarea);

    const actions = document.createElement("div");
    actions.className = "dlc-shop-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "dlc-shop-btn";
    saveBtn.textContent = adminMode ? "Save Page" : "Admin key required to edit";
    saveBtn.disabled = !adminMode;
    actions.appendChild(saveBtn);
    settingsBody.appendChild(actions);

    const assetUrl = window.TaroTimePluginHost?.assetUrl
      ? window.TaroTimePluginHost.assetUrl(plugin.name, "index.html")
      : service.buildApiUrl(`/api/v1/plugins/${encodeURIComponent(plugin.name)}/index.html`);
    try {
      const response = await fetch(assetUrl, { cache: "no-store" });
      if (response.ok) {
        textarea.value = await response.text();
      }
    } catch (_error) {
      textarea.value = "<h1>Welcome</h1>";
    }

    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        const bytes = new TextEncoder().encode(textarea.value || "");
        let binary = "";
        for (const byte of bytes) {
          binary += String.fromCharCode(byte);
        }
        const base64 = btoa(binary);
        await service.requestJson(
          "POST",
          service.buildApiUrl(`/api/v1/plugins/${encodeURIComponent(plugin.name)}/files`),
          { fileName: "index.html", data: base64 }
        );
        status.set("Homepage saved.");
        document.dispatchEvent(new CustomEvent("taro-plugin-content-updated", {
          detail: { pluginName: plugin.name }
        }));
      } catch (error) {
        status.set(`Could not save homepage. ${error?.message || ""}`, true);
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  async function renderPluginLogs(settingsEl, plugin) {
    const service = window.TarotDataService;
    const wrap = document.createElement("div");
    wrap.className = "dlc-plugin-logs";
    const head = document.createElement("div");
    head.className = "dlc-plugin-settings-head";
    const title = document.createElement("strong");
    title.textContent = "Plugin log";
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "dlc-shop-btn";
    refreshBtn.textContent = "Refresh";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "dlc-shop-btn";
    clearBtn.textContent = "Clear";
    clearBtn.hidden = !isAdmin();
    head.append(title, refreshBtn, clearBtn);
    const pre = document.createElement("pre");
    pre.className = "dlc-plugin-log-view";
    wrap.append(head, pre);
    settingsEl.appendChild(wrap);

    async function load() {
      try {
        const payload = await service.requestJson(
          "GET",
          service.buildApiUrl(`/api/v1/plugins/${encodeURIComponent(plugin.name)}/logs?limit=200`)
        );
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];
        pre.textContent = entries.length
          ? entries.map((entry) => `${entry.timestamp || ""} [${entry.level || "info"}] ${entry.message || ""}`).join("\n")
          : "No log entries yet.";
      } catch (_error) {
        pre.textContent = "Could not load plugin logs.";
      }
    }

    refreshBtn.addEventListener("click", () => {
      void load();
    });
    clearBtn.addEventListener("click", async () => {
      try {
        await service.requestJson("DELETE", service.buildApiUrl(`/api/v1/plugins/${encodeURIComponent(plugin.name)}/logs`));
        await load();
      } catch (_error) {}
    });
    await load();
  }

  function openPluginSettings(cardEl, plugin) {
    if (plugin?.name === "menu-plugin") {
      if (!isAdmin()) {
        const settingsEl = createPluginSettingsShell(cardEl, `${plugin?.title || plugin?.name} Settings`);
        if (settingsEl) {
          const hint = document.createElement("span");
          hint.className = "settings-field-hint";
          hint.textContent = "Menu order can only be changed with an admin API key.";
          settingsEl.appendChild(hint);
        }
        return;
      }
      openMenuEditor(cardEl);
      return;
    }
    const settingsEl = createPluginSettingsShell(cardEl, `${plugin?.title || plugin?.name} Settings`);
    if (!settingsEl) return;
    const render = plugin?.name === "music-player"
      ? renderMusicPlayerSettings
      : plugin?.name === "homepage"
        ? renderHomepageSettings
        : plugin?.name === "links"
          ? renderLinksSettings
          : plugin?.name === "hydrus-network"
            ? renderHydrusNetworkSettings
            : renderGenericConfigSettings;
    void Promise.resolve(render(settingsEl, plugin)).then(() => renderPluginLogs(settingsEl, plugin));
  }

  // --- Create DLC (text first; plugin keeps the old scaffold) -----------------

  function openCreatePluginForm(hostEl, { onCreated } = {}) {
    if (!hostEl) return;
    const existing = hostEl.querySelector(".dlc-create-plugin");
    if (existing) existing.remove();

    const form = document.createElement("div");
    form.className = "dlc-plugin-settings dlc-create-plugin";
    form.innerHTML = `
      <div class="dlc-plugin-settings-head">
        <strong>Create Plugin</strong>
        <button type="button" class="dlc-shop-btn" data-action="close">Close</button>
      </div>
      <div class="dlc-plugin-settings-body">
          <span class="settings-field-hint">Creates a new plugin folder with a manifest, a starter entry script, and an empty config. Edit the code from the plugin's Settings afterwards. Check UI overhaul to replace the whole app chrome (menus, layout) instead of adding a top-bar widget.</span>
          <input type="text" class="dlc-create-name" maxlength="40" placeholder="Plugin id (e.g. my-gadget)">
          <input type="text" class="dlc-create-title" maxlength="80" placeholder="Title (e.g. My Gadget)">
          <input type="text" class="dlc-create-description" maxlength="400" placeholder="Description">
          <label class="settings-field"><input type="checkbox" class="dlc-create-skin"> UI overhaul (replace the default layout)</label>
        <div class="dlc-shop-actions">
          <button type="button" class="dlc-shop-btn" data-action="create">Create Plugin</button>
          <span class="settings-field-hint" data-role="status" aria-live="polite"></span>
        </div>
      </div>
    `;

    const statusEl = form.querySelector('[data-role="status"]');
    const setFormStatus = (text, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.classList.toggle("is-error", Boolean(isError));
    };

    form.querySelector('[data-action="close"]').addEventListener("click", () => form.remove());
    form.querySelector('[data-action="create"]').addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const name = String(form.querySelector(".dlc-create-name").value || "").trim();
      const title = String(form.querySelector(".dlc-create-title").value || "").trim();
      const description = String(form.querySelector(".dlc-create-description").value || "").trim();
      const role = form.querySelector(".dlc-create-skin")?.checked ? "skin" : "widget";
      if (!name) {
        setFormStatus("Plugin id is required (letters, numbers, dot, dash, underscore).", true);
        return;
      }
      button.disabled = true;
      setFormStatus("Creating…");
      try {
        const result = await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl("/api/v1/plugins"),
          { name, title, description, role }
        );
        setFormStatus(`Created '${result?.plugin?.name || name}'.`);
        setStatus(`Plugin '${result?.plugin?.name || name}' created — open its Settings to edit the code.`);
        form.remove();
        if (typeof onCreated === "function") {
          await onCreated(result?.plugin);
        }
        await window.TaroTimePluginHost?.refresh?.();
      } catch (error) {
        setFormStatus(`Could not create plugin. ${error?.message || ""}`, true);
      } finally {
        button.disabled = false;
      }
    });

    hostEl.prepend(form);
    const nameInput = form.querySelector(".dlc-create-name");
    if (nameInput) nameInput.focus();
  }

  function collectEditedDocument(_form, preview) {
    const works = (preview?.document?.works || []).map((work) => ({
      id: work.id,
      title: work.title,
      sections: (work.sections || []).map((section, sectionIndex) => ({
        id: section.id || `section-${sectionIndex + 1}`,
        number: section.number || sectionIndex + 1,
        title: section.title,
        verses: (section.verses || []).map((verse, verseIndex) => ({
          number: verse.number || verseIndex + 1,
          text: verse.text
        }))
      })).filter((section) => section.verses.length)
    })).filter((work) => work.sections.length);
    return { works };
  }

  function renderTextPreview(form, preview, { syncFields = true } = {}) {
    const statsEl = form.querySelector("[data-role='text-stats']");
    const fieldsEl = form.querySelector("[data-role='text-fields']");
    const outlineEl = form.querySelector("[data-role='text-outline']");
    const sampleEl = form.querySelector("[data-role='text-sample']");
    const sampleHeadEl = form.querySelector("[data-role='sample-heading']");
    const sampleMetaEl = form.querySelector("[data-role='sample-meta']");
    const editorEl = form.querySelector("[data-role='text-editor']");
    const workLabel = preview.workLabel || "Work";
    const sectionLabel = preview.sectionLabel || "Section";
    const verseLabel = preview.verseLabel || "Passage";
    if (statsEl) {
      statsEl.innerHTML = "";
      [
        preview.format,
        `${preview.stats?.works || 0} ${String(workLabel).toLowerCase()}(s)`,
        `${preview.stats?.sections || 0} ${String(sectionLabel).toLowerCase()}(s)`,
        `${preview.stats?.verses || 0} ${String(verseLabel).toLowerCase()}(s)`,
        `${Array.isArray(preview.looseText) ? preview.looseText.length : 0} loose`
      ].forEach((label) => {
        const chip = document.createElement("span");
        chip.className = "dlc-text-chip";
        chip.textContent = label;
        statsEl.appendChild(chip);
      });
    }
    if (syncFields) {
      if (form.querySelector(".dlc-create-text-id")) form.querySelector(".dlc-create-text-id").value = preview.id || "";
      if (form.querySelector(".dlc-create-text-title")) form.querySelector(".dlc-create-text-title").value = preview.title || "";
      if (form.querySelector(".dlc-create-text-format") && preview.format) {
        form.querySelector(".dlc-create-text-format").value = preview.format;
      }
    }
    if (fieldsEl) fieldsEl.hidden = false;
    const sourceEl = form.querySelector("[data-role='text-source']");
    if (sourceEl) sourceEl.hidden = true;
    const introEl = form.querySelector("[data-role='create-intro']");
    if (introEl) introEl.hidden = true;
    if (!Array.isArray(preview.looseText)) {
      preview.looseText = [];
    }
    if (!Array.isArray(preview.shelf)) {
      preview.shelf = [];
    }
    if (!outlineEl || !sampleEl) return;

    if (!preview._selected) {
      preview._selected = { workIndex: 0, sectionIndex: 0 };
    }
    const selected = preview._selected;
    const workList = () => (preview.document?.works?.[selected.workIndex]?.sections
      ? preview.document.works[selected.workIndex].sections
      : []);

    const getSection = () => workList()[selected.sectionIndex] || null;

    const refreshStats = () => {
      const works = Array.isArray(preview.document?.works) ? preview.document.works : [];
      preview.stats = {
        works: works.length,
        sections: works.reduce((sum, work) => sum + (work.sections || []).length, 0),
        verses: works.reduce((sum, work) => (
          sum + (work.sections || []).reduce((inner, section) => inner + (section.verses || []).length, 0)
        ), 0)
      };
      if (!statsEl) return;
      statsEl.innerHTML = "";
      [
        preview.format,
        `${preview.stats.works} ${String(workLabel).toLowerCase()}(s)`,
        `${preview.stats.sections} ${String(sectionLabel).toLowerCase()}(s)`,
        `${preview.stats.verses} ${String(verseLabel).toLowerCase()}(s)`,
        `${(Number(preview.looseText?.length || 0) + Number(preview.shelf?.length || 0))} on shelf`
      ].forEach((label) => {
        const chip = document.createElement("span");
        chip.className = "dlc-text-chip";
        chip.textContent = label;
        statsEl.appendChild(chip);
      });
    };

    const renumber = (section) => {
      (section.verses || []).forEach((verse, verseIndex) => {
        verse.number = verseIndex + 1;
      });
    };

    const readDrag = (event) => {
      try {
        return JSON.parse(event.dataTransfer.getData("application/json") || event.dataTransfer.getData("text/plain") || "{}");
      } catch (_error) {
        return null;
      }
    };

    const takeDraggedVerse = (payload) => {
      if (!payload) return null;
      if (payload.source === "verse") {
        const origin = preview.document?.works?.[payload.workIndex]?.sections?.[payload.sectionIndex];
        if (!origin?.verses?.[payload.verseIndex]) return null;
        const [moved] = origin.verses.splice(payload.verseIndex, 1);
        renumber(origin);
        return moved;
      }
      if (payload.source === "shelf") {
        const item = preview.shelf[payload.index];
        if (!item) return null;
        preview.shelf.splice(payload.index, 1);
        if (item.kind === "section") {
          return item;
        }
        return { number: 1, text: item.text || "" };
      }
      if (payload.source === "loose") {
        const text = preview.looseText[payload.index];
        if (text == null) return null;
        preview.looseText.splice(payload.index, 1);
        return { number: 1, text };
      }
      return null;
    };

    const dropPayload = (payload, target) => {
      const moved = takeDraggedVerse(payload);
      if (!moved) return;
      const sections = workList();
      const section = sections[target.sectionIndex];
      if (!section) return;
      if (moved.kind === "section") {
        const verses = Array.isArray(moved.verses) ? moved.verses : [{ number: 1, text: moved.text || "" }];
        section.verses = (section.verses || []).concat(verses);
        if (moved.title && !String(section.title || "").trim()) {
          section.title = moved.title;
        }
      } else {
        section.verses = section.verses || [];
        const at = Number.isInteger(target.verseIndex) ? target.verseIndex : section.verses.length;
        section.verses.splice(Math.max(0, Math.min(at, section.verses.length)), 0, {
          number: 1,
          text: moved.text || ""
        });
      }
      renumber(section);
      selected.sectionIndex = target.sectionIndex;
      refreshStats();
      renderOutline();
      renderSample();
      renderShelf();
    };

    const shelfVerse = (sectionIndex, verseIndex) => {
      const section = workList()[sectionIndex];
      if (!section?.verses?.[verseIndex]) return;
      const [moved] = section.verses.splice(verseIndex, 1);
      const text = String(moved?.text || "").trim();
      if (text) {
        preview.shelf.push({ kind: "passage", title: section.title || "", text });
      }
      renumber(section);
      refreshStats();
      renderOutline();
      renderSample();
      renderShelf();
    };

    const shelfSection = (sectionIndex) => {
      const sections = workList();
      if (!sections[sectionIndex]) return;
      const [moved] = sections.splice(sectionIndex, 1);
      const verses = (moved.verses || []).filter((verse) => String(verse.text || "").trim());
      if (verses.length) {
        preview.shelf.push({
          kind: "section",
          title: moved.title || "",
          verses
        });
      }
      if (!sections.length) {
        sections.push({
          id: "section-1",
          number: 1,
          title: `${sectionLabel} 1`,
          verses: [{ number: 1, text: "" }]
        });
      }
      selected.sectionIndex = Math.min(sectionIndex, sections.length - 1);
      refreshStats();
      renderOutline();
      renderSample();
      renderShelf();
    };

    const renderSample = () => {
      const work = preview.document?.works?.[selected.workIndex];
      const section = getSection();
      if (sampleHeadEl) {
        sampleHeadEl.value = section?.title || `${sectionLabel} ${selected.sectionIndex + 1}`;
      }
      if (sampleMetaEl) {
        sampleMetaEl.textContent = [
          preview.title || work?.title || "",
          preview.format,
          `${sectionLabel} ${selected.sectionIndex + 1} of ${workList().length}`,
          `${section?.verses?.length || 0} ${String(verseLabel).toLowerCase()}(s)`
        ].filter(Boolean).join(" · ");
      }
      sampleEl.replaceChildren();
      (section?.verses || []).forEach((verse, verseIndex) => {
        const row = document.createElement("article");
        row.className = "alpha-text-verse dlc-text-verse-edit";
        const head = document.createElement("div");
        head.className = "alpha-text-verse-head";
        const ref = document.createElement("span");
        ref.className = "alpha-text-verse-reference";
        ref.textContent = `${selected.sectionIndex + 1}:${verseIndex + 1}`;
        const tools = document.createElement("div");
        tools.className = "dlc-text-verse-tools";
        const up = document.createElement("button");
        up.type = "button";
        up.className = "dlc-shop-btn";
        up.textContent = "Up";
        const down = document.createElement("button");
        down.type = "button";
        down.className = "dlc-shop-btn";
        down.textContent = "Down";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "dlc-shop-btn";
        remove.textContent = "Shelf";
        up.addEventListener("click", () => moveVerse(verseIndex, verseIndex - 1));
        down.addEventListener("click", () => moveVerse(verseIndex, verseIndex + 1));
        remove.addEventListener("click", () => shelfVerse(selected.sectionIndex, verseIndex));
        tools.append(up, down, remove);
        head.append(ref, tools);
        const area = document.createElement("textarea");
        area.className = "dlc-text-verse-input";
        area.value = verse.text || "";
        area.addEventListener("input", () => {
          verse.text = area.value;
        });
        row.draggable = true;
        row.addEventListener("dragstart", (event) => {
          if (event.target === area) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.setData("application/json", JSON.stringify({
            source: "verse",
            workIndex: selected.workIndex,
            sectionIndex: selected.sectionIndex,
            verseIndex
          }));
          event.dataTransfer.effectAllowed = "move";
        });
        row.addEventListener("dragover", (event) => {
          event.preventDefault();
          row.classList.add("is-drop");
        });
        row.addEventListener("dragleave", () => row.classList.remove("is-drop"));
        row.addEventListener("drop", (event) => {
          event.preventDefault();
          row.classList.remove("is-drop");
          dropPayload(readDrag(event), { sectionIndex: selected.sectionIndex, verseIndex });
        });
        row.append(head, area);
        sampleEl.appendChild(row);
      });
    };

    const moveSection = (from, to) => {
      const sections = workList();
      if (from < 0 || to < 0 || from >= sections.length || to >= sections.length) return;
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      selected.sectionIndex = to;
      refreshStats();
      renderOutline();
      renderSample();
    };

    const moveVerse = (from, to) => {
      const section = getSection();
      if (!section) return;
      const verses = section.verses || [];
      if (to < 0) {
        const prev = workList()[selected.sectionIndex - 1];
        if (!prev) return;
        const [moved] = verses.splice(from, 1);
        prev.verses = prev.verses || [];
        prev.verses.push(moved);
        renumber(section);
        renumber(prev);
        selected.sectionIndex -= 1;
      } else if (to >= verses.length) {
        const next = workList()[selected.sectionIndex + 1];
        if (!next) return;
        const [moved] = verses.splice(from, 1);
        next.verses = next.verses || [];
        next.verses.unshift(moved);
        renumber(section);
        renumber(next);
        selected.sectionIndex += 1;
      } else {
        const [moved] = verses.splice(from, 1);
        verses.splice(to, 0, moved);
        renumber(section);
      }
      refreshStats();
      renderOutline();
      renderSample();
    };

    const renderOutline = () => {
      outlineEl.replaceChildren();
      (preview.document?.works || []).forEach((work, workIndex) => {
        const workHead = document.createElement("div");
        workHead.className = "dlc-text-outline-work";
        workHead.textContent = preview.title || work.title || `${workLabel} ${workIndex + 1}`;
        outlineEl.appendChild(workHead);
        (work.sections || []).forEach((section, sectionIndex) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "dlc-text-outline-item";
          if (workIndex === selected.workIndex && sectionIndex === selected.sectionIndex) {
            item.classList.add("is-active");
          }
          const name = document.createElement("strong");
          name.textContent = section.title || `${sectionLabel} ${sectionIndex + 1}`;
          const meta = document.createElement("span");
          meta.textContent = `${section.verses?.length || 0} ${String(verseLabel).toLowerCase()}(s)`;
          item.append(name, meta);
          item.addEventListener("click", () => {
            selected.workIndex = workIndex;
            selected.sectionIndex = sectionIndex;
            renderOutline();
            renderSample();
          });
          item.addEventListener("dragover", (event) => {
            event.preventDefault();
            item.classList.add("is-drop");
          });
          item.addEventListener("dragleave", () => item.classList.remove("is-drop"));
          item.addEventListener("drop", (event) => {
            event.preventDefault();
            item.classList.remove("is-drop");
            selected.workIndex = workIndex;
            dropPayload(readDrag(event), { sectionIndex, verseIndex: work.sections[sectionIndex].verses.length });
          });
          outlineEl.appendChild(item);
        });
      });
    };

    if (sampleHeadEl) {
      sampleHeadEl.oninput = () => {
        const section = getSection();
        if (!section) return;
        section.title = String(sampleHeadEl.value || "").trim();
        renderOutline();
      };
    }
    form.querySelectorAll("[data-edit]").forEach((button) => {
      const next = button.cloneNode(true);
      button.replaceWith(next);
      next.addEventListener("click", () => {
        const action = next.getAttribute("data-edit");
        const sections = workList();
        if (action === "section-up") {
          moveSection(selected.sectionIndex, selected.sectionIndex - 1);
          return;
        }
        if (action === "section-down") {
          moveSection(selected.sectionIndex, selected.sectionIndex + 1);
          return;
        }
        if (action === "section-add") {
          const at = Math.min(sections.length, selected.sectionIndex + 1);
          sections.splice(at, 0, {
            id: `section-${Date.now()}`,
            number: at + 1,
            title: `${sectionLabel} ${at + 1}`,
            verses: [{ number: 1, text: "" }]
          });
          selected.sectionIndex = at;
          refreshStats();
          renderOutline();
          renderSample();
          return;
        }
        if (action === "section-delete") {
          shelfSection(selected.sectionIndex);
          return;
        }
        if (action === "verse-add") {
          const section = getSection();
          if (!section) return;
          section.verses = section.verses || [];
          section.verses.push({ number: section.verses.length + 1, text: "" });
          refreshStats();
          renderOutline();
          renderSample();
        }
      });
    });

    const ensureWork = () => {
      if (!preview.document) {
        preview.document = { title: preview.title || "", works: [] };
      }
      if (!Array.isArray(preview.document.works) || !preview.document.works.length) {
        preview.document.works = [{ id: "work-1", title: preview.title || "Text", sections: [] }];
      }
      return preview.document.works[selected.workIndex] || preview.document.works[0];
    };

    const renderShelf = () => {
      const host = form.querySelector("[data-role='text-shelf']");
      const list = form.querySelector("[data-role='shelf-list']");
      if (!host || !list) return;
      const loose = (Array.isArray(preview.looseText) ? preview.looseText : []).map((text, index) => ({
        source: "loose",
        index,
        kind: "passage",
        title: "",
        text
      }));
      const shelved = (Array.isArray(preview.shelf) ? preview.shelf : []).map((entry, index) => ({
        source: "shelf",
        index,
        kind: entry.kind || "passage",
        title: entry.title || "",
        text: entry.text || (entry.verses || []).map((verse) => verse.text).join("\n\n")
      }));
      const items = [...loose, ...shelved];
      host.hidden = items.length === 0;
      list.replaceChildren();
      items.forEach((entry) => {
        const item = document.createElement("div");
        item.className = "dlc-text-loose-item";
        item.draggable = true;
        const label = document.createElement("strong");
        label.textContent = entry.kind === "section" ? (entry.title || "Section") : "Passage";
        const text = document.createElement("p");
        text.textContent = entry.text || "";
        const discardBtn = document.createElement("button");
        discardBtn.type = "button";
        discardBtn.className = "dlc-shop-btn";
        discardBtn.textContent = "Discard";
        item.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("application/json", JSON.stringify({
            source: entry.source,
            index: entry.index
          }));
          event.dataTransfer.effectAllowed = "move";
        });
        discardBtn.addEventListener("click", () => {
          if (entry.source === "loose") {
            preview.looseText.splice(entry.index, 1);
          } else {
            preview.shelf.splice(entry.index, 1);
          }
          refreshStats();
          renderShelf();
        });
        item.append(label, text, discardBtn);
        list.appendChild(item);
      });
    };

    sampleEl.ondragover = (event) => {
      event.preventDefault();
    };
    sampleEl.ondrop = (event) => {
      event.preventDefault();
      const section = getSection();
      dropPayload(readDrag(event), {
        sectionIndex: selected.sectionIndex,
        verseIndex: section?.verses?.length || 0
      });
    };

    renderOutline();
    renderSample();
    renderShelf();
  }

  const DECK_IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
  const DECK_MAJORS = [
    "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
    "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit",
    "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance",
    "The Devil", "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World"
  ];
  const DECK_SUITS = [
    { id: "wands", label: "Wands", aliases: ["wand", "wands", "rod", "staff", "baton"] },
    { id: "cups", label: "Cups", aliases: ["cup", "cups", "chalice", "grail"] },
    { id: "swords", label: "Swords", aliases: ["sword", "swords", "blade"] },
    { id: "pentacles", label: "Disks", aliases: ["pentacle", "pentacles", "disk", "disks", "coin", "coins", "pentacle"] }
  ];
  const DECK_RANKS = [
    { id: "ace", label: "Ace", aliases: ["ace", "1"] },
    { id: "two", label: "Two", aliases: ["two", "2"] },
    { id: "three", label: "Three", aliases: ["three", "3"] },
    { id: "four", label: "Four", aliases: ["four", "4"] },
    { id: "five", label: "Five", aliases: ["five", "5"] },
    { id: "six", label: "Six", aliases: ["six", "6"] },
    { id: "seven", label: "Seven", aliases: ["seven", "7"] },
    { id: "eight", label: "Eight", aliases: ["eight", "8"] },
    { id: "nine", label: "Nine", aliases: ["nine", "9"] },
    { id: "ten", label: "Ten", aliases: ["ten", "10"] },
    { id: "page", label: "Page", aliases: ["page", "princess", "knave"] },
    { id: "knight", label: "Knight", aliases: ["knight", "prince"] },
    { id: "queen", label: "Queen", aliases: ["queen"] },
    { id: "king", label: "King", aliases: ["king", "knight-king"] }
  ];

  function deckSlotList() {
    const slots = DECK_MAJORS.map((name, trump) => ({
      key: `major-${trump}`,
      group: "Majors",
      label: `${String(trump).padStart(2, "0")} · ${name}`,
      file: `${String(trump).padStart(2, "0")}.png`
    }));
    DECK_SUITS.forEach((suit, suitIndex) => {
      DECK_RANKS.forEach((rank, rankIndex) => {
        const number = 22 + (suitIndex * 14) + rankIndex;
        slots.push({
          key: `minor-${suit.id}-${rank.id}`,
          group: suit.label,
          label: `${rank.label} of ${suit.label}`,
          file: `${String(number).padStart(2, "0")}.png`
        });
      });
    });
    return slots;
  }

  function deckFileBase(relativePath) {
    return String(relativePath || "").replace(/\\/g, "/").split("/").pop().replace(/\.[^.]+$/, "");
  }

  function matchDeckPattern(baseName, pattern) {
    const raw = String(pattern || "").trim();
    if (!raw) {
      return null;
    }
    const escaped = raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\{n\\\}/gi, "(\\d+)")
      .replace(/#+/g, "(\\d+)");
    const match = String(baseName || "").match(new RegExp(`^${escaped}$`, "i"));
    if (!match || match[1] == null) {
      return null;
    }
    const number = Number(match[1]);
    return Number.isInteger(number) ? number : null;
  }

  function detectDeckPatterns(files) {
    const groups = new Map();
    (Array.isArray(files) ? files : []).forEach((entry) => {
      const base = deckFileBase(entry.path);
      const match = base.match(/^([^0-9]*?)(\d+)$/);
      if (!match || !match[1]) {
        return;
      }
      const key = match[1].toLowerCase();
      const group = groups.get(key) || { prefix: match[1], pad: match[2].length, numbers: [] };
      group.pad = Math.max(group.pad, match[2].length);
      group.numbers.push(Number(match[2]));
      groups.set(key, group);
    });
    const ranked = [...groups.values()].map((group) => {
      const unique = [...new Set(group.numbers)].sort((left, right) => left - right);
      return {
        prefix: group.prefix,
        pad: Math.max(2, group.pad),
        count: unique.length,
        min: unique[0],
        max: unique[unique.length - 1]
      };
    }).sort((left, right) => right.count - left.count || left.prefix.localeCompare(right.prefix));

    const patterns = {
      majors: { pattern: "", start: 0 },
      back: "",
      suits: {}
    };
    const used = new Set();
    const majorGroup = ranked.find((group) => group.count >= 20 && group.count <= 24);
    if (majorGroup) {
      patterns.majors.pattern = `${majorGroup.prefix}${"#".repeat(majorGroup.pad)}`;
      patterns.majors.start = majorGroup.min;
      used.add(majorGroup.prefix.toLowerCase());
    }
    ranked.filter((group) => !used.has(group.prefix.toLowerCase()) && group.count >= 12 && group.count <= 16)
      .sort((left, right) => left.prefix.localeCompare(right.prefix, undefined, { sensitivity: "base" }))
      .forEach((group, index) => {
        const suit = DECK_SUITS[index];
        if (!suit) {
          return;
        }
        patterns.suits[suit.id] = {
          pattern: `${group.prefix}${"#".repeat(group.pad)}`,
          start: group.min
        };
      });
    return patterns;
  }

  function guessDeckSlot(relativePath, suitOrder) {
    const orderedSuits = (Array.isArray(suitOrder) ? suitOrder : [])
      .map((id) => DECK_SUITS.find((suit) => suit.id === id))
      .filter(Boolean);
    const suits = orderedSuits.length === 4 ? orderedSuits : DECK_SUITS;
    const rel = String(relativePath || "").replace(/\\/g, "/").toLowerCase();
    const base = rel.split("/").pop().replace(/\.[^.]+$/, "");
    if (/(^|\/)(back|card-back|cardback|verso)(\.|$)/.test(rel) || /^back$/i.test(base)) {
      return "back";
    }
    const numMatch = base.match(/^(?:page[_-]?)?(\d{1,3})$/);
    const number = numMatch ? Number(numMatch[1]) : NaN;
    const inMajor = /major|trump|arcana/.test(rel);
    const inMinor = /minor|pip|small/.test(rel);
    if (Number.isInteger(number) && number >= 0 && number <= 21 && (inMajor || !inMinor)) {
      return `major-${number}`;
    }
    if (Number.isInteger(number) && number >= 22 && number <= 77) {
      const offset = number - 22;
      const suit = suits[Math.floor(offset / 14)];
      const rank = DECK_RANKS[offset % 14];
      if (suit && rank) {
        return `minor-${suit.id}-${rank.id}`;
      }
    }
    const suit = DECK_SUITS.find((entry) => entry.aliases.some((alias) => rel.includes(alias)));
    const rank = DECK_RANKS.find((entry) => entry.aliases.some((alias) => new RegExp(`(?:^|[^a-z])${alias}(?:$|[^a-z])`).test(base) || rel.includes(`/${alias}`)));
    if (suit && rank) {
      return `minor-${suit.id}-${rank.id}`;
    }
    if (Number.isInteger(number) && number >= 0 && number <= 21) {
      return `major-${number}`;
    }
    return "";
  }

  const ZIP_CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let crc = index;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
      table[index] = crc >>> 0;
    }
    return table;
  })();

  function zipCrc32(bytes) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
      crc = ZIP_CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function u16(value) {
    const buf = new Uint8Array(2);
    new DataView(buf.buffer).setUint16(0, value, true);
    return buf;
  }

  function u32(value) {
    const buf = new Uint8Array(4);
    new DataView(buf.buffer).setUint32(0, value, true);
    return buf;
  }

  function buildStoreZip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    files.forEach((file) => {
      const nameBytes = new TextEncoder().encode(file.name);
      const data = file.bytes;
      const crc = zipCrc32(data);
      const local = concatBytes([
        new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
        u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0),
        nameBytes,
        data
      ]);
      locals.push(local);
      const central = concatBytes([
        new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
        u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
        nameBytes
      ]);
      centrals.push(central);
      offset += local.length;
    });
    const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
    const eocd = concatBytes([
      new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
      u16(0), u16(0), u16(files.length), u16(files.length),
      u32(centralSize), u32(offset), u16(0)
    ]);
    return concatBytes([...locals, ...centrals, eocd]);
  }

  function openCreateDlc(hostEl, { onCreated } = {}) {
    if (!isAdmin()) {
      setStatus("Admin key required to create DLC.", true);
      return;
    }
    document.querySelector(".dlc-create-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "dlc-settings-overlay dlc-create-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="dlc-settings-overlay-panel">
        <div class="dlc-settings-overlay-head">
          <strong>Create DLC</strong>
          <button type="button" class="dlc-shop-btn" data-action="close">Close</button>
        </div>
        <div class="dlc-settings-overlay-body">
          <div data-role="create-intro">
            <p class="settings-field-hint">Pick a category. Text and decks are assembled in the browser, then saved into the DLC checkout.</p>
            <div class="dlc-create-kinds">
              <button type="button" class="dlc-shop-btn dlc-create-kind is-active" data-kind="text" aria-pressed="true">Text</button>
              <button type="button" class="dlc-shop-btn dlc-create-kind" data-kind="deck" aria-pressed="false">Deck</button>
              <button type="button" class="dlc-shop-btn dlc-create-kind" data-kind="plugin" aria-pressed="false">Plugin</button>
              <button type="button" class="dlc-shop-btn dlc-create-kind" data-kind="reference" aria-pressed="false">Reference</button>
            </div>
          </div>
          <div data-role="kind-text">
            <div data-role="text-source">
              <div class="dlc-create-meta-grid">
              <div class="settings-field">Upload a file
                <label class="dlc-shop-btn dlc-file-btn">Choose file
                  <input type="file" class="dlc-create-text-file" accept=".txt,.text,.md,.json,.html" hidden>
                </label>
              </div>
              </div>
              <label class="settings-field">Or paste text
                <textarea class="dlc-create-text-body" rows="7" placeholder="Paste a book, ritual, or article…"></textarea>
              </label>
              <div class="dlc-shop-actions">
                <button type="button" class="settings-button-primary" data-action="preview">Auto-section</button>
              </div>
            </div>
            <div data-role="text-fields" hidden>
              <div class="dlc-text-preview-stats" data-role="text-stats"></div>
              <div class="dlc-text-loose" data-role="text-shelf" hidden>
                <div class="dlc-text-loose-head">
                  <strong>Shelf</strong>
                  <span class="settings-field-hint">Leftovers and removed passages. Drag onto a section to put them back.</span>
                </div>
                <div class="dlc-text-shelf-list" data-role="shelf-list"></div>
              </div>
              <div class="dlc-text-workspace">
                <aside class="dlc-text-outline" data-role="text-outline"></aside>
                <div class="dlc-text-sample">
                  <div class="dlc-text-sample-head">
                    <input type="text" class="dlc-create-text-title dlc-text-preview-title" maxlength="120" placeholder="Title">
                    <input type="text" class="dlc-create-text-description" maxlength="400" placeholder="Description">
                    <input type="text" class="dlc-text-preview-title" data-role="sample-heading" placeholder="Section title">
                    <span class="settings-field-hint" data-role="sample-meta"></span>
                    <div class="dlc-text-edit-actions">
                      <button type="button" class="dlc-shop-btn" data-edit="section-up">Section up</button>
                      <button type="button" class="dlc-shop-btn" data-edit="section-down">Section down</button>
                      <button type="button" class="dlc-shop-btn" data-edit="section-add">Add section</button>
                      <button type="button" class="dlc-shop-btn" data-edit="section-delete">Delete section</button>
                      <button type="button" class="dlc-shop-btn" data-edit="verse-add">Add passage</button>
                    </div>
                  </div>
                  <div class="dlc-text-sample-reader" data-role="text-sample"></div>
                </div>
              </div>
              <div class="dlc-text-footer">
                <button type="button" class="settings-button-primary" data-action="save-text">Save DLC text</button>
                <button type="button" class="dlc-shop-btn" data-action="toggle-format">Format</button>
                <button type="button" class="dlc-shop-btn" data-action="toggle-options">Options</button>
              </div>
              <div class="dlc-text-drawer" data-role="text-format-panel" hidden>
                <label class="settings-field">Format
                  <select class="dlc-create-text-format"></select>
                </label>
                <div class="dlc-text-custom-rules" data-role="custom-rules">
                  <label class="settings-field">Heading pattern
                    <input type="text" class="dlc-text-heading-pattern" placeholder="^CHAPTER\\s+(\\d+)">
                  </label>
                  <label class="settings-field">Verse pattern
                    <input type="text" class="dlc-text-verse-pattern" placeholder="^(\\d+)[.]\\s+(.*)">
                  </label>
                  <label class="settings-field">Split
                    <select class="dlc-text-split">
                      <option value="blank-line">Blank lines</option>
                      <option value="line">Every line</option>
                    </select>
                  </label>
                  <label class="settings-field">Skip first lines
                    <input type="number" class="dlc-text-skip" min="0" max="200" value="0">
                  </label>
                  <div class="dlc-shop-actions">
                    <button type="button" class="dlc-shop-btn" data-action="apply-custom">Apply custom</button>
                  </div>
                </div>
              </div>
              <div class="dlc-text-drawer" data-role="text-options-panel" hidden>
                <label class="settings-field">Id
                  <input type="text" class="dlc-create-text-id" maxlength="40" placeholder="gospel-of-philip">
                </label>
                <label class="settings-field">Language
                  <input type="text" class="dlc-create-text-language" maxlength="40" value="English">
                </label>
                <label class="settings-field">Tradition
                  <input type="text" class="dlc-create-text-tradition" maxlength="80" placeholder="optional">
                </label>
                <div class="dlc-shop-actions">
                  <button type="button" class="dlc-shop-btn" data-action="change-source">Change source</button>
                </div>
              </div>
            </div>
          </div>
          <div data-role="kind-deck" hidden>
            <div data-role="deck-source">
              <div class="settings-field">Deck folder
                <label class="dlc-shop-btn dlc-file-btn">Choose folder
                  <input type="file" class="dlc-create-deck-folder" webkitdirectory multiple accept="image/*" hidden>
                </label>
              </div>
            </div>
            <div data-role="deck-fields" hidden>
              <div class="dlc-deck-meta">
                <label class="settings-field">Title
                  <input type="text" class="dlc-create-deck-title" maxlength="120" placeholder="My Deck">
                </label>
                <label class="settings-field">Id
                  <input type="text" class="dlc-create-deck-id" maxlength="40" placeholder="thoth">
                </label>
                <div class="dlc-shop-actions dlc-deck-meta-actions">
                  <button type="button" class="dlc-shop-btn" data-action="deck-help">Help</button>
                  <button type="button" class="dlc-shop-btn" data-action="detect-deck-patterns">Detect</button>
                  <button type="button" class="dlc-shop-btn" data-action="apply-deck-patterns">Apply</button>
                </div>
              </div>
              <div class="dlc-text-preview-stats" data-role="deck-stats"></div>
              <div class="dlc-deck-suit-order">
                <strong>After trumps</strong>
                <label>22–35 <select data-suit-block="0"></select></label>
                <label>36–49 <select data-suit-block="1"></select></label>
                <label>50–63 <select data-suit-block="2"></select></label>
                <label>64–77 <select data-suit-block="3"></select></label>
              </div>
              <div class="dlc-deck-pattern-groups">
                <section class="dlc-deck-pattern-card">
                  <h3>Trumps</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-majors" placeholder="a##">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-majors" value="0" min="0" max="22">
                    </label>
                  </div>
                  <div class="dlc-deck-grid" data-role="deck-grid-majors"></div>
                </section>
                <section class="dlc-deck-pattern-card">
                  <h3 data-role="suit-head-wands">Wands</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-wands" placeholder="b##">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-wands" value="1" min="0" max="14">
                    </label>
                    <label class="settings-field">Shown as
                      <input type="text" class="dlc-deck-alias-wands" placeholder="Batons">
                    </label>
                  </div>
                  <div class="dlc-deck-grid" data-role="deck-grid-wands"></div>
                </section>
                <section class="dlc-deck-pattern-card">
                  <h3 data-role="suit-head-cups">Cups</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-cups" placeholder="c##">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-cups" value="1" min="0" max="14">
                    </label>
                    <label class="settings-field">Shown as
                      <input type="text" class="dlc-deck-alias-cups" placeholder="Cups">
                    </label>
                  </div>
                  <div class="dlc-deck-grid" data-role="deck-grid-cups"></div>
                </section>
                <section class="dlc-deck-pattern-card">
                  <h3 data-role="suit-head-swords">Swords</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-swords" placeholder="d##">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-swords" value="1" min="0" max="14">
                    </label>
                    <label class="settings-field">Shown as
                      <input type="text" class="dlc-deck-alias-swords" placeholder="Swords">
                    </label>
                  </div>
                  <div class="dlc-deck-grid" data-role="deck-grid-swords"></div>
                </section>
                <section class="dlc-deck-pattern-card">
                  <h3 data-role="suit-head-pentacles">Disks</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-pentacles" placeholder="e##">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-pentacles" value="1" min="0" max="14">
                    </label>
                    <label class="settings-field">Shown as
                      <input type="text" class="dlc-deck-alias-pentacles" placeholder="Coins">
                    </label>
                  </div>
                  <div class="dlc-deck-grid" data-role="deck-grid-pentacles"></div>
                </section>
                <section class="dlc-deck-pattern-card dlc-deck-pattern-card-back">
                  <h3>Back</h3>
                  <div class="dlc-deck-pattern-row">
                    <div class="settings-field">One image for every card
                      <label class="dlc-shop-btn dlc-file-btn">Choose image
                        <input type="file" class="dlc-create-deck-back" accept="image/*" hidden>
                      </label>
                    </div>
                    <div class="dlc-deck-back" data-role="deck-back"></div>
                  </div>
                </section>
              </div>
              <details class="dlc-deck-loose" data-role="deck-loose" hidden>
                <summary>Unmapped images</summary>
                <div class="dlc-deck-loose-list" data-role="deck-loose-list"></div>
              </details>
              <div class="dlc-shop-actions">
                <button type="button" class="dlc-shop-btn" data-action="change-deck-source">Change folder</button>
                <label class="dlc-menu-hide-label">
                  <input type="checkbox" class="dlc-create-deck-incomplete">
                  Allow incomplete deck
                </label>
                <button type="button" class="settings-button-primary" data-action="save-deck">Save DLC deck</button>
              </div>
              <div class="dlc-ctx-menu" data-role="deck-ctx" hidden></div>
            </div>
          </div>
          <div data-role="kind-plugin" hidden></div>
          <div data-role="kind-reference" hidden>
            <div data-role="ref-source">
              <div class="settings-field">Upload JSON or JSONL
                <label class="dlc-shop-btn dlc-file-btn">Choose file
                  <input type="file" class="dlc-create-ref-file" accept=".json,.jsonl,application/json,application/jsonl" hidden>
                </label>
              </div>
            </div>
            <div data-role="ref-fields" hidden>
              <div class="dlc-text-preview-stats" data-role="ref-stats"></div>
              <div class="dlc-ref-sample" data-role="ref-sample"></div>
              <div class="dlc-text-footer">
                <button type="button" class="settings-button-primary" data-action="save-reference">Save DLC reference</button>
                <button type="button" class="dlc-shop-btn" data-action="toggle-ref-options">Options</button>
              </div>
              <div class="dlc-text-drawer" data-role="ref-options-panel" hidden>
                <label class="settings-field">Title
                  <input type="text" class="dlc-create-ref-title" maxlength="120" placeholder="Dream Symbols">
                </label>
                <label class="settings-field">Id
                  <input type="text" class="dlc-create-ref-id" maxlength="40" placeholder="dream-symbols">
                </label>
                <label class="settings-field">Kind
                  <select class="dlc-create-ref-kind">
                    <option value="dictionary" selected>Dictionary — common words</option>
                    <option value="encyclopedia">Encyclopedia — topics</option>
                    <option value="lexicon">Lexicon — specialist index</option>
                  </select>
                </label>
                <p class="settings-field-hint" data-role="ref-kind-hint"></p>
                <label class="settings-field" data-role="ref-scheme-field" hidden>
                  Lexicon index
                  <select class="dlc-create-ref-scheme">
                    <option value="word" selected>Word (slug: being-chased)</option>
                    <option value="term">Term (as written: being chased)</option>
                    <option value="strongs">Strong's (H1 / G12)</option>
                  </select>
                </label>
                <p class="settings-field-hint" data-role="ref-scheme-hint" hidden></p>
                <label class="settings-field">Description
                  <input type="text" class="dlc-create-ref-description" maxlength="400" placeholder="Short description">
                </label>
                <div class="dlc-ref-field-config" data-role="ref-field-config"></div>
              </div>
            </div>
          </div>
          <p class="settings-field-hint" data-role="status" aria-live="polite"></p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const statusEl = overlay.querySelector("[data-role='status']");
    const setFormStatus = (text, isError = false) => {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.classList.toggle("is-error", Boolean(isError));
    };
    let previewState = null;
    let sourceText = "";
    let sourceName = "";
    let idManual = false;

    function slugifyId(value) {
      return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    }

    function syncIdFromTitle(title) {
      if (idManual) return;
      const idEl = overlay.querySelector(".dlc-create-text-id");
      if (idEl) {
        idEl.value = slugifyId(title);
      }
    }

    overlay.querySelector('[data-action="close"]').addEventListener("click", () => overlay.remove());
    const paintKindButtons = (activeBtn) => {
      overlay.querySelectorAll(".dlc-create-kind").forEach((entry) => {
        const active = entry === activeBtn;
        entry.classList.toggle("is-active", active);
        entry.setAttribute("aria-pressed", active ? "true" : "false");
        if (entry.disabled) {
          return;
        }
        if (active) {
          entry.style.opacity = "0.55";
          entry.style.boxShadow = "inset 0 3px 8px rgba(0, 0, 0, 0.55)";
          entry.style.transform = "translateY(1px)";
          entry.style.filter = "brightness(0.82)";
        } else {
          entry.style.opacity = "";
          entry.style.boxShadow = "";
          entry.style.transform = "";
          entry.style.filter = "";
        }
      });
    };
    paintKindButtons(overlay.querySelector(".dlc-create-kind.is-active"));
    overlay.querySelectorAll(".dlc-create-kind").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.disabled) return;
        paintKindButtons(button);
        const kind = button.dataset.kind;
        overlay.querySelector("[data-role='kind-text']").hidden = kind !== "text";
        overlay.querySelector("[data-role='kind-deck']").hidden = kind !== "deck";
        overlay.querySelector("[data-role='kind-plugin']").hidden = kind !== "plugin";
        overlay.querySelector("[data-role='kind-reference']").hidden = kind !== "reference";
        if (kind === "plugin") {
          openCreatePluginForm(overlay.querySelector("[data-role='kind-plugin']"), { onCreated });
        }
      });
    });

    let referenceSource = "";
    let referenceFileName = "";
    let referenceParsed = null;
    let referenceFieldConfig = {};
    let referenceListOrder = [];

    const getRefListKeys = () => {
      const listed = Object.keys(referenceFieldConfig).filter((key) => referenceFieldConfig[key].list);
      const ordered = referenceListOrder.filter((key) => listed.includes(key));
      listed.forEach((key) => {
        if (!ordered.includes(key)) ordered.push(key);
      });
      referenceListOrder = ordered;
      return ordered;
    };

    const REF_FIELD_LABELS = {
      keyword: "Keyword",
      word: "Word",
      term: "Term",
      summary: "Summary",
      gloss: "Gloss",
      senses: "Senses",
      examples: "Examples",
      icon: "Icon",
      category: "Category",
      url: "Source",
      date: "Date",
      whatYourDream: "What your dream is telling you",
      theScience: "The science",
      psychology: "Psychology",
      shadowQuestion: "Shadow question",
      scenarioMatrix: "Scenario matrix",
      spiritualRemedies: "Spiritual remedies"
    };
    const REF_FIELD_HIDDEN = new Set(["slug", "date", "url"]);

    const humanizeRefKey = (key) => REF_FIELD_LABELS[key] || String(key || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/^\w/, (char) => char.toUpperCase());

    const REF_LIST_DEFAULT = new Set(["keyword", "word", "term", "title", "summary", "body", "icon", "category"]);

    const ensureRefColumns = (key, sample) => {
      if (!isRefTable(sample)) return;
      const field = referenceFieldConfig[key];
      if (!field.columns) field.columns = {};
      sample.forEach((row) => {
        Object.keys(row || {}).forEach((column) => {
          if (field.columns[column]) return;
          field.columns[column] = { label: humanizeRefKey(column), visible: true };
        });
      });
    };

    const ensureRefField = (key, sample) => {
      if (!key) return;
      if (!referenceFieldConfig[key]) {
        referenceFieldConfig[key] = {
          label: humanizeRefKey(key),
          visible: !REF_FIELD_HIDDEN.has(key),
          list: REF_LIST_DEFAULT.has(key)
        };
      }
      ensureRefColumns(key, sample);
    };

    const isRefTable = (value) => Array.isArray(value)
      && value.length
      && value.every((item) => item && typeof item === "object" && !Array.isArray(item));

    const formatRefCell = (value) => {
      if (value == null || value === "") return "";
      if (Array.isArray(value)) {
        return value.map((item) => {
          if (item && typeof item === "object") {
            return String(item.word || item.title || item.gloss || "").trim()
              || Object.values(item).filter((part) => part != null && typeof part !== "object").join(" ");
          }
          return String(item);
        }).filter(Boolean).join(", ");
      }
      if (typeof value === "object") {
        return String(value.word || value.title || value.gloss || "").trim();
      }
      return String(value);
    };

    const renderRefValue = (value, fieldKey) => {
      if (value == null || value === "") {
        return document.createTextNode("—");
      }
      if (isRefTable(value)) {
        ensureRefColumns(fieldKey, value);
        const columnConfig = referenceFieldConfig[fieldKey]?.columns || {};
        const columns = [...new Set(value.flatMap((row) => Object.keys(row || {})))]
          .filter((column) => columnConfig[column]?.visible !== false);
        const table = document.createElement("table");
        table.className = "dlc-ref-matrix";
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        columns.forEach((column) => {
          const th = document.createElement("th");
          th.textContent = columnConfig[column]?.label || humanizeRefKey(column);
          headRow.appendChild(th);
        });
        head.appendChild(headRow);
        const body = document.createElement("tbody");
        value.forEach((row) => {
          const tr = document.createElement("tr");
          columns.forEach((column) => {
            const td = document.createElement("td");
            td.textContent = formatRefCell(row[column]);
            tr.appendChild(td);
          });
          body.appendChild(tr);
        });
        table.append(head, body);
        const wrap = document.createElement("div");
        wrap.className = "dlc-ref-matrix-wrap";
        wrap.appendChild(table);
        return wrap;
      }
      if (Array.isArray(value)) {
        const wrap = document.createElement("div");
        wrap.className = "dlc-ref-detail-list";
        value.forEach((item) => {
          const row = document.createElement("div");
          row.textContent = formatRefCell(item);
          wrap.appendChild(row);
        });
        return wrap;
      }
      if (typeof value === "object") {
        return renderRefValue(Object.entries(value).map(([key, val]) => `${key}: ${val}`));
      }
      const span = document.createElement("span");
      span.textContent = String(value);
      return span;
    };

    const findRawReference = (id, title) => {
      const lowerId = String(id || "").toLowerCase();
      const lowerTitle = String(title || "").toLowerCase();
      const slugOf = (value) => String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const matches = (item) => {
        if (!item || typeof item !== "object") return false;
        const labels = [item.slug, item.id, item.keyword, item.word, item.term, item.title]
          .map((value) => String(value || "").toLowerCase())
          .filter(Boolean);
        if (lowerId && labels.includes(lowerId)) return true;
        if (lowerTitle && labels.includes(lowerTitle)) return true;
        const slugged = slugOf(item.word || item.keyword || item.term || item.title || item.slug);
        return Boolean(lowerId && slugged && slugged === lowerId);
      };
      if (Array.isArray(referenceParsed)) {
        return referenceParsed.find(matches) || null;
      }
      if (referenceParsed && typeof referenceParsed === "object") {
        const source = referenceParsed.entries && typeof referenceParsed.entries === "object"
          ? referenceParsed.entries
          : referenceParsed;
        if (source[id] || source[title]) return source[id] || source[title];
        return Object.values(source).find(matches) || null;
      }
      return null;
    };

    const renderRefFieldConfig = () => {
      const host = overlay.querySelector("[data-role='ref-field-config']");
      if (!host) return;
      host.replaceChildren();
      const listKeys = getRefListKeys();
      const restKeys = Object.keys(referenceFieldConfig).filter((key) => !listKeys.includes(key));
      [...listKeys, ...restKeys].forEach((key) => {
        const config = referenceFieldConfig[key];
        const row = document.createElement("div");
        row.className = "dlc-ref-field-row";
        const eye = document.createElement("button");
        eye.type = "button";
        eye.className = "dlc-ref-eye";
        eye.textContent = config.visible === false ? "○" : "◉";
        eye.title = config.visible === false ? "Hide in entry" : "Show in entry";
        eye.addEventListener("click", () => {
          config.visible = config.visible === false;
          renderRefFieldConfig();
        });
        const listBtn = document.createElement("button");
        listBtn.type = "button";
        listBtn.className = "dlc-ref-eye";
        listBtn.textContent = config.list ? "☰" : "–";
        listBtn.title = config.list ? "Shown in set list" : "Not in set list";
        listBtn.addEventListener("click", () => {
          config.list = !config.list;
          if (config.list && !referenceListOrder.includes(key)) {
            referenceListOrder.push(key);
          }
          if (!config.list) {
            referenceListOrder = referenceListOrder.filter((item) => item !== key);
          }
          renderRefFieldConfig();
          paintRefList(referencePreviewLast);
        });
        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "dlc-ref-eye";
        upBtn.textContent = "↑";
        upBtn.title = "Move up in set list (first is title)";
        upBtn.hidden = !config.list;
        upBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const keys = getRefListKeys().slice();
          const index = keys.indexOf(key);
          if (index < 1) return;
          keys.splice(index, 1);
          keys.splice(index - 1, 0, key);
          referenceListOrder = keys;
          renderRefFieldConfig();
          paintRefList(referencePreviewLast);
        });
        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "dlc-ref-eye";
        downBtn.textContent = "↓";
        downBtn.title = "Move down in set list";
        downBtn.hidden = !config.list;
        downBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const keys = getRefListKeys().slice();
          const index = keys.indexOf(key);
          if (index < 0 || index >= keys.length - 1) return;
          keys.splice(index, 1);
          keys.splice(index + 1, 0, key);
          referenceListOrder = keys;
          renderRefFieldConfig();
          paintRefList(referencePreviewLast);
        });
        const label = document.createElement("input");
        label.type = "text";
        label.value = config.label || humanizeRefKey(key);
        label.addEventListener("input", () => {
          config.label = label.value;
        });
        const keyName = document.createElement("span");
        keyName.textContent = key;
        if (config.list && getRefListKeys()[0] === key) {
          row.classList.add("is-list-title");
        }
        row.append(eye, listBtn, upBtn, downBtn, label, keyName);
        host.appendChild(row);
        if (config.columns && typeof config.columns === "object") {
          Object.keys(config.columns).forEach((column) => {
            const nested = document.createElement("div");
            nested.className = "dlc-ref-field-row is-column";
            const colEye = document.createElement("button");
            colEye.type = "button";
            colEye.className = "dlc-ref-eye";
            colEye.textContent = config.columns[column].visible === false ? "○" : "◉";
            colEye.title = "Column visibility";
            colEye.addEventListener("click", () => {
              config.columns[column].visible = config.columns[column].visible === false;
              renderRefFieldConfig();
            });
            const colLabel = document.createElement("input");
            colLabel.type = "text";
            colLabel.value = config.columns[column].label || humanizeRefKey(column);
            colLabel.addEventListener("input", () => {
              config.columns[column].label = colLabel.value;
            });
            const colKey = document.createElement("span");
            colKey.textContent = `${key}.${column}`;
            nested.append(colEye, colLabel, colKey);
            host.appendChild(nested);
          });
        }
      });
    };

    const openRefDetail = (entry) => {
      document.querySelector(".dlc-ref-detail-overlay")?.remove();
      const raw = findRawReference(entry.id, entry.title) || entry;
      const pop = document.createElement("div");
      pop.className = "dlc-settings-overlay dlc-ref-detail-overlay";
      pop.innerHTML = `
        <div class="dlc-settings-overlay-panel">
          <div class="dlc-settings-overlay-head">
            <strong>${escapeHtml(entry.title || entry.id || "Entry")}</strong>
            <button type="button" class="dlc-shop-btn" data-action="ref-detail-close">Close</button>
          </div>
          <div class="dlc-settings-overlay-body dlc-ref-detail-body"></div>
        </div>
      `;
      const body = pop.querySelector(".dlc-ref-detail-body");
      const data = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : { value: raw };
      Object.keys(data).forEach((key) => {
        if (data[key] == null || data[key] === "") return;
        ensureRefField(key);
        const config = referenceFieldConfig[key];
        const details = document.createElement("details");
        details.className = "dlc-ref-detail-fold";
        details.open = config.visible !== false;
        const summary = document.createElement("summary");
        const eye = document.createElement("button");
        eye.type = "button";
        eye.className = "dlc-ref-eye";
        eye.textContent = config.visible === false ? "○" : "◉";
        eye.title = config.visible === false ? "Hidden" : "Visible";
        eye.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          config.visible = config.visible === false;
          eye.textContent = config.visible === false ? "○" : "◉";
          eye.title = config.visible === false ? "Hidden" : "Visible";
          details.classList.toggle("is-hidden-field", config.visible === false);
          renderRefFieldConfig();
        });
        const label = document.createElement("input");
        label.type = "text";
        label.value = config.label || humanizeRefKey(key);
        label.addEventListener("click", (event) => event.stopPropagation());
        label.addEventListener("input", () => {
          config.label = label.value;
          renderRefFieldConfig();
        });
        const keyName = document.createElement("span");
        keyName.textContent = key;
        summary.append(eye, label, keyName);
        const content = document.createElement("div");
        content.className = "dlc-ref-detail-content";
        content.appendChild(renderRefValue(data[key], key));
        details.append(summary, content);
        details.classList.toggle("is-hidden-field", config.visible === false);
        body.appendChild(details);
      });
      document.body.appendChild(pop);
      const close = () => pop.remove();
      pop.querySelector("[data-action='ref-detail-close']").addEventListener("click", close);
      pop.addEventListener("click", (event) => {
        if (event.target === pop) close();
      });
    };

    let referencePreviewLast = null;

    const paintRefList = (preview) => {
      const sampleEl = overlay.querySelector("[data-role='ref-sample']");
      if (!sampleEl || !preview) return;
      sampleEl.replaceChildren();
      (preview.list || preview.sample || []).slice(0, 9).forEach((entry) => {
        const raw = findRawReference(entry.id, entry.title) || entry;
        const row = document.createElement("button");
        row.type = "button";
        row.className = "dlc-ref-sample-row";
        const listKeys = getRefListKeys();
        const values = (listKeys.length ? listKeys : ["title", "body"]).map((key) => {
          const source = raw && raw[key] != null ? raw[key] : entry[key];
          if (source == null || source === "" || typeof source === "object") return "";
          return String(source);
        }).filter(Boolean);
        const title = document.createElement("strong");
        title.textContent = values[0] || entry.title || entry.id;
        row.appendChild(title);
        const keyLine = document.createElement("span");
        keyLine.className = "dlc-ref-entry-key";
        keyLine.textContent = `key: ${entry.id}`;
        row.appendChild(keyLine);
        values.slice(1).forEach((text) => {
          const line = document.createElement("span");
          line.textContent = text;
          row.appendChild(line);
        });
        row.addEventListener("click", () => openRefDetail(entry));
        sampleEl.appendChild(row);
      });
    };

    const applyReferencePreview = (preview, { fillMeta = true } = {}) => {
      overlay.querySelector("[data-role='create-intro']")?.setAttribute("hidden", "hidden");
      overlay.querySelector("[data-role='ref-source']").hidden = true;
      overlay.querySelector("[data-role='ref-fields']").hidden = false;
      const seed = findRawReference(preview.list?.[0]?.id, preview.list?.[0]?.title)
        || (Array.isArray(referenceParsed) ? referenceParsed[0] : null);
      if (seed && typeof seed === "object") {
        Object.keys(seed).forEach((key) => ensureRefField(key, seed[key]));
      }
      (preview.list || []).forEach((entry) => {
        const raw = findRawReference(entry.id, entry.title);
        if (raw && typeof raw === "object") {
          Object.keys(raw).forEach((key) => ensureRefField(key, raw[key]));
        }
        Object.keys(entry).forEach((key) => ensureRefField(key));
      });
      renderRefFieldConfig();
      if (fillMeta) {
        overlay.querySelector(".dlc-create-ref-title").value = preview.title || "";
        if (!referenceIdManual) {
          overlay.querySelector(".dlc-create-ref-id").value = slugifyId(preview.title || preview.id || "");
        } else {
          overlay.querySelector(".dlc-create-ref-id").value = preview.id || "";
        }
        overlay.querySelector(".dlc-create-ref-kind").value = preview.kind || "dictionary";
        overlay.querySelector(".dlc-create-ref-scheme").value = preview.keyScheme || "word";
        overlay.querySelector(".dlc-create-ref-description").value = preview.description || "";
        syncRefKindUi();
      }
      const stats = overlay.querySelector("[data-role='ref-stats']");
      if (stats) {
        stats.innerHTML = "";
          [`${preview.count || 0} entries`, `preview ${preview.list?.length || 0}`, preview.kind, preview.keyScheme].forEach((label) => {
          const chip = document.createElement("span");
          chip.className = "dlc-text-chip";
          chip.textContent = label;
          stats.appendChild(chip);
        });
      }
      referencePreviewLast = preview;
      paintRefList(preview);
      setFormStatus(`Ready to save ${preview.count} entries. Click a row for full fields.`);
    };

    const runReferencePreview = async ({ fillMeta = true } = {}) => {
      const preview = await window.TarotDataService.requestJson(
        "POST",
        window.TarotDataService.buildApiUrl("/api/v1/dlc/references/preview"),
        {
          text: referenceSource,
          filename: referenceFileName,
          id: String(overlay.querySelector(".dlc-create-ref-id")?.value || "").trim(),
          title: String(overlay.querySelector(".dlc-create-ref-title")?.value || "").trim(),
          description: String(overlay.querySelector(".dlc-create-ref-description")?.value || "").trim(),
          kind: String(overlay.querySelector(".dlc-create-ref-kind")?.value || "").trim(),
          keyScheme: String(overlay.querySelector(".dlc-create-ref-scheme")?.value || "").trim()
        }
      );
      applyReferencePreview(preview, { fillMeta });
      return preview;
    };

    overlay.querySelector(".dlc-create-ref-file")?.addEventListener("change", async (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      referenceFileName = file.name;
      referenceSource = await file.text();
      try {
        referenceParsed = JSON.parse(referenceSource);
      } catch (_error) {
        const rows = [];
        String(referenceSource || "").split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          try {
            rows.push(JSON.parse(trimmed));
          } catch (_lineError) {}
        });
        referenceParsed = rows.length ? rows : null;
      }
      setFormStatus(`Loaded ${file.name}. Previewing…`);
      try {
        await runReferencePreview({ fillMeta: true });
      } catch (error) {
        setFormStatus(error?.message || "Could not preview that JSON.", true);
      }
    });
    let referenceIdManual = false;
    const REF_KIND_HINTS = {
      dictionary: "Everyday lookup by common words. Keys are slugs (being-chased).",
      encyclopedia: "Longer topics. Keys stay close to the term (being chased).",
      lexicon: "Specialist index. Choose Word, Term, or Strong's (Hebrew/Greek numbers) under Lexicon."
    };
    const REF_SCHEME_HINTS = {
      word: "Slug keys: lowercase, hyphens. Example: being-chased",
      term: "Natural-language keys. Example: being chased",
      strongs: "Strong's numbers only (H1, G12). Other entries fall back to slugs."
    };
    const syncRefKindUi = () => {
      const kind = String(overlay.querySelector(".dlc-create-ref-kind")?.value || "dictionary");
      const schemeField = overlay.querySelector("[data-role='ref-scheme-field']");
      const schemeHint = overlay.querySelector("[data-role='ref-scheme-hint']");
      const kindHint = overlay.querySelector("[data-role='ref-kind-hint']");
      const schemeEl = overlay.querySelector(".dlc-create-ref-scheme");
      if (kindHint) kindHint.textContent = REF_KIND_HINTS[kind] || "";
      const lexicon = kind === "lexicon";
      if (schemeField) schemeField.hidden = !lexicon;
      if (schemeHint) schemeHint.hidden = !lexicon;
      if (!lexicon && schemeEl) {
        schemeEl.value = kind === "encyclopedia" ? "term" : "word";
      }
      if (schemeHint && lexicon) {
        schemeHint.textContent = REF_SCHEME_HINTS[schemeEl?.value] || "";
      }
    };
    overlay.querySelector(".dlc-create-ref-title")?.addEventListener("input", (event) => {
      if (referenceIdManual) return;
      const idEl = overlay.querySelector(".dlc-create-ref-id");
      if (idEl) idEl.value = slugifyId(event.currentTarget.value);
    });
    overlay.querySelector(".dlc-create-ref-id")?.addEventListener("input", () => {
      referenceIdManual = true;
    });
    overlay.querySelector(".dlc-create-ref-kind")?.addEventListener("change", async () => {
      syncRefKindUi();
      if (!referenceSource.trim()) return;
      setFormStatus("Updating kind…");
      try {
        await runReferencePreview({ fillMeta: false });
      } catch (error) {
        setFormStatus(error?.message || "Could not update kind.", true);
      }
    });
    overlay.querySelector('[data-action="toggle-ref-options"]')?.addEventListener("click", (event) => {
      const panel = overlay.querySelector("[data-role='ref-options-panel']");
      const open = Boolean(panel?.hidden);
      if (panel) panel.hidden = !open;
      event.currentTarget.classList.toggle("is-active", open);
    });
    overlay.querySelector(".dlc-create-ref-scheme")?.addEventListener("change", async () => {
      syncRefKindUi();
      if (!referenceSource.trim()) return;
      setFormStatus("Rebuilding keys…");
      try {
        await runReferencePreview({ fillMeta: false });
      } catch (error) {
        setFormStatus(error?.message || "Could not rebuild keys.", true);
      }
    });
    overlay.querySelector('[data-action="save-reference"]')?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (!referenceSource.trim()) {
        setFormStatus("Upload a JSON file first.", true);
        return;
      }
      button.disabled = true;
      setFormStatus("Saving DLC reference…");
      try {
        const result = await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl("/api/v1/dlc/references"),
          {
            text: referenceSource,
            filename: referenceFileName,
            id: String(overlay.querySelector(".dlc-create-ref-id")?.value || "").trim(),
            title: String(overlay.querySelector(".dlc-create-ref-title")?.value || "").trim(),
            description: String(overlay.querySelector(".dlc-create-ref-description")?.value || "").trim(),
            kind: String(overlay.querySelector(".dlc-create-ref-kind")?.value || "dictionary").trim(),
            keyScheme: String(overlay.querySelector(".dlc-create-ref-scheme")?.value || "word").trim(),
            fieldConfig: referenceFieldConfig,
            listOrder: getRefListKeys()
          }
        );
        setFormStatus(`Saved '${result?.reference?.title || result?.reference?.id}'.`);
        overlay.remove();
        if (typeof onCreated === "function") {
          void Promise.resolve(onCreated(result?.reference)).catch(() => {});
        }
      } catch (error) {
        setFormStatus(error?.message || "Could not save DLC reference.", true);
      } finally {
        button.disabled = false;
      }
    });

    overlay.querySelector(".dlc-create-text-file").addEventListener("change", async (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      sourceName = file.name;
      sourceText = await file.text();
      overlay.querySelector(".dlc-create-text-body").value = sourceText;
      setFormStatus(`Loaded ${file.name} (${Math.round(file.size / 1024)} KB). Click Auto-section.`);
    });

    const applyDocumentTitle = (title) => {
      if (!previewState) return;
      const nextTitle = String(title || "").trim();
      previewState.title = nextTitle;
      if (previewState.document) {
        previewState.document.title = nextTitle;
        const works = Array.isArray(previewState.document.works) ? previewState.document.works : [];
        if (works.length === 1) {
          works[0].title = nextTitle;
        }
      }
      renderTextPreview(overlay, previewState, { syncFields: false });
    };

    let previewing = false;

    const fillFormatOptions = (formats, selected) => {
      const formatEl = overlay.querySelector(".dlc-create-text-format");
      if (!formatEl) return;
      if (formatEl.options.length <= 1) {
        formatEl.replaceChildren();
        (formats || []).forEach((entry) => {
          const id = String(entry?.id || entry || "").trim();
          if (!id) return;
          const opt = document.createElement("option");
          opt.value = id;
          opt.textContent = String(entry?.label || id);
          formatEl.appendChild(opt);
        });
      }
      if (selected && [...formatEl.options].some((option) => option.value === selected)) {
        formatEl.value = selected;
      }
    };

    const runTextPreview = async ({
      syncFields = true,
      statusText = "Sectioning…",
      format: formatOverride,
      keepFormat = false
    } = {}) => {
      if (previewing) {
        return false;
      }
      sourceText = String(overlay.querySelector(".dlc-create-text-body")?.value || sourceText || "");
      if (!sourceText.trim()) {
        setFormStatus("Upload or paste text first.", true);
        return false;
      }
      const formatEl = overlay.querySelector(".dlc-create-text-format");
      const requestedFormat = String(formatOverride || formatEl?.value || "").trim();
      previewing = true;
      setFormStatus(statusText);
      try {
        previewState = await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl("/api/v1/dlc/texts/preview"),
          {
            text: sourceText,
            filename: sourceName,
            format: requestedFormat || undefined,
            title: String(overlay.querySelector(".dlc-create-text-title")?.value || "").trim(),
            id: String(overlay.querySelector(".dlc-create-text-id")?.value || "").trim(),
            customRules: {
              headingPattern: String(overlay.querySelector(".dlc-text-heading-pattern")?.value || "").trim(),
              versePattern: String(overlay.querySelector(".dlc-text-verse-pattern")?.value || "").trim(),
              split: String(overlay.querySelector(".dlc-text-split")?.value || "blank-line").trim(),
              headerSkipCount: Number(overlay.querySelector(".dlc-text-skip")?.value) || 0
            }
          }
        );
        fillFormatOptions(previewState.formats, keepFormat ? requestedFormat : previewState.format);
        renderTextPreview(overlay, previewState, { syncFields });
        const used = String(previewState.format || requestedFormat || "");
        const warn = String(previewState.warning || "").trim();
        const note = requestedFormat && used && requestedFormat !== used
          ? ` Requested ${requestedFormat}, using ${used}.`
          : "";
        setFormStatus(
          warn
            ? warn
            : `Showing ${used}: ${previewState.stats?.sections || 0} section(s), ${previewState.stats?.verses || 0} passage(s).${note}`,
          Boolean(warn)
        );
        return true;
      } finally {
        previewing = false;
      }
    };

    overlay.querySelector('[data-action="toggle-format"]').addEventListener("click", (event) => {
      const panel = overlay.querySelector("[data-role='text-format-panel']");
      const options = overlay.querySelector("[data-role='text-options-panel']");
      const open = Boolean(panel?.hidden);
      if (panel) panel.hidden = !open;
      if (options) options.hidden = true;
      event.currentTarget.classList.toggle("is-active", open);
      overlay.querySelector('[data-action="toggle-options"]')?.classList.remove("is-active");
    });
    overlay.querySelector('[data-action="toggle-options"]').addEventListener("click", (event) => {
      const panel = overlay.querySelector("[data-role='text-options-panel']");
      const format = overlay.querySelector("[data-role='text-format-panel']");
      const open = Boolean(panel?.hidden);
      if (panel) panel.hidden = !open;
      if (format) format.hidden = true;
      event.currentTarget.classList.toggle("is-active", open);
      overlay.querySelector('[data-action="toggle-format"]')?.classList.remove("is-active");
    });
    overlay.querySelector('[data-action="change-source"]').addEventListener("click", () => {
      const sourceEl = overlay.querySelector("[data-role='text-source']");
      if (sourceEl) sourceEl.hidden = false;
      setFormStatus("Edit the source, then Auto-section again.");
    });

    overlay.querySelector('[data-action="preview"]').addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await runTextPreview();
      } catch (error) {
        setFormStatus(error?.message || "Could not section that text.", true);
      } finally {
        button.disabled = false;
      }
    });

    overlay.querySelector(".dlc-create-text-id").addEventListener("input", () => {
      idManual = true;
    });

    overlay.querySelector(".dlc-create-text-title").addEventListener("input", (event) => {
      const title = event.currentTarget.value;
      syncIdFromTitle(title);
      applyDocumentTitle(title);
    });

    overlay.querySelector(".dlc-create-text-format").addEventListener("change", async (event) => {
      const format = String(event.currentTarget.value || "").trim();
      if (!format) {
        return;
      }
      if (!sourceText.trim() && !String(overlay.querySelector(".dlc-create-text-body")?.value || "").trim()) {
        return;
      }
      try {
        await runTextPreview({
          syncFields: false,
          keepFormat: true,
          format,
          statusText: `Resectioning as ${format}…`
        });
      } catch (error) {
        setFormStatus(error?.message || "That format could not read this file.", true);
      }
    });

    overlay.querySelector('[data-action="apply-custom"]').addEventListener("click", async () => {
      overlay.querySelector(".dlc-create-text-format").value = "custom-text";
      try {
        await runTextPreview({
          syncFields: false,
          keepFormat: true,
          format: "custom-text",
          statusText: "Applying custom patterns…"
        });
      } catch (error) {
        setFormStatus(error?.message || "Custom patterns failed.", true);
      }
    });

    overlay.querySelector('[data-action="save-text"]').addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (!previewState) {
        setFormStatus("Auto-section the text first.", true);
        return;
      }
      button.disabled = true;
      setFormStatus("Saving DLC text…");
      try {
        const result = await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl("/api/v1/dlc/texts"),
          {
            id: String(overlay.querySelector(".dlc-create-text-id")?.value || previewState.id || "").trim(),
            title: String(overlay.querySelector(".dlc-create-text-title")?.value || previewState.title || "").trim(),
            description: String(overlay.querySelector(".dlc-create-text-description")?.value || "").trim(),
            language: String(overlay.querySelector(".dlc-create-text-language")?.value || "English").trim(),
            tradition: String(overlay.querySelector(".dlc-create-text-tradition")?.value || "").trim(),
            format: String(overlay.querySelector(".dlc-create-text-format")?.value || previewState.format || "").trim(),
            text: sourceText,
            document: collectEditedDocument(overlay, previewState)
          }
        );
        setFormStatus(`Saved '${result?.text?.title || result?.text?.id}'. Storage is refreshing so it appears in the library.`);
        setStatus(`Created text '${result?.text?.id}'.`);
        if (typeof onCreated === "function") {
          await onCreated(result?.text);
        }
        window.setTimeout(() => overlay.remove(), 1600);
      } catch (error) {
        setFormStatus(error?.message || "Could not save DLC text.", true);
      } finally {
        button.disabled = false;
      }
    });

    const deckSlots = deckSlotList();
    const deckState = {
      files: [],
      assigned: {},
      back: "",
      pendingLoose: "",
      idManual: false,
      cardNames: {},
      suitNames: {},
      suitOrder: DECK_SUITS.map((suit) => suit.id),
      backFile: null
    };

    overlay.querySelectorAll("[data-suit-block]").forEach((select) => {
      DECK_SUITS.forEach((suit) => {
        const option = document.createElement("option");
        option.value = suit.id;
        option.textContent = suit.label;
        select.appendChild(option);
      });
      select.value = deckState.suitOrder[Number(select.getAttribute("data-suit-block"))] || DECK_SUITS[0].id;
    });

    const revokeFaceUrls = () => {
      deckState.files.forEach((entry) => {
        if (entry.url) URL.revokeObjectURL(entry.url);
      });
    };
    const revokeDeckUrls = () => {
      revokeFaceUrls();
      if (deckState.backFile?.url) {
        URL.revokeObjectURL(deckState.backFile.url);
      }
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        revokeDeckUrls();
      }
    });
    overlay.querySelector('[data-action="close"]').addEventListener("click", revokeDeckUrls);

    const ctxMenu = overlay.querySelector("[data-role='deck-ctx']");
    const hideDeckMenus = () => {
      if (ctxMenu) ctxMenu.hidden = true;
      document.querySelector(".dlc-deck-rename-overlay")?.remove();
    };

    const suitLabel = (suitId) => {
      const custom = String(deckState.suitNames[suitId] || overlay.querySelector(`.dlc-deck-alias-${suitId}`)?.value || "").trim();
      if (custom) return custom;
      return DECK_SUITS.find((suit) => suit.id === suitId)?.label || suitId;
    };

    const slotDisplayLabel = (slot) => {
      const custom = String(deckState.cardNames[slot.key] || "").trim();
      if (custom) return custom;
      if (String(slot.key).startsWith("minor-")) {
        const parts = String(slot.key).split("-");
        const suitId = parts[1];
        const rankId = parts.slice(2).join("-");
        const rank = DECK_RANKS.find((entry) => entry.id === rankId)?.label || rankId;
        return `${rank} of ${suitLabel(suitId)}`;
      }
      return slot.label;
    };

    const openDeckPreview = (url, label, filePath) => {
      if (!url) return;
      const relative = String(filePath || "").replace(/\\/g, "/");
      const fileName = relative.split("/").pop() || "";
      document.querySelector(".dlc-deck-preview-overlay")?.remove();
      const pop = document.createElement("div");
      pop.className = "dlc-settings-overlay dlc-deck-preview-overlay";
      pop.setAttribute("role", "dialog");
      pop.innerHTML = `
        <div class="dlc-settings-overlay-panel dlc-deck-preview-panel">
          <div class="dlc-settings-overlay-head">
            <strong>${escapeHtml(label || "Card")}</strong>
            <button type="button" class="dlc-shop-btn" data-action="preview-close">Close</button>
          </div>
          <div class="dlc-deck-preview-file">
            <code>${escapeHtml(fileName)}</code>
            ${relative && relative !== fileName ? `<span>${escapeHtml(relative)}</span>` : ""}
          </div>
          <div class="dlc-deck-preview-body">
            <img src="${escapeHtml(url)}" alt="${escapeHtml(label || "Card")}">
          </div>
        </div>
      `;
      document.body.appendChild(pop);
      const close = () => pop.remove();
      pop.querySelector('[data-action="preview-close"]').addEventListener("click", close);
      pop.addEventListener("click", (event) => {
        if (event.target === pop) close();
      });
    };

    const openRenamePop = (title, value, onSave) => {
      hideDeckMenus();
      const pop = document.createElement("div");
      pop.className = "dlc-settings-overlay dlc-deck-rename-overlay";
      pop.setAttribute("role", "dialog");
      pop.innerHTML = `
        <div class="dlc-settings-overlay-panel dlc-deck-rename-panel">
          <div class="dlc-settings-overlay-head">
            <strong>${escapeHtml(title)}</strong>
            <button type="button" class="dlc-shop-btn" data-action="rename-cancel">Close</button>
          </div>
          <div class="dlc-settings-overlay-body">
            <label class="settings-field">Name
              <input type="text" class="dlc-rename-input" maxlength="80">
            </label>
            <div class="dlc-shop-actions">
              <button type="button" class="settings-button-primary" data-action="rename-ok">Save</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(pop);
      const input = pop.querySelector(".dlc-rename-input");
      if (input) {
        input.value = value || "";
        input.focus();
        input.select();
      }
      const finish = (save) => {
        const next = String(input?.value || "").trim();
        pop.remove();
        if (save) onSave(next);
      };
      pop.querySelector('[data-action="rename-ok"]').addEventListener("click", () => finish(true));
      pop.querySelector('[data-action="rename-cancel"]').addEventListener("click", () => finish(false));
      pop.addEventListener("click", (event) => {
        if (event.target === pop) finish(false);
      });
      input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") finish(true);
        if (event.key === "Escape") finish(false);
      });
    };

    const showDeckContextMenu = (event, items) => {
      event.preventDefault();
      if (!ctxMenu) return;
      ctxMenu.replaceChildren();
      items.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.label;
        button.addEventListener("click", () => {
          hideDeckMenus();
          item.action();
        });
        ctxMenu.appendChild(button);
      });
      ctxMenu.hidden = false;
      const left = Math.min(event.clientX, window.innerWidth - 180);
      const top = Math.min(event.clientY, window.innerHeight - 8 - items.length * 36);
      ctxMenu.style.left = `${Math.max(8, left)}px`;
      ctxMenu.style.top = `${Math.max(8, top)}px`;
    };

    overlay.addEventListener("click", (event) => {
      if (!event.target.closest("[data-role='deck-ctx']")) {
        if (ctxMenu) ctxMenu.hidden = true;
      }
    });

    const renderDeckEditor = () => {
      const statsEl = overlay.querySelector("[data-role='deck-stats']");
      const backEl = overlay.querySelector("[data-role='deck-back']");
      const looseHost = overlay.querySelector("[data-role='deck-loose']");
      const looseList = overlay.querySelector("[data-role='deck-loose-list']");
      const grids = {
        Majors: overlay.querySelector("[data-role='deck-grid-majors']"),
        Wands: overlay.querySelector("[data-role='deck-grid-wands']"),
        Cups: overlay.querySelector("[data-role='deck-grid-cups']"),
        Swords: overlay.querySelector("[data-role='deck-grid-swords']"),
        Disks: overlay.querySelector("[data-role='deck-grid-pentacles']")
      };
      DECK_SUITS.forEach((suit) => {
        const head = overlay.querySelector(`[data-role="suit-head-${suit.id}"]`);
        if (head) {
          head.textContent = suitLabel(suit.id);
        }
      });
      const assignedCount = Object.keys(deckState.assigned).filter((key) => key !== "back" && deckState.assigned[key]).length;
      if (statsEl) {
        statsEl.innerHTML = "";
        [`${assignedCount}/78 cards`, deckState.backFile ? "back set" : "no back", `${deckState.files.length} files`].forEach((label) => {
          const chip = document.createElement("span");
          chip.className = "dlc-text-chip";
          chip.textContent = label;
          statsEl.appendChild(chip);
        });
      }
      const fileByPath = new Map(deckState.files.map((entry) => [entry.path, entry]));
      if (backEl) {
        backEl.replaceChildren();
        if (deckState.backFile?.url) {
          const img = document.createElement("img");
          img.alt = "Card back";
          img.src = deckState.backFile.url;
          img.addEventListener("click", () => {
            openDeckPreview(deckState.backFile.url, "Card back", deckState.backFile.name);
          });
          backEl.appendChild(img);
        }
      }
      Object.values(grids).forEach((grid) => grid?.replaceChildren());
      deckSlots.forEach((slot) => {
          const gridEl = grids[slot.group];
          if (!gridEl) return;
          const card = document.createElement("button");
          card.type = "button";
          card.className = "dlc-deck-slot";
          const path = deckState.assigned[slot.key];
          const file = path ? fileByPath.get(path) : null;
          const displayName = slotDisplayLabel(slot);
          if (file?.url) {
            const img = document.createElement("img");
            img.src = file.url;
            img.alt = displayName;
            card.appendChild(img);
          }
          const caption = document.createElement("span");
          caption.textContent = displayName;
          card.appendChild(caption);
          if (file?.path) {
            const fileLabel = document.createElement("span");
            fileLabel.className = "dlc-deck-slot-file";
            fileLabel.textContent = String(file.path).replace(/\\/g, "/").split("/").pop();
            card.appendChild(fileLabel);
          }
          if (deckState.pendingLoose) {
            card.classList.add("is-assign");
          }
          if (deckState.cardNames[slot.key]) {
            card.classList.add("is-renamed");
          }
          card.addEventListener("click", () => {
            if (file?.url) {
              openDeckPreview(file.url, displayName, file.path);
            }
          });
          card.addEventListener("contextmenu", (event) => {
            const items = [
              {
                label: "Rename card…",
                action: () => openRenamePop("Card name", displayName, (value) => {
                  if (value && value !== slot.label) {
                    deckState.cardNames[slot.key] = value;
                  } else {
                    delete deckState.cardNames[slot.key];
                  }
                  renderDeckEditor();
                })
              },
              {
                label: "Reset name",
                action: () => {
                  delete deckState.cardNames[slot.key];
                  renderDeckEditor();
                }
              }
            ];
            if (deckState.pendingLoose) {
              items.unshift({
                label: "Assign selected image",
                action: () => {
                  const previous = deckState.assigned[slot.key];
                  deckState.assigned[slot.key] = deckState.pendingLoose;
                  deckState.pendingLoose = previous || "";
                  renderDeckEditor();
                }
              });
            }
            if (deckState.assigned[slot.key]) {
              items.push({
                label: "Unmap image",
                action: () => {
                  delete deckState.assigned[slot.key];
                  renderDeckEditor();
                }
              });
            }
            showDeckContextMenu(event, items);
          });
          gridEl.appendChild(card);
      });
      const used = new Set(Object.values(deckState.assigned).filter(Boolean));
      const loose = deckState.files.filter((entry) => !used.has(entry.path));
      if (looseHost && looseList) {
        looseHost.hidden = loose.length === 0;
        const summary = looseHost.querySelector("summary");
        if (summary) {
          summary.textContent = `Unmapped images (${loose.length})`;
        }
        looseList.replaceChildren();
        loose.forEach((entry) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "dlc-deck-loose-item";
          if (deckState.pendingLoose === entry.path) {
            item.classList.add("is-active");
          }
          const img = document.createElement("img");
          img.src = entry.url;
          img.alt = entry.path;
          const name = document.createElement("span");
          name.textContent = entry.path;
          item.append(img, name);
          item.addEventListener("click", () => {
            openDeckPreview(entry.url, entry.path, entry.path);
          });
          item.addEventListener("contextmenu", (event) => {
            showDeckContextMenu(event, [
              {
                label: deckState.pendingLoose === entry.path ? "Deselect" : "Select to assign",
                action: () => {
                  deckState.pendingLoose = deckState.pendingLoose === entry.path ? "" : entry.path;
                  renderDeckEditor();
                }
              }
            ]);
          });
          looseList.appendChild(item);
        });
      }
    };

    const fillDeckPatternFields = (patterns) => {
      overlay.querySelector(".dlc-deck-pat-majors").value = patterns.majors?.pattern || "";
      overlay.querySelector(".dlc-deck-start-majors").value = String(patterns.majors?.start ?? 0);
      DECK_SUITS.forEach((suit) => {
        overlay.querySelector(`.dlc-deck-pat-${suit.id}`).value = patterns.suits?.[suit.id]?.pattern || "";
        overlay.querySelector(`.dlc-deck-start-${suit.id}`).value = String(patterns.suits?.[suit.id]?.start ?? 1);
      });
    };

    const applyDeckPatterns = (overwrite) => {
      const majorsPattern = String(overlay.querySelector(".dlc-deck-pat-majors")?.value || "").trim();
      const majorsStart = Number(overlay.querySelector(".dlc-deck-start-majors")?.value);
      let mapped = 0;
      deckState.files.forEach((entry) => {
        const base = deckFileBase(entry.path);
        let slot = "";
        const majorNumber = matchDeckPattern(base, majorsPattern);
        if (majorNumber != null) {
          const trump = majorNumber - (Number.isInteger(majorsStart) ? majorsStart : 0);
          if (trump >= 0 && trump <= 21) {
            slot = `major-${trump}`;
          }
        }
        if (!slot) {
          DECK_SUITS.some((suit) => {
            const pattern = String(overlay.querySelector(`.dlc-deck-pat-${suit.id}`)?.value || "").trim();
            const start = Number(overlay.querySelector(`.dlc-deck-start-${suit.id}`)?.value);
            const rankNumber = matchDeckPattern(base, pattern);
            if (rankNumber == null) {
              return false;
            }
            const rankIndex = rankNumber - (Number.isInteger(start) ? start : 1);
            const rank = DECK_RANKS[rankIndex];
            if (!rank) {
              return false;
            }
            slot = `minor-${suit.id}-${rank.id}`;
            return true;
          });
        }
        if (!slot) {
          return;
        }
        if (overwrite || !deckState.assigned[slot]) {
          deckState.assigned[slot] = entry.path;
          mapped += 1;
        }
      });
      return mapped;
    };

    const numberedFileIndex = (filePath) => {
      const match = deckFileBase(filePath).match(/^(?:page[_-]?)?(\d{1,3})$/);
      const number = match ? Number(match[1]) : NaN;
      return Number.isInteger(number) ? number : null;
    };

    const remapNumberedMinors = () => {
      const order = [0, 1, 2, 3].map((index) => (
        String(overlay.querySelector(`[data-suit-block="${index}"]`)?.value || DECK_SUITS[index].id)
      ));
      deckState.suitOrder = order;
      const numberedPaths = new Set();
      deckState.files.forEach((entry) => {
        const number = numberedFileIndex(entry.path);
        if (number >= 22 && number <= 77) {
          numberedPaths.add(entry.path);
        }
      });
      Object.keys(deckState.assigned).forEach((key) => {
        if (key.startsWith("minor-") && numberedPaths.has(deckState.assigned[key])) {
          delete deckState.assigned[key];
        }
      });
      deckState.files.forEach((entry) => {
        const slot = guessDeckSlot(entry.path, order);
        if (slot && slot.startsWith("minor-") && numberedPaths.has(entry.path)) {
          deckState.assigned[slot] = entry.path;
        }
      });
    };

    const swapSuitCards = (idA, idB) => {
      if (!idA || !idB || idA === idB) {
        return;
      }
      DECK_RANKS.forEach((rank) => {
        const keyA = `minor-${idA}-${rank.id}`;
        const keyB = `minor-${idB}-${rank.id}`;
        const valueA = deckState.assigned[keyA];
        const valueB = deckState.assigned[keyB];
        if (valueB) {
          deckState.assigned[keyA] = valueB;
        } else {
          delete deckState.assigned[keyA];
        }
        if (valueA) {
          deckState.assigned[keyB] = valueA;
        } else {
          delete deckState.assigned[keyB];
        }
      });
      const indexA = deckState.suitOrder.indexOf(idA);
      const indexB = deckState.suitOrder.indexOf(idB);
      if (indexA >= 0 && indexB >= 0) {
        const next = [...deckState.suitOrder];
        next[indexA] = idB;
        next[indexB] = idA;
        deckState.suitOrder = next;
        overlay.querySelectorAll("[data-suit-block]").forEach((select, index) => {
          select.value = deckState.suitOrder[index];
        });
      }
    };

    overlay.querySelectorAll("[data-suit-block]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.getAttribute("data-suit-block"));
        const nextId = String(select.value || "");
        const other = deckState.suitOrder.indexOf(nextId);
        if (other >= 0 && other !== index) {
          const swapped = [...deckState.suitOrder];
          swapped[other] = deckState.suitOrder[index];
          swapped[index] = nextId;
          deckState.suitOrder = swapped;
        } else {
          deckState.suitOrder[index] = nextId;
        }
        overlay.querySelectorAll("[data-suit-block]").forEach((entry, block) => {
          entry.value = deckState.suitOrder[block];
        });
        remapNumberedMinors();
        renderDeckEditor();
        setFormStatus("Suit order after trumps updated for 22–77 files.");
      });
    });

    overlay.querySelector(".dlc-create-deck-folder").addEventListener("change", (event) => {
      const files = [...(event.currentTarget.files || [])].filter((file) => DECK_IMAGE_EXT.test(file.name));
      if (!files.length) {
        setFormStatus("No images found in that folder.", true);
        return;
      }
      revokeFaceUrls();
      deckState.files = files.map((file) => {
        const path = String(file.webkitRelativePath || file.name).replace(/\\/g, "/");
        return {
          path,
          file,
          url: URL.createObjectURL(file)
        };
      });
      deckState.assigned = {};
      deckState.pendingLoose = "";
      deckState.cardNames = {};
      deckState.suitNames = {};
      deckState.suitOrder = DECK_SUITS.map((suit) => suit.id);
      overlay.querySelectorAll("[data-suit-block]").forEach((select, index) => {
        select.value = deckState.suitOrder[index];
      });
      deckState.files.forEach((entry) => {
        const slot = guessDeckSlot(entry.path, deckState.suitOrder);
        if (slot && slot !== "back" && !deckState.assigned[slot]) {
          deckState.assigned[slot] = entry.path;
        }
      });
      const detected = detectDeckPatterns(deckState.files);
      fillDeckPatternFields(detected);
      DECK_SUITS.forEach((suit) => {
        const aliasEl = overlay.querySelector(`.dlc-deck-alias-${suit.id}`);
        if (aliasEl) aliasEl.value = "";
      });
      applyDeckPatterns(false);
      const folderName = String(deckState.files[0]?.path || "").split("/")[0] || "My Deck";
      const titleEl = overlay.querySelector(".dlc-create-deck-title");
      const idEl = overlay.querySelector(".dlc-create-deck-id");
      if (titleEl && !titleEl.value) {
        titleEl.value = folderName.replace(/[-_]+/g, " ");
      }
      if (idEl && !deckState.idManual) {
        idEl.value = slugifyId(titleEl?.value || folderName);
      }
      overlay.querySelector("[data-role='create-intro']")?.setAttribute("hidden", "hidden");
      overlay.querySelector("[data-role='deck-source']").hidden = true;
      overlay.querySelector("[data-role='deck-fields']").hidden = false;
      renderDeckEditor();
      setFormStatus("Check the mapping, then save. Unmapped images stay on the device until you assign or skip them.");
    });

    overlay.querySelector('[data-action="deck-help"]').addEventListener("click", () => {
      document.querySelector(".dlc-deck-help-overlay")?.remove();
      const help = document.createElement("div");
      help.className = "dlc-settings-overlay dlc-deck-help-overlay";
      help.innerHTML = `
        <div class="dlc-settings-overlay-panel dlc-deck-rename-panel">
          <div class="dlc-settings-overlay-head">
            <strong>Deck mapping</strong>
            <button type="button" class="dlc-shop-btn" data-action="help-close">Close</button>
          </div>
          <div class="dlc-settings-overlay-body">
            <p class="settings-field-hint">Pick a folder of card images. Mapping stays in the browser until you save.</p>
            <p class="settings-field-hint">Pattern <code>a##</code> is a prefix plus number. Start is the first index in those files (0 or 1). Detect reads letter groups like a/b/c from the folder.</p>
            <p class="settings-field-hint">Left-click a card to view it larger. Right-click to rename, unmap, or assign a selected leftover. Shown as maps a suit (Wands → Batons) onto the standard deck.</p>
            <p class="settings-field-hint">For 00–77 files, After trumps sets which suit owns 22–35, 36–49, 50–63, and 64–77. Right-click a suit heading to swap its cards with another suit.</p>
            <p class="settings-field-hint">Unmapped leftovers can be assigned or skipped. All 78 slots are required unless you allow an incomplete deck.</p>
          </div>
        </div>
      `;
      document.body.appendChild(help);
      help.querySelector('[data-action="help-close"]').addEventListener("click", () => help.remove());
      help.addEventListener("click", (event) => {
        if (event.target === help) help.remove();
      });
    });

    overlay.querySelector('[data-action="detect-deck-patterns"]').addEventListener("click", () => {
      if (!deckState.files.length) {
        setFormStatus("Choose a deck folder first.", true);
        return;
      }
      fillDeckPatternFields(detectDeckPatterns(deckState.files));
      const mapped = applyDeckPatterns(true);
      renderDeckEditor();
      setFormStatus(`Detected patterns and mapped ${mapped} file(s). Adjust patterns if a suit is wrong, then Apply.`);
    });
    DECK_SUITS.forEach((suit) => {
      overlay.querySelector(`[data-role="suit-head-${suit.id}"]`)?.addEventListener("contextmenu", (event) => {
        showDeckContextMenu(event, [
          {
            label: `Rename ${suit.label}…`,
            action: () => openRenamePop(`${suit.label} shown as`, suitLabel(suit.id), (value) => {
              if (value && value !== suit.label) {
                deckState.suitNames[suit.id] = value;
              } else {
                delete deckState.suitNames[suit.id];
              }
              const aliasEl = overlay.querySelector(`.dlc-deck-alias-${suit.id}`);
              if (aliasEl) aliasEl.value = deckState.suitNames[suit.id] || "";
              renderDeckEditor();
            })
          },
          {
            label: "Reset suit name",
            action: () => {
              delete deckState.suitNames[suit.id];
              const aliasEl = overlay.querySelector(`.dlc-deck-alias-${suit.id}`);
              if (aliasEl) aliasEl.value = "";
              renderDeckEditor();
            }
          },
          ...DECK_SUITS.filter((other) => other.id !== suit.id).map((other) => ({
            label: `Swap cards with ${other.label}`,
            action: () => {
              swapSuitCards(suit.id, other.id);
              renderDeckEditor();
              setFormStatus(`Swapped ${suit.label} with ${other.label}.`);
            }
          }))
        ]);
      });
      overlay.querySelector(`.dlc-deck-alias-${suit.id}`)?.addEventListener("input", (event) => {
        const value = String(event.currentTarget.value || "").trim();
        if (value && value !== suit.label) {
          deckState.suitNames[suit.id] = value;
        } else {
          delete deckState.suitNames[suit.id];
        }
        renderDeckEditor();
      });
    });

    overlay.querySelector('[data-action="apply-deck-patterns"]').addEventListener("click", () => {
      if (!deckState.files.length) {
        setFormStatus("Choose a deck folder first.", true);
        return;
      }
      const mapped = applyDeckPatterns(true);
      renderDeckEditor();
      setFormStatus(`Applied patterns to ${mapped} file(s).`);
    });

    overlay.querySelector(".dlc-create-deck-id").addEventListener("input", () => {
      deckState.idManual = true;
    });
    overlay.querySelector(".dlc-create-deck-title").addEventListener("input", (event) => {
      if (!deckState.idManual) {
        overlay.querySelector(".dlc-create-deck-id").value = slugifyId(event.currentTarget.value);
      }
    });
    overlay.querySelector(".dlc-create-deck-back").addEventListener("change", (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      if (deckState.backFile?.url) {
        URL.revokeObjectURL(deckState.backFile.url);
      }
      deckState.backFile = {
        file,
        name: file.name,
        url: URL.createObjectURL(file)
      };
      renderDeckEditor();
      setFormStatus(`Card back set from ${file.name}. Used for every card.`);
    });

    overlay.querySelector('[data-action="change-deck-source"]').addEventListener("click", () => {
      overlay.querySelector("[data-role='deck-source']").hidden = false;
    });
    overlay.querySelector('[data-action="save-deck"]').addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const title = String(overlay.querySelector(".dlc-create-deck-title")?.value || "").trim() || "Untitled deck";
      const id = slugifyId(overlay.querySelector(".dlc-create-deck-id")?.value || title);
      const missing = deckSlots.filter((slot) => !deckState.assigned[slot.key]);
      const allowIncomplete = Boolean(overlay.querySelector(".dlc-create-deck-incomplete")?.checked);
      if (missing.length && !allowIncomplete) {
        setFormStatus(`${missing.length} card(s) still unmapped. Map them, or check “Allow incomplete deck”.`, true);
        return;
      }
      const mapped = deckSlots.filter((slot) => deckState.assigned[slot.key]);
      if (!mapped.length) {
        setFormStatus("Map at least one card image before saving.", true);
        return;
      }
      button.disabled = true;
      setFormStatus("Packing deck…");
      try {
        const fileByPath = new Map(deckState.files.map((entry) => [entry.path, entry]));
        const zipFiles = [];
        const majorNameOverridesByTrump = {};
        const minorNameOverrides = {};
        const suitNameOverrides = {};
        DECK_SUITS.forEach((suit) => {
          const custom = String(deckState.suitNames[suit.id] || overlay.querySelector(`.dlc-deck-alias-${suit.id}`)?.value || "").trim();
          if (custom && custom !== suit.label) {
            suitNameOverrides[suit.id === "pentacles" ? "disks" : suit.id] = custom;
          }
        });
        deckSlots.forEach((slot) => {
          const custom = String(deckState.cardNames[slot.key] || "").trim();
          if (!custom) return;
          if (slot.key.startsWith("major-")) {
            const trump = Number(slot.key.slice(6));
            if (custom !== DECK_MAJORS[trump]) {
              majorNameOverridesByTrump[String(trump)] = custom;
            }
            return;
          }
          const parts = slot.key.split("-");
          const suitId = parts[1] === "pentacles" ? "disks" : parts[1];
          const rankId = parts.slice(2).join("-");
          minorNameOverrides[`${rankId} of ${suitId}`] = custom;
        });
        const imageExt = (filePath) => {
          const match = String(filePath || "").toLowerCase().match(/\.(png|jpe?g|webp|gif)$/);
          return match ? match[0] : ".png";
        };
        const majorCards = {};
        const minorCards = {};
        const addFile = async (slotFile, zipName) => {
          const entry = fileByPath.get(slotFile);
          if (!entry) return;
          zipFiles.push({ name: zipName, bytes: new Uint8Array(await entry.file.arrayBuffer()) });
        };
        for (const slot of mapped) {
          const sourcePath = deckState.assigned[slot.key];
          const zipName = `${String(slot.file).replace(/\.[^.]+$/, "")}${imageExt(sourcePath)}`;
          await addFile(sourcePath, zipName);
          if (slot.key.startsWith("major-")) {
            majorCards[String(slot.key.slice(6))] = zipName;
          } else {
            const parts = slot.key.split("-");
            const suitId = parts[1] === "pentacles" ? "disks" : parts[1];
            const rankId = parts.slice(2).join("-");
            minorCards[`${rankId} of ${suitId}`] = zipName;
          }
        }
        let cardBack = "";
        if (deckState.backFile?.file) {
          cardBack = `back${imageExt(deckState.backFile.name)}`;
          zipFiles.push({
            name: cardBack,
            bytes: new Uint8Array(await deckState.backFile.file.arrayBuffer())
          });
        }
        const manifest = {
          id,
          name: title,
          thumbnails: { root: "thumbs", width: 240, height: 360, fit: "inside", quality: 82 },
          majors: { mode: "trump-map", cards: majorCards },
          minors: { mode: "file-map", cards: minorCards }
        };
        if (cardBack) {
          manifest.cardBack = cardBack;
        }
        if (Object.keys(majorNameOverridesByTrump).length) {
          manifest.majorNameOverridesByTrump = majorNameOverridesByTrump;
        }
        if (Object.keys(minorNameOverrides).length) {
          manifest.minorNameOverrides = minorNameOverrides;
        }
        if (Object.keys(suitNameOverrides).length) {
          manifest.suitNameOverrides = suitNameOverrides;
        }
        zipFiles.unshift({
          name: "deck.json",
          bytes: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)
        });
        const zipBytes = buildStoreZip(zipFiles.filter((file) => file.bytes && file.bytes.length));
        if (!zipBytes.length) {
          throw new Error("Nothing to upload.");
        }
        setFormStatus(`Uploading ${mapped.length} card(s)…`);
        const result = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", window.TarotDataService.buildApiUrl("/api/v1/dlc/decks"));
          xhr.setRequestHeader("Content-Type", "application/zip");
          const apiKey = window.TarotDataService.getApiKey?.();
          if (apiKey) xhr.setRequestHeader("x-api-key", apiKey);
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const percent = Math.round((event.loaded / event.total) * 100);
            setFormStatus(`Uploading ${mapped.length} card(s)… ${percent}%`);
          };
          xhr.onload = () => {
            let payload = null;
            try {
              payload = JSON.parse(xhr.responseText || "{}");
            } catch (_error) {
              payload = null;
            }
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(payload?.data ?? payload ?? {});
              return;
            }
            reject(new Error(payload?.message || payload?.error?.message || `Upload failed (HTTP ${xhr.status}).`));
          };
          xhr.onerror = () => reject(new Error("Network error during deck upload."));
          xhr.send(zipBytes);
        });
        setFormStatus(`Saved '${result?.deck?.title || id}'. Storage is refreshing so the deck appears.`);
        setStatus(`Created deck '${result?.deck?.id || id}'.`);
        if (typeof onCreated === "function") {
          await onCreated(result?.deck);
        }
        revokeDeckUrls();
        window.setTimeout(() => overlay.remove(), 1600);
      } catch (error) {
        setFormStatus(error?.message || "Could not save DLC deck.", true);
      } finally {
        button.disabled = false;
      }
    });
  }

  function openCreatePlugin(hostEl, options) {
    openCreateDlc(hostEl, options);
  }

  const KIND_ORDER = ["gui", "api", "plugin", "pack", "deck", "text", "reference"];
  const KIND_LABELS = {
    pack: "Packs",
    deck: "Decks",
    text: "Texts",
    reference: "References",
    plugin: "Plugins",
    api: "API",
    gui: "GUI"
  };

  function mergeCatalogItems(items) {
    const rank = { installed: 0, staged: 1, available: 2, partial: 3 };
    const byKey = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const name = String(item?.name || "").trim();
      if (!name) return;
      const key = `${String(item.kind || "")}:${name.toLowerCase()}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...item });
        return;
      }
      const existingRank = rank[existing.status] ?? 9;
      const nextRank = rank[item.status] ?? 9;
      if (nextRank < existingRank) {
        byKey.set(key, {
          ...item,
          updateAvailable: Boolean(item.updateAvailable || existing.updateAvailable),
          latestVersion: item.latestVersion || existing.latestVersion
        });
        return;
      }
      if (item.updateAvailable) existing.updateAvailable = true;
      if (item.latestVersion && !existing.latestVersion) existing.latestVersion = item.latestVersion;
    });
    return [...byKey.values()];
  }

  function groupCatalogItems(items) {
    const groups = new Map();
    items.forEach((item) => {
      const kind = String(item?.kind || "other");
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind).push(item);
    });
    return [...groups.entries()].sort((a, b) => {
      const indexA = KIND_ORDER.indexOf(a[0]);
      const indexB = KIND_ORDER.indexOf(b[0]);
      return (indexA < 0 ? 99 : indexA) - (indexB < 0 ? 99 : indexB);
    });
  }

  function createKindHeading(kind, count) {
    const head = document.createElement("div");
    head.className = "dlc-kind-head";
    head.innerHTML = `<strong>${escapeHtml(KIND_LABELS[kind] || kind)}</strong><span>${Number(count) || 0}</span>`;
    return head;
  }

  async function pollReloadStatus(onUpdate) {
    const service = window.TarotDataService;
    for (let attempt = 0; attempt < 240; attempt += 1) {
      let status = null;
      try {
        status = await service.requestJson("GET", service.buildApiUrl("/api/v1/admin/dlc/reload-status"));
      } catch (_error) {
        break;
      }
      if (!status) break;
      if (status.state === "done") {
        document.dispatchEvent(new CustomEvent("content:updated"));
        onUpdate?.("Storage refreshed — changes are live. No server restart needed.");
        return;
      }
      if (status.state === "error") {
        onUpdate?.(`Storage refresh failed. ${status.message || ""}`, true);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    onUpdate?.("Storage refresh is still running. Changes will appear shortly.");
  }

  function renderAvailable(listEl, availableItems, isAdminUser) {
    listEl.innerHTML = "";
    if (!availableItems.length) {
      const empty = document.createElement("span");
      empty.className = "settings-field-hint";
      empty.textContent = "Nothing new in the DLC catalog — everything is installed or staged.";
      listEl.appendChild(empty);
      return;
    }
    groupCatalogItems(mergeCatalogItems(availableItems)).forEach(([kind, items]) => {
      listEl.appendChild(createKindHeading(kind, items.length));
      items.forEach((item) => {
        listEl.appendChild(createPluginCard({
          title: item.title,
          description: item.description,
          version: item.version,
          badge: kind === "pack" ? "curated pack" : "",
          actionLabel: kind === "pack" ? "" : (isAdminUser ? "Install" : "Admin key required"),
          onAction: kind === "pack" ? null : async (button) => {
            if (!isAdminUser) return;
            button.disabled = true;
            setStatus(`Installing ${item.title || item.name}…`);
            try {
              const result = await window.TarotDataService.requestJson(
                "POST",
                window.TarotDataService.buildApiUrl("/api/v1/dlc/install"),
                { kind: item.kind, name: item.name, sourceId: item.sourceId || "" }
              );
            const staged = result?.staged === true;
            setStatus(staged
              ? `Staged ${item.name}. Refreshing storage…`
              : `Installed ${item.name}.`);
            await refreshShop();
            if (!staged) {
              await window.TaroTimePluginHost?.refresh?.();
            } else {
              void pollReloadStatus((text, isError) => setStatus(text, isError));
            }
            } catch (error) {
              setStatus(`Could not install ${item.name}. ${error?.message || ""}`, true);
            } finally {
              button.disabled = false;
            }
          }
        }));
      });
    });
  }

  async function refreshShop() {
    const { installedEl, availableEl } = getElements();
    if (!installedEl || !availableEl) {
      return;
    }
    try {
      const service = window.TarotDataService;
      const [catalog, installedPayload] = await Promise.all([
        service.requestJson("GET", service.buildApiUrl("/api/v1/dlc/catalog")),
        service.requestJson("GET", service.buildApiUrl("/api/v1/plugins"))
      ]);
      const allItems = Array.isArray(catalog?.items) ? catalog.items : [];
      const availableItems = allItems.filter((item) => item?.status === "available");
      const installedPlugins = Array.isArray(installedPayload?.plugins) ? installedPayload.plugins : [];
      renderInstalled(installedEl, installedPlugins);
      renderAvailable(availableEl, availableItems, isAdmin());
      setStatus(`Catalog source: ${catalog?.origin || "none"} · ${availableItems.length} item(s) available`);
    } catch (error) {
      setStatus(`Could not load the DLC shop. ${error?.message || "Please try again."}`, true);
    }
  }

  function init() {
    const { reloadBtn } = getElements();
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        setStatus("Reloading plugins…");
        void window.TaroTimePluginHost?.refresh?.().then(() => {
          setStatus("Plugins reloaded.");
        });
      });
    }
    const createPluginBtn = document.getElementById("dlc-create-plugin");
    if (createPluginBtn) {
      createPluginBtn.addEventListener("click", () => {
        const { installedEl } = getElements();
        openCreatePlugin(installedEl || createPluginBtn.parentElement, {
          onCreated: () => refreshShop()
        });
      });
    }
    document.addEventListener("connection:access-updated", () => {
      void refreshShop();
    });
    document.addEventListener("connection:updated", () => {
      void refreshShop();
    });
    const isConnected = window.TarotAppConfig?.getConnectionAccess?.()?.connected === true;
    if (window.TarotDataService?.isApiEnabled?.() && isConnected) {
      void refreshShop();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.TaroTimeDlcShop = {
    openMenuEditorInto(cardEl) {
      return openMenuEditor(cardEl);
    },
    openPluginSettings(cardEl, plugin) {
      return openPluginSettings(cardEl, plugin);
    },
    openCreatePlugin(hostEl, options) {
      return openCreateDlc(hostEl, options);
    },
    openCreateDlc(hostEl, options) {
      return openCreateDlc(hostEl, options);
    }
  };
})();
