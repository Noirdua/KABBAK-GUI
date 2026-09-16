(function () {
  "use strict";

  let config = {};
  let initialized = false;

  function getActiveSection() {
    return typeof config.getActiveSection === "function"
      ? config.getActiveSection()
      : "home";
  }

  function setActiveSection(section) {
    config.setActiveSection?.(section);
  }

  function getReferenceData() {
    return config.getReferenceData?.() || null;
  }

  function getMagickDataset() {
    return config.getMagickDataset?.() || null;
  }

  function getKabbalahPathNo(detail) {
    if (!detail || typeof detail !== "object") {
      return null;
    }

    const rawValue = detail.pathNo ?? detail["path-no"] ?? null;
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      return null;
    }

    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  const DETAIL_VIEW_SELECTOR_BY_SECTION = {
    tarot: "#tarot-browse-view .browse-layout",
    cube: "#cube-layout",
    zodiac: "#zodiac-section .browse-layout",
    "alphabet-letters": "#alphabet-letters-section .browse-layout",
    numbers: "#numbers-section .numbers-main-layout",
    iching: "#iching-section .browse-layout",
    gods: "#gods-section .browse-layout",
    kabbalah: "#kabbalah-section .browse-layout",
    "kabbalah-worlds": "#kabbalah-worlds-section .browse-layout",
    "kabbalah-paths": "#kabbalah-paths-section .browse-layout",
    "kabbalah-cross": "#kabbalah-cross-section .kab-rose-layout",
    planets: "#planet-section .browse-layout",
    elements: "#elements-section .browse-layout",
    tattvas: "#tattvas-section .browse-layout",
    modalities: "#modalities-section .browse-layout"
  };

  function showSectionDetailOnly(sectionKey, persist = false) {
    const selector = DETAIL_VIEW_SELECTOR_BY_SECTION[sectionKey];
    if (!selector) {
      return false;
    }

    const target = document.querySelector(selector);
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(window.TarotChromeUi?.showDetailOnly?.(target, persist));
  }

  function isSectionDetailOnly(sectionKey) {
    const selector = DETAIL_VIEW_SELECTOR_BY_SECTION[sectionKey];
    if (!selector) {
      return false;
    }

    const target = document.querySelector(selector);
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.classList.contains("layout-sidebar-collapsed")
      && !target.classList.contains("layout-detail-collapsed");
  }

  function scheduleSectionDetailOnly(sectionKey, persist = false, attempts = 4) {
    requestAnimationFrame(() => {
      showSectionDetailOnly(sectionKey, persist);
      if (!isSectionDetailOnly(sectionKey) && attempts > 1) {
        scheduleSectionDetailOnly(sectionKey, persist, attempts - 1);
      }
    });
  }

  async function prepareTarotBrowseDetailView() {
    if (window.TarotAppConfig?.hasTarotAccess?.() !== true) {
      return false;
    }

    try {
      await window.TarotLazySections?.ensureSectionScripts?.("tarot");
      window.TarotEnsureDeferredUiInits?.();
    } catch (_) {}

    const ensure = config.ensure || {};
    const referenceData = getReferenceData();
    const magickDataset = getMagickDataset();

    setActiveSection("tarot");
    window.TarotSpreadUi?.showCardsView?.();
    config.tarotSpreadUi?.showCardsView?.();

    if (typeof ensure.ensureTarotSection === "function" && referenceData) {
      await ensure.ensureTarotSection(referenceData, magickDataset);
    }

    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });

    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });

    showSectionDetailOnly("tarot");
    return true;
  }

  function bindClick(element, handler) {
    if (!element) {
      return;
    }

    element.addEventListener("click", handler);
  }

  function bindTopLevelNavButtons() {
    const elements = config.elements || {};

    bindClick(elements.openHomeEl, () => {
      setActiveSection("home");
    });

    bindClick(elements.openHomeMenuEl, () => {
      setActiveSection("home");
    });

    bindClick(elements.openAudioEl, () => {
      const activeSection = getActiveSection();
      const isAudioSectionActive = activeSection === "audio-notes" || activeSection === "audio-circle";
      setActiveSection(isAudioSectionActive ? "home" : "audio-notes");
    });

    bindClick(elements.openAudioCircleEl, () => {
      setActiveSection("audio-circle");
    });

    bindClick(elements.openAudioNotesEl, () => {
      setActiveSection("audio-notes");
    });

    bindClick(elements.openTarotEl, () => {
      if (getActiveSection() === "tarot") {
        setActiveSection("home");
      } else {
        setActiveSection("tarot");
        config.tarotSpreadUi?.showCardsView?.();
      }
    });

    bindClick(elements.openTarotCardsEl, () => {
      setActiveSection("tarot");
      config.tarotSpreadUi?.showCardsView?.();
    });

    bindClick(elements.openTarotSpreadEl, () => {
      setActiveSection("tarot");
      config.tarotSpreadUi?.setSpread?.("three-card", false);
    });

    bindClick(elements.openTarotFrameEl, () => {
      setActiveSection(getActiveSection() === "tarot-frame" ? "home" : "tarot-frame");
    });

    bindClick(elements.openTarotHouseEl, () => {
      setActiveSection(getActiveSection() === "tarot-house" ? "home" : "tarot-house");
    });

    bindClick(elements.openAstronomyEl, () => {
      setActiveSection(getActiveSection() === "astronomy" ? "home" : "astronomy");
    });

    bindClick(elements.openPlanetsEl, () => {
      setActiveSection(getActiveSection() === "planets" ? "home" : "planets");
    });

    bindClick(elements.openCyclesEl, () => {
      setActiveSection(getActiveSection() === "cycles" ? "home" : "cycles");
    });

    bindClick(elements.openModalitiesEl, () => {
      setActiveSection(getActiveSection() === "modalities" ? "home" : "modalities");
    });

    bindClick(elements.openElementsEl, () => {
      setActiveSection(getActiveSection() === "elements" ? "home" : "elements");
    });

    bindClick(elements.openTattvasEl, () => {
      setActiveSection(getActiveSection() === "tattvas" ? "home" : "tattvas");
    });

    bindClick(elements.openIChingEl, () => {
      setActiveSection(getActiveSection() === "iching" ? "home" : "iching");
    });

    bindClick(elements.openIChingHexagramsEl, () => {
      setActiveSection("iching");
    });

    bindClick(elements.openIChingTrigramsEl, () => {
      setActiveSection("iching-trigram");
    });

    bindClick(elements.openIChingBigramsEl, () => {
      setActiveSection("iching-bigram");
    });

    bindClick(elements.openIChingPhasesEl, () => {
      setActiveSection("iching-phase");
    });

    bindClick(elements.openKabbalahEl, () => {
      setActiveSection(getActiveSection() === "kabbalah" ? "home" : "kabbalah");
    });

    bindClick(elements.openKabbalahSephirotEl, () => {
      setActiveSection("kabbalah");
    });

    bindClick(elements.openKabbalahWorldsEl, () => {
      setActiveSection("kabbalah-worlds");
    });

    bindClick(elements.openKabbalahPathsEl, () => {
      setActiveSection("kabbalah-paths");
    });

    bindClick(elements.openKabbalahCrossEl, () => {
      setActiveSection("kabbalah-cross");
    });

    bindClick(elements.openKabbalahTreeEl, () => {
      setActiveSection("kabbalah-tree");
    });

    bindClick(elements.openKabbalahCubeEl, () => {
      setActiveSection("cube");
    });

    bindClick(elements.openKabbalahTandemEl, () => {
      setActiveSection("kabbalah-tandem");
    });

    bindClick(elements.openAlphabetWordEl, () => {
      setActiveSection(getActiveSection() === "alphabet" ? "home" : "alphabet");
    });

    bindClick(elements.openAlphabetLettersEl, () => {
      setActiveSection(getActiveSection() === "alphabet-letters" ? "home" : "alphabet-letters");
    });

    bindClick(elements.openAlphabetTextEl, () => {
      setActiveSection(getActiveSection() === "alphabet-text" ? "home" : "alphabet-text");
    });

    bindClick(elements.openAlphabetReferenceEl, () => {
      setActiveSection(getActiveSection() === "alphabet-reference" ? "home" : "alphabet-reference");
    });

    bindClick(elements.openNumbersEl, () => {
      const active = getActiveSection();
      const onNumbersMenu = active === "numbers" || active === "num-pad";
      setActiveSection(onNumbersMenu ? "home" : "numbers");
      if (!onNumbersMenu) {
        config.showNumbersBrowseView?.(false);
      }
    });

    bindClick(elements.openNumbersBrowseEl, () => {
      setActiveSection("numbers");
      config.showNumbersBrowseView?.(false);
    });

    bindClick(elements.openNumbersTheoryEl, () => {
      setActiveSection("numbers");
      config.showNumbersTheoryView?.(false);
      scheduleSectionDetailOnly("numbers");
    });

    bindClick(elements.openNumbersNumPadEl, () => {
      setActiveSection(getActiveSection() === "num-pad" ? "home" : "num-pad");
    });

    bindClick(elements.openZodiacEl, () => {
      setActiveSection(getActiveSection() === "zodiac" ? "home" : "zodiac");
    });

    bindClick(elements.openSkyEl, () => {
      setActiveSection(getActiveSection() === "sky" ? "home" : "sky");
    });

    bindClick(elements.openNatalEl, () => {
      setActiveSection(getActiveSection() === "natal" ? "home" : "natal");
    });

    bindClick(elements.openQuizEl, () => {
      setActiveSection(getActiveSection() === "quiz" ? "home" : "quiz");
    });

    bindClick(elements.openCommunityEl, () => {
      setActiveSection(getActiveSection() === "community" ? "home" : "community");
    });

    bindClick(elements.openScriberEl, () => {
      setActiveSection(getActiveSection() === "scriber" ? "home" : "scriber");
    });

    bindClick(elements.openProfileEl, () => {
      setActiveSection(getActiveSection() === "profile" ? "home" : "profile");
    });

    bindClick(elements.openAdminEl, () => {
      setActiveSection(getActiveSection() === "admin" ? "home" : "admin");
    });

    bindClick(elements.openGodsEl, () => {
      setActiveSection(getActiveSection() === "gods" ? "home" : "gods");
    });

    bindClick(elements.openEnochianEl, () => {
      setActiveSection(getActiveSection() === "enochian" ? "home" : "enochian");
    });

    bindClick(elements.openCalendarEl, () => {
      setActiveSection(getActiveSection() === "planner" ? "home" : "planner");
    });
  }

  function bindCustomNavEvents() {
    const ensure = config.ensure || {};

    document.addEventListener("nav:cube", (event) => {
      const referenceData = getReferenceData();
      const magickDataset = getMagickDataset();
      if (typeof ensure.ensureCubeSection === "function" && magickDataset) {
        ensure.ensureCubeSection(magickDataset, referenceData);
      }

      setActiveSection("cube");

      const detail = event?.detail || {};
      requestAnimationFrame(() => {
        const ui = window.CubeSectionUi;
        const selected = ui?.selectPlacement?.(detail);
        if (!selected && detail?.wallId) {
          ui?.selectWallById?.(detail.wallId);
        }
        scheduleSectionDetailOnly("cube");
      });
    });

    document.addEventListener("nav:zodiac", (event) => {
      const referenceData = getReferenceData();
      const magickDataset = getMagickDataset();
      if (typeof ensure.ensureZodiacSection === "function" && referenceData && magickDataset) {
        ensure.ensureZodiacSection(referenceData, magickDataset);
      }
      setActiveSection("zodiac");
      const signId = event?.detail?.signId;
      if (signId) {
        requestAnimationFrame(() => {
          window.ZodiacSectionUi?.selectBySignId?.(signId);
          scheduleSectionDetailOnly("zodiac");
        });
      }
    });

    document.addEventListener("nav:alphabet", (event) => {
      const referenceData = getReferenceData();
      const magickDataset = getMagickDataset();
      if (typeof ensure.ensureAlphabetSection === "function" && magickDataset) {
        ensure.ensureAlphabetSection(magickDataset, referenceData);
      }
      setActiveSection("alphabet-letters");

      const alphabet = event?.detail?.alphabet;
      const hebrewLetterId = event?.detail?.hebrewLetterId;
      const greekName = event?.detail?.greekName;
      const englishLetter = event?.detail?.englishLetter;
      const arabicName = event?.detail?.arabicName;
      const enochianId = event?.detail?.enochianId;

      requestAnimationFrame(() => {
        const ui = window.AlphabetSectionUi;
        if ((alphabet === "hebrew" || (!alphabet && hebrewLetterId)) && hebrewLetterId) {
          ui?.selectLetterByHebrewId?.(hebrewLetterId);
          scheduleSectionDetailOnly("alphabet-letters");
          return;
        }
        if (alphabet === "greek" && greekName) {
          ui?.selectGreekLetterByName?.(greekName);
          scheduleSectionDetailOnly("alphabet-letters");
          return;
        }
        if (alphabet === "english" && englishLetter) {
          ui?.selectEnglishLetter?.(englishLetter);
          scheduleSectionDetailOnly("alphabet-letters");
          return;
        }
        if (alphabet === "arabic" && arabicName) {
          ui?.selectArabicLetter?.(arabicName);
          scheduleSectionDetailOnly("alphabet-letters");
          return;
        }
        if (alphabet === "enochian" && enochianId) {
          ui?.selectEnochianLetter?.(enochianId);
          scheduleSectionDetailOnly("alphabet-letters");
        }
      });
    });

    document.addEventListener("nav:number", (event) => {
      const rawValue = event?.detail?.value;
      const normalizedValue = typeof config.normalizeNumberValue === "function"
        ? config.normalizeNumberValue(rawValue)
        : 0;
      if (normalizedValue === null) {
        return;
      }

      setActiveSection("numbers");
      config.showNumbersBrowseView?.(false);
      requestAnimationFrame(() => {
        if (typeof config.selectNumberEntry === "function") {
          config.selectNumberEntry(normalizedValue);
        }
        scheduleSectionDetailOnly("numbers");
      });
    });

    document.addEventListener("nav:iching", (event) => {
      const referenceData = getReferenceData();
      if (typeof ensure.ensureIChingSection === "function" && referenceData) {
        ensure.ensureIChingSection(referenceData);
      }

      setActiveSection("iching");

      const hexagramNumber = event?.detail?.hexagramNumber;
      const planetaryInfluence = event?.detail?.planetaryInfluence;

      requestAnimationFrame(() => {
        const ui = window.IChingSectionUi;
        if (hexagramNumber != null) {
          ui?.selectByHexagramNumber?.(hexagramNumber);
          scheduleSectionDetailOnly("iching");
          return;
        }
        if (planetaryInfluence) {
          ui?.selectByPlanetaryInfluence?.(planetaryInfluence);
          scheduleSectionDetailOnly("iching");
        }
      });
    });

    document.addEventListener("nav:gods", (event) => {
      void (async () => {
        try {
          await window.TarotLazySections?.ensureSectionScripts?.("gods");
          await window.TarotAppRuntime?.ensureMagickDatasetLoaded?.();
        } catch (_) {}
        const referenceData = getReferenceData();
        const magickDataset = getMagickDataset();
        if (typeof ensure.ensureGodsSection === "function" && magickDataset) {
          ensure.ensureGodsSection(magickDataset, referenceData);
        }
        setActiveSection("gods");
        const godId = event?.detail?.godId;
        const godName = event?.detail?.godName;
        const pathNo = event?.detail?.pathNo;
        requestAnimationFrame(() => {
          const ui = window.GodsSectionUi;
          const viaId = godId ? ui?.selectById?.(godId) : false;
          const viaName = !viaId && godName ? ui?.selectByName?.(godName) : false;
          if (!viaId && !viaName && pathNo != null) {
            ui?.selectByPathNo?.(pathNo);
          }
          scheduleSectionDetailOnly("gods");
        });
      })();
    });

    document.addEventListener("nav:kabbalah-path", (event) => {
      const magickDataset = getMagickDataset();
      const pathNo = getKabbalahPathNo(event?.detail);
      if (typeof ensure.ensureKabbalahSection === "function" && magickDataset) {
        ensure.ensureKabbalahSection(magickDataset);
      }
      if (pathNo != null) {
        const targetSection = Number(pathNo) >= 11 ? "kabbalah-paths" : "kabbalah";
        setActiveSection(targetSection);
        requestAnimationFrame(() => {
          window.KabbalahSectionUi?.selectNode?.(pathNo);
          scheduleSectionDetailOnly(targetSection);
        });
        return;
      }

      setActiveSection("kabbalah-paths");
    });

    document.addEventListener("nav:planet", (event) => {
      const planetId = event?.detail?.planetId;
      if (!planetId) {
        return;
      }
      void (async () => {
        try {
          await window.TarotLazySections?.ensureSectionScripts?.("planets");
          await window.TarotAppRuntime?.ensureMagickDatasetLoaded?.();
        } catch (_) {}
        const referenceData = getReferenceData();
        const magickDataset = getMagickDataset();
        if (typeof ensure.ensurePlanetSection === "function" && referenceData) {
          ensure.ensurePlanetSection(referenceData, magickDataset);
        }
        setActiveSection("planets");
        requestAnimationFrame(() => {
          window.PlanetSectionUi?.selectByPlanetId?.(planetId);
          scheduleSectionDetailOnly("planets");
        });
      })();
    });

    document.addEventListener("nav:elements", (event) => {
      const elementId = event?.detail?.elementId;
      if (!elementId) {
        return;
      }

      void (async () => {
        try {
          await window.TarotLazySections?.ensureSectionScripts?.("elements");
          await window.TarotAppRuntime?.ensureMagickDatasetLoaded?.();
        } catch (_) {}
        const magickDataset = getMagickDataset();
        if (typeof ensure.ensureElementsSection === "function" && magickDataset) {
          ensure.ensureElementsSection(magickDataset);
        }

        setActiveSection("elements");

        requestAnimationFrame(() => {
          window.ElementsSectionUi?.selectByElementId?.(elementId);
          scheduleSectionDetailOnly("elements");
        });
      })();
    });

    document.addEventListener("nav:tattvas", (event) => {
      const tattvaId = event?.detail?.tattvaId;
      if (!tattvaId) {
        return;
      }

      void (async () => {
        try {
          await window.TarotLazySections?.ensureSectionScripts?.("tattvas");
          await window.TarotAppRuntime?.ensureMagickDatasetLoaded?.();
        } catch (_) {}
        const magickDataset = getMagickDataset();
        if (typeof ensure.ensureTattvasSection === "function" && magickDataset) {
          ensure.ensureTattvasSection(magickDataset);
        }

        setActiveSection("tattvas");

        requestAnimationFrame(() => {
          window.TattvasSectionUi?.selectByTattvaId?.(tattvaId);
          scheduleSectionDetailOnly("tattvas");
        });
      })();
    });

    document.addEventListener("nav:modalities", (event) => {
      const modalityId = event?.detail?.modalityId || event?.detail?.["modality-id"] || "";

      void (async () => {
        try {
          await window.TarotLazySections?.ensureSectionScripts?.("modalities");
          await window.TarotAppRuntime?.ensureMagickDatasetLoaded?.();
        } catch (_) {}
        const referenceData = getReferenceData();
        const magickDataset = getMagickDataset();
        if (typeof ensure.ensureModalitiesSection === "function") {
          ensure.ensureModalitiesSection(magickDataset, referenceData);
        }

        setActiveSection("modalities");

        if (modalityId) {
          requestAnimationFrame(() => {
            window.ModalitiesSectionUi?.selectByModalityId?.(modalityId);
            scheduleSectionDetailOnly("modalities");
          });
        }
      })();
    });

    document.addEventListener("nav:tarot-trump", async (event) => {
      const tarotReady = await prepareTarotBrowseDetailView();
      if (!tarotReady) {
        return;
      }

      const { trumpNumber, cardName } = event?.detail || {};

      if (trumpNumber != null) {
        window.TarotSectionUi?.selectCardByTrump?.(trumpNumber);
      } else if (cardName) {
        window.TarotSectionUi?.selectCardByName?.(cardName);
      }
    });

    document.addEventListener("kab:view-trump", async (event) => {
      const tarotReady = await prepareTarotBrowseDetailView();
      if (!tarotReady) {
        return;
      }

      const trumpNumber = event?.detail?.trumpNumber;

      if (trumpNumber != null) {
        window.TarotSectionUi?.selectCardByTrump?.(trumpNumber);
      }
    });

    document.addEventListener("tarot:view-kab-path", (event) => {
      setActiveSection("kabbalah-paths");
      const pathNumber = event?.detail?.pathNumber;
      if (pathNumber != null) {
        requestAnimationFrame(() => {
          const kabbalahUi = window.KabbalahSectionUi;
          if (typeof kabbalahUi?.selectNode === "function") {
            kabbalahUi.selectNode(pathNumber);
          } else {
            kabbalahUi?.selectPathByNumber?.(pathNumber);
          }
          scheduleSectionDetailOnly("kabbalah-paths");
        });
      }
    });
  }

  function init(nextConfig = {}) {
    config = {
      ...config,
      ...nextConfig,
      elements: {
        ...(config.elements || {}),
        ...(nextConfig.elements || {})
      },
      ensure: {
        ...(config.ensure || {}),
        ...(nextConfig.ensure || {})
      }
    };

    if (initialized) {
      return;
    }

    initialized = true;
    bindTopLevelNavButtons();
    bindCustomNavEvents();
  }

  window.TarotNavigationUi = {
    ...(window.TarotNavigationUi || {}),
    init
  };
})();
