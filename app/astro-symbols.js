(function () {
  "use strict";

  // Shared astrology glyphs. The Cube of Space edge markers and the Tree of Life
  // path labels both read from here so the two views stay identical.
  const PLANET_SYMBOLS = {
    mercury: "☿︎",
    venus: "♀︎",
    mars: "♂︎",
    jupiter: "♃︎",
    saturn: "♄︎",
    sol: "☉︎",
    sun: "☉︎",
    luna: "☾︎",
    moon: "☾︎",
    earth: "⊕",
    uranus: "♅︎",
    neptune: "♆︎",
    pluto: "♇︎"
  };

  const ZODIAC_SYMBOLS = {
    aries: "♈︎",
    taurus: "♉︎",
    gemini: "♊︎",
    cancer: "♋︎",
    leo: "♌︎",
    virgo: "♍︎",
    libra: "♎︎",
    scorpio: "♏︎",
    sagittarius: "♐︎",
    capricorn: "♑︎",
    aquarius: "♒︎",
    pisces: "♓︎"
  };

  const ELEMENT_SYMBOLS = {
    fire: "🜂",
    water: "🜄",
    air: "🜁",
    earth: "🜃",
    spirit: "🜀"
  };

  const SYMBOLS_BY_TYPE = {
    planet: PLANET_SYMBOLS,
    zodiac: ZODIAC_SYMBOLS,
    element: ELEMENT_SYMBOLS
  };

  function normalizeToken(value) {
    return String(value || "").trim().toLowerCase();
  }

  function get(type, name) {
    const table = SYMBOLS_BY_TYPE[normalizeToken(type)];
    if (!table) {
      return "";
    }

    return table[normalizeToken(name)] || "";
  }

  window.AstroSymbols = {
    get,
    normalizeToken,
    planetSymbols: PLANET_SYMBOLS,
    zodiacSymbols: ZODIAC_SYMBOLS,
    elementSymbols: ELEMENT_SYMBOLS
  };
})();
