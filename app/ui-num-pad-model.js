(function () {
  "use strict";

  const grid = window.NumPadGrid;
  if (!grid || typeof grid.listSlots !== "function") {
    throw new Error("NumPadGrid module must load before ui-num-pad-model.js");
  }

  const MODE_KEYPAD = "keypad";
  const MODE_TIMES_TABLE = "times-table";
  const DISPLAY_PRODUCT = "product";
  const DISPLAY_DIGITAL_ROOT = "digital-root";
  const PLACE_FULL = "full";
  const PLACE_ONES = "ones";
  const PLACE_TENS = "tens";
  const PLACE_HUNDREDS = "hundreds";
  const MIN_FACTOR = 1;
  const MAX_FACTOR = 9;
  const MIN_DEGREE = 0;
  const MAX_DEGREE = 99;
  const DEGREE_SPAN = grid.GRID.slotCount;

  function toInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.trunc(parsed);
  }

  function normalizeFactor(value) {
    const factor = toInteger(value);
    if (factor === null || factor < MIN_FACTOR || factor > MAX_FACTOR) {
      return null;
    }
    return factor;
  }

  function computeDigitalRoot(value) {
    const integer = toInteger(value);
    if (integer === null) {
      return null;
    }
    const abs = Math.abs(integer);
    if (abs === 0) {
      return 0;
    }
    return 1 + ((abs - 1) % 9);
  }

  function getPlaceDigits(value) {
    const integer = toInteger(value);
    if (integer === null) {
      return {
        ones: null,
        tens: null,
        hundreds: null
      };
    }
    const abs = Math.abs(integer);
    return {
      ones: abs % 10,
      tens: Math.floor(abs / 10) % 10,
      hundreds: Math.floor(abs / 100) % 10
    };
  }

  function normalizeDegree(value) {
    const degree = toInteger(value);
    if (degree === null || degree < MIN_DEGREE) {
      return MIN_DEGREE;
    }
    if (degree > MAX_DEGREE) {
      return MAX_DEGREE;
    }
    return degree;
  }

  function getDegreeRange(degree) {
    const normalized = normalizeDegree(degree);
    const start = (normalized * DEGREE_SPAN) + 1;
    return {
      degree: normalized,
      start,
      end: start + DEGREE_SPAN - 1
    };
  }

  function getMultiplier(slotIndex, degree) {
    const range = getDegreeRange(degree);
    return range.start + (slotIndex - 1);
  }

  function normalizePlaceValue(value) {
    if (value === PLACE_ONES || value === PLACE_TENS || value === PLACE_HUNDREDS) {
      return value;
    }
    return PLACE_FULL;
  }

  function formatProduct(value) {
    const product = toInteger(value);
    if (product === null) {
      return "--";
    }
    const abs = Math.abs(product);
    const digits = String(abs);
    const padded = digits.length < 2 ? digits.padStart(2, "0") : digits;
    return product < 0 ? `-${padded}` : padded;
  }

  function createCell(slot, spec) {
    const mode = spec.mode === MODE_TIMES_TABLE ? MODE_TIMES_TABLE : MODE_KEYPAD;
    const factor = mode === MODE_TIMES_TABLE ? normalizeFactor(spec.factor) : null;
    const degree = normalizeDegree(spec.degree);
    const multiplier = getMultiplier(slot.index, degree);
    const product = mode === MODE_TIMES_TABLE && factor !== null
      ? factor * multiplier
      : multiplier;
    const digitalRoot = computeDigitalRoot(product);
    const placeDigits = getPlaceDigits(product);
    const productDisplay = mode === MODE_TIMES_TABLE ? formatProduct(product) : String(multiplier);
    const digitalRootDisplay = digitalRoot === null ? "--" : String(digitalRoot);

    return Object.freeze({
      slot,
      mode,
      factor,
      degree,
      multiplier,
      product,
      digitalRoot,
      onesDigit: placeDigits.ones,
      tensDigit: placeDigits.tens,
      hundredsDigit: placeDigits.hundreds,
      productDisplay,
      digitalRootDisplay,
      onesDisplay: placeDigits.ones === null ? "--" : String(placeDigits.ones),
      tensDisplay: placeDigits.tens === null ? "--" : String(placeDigits.tens),
      hundredsDisplay: placeDigits.hundreds === null ? "--" : String(placeDigits.hundreds),
      display: productDisplay,
      selectable: mode === MODE_KEYPAD
    });
  }

  function normalizeDisplayFlags(flags) {
    const gridShowProduct = flags?.gridShowProduct !== false;
    const gridShowDigitalRoot = flags?.gridShowDigitalRoot !== false;
    const chainShowProduct = flags?.chainShowProduct !== false;
    const chainShowDigitalRoot = flags?.chainShowDigitalRoot !== false;
    const gridPlaceValue = normalizePlaceValue(flags?.gridPlaceValue ?? flags?.placeValue);
    const chainPlaceValue = normalizePlaceValue(flags?.chainPlaceValue);

    function pair(showProduct, showDigitalRoot) {
      if (!showProduct && !showDigitalRoot) {
        return { showProduct: true, showDigitalRoot: false };
      }
      return { showProduct, showDigitalRoot };
    }

    const gridPair = pair(gridShowProduct, gridShowDigitalRoot);
    const chainPair = pair(chainShowProduct, chainShowDigitalRoot);
    return {
      showProduct: gridPair.showProduct,
      showDigitalRoot: gridPair.showDigitalRoot,
      gridShowProduct: gridPair.showProduct,
      gridShowDigitalRoot: gridPair.showDigitalRoot,
      chainShowProduct: chainPair.showProduct,
      chainShowDigitalRoot: chainPair.showDigitalRoot,
      gridPlaceValue,
      chainPlaceValue,
      placeValue: gridPlaceValue
    };
  }

  function setDegree(state, value) {
    if (!state) {
      return createState();
    }
    state.degree = normalizeDegree(value);
    return state;
  }

  function shiftDegree(state, delta) {
    return setDegree(state, normalizeDegree(state?.degree) + Number(delta || 0));
  }

  function setPlaceValue(state, value) {
    return setGridPlaceValue(state, value);
  }

  function setGridPlaceValue(state, value) {
    if (!state) {
      return createState();
    }
    state.gridPlaceValue = normalizePlaceValue(value);
    state.placeValue = state.gridPlaceValue;
    return state;
  }

  function setChainPlaceValue(state, value) {
    if (!state) {
      return createState();
    }
    state.chainPlaceValue = normalizePlaceValue(value);
    return state;
  }

  function getLocatorValue(cell, placeValue) {
    const place = normalizePlaceValue(placeValue);
    if (place === PLACE_ONES) {
      return cell?.onesDigit;
    }
    if (place === PLACE_TENS) {
      return cell?.tensDigit;
    }
    if (place === PLACE_HUNDREDS) {
      return cell?.hundredsDigit;
    }
    return cell?.digitalRoot;
  }

  function getVisiblePlaceDigits(cell, placeValue) {
    const place = normalizePlaceValue(placeValue);
    const hundreds = cell?.hundredsDigit ?? 0;
    const tens = cell?.tensDigit ?? 0;
    const ones = cell?.onesDigit ?? 0;
    const showHundreds = hundreds > 0 || place === PLACE_HUNDREDS;
    const digits = [];
    if (showHundreds) {
      digits.push({ place: PLACE_HUNDREDS, value: String(hundreds) });
    }
    digits.push(
      { place: PLACE_TENS, value: String(tens) },
      { place: PLACE_ONES, value: String(ones) }
    );
    return digits.map((digit) => ({
      ...digit,
      emphasized: place !== PLACE_FULL && digit.place === place
    }));
  }

  function getProductLayer(cell, placeValue) {
    const place = normalizePlaceValue(placeValue);
    const label = place === PLACE_ONES
      ? "Ones"
      : (place === PLACE_TENS ? "Tens" : (place === PLACE_HUNDREDS ? "Huns" : "Product"));
    return {
      id: DISPLAY_PRODUCT,
      label,
      value: cell.productDisplay,
      digits: getVisiblePlaceDigits(cell, place)
    };
  }

  function setDisplayFlag(state, flag, enabled, target) {
    if (!state) {
      return createState();
    }

    const isChain = target === "chain";
    const productKey = isChain ? "chainShowProduct" : "gridShowProduct";
    const rootKey = isChain ? "chainShowDigitalRoot" : "gridShowDigitalRoot";

    if (flag === DISPLAY_DIGITAL_ROOT) {
      state[rootKey] = Boolean(enabled);
    } else {
      state[productKey] = Boolean(enabled);
    }

    if (!state[productKey] && !state[rootKey]) {
      if (flag === DISPLAY_DIGITAL_ROOT) {
        state[productKey] = true;
      } else {
        state[rootKey] = true;
      }
    }

    if (!isChain) {
      state.showProduct = state.gridShowProduct;
      state.showDigitalRoot = state.gridShowDigitalRoot;
    }

    return state;
  }

  function getDisplayLayers(cell, displayFlags) {
    const showProduct = displayFlags?.showProduct !== false;
    const showDigitalRoot = displayFlags?.showDigitalRoot !== false;
    const placeValue = normalizePlaceValue(displayFlags?.placeValue);
    const layers = [];

    if (showProduct || (!showProduct && !showDigitalRoot)) {
      layers.push(getProductLayer(cell, placeValue));
    }

    if (showDigitalRoot) {
      layers.push({
        id: DISPLAY_DIGITAL_ROOT,
        label: "Root",
        value: cell.digitalRootDisplay
      });
    }

    return layers;
  }

  function buildKeypadCells(degree) {
    return grid.mapSlots((slot) => createCell(slot, { mode: MODE_KEYPAD, degree }));
  }

  function buildTimesTableCells(factor, degree) {
    const normalized = normalizeFactor(factor);
    if (normalized === null) {
      return buildKeypadCells(degree);
    }

    return grid.mapSlots((slot) => createCell(slot, {
      mode: MODE_TIMES_TABLE,
      factor: normalized,
      degree
    }));
  }

  function buildChain(factor, degree) {
    const normalized = normalizeFactor(factor);
    if (normalized === null) {
      return null;
    }

    const range = getDegreeRange(degree);
    const cells = buildTimesTableCells(normalized, range.degree);
    return Object.freeze({
      factor: normalized,
      degree: range.degree,
      key: `chain-${normalized}-d${range.degree}`,
      label: `${normalized} × ${range.start}–${range.end}`,
      range,
      cells
    });
  }

  function buildAllChains(degree) {
    const chains = [];
    for (let factor = MIN_FACTOR; factor <= MAX_FACTOR; factor += 1) {
      const chain = buildChain(factor, degree);
      if (chain) {
        chains.push(chain);
      }
    }
    return chains;
  }

  function getChain(state) {
    const factor = normalizeFactor(state?.factor);
    return factor === null ? null : buildChain(factor, MIN_DEGREE);
  }

  function buildChainPath(chain, layoutCells, gridPlaceValue) {
    const empty = Object.freeze({
      steps: [],
      complete: false,
      brokeAt: 0,
      message: "No link found"
    });

    if (!chain || !Array.isArray(chain.cells) || !Array.isArray(layoutCells)) {
      return empty;
    }

    const buckets = new Map();
    layoutCells.forEach((cell) => {
      const key = getLocatorValue(cell, gridPlaceValue);
      if (key === null || key === undefined) {
        return;
      }
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push(cell);
    });

    const cursors = new Map();
    const steps = [];

    for (let offset = 0; offset < chain.cells.length; offset += 1) {
      const step = chain.cells[offset];
      const key = step.digitalRoot;
      const matches = buckets.get(key) || [];
      const cursor = cursors.get(key) || 0;
      if (!matches.length || cursor >= matches.length) {
        if (!steps.length) {
          return empty;
        }
        return Object.freeze({
          steps,
          complete: false,
          brokeAt: offset,
          message: `Breaks after ${steps.length}`
        });
      }

      const layoutCell = matches[cursor];
      cursors.set(key, cursor + 1);
      steps.push(Object.freeze({
        order: offset + 1,
        value: key,
        chainCell: step,
        layoutCell,
        slot: layoutCell.slot
      }));
    }

    return Object.freeze({
      steps,
      complete: true,
      brokeAt: null,
      message: ""
    });
  }

  function createState(initialFactor) {
    const factor = normalizeFactor(initialFactor);
    return {
      mode: factor === null ? MODE_KEYPAD : MODE_TIMES_TABLE,
      factor,
      showProduct: true,
      showDigitalRoot: true,
      gridShowProduct: true,
      gridShowDigitalRoot: true,
      chainShowProduct: true,
      chainShowDigitalRoot: true,
      placeValue: PLACE_FULL,
      gridPlaceValue: PLACE_FULL,
      chainPlaceValue: PLACE_FULL,
      degree: MIN_DEGREE
    };
  }

  function selectFactor(state, factor) {
    const normalized = normalizeFactor(factor);
    if (normalized === null) {
      return reset(state);
    }

    state.mode = MODE_TIMES_TABLE;
    state.factor = normalized;
    return state;
  }

  function reset(state) {
    state.mode = MODE_KEYPAD;
    state.factor = null;
    return state;
  }

  function getCells(state) {
    if (!state || state.mode !== MODE_TIMES_TABLE || state.factor === null) {
      return buildKeypadCells(state?.degree);
    }
    return buildTimesTableCells(state.factor, state.degree);
  }

  function getCellAt(state, slotIndex) {
    return getCells(state).find((cell) => cell.slot.index === slotIndex) || null;
  }

  window.NumPadModel = {
    MODE_KEYPAD,
    MODE_TIMES_TABLE,
    DISPLAY_PRODUCT,
    DISPLAY_DIGITAL_ROOT,
    PLACE_FULL,
    PLACE_ONES,
    PLACE_TENS,
    PLACE_HUNDREDS,
    getVisiblePlaceDigits,
    MIN_FACTOR,
    MAX_FACTOR,
    MIN_DEGREE,
    MAX_DEGREE,
    DEGREE_SPAN,
    normalizeFactor,
    normalizeDegree,
    getDegreeRange,
    getMultiplier,
    computeDigitalRoot,
    getPlaceDigits,
    normalizePlaceValue,
    formatProduct,
    normalizeDisplayFlags,
    setDisplayFlag,
    setPlaceValue,
    setGridPlaceValue,
    setChainPlaceValue,
    setDegree,
    shiftDegree,
    getLocatorValue,
    getDisplayLayers,
    buildKeypadCells,
    buildTimesTableCells,
    buildChain,
    buildAllChains,
    getChain,
    buildChainPath,
    createState,
    selectFactor,
    reset,
    getCells,
    getCellAt
  };
})();
