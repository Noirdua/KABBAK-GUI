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
        const url = window.TaroTimePluginHost?.assetUrl?.("menu-plugin", "presets.json")
          || window.TarotDataService.buildApiUrl("/api/v1/plugins/menu-plugin/presets.json");
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return {};
        const payload = await response.json().catch(() => null);
        return payload && typeof payload === "object" && payload.presets && typeof payload.presets === "object"
          ? payload.presets
          : {};
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
          detail: { pluginName: "menu-plugin" }
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
          detail: { pluginName: "menu-plugin" }
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
    const AUDIO_EXTENSIONS = new Set([".mp3", ".ogg", ".wav", ".webm", ".m4a"]);
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
      uploadInput.accept = "audio/*,.mp3,.ogg,.wav,.webm,.m4a";
      uploadInput.style.display = "none";
      uploadLabel.appendChild(uploadInput);
      uploadInput.addEventListener("change", async () => {
        const fileList = Array.from(uploadInput.files || []).filter((file) => file.type && file.type.startsWith("audio/"));
        uploadInput.value = "";
        if (!fileList.length) return;
        let uploaded = 0;
        for (const file of fileList) {
          if (uploadLimitBytes && file.size > uploadLimitBytes) {
            status.set(`Skipped '${file.name}' — over the server upload limit.`, true);
            continue;
          }
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          });
          if (!dataUrl) continue;
          try {
            await service.requestJson(
              "POST",
              service.buildApiUrl(`/api/v1/plugins/${plugin.name}/files/${LIBRARY_DIR}`),
              { fileName: file.name, data: dataUrl }
            );
            uploaded += 1;
          } catch (error) {
            status.set(`Upload failed for '${file.name}'. ${error?.message || ""}`, true);
            break;
          }
        }
        await loadLibrary();
        renderLibraryList();
        status.set(uploaded ? `Uploaded ${uploaded} song(s) to the library.` : "Nothing uploaded.");
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
    if (plugin?.name === "music-player") {
      void renderMusicPlayerSettings(settingsEl, plugin);
      return;
    }
    if (plugin?.name === "homepage") {
      void renderHomepageSettings(settingsEl, plugin);
      return;
    }
    if (plugin?.name === "links") {
      void renderLinksSettings(settingsEl, plugin);
      return;
    }
    if (plugin?.name === "hydrus-network") {
      void renderHydrusNetworkSettings(settingsEl, plugin);
      return;
    }
    void renderGenericConfigSettings(settingsEl, plugin);
  }

  // --- Create a third-party plugin -------------------------------------------

  function openCreatePlugin(hostEl, { onCreated } = {}) {
    if (!hostEl) return;
    if (!isAdmin()) {
      setStatus("Admin key required to create plugins.", true);
      return;
    }
    const existing = hostEl.querySelector(".dlc-create-plugin");
    if (existing) {
      existing.remove();
      return;
    }

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
      return openCreatePlugin(hostEl, options);
    }
  };
})();
