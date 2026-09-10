/* ui-alphabet-kabbalah.js — Shared Kabbalah and cube helpers for the alphabet section */
(function () {
  "use strict";

  function normalizeId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeLetterId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  function titleCase(value) {
    return String(value || "")
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function normalizeSoulId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  function buildFourWorldLayersFromDataset(magickDataset) {
    const worlds = magickDataset?.grouped?.kabbalah?.fourWorlds;
    const souls = magickDataset?.grouped?.kabbalah?.souls;
    const paths = Array.isArray(magickDataset?.grouped?.kabbalah?.["kabbalah-tree"]?.paths)
      ? magickDataset.grouped.kabbalah["kabbalah-tree"].paths
      : [];

    if (!worlds || typeof worlds !== "object") {
      return [];
    }

    const soulAliases = {
      chiah: "chaya",
      chaya: "chaya",
      neshamah: "neshama",
      neshama: "neshama",
      ruach: "ruach",
      nephesh: "nephesh"
    };

    const pathByLetterId = new Map();
    paths.forEach((path) => {
      const letterId = normalizeLetterId(path?.hebrewLetter?.transliteration || path?.hebrewLetter?.char);
      const pathNo = Number(path?.pathNumber);
      if (!letterId || !Number.isFinite(pathNo) || pathByLetterId.has(letterId)) {
        return;
      }
      pathByLetterId.set(letterId, pathNo);
    });

    const worldOrder = ["atzilut", "briah", "yetzirah", "assiah"];

    return worldOrder
      .map((worldId) => {
        const world = worlds?.[worldId];
        if (!world || typeof world !== "object") {
          return null;
        }

        const tetragrammaton = world?.tetragrammaton && typeof world.tetragrammaton === "object"
          ? world.tetragrammaton
          : {};

        const letterId = normalizeLetterId(tetragrammaton?.hebrewLetterId);
        const rawSoulId = normalizeSoulId(world?.soulId);
        const soulId = soulAliases[rawSoulId] || rawSoulId;
        const soul = souls?.[soulId] && typeof souls[soulId] === "object"
          ? souls[soulId]
          : null;

        const slot = tetragrammaton?.isFinal
          ? `${String(tetragrammaton?.slot || "Heh")} (final)`
          : String(tetragrammaton?.slot || "");

        return {
          slot,
          letterChar: String(tetragrammaton?.letterChar || ""),
          hebrewLetterId: letterId,
          world: String(world?.name?.roman || titleCase(worldId)),
          worldLayer: String(world?.worldLayer?.en || world?.desc?.en || ""),
          worldDescription: String(world?.worldDescription?.en || ""),
          soulLayer: String(soul?.name?.roman || titleCase(rawSoulId || soulId)),
          soulTitle: String(soul?.title?.en || titleCase(soul?.name?.en || "")),
          soulDescription: String(soul?.desc?.en || ""),
          pathNumber: pathByLetterId.get(letterId) || null
        };
      })
      .filter(Boolean);
  }

  function createEmptyCubeRefs() {
    return {
      hebrewPlacementById: new Map(),
      signPlacementById: new Map(),
      planetPlacementById: new Map(),
      pathPlacementByNo: new Map()
    };
  }

  function getCubePlacementForHebrewLetter(cubeRefs, hebrewLetterId, pathNo = null) {
    const normalizedLetterId = normalizeId(hebrewLetterId);
    if (normalizedLetterId && cubeRefs?.hebrewPlacementById?.has(normalizedLetterId)) {
      return cubeRefs.hebrewPlacementById.get(normalizedLetterId);
    }

    const numericPath = Number(pathNo);
    if (Number.isFinite(numericPath) && cubeRefs?.pathPlacementByNo?.has(numericPath)) {
      return cubeRefs.pathPlacementByNo.get(numericPath);
    }

    return null;
  }

  function getCubePlacementForPlanet(cubeRefs, planetId) {
    const normalizedPlanetId = normalizeId(planetId);
    return normalizedPlanetId ? cubeRefs?.planetPlacementById?.get(normalizedPlanetId) || null : null;
  }

  function getCubePlacementForSign(cubeRefs, signId) {
    const normalizedSignId = normalizeId(signId);
    return normalizedSignId ? cubeRefs?.signPlacementById?.get(normalizedSignId) || null : null;
  }

  function cubePlacementLabel(placement) {
    const wallName = placement?.wallName || "Wall";
    const edgeName = placement?.edgeName || "Direction";
    return `Cube: ${wallName} Wall - ${edgeName}`;
  }

  function buildCubePlacementButton(placement, navBtn, fallbackDetail = null) {
    if (!placement || typeof navBtn !== "function") {
      return "";
    }

    const detail = {
      "wall-id": placement.wallId,
      "edge-id": placement.edgeId
    };

    if (fallbackDetail && typeof fallbackDetail === "object") {
      Object.entries(fallbackDetail).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          detail[key] = value;
        }
      });
    }

    return navBtn(cubePlacementLabel(placement), "nav:cube", detail);
  }

  window.AlphabetKabbalahUi = {
    buildCubePlacementButton,
    buildFourWorldLayersFromDataset,
    createEmptyCubeRefs,
    cubePlacementLabel,
    getCubePlacementForHebrewLetter,
    getCubePlacementForPlanet,
    getCubePlacementForSign,
    normalizeId,
    normalizeLetterId,
    titleCase
  };
})();