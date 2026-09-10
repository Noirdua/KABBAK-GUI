(function () {
  "use strict";

  // Token aliases so pane search matches linked concepts users actually type.
  const TOKEN_ALIASES = Object.freeze({
    kerubic: ["fixed", "kerubic", "modality", "quadruplicity", "sign type"],
    fixed: ["fixed", "kerubic", "modality", "quadruplicity", "sign type"],
    cardinal: ["cardinal", "modality", "quadruplicity", "sign type"],
    mutable: ["mutable", "modality", "quadruplicity", "sign type"],
    fire: ["fire", "element"],
    water: ["water", "element"],
    air: ["air", "element"],
    earth: ["earth", "element"],
    spirit: ["spirit", "element"]
  });

  const LINK_KEY_HINTS = Object.freeze({
    modality: ["modality", "sign type", "quadruplicity"],
    quadruplicity: ["modality", "sign type", "quadruplicity"],
    sourceQuadruplicity: ["modality", "sign type", "quadruplicity"],
    elementId: ["element"],
    element: ["element"],
    signId: ["sign", "zodiac"],
    signName: ["sign", "zodiac"],
    planetId: ["planet"],
    hebrewLetterId: ["hebrew", "letter", "alphabet"],
    cardName: ["tarot", "card"],
    monthId: ["calendar", "month"],
    pathNumber: ["kabbalah", "path"],
    sephirah: ["kabbalah", "sephirah"]
  });

  function normalizeSearchValue(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function tokenize(value) {
    return normalizeSearchValue(value)
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  function expandTokenAliases(token) {
    const key = String(token || "").trim().toLowerCase();
    if (!key) {
      return [];
    }
    const aliases = TOKEN_ALIASES[key];
    return aliases ? aliases.slice() : [key];
  }

  function pushUnique(out, value) {
    const text = String(value || "").trim();
    if (!text) {
      return;
    }
    out.push(text);
  }

  function relationToSearchParts(relation) {
    if (!relation) {
      return [];
    }

    if (typeof relation === "string" || typeof relation === "number" || typeof relation === "boolean") {
      return [String(relation)];
    }

    if (Array.isArray(relation)) {
      const nested = [];
      relation.forEach((entry) => {
        flattenSearchParts(entry, nested);
      });
      return nested;
    }

    if (typeof relation !== "object") {
      return [];
    }

    const parts = [];
    pushUnique(parts, relation.label);
    pushUnique(parts, relation.type);
    pushUnique(parts, relation.id);
    pushUnique(parts, relation.name);
    pushUnique(parts, relation.title);
    pushUnique(parts, relation.event);

    if (relation.data && typeof relation.data === "object" && !Array.isArray(relation.data)) {
      Object.entries(relation.data).forEach(([key, value]) => {
        pushUnique(parts, key);
        flattenSearchParts(value, parts);

        const hints = LINK_KEY_HINTS[key];
        if (hints) {
          hints.forEach((hint) => pushUnique(parts, hint));
        }

        if (key === "modality" || key === "quadruplicity" || key === "sourceQuadruplicity") {
          expandTokenAliases(value).forEach((alias) => pushUnique(parts, alias));
        }
      });
    } else if (relation.data != null) {
      flattenSearchParts(relation.data, parts);
    }

    // Generic object fields that often represent linked destinations.
    [
      "elementId",
      "element",
      "signId",
      "signName",
      "planetId",
      "modality",
      "quadruplicity",
      "hebrewLetterId",
      "cardName",
      "monthId",
      "pathNumber",
      "sephirah"
    ].forEach((key) => {
      if (relation[key] == null || relation[key] === "") {
        return;
      }
      pushUnique(parts, key);
      flattenSearchParts(relation[key], parts);
      const hints = LINK_KEY_HINTS[key];
      if (hints) {
        hints.forEach((hint) => pushUnique(parts, hint));
      }
      if (key === "modality" || key === "quadruplicity") {
        expandTokenAliases(relation[key]).forEach((alias) => pushUnique(parts, alias));
      }
    });

    return parts;
  }

  function flattenSearchParts(value, out = []) {
    if (value == null || value === false) {
      return out;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      pushUnique(out, value);
      return out;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        flattenSearchParts(entry, out);
      });
      return out;
    }

    if (typeof value === "object") {
      // Treat relation/link-shaped objects specially so nested data is indexed.
      if (
        "label" in value
        || "type" in value
        || "data" in value
        || "event" in value
        || "modality" in value
        || "elementId" in value
        || "signId" in value
      ) {
        relationToSearchParts(value).forEach((part) => pushUnique(out, part));
        return out;
      }

      Object.values(value).forEach((entry) => {
        flattenSearchParts(entry, out);
      });
    }

    return out;
  }

  function buildSearchText(...groups) {
    const flat = [];
    groups.forEach((group) => {
      flattenSearchParts(group, flat);
    });

    const base = normalizeSearchValue(flat.join(" "));
    if (!base) {
      return "";
    }

    const extras = [];
    tokenize(base).forEach((token) => {
      expandTokenAliases(token).forEach((alias) => {
        if (alias !== token) {
          extras.push(alias);
        }
      });
    });

    return normalizeSearchValue([base, ...extras].join(" "));
  }

  function matchesSearch(haystack, query) {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) {
      return true;
    }
    return normalizeSearchValue(haystack).includes(normalizedQuery);
  }

  function collectLinkSearchText(...linkGroups) {
    return buildSearchText(...linkGroups);
  }

  window.TarotSearchText = {
    normalizeSearchValue,
    expandTokenAliases,
    flattenSearchParts,
    relationToSearchParts,
    relationToSearchText(relation) {
      return buildSearchText(relationToSearchParts(relation));
    },
    buildSearchText,
    matchesSearch,
    collectLinkSearchText
  };
})();
