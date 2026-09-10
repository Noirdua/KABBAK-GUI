(function () {
  "use strict";

  let state = {
    initialized: false,
    trigrams: [],
    selectedName: null
  };

  function createLineDiagram(binary) {
    const container = document.createElement("div");
    container.className = "iching-lines";
    if (!binary) {
      container.textContent = "--";
      return container;
    }
    for (const char of String(binary)) {
      const line = document.createElement("div");
      line.className = "iching-line";
      line.classList.toggle("is-yin", char === "0");
      container.appendChild(line);
    }
    return container;
  }

  function renderList() {
    const listEl = document.getElementById("iching-trigram-list");
    if (!listEl) return;
    listEl.replaceChildren();

    state.trigrams.forEach((trigram) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-item";
      btn.setAttribute("role", "option");
      if (trigram.name === state.selectedName) {
        btn.setAttribute("aria-selected", "true");
      }

      const nameEl = document.createElement("span");
      nameEl.className = "list-name";
      nameEl.textContent = trigram.name;

      const metaEl = document.createElement("span");
      metaEl.className = "list-meta";
      metaEl.textContent = `${trigram.element} · ${trigram.attribute}`;

      btn.append(nameEl, metaEl);
      btn.addEventListener("click", () => {
        state.selectedName = trigram.name;
        renderList();
        renderDetail(trigram);
      });
      listEl.appendChild(btn);
    });
  }

  function renderDetail(trigram) {
    const nameEl = document.getElementById("iching-trigram-detail-name");
    const typeEl = document.getElementById("iching-trigram-detail-type");
    const summaryEl = document.getElementById("iching-trigram-detail-summary");
    const descEl = document.getElementById("iching-trigram-detail-description");
    const binaryEl = document.getElementById("iching-trigram-detail-binary");
    const diagramEl = document.getElementById("iching-trigram-line-diagram");
    const attrEl = document.getElementById("iching-trigram-detail-attributes");

    if (nameEl) nameEl.textContent = trigram.name;
    if (typeEl) typeEl.textContent = `${trigram.chineseName || ""} · ${trigram.pinyin || ""}`;
    if (summaryEl) summaryEl.textContent = `${trigram.element || ""} — ${trigram.attribute || ""}`;
    if (descEl) descEl.textContent = trigram.description || "";
    if (binaryEl) binaryEl.textContent = trigram.binary ? `Binary: ${trigram.binary}` : "";
    if (diagramEl) {
      diagramEl.replaceChildren();
      diagramEl.appendChild(createLineDiagram(trigram.binary));
    }
    if (attrEl) attrEl.textContent = `Element: ${trigram.element || "--"}  •  Attribute: ${trigram.attribute || "--"}`;
  }

  function selectFirst() {
    if (!state.selectedName && state.trigrams.length) {
      state.selectedName = state.trigrams[0].name;
    }
    const trigram = state.trigrams.find((t) => t.name === state.selectedName) || state.trigrams[0];
    if (trigram) {
      renderList();
      renderDetail(trigram);
    }
  }

  function ensureIChingTrigramSection(referenceData) {
    if (state.initialized) {
      selectFirst();
      return;
    }

    const ichingData = referenceData?.iChing || referenceData?.iching || {};
    const rawTrigrams = Array.isArray(ichingData.trigrams) ? ichingData.trigrams : [];
    state.trigrams = rawTrigrams.filter((t) => !t?.special);
    state.initialized = true;
    selectFirst();

    const countEl = document.getElementById("iching-trigram-count");
    if (countEl) countEl.textContent = String(state.trigrams.length);
  }

  window.IChingTrigramSectionUi = {
    ensureIChingTrigramSection
  };
})();
