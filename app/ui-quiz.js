/* ui-quiz.js — Correspondences quiz */
(function () {
  "use strict";

  const dataService = window.TarotDataService || {};

  const state = {
    initialized: false,
    scoreCorrect: 0,
    scoreAnswered: 0,
    selectedCategory: "random",
    selectedDifficulty: "normal",
    questionBank: [],
    templateByKey: new Map(),
    runUnseenKeys: [],
    runRetryKeys: [],
    runRetrySet: new Set(),
    currentQuestion: null,
    answeredCurrent: false,
    loadingQuestion: false,
    autoAdvanceTimer: null,
    autoAdvanceDelayMs: 1500
  };

  const FIXED_CATEGORY_OPTIONS = [
    { value: "random", label: "Random" },
    { value: "all", label: "All" }
  ];

  const CATEGORY_META = [
    { id: "english-gematria", label: "English Gematria" },
    { id: "hebrew-numerology", label: "Hebrew Gematria" },
    { id: "english-hebrew-mapping", label: "Alphabet Mapping" },
    { id: "zodiac-rulers", label: "Zodiac Rulers" },
    { id: "zodiac-elements", label: "Zodiac Elements" },
    { id: "planetary-weekdays", label: "Planetary Weekdays" },
    { id: "zodiac-tarot", label: "Zodiac ↔ Tarot" },
    { id: "kabbalah-path-between-sephirot", label: "Kabbalah: Path Between Sephirot" },
    { id: "kabbalah-path-letter", label: "Kabbalah: Path Number ↔ Letter" },
    { id: "kabbalah-path-tarot", label: "Kabbalah: Path ↔ Tarot Trump" },
    { id: "sephirot-planets", label: "Sephirot ↔ Planet" },
    { id: "tarot-decan-sign", label: "Tarot Decans: Card ↔ Decan" },
    { id: "tarot-decan-ruler", label: "Tarot Decans: Card ↔ Ruler" },
    { id: "tarot-cube-location", label: "Tarot ↔ Cube Location" },
    { id: "cube-hebrew-letter", label: "Cube ↔ Hebrew Letter" },
    { id: "playing-card-tarot", label: "Playing Card ↔ Tarot" }
  ];

  // Dynamic category plugin registry — populated by registerQuizCategory()
  const DYNAMIC_CATEGORY_REGISTRY = [];
  const quizQuestionBank = window.QuizQuestionBank || {};

  function registerQuizCategory(id, label, builder) {
    if (typeof id !== "string" || !id || typeof builder !== "function") {
      return;
    }

    const existingIndex = DYNAMIC_CATEGORY_REGISTRY.findIndex((entry) => entry.id === id);
    if (existingIndex >= 0) {
      DYNAMIC_CATEGORY_REGISTRY[existingIndex] = { id, label: String(label || id), builder };
    } else {
      DYNAMIC_CATEGORY_REGISTRY.push({ id, label: String(label || id), builder });
    }

    if (!CATEGORY_META.some((item) => item.id === id)) {
      CATEGORY_META.push({ id, label: String(label || id) });
    }
  }

  let categoryEl;
  let difficultyEl;
  let questionTypeEl;
  let questionEl;
  let optionsEl;
  let feedbackEl;
  let runSerial = 0;
  let resetEl;
  let scoreCorrectEl;
  let scoreAnsweredEl;
  let scoreAccuracyEl;

  function getElements() {
    categoryEl = document.getElementById("quiz-category");
    difficultyEl = document.getElementById("quiz-difficulty");
    questionTypeEl = document.getElementById("quiz-question-type");
    questionEl = document.getElementById("quiz-question");
    optionsEl = document.getElementById("quiz-options");
    feedbackEl = document.getElementById("quiz-feedback");
    resetEl = document.getElementById("quiz-reset");
    scoreCorrectEl = document.getElementById("quiz-score-correct");
    scoreAnsweredEl = document.getElementById("quiz-score-answered");
    scoreAccuracyEl = document.getElementById("quiz-score-accuracy");
  }

  function isReady() {
    return Boolean(
      categoryEl
      && difficultyEl
      && questionTypeEl
      && questionEl
      && optionsEl
      && feedbackEl
      && resetEl
      && scoreCorrectEl
      && scoreAnsweredEl
      && scoreAccuracyEl
    );
  }

  function clearAutoAdvanceTimer() {
    if (!state.autoAdvanceTimer) {
      return;
    }
    clearTimeout(state.autoAdvanceTimer);
    state.autoAdvanceTimer = null;
  }

  function queueAutoAdvance() {
    clearAutoAdvanceTimer();
    state.autoAdvanceTimer = setTimeout(() => {
      state.autoAdvanceTimer = null;
      showNextQuestion();
    }, state.autoAdvanceDelayMs);
  }

  function toTitleCase(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) {
      return "";
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function normalizeOption(value) {
    return String(value || "").trim();
  }

  function normalizeKey(value) {
    return normalizeOption(value).toLowerCase();
  }

  function toUniqueOptionList(values) {
    const seen = new Set();
    const unique = [];

    (values || []).forEach((value) => {
      const formatted = normalizeOption(value);
      if (!formatted) {
        return;
      }

      const key = normalizeKey(formatted);
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      unique.push(formatted);
    });

    return unique;
  }

  function shuffle(list) {
    const clone = list.slice();
    for (let index = clone.length - 1; index > 0; index -= 1) {
      const nextIndex = Math.floor(Math.random() * (index + 1));
      [clone[index], clone[nextIndex]] = [clone[nextIndex], clone[index]];
    }
    return clone;
  }

  function pickMany(list, count) {
    if (!Array.isArray(list) || !list.length || count <= 0) {
      return [];
    }
    return shuffle(list).slice(0, Math.min(count, list.length));
  }

  function getActiveDifficulty() {
    const value = String(state.selectedDifficulty || "normal").toLowerCase();
    if (value === "easy" || value === "hard") {
      return value;
    }
    return "normal";
  }

  function resolveDifficultyValue(valueByDifficulty, difficulty = getActiveDifficulty()) {
    if (valueByDifficulty == null) {
      return "";
    }

    if (typeof valueByDifficulty !== "object" || Array.isArray(valueByDifficulty)) {
      return valueByDifficulty;
    }

    if (Object.prototype.hasOwnProperty.call(valueByDifficulty, difficulty)) {
      return valueByDifficulty[difficulty];
    }

    if (Object.prototype.hasOwnProperty.call(valueByDifficulty, "normal")) {
      return valueByDifficulty.normal;
    }

    if (Object.prototype.hasOwnProperty.call(valueByDifficulty, "easy")) {
      return valueByDifficulty.easy;
    }

    if (Object.prototype.hasOwnProperty.call(valueByDifficulty, "hard")) {
      return valueByDifficulty.hard;
    }

    return "";
  }

  function buildOptions(correctValue, poolValues) {
    const correct = normalizeOption(correctValue);
    if (!correct) {
      return null;
    }

    const uniquePool = toUniqueOptionList(poolValues || []);
    if (!uniquePool.some((value) => normalizeKey(value) === normalizeKey(correct))) {
      uniquePool.push(correct);
    }

    const distractors = uniquePool.filter((value) => normalizeKey(value) !== normalizeKey(correct));
    if (distractors.length < 3) {
      return null;
    }

    const selectedDistractors = pickMany(distractors, 3);
    const options = shuffle([correct, ...selectedDistractors]);
    const correctIndex = options.findIndex((value) => normalizeKey(value) === normalizeKey(correct));

    if (correctIndex < 0 || options.length < 4) {
      return null;
    }

    return {
      options,
      correctIndex
    };
  }

  async function buildQuestionBank(referenceData, magickDataset) {
    const payload = await dataService.loadQuizTemplates?.();
    return Array.isArray(payload?.templates)
      ? payload.templates
      : (Array.isArray(payload) ? payload : []);
  }

  async function refreshQuestionBank(referenceData, magickDataset) {
    state.questionBank = await buildQuestionBank(referenceData, magickDataset);
    state.templateByKey = new Map(state.questionBank.map((template) => [template.key, template]));

    const hasTemplate = (key) => state.templateByKey.has(key);
    state.runUnseenKeys = state.runUnseenKeys.filter(hasTemplate);
    state.runRetryKeys = state.runRetryKeys.filter(hasTemplate);
    state.runRetrySet = new Set(state.runRetryKeys);

    if (state.currentQuestion && !state.templateByKey.has(state.currentQuestion.key)) {
      state.currentQuestion = null;
      state.answeredCurrent = true;
    }
  }

  function getScopedTemplates() {
    if (!state.questionBank.length) {
      return [];
    }

    const mode = state.selectedCategory || "random";
    if (mode === "random" || mode === "all") {
      return state.questionBank.slice();
    }

    return state.questionBank.filter((template) => template.categoryId === mode);
  }

  function getCategoryOptions() {
    const availableCategoryIds = new Set(state.questionBank.map((template) => template.categoryId));
    const labelByCategoryId = new Map(CATEGORY_META.map((item) => [item.id, item.label]));

    state.questionBank.forEach((template) => {
      const categoryId = String(template?.categoryId || "").trim();
      const category = String(template?.category || "").trim();
      if (categoryId && category && !labelByCategoryId.has(categoryId)) {
        labelByCategoryId.set(categoryId, category);
      }
    });

    const dynamic = [...availableCategoryIds]
      .sort((left, right) => {
        const leftLabel = String(labelByCategoryId.get(left) || left);
        const rightLabel = String(labelByCategoryId.get(right) || right);
        return leftLabel.localeCompare(rightLabel);
      })
      .map((categoryId) => ({
        value: categoryId,
        label: String(labelByCategoryId.get(categoryId) || categoryId)
      }));

    return [...FIXED_CATEGORY_OPTIONS, ...dynamic];
  }

  function renderCategoryOptions() {
    if (!categoryEl) {
      return false;
    }

    const options = getCategoryOptions();
    const preservedValue = state.selectedCategory;
    categoryEl.innerHTML = "";

    options.forEach((optionDef) => {
      const option = document.createElement("option");
      option.value = optionDef.value;
      option.textContent = optionDef.label;
      categoryEl.appendChild(option);
    });

    const validValues = new Set(options.map((optionDef) => optionDef.value));
    const nextSelected = validValues.has(preservedValue) ? preservedValue : "random";
    state.selectedCategory = nextSelected;
    categoryEl.value = nextSelected;
    return nextSelected !== preservedValue;
  }

  function syncDifficultyControl() {
    if (!difficultyEl) {
      return;
    }

    const difficulty = getActiveDifficulty();
    state.selectedDifficulty = difficulty;
    difficultyEl.value = difficulty;
  }

  function getRunLabel() {
    const mode = state.selectedCategory || "random";
    if (mode === "random") {
      return "Random";
    }
    if (mode === "all") {
      return "All";
    }
    return CATEGORY_META.find((item) => item.id === mode)?.label
      || state.questionBank.find((template) => template.categoryId === mode)?.category
      || "Category";
  }

  async function startRun(resetScore = false) {
    clearAutoAdvanceTimer();
    const serial = ++runSerial;

    if (resetScore) {
      state.scoreCorrect = 0;
      state.scoreAnswered = 0;
    }

    const templates = getScopedTemplates();
    const mode = state.selectedCategory || "random";

    if (!templates.length) {
      state.runUnseenKeys = [];
      state.runRetryKeys = [];
      state.runRetrySet = new Set();
      state.currentQuestion = null;
      state.answeredCurrent = true;
      updateScoreboard();
      renderNoQuestionState();
      return;
    }

    let orderedTemplates;
    if (mode === "all") {
      orderedTemplates = templates
        .slice()
        .sort((left, right) => {
          const leftCategory = String(left.category || "");
          const rightCategory = String(right.category || "");
          if (leftCategory === rightCategory) {
            return String(left.key || "").localeCompare(String(right.key || ""));
          }
          return leftCategory.localeCompare(rightCategory);
        });
    } else {
      orderedTemplates = shuffle(templates);
    }

    state.runUnseenKeys = orderedTemplates.map((template) => template.key);
    state.runRetryKeys = [];
    state.runRetrySet = new Set();
    state.currentQuestion = null;
    state.answeredCurrent = true;

    updateScoreboard();
    await showNextQuestion(serial);
  }

  function popNextTemplateFromRun() {
    while (state.runUnseenKeys.length) {
      const key = state.runUnseenKeys.shift();
      const template = state.templateByKey.get(key);
      if (template) {
        return template;
      }
    }

    while (state.runRetryKeys.length) {
      const key = state.runRetryKeys.shift();
      state.runRetrySet.delete(key);
      const template = state.templateByKey.get(key);
      if (template) {
        return template;
      }
    }

    return null;
  }

  function renderRunCompleteState() {
    state.loadingQuestion = false;
    state.currentQuestion = null;
    state.answeredCurrent = true;
    questionTypeEl.textContent = getRunLabel();
    questionEl.textContent = "Run complete. All previously missed questions are now correct.";
    optionsEl.innerHTML = "";
    feedbackEl.textContent = "Change category/difficulty or press Reset Score to start a new run.";

    recordRunToProfile();
  }

  const lastProfileAttemptSignature = { value: "" };

  async function recordRunToProfile() {
    if (state.scoreAnswered <= 0) {
      return;
    }
    if (!window.TarotAppConfig?.isProfileAuthorized?.()) {
      return;
    }

    const signature = [
      String(state.selectedCategory || ""),
      String(state.selectedDifficulty || ""),
      String(state.scoreCorrect),
      String(state.scoreAnswered)
    ].join("|");
    if (lastProfileAttemptSignature.value === signature) {
      return;
    }
    lastProfileAttemptSignature.value = signature;

    if (!window.ProfileUi) {
      try {
        await window.TarotLazySections?.loadScriptGroup?.("profile");
      } catch (_error) {
        return;
      }
    }

    void window.ProfileUi?.recordQuizAttempt?.({
      categoryId: String(state.selectedCategory || ""),
      templateKey: "",
      difficulty: String(state.selectedDifficulty || ""),
      score: state.scoreCorrect,
      total: state.scoreAnswered
    });
  }

  function updateScoreboard() {
    if (!isReady()) {
      return;
    }

    const answered = state.scoreAnswered;
    const correct = state.scoreCorrect;
    const accuracy = answered > 0
      ? `${Math.round((correct / answered) * 100)}%`
      : "0%";

    scoreCorrectEl.textContent = String(correct);
    scoreAnsweredEl.textContent = String(answered);
    scoreAccuracyEl.textContent = accuracy;
  }

  function renderQuestion(question) {
    if (!isReady()) {
      return;
    }

    state.loadingQuestion = false;
    state.currentQuestion = question;
    state.answeredCurrent = false;

    questionTypeEl.textContent = question.category;
    questionEl.textContent = question.prompt;
    feedbackEl.textContent = "Choose the best answer.";

    optionsEl.innerHTML = "";
    question.options.forEach((optionText, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-option";
      button.textContent = `${String.fromCharCode(65 + index)}. ${optionText}`;
      button.dataset.optionIndex = String(index);
      button.addEventListener("click", () => {
        submitAnswer(index);
      });
      optionsEl.appendChild(button);
    });
  }

  function renderNoQuestionState() {
    if (!isReady()) {
      return;
    }

    state.loadingQuestion = false;
    state.currentQuestion = null;
    state.answeredCurrent = true;

    questionTypeEl.textContent = getRunLabel();
    questionEl.textContent = "Not enough variation for this category yet.";
    optionsEl.innerHTML = "";
    feedbackEl.textContent = "Try Random/All or switch to another category.";
  }

  async function createQuestionFromTemplate(template) {
    if (!template) {
      return null;
    }

    return dataService.pullQuizQuestion?.({
      templateKey: template.key,
      difficulty: getActiveDifficulty(),
      includeAnswer: true
    });
  }

  async function showNextQuestion(serial = 0) {
    clearAutoAdvanceTimer();

    if (state.loadingQuestion) {
      return;
    }

    if (!isReady() || !(feedbackEl instanceof HTMLElement)) {
      return;
    }

    const totalPending = state.runUnseenKeys.length + state.runRetryKeys.length;
    if (totalPending <= 0) {
      if (state.questionBank.length) {
        renderRunCompleteState();
      } else {
        renderNoQuestionState();
      }
      return;
    }

    const maxAttempts = totalPending + 1;
    state.loadingQuestion = true;
    feedbackEl.textContent = "Loading question...";

    for (let index = 0; index < maxAttempts; index += 1) {
      const template = popNextTemplateFromRun();
      if (!template) {
        continue;
      }

      let question = null;
      try {
        question = await createQuestionFromTemplate(template);
      } catch (error) {
        feedbackEl.textContent = `Could not reach the API. ${error?.message || "Check your connection."}`;
        state.loadingQuestion = false;
        return;
      }
      if (question) {
        renderQuestion(question);
        return;
      }
    }

    renderNoQuestionState();
  }

  function submitAnswer(optionIndex) {
    if (!state.currentQuestion || state.answeredCurrent) {
      return;
    }

    state.answeredCurrent = true;
    state.scoreAnswered += 1;

    const isCorrect = optionIndex === state.currentQuestion.correctIndex;
    if (isCorrect) {
      state.scoreCorrect += 1;
    }

    const optionButtons = optionsEl.querySelectorAll(".quiz-option");
    optionButtons.forEach((button, index) => {
      button.disabled = true;
      if (index === state.currentQuestion.correctIndex) {
        button.classList.add("is-correct");
      } else if (index === optionIndex) {
        button.classList.add("is-wrong");
      }
    });

    if (isCorrect) {
      feedbackEl.textContent = "Correct. Next question incoming…";
    } else {
      feedbackEl.textContent = `Not quite. Correct answer: ${state.currentQuestion.answer}. Next question incoming…`;
      const failedKey = state.currentQuestion.key;
      if (!state.runRetrySet.has(failedKey)) {
        state.runRetrySet.add(failedKey);
        state.runRetryKeys.push(failedKey);
      }
    }

    updateScoreboard();
    queueAutoAdvance();
  }

  function bindEvents() {
    if (!isReady()) {
      return;
    }

    categoryEl.addEventListener("change", () => {
      state.selectedCategory = String(categoryEl.value || "random");
      void startRun(true);
    });

    difficultyEl.addEventListener("change", () => {
      state.selectedDifficulty = String(difficultyEl.value || "normal").toLowerCase();
      syncDifficultyControl();
      void startRun(true);
    });

    resetEl.addEventListener("click", () => {
      void startRun(true);
    });
  }

  async function ensureQuizSection(referenceData, magickDataset) {
    ensureQuizSection._referenceData = referenceData;
    ensureQuizSection._magickDataset = magickDataset;

    if (!state.initialized) {
      getElements();
      if (!isReady()) {
        return;
      }

      bindEvents();
      state.initialized = true;
      updateScoreboard();
    }

    const isQuizActive = window.TarotSectionStateUi?.getActiveSection?.() === "quiz";
    if (!isQuizActive) {
      return;
    }

    await refreshQuestionBank(referenceData, magickDataset);
    const categoryAdjusted = renderCategoryOptions();
    syncDifficultyControl();

    if (categoryAdjusted) {
      await startRun(false);
      return;
    }

    const hasRunPending = state.runUnseenKeys.length > 0 || state.runRetryKeys.length > 0;
    if (!state.currentQuestion && !hasRunPending) {
      await startRun(false);
      return;
    }

    if (!state.currentQuestion && hasRunPending) {
      await showNextQuestion();
    }

    updateScoreboard();
  }

  window.QuizSectionUi = {
    ensureQuizSection,
    registerQuizCategory
  };
})();
