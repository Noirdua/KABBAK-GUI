(function () {
  "use strict";

  const SCRIPT_KEY = "kabbak-editor-keyboard-script";
  const POSITION_KEY = "kabbak-keyboard-position";
  const SCRIPT_FONT_STACK = "\"Noto Sans Hebrew\", \"Noto Serif\", \"Amiri\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif";

  const SCRIPTS = [
    {
      id: "english",
      label: "English",
      dir: "ltr",
      defaultCase: "lower",
      cases: {
        lower: "abcdefghijklmnopqrstuvwxyz".split(""),
        upper: "abcdefghijklmnopqrstuvwxyz".toUpperCase().split("")
      }
    },
    {
      id: "hebrew",
      label: "Hebrew",
      dir: "rtl",
      defaultCase: "single",
      cases: {
        single: ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ך", "ל", "מ", "ם", "נ", "ן", "ס", "ע", "פ", "ף", "צ", "ץ", "ק", "ר", "ש", "ת"]
      }
    },
    {
      id: "greek",
      label: "Greek",
      dir: "ltr",
      defaultCase: "lower",
      cases: {
        lower: ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ", "ν", "ξ", "ο", "π", "ρ", "σ", "ς", "τ", "υ", "φ", "χ", "ψ", "ω"],
        upper: ["Α", "Β", "Γ", "Δ", "Ε", "Ζ", "Η", "Θ", "Ι", "Κ", "Λ", "Μ", "Ν", "Ξ", "Ο", "Π", "Ρ", "Σ", "Τ", "Υ", "Φ", "Χ", "Ψ", "Ω"]
      }
    },
    {
      id: "arabic",
      label: "Arabic",
      dir: "rtl",
      defaultCase: "single",
      cases: {
        single: ["ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"]
      }
    },
    {
      id: "enochian",
      label: "Enochian",
      dir: "ltr",
      defaultCase: "single",
      cases: {
        single: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "V", "X", "Z"]
      }
    }
  ];

  const state = {
    overlay: null,
    scriptEl: null,
    keysEl: null,
    target: null,
    range: null,
    selectionStart: null,
    selectionEnd: null,
    scriptId: readScript(),
    caseId: ""
  };

  function readScript() {
    try {
      const value = String(window.localStorage.getItem(SCRIPT_KEY) || "").trim();
      return SCRIPTS.some((script) => script.id === value) ? value : "english";
    } catch (_error) {
      return "english";
    }
  }

  function writeScript(scriptId) {
    try {
      window.localStorage.setItem(SCRIPT_KEY, scriptId);
    } catch (_error) {}
  }

  function scriptById(scriptId) {
    return SCRIPTS.find((script) => script.id === scriptId) || SCRIPTS[0];
  }

  function activeScript() {
    return scriptById(state.scriptId);
  }

  function activeChars() {
    const script = activeScript();
    const caseId = state.caseId || script.defaultCase || Object.keys(script.cases)[0];
    return script.cases[caseId] || [];
  }

  function prepareField(field) {
    if (!(field instanceof HTMLElement)) return;
    field.classList.add("kabbak-editor-input");
  }

  function ensureOverlay() {
    if (state.overlay) return state.overlay;

    const overlay = document.createElement("div");
    overlay.className = "kabbak-keyboard";
    overlay.id = "kabbak-keyboard";
    overlay.hidden = true;
    overlay.setAttribute("role", "region");
    overlay.setAttribute("aria-label", "Language keyboard");

    function clampPosition(left, top) {
      const rect = overlay.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);
      return {
        left: Math.max(0, Math.min(left, maxLeft)),
        top: Math.max(0, Math.min(top, maxTop))
      };
    }

    function placeOverlay(left, top) {
      const position = clampPosition(left, top);
      overlay.style.left = `${position.left}px`;
      overlay.style.top = `${position.top}px`;
      overlay.style.bottom = "auto";
      overlay.style.transform = "none";
    }

    function resetPosition() {
      overlay.style.left = "";
      overlay.style.top = "";
      overlay.style.bottom = "";
      overlay.style.transform = "";
      try {
        window.localStorage.removeItem(POSITION_KEY);
      } catch (_error) {}
    }

    function restorePosition() {
      if (overlay.hidden) return;
      try {
        const raw = window.localStorage.getItem(POSITION_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (Number.isFinite(saved?.left) && Number.isFinite(saved?.top)) {
          placeOverlay(saved.left, saved.top);
        }
      } catch (_error) {}
    }

    const panel = document.createElement("div");
    panel.className = "kabbak-keyboard-panel";

    const head = document.createElement("div");
    head.className = "kabbak-keyboard-head";
    const grip = document.createElement("span");
    grip.className = "kabbak-keyboard-grip";
    grip.textContent = "⠿";
    grip.title = "Drag to move · double-click to reset";
    const title = document.createElement("strong");
    title.textContent = "Language keyboard";
    const scriptEl = document.createElement("select");
    scriptEl.className = "kabbak-keyboard-script";
    scriptEl.id = "kabbak-keyboard-script";
    scriptEl.setAttribute("aria-label", "Keyboard language");
    SCRIPTS.forEach((script) => {
      const option = document.createElement("option");
      option.value = script.id;
      option.textContent = script.label;
      scriptEl.appendChild(option);
    });
    scriptEl.addEventListener("change", () => {
      state.scriptId = scriptEl.value;
      state.caseId = "";
      writeScript(state.scriptId);
      applyScriptFont(state.target);
      renderKeys();
      if (state.target?.isContentEditable) {
        focusField();
      }
    });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "kabbak-keyboard-close";
    close.textContent = "Close";
    close.addEventListener("click", closeKeyboard);
    head.append(grip, title, scriptEl, close);

    let drag = null;
    head.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 && event.pointerType !== "touch") return;
      if (event.target.closest("button, select, input, a")) return;
      const rect = overlay.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      head.classList.add("is-dragging");
      placeOverlay(rect.left, rect.top);
      event.preventDefault();
      try {
        head.setPointerCapture(event.pointerId);
      } catch (_error) {}
    });
    head.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      placeOverlay(drag.left + event.clientX - drag.startX, drag.top + event.clientY - drag.startY);
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag = null;
      head.classList.remove("is-dragging");
      try {
        const rect = overlay.getBoundingClientRect();
        window.localStorage.setItem(POSITION_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (_error) {}
      try {
        head.releasePointerCapture(event.pointerId);
      } catch (_error) {}
    };
    head.addEventListener("pointerup", endDrag);
    head.addEventListener("pointercancel", endDrag);
    head.addEventListener("dblclick", (event) => {
      if (event.target.closest("button, select")) return;
      resetPosition();
    });
    window.addEventListener("resize", () => {
      if (overlay.hidden || !overlay.style.left) return;
      const rect = overlay.getBoundingClientRect();
      placeOverlay(rect.left, rect.top);
    });

    const keysEl = document.createElement("div");
    keysEl.className = "kabbak-keyboard-keys";
    keysEl.id = "kabbak-keyboard-keys";
    keysEl.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) event.preventDefault();
    });
    keysEl.addEventListener("click", (event) => {
      const keyButton = event.target.closest("[data-keyboard-insert]");
      if (!keyButton) return;
      insertText(String(keyButton.dataset.keyboardInsert || ""));
    });

    const actions = document.createElement("div");
    actions.className = "kabbak-keyboard-actions";
    actions.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) event.preventDefault();
    });
    actions.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-keyboard-action]");
      if (!actionButton) return;
      handleAction(String(actionButton.dataset.keyboardAction || ""));
    });
    [
      ["shift", "Shift"],
      ["space", "Space"],
      ["backspace", "Backspace"],
      ["newline", "New line"]
    ].forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "kabbak-keyboard-action";
      button.dataset.keyboardAction = action;
      button.textContent = label;
      actions.appendChild(button);
    });

    panel.append(head, keysEl, actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    state.overlay = overlay;
    state.scriptEl = scriptEl;
    state.keysEl = keysEl;
    state.actionsEl = actions;
    state.restorePosition = restorePosition;

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.overlay && !state.overlay.hidden) {
        event.preventDefault();
        closeKeyboard();
      }
    });
    document.addEventListener("selectionchange", () => {
      if (!state.overlay || state.overlay.hidden) return;
      const target = state.target;
      if (!target || !target.isConnected) return;
      if (target.isContentEditable) {
        const selection = window.getSelection();
        if (selection?.rangeCount && target.contains(selection.anchorNode)) {
          state.range = selection.getRangeAt(0).cloneRange();
        }
      }
    });
    return overlay;
  }

  function renderKeys() {
    if (!state.keysEl) return;
    const script = activeScript();
    const caseId = state.caseId || script.defaultCase || Object.keys(script.cases)[0];
    state.caseId = caseId;
    if (state.scriptEl) state.scriptEl.value = script.id;
    state.keysEl.dataset.script = script.id;
    state.keysEl.setAttribute("dir", "ltr");
    state.keysEl.replaceChildren();
    const fragment = document.createDocumentFragment();
    (script.cases[caseId] || []).forEach((char) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "kabbak-key";
      button.dataset.keyboardInsert = char;
      button.textContent = char;
      fragment.appendChild(button);
    });
    state.keysEl.appendChild(fragment);
    const shiftButton = state.actionsEl?.querySelector('[data-keyboard-action="shift"]');
    if (shiftButton) {
      const hasCases = Object.keys(script.cases).length > 1;
      shiftButton.hidden = !hasCases;
      shiftButton.disabled = !hasCases;
      shiftButton.setAttribute("aria-pressed", state.caseId === "upper" ? "true" : "false");
    }
  }

  function focusField() {
    const target = state.target;
    if (!target || !target.isConnected) return;
    target.focus({ preventScroll: true });
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const start = Number.isFinite(state.selectionStart) ? state.selectionStart : target.value.length;
      const end = Number.isFinite(state.selectionEnd) ? state.selectionEnd : start;
      target.setSelectionRange(start, end);
      return;
    }
    if (target.isContentEditable) {
      const selection = window.getSelection();
      if (!selection) return;
      if (state.range && target.contains(state.range.startContainer)) {
        selection.removeAllRanges();
        selection.addRange(state.range);
      } else {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        state.range = range.cloneRange();
      }
    }
  }

  function applyScriptFont(field) {
    if (!(field instanceof HTMLElement)) return;
    field.classList.toggle("kabbak-script-enochian", state.scriptId === "enochian");
  }

  function saveSelection() {
    const target = state.target;
    if (!target || !target.isConnected) return;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      state.selectionStart = target.selectionStart ?? target.value.length;
      state.selectionEnd = target.selectionEnd ?? state.selectionStart;
      return;
    }
    if (target.isContentEditable) {
      const selection = window.getSelection();
      if (selection?.rangeCount && target.contains(selection.anchorNode)) {
        state.range = selection.getRangeAt(0).cloneRange();
      }
    }
  }

  function openKeyboard(field) {
    if (!(field instanceof HTMLElement)) return;
    prepareField(field);
    state.target = field;
    state.range = null;
    state.selectionStart = null;
    state.selectionEnd = null;
    saveSelection(field);
    ensureOverlay();
    state.overlay.hidden = false;
    state.restorePosition?.();
    document.documentElement.classList.add("kabbak-keyboard-open");
    state.scriptId = readScript();
    state.caseId = "";
    applyScriptFont(field);
    renderKeys();
    if (document.activeElement !== field) {
      focusField();
      saveSelection();
    }
    try {
      field.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (_error) {
      field.scrollIntoView();
    }
  }

  function closeKeyboard() {
    if (!state.overlay) return;
    state.overlay.hidden = true;
    document.documentElement.classList.remove("kabbak-keyboard-open");
    state.target = null;
    state.range = null;
  }

  function insertText(text) {
    const target = state.target;
    if (!target || !target.isConnected) {
      closeKeyboard();
      return;
    }
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const start = target.selectionStart ?? state.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? state.selectionEnd ?? start;
      target.setRangeText(text, start, end, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      state.selectionStart = start + text.length;
      state.selectionEnd = state.selectionStart;
      target.focus({ preventScroll: true });
      target.setSelectionRange(state.selectionStart, state.selectionEnd);
      return;
    }
    if (target.isContentEditable) {
      focusField();
      try {
        document.execCommand("insertText", false, text);
      } catch (_error) {}
      saveSelection();
    }
  }

  function deleteBackward() {
    const target = state.target;
    if (!target || !target.isConnected) {
      closeKeyboard();
      return;
    }
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
      const start = target.selectionStart ?? state.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? state.selectionEnd ?? start;
      const nextStart = start === end ? Math.max(0, start - 1) : start;
      target.setRangeText("", nextStart, end, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      state.selectionStart = nextStart;
      state.selectionEnd = nextStart;
      target.focus({ preventScroll: true });
      target.setSelectionRange(nextStart, nextStart);
      return;
    }
    if (target.isContentEditable) {
      focusField();
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!range.collapsed) {
        range.deleteContents();
      } else {
        try {
          selection.modify("extend", "backward", "character");
          selection.deleteFromDocument();
        } catch (_error) {
          document.execCommand("delete");
        }
      }
      saveSelection();
    }
  }

  function insertNewline() {
    const target = state.target;
    if (!target || !target.isConnected) {
      closeKeyboard();
      return;
    }
    if (target.isContentEditable) {
      focusField();
      try {
        document.execCommand("insertHTML", false, "<br>");
      } catch (_error) {}
      saveSelection();
      return;
    }
    insertText("\n");
  }

  function handleAction(action) {
    if (action === "shift") {
      const script = activeScript();
      const caseKeys = Object.keys(script.cases);
      if (caseKeys.length < 2) return;
      const current = state.caseId || script.defaultCase || caseKeys[0];
      const index = caseKeys.indexOf(current);
      state.caseId = caseKeys[(index + 1) % caseKeys.length];
      renderKeys();
      focusField();
      return;
    }
    if (action === "space") {
      insertText(" ");
      return;
    }
    if (action === "backspace") {
      deleteBackward();
      return;
    }
    if (action === "newline") {
      insertNewline();
    }
  }

  function applyMarkdown(area, format) {
    if (!(area instanceof HTMLTextAreaElement)) return;
    const start = area.selectionStart ?? 0;
    const end = area.selectionEnd ?? 0;
    const value = area.value;
    const selected = value.slice(start, end);
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    let lineEnd = value.indexOf("\n", end);
    if (lineEnd < 0) lineEnd = value.length;
    const replace = (from, to, text, selectStart, selectEnd) => {
      area.value = value.slice(0, from) + text + value.slice(to);
      area.focus();
      area.setSelectionRange(selectStart, selectEnd);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    };

    if (format === "bold") {
      const inner = selected || "bold";
      replace(start, end, `**${inner}**`, start + 2, start + 2 + inner.length);
      return;
    }
    if (format === "italic") {
      const inner = selected || "italic";
      replace(start, end, `*${inner}*`, start + 1, start + 1 + inner.length);
      return;
    }
    if (format === "strike") {
      const inner = selected || "text";
      replace(start, end, `~~${inner}~~`, start + 2, start + 2 + inner.length);
      return;
    }
    if (format === "code") {
      const inner = selected || "code";
      if (selected.includes("\n") || !selected) {
        const block = `\`\`\`\n${inner}\n\`\`\``;
        replace(start, end, block, start + 4, start + 4 + inner.length);
        return;
      }
      replace(start, end, `\`${inner}\``, start + 1, start + 1 + inner.length);
      return;
    }
    if (format === "link") {
      const label = selected || "link text";
      const inserted = `[${label}](https://)`;
      replace(start, end, inserted, start + label.length + 3, start + inserted.length - 1);
      return;
    }

    const from = start === end ? lineStart : lineStart;
    const to = start === end ? lineEnd : lineEnd;
    const block = value.slice(from, to);
    const mapped = (block || " ").split("\n").map((line, index) => {
      const trimmed = line.replace(/^\s+/, "");
      if (format === "heading") {
        const text = trimmed.replace(/^#{1,3}\s+/, "") || "heading";
        return `## ${text}`;
      }
      if (format === "quote") {
        return trimmed.startsWith("> ") ? trimmed : `> ${trimmed || "quote"}`;
      }
      if (format === "ul") {
        const text = trimmed.replace(/^[-*]\s+/, "") || "item";
        return `- ${text}`;
      }
      if (format === "ol") {
        const text = trimmed.replace(/^\d+\.\s+/, "") || "item";
        return `${index + 1}. ${text}`;
      }
      return line;
    }).join("\n");
    replace(from, to, mapped, from, from + mapped.length);
  }

  function addKeyboardButton(toolbar, field) {
    if (!(toolbar instanceof HTMLElement) || !(field instanceof HTMLElement)) return null;
    prepareField(field);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kabbak-editor-btn kabbak-editor-keyboard-btn";
    button.textContent = "⌨";
    button.title = "Language keyboard";
    button.setAttribute("aria-label", "Open the language keyboard");
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => openKeyboard(field));
    toolbar.appendChild(button);
    return button;
  }

  function markdownToolbar(area) {
    if (!(area instanceof HTMLTextAreaElement)) return null;
    prepareField(area);
    const toolbar = document.createElement("div");
    toolbar.className = "kabbak-editor-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Formatting");
    [
      ["bold", "B", "Bold"],
      ["italic", "I", "Italic"],
      ["strike", "S", "Strikethrough"],
      ["heading", "H", "Heading"],
      ["quote", "“", "Quote"],
      ["ul", "•", "Bullet list"],
      ["ol", "1.", "Numbered list"],
      ["link", "Link", "Link"],
      ["code", "</>", "Code"]
    ].forEach(([format, label, title]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "kabbak-editor-btn";
      button.dataset.format = format;
      button.textContent = label;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        area.focus();
        applyMarkdown(area, format);
      });
      toolbar.appendChild(button);
    });
    addKeyboardButton(toolbar, area);
    if (area.dataset.kabbakShortcuts !== "1") {
      area.dataset.kabbakShortcuts = "1";
      area.addEventListener("keydown", (event) => {
        if (!(event.ctrlKey || event.metaKey)) return;
        const key = String(event.key || "").toLowerCase();
        if (key === "b") {
          event.preventDefault();
          applyMarkdown(area, "bold");
        } else if (key === "i") {
          event.preventDefault();
          applyMarkdown(area, "italic");
        } else if (key === "k") {
          event.preventDefault();
          applyMarkdown(area, "link");
        }
      });
    }
    return toolbar;
  }

  function mountMarkdown(area) {
    if (!(area instanceof HTMLTextAreaElement) || area.dataset.kabbakMarkdown === "1") return null;
    area.dataset.kabbakMarkdown = "1";
    const toolbar = markdownToolbar(area);
    if (toolbar) area.insertAdjacentElement("beforebegin", toolbar);
    return toolbar;
  }

  function enhanceKeyboardOnly(field, host) {
    if (!(field instanceof HTMLElement)) return null;
    prepareField(field);
    if (field.dataset.kabbakKeyboard === "1") return null;
    field.dataset.kabbakKeyboard = "1";
    const toolbar = document.createElement("div");
    toolbar.className = "kabbak-editor-toolbar kabbak-editor-toolbar--compact";
    addKeyboardButton(toolbar, field);
    if (host instanceof HTMLElement) {
      host.appendChild(toolbar);
    } else {
      field.insertAdjacentElement("beforebegin", toolbar);
    }
    return toolbar;
  }

  window.KabbakEditor = {
    scriptFontStack: SCRIPT_FONT_STACK,
    openKeyboard,
    closeKeyboard,
    addKeyboardButton,
    markdownToolbar,
    mountMarkdown,
    enhanceKeyboardOnly
  };
})();
