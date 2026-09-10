(function () {
  function createTarotCardDerivations(dependencies) {
    const {
      normalizeRelationId,
      normalizeTarotCardLookupName,
      toTitleCase,
      getReferenceData,
      ELEMENT_NAME_BY_ID,
      ELEMENT_HEBREW_LETTER_BY_ID,
      ELEMENT_HEBREW_CHAR_BY_ID,
      HEBREW_LETTER_ID_BY_TETRAGRAMMATON_LETTER,
      ACE_ELEMENT_BY_CARD_NAME,
      COURT_ELEMENT_BY_RANK,
      MINOR_RANK_NUMBER_BY_NAME,
      SMALL_CARD_SIGN_BY_MODALITY_AND_SUIT,
      MINOR_PLURAL_BY_RANK
    } = dependencies || {};

    function buildTypeLabel(card) {
      if (card.arcana === "Major") {
        return typeof card.number === "number"
          ? `Major Arcana · ${card.number}`
          : "Major Arcana";
      }

      const parts = ["Minor Arcana"];
      if (card.rank) {
        parts.push(card.rank);
      }
      if (card.suit) {
        parts.push(card.suit);
      }

      return parts.join(" · ");
    }

    function resolveElementIdForCard(card) {
      if (!card) {
        return "";
      }

      const cardLookupName = normalizeTarotCardLookupName(card.name);
      const rankKey = String(card.rank || "").trim().toLowerCase();

      return ACE_ELEMENT_BY_CARD_NAME[cardLookupName] || COURT_ELEMENT_BY_RANK[rankKey] || "";
    }

    function createElementRelation(card, elementId, sourceKind, sourceLabel) {
      if (!card || !elementId) {
        return null;
      }

      const elementName = ELEMENT_NAME_BY_ID[elementId] || toTitleCase(elementId);
      const hebrewLetter = ELEMENT_HEBREW_LETTER_BY_ID[elementId] || "";
      const hebrewChar = ELEMENT_HEBREW_CHAR_BY_ID[elementId] || "";
      const relationLabel = `${elementName}${hebrewChar ? ` (${hebrewChar})` : (hebrewLetter ? ` (${hebrewLetter})` : "")} · ${sourceLabel}`;

      return {
        type: "element",
        id: elementId,
        label: relationLabel,
        data: {
          elementId,
          name: elementName,
          tarotCard: card.name,
          hebrewLetter,
          hebrewChar,
          sourceKind,
          sourceLabel,
          rank: card.rank || "",
          suit: card.suit || ""
        },
        __key: `element|${elementId}|${sourceKind}|${normalizeRelationId(sourceLabel)}|${card.id || normalizeTarotCardLookupName(card.name)}`
      };
    }

    function buildElementRelationsForCard(card, baseElementRelations = []) {
      if (!card) {
        return [];
      }

      if (card.arcana === "Major") {
        return Array.isArray(baseElementRelations) ? [...baseElementRelations] : [];
      }

      const relations = [];

      const suitKey = String(card.suit || "").trim().toLowerCase();
      const suitElementId = {
        wands: "fire",
        cups: "water",
        swords: "air",
        disks: "earth"
      }[suitKey] || "";
      if (suitElementId) {
        const suitRelation = createElementRelation(card, suitElementId, "suit", `Suit: ${card.suit}`);
        if (suitRelation) {
          relations.push(suitRelation);
        }
      }

      const rankKey = String(card.rank || "").trim().toLowerCase();
      const courtElementId = COURT_ELEMENT_BY_RANK[rankKey] || "";
      if (courtElementId) {
        const courtRelation = createElementRelation(card, courtElementId, "court", `Court: ${card.rank}`);
        if (courtRelation) {
          relations.push(courtRelation);
        }
      }

      return relations;
    }

    function buildTetragrammatonRelationsForCard(card) {
      if (!card) {
        return [];
      }

      const elementId = resolveElementIdForCard(card);
      if (!elementId) {
        return [];
      }

      const letter = ELEMENT_HEBREW_LETTER_BY_ID[elementId] || "";
      if (!letter) {
        return [];
      }

      const elementName = ELEMENT_NAME_BY_ID[elementId] || elementId;
      const letterKey = String(letter || "").trim().toLowerCase();
      const hebrewLetterId = HEBREW_LETTER_ID_BY_TETRAGRAMMATON_LETTER[letterKey] || "";

      return [{
        type: "tetragrammaton",
        id: `${letterKey}-${elementId}`,
        label: `${letter} · ${elementName}`,
        data: {
          letter,
          elementId,
          elementName,
          hebrewLetterId
        },
        __key: `tetragrammaton|${letterKey}|${elementId}|${card.id || normalizeTarotCardLookupName(card.name)}`
      }];
    }

    function getSmallCardModality(rankNumber) {
      const numeric = Number(rankNumber);
      if (!Number.isFinite(numeric) || numeric < 2 || numeric > 10) {
        return "";
      }

      if (numeric <= 4) {
        return "cardinal";
      }
      if (numeric <= 7) {
        return "fixed";
      }
      return "mutable";
    }

    function buildSmallCardRulershipRelation(card) {
      if (!card || card.arcana !== "Minor") {
        return null;
      }

      const rankKey = String(card.rank || "").trim().toLowerCase();
      const rankNumber = MINOR_RANK_NUMBER_BY_NAME[rankKey];
      const modality = getSmallCardModality(rankNumber);
      if (!modality) {
        return null;
      }

      const suitKey = String(card.suit || "").trim().toLowerCase();
      const signId = SMALL_CARD_SIGN_BY_MODALITY_AND_SUIT[modality]?.[suitKey] || "";
      if (!signId) {
        return null;
      }

      const referenceData = typeof getReferenceData === "function" ? getReferenceData() : null;
      const sign = (Array.isArray(referenceData?.signs) ? referenceData.signs : [])
        .find((entry) => String(entry?.id || "").trim().toLowerCase() === signId);

      const signName = String(sign?.name || toTitleCase(signId));
      const signSymbol = String(sign?.symbol || "").trim();
      const modalityName = toTitleCase(modality);

      return {
        type: "zodiacRulership",
        id: `${signId}-${rankKey}-${suitKey}`,
        label: `Sign type: ${modalityName} · ${signSymbol} ${signName}`.trim(),
        data: {
          signId,
          signName,
          symbol: signSymbol,
          modality,
          rank: card.rank,
          suit: card.suit
        },
        __key: `zodiacRulership|${signId}|${rankKey}|${suitKey}`
      };
    }

    function findSephirahForMinorCard(card, kabTree) {
      if (!card || card.arcana !== "Minor" || !kabTree) {
        return null;
      }

      const rankKey = String(card.rank || "").trim().toLowerCase();
      const plural = MINOR_PLURAL_BY_RANK[rankKey];
      if (!plural) {
        return null;
      }

      const matcher = new RegExp(`\\b4\\s+${plural}\\b`, "i");
      return (kabTree.sephiroth || []).find((seph) => matcher.test(String(seph?.tarot || ""))) || null;
    }

    return {
      buildTypeLabel,
      buildElementRelationsForCard,
      buildTetragrammatonRelationsForCard,
      buildSmallCardRulershipRelation,
      findSephirahForMinorCard
    };
  }

  window.TarotCardDerivations = {
    createTarotCardDerivations
  };
})();