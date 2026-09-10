(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function svgEl(tag, attrs, text) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      el.setAttribute(key, String(value));
    });
    if (text != null) {
      el.textContent = text;
    }
    return el;
  }

  function normalizeLetterType(value) {
    const normalized = normalizeText(value);
    if (normalized.includes("mother")) return "mother";
    if (normalized.includes("double")) return "double";
    if (normalized.includes("simple")) return "simple";
    return "other";
  }

  function getRosePaletteForType(letterType) {
    if (letterType === "mother") {
      return ["#facc15", "#4ade80", "#f97316"];
    }

    if (letterType === "double") {
      return ["#fde047", "#fb7185", "#fdba74", "#34d399", "#60a5fa", "#c084fc", "#fca5a5"];
    }

    if (letterType === "simple") {
      return [
        "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
        "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef"
      ];
    }

    return ["#71717a", "#a1a1aa", "#52525b"];
  }

  function appendRosePetalRing(svg, paths, options) {
    if (!Array.isArray(paths) || !paths.length) {
      return;
    }

    const cx = Number(options?.cx) || 490;
    const cy = Number(options?.cy) || 560;
    const ringRadius = Number(options?.ringRadius) || 200;
    const petalRadius = Number(options?.petalRadius) || 38;
    const startDeg = Number(options?.startDeg) || -90;
    const letterType = String(options?.letterType || "other");
    const className = String(options?.className || "");
    const palette = getRosePaletteForType(letterType);

    paths.forEach((path, index) => {
      const angle = ((startDeg + ((360 / paths.length) * index)) * Math.PI) / 180;
      const px = cx + Math.cos(angle) * ringRadius;
      const py = cy + Math.sin(angle) * ringRadius;
      const letterChar = String(path?.hebrewLetter?.char || "?").trim() || "?";
      const transliteration = String(path?.hebrewLetter?.transliteration || "").trim();
      const tarotCard = String(path?.tarot?.card || "").trim();
      const fill = palette[index % palette.length];

      const group = svgEl("g", {
        class: `kab-rose-petal ${className}`.trim(),
        "data-path": path.pathNumber,
        role: "button",
        tabindex: "0",
        "aria-label": `Path ${path.pathNumber}: ${transliteration} ${letterChar}${tarotCard ? ` - ${tarotCard}` : ""}`
      });

      group.appendChild(svgEl("circle", {
        cx: px.toFixed(2),
        cy: py.toFixed(2),
        r: petalRadius.toFixed(2),
        class: "kab-rose-petal-shape",
        fill,
        stroke: "rgba(255,255,255,0.45)",
        "stroke-width": "1.5",
        style: "transform-box: fill-box; transform-origin: center;"
      }));

      group.appendChild(svgEl("text", {
        x: px.toFixed(2),
        y: (py + 4).toFixed(2),
        class: "kab-rose-petal-letter",
        "text-anchor": "middle",
        "dominant-baseline": "middle"
      }, letterChar));

      group.appendChild(svgEl("text", {
        x: px.toFixed(2),
        y: (py + petalRadius - 10).toFixed(2),
        class: "kab-rose-petal-number",
        "text-anchor": "middle",
        "dominant-baseline": "middle"
      }, String(path.pathNumber)));

      svg.appendChild(group);
    });
  }

  function buildRosicrucianCrossSVG(tree) {
    const cx = 490;
    const cy = 560;

    const svg = svgEl("svg", {
      viewBox: "0 0 980 1180",
      width: "100%",
      role: "img",
      "aria-label": "Rosicrucian cross with Hebrew letter petals",
      class: "kab-rose-svg"
    });

    for (let index = 0; index < 16; index += 1) {
      const angle = ((index * 22.5) - 90) * (Math.PI / 180);
      const baseAngle = 7 * (Math.PI / 180);
      const innerRadius = 232;
      const outerRadius = index % 2 === 0 ? 350 : 320;
      const x1 = cx + Math.cos(angle - baseAngle) * innerRadius;
      const y1 = cy + Math.sin(angle - baseAngle) * innerRadius;
      const x2 = cx + Math.cos(angle + baseAngle) * innerRadius;
      const y2 = cy + Math.sin(angle + baseAngle) * innerRadius;
      const x3 = cx + Math.cos(angle) * outerRadius;
      const y3 = cy + Math.sin(angle) * outerRadius;
      svg.appendChild(svgEl("polygon", {
        points: `${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)} ${x3.toFixed(2)},${y3.toFixed(2)}`,
        fill: "#f8fafc",
        stroke: "#0f172a",
        "stroke-opacity": "0.18",
        "stroke-width": "1"
      }));
    }

    svg.appendChild(svgEl("rect", { x: 408, y: 86, width: 164, height: 404, rx: 26, fill: "#f6e512", stroke: "#111827", "stroke-opacity": "0.55", "stroke-width": "1.6" }));
    svg.appendChild(svgEl("rect", { x: 96, y: 462, width: 348, height: 154, rx: 22, fill: "#ef1c24", stroke: "#111827", "stroke-opacity": "0.55", "stroke-width": "1.6" }));
    svg.appendChild(svgEl("rect", { x: 536, y: 462, width: 348, height: 154, rx: 22, fill: "#1537ee", stroke: "#111827", "stroke-opacity": "0.55", "stroke-width": "1.6" }));
    svg.appendChild(svgEl("rect", { x: 408, y: 616, width: 164, height: 286, rx: 0, fill: "#f3f4f6", stroke: "#111827", "stroke-opacity": "0.45", "stroke-width": "1.3" }));

    svg.appendChild(svgEl("polygon", { points: "408,902 490,902 408,980", fill: "#b3482f" }));
    svg.appendChild(svgEl("polygon", { points: "490,902 572,902 572,980", fill: "#506b1c" }));
    svg.appendChild(svgEl("polygon", { points: "408,902 490,902 490,980", fill: "#d4aa15" }));
    svg.appendChild(svgEl("polygon", { points: "408,980 572,980 490,1106", fill: "#020617" }));

    [
      { cx: 490, cy: 90, r: 52, fill: "#f6e512" },
      { cx: 430, cy: 154, r: 48, fill: "#f6e512" },
      { cx: 550, cy: 154, r: 48, fill: "#f6e512" },
      { cx: 90, cy: 539, r: 52, fill: "#ef1c24" },
      { cx: 154, cy: 480, r: 48, fill: "#ef1c24" },
      { cx: 154, cy: 598, r: 48, fill: "#ef1c24" },
      { cx: 890, cy: 539, r: 52, fill: "#1537ee" },
      { cx: 826, cy: 480, r: 48, fill: "#1537ee" },
      { cx: 826, cy: 598, r: 48, fill: "#1537ee" },
      { cx: 430, cy: 1038, r: 48, fill: "#b3482f" },
      { cx: 550, cy: 1038, r: 48, fill: "#506b1c" },
      { cx: 490, cy: 1110, r: 72, fill: "#020617" }
    ].forEach((entry) => {
      svg.appendChild(svgEl("circle", {
        cx: entry.cx,
        cy: entry.cy,
        r: entry.r,
        fill: entry.fill,
        stroke: "#111827",
        "stroke-opacity": "0.56",
        "stroke-width": "1.6"
      }));
    });

    [
      { x: 490, y: 128, t: "☿", c: "#a21caf", s: 50 },
      { x: 490, y: 206, t: "✶", c: "#a21caf", s: 56 },
      { x: 172, y: 539, t: "✶", c: "#16a34a", s: 62 },
      { x: 810, y: 539, t: "✶", c: "#fb923c", s: 62 },
      { x: 490, y: 778, t: "✡", c: "#52525b", s: 66 },
      { x: 490, y: 996, t: "✶", c: "#f8fafc", s: 62 },
      { x: 490, y: 1118, t: "☿", c: "#f8fafc", s: 56 }
    ].forEach((glyph) => {
      svg.appendChild(svgEl("text", {
        x: glyph.x,
        y: glyph.y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        class: "kab-rose-arm-glyph",
        fill: glyph.c,
        "font-size": String(glyph.s),
        "font-weight": "700"
      }, glyph.t));
    });

    svg.appendChild(svgEl("circle", { cx, cy, r: 286, fill: "rgba(2, 6, 23, 0.42)", stroke: "rgba(248, 250, 252, 0.24)", "stroke-width": "2" }));
    svg.appendChild(svgEl("circle", { cx, cy, r: 252, fill: "rgba(15, 23, 42, 0.32)", stroke: "rgba(248, 250, 252, 0.2)", "stroke-width": "1.5" }));

    const pathEntries = Array.isArray(tree?.paths)
      ? [...tree.paths].sort((left, right) => Number(left?.pathNumber) - Number(right?.pathNumber))
      : [];

    const grouped = {
      mother: [],
      double: [],
      simple: [],
      other: []
    };

    pathEntries.forEach((entry) => {
      const letterType = normalizeLetterType(entry?.hebrewLetter?.letterType);
      grouped[letterType].push(entry);
    });

    appendRosePetalRing(svg, grouped.simple, {
      cx,
      cy,
      ringRadius: 216,
      petalRadius: 34,
      startDeg: -90,
      letterType: "simple",
      className: "kab-rose-petal--simple"
    });

    appendRosePetalRing(svg, grouped.double, {
      cx,
      cy,
      ringRadius: 154,
      petalRadius: 36,
      startDeg: -78,
      letterType: "double",
      className: "kab-rose-petal--double"
    });

    appendRosePetalRing(svg, grouped.mother, {
      cx,
      cy,
      ringRadius: 96,
      petalRadius: 40,
      startDeg: -90,
      letterType: "mother",
      className: "kab-rose-petal--mother"
    });

    appendRosePetalRing(svg, grouped.other, {
      cx,
      cy,
      ringRadius: 274,
      petalRadius: 30,
      startDeg: -90,
      letterType: "other",
      className: "kab-rose-petal--other"
    });

    svg.appendChild(svgEl("circle", { cx, cy, r: 64, fill: "#f8fafc", stroke: "#111827", "stroke-width": "1.7" }));
    svg.appendChild(svgEl("circle", { cx, cy, r: 44, fill: "#facc15", stroke: "#111827", "stroke-width": "1.4" }));
    svg.appendChild(svgEl("path", { d: "M490 516 L490 604 M446 560 L534 560", stroke: "#111827", "stroke-width": "8", "stroke-linecap": "round" }));
    svg.appendChild(svgEl("circle", { cx, cy, r: 22, fill: "#db2777", stroke: "#111827", "stroke-width": "1.1" }));
    svg.appendChild(svgEl("circle", { cx, cy, r: 10, fill: "#f59e0b", stroke: "#111827", "stroke-width": "1" }));

    return svg;
  }

  window.KabbalahRosicrucianCross = {
    ...(window.KabbalahRosicrucianCross || {}),
    buildRosicrucianCrossSVG
  };
})();
