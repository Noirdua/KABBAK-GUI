(function () {
  "use strict";

  const { html, raw } = window.HtmlSafe;

  const PLANET_ID_TO_LABEL = {
    saturn: "Saturn",
    jupiter: "Jupiter",
    mars: "Mars",
    sol: "Sol",
    venus: "Venus",
    mercury: "Mercury",
    luna: "Luna"
  };

  const MINOR_RANK_BY_PLURAL = {
    aces: "Ace",
    twos: "Two",
    threes: "Three",
    fours: "Four",
    fives: "Five",
    sixes: "Six",
    sevens: "Seven",
    eights: "Eight",
    nines: "Nine",
    tens: "Ten"
  };

  const MINOR_SUITS = ["Wands", "Cups", "Swords", "Disks"];

  function hasTarotAccess() {
    return window.TarotAppConfig?.hasTarotAccess?.() === true;
  }

  const DEFAULT_FOUR_QABALISTIC_WORLD_LAYERS = [
    {
      slot: "Yod",
      letterChar: "י",
      hebrewToken: "yod",
      world: "Atziluth",
      worldLayer: "Archetypal World (God’s Will)",
      worldDescription: "World of gods or specific facets or divine qualities.",
      soulLayer: "Chiah",
      soulTitle: "Life Force",
      soulDescription: "The Chiah is the Life Force itself and our true identity as reflection of Supreme Consciousness."
    },
    {
      slot: "Heh",
      letterChar: "ה",
      hebrewToken: "he",
      world: "Briah",
      worldLayer: "Creative World (God’s Love)",
      worldDescription: "World of archangels, executors of divine qualities.",
      soulLayer: "Neshamah",
      soulTitle: "Soul-Intuition",
      soulDescription: "The Neshamah is the part of our soul that transcends the thinking process."
    },
    {
      slot: "Vav",
      letterChar: "ו",
      hebrewToken: "vav",
      world: "Yetzirah",
      worldLayer: "Formative World (God’s Mind)",
      worldDescription: "World of angels who work under archangelic direction.",
      soulLayer: "Ruach",
      soulTitle: "Intellect",
      soulDescription: "The Ruach is the thinking mind that often dominates attention and identity."
    },
    {
      slot: "Heh (final)",
      letterChar: "ה",
      hebrewToken: "he",
      world: "Assiah",
      worldLayer: "Material World (God’s Creation)",
      worldDescription: "World of spirits that infuse matter and energy through specialized duties.",
      soulLayer: "Nephesh",
      soulTitle: "Animal Soul",
      soulDescription: "The Nephesh is instinctive consciousness expressed through appetite, emotion, sex drive, and survival."
    }
  ];

  function metaCard(label, value, wide) {
    const card = document.createElement("div");
    card.className = wide ? "meta-card kab-wide-card" : "meta-card";

    const title = document.createElement("strong");
    title.textContent = label;
    card.appendChild(title);

    if (value instanceof Node) {
      card.appendChild(value);
    } else {
      const body = document.createElement("p");
      body.className = "body-text";
      body.textContent = value || "—";
      card.appendChild(body);
    }

    return card;
  }

  function appendInlineParts(target, parts) {
    (Array.isArray(parts) ? parts : []).forEach((part) => {
      if (part instanceof Node) {
        target.appendChild(part);
        return;
      }

      const text = String(part ?? "");
      if (text) {
        target.appendChild(document.createTextNode(text));
      }
    });
  }

  function createInlineEventLink(label, eventName, detail) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "detail-inline-link";
    btn.textContent = String(label || "—");
    btn.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    });
    return btn;
  }

  function inlineValue(parts) {
    const body = document.createElement("p");
    body.className = "body-text detail-inline-value";
    appendInlineParts(body, parts);
    return body;
  }

  function createNavButton(label, eventName, detail) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kab-god-link";
    btn.textContent = `${label} ↗`;
    btn.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent(eventName, { detail }));
    });
    return btn;
  }

  function buildPlanetLuminaryCard(planetValue, context) {
    const planetId = context.resolvePlanetId(planetValue);
    if (planetId) {
      return metaCard("Planet / Luminary", inlineValue([
        createInlineEventLink(PLANET_ID_TO_LABEL[planetId] || planetValue, "nav:planet", { planetId })
      ]));
    }

    const zodiacId = context.resolveZodiacId(planetValue);
    if (zodiacId) {
      return metaCard("Planet / Luminary", inlineValue([
        createInlineEventLink(zodiacId.charAt(0).toUpperCase() + zodiacId.slice(1), "nav:zodiac", { signId: zodiacId })
      ]));
    }

    return metaCard("Planet / Luminary", planetValue);
  }

  function extractMinorRank(attribution) {
    const match = String(attribution || "").match(/\bthe\s+4\s+(aces|twos|threes|fours|fives|sixes|sevens|eights|nines|tens)\b/i);
    if (!match) return null;
    return MINOR_RANK_BY_PLURAL[(match[1] || "").toLowerCase()] || null;
  }

  function buildMinorTarotNames(attribution) {
    const rank = extractMinorRank(attribution);
    if (!rank) return [];
    return MINOR_SUITS.map((suit) => `${rank} of ${suit}`);
  }

  function buildTarotAttributionCard(attribution) {
    if (!hasTarotAccess()) {
      return null;
    }

    const minorCards = buildMinorTarotNames(attribution);
    if (minorCards.length) {
      const parts = [];
      minorCards.forEach((cardName, index) => {
        if (index > 0) {
          parts.push(", ");
        }
        parts.push(createInlineEventLink(cardName, "nav:tarot-trump", { cardName }));
      });
      return metaCard("Tarot Attribution", inlineValue(parts));
    }

    return metaCard("Tarot Attribution", attribution);
  }

  function buildAstrologyCard(astrology, context) {
    if (astrology?.type === "planet") {
      const planetId = context.resolvePlanetId(astrology.name);
      if (planetId) {
        return metaCard("Astrology", inlineValue([
          createInlineEventLink(PLANET_ID_TO_LABEL[planetId] || astrology.name, "nav:planet", { planetId }),
          " (planet)"
        ]));
      }
    } else if (astrology?.type === "zodiac") {
      const signId = context.resolveZodiacId(astrology.name);
      if (signId) {
        return metaCard("Astrology", inlineValue([
          createInlineEventLink(signId.charAt(0).toUpperCase() + signId.slice(1), "nav:zodiac", { signId }),
          " (zodiac)"
        ]));
      }
    }

    return metaCard("Astrology", astrology ? `${astrology.name} (${astrology.type})` : "—");
  }

  function buildConnectsCard(path, fromName, toName) {
    return metaCard("Connects", inlineValue([
      createInlineEventLink(fromName, "nav:kabbalah-path", { pathNo: Number(path.connects.from) }),
      " → ",
      createInlineEventLink(toName, "nav:kabbalah-path", { pathNo: Number(path.connects.to) })
    ]));
  }

  function buildHebrewLetterCard(letter, context) {
    const hebrewLetterId = context.resolveHebrewLetterId(letter.transliteration || letter.char || "");
    const letterLabel = `${letter.char || ""} ${letter.transliteration || ""}`.replace(/\s+/g, " ").trim() || "Letter";
    const suffix = raw([
      letter.meaning ? ` — "${letter.meaning}"` : "",
      letter.letterType ? ` (${letter.letterType})` : ""
    ].join(""));

    if (hebrewLetterId) {
      return metaCard("Hebrew Letter", inlineValue([
        createInlineEventLink(letterLabel, "nav:alphabet", {
          alphabet: "hebrew",
          hebrewLetterId
        }),
        suffix
      ]));
    }

    return metaCard("Hebrew Letter", `${letterLabel}${suffix}`);
  }

  function buildFourWorldsCard(tree, activeHebrewToken, context) {
    const activeToken = String(activeHebrewToken || "").trim().toLowerCase();
    const worldLayers = Array.isArray(context.fourWorldLayers) && context.fourWorldLayers.length
      ? context.fourWorldLayers
      : DEFAULT_FOUR_QABALISTIC_WORLD_LAYERS;

    const card = document.createElement("div");
    card.className = "meta-card kab-wide-card";

    const title = document.createElement("strong");
    title.textContent = "Four Qabalistic Worlds & Soul Layers";
    card.appendChild(title);

    const stack = document.createElement("div");
    stack.className = "cal-item-stack";

    worldLayers.forEach((layer) => {
      const row = document.createElement("div");
      row.className = "cal-item-row";

      const isActive = Boolean(activeToken) && activeToken === String(layer.hebrewToken || "").trim().toLowerCase();

      const head = document.createElement("div");
      head.className = "cal-item-head";
      head.innerHTML = html`
        <span class="cal-item-name">${layer.slot}: ${layer.letterChar} — ${layer.world}</span>
        <span class="list-meta">${layer.soulLayer}</span>
      `;
      row.appendChild(head);

      const worldLine = document.createElement("div");
      worldLine.className = "body-text";
      worldLine.textContent = `${layer.worldLayer} · ${layer.worldDescription}`;
      row.appendChild(worldLine);

      const soulLine = document.createElement("div");
      soulLine.className = "body-text";
      soulLine.textContent = `${layer.soulLayer} — ${layer.soulTitle}: ${layer.soulDescription}`;
      row.appendChild(soulLine);

      const parts = [];
      const hebrewLetterId = context.resolveHebrewLetterId(layer.hebrewToken);
      if (hebrewLetterId) {
        parts.push(
          createInlineEventLink(layer.letterChar || layer.hebrewToken, "nav:alphabet", {
            alphabet: "hebrew",
            hebrewLetterId
          })
        );
      }

      const linkedPath = context.findPathByHebrewToken(tree, layer.hebrewToken);
      if (linkedPath?.pathNumber != null) {
        if (parts.length) {
          parts.push(" · ");
        }
        parts.push(
          createInlineEventLink(`Path ${linkedPath.pathNumber}`, "nav:kabbalah-path", { pathNo: Number(linkedPath.pathNumber) })
        );
      }

      if (parts.length) {
        row.appendChild(inlineValue(parts));
      }

      if (isActive) {
        row.style.borderColor = "#818cf8";
      }

      stack.appendChild(row);
    });

    card.appendChild(stack);
    return card;
  }

  function renderWorldLayerDetail(context) {
    const { worldLayer, tree, elements } = context;
    if (!worldLayer || !elements?.detailBodyEl) {
      return;
    }

    elements.detailNameEl.textContent = String(worldLayer.world || "Qabalistic World");
    elements.detailSubEl.textContent = [
      worldLayer.slot ? `${worldLayer.slot}: ${worldLayer.letterChar || ""}`.trim() : "",
      worldLayer.soulLayer
    ].filter(Boolean).join("  ·  ");

    elements.detailBodyEl.innerHTML = "";
    elements.detailBodyEl.appendChild(metaCard(
      "World Layer",
      `${worldLayer.worldLayer || "—"}${worldLayer.worldDescription ? ` · ${worldLayer.worldDescription}` : ""}`,
      true
    ));
    elements.detailBodyEl.appendChild(metaCard(
      "Soul Layer",
      `${worldLayer.soulLayer || "—"}${worldLayer.soulTitle ? ` — ${worldLayer.soulTitle}` : ""}${worldLayer.soulDescription ? `: ${worldLayer.soulDescription}` : ""}`,
      true
    ));

    const linkedParts = [];
    const hebrewLetterId = context.resolveHebrewLetterId(worldLayer.hebrewToken);
    if (hebrewLetterId) {
      linkedParts.push(createInlineEventLink(
        `${worldLayer.letterChar || ""} ${worldLayer.hebrewToken || ""}`.replace(/\s+/g, " ").trim(),
        "nav:alphabet",
        {
          alphabet: "hebrew",
          hebrewLetterId
        }
      ));
    }

    const linkedPath = context.findPathByHebrewToken(tree, worldLayer.hebrewToken);
    if (linkedPath?.pathNumber != null) {
      if (linkedParts.length) {
        linkedParts.push(" · ");
      }
      linkedParts.push(createInlineEventLink(
        `Path ${linkedPath.pathNumber}`,
        "nav:kabbalah-path",
        { pathNo: Number(linkedPath.pathNumber) }
      ));
    }

    if (linkedParts.length) {
      elements.detailBodyEl.appendChild(metaCard("Linked Attributions", inlineValue(linkedParts)));
    }

    elements.detailBodyEl.appendChild(buildFourWorldsCard(tree, worldLayer.hebrewToken, context));
  }

  function splitCorrespondenceNames(value) {
    return String(value || "")
      .split(/,|;|·|\/|\bor\b|\band\b|\+/i)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function uniqueNames(values) {
    const seen = new Set();
    const output = [];
    values.forEach((name) => {
      const key = String(name || "").toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      output.push(name);
    });
    return output;
  }

  function godLinksCard(label, names, pathNo, metaText) {
    const card = document.createElement("div");
    card.className = "meta-card";

    const title = document.createElement("strong");
    title.textContent = label;
    card.appendChild(title);

    if (metaText) {
      const meta = document.createElement("p");
      meta.className = "body-text kab-god-meta";
      meta.textContent = metaText;
      card.appendChild(meta);
    }

    const parts = [];
    names.forEach((name, index) => {
      if (index > 0) {
        parts.push(", ");
      }
      parts.push(createInlineEventLink(name, "nav:gods", {
        godName: name,
        pathNo: Number(pathNo)
      }));
    });

    card.appendChild(inlineValue(parts));
    return card;
  }

  function appendGodsCards(pathNo, elements, godsData) {
    const gd = godsData?.[String(pathNo)];
    if (!gd) return;

    const hasAny = gd.greek || gd.roman || gd.egyptian || gd.egyptianPractical
      || gd.elohim || gd.archangel || gd.angelicOrder;
    if (!hasAny) return;

    const sep = document.createElement("div");
    sep.className = "meta-card kab-wide-card";
    sep.innerHTML = `<strong style="color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:.05em">Divine Correspondences</strong>`;
    elements.detailBodyEl.appendChild(sep);

    const greekNames = uniqueNames(splitCorrespondenceNames(gd.greek));
    const romanNames = uniqueNames(splitCorrespondenceNames(gd.roman));
    const egyptNames = uniqueNames([
      ...splitCorrespondenceNames(gd.egyptianPractical),
      ...splitCorrespondenceNames(gd.egyptian)
    ]);

    if (greekNames.length) {
      elements.detailBodyEl.appendChild(godLinksCard("Greek", greekNames, pathNo));
    }
    if (romanNames.length) {
      elements.detailBodyEl.appendChild(godLinksCard("Roman", romanNames, pathNo));
    }
    if (egyptNames.length) {
      elements.detailBodyEl.appendChild(godLinksCard("Egyptian", egyptNames, pathNo));
    }

    if (gd.elohim) {
      const g = gd.elohim;
      const meta = `${g.hebrew}${g.meaning ? "  —  " + g.meaning : ""}`;
      elements.detailBodyEl.appendChild(godLinksCard(
        "God Name",
        uniqueNames(splitCorrespondenceNames(g.transliteration)),
        pathNo,
        meta
      ));
    }
    if (gd.archangel) {
      const a = gd.archangel;
      const meta = `${a.hebrew}`;
      elements.detailBodyEl.appendChild(godLinksCard(
        "Archangel",
        uniqueNames(splitCorrespondenceNames(a.transliteration)),
        pathNo,
        meta
      ));
    }
    if (gd.angelicOrder) {
      const o = gd.angelicOrder;
      elements.detailBodyEl.appendChild(metaCard(
        "Angelic Order",
        `${o.hebrew}  ${o.transliteration}${o.meaning ? "  —  " + o.meaning : ""}`
      ));
    }
  }

  function renderSephiraDetail(context) {
    const { seph, tree, elements } = context;
    const displayNumber = String(seph.displayNumber || seph.number || "").trim();
    elements.detailNameEl.textContent = displayNumber
      ? `${displayNumber} · ${seph.name}`
      : `${seph.name}`;
    elements.detailSubEl.textContent =
      [seph.nameHebrew, seph.translation, seph.planet].filter(Boolean).join("  ·  ");

    elements.detailBodyEl.innerHTML = "";
    elements.detailBodyEl.appendChild(buildPlanetLuminaryCard(seph.planet, context));
    elements.detailBodyEl.appendChild(metaCard("Intelligence", seph.intelligence));
    const tarotAttributionCard = buildTarotAttributionCard(seph.tarot);
    if (tarotAttributionCard) {
      elements.detailBodyEl.appendChild(tarotAttributionCard);
    }

    if (seph.description) {
      elements.detailBodyEl.appendChild(
        metaCard(seph.name, seph.description, true)
      );
    }

    const connected = tree.paths.filter(
      (entry) => entry.connects.from === seph.number || entry.connects.to === seph.number
    );
    if (connected.length) {
      const card = document.createElement("div");
      card.className = "meta-card kab-wide-card";
      const chips = raw(connected.map((entry) =>
        html`<span class="kab-chip" data-path="${entry.pathNumber}" role="button" tabindex="0" title="${hasTarotAccess() ? `Path ${entry.pathNumber}: ${entry.tarot?.card || ""}` : `Path ${entry.pathNumber}`}">`
        + html`${entry.hebrewLetter?.char || ""} <span class="kab-chip-sub">${entry.pathNumber}</span>`
        + `</span>`
      ).join(""));
      card.innerHTML = html`<strong>Connected Paths</strong><div class="kab-chips">${chips}</div>`;
      elements.detailBodyEl.appendChild(card);

      card.querySelectorAll(".kab-chip[data-path]").forEach((chip) => {
        const handler = () => {
          const path = tree.paths.find((entry) => entry.pathNumber === Number(chip.dataset.path));
          if (path && typeof context.onPathSelect === "function") {
            context.onPathSelect(path);
          }
        };
        chip.addEventListener("click", handler);
        chip.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handler();
          }
        });
      });
    }

    appendGodsCards(seph.number, elements, context.godsData);
  }

  function renderPathDetail(context) {
    const { path, tree, elements } = context;
    const letter = path.hebrewLetter || {};
    const fromName = tree.sephiroth.find((entry) => entry.number === path.connects.from)?.name || path.connects.from;
    const toName = tree.sephiroth.find((entry) => entry.number === path.connects.to)?.name || path.connects.to;
    const astro = path.astrology ? `${path.astrology.name} (${path.astrology.type})` : "—";
    const tarotAccessEnabled = hasTarotAccess();
    const tarotStr = tarotAccessEnabled && path.tarot?.card
      ? `${path.tarot.card}${path.tarot.trumpNumber != null ? "  · Trump " + path.tarot.trumpNumber : ""}`
      : "—";

    elements.detailNameEl.textContent =
      `Path ${path.pathNumber} · ${letter.char || ""} ${letter.transliteration || ""}`;
    elements.detailSubEl.textContent = [tarotAccessEnabled ? path.tarot?.card : "", astro].filter(Boolean).join("  ·  ");

    elements.detailBodyEl.innerHTML = "";
    elements.detailBodyEl.appendChild(buildConnectsCard(path, fromName, toName));
    elements.detailBodyEl.appendChild(buildHebrewLetterCard(letter, context));
    elements.detailBodyEl.appendChild(buildAstrologyCard(path.astrology, context));

    if (tarotAccessEnabled) {
      const tarotMetaCard = document.createElement("div");
      tarotMetaCard.className = "meta-card";
      const tarotLabel = document.createElement("strong");
      tarotLabel.textContent = "Tarot";
      tarotMetaCard.appendChild(tarotLabel);
      if (path.tarot?.card && path.tarot.trumpNumber != null) {
        const tarotBtn = createInlineEventLink(
          `${path.tarot.card}  ·  Trump ${path.tarot.trumpNumber}`,
          "kab:view-trump",
          { trumpNumber: path.tarot.trumpNumber }
        );
        tarotBtn.title = "Open in Tarot section";
        tarotMetaCard.appendChild(tarotBtn);
      } else {
        const tarotP = document.createElement("p");
        tarotP.className = "body-text";
        tarotP.textContent = tarotStr || "—";
        tarotMetaCard.appendChild(tarotP);
      }
      elements.detailBodyEl.appendChild(tarotMetaCard);
    }

    elements.detailBodyEl.appendChild(metaCard("Intelligence", path.intelligence));
    elements.detailBodyEl.appendChild(metaCard("Pillar", path.pillar));

    if (path.description) {
      const desc = document.createElement("div");
      desc.className = "meta-card kab-wide-card";
      desc.innerHTML =
        html`<strong>Path ${path.pathNumber} — Sefer Yetzirah</strong>`
        + html`<p class="body-text">${path.description.replace(/\n/g, "<br><br>")}</p>`;
      elements.detailBodyEl.appendChild(desc);
    }

    appendGodsCards(path.pathNumber, elements, context.godsData);
  }

  function renderRoseLandingIntro(roseElements) {
    if (!roseElements?.detailNameEl || !roseElements?.detailSubEl || !roseElements?.detailBodyEl) {
      return;
    }

    roseElements.detailNameEl.textContent = "Rosicrucian Cross";
    roseElements.detailSubEl.textContent = "Select a Hebrew letter petal to explore a Tree path";

    const introCard = document.createElement("div");
    introCard.className = "meta-card kab-wide-card";
    introCard.innerHTML = "<strong>Interactive Path Crosswalk</strong>"
      + "<p class=\"body-text\">Each petal maps to one of the 22 Hebrew letter paths (11-32). Click any large Hebrew letter to view astrology, tarot, and path intelligence details.</p>";

    roseElements.detailBodyEl.innerHTML = "";
    roseElements.detailBodyEl.appendChild(introCard);
  }

  window.KabbalahDetailUi = {
    renderWorldLayerDetail,
    renderSephiraDetail,
    renderPathDetail,
    renderRoseLandingIntro
  };
})();