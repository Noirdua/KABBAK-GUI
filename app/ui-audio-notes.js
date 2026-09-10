(() => {
  "use strict";

  const { html } = window.HtmlSafe;

  const OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const SPEED_OF_SOUND_METERS_PER_SECOND = 343;
  const INTERVALS_FROM_C = [
    "Unison",
    "Minor second",
    "Major second",
    "Minor third",
    "Major third",
    "Perfect fourth",
    "Tritone",
    "Perfect fifth",
    "Minor sixth",
    "Major sixth",
    "Minor seventh",
    "Major seventh"
  ];

  const NOTE_DEFINITIONS = [
    {
      id: "c",
      label: "C",
      pitchClass: 0,
      family: "Natural",
      keyColor: "White key",
      aliases: ["Do"],
      description: "C is the anchor note for scientific pitch notation, and middle C is the common visual landmark many players use to orient the keyboard.",
      usage: "In basic theory it often feels like a starting point because C major uses only natural notes."
    },
    {
      id: "c-sharp-d-flat",
      label: "C#/Db",
      pitchClass: 1,
      family: "Accidental",
      keyColor: "Black key",
      aliases: ["C sharp", "D flat"],
      description: "C sharp and D flat are the same sounding pitch in equal temperament, sitting one semitone above C and one semitone below D.",
      usage: "It is a common chromatic color tone that adds immediate tension or forward motion."
    },
    {
      id: "d",
      label: "D",
      pitchClass: 2,
      family: "Natural",
      keyColor: "White key",
      aliases: ["Re"],
      description: "D is a whole step above C and often acts like a clear, open support tone in many scales and melodies.",
      usage: "In C major it functions as the supertonic, which often points onward rather than feeling final."
    },
    {
      id: "d-sharp-e-flat",
      label: "D#/Eb",
      pitchClass: 3,
      family: "Accidental",
      keyColor: "Black key",
      aliases: ["D sharp", "E flat"],
      description: "D sharp and E flat are enharmonic spellings of the same pitch class, positioned three semitones above C.",
      usage: "It is common in minor colors and in flat-oriented keys such as E-flat major."
    },
    {
      id: "e",
      label: "E",
      pitchClass: 4,
      family: "Natural",
      keyColor: "White key",
      aliases: ["Mi"],
      description: "E is the major third above C, so it strongly helps define the sound of major harmony.",
      usage: "When E is present over C, the chord immediately feels brighter and more settled."
    },
    {
      id: "f",
      label: "F",
      pitchClass: 5,
      family: "Natural",
      keyColor: "White key",
      aliases: ["Fa"],
      description: "F is the perfect fourth above C and often feels stable while still wanting to move or resolve in tonal music.",
      usage: "It frequently appears as a structural tone in melodies and as the root of flat-side key centers."
    },
    {
      id: "f-sharp-g-flat",
      label: "F#/Gb",
      pitchClass: 6,
      family: "Accidental",
      keyColor: "Black key",
      aliases: ["F sharp", "G flat"],
      description: "F sharp and G flat form the tritone above C, the octave's most evenly divided and tense pitch relationship.",
      usage: "Because it sits at the midpoint of the octave, it is often used to create instability or dramatic pull."
    },
    {
      id: "g",
      label: "G",
      pitchClass: 7,
      family: "Natural",
      keyColor: "White key",
      aliases: ["Sol"],
      description: "G is the perfect fifth above C and one of the most stable interval relationships in Western tonal music.",
      usage: "It reinforces harmony strongly and often feels supportive, open, and structurally important."
    },
    {
      id: "g-sharp-a-flat",
      label: "G#/Ab",
      pitchClass: 8,
      family: "Accidental",
      keyColor: "Black key",
      aliases: ["G sharp", "A flat"],
      description: "G sharp and A flat are enharmonic spellings used in different key contexts for the same sounding pitch.",
      usage: "This pitch often acts as a vivid chromatic color that leans upward toward A or downward toward G."
    },
    {
      id: "a",
      label: "A",
      pitchClass: 9,
      family: "Natural",
      keyColor: "White key",
      aliases: ["La"],
      description: "A is the modern concert-pitch reference note, with A4 standardized at 440 Hz for most contemporary instruments and tuning devices.",
      usage: "It is the main calibration point for ensembles, tuners, and synthesized reference tones."
    },
    {
      id: "a-sharp-b-flat",
      label: "A#/Bb",
      pitchClass: 10,
      family: "Accidental",
      keyColor: "Black key",
      aliases: ["A sharp", "B flat"],
      description: "A sharp and B flat are the same equal-tempered pitch, frequently spelled as B flat in ensemble and band-oriented music.",
      usage: "It shows up often in brass, wind, and flat-key writing, where B-flat-centered harmony is common."
    },
    {
      id: "b",
      label: "B",
      pitchClass: 11,
      family: "Natural",
      keyColor: "White key",
      aliases: ["Ti"],
      description: "B is the major seventh above C, so it often behaves like a leading tone that wants to resolve upward.",
      usage: "That strong pull makes it useful for creating expectation and directional movement toward C."
    }
  ];

  const state = {
    initialized: false,
    entries: [],
    filteredEntries: [],
    selectedId: "",
    searchQuery: "",
    audioContext: null,
    oscillatorNode: null,
    gainNode: null,
    stopTimerId: 0,
    activePlaybackKey: ""
  };

  function getElements() {
    return {
      countEl: document.getElementById("audio-note-count"),
      listEl: document.getElementById("audio-note-list"),
      searchEl: document.getElementById("audio-note-search-input"),
      searchClearEl: document.getElementById("audio-note-search-clear"),
      detailNameEl: document.getElementById("audio-note-detail-name"),
      detailSubEl: document.getElementById("audio-note-detail-sub"),
      detailSummaryEl: document.getElementById("audio-note-detail-summary"),
      detailBodyEl: document.getElementById("audio-note-detail-body")
    };
  }

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9#]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function getMidiNumber(pitchClass, octave) {
    return ((octave + 1) * 12) + pitchClass;
  }

  function getFrequencyHz(pitchClass, octave) {
    const midiNumber = getMidiNumber(pitchClass, octave);
    return 440 * Math.pow(2, (midiNumber - 69) / 12);
  }

  function formatFrequencyHz(value) {
    if (value >= 100) {
      return `${value.toFixed(2)} Hz`;
    }
    if (value >= 10) {
      return `${value.toFixed(3)} Hz`;
    }
    return `${value.toFixed(4)} Hz`;
  }

  function formatMeters(value) {
    if (value >= 1) {
      return `${value.toFixed(2)} m`;
    }
    return `${value.toFixed(3)} m`;
  }

  function formatMilliseconds(value) {
    return `${value.toFixed(2)} ms`;
  }

  function formatSignedSemitoneOffset(value) {
    if (value === 0) {
      return "Concert pitch reference";
    }

    const distance = Math.abs(value);
    const direction = value > 0 ? "above" : "below";
    return `${distance} semitone${distance === 1 ? "" : "s"} ${direction} A4`;
  }

  function buildEntries() {
    return NOTE_DEFINITIONS.map((definition) => {
      const referenceOctave = 4;
      const referenceFrequencyHz = getFrequencyHz(definition.pitchClass, referenceOctave);
      const referenceMidiNumber = getMidiNumber(definition.pitchClass, referenceOctave);
      const octaveSeries = OCTAVES.map((octave) => {
        const frequencyHz = getFrequencyHz(definition.pitchClass, octave);
        return {
          octave,
          label: `${definition.label}${octave}`,
          frequencyHz,
          midiNumber: getMidiNumber(definition.pitchClass, octave)
        };
      });

      return {
        ...definition,
        intervalFromC: INTERVALS_FROM_C[definition.pitchClass],
        referenceOctave,
        referenceLabel: `${definition.label}${referenceOctave}`,
        referenceFrequencyHz,
        referenceMidiNumber,
        wavelengthMeters: SPEED_OF_SOUND_METERS_PER_SECOND / referenceFrequencyHz,
        periodMilliseconds: 1000 / referenceFrequencyHz,
        semitoneOffsetFromA4: referenceMidiNumber - 69,
        octaveSeries,
        searchText: normalize([
          definition.label,
          definition.family,
          definition.keyColor,
          definition.description,
          definition.usage,
          INTERVALS_FROM_C[definition.pitchClass],
          ...(definition.aliases || [])
        ].join(" "))
      };
    });
  }

  function findEntryById(id) {
    return state.entries.find((entry) => entry.id === id) || null;
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

  function createFrequencyGrid(entry) {
    const grid = document.createElement("div");
    grid.className = "audio-note-frequency-grid";

    entry.octaveSeries.forEach((seriesEntry) => {
      const playbackKey = `${entry.id}:${seriesEntry.octave}`;
      const isPlaying = state.activePlaybackKey === playbackKey;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `audio-note-frequency-cell audio-note-frequency-cell--button${isPlaying ? " is-playing" : ""}`;
      cell.dataset.action = "play-frequency";
      cell.dataset.playbackKey = playbackKey;
      cell.dataset.frequencyHz = String(seriesEntry.frequencyHz);
      cell.setAttribute("aria-pressed", isPlaying ? "true" : "false");
      cell.setAttribute("aria-label", `${isPlaying ? "Stop" : "Play"} ${seriesEntry.label} at ${formatFrequencyHz(seriesEntry.frequencyHz)}`);

      const label = document.createElement("div");
      label.className = "audio-note-frequency-label";
      label.textContent = seriesEntry.label;

      const value = document.createElement("div");
      value.className = "audio-note-frequency-value";
      value.textContent = formatFrequencyHz(seriesEntry.frequencyHz);

      const meta = document.createElement("div");
      meta.className = "audio-note-frequency-meta";
      meta.textContent = `MIDI ${seriesEntry.midiNumber}`;

      const status = document.createElement("div");
      status.className = "audio-note-frequency-status";
      status.textContent = isPlaying ? "Playing now" : "Tap to hear";

      cell.append(label, value, meta, status);
      grid.appendChild(cell);
    });

    return grid;
  }

  function renderList(elements) {
    if (!elements.listEl) {
      return;
    }

    const fragment = document.createDocumentFragment();

    state.filteredEntries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "list-item audio-note-list-item";
      button.dataset.noteId = entry.id;
      button.setAttribute("role", "option");

      const isSelected = entry.id === state.selectedId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-selected", isSelected ? "true" : "false");

      const name = document.createElement("span");
      name.className = "list-name";
      name.textContent = entry.label;

      const meta = document.createElement("span");
      meta.className = "list-meta";
      meta.textContent = `${entry.referenceLabel} = ${formatFrequencyHz(entry.referenceFrequencyHz)} · ${entry.intervalFromC}`;

      button.append(name, meta);
      fragment.appendChild(button);
    });

    elements.listEl.replaceChildren(fragment);

    if (!state.filteredEntries.length) {
      const empty = document.createElement("div");
      empty.className = "body-text";
      empty.style.padding = "16px";
      empty.style.color = "#71717a";
      empty.textContent = "No notes match your search.";
      elements.listEl.appendChild(empty);
    }

    if (elements.countEl) {
      elements.countEl.textContent = `${state.filteredEntries.length} notes`;
    }
  }

  function renderDetail(elements) {
    const entry = findEntryById(state.selectedId);
    if (!elements.detailNameEl || !elements.detailSubEl || !elements.detailSummaryEl || !elements.detailBodyEl) {
      return;
    }

    elements.detailBodyEl.replaceChildren();

    if (!entry) {
      elements.detailNameEl.textContent = "--";
      elements.detailSubEl.textContent = "Select a note to explore";
      elements.detailSummaryEl.textContent = "--";
      return;
    }

    elements.detailNameEl.textContent = entry.label;
    elements.detailSubEl.textContent = `${entry.family} note · ${entry.intervalFromC}`;
    elements.detailSummaryEl.textContent = entry.description;

    const grid = document.createElement("div");
    grid.className = "meta-grid";

    const profileCard = createMetaCard("Note Profile");
    profileCard.innerHTML += html`
      <dl class="alpha-dl">
        <dt>Reference pitch</dt><dd>${entry.referenceLabel}</dd>
        <dt>Reference frequency</dt><dd>${formatFrequencyHz(entry.referenceFrequencyHz)}</dd>
        <dt>Pitch class</dt><dd>${entry.pitchClass}</dd>
        <dt>Interval above C</dt><dd>${entry.intervalFromC}</dd>
        <dt>Keyboard key</dt><dd>${entry.keyColor}</dd>
        <dt>Relation to A4</dt><dd>${formatSignedSemitoneOffset(entry.semitoneOffsetFromA4)}</dd>
        <dt>Wavelength</dt><dd>${formatMeters(entry.wavelengthMeters)}</dd>
        <dt>Period</dt><dd>${formatMilliseconds(entry.periodMilliseconds)}</dd>
      </dl>
    `;

    const aliasRow = document.createElement("div");
    aliasRow.className = "audio-note-chip-row";
    const familyChip = document.createElement("span");
    familyChip.className = `audio-note-chip audio-note-chip--${entry.family.toLowerCase()}`;
    familyChip.textContent = entry.family;
    aliasRow.appendChild(familyChip);

    (entry.aliases || []).forEach((alias) => {
      const chip = document.createElement("span");
      chip.className = "audio-note-chip";
      chip.textContent = alias;
      aliasRow.appendChild(chip);
    });

    profileCard.appendChild(aliasRow);

    const explanationCard = createMetaCard("Explanation");
    const explanation = document.createElement("div");
    explanation.className = "audio-note-copy";
    explanation.textContent = `${entry.description} ${entry.usage}`;
    explanationCard.appendChild(explanation);

    const playbackCard = createMetaCard("Tone Preview");
    const playbackCopy = document.createElement("div");
    playbackCopy.className = "audio-note-playback-copy";
    playbackCopy.textContent = `Play ${entry.referenceLabel} as a quick sine-wave reference, or use any octave button below to hear that exact frequency.`;

    const playbackActions = document.createElement("div");
    playbackActions.className = "audio-note-playback-actions";

    const playReferenceButton = document.createElement("button");
    playReferenceButton.type = "button";
    playReferenceButton.className = "alpha-nav-btn audio-note-playback-btn";
    playReferenceButton.dataset.action = "play-frequency";
    playReferenceButton.dataset.playbackKey = `${entry.id}:${entry.referenceOctave}`;
    playReferenceButton.dataset.frequencyHz = String(entry.referenceFrequencyHz);
    playReferenceButton.textContent = `Play ${entry.referenceLabel}`;

    const stopButton = document.createElement("button");
    stopButton.type = "button";
    stopButton.className = "alpha-nav-btn alpha-nav-btn--ghost audio-note-playback-btn";
    stopButton.dataset.action = "stop-playback";
    stopButton.textContent = "Stop";

    playbackActions.append(playReferenceButton, stopButton);
    playbackCard.append(playbackCopy, playbackActions);

    const frequencyCard = createMetaCard("Frequencies By Octave");
    frequencyCard.appendChild(createFrequencyGrid(entry));

    const formulaCard = createMetaCard("Equal-Temperament Rule");
    const formula = document.createElement("div");
    formula.className = "audio-note-formula";
    formula.textContent = "Reference frequencies here use twelve-tone equal temperament with A4 = 440 Hz. Every octave doubles the frequency, and each semitone step multiplies the pitch by the twelfth root of 2.";
    formulaCard.appendChild(formula);

    grid.append(profileCard, explanationCard, playbackCard, frequencyCard, formulaCard);
    elements.detailBodyEl.appendChild(grid);
  }

  function render() {
    const elements = getElements();
    renderList(elements);
    renderDetail(elements);
  }

  function applyFilter() {
    const query = normalize(state.searchQuery);
    state.filteredEntries = state.entries.filter((entry) => !query || entry.searchText.includes(query));

    if (!state.filteredEntries.some((entry) => entry.id === state.selectedId)) {
      state.selectedId = state.filteredEntries[0]?.id || "";
    }

    render();

    const elements = getElements();
    if (elements.searchClearEl) {
      elements.searchClearEl.disabled = !state.searchQuery;
    }
  }

  function selectNote(id) {
    if (!findEntryById(id)) {
      return;
    }

    stopPlayback(false);
    state.selectedId = id;
    render();
  }

  function bindEvents() {
    const elements = getElements();
    if (!elements.listEl || !elements.searchEl || !elements.searchClearEl || !elements.detailBodyEl) {
      return;
    }

    elements.listEl.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("button[data-note-id]") : null;
      if (!button) {
        return;
      }
      selectNote(button.dataset.noteId || "");
    });

    elements.searchEl.addEventListener("input", () => {
      state.searchQuery = elements.searchEl.value || "";
      applyFilter();
    });

    elements.searchClearEl.addEventListener("click", () => {
      state.searchQuery = "";
      elements.searchEl.value = "";
      applyFilter();
      elements.searchEl.focus();
    });

    elements.detailBodyEl.addEventListener("click", (event) => {
      const control = event.target instanceof Element ? event.target.closest("button[data-action]") : null;
      if (!control) {
        return;
      }

      const action = control.dataset.action || "";
      if (action === "stop-playback") {
        stopPlayback(true);
        return;
      }

      if (action === "play-frequency") {
        const frequencyHz = Number(control.dataset.frequencyHz);
        const playbackKey = String(control.dataset.playbackKey || "").trim();
        if (!Number.isFinite(frequencyHz) || !playbackKey) {
          return;
        }

        void playFrequency(frequencyHz, playbackKey);
      }
    });

    window.addEventListener("beforeunload", () => {
      stopPlayback(false);
    });
  }

  function init() {
    if (state.initialized) {
      render();
      return;
    }

    state.entries = buildEntries();
    state.filteredEntries = [...state.entries];
    state.selectedId = state.entries[0]?.id || "";

    bindEvents();
    render();
    state.initialized = true;
  }

  function ensureAudioNotesSection() {
    init();
  }

  window.AudioNotesUi = {
    ...(window.AudioNotesUi || {}),
    init,
    ensureAudioNotesSection,
    selectNote
  };
})();