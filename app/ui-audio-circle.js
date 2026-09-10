(() => {
  "use strict";

  const { html } = window.HtmlSafe;

  const CIRCLE_ENTRIES = [
    { id: "c", major: "C", relativeMinor: "Am", pitchClass: 0, frequencyLabel: "C4" },
    { id: "g", major: "G", relativeMinor: "Em", pitchClass: 7, frequencyLabel: "G4" },
    { id: "d", major: "D", relativeMinor: "Bm", pitchClass: 2, frequencyLabel: "D4" },
    { id: "a", major: "A", relativeMinor: "F#m", pitchClass: 9, frequencyLabel: "A4" },
    { id: "e", major: "E", relativeMinor: "C#m", pitchClass: 4, frequencyLabel: "E4" },
    { id: "b", major: "B", relativeMinor: "G#m", pitchClass: 11, frequencyLabel: "B4" },
    { id: "f-sharp-g-flat", major: "F#/Gb", relativeMinor: "D#m/Ebm", pitchClass: 6, frequencyLabel: "F#/Gb4" },
    { id: "d-flat", major: "Db", relativeMinor: "Bbm", pitchClass: 1, frequencyLabel: "Db4" },
    { id: "a-flat", major: "Ab", relativeMinor: "Fm", pitchClass: 8, frequencyLabel: "Ab4" },
    { id: "e-flat", major: "Eb", relativeMinor: "Cm", pitchClass: 3, frequencyLabel: "Eb4" },
    { id: "b-flat", major: "Bb", relativeMinor: "Gm", pitchClass: 10, frequencyLabel: "Bb4" },
    { id: "f", major: "F", relativeMinor: "Dm", pitchClass: 5, frequencyLabel: "F4" }
  ];

  const state = {
    initialized: false,
    selectedId: "c",
    audioContext: null,
    oscillatorNode: null,
    gainNode: null,
    stopTimerId: 0,
    activePlaybackKey: ""
  };

  function getElements() {
    return {
      stageEl: document.getElementById("audio-circle-stage"),
      detailNameEl: document.getElementById("audio-circle-detail-name"),
      detailSubEl: document.getElementById("audio-circle-detail-sub"),
      detailSummaryEl: document.getElementById("audio-circle-detail-summary"),
      detailBodyEl: document.getElementById("audio-circle-detail-body")
    };
  }

  function getMidiNumber(pitchClass, octave) {
    return ((octave + 1) * 12) + pitchClass;
  }

  function getFrequencyHz(pitchClass, octave) {
    const midiNumber = getMidiNumber(pitchClass, octave);
    return 440 * Math.pow(2, (midiNumber - 69) / 12);
  }

  function formatFrequencyHz(value) {
    return `${value.toFixed(2)} Hz`;
  }

  function findEntryById(id) {
    return CIRCLE_ENTRIES.find((entry) => entry.id === id) || null;
  }

  function getSelectedEntry() {
    return findEntryById(state.selectedId) || CIRCLE_ENTRIES[0];
  }

  function getAudioContext() {
    if (state.audioContext) {
      return state.audioContext;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (typeof AudioContextCtor !== "function") {
      return null;
    }

    state.audioContext = new AudioContextCtor();
    return state.audioContext;
  }

  function clearStopTimer() {
    if (state.stopTimerId) {
      window.clearTimeout(state.stopTimerId);
      state.stopTimerId = 0;
    }
  }

  function clearActivePlayback(shouldRender = true) {
    state.oscillatorNode = null;
    state.gainNode = null;
    state.activePlaybackKey = "";
    clearStopTimer();
    if (shouldRender) {
      render();
    }
  }

  function stopPlayback(shouldRender = true) {
    clearStopTimer();

    const oscillatorNode = state.oscillatorNode;
    const gainNode = state.gainNode;
    const audioContext = state.audioContext;

    state.oscillatorNode = null;
    state.gainNode = null;
    state.activePlaybackKey = "";

    if (oscillatorNode && gainNode && audioContext) {
      const now = audioContext.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      try {
        oscillatorNode.stop(now + 0.07);
      } catch (_error) {
      }
    }

    if (shouldRender) {
      render();
    }
  }

  async function playFrequency(frequencyHz, playbackKey) {
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }

    if (state.activePlaybackKey === playbackKey) {
      stopPlayback(true);
      return;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    stopPlayback(false);

    const oscillatorNode = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillatorNode.type = "sine";
    oscillatorNode.frequency.setValueAtTime(frequencyHz, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    oscillatorNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    state.oscillatorNode = oscillatorNode;
    state.gainNode = gainNode;
    state.activePlaybackKey = playbackKey;

    oscillatorNode.onended = () => {
      if (state.oscillatorNode === oscillatorNode || state.activePlaybackKey === playbackKey) {
        clearActivePlayback(true);
      }
    };

    oscillatorNode.start(now);
    oscillatorNode.stop(now + 1.12);
    state.stopTimerId = window.setTimeout(() => {
      clearActivePlayback(true);
    }, 1250);

    render();
  }

  function createMetaCard(title) {
    const card = document.createElement("div");
    card.className = "meta-card";
    const heading = document.createElement("strong");
    heading.textContent = title;
    card.appendChild(heading);
    return card;
  }

  function renderCircleStage(elements) {
    if (!elements.stageEl) {
      return;
    }

    const shell = document.createElement("div");
    shell.className = "audio-circle-shell";

    const center = document.createElement("div");
    center.className = "audio-circle-center";
    const selectedEntry = getSelectedEntry();
    center.innerHTML = html`
      <div>
        <div class="audio-circle-center-label">${selectedEntry.major}</div>
        <div class="audio-circle-center-sub">Relative minor ${selectedEntry.relativeMinor}<br>Circle of Fifths</div>
      </div>
    `;
    shell.appendChild(center);

    const radius = 41;
    CIRCLE_ENTRIES.forEach((entry, index) => {
      const angleDegrees = -90 + (index * 30);
      const angleRadians = (angleDegrees * Math.PI) / 180;
      const x = 50 + (Math.cos(angleRadians) * radius);
      const y = 50 + (Math.sin(angleRadians) * radius);
      const playbackKey = `circle:${entry.id}`;
      const isSelected = entry.id === state.selectedId;
      const isPlaying = state.activePlaybackKey === playbackKey;

      const button = document.createElement("button");
      button.type = "button";
      button.className = `audio-circle-key${isSelected || isPlaying ? " is-selected" : ""}`;
      button.dataset.entryId = entry.id;
      button.dataset.action = "play-entry";
      button.dataset.playbackKey = playbackKey;
      button.dataset.frequencyHz = String(getFrequencyHz(entry.pitchClass, 4));
      button.style.left = `${x}%`;
      button.style.top = `${y}%`;
      button.style.transform = "translate(-50%, -50%)";
      button.setAttribute("aria-pressed", isPlaying ? "true" : "false");
      button.setAttribute("aria-label", `${isPlaying ? "Stop" : "Play"} ${entry.major}`);

      const major = document.createElement("div");
      major.className = "audio-circle-key-major";
      major.textContent = entry.major;

      const minor = document.createElement("div");
      minor.className = "audio-circle-key-minor";
      minor.textContent = entry.relativeMinor;

      const meta = document.createElement("div");
      meta.className = "audio-circle-key-meta";
      meta.textContent = isPlaying ? "Playing" : "Tap";

      button.append(major, minor, meta);
      shell.appendChild(button);
    });

    elements.stageEl.replaceChildren(shell);
  }

  function renderDetail(elements) {
    const entry = getSelectedEntry();
    if (!elements.detailNameEl || !elements.detailSubEl || !elements.detailSummaryEl || !elements.detailBodyEl) {
      return;
    }

    const entryIndex = CIRCLE_ENTRIES.findIndex((item) => item.id === entry.id);
    const clockwiseEntry = CIRCLE_ENTRIES[(entryIndex + 1) % CIRCLE_ENTRIES.length];
    const counterClockwiseEntry = CIRCLE_ENTRIES[(entryIndex - 1 + CIRCLE_ENTRIES.length) % CIRCLE_ENTRIES.length];
    const frequencyHz = getFrequencyHz(entry.pitchClass, 4);

    elements.detailNameEl.textContent = `${entry.major} Major`;
    elements.detailSubEl.textContent = `${entry.relativeMinor} relative minor · tonic ${entry.frequencyLabel}`;
    elements.detailSummaryEl.textContent = `${entry.major} sits between ${counterClockwiseEntry.major} and ${clockwiseEntry.major} on the Circle of Fifths.`;

    const grid = document.createElement("div");
    grid.className = "meta-grid";

    const overviewCard = createMetaCard("Key Overview");
    overviewCard.innerHTML += html`
      <dl class="alpha-dl">
        <dt>Major key</dt><dd>${entry.major}</dd>
        <dt>Relative minor</dt><dd>${entry.relativeMinor}</dd>
        <dt>Tonic pitch</dt><dd>${entry.frequencyLabel}</dd>
        <dt>Tonic frequency</dt><dd>${formatFrequencyHz(frequencyHz)}</dd>
        <dt>Clockwise neighbor</dt><dd>${clockwiseEntry.major}</dd>
        <dt>Counter-clockwise neighbor</dt><dd>${counterClockwiseEntry.major}</dd>
      </dl>
    `;

    const chipRow = document.createElement("div");
    chipRow.className = "audio-circle-chip-row";
    [entry.major, entry.relativeMinor, clockwiseEntry.major, counterClockwiseEntry.major].forEach((label, index) => {
      const chip = document.createElement("span");
      chip.className = `audio-circle-chip${index === 0 ? " audio-circle-chip--active" : ""}`;
      chip.textContent = label;
      chipRow.appendChild(chip);
    });
    overviewCard.appendChild(chipRow);

    const explanationCard = createMetaCard("How To Read The Circle");
    const explanation = document.createElement("div");
    explanation.className = "audio-circle-copy";
    explanation.textContent = "Moving clockwise adds one sharp and raises the tonic by a perfect fifth. Moving counter-clockwise adds one flat and returns by a perfect fourth. The inner minor labels show the relative minor that shares the same key signature.";
    explanationCard.appendChild(explanation);

    const playbackCard = createMetaCard("Tone Preview");
    const playbackCopy = document.createElement("div");
    playbackCopy.className = "audio-circle-copy";
    playbackCopy.textContent = `Tap any key on the circle to hear its tonic. ${entry.major} is currently centered at ${formatFrequencyHz(frequencyHz)}.`;
    const playbackActions = document.createElement("div");
    playbackActions.className = "audio-note-playback-actions";

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.className = "alpha-nav-btn audio-note-playback-btn";
    playButton.dataset.action = "play-entry";
    playButton.dataset.entryId = entry.id;
    playButton.dataset.playbackKey = `circle:${entry.id}`;
    playButton.dataset.frequencyHz = String(frequencyHz);
    playButton.textContent = `Play ${entry.major}`;

    const stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.className = "alpha-nav-btn alpha-nav-btn--ghost audio-note-playback-btn";
    stopButton.dataset.action = "stop-playback";
    stopButton.textContent = "Stop";

    playbackActions.append(playButton, stopButton);
    playbackCard.append(playbackCopy, playbackActions);

    const navCard = createMetaCard("Neighbors");
    const navGrid = document.createElement("div");
    navGrid.className = "audio-circle-nav-grid";
    [
      { label: "Counter-clockwise", entry: counterClockwiseEntry },
      { label: "Clockwise", entry: clockwiseEntry }
    ].forEach(({ label, entry: neighbor }) => {
      const card = document.createElement("div");
      card.className = "audio-circle-nav-card";
      card.innerHTML = html`
        <div class="audio-circle-nav-label">${label}</div>
        <div class="audio-circle-nav-value">${neighbor.major}</div>
        <div class="audio-circle-nav-sub">Relative minor ${neighbor.relativeMinor}</div>
      `;
      navGrid.appendChild(card);
    });
    navCard.appendChild(navGrid);

    grid.append(overviewCard, explanationCard, playbackCard, navCard);
    elements.detailBodyEl.replaceChildren(grid);
  }

  function render() {
    const elements = getElements();
    renderCircleStage(elements);
    renderDetail(elements);
  }

  function selectEntry(id, shouldRender = true) {
    if (!findEntryById(id)) {
      return;
    }

    state.selectedId = id;
    if (shouldRender) {
      render();
    }
  }

  function bindEvents() {
    const elements = getElements();
    if (!elements.stageEl || !elements.detailBodyEl) {
      return;
    }

    const clickHandler = (event) => {
      const button = event.target instanceof Element ? event.target.closest("button[data-action]") : null;
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const action = button.dataset.action || "";
      if (action === "stop-playback") {
        stopPlayback(true);
        return;
      }

      if (action === "play-entry") {
        const entryId = String(button.dataset.entryId || "").trim();
        const playbackKey = String(button.dataset.playbackKey || "").trim();
        const frequencyHz = Number(button.dataset.frequencyHz);
        if (!entryId || !playbackKey || !Number.isFinite(frequencyHz)) {
          return;
        }

        selectEntry(entryId, false);
        void playFrequency(frequencyHz, playbackKey);
      }
    };

    elements.stageEl.addEventListener("click", clickHandler);
    elements.detailBodyEl.addEventListener("click", clickHandler);

    window.addEventListener("beforeunload", () => {
      stopPlayback(false);
    });
  }

  function init() {
    if (state.initialized) {
      render();
      return;
    }

    bindEvents();
    render();
    state.initialized = true;
  }

  function ensureAudioCircleSection() {
    init();
  }

  window.AudioCircleUi = {
    ...(window.AudioCircleUi || {}),
    init,
    ensureAudioCircleSection,
    selectEntry
  };
})();