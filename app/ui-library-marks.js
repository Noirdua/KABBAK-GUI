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

  function canUsePersonalLibrary() {
    return window.TarotAppConfig?.hasPersonalFeatures?.() !== false;
  }

  async function loadLibrary() {
    const svc = service();
    if (!svc?.requestJson || !svc?.buildApiUrl || !canUsePersonalLibrary()) {
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
      if (!svc?.requestJson || !svc?.buildApiUrl || !canUsePersonalLibrary()) return;
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
      const cardId = String(meta.cardId || item.key || "").trim();
      const nav = window.TarotNavigationUi;
      window.TarotSectionStateUi?.setActiveSection?.("tarot");
      if (typeof nav?.prepareTarotBrowseDetailView === "function") {
        await nav.prepareTarotBrowseDetailView();
      } else {
        await window.TarotSectionUi?.ensureTarotSection?.();
        const layout = document.querySelector("#tarot-browse-view .browse-layout");
        if (layout instanceof HTMLElement) {
          window.TarotChromeUi?.showDetailOnly?.(layout, false);
        }
      }
      window.TarotSectionUi?.selectCardById?.(cardId);
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
    const hasEvidence = evidenceKeys.has(itemKey(spec.type, spec.key));
    const marked = bookmarked || Boolean(existingNote) || hasEvidence;

    const actionsBtn = el("button", `kabbak-mark-btn${marked ? " is-marked" : ""}`, "Actions");
    actionsBtn.type = "button";
    if (existingNote?.body) {
      actionsBtn.title = `Note: ${existingNote.body}`;
    }
    if (bookmarked) {
      actionsBtn.appendChild(el("span", "kabbak-mark-flag is-bookmark", "B"));
    }
    if (existingNote) {
      actionsBtn.appendChild(el("span", "kabbak-mark-flag is-note", "N"));
    }
    if (hasEvidence) {
      actionsBtn.appendChild(el("span", "kabbak-mark-flag is-evidence", "E"));
    }
    actionsBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openMarkActions(host, spec);
    });
    bar.appendChild(actionsBtn);
    host.appendChild(bar);
  }

  // Evidence state is per post, but the store keeps a convenience copy so the
  // indicator can show without loading every post.
  let evidenceKeys = new Set();

  async function loadEvidenceKeys() {
    try {
      const result = await window.TarotDataService?.fetchEvidenceStore?.();
      const items = Array.isArray(result?.evidence) ? result.evidence : [];
      evidenceKeys = new Set(
        items.map((item) => itemKey(item.markType, item.markKey)).filter(Boolean)
      );
    } catch (_error) {
      evidenceKeys = new Set();
    }
  }

  // One tidy overlay for every library action on a section item, so the inline
  // bar stays a single compact button.
  function openMarkActions(host, spec) {
    if (!window.TaroOverlay?.open) return;
    const refresh = () => {
      loadEvidenceKeys().then(() => attachControls(host, spec));
    };
    const body = el("div", "kabbak-mark-overlay");
    const bookmarked = Boolean(findBookmark(spec.type, spec.key));
    const existingNote = findNote(spec.type, spec.key);

    const bookmarkBtn = el("button", `kabbak-mark-btn${bookmarked ? " is-on" : ""}`, bookmarked ? "Remove bookmark" : "Bookmark");
    bookmarkBtn.type = "button";
    bookmarkBtn.addEventListener("click", () => {
      const added = toggleBookmark(spec);
      bookmarkBtn.textContent = added ? "Remove bookmark" : "Bookmark";
      bookmarkBtn.classList.toggle("is-on", added);
      void refresh();
    });

    const noteArea = document.createElement("textarea");
    noteArea.className = "kabbak-mark-input";
    noteArea.rows = 4;
    noteArea.placeholder = "Personal note";
    noteArea.value = existingNote?.body || "";
    const saveNote = el("button", "kabbak-mark-btn is-on", "Save note");
    saveNote.type = "button";
    const status = el("span", "settings-field-hint", "");
    saveNote.addEventListener("click", () => {
      setNote(spec, noteArea.value);
      status.textContent = noteArea.value.trim() ? "Note saved." : "Note cleared.";
      void refresh();
    });

    // Evidence is per post: pick which post's proof pool this belongs to.
    const evidenceBtn = el("button", "kabbak-mark-btn", "Add to a post");
    evidenceBtn.type = "button";
    const picker = el("div", "kabbak-mark-picker");
    picker.hidden = true;
    const itemPayload = () => ({
      title: spec.title || spec.key,
      body: spec.body || "",
      markType: spec.type,
      markKey: spec.key
    });
    const mirrorToStore = async () => {
      try {
        await window.TarotDataService?.addEvidenceStoreItem?.(itemPayload());
      } catch (_error) {
        // The store is only a convenience pool for the composer.
      }
    };
    evidenceBtn.addEventListener("click", async () => {
      picker.hidden = false;
      picker.textContent = "";
      picker.appendChild(el("span", "settings-field-hint", "Loading posts…"));
      try {
        const result = await window.TarotDataService.fetchProfilePosts();
        const posts = Array.isArray(result?.posts) ? result.posts : [];
        picker.textContent = "";
        const createNew = el("button", "kabbak-mark-btn", "New post with this");
        createNew.type = "button";
        createNew.addEventListener("click", async () => {
          createNew.disabled = true;
          createNew.textContent = "Creating…";
          try {
            const created = await window.TarotDataService.createProfilePost({
              title: spec.title || spec.key,
              body: `From ${typeLabel(spec.type)}: ${spec.title || spec.key}`.slice(0, 999)
            });
            await window.TarotDataService.addPostItem(created.id, itemPayload());
            await mirrorToStore();
            void refresh();
            createNew.textContent = "Added ✓";
            status.textContent = "Added to a new post's evidence.";
            void refresh();
          } catch (error) {
            createNew.disabled = false;
            createNew.textContent = "New post with this";
            status.textContent = error?.message || "Could not create the post.";
          }
        });
        picker.appendChild(createNew);
        if (!posts.length) {
          picker.appendChild(el("span", "settings-field-hint", "No posts yet — start one above."));
        }
        posts.forEach((post) => {
          const row = el("div", "kabbak-mark-picker-row");
          row.appendChild(el("strong", "", post.title || "Post"));
          const add = el("button", "kabbak-mark-btn", "Add here");
          add.type = "button";
          add.addEventListener("click", async () => {
            add.disabled = true;
            add.textContent = "Adding…";
            try {
              await window.TarotDataService.addPostItem(post.id, itemPayload());
              await mirrorToStore();
              // Stay disabled with a clear confirmation so the click is visible.
              add.textContent = "Added ✓";
              add.classList.add("is-on");
              row.classList.add("is-added");
              status.textContent = `Added to “${post.title || "Post"}”.`;
              void refresh();
            } catch (error) {
              add.disabled = false;
              add.textContent = "Add here";
              status.textContent = error?.message || "Could not add to the post.";
            }
          });
          row.appendChild(add);
          picker.appendChild(row);
        });
      } catch (error) {
        picker.textContent = "";
        picker.appendChild(el("span", "settings-field-hint", error?.message || "Could not load posts."));
      }
    });

    body.append(bookmarkBtn, noteArea, saveNote, evidenceBtn, picker, status);
    window.TaroOverlay.open({
      title: spec.title || "Actions",
      size: "small",
      className: "kabbak-mark-actions-overlay",
      body
    });
  }

  document.addEventListener("connection:access-updated", () => {
    void loadLibrary();
    void loadEvidenceKeys();
  });
  document.addEventListener("connection:updated", () => {
    void loadLibrary();
    void loadEvidenceKeys();
  });
  void loadEvidenceKeys();

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
