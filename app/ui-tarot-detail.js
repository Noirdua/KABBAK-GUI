(function () {
  const { html } = window.HtmlSafe;

  function createTarotDetailRenderer(dependencies) {
    const {
      getMonthRefsByCardId,
      getMagickDataset,
      resolveTarotCardImage,
      resolveTarotCardThumbnail,
      getDeckVariantsForCard,
      getCardVariantsForCard,
      openDeckVariantLightbox,
      openCardVariantLightbox,
      getDisplayCardName,
      buildTypeLabel,
      clearChildren,
      normalizeRelationObject,
      buildElementRelationsForCard,
      buildTetragrammatonRelationsForCard,
      buildSmallCardRulershipRelation,
      buildSmallCardCourtLinkRelations,
      buildCubeRelationsForCard,
      buildIChingRelationsForCard,
      parseMonthDayToken,
      createRelationListItem,
      findSephirahForMinorCard
    } = dependencies || {};

    let activeVariantCardId = "";
    let activeVariantIndex = 0;

    function buildDecanRelationKey(signId, decanIndex) {
      const normalizedSignId = String(signId || "").trim().toLowerCase();
      const normalizedIndex = Number(decanIndex);
      if (!normalizedSignId || !Number.isFinite(normalizedIndex)) {
        return "";
      }

      return `${normalizedSignId}-${normalizedIndex}`;
    }

    function buildSignRelationKey(signId) {
      return String(signId || "").trim().toLowerCase();
    }

    function formatPaddedDegreeRange(startDegree, endDegree) {
      const start = Number(startDegree);
      const end = Number(endDegree);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return "";
      }

      const normalizedStart = Math.trunc(start);
      const normalizedEnd = Math.trunc(end) - (Math.trunc(end) - Math.trunc(start) === 10 ? 1 : 0);

      return `(${String(normalizedStart).padStart(2, "0")}°-${String(normalizedEnd).padStart(2, "0")}°)`;
    }

    function buildDecanSummaryRelations(relations) {
      const decanRelations = (relations || []).filter((relation) => relation?.type === "decan");
      const signWindowRelations = (relations || []).filter((relation) => relation?.type === "signWindow");
      if (!decanRelations.length && !signWindowRelations.length) {
        return [];
      }

      function normalizeInlineDateRange(value) {
        return String(value || "")
          .replace(/[–—]/g, " - ")
          .replace(/\s*-\s*/g, " - ")
          .replace(/\s+/g, " ")
          .trim();
      }

      const rulerByDecanKey = new Map();
      const cardByDecanKey = new Map();
      const cardsBySignKey = new Map();

      (relations || []).forEach((relation) => {
        if (relation?.type === "decanRuler") {
          const key = buildDecanRelationKey(relation?.data?.signId, relation?.data?.decanIndex);
          if (key && !rulerByDecanKey.has(key)) {
            rulerByDecanKey.set(key, relation);
          }
        }

        if (relation?.type === "tarotCard") {
          const decanKey = buildDecanRelationKey(relation?.data?.signId, relation?.data?.decanIndex);
          if (decanKey && !cardByDecanKey.has(decanKey)) {
            cardByDecanKey.set(decanKey, relation);
            return;
          }

          const signKey = buildSignRelationKey(relation?.data?.signId);
          if (!signKey) {
            return;
          }

          const entries = cardsBySignKey.get(signKey) || [];
          entries.push(relation);
          cardsBySignKey.set(signKey, entries);
        }
      });

      const decanSummaries = decanRelations.map((relation) => {
        const signId = relation?.data?.signId;
        const signName = String(relation?.data?.signName || "").trim();
        const signSymbol = String(relation?.data?.signSymbol || relation?.data?.symbol || "").trim();
        const decanIndex = Number(relation?.data?.index);
        const startDegree = Number(relation?.data?.startDegree);
        const endDegree = Number(relation?.data?.endDegree);
        const dateRange = String(relation?.data?.dateRange || "").trim();
        const decanKey = buildDecanRelationKey(signId, decanIndex);
        const rulerRelation = rulerByDecanKey.get(decanKey) || null;
        const cardRelation = cardByDecanKey.get(decanKey) || null;
        const rulerSymbol = String(rulerRelation?.data?.symbol || "").trim();
        const rulerName = String(rulerRelation?.data?.name || "").trim();
        const rulerLabel = `${rulerSymbol} ${rulerName}`.replace(/\s+/g, " ").trim();
        const decanCardName = String(cardRelation?.data?.cardName || "").trim();
        const decanCardLabel = decanCardName
          ? String(getDisplayCardName?.(decanCardName) || decanCardName).trim()
          : "";
        const signLabel = `${signSymbol} ${signName}`.replace(/\s+/g, " ").trim();
        const degreeLabel = formatPaddedDegreeRange(startDegree, endDegree);
        const dateLabel = normalizeInlineDateRange(dateRange);
        const summaryParts = [
          rulerLabel,
          decanCardLabel,
          [signLabel, degreeLabel].filter(Boolean).join(" ").trim(),
          dateLabel
        ].filter(Boolean);

        return {
          type: decanCardName ? "tarotCard" : "decan",
          id: cardRelation?.id || `${decanKey}-summary`,
          label: summaryParts.join(": "),
          data: {
            ...(cardRelation?.data || relation?.data || {}),
            signId,
            signName,
            signSymbol,
            decanIndex,
            dateRange,
            cardName: decanCardName || cardRelation?.data?.cardName || ""
          },
          __key: `decanSummary|${decanKey}|${cardRelation?.data?.cardName || ""}`
        };
      });

      const signSummaries = signWindowRelations.map((relation) => {
        const signId = relation?.data?.signId;
        const signKey = buildSignRelationKey(signId);
        const signName = String(relation?.data?.signName || "").trim();
        const signSymbol = String(relation?.data?.signSymbol || relation?.data?.symbol || "").trim();
        const startDegree = Number(relation?.data?.startDegree);
        const endDegree = Number(relation?.data?.endDegree);
        const dateRange = String(relation?.data?.dateRange || "").trim();
        const cardLabels = [...new Set((cardsBySignKey.get(signKey) || [])
          .map((entry) => String(getDisplayCardName?.(entry?.data?.cardName) || entry?.data?.cardName || "").trim())
          .filter(Boolean))];
        const signLabel = `${signSymbol} ${signName}`.replace(/\s+/g, " ").trim();
        const degreeLabel = formatPaddedDegreeRange(startDegree, endDegree);
        const dateLabel = normalizeInlineDateRange(dateRange);
        const summaryParts = [
          cardLabels.join(", "),
          [signLabel, degreeLabel].filter(Boolean).join(" ").trim(),
          dateLabel
        ].filter(Boolean);

        return {
          type: "signWindow",
          id: relation?.id || `${signKey}-summary`,
          label: summaryParts.join(": "),
          data: {
            ...(relation?.data || {}),
            signId,
            signName,
            signSymbol,
            cardNames: cardLabels
          },
          __key: `signSummary|${signKey}`
        };
      });

      return [...decanSummaries, ...signSummaries];
    }

    function renderStaticRelationGroup(targetEl, cardEl, relations) {
      clearChildren(targetEl);
      if (!targetEl || !cardEl) return;
      if (!relations.length) {
        cardEl.hidden = true;
        return;
      }

      cardEl.hidden = false;

      relations.forEach((relation) => {
        targetEl.appendChild(createRelationListItem(relation));
      });
    }

    function createInlineButton(label, eventName, detail) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "detail-inline-link";
      button.textContent = String(label || "—");
      button.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
      });
      return button;
    }

    function createInlineValue(parts) {
      const inline = document.createElement("div");
      inline.className = "body-text detail-inline-value";

      (Array.isArray(parts) ? parts : []).forEach((part) => {
        if (part instanceof Node) {
          inline.appendChild(part);
          return;
        }

        const text = String(part || "");
        if (text) {
          inline.appendChild(document.createTextNode(text));
        }
      });

      return inline;
    }

    function resolvePlanetId(value) {
      const token = String(value || "").trim().toLowerCase();
      if (!token) {
        return "";
      }

      if (token === "sun") return "sol";
      if (token === "moon") return "luna";
      return token;
    }

    function collectDetailRelations(card) {
      const allRelations = (card.relations || [])
        .map((relation, index) => normalizeRelationObject(relation, index))
        .filter(Boolean);

      const uniqueByKey = new Set();
      const dedupedRelations = allRelations.filter((relation) => {
        const key = `${relation.type || "relation"}|${relation.id || ""}|${relation.label || ""}`;
        if (uniqueByKey.has(key)) return false;
        uniqueByKey.add(key);
        return true;
      });

      const decanSummaryRelations = buildDecanSummaryRelations(dedupedRelations);
      const hasDecanSummaryRelations = decanSummaryRelations.length > 0;
      const hasSignWindowRelations = decanSummaryRelations.some((relation) => relation?.type === "signWindow");

      const planetRelations = dedupedRelations.filter((relation) =>
        relation.type === "planetCorrespondence"
          || relation.type === "planet"
          || (!hasDecanSummaryRelations && relation.type === "decanRuler")
      );

      const zodiacRelations = dedupedRelations.filter((relation) =>
        relation.type === "zodiacCorrespondence"
          || relation.type === "zodiac"
          || (!hasDecanSummaryRelations && relation.type === "decan")
      );

      const courtDateRelations = dedupedRelations.filter((relation) => relation.type === "courtDateWindow");

      const hebrewRelations = dedupedRelations.filter((relation) => relation.type === "hebrewLetter");
      const baseElementRelations = dedupedRelations.filter((relation) => relation.type === "element");
      const elementRelations = buildElementRelationsForCard(card, baseElementRelations);
      const tetragrammatonRelations = buildTetragrammatonRelationsForCard(card);
      const smallCardRulershipRelation = buildSmallCardRulershipRelation(card);
      const zodiacRelationsWithRulership = hasDecanSummaryRelations
        ? [...decanSummaryRelations, ...(smallCardRulershipRelation ? [smallCardRulershipRelation] : [])]
        : [...zodiacRelations, ...(smallCardRulershipRelation ? [smallCardRulershipRelation] : [])];
      const smallCardCourtLinkRelations = buildSmallCardCourtLinkRelations(card, dedupedRelations);
      const mergedCourtDateRelations = [...courtDateRelations, ...smallCardCourtLinkRelations];
      const cubeRelations = buildCubeRelationsForCard(card);
      const iChingRelations = buildIChingRelationsForCard(card);
      const monthRelations = (getMonthRefsByCardId().get(card.id) || []).map((month, index) => {
        const dateRange = String(month?.dateRange || "").trim();
        const context = String(month?.context || "").trim();
        const labelBase = dateRange || month.name;
        const label = context ? `${labelBase} · ${context}` : labelBase;

        return {
          type: "calendarMonth",
          id: month.id,
          label,
          data: {
            monthId: month.id,
            name: month.name,
            monthOrder: Number.isFinite(Number(month.order)) ? Number(month.order) : null,
            dateRange: dateRange || null,
            dateStart: month.startToken || null,
            dateEnd: month.endToken || null,
            context: context || null,
            source: month.source || null
          },
          __key: `calendarMonth|${month.id}|${month.uniqueKey || index}`
        };
      });

      const relationMonthRows = dedupedRelations
        .filter((relation) => relation.type === "calendarMonth")
        .map((relation) => {
          const dateRange = String(relation?.data?.dateRange || "").trim();
          const baseName = relation?.data?.name || relation.label;
          const label = dateRange && baseName
            ? `${baseName} · ${dateRange}`
            : baseName;

          return {
            type: "calendarMonth",
            id: relation?.data?.monthId || relation.id,
            label,
            data: {
              monthId: relation?.data?.monthId || relation.id,
              name: relation?.data?.name || relation.label,
              monthOrder: Number.isFinite(Number(relation?.data?.monthOrder))
                ? Number(relation.data.monthOrder)
                : null,
              dateRange: dateRange || null,
              dateStart: relation?.data?.dateStart || null,
              dateEnd: relation?.data?.dateEnd || null,
              context: relation?.data?.signName || null
            },
            __key: relation.__key
          };
        })
        .filter((entry) => entry.data.monthId);

      const mergedMonthMap = new Map();
      [...monthRelations, ...relationMonthRows].forEach((entry) => {
        const monthId = entry?.data?.monthId;
        if (!monthId) {
          return;
        }

        const key = [
          monthId,
          String(entry?.data?.dateRange || "").trim().toLowerCase(),
          String(entry?.data?.context || "").trim().toLowerCase(),
          String(entry?.label || "").trim().toLowerCase()
        ].join("|");

        if (!mergedMonthMap.has(key)) {
          mergedMonthMap.set(key, entry);
        }
      });

      const mergedMonthRelations = [...mergedMonthMap.values()].sort((left, right) => {
        const orderLeft = Number.isFinite(Number(left?.data?.monthOrder)) ? Number(left.data.monthOrder) : 999;
        const orderRight = Number.isFinite(Number(right?.data?.monthOrder)) ? Number(right.data.monthOrder) : 999;

        if (orderLeft !== orderRight) {
          return orderLeft - orderRight;
        }

        const startLeft = parseMonthDayToken(left?.data?.dateStart);
        const startRight = parseMonthDayToken(right?.data?.dateStart);
        const dayLeft = startLeft ? startLeft.day : 999;
        const dayRight = startRight ? startRight.day : 999;
        if (dayLeft !== dayRight) {
          return dayLeft - dayRight;
        }

        return String(left.label || "").localeCompare(String(right.label || ""));
      });

      return {
        planetRelations,
        elementRelations,
        tetragrammatonRelations,
        zodiacRelationsWithRulership,
        hasDecanSummaryRelations,
        hasSignWindowRelations,
        mergedCourtDateRelations,
        hebrewRelations,
        cubeRelations,
        iChingRelations,
        mergedMonthRelations
      };
    }

    function buildCompareDetails(card) {
      if (!card) {
        return [];
      }

      const detailRelations = collectDetailRelations(card);
      const groups = [
        { title: "Letter", relations: detailRelations.hebrewRelations },
        { title: "Planet / Ruler", relations: detailRelations.planetRelations },
        {
          title: detailRelations.hasSignWindowRelations ? "Signs" : (detailRelations.hasDecanSummaryRelations ? "Decans" : "Sign / Decan"),
          relations: detailRelations.zodiacRelationsWithRulership
        },
        { title: "Element", relations: detailRelations.elementRelations },
        { title: "Tetragrammaton", relations: detailRelations.tetragrammatonRelations },
        { title: "Dates", relations: detailRelations.mergedCourtDateRelations },
        { title: "Calendar", relations: detailRelations.mergedMonthRelations }
      ];

      return groups
        .map((group) => ({
          title: group.title,
          items: [...new Set((group.relations || []).map((relation) => String(relation?.label || "").trim()).filter(Boolean))]
        }))
        .filter((group) => group.items.length);
    }

    function buildVariantSwitcher(card, cardVariants, cardDisplayName) {
      const switcherEl = document.createElement("div");
      switcherEl.className = "tarot-variant-switcher";

      const prevButton = document.createElement("button");
      prevButton.type = "button";
      prevButton.className = "tarot-variant-switcher-arrow";
      prevButton.textContent = "‹";
      prevButton.setAttribute("aria-label", "Previous variant");

      const imageWrapEl = document.createElement("button");
      imageWrapEl.type = "button";
      imageWrapEl.className = "tarot-variant-switcher-image";
      imageWrapEl.title = "Click to enlarge";

      const imageEl = document.createElement("img");
      imageEl.className = "tarot-variant-switcher-img";
      imageEl.loading = "lazy";
      imageEl.decoding = "async";
      imageWrapEl.appendChild(imageEl);

      const nextButton = document.createElement("button");
      nextButton.type = "button";
      nextButton.className = "tarot-variant-switcher-arrow";
      nextButton.textContent = "›";
      nextButton.setAttribute("aria-label", "Next variant");

      const counterEl = document.createElement("span");
      counterEl.className = "tarot-variant-switcher-counter";

      function sync() {
        if (activeVariantIndex >= cardVariants.length) {
          activeVariantIndex = 0;
        }
        const activeVariant = cardVariants[activeVariantIndex] || cardVariants[0];
        imageEl.src = String(activeVariant?.src || "").trim();
        imageEl.alt = `${cardDisplayName || card?.name || "Tarot card"} — variant ${activeVariantIndex + 1}`;
        counterEl.textContent = `${activeVariantIndex + 1} / ${cardVariants.length}`;
      }

      prevButton.addEventListener("click", () => {
        activeVariantIndex = (activeVariantIndex - 1 + cardVariants.length) % cardVariants.length;
        sync();
      });

      nextButton.addEventListener("click", () => {
        activeVariantIndex = (activeVariantIndex + 1) % cardVariants.length;
        sync();
      });

      imageWrapEl.addEventListener("click", () => {
        const activeVariant = cardVariants[activeVariantIndex];
        if (typeof openCardVariantLightbox === "function" && activeVariant?.assetPath) {
          openCardVariantLightbox(card?.id, activeVariant.assetPath);
        }
      });

      sync();
      switcherEl.append(prevButton, imageWrapEl, nextButton, counterEl);
      return switcherEl;
    }

    function renderDeckVariants(card, elements, cardDisplayName) {
      const galleryCardEl = elements?.tarotMetaDeckGalleryCardEl;
      const galleryEl = elements?.tarotDetailDeckGalleryEl;
      if (!galleryCardEl || !galleryEl) {
        return;
      }

      clearChildren(galleryEl);
      const variants = typeof getDeckVariantsForCard === "function"
        ? getDeckVariantsForCard(card)
        : [];

      const cardVariants = typeof getCardVariantsForCard === "function"
        ? getCardVariantsForCard(card)
        : [];

      const cardId = String(card?.id || "");
      if (activeVariantCardId !== cardId) {
        activeVariantCardId = cardId;
        activeVariantIndex = 0;
      }

      if (cardVariants.length > 1) {
        galleryEl.appendChild(buildVariantSwitcher(card, cardVariants, cardDisplayName));
      }

      variants.forEach((variant) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `tarot-deck-variant${variant?.isActive ? " is-active" : ""}`;
        button.dataset.deckId = String(variant?.deckId || "").trim().toLowerCase();

        const imageEl = document.createElement("img");
        imageEl.className = "tarot-deck-variant-image";
        imageEl.src = String(variant?.src || "").trim();
        imageEl.alt = `${String(variant?.label || "Deck").trim()} — ${cardDisplayName || card?.name || "Tarot card"}`;
        imageEl.loading = "lazy";
        imageEl.decoding = "async";

        const labelEl = document.createElement("span");
        labelEl.className = "tarot-deck-variant-label";

        const deckNameEl = document.createElement("span");
        deckNameEl.className = "tarot-deck-variant-deck";
        deckNameEl.textContent = String(variant?.label || variant?.deckId || "Deck").trim() || "Deck";
        labelEl.appendChild(deckNameEl);

        const variantName = String(variant?.displayName || "").trim();
        if (variantName && variantName !== (cardDisplayName || card?.name || "")) {
          const variantNameEl = document.createElement("span");
          variantNameEl.className = "tarot-deck-variant-name";
          variantNameEl.textContent = variantName;
          labelEl.appendChild(variantNameEl);
        }

        button.append(imageEl, labelEl);

        if (typeof openDeckVariantLightbox === "function" && button.dataset.deckId) {
          button.addEventListener("click", () => {
            openDeckVariantLightbox(card?.id, button.dataset.deckId);
          });
        }

        galleryEl.appendChild(button);
      });

      galleryCardEl.hidden = galleryEl.children.length < 1;
    }

    function renderDetail(card, elements) {
      if (!card || !elements) {
        return;
      }

      const cardDisplayName = getDisplayCardName(card);
      const imageUrl = typeof resolveTarotCardThumbnail === "function"
        ? resolveTarotCardThumbnail(card.name)
        : (typeof resolveTarotCardImage === "function" ? resolveTarotCardImage(card.name) : null);

      if (elements.tarotDetailImageEl) {
        if (imageUrl) {
          elements.tarotDetailImageEl.src = imageUrl;
          elements.tarotDetailImageEl.alt = cardDisplayName || card.name;
          elements.tarotDetailImageEl.style.display = "block";
          elements.tarotDetailImageEl.style.cursor = "zoom-in";
          elements.tarotDetailImageEl.title = "Click to enlarge";
          elements.tarotDetailImageEl.decoding = "async";
        } else {
          elements.tarotDetailImageEl.removeAttribute("src");
          elements.tarotDetailImageEl.alt = "";
          elements.tarotDetailImageEl.style.display = "none";
          elements.tarotDetailImageEl.style.cursor = "default";
          elements.tarotDetailImageEl.removeAttribute("title");
        }
      }

      if (elements.tarotDetailNameEl) {
        elements.tarotDetailNameEl.textContent = cardDisplayName || card.name;
      }

      if (elements.tarotDetailTypeEl) {
        elements.tarotDetailTypeEl.textContent = buildTypeLabel(card);
      }

      if (elements.tarotDetailSummaryEl) {
        elements.tarotDetailSummaryEl.textContent = card.summary || "--";
      }

      if (elements.tarotDetailUprightEl) {
        elements.tarotDetailUprightEl.textContent = card.meanings?.upright || "--";
      }

      if (elements.tarotDetailReversedEl) {
        elements.tarotDetailReversedEl.textContent = card.meanings?.reversed || "--";
      }

      renderDeckVariants(card, elements, cardDisplayName || card.name);

      const meaningText = String(card.meaning || card.meanings?.upright || "").trim();
      if (elements.tarotMetaMeaningCardEl && elements.tarotDetailMeaningEl) {
        if (meaningText) {
          elements.tarotMetaMeaningCardEl.hidden = false;
          elements.tarotDetailMeaningEl.textContent = meaningText;
        } else {
          elements.tarotMetaMeaningCardEl.hidden = true;
          elements.tarotDetailMeaningEl.textContent = "--";
        }
      }

      clearChildren(elements.tarotDetailKeywordsEl);
      (card.keywords || []).forEach((keyword) => {
        const chip = document.createElement("span");
        chip.className = "tarot-keyword-chip";
        chip.textContent = keyword;
        elements.tarotDetailKeywordsEl?.appendChild(chip);
      });

      const detailRelations = collectDetailRelations(card);

      renderStaticRelationGroup(elements.tarotDetailPlanetEl, elements.tarotMetaPlanetCardEl, detailRelations.planetRelations);
      renderStaticRelationGroup(elements.tarotDetailElementEl, elements.tarotMetaElementCardEl, detailRelations.elementRelations);
      renderStaticRelationGroup(elements.tarotDetailTetragrammatonEl, elements.tarotMetaTetragrammatonCardEl, detailRelations.tetragrammatonRelations);
      renderStaticRelationGroup(elements.tarotDetailZodiacEl, elements.tarotMetaZodiacCardEl, detailRelations.zodiacRelationsWithRulership);
      renderStaticRelationGroup(elements.tarotDetailCourtDateEl, elements.tarotMetaCourtDateCardEl, detailRelations.mergedCourtDateRelations);
      renderStaticRelationGroup(elements.tarotDetailHebrewEl, elements.tarotMetaHebrewCardEl, detailRelations.hebrewRelations);
      renderStaticRelationGroup(elements.tarotDetailCubeEl, elements.tarotMetaCubeCardEl, detailRelations.cubeRelations);
      renderStaticRelationGroup(elements.tarotDetailIChingEl, elements.tarotMetaIChingCardEl, detailRelations.iChingRelations);
      renderStaticRelationGroup(elements.tarotDetailCalendarEl, elements.tarotMetaCalendarCardEl, detailRelations.mergedMonthRelations);

      const kabPathEl = elements.tarotKabPathEl;
      if (kabPathEl) {
        const kabTree = getMagickDataset()?.grouped?.kabbalah?.["kabbalah-tree"];
        const kabPath = (card.arcana === "Major" && typeof card.number === "number" && kabTree)
          ? kabTree.paths.find((path) => path.tarot?.trumpNumber === card.number)
          : null;
        const kabSeph = !kabPath ? findSephirahForMinorCard(card, kabTree) : null;

        if (kabPath) {
          const letter = kabPath.hebrewLetter || {};
          const fromName = kabTree.sephiroth.find((seph) => seph.number === kabPath.connects.from)?.name || kabPath.connects.from;
          const toName = kabTree.sephiroth.find((seph) => seph.number === kabPath.connects.to)?.name || kabPath.connects.to;
          const astrologyType = String(kabPath.astrology?.type || "").trim().toLowerCase();
          const astrologyName = String(kabPath.astrology?.name || "").trim();

          kabPathEl.innerHTML = html`
          <strong>Kabbalah Tree</strong>
          <div class="tarot-kab-path-row">
            <span class="tarot-kab-letter" title="${letter.transliteration || ""}">${letter.char || ""}</span>
            <span class="tarot-kab-meta">
              <span class="tarot-kab-name"></span>
              <span class="tarot-kab-connects"></span>
            </span>
          </div>`;

          const pathNameEl = kabPathEl.querySelector(".tarot-kab-name");
          if (pathNameEl) {
            pathNameEl.appendChild(createInlineButton(`Path ${kabPath.pathNumber}`, "nav:kabbalah-path", {
              pathNo: kabPath.pathNumber
            }));
            pathNameEl.appendChild(document.createTextNode(` — ${letter.transliteration || ""}`));
            if (letter.meaning) {
              pathNameEl.appendChild(document.createTextNode(` - \"${letter.meaning}\"`));
            }
            if (letter.letterType) {
              pathNameEl.appendChild(document.createTextNode(` - ${letter.letterType}`));
            }
          }

          const connectsEl = kabPathEl.querySelector(".tarot-kab-connects");
          if (connectsEl) {
            connectsEl.appendChild(createInlineButton(fromName, "nav:kabbalah-path", {
              pathNo: kabPath.connects.from
            }));
            connectsEl.appendChild(document.createTextNode(" → "));
            connectsEl.appendChild(createInlineButton(toName, "nav:kabbalah-path", {
              pathNo: kabPath.connects.to
            }));
            if (astrologyName) {
              connectsEl.appendChild(document.createTextNode(" · "));
              if (astrologyType === "planet") {
                connectsEl.appendChild(createInlineButton(astrologyName, "nav:planet", {
                  planetId: resolvePlanetId(astrologyName)
                }));
              } else if (astrologyType === "zodiac") {
                connectsEl.appendChild(createInlineButton(astrologyName, "nav:zodiac", {
                  signId: astrologyName.toLowerCase()
                }));
              } else {
                connectsEl.appendChild(document.createTextNode(`${astrologyName} (${astrologyType || "astrology"})`));
              }
            }
          }

          const letterId = String(letter.transliteration || "").trim().toLowerCase();
          if (letterId) {
            kabPathEl.appendChild(createInlineValue([
              "Hebrew ",
              createInlineButton(`${letter.char || ""} ${letter.transliteration || letterId}`.trim(), "nav:alphabet", {
                alphabet: "hebrew",
                hebrewLetterId: letterId
              })
            ]));
          }

          kabPathEl.hidden = false;
        } else if (kabSeph) {
          const hebrewName = kabSeph.nameHebrew ? ` (${kabSeph.nameHebrew})` : "";
          const translation = kabSeph.translation ? ` — ${kabSeph.translation}` : "";
          const planetInfo = kabSeph.planet || "";
          const tarotInfo = kabSeph.tarot ? `  ·  ${kabSeph.tarot}` : "";
          const resolvedPlanetId = resolvePlanetId(planetInfo);

          kabPathEl.innerHTML = html`
          <strong>Kabbalah Tree</strong>
          <div class="tarot-kab-path-row">
            <span class="tarot-kab-letter" title="${kabSeph.name || ""}"></span>
            <span class="tarot-kab-meta">
              <span class="tarot-kab-name"></span>
              <span class="tarot-kab-connects"></span>
            </span>
          </div>`;

          const sephirahLetterEl = kabPathEl.querySelector(".tarot-kab-letter");
          if (sephirahLetterEl) {
            sephirahLetterEl.appendChild(createInlineButton(`${kabSeph.number}`, "nav:kabbalah-path", {
              pathNo: kabSeph.number
            }));
          }
          const sephirahNameEl = kabPathEl.querySelector(".tarot-kab-name");
          if (sephirahNameEl) {
            sephirahNameEl.appendChild(createInlineButton(`Sephirah ${kabSeph.number} — ${kabSeph.name || "Sephirah"}${hebrewName}${translation}`, "nav:kabbalah-path", {
              pathNo: kabSeph.number
            }));
          }

          const sephirahConnectsEl = kabPathEl.querySelector(".tarot-kab-connects");
          if (sephirahConnectsEl) {
            if (resolvedPlanetId) {
              sephirahConnectsEl.appendChild(createInlineButton(planetInfo, "nav:planet", { planetId: resolvedPlanetId }));
            } else if (planetInfo) {
              sephirahConnectsEl.appendChild(document.createTextNode(planetInfo));
            }

            if (tarotInfo) {
              if (sephirahConnectsEl.childNodes.length) {
                sephirahConnectsEl.appendChild(document.createTextNode(" · "));
              }
              sephirahConnectsEl.appendChild(document.createTextNode(String(kabSeph.tarot || "")));
            }
          }

          kabPathEl.hidden = false;
        } else {
          kabPathEl.hidden = true;
          kabPathEl.innerHTML = "";
        }
      }
    }

    return {
      buildCompareDetails,
      renderStaticRelationGroup,
      renderDetail
    };
  }

  window.TarotDetailUi = {
    createTarotDetailRenderer
  };
})();