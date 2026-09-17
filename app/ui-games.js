(function () {
  "use strict";

  let bound = false;
  let games = [];
  let sessions = [];
  let currentId = "";
  let current = null;
  let opponents = [];
  let myId = "";
  const renderers = new Map();

  function el(id) {
    const node = document.getElementById(id);
    return node instanceof HTMLElement ? node : null;
  }

  function service() {
    return window.TarotDataService;
  }

  function show(node, visible) {
    if (node) node.hidden = !visible;
  }

  function setStatus(id, text, isError) {
    const node = el(id);
    if (!node) return;
    node.textContent = text || "";
    node.dataset.tone = isError ? "error" : "neutral";
  }

  function formatWhen(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function gallows(misses) {
    const count = Math.max(0, Math.min(6, Number(misses) || 0));
    return [
      "  +---+",
      `  |   ${count > 0 ? "O" : " "}`,
      `  |  ${count > 2 ? "/" : " "}${count > 1 ? "|" : " "}${count > 3 ? "\\" : " "}`,
      `  |  ${count > 4 ? "/" : " "} ${count > 5 ? "\\" : " "}`,
      "  |",
      " ====="
    ].join("\n");
  }

  function renderSessionList() {
    const list = el("games-session-list");
    if (!list) return;
    list.textContent = "";
    if (!sessions.length) {
      const empty = document.createElement("p");
      empty.className = "body-text";
      empty.textContent = "No games yet. Challenge someone.";
      list.appendChild(empty);
      return;
    }
    sessions.forEach((session) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `games-session-item${session.id === currentId ? " is-active" : ""}`;
      item.addEventListener("click", () => {
        void openSession(session.id);
      });
      const title = document.createElement("span");
      title.className = "games-session-item-title";
      title.textContent = session.title || session.gameId;
      const meta = document.createElement("span");
      meta.className = "games-session-item-meta";
      const vs = session.hostName && session.guestName
        ? `${session.hostName} vs ${session.guestName}`
        : session.guestName || session.hostName || "";
      const turn = session.status === "pending"
        ? "Challenge"
        : session.status === "finished"
          ? "Finished"
          : session.yourTurn
            ? "Your turn"
            : "Waiting";
      meta.textContent = `${vs} · ${turn}`;
      item.append(title, meta);
      list.appendChild(item);
    });
  }

  function renderAlphabet(session) {
    const wrap = el("games-hangman-letters");
    if (!wrap) return;
    wrap.textContent = "";
    const guessed = new Set((session.view?.guessed || []).map((letter) => String(letter).toLowerCase()));
    const canPlay = session.status === "active" && session.yourTurn;
    "abcdefghijklmnopqrstuvwxyz".split("").forEach((letter) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "games-letter";
      button.textContent = letter.toUpperCase();
      button.disabled = !canPlay || guessed.has(letter);
      if (guessed.has(letter)) {
        button.classList.add(session.view?.pattern?.includes(letter) ? "is-hit" : "is-miss");
      }
      button.addEventListener("click", () => {
        void playLetter(letter);
      });
      wrap.appendChild(button);
    });
  }

  function renderHangman(session) {
    const board = el("games-hangman");
    show(board, true);
    const gallowsEl = el("games-hangman-gallows");
    if (gallowsEl) gallowsEl.textContent = gallows(session.view?.misses);
    const patternEl = el("games-hangman-pattern");
    if (patternEl) {
      const pattern = Array.isArray(session.view?.pattern) ? session.view.pattern : [];
      patternEl.textContent = pattern.map((letter) => (letter ? letter.toUpperCase() : "_")).join(" ");
    }
    const meta = el("games-hangman-meta");
    if (meta) {
      const misses = `${session.view?.misses || 0}/${session.view?.maxMisses || 6} misses`;
      const word = session.view?.word ? ` Word: ${session.view.word}` : "";
      meta.textContent = misses + word;
    }
    renderAlphabet(session);
  }

  function renderSession(session) {
    current = session;
    currentId = session.id;
    show(el("games-compose"), false);
    show(el("games-empty"), false);
    show(el("games-detail"), true);
    setStatus("games-detail-status", "");

    const title = el("games-detail-title");
    if (title) title.textContent = session.title || session.gameId;
    const meta = el("games-detail-meta");
    if (meta) {
      meta.textContent = `${session.hostName || "Host"} vs ${session.guestName || "Guest"} · ${session.status} · ${formatWhen(session.updatedAt)}`;
    }

    const pendingGuest = session.status === "pending" && session.guestClientId === myId;
    show(el("games-accept"), pendingGuest);
    show(el("games-decline"), pendingGuest);

    show(el("games-hangman"), false);
    show(el("games-custom"), false);
    const renderer = renderers.get(session.gameId);
    if (session.status !== "pending") {
      if (renderer) {
        renderCustom(session, renderer);
      } else {
        renderFallback(session);
      }
    }

    const turn = el("games-turn");
    if (turn) {
      if (session.status === "pending") {
        turn.textContent = "Waiting for the challenge to be accepted.";
      } else if (session.status === "finished") {
        const winner = session.winnerClientId === session.hostClientId ? session.hostName : session.guestName;
        turn.textContent = session.winnerClientId ? `${winner} wins.` : "Game over.";
      } else if (session.yourTurn) {
        turn.textContent = "Your turn — no clock. Play whenever you like.";
      } else {
        turn.textContent = "Waiting on the other player. There is no time limit.";
      }
    }
    renderSessionList();
  }

  function renderCustom(session, renderer) {
    const container = el("games-custom");
    if (!container) return;
    container.textContent = "";
    show(container, true);
    try {
      renderer.render(session, container, gameActions());
    } catch (error) {
      const note = document.createElement("p");
      note.className = "body-text";
      note.textContent = error?.message || "This game's board could not be rendered.";
      container.appendChild(note);
    }
  }

  function renderFallback(session) {
    const container = el("games-custom");
    if (!container) return;
    container.textContent = "";
    show(container, true);
    const note = document.createElement("p");
    note.className = "body-text";
    note.textContent = "This game has no board renderer installed. Ask the operator to update its plugin.";
    container.appendChild(note);
    const state = document.createElement("pre");
    state.className = "games-state-dump";
    state.textContent = JSON.stringify(session.view || {}, null, 2);
    container.appendChild(state);
  }

  function gameActions() {
    return {
      move(move) {
        return submitMove(move);
      },
      accept,
      decline,
      refresh() {
        return currentId ? openSession(currentId) : Promise.resolve();
      },
      yourTurn() {
        return Boolean(current?.yourTurn);
      }
    };
  }

  async function submitMove(move) {
    if (!currentId) return null;
    try {
      const session = await service().playGameMove(currentId, move);
      await loadSessions();
      renderSession(session);
      return session;
    } catch (error) {
      setStatus("games-detail-status", error?.message || "That move was not allowed.", true);
      return null;
    }
  }

  function registerRenderer(gameId, definition) {
    const id = String(gameId || "").trim();
    if (!id || !definition || typeof definition.render !== "function") return;
    renderers.set(id, definition);
    // A board can arrive before its renderer; redraw if it is on screen.
    if (current && current.id === currentId && current.gameId === id && current.status !== "pending") {
      renderCustom(current, definition);
    }
  }

  async function loadTypes() {
    try {
      const result = await service().fetchGames();
      games = Array.isArray(result?.games) ? result.games : [];
    } catch (_error) {
      games = [{ id: "hangman", title: "Hangman" }];
    }
    const select = el("games-type");
    if (!select) return;
    const currentValue = select.value;
    select.textContent = "";
    games.forEach((game) => {
      const option = document.createElement("option");
      option.value = game.id;
      option.textContent = game.title || game.id;
      select.appendChild(option);
    });
    if (currentValue && [...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }
  }

  async function loadOpponents() {
    opponents = [];
    try {
      const directory = await service().fetchDirectory();
      (Array.isArray(directory?.users) ? directory.users : []).forEach((user) => {
        opponents.push({
          clientId: user.clientId,
          name: user.displayName || user.clientId
        });
      });
    } catch (_error) {}
    try {
      const friends = await service().requestJson("GET", service().buildApiUrl("/api/v1/profile/friends"));
      (Array.isArray(friends?.friends) ? friends.friends : []).forEach((entry) => {
        if (!opponents.some((item) => item.clientId === entry.clientId)) {
          opponents.push({ clientId: entry.clientId, name: entry.name || entry.clientId });
        }
      });
    } catch (_error) {}
    const select = el("games-opponent");
    if (!select) return;
    select.textContent = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Choose an opponent…";
    select.appendChild(blank);
    opponents.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.clientId;
      option.textContent = entry.name;
      select.appendChild(option);
    });
  }

  async function loadSessions() {
    try {
      const result = await service().fetchGameSessions();
      sessions = Array.isArray(result?.sessions) ? result.sessions : [];
    } catch (error) {
      sessions = [];
      setStatus("games-status", error?.message || "Could not load games.", true);
    }
    renderSessionList();
  }

  async function openSession(sessionId) {
    currentId = String(sessionId || "");
    try {
      const session = await service().fetchGameSession(currentId);
      renderSession(session);
    } catch (error) {
      setStatus("games-status", error?.message || "Could not open that game.", true);
    }
  }

  function openCompose() {
    currentId = "";
    current = null;
    show(el("games-detail"), false);
    show(el("games-empty"), false);
    show(el("games-compose"), true);
    setStatus("games-status", "");
    renderSessionList();
    void loadTypes();
    void loadOpponents();
  }

  async function createChallenge() {
    const gameId = String(el("games-type")?.value || "hangman").trim();
    const opponentClientId = String(el("games-opponent")?.value || "").trim();
    if (!opponentClientId) {
      setStatus("games-status", "Choose an opponent.", true);
      return;
    }
    setStatus("games-status", "Sending challenge…");
    try {
      const session = await service().createGameSession({ gameId, opponentClientId });
      await loadSessions();
      await openSession(session.id);
    } catch (error) {
      setStatus("games-status", error?.message || "Could not start the game.", true);
    }
  }

  async function accept() {
    if (!currentId) return;
    try {
      const session = await service().acceptGameSession(currentId);
      await loadSessions();
      renderSession(session);
    } catch (error) {
      setStatus("games-detail-status", error?.message || "Could not accept.", true);
    }
  }

  async function decline() {
    if (!currentId) return;
    try {
      await service().declineGameSession(currentId);
      currentId = "";
      current = null;
      show(el("games-detail"), false);
      show(el("games-empty"), true);
      await loadSessions();
    } catch (error) {
      setStatus("games-detail-status", error?.message || "Could not decline.", true);
    }
  }

  // Built-in Hangman funnels through the shared submitter so both the builtin
  // and plugin renderers share one move path.
  async function playLetter(letter) {
    await submitMove({ letter });
  }

  function bind() {
    if (bound) return;
    bound = true;
    el("games-new")?.addEventListener("click", openCompose);
    el("games-cancel")?.addEventListener("click", () => {
      show(el("games-compose"), false);
      show(el("games-empty"), true);
    });
    el("games-challenge")?.addEventListener("click", () => {
      void createChallenge();
    });
    el("games-accept")?.addEventListener("click", () => {
      void accept();
    });
    el("games-decline")?.addEventListener("click", () => {
      void decline();
    });
  }

  function drainPendingRenderers() {
    const pending = window.__kabbakGameRenderers;
    if (!pending || typeof pending !== "object") return;
    Object.keys(pending).forEach((gameId) => {
      const definition = pending[gameId];
      if (definition && typeof definition.render === "function" && !renderers.has(gameId)) {
        renderers.set(gameId, definition);
      }
    });
  }

  async function ensureGamesSection() {
    if (!bound) bind();
    drainPendingRenderers();
    try {
      const summary = await service().requestJson("GET", service().buildApiUrl("/api/v1/profile"));
      myId = String(summary?.clientId || "").trim();
    } catch (_error) {
      myId = "";
    }
    await loadTypes();
    await loadOpponents();
    await loadSessions();
    if (currentId) {
      await openSession(currentId);
    }
  }

  registerRenderer("hangman", {
    render(session, container) {
      show(el("games-hangman"), true);
      renderHangman(session);
      if (container) container.hidden = true;
    }
  });

  window.GamesSectionUi = {
    ensureGamesSection,
    openSession,
    registerRenderer,
    challenge(clientId, gameId) {
      return service().createGameSession({
        gameId: gameId || "hangman",
        opponentClientId: clientId
      }).then(async (session) => {
        const button = document.getElementById("open-games");
        if (button) button.click();
        else window.TarotSectionStateUi?.setActiveSection?.("games");
        await loadSessions();
        await openSession(session.id);
        return session;
      });
    }
  };
})();
