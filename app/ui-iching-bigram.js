(function () {
  "use strict";

  const BIGRAMS = [
    {
      id: "elder-yang",
      name: "Elder Yang",
      chineseName: "老陽",
      pinyin: "Lǎo Yáng",
      binary: "11",
      element: "Heaven",
      attribute: "Creative Force",
      description: "Elder Yang (Old Yang) is the bigram of two solid lines, representing maximum yang energy. It is the father of trigrams, associated with Heaven (Qian) and the creative principle. In divination, it represents a line that is changing from yang to yin."
    },
    {
      id: "younger-yang",
      name: "Younger Yang",
      chineseName: "少陽",
      pinyin: "Shǎo Yáng",
      binary: "10",
      element: "Thunder / Lake",
      attribute: "Initiating Movement",
      description: "Younger Yang (Young Yang) has a solid line above a broken line, representing yang emerging from yin. It is associated with growth, new beginnings, and the movement toward light. This bigram underlies the trigrams Dui (Lake) and Zhen (Thunder)."
    },
    {
      id: "younger-yin",
      name: "Younger Yin",
      chineseName: "少陰",
      pinyin: "Shǎo Yīn",
      binary: "01",
      element: "Wind / Fire",
      attribute: "Gentle Adaptation",
      description: "Younger Yin (Young Yin) has a broken line above a solid line, representing yin descending upon yang. It is associated with subtle influence, refinement, and the cooling of intensity. This bigram underlies the trigrams Xun (Wind) and Li (Fire)."
    },
    {
      id: "elder-yin",
      name: "Elder Yin",
      chineseName: "老陰",
      pinyin: "Lǎo Yīn",
      binary: "00",
      element: "Earth",
      attribute: "Receptive Stillness",
      description: "Elder Yin (Old Yin) is the bigram of two broken lines, representing maximum yin energy. It is the mother of trigrams, associated with Earth (Kun) and the receptive principle. In divination, it represents a line that is changing from yin to yang."
    }
  ];

  function createLineDiagram(binary) {
    const container = document.createElement("div");
    container.className = "iching-lines iching-lines--bigram";
    for (const char of String(binary || "")) {
      const line = document.createElement("div");
      line.className = "iching-line";
      line.classList.toggle("is-yin", char === "0");
      container.appendChild(line);
    }
    return container;
  }

  let state = {
    initialized: false,
    selectedId: null
  };

  function renderList() {
    const listEl = document.getElementById("iching-bigram-list");
    if (!listEl) return;
    listEl.replaceChildren();

    BIGRAMS.forEach((bigram) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-item";
      btn.setAttribute("role", "option");
      if (bigram.id === state.selectedId) {
        btn.setAttribute("aria-selected", "true");
      }

      const nameEl = document.createElement("span");
      nameEl.className = "list-name";
      nameEl.textContent = bigram.name;

      const metaEl = document.createElement("span");
      metaEl.className = "list-meta";
      metaEl.textContent = `${bigram.element} · ${bigram.attribute}`;

      btn.append(nameEl, metaEl);
      btn.addEventListener("click", () => {
        state.selectedId = bigram.id;
        renderList();
        renderDetail(bigram);
      });
      listEl.appendChild(btn);
    });
  }

  function renderDetail(bigram) {
    const nameEl = document.getElementById("iching-bigram-detail-name");
    const typeEl = document.getElementById("iching-bigram-detail-type");
    const summaryEl = document.getElementById("iching-bigram-detail-summary");
    const descEl = document.getElementById("iching-bigram-detail-description");
    const binaryEl = document.getElementById("iching-bigram-detail-binary");
    const diagramEl = document.getElementById("iching-bigram-line-diagram");
    const attrEl = document.getElementById("iching-bigram-detail-attributes");

    if (nameEl) nameEl.textContent = bigram.name;
    if (typeEl) typeEl.textContent = `${bigram.chineseName} · ${bigram.pinyin}`;
    if (summaryEl) summaryEl.textContent = `${bigram.element} — ${bigram.attribute}`;
    if (descEl) descEl.textContent = bigram.description;
    if (binaryEl) binaryEl.textContent = `Binary: ${bigram.binary}`;
    if (diagramEl) {
      diagramEl.replaceChildren();
      diagramEl.appendChild(createLineDiagram(bigram.binary));
    }
    if (attrEl) attrEl.textContent = `Element: ${bigram.element}  •  Attribute: ${bigram.attribute}`;
  }

  function selectFirst() {
    if (!state.selectedId && BIGRAMS.length) {
      state.selectedId = BIGRAMS[0].id;
    }
    const bigram = BIGRAMS.find((b) => b.id === state.selectedId) || BIGRAMS[0];
    renderList();
    renderDetail(bigram);
  }

  function ensureIChingBigramSection() {
    if (state.initialized) {
      selectFirst();
      return;
    }
    state.initialized = true;
    selectFirst();
  }

  window.IChingBigramSectionUi = {
    ensureIChingBigramSection
  };
})();
