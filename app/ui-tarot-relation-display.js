(function () {
  function createTarotRelationDisplay(dependencies) {
    const { normalizeRelationId } = dependencies || {};

    function formatRelation(relation) {
      if (typeof relation === "string") {
        return relation;
      }

      if (!relation || typeof relation !== "object") {
        return "";
      }

      if (typeof relation.label === "string" && relation.label.trim()) {
        return relation.label;
      }

      if (relation.type === "hebrewLetter" && relation.data) {
        const glyph = relation.data.glyph || "";
        const name = relation.data.name || relation.id || "Unknown";
        const latin = relation.data.latin ? ` (${relation.data.latin})` : "";
        const index = Number.isFinite(relation.data.index) ? relation.data.index : "?";
        const value = Number.isFinite(relation.data.value) ? relation.data.value : "?";
        const meaning = relation.data.meaning ? ` · ${relation.data.meaning}` : "";
        return `Hebrew Letter: ${glyph} ${name}${latin} (index ${index}, value ${value})${meaning}`.trim();
      }

      if (typeof relation.type === "string" && typeof relation.id === "string") {
        return `${relation.type}: ${relation.id}`;
      }

      return "";
    }

    function relationKey(relation, index) {
      const safeType = String(relation?.type || "relation");
      const safeId = String(relation?.id || index || "0");
      const safeLabel = String(relation?.label || relation?.text || "");
      return `${safeType}|${safeId}|${safeLabel}`;
    }

    function normalizeRelationObject(relation, index) {
      if (relation && typeof relation === "object") {
        const label = formatRelation(relation);
        if (!label) {
          return null;
        }

        return {
          ...relation,
          label,
          __key: relationKey(relation, index)
        };
      }

      const text = formatRelation(relation);
      if (!text) {
        return null;
      }

      return {
        type: "text",
        id: `text-${index}`,
        label: text,
        data: { value: text },
        __key: relationKey({ type: "text", id: `text-${index}`, label: text }, index)
      };
    }

    function formatRelationDataLines(relation) {
      if (!relation || typeof relation !== "object") {
        return "--";
      }

      const data = relation.data;
      if (!data || typeof data !== "object") {
        return "(no additional relation data)";
      }

      const lines = Object.entries(data)
        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
        .map(([key, value]) => `${key}: ${value}`);

      return lines.length ? lines.join("\n") : "(no additional relation data)";
    }

    function getRelationNavTarget(relation) {
      const t = relation?.type;
      const d = relation?.data || {};
      if ((t === "planetCorrespondence" || t === "decanRuler") && d.planetId) {
        return {
          event: "nav:planet",
          detail: { planetId: d.planetId },
          label: `Open ${d.name || d.planetId} in Planets`
        };
      }
      if (t === "planet") {
        const planetId = normalizeRelationId(d.name || relation?.id || "");
        if (!planetId) return null;
        return {
          event: "nav:planet",
          detail: { planetId },
          label: `Open ${d.name || planetId} in Planets`
        };
      }
      if (t === "element") {
        const elementId = d.elementId || relation?.id;
        if (!elementId) {
          return null;
        }
        return {
          event: "nav:elements",
          detail: { elementId },
          label: `Open ${d.name || elementId} in Elements`
        };
      }
      if (t === "tetragrammaton") {
        if (!d.hebrewLetterId) {
          return null;
        }
        return {
          event: "nav:alphabet",
          detail: { alphabet: "hebrew", hebrewLetterId: d.hebrewLetterId },
          label: `Open ${d.letter || d.hebrewLetterId} in Alphabet`
        };
      }
      if (t === "tarotCard") {
        const cardName = d.cardName || relation?.id;
        if (!cardName) {
          return null;
        }
        return {
          event: "nav:tarot-trump",
          detail: { cardName },
          label: `Open ${cardName} in Tarot`
        };
      }
      if (t === "zodiacRulership") {
        const signId = d.signId || relation?.id;
        if (!signId) {
          return null;
        }
        return {
          event: "nav:zodiac",
          detail: { signId },
          label: `Open ${d.signName || signId} in Zodiac`
        };
      }
      if (t === "zodiacCorrespondence" || t === "zodiac") {
        const signId = d.signId || relation?.id || normalizeRelationId(d.name || "");
        if (!signId) {
          return null;
        }
        return {
          event: "nav:zodiac",
          detail: { signId },
          label: `Open ${d.name || signId} in Zodiac`
        };
      }
      if (t === "decan") {
        const signId = d.signId || normalizeRelationId(d.signName || relation?.id || "");
        if (!signId) {
          return null;
        }
        return {
          event: "nav:zodiac",
          detail: { signId },
          label: `Open ${d.signName || signId} in Zodiac`
        };
      }
      if (t === "hebrewLetter") {
        const hebrewLetterId = d.id || relation?.id;
        if (!hebrewLetterId) {
          return null;
        }
        return {
          event: "nav:alphabet",
          detail: { alphabet: "hebrew", hebrewLetterId },
          label: `Open ${d.name || hebrewLetterId} in Alphabet`
        };
      }
      if (t === "calendarMonth") {
        const monthId = d.monthId || relation?.id;
        if (!monthId) {
          return null;
        }
        return {
          event: "nav:calendar-month",
          detail: { monthId },
          label: `Open ${d.name || monthId} in Calendar`
        };
      }
      if (t === "ichingHexagram") {
        const hexagramNumber = Number(d.hexagramNumber || relation?.id);
        if (!Number.isFinite(hexagramNumber)) {
          return null;
        }
        return {
          event: "nav:iching",
          detail: { hexagramNumber },
          label: `Open Hexagram ${hexagramNumber} in I Ching`
        };
      }
      if (t === "cubeFace") {
        const wallId = d.wallId || relation?.id;
        if (!wallId) {
          return null;
        }
        return {
          event: "nav:cube",
          detail: { wallId, edgeId: "" },
          label: `Open ${d.wallName || wallId} face in Cube`
        };
      }
      if (t === "cubeEdge") {
        const edgeId = d.edgeId || relation?.id;
        if (!edgeId) {
          return null;
        }
        return {
          event: "nav:cube",
          detail: { edgeId, wallId: d.wallId || undefined },
          label: `Open ${d.edgeName || edgeId} edge in Cube`
        };
      }
      if (t === "cubeConnector") {
        const connectorId = d.connectorId || relation?.id;
        if (!connectorId) {
          return null;
        }
        return {
          event: "nav:cube",
          detail: { connectorId },
          label: `Open ${d.connectorName || connectorId} connector in Cube`
        };
      }
      if (t === "cubeCenter") {
        return {
          event: "nav:cube",
          detail: { nodeType: "center", primalPoint: true },
          label: "Open Primal Point in Cube"
        };
      }
      return null;
    }

    function createRelationListItem(relation) {
      const item = document.createElement("li");
      const navTarget = getRelationNavTarget(relation);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "tarot-relation-btn";
      button.dataset.relationKey = relation.__key;
      button.textContent = relation.label;
      item.appendChild(button);

      if (!navTarget) {
        button.classList.add("tarot-relation-btn-static");
      }
      button.addEventListener("click", () => {
        if (navTarget) {
          document.dispatchEvent(new CustomEvent(navTarget.event, { detail: navTarget.detail }));
        }
      });

      if (navTarget) {
        item.className = "tarot-rel-item";
        const navBtn = document.createElement("button");
        navBtn.type = "button";
        navBtn.className = "tarot-rel-nav-btn";
        navBtn.title = navTarget.label;
        navBtn.textContent = "\u2197";
        navBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          document.dispatchEvent(new CustomEvent(navTarget.event, { detail: navTarget.detail }));
        });
        item.appendChild(navBtn);
      }

      return item;
    }

    return {
      formatRelation,
      relationKey,
      normalizeRelationObject,
      formatRelationDataLines,
      getRelationNavTarget,
      createRelationListItem
    };
  }

  window.TarotRelationDisplay = {
    createTarotRelationDisplay
  };
})();