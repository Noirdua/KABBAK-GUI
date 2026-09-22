(function () {
  "use strict";

  const SEEN_KEY = "kabbak-board-seen-at";
  let bound = false;
  let topics = [];
  let currentTopicId = "";
  let currentTopic = null;
  let lastSeenAt = 0;

  function el(id) {
    const node = document.getElementById(id);
    return node instanceof HTMLElement ? node : null;
  }

  function setStatus(id, text, isError) {
    const node = el(id);
    if (!node) return;
    node.textContent = text || "";
    node.dataset.tone = isError ? "error" : "neutral";
  }

  function show(node, visible) {
    if (node) node.hidden = !visible;
  }

  function service() {
    return window.TarotDataService;
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function appendInlines(parent, text) {
    const src = String(text || "");
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;
    let last = 0;
    let match = pattern.exec(src);
    while (match) {
      if (match.index > last) {
        parent.appendChild(document.createTextNode(src.slice(last, match.index)));
      }
      const token = match[0];
      if (token.startsWith("`")) {
        const code = document.createElement("code");
        code.textContent = token.slice(1, -1);
        parent.appendChild(code);
      } else if (token.startsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = token.slice(2, -2);
        parent.appendChild(strong);
      } else if (token.startsWith("~~")) {
        const del = document.createElement("del");
        del.textContent = token.slice(2, -2);
        parent.appendChild(del);
      } else if (token.startsWith("*")) {
        const em = document.createElement("em");
        em.textContent = token.slice(1, -1);
        parent.appendChild(em);
      } else if (match[2] && match[3]) {
        const link = document.createElement("a");
        link.href = match[3];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = match[2];
        parent.appendChild(link);
      }
      last = match.index + token.length;
      match = pattern.exec(src);
    }
    if (last < src.length) {
      parent.appendChild(document.createTextNode(src.slice(last)));
    }
  }

  function renderMarkdown(source) {
    const fragment = document.createDocumentFragment();
    const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }
      if (line.trimStart().startsWith("```")) {
        index += 1;
        const buf = [];
        while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
          buf.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1;
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = buf.join("\n");
        pre.appendChild(code);
        fragment.appendChild(pre);
        continue;
      }
      const heading = /^(#{1,3})\s+(.*)$/.exec(line);
      if (heading) {
        const node = document.createElement(`h${heading[1].length + 2}`);
        appendInlines(node, heading[2]);
        fragment.appendChild(node);
        index += 1;
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quote = document.createElement("blockquote");
        const buf = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          buf.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        appendInlines(quote, buf.join("\n"));
        fragment.appendChild(quote);
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const list = document.createElement("ul");
        while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
          const item = document.createElement("li");
          appendInlines(item, lines[index].replace(/^\s*[-*]\s+/, ""));
          list.appendChild(item);
          index += 1;
        }
        fragment.appendChild(list);
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        const list = document.createElement("ol");
        while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
          const item = document.createElement("li");
          appendInlines(item, lines[index].replace(/^\s*\d+\.\s+/, ""));
          list.appendChild(item);
          index += 1;
        }
        fragment.appendChild(list);
        continue;
      }
      const para = [];
      while (index < lines.length && lines[index].trim()
        && !lines[index].trimStart().startsWith("```")
        && !/^(#{1,3})\s+/.test(lines[index])
        && !/^>\s?/.test(lines[index])
        && !/^\s*[-*]\s+/.test(lines[index])
        && !/^\s*\d+\.\s+/.test(lines[index])) {
        para.push(lines[index]);
        index += 1;
      }
      const paragraph = document.createElement("p");
      appendInlines(paragraph, para.join("\n"));
      fragment.appendChild(paragraph);
    }
    return fragment;
  }

  function setFormatted(node, text) {
    if (!node) return;
    node.textContent = "";
    node.appendChild(renderMarkdown(text));
  }

  function applyFormat(area, format) {
    if (!(area instanceof HTMLTextAreaElement)) return;
    const start = area.selectionStart ?? 0;
    const end = area.selectionEnd ?? 0;
    const value = area.value;
    const selected = value.slice(start, end);
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndRaw = value.indexOf("\n", end);
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;

    function replace(from, to, next, selFrom, selTo) {
      area.value = value.slice(0, from) + next + value.slice(to);
      area.focus();
      area.setSelectionRange(selFrom, selTo);
    }

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

    const from = selected ? start : lineStart;
    const to = selected ? end : lineEnd;
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

  function makeFormatBar(area) {
    const bar = document.createElement("div");
    bar.className = "community-format-bar";
    const buttons = [
      { format: "bold", label: "B", title: "Bold" },
      { format: "italic", label: "I", title: "Italic" },
      { format: "strike", label: "S", title: "Strikethrough" },
      { format: "heading", label: "H", title: "Heading" },
      { format: "quote", label: "“", title: "Quote" },
      { format: "ul", label: "•", title: "Bullet list" },
      { format: "ol", label: "1.", title: "Numbered list" },
      { format: "link", label: "Link", title: "Link" },
      { format: "code", label: "</>", title: "Code" }
    ];
    buttons.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "community-format-btn";
      button.dataset.format = entry.format;
      button.title = entry.title;
      button.setAttribute("aria-label", entry.title);
      button.textContent = entry.label;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyFormat(area, entry.format);
      });
      bar.appendChild(button);
    });
    area.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = String(event.key || "").toLowerCase();
      if (key === "b") {
        event.preventDefault();
        applyFormat(area, "bold");
      } else if (key === "i") {
        event.preventDefault();
        applyFormat(area, "italic");
      } else if (key === "k") {
        event.preventDefault();
        applyFormat(area, "link");
      }
    });
    return bar;
  }

  function attachFormatBar(area) {
    if (!(area instanceof HTMLTextAreaElement) || area.dataset.formatBar === "1") return;
    area.dataset.formatBar = "1";
    area.insertAdjacentElement("beforebegin", makeFormatBar(area));
  }

  function renderTopicList() {
    const list = el("community-topic-list");
    if (!list) return;
    list.textContent = "";
    if (!topics.length) {
      const empty = document.createElement("p");
      empty.className = "body-text";
      empty.textContent = "No topics yet. Start one.";
      list.appendChild(empty);
      return;
    }
    topics.forEach((topic) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `community-topic-item${topic.id === currentTopicId ? " is-active" : ""}`;
      item.addEventListener("click", () => {
        void openTopic(topic.id);
      });
      const head = document.createElement("span");
      head.className = "community-topic-item-head";
      if (topic.pinned) {
        const pin = document.createElement("span");
        pin.className = "community-badge is-pinned";
        pin.textContent = "Pinned";
        head.appendChild(pin);
      }
      if (lastSeenAt > 0 && Date.parse(topic.updatedAt) > lastSeenAt) {
        const fresh = document.createElement("span");
        fresh.className = "community-badge is-new";
        fresh.textContent = "New";
        head.appendChild(fresh);
      }
      const title = document.createElement("span");
      title.className = "community-topic-item-title";
      title.textContent = topic.title || "(untitled)";
      head.appendChild(title);
      const meta = document.createElement("span");
      meta.className = "community-topic-item-meta";
      meta.textContent = `${topic.authorName || "Someone"} · ${topic.replyCount} repl${topic.replyCount === 1 ? "y" : "ies"} · ${formatDate(topic.updatedAt)}`;
      item.append(head, meta);
      list.appendChild(item);
    });
  }

  async function loadTopics() {
    try {
      const result = await service().fetchBoardTopics();
      topics = Array.isArray(result?.topics) ? result.topics : [];
      renderTopicList();
      void loadContributors();
    } catch (error) {
      const list = el("community-topic-list");
      if (list) {
        list.textContent = "";
        const node = document.createElement("p");
        node.className = "body-text";
        node.textContent = error?.message || "Could not load topics.";
        list.appendChild(node);
      }
    }
  }

  function renderTopic(topic) {
    currentTopic = topic;
    show(el("community-compose"), false);
    show(el("community-empty"), false);
    show(el("community-topic-view"), true);
    show(el("community-topic-editor"), false);
    show(el("community-topic-body"), true);
    // Never leave the actions menu open behind a different topic.
    el("community-topic-actions-menu")?.setAttribute("hidden", "hidden");
    el("community-topic-actions-toggle")?.setAttribute("aria-expanded", "false");
    closeReport();
    const pinButton = el("community-topic-pin");
    if (pinButton) {
      pinButton.textContent = topic.pinned ? "Unpin" : "Pin";
    }
    const watchButton = el("community-topic-watch");
    if (watchButton) {
      watchButton.textContent = topic.watching ? "Unwatch" : "Watch";
    }

    const title = el("community-topic-title");
    if (title) title.textContent = topic.title || "(untitled)";
    const meta = el("community-topic-meta");
    if (meta) meta.textContent = `${topic.authorName || "Someone"} · ${formatDate(topic.createdAt)}`;
    const body = el("community-topic-body");
    if (body) setFormatted(body, topic.body || "");

    const replies = el("community-replies");
    if (replies) {
      replies.textContent = "";
      const list = Array.isArray(topic.replies) ? topic.replies : [];
      if (!list.length) {
        const empty = document.createElement("p");
        empty.className = "body-text";
        empty.textContent = "No replies yet.";
        replies.appendChild(empty);
      }
      list.forEach((reply) => {
        const row = document.createElement("div");
        row.className = "community-reply";
        const head = document.createElement("div");
        head.className = "community-reply-head";
        const name = document.createElement("strong");
        name.textContent = reply.authorName || "Someone";
        const when = document.createElement("span");
        when.className = "community-reply-time";
        when.textContent = formatDate(reply.createdAt);
        head.append(name, when);
        const text = document.createElement("div");
        text.className = "community-reply-body";
        setFormatted(text, reply.body || "");
        const quote = document.createElement("button");
        quote.type = "button";
        quote.className = "settings-trigger community-reply-quote";
        quote.textContent = "Quote";
        quote.addEventListener("click", () => {
          startQuote(reply);
        });
        const report = document.createElement("button");
        report.type = "button";
        report.className = "settings-trigger community-reply-report";
        report.textContent = "Report";
        report.addEventListener("click", () => {
          openReport(reply);
        });
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "settings-trigger community-reply-edit";
        edit.textContent = "Edit";
        edit.addEventListener("click", () => {
          startEditReply(reply, text);
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "settings-trigger community-reply-delete";
        remove.textContent = "Delete";
        remove.addEventListener("click", () => {
          void deleteReply(reply.id);
        });
        head.append(quote, report, edit, remove);
        if (reply.quote) {
          const quoted = document.createElement("blockquote");
          quoted.className = "community-quote";
          quoted.textContent = `${reply.quote.authorName || "Someone"}: ${reply.quote.excerpt}`;
          row.append(head, quoted, text);
        } else {
          row.append(head, text);
        }
        replies.appendChild(row);
      });
    }

    const replyBody = el("community-reply-body");
    if (replyBody) replyBody.value = "";
    setStatus("community-reply-status", "");
  }

  async function openTopic(topicId) {
    currentTopicId = String(topicId || "");
    try {
      const topic = await service().fetchBoardTopic(currentTopicId);
      renderTopic(topic);
      renderTopicList();
    } catch (error) {
      setStatus("community-status", error?.message || "Could not open that topic.", true);
    }
  }

  function openCompose() {
    currentTopicId = "";
    show(el("community-topic-view"), false);
    show(el("community-empty"), false);
    show(el("community-compose"), true);
    const title = el("community-title");
    const body = el("community-body");
    if (title) title.value = "";
    if (body) body.value = "";
    setStatus("community-status", "");
    title?.focus?.();
    renderTopicList();
  }

  async function postTopic() {
    const title = String(el("community-title")?.value || "").trim();
    const body = String(el("community-body")?.value || "").trim();
    if (!title || !body) {
      setStatus("community-status", "A title and body are required.", true);
      return;
    }
    setStatus("community-status", "Posting…");
    try {
      const topic = await service().createBoardTopic({ title, body });
      await loadTopics();
      await openTopic(topic.id);
    } catch (error) {
      setStatus("community-status", error?.message || "Could not post the topic.", true);
    }
  }

  async function postReply() {
    if (!currentTopicId) return;
    const body = String(el("community-reply-body")?.value || "").trim();
    if (!body) {
      setStatus("community-reply-status", "Write a reply first.", true);
      return;
    }
    setStatus("community-reply-status", "Posting…");
    try {
      const topic = await service().createBoardReply(currentTopicId, body);
      renderTopic(topic);
      await loadTopics();
    } catch (error) {
      setStatus("community-reply-status", error?.message || "Could not post the reply.", true);
    }
  }

  async function deleteTopic() {
    if (!currentTopicId) return;
    if (!window.confirm("Delete this topic and its replies?")) return;
    try {
      await service().deleteBoardTopic(currentTopicId);
      currentTopicId = "";
      show(el("community-topic-view"), false);
      show(el("community-empty"), true);
      await loadTopics();
    } catch (error) {
      setStatus("community-reply-status", error?.message || "Could not delete the topic.", true);
    }
  }

  async function deleteReply(replyId) {
    if (!currentTopicId) return;
    try {
      await service().deleteBoardReply(currentTopicId, replyId);
      await openTopic(currentTopicId);
      await loadTopics();
    } catch (error) {
      setStatus("community-reply-status", error?.message || "Could not delete the reply.", true);
    }
  }

  let reportTarget = null;

  function startQuote(reply) {
    const area = el("community-reply-body");
    if (!area) return;
    const excerpt = String(reply.body || "").split("\n")[0].slice(0, 200);
    area.value = `> ${reply.authorName || "Someone"}: ${excerpt}\n\n`;
    area.focus();
  }

  function openReport(reply) {
    reportTarget = reply ? { replyId: reply.id } : null;
    const box = el("community-report-box");
    const reason = el("community-report-reason");
    if (reason) reason.value = "";
    show(box, true);
    reason?.focus?.();
  }

  function closeReport() {
    reportTarget = null;
    show(el("community-report-box"), false);
  }

  async function sendReport() {
    if (!currentTopic) return;
    const reason = String(el("community-report-reason")?.value || "").trim();
    if (!reason) {
      setStatus("community-reply-status", "Add a short reason.", true);
      return;
    }
    try {
      await service().reportBoardPost({
        topicId: currentTopic.id,
        replyId: reportTarget?.replyId || "",
        reason
      });
      closeReport();
      setStatus("community-reply-status", "Report sent to the admins.");
    } catch (error) {
      setStatus("community-reply-status", error?.message || "Could not send the report.", true);
    }
  }

  async function loadContributors() {
    const list = el("community-posters");
    if (!list || typeof service()?.fetchBoardContributors !== "function") return;
    try {
      const result = await service().fetchBoardContributors(10);
      const contributors = Array.isArray(result?.contributors) ? result.contributors : [];
      list.textContent = "";
      if (!contributors.length) {
        const empty = document.createElement("span");
        empty.className = "community-topic-item-meta";
        empty.textContent = "No posts yet.";
        list.appendChild(empty);
        return;
      }
      contributors.forEach((entry, index) => {
        const row = document.createElement("div");
        row.className = "community-poster-row";
        const name = document.createElement("span");
        name.textContent = `${index + 1}. ${entry.name || entry.clientId || "Anonymous"}`;
        const count = document.createElement("span");
        count.className = "community-topic-item-meta";
        count.textContent = `${entry.posts} post${entry.posts === 1 ? "" : "s"}`;
        row.append(name, count);
        list.appendChild(row);
      });
    } catch (_error) {
      list.textContent = "";
    }
  }

  function startEditTopic() {
    if (!currentTopic) return;
    const title = el("community-edit-title");
    const body = el("community-edit-body");
    if (title) title.value = currentTopic.title || "";
    if (body) body.value = currentTopic.body || "";
    show(el("community-topic-editor"), true);
    show(el("community-topic-body"), false);
    title?.focus?.();
  }

  function cancelEditTopic() {
    show(el("community-topic-editor"), false);
    show(el("community-topic-body"), true);
  }

  async function saveEditTopic() {
    if (!currentTopic) return;
    const title = String(el("community-edit-title")?.value || "").trim();
    const body = String(el("community-edit-body")?.value || "").trim();
    if (!title || !body) {
      setStatus("community-reply-status", "A title and body are required.", true);
      return;
    }
    try {
      await service().updateBoardTopic(currentTopic.id, { title, body });
      cancelEditTopic();
      await openTopic(currentTopic.id);
      await loadTopics();
    } catch (error) {
      setStatus("community-reply-status", error?.message || "Could not save the topic.", true);
    }
  }

  async function toggleWatch() {
    if (!currentTopic) return;
    try {
      await service().watchBoardTopic(currentTopic.id, !currentTopic.watching);
      await openTopic(currentTopic.id);
    } catch (error) {
      setStatus("community-reply-status", error?.message || "Could not update watching.", true);
    }
  }

  async function togglePin() {
    if (!currentTopic) return;
    try {
      await service().pinBoardTopic(currentTopic.id, !currentTopic.pinned);
      await openTopic(currentTopic.id);
      await loadTopics();
    } catch (error) {
      setStatus("community-reply-status", error?.message || "Could not pin the topic.", true);
    }
  }

  function startEditReply(reply, bodyNode) {
    if (!currentTopic || !bodyNode) return;
    const wrap = document.createElement("div");
    wrap.className = "community-reply-editor";
    const area = document.createElement("textarea");
    area.rows = 3;
    area.maxLength = 5000;
    area.className = "community-edit-textarea";
    area.value = reply.body || "";
    const actions = document.createElement("div");
    actions.className = "community-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "settings-button-primary";
    save.textContent = "Save";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "settings-trigger";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => {
      wrap.replaceWith(bodyNode);
    });
    save.addEventListener("click", async () => {
      const text = String(area.value || "").trim();
      if (!text) {
        setStatus("community-reply-status", "Write a reply first.", true);
        return;
      }
      try {
        await service().updateBoardReply(currentTopic.id, reply.id, text);
        await openTopic(currentTopic.id);
        await loadTopics();
      } catch (error) {
        setStatus("community-reply-status", error?.message || "Could not save the reply.", true);
      }
    });
    actions.append(save, cancel);
    wrap.append(makeFormatBar(area), area, actions);
    bodyNode.replaceWith(wrap);
  }

  function bind() {
    if (bound) return;
    bound = true;
    el("community-new")?.addEventListener("click", openCompose);
    el("community-cancel")?.addEventListener("click", () => {
      show(el("community-compose"), false);
      show(el("community-empty"), true);
    });
    el("community-post")?.addEventListener("click", () => {
      void postTopic();
    });
    el("community-reply-post")?.addEventListener("click", () => {
      void postReply();
    });
    el("community-topic-delete")?.addEventListener("click", () => {
      void deleteTopic();
    });
    el("community-topic-watch")?.addEventListener("click", () => {
      void toggleWatch();
    });
    el("community-topic-edit")?.addEventListener("click", startEditTopic);
    el("community-topic-pin")?.addEventListener("click", () => {
      void togglePin();
    });
    el("community-edit-save")?.addEventListener("click", () => {
      void saveEditTopic();
    });
    el("community-edit-cancel")?.addEventListener("click", cancelEditTopic);
    el("community-topic-report")?.addEventListener("click", () => openReport(null));

    // One "Actions" button keeps the topic header compact on phones.
    const actionsToggle = el("community-topic-actions-toggle");
    const actionsMenu = el("community-topic-actions-menu");
    const setActionsOpen = (open) => {
      if (!actionsMenu || !actionsToggle) return;
      actionsMenu.hidden = !open;
      actionsToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };
    actionsToggle?.addEventListener("click", (event) => {
      event.stopPropagation();
      setActionsOpen(actionsMenu?.hidden === true);
    });
    actionsMenu?.querySelectorAll(".community-actions-item").forEach((item) => {
      item.addEventListener("click", () => setActionsOpen(false));
    });
    document.addEventListener("click", (event) => {
      if (!actionsMenu || actionsMenu.hidden) return;
      const target = event.target;
      if (target instanceof Node && !actionsMenu.contains(target) && target !== actionsToggle) {
        setActionsOpen(false);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && actionsMenu && !actionsMenu.hidden) {
        setActionsOpen(false);
      }
    });
    el("community-report-send")?.addEventListener("click", () => {
      void sendReport();
    });
    el("community-report-cancel")?.addEventListener("click", closeReport);
    attachFormatBar(el("community-body"));
    attachFormatBar(el("community-edit-body"));
    attachFormatBar(el("community-reply-body"));
  }

  async function ensureCommunitySection() {
    if (!bound) {
      bind();
    }
    // Badges compare against the previous visit, then mark this visit as seen.
    lastSeenAt = Number(window.localStorage.getItem(SEEN_KEY) || 0);
    await loadTopics();
    void loadContributors();
    try {
      window.localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch (_error) {
      // localStorage is best-effort
    }
  }

  window.CommunitySectionUi = { ensureCommunitySection };
})();
