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
    let configLoadError = "";
    try {
      const payload = await service.requestJson("GET", service.buildApiUrl(`/api/v1/plugins/${plugin.name}/config`));
      const loaded = payload?.config;
      if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
        config = { align: "center", playlists: [], ...loaded };
      } else {
        configLoadError = "The server returned an unexpected config shape.";
      }
    } catch (error) {
      configLoadError = `Could not load the saved playlists (${error?.message || "request failed"}).`;
    }
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
    if (configLoadError) {
      status.set(`${configLoadError} Editing will save over the stored config.`, true);
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

    const playlistHint = document.createElement("span");
    playlistHint.className = "settings-field-hint";
    settingsBody.appendChild(playlistHint);

    const newPlaylistForm = document.createElement("div");
    newPlaylistForm.className = "dlc-settings-config-row mp-new-playlist-form";
    newPlaylistForm.hidden = true;
    const newPlaylistInput = document.createElement("input");
    newPlaylistInput.type = "text";
    newPlaylistInput.className = "dlc-create-name";
    newPlaylistInput.placeholder = "New playlist name";
    newPlaylistInput.maxLength = 60;
    const newPlaylistCreate = document.createElement("button");
    newPlaylistCreate.type = "button";
    newPlaylistCreate.className = "dlc-shop-btn";
    newPlaylistCreate.textContent = "Create";
    const newPlaylistCancel = document.createElement("button");
    newPlaylistCancel.type = "button";
    newPlaylistCancel.className = "dlc-shop-btn";
    newPlaylistCancel.textContent = "Cancel";
    newPlaylistForm.append(newPlaylistInput, newPlaylistCreate, newPlaylistCancel);
    settingsBody.appendChild(newPlaylistForm);

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
      const playlists = Array.isArray(config.playlists) ? config.playlists : [];
      if (!playlists.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "— no playlists yet —";
        option.selected = true;
        playlistSelect.appendChild(option);
        currentPlaylistId = "";
        deletePlaylistBtn.disabled = true;
        playlistHint.textContent = adminMode
          ? "No playlists yet. Click ＋ New Playlist to create one."
          : "No playlists have been created yet.";
        return;
      }
      playlists.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = entry.name || entry.id;
        playlistSelect.appendChild(option);
      });
      if (!currentPlaylist()) currentPlaylistId = playlists[0].id;
      playlistSelect.value = currentPlaylistId;
      deletePlaylistBtn.disabled = !adminMode || !currentPlaylist();
      playlistHint.textContent = "";
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

    newPlaylistBtn.addEventListener("click", () => {
      if (!adminMode) return;
      newPlaylistForm.hidden = false;
      newPlaylistInput.value = "";
      newPlaylistInput.focus();
      status.set("");
    });

    newPlaylistCancel.addEventListener("click", () => {
      newPlaylistForm.hidden = true;
      newPlaylistInput.value = "";
    });

    newPlaylistInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        newPlaylistCreate.click();
      } else if (event.key === "Escape") {
        event.preventDefault();
        newPlaylistCancel.click();
      }
    });

    newPlaylistCreate.addEventListener("click", async () => {
      const name = String(newPlaylistInput.value || "").trim();
      if (!name) {
        status.set("Type a playlist name first.", true);
        newPlaylistInput.focus();
        return;
      }
      let id = slugPlaylist(name);
      const used = new Set((config.playlists || []).map((entry) => entry.id));
      let suffix = 2;
      while (used.has(id)) id = `${slugPlaylist(name)}-${suffix++}`;
      const next = { ...config, playlists: [...(config.playlists || []), { id, name, tracks: [] }] };
      newPlaylistCreate.disabled = true;
      try {
        await saveConfig(next, `Playlist '${name}' created.`);
        currentPlaylistId = id;
        refreshPlaylistSelect();
        renderLibraryList();
        newPlaylistForm.hidden = true;
        newPlaylistInput.value = "";
      } catch (error) {
        status.set(`Could not create playlist. ${error?.message || ""}`, true);
      } finally {
        newPlaylistCreate.disabled = false;
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
          status.set("Create a playlist first (use ＋ New Playlist).", true);
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

  async function renderDemoUsersSettings(settingsEl, plugin) {
    const status = createSettingsStatus(settingsEl);
    const service = window.TarotDataService;
    const adminMode = isAdmin();
    const body = document.createElement("div");
    body.className = "dlc-plugin-settings-body";
    settingsEl.appendChild(body);

    const hint = document.createElement("span");
    hint.className = "settings-field-hint";
    hint.textContent = adminMode
      ? "Control the demo gate and the defaults applied to new demo accounts."
      : "Read-only. An admin key is required to change demo settings.";
    body.appendChild(hint);

    const activeLabel = document.createElement("label");
    activeLabel.className = "dlc-menu-hide-label";
    const activeInput = document.createElement("input");
    activeInput.type = "checkbox";
    activeInput.disabled = !adminMode;
    activeLabel.append(activeInput, document.createTextNode("Demo access enabled"));
    body.appendChild(activeLabel);

    const remoteLabel = document.createElement("label");
    remoteLabel.className = "dlc-menu-hide-label";
    const remoteInput = document.createElement("input");
    remoteInput.type = "checkbox";
    remoteInput.disabled = !adminMode;
    remoteLabel.append(remoteInput, document.createTextNode("Allow demo access from remote hosts"));
    body.appendChild(remoteLabel);

    const remoteWarn = document.createElement("span");
    remoteWarn.className = "settings-field-hint";
    remoteWarn.textContent = "Warning: the gate hands out a live API key. Leave this off unless the host is trusted.";
    body.appendChild(remoteWarn);

    function makeField(labelText, fieldName, attributes = {}) {
      const label = document.createElement("label");
      label.className = "settings-field";
      label.appendChild(document.createTextNode(labelText));
      const input = document.createElement("input");
      Object.keys(attributes).forEach((key) => {
        input.setAttribute(key, String(attributes[key]));
      });
      input.dataset.field = fieldName;
      input.readOnly = !adminMode;
      label.appendChild(input);
      return label;
    }

    const rowOne = document.createElement("div");
    rowOne.className = "dlc-settings-config-row";
    rowOne.append(
      makeField("Demo access level", "demoAccessLevel", { type: "text", placeholder: "premium" }),
      makeField("Trial access level", "trialAccessLevel", { type: "text", placeholder: "premium" })
    );
    body.appendChild(rowOne);

    const rowTwo = document.createElement("div");
    rowTwo.className = "dlc-settings-config-row";
    rowTwo.append(
      makeField("Default trial (days)", "defaultTrialDays", { type: "number", min: "0", max: "3650", step: "1", placeholder: "14" }),
      makeField("Gate demo account id (optional)", "gateAccountId", { type: "text", placeholder: "First active demo" })
    );
    body.appendChild(rowTwo);

    const rowThree = document.createElement("div");
    rowThree.className = "dlc-settings-config-row";
    rowThree.append(
      makeField("Max demo accounts", "maxDemoAccounts", { type: "number", min: "0", max: "1000", step: "1", placeholder: "0 = unlimited" }),
      makeField("Max trial accounts", "maxTrialAccounts", { type: "number", min: "0", max: "1000", step: "1", placeholder: "0 = unlimited" })
    );
    body.appendChild(rowThree);

    const levelHint = document.createElement("span");
    levelHint.className = "settings-field-hint";
    levelHint.textContent = "Access level names come from the API access policy (for example basic, premium, pro+). New trials default to the default trial length.";
    body.appendChild(levelHint);

    const actions = document.createElement("div");
    actions.className = "dlc-shop-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "dlc-shop-btn";
    saveBtn.textContent = adminMode ? "Save Settings" : "Admin key required to edit";
    saveBtn.disabled = !adminMode;
    actions.appendChild(saveBtn);
    body.appendChild(actions);

    const field = (name) => body.querySelector(`[data-field='${name}']`);

    try {
      const payload = await service.requestJson(
        "GET",
        service.buildApiUrl(`/api/v1/plugins/${plugin.name}/server/admin/settings`)
      );
      const settings = payload?.settings && typeof payload.settings === "object" ? payload.settings : {};
      activeInput.checked = settings.enabled !== false;
      remoteInput.checked = settings.allowRemote === true;
      field("demoAccessLevel").value = String(settings.demoAccessLevel || "premium");
      field("trialAccessLevel").value = String(settings.trialAccessLevel || settings.demoAccessLevel || "premium");
      field("defaultTrialDays").value = String(settings.defaultTrialDays ?? 14);
      field("maxDemoAccounts").value = String(settings.maxDemoAccounts ?? 0);
      field("maxTrialAccounts").value = String(settings.maxTrialAccounts ?? 0);
      field("gateAccountId").value = String(settings.gateAccountId || "");
    } catch (error) {
      status.set(`Could not load settings. ${error?.message || ""}`.trim(), true);
    }

    saveBtn.addEventListener("click", async () => {
      if (!isAdmin()) {
        status.set("Admin key required to save demo settings.", true);
        return;
      }
      saveBtn.disabled = true;
      try {
        await service.requestJson(
          "POST",
          service.buildApiUrl(`/api/v1/plugins/${plugin.name}/server/admin/settings`),
          {
            settings: {
              enabled: activeInput.checked,
              allowRemote: remoteInput.checked,
              demoAccessLevel: String(field("demoAccessLevel").value || "").trim() || "premium",
              trialAccessLevel: String(field("trialAccessLevel").value || "").trim() || "premium",
              defaultTrialDays: Number(field("defaultTrialDays").value) || 0,
              maxDemoAccounts: Number(field("maxDemoAccounts").value) || 0,
              maxTrialAccounts: Number(field("maxTrialAccounts").value) || 0,
              gateAccountId: String(field("gateAccountId").value || "").trim()
            }
          }
        );
        status.set("Saved.");
      } catch (error) {
        status.set(`Could not save. ${error?.message || ""}`.trim(), true);
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

  function renderLayoutPhoneSettings(settingsEl) {
    const status = createSettingsStatus(settingsEl);
    const body = document.createElement("div");
    body.className = "dlc-plugin-settings-body";
    settingsEl.appendChild(body);

    const hint = document.createElement("span");
    hint.className = "settings-field-hint";
    hint.textContent = "These options are saved on this device. They apply as soon as you change them.";
    body.appendChild(hint);

    const OPTIONS_KEY = "kabbak-phone-options";
    const AUTO_KEY = "kabbak-phone-auto-browser";
    const defaults = { browse: "drill", density: "comfortable", barLabels: true };

    function readPhoneOptions() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(OPTIONS_KEY) || "{}");
        return { ...defaults, ...(parsed && typeof parsed === "object" ? parsed : {}) };
      } catch (_error) {
        return { ...defaults };
      }
    }

    function writePhoneOptions(next) {
      try {
        window.localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
      } catch (_error) {}
      document.documentElement.classList.toggle("kabbak-phone-split", next.browse === "split");
      document.documentElement.classList.toggle("kabbak-phone-compact", next.density === "compact");
      document.documentElement.classList.toggle("kabbak-phone-no-barlabels", next.barLabels === false);
    }

    function autoEnabled() {
      try {
        const raw = String(window.localStorage.getItem(AUTO_KEY) || "").trim().toLowerCase();
        if (!raw) return true;
        return raw !== "0" && raw !== "false" && raw !== "off";
      } catch (_error) {
        return true;
      }
    }

    function addSelect(labelText, value, choices, onChange) {
      const label = document.createElement("label");
      label.className = "settings-field";
      label.appendChild(document.createTextNode(labelText));
      const select = document.createElement("select");
      choices.forEach(([id, text]) => {
        const option = document.createElement("option");
        option.value = String(id);
        option.textContent = text;
        if (String(id) === String(value)) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", () => onChange(select.value));
      label.appendChild(select);
      body.appendChild(label);
      return select;
    }

    const autoLabel = document.createElement("label");
    autoLabel.className = "settings-field";
    const autoBox = document.createElement("input");
    autoBox.type = "checkbox";
    autoBox.checked = autoEnabled();
    autoLabel.appendChild(autoBox);
    autoLabel.appendChild(document.createTextNode(" Use phone layout automatically in mobile browsers"));
    body.appendChild(autoLabel);
    const autoHint = document.createElement("span");
    autoHint.className = "settings-field-hint";
    autoHint.textContent = "When on, phones and small screens load Phone Layout even if this device last used the default chrome. The Android/iPhone app always uses Phone Layout.";
    body.appendChild(autoHint);

    let options = readPhoneOptions();
    addSelect("Page layout", options.browse, [["drill", "Full screen"], ["split", "Split"]], (value) => {
      options = { ...options, browse: value };
      writePhoneOptions(options);
      status.set("Saved.");
    });
    addSelect("Row size", options.density, [["comfortable", "Comfortable"], ["compact", "Compact"]], (value) => {
      options = { ...options, density: value };
      writePhoneOptions(options);
      status.set("Saved.");
    });
    addSelect("Bottom bar labels", options.barLabels, [["true", "Show"], ["false", "Hide"]], (value) => {
      options = { ...options, barLabels: value === "true" };
      writePhoneOptions(options);
      status.set("Saved.");
    });

    autoBox.addEventListener("change", () => {
      try {
        window.localStorage.setItem(AUTO_KEY, autoBox.checked ? "1" : "0");
      } catch (_error) {}
      status.set("Saved. Reload the page to apply the layout choice.");
    });
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
            : plugin?.name === "demo-users"
              ? renderDemoUsersSettings
              : plugin?.name === "layout-phone"
                ? renderLayoutPhoneSettings
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

    // Section-title filter + right-click actions for the outline. The filter
    // lives inside the outline column (kept across re-renders) so the editor
    // layout stays intact.
    if (!outlineEl.querySelector(".dlc-text-outline-search")) {
      const row = document.createElement("div");
      row.className = "dlc-text-outline-search-row";
      const input = document.createElement("input");
      input.type = "search";
      input.className = "admin-dlc-search dlc-text-outline-search";
      input.placeholder = "Filter sections…";
      input.autocomplete = "off";
      input.value = String(preview._sectionQuery || "");
      input.addEventListener("input", () => {
        preview._sectionQuery = input.value;
        renderOutline();
      });
      row.appendChild(input);
      outlineEl.insertBefore(row, outlineEl.firstChild);
    }

    let outlineMenu = form.querySelector(".dlc-text-outline-menu");
    if (!outlineMenu) {
      outlineMenu = document.createElement("div");
      outlineMenu.className = "dlc-ctx-menu dlc-text-outline-menu";
      outlineMenu.hidden = true;
      form.appendChild(outlineMenu);
    }
    const hideOutlineMenu = () => {
      outlineMenu.hidden = true;
    };
    if (!form._outlineMenuBound) {
      form._outlineMenuBound = true;
      document.addEventListener("pointerdown", (event) => {
        if (outlineMenu && !outlineMenu.hidden && !event.target.closest(".dlc-text-outline-menu")) {
          hideOutlineMenu();
        }
      }, true);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") hideOutlineMenu();
      });
    }

    const removeSection = (workIndex, sectionIndex) => {
      const work = preview.document?.works?.[workIndex];
      if (!work?.sections?.[sectionIndex]) return;
      work.sections.splice(sectionIndex, 1);
      if (!work.sections.length) {
        work.sections.push({
          id: `section-${Date.now()}`,
          number: 1,
          title: `${sectionLabel} 1`,
          verses: [{ number: 1, text: "" }]
        });
      }
      if (selected.workIndex === workIndex) {
        selected.sectionIndex = Math.max(0, Math.min(sectionIndex, work.sections.length - 1));
      }
      refreshStats();
      renderOutline();
      renderSample();
    };

    const showOutlineMenu = (event, workIndex, sectionIndex) => {
      event.preventDefault();
      selected.workIndex = workIndex;
      selected.sectionIndex = sectionIndex;
      const actions = [
        { label: "Rename section", action: () => sampleHeadEl?.focus() },
        { label: "Move up", action: () => moveSection(sectionIndex, sectionIndex - 1) },
        { label: "Move down", action: () => moveSection(sectionIndex, sectionIndex + 1) },
        { label: "Move to shelf", action: () => shelfSection(sectionIndex) },
        { label: "Delete section", action: () => removeSection(workIndex, sectionIndex) }
      ];
      outlineMenu.replaceChildren();
      actions.forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = entry.label;
        button.addEventListener("click", () => {
          hideOutlineMenu();
          entry.action();
        });
        outlineMenu.appendChild(button);
      });
      outlineMenu.hidden = false;
      outlineMenu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - 180))}px`;
      outlineMenu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - 8 - actions.length * 34))}px`;
    };

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
          work?.title || preview.title || "",
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
      const query = String(preview._sectionQuery || "").trim().toLowerCase();
      // Keep the filter row; replace only the section/work entries.
      [...outlineEl.children].forEach((child) => {
        if (!child.classList.contains("dlc-text-outline-search-row")) child.remove();
      });
      let shown = 0;
      (preview.document?.works || []).forEach((work, workIndex) => {
        const matching = (work.sections || [])
          .map((section, sectionIndex) => ({ section, sectionIndex }))
          .filter(({ section, sectionIndex }) => !query
            || String(section.title || "").toLowerCase().includes(query)
            || `${sectionLabel} ${sectionIndex + 1}`.toLowerCase().includes(query));
        if (query && !matching.length) return;
        const workHead = document.createElement("div");
        workHead.className = "dlc-text-outline-work";
        workHead.textContent = work.title || preview.title || `${workLabel} ${workIndex + 1}`;
        outlineEl.appendChild(workHead);
        matching.forEach(({ section, sectionIndex }) => {
          shown += 1;
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
          item.addEventListener("contextmenu", (event) => showOutlineMenu(event, workIndex, sectionIndex));
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
      if (query && !shown) {
        const empty = document.createElement("span");
        empty.className = "settings-field-hint";
        empty.textContent = "No sections match.";
        outlineEl.appendChild(empty);
      }
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
  // Court ranks get deck-wide name overrides (Page → Princess, Knight → Prince…).
  const COURT_RANKS = ["page", "knight", "queen", "king"];
  const PLAYING_SUITS = [
    { id: "spades", label: "Spades", aliases: ["spade", "spades", "pique"] },
    { id: "hearts", label: "Hearts", aliases: ["heart", "hearts", "coeur"] },
    { id: "diamonds", label: "Diamonds", aliases: ["diamond", "diamonds", "carreau"] },
    { id: "clubs", label: "Clovers", aliases: ["club", "clubs", "clover", "clovers", "trefle"] }
  ];
  const PLAYING_RANKS = [
    { id: "ace", label: "Ace", aliases: ["ace", "a", "1"] },
    { id: "two", label: "Two", aliases: ["two", "2"] },
    { id: "three", label: "Three", aliases: ["three", "3"] },
    { id: "four", label: "Four", aliases: ["four", "4"] },
    { id: "five", label: "Five", aliases: ["five", "5"] },
    { id: "six", label: "Six", aliases: ["six", "6"] },
    { id: "seven", label: "Seven", aliases: ["seven", "7"] },
    { id: "eight", label: "Eight", aliases: ["eight", "8"] },
    { id: "nine", label: "Nine", aliases: ["nine", "9"] },
    { id: "ten", label: "Ten", aliases: ["ten", "10"] },
    { id: "jack", label: "Jack", aliases: ["jack", "j", "knave"] },
    { id: "queen", label: "Queen", aliases: ["queen", "q"] },
    { id: "king", label: "King", aliases: ["king", "k"] }
  ];

  const ICHING_HEXAGRAM_COUNT = 64;
  let ichingHexagramNames = null;
  let ichingHexagramData = null;

  // Hexagram names/lines come from the reference data; the manifest stores them
  // too so the deck is self-contained.
  async function ensureIChingNames() {
    if (ichingHexagramNames && ichingHexagramData) return ichingHexagramNames;
    ichingHexagramNames = {};
    ichingHexagramData = {};
    try {
      const payload = await window.TarotDataService.requestJson(
        "GET",
        window.TarotDataService.buildApiUrl("/api/v1/iching")
      );
      (Array.isArray(payload?.hexagrams) ? payload.hexagrams : []).forEach((hexagram) => {
        const number = Number(hexagram?.number);
        if (number < 1 || number > ICHING_HEXAGRAM_COUNT) return;
        const name = String(hexagram?.name || `Hexagram ${number}`).trim();
        ichingHexagramNames[number] = name;
        ichingHexagramData[number] = {
          number,
          name,
          chineseName: String(hexagram?.chineseName || "").trim(),
          lineDiagram: String(hexagram?.lineDiagram || "").trim(),
          binary: String(hexagram?.binary || "").trim()
        };
      });
    } catch (_error) {
      // Fall back to generic names.
    }
    return ichingHexagramNames;
  }

  // Six lines drawn top-to-bottom: solid = yang, broken = yin. `binary` is
  // stored top-down, but `lineDiagram` is bottom-up, so reverse those.
  function renderHexagramLines(pattern) {
    const wrap = document.createElement("div");
    wrap.className = "tt-hexagram";
    let raw = String(pattern || "").trim();
    if (/^[|:]+$/.test(raw)) {
      raw = raw.split("").reverse().join("");
    }
    const chars = raw.replace(/\|/g, "1").replace(/:/g, "0").replace(/[^01]/g, "").split("").slice(0, 6);
    if (!chars.length) {
      wrap.hidden = true;
      return wrap;
    }
    chars.forEach((char) => {
      const line = document.createElement("span");
      line.className = `tt-hex-line ${char === "1" ? "is-yang" : "is-yin"}`;
      wrap.appendChild(line);
    });
    return wrap;
  }

  function iChingSlotList(names = ichingHexagramNames || {}) {
    const slots = [];
    for (let number = 1; number <= ICHING_HEXAGRAM_COUNT; number += 1) {
      slots.push({
        key: `hex-${number}`,
        group: "Hexagrams",
        label: `${String(number).padStart(2, "0")} · ${names[number] || `Hexagram ${number}`}`,
        file: `${String(number - 1).padStart(2, "0")}.png`
      });
    }
    slots.push({ key: "back", group: "Back", label: "Card back", file: "back.png" });
    slots.push({ key: "misc", group: "Misc", label: "Misc/Extra", file: "misc.png" });
    return slots;
  }

  function playingCardSlotList() {
    const slots = [];
    PLAYING_SUITS.forEach((suit, suitIndex) => {
      PLAYING_RANKS.forEach((rank, rankIndex) => {
        const number = (suitIndex * 13) + rankIndex;
        slots.push({
          key: `pc-${suit.id}-${rank.id}`,
          group: suit.id.charAt(0).toUpperCase() + suit.id.slice(1),
          label: `${rank.label} of ${suit.label}`,
          file: `${String(number).padStart(2, "0")}.png`
        });
      });
    });
    slots.push({ key: "joker-1", group: "Jokers", label: "Joker 1", file: "joker-1.png" });
    slots.push({ key: "joker-2", group: "Jokers", label: "Joker 2", file: "joker-2.png" });
    slots.push({ key: "back", group: "Back", label: "Card back", file: "back.png" });
    slots.push({ key: "misc", group: "Misc", label: "Misc/Extra", file: "misc.png" });
    return slots;
  }

  function deckSlotList(system = "tarot") {
    if (system === "iching") {
      return iChingSlotList();
    }
    if (system === "playing-cards") {
      return playingCardSlotList();
    }
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
    slots.push({ key: "back", group: "Back", label: "Card back", file: "back.png" });
    slots.push({ key: "misc", group: "Misc", label: "Misc/Extra", file: "misc.png" });
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
    patterns.playingSuits = {};
    ranked.filter((group) => group.count >= 12 && group.count <= 14)
      .sort((left, right) => left.prefix.localeCompare(right.prefix, undefined, { sensitivity: "base" }))
      .forEach((group, index) => {
        const suit = PLAYING_SUITS[index];
        if (!suit) return;
        patterns.playingSuits[suit.id] = {
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

  const PLAYING_CODE_RANKS = {
    a: "ace", ace: "ace", 1: "ace",
    2: "two", 3: "three", 4: "four", 5: "five", 6: "six",
    7: "seven", 8: "eight", 9: "nine", 10: "ten",
    j: "jack", jack: "jack", knave: "jack",
    q: "queen", queen: "queen",
    k: "king", king: "king"
  };
  const PLAYING_CODE_SUITS = {
    s: "spades", spade: "spades", spades: "spades",
    h: "hearts", heart: "hearts", hearts: "hearts",
    d: "diamonds", diamond: "diamonds", diamonds: "diamonds",
    c: "clubs", club: "clubs", clubs: "clubs", clover: "clubs", clovers: "clubs"
  };

  function parsePlayingCode(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = raw.match(/^(10|[2-9]|a|j|q|k|ace|jack|queen|king)(s|h|d|c|spades?|hearts?|diamonds?|clubs?|clovers?)$/);
    if (!match) return null;
    const rankId = PLAYING_CODE_RANKS[match[1]];
    const suitToken = match[2] === "s" || match[2] === "h" || match[2] === "d" || match[2] === "c"
      ? match[2]
      : match[2].replace(/s$/, "");
    const suitId = PLAYING_CODE_SUITS[match[2]] || PLAYING_CODE_SUITS[suitToken];
    return rankId && suitId ? { rankId, suitId, key: `pc-${suitId}-${rankId}` } : null;
  }

  function playingCodeFromBase(base) {
    const cleaned = String(base || "").toLowerCase();
    if (/(^|[-_])(back|cardback|card-back|verso)$/.test(cleaned)) {
      return { key: "back" };
    }
    if (/(^|[-_])(misc|extra|box|boxart|box-art|cover|art)$/.test(cleaned)) {
      return { key: "misc" };
    }
    if (/joker/.test(cleaned)) {
      const number = Number((cleaned.match(/joker[-_ ]?(\d+)/) || [])[1] || 1);
      return { key: Number.isFinite(number) && number >= 2 ? "joker-2" : "joker-1" };
    }
    const match = cleaned.match(/(?:^|[-_])(10|[2-9]|a|j|q|k)(s|h|d|c)$/);
    if (match) return parsePlayingCode(match[1] + match[2]);
    return parsePlayingCode(cleaned.replace(/^\d+[-_]?/, ""));
  }

  function guessPlayingSlot(relativePath, suitOrder, zeroBased) {
    const orderedSuits = (Array.isArray(suitOrder) ? suitOrder : [])
      .map((id) => PLAYING_SUITS.find((suit) => suit.id === id))
      .filter(Boolean);
    const suits = orderedSuits.length === 4 ? orderedSuits : PLAYING_SUITS;
    const rel = String(relativePath || "").replace(/\\/g, "/").toLowerCase();
    const base = rel.split("/").pop().replace(/\.[^.]+$/, "");
    if (/(^|\/)(back|card-back|cardback|verso)(\.|$)/.test(rel) || /^back$/i.test(base)) {
      return "back";
    }
    const coded = playingCodeFromBase(base);
    if (coded?.key) return coded.key;
    const suit = PLAYING_SUITS.find((entry) => entry.aliases.some((alias) => rel.includes(alias)));
    const rank = PLAYING_RANKS.find((entry) => entry.aliases.some((alias) => new RegExp(`(?:^|[^a-z])${alias}(?:$|[^a-z])`).test(base) || rel.includes(`/${alias}`)));
    if (suit && rank) {
      return `pc-${suit.id}-${rank.id}`;
    }
    const numMatch = base.match(/^(?:card[_-]?)?(\d{1,3})$/);
    const number = numMatch ? Number(numMatch[1]) : NaN;
    if (!Number.isInteger(number)) return "";
    const offset = zeroBased ? number : number - 1;
    if (offset < 0 || offset > 51) return "";
    const suitEntry = suits[Math.floor(offset / 13)];
    const rankEntry = PLAYING_RANKS[offset % 13];
    if (suitEntry && rankEntry) return `pc-${suitEntry.id}-${rankEntry.id}`;
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

  // Stripped-down tarot viewer: full-bleed image with a small overlay showing
  // what card the file is meant to be and its file name. Shared by the deck
  // builder and the Admin → DLC deck preview.
  let cardPeekOnKey = null;

  function closeCardPeek() {
    document.querySelector(".tt-peek")?.remove();
    if (cardPeekOnKey) {
      document.removeEventListener("keydown", cardPeekOnKey);
      cardPeekOnKey = null;
    }
  }

  function openCardPeek({ items, index = 0, context = "", onEmpty = null, onRemove = null, onRename = null, refresh = null } = {}) {
    let list = (Array.isArray(items) ? items : []).filter((entry) => entry && (entry.src || entry.empty));
    if (!list.length) return;
    closeCardPeek();
    let current = Math.max(0, Math.min(Number(index) || 0, list.length - 1));

    const overlay = document.createElement("div");
    overlay.className = "tt-peek";
    overlay.tabIndex = -1;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="tarot-lightbox-backdrop" data-role="peek-backdrop"></div>
      <div class="tt-peek-stage">
        <img data-role="peek-image" alt="">
        <div class="tt-peek-empty" data-role="peek-empty" hidden>
          <span data-role="peek-empty-text">No image mapped.</span>
          <button type="button" class="tt-lb-btn" data-action="peek-pick">Pick image</button>
        </div>
      </div>
      <div class="tt-peek-info">
        <div class="tt-peek-hexagram" data-role="peek-hexagram" hidden></div>
        <strong data-role="peek-label"></strong>
        <code data-role="peek-file"></code>
        <span data-role="peek-context"></span>
      </div>
      <div class="tt-peek-controls">
        <button type="button" class="tt-lb-btn" data-action="peek-prev">◀ Prev</button>
        <span class="tt-lb-control"><span data-role="peek-counter"></span></span>
        <button type="button" class="tt-lb-btn" data-action="peek-next">Next ▶</button>
        <button type="button" class="tt-lb-btn is-danger" data-action="peek-close">Close</button>
      </div>`;
    document.body.appendChild(overlay);

    const img = overlay.querySelector('[data-role="peek-image"]');
    const emptyEl = overlay.querySelector('[data-role="peek-empty"]');
    const emptyTextEl = overlay.querySelector('[data-role="peek-empty-text"]');
    const pickBtn = overlay.querySelector('[data-action="peek-pick"]');
    const hexagramEl = overlay.querySelector('[data-role="peek-hexagram"]');
    const labelEl = overlay.querySelector('[data-role="peek-label"]');
    const fileEl = overlay.querySelector('[data-role="peek-file"]');
    const contextEl = overlay.querySelector('[data-role="peek-context"]');
    const counterEl = overlay.querySelector('[data-role="peek-counter"]');
    const prevBtn = overlay.querySelector('[data-action="peek-prev"]');
    const nextBtn = overlay.querySelector('[data-action="peek-next"]');

    const render = () => {
      const entry = list[current];
      if (hexagramEl) {
        hexagramEl.replaceChildren();
        const hexagram = entry.hexagram;
        if (hexagram && hexagram.lineDiagram) {
          hexagramEl.appendChild(renderHexagramLines(hexagram.lineDiagram));
          if (hexagram.chineseName) {
            const chinese = document.createElement("span");
            chinese.className = "tt-peek-hex-name";
            chinese.textContent = hexagram.chineseName;
            hexagramEl.appendChild(chinese);
          }
          hexagramEl.hidden = false;
        } else {
          hexagramEl.hidden = true;
        }
      }
      labelEl.textContent = entry.label || "Card";
      fileEl.textContent = entry.file || "";
      contextEl.textContent = context || "";
      counterEl.textContent = `${current + 1} / ${list.length}`;
      if (entry.src) {
        img.hidden = false;
        emptyEl.hidden = true;
        img.src = entry.src;
        img.alt = entry.label || entry.file || "Card";
      } else {
        img.hidden = true;
        img.removeAttribute("src");
        emptyEl.hidden = false;
        emptyTextEl.textContent = `${entry.label || "This slot"} has no image mapped.`;
        pickBtn.hidden = typeof onEmpty !== "function";
      }
      const single = list.length <= 1;
      prevBtn.disabled = single;
      nextBtn.disabled = single;
    };
    const step = (delta) => {
      if (list.length <= 1) return;
      current = (current + delta + list.length) % list.length;
      render();
    };

    const doRefresh = async () => {
      if (typeof refresh !== "function") return;
      const next = await refresh();
      if (Array.isArray(next) && next.length) {
        const key = list[current]?.key;
        list = next;
        const found = key ? list.findIndex((entry) => entry.key === key) : -1;
        current = found >= 0 ? found : Math.max(0, Math.min(current, list.length - 1));
        render();
      }
    };

    pickBtn.addEventListener("click", async () => {
      if (typeof onEmpty !== "function") return;
      pickBtn.disabled = true;
      try {
        await onEmpty(list[current]);
        await doRefresh();
      } finally {
        pickBtn.disabled = false;
      }
    });

    // Small right-click menu: remove on a mapped slot, add on an empty one.
    const menu = document.createElement("div");
    menu.className = "dlc-ctx-menu tt-peek-menu";
    menu.hidden = true;
    overlay.appendChild(menu);
    const hideMenu = () => {
      menu.hidden = true;
    };
    overlay.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const entry = list[current];
      const actions = [];
      if (typeof onRename === "function") {
        actions.push({
          label: "Rename card…",
          action: async () => {
            await onRename(entry);
            await doRefresh();
          }
        });
      }
      if (entry?.src && typeof onRemove === "function") {
        actions.push({
          label: "Remove image",
          action: async () => {
            await onRemove(entry);
            await doRefresh();
          }
        });
      } else if (!entry?.src && typeof onEmpty === "function") {
        actions.push({
          label: "Add image",
          action: async () => {
            await onEmpty(entry);
            await doRefresh();
          }
        });
      }
      if (!actions.length) return;
      menu.replaceChildren();
      actions.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.label;
        button.addEventListener("click", () => {
          hideMenu();
          void item.action();
        });
        menu.appendChild(button);
      });
      menu.hidden = false;
      menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - 180))}px`;
      menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - 8 - actions.length * 36))}px`;
    });
    overlay.addEventListener("click", hideMenu);

    prevBtn.addEventListener("click", () => step(-1));
    nextBtn.addEventListener("click", () => step(1));
    overlay.querySelector('[data-action="peek-close"]').addEventListener("click", closeCardPeek);
    overlay.querySelector('[data-role="peek-backdrop"]').addEventListener("click", closeCardPeek);
    cardPeekOnKey = (event) => {
      if (event.key === "Escape") closeCardPeek();
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", cardPeekOnKey);

    overlay.focus({ preventScroll: true });
    render();
  }

  window.TaroDlcCardPeek = { open: openCardPeek, close: closeCardPeek };

  function openCreateDlc(hostEl, { onCreated, editItem, mergeDraft, mergeContext } = {}) {
    if (!isAdmin()) {
      setStatus("Admin key required to create DLC.", true);
      return;
    }
    const editing = editItem && typeof editItem === "object";
    document.querySelector(".dlc-create-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "dlc-settings-overlay dlc-create-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="dlc-settings-overlay-panel">
        <div class="dlc-settings-overlay-head">
          <strong>${editing ? `Edit ${editItem.title || editItem.name}` : "Create DLC"}</strong>
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
                <label class="settings-field">Short title
                  <input type="text" class="dlc-create-text-short-title" maxlength="80" placeholder="optional">
                </label>
                <label class="settings-field">Script
                  <input type="text" class="dlc-create-text-script" maxlength="60" value="Latin">
                </label>
                <label class="settings-field">Work label
                  <input type="text" class="dlc-create-text-work-label" maxlength="40" placeholder="Text">
                </label>
                <label class="settings-field">Section label
                  <input type="text" class="dlc-create-text-section-label" maxlength="40" placeholder="Section">
                </label>
                <label class="settings-field">Passage label
                  <input type="text" class="dlc-create-text-verse-label" maxlength="40" placeholder="Passage">
                </label>
                <div class="dlc-shop-actions">
                  <button type="button" class="dlc-shop-btn" data-action="change-source">Change source</button>
                </div>
              </div>
            </div>
          </div>
          <div data-role="kind-deck" hidden>
            <div data-role="deck-source">
              <div class="dlc-shop-actions dlc-deck-system">
                <span class="settings-field-hint">Deck system</span>
                <button type="button" class="dlc-shop-btn is-active" data-deck-mode="tarot">Tarot (78 + back)</button>
                <button type="button" class="dlc-shop-btn" data-deck-mode="iching">I Ching (64 + back)</button>
                <button type="button" class="dlc-shop-btn" data-deck-mode="playing-cards">Playing cards (52 + back)</button>
              </div>
              <div class="settings-field">Deck folder
                <label class="dlc-shop-btn dlc-file-btn dlc-dir-label" data-role="deck-folder-label">Choose folder
                  <input type="file" class="dlc-create-deck-folder dlc-dir-input" webkitdirectory multiple>
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
              <div class="dlc-deck-suit-order" data-role="playing-suit-order" hidden>
                <strong>File order</strong>
                <label>00–12 <select data-playing-suit-block="0"></select></label>
                <label>13–25 <select data-playing-suit-block="1"></select></label>
                <label>26–38 <select data-playing-suit-block="2"></select></label>
                <label>39–51 <select data-playing-suit-block="3"></select></label>
              </div>
              <div class="dlc-deck-pattern-groups">
                <section class="dlc-deck-pattern-card" data-role="deck-majors-section">
                  <h3 data-role="deck-majors-heading">Trumps</h3>
                  <div class="dlc-deck-pattern-row" data-role="deck-majors-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-majors" placeholder="a##">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-majors" value="0" min="0" max="64">
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
                <section class="dlc-deck-pattern-card" data-role="playing-suit-section" hidden>
                  <h3 data-role="playing-head-spades">Spades</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-spades" placeholder="##-as">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-spades" value="1" min="0" max="13">
                    </label>
                    <label class="settings-field">Shown as
                      <input type="text" class="dlc-deck-alias-spades" placeholder="Spades">
                    </label>
                  </div>
                  <div class="dlc-deck-grid" data-role="deck-grid-spades"></div>
                </section>
                <section class="dlc-deck-pattern-card" data-role="playing-suit-section" hidden>
                  <h3 data-role="playing-head-hearts">Hearts</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-hearts" placeholder="##-ah">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-hearts" value="1" min="0" max="13">
                    </label>
                    <label class="settings-field">Shown as
                      <input type="text" class="dlc-deck-alias-hearts" placeholder="Hearts">
                    </label>
                  </div>
                  <div class="dlc-deck-grid" data-role="deck-grid-hearts"></div>
                </section>
                <section class="dlc-deck-pattern-card" data-role="playing-suit-section" hidden>
                  <h3 data-role="playing-head-diamonds">Diamonds</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-diamonds" placeholder="##-ad">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-diamonds" value="1" min="0" max="13">
                    </label>
                    <label class="settings-field">Shown as
                      <input type="text" class="dlc-deck-alias-diamonds" placeholder="Diamonds">
                    </label>
                  </div>
                  <div class="dlc-deck-grid" data-role="deck-grid-diamonds"></div>
                </section>
                <section class="dlc-deck-pattern-card" data-role="playing-suit-section" hidden>
                  <h3 data-role="playing-head-clubs">Clovers</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Pattern
                      <input type="text" class="dlc-deck-pat-clubs" placeholder="##-ac">
                    </label>
                    <label class="settings-field">Start
                      <input type="number" class="dlc-deck-start-clubs" value="1" min="0" max="13">
                    </label>
                    <label class="settings-field">Shown as
                      <input type="text" class="dlc-deck-alias-clubs" placeholder="Clovers">
                    </label>
                  </div>
                  <div class="dlc-deck-grid" data-role="deck-grid-clubs"></div>
                </section>
                <section class="dlc-deck-pattern-card" data-role="deck-court-section">
                  <h3>Court names</h3>
                  <div class="dlc-deck-pattern-row">
                    <label class="settings-field">Page
                      <input type="text" class="dlc-deck-court-page" placeholder="Princess">
                    </label>
                    <label class="settings-field">Knight
                      <input type="text" class="dlc-deck-court-knight" placeholder="Prince">
                    </label>
                    <label class="settings-field">Queen
                      <input type="text" class="dlc-deck-court-queen" placeholder="Queen">
                    </label>
                    <label class="settings-field">King
                      <input type="text" class="dlc-deck-court-king" placeholder="King">
                    </label>
                  </div>
                  <p class="settings-field-hint">Shown as applies to every suit (e.g. Page → Princess, Knight → Prince).</p>
                </section>
                <section class="dlc-deck-pattern-card" data-role="playing-suit-section" hidden>
                  <h3>Jokers</h3>
                  <div class="dlc-deck-grid" data-role="deck-grid-jokers"></div>
                  <p class="settings-field-hint">Two Joker faces; in the app they switch as variants 1 / 2 on one Joker card.</p>
                </section>
                <section class="dlc-deck-pattern-card dlc-deck-pattern-card-back">
                  <h3>Card back</h3>
                  <div class="dlc-deck-grid" data-role="deck-grid-back"></div>
                  <p class="settings-field-hint">The face-down card back.</p>
                </section>
                <section class="dlc-deck-pattern-card dlc-deck-pattern-card-back">
                  <h3>Misc/Extra</h3>
                  <div class="dlc-deck-grid" data-role="deck-grid-misc"></div>
                  <p class="settings-field-hint">Box art or any extra scan shipped with the deck.</p>
                </section>
              </div>
              <details class="dlc-deck-loose" data-role="deck-loose" hidden>
                <summary>Unmapped images</summary>
                <div class="dlc-deck-loose-list" data-role="deck-loose-list"></div>
              </details>
              <div class="dlc-shop-actions">
                <button type="button" class="dlc-shop-btn" data-action="change-deck-source">Change folder</button>
                <label class="dlc-shop-btn dlc-file-btn">Upload image
                  <input type="file" class="dlc-create-deck-upload" accept="image/*" multiple hidden>
                </label>
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
            listOrder: getRefListKeys(),
            ...(editing ? { overwrite: true, renameFrom: editItem.name } : {})
          }
        );
        setFormStatus(`${editing ? "Updated" : "Saved"} '${result?.reference?.title || result?.reference?.id}'. Install or Publish it from Admin → DLC when ready.`);
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
      const merging = Boolean(mergeContext && Array.isArray(mergeContext.sourceNames) && mergeContext.sourceNames.length);
      button.disabled = true;
      setFormStatus(merging ? "Merging texts…" : "Saving DLC text…");
      try {
        const result = await window.TarotDataService.requestJson(
          "POST",
          window.TarotDataService.buildApiUrl(merging ? "/api/v1/admin/dlc/texts/merge" : "/api/v1/dlc/texts"),
          {
            id: String(overlay.querySelector(".dlc-create-text-id")?.value || previewState.id || "").trim(),
            title: String(overlay.querySelector(".dlc-create-text-title")?.value || previewState.title || "").trim(),
            description: String(overlay.querySelector(".dlc-create-text-description")?.value || "").trim(),
            language: String(overlay.querySelector(".dlc-create-text-language")?.value || "English").trim(),
            tradition: String(overlay.querySelector(".dlc-create-text-tradition")?.value || "").trim(),
            shortTitle: String(overlay.querySelector(".dlc-create-text-short-title")?.value || "").trim(),
            script: String(overlay.querySelector(".dlc-create-text-script")?.value || "Latin").trim(),
            workLabel: String(overlay.querySelector(".dlc-create-text-work-label")?.value || "").trim(),
            sectionLabel: String(overlay.querySelector(".dlc-create-text-section-label")?.value || "").trim(),
            verseLabel: String(overlay.querySelector(".dlc-create-text-verse-label")?.value || "").trim(),
            format: String(overlay.querySelector(".dlc-create-text-format")?.value || previewState.format || "").trim(),
            document: collectEditedDocument(overlay, previewState),
            ...(merging
              ? {
                items: mergeContext.sourceNames.map((name) => ({ name })),
                removeSources: mergeContext.removeSources === true
              }
              : {
                text: sourceText,
                ...(editing ? { overwrite: true, renameFrom: editItem.name } : {})
              })
          }
        );
        setFormStatus(`${merging ? "Merged" : editing ? "Updated" : "Saved"} '${result?.text?.title || result?.text?.id || result?.title || result?.name}'. Install or Publish it from Admin → DLC when ready.`);
        setStatus(`${merging ? "Merged" : editing ? "Updated" : "Created"} text '${result?.text?.id || result?.name}'.`);
        if (typeof onCreated === "function") {
          await onCreated(result?.text || result);
        }
        window.setTimeout(() => overlay.remove(), 1600);
      } catch (error) {
        setFormStatus(error?.message || "Could not save DLC text.", true);
      } finally {
        button.disabled = false;
      }
    });

    let deckSlots = deckSlotList("tarot");
    const deckState = {
      system: "tarot",
      files: [],
      scanManifest: null,
      assigned: {},
      back: "",
      pendingLoose: "",
      idManual: false,
      cardNames: {},
      suitNames: {},
      courtNames: {},
      suitOrder: DECK_SUITS.map((suit) => suit.id),
      playingSuitOrder: PLAYING_SUITS.map((suit) => suit.id)
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
    overlay.querySelectorAll("[data-playing-suit-block]").forEach((select) => {
      PLAYING_SUITS.forEach((suit) => {
        const option = document.createElement("option");
        option.value = suit.id;
        option.textContent = suit.label;
        select.appendChild(option);
      });
      select.value = deckState.playingSuitOrder[Number(select.getAttribute("data-playing-suit-block"))] || PLAYING_SUITS[0].id;
    });

    const revokeFaceUrls = () => {
      deckState.files.forEach((entry) => {
        if (entry.url) URL.revokeObjectURL(entry.url);
      });
    };
    const revokeDeckUrls = () => {
      revokeFaceUrls();
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
      return DECK_SUITS.find((suit) => suit.id === suitId)?.label
        || PLAYING_SUITS.find((suit) => suit.id === suitId)?.label
        || suitId;
    };

    const playingRankLabel = (rankId) => PLAYING_RANKS.find((entry) => entry.id === rankId)?.label || rankId;

    const courtLabel = (rankId) => {
      const custom = String(deckState.courtNames[rankId] || overlay.querySelector(`.dlc-deck-court-${rankId}`)?.value || "").trim();
      if (custom) return custom;
      return DECK_RANKS.find((entry) => entry.id === rankId)?.label || rankId;
    };

    // The default card name without the slot number prefix (renaming should not
    // require typing "01 · The Magician").
    const slotDefaultName = (slot) => {
      if (String(slot.key).startsWith("major-")) {
        const trump = Number(String(slot.key).slice(6));
        return DECK_MAJORS[trump] || slot.label;
      }
      if (String(slot.key).startsWith("hex-")) {
        const number = Number(String(slot.key).slice(4));
        return (ichingHexagramNames && ichingHexagramNames[number]) || `Hexagram ${number}`;
      }
      if (String(slot.key).startsWith("minor-")) {
        const parts = String(slot.key).split("-");
        const suitId = parts[1];
        const rankId = parts.slice(2).join("-");
        const rank = COURT_RANKS.includes(rankId) ? courtLabel(rankId) : (DECK_RANKS.find((entry) => entry.id === rankId)?.label || rankId);
        return `${rank} of ${suitLabel(suitId)}`;
      }
      if (String(slot.key).startsWith("pc-")) {
        const parts = String(slot.key).split("-");
        const suitId = parts[1];
        const rankId = parts.slice(2).join("-");
        return `${playingRankLabel(rankId)} of ${suitLabel(suitId)}`;
      }
      if (String(slot.key).startsWith("joker-")) {
        return String(slot.key) === "joker-2" ? "Joker 2" : "Joker 1";
      }
      if (String(slot.key) === "misc") {
        return "Misc/Extra";
      }
      return slot.label;
    };

    const slotDisplayLabel = (slot) => {
      const custom = String(deckState.cardNames[slot.key] || "").trim();
      if (custom) return custom;
      // Majors/hexagrams keep their numbered caption ("01 · …") in the grid.
      if (String(slot.key).startsWith("major-") || String(slot.key).startsWith("hex-")) return slot.label;
      return slotDefaultName(slot);
    };

    const openDeckPreview = (url, label, filePath) => {
      if (!url) return;
      const relative = String(filePath || "").replace(/\\/g, "/");
      window.TaroDlcCardPeek?.open({
        items: [{ src: url, label: label || "Card", file: relative }],
        context: deckState.title || ""
      });
    };

    // Full-deck peek across every slot; empty slots offer a pick action.
    const buildDeckPeekItems = () => {
      const filesByPath = new Map(deckState.files.map((entry) => [entry.path, entry]));
      return deckSlots.map((slot) => {
        const assignedPath = deckState.assigned[slot.key];
        const entry = assignedPath ? filesByPath.get(assignedPath) : null;
        const hexMatch = String(slot.key).match(/^hex-(\d+)$/);
        const hexagram = hexMatch && ichingHexagramData ? ichingHexagramData[Number(hexMatch[1])] : null;
        return {
          key: slot.key,
          label: slotDisplayLabel(slot),
          file: assignedPath || "",
          src: entry?.url || "",
          empty: !entry,
          hexagram: hexagram || null
        };
      });
    };

    const openDeckPeekAt = (slotKey) => {
      const items = buildDeckPeekItems();
      const index = Math.max(0, items.findIndex((entry) => entry.key === slotKey));
      window.TaroDlcCardPeek?.open({
        items,
        index,
        context: deckState.title || "",
        onEmpty: async (entry) => {
          const slot = deckSlots.find((candidate) => candidate.key === entry.key);
          if (!slot) return;
          if (deckState.pendingLoose) {
            assignLooseToSlot(slot.key, deckState.pendingLoose);
            return;
          }
          await openLoosePicker(slot);
        },
        onRemove: (entry) => {
          if (!entry?.key) return;
          delete deckState.assigned[entry.key];
          renderDeckEditor();
        },
        onRename: async (entry) => {
          const slot = deckSlots.find((candidate) => candidate.key === entry.key);
          if (!slot) return;
          const defaultName = slotDefaultName(slot);
          const current = String(deckState.cardNames[slot.key] || defaultName).trim();
          await openRenamePop("Card name", current, (value) => {
            if (value && value !== defaultName) {
              deckState.cardNames[slot.key] = value;
            } else {
              delete deckState.cardNames[slot.key];
            }
            renderDeckEditor();
          });
        },
        refresh: () => buildDeckPeekItems()
      });
    };

    const openRenamePop = (title, value, onSave) => new Promise((resolve) => {
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
        resolve(save ? next : null);
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
    });

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
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideDeckMenus();
    });
    document.addEventListener("pointerdown", (event) => {
      if (ctxMenu && !ctxMenu.hidden && !event.target.closest("[data-role='deck-ctx']")) {
        hideDeckMenus();
      }
    }, true);

    const assignLooseToSlot = (slotKey, path) => {
      const previous = deckState.assigned[slotKey];
      deckState.assigned[slotKey] = path;
      deckState.pendingLoose = previous || "";
      renderDeckEditor();
    };

    const openLoosePicker = (slot) => new Promise((resolve) => {
      const used = new Set(Object.values(deckState.assigned).filter(Boolean));
      const loose = deckState.files.filter((entry) => !used.has(entry.path));
      if (!loose.length) {
        setFormStatus("No unmapped images left to place.", true);
        resolve(null);
        return;
      }
      document.querySelector(".dlc-deck-loose-picker")?.remove();
      const picker = document.createElement("div");
      picker.className = "dlc-settings-overlay dlc-deck-loose-picker";
      picker.setAttribute("role", "dialog");
      picker.setAttribute("aria-modal", "true");
      const panel = document.createElement("div");
      panel.className = "dlc-settings-overlay-panel";
      const head = document.createElement("div");
      head.className = "dlc-settings-overlay-head";
      const title = document.createElement("strong");
      title.textContent = `Place image on ${slotDisplayLabel(slot)}`;
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "dlc-shop-btn";
      closeBtn.textContent = "Close";
      head.append(title, closeBtn);
      const body = document.createElement("div");
      body.className = "dlc-settings-overlay-body";
      const hint = document.createElement("p");
      hint.className = "settings-field-hint";
      hint.textContent = "Pick an unmapped image for this card.";
      const grid = document.createElement("div");
      grid.className = "dlc-deck-loose-list";
      loose.forEach((entry) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dlc-deck-loose-item";
        const img = document.createElement("img");
        img.src = entry.url;
        img.alt = entry.path;
        const name = document.createElement("span");
        name.textContent = entry.path.replace(/\\/g, "/").split("/").pop();
        item.append(img, name);
        item.addEventListener("click", () => {
          assignLooseToSlot(slot.key, entry.path);
          finish(entry.path);
        });
        grid.appendChild(item);
      });
      body.append(hint, grid);
      panel.append(head, body);
      picker.appendChild(panel);
      const finish = (value) => {
        picker.remove();
        resolve(value ?? null);
      };
      closeBtn.addEventListener("click", () => finish(null));
      picker.addEventListener("click", (event) => {
        if (event.target === picker) finish(null);
      });
      document.body.appendChild(picker);
    });

    const renderDeckEditor = () => {
      const statsEl = overlay.querySelector("[data-role='deck-stats']");
      const looseHost = overlay.querySelector("[data-role='deck-loose']");
      const looseList = overlay.querySelector("[data-role='deck-loose-list']");
      const majorsGridEl = overlay.querySelector("[data-role='deck-grid-majors']");
      // Group lookup is normalized to lower case so a display label (Clubs vs
      // Clovers) can never misroute a suit's cards to a missing grid.
      const gridLookup = new Map();
      const registerGrid = (names, element) => {
        if (!element) return;
        names.forEach((name) => gridLookup.set(String(name).toLowerCase(), element));
      };
      registerGrid(["Majors", "Hexagrams"], majorsGridEl);
      registerGrid(["Wands"], overlay.querySelector("[data-role='deck-grid-wands']"));
      registerGrid(["Cups"], overlay.querySelector("[data-role='deck-grid-cups']"));
      registerGrid(["Swords"], overlay.querySelector("[data-role='deck-grid-swords']"));
      registerGrid(["Disks", "Pentacles"], overlay.querySelector("[data-role='deck-grid-pentacles']"));
      registerGrid(["Spades"], overlay.querySelector("[data-role='deck-grid-spades']"));
      registerGrid(["Hearts"], overlay.querySelector("[data-role='deck-grid-hearts']"));
      registerGrid(["Diamonds"], overlay.querySelector("[data-role='deck-grid-diamonds']"));
      registerGrid(["Clubs", "Clovers"], overlay.querySelector("[data-role='deck-grid-clubs']"));
      const jokersGridEl = overlay.querySelector("[data-role='deck-grid-jokers']");
      const backGridEl = overlay.querySelector("[data-role='deck-grid-back']");
      const miscGridEl = overlay.querySelector("[data-role='deck-grid-misc']");
      registerGrid(["Jokers"], jokersGridEl);
      registerGrid(["Back"], backGridEl);
      registerGrid(["Misc", "Extra"], miscGridEl);
      // Slot keys are the source of truth for the fixed extra slots, so a
      // renamed group can never leave the back/Misc or joker grids empty.
      const gridForSlot = (slot) => {
        const key = String(slot?.key || "");
        if (key.startsWith("joker-")) return jokersGridEl;
        if (key === "back") return backGridEl;
        if (key === "misc") return miscGridEl;
        return gridLookup.get(String(slot?.group || "").toLowerCase());
      };
      DECK_SUITS.forEach((suit) => {
        const head = overlay.querySelector(`[data-role="suit-head-${suit.id}"]`);
        if (head) {
          head.textContent = suitLabel(suit.id);
        }
      });
      PLAYING_SUITS.forEach((suit) => {
        const head = overlay.querySelector(`[data-role="playing-head-${suit.id}"]`);
        if (head) {
          head.textContent = suitLabel(suit.id);
        }
      });
      const assignedCount = Object.keys(deckState.assigned).filter((key) => key !== "back" && key !== "misc" && !key.startsWith("joker-") && deckState.assigned[key]).length;
      const totalLabel = deckState.system === "iching"
        ? "64 hexagrams"
        : deckState.system === "playing-cards"
          ? "52 cards"
          : "78 cards";
      if (statsEl) {
        statsEl.innerHTML = "";
        [`${assignedCount} / ${totalLabel}`, deckState.assigned.back ? "back set" : "no back", `${deckState.files.length} files`].forEach((label) => {
          const chip = document.createElement("span");
          chip.className = "dlc-text-chip";
          chip.textContent = label;
          statsEl.appendChild(chip);
        });
      }
      const fileByPath = new Map(deckState.files.map((entry) => [entry.path, entry]));
      new Set([...gridLookup.values(), jokersGridEl, backGridEl, miscGridEl].filter(Boolean)).forEach((grid) => grid.replaceChildren());
      deckSlots.forEach((slot) => {
          const gridEl = gridForSlot(slot);
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
            openDeckPeekAt(slot.key);
          });
          card.addEventListener("contextmenu", (event) => {
            const items = [
              {
                label: "Rename card…",
                action: () => {
                  const defaultName = slotDefaultName(slot);
                  return openRenamePop("Card name", String(deckState.cardNames[slot.key] || defaultName).trim(), (value) => {
                    if (value && value !== defaultName) {
                      deckState.cardNames[slot.key] = value;
                    } else {
                      delete deckState.cardNames[slot.key];
                    }
                    renderDeckEditor();
                  });
                }
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
      PLAYING_SUITS.forEach((suit) => {
        const patEl = overlay.querySelector(`.dlc-deck-pat-${suit.id}`);
        const startEl = overlay.querySelector(`.dlc-deck-start-${suit.id}`);
        if (patEl) patEl.value = patterns.playingSuits?.[suit.id]?.pattern || "";
        if (startEl) startEl.value = String(patterns.playingSuits?.[suit.id]?.start ?? 1);
      });
    };

    const applyDeckPatterns = (overwrite) => {
      const majorsPattern = String(overlay.querySelector(".dlc-deck-pat-majors")?.value || "").trim();
      const majorsStart = Number(overlay.querySelector(".dlc-deck-start-majors")?.value);
      if (deckState.system === "iching") {
        const start = Number.isInteger(majorsStart) ? majorsStart : 1;
        let hexMapped = 0;
        deckState.files.forEach((entry) => {
          const number = matchDeckPattern(deckFileBase(entry.path), majorsPattern);
          if (number == null) return;
          const hexagram = number - start + 1;
          if (hexagram < 1 || hexagram > 64) return;
          const key = `hex-${hexagram}`;
          if (overwrite || !deckState.assigned[key]) {
            deckState.assigned[key] = entry.path;
            hexMapped += 1;
          }
        });
        return hexMapped;
      }
      if (deckState.system === "playing-cards") {
        let mapped = 0;
        deckState.files.forEach((entry) => {
          const base = deckFileBase(entry.path);
          let slot = "";
          PLAYING_SUITS.some((suit) => {
            const pattern = String(overlay.querySelector(`.dlc-deck-pat-${suit.id}`)?.value || "").trim();
            const start = Number(overlay.querySelector(`.dlc-deck-start-${suit.id}`)?.value);
            const number = matchDeckPattern(base, pattern);
            if (number == null) return false;
            const rankIndex = number - (Number.isInteger(start) ? start : 1);
            const rank = PLAYING_RANKS[rankIndex];
            if (!rank) return false;
            slot = `pc-${suit.id}-${rank.id}`;
            return true;
          });
          if (slot && (overwrite || !deckState.assigned[slot])) {
            deckState.assigned[slot] = entry.path;
            mapped += 1;
          }
        });
        return mapped;
      }
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

    const remapNumberedPlaying = () => {
      const order = [0, 1, 2, 3].map((index) => (
        String(overlay.querySelector(`[data-playing-suit-block="${index}"]`)?.value || PLAYING_SUITS[index].id)
      ));
      deckState.playingSuitOrder = order;
      const zeroBased = deckState.files.some((entry) => /(^|\D)0{1,2}$/.test(deckFileBase(entry.path)));
      const numberedPaths = new Set();
      deckState.files.forEach((entry) => {
        const number = numberedFileIndex(entry.path);
        if (number >= 0 && number <= 52) numberedPaths.add(entry.path);
      });
      Object.keys(deckState.assigned).forEach((key) => {
        if (key.startsWith("pc-") && numberedPaths.has(deckState.assigned[key])) {
          delete deckState.assigned[key];
        }
      });
      deckState.files.forEach((entry) => {
        const slot = guessPlayingSlot(entry.path, order, zeroBased);
        if (slot && slot.startsWith("pc-") && numberedPaths.has(entry.path)) {
          deckState.assigned[slot] = entry.path;
        }
      });
    };

    overlay.querySelectorAll("[data-playing-suit-block]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.getAttribute("data-playing-suit-block"));
        const nextId = String(select.value || "");
        const other = deckState.playingSuitOrder.indexOf(nextId);
        if (other >= 0 && other !== index) {
          const swapped = [...deckState.playingSuitOrder];
          swapped[other] = deckState.playingSuitOrder[index];
          swapped[index] = nextId;
          deckState.playingSuitOrder = swapped;
        } else {
          deckState.playingSuitOrder[index] = nextId;
        }
        overlay.querySelectorAll("[data-playing-suit-block]").forEach((entry, block) => {
          entry.value = deckState.playingSuitOrder[block];
        });
        remapNumberedPlaying();
        renderDeckEditor();
        setFormStatus("Playing-card suit order updated for 00–51 files.");
      });
    });

    const assignPlayingFiles = () => {
      const byBase = new Map(deckState.files.map((entry) => [entry.path.split("/").pop().toLowerCase(), entry.path]));
      const cards = Array.isArray(deckState.scanManifest?.cards) ? deckState.scanManifest.cards : [];
      cards.forEach((card) => {
        const path = byBase.get(String(card.file || "").toLowerCase());
        if (!path) return;
        if (card.back === true) {
          if (!deckState.assigned.back) deckState.assigned.back = path;
          return;
        }
        const coded = parsePlayingCode(card.name)
          || playingCodeFromBase(card.name)
          || playingCodeFromBase(String(card.file || "").replace(/\.[^.]+$/, ""));
        if (coded?.key && coded.key !== "back" && !deckState.assigned[coded.key]) {
          deckState.assigned[coded.key] = path;
        }
      });
      const usesZeroBased = deckState.files.some((entry) => /(^|\D)0{1,2}$/.test(deckFileBase(entry.path)));
      deckState.files.forEach((entry) => {
        const guessed = guessPlayingSlot(entry.path, deckState.playingSuitOrder, usesZeroBased);
        if (guessed && !deckState.assigned[guessed]) deckState.assigned[guessed] = entry.path;
      });
    };

    const applyDeckEntries = (entries, scanManifest = null) => {
      revokeFaceUrls();
      deckState.scanManifest = scanManifest;
      deckState.files = entries;
      deckState.assigned = {};
      deckState.pendingLoose = "";
      deckState.cardNames = {};
      deckState.suitNames = {};
      deckState.courtNames = {};
      deckState.suitOrder = DECK_SUITS.map((suit) => suit.id);
      deckState.playingSuitOrder = PLAYING_SUITS.map((suit) => suit.id);
      overlay.querySelectorAll("[data-suit-block]").forEach((select, index) => {
        select.value = deckState.suitOrder[index];
      });
      overlay.querySelectorAll("[data-playing-suit-block]").forEach((select, index) => {
        select.value = deckState.playingSuitOrder[index];
      });
      if (deckState.system === "playing-cards") {
        assignPlayingFiles();
      }
      const usesZeroBased = deckState.files.some((entry) => /(^|\D)0{1,2}$/.test(deckFileBase(entry.path)));
      deckState.files.forEach((entry) => {
        if (deckState.system === "playing-cards") return;
        const guessed = guessDeckSlot(entry.path, deckState.suitOrder);
        if (guessed === "back") {
          if (!deckState.assigned.back) deckState.assigned.back = entry.path;
          return;
        }
        if (deckState.system === "iching") {
          const numeric = deckFileBase(entry.path).match(/^(?:hex[_-]?)?(\d{1,3})$/);
          const number = numeric ? Number(numeric[1]) : NaN;
          if (!Number.isInteger(number)) return;
          const hexagram = usesZeroBased ? number + 1 : number;
          if (hexagram >= 1 && hexagram <= 64) {
            const key = `hex-${hexagram}`;
            if (!deckState.assigned[key]) deckState.assigned[key] = entry.path;
          }
          return;
        }
        if (guessed && !deckState.assigned[guessed]) {
          deckState.assigned[guessed] = entry.path;
        }
      });
      const detected = detectDeckPatterns(deckState.files);
      fillDeckPatternFields(detected);
      DECK_SUITS.forEach((suit) => {
        const aliasEl = overlay.querySelector(`.dlc-deck-alias-${suit.id}`);
        if (aliasEl) aliasEl.value = "";
      });
      PLAYING_SUITS.forEach((suit) => {
        const aliasEl = overlay.querySelector(`.dlc-deck-alias-${suit.id}`);
        if (aliasEl) aliasEl.value = "";
      });
      COURT_RANKS.forEach((rankId) => {
        const courtEl = overlay.querySelector(`.dlc-deck-court-${rankId}`);
        if (courtEl) courtEl.value = "";
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
    };

    const applyDeckModeUi = () => {
      const isIChing = deckState.system === "iching";
      const isPlaying = deckState.system === "playing-cards";
      overlay.querySelectorAll("[data-deck-mode]").forEach((button) => {
        const active = button.getAttribute("data-deck-mode") === deckState.system;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const majorsHeading = overlay.querySelector("[data-role='deck-majors-heading']");
      if (majorsHeading) majorsHeading.textContent = isIChing ? "Hexagrams" : "Trumps";
      const majorsSection = overlay.querySelector("[data-role='deck-majors-section']");
      if (majorsSection) majorsSection.style.display = isPlaying ? "none" : "";
      const majorsPatternRow = overlay.querySelector("[data-role='deck-majors-pattern-row']");
      if (majorsPatternRow) majorsPatternRow.style.display = isIChing || isPlaying ? "none" : "";
      const suitOrder = overlay.querySelector(".dlc-deck-suit-order");
      if (suitOrder) suitOrder.style.display = isIChing || isPlaying ? "none" : "";
      const playingOrder = overlay.querySelector("[data-role='playing-suit-order']");
      if (playingOrder) playingOrder.style.display = isPlaying ? "" : "none";
      overlay.querySelectorAll("[data-role^='suit-head-']").forEach((heading) => {
        const section = heading.closest(".dlc-deck-pattern-card");
        if (section) section.style.display = isIChing || isPlaying ? "none" : "";
      });
      // .dlc-deck-pattern-card sets display:grid, which beats the [hidden]
      // attribute, so toggle these with inline display instead.
      overlay.querySelectorAll("[data-role='playing-suit-section']").forEach((section) => {
        section.style.display = isPlaying ? "" : "none";
      });
      const courtSection = overlay.querySelector("[data-role='deck-court-section']");
      if (courtSection) courtSection.style.display = isIChing || isPlaying ? "none" : "";
      // The back and Misc/Extra slots are valid for every system; never hide them.
      ["deck-grid-back", "deck-grid-misc"].forEach((role) => {
        const section = overlay.querySelector(`[data-role='${role}']`)?.closest(".dlc-deck-pattern-card");
        if (section) section.style.display = "";
      });
    };

    const setDeckMode = async (system) => {
      const next = system === "iching" || system === "playing-cards" ? system : "tarot";
      deckState.system = next;
      if (next === "iching") {
        await ensureIChingNames();
      }
      deckSlots = deckSlotList(next);
      deckState.assigned = {};
      deckState.pendingLoose = "";
      applyDeckModeUi();
      if (deckState.files.length && next === "playing-cards") {
        assignPlayingFiles();
        applyDeckPatterns(false);
      }
      renderDeckEditor();
      setFormStatus(next === "iching"
        ? "I Ching mode: 64 hexagram slots + back. Map the images, then save."
        : next === "playing-cards"
          ? "Playing cards: 52 cards + back (AS, 2S… order Spades, Hearts, Diamonds, Clovers)."
          : "Tarot mode: 78 cards + back.");
    };

    overlay.querySelectorAll("[data-deck-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        void setDeckMode(button.getAttribute("data-deck-mode"));
      });
    });
    applyDeckModeUi();

    const deckFolderInput = overlay.querySelector(".dlc-create-deck-folder");
    const deckFolderLabel = overlay.querySelector("[data-role='deck-folder-label']");
    // The input is stretched invisibly over its label, so the browser opens the
    // directory chooser natively. Clearing first lets the same folder re-fire.
    deckFolderInput.addEventListener("click", () => {
      deckFolderInput.value = "";
    });
    if (deckFolderLabel) {
      // Fallback for a stale stylesheet that still hides the input: activate it
      // from the label, but only when the input itself was not the click target.
      deckFolderLabel.addEventListener("click", (event) => {
        if (event.target === deckFolderInput) return;
        event.preventDefault();
        deckFolderInput.value = "";
        deckFolderInput.click();
      });
    }
    deckFolderInput.addEventListener("change", (event) => {
      const picked = [...(event.currentTarget.files || [])];
      const files = picked.filter((file) => DECK_IMAGE_EXT.test(file.name));
      if (!files.length) {
        setFormStatus("No images found in that folder.", true);
        return;
      }
      const scanFile = picked.find((file) => /(^|\/)scan\.json$/i.test(String(file.webkitRelativePath || file.name).replace(/\\/g, "/")));
      const entries = files.map((file) => {
        const path = String(file.webkitRelativePath || file.name).replace(/\\/g, "/");
        return {
          path,
          file,
          url: URL.createObjectURL(file)
        };
      });
      const apply = (scanManifest) => {
        const codedFiles = entries.filter((entry) => String(playingCodeFromBase(deckFileBase(entry.path))?.key || "").startsWith("pc-"));
        const scanLooksPlaying = (scanManifest?.cards || []).some((card) => parsePlayingCode(card.name));
        if ((scanLooksPlaying || codedFiles.length >= 13) && deckState.system !== "playing-cards") {
          deckState.system = "playing-cards";
          deckSlots = deckSlotList("playing-cards");
        }
        applyDeckEntries(entries, scanManifest);
        applyDeckModeUi();
        if (scanManifest?.cards?.length && deckState.system === "playing-cards") {
          setFormStatus(`Mapped from scan.json (${scanManifest.cards.length} faces). Check the grid, then save.`);
        }
      };
      if (!scanFile) {
        apply(null);
        return;
      }
      scanFile.text().then((text) => {
        try {
          apply(JSON.parse(text));
        } catch (_error) {
          apply(null);
        }
      }).catch(() => apply(null));
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
            <p class="settings-field-hint">Left-click a card to view it larger. Right-click to rename, unmap, or assign a selected leftover. Shown as maps a suit (Wands → Batons) onto the standard deck, and Court names renames Page/Knight/Queen/King across every suit.</p>
            <p class="settings-field-hint">For 00–77 files, After trumps sets which suit owns 22–35, 36–49, 50–63, and 64–77. Right-click a suit heading to swap its cards with another suit.</p>
            <p class="settings-field-hint">Unmapped leftovers can be assigned or skipped. All 78 tarot, 64 I Ching, or 52 playing-card slots are required unless you allow an incomplete deck. Playing cards also take a back.</p>
            <p class="settings-field-hint">Playing-card files named like <code>01-as.webp</code> (AS, 2S, KH…) map automatically, Spades → Hearts → Diamonds → Clovers. A folder <code>scan.json</code> from the ZIO scraper is used when present.</p>
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
    PLAYING_SUITS.forEach((suit) => {
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

    COURT_RANKS.forEach((rankId) => {
      overlay.querySelector(`.dlc-deck-court-${rankId}`)?.addEventListener("input", (event) => {
        const value = String(event.currentTarget.value || "").trim();
        const defaultLabel = DECK_RANKS.find((entry) => entry.id === rankId)?.label || rankId;
        if (value && value !== defaultLabel) {
          deckState.courtNames[rankId] = value;
        } else {
          delete deckState.courtNames[rankId];
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
    overlay.querySelector(".dlc-create-deck-upload").addEventListener("change", (event) => {
      const files = [...(event.currentTarget.files || [])].filter((file) => DECK_IMAGE_EXT.test(file.name));
      event.currentTarget.value = "";
      if (!files.length) {
        setFormStatus("No image files found in that upload.", true);
        return;
      }
      const existing = new Set(deckState.files.map((entry) => entry.path));
      const added = [];
      files.forEach((file) => {
        if (existing.has(file.name)) return;
        existing.add(file.name);
        added.push({ path: file.name, file, url: URL.createObjectURL(file) });
      });
      if (!added.length) {
        setFormStatus("Those images are already loaded.", true);
        return;
      }
      deckState.files.push(...added);
      renderDeckEditor();
      setFormStatus(`Added ${added.length} unmapped image(s). Assign them to a slot from the grid.`);
    });

    overlay.querySelector('[data-action="change-deck-source"]').addEventListener("click", () => {
      overlay.querySelector("[data-role='deck-source']").hidden = false;
    });
    overlay.querySelector('[data-action="save-deck"]').addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const title = String(overlay.querySelector(".dlc-create-deck-title")?.value || "").trim() || "Untitled deck";
      const id = slugifyId(overlay.querySelector(".dlc-create-deck-id")?.value || title);
      const optionalKeys = new Set(["back", "misc"]);
      const missing = deckSlots.filter((slot) => (
        !slot.key.startsWith("joker-") && !optionalKeys.has(slot.key) && !deckState.assigned[slot.key]
      ));
      const allowIncomplete = Boolean(overlay.querySelector(".dlc-create-deck-incomplete")?.checked);
      if (missing.length && !allowIncomplete) {
        const names = missing.slice(0, 4).map((slot) => slotDefaultName(slot)).join(", ");
        const suffix = missing.length > 4 ? ", …" : "";
        setFormStatus(`${missing.length} card(s) still unmapped (${names}${suffix}). Map them, or check “Allow incomplete deck”.`, true);
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
        const courtNameOverrides = {};
        const playingNameOverrides = {};
        DECK_SUITS.forEach((suit) => {
          const custom = String(deckState.suitNames[suit.id] || overlay.querySelector(`.dlc-deck-alias-${suit.id}`)?.value || "").trim();
          if (custom && custom !== suit.label) {
            suitNameOverrides[suit.id === "pentacles" ? "disks" : suit.id] = custom;
          }
        });
        PLAYING_SUITS.forEach((suit) => {
          const custom = String(deckState.suitNames[suit.id] || overlay.querySelector(`.dlc-deck-alias-${suit.id}`)?.value || "").trim();
          if (custom && custom !== suit.label) {
            suitNameOverrides[suit.id] = custom;
          }
        });
        COURT_RANKS.forEach((rankId) => {
          const custom = String(deckState.courtNames[rankId] || overlay.querySelector(`.dlc-deck-court-${rankId}`)?.value || "").trim();
          const defaultLabel = DECK_RANKS.find((entry) => entry.id === rankId)?.label || rankId;
          if (custom && custom !== defaultLabel) {
            courtNameOverrides[rankId] = custom;
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
          if (slot.key.startsWith("pc-")) {
            const parts = slot.key.split("-");
            const suitId = parts[1];
            const rankId = parts.slice(2).join("-");
            const defaultName = `${playingRankLabel(rankId)} of ${suitLabel(suitId)}`;
            if (custom !== defaultName) {
              playingNameOverrides[`${rankId} of ${suitId}`] = custom;
            }
            return;
          }
          if (slot.key.startsWith("joker-") || slot.key === "back" || slot.key === "misc") return;
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
        const hexagramCards = {};
        const hexagramNames = {};
        const hexagramLines = {};
        const playingCards = {};
        const jokerCards = [];
        const extraCards = [];
        const addFile = async (slotFile, zipName) => {
          const entry = fileByPath.get(slotFile);
          if (!entry) return;
          zipFiles.push({ name: zipName, bytes: new Uint8Array(await entry.file.arrayBuffer()) });
        };
        for (const slot of mapped) {
          if (slot.key === "back") continue;
          const sourcePath = deckState.assigned[slot.key];
          const zipName = `${String(slot.file).replace(/\.[^.]+$/, "")}${imageExt(sourcePath)}`;
          await addFile(sourcePath, zipName);
          if (slot.key.startsWith("hex-")) {
            const number = String(slot.key.slice(4));
            hexagramCards[number] = zipName;
            const custom = String(deckState.cardNames[slot.key] || "").trim();
            const defaultName = (ichingHexagramNames && ichingHexagramNames[Number(number)]) || `Hexagram ${number}`;
            hexagramNames[number] = custom || defaultName;
            const lineDiagram = ichingHexagramData && ichingHexagramData[Number(number)]?.lineDiagram;
            if (lineDiagram) hexagramLines[number] = lineDiagram;
            continue;
          }
          if (slot.key === "misc") {
            extraCards.push(zipName);
          } else if (slot.key.startsWith("joker-")) {
            jokerCards[slot.key === "joker-2" ? 1 : 0] = zipName;
          } else if (slot.key.startsWith("major-")) {
            majorCards[String(slot.key.slice(6))] = zipName;
          } else if (slot.key.startsWith("pc-")) {
            const parts = slot.key.split("-");
            const suitId = parts[1];
            const rankId = parts.slice(2).join("-");
            playingCards[`${rankId} of ${suitId}`] = zipName;
          } else {
            const parts = slot.key.split("-");
            const suitId = parts[1] === "pentacles" ? "disks" : parts[1];
            const rankId = parts.slice(2).join("-");
            minorCards[`${rankId} of ${suitId}`] = zipName;
          }
        }
        if (jokerCards.filter(Boolean).length) {
          playingCards.joker = jokerCards.filter(Boolean);
        }
        let cardBack = "";
        const backPath = deckState.assigned.back;
        if (backPath) {
          cardBack = `back${imageExt(backPath)}`;
          await addFile(backPath, cardBack);
        }
        const thumbnails = { root: "thumbs", width: 240, height: 360, fit: "inside", quality: 82 };
        let manifest;
        if (deckState.system === "iching") {
          manifest = {
            id,
            name: title,
            system: "iching",
            thumbnails,
            hexagrams: hexagramCards,
            hexagramNames,
            hexagramLines
          };
        } else if (deckState.system === "playing-cards") {
          manifest = {
            id,
            name: title,
            system: "playing-cards",
            thumbnails,
            cards: playingCards
          };
          if (Object.keys(playingNameOverrides).length) {
            manifest.cardNameOverrides = playingNameOverrides;
          }
          if (Object.keys(suitNameOverrides).length) {
            manifest.suitNameOverrides = suitNameOverrides;
          }
        } else {
          manifest = {
            id,
            name: title,
            system: "tarot",
            thumbnails,
            majors: { mode: "trump-map", cards: majorCards },
            minors: { mode: "file-map", cards: minorCards }
          };
          if (Object.keys(majorNameOverridesByTrump).length) {
            manifest.majorNameOverridesByTrump = majorNameOverridesByTrump;
          }
          if (Object.keys(minorNameOverrides).length) {
            manifest.minorNameOverrides = minorNameOverrides;
          }
          if (Object.keys(suitNameOverrides).length) {
            manifest.suitNameOverrides = suitNameOverrides;
          }
          if (Object.keys(courtNameOverrides).length) {
            manifest.courtNameOverrides = courtNameOverrides;
          }
        }
        if (cardBack) {
          manifest.cardBack = cardBack;
        }
        if (extraCards.length) {
          manifest.extras = extraCards;
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
          xhr.open(
            "POST",
            window.TarotDataService.buildApiUrl(
              `/api/v1/dlc/decks${editing ? `?overwrite=1&renameFrom=${encodeURIComponent(editItem.name)}` : ""}`
            )
          );
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
        setFormStatus(`${editing ? "Updated" : "Saved"} '${result?.deck?.title || id}'. Install or Publish it from Admin → DLC when ready.`);
        setStatus(`${editing ? "Updated" : "Created"} deck '${result?.deck?.id || id}'.`);
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

    const prefillEdit = async () => {
      if (!editing) return;
      const kind = editItem.kind === "gui" ? "plugin" : editItem.kind;
      const query = [
        `kind=${encodeURIComponent(editItem.kind)}`,
        `name=${encodeURIComponent(editItem.name)}`,
        `sourceId=${encodeURIComponent(editItem.sourceId || "")}`,
        `id=${encodeURIComponent(editItem.id || "")}`
      ].join("&");
      overlay.querySelector(`.dlc-create-kind[data-kind="${kind}"]`)?.click();
      setFormStatus("Loading saved item…");
      let draft = null;
      try {
        draft = await window.TarotDataService.requestJson(
          "GET",
          window.TarotDataService.buildApiUrl(`/api/v1/admin/dlc/item/draft?${query}`)
        );
      } catch (error) {
        setFormStatus(error?.message || "Could not load the saved item.", true);
        return;
      }
      try {
        if (kind === "reference" && draft?.reference) {
          const manifest = draft.reference.manifest || {};
          const entries = draft.reference.entries || {};
          referenceIdManual = true;
          referenceFileName = `${manifest.id || editItem.name}.json`;
          referenceParsed = entries;
          referenceSource = JSON.stringify(entries);
          if (manifest.fieldConfig && typeof manifest.fieldConfig === "object") {
            referenceFieldConfig = manifest.fieldConfig;
          }
          referenceListOrder = Array.isArray(manifest.listOrder) ? manifest.listOrder.slice() : [];
          overlay.querySelector(".dlc-create-ref-title").value = manifest.title || editItem.title || "";
          overlay.querySelector(".dlc-create-ref-id").value = manifest.id || editItem.name;
          overlay.querySelector(".dlc-create-ref-kind").value = manifest.kind || "dictionary";
          overlay.querySelector(".dlc-create-ref-scheme").value = manifest.keyScheme || "word";
          overlay.querySelector(".dlc-create-ref-description").value = manifest.description || "";
          syncRefKindUi();
          await runReferencePreview({ fillMeta: false });
          return;
        }
        if (kind === "text" && draft?.text) {
          const manifest = draft.text.manifest || {};
          idManual = true;
          sourceText = String(draft.text.sourceText || "");
          sourceName = `${manifest.id || editItem.name}.txt`;
          overlay.querySelector(".dlc-create-text-body").value = sourceText;
          overlay.querySelector(".dlc-create-text-title").value = manifest.title || editItem.title || "";
          overlay.querySelector(".dlc-create-text-id").value = manifest.id || editItem.name;
          overlay.querySelector(".dlc-create-text-description").value = manifest.description || "";
          overlay.querySelector(".dlc-create-text-language").value = manifest.language || "English";
          overlay.querySelector(".dlc-create-text-tradition").value = manifest.tradition || "";
          overlay.querySelector(".dlc-create-text-short-title").value = manifest.shortTitle || "";
          overlay.querySelector(".dlc-create-text-script").value = manifest.script || "Latin";
          overlay.querySelector(".dlc-create-text-work-label").value = manifest.workLabel || "";
          overlay.querySelector(".dlc-create-text-section-label").value = manifest.sectionLabel || "";
          overlay.querySelector(".dlc-create-text-verse-label").value = manifest.verseLabel || "";
          await runTextPreview({
            syncFields: false,
            keepFormat: true,
            format: manifest?.input?.format || undefined,
            statusText: "Loading saved text…"
          });
          return;
        }
        if (kind === "deck" && draft?.deck) {
          const manifest = draft.deck || {};
          const listing = await window.TarotDataService.requestJson(
            "GET",
            window.TarotDataService.buildApiUrl(`/api/v1/admin/dlc/item/files?${query}`)
          );
          const imageFiles = (listing?.files || []).filter((file) => DECK_IMAGE_EXT.test(file.path));
          if (!imageFiles.length) {
            setFormStatus("No card images found in this deck.", true);
            return;
          }
          const entries = [];
          for (const file of imageFiles) {
            const blob = await window.TarotDataService.requestBlob(
              "GET",
              window.TarotDataService.buildApiUrl(
                `/api/v1/admin/dlc/item/raw?${query}&path=${encodeURIComponent(file.path)}`
              )
            );
            const name = file.path.split("/").pop();
            const deckFile = new File([blob], name, { type: blob.type || "application/octet-stream" });
            entries.push({ path: file.path, file: deckFile, url: URL.createObjectURL(deckFile) });
          }
          // Editing keeps the deck's id stable: renaming the title must not
          // change identity or the runtime/installed deck would look new.
          deckState.idManual = true;
          const savedSystem = String(manifest.system || "").toLowerCase();
          const isIChing = savedSystem === "iching";
          const isPlaying = savedSystem === "playing-cards";
          const applyExtraFiles = (byBase) => {
            const extras = Array.isArray(manifest.extras)
              ? manifest.extras
              : (manifest.extras ? [manifest.extras] : []);
            const first = extras.map((fileName) => byBase.get(String(fileName).toLowerCase())).find(Boolean);
            if (first) deckState.assigned.misc = first;
          };
          if (isIChing) {
            deckState.system = "iching";
            await ensureIChingNames();
            Object.entries(manifest.hexagramNames || {}).forEach(([number, name]) => {
              const key = Number(number);
              if (key >= 1 && key <= 64 && String(name || "").trim()) {
                ichingHexagramNames[key] = String(name).trim();
              }
            });
            deckSlots = deckSlotList("iching");
            applyDeckModeUi();
            applyDeckEntries(entries);
            const byBaseHex = new Map(entries.map((entry) => [entry.path.split("/").pop().toLowerCase(), entry.path]));
            Object.entries(manifest.hexagrams || {}).forEach(([number, fileName]) => {
              const path = byBaseHex.get(String(fileName).toLowerCase());
              if (path) deckState.assigned[`hex-${number}`] = path;
            });
            Object.entries(manifest.hexagramNames || {}).forEach(([number, name]) => {
              if (String(name || "").trim()) deckState.cardNames[`hex-${number}`] = String(name).trim();
            });
            if (manifest.cardBack) {
              const backPath = byBaseHex.get(String(manifest.cardBack).toLowerCase());
              if (backPath) deckState.assigned.back = backPath;
            }
            applyExtraFiles(byBaseHex);
          } else if (isPlaying) {
            deckState.system = "playing-cards";
            deckSlots = deckSlotList("playing-cards");
            applyDeckModeUi();
            applyDeckEntries(entries);
            const byBasePlay = new Map(entries.map((entry) => [entry.path.split("/").pop().toLowerCase(), entry.path]));
            Object.entries(manifest.cards || {}).forEach(([key, value]) => {
              const files = Array.isArray(value) ? value : [value];
              if (String(key).toLowerCase() === "joker") {
                files.forEach((fileName, index) => {
                  const path = byBasePlay.get(String(fileName).toLowerCase());
                  if (path) deckState.assigned[index === 0 ? "joker-1" : "joker-2"] = path;
                });
                return;
              }
              const match = String(key).toLowerCase().match(/^(.+?)\s+of\s+(.+)$/);
              if (!match) return;
              const slotKey = `pc-${match[2]}-${match[1]}`;
              const path = byBasePlay.get(String(files[0]).toLowerCase());
              if (path && deckSlots.some((slot) => slot.key === slotKey)) deckState.assigned[slotKey] = path;
            });
            Object.entries(manifest.cardNameOverrides || {}).forEach(([key, name]) => {
              const match = String(key).toLowerCase().match(/^(.+?)\s+of\s+(.+)$/);
              if (match && String(name || "").trim()) {
                deckState.cardNames[`pc-${match[2]}-${match[1]}`] = String(name).trim();
              }
            });
            Object.entries(manifest.suitNameOverrides || {}).forEach(([suitId, name]) => {
              if (PLAYING_SUITS.some((suit) => suit.id === suitId)) deckState.suitNames[suitId] = name;
            });
            if (manifest.cardBack) {
              const backPath = byBasePlay.get(String(manifest.cardBack).toLowerCase());
              if (backPath) deckState.assigned.back = backPath;
            }
            applyExtraFiles(byBasePlay);
          } else {
            deckState.system = "tarot";
            applyDeckModeUi();
            applyDeckEntries(entries);
            const byBase = new Map(entries.map((entry) => [entry.path.split("/").pop().toLowerCase(), entry.path]));
            Object.entries(manifest.majors?.cards || {}).forEach(([trump, fileName]) => {
              const path = byBase.get(String(fileName).toLowerCase());
              if (path) deckState.assigned[`major-${trump}`] = path;
            });
            const minorCards = manifest.minors?.cards || {};
            deckSlots.forEach((slot) => {
              if (slot.key.startsWith("major-")) return;
              const parts = slot.key.split("-");
              const suitId = parts[1] === "pentacles" ? "disks" : parts[1];
              const rankId = parts.slice(2).join("-");
              const path = byBase.get(String(minorCards[`${rankId} of ${suitId}`] || "").toLowerCase());
              if (path) deckState.assigned[slot.key] = path;
            });
            Object.entries(manifest.majorNameOverridesByTrump || {}).forEach(([trump, name]) => {
              deckState.cardNames[`major-${trump}`] = name;
            });
            // Legacy major overrides keyed by canonical name (e.g. judgement → Aeon).
            Object.entries(manifest.nameOverrides || {}).forEach(([key, name]) => {
              if (deckState.cardNames[`major-${key}`]) return;
              const trumpIndex = DECK_MAJORS.findIndex((entry) => entry.toLowerCase() === String(key).toLowerCase());
              if (trumpIndex >= 0 && String(name || "").trim()) {
                deckState.cardNames[`major-${trumpIndex}`] = String(name).trim();
              }
            });
            deckSlots.forEach((slot) => {
              if (slot.key.startsWith("major-")) return;
              const parts = slot.key.split("-");
              const suitId = parts[1] === "pentacles" ? "disks" : parts[1];
              const rankId = parts.slice(2).join("-");
              const saved = (manifest.minorNameOverrides || {})[`${rankId} of ${suitId}`];
              if (saved) deckState.cardNames[slot.key] = saved;
            });
            Object.entries(manifest.suitNameOverrides || {}).forEach(([suitId, name]) => {
              const id = suitId === "disks" ? "pentacles" : suitId;
              if (DECK_SUITS.some((suit) => suit.id === id)) deckState.suitNames[id] = name;
            });
            Object.entries(manifest.courtNameOverrides || {}).forEach(([rankId, name]) => {
              if (COURT_RANKS.includes(rankId) && String(name || "").trim()) {
                deckState.courtNames[rankId] = String(name).trim();
              }
            });
            if (manifest.cardBack) {
              const backPath = byBase.get(String(manifest.cardBack).toLowerCase());
              if (backPath) deckState.assigned.back = backPath;
            }
            applyExtraFiles(byBase);
          }
          const titleEl = overlay.querySelector(".dlc-create-deck-title");
          const idEl = overlay.querySelector(".dlc-create-deck-id");
          if (titleEl) titleEl.value = manifest.name || manifest.label || manifest.title || editItem.title || titleEl.value;
          if (idEl) idEl.value = manifest.id || editItem.name;
          DECK_SUITS.forEach((suit) => {
            const aliasEl = overlay.querySelector(`.dlc-deck-alias-${suit.id}`);
            if (aliasEl) aliasEl.value = deckState.suitNames[suit.id] || "";
          });
          PLAYING_SUITS.forEach((suit) => {
            const aliasEl = overlay.querySelector(`.dlc-deck-alias-${suit.id}`);
            if (aliasEl) aliasEl.value = deckState.suitNames[suit.id] || "";
          });
          COURT_RANKS.forEach((rankId) => {
            const courtEl = overlay.querySelector(`.dlc-deck-court-${rankId}`);
            if (courtEl) courtEl.value = deckState.courtNames[rankId] || "";
          });
          renderDeckEditor();
          setFormStatus(`Loaded ${entries.length} card image(s) with the saved mapping. Adjust, then save to overwrite.`);
          return;
        }
        setFormStatus("This item opens in the file editor instead.", false);
      } catch (error) {
        setFormStatus(error?.message || "Could not load the saved item.", true);
      }
    };

    if (editing) {
      void prefillEdit();
    }

    // Merge mode: show the merged draft in the normal text editor so the admin
    // can read it, delete/shelve passages, then "Merge & save".
    if (mergeDraft) {
      previewState = mergeDraft;
      sourceText = "";
      overlay.querySelector('.dlc-create-kind[data-kind="text"]')?.click();
      const setField = (selector, value) => {
        const el = overlay.querySelector(selector);
        if (el) el.value = value == null ? "" : String(value);
      };
      setField(".dlc-create-text-title", mergeDraft.title);
      setField(".dlc-create-text-id", mergeDraft.id);
      setField(".dlc-create-text-description", mergeDraft.description);
      setField(".dlc-create-text-work-label", mergeDraft.workLabel);
      setField(".dlc-create-text-section-label", mergeDraft.sectionLabel);
      setField(".dlc-create-text-verse-label", mergeDraft.verseLabel);
      fillFormatOptions(mergeDraft.formats, mergeDraft.format);
      renderTextPreview(overlay, previewState, { syncFields: false });

      // Source naming lives in the editor: rename the merged works from their
      // original titles with a regex, then review the (re-rendered) preview.
      const fieldsHost = overlay.querySelector("[data-role='text-fields']");
      if (fieldsHost && !fieldsHost.querySelector(".dlc-text-merge-naming")) {
        const panel = document.createElement("div");
        panel.className = "dlc-text-merge-naming";
        panel.innerHTML = `
          <strong>Source naming</strong>
          <p class="settings-field-hint">Rename the merged sources from their original titles.</p>
          <label class="settings-field">Pattern (regex)
            <input type="text" class="dlc-text-merge-pattern" placeholder="e.g. part\\s*\\d+">
          </label>
          <label class="settings-field">Replace with (optional)
            <input type="text" class="dlc-text-merge-replace" placeholder="blank uses capture $1">
          </label>
          <label class="dlc-menu-hide-label"><input type="checkbox" class="dlc-text-merge-ignorecase" checked> Ignore case</label>
          <div class="dlc-shop-actions">
            <button type="button" class="dlc-shop-btn" data-action="apply-merge-naming">Rename sources</button>
            <span class="settings-field-hint" data-role="merge-naming-status"></span>
          </div>`;
        fieldsHost.prepend(panel);
        const namingPattern = panel.querySelector(".dlc-text-merge-pattern");
        const namingReplace = panel.querySelector(".dlc-text-merge-replace");
        const namingIgnore = panel.querySelector(".dlc-text-merge-ignorecase");
        const namingStatus = panel.querySelector('[data-role="merge-naming-status"]');
        panel.querySelector('[data-action="apply-merge-naming"]').addEventListener("click", () => {
          const pattern = String(namingPattern.value || "").trim();
          if (!pattern) {
            namingStatus.textContent = "Enter a pattern.";
            return;
          }
          let regex;
          try {
            regex = new RegExp(pattern, namingIgnore.checked ? "i" : "");
          } catch (error) {
            namingStatus.textContent = `Pattern error: ${error.message}`;
            return;
          }
          const template = String(namingReplace.value || "").trim();
          let renamed = 0;
          (previewState.document?.works || []).forEach((work, index) => {
            const source = String(previewState.workSources?.[index] || work.title || "").trim();
            const match = regex.exec(source);
            if (!match) return;
            const next = template ? source.replace(regex, template) : (match[1] !== undefined ? match[1] : match[0]);
            const clean = String(next || source).trim();
            if (!clean) return;
            work.title = clean.slice(0, 160);
            work.shortTitle = clean.slice(0, 80);
            renamed += 1;
          });
          renderTextPreview(overlay, previewState, { syncFields: false });
          namingStatus.textContent = `Renamed ${renamed} source(s).`;
        });
      }

      setFormStatus(`Merged ${mergeContext?.sourceNames?.length || 0} source(s). Edit, delete, or shelve passages, rename sources, then “Merge &amp; save”.`);
      overlay.querySelector('[data-action="save-text"]')?.scrollIntoView({ block: "nearest" });
    }
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
