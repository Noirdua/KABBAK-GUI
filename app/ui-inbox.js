(function () {
  "use strict";

  const POLL_MS = 60000;
  let items = [];
  let filter = "all";

  function matchesFilter(item) {
    if (filter === "all") return true;
    if (filter === "unread") return !item.read;
    if (filter === "broadcast") return item.scope === "broadcast";
    return String(item.kind || "").toLowerCase() === filter;
  }

  function el(id) {
    const node = document.getElementById(id);
    return node instanceof HTMLElement ? node : null;
  }

  function isEnabled() {
    return window.TarotDataService?.isApiEnabled?.() === true;
  }

  function setBadge(count) {
    const badge = el("inbox-badge");
    if (!badge) return;
    if (count > 0) {
      badge.hidden = false;
      badge.textContent = count > 99 ? "99+" : String(count);
    } else {
      badge.hidden = true;
      badge.textContent = "";
    }
  }

  function setStatus(message) {
    const node = el("inbox-status");
    if (node) node.textContent = message || "";
  }

  function showButton(show) {
    const button = el("open-inbox");
    if (button) button.hidden = !show;
  }

  async function refreshBadge() {
    if (!isEnabled()) {
      showButton(false);
      setBadge(0);
      return;
    }
    showButton(true);
    try {
      const inbox = await window.TarotDataService.fetchInbox();
      items = Array.isArray(inbox?.items) ? inbox.items : [];
      setBadge(Number(inbox?.unreadCount) || 0);
      setStatus("");
      if (!el("inbox-modal")?.hidden) {
        renderList();
      }
    } catch (error) {
      setBadge(0);
      if (!el("inbox-modal")?.hidden) {
        setStatus(error?.message || "Could not load the inbox.");
      }
    }
  }

  function buildItem(item) {
    // A div (not a button) so attachment links/images can live inside it safely.
    const row = document.createElement("div");
    row.className = `inbox-item${item.read ? "" : " is-unread"}`;
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    const activate = () => {
      void openItem(item);
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });

    const head = document.createElement("span");
    head.className = "inbox-item-head";
    const kind = document.createElement("span");
    kind.className = "inbox-item-kind";
    kind.textContent = item.scope === "broadcast" ? "Announcement" : String(item.kind || "message");
    const title = document.createElement("span");
    title.className = "inbox-item-title";
    title.textContent = item.title || "(untitled)";
    head.appendChild(kind);
    head.appendChild(title);
    if (item.requiresAck) {
      const ack = document.createElement("span");
      ack.className = `inbox-item-ack${item.read ? "" : " is-pending"}`;
      ack.textContent = item.read ? "acknowledged" : "ack required";
      head.appendChild(ack);
    }
    if (item.expiresAt) {
      const expiry = document.createElement("span");
      expiry.className = "inbox-item-ack";
      expiry.textContent = `expires ${new Date(item.expiresAt).toLocaleDateString()}`;
      head.appendChild(expiry);
    }
    row.appendChild(head);

    const meta = document.createElement("span");
    meta.className = "inbox-item-meta";
    const parts = [];
    if (item.sender) parts.push(item.sender);
    if (item.createdAt) parts.push(new Date(item.createdAt).toLocaleString());
    if (item.attachmentCount) parts.push(`${item.attachmentCount} file${item.attachmentCount === 1 ? "" : "s"}`);
    meta.textContent = parts.join(" · ");
    row.appendChild(meta);

    if (item.description) {
      const body = document.createElement("span");
      body.className = "inbox-item-body";
      body.textContent = item.description;
      row.appendChild(body);
    }

    if (Array.isArray(item.attachments) && item.attachments.length) {
      const files = document.createElement("span");
      files.className = "inbox-item-files";
      item.attachments.forEach((att) => {
        const url = window.TarotDataService.buildInboxAttachmentUrl(item.scope, item.id, att.id);
        if (String(att.type || "").startsWith("image/")) {
          const img = document.createElement("img");
          img.className = "inbox-item-thumb";
          img.src = url;
          img.alt = att.name || "attachment";
          img.loading = "lazy";
          img.addEventListener("click", (event) => {
            event.stopPropagation();
            window.open(url, "_blank", "noopener");
          });
          files.appendChild(img);
        } else {
          const link = document.createElement("a");
          link.className = "inbox-item-file";
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = att.name || "file";
          link.addEventListener("click", (event) => event.stopPropagation());
          files.appendChild(link);
        }
      });
      row.appendChild(files);
    }
    return row;
  }

  function renderDigest() {
    const node = el("inbox-digest");
    if (!node) return;
    const unread = items.filter((item) => !item.read);
    if (!unread.length) {
      node.textContent = "";
      return;
    }
    const counts = { announcement: 0, alert: 0, report: 0, message: 0 };
    unread.forEach((item) => {
      if (item.scope === "broadcast") counts.announcement += 1;
      else if (item.kind === "alert") counts.alert += 1;
      else if (item.kind === "report") counts.report += 1;
      else counts.message += 1;
    });
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const parts = [`${unread.length} unread`];
    if (counts.announcement) parts.push(plural(counts.announcement, "announcement"));
    if (counts.alert) parts.push(plural(counts.alert, "alert"));
    if (counts.report) parts.push(plural(counts.report, "report"));
    if (counts.message) parts.push(plural(counts.message, "message"));
    node.textContent = parts.join(" · ");
  }

  function renderList() {
    const list = el("inbox-list");
    if (!list) return;
    renderDigest();
    list.textContent = "";
    const visible = items.filter(matchesFilter);
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "planner-empty";
      empty.textContent = items.length ? "No messages in this filter." : "No messages yet.";
      list.appendChild(empty);
      return;
    }
    visible.forEach((item) => list.appendChild(buildItem(item)));
  }

  async function openItem(item) {
    // Only public messages have a shareable page; internal ones are read inline.
    if (item.visibility === "public" && item.token) {
      const url = window.TarotDataService.buildApiUrl(`/api/v1/share/${encodeURIComponent(item.token)}`);
      if (url) {
        window.open(url, "_blank", "noopener");
      }
    }
    if (!item.read) {
      item.read = true;
      renderList();
      setBadge(Math.max(0, items.filter((entry) => !entry.read).length));
      try {
        await window.TarotDataService.markInboxItemRead(item.scope, item.id);
      } catch (_error) {
        // Marking read is best-effort; the badge refreshes on the next poll.
      }
    }
  }

  async function loadQuietHours() {
    try {
      const quiet = await window.TarotDataService.fetchQuietHours();
      const enabled = el("inbox-quiet-enabled");
      const start = el("inbox-quiet-start");
      const end = el("inbox-quiet-end");
      if (enabled) enabled.checked = quiet?.enabled === true;
      if (start) start.value = quiet?.start || "22:00";
      if (end) end.value = quiet?.end || "07:00";
      const status = el("inbox-quiet-status");
      if (status) status.textContent = "";
    } catch (_error) {
      // Quiet hours are optional; ignore load failures.
    }
  }

  async function saveQuietHours() {
    const status = el("inbox-quiet-status");
    try {
      await window.TarotDataService.updateQuietHours({
        enabled: el("inbox-quiet-enabled")?.checked === true,
        start: el("inbox-quiet-start")?.value || "22:00",
        end: el("inbox-quiet-end")?.value || "07:00"
      });
      if (status) status.textContent = "Saved.";
      void refreshBadge();
    } catch (error) {
      if (status) status.textContent = error?.message || "Could not save.";
    }
  }

  function openModal() {
    const modal = el("inbox-modal");
    if (modal) modal.hidden = false;
    renderList();
    void loadQuietHours();
    void refreshBadge();
  }

  function closeModal() {
    const modal = el("inbox-modal");
    if (modal) modal.hidden = true;
  }

  async function markAll() {
    // Acknowledgement-required messages stay unread until opened individually.
    items = items.map((item) => (item.requiresAck ? item : { ...item, read: true }));
    renderList();
    setBadge(items.filter((item) => !item.read).length);
    try {
      await window.TarotDataService.markInboxAllRead();
    } catch (_error) {
      void refreshBadge();
    }
  }

  function init() {
    el("open-inbox")?.addEventListener("click", openModal);
    el("inbox-close")?.addEventListener("click", closeModal);
    el("inbox-mark-all")?.addEventListener("click", () => {
      void markAll();
    });
    el("inbox-modal")?.addEventListener("mousedown", (event) => {
      if (event.target?.id === "inbox-modal") closeModal();
    });
    el("inbox-quiet-save")?.addEventListener("click", () => {
      void saveQuietHours();
    });
    document.querySelectorAll("[data-inbox-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        filter = button.getAttribute("data-inbox-filter") || "all";
        document.querySelectorAll("[data-inbox-filter]").forEach((other) => {
          other.classList.toggle("is-active", other === button);
        });
        renderList();
      });
    });
    document.addEventListener("connection:updated", () => {
      void refreshBadge();
    });

    void refreshBadge();
    window.setInterval(() => {
      void refreshBadge();
    }, POLL_MS);
  }

  window.TarotInboxUi = { open: openModal, refresh: refreshBadge };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
