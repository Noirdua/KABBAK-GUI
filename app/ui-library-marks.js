(function () {
  "use strict";

  const LIBRARY_PATH = "/api/v1/profile/library";
  let library = { bookmarks: [], notes: [] };
  let loaded = false;
  let saveTimer = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function itemKey(type, key) {
    return `${String(type || "").trim().toLowerCase()}::${String(key || "").trim()}`;
  }

  function sameItem(entry, type, key) {
    return itemKey(entry?.type, entry?.key) === itemKey(type, key);
  }

  function service() {
    return window.TarotDataService;
  }

  async function loadLibrary() {
    const svc = service();
    if (!svc?.requestJson || !svc?.buildApiUrl) {
      library = { bookmarks: [], notes: [] };
      loaded = false;
      return library;
    }
    try {
      const payload = await svc.requestJson("GET", svc.buildApiUrl(LIBRARY_PATH));
      library = {
        bookmarks: Array.isArray(payload?.bookmarks) ? payload.bookmarks : [],
        notes: Array.isArray(payload?.notes) ? payload.notes : []
      };
      loaded = true;
    } catch (_error) {
      library = { bookmarks: [], notes: [] };
      loaded = false;
    }
    renderProfileLists();
    document.dispatchEvent(new CustomEvent("kabbak-library-changed"));
    return library;
  }

  function persistLibrary() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      const svc = service();
      if (!svc?.requestJson || !svc?.buildApiUrl) return;
      svc.requestJson("PUT", svc.buildApiUrl(LIBRARY_PATH), {
        bookmarks: library.bookmarks,
        notes: library.notes
      }).catch(() => {});
    }, 280);
  }

  function findBookmark(type, key) {
    return library.bookmarks.find((entry) => sameItem(entry, type, key)) || null;
  }

  function findNote(type, key) {
    return library.notes.find((entry) => sameItem(entry, type, key)) || null;
  }

  function toggleBookmark(spec) {
    const existing = findBookmark(spec.type, spec.key);
    if (existing) {
      library.bookmarks = library.bookmarks.filter((entry) => !sameItem(entry, spec.type, spec.key));
    } else {
      library.bookmarks = [
        ...library.bookmarks,
        {
          type: spec.type,
          key: spec.key,
          title: spec.title || spec.key,
          meta: spec.meta || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
    }
    persistLibrary();
    renderProfileLists();
    document.dispatchEvent(new CustomEvent("kabbak-library-changed"));
    return !existing;
  }

  function setNote(spec, body) {
    const text = String(body || "").trim();
    const existing = findNote(spec.type, spec.key);
    if (!text) {
      if (existing) {
        library.notes = library.notes.filter((entry) => !sameItem(entry, spec.type, spec.key));
      }
    } else if (existing) {
      existing.body = text;
      existing.title = spec.title || existing.title;
      existing.meta = spec.meta || existing.meta || {};
      existing.updatedAt = new Date().toISOString();
    } else {
      library.notes = [
        ...library.notes,
        {
          type: spec.type,
          key: spec.key,
          title: spec.title || spec.key,
          body: text,
          meta: spec.meta || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
    }
    persistLibrary();
    renderProfileLists();
    document.dispatchEvent(new CustomEvent("kabbak-library-changed"));
  }

  function typeLabel(type) {
    if (type === "text") return "Text";
    if (type === "tarot") return "Tarot";
    if (type === "hieroglyph") return "Hieroglyph";
    if (type === "reference") return "Reference";
    return String(type || "Item");
  }

  async function openItem(item) {
    const type = String(item?.type || "");
    const meta = item?.meta && typeof item.meta === "object" ? item.meta : {};
    if (type === "text") {
      window.TarotSectionStateUi?.setActiveSection?.("alphabet-text");
      const open = window.AlphabetTextUi?.openPassage;
      if (typeof open === "function") {
        await open({
          sourceId: meta.sourceId,
          workId: meta.workId,
          sectionId: meta.sectionId,
          verseId: meta.verseId || item.key
        });
      }
      return;
    }
    if (type === "tarot") {
      window.TarotSectionStateUi?.setActiveSection?.("tarot");
      await window.TarotSectionUi?.ensureTarotSection?.();
      window.TarotSectionUi?.selectCardById?.(meta.cardId || item.key);
    }
  }

  function renderList(target, items, emptyText) {
    if (!(target instanceof HTMLElement)) return;
    target.replaceChildren();
    if (!items.length) {
      target.appendChild(el("p", "profile-library-empty", emptyText));
      return;
    }
    items.forEach((item) => {
      const button = el("button", "profile-library-item");
      button.type = "button";
      button.append(
        el("span", "profile-library-item-type", typeLabel(item.type)),
        el("span", "profile-library-item-title", item.title || item.key)
      );
      if (item.body) {
        button.appendChild(el("span", "profile-library-item-body", item.body.slice(0, 120)));
      }
      button.addEventListener("click", () => {
        void openItem(item);
      });
      target.appendChild(button);
    });
  }

  function renderProfileLists() {
    const countEl = document.getElementById("profile-library-count");
    if (countEl) {
      countEl.textContent = `${library.bookmarks.length} bookmarks · ${library.notes.length} notes`;
    }
    renderList(document.getElementById("profile-library-bookmarks"), library.bookmarks, "No bookmarks yet.");
    renderList(document.getElementById("profile-library-notes"), library.notes, "No notes yet.");
  }

  function attachControls(host, spec) {
    if (!(host instanceof HTMLElement) || !spec?.type || !spec?.key) {
      return;
    }
    host.querySelectorAll(".kabbak-mark-actions").forEach((node) => node.remove());
    const bar = el("div", "kabbak-mark-actions");
    const bookmarked = Boolean(findBookmark(spec.type, spec.key));
    const existingNote = findNote(spec.type, spec.key);
    const bookmarkBtn = el("button", `kabbak-mark-btn${bookmarked ? " is-on" : ""}`, bookmarked ? "Bookmarked" : "Bookmark");
    bookmarkBtn.type = "button";
    bookmarkBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleBookmark(spec);
      attachControls(host, spec);
    });
    const noteBtn = el("button", `kabbak-mark-btn${existingNote ? " is-on" : ""}`, existingNote ? "Edit note" : "Note");
    noteBtn.type = "button";
    noteBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = bar.querySelector(".kabbak-mark-editor");
      if (open) {
        open.remove();
        return;
      }
      const editor = el("div", "kabbak-mark-editor");
      const area = document.createElement("textarea");
      area.className = "kabbak-mark-input";
      area.rows = 3;
      area.placeholder = "Personal note";
      area.value = existingNote?.body || "";
      const save = el("button", "kabbak-mark-btn is-on", "Save note");
      save.type = "button";
      save.addEventListener("click", (saveEvent) => {
        saveEvent.preventDefault();
        saveEvent.stopPropagation();
        setNote(spec, area.value);
        attachControls(host, spec);
      });
      editor.append(area, save);
      bar.appendChild(editor);
      area.focus();
    });
    bar.append(bookmarkBtn, noteBtn);
    host.appendChild(bar);
  }

  document.addEventListener("connection:access-updated", () => {
    void loadLibrary();
  });
  document.addEventListener("connection:updated", () => {
    void loadLibrary();
  });

  window.KabbakLibraryMarks = {
    load: loadLibrary,
    getLibrary: () => library,
    isBookmarked: (type, key) => Boolean(findBookmark(type, key)),
    getNote: findNote,
    toggleBookmark,
    setNote,
    attachControls,
    openItem
  };
})();
