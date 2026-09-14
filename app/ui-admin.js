/* ui-admin.js — Admin panel: overview, API clients, plugins & DLC, users. */
(function () {
  "use strict";

  function getElements() {
    return {
      statusText: document.getElementById("admin-status-text"),
      overviewGrid: document.getElementById("admin-overview-grid"),
      clientsTable: document.getElementById("admin-clients-table"),
      clientNameEl: document.getElementById("admin-client-name"),
      clientIdEl: document.getElementById("admin-client-id"),
      clientAccessEl: document.getElementById("admin-client-access"),
      clientKeyEl: document.getElementById("admin-client-key"),
      clientCreateBtn: document.getElementById("admin-client-create"),
      rolesListEl: document.getElementById("admin-roles-list"),
      roleIdEl: document.getElementById("admin-role-id"),
      roleLabelEl: document.getElementById("admin-role-label"),
      roleAccessEl: document.getElementById("admin-role-access"),
      roleDescriptionEl: document.getElementById("admin-role-description"),
      roleCapabilitiesEl: document.getElementById("admin-role-capabilities"),
      roleLimitsEl: document.getElementById("admin-role-limits"),
      roleCreateBtn: document.getElementById("admin-role-create"),
      rolePriceEl: document.getElementById("admin-role-price"),
      roleCurrencyEl: document.getElementById("admin-role-currency"),
      roleProviderPlanEl: document.getElementById("admin-role-provider-plan"),
      levelsListEl: document.getElementById("admin-levels-list"),
      dlcCatalogEl: document.getElementById("admin-dlc-catalog"),
      pluginsReloadBtn: document.getElementById("admin-dlc-refresh"),
      settingLogModeEl: document.getElementById("admin-setting-log-mode"),
      settingAllowNullEl: document.getElementById("admin-setting-allow-null"),
      settingOriginsEl: document.getElementById("admin-setting-origins"),
      settingBodyLimitEl: document.getElementById("admin-setting-body-limit"),
      settingPluginLimitMbEl: document.getElementById("admin-setting-plugin-limit-mb"),
      settingAutoMigrateEl: document.getElementById("admin-setting-auto-migrate"),
      settingSecretEl: document.getElementById("admin-setting-encryption-secret"),
      settingSecretStateEl: document.getElementById("admin-setting-secret-state"),
      settingSecretClearEl: document.getElementById("admin-setting-secret-clear"),
      settingBrowserTitleEl: document.getElementById("admin-setting-browser-title"),
      settingOverlayUrlEl: document.getElementById("admin-setting-overlay-url"),
      settingOverlayFileEl: document.getElementById("admin-setting-overlay-file"),
      settingOverlayClearEl: document.getElementById("admin-setting-overlay-clear"),
      settingsSaveBtn: document.getElementById("admin-settings-save"),
      envReadonlyEl: document.getElementById("admin-env-readonly"),
      logLevelEl: document.getElementById("admin-log-level"),
      logGroupEl: document.getElementById("admin-log-group"),
      logEventEl: document.getElementById("admin-log-event"),
      logSinceEl: document.getElementById("admin-log-since"),
      logSearchEl: document.getElementById("admin-log-search"),
      logAutoRefreshEl: document.getElementById("admin-log-autorefresh"),
      logRefreshBtn: document.getElementById("admin-log-refresh"),
      logClearBtn: document.getElementById("admin-log-clear"),
      logListEl: document.getElementById("admin-log-list")
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

  function setStatus(text, isError = false) {
    const { statusText } = getElements();
    if (!statusText) return;
    statusText.textContent = text;
    const statusWrap = statusText.closest(".settings-page-status");
    if (statusWrap) {
      statusWrap.dataset.tone = isError ? "error" : "neutral";
    }
  }

  function requestJson(method, path, body) {
    const service = window.TarotDataService;
    return service.requestJson(method, service.buildApiUrl(path), body);
  }

  function copyText(text, label) {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        () => setStatus(`${label || "Key"} copied to clipboard.`),
        () => setStatus(text)
      );
      return;
    }
    window.prompt(`${label || "Copy"} (press Ctrl+C):`, text);
  }

  function showKeyOnce(key, contextLabel) {
    if (!key) return;
    document.querySelector(".admin-key-once-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "dlc-settings-overlay admin-key-once-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", `${contextLabel} key`);
    overlay.innerHTML = `
      <div class="dlc-settings-overlay-panel">
        <div class="dlc-settings-overlay-head"><strong>${escapeHtml(contextLabel)} — shown once</strong></div>
        <div class="dlc-install-overlay-body">
          <p class="settings-field-hint">Copy this key now. It will not be shown again after you close this dialog.</p>
          <code class="admin-key-once-code">${escapeHtml(key)}</code>
          <div class="dlc-shop-actions">
            <button type="button" class="dlc-shop-btn" data-action="copy">Copy</button>
            <button type="button" class="dlc-shop-btn" data-action="dismiss">Close</button>
          </div>
        </div>
      </div>`;
    overlay.querySelector('[data-action="copy"]').addEventListener("click", () => copyText(key, "API key"));
    const closeOverlay = () => overlay.remove();
    overlay.querySelector('[data-action="dismiss"]').addEventListener("click", closeOverlay);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", function onKey(event) {
      if (event.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        closeOverlay();
      }
    });
    document.body.appendChild(overlay);
  }

  // In-app replacement for window.prompt (blocked in some embedded browsers).
  function promptPublishMessage(item) {
    return new Promise((resolve) => {
      document.querySelector(".dlc-publish-overlay")?.remove();
      const overlay = document.createElement("div");
      overlay.className = "dlc-settings-overlay dlc-publish-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.innerHTML = `
        <div class="dlc-settings-overlay-panel">
          <div class="dlc-settings-overlay-head"><strong>Publish ${escapeHtml(item.title || item.name)}</strong></div>
          <div class="dlc-install-overlay-body">
            <p class="settings-field-hint">Commits this ${escapeHtml(item.kind || "item")} to its DLC repository and pushes to the source branch.</p>
            <label class="settings-field">Commit message
              <input type="text" class="dlc-publish-message" value="Update ${escapeHtml(item.kind)}: ${escapeHtml(item.name)}">
            </label>
            <div class="dlc-shop-actions">
              <button type="button" class="dlc-shop-btn" data-action="confirm">Publish</button>
              <button type="button" class="dlc-shop-btn" data-action="cancel">Cancel</button>
            </div>
          </div>
        </div>`;
      const input = overlay.querySelector(".dlc-publish-message");
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector('[data-action="confirm"]').addEventListener("click", () => finish(String(input.value || "")));
      overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => finish(null));
      overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) finish(null);
      });
      document.addEventListener("keydown", function onKey(event) {
        if (event.key === "Escape") {
          document.removeEventListener("keydown", onKey);
          finish(null);
        }
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") finish(String(input.value || ""));
      });
      document.body.appendChild(overlay);
      input.focus();
      input.select();
    });
  }

  async function openDlcItemEditor(item) {
    document.querySelector(".dlc-item-editor-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "dlc-settings-overlay dlc-item-editor-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="dlc-settings-overlay-panel dlc-item-editor-panel">
        <div class="dlc-settings-overlay-head">
          <strong>Edit ${escapeHtml(item.title || item.name)}</strong>
          <button type="button" class="dlc-shop-btn" data-action="close">Close</button>
        </div>
        <div class="dlc-item-editor-body">
          <div class="dlc-item-files" data-role="files"><span class="settings-field-hint">Loading files…</span></div>
          <div class="dlc-item-editor-main">
            <div class="dlc-item-editor-path settings-field-hint" data-role="path">Select a file to edit.</div>
            <textarea class="dlc-item-textarea" data-role="editor" spellcheck="false" disabled></textarea>
            <div class="dlc-shop-actions">
              <button type="button" class="dlc-shop-btn" data-action="save" disabled>Save file</button>
              <span class="settings-field-hint" data-role="edit-status"></span>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const closeOverlay = () => overlay.remove();
    overlay.querySelector('[data-action="close"]').addEventListener("click", closeOverlay);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", function onKey(event) {
      if (event.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        closeOverlay();
      }
    });

    const filesHost = overlay.querySelector('[data-role="files"]');
    const pathLabel = overlay.querySelector('[data-role="path"]');
    const editor = overlay.querySelector('[data-role="editor"]');
    const saveBtn = overlay.querySelector('[data-action="save"]');
    const editStatus = overlay.querySelector('[data-role="edit-status"]');
    const query = `kind=${encodeURIComponent(item.kind)}&name=${encodeURIComponent(item.name)}&sourceId=${encodeURIComponent(item.sourceId || "")}&id=${encodeURIComponent(item.id || "")}`;
    let currentPath = "";
    let loadedContent = "";

    async function loadFile(filePath) {
      editStatus.textContent = "Loading…";
      try {
        const file = await requestJson("GET", `/api/v1/admin/dlc/item/file?${query}&path=${encodeURIComponent(filePath)}`);
        currentPath = file.path;
        pathLabel.textContent = file.path;
        if (file.binary || !file.editable) {
          editor.value = "";
          editor.disabled = true;
          saveBtn.disabled = true;
          editStatus.textContent = "Binary or unsupported file — read-only.";
          return;
        }
        editor.value = file.content || "";
        loadedContent = editor.value;
        editor.disabled = false;
        saveBtn.disabled = true;
        editStatus.textContent = `${file.size || 0} bytes`;
      } catch (error) {
        editor.value = "";
        editor.disabled = true;
        saveBtn.disabled = true;
        editStatus.textContent = error?.message || "Could not load file.";
      }
    }

    editor.addEventListener("input", () => {
      saveBtn.disabled = editor.value === loadedContent;
    });

    saveBtn.addEventListener("click", async () => {
      if (!currentPath) return;
      saveBtn.disabled = true;
      editStatus.textContent = "Saving…";
      try {
        await requestJson("PUT", "/api/v1/admin/dlc/item/file", {
          kind: item.kind,
          name: item.name,
          sourceId: item.sourceId || "",
          id: item.id || "",
          path: currentPath,
          content: editor.value
        });
        loadedContent = editor.value;
        editStatus.textContent = "Saved.";
        setStatus(`Saved ${currentPath} in ${item.name}.`);
      } catch (error) {
        editStatus.textContent = error?.message || "Could not save.";
        saveBtn.disabled = false;
      }
    });

    try {
      const listing = await requestJson("GET", `/api/v1/admin/dlc/item/files?${query}`);
      const files = Array.isArray(listing?.files) ? listing.files : [];
      filesHost.innerHTML = "";
      if (!files.length) {
        const empty = document.createElement("span");
        empty.className = "settings-field-hint";
        empty.textContent = "No editable files found.";
        filesHost.appendChild(empty);
      }
      files.forEach((file) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dlc-item-file";
        button.textContent = file.path;
        if (!file.editable) button.classList.add("is-readonly");
        button.addEventListener("click", () => {
          filesHost.querySelectorAll(".dlc-item-file").forEach((other) => other.classList.toggle("is-active", other === button));
          void loadFile(file.path);
        });
        filesHost.appendChild(button);
      });
      const first = files.find((file) => file.editable) || files[0];
      if (first) {
        filesHost.querySelector(".dlc-item-file")?.classList.add("is-active");
        void loadFile(first.path);
      }
    } catch (error) {
      filesHost.innerHTML = "";
      const failed = document.createElement("span");
      failed.className = "settings-field-hint";
      failed.textContent = error?.message || "Could not list files.";
      filesHost.appendChild(failed);
    }
  }

  async function openDeckPreview(item) {
    document.querySelector(".dlc-deck-preview-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "dlc-settings-overlay dlc-deck-preview-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="dlc-settings-overlay-panel dlc-deck-preview-panel">
        <div class="dlc-settings-overlay-head">
          <strong>Preview ${escapeHtml(item.title || item.name)}</strong>
          <button type="button" class="dlc-shop-btn" data-action="close">Close</button>
        </div>
        <div class="dlc-deck-preview-body">
          <div class="dlc-deck-preview-stage"><img data-role="image" alt="${escapeHtml(item.title || item.name)}" /></div>
          <div class="dlc-deck-preview-controls">
            <button type="button" class="dlc-shop-btn" data-action="prev">◀ Prev</button>
            <span class="dlc-deck-preview-counter" data-role="counter">—</span>
            <button type="button" class="dlc-shop-btn" data-action="next">Next ▶</button>
            <span class="dlc-deck-preview-file settings-field-hint" data-role="file"></span>
          </div>
          <div class="settings-field-hint" data-role="status">Loading deck…</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('[data-action="close"]').addEventListener("click", close);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) close();
    });

    const img = overlay.querySelector('[data-role="image"]');
    const counter = overlay.querySelector('[data-role="counter"]');
    const fileLabel = overlay.querySelector('[data-role="file"]');
    const statusEl = overlay.querySelector('[data-role="status"]');
    const prevBtn = overlay.querySelector('[data-action="prev"]');
    const nextBtn = overlay.querySelector('[data-action="next"]');
    let images = [];
    let index = 0;

    const service = window.TarotDataService;
    const itemQuery = `kind=deck&name=${encodeURIComponent(item.name)}&sourceId=${encodeURIComponent(item.sourceId || "")}`;

    const renderImage = () => {
      const file = images[index];
      if (!file) return;
      const params = new URLSearchParams({ kind: "deck", name: item.name, sourceId: item.sourceId || "", path: file.path });
      const apiKey = service.getApiKey?.();
      if (apiKey) params.set("apiKey", apiKey);
      img.src = `${service.buildApiUrl("/api/v1/admin/dlc/deck/image")}?${params.toString()}`;
      counter.textContent = `${index + 1} / ${images.length}`;
      fileLabel.textContent = file.name;
    };
    const step = (delta) => {
      if (!images.length) return;
      index = (index + delta + images.length) % images.length;
      renderImage();
    };
    prevBtn.addEventListener("click", () => step(-1));
    nextBtn.addEventListener("click", () => step(1));

    document.addEventListener("keydown", function onKey(event) {
      if (event.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        close();
      } else if (event.key === "ArrowLeft") {
        step(-1);
      } else if (event.key === "ArrowRight") {
        step(1);
      }
    });

    img.addEventListener("error", () => {
      statusEl.textContent = "Could not load this card image.";
    });

    try {
      const result = await requestJson("GET", `/api/v1/admin/dlc/deck/preview?${itemQuery}`);
      images = Array.isArray(result?.images) ? result.images : [];
      if (!images.length) {
        statusEl.textContent = "No card images found in this deck.";
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
      }
      statusEl.textContent = `${images.length} image(s) · ${result?.materialized ? "from local checkout" : "from repository"}`;
      renderImage();
    } catch (error) {
      statusEl.textContent = error?.message || "Could not load deck preview.";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
    }
  }

  function promptDeleteScope(item) {
    return new Promise((resolve) => {
      document.querySelector(".dlc-delete-overlay")?.remove();
      const overlay = document.createElement("div");
      overlay.className = "dlc-settings-overlay dlc-delete-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.innerHTML = `
        <div class="dlc-settings-overlay-panel dlc-delete-panel">
          <div class="dlc-settings-overlay-head">
            <strong>Delete ${escapeHtml(item.title || item.name)}</strong>
          </div>
          <div class="dlc-install-overlay-body">
            <p>Remove this ${escapeHtml(item.kind)}?</p>
            <p class="settings-field-hint">${item?.downloaded === true
              ? "Deleting from the repository commits the removal and pushes it to the source branch. The local copy is removed either way."
              : "This item is only in the repository; deleting commits the removal and pushes it to the source branch."}</p>
            <div class="dlc-shop-actions">
              ${item?.downloaded === true ? '<button type="button" class="dlc-shop-btn" data-action="local">Delete locally</button>' : ""}
              <button type="button" class="dlc-shop-btn is-danger" data-action="repo">Delete from repository</button>
              <button type="button" class="dlc-shop-btn" data-action="cancel">Cancel</button>
            </div>
          </div>
        </div>`;
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector('[data-action="local"]')?.addEventListener("click", () => finish("local"));
      overlay.querySelector('[data-action="repo"]').addEventListener("click", () => finish("repo"));
      overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => finish(null));
      overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) finish(null);
      });
      document.addEventListener("keydown", function onKey(event) {
        if (event.key === "Escape") {
          document.removeEventListener("keydown", onKey);
          finish(null);
        }
      });
      document.body.appendChild(overlay);
    });
  }

  async function deleteDlcItem(item) {
    const scope = await promptDeleteScope(item);
    if (!scope) return;
    const fromRepo = scope === "repo";
    setStatus(fromRepo ? `Deleting ${item.name} from the repository…` : `Deleting ${item.name}…`);
    try {
      const result = await requestJson("POST", "/api/v1/admin/dlc/delete", {
        kind: item.kind,
        name: item.name,
        id: item.id || "",
        sourceId: item.sourceId || "",
        fromRepo
      });
      setStatus(result?.note || `${fromRepo ? "Removed from repository" : "Deleted"} ${item.name}.`);
      await loadPlugins();
    } catch (error) {
      setStatus(`Could not delete ${item.name}. ${error?.message || ""}`, true);
    }
  }

  // --- Tabs ------------------------------------------------------------------

  function activateTab(tabId) {
    document.querySelectorAll(".admin-tab").forEach((tab) => {
      const active = tab.id === tabId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    const panelIds = ["overview", "clients", "tiers", "plugins", "server"];
    panelIds.forEach((panelId) => {
      const panel = document.getElementById(`admin-panel-${panelId}`);
      if (panel) {
        panel.hidden = panelId !== tabId.split("-").pop();
      }
    });
  }

  function bindTabs() {
    ["overview", "clients", "tiers", "plugins", "server"].forEach((panelId) => {
      const tab = document.getElementById(`admin-tab-${panelId}`);
      if (tab) {
        tab.addEventListener("click", () => activateTab(`admin-tab-${panelId}`));
      }
    });
    const backBtn = document.getElementById("close-admin");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        document.getElementById("open-home")?.click();
      });
    }
  }

  // --- Overview --------------------------------------------------------------

  function createStatCard(label, value, hint) {
    const card = document.createElement("div");
    card.className = "admin-stat-card";
    card.innerHTML = `
      <span class="admin-stat-label">${escapeHtml(label)}</span>
      <strong class="admin-stat-value">${escapeHtml(value)}</strong>
      ${hint ? `<span class="admin-stat-hint">${escapeHtml(hint)}</span>` : ""}
    `;
    return card;
  }

  function renderJobs(jobs) {
    const hosts = [
      document.getElementById("admin-jobs-overview"),
      document.getElementById("admin-jobs-server")
    ].filter(Boolean);
    const activeJobs = (Array.isArray(jobs) ? jobs : []).filter((job) => {
      const state = String(job?.state || "idle");
      if (state === "running" || state === "error") return true;
      return state === "done" && String(job.id || "") === "thumbs";
    });
    hosts.forEach((host) => {
      host.hidden = activeJobs.length === 0;
      host.replaceChildren();
      activeJobs.forEach((job) => {
        const card = document.createElement("div");
        card.className = "admin-job-card";
        const total = Number(job.total) || 0;
        const done = Number(job.done) || 0;
        const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : (job.state === "done" ? 100 : 0);
        const detail = [job.current, job.message].filter(Boolean).join(" · ");
        card.innerHTML = `
          <div class="admin-job-head">
            <strong>${escapeHtml(job.label || job.id || "Job")}</strong>
            <span class="admin-job-state is-${escapeHtml(job.state || "idle")}">${escapeHtml(job.state || "idle")}${total ? ` ${done}/${total}` : ""}</span>
          </div>
          <div class="admin-job-bar"><span style="width:${percent}%"></span></div>
          ${detail ? `<span class="admin-job-message">${escapeHtml(detail)}</span>` : ""}
        `;
        host.appendChild(card);
      });
    });
  }

  async function loadOverview() {
    const { overviewGrid } = getElements();
    if (!overviewGrid) return;
    try {
      const [overview, health] = await Promise.all([
        requestJson("GET", "/api/v1/admin/overview"),
        requestJson("GET", "/api/v1/health").catch(() => null)
      ]);
      overviewGrid.innerHTML = "";
      const uptimeSeconds = Number(health?.uptimeSeconds);
      const uptimeHint = Number.isFinite(uptimeSeconds) && uptimeSeconds >= 0
        ? (uptimeSeconds < 120
          ? `up ${Math.round(uptimeSeconds)}s`
          : uptimeSeconds < 7200
            ? `up ${Math.round(uptimeSeconds / 60)}m`
            : `up ${(uptimeSeconds / 3600).toFixed(1)}h`)
        : "online";
      overviewGrid.appendChild(createStatCard("Server", `kabbak-api v${health?.version || "?"}`, uptimeHint));
      overviewGrid.appendChild(createStatCard("GUI", `v${window.KABBAK_GUI_VERSION || "?"}`, window.TarotDataService?.getApiBaseUrl?.() || ""));
      const limits = overview?.limits || {};
      overviewGrid.appendChild(createStatCard(
        "Upload Limits",
        limits.pluginUploadBytes ? `${Math.round(limits.pluginUploadBytes / 1048576)}MB plugin upload` : "--",
        `request body: ${limits.jsonBodyLimit || "?"}`
      ));
      overviewGrid.appendChild(createStatCard("Users", String(overview?.counts?.apiClients ?? "--"), `${overview?.counts?.registryOnline ?? 0} online now`));
      overviewGrid.appendChild(createStatCard("Installed Plugins", String(overview?.counts?.installedPlugins ?? "--"), overview?.installedPlugins?.map((p) => p.name).join(", ") || ""));
      overviewGrid.appendChild(createStatCard("DLC Catalog", overview?.catalog?.origin || "--", `${overview?.catalog?.items ?? 0} items`));
      const counts = overview?.catalog?.counts || {};
      overviewGrid.appendChild(createStatCard("Catalog Breakdown", Object.keys(counts).length ? Object.entries(counts).map(([kind, count]) => `${kind}: ${count}`).join(" · ") : "--", ""));
      overviewGrid.appendChild(createStatCard("DLC Repo", overview?.dlcRepo?.present ? "checked out" : "missing", overview?.dlcRepo?.present ? `${overview.dlcRepo.branch || "?"} · ${overview.dlcRepo.url || ""}` : "run dlc init"));
      overviewGrid.appendChild(createStatCard("Server Time", String(overview?.serverTime || "").replace("T", " ").slice(0, 19), ""));
      renderJobs(overview?.jobs);
      setStatus("Admin overview loaded.");
    } catch (error) {
      setStatus(`Could not load overview. ${error?.message || ""}`, true);
      overviewGrid.innerHTML = "";
      const errorCard = document.createElement("div");
      errorCard.className = "admin-stat-card";
      errorCard.innerHTML = `
        <span class="admin-stat-label">Error</span>
        <strong class="admin-stat-value">${escapeHtml(error?.message || "Unknown error")}</strong>
        <div class="dlc-shop-actions" style="margin-top:6px;">
          <button type="button" class="dlc-shop-btn" data-action="retry">Retry</button>
        </div>
      `;
      errorCard.querySelector('[data-action="retry"]').addEventListener("click", () => {
        void loadOverview();
      });
      overviewGrid.appendChild(errorCard);
    }
  }

  // --- API Clients -----------------------------------------------------------

  async function loadClients() {
    const { clientsTable } = getElements();
    if (!clientsTable) return;
    try {
      const payload = await requestJson("GET", "/api/v1/admin/users");
      const clients = Array.isArray(payload?.users) ? payload.users : [];
      clientsTable.innerHTML = "";
      if (!clients.length) {
        const empty = document.createElement("span");
        empty.className = "settings-field-hint";
        empty.textContent = "No users yet.";
        clientsTable.appendChild(empty);
        return;
      }
      clients.forEach((client) => {
        const row = document.createElement("div");
        row.className = "admin-client-row";
        row.dataset.clientId = client.id;
        const displayName = client.displayName || client.name || client.id;
        const isOnline = client.status === "online";
        const lastSeen = client.lastSeen ? String(client.lastSeen).replace("T", " ").slice(0, 19) : "never seen";
        const tiersText = (client.roles || []).map((role) => escapeHtml(role)).join(" · ");
        row.innerHTML = `
          <span class="admin-user-status ${isOnline ? "is-online" : ""}">${isOnline ? "●" : "○"}</span>
          <div class="admin-client-main">
            <strong>${escapeHtml(displayName)}</strong>
            <span class="admin-client-id">${escapeHtml(client.id)}</span>
            ${client.bio ? `<span class="admin-user-bio">${escapeHtml(String(client.bio).slice(0, 160))}</span>` : ""}
          </div>
          <span class="admin-client-access">${escapeHtml(client.accessLevel || "—")}</span>
          ${tiersText ? `<span class="admin-role-caps">${tiersText}</span>` : ""}
          <span class="admin-client-key-preview">${escapeHtml(client.keyPreview || (client.hasKey ? "•••" : "no key"))}</span>
          <span class="admin-user-last-seen">${escapeHtml(lastSeen)}</span>
          <div class="admin-client-actions">
            <button type="button" class="dlc-shop-btn" data-action="edit">Edit</button>
            <button type="button" class="dlc-shop-btn" data-action="reset">Reset Key</button>
            <button type="button" class="dlc-shop-btn" data-action="delete">Delete</button>
          </div>
        `;
        row.querySelector('[data-action="reset"]').addEventListener("click", async () => {
          if (!window.confirm(`Reset the API key for ${client.id}? The old key stops working immediately and the new key is shown only once.`)) return;
          try {
            const result = await requestJson("POST", `/api/v1/admin/api-clients/${encodeURIComponent(client.id)}/rotate-key`);
            setStatus(`Key reset for ${client.id}.`);
            showKeyOnce(result?.apiKey, `New ${client.id}`);
            await loadClients();
          } catch (error) {
            setStatus(`Could not reset key. ${error?.message || ""}`, true);
          }
        });
        row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
          if (!window.confirm(`Delete user ${client.id}? Their key, profile, and API access stop immediately.`)) return;
          try {
            await requestJson("DELETE", `/api/v1/admin/api-clients/${encodeURIComponent(client.id)}`);
            setStatus(`Deleted ${client.id}.`);
            await loadClients();
          } catch (error) {
            setStatus(`Could not delete user. ${error?.message || ""}`, true);
          }
        });
        row.querySelector('[data-action="edit"]').addEventListener("click", () => openClientEditor(row, client));
        clientsTable.appendChild(row);
      });

      setStatus(`Users loaded (${clients.length}).`);
    } catch (error) {
      setStatus(`Could not load users. ${error?.message || ""}`, true);
    }
  }

  function openClientEditor(rowEl, client) {
    const existing = rowEl.querySelector(".admin-client-editor");
    if (existing) {
      existing.remove();
      return;
    }
    const editor = document.createElement("div");
    editor.className = "admin-client-editor";
    editor.innerHTML = `
      <input type="text" class="admin-client-edit-name" maxlength="100" value="${escapeHtml(client.name || "")}" placeholder="Name">
      <select class="admin-client-edit-access">
        <option value="basic"${client.accessLevel === "basic" ? " selected" : ""}>basic</option>
        <option value="premium"${client.accessLevel === "premium" ? " selected" : ""}>premium</option>
        <option value="pro+"${client.accessLevel === "pro+" ? " selected" : ""}>pro+</option>
      </select>
      <input type="text" class="admin-client-edit-roles" maxlength="300" value="${escapeHtml((client.roles || []).join(", "))}" placeholder="Tiers (comma separated)">
      <button type="button" class="dlc-shop-btn" data-action="save">Save</button>
      <button type="button" class="dlc-shop-btn" data-action="cancel">Cancel</button>
    `;
    editor.querySelector('[data-action="save"]').addEventListener("click", async () => {
      const name = editor.querySelector(".admin-client-edit-name").value.trim();
      const accessLevel = editor.querySelector(".admin-client-edit-access").value;
      const roles = editor.querySelector(".admin-client-edit-roles").value
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean);
      try {
        await requestJson("PATCH", `/api/v1/admin/api-clients/${encodeURIComponent(client.id)}`, { name, accessLevel, roles });
        setStatus(`Updated ${client.id}.`);
        editor.remove();
        await loadClients();
      } catch (error) {
        setStatus(`Could not update client. ${error?.message || ""}`, true);
      }
    });
    editor.querySelector('[data-action="cancel"]').addEventListener("click", () => editor.remove());
    rowEl.appendChild(editor);
  }

  function bindClientCreate() {
    const { clientCreateBtn } = getElements();
    if (!clientCreateBtn) return;
    clientCreateBtn.addEventListener("click", async () => {
      const { clientNameEl, clientIdEl, clientAccessEl, clientKeyEl } = getElements();
      const rolesEl = document.getElementById("admin-client-roles");
      const body = {
        name: String(clientNameEl?.value || "").trim(),
        accessLevel: String(clientAccessEl?.value || "premium")
      };
      if (rolesEl?.value.trim()) {
        body.roles = rolesEl.value.split(",").map((role) => role.trim()).filter(Boolean);
      }
      if (clientIdEl?.value.trim()) body.id = clientIdEl.value.trim();
      if (clientKeyEl?.value.trim()) body.key = clientKeyEl.value.trim();
      clientCreateBtn.disabled = true;
      try {
        const result = await requestJson("POST", "/api/v1/admin/api-clients", body);
        setStatus(`Created client ${result?.client?.id || ""}.`);
        showKeyOnce(result?.apiKey, `New ${result?.client?.id || "client"}`);
        if (clientIdEl) clientIdEl.value = "";
        if (clientKeyEl) clientKeyEl.value = "";
        if (rolesEl) rolesEl.value = "";
        await loadClients();
      } catch (error) {
        setStatus(`Could not create client. ${error?.message || ""}`, true);
      } finally {
        clientCreateBtn.disabled = false;
      }
    });
  }

  // --- Roles -----------------------------------------------------------------

  const LIMIT_FIELDS = [
    { key: "notes", label: "Max notebook entries", step: 1, isBytes: false },
    { key: "attachmentsPerScene", label: "Attachments per scene", step: 1, isBytes: false },
    { key: "attachmentBytes", label: "Max attachment size (MB)", step: 1, isBytes: true },
    { key: "storageBytes", label: "Storage quota (MB)", step: 5, isBytes: true }
  ];

  function formatBytesMb(bytesValue) {
    const numeric = Number(bytesValue);
    if (!Number.isFinite(numeric) || numeric <= 0) return "";
    return String(Math.round((numeric / (1024 * 1024)) * 100) / 100);
  }

  function formatPrice(price) {
    const amount = Number(price?.amount);
    const currency = String(price?.currency || "").trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      return price?.providerPlanId ? `plan: ${price.providerPlanId}` : "";
    }
    const amountText = `${currency} ${amount}`;
    return price?.providerPlanId ? `${amountText} · ${price.providerPlanId}` : amountText;
  }

  function renderRoleFlagInputs({ capabilities = [], limitKeys = [], defaultLimits = {} }, overrides = null) {
    const { roleCapabilitiesEl, roleLimitsEl } = getElements();
    if (!roleCapabilitiesEl || !roleLimitsEl) return;

    roleCapabilitiesEl.innerHTML = "";
    capabilities.forEach((capability) => {
      const label = document.createElement("label");
      label.className = "admin-role-flag";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = capability;
      checkbox.dataset.capability = capability;
      if (overrides?.capabilities?.includes(capability)) {
        checkbox.checked = true;
      }
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(capability));
      roleCapabilitiesEl.appendChild(label);
    });

    roleLimitsEl.innerHTML = "";
    LIMIT_FIELDS.forEach((field) => {
      if (!limitKeys.includes(field.key)) return;
      const label = document.createElement("label");
      label.className = "settings-field";
      const text = document.createElement("span");
      text.textContent = field.label;
      label.appendChild(text);
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.step = String(field.step);
      input.dataset.limitKey = field.key;
      input.dataset.isBytes = field.isBytes ? "1" : "0";
      let displayValue = "";
      if (overrides?.limits?.[field.key] != null) {
        displayValue = field.isBytes
          ? formatBytesMb(overrides.limits[field.key])
          : String(overrides.limits[field.key]);
      } else if (defaultLimits?.[field.key] != null) {
        displayValue = field.isBytes
          ? formatBytesMb(defaultLimits[field.key])
          : String(defaultLimits[field.key]);
      }
      input.value = displayValue;
      label.appendChild(input);
      roleLimitsEl.appendChild(label);
    });
  }

  function readRoleForm() {
    const { roleIdEl, roleLabelEl, roleAccessEl, roleDescriptionEl, rolePriceEl, roleCurrencyEl, roleProviderPlanEl } = getElements();
    const capabilities = Array.from(
      document.querySelectorAll("#admin-role-capabilities input[type='checkbox']")
    )
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
    const limits = {};
    document.querySelectorAll("#admin-role-limits input[type='number']").forEach((input) => {
      const key = input.dataset.limitKey;
      const numeric = Number(input.value);
      if (!key || !Number.isFinite(numeric) || numeric <= 0) return;
      limits[key] = input.dataset.isBytes === "1"
        ? Math.floor(numeric * 1024 * 1024)
        : Math.floor(numeric);
    });
    return {
      id: String(roleIdEl?.value || "").trim(),
      label: String(roleLabelEl?.value || "").trim(),
      description: String(roleDescriptionEl?.value || "").trim(),
      accessLevel: String(roleAccessEl?.value || ""),
      capabilities,
      limits,
      price: {
        amount: Number(rolePriceEl?.value) || 0,
        currency: String(roleCurrencyEl?.value || "USD"),
        providerPlanId: String(roleProviderPlanEl?.value || "").trim()
      }
    };
  }

  function renderRoleCard(role, catalog) {
    const card = document.createElement("div");
    card.className = "admin-role-card";
    const limitsText = Object.entries(role.limits || {})
      .map(([key, value]) => {
        const isBytes = key === "attachmentBytes" || key === "storageBytes";
        return `${key}=${isBytes ? `${formatBytesMb(value)}MB` : value}`;
      })
      .join(" · ");
    const priceText = formatPrice(role.price);
    card.innerHTML = `
      <div class="admin-role-main">
        <div class="dlc-plugin-name-row">
          <strong>${escapeHtml(role.label || role.id)}</strong>
          <span class="admin-client-id">${escapeHtml(role.id)}</span>
          ${role.accessLevel ? `<span class="admin-client-access">${escapeHtml(role.accessLevel)}</span>` : ""}
          ${priceText ? `<span class="admin-tier-price">${escapeHtml(priceText)}</span>` : ""}
        </div>
        ${role.description ? `<span class="admin-role-description">${escapeHtml(role.description)}</span>` : ""}
        ${(role.capabilities || []).length ? `<span class="admin-role-caps">${(role.capabilities || []).map((cap) => escapeHtml(cap)).join(" · ")}</span>` : ""}
        ${limitsText ? `<span class="admin-role-limits-text">${escapeHtml(limitsText)}</span>` : ""}
      </div>
      <div class="admin-client-actions">
        <button type="button" class="dlc-shop-btn" data-action="edit">Edit</button>
        <button type="button" class="dlc-shop-btn" data-action="delete">Delete</button>
      </div>
    `;
    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      openRoleEditor(card, role, catalog);
    });
    card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (!window.confirm(`Delete tier '${role.id}'? Clients keep working; they just lose this tier's grants.`)) return;
      try {
        await requestJson("DELETE", `/api/v1/admin/roles/${encodeURIComponent(role.id)}`);
        setStatus(`Deleted tier ${role.id}.`);
        await loadTiers();
      } catch (error) {
        setStatus(`Could not delete tier. ${error?.message || ""}`, true);
      }
    });
    return card;
  }

  async function loadTiers() {
    const { rolesListEl, levelsListEl } = getElements();
    let catalog = { baseTiers: [], customTiers: [], capabilities: [], limitKeys: [], defaultLimits: {} };
    try {
      catalog = await requestJson("GET", "/api/v1/admin/tiers");
    } catch (error) {
      setStatus(`Could not load tiers. ${error?.message || ""}`, true);
      return;
    }
    renderRoleFlagInputs(catalog, null);

    if (levelsListEl) {
      levelsListEl.innerHTML = "";
      (catalog.baseTiers || []).forEach((level) => {
        levelsListEl.appendChild(renderLevelCard(level, catalog));
      });
    }

    if (rolesListEl) {
      rolesListEl.innerHTML = "";
      if (!catalog.customTiers?.length) {
        const empty = document.createElement("span");
        empty.className = "settings-field-hint";
        empty.textContent = "No custom tiers yet. Create one above (e.g. a Patreon-style subscriber tier).";
        rolesListEl.appendChild(empty);
      } else {
        catalog.customTiers.forEach((tier) => {
          rolesListEl.appendChild(renderRoleCard(tier, catalog));
        });
      }
    }

    setStatus(`Tiers loaded (${catalog.baseTiers?.length || 0} base, ${catalog.customTiers?.length || 0} custom).`);
  }

  function renderLevelCard(level, catalog) {
    const card = document.createElement("div");
    card.className = "admin-role-card";
    const limitsText = Object.entries(level.limits || {})
      .map(([key, value]) => {
        const isBytes = key === "attachmentBytes" || key === "storageBytes";
        return `${key}=${isBytes ? `${formatBytesMb(value)}MB` : value}`;
      })
      .join(" · ");
    const capabilityText = [(level.roles || []).map((role) => `role:${role}`), (level.scopes || []).map((scope) => `scope:${scope}`)]
      .flat()
      .filter(Boolean)
      .join(" · ");
    const priceText = formatPrice(level.price);
    card.innerHTML = `
      <div class="admin-role-main">
        <div class="dlc-plugin-name-row">
          <strong>${escapeHtml(level.label || level.id)}</strong>
          <span class="admin-client-id">${escapeHtml(level.id)}</span>
          ${priceText ? `<span class="admin-tier-price">${escapeHtml(priceText)}</span>` : ""}
        </div>
        ${level.description ? `<span class="admin-role-description">${escapeHtml(level.description)}</span>` : ""}
        ${capabilityText ? `<span class="admin-role-caps">${escapeHtml(capabilityText)}</span>` : ""}
        ${limitsText ? `<span class="admin-role-limits-text">${escapeHtml(limitsText)}</span>` : ""}
      </div>
      <div class="admin-client-actions">
        <button type="button" class="dlc-shop-btn" data-action="edit">Edit</button>
      </div>
    `;
    card.querySelector('[data-action="edit"]').addEventListener("click", () => {
      openLevelEditor(card, level, catalog);
    });
    return card;
  }

  function openLevelEditor(cardEl, level, catalog) {
    const existing = cardEl.querySelector(".admin-role-editor");
    if (existing) {
      existing.remove();
      return;
    }
    const editor = document.createElement("div");
    editor.className = "admin-role-editor";
    editor.innerHTML = `
      <input type="text" class="admin-level-edit-label" maxlength="80" value="${escapeHtml(level.label || "")}" placeholder="Label">
      <input type="text" class="admin-level-edit-description" maxlength="400" value="${escapeHtml(level.description || "")}" placeholder="What this tier does">
      <input type="text" class="admin-level-edit-roles" maxlength="300" value="${escapeHtml((level.roles || []).join(", "))}" placeholder="Default roles (comma separated)">
      <input type="text" class="admin-level-edit-scopes" maxlength="300" value="${escapeHtml((level.scopes || []).join(", "))}" placeholder="Default scopes (comma separated)">
      <div class="admin-tier-price-row">
        <input type="number" class="admin-level-edit-price" min="0" step="0.01" value="${escapeHtml(level.price?.amount ?? "")}" placeholder="Price">
        <select class="admin-level-edit-currency">
          ${(catalog?.currencies || ["USD"]).map((currency) => `<option value="${escapeHtml(currency)}"${(level.price?.currency || "USD") === currency ? " selected" : ""}>${escapeHtml(currency)}</option>`).join("")}
        </select>
        <input type="text" class="admin-level-edit-provider-plan" maxlength="120" value="${escapeHtml(level.price?.providerPlanId || "")}" placeholder="Provider plan id (future billing)">
      </div>
      <button type="button" class="dlc-shop-btn" data-action="save">Save</button>
      <button type="button" class="dlc-shop-btn" data-action="cancel">Cancel</button>
    `;

    const limitsWrap = document.createElement("div");
    limitsWrap.className = "admin-role-limits";
    LIMIT_FIELDS.forEach((field) => {
      if (!catalog?.limitKeys?.includes(field.key)) return;
      const label = document.createElement("label");
      label.className = "settings-field";
      const text = document.createElement("span");
      text.textContent = field.label;
      label.appendChild(text);
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.step = String(field.step);
      input.dataset.limitKey = field.key;
      input.dataset.isBytes = field.isBytes ? "1" : "0";
      const value = level.limits?.[field.key] ?? catalog.defaultLimits?.[field.key];
      input.value = field.isBytes ? (formatBytesMb(value) || "") : String(value ?? "");
      label.appendChild(input);
      limitsWrap.appendChild(label);
    });
    editor.appendChild(limitsWrap);

    editor.querySelector('[data-action="save"]').addEventListener("click", async () => {
      const limits = {};
      limitsWrap.querySelectorAll("input[type='number']").forEach((input) => {
        const key = input.dataset.limitKey;
        const numeric = Number(input.value);
        if (!key || !Number.isFinite(numeric) || numeric <= 0) return;
        limits[key] = input.dataset.isBytes === "1"
          ? Math.floor(numeric * 1024 * 1024)
          : Math.floor(numeric);
      });
      const splitList = (value) => value.split(",").map((entry) => entry.trim()).filter(Boolean);
      const payload = {
        label: editor.querySelector(".admin-level-edit-label").value.trim(),
        description: editor.querySelector(".admin-level-edit-description").value.trim(),
        roles: splitList(editor.querySelector(".admin-level-edit-roles").value),
        scopes: splitList(editor.querySelector(".admin-level-edit-scopes").value),
        limits,
        price: {
          amount: Number(editor.querySelector(".admin-level-edit-price").value) || 0,
          currency: editor.querySelector(".admin-level-edit-currency").value || "USD",
          providerPlanId: editor.querySelector(".admin-level-edit-provider-plan").value.trim()
        }
      };
      try {
        await requestJson("PUT", `/api/v1/admin/access-levels/${encodeURIComponent(level.id)}`, payload);
        setStatus(`Saved ${level.id} access level.`);
        editor.remove();
        await loadTiers();
      } catch (error) {
        setStatus(`Could not save access level. ${error?.message || ""}`, true);
      }
    });
    editor.querySelector('[data-action="cancel"]').addEventListener("click", () => editor.remove());
    cardEl.appendChild(editor);
  }

  function openRoleEditor(cardEl, role, catalog) {
    const existing = cardEl.querySelector(".admin-role-editor");
    if (existing) {
      existing.remove();
      return;
    }
    const editor = document.createElement("div");
    editor.className = "admin-role-editor";
    editor.innerHTML = `
      <input type="text" class="admin-role-edit-label" maxlength="80" value="${escapeHtml(role.label || "")}" placeholder="Label">
      <select class="admin-role-edit-access">
        <option value=""${!role.accessLevel ? " selected" : ""}>(inherit rank)</option>
        <option value="basic"${role.accessLevel === "basic" ? " selected" : ""}>basic</option>
        <option value="premium"${role.accessLevel === "premium" ? " selected" : ""}>premium</option>
        <option value="pro+"${role.accessLevel === "pro+" ? " selected" : ""}>pro+</option>
      </select>
      <input type="text" class="admin-role-edit-description" maxlength="400" value="${escapeHtml(role.description || "")}" placeholder="Description">
      <div class="admin-tier-price-row">
        <input type="number" class="admin-role-edit-price" min="0" step="0.01" value="${escapeHtml(role.price?.amount ?? "")}" placeholder="Price">
        <select class="admin-role-edit-currency">
          ${(catalog?.currencies || ["USD"]).map((currency) => `<option value="${escapeHtml(currency)}"${(role.price?.currency || "USD") === currency ? " selected" : ""}>${escapeHtml(currency)}</option>`).join("")}
        </select>
        <input type="text" class="admin-role-edit-provider-plan" maxlength="120" value="${escapeHtml(role.price?.providerPlanId || "")}" placeholder="Provider plan id (future billing)">
      </div>
      <button type="button" class="dlc-shop-btn" data-action="save">Save</button>
      <button type="button" class="dlc-shop-btn" data-action="cancel">Cancel</button>
    `;
    const capabilitiesWrap = document.createElement("div");
    capabilitiesWrap.className = "admin-role-flags";
    (catalog?.capabilities || []).forEach((capability) => {
      const label = document.createElement("label");
      label.className = "admin-role-flag";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = capability;
      checkbox.dataset.capability = capability;
      checkbox.checked = (role.capabilities || []).includes(capability);
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(capability));
      capabilitiesWrap.appendChild(label);
    });
    editor.appendChild(capabilitiesWrap);

    const limitsWrap = document.createElement("div");
    limitsWrap.className = "admin-role-limits";
    LIMIT_FIELDS.forEach((field) => {
      if (!catalog?.limitKeys?.includes(field.key)) return;
      const label = document.createElement("label");
      label.className = "settings-field";
      const text = document.createElement("span");
      text.textContent = field.label;
      label.appendChild(text);
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.step = String(field.step);
      input.dataset.limitKey = field.key;
      input.dataset.isBytes = field.isBytes ? "1" : "0";
      const value = role.limits?.[field.key] != null
        ? role.limits[field.key]
        : catalog.defaultLimits?.[field.key];
      input.value = field.isBytes ? (formatBytesMb(value) || "") : String(value ?? "");
      label.appendChild(input);
      limitsWrap.appendChild(label);
    });
    editor.appendChild(limitsWrap);

    editor.querySelector('[data-action="save"]').addEventListener("click", async () => {
      const capabilities = Array.from(capabilitiesWrap.querySelectorAll("input[type='checkbox']"))
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.value);
      const limits = {};
      limitsWrap.querySelectorAll("input[type='number']").forEach((input) => {
        const key = input.dataset.limitKey;
        const numeric = Number(input.value);
        if (!key || !Number.isFinite(numeric) || numeric <= 0) return;
        limits[key] = input.dataset.isBytes === "1"
          ? Math.floor(numeric * 1024 * 1024)
          : Math.floor(numeric);
      });
      const payload = {
        label: editor.querySelector(".admin-role-edit-label").value.trim(),
        description: editor.querySelector(".admin-role-edit-description").value.trim(),
        accessLevel: editor.querySelector(".admin-role-edit-access").value,
        capabilities,
        limits,
        price: {
          amount: Number(editor.querySelector(".admin-role-edit-price").value) || 0,
          currency: editor.querySelector(".admin-role-edit-currency").value || "USD",
          providerPlanId: editor.querySelector(".admin-role-edit-provider-plan").value.trim()
        }
      };
      try {
        await requestJson("PUT", `/api/v1/admin/roles/${encodeURIComponent(role.id)}`, payload);
        setStatus(`Saved tier ${role.id}.`);
        editor.remove();
        await loadTiers();
      } catch (error) {
        setStatus(`Could not save tier. ${error?.message || ""}`, true);
      }
    });
    editor.querySelector('[data-action="cancel"]').addEventListener("click", () => editor.remove());
    cardEl.appendChild(editor);
  }

  function bindRoleCreate() {
    const { roleCreateBtn, roleIdEl, roleLabelEl, rolePriceEl, roleProviderPlanEl } = getElements();
    if (!roleCreateBtn) return;
    roleCreateBtn.addEventListener("click", async () => {
      const form = readRoleForm();
      if (!form.id) {
        setStatus("Enter a tier id (e.g. mystic-moon).", true);
        return;
      }
      roleCreateBtn.disabled = true;
      try {
        await requestJson("PUT", `/api/v1/admin/roles/${encodeURIComponent(form.id)}`, {
          label: form.label,
          description: form.description,
          accessLevel: form.accessLevel,
          capabilities: form.capabilities,
          limits: form.limits,
          price: form.price
        });
        setStatus(`Created tier ${form.id}. Assign it to clients in the API Clients tab.`);
        if (roleIdEl) roleIdEl.value = "";
        if (roleLabelEl) roleLabelEl.value = "";
        if (rolePriceEl) rolePriceEl.value = "";
        if (roleProviderPlanEl) roleProviderPlanEl.value = "";
        await loadTiers();
      } catch (error) {
        setStatus(`Could not create tier. ${error?.message || ""}`, true);
      } finally {
        roleCreateBtn.disabled = false;
      }
    });
  }

  // --- Server settings & logs -------------------------------------------------

  async function loadServerSettings() {
    const {
      settingLogModeEl,
      settingAllowNullEl,
      settingOriginsEl,
      settingBodyLimitEl,
      settingPluginLimitMbEl,
      settingAutoMigrateEl,
      settingSecretEl,
      settingSecretStateEl,
      settingSecretClearEl,
      settingBrowserTitleEl,
      settingOverlayUrlEl,
      envReadonlyEl
    } = getElements();
    if (!settingLogModeEl) return;
    try {
      const settings = await requestJson("GET", "/api/v1/admin/settings");
      settingLogModeEl.value = settings?.requestLogMode === "all" || settings?.requestLogMode === "none"
        ? settings.requestLogMode
        : "errors";
      settingAllowNullEl.value = settings?.allowNullOrigin ? "true" : "false";
      if (settingOriginsEl) {
        settingOriginsEl.value = (settings?.allowedOrigins || []).join("\n");
      }
      if (settingBodyLimitEl) {
        settingBodyLimitEl.value = settings?.jsonBodyLimit || "";
      }
      if (settingPluginLimitMbEl) {
        const bytes = Number(settings?.pluginUploadLimitBytes);
        settingPluginLimitMbEl.value = Number.isFinite(bytes) && bytes > 0 ? String(Math.round(bytes / 1048576)) : "";
      }
      if (settingAutoMigrateEl) {
        settingAutoMigrateEl.value = settings?.autoMigrateEnabled ? "true" : "false";
      }
      if (settingSecretEl) {
        settingSecretEl.value = "";
      }
      if (settingSecretStateEl) {
        settingSecretStateEl.textContent = settings?.profileEncryptionSecretSet
          ? "set — enter a new value to replace it, or clear it below"
          : "not set";
      }
      if (settingSecretClearEl) {
        settingSecretClearEl.checked = false;
      }
      if (settingBrowserTitleEl) {
        settingBrowserTitleEl.value = String(settings?.browserTitle || "");
      }
      if (settingOverlayUrlEl) {
        settingOverlayUrlEl.value = String(settings?.overlayBackgroundUrl || "");
      }
      if (envReadonlyEl) {
        const env = settings?.envOnly || {};
        envReadonlyEl.innerHTML = "";
        const rows = [
          ["Port", String(env.port ?? "?"), env.envVarNames?.port || "PORT"],
          ["Host", String(env.host ?? "?"), env.envVarNames?.host || "HOST"]
        ];
        rows.forEach(([label, value, envVar]) => {
          const row = document.createElement("div");
          row.className = "admin-env-row";
          row.innerHTML = `<span class="admin-env-label">${escapeHtml(label)} (restart-only)</span><span class="admin-env-value">${escapeHtml(value)}</span><span class="admin-env-var">${escapeHtml(envVar)}</span>`;
          envReadonlyEl.appendChild(row);
        });
      }
      setStatus("Server settings loaded.");
    } catch (error) {
      setStatus(`Could not load server settings. ${error?.message || ""}`, true);
    }
  }

  async function saveServerSettings() {
    const {
      settingLogModeEl,
      settingAllowNullEl,
      settingOriginsEl,
      settingBodyLimitEl,
      settingPluginLimitMbEl,
      settingAutoMigrateEl,
      settingSecretEl,
      settingSecretClearEl,
      settingBrowserTitleEl,
      settingOverlayUrlEl,
      settingsSaveBtn
    } = getElements();
    if (!settingsSaveBtn) return;
    settingsSaveBtn.disabled = true;
    try {
      const body = {
        requestLogMode: settingLogModeEl?.value || "errors",
        allowNullOrigin: settingAllowNullEl?.value === "true",
        allowedOrigins: String(settingOriginsEl?.value || "")
          .split(/[\r\n,;]+/)
          .map((entry) => entry.trim())
          .filter(Boolean),
        autoMigrateEnabled: settingAutoMigrateEl?.value === "true",
        browserTitle: String(settingBrowserTitleEl?.value || "").trim(),
        overlayBackgroundUrl: String(settingOverlayUrlEl?.value || "").trim()
      };
      const bodyLimit = String(settingBodyLimitEl?.value || "").trim();
      if (bodyLimit) {
        body.jsonBodyLimit = bodyLimit;
      }
      const pluginLimitMb = Number(settingPluginLimitMbEl?.value);
      if (Number.isFinite(pluginLimitMb) && pluginLimitMb > 0) {
        body.pluginUploadLimitBytes = Math.round(pluginLimitMb * 1048576);
      }
      const secret = String(settingSecretEl?.value || "").trim();
      if (settingSecretClearEl?.checked) {
        body.profileEncryptionSecret = null;
      } else if (secret) {
        body.profileEncryptionSecret = secret;
      }
      await requestJson("PATCH", "/api/v1/admin/settings", body);
      if (settingSecretEl) settingSecretEl.value = "";
      if (settingSecretClearEl) settingSecretClearEl.checked = false;
      // Apply the tab title to this browser immediately; everyone else gets it
      // on their next page load (the shell reads /api/v1/branding at boot).
      const savedTitle = String(body.browserTitle || "").trim();
      if (savedTitle) {
        document.title = savedTitle;
      } else {
        document.title = String(window.TarotAppConfig?.getBranding?.()?.title || "KABBAK");
      }
      window.TarotAppConfig?.applyOverlayBackground?.(
        body.overlayBackgroundUrl,
        window.TarotDataService?.getApiBaseUrl?.() || window.TarotAppConfig?.apiBaseUrl
      );
      await loadServerSettings();
      setStatus("Server settings saved — applied immediately.");
    } catch (error) {
      setStatus(`Could not save server settings. ${error?.message || ""}`, true);
    } finally {
      settingsSaveBtn.disabled = false;
    }
  }

  let logPollTimer = null;

  function syncLogSelect(selectEl, items, allLabel) {
    if (!selectEl) return;
    const current = String(selectEl.value || "");
    const nextItems = Array.isArray(items) ? items : [];
    const options = [`<option value="">${escapeHtml(allLabel)}</option>`].concat(
      nextItems.map((item) => {
        const id = String(item?.id || "").trim();
        if (!id) return "";
        const count = Number(item.count) || 0;
        return `<option value="${escapeHtml(id)}">${escapeHtml(id)}${count ? ` (${count})` : ""}</option>`;
      }).filter(Boolean)
    );
    selectEl.innerHTML = options.join("");
    if (current && [...selectEl.options].some((option) => option.value === current)) {
      selectEl.value = current;
    }
  }

  async function loadLogs() {
    const { logLevelEl, logGroupEl, logEventEl, logSinceEl, logSearchEl, logListEl } = getElements();
    if (!logListEl) return;
    try {
      const params = new URLSearchParams();
      params.set("level", String(logLevelEl?.value || "all"));
      params.set("limit", "300");
      const group = String(logGroupEl?.value || "").trim();
      const event = String(logEventEl?.value || "").trim();
      const query = String(logSearchEl?.value || "").trim();
      const sinceMinutes = String(logSinceEl?.value || "").trim();
      if (group) params.set("pathGroup", group);
      if (event) params.set("event", event);
      if (query) params.set("q", query);
      if (sinceMinutes) params.set("sinceMinutes", sinceMinutes);
      const [payload, jobsPayload] = await Promise.all([
        requestJson("GET", `/api/v1/admin/logs?${params.toString()}`),
        requestJson("GET", "/api/v1/admin/jobs").catch(() => null)
      ]);
      if (jobsPayload?.jobs) {
        renderJobs(jobsPayload.jobs);
      }
      const entries = Array.isArray(payload?.entries) ? payload.entries : [];
      const facets = payload?.facets && typeof payload.facets === "object" ? payload.facets : {};
      syncLogSelect(logGroupEl, facets.pathGroups, "All paths");
      syncLogSelect(logEventEl, facets.events, "All events");
      logListEl.innerHTML = "";
      if (!entries.length) {
        const empty = document.createElement("span");
        empty.className = "settings-field-hint";
        empty.textContent = "No log entries match these filters.";
        logListEl.appendChild(empty);
        return;
      }
      entries.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "admin-log-row";
        const levelClass = `is-${String(entry.level || "info")}`;
        const time = String(entry.timestamp || "").replace("T", " ").slice(5, 19);
        const meta = [entry.method, entry.statusCode || "", entry.path || ""].filter(Boolean).join(" ");
        row.innerHTML = `
          <span class="admin-log-level ${levelClass}">${escapeHtml(String(entry.level || "info").toUpperCase())}</span>
          <span class="admin-log-time">${escapeHtml(time)}</span>
          <span class="admin-log-group">${escapeHtml(entry.pathGroup || "")}</span>
          <span class="admin-log-event">${escapeHtml(entry.event || "")}</span>
          ${meta ? `<span class="admin-log-meta">${escapeHtml(meta)}</span>` : ""}
          <span class="admin-log-message">${escapeHtml(String(entry.message || "").slice(0, 400))}</span>
        `;
        logListEl.appendChild(row);
      });
    } catch (error) {
      // Silent for polling; surface once via status only on manual refresh.
    }
  }

  function syncLogPolling() {
    const { logAutoRefreshEl } = getElements();
    const activePanel = String(window.TarotSectionStateUi?.getActiveSection?.() || "");
    const shouldPoll = logAutoRefreshEl?.checked === true;
    if (shouldPoll && activePanel === "admin") {
      if (!logPollTimer) {
        logPollTimer = window.setInterval(() => {
          void loadLogs();
        }, 3000);
      }
    } else if (logPollTimer) {
      window.clearInterval(logPollTimer);
      logPollTimer = null;
    }
  }

  function bindServerControls() {
    const { logLevelEl, logGroupEl, logEventEl, logSinceEl, logSearchEl, logAutoRefreshEl, logRefreshBtn, logClearBtn, settingsSaveBtn } = getElements();
    if (settingsSaveBtn) {
      settingsSaveBtn.addEventListener("click", () => {
        void saveServerSettings();
      });
    }
    const { settingOverlayFileEl, settingOverlayClearEl, settingOverlayUrlEl } = getElements();
    if (settingOverlayFileEl) {
      settingOverlayFileEl.addEventListener("change", async () => {
        const file = settingOverlayFileEl.files?.[0];
        settingOverlayFileEl.value = "";
        if (!file) return;
        try {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error("Could not read image."));
            reader.readAsDataURL(file);
          });
          const payload = await requestJson("POST", "/api/v1/admin/overlay-background", { data: dataUrl });
          if (settingOverlayUrlEl) settingOverlayUrlEl.value = String(payload?.overlayBackgroundUrl || "");
          window.TarotAppConfig?.applyOverlayBackground?.(
            payload?.overlayBackgroundUrl,
            window.TarotDataService?.getApiBaseUrl?.() || window.TarotAppConfig?.apiBaseUrl
          );
          setStatus("Overlay background uploaded.");
        } catch (error) {
          setStatus(`Could not upload overlay. ${error?.message || ""}`, true);
        }
      });
    }
    if (settingOverlayClearEl) {
      settingOverlayClearEl.addEventListener("click", async () => {
        try {
          await requestJson("DELETE", "/api/v1/admin/overlay-background");
          if (settingOverlayUrlEl) settingOverlayUrlEl.value = "";
          window.TarotAppConfig?.applyOverlayBackground?.("");
          setStatus("Overlay background cleared.");
        } catch (error) {
          setStatus(`Could not clear overlay. ${error?.message || ""}`, true);
        }
      });
    }
    [logLevelEl, logGroupEl, logEventEl, logSinceEl].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", () => {
        void loadLogs();
      });
    });
    if (logSearchEl) {
      let searchTimer = null;
      logSearchEl.addEventListener("input", () => {
        if (searchTimer) window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
          searchTimer = null;
          void loadLogs();
        }, 300);
      });
    }
    if (logAutoRefreshEl) {
      logAutoRefreshEl.addEventListener("change", syncLogPolling);
    }
    if (logRefreshBtn) {
      logRefreshBtn.addEventListener("click", () => {
        void loadLogs();
      });
    }
    if (logClearBtn) {
      logClearBtn.addEventListener("click", async () => {
        try {
          await requestJson("DELETE", "/api/v1/admin/logs");
          setStatus("Log buffer cleared.");
          void loadLogs();
        } catch (error) {
          setStatus(`Could not clear logs. ${error?.message || ""}`, true);
        }
      });
    }
  }

  // --- Plugins & DLC ---------------------------------------------------------

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

  function createKindHeading(kind, count, options = {}) {
    const head = document.createElement("div");
    head.className = "dlc-kind-head";
    head.innerHTML = `<strong>${escapeHtml(KIND_LABELS[kind] || kind)}</strong><span>${Number(count) || 0}</span>`;
    if (typeof options.installAll === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dlc-shop-btn";
      button.textContent = "Install All";
      button.title = `Install every available ${KIND_LABELS[kind] || kind} item`;
      if (options.disabled) {
        button.disabled = true;
        button.title = `No ${KIND_LABELS[kind] || kind} items available to install`;
      }
      button.addEventListener("click", (event) => {
        event.preventDefault();
        void options.installAll(button);
      });
      head.appendChild(button);
    }
    return head;
  }

  async function installAvailableItems(items, { button, kindLabel }) {
    const targets = items.filter((item) => item?.status === "available");
    if (!targets.length) return;
    const kind = String(targets[0]?.kind || "").trim();

    const overlay = document.createElement("div");
    overlay.className = "dlc-settings-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div class="dlc-settings-overlay-panel">
        <div class="dlc-settings-overlay-head"><strong>Installing ${escapeHtml(kindLabel)}</strong></div>
        <div class="dlc-install-overlay-body">
          <p class="settings-field-hint">Installing ${targets.length} item(s). This runs on the server and keeps going if you close this window.</p>
          <p id="dlc-install-progress" class="settings-field-hint">Starting…</p>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    if (button) button.disabled = true;
    try {
      await requestJson("POST", "/api/v1/admin/dlc/install-all", { kind });
    } catch (error) {
      // The job may still be running; fall through to status polling.
    }

    const progressEl = overlay.querySelector("#dlc-install-progress");
    let lastState = "idle";
    for (let attempt = 0; attempt < 1200; attempt += 1) {
      let status = null;
      try {
        status = await requestJson("GET", "/api/v1/admin/dlc/install-status");
      } catch (_error) {
        break;
      }
      if (!status) break;
      lastState = status.state;
      if (status.state === "running") {
        progressEl.textContent = status.current === "storage snapshot"
          ? (status.message || "Refreshing storage snapshot…")
          : (status.total
            ? `Installing ${status.current || "…"} (${status.done}/${status.total})`
            : "Preparing…");
      } else if (status.state === "done") {
        progressEl.textContent = status.message || "Done.";
        document.dispatchEvent(new CustomEvent("content:updated"));
        break;
      } else if (status.state === "error") {
        progressEl.textContent = status.message || "Install failed.";
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    await window.TaroTimePluginHost?.refresh?.();
    await loadPlugins();
    if (button) button.disabled = false;

    if (lastState === "running") {
      progressEl.textContent = "Still installing in the background — it will finish on the server.";
    }
    setStatus(`Install All (${kindLabel}) finished on the server.`);
    setTimeout(() => overlay.remove(), 2200);
  }

  function createPluginCard({ title, description, version, badge, actionLabel, onAction }) {    const card = document.createElement("div");
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

  async function pollReloadStatus(onUpdate) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      let status = null;
      try {
        status = await requestJson("GET", "/api/v1/admin/dlc/reload-status");
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
      if (attempt === 0) {
        onUpdate?.("Refreshing storage snapshot…");
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    onUpdate?.("Storage refresh is still running. Changes will appear shortly.");
  }

  async function reloadStorageInBackground() {
    try {
      await requestJson("POST", "/api/v1/admin/dlc/reload");
    } catch (_error) {
      // The background reload may already be running; polling still works.
    }
  }

  let allDlcItems = [];
  let activeDlcFilter = "all";

  function syncDlcFilterButtons() {
    document.querySelectorAll("#admin-dlc-filter [data-dlc-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.dlcFilter === activeDlcFilter);
    });
  }

  function renderDlcCatalog() {
    const { dlcCatalogEl } = getElements();
    if (!dlcCatalogEl) return;
    dlcCatalogEl.innerHTML = "";

    const visibleItems = mergeCatalogItems(activeDlcFilter === "all"
      ? allDlcItems
      : allDlcItems.filter((item) => item?.kind === activeDlcFilter));

    if (!visibleItems.length) {
      const empty = document.createElement("span");
      empty.className = "settings-field-hint";
      empty.textContent = activeDlcFilter === "all"
        ? "The DLC catalog is empty."
        : `No ${KIND_LABELS[activeDlcFilter] || activeDlcFilter} in the catalog.`;
      dlcCatalogEl.appendChild(empty);
      return;
    }

    groupCatalogItems(visibleItems).forEach(([kind, items]) => {
      const availableCount = items.filter((item) => item?.status === "available").length;
      const installableKind = kind === "plugin" || kind === "api" || kind === "gui" || kind === "deck" || kind === "text" || kind === "reference";
      dlcCatalogEl.appendChild(createKindHeading(kind, items.length, installableKind
        ? { installAll: (button) => installAvailableItems(items, { button, kindLabel: KIND_LABELS[kind] || kind }), disabled: availableCount === 0 }
        : {}));
      items.forEach((item) => {
        const isInstalled = item?.status === "installed" || item?.status === "staged";
        const isPlugin = kind === "plugin" || kind === "api" || kind === "gui";
        const hasUpdate = isPlugin && item?.updateAvailable === true;
        const badge = item?.status === "staged"
          ? (isPlugin ? "plugin · staged" : "staged")
          : (isInstalled ? (isPlugin ? (hasUpdate ? "plugin · update available" : "plugin · installed") : "installed") : (isPlugin ? "plugin" : ""));

        const card = createPluginCard({
          title: item.title,
          description: item.description,
          version: hasUpdate ? `installed ${item.version} · latest ${item.latestVersion}` : item.version,
          badge,
          actionLabel: kind === "pack"
            ? (isInstalled ? "Uninstall Pack" : "")
            : (isInstalled ? "Uninstall" : "Install"),
          onAction: kind === "pack" && !isInstalled ? null : async (button) => {
            if (isInstalled && !window.confirm(`Uninstall '${item.title || item.name}' (${kind})?`)) return;
            button.disabled = true;
            try {
              await requestJson("POST", `/api/v1/dlc/${isInstalled ? "uninstall" : "install"}`, { kind: item.kind, name: item.name, id: item.id || "", sourceId: item.sourceId || "" });
              setStatus(isInstalled
                ? `Uninstalled ${item.name}. Refreshing storage…`
                : `Installing ${item.name}…`);
              await loadPlugins();
              if (isPlugin) {
                await window.TaroTimePluginHost?.refresh?.();
              } else {
                void pollReloadStatus((text, isError) => setStatus(text, isError));
              }
              setStatus(isInstalled ? `Uninstalled ${item.name}.` : `Installed ${item.name}.`);
            } catch (error) {
              setStatus(`Could not ${isInstalled ? "uninstall" : "install"} ${item.name}. ${error?.message || ""}`, true);
            } finally {
              button.disabled = false;
            }
          }
        });

        if (hasUpdate) {
          const updateBtn = document.createElement("button");
          updateBtn.type = "button";
          updateBtn.className = "dlc-shop-btn";
          updateBtn.textContent = "Update";
          updateBtn.title = `Update ${item.title || item.name} from ${item.version} to ${item.latestVersion}`;
          card.querySelector(".dlc-plugin-actions")?.appendChild(updateBtn);
          updateBtn.addEventListener("click", async () => {
            const changelogLines = (Array.isArray(item.changelog) ? item.changelog : [])
              .filter((entry) => entry?.version)
              .map((entry) => {
                const notes = (Array.isArray(entry.notes) ? entry.notes : []).join("; ");
                return `v${entry.version}${entry.date ? ` (${entry.date})` : ""}${notes ? ` — ${notes}` : ""}`;
              });
            const detail = changelogLines.length ? `\n\nChangelog:\n${changelogLines.join("\n")}` : "";
            if (!window.confirm(`Update '${item.title || item.name}' from v${item.version} to v${item.latestVersion}?${detail}`)) return;
            updateBtn.disabled = true;
            try {
              await requestJson("POST", "/api/v1/dlc/update", { kind: item.kind, name: item.name, sourceId: item.sourceId || "" });
              await window.TaroTimePluginHost?.refresh?.();
              await loadPlugins();
              setStatus(`Updated ${item.name}.`);
            } catch (error) {
              setStatus(`Could not update ${item.name}. ${error?.message || ""}`, true);
            } finally {
              updateBtn.disabled = false;
            }
          });
        }

        const actionRow = card.querySelector(".dlc-plugin-actions");

        if (kind === "deck" && item?.status !== "installed") {
          const previewBtn = document.createElement("button");
          previewBtn.type = "button";
          previewBtn.className = "dlc-shop-btn";
          previewBtn.textContent = "Preview";
          previewBtn.title = "Sample this deck's card images";
          actionRow?.appendChild(previewBtn);
          previewBtn.addEventListener("click", () => {
            void openDeckPreview(item);
          });
        }

        if (kind !== "pack" && item?.status !== "installed") {
          if (item?.downloaded === true) {
            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "dlc-shop-btn";
            editBtn.textContent = "Edit";
            editBtn.title = "Edit this item's files (available while it is not installed)";
            actionRow?.appendChild(editBtn);
            editBtn.addEventListener("click", () => {
              if (["reference", "text", "deck"].includes(item.kind) && window.TaroTimeDlcShop?.openCreateDlc) {
                window.TaroTimeDlcShop.openCreateDlc(card, {
                  editItem: item,
                  onCreated: () => { void loadPlugins(); }
                });
                return;
              }
              void openDlcItemEditor(item);
            });
          }
          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.className = "dlc-shop-btn";
          deleteBtn.textContent = "Delete";
          deleteBtn.title = item?.downloaded === true
            ? "Delete this item locally or from the repository"
            : "Delete this item from the repository";
          actionRow?.appendChild(deleteBtn);
          deleteBtn.addEventListener("click", () => {
            void deleteDlcItem(item);
          });
        }

        if (kind !== "pack" && item?.downloaded === true && item?.publishPending === true) {
          const publishBtn = document.createElement("button");
          publishBtn.type = "button";
          publishBtn.className = "dlc-shop-btn";
          publishBtn.textContent = "Publish";
          publishBtn.title = "Validate, commit, and push this item to its DLC repository";
          const publishStatus = document.createElement("span");
          publishStatus.className = "dlc-publish-status settings-field-hint";
          actionRow?.append(publishBtn, publishStatus);
          publishBtn.addEventListener("click", async () => {
            if (publishBtn.disabled) return;
            const message = await promptPublishMessage(item);
            if (message === null) return;
            publishBtn.disabled = true;
            publishStatus.textContent = "Publishing…";
            setStatus(`Publishing ${item.name}…`);
            try {
              const result = await requestJson("POST", "/api/v1/admin/dlc/publish", {
                kind: item.kind,
                name: item.name,
                sourceId: item.sourceId || "",
                message
              });
              const okText = result?.note || `Published to ${result?.sourceName || "repo"} (${result?.branch || ""})${result?.head ? ` · ${result.head}` : ""}.`;
              publishStatus.textContent = okText;
              setStatus(okText);
              await loadPlugins();
            } catch (error) {
              const failText = `Publish failed. ${error?.message || "Unknown error."}`;
              publishStatus.textContent = failText;
              setStatus(failText, true);
            } finally {
              publishBtn.disabled = false;
            }
          });
        }

        if (isInstalled && kind !== "pack") {
          const exportBtn = document.createElement("button");
          exportBtn.type = "button";
          exportBtn.className = "dlc-shop-btn";
          exportBtn.textContent = "Export";
          exportBtn.title = `Download '${item.title || item.name}' as a shareable zip`;
          card.querySelector(".dlc-plugin-actions")?.appendChild(exportBtn);
          exportBtn.addEventListener("click", async () => {
            exportBtn.disabled = true;
            try {
              const url = window.TarotDataService.buildApiUrl(
                `/api/v1/dlc/export?kind=${encodeURIComponent(item.kind)}&name=${encodeURIComponent(item.name)}`
              );
              const headers = {};
              const apiKey = window.TarotDataService.getApiKey?.();
              if (apiKey) headers["x-api-key"] = apiKey;
              const response = await fetch(url, { headers });
              if (!response.ok) {
                let message = `Export failed (HTTP ${response.status}).`;
                try {
                  const payload = await response.json();
                  message = payload?.message || payload?.error?.message || message;
                } catch (_error) {}
                throw new Error(message);
              }
              const blob = await response.blob();
              const link = document.createElement("a");
              const objectUrl = URL.createObjectURL(blob);
              link.href = objectUrl;
              link.download = `${item.name}.kabbak.zip`;
              document.body.appendChild(link);
              link.click();
              link.remove();
              URL.revokeObjectURL(objectUrl);
              setStatus(`Exported ${item.name}.`);
            } catch (error) {
              setStatus(`Could not export ${item.name}. ${error?.message || ""}`, true);
            } finally {
              exportBtn.disabled = false;
            }
          });
        }

        if (isInstalled && isPlugin) {
          const skinIds = new Set((window.TaroTimePluginHost?.listSkins?.() || []).map((skin) => skin.id));
          const isSkin = item.role === "skin" || skinIds.has(item.name) || skinIds.has(item.id);
          if (isSkin) {
            const activeSkin = window.TaroTimePluginHost?.getActiveSkin?.() || "";
            const useBtn = document.createElement("button");
            useBtn.type = "button";
            useBtn.className = "dlc-shop-btn";
            const skinId = skinIds.has(item.name) ? item.name : (skinIds.has(item.id) ? item.id : item.name);
            const isActive = activeSkin === skinId;
            useBtn.textContent = isActive ? "Active layout" : "Use layout";
            useBtn.disabled = isActive;
            card.querySelector(".dlc-plugin-actions")?.appendChild(useBtn);
            useBtn.addEventListener("click", () => {
              window.TaroTimePluginHost?.setActiveSkin?.(skinId);
              useBtn.textContent = "Active layout";
              useBtn.disabled = true;
              card.querySelectorAll(".dlc-shop-btn").forEach((button) => {
                if (button !== useBtn && button.textContent === "Active layout") {
                  button.textContent = "Use layout";
                  button.disabled = false;
                }
              });
            });
          }
          const settingsBtn = document.createElement("button");
          settingsBtn.type = "button";
          settingsBtn.className = "dlc-shop-btn";
          settingsBtn.textContent = "Settings";
          settingsBtn.title = `Configure ${item.title || item.name}`;
          card.querySelector(".dlc-plugin-actions")?.appendChild(settingsBtn);
          settingsBtn.addEventListener("click", () => {
            if (item.name === "menu-plugin") {
              if (window.TaroTimeDlcShop?.openMenuEditorInto) {
                window.TaroTimeDlcShop.openMenuEditorInto(card);
              } else {
                setStatus("Menu editor is available in Settings > DLC Shop & Plugins.", true);
              }
            } else if (window.TaroTimeDlcShop?.openPluginSettings) {
              window.TaroTimeDlcShop.openPluginSettings(card, item);
            } else {
              setStatus("Plugin settings are available in Settings > DLC Shop & Plugins.", true);
            }
          });
        }

        dlcCatalogEl.appendChild(card);
      });
    });
  }

  function renderDlcSources(sources, publishMap = new Map()) {
    const host = document.getElementById("admin-dlc-sources");
    if (!host) return;
    host.innerHTML = "";
    const list = Array.isArray(sources) ? sources : [];
    if (!list.length) {
      const empty = document.createElement("span");
      empty.className = "settings-field-hint";
      empty.textContent = "No DLC repositories configured yet.";
      host.appendChild(empty);
      return;
    }
    list.forEach((source) => {
      const card = document.createElement("div");
      card.className = "dlc-plugin-card";
      const info = document.createElement("div");
      info.className = "dlc-plugin-info";
      const nameRow = document.createElement("div");
      nameRow.className = "dlc-plugin-name-row";
      const nameEl = document.createElement("strong");
      nameEl.textContent = source.name || source.id;
      nameRow.appendChild(nameEl);
      const badge = document.createElement("span");
      badge.className = "dlc-plugin-badge";
      badge.textContent = source.primary ? "primary" : (source.enabled === false ? "disabled" : "additional");
      nameRow.appendChild(badge);
      info.appendChild(nameRow);
      const meta = document.createElement("span");
      meta.className = "dlc-plugin-description";
      meta.textContent = `${source.url || "—"}${source.branch ? ` · ${source.branch}` : ""}${source.head ? ` · ${source.head}` : ""}${source.present ? "" : " · not cloned"}`;
      info.appendChild(meta);
      card.appendChild(info);

      const actions = document.createElement("div");
      actions.className = "dlc-plugin-actions";
      const urlInput = document.createElement("input");
      urlInput.type = "url";
      urlInput.value = source.url || "";
      urlInput.style.minWidth = "220px";
      const branchInput = document.createElement("input");
      branchInput.type = "text";
      branchInput.value = source.branch || "main";
      branchInput.style.width = "90px";
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "dlc-shop-btn";
      saveBtn.textContent = "Save";
      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        try {
          await requestJson("PATCH", `/api/v1/admin/dlc/sources/${encodeURIComponent(source.id)}`, {
            url: urlInput.value,
            branch: branchInput.value
          });
          await window.TaroTimePluginHost?.refresh?.();
          await loadDlcSources();
          await loadPlugins();
          setStatus(`Saved ${source.name}.`);
        } catch (error) {
          setStatus(`Could not save ${source.name}. ${error?.message || ""}`, true);
        } finally {
          saveBtn.disabled = false;
        }
      });
      const syncBtn = document.createElement("button");
      syncBtn.type = "button";
      syncBtn.className = "dlc-shop-btn";
      syncBtn.textContent = "Sync";
      syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        setStatus(`Syncing ${source.name}…`);
        try {
          await requestJson("POST", `/api/v1/admin/dlc/sources/${encodeURIComponent(source.id)}/sync`, {});
          await loadDlcSources();
          await loadPlugins();
          setStatus(`Synced ${source.name}.`);
        } catch (error) {
          setStatus(`Could not sync ${source.name}. ${error?.message || ""}`, true);
        } finally {
          syncBtn.disabled = false;
        }
      });
      actions.append(urlInput, branchInput, saveBtn, syncBtn);
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "dlc-shop-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", async () => {
        if (!window.confirm(`Remove DLC repository '${source.name}'? Local checkout files are kept.`)) return;
        try {
          await requestJson("DELETE", `/api/v1/admin/dlc/sources/${encodeURIComponent(source.id)}`);
          await loadDlcSources();
          await loadPlugins();
          setStatus(`Removed ${source.name}.`);
        } catch (error) {
          setStatus(`Could not remove ${source.name}. ${error?.message || ""}`, true);
        }
      });
      actions.appendChild(removeBtn);
      card.appendChild(actions);

      const publishInfo = publishMap.get(source.id) || null;
      const credSet = publishInfo?.credential?.set === true;
      const credRow = document.createElement("div");
      credRow.className = "dlc-plugin-actions dlc-publish-cred-row";
      const userInput = document.createElement("input");
      userInput.type = "text";
      userInput.autocomplete = "off";
      userInput.placeholder = "username (optional)";
      userInput.value = publishInfo?.credential?.username || "";
      userInput.style.width = "140px";
      const tokenInput = document.createElement("input");
      tokenInput.type = "password";
      tokenInput.autocomplete = "new-password";
      tokenInput.placeholder = credSet ? "token saved — enter to replace" : "access token";
      tokenInput.style.width = "180px";
      const credStatus = document.createElement("span");
      credStatus.className = "settings-field-hint";
      credStatus.textContent = credSet ? "repo access: token set" : "repo access: none";
      const saveCredBtn = document.createElement("button");
      saveCredBtn.type = "button";
      saveCredBtn.className = "dlc-shop-btn";
      saveCredBtn.textContent = "Save access";
      saveCredBtn.addEventListener("click", async () => {
        const token = String(tokenInput.value || "").trim();
        if (!token) {
          setStatus("Enter an access token (or use Clear).", true);
          return;
        }
        saveCredBtn.disabled = true;
        credStatus.textContent = "saving…";
        try {
          await requestJson("PUT", "/api/v1/admin/dlc/publish/credentials", {
            sourceId: source.id,
            username: userInput.value,
            token
          });
          tokenInput.value = "";
          credStatus.textContent = "repo access: token set";
          await loadDlcSources();
          setStatus(`Saved access token for ${source.name}.`);
        } catch (error) {
          credStatus.textContent = "repo access: save failed";
          setStatus(`Could not save access token for ${source.name}. ${error?.message || ""}`, true);
        } finally {
          saveCredBtn.disabled = false;
        }
      });
      credRow.append(userInput, tokenInput, saveCredBtn);
      if (credSet) {
        const clearCredBtn = document.createElement("button");
        clearCredBtn.type = "button";
        clearCredBtn.className = "dlc-shop-btn";
        clearCredBtn.textContent = "Clear";
        clearCredBtn.addEventListener("click", async () => {
          if (!window.confirm(`Remove the saved access token for '${source.name}'?`)) return;
          clearCredBtn.disabled = true;
          credStatus.textContent = "clearing…";
          try {
            await requestJson("DELETE", `/api/v1/admin/dlc/publish/credentials/${encodeURIComponent(source.id)}`);
            credStatus.textContent = "repo access: none";
            await loadDlcSources();
            setStatus(`Cleared access token for ${source.name}.`);
          } catch (error) {
            credStatus.textContent = "repo access: clear failed";
            setStatus(`Could not clear access token for ${source.name}. ${error?.message || ""}`, true);
          } finally {
            clearCredBtn.disabled = false;
          }
        });
        credRow.appendChild(clearCredBtn);
      }
      credRow.appendChild(credStatus);
      card.appendChild(credRow);
      host.appendChild(card);
    });
  }

  function openDlcReposOverlay() {
    document.querySelector(".dlc-repos-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "dlc-settings-overlay dlc-repos-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    const panel = document.createElement("div");
    panel.className = "dlc-settings-overlay-panel dlc-repos-panel";
    const head = document.createElement("div");
    head.className = "dlc-settings-overlay-head";
    const title = document.createElement("strong");
    title.textContent = "DLC Repositories";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dlc-shop-btn";
    closeBtn.textContent = "Close";
    head.append(title, closeBtn);

    const body = document.createElement("div");
    body.className = "dlc-repos-body";
    const hint = document.createElement("p");
    hint.className = "settings-field-hint";
    hint.textContent = "The primary repo is the main catalog checkout. Additional repos merge into the shop; matching names keep the primary copy.";

    const sourcesHost = document.createElement("div");
    sourcesHost.id = "admin-dlc-sources";
    sourcesHost.className = "dlc-plugin-list";

    const addBox = document.createElement("div");
    addBox.className = "dlc-repos-add";
    const addHead = document.createElement("strong");
    addHead.textContent = "Add repository";
    const makeField = (labelText, placeholder, value = "") => {
      const label = document.createElement("label");
      label.className = "settings-field";
      label.textContent = labelText;
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 200;
      input.placeholder = placeholder;
      input.value = value;
      label.appendChild(input);
      return { label, input };
    };
    const nameField = makeField("Name", "Community DLC");
    const urlField = makeField("Repository URL", "https://example.com/org/kabbak-dlc");
    const branchField = makeField("Branch", "main", "main");
    const actions = document.createElement("div");
    actions.className = "dlc-shop-actions";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "settings-button-primary";
    addBtn.textContent = "Add Repository";
    const statusEl = document.createElement("span");
    statusEl.className = "settings-field-hint";
    actions.append(addBtn, statusEl);
    addBox.append(addHead, nameField.label, urlField.label, branchField.label, actions);

    body.append(hint, sourcesHost, addBox);
    panel.append(head, body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener("keydown", function onKey(event) {
      if (event.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        close();
      }
    });

    addBtn.addEventListener("click", async () => {
      const name = String(nameField.input.value || "").trim();
      const url = String(urlField.input.value || "").trim();
      const branch = String(branchField.input.value || "main").trim();
      if (!url) {
        statusEl.textContent = "A repository URL is required.";
        statusEl.classList.add("is-error");
        return;
      }
      addBtn.disabled = true;
      statusEl.classList.remove("is-error");
      statusEl.textContent = "Adding…";
      try {
        await requestJson("POST", "/api/v1/admin/dlc/sources", { name, url, branch });
        nameField.input.value = "";
        urlField.input.value = "";
        await window.TaroTimePluginHost?.refresh?.();
        await loadDlcSources();
        await loadPlugins();
        statusEl.textContent = "Repository added.";
        setStatus("DLC repository added.");
      } catch (error) {
        statusEl.textContent = `Could not add repository. ${error?.message || ""}`;
        statusEl.classList.add("is-error");
      } finally {
        addBtn.disabled = false;
      }
    });

    void loadDlcSources();
    nameField.input.focus();
  }

  async function loadDlcSources() {
    if (!document.getElementById("admin-dlc-sources")) {
      return;
    }
    try {
      const [payload, publishPayload] = await Promise.all([
        requestJson("GET", "/api/v1/admin/dlc/sources"),
        requestJson("GET", "/api/v1/admin/dlc/publish").catch(() => null)
      ]);
      const publishList = publishPayload?.sources || publishPayload?.data?.sources || [];
      const publishMap = new Map((Array.isArray(publishList) ? publishList : []).map((entry) => [entry.id, entry]));
      renderDlcSources(payload?.sources || payload?.data?.sources, publishMap);
    } catch (error) {
      renderDlcSources([]);
      setStatus(`Could not load DLC repositories. ${error?.message || ""}`, true);
    }
  }

  async function annotatePublishPending() {
    const candidates = allDlcItems.filter((item) => item?.downloaded === true && item?.kind !== "pack");
    if (!candidates.length) return;
    try {
      const result = await requestJson("POST", "/api/v1/admin/dlc/publish/status", {
        items: candidates.map((item) => ({ kind: item.kind, name: item.name, sourceId: item.sourceId || "" }))
      });
      const map = new Map((result?.statuses || []).map((entry) => [`${entry.kind}:${entry.name}`, entry]));
      allDlcItems.forEach((item) => {
        const status = map.get(`${item.kind}:${item.name}`);
        item.publishPending = status ? status.pending === true : false;
      });
    } catch (_error) {
      // Never hide Publish entirely if the status check fails.
      allDlcItems.forEach((item) => {
        item.publishPending = true;
      });
    }
  }

  async function loadPlugins() {
    const { dlcCatalogEl } = getElements();
    if (!dlcCatalogEl) return;
    try {
      const catalog = await requestJson("GET", "/api/v1/dlc/catalog?refresh=1");
      allDlcItems = Array.isArray(catalog?.items) ? catalog.items : [];
      await annotatePublishPending();
      renderDlcCatalog();
      const baseUrl = window.TarotDataService?.getApiBaseUrl?.() || "";
      const pluginCount = allDlcItems.filter((item) => item?.kind === "plugin").length;
      setStatus(`DLC loaded (server: ${baseUrl || "?"}, source: ${catalog?.origin || "none"}, plugins: ${pluginCount}).`);
    } catch (error) {
      setStatus(`Could not load DLC. ${error?.message || ""}`, true);
      dlcCatalogEl.innerHTML = "";
      const errorCard = document.createElement("div");
      errorCard.className = "admin-stat-card";
      errorCard.innerHTML = `
        <span class="admin-stat-label">Error</span>
        <strong class="admin-stat-value">${escapeHtml(error?.message || "Could not load the DLC catalog.")}</strong>
        <div class="dlc-shop-actions" style="margin-top:6px;">
          <button type="button" class="dlc-shop-btn" data-action="retry">Retry</button>
        </div>
      `;
      errorCard.querySelector('[data-action="retry"]').addEventListener("click", () => {
        void loadPlugins();
      });
      dlcCatalogEl.appendChild(errorCard);
    }
  }

  // --- Gate + lifecycle ------------------------------------------------------

  function syncGate() {
    const adminBtn = document.getElementById("open-admin");
    const adminSection = document.getElementById("admin-section");
    const allowed = isAdmin();
    if (adminBtn) {
      adminBtn.classList.remove("mp-hidden");
      adminBtn.style.removeProperty("display");
      adminBtn.hidden = !allowed;
    }
    if (!allowed && adminSection && !adminSection.hidden) {
      // Access is unknown until the API responds (roles/scopes arrive with it).
      // Only bounce a fully resolved non-admin, otherwise a slow/late access
      // update yanks the user from Admin back to Home.
      const access = window.TarotAppConfig?.getConnectionAccess?.();
      const hasIdentity = Array.isArray(access?.roles) || Array.isArray(access?.scopes);
      const resolved = Boolean(
        access
        && access.authenticated === true
        && hasIdentity
        && (access.roles.length > 0 || access.scopes.length > 0)
      );
      if (resolved) {
        document.getElementById("open-home")?.click();
      }
    }
    if (allowed) {
      void loadOverview();
    }
  }

  function init() {
    bindTabs();
    bindClientCreate();
    bindRoleCreate();
    bindServerControls();
    const { pluginsReloadBtn } = getElements();
    if (pluginsReloadBtn) {
      pluginsReloadBtn.addEventListener("click", async () => {
        pluginsReloadBtn.disabled = true;
        setStatus("Refreshing DLC…");
        try {
          const result = await requestJson("POST", "/api/v1/admin/dlc/update", {});
          if (result?.updated === false) {
            setStatus(`Could not refresh DLC. ${result?.error || "Update failed."}`, true);
            return;
          }
          await window.TaroTimePluginHost?.refresh?.();
          await loadDlcSources();
          await loadPlugins();
          setStatus(`DLC refreshed${result?.head ? ` (${result.head})` : ""}.`);
        } catch (error) {
          setStatus(`Could not refresh DLC. ${error?.message || ""}`, true);
        } finally {
          pluginsReloadBtn.disabled = false;
        }
      });
    }
    document.getElementById("admin-dlc-repos-open")?.addEventListener("click", openDlcReposOverlay);
    const importDlcBtn = document.getElementById("admin-import-dlc");
    const importDlcFile = document.getElementById("admin-import-dlc-file");
    if (importDlcBtn && importDlcFile) {
      importDlcBtn.addEventListener("click", () => importDlcFile.click());
      importDlcFile.addEventListener("change", async (event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        importDlcBtn.disabled = true;
        setStatus(`Importing ${file.name}…`);
        try {
          const buffer = new Uint8Array(await file.arrayBuffer());
          const result = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", window.TarotDataService.buildApiUrl("/api/v1/dlc/import"));
            xhr.setRequestHeader("Content-Type", "application/zip");
            const apiKey = window.TarotDataService.getApiKey?.();
            if (apiKey) xhr.setRequestHeader("x-api-key", apiKey);
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
              reject(new Error(payload?.message || payload?.error?.message || `Import failed (HTTP ${xhr.status}).`));
            };
            xhr.onerror = () => reject(new Error("Network error during DLC import."));
            xhr.send(buffer);
          });
          await loadPlugins();
          if (result?.imported?.kind && result.imported.kind !== "plugin" && result.imported.kind !== "api") {
            void pollReloadStatus((text, isError) => setStatus(text, isError));
          } else {
            await window.TaroTimePluginHost?.refresh?.();
          }
          setStatus(`Imported '${result?.imported?.name || file.name}'.`);
        } catch (error) {
          setStatus(`Could not import DLC. ${error?.message || ""}`, true);
        } finally {
          importDlcBtn.disabled = false;
        }
      });
    }
    const createPluginBtn = document.getElementById("admin-create-plugin");
    if (createPluginBtn) {
      createPluginBtn.addEventListener("click", () => {
        const { dlcCatalogEl } = getElements();
        if (window.TaroTimeDlcShop?.openCreateDlc) {
          window.TaroTimeDlcShop.openCreateDlc(dlcCatalogEl, {
            onCreated: () => loadPlugins()
          });
        } else if (window.TaroTimeDlcShop?.openCreatePlugin) {
          window.TaroTimeDlcShop.openCreatePlugin(dlcCatalogEl, {
            onCreated: () => loadPlugins()
          });
        } else {
          setStatus("DLC creation is available in Settings > DLC Shop & Plugins.", true);
        }
      });
    }
    document.querySelectorAll("#admin-dlc-filter [data-dlc-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeDlcFilter = String(button.dataset.dlcFilter || "all");
        syncDlcFilterButtons();
        renderDlcCatalog();
      });
    });
    syncDlcFilterButtons();

    const refreshPanel = (panelId) => {
      if (panelId === "overview") void loadOverview();
      if (panelId === "clients") void loadClients();
      if (panelId === "tiers") void loadTiers();
      if (panelId === "plugins") {
        void loadDlcSources();
        void loadPlugins();
      }
      if (panelId === "server") {
        void loadServerSettings();
        void loadLogs();
      }
    };

    document.querySelectorAll(".admin-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        refreshPanel(String(tab.id).replace("admin-tab-", ""));
        syncLogPolling();
      });
    });

    document.addEventListener("connection:access-updated", () => {
      syncGate();
      const active = String(window.TarotSectionStateUi?.getActiveSection?.() || "");
      if (active === "admin") {
        void loadOverview();
      }
      syncLogPolling();
    });
    document.addEventListener("connection:updated", syncGate);

    // Load panels when the admin section first opens.
    const openAdminBtn = document.getElementById("open-admin");
    if (openAdminBtn) {
      openAdminBtn.addEventListener("click", () => {
        void loadOverview();
      });
    }

    syncGate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
