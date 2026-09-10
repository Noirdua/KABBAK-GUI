/* ui-quiz-bank.js — Built-in quiz question bank generation */
(function () {
  "use strict";

  const quizQuestionBankBuiltins = window.QuizQuestionBankBuiltins || {};

  if (typeof quizQuestionBankBuiltins.buildBuiltInQuestionBank !== "function") {
    throw new Error("QuizQuestionBankBuiltins module must load before ui-quiz-bank.js");
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

  function resolveDifficultyValue(valueByDifficulty, difficulty = "normal") {
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

  function createQuestionTemplate(payload, poolValues) {
    const key = String(payload?.key || "").trim();
    const promptByDifficulty = payload?.promptByDifficulty ?? payload?.prompt;
    const answerByDifficulty = payload?.answerByDifficulty ?? payload?.answer;
    const poolByDifficulty = poolValues;
    const categoryId = String(payload?.categoryId || "").trim();
    const category = String(payload?.category || "Correspondence").trim();

    const defaultPrompt = String(resolveDifficultyValue(promptByDifficulty, "normal") || "").trim();
    const defaultAnswer = normalizeOption(resolveDifficultyValue(answerByDifficulty, "normal"));
    const defaultPool = toUniqueOptionList(resolveDifficultyValue(poolByDifficulty, "normal") || []);

    if (!key || !defaultPrompt || !defaultAnswer || !categoryId || !category) {
      return null;
    }

    if (!defaultPool.some((value) => normalizeKey(value) === normalizeKey(defaultAnswer))) {
      defaultPool.push(defaultAnswer);
    }

    const distractorCount = defaultPool.filter((value) => normalizeKey(value) !== normalizeKey(defaultAnswer)).length;
    if (distractorCount < 3) {
      return null;
    }

    return {
      key,
      categoryId,
      category,
      promptByDifficulty,
      answerByDifficulty,
      poolByDifficulty
    };
  }

  function dedupeTemplatesByKey(templates) {
    const deduped = new Map();

    (templates || []).forEach((template) => {
      if (!template || !template.key) {
        return;
      }
      deduped.set(template.key, template);
    });

    return [...deduped.values()];
  }

  function buildQuestionBank(referenceData, magickDataset, dynamicCategoryRegistry) {
    const bank = quizQuestionBankBuiltins.buildBuiltInQuestionBank({
      referenceData,
      magickDataset,
      helpers: {
        toTitleCase,
        normalizeOption,
        toUniqueOptionList,
        createQuestionTemplate
      }
    });

    (dynamicCategoryRegistry || []).forEach(({ builder }) => {
      try {
        const dynamicTemplates = builder(referenceData, magickDataset);
        if (Array.isArray(dynamicTemplates)) {
          dynamicTemplates.forEach((template) => {
            if (template) {
              bank.push(template);
            }
          });
        }
      } catch (_error) {
        // Skip broken plugins silently to preserve quiz availability.
      }
    });

    return dedupeTemplatesByKey(bank);
  }

  window.QuizQuestionBank = {
    buildQuestionBank,
    createQuestionTemplate,
    dedupeTemplatesByKey,
    normalizeKey,
    normalizeOption,
    toTitleCase,
    toUniqueOptionList
  };
})();