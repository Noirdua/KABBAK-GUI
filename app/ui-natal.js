(function () {
  "use strict";

  const ELEMENT_COLORS = {
    fire: "#c45c3e",
    earth: "#7a9a4a",
    air: "#c9b45a",
    water: "#4a8aaa"
  };

  const SIGN_ORDER = [
    { id: "aries", name: "Aries", symbol: "♈︎", element: "fire" },
    { id: "taurus", name: "Taurus", symbol: "♉︎", element: "earth" },
    { id: "gemini", name: "Gemini", symbol: "♊︎", element: "air" },
    { id: "cancer", name: "Cancer", symbol: "♋︎", element: "water" },
    { id: "leo", name: "Leo", symbol: "♌︎", element: "fire" },
    { id: "virgo", name: "Virgo", symbol: "♍︎", element: "earth" },
    { id: "libra", name: "Libra", symbol: "♎︎", element: "air" },
    { id: "scorpio", name: "Scorpio", symbol: "♏︎", element: "water" },
    { id: "sagittarius", name: "Sagittarius", symbol: "♐︎", element: "fire" },
    { id: "capricorn", name: "Capricorn", symbol: "♑︎", element: "earth" },
    { id: "aquarius", name: "Aquarius", symbol: "♒︎", element: "air" },
    { id: "pisces", name: "Pisces", symbol: "♓︎", element: "water" }
  ];

  let bound = false;
  let lastChart = null;

  function getElements() {
    return {
      formEl: document.getElementById("natal-form"),
      sourceProfileEl: document.getElementById("natal-source-profile"),
      sourceManualEl: document.getElementById("natal-source-manual"),
      dateEl: document.getElementById("natal-date"),
      timeEl: document.getElementById("natal-time"),
      timeUnknownEl: document.getElementById("natal-time-unknown"),
      countryEl: document.getElementById("natal-location-country"),
      regionEl: document.getElementById("natal-location-region"),
      cityEl: document.getElementById("natal-location-city"),
      latEl: document.getElementById("natal-lat"),
      lngEl: document.getElementById("natal-lng"),
      locationLabelEl: document.getElementById("natal-location-label"),
      statusEl: document.getElementById("natal-status"),
      emptyEl: document.getElementById("natal-empty"),
      resultEl: document.getElementById("natal-result"),
      bigThreeEl: document.getElementById("natal-big-three"),
      wheelEl: document.getElementById("natal-wheel"),
      notesEl: document.getElementById("natal-notes"),
      talliesEl: document.getElementById("natal-tallies"),
      planetsEl: document.getElementById("natal-planets"),
      housesEl: document.getElementById("natal-houses"),
      aspectsEl: document.getElementById("natal-aspects")
    };
  }

  function isProfileSource() {
    return document.getElementById("natal-source-profile")?.checked !== false;
  }

  function setStatus(message, kind) {
    const statusEl = document.getElementById("natal-status");
    if (!statusEl) {
      return;
    }
    statusEl.textContent = message || "";
    statusEl.dataset.kind = kind || "";
  }

  function getProfileBirth() {
    const settings = window.TarotNatal?.getSettings?.()
      || window.TarotSettingsUi?.loadSavedSettings?.()
      || {};
    const location = window.ProfileUi?.getLocation?.()
      || window.TarotSettingsUi?.getProfileLocation?.()
      || null;
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    const geo = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? {
        latitude,
        longitude,
        label: String(location?.label || "").trim(),
        countryId: String(location?.countryId || "").trim(),
        regionId: String(location?.regionId || "").trim(),
        cityId: String(location?.cityId || "").trim()
      }
      : null;
    return {
      date: String(settings.birthDate || "").trim(),
      time: String(settings.birthTime || "").trim(),
      geo
    };
  }

  function describeGeo(geo) {
    const label = String(geo?.label || "").trim();
    const latitude = Number(geo?.latitude);
    const longitude = Number(geo?.longitude);
    const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
    if (!label && !hasCoords) {
      return "Location: pick a city, or enter coordinates.";
    }
    const coords = hasCoords ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : "";
    if (label && coords) {
      return `Location: ${label} (${coords})`;
    }
    return `Location: ${label || coords}`;
  }

  function fillSelect(selectEl, items, placeholder, selectedId) {
    if (!selectEl) {
      return;
    }
    const current = selectedId != null ? String(selectedId) : String(selectEl.value || "");
    selectEl.replaceChildren();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = placeholder;
    selectEl.appendChild(blank);
    (Array.isArray(items) ? items : []).forEach((item) => {
      const option = document.createElement("option");
      option.value = String(item.id || "");
      option.textContent = String(item.name || item.label || item.id || "");
      selectEl.appendChild(option);
    });
    if (current && [...selectEl.options].some((option) => option.value === current)) {
      selectEl.value = current;
    }
  }

  async function loadNatalCountries(selectedId) {
    const { countryEl } = getElements();
    if (!countryEl) {
      return;
    }
    try {
      const service = window.TarotDataService;
      const payload = await service.fetchJson(service.buildApiUrl("/api/v1/locations/countries"));
      fillSelect(countryEl, payload?.countries, "Select a country…", selectedId);
    } catch (_error) {
      fillSelect(countryEl, [], "Location list unavailable", "");
    }
  }

  async function loadNatalRegions(selectedId) {
    const { countryEl, regionEl, cityEl } = getElements();
    const countryId = String(countryEl?.value || "").trim();
    if (!regionEl) {
      return;
    }
    if (!countryId) {
      fillSelect(regionEl, [], "Select a region…", "");
      regionEl.disabled = true;
      fillSelect(cityEl, [], "Select a city…", "");
      if (cityEl) {
        cityEl.disabled = true;
      }
      return;
    }
    try {
      const service = window.TarotDataService;
      const payload = await service.fetchJson(service.buildApiUrl("/api/v1/locations/regions", { country: countryId }));
      const regions = Array.isArray(payload?.regions) ? payload.regions : [];
      fillSelect(regionEl, regions, regions.length ? "Select a region…" : "No regions — pick a city", selectedId);
      regionEl.disabled = isProfileSource() || regions.length === 0;
    } catch (_error) {
      fillSelect(regionEl, [], "Could not load regions", "");
      regionEl.disabled = true;
    }
  }

  async function loadNatalCities(selectedId) {
    const { countryEl, regionEl, cityEl } = getElements();
    const countryId = String(countryEl?.value || "").trim();
    const regionId = String(regionEl?.value || "").trim();
    if (!cityEl) {
      return;
    }
    if (!countryId) {
      fillSelect(cityEl, [], "Select a city…", "");
      cityEl.disabled = true;
      return;
    }
    try {
      const service = window.TarotDataService;
      const payload = await service.fetchJson(service.buildApiUrl("/api/v1/locations/cities", {
        country: countryId,
        region: regionId
      }));
      const cities = Array.isArray(payload?.cities) ? payload.cities : [];
      fillSelect(cityEl, cities, "Select a city…", selectedId);
      cityEl.disabled = isProfileSource() || cities.length === 0;
    } catch (_error) {
      fillSelect(cityEl, [], "Could not load cities", "");
      cityEl.disabled = true;
    }
  }

  async function resolveNatalPlace() {
    const els = getElements();
    const country = String(els.countryEl?.value || "").trim();
    const region = String(els.regionEl?.value || "").trim();
    const city = String(els.cityEl?.value || "").trim();
    if (!country && !region && !city) {
      return;
    }
    try {
      const service = window.TarotDataService;
      const place = await service.fetchJson(service.buildApiUrl("/api/v1/locations/resolve", { country, region, city }));
      if (els.latEl && Number.isFinite(Number(place?.latitude))) {
        els.latEl.value = String(place.latitude);
      }
      if (els.lngEl && Number.isFinite(Number(place?.longitude))) {
        els.lngEl.value = String(place.longitude);
      }
      if (els.locationLabelEl) {
        els.locationLabelEl.textContent = describeGeo({
          latitude: place?.latitude,
          longitude: place?.longitude,
          label: place?.label || ""
        });
      }
    } catch (_error) {
    }
  }

  function syncSourceLock() {
    const els = getElements();
    const locked = isProfileSource();
    [els.dateEl, els.timeEl, els.timeUnknownEl, els.countryEl, els.latEl, els.lngEl].forEach((inputEl) => {
      if (inputEl) {
        inputEl.disabled = locked;
      }
    });
    if (els.regionEl) {
      els.regionEl.disabled = locked || !String(els.countryEl?.value || "").trim() || els.regionEl.options.length <= 1;
    }
    if (els.cityEl) {
      els.cityEl.disabled = locked || !String(els.countryEl?.value || "").trim() || els.cityEl.options.length <= 1;
    }
  }

  async function applyProfileToForm() {
    const els = getElements();
    const profile = getProfileBirth();
    if (!profile.date && els.sourceManualEl && isProfileSource()) {
      els.sourceManualEl.checked = true;
    }
    if (els.locationLabelEl) {
      els.locationLabelEl.textContent = isProfileSource()
        ? describeGeo(profile.geo)
        : describeGeo({
          latitude: Number(els.latEl?.value),
          longitude: Number(els.lngEl?.value),
          label: String(els.cityEl?.selectedOptions?.[0]?.textContent || "").trim()
        });
    }
    if (!isProfileSource()) {
      syncSourceLock();
      return;
    }
    if (els.dateEl && profile.date) {
      els.dateEl.value = profile.date;
    }
    if (els.timeEl) {
      els.timeEl.value = profile.time || "";
    }
    if (els.timeUnknownEl) {
      els.timeUnknownEl.checked = !profile.time;
    }
    if (profile.geo) {
      if (els.latEl) {
        els.latEl.value = String(profile.geo.latitude);
      }
      if (els.lngEl) {
        els.lngEl.value = String(profile.geo.longitude);
      }
      if (profile.geo.countryId && els.countryEl) {
        els.countryEl.value = profile.geo.countryId;
        await loadNatalRegions(profile.geo.regionId);
        await loadNatalCities(profile.geo.cityId);
      }
    }
    syncSourceLock();
  }

  function selectedPlaceLabel(els) {
    const city = String(els.cityEl?.selectedOptions?.[0]?.textContent || "").trim();
    const region = String(els.regionEl?.selectedOptions?.[0]?.textContent || "").trim();
    const country = String(els.countryEl?.selectedOptions?.[0]?.textContent || "").trim();
    return [city, region, country].filter((part) => part && !part.startsWith("Select a") && !part.startsWith("No regions")).join(", ");
  }

  function readForm() {
    const els = getElements();
    const profile = getProfileBirth();
    const useProfile = isProfileSource();
    const date = useProfile ? profile.date : String(els.dateEl?.value || "").trim();
    const time = useProfile ? profile.time : String(els.timeEl?.value || "").trim();
    const timeUnknown = useProfile ? !profile.time : Boolean(els.timeUnknownEl?.checked) || !time;
    const geo = useProfile && profile.geo
      ? profile.geo
      : {
        latitude: Number(els.latEl?.value),
        longitude: Number(els.lngEl?.value),
        label: selectedPlaceLabel(els),
        countryId: String(els.countryEl?.value || "").trim(),
        regionId: String(els.regionEl?.value || "").trim(),
        cityId: String(els.cityEl?.value || "").trim()
      };
    return { date, time, timeUnknown, geo };
  }

  function utcOffsetMinutesFor(date, time) {
    const [year, month, day] = String(date).split("-").map(Number);
    const [hour, minute] = String(time || "12:00").split(":").map(Number);
    if (!year || !month || !day) {
      return null;
    }
    const local = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
    if (Number.isNaN(local.getTime())) {
      return null;
    }
    return -local.getTimezoneOffset();
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      node.setAttribute(key, String(value));
    });
    return node;
  }

  function polar(cx, cy, radius, svgDeg) {
    const rad = (svgDeg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad)
    };
  }

  function renderWheel(containerEl, chart) {
    containerEl.replaceChildren();
    const size = 360;
    const cx = size / 2;
    const cy = size / 2;
    const svg = svgEl("svg", { viewBox: `0 0 ${size} ${size}`, class: "natal-wheel-svg" });
    const asc = Number(chart?.points?.ascendant?.longitude);
    const origin = Number.isFinite(asc) ? asc : 0;
    const lonToSvg = (longitude) => 180 - (Number(longitude) - origin);
    const outer = 168;
    const inner = 118;
    const houseR = 78;
    const planetR = 98;

    SIGN_ORDER.forEach((sign, index) => {
      const start = lonToSvg(index * 30);
      const end = lonToSvg((index + 1) * 30);
      const a = polar(cx, cy, outer, start);
      const b = polar(cx, cy, outer, end);
      const c = polar(cx, cy, inner, end);
      const d = polar(cx, cy, inner, start);
      const path = svgEl("path", {
        d: `M ${a.x} ${a.y} A ${outer} ${outer} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 0 0 ${d.x} ${d.y} Z`,
        fill: ELEMENT_COLORS[sign.element] || "#666",
        "fill-opacity": "0.28",
        stroke: "currentColor",
        "stroke-opacity": "0.35",
        "stroke-width": "1"
      });
      svg.appendChild(path);
      const mid = polar(cx, cy, (outer + inner) / 2, lonToSvg(index * 30 + 15));
      const label = svgEl("text", {
        x: mid.x,
        y: mid.y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        class: "natal-wheel-sign"
      });
      label.textContent = sign.symbol;
      svg.appendChild(label);
    });

    svg.appendChild(svgEl("circle", {
      cx, cy, r: houseR, fill: "none", stroke: "currentColor", "stroke-opacity": "0.25", "stroke-width": "1"
    }));
    svg.appendChild(svgEl("circle", {
      cx, cy, r: inner, fill: "none", stroke: "currentColor", "stroke-opacity": "0.4", "stroke-width": "1"
    }));

    (chart?.houses || []).forEach((house) => {
      const angle = lonToSvg(house.longitude || 0);
      const edge = polar(cx, cy, inner, angle);
      const hub = polar(cx, cy, 18, angle);
      svg.appendChild(svgEl("line", {
        x1: hub.x, y1: hub.y, x2: edge.x, y2: edge.y,
        stroke: "currentColor", "stroke-opacity": house.number === 1 ? "0.9" : "0.28",
        "stroke-width": house.number === 1 ? "2" : "1"
      }));
    });

    (chart?.planets || []).forEach((planet) => {
      const angle = lonToSvg(planet.longitude || 0);
      const pos = polar(cx, cy, planetR, angle);
      const glyph = svgEl("text", {
        x: pos.x,
        y: pos.y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        class: "natal-wheel-planet"
      });
      glyph.textContent = planet.symbol || planet.name;
      svg.appendChild(glyph);
    });

    containerEl.appendChild(svg);
  }

  function pointCard(title, point, fallback) {
    const card = document.createElement("div");
    card.className = "natal-point-card";
    const kicker = document.createElement("div");
    kicker.className = "natal-point-kicker";
    kicker.textContent = title;
    const value = document.createElement("div");
    value.className = "natal-point-value";
    value.textContent = point
      ? `${point.symbol || ""} ${point.sign?.symbol || ""} ${point.sign?.name || ""} ${point.degreeLabel || ""}`.trim()
      : fallback;
    const extra = document.createElement("div");
    extra.className = "natal-point-extra";
    extra.textContent = point?.sign?.tarot?.majorArcana
      ? `${point.sign.tarot.majorArcana}${point.decan?.tarotMinorArcana ? ` · ${point.decan.tarotMinorArcana}` : ""}`
      : (point?.decan?.tarotMinorArcana || "");
    card.append(kicker, value, extra);
    return card;
  }

  function renderBigThree(containerEl, chart) {
    containerEl.replaceChildren();
    containerEl.append(
      pointCard("Sun", chart?.points?.sun, "--"),
      pointCard("Moon", chart?.points?.moon, "--"),
      pointCard("Rising", chart?.points?.ascendant, chart?.birth?.timeUnknown ? "Needs birth time" : "--")
    );
  }

  function addRow(containerEl, cells) {
    const row = document.createElement("div");
    row.className = "natal-row";
    cells.forEach((text) => {
      const cell = document.createElement("span");
      cell.textContent = text;
      row.appendChild(cell);
    });
    containerEl.appendChild(row);
  }

  function renderPlanets(containerEl, planets) {
    containerEl.replaceChildren();
    addRow(containerEl, ["Planet", "Sign", "House", "Rx"]);
    (planets || []).forEach((planet) => {
      addRow(containerEl, [
        `${planet.symbol || ""} ${planet.name}`.trim(),
        `${planet.sign?.symbol || ""} ${planet.sign?.name || ""} ${planet.degreeLabel || ""}`.trim(),
        planet.house ? `H${planet.house}` : "--",
        planet.retrograde ? "Rx" : ""
      ]);
    });
  }

  function renderHouses(containerEl, houses) {
    containerEl.replaceChildren();
    if (!houses?.length) {
      containerEl.textContent = "Houses need a birth time.";
      return;
    }
    addRow(containerEl, ["House", "Cusp"]);
    houses.forEach((house) => {
      addRow(containerEl, [
        String(house.number),
        `${house.sign?.symbol || ""} ${house.sign?.name || ""} ${house.degreeLabel || ""}`.trim()
      ]);
    });
  }

  function renderAspects(containerEl, aspects) {
    containerEl.replaceChildren();
    if (!aspects?.length) {
      containerEl.textContent = "No major aspects within orb.";
      return;
    }
    addRow(containerEl, ["Aspect", "Orb"]);
    aspects.slice(0, 24).forEach((aspect) => {
      addRow(containerEl, [
        `${aspect.from?.symbol || aspect.from?.name} ${aspect.glyph || ""} ${aspect.to?.symbol || aspect.to?.name}`,
        `${aspect.name} ${aspect.orb}°`
      ]);
    });
  }

  function renderTallies(containerEl, chart) {
    containerEl.replaceChildren();
    const block = (title, counts) => {
      const wrap = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = title;
      wrap.appendChild(heading);
      Object.entries(counts || {}).forEach(([key, value]) => {
        const line = document.createElement("div");
        line.textContent = `${key}: ${value}`;
        wrap.appendChild(line);
      });
      containerEl.appendChild(wrap);
    };
    block("Elements", chart?.elements);
    block("Modalities", chart?.modalities);
    if (chart?.moonPhase?.name) {
      const moon = document.createElement("div");
      const illumination = Number(chart.moonPhase.illuminationFraction);
      moon.textContent = `Moon: ${chart.moonPhase.name}${Number.isFinite(illumination) ? ` (${Math.round(illumination * 100)}%)` : ""}`;
      containerEl.appendChild(moon);
    }
  }

  function renderChart(chart) {
    const els = getElements();
    lastChart = chart;
    if (els.emptyEl) {
      els.emptyEl.hidden = true;
    }
    if (els.resultEl) {
      els.resultEl.hidden = false;
    }
    renderBigThree(els.bigThreeEl, chart);
    renderWheel(els.wheelEl, chart);
    if (els.notesEl) {
      els.notesEl.textContent = (chart?.notes || []).join(" ");
    }
    renderTallies(els.talliesEl, chart);
    renderPlanets(els.planetsEl, chart?.planets);
    renderHouses(els.housesEl, chart?.houses);
    renderAspects(els.aspectsEl, chart?.aspects);
  }

  async function castChart() {
    const service = window.TarotDataService;
    const input = readForm();
    if (!input.date) {
      setStatus("Set a birth date first.", "error");
      return;
    }
    const hasCoords = Number.isFinite(Number(input.geo?.latitude)) && Number.isFinite(Number(input.geo?.longitude));
    const hasPlace = Boolean(input.geo?.countryId || input.geo?.cityId);
    if (!hasCoords && !hasPlace) {
      setStatus("Pick a city, or enter coordinates.", "error");
      return;
    }
    if (!service?.requestJson || !service.buildApiUrl) {
      setStatus("API is not connected.", "error");
      return;
    }
    const query = {
      date: input.date
    };
    if (hasCoords) {
      query.latitude = input.geo.latitude;
      query.longitude = input.geo.longitude;
    }
    if (input.geo?.countryId) {
      query.country = input.geo.countryId;
    }
    if (input.geo?.regionId) {
      query.region = input.geo.regionId;
    }
    if (input.geo?.cityId) {
      query.city = input.geo.cityId;
    }
    if (input.timeUnknown || !input.time) {
      query.timeUnknown = "1";
    } else {
      const offset = utcOffsetMinutesFor(input.date, input.time);
      if (offset == null) {
        setStatus("Birth date is invalid.", "error");
        return;
      }
      query.time = input.time;
      query.utcOffsetMinutes = String(offset);
    }
    setStatus("Casting…");
    try {
      const chart = await service.requestJson("GET", service.buildApiUrl("/api/v1/astrology/natal", query));
      renderChart(chart);
      setStatus("Chart ready.");
    } catch (error) {
      setStatus(error?.message || "Unable to cast natal chart.", "error");
    }
  }

  function bind() {
    if (bound) {
      return;
    }
    bound = true;
    const els = getElements();
    els.formEl?.addEventListener("submit", (event) => {
      event.preventDefault();
      void castChart();
    });
    els.sourceProfileEl?.addEventListener("change", () => {
      void applyProfileToForm();
    });
    els.sourceManualEl?.addEventListener("change", () => {
      syncSourceLock();
    });
    els.timeUnknownEl?.addEventListener("change", () => {
      if (els.timeEl && els.timeUnknownEl.checked) {
        els.timeEl.value = "";
      }
    });
    els.countryEl?.addEventListener("change", () => {
      void loadNatalRegions().then(() => loadNatalCities()).then(() => resolveNatalPlace());
    });
    els.regionEl?.addEventListener("change", () => {
      void loadNatalCities().then(() => resolveNatalPlace());
    });
    els.cityEl?.addEventListener("change", () => {
      void resolveNatalPlace();
    });
    document.addEventListener("settings:updated", () => {
      if (isProfileSource()) {
        void applyProfileToForm();
      }
    });
    document.addEventListener("profile:location-updated", () => {
      if (isProfileSource()) {
        void applyProfileToForm();
      }
    });
  }

  async function ensureNatalPanel() {
    bind();
    await loadNatalCountries();
    await applyProfileToForm();
    const input = readForm();
    if (input.date && (Number.isFinite(Number(input.geo?.latitude)) || input.geo?.countryId)) {
      await castChart();
    }
  }

  window.TarotNatalUi = {
    ensureNatalPanel,
    renderNatalSummary() {
      if (lastChart) {
        renderChart(lastChart);
      }
    }
  };
})();
