(function () {
  "use strict";

  const state = {
    initialized: false
  };

  let options = {};

  function makeEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function stripHtmlText(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getElements() {
    return {
      postTitleEl: document.getElementById("profile-post-title"),
      postToolsEl: document.getElementById("profile-post-tools"),
      postFilesEl: document.getElementById("profile-post-files"),
      postAttachmentsEl: document.getElementById("profile-post-attachments"),
      postSubmitBtn: document.getElementById("profile-post-submit"),
      postCountEl: document.getElementById("profile-post-count"),
      postStatusEl: document.getElementById("profile-post-status"),
      postEvidenceBtn: document.getElementById("profile-post-evidence"),
      postEvidenceCountEl: document.getElementById("profile-post-evidence-count"),
      postBlocksEl: document.getElementById("profile-post-blocks"),
      postEvidenceListEl: document.getElementById("profile-post-evidence-list"),
      postAddTextBtnEl: document.getElementById("profile-post-add-text"),
      postComposerEl: document.getElementById("profile-post-composer"),
      postPreviewCardEl: document.getElementById("profile-post-preview-card")
    };
  }

  function getAttachments() {
    return typeof options.getAttachments === "function" ? options.getAttachments() : [];
  }

  function setPostStatus(text, isError = false) {
    const { postStatusEl } = getElements();
    if (!postStatusEl) return;
    postStatusEl.textContent = text || "";
    postStatusEl.classList.toggle("is-error", isError);
  }

  const MAX_POST_TEXT_LENGTH = 999;
  let postOverLimitNotice = false;

  function postTextBlockLength(editor) {
    return String(editor?.textContent || "").trim().length;
  }

  function composerTextOverLimit() {
    const { postBlocksEl } = getElements();
    if (!postBlocksEl) return false;
    return Array.from(postBlocksEl.querySelectorAll(".profile-post-block-text"))
      .some((editor) => postTextBlockLength(editor) > MAX_POST_TEXT_LENGTH);
  }

  function updatePostCounter() {
    const { postBlocksEl, postCountEl, postSubmitBtn } = getElements();
    if (!postCountEl) return;
    let longest = 0;
    let over = false;
    Array.from(postBlocksEl?.querySelectorAll(".profile-post-block-text") || []).forEach((editor) => {
      const length = postTextBlockLength(editor);
      if (length > longest) longest = length;
      if (length > MAX_POST_TEXT_LENGTH) over = true;
    });
    const active = document.activeElement;
    const focused = active && active.classList?.contains("profile-post-block-text") && postBlocksEl?.contains(active)
      ? active
      : null;
    postCountEl.textContent = `${focused ? postTextBlockLength(focused) : longest} / ${MAX_POST_TEXT_LENGTH}`;
    if (postSubmitBtn) postSubmitBtn.disabled = over;
    if (over) {
      postOverLimitNotice = true;
      setPostStatus(`Each block tops out at ${MAX_POST_TEXT_LENGTH} characters — shorten the long block.`, true);
    } else if (postOverLimitNotice) {
      postOverLimitNotice = false;
      setPostStatus("");
    }
  }

  function renderPostAttachments() {
    const { postAttachmentsEl } = getElements();
    if (!postAttachmentsEl) return;
    postAttachmentsEl.textContent = "";
    getAttachments().forEach((file, index) => {
      const row = makeEl("div", "profile-post-attachment");
      row.appendChild(makeEl("span", "", `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`));
      const remove = makeEl("button", "profile-btn", "Remove");
      remove.type = "button";
      remove.addEventListener("click", () => {
        getAttachments().splice(index, 1);
        renderPostAttachments();
      });
      row.appendChild(remove);
      postAttachmentsEl.appendChild(row);
    });
  }

  function fileToAttachment(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        data: String(reader.result || "")
      });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  const POST_HTML_TOOLS = [
    { cmd: "bold", label: "B", title: "Bold" },
    { cmd: "italic", label: "I", title: "Italic" },
    { cmd: "underline", label: "U", title: "Underline" },
    { cmd: "insertUnorderedList", label: "•", title: "Bullet list" },
    { cmd: "insertOrderedList", label: "1.", title: "Numbered list" },
    { cmd: "formatBlock", value: "blockquote", label: "❝", title: "Quote" },
    { cmd: "formatBlock", value: "h3", label: "H", title: "Heading" }
  ];

  function getActivePostEditor() {
    const { postBlocksEl } = getElements();
    if (!postBlocksEl) return null;
    const active = document.activeElement;
    if (active && active.classList?.contains("profile-post-block-text") && postBlocksEl.contains(active)) {
      return active;
    }
    if (activeTextBlockId) {
      const cached = postBlocksEl.querySelector(`[data-block-id="${activeTextBlockId}"] .profile-post-block-text`);
      if (cached) return cached;
    }
    return postBlocksEl.querySelector(".profile-post-block-text");
  }

  function syncActivePostEditor() {
    updatePostCounter();
    renderPostPreview();
  }

  function ensurePostTools() {
    const { postToolsEl } = getElements();
    if (!postToolsEl || postToolsEl.childElementCount) return;
    POST_HTML_TOOLS.forEach((tool) => {
      const button = makeEl("button", "profile-format-btn", tool.label);
      button.type = "button";
      button.title = tool.title;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        getActivePostEditor()?.focus();
        document.execCommand(tool.cmd, false, tool.value || null);
        syncActivePostEditor();
      });
      postToolsEl.appendChild(button);
    });
    const link = makeEl("button", "profile-format-btn", "Link");
    link.type = "button";
    link.title = "Link";
    link.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const url = window.prompt("Link URL", "https://");
      if (!url) return;
      getActivePostEditor()?.focus();
      document.execCommand("createLink", false, url);
      syncActivePostEditor();
    });
    postToolsEl.appendChild(link);
  }

  let composerEvidence = [];
  let composerBlocks = [];
  let activeTextBlockId = "";
  let composerInsertAnchorId = "";
  let composerBlockSeq = 0;

  function nextComposerBlockId() {
    composerBlockSeq += 1;
    return `cblock_${composerBlockSeq}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function newComposerTextBlock(html = "") {
    return { id: nextComposerBlockId(), kind: "text", html };
  }

  function postHtmlHasContent(html) {
    const value = String(html || "");
    return Boolean(stripHtmlText(value)) || /<img\b/i.test(value);
  }

  function postEditorIsEmpty(editor) {
    return !postHtmlHasContent(editor?.innerHTML || "");
  }

  function syncPostEditorEmptyState(editor) {
    if (editor) editor.setAttribute("data-empty", postEditorIsEmpty(editor) ? "true" : "false");
  }

  function uniqueComposerEvidenceBlocks() {
    const seen = new Set();
    return composerBlocks.filter((block) => {
      if (block.kind !== "evidence" || !block.evidenceId || seen.has(block.evidenceId)) return false;
      seen.add(block.evidenceId);
      return true;
    });
  }

  function evidenceMeta(evidenceId) {
    return composerEvidence.find((item) => item.id === evidenceId)
      || { id: evidenceId, title: "Evidence" };
  }

  function updateComposerEvidenceCount() {
    const { postEvidenceCountEl } = getElements();
    if (postEvidenceCountEl) {
      const count = uniqueComposerEvidenceBlocks().length;
      postEvidenceCountEl.textContent = count
        ? `${count} proof${count === 1 ? "" : "s"} selected`
        : "";
    }
  }

  let composerBucketItems = [];
  let composerBucketState = "idle";
  let composerBucketError = "";
  let composerBucketSeq = 0;

  function renderComposerEvidenceBucket() {
    const { postEvidenceListEl } = getElements();
    if (!postEvidenceListEl) return;
    postEvidenceListEl.textContent = "";
    if (!composerBucketItems.length) {
      if (composerBucketState === "loading") {
        postEvidenceListEl.appendChild(makeEl("span", "profile-directory-empty", "Loading…"));
      } else if (composerBucketState === "error") {
        postEvidenceListEl.appendChild(makeEl("span", "profile-directory-empty", composerBucketError || "Could not load evidence."));
      } else {
        postEvidenceListEl.appendChild(makeEl("span", "profile-directory-empty", "Nothing collected yet. Use “Add to post” on any verse, card, or reference."));
      }
      return;
    }
    composerBucketItems.forEach((item) => {
      const row = makeEl("div", "profile-post-bucket-item");
      const quote = String(item.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
      row.appendChild(makeEl("strong", "profile-post-bucket-title", quote || item.title || "Evidence"));
      if (quote) {
        row.appendChild(makeEl("span", "profile-post-bucket-meta", String(item.title || "Evidence")));
      }
      const insert = makeEl("button", "profile-btn", "Insert");
      insert.type = "button";
      insert.addEventListener("click", () => {
        insertComposerEvidenceBlock(item);
      });
      row.appendChild(insert);
      postEvidenceListEl.appendChild(row);
    });
  }

  async function loadComposerEvidenceBucket() {
    const { postEvidenceListEl } = getElements();
    if (!postEvidenceListEl) return;
    const seq = ++composerBucketSeq;
    composerBucketState = "loading";
    if (!composerBucketItems.length) renderComposerEvidenceBucket();
    try {
      const result = await window.TarotDataService.fetchEvidenceStore();
      if (seq !== composerBucketSeq) return;
      composerBucketItems = Array.isArray(result?.evidence) ? result.evidence : [];
      composerBucketState = "ready";
      renderComposerEvidenceBucket();
    } catch (error) {
      if (seq !== composerBucketSeq) return;
      composerBucketItems = [];
      composerBucketState = "error";
      composerBucketError = error?.message || "Could not load evidence.";
      renderComposerEvidenceBucket();
    }
  }

  function renderComposerBlocks() {
    const { postBlocksEl } = getElements();
    if (!postBlocksEl) return;
    postBlocksEl.textContent = "";
    composerBlocks.forEach((block, index) => {
      const row = makeEl("div", "profile-post-block");
      row.setAttribute("data-block-id", block.id);
      row.setAttribute("data-block-kind", block.kind);
      if (block.kind === "evidence") {
        row.classList.add("is-evidence");
        row.setAttribute("data-evidence-id", block.evidenceId);
      }
      const tools = makeEl("div", "profile-post-block-tools");
      const up = makeEl("button", "profile-post-block-btn", "↑");
      up.type = "button";
      up.title = "Move up";
      up.setAttribute("data-block-action", "up");
      up.disabled = index === 0;
      tools.appendChild(up);
      const down = makeEl("button", "profile-post-block-btn", "↓");
      down.type = "button";
      down.title = "Move down";
      down.setAttribute("data-block-action", "down");
      down.disabled = index === composerBlocks.length - 1;
      tools.appendChild(down);
      const remove = makeEl("button", "profile-post-block-btn", "✕");
      remove.type = "button";
      remove.title = "Remove block";
      remove.setAttribute("data-block-action", "remove");
      tools.appendChild(remove);
      row.appendChild(tools);
      const bodyEl = makeEl("div", "profile-post-block-body");
      if (block.kind === "evidence") {
        const marker = makeEl("span", "profile-post-evidence-chip profile-post-evidence-marker", evidenceMeta(block.evidenceId).title || "Evidence");
        marker.title = evidenceMeta(block.evidenceId).title || "Evidence";
        bodyEl.appendChild(marker);
      } else {
        const editor = makeEl("div", "profile-post-block-text");
        editor.setAttribute("contenteditable", "true");
        editor.setAttribute("role", "textbox");
        editor.setAttribute("aria-multiline", "true");
        editor.setAttribute("data-placeholder", index === 0 ? "State the theory…" : "Add another thought…");
        editor.innerHTML = block.html || "";
        syncPostEditorEmptyState(editor);
        bodyEl.appendChild(editor);
      }
      row.appendChild(bodyEl);
      postBlocksEl.appendChild(row);
    });
    updateComposerEvidenceCount();
    renderComposerEvidenceBucket();
  }

  function syncComposerBlocksFromDom() {
    const { postBlocksEl } = getElements();
    if (!postBlocksEl) return;
    postBlocksEl.querySelectorAll(".profile-post-block").forEach((row) => {
      if (row.getAttribute("data-block-kind") !== "text") return;
      const block = composerBlocks.find((item) => item.id === row.getAttribute("data-block-id"));
      const editor = row.querySelector(".profile-post-block-text");
      if (block && editor) block.html = editor.innerHTML;
    });
  }

  function captureComposerCaret() {
    const { postBlocksEl } = getElements();
    if (!postBlocksEl) return null;
    const selection = window.getSelection();
    const active = document.activeElement;
    let editor = null;
    if (active && active.classList?.contains("profile-post-block-text") && postBlocksEl.contains(active)) {
      editor = active;
    } else if (selection && selection.rangeCount) {
      const anchor = selection.anchorNode;
      const element = anchor?.nodeType === 1 ? anchor : anchor?.parentElement;
      const found = element?.closest?.(".profile-post-block-text");
      if (found && postBlocksEl.contains(found)) editor = found;
    }
    if (!editor) return null;
    const blockId = editor.closest(".profile-post-block")?.getAttribute("data-block-id") || "";
    if (!blockId) return null;
    if (!selection || !selection.rangeCount) return { blockId, offset: null };
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.endContainer)) return { blockId, offset: null };
    const measured = range.cloneRange();
    measured.selectNodeContents(editor);
    measured.setEnd(range.endContainer, range.endOffset);
    return { blockId, offset: measured.toString().length };
  }

  function restoreComposerCaret(snapshot) {
    if (!snapshot?.blockId) return false;
    const { postBlocksEl } = getElements();
    const editor = postBlocksEl?.querySelector(`[data-block-id="${snapshot.blockId}"] .profile-post-block-text`);
    if (!editor) return false;
    editor.focus();
    if (snapshot.offset == null) return true;
    const selection = window.getSelection();
    if (!selection) return true;
    const range = document.createRange();
    let remaining = snapshot.offset;
    let target = null;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const length = node.textContent.length;
      if (remaining <= length) {
        target = node;
        break;
      }
      remaining -= length;
      node = walker.nextNode();
    }
    if (target) {
      range.setStart(target, Math.min(remaining, target.textContent.length));
      range.collapse(true);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function resetComposerBlocks() {
    composerBlocks = [newComposerTextBlock()];
    activeTextBlockId = composerBlocks[0].id;
    composerInsertAnchorId = composerBlocks[0].id;
    renderComposerBlocks();
  }

  function addComposerTextBlock() {
    syncComposerBlocksFromDom();
    const block = newComposerTextBlock();
    const anchorIndex = composerBlocks.findIndex((entry) => entry.id === composerInsertAnchorId);
    const index = anchorIndex >= 0 ? anchorIndex + 1 : composerBlocks.length;
    composerBlocks.splice(index, 0, block);
    activeTextBlockId = block.id;
    composerInsertAnchorId = block.id;
    renderComposerBlocks();
    const { postBlocksEl } = getElements();
    postBlocksEl?.querySelector(`[data-block-id="${block.id}"] .profile-post-block-text`)?.focus();
  }

  function moveComposerBlock(blockId, delta) {
    syncComposerBlocksFromDom();
    const index = composerBlocks.findIndex((block) => block.id === blockId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= composerBlocks.length) return;
    const caret = captureComposerCaret();
    const [block] = composerBlocks.splice(index, 1);
    composerBlocks.splice(target, 0, block);
    renderComposerBlocks();
    if (caret) restoreComposerCaret(caret);
    renderPostPreview();
  }

  function removeComposerBlock(blockId) {
    syncComposerBlocksFromDom();
    const index = composerBlocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;
    const caret = captureComposerCaret();
    const [removed] = composerBlocks.splice(index, 1);
    if (removed.kind === "evidence") {
      const stillUsed = composerBlocks.some((block) => block.kind === "evidence" && block.evidenceId === removed.evidenceId);
      if (!stillUsed) {
        composerEvidence = composerEvidence.filter((item) => item.id !== removed.evidenceId);
      }
    }
    if (activeTextBlockId === blockId) activeTextBlockId = "";
    if (composerInsertAnchorId === blockId) composerInsertAnchorId = "";
    renderComposerBlocks();
    if (caret && caret.blockId !== blockId) restoreComposerCaret(caret);
    renderPostPreview();
  }

  function insertComposerEvidenceBlock(item) {
    if (!item?.id) return;
    syncComposerBlocksFromDom();
    if (!composerEvidence.some((entry) => entry.id === item.id)) {
      composerEvidence.push(item);
    }
    const block = { id: nextComposerBlockId(), kind: "evidence", evidenceId: item.id };
    const anchorIndex = composerBlocks.findIndex((entry) => entry.id === composerInsertAnchorId);
    const index = anchorIndex >= 0 ? anchorIndex + 1 : composerBlocks.length;
    composerBlocks.splice(index, 0, block);
    composerInsertAnchorId = block.id;
    renderComposerBlocks();
    renderPostPreview();
    void loadComposerEvidenceBucket();
  }

  // Live preview mirrors the public share page by rendering the server template
  // into a script-less sandbox, so what the author sees is what a reader gets.
  let postPreviewTimer = null;
  let postPreviewRequestSeq = 0;
  let postPreviewContentKey = "";

  function collectPostDraft() {
    const { postTitleEl, postBlocksEl } = getElements();
    const entries = [];
    const evidenceIds = [];
    (postBlocksEl ? Array.from(postBlocksEl.querySelectorAll(".profile-post-block")) : []).forEach((row) => {
      if (row.getAttribute("data-block-kind") === "evidence") {
        const evidenceId = String(row.getAttribute("data-evidence-id") || "").trim();
        if (!evidenceId) return;
        entries.push({ kind: "evidence", evidenceId });
        if (!evidenceIds.includes(evidenceId)) evidenceIds.push(evidenceId);
        return;
      }
      const editor = row.querySelector(".profile-post-block-text");
      const html = String(editor?.innerHTML || "").trim();
      if (postHtmlHasContent(html)) entries.push({ kind: "text", text: html });
    });
    const evidence = evidenceIds.map((evidenceId) => evidenceMeta(evidenceId));
    return {
      title: String(postTitleEl?.value || "").trim(),
      kind: "waking",
      body: "",
      entries,
      attachments: getAttachments(),
      evidence
    };
  }

  function postDraftIsEmpty(draft) {
    const hasText = (draft.entries || []).some((entry) => (
      entry.kind === "text" && postHtmlHasContent(entry.text)
    ));
    const hasEvidence = (draft.entries || []).some((entry) => entry.kind === "evidence");
    return !draft.title && !hasText && !hasEvidence && !draft.attachments.length;
  }

  function showPostPreviewNote(text, isError = false) {
    const { postPreviewCardEl } = getElements();
    if (!postPreviewCardEl) return;
    postPreviewCardEl.textContent = "";
    const note = makeEl("span", "profile-directory-empty", text);
    note.classList.toggle("is-error", isError);
    postPreviewCardEl.appendChild(note);
  }

  function showPostPreviewHtml(container, html, minHeight = "420px") {
    if (!container) return;
    container.textContent = "";
    const frame = makeEl("iframe");
    frame.setAttribute("sandbox", "");
    frame.title = "Post preview";
    frame.style.width = "100%";
    frame.style.minHeight = minHeight;
    frame.style.border = "1px solid #3f3f46";
    frame.style.borderRadius = "8px";
    frame.style.background = "#0f0f14";
    frame.srcdoc = String(html || "");
    container.appendChild(frame);
  }

  function cancelPostPreview() {
    if (postPreviewTimer) clearTimeout(postPreviewTimer);
    postPreviewTimer = null;
    postPreviewRequestSeq += 1;
  }

  async function renderPostPreviewNow({ includeAttachments = true } = {}) {
    const draft = collectPostDraft();
    if (postDraftIsEmpty(draft)) {
      postPreviewContentKey = "";
      showPostPreviewNote("Start writing to see the post preview.");
      return;
    }
    const contentKey = JSON.stringify({
      title: draft.title,
      entries: draft.entries,
      evidence: draft.evidence.map((item) => item.id)
    });
    if (!includeAttachments) {
      if (contentKey === postPreviewContentKey) return;
      draft.attachments = [];
    }
    const seq = ++postPreviewRequestSeq;
    showPostPreviewNote("Rendering…");
    try {
      const result = await window.TarotDataService.previewProfilePost(draft);
      if (seq !== postPreviewRequestSeq) return;
      postPreviewContentKey = contentKey;
      const html = String(result?.html || "");
      if (!html) {
        showPostPreviewNote("Preview unavailable.", true);
        return;
      }
      const { postPreviewCardEl } = getElements();
      showPostPreviewHtml(postPreviewCardEl, html);
    } catch (error) {
      if (seq !== postPreviewRequestSeq) return;
      showPostPreviewNote(error?.message || "Could not render the preview.", true);
    }
  }

  function renderPostPreview(options = {}) {
    const includeAttachments = options.includeAttachments !== false;
    if (postPreviewTimer) clearTimeout(postPreviewTimer);
    postPreviewTimer = null;
    if (options.immediate) {
      void renderPostPreviewNow({ includeAttachments });
      return;
    }
    postPreviewTimer = setTimeout(() => {
      postPreviewTimer = null;
      void renderPostPreviewNow({ includeAttachments });
    }, 300);
  }

  function setPostComposerOpen(open) {
    const { postComposerEl } = getElements();
    if (!postComposerEl) return;
    postComposerEl.hidden = !open;
    document.querySelector(".profile-feed-card")?.classList.toggle("is-composing", open);
    if (open) {
      void loadComposerEvidenceBucket();
      if (!composerBlocks.length) resetComposerBlocks();
      updatePostCounter();
      renderPostPreview();
      getActivePostEditor()?.focus();
    } else {
      cancelPostPreview();
      postOverLimitNotice = false;
      setPostStatus("");
    }
  }

  async function previewComposerPost() {
    if (!window.TaroOverlay?.open) return;
    const body = makeEl("div", "profile-feed-list");
    body.appendChild(makeEl("span", "profile-directory-empty", "Rendering…"));
    window.TaroOverlay.open({ title: "Post preview", size: "medium", body });
    const draft = collectPostDraft();
    if (postDraftIsEmpty(draft)) {
      body.textContent = "";
      body.appendChild(makeEl("span", "profile-directory-empty", "Start writing to see the post preview."));
      return;
    }
    try {
      const result = await window.TarotDataService.previewProfilePost(draft);
      const html = String(result?.html || "");
      body.textContent = "";
      if (!html) {
        body.appendChild(makeEl("span", "profile-directory-empty", "Preview unavailable."));
        return;
      }
      showPostPreviewHtml(body, html, "60vh");
    } catch (error) {
      body.textContent = "";
      body.appendChild(makeEl("span", "profile-directory-empty", error?.message || "Could not render the preview."));
    }
  }

  function togglePostComposer() {
    const { postComposerEl } = getElements();
    setPostComposerOpen(Boolean(postComposerEl?.hidden));
  }

  async function pickComposerEvidence() {
    if (!window.TaroOverlay?.open) return;
    const body = makeEl("div", "profile-feed-list");
    body.appendChild(makeEl("span", "profile-directory-empty", "Loading…"));
    window.TaroOverlay.open({ title: "Evidence — insert proof", size: "medium", body });
    try {
      const result = await window.TarotDataService.fetchEvidenceStore();
      const items = Array.isArray(result?.evidence) ? result.evidence : [];
      body.textContent = "";
      if (!items.length) {
        body.appendChild(makeEl("span", "profile-directory-empty", "Nothing collected yet. Use “Add to post” on any verse, card, or reference."));
        return;
      }
      items.forEach((item) => {
        const row = makeEl("div", "profile-feed-post");
        const quote = String(item.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
        row.appendChild(makeEl("strong", "", quote || item.title || "Evidence"));
        if (quote) {
          row.appendChild(makeEl("span", "profile-feed-post-meta", String(item.title || "Evidence")));
        }
        const insert = makeEl("button", "profile-btn profile-btn-primary", "Insert");
        insert.type = "button";
        insert.addEventListener("click", () => {
          insertComposerEvidenceBlock(item);
          window.TaroOverlay.close();
        });
        row.appendChild(insert);
        body.appendChild(row);
      });
    } catch (error) {
      body.textContent = "";
      body.appendChild(makeEl("span", "profile-directory-empty", error?.message || "Could not load evidence."));
    }
  }

  async function submitPost() {
    const { postTitleEl, postSubmitBtn } = getElements();
    const draft = collectPostDraft();
    if (composerTextOverLimit()) {
      setPostStatus(`Each block tops out at ${MAX_POST_TEXT_LENGTH} characters — shorten the long block.`, true);
      updatePostCounter();
      return;
    }
    if (postDraftIsEmpty(draft)) {
      setPostStatus("Write something first.", true);
      return;
    }
    if (postSubmitBtn) postSubmitBtn.disabled = true;
    try {
      await window.TarotDataService.createProfilePost({
        title: draft.title || undefined,
        body: draft.body,
        entries: draft.entries,
        attachments: draft.attachments,
        evidenceIds: draft.evidence.map((item) => item.id)
      });
      if (postTitleEl) postTitleEl.value = "";
      options.clearAttachments?.();
      composerEvidence = [];
      resetComposerBlocks();
      renderPostAttachments();
      updatePostCounter();
      renderPostPreview();
      setPostComposerOpen(false);
      setPostStatus("Posted.");
      options.onPosted?.();
    } catch (error) {
      setPostStatus(`Could not post. ${error?.message || ""}`.trim(), true);
    } finally {
      if (postSubmitBtn) postSubmitBtn.disabled = false;
    }
  }

  function mount(opts = {}) {
    options = opts && typeof opts === "object" ? opts : {};
    if (state.initialized) return;
    state.initialized = true;
    const elements = getElements();

    elements.postSubmitBtn?.addEventListener("click", () => {
      void submitPost();
    });
    elements.postBlocksEl?.addEventListener("input", (event) => {
      const editor = event.target.closest?.(".profile-post-block-text");
      if (editor) syncPostEditorEmptyState(editor);
      updatePostCounter();
      renderPostPreview({ includeAttachments: false });
    });
    elements.postBlocksEl?.addEventListener("focusin", (event) => {
      const row = event.target.closest?.(".profile-post-block");
      if (row && row.getAttribute("data-block-kind") === "text") {
        activeTextBlockId = row.getAttribute("data-block-id");
        composerInsertAnchorId = activeTextBlockId;
      }
    });
    elements.postAddTextBtnEl?.addEventListener("click", () => {
      addComposerTextBlock();
    });
    elements.postComposerEl?.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-block-action]");
      if (!button) return;
      const blockId = button.closest("[data-block-id]")?.getAttribute("data-block-id") || "";
      if (!blockId) return;
      const action = button.getAttribute("data-block-action");
      if (action === "up") moveComposerBlock(blockId, -1);
      else if (action === "down") moveComposerBlock(blockId, 1);
      else if (action === "remove") removeComposerBlock(blockId);
    });
    elements.postTitleEl?.addEventListener("input", () => {
      renderPostPreview({ includeAttachments: false });
    });
    document.getElementById("profile-post-preview-btn")?.addEventListener("click", previewComposerPost);
    document.getElementById("profile-post-cancel")?.addEventListener("click", () => {
      setPostComposerOpen(false);
    });
    elements.postEvidenceBtn?.addEventListener("click", () => {
      void pickComposerEvidence();
    });
    elements.postFilesEl?.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      for (const file of files) {
        const attachment = await fileToAttachment(file);
        if (attachment) getAttachments().push(attachment);
      }
      renderPostAttachments();
      renderPostPreview({ includeAttachments: true, immediate: true });
    });
    ensurePostTools();
    updatePostCounter();
    updateComposerEvidenceCount();
    document.addEventListener("section:changed", (event) => {
      if (event.detail?.activeSection !== "profile") cancelPostPreview();
    });
  }

  function reset() {
    composerEvidence = [];
    resetComposerBlocks();
  }

  window.PostEditorUi = {
    mount,
    setOpen: setPostComposerOpen,
    toggle: togglePostComposer,
    isOpen() {
      const composer = document.getElementById("profile-post-composer");
      return Boolean(composer && !composer.hidden);
    },
    collectDraft: collectPostDraft,
    isEmptyDraft: postDraftIsEmpty,
    openEvidencePicker: pickComposerEvidence,
    reset,
    cancelPreview: cancelPostPreview,
    showPostPreviewHtml,
    hasContent: postHtmlHasContent
  };
})();
