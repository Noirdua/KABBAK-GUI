(function () {
  "use strict";

  const VIEWS = ["month", "week", "day", "agenda"];
  const SETTINGS_STORAGE_KEY = "tarot-time-settings-v1";
  const DEFAULT_GEO = { latitude: 51.5074, longitude: -0.1278 };
  const CATEGORY_COLORS = {
    personal: "#6366f1",
    ritual: "#a855f7",
    study: "#0ea5e9",
    work: "#64748b",
    health: "#10b981",
    travel: "#f59e0b",
    other: "#94a3b8"
  };
  const STATE_ICON = { holiday: "#fde68a", moon: "#c7d2fe", astrology: "#fcd34d", notes: "#6366f1", planetary: "#52525b" };
  const MAX_SEGMENTS_UI = 12;
  const MAX_ATTACHMENTS_UI = 6;
  const MAX_ATTACHMENT_BYTES_UI = 5 * 1024 * 1024;
  const FEED_LAYERS_STORAGE_KEY = "kabbak-feed-layers-v1";
  // Subscribe layers. Rendered in JS so a cached page shell never hides one.
  const FEED_LAYERS = [
    { id: "user", text: "My events", defaultOn: true },
    { id: "notes", text: "Notes & journals", defaultOn: false },
    { id: "astrology", text: "Astrology (decans)", defaultOn: false },
    { id: "moon", text: "Moon phases", defaultOn: true },
    { id: "planetary", text: "Planetary hours", defaultOn: false },
    { id: "holidays", text: "Holidays", defaultOn: true }
  ];
  const FEED_LAYER_IDS = Object.fromEntries(FEED_LAYERS.map((layer) => [layer.id, `planner-feed-layer-${layer.id}`]));

  let bound = false;
  let view = "month";
  let focusDate = startOfDay(new Date());
  let sideDate = null;
  let occurrences = [];
  let editingEventId = "";
  let loadToken = 0;
  const FILTER_STORAGE_KEY = "kabbak-planner-filters-v1";
  // Calendar filter groups. "events" is the profile's own events; the rest map
  // to the subscription layers plus the local planetary-hour layer.
  const PLANNER_FILTERS = [
    { id: "events", text: "My events" },
    { id: "astrology", text: "Astrology", configurable: true },
    { id: "moon", text: "Moon", configurable: true },
    { id: "holidays", text: "Holidays" },
    { id: "planetary", text: "Planetary hours" }
  ];
  const PLANNER_FILTER_IDS = PLANNER_FILTERS.map((entry) => entry.id);
  const MOON_PHASE_CHOICES = [
    { slug: "new", label: "New Moon" },
    { slug: "first-quarter", label: "First Quarter" },
    { slug: "full", label: "Full Moon" },
    { slug: "last-quarter", label: "Last Quarter" }
  ];
  const ASTROLOGY_DETAIL_CHOICES = [
    { value: "decan", label: "Decan changes (every 10°)" },
    { value: "degree", label: "Every degree (about daily)" },
    { value: "sign", label: "Sign ingresses only" }
  ];

  let plannerFilterState = { events: true, astrology: true, moon: true, holidays: true, planetary: true };
  let overlayOccurrences = [];
  let planetaryOccurrences = [];
  let filterPopoverEl = null;
  let feedState = null;
  let feedLayerPrefs = Object.fromEntries(FEED_LAYERS.map((layer) => [layer.id, layer.defaultOn === true]));
  feedLayerPrefs.notesFormat = "events";
  let feedPrefsSaveTimer = null;
  let referenceCache = null;
  let baseAttachments = [];
  let occurrenceAttachments = [];
  let attachmentTarget = "series";
  let editingOccurrenceDate = "";
  let editingOccurrenceOverrides = [];
  let editingIsRecurring = false;

  function activeAttachmentList() {
    return attachmentTarget === "occurrence" ? occurrenceAttachments : baseAttachments;
  }

  function findOverrideForDate(list, date) {
    return (Array.isArray(list) ? list : []).find((entry) => entry.date === date) || null;
  }

  function buildOccurrenceOverrides(list, date, attachments) {
    const others = (Array.isArray(list) ? list : []).filter((entry) => entry.date !== date);
    const cleaned = (attachments || []).map((att) => ({
      id: att.id,
      name: att.name,
      type: att.type,
      size: att.size,
      data: att.data
    }));
    if (cleaned.length) {
      others.push({ date, attachments: cleaned });
    }
    return others.sort((left, right) => left.date.localeCompare(right.date));
  }

  function $(id) {
    return document.getElementById(id);
  }

  function el(id) {
    const node = $(id);
    return node instanceof HTMLElement ? node : null;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseIsoDate(iso) {
    const [year, month, day] = String(iso || "").split("-").map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function isActive() {
    return (window.TarotSectionStateUi?.getActiveSection?.() || "home") === "planner";
  }

  function setStatus(message) {
    const node = el("planner-status");
    if (node) {
      node.textContent = message || "";
    }
  }

  function getCalendar() {
    return window.TarotAppCalendar || null;
  }

  // Built in JS (not static HTML) so it always appears even if the page shell is
  // served from cache.
  function ensurePlannerFilters() {
    if (el("planner-filters")) {
      return;
    }
    const shell = document.querySelector("#planner-section .planner-shell");
    const body = shell?.querySelector(".planner-body");
    if (!shell || !body) {
      return;
    }
    const bar = document.createElement("div");
    bar.id = "planner-filters";
    bar.className = "planner-filters";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Show calendars");
    const label = document.createElement("span");
    label.className = "planner-filter-label";
    label.textContent = "Show";
    bar.appendChild(label);
    PLANNER_FILTERS.forEach((entry) => {
      const item = document.createElement("span");
      item.className = "planner-filter-item";
      const label = document.createElement("label");
      label.className = "planner-layer";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("data-planner-filter", entry.id);
      label.appendChild(input);
      label.appendChild(document.createTextNode(` ${entry.text}`));
      item.appendChild(label);
      if (entry.configurable) {
        const gear = document.createElement("button");
        gear.type = "button";
        gear.className = "planner-filter-gear";
        gear.setAttribute("aria-label", `${entry.text} settings`);
        gear.title = `${entry.text} settings`;
        gear.textContent = "⚙";
        gear.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void openFilterConfig(entry.id, gear);
        });
        item.appendChild(gear);
      }
      bar.appendChild(item);
    });
    shell.insertBefore(bar, body);
  }

  function readFeedOptions() {
    const options = feedState?.options;
    if (options && typeof options === "object") {
      return {
        // An empty array means "no phases"; only an absent value means all.
        moonPhases: Array.isArray(options.moonPhases)
          ? options.moonPhases
          : MOON_PHASE_CHOICES.map((phase) => phase.slug),
        astrologyDetail: options.astrologyDetail || "decan"
      };
    }
    return { moonPhases: MOON_PHASE_CHOICES.map((phase) => phase.slug), astrologyDetail: "decan" };
  }

  // Reveal the calendar only once it has been themed and populated.
  function markCalendarReady() {
    document.getElementById("planner-section")?.classList.add("is-calendar-ready");
  }

  function closeFilterPopover() {
    if (filterPopoverEl) {
      filterPopoverEl.remove();
      filterPopoverEl = null;
    }
  }

  function onFilterPopoverOutsideClick(event) {
    if (filterPopoverEl && !filterPopoverEl.contains(event.target) && !event.target.closest(".planner-filter-gear")) {
      closeFilterPopover();
    }
  }

  async function saveFeedOptions(nextOptions) {
    try {
      feedState = await window.TarotDataService.updateProfileCalendarFeed({ options: nextOptions });
      void render();
      setStatus("Calendar settings saved.");
    } catch (error) {
      setStatus(error?.message || "Could not save calendar settings.");
    }
  }

  // Per-calendar settings: which moon phases, and how fine-grained astrology is.
  async function openFilterConfig(kind, anchor) {
    closeFilterPopover();
    try {
      feedState = await window.TarotDataService.fetchProfileCalendarFeed();
    } catch (_error) {
      // fall back to whatever state we have (defaults)
    }
    const options = readFeedOptions();
    const popover = document.createElement("div");
    popover.className = "planner-filter-popover";
    const title = document.createElement("strong");
    title.textContent = kind === "moon" ? "Moon phases" : "Astrology events";
    popover.appendChild(title);

    if (kind === "moon") {
      MOON_PHASE_CHOICES.forEach((phase) => {
        const option = document.createElement("label");
        option.className = "planner-filter-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.setAttribute("data-phase", phase.slug);
        input.checked = options.moonPhases.includes(phase.slug);
        input.addEventListener("change", () => {
          const selected = MOON_PHASE_CHOICES
            .filter((entry) => popover.querySelector(`[data-phase="${entry.slug}"]`)?.checked)
            .map((entry) => entry.slug);
          void saveFeedOptions({ moonPhases: selected, astrologyDetail: options.astrologyDetail });
        });
        option.appendChild(input);
        option.appendChild(document.createTextNode(` ${phase.label}`));
        popover.appendChild(option);
      });
    } else {
      ASTROLOGY_DETAIL_CHOICES.forEach((choice) => {
        const option = document.createElement("label");
        option.className = "planner-filter-option";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "planner-astrology-detail";
        input.value = choice.value;
        input.checked = options.astrologyDetail === choice.value;
        input.addEventListener("change", () => {
          if (input.checked) {
            void saveFeedOptions({ moonPhases: options.moonPhases, astrologyDetail: choice.value });
          }
        });
        option.appendChild(input);
        option.appendChild(document.createTextNode(` ${choice.label}`));
        popover.appendChild(option);
      });
    }

    (anchor.parentElement || anchor).appendChild(popover);
    filterPopoverEl = popover;
    window.setTimeout(() => {
      document.addEventListener("click", onFilterPopoverOutsideClick, { once: true });
    }, 0);
  }

  function loadPlannerFilters() {
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        PLANNER_FILTER_IDS.forEach((id) => {
          plannerFilterState[id] = parsed[id] !== false;
        });
      }
    } catch (_error) {
      // keep defaults
    }
  }

  function savePlannerFilters() {
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(plannerFilterState));
    } catch (_error) {
      // persistence is best-effort
    }
  }

  function syncPlannerFilterControls() {
    document.querySelectorAll("[data-planner-filter]").forEach((input) => {
      const id = input.getAttribute("data-planner-filter");
      input.checked = plannerFilterState[id] !== false;
    });
  }

  function filterIdForCalendarId(calendarId) {
    const id = String(calendarId || "user");
    if (id === "user") return "events";
    if (id === "astrology") return "astrology";
    if (id === "moon") return "moon";
    if (id === "holiday") return "holidays";
    if (id === "planetary" || id.startsWith("planet-")) return "planetary";
    return "";
  }

  function isCalendarVisible(calendarId) {
    const filterId = filterIdForCalendarId(calendarId);
    return !filterId || plannerFilterState[filterId] !== false;
  }

  function calendarIdForOccurrence(occurrence) {
    if (occurrence?.calendarId) {
      return String(occurrence.calendarId);
    }
    const source = occurrence?.source || "user";
    if (source === "holiday") return "holiday";
    if (source === "moon") return "moon";
    if (source === "astrology") return "astrology";
    if (source === "planetary") return "planetary";
    return "user";
  }

  function isOccurrenceVisible(occurrence) {
    return isCalendarVisible(calendarIdForOccurrence(occurrence));
  }

  function categoryColor(occurrence) {
    if (occurrence.color) {
      return occurrence.color;
    }
    return CATEGORY_COLORS[occurrence.category] || CATEGORY_COLORS.personal;
  }

  function readGeo() {
    // The profile location is authoritative (planetary hours, sky cards); the
    // legacy settings blob and the London default are only fallbacks.
    const profileLocation = window.ProfileUi?.getLocation?.() || window.TarotSettingsUi?.getProfileLocation?.();
    const profileLatitude = Number(profileLocation?.latitude);
    const profileLongitude = Number(profileLocation?.longitude);
    if (Number.isFinite(profileLatitude) && Number.isFinite(profileLongitude)) {
      return { latitude: profileLatitude, longitude: profileLongitude };
    }
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const latitude = Number(parsed?.latitude);
      const longitude = Number(parsed?.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    } catch (_error) {
      // fall through to defaults
    }
    return { ...DEFAULT_GEO };
  }

  function visibleRange() {
    if (view === "month") {
      const first = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
      const last = new Date(focusDate.getFullYear(), focusDate.getMonth() + 1, 0);
      return { from: addDays(first, -7), to: addDays(last, 7) };
    }
    if (view === "week") {
      const startDay = window.TarotCalc?.getCenteredWeekStartDay?.(focusDate) ?? 0;
      const start = addDays(focusDate, -((focusDate.getDay() - startDay + 7) % 7));
      return { from: start, to: addDays(start, 6) };
    }
    if (view === "day") {
      return { from: focusDate, to: focusDate };
    }
    const from = focusDate < startOfDay(new Date()) ? new Date() : focusDate;
    return { from: startOfDay(from), to: addDays(from, 89) };
  }

  function formatRangeLabel() {
    const opts = { month: "long", year: "numeric" };
    if (view === "month") {
      return focusDate.toLocaleDateString(undefined, opts);
    }
    const { from, to } = visibleRange();
    if (view === "day") {
      return from.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    }
    if (view === "agenda") {
      return `From ${from.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
    }
    const sameMonth = from.getMonth() === to.getMonth();
    const startText = from.toLocaleDateString(undefined, { day: "numeric", month: sameMonth ? undefined : "short" });
    const endText = to.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    return `${startText} – ${endText}`;
  }

  // Explicit map so an unexpected category can never be filed under the wrong
  // calendar (user events use their own category, notes use dream/journal).
  const SUBSCRIPTION_SOURCE_BY_CATEGORY = {
    astrology: "astrology",
    moon: "moon",
    holiday: "holiday",
    notes: "notes",
    dream: "notes",
    journal: "notes"
  };

  function addMinutesToTime(time, minutes) {
    const [hours, mins] = String(time || "").split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(mins)) {
      return "";
    }
    const total = (hours * 60 + mins + minutes) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  // Turns a server subscription event into a calendar occurrence. Astrology and
  // moon events carry an exact local time, so they render as timed blocks (the
  // ICS feed keeps them all-day).
  function subscriptionOccurrence(event) {
    const source = SUBSCRIPTION_SOURCE_BY_CATEGORY[String(event.category || "").toLowerCase()];
    if (!source) {
      return null;
    }
    const timed = Boolean(event.time) && (source === "astrology" || source === "moon");
    const occurrence = {
      id: event.id,
      eventId: "",
      title: event.title || "",
      date: event.date,
      allDay: !timed,
      category: source,
      source,
      editable: false
    };
    if (timed) {
      occurrence.segments = [{ startTime: event.time, endTime: addMinutesToTime(event.time, 30) }];
    }
    return occurrence;
  }

  // The in-app calendar shows exactly what the profile is subscribed to, from
  // the same server computation that builds the ICS feed.
  async function buildOverlayOccurrences(from, to) {
    if (typeof window.TarotDataService?.fetchProfileCalendarEvents !== "function") {
      return [];
    }
    try {
      const payload = await window.TarotDataService.fetchProfileCalendarEvents(isoDate(from), isoDate(to));
      const events = Array.isArray(payload?.events) ? payload.events : [];
      return events.map(subscriptionOccurrence).filter(Boolean);
    } catch (_error) {
      return [];
    }
  }

  function occurrenceSegments(occurrence) {
    if (Array.isArray(occurrence.segments) && occurrence.segments.length) {
      return occurrence.segments;
    }
    return [{
      startTime: occurrence.startTime || "09:00",
      endTime: occurrence.endTime || occurrence.startTime || "10:00"
    }];
  }

  // A split-time event paints one block per segment; a plain event is one block.
  function toCalendarEvents(occurrence) {
    const source = occurrence.source || "user";
    // Honour an explicit calendar first: planetary hours use the per-planet
    // calendars, and defaulting them to "user" hid them behind the My events
    // filter and made them read-only user events.
    let calendarId = occurrence.calendarId || "user";
    if (!occurrence.calendarId) {
      if (source === "holiday") {
        calendarId = "holiday";
      } else if (source === "moon") {
        calendarId = "moon";
      } else if (source === "astrology") {
        calendarId = "astrology";
      } else if (source === "notes") {
        calendarId = "user";
      }
    }
    // Planetary hours keep the per-planet calendar colors (native event look)
    // instead of a forced swatch.
    const nativeColors = source === "planetary";
    const color = occurrence.editable === false
      ? STATE_ICON[source] || "#cbd5e1"
      : categoryColor(occurrence);
    const textColor = source === "moon" || source === "holiday" || source === "astrology"
      ? "#1f2937"
      : "#ffffff";
    const title = occurrence.title || "(untitled)";

    if (occurrence.allDay === true) {
      return [{
        id: occurrence.id,
        calendarId,
        title,
        isAllday: true,
        start: `${occurrence.date}T00:00:00`,
        end: `${isoDate(addDays(parseIsoDate(occurrence.date) || focusDate, 1))}T00:00:00`,
        category: "allday",
        backgroundColor: nativeColors ? undefined : color,
        borderColor: nativeColors ? undefined : color,
        color: nativeColors ? undefined : textColor,
        raw: occurrence
      }];
    }

    return occurrenceSegments(occurrence).map((segment, index) => ({
      id: `${occurrence.id}#${index}`,
      calendarId,
      title,
      isAllday: false,
      start: `${occurrence.date}T${segment.startTime}:00`,
      end: `${occurrence.date}T${segment.endTime || segment.startTime}:00`,
      category: "time",
      backgroundColor: nativeColors ? undefined : color,
      borderColor: nativeColors ? undefined : color,
      color: nativeColors ? undefined : textColor,
      raw: occurrence
    }));
  }

  async function buildPlanetaryEvents() {
    try {
      let referenceData = referenceCache || window.TarotAppRuntime?.getReferenceData?.() || null;
      if (!referenceData) {
        referenceData = await window.TarotDataService?.loadReferenceData?.() || null;
        referenceCache = referenceData;
      }
      if (!referenceData || typeof window.TarotEventBuilder?.buildWeekEvents !== "function") {
        return [];
      }
      const events = await window.TarotEventBuilder.buildWeekEvents(readGeo(), referenceData, focusDate);
      return Array.isArray(events) ? events : [];
    } catch (_error) {
      return [];
    }
  }

  // Planetary hours become ordinary timed occurrences so they flow through the
  // same rendering and agenda paths as every other event (no custom overlay).
  function planetaryOccurrence(event) {
    const start = event?.start instanceof Date ? event.start : new Date(event?.start);
    const end = event?.end instanceof Date ? event.end : new Date(event?.end);
    if (Number.isNaN(start.getTime())) {
      return null;
    }
    const planetName = event?.raw?.planetName || "";
    const symbol = event?.raw?.planetSymbol || "";
    const title = planetName ? `${symbol ? `${symbol} ` : ""}${planetName} hour` : (event?.title || "Planetary hour");
    return {
      id: event?.id || `ph-${start.getTime()}`,
      eventId: "",
      title,
      date: isoDate(start),
      allDay: false,
      segments: [{
        startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
        endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`
      }],
      category: "planetary",
      source: "planetary",
      calendarId: event?.calendarId || "planetary",
      editable: false
    };
  }

  async function renderCalendar(token = loadToken) {
    const calendar = getCalendar();
    if (!calendar) {
      return;
    }
    const range = visibleRange();
    const overlays = await buildOverlayOccurrences(range.from, range.to);
    if (token !== loadToken) {
      return;
    }
    overlayOccurrences = overlays;
    // Planetary hours are real timed events, shown in every view (month/week/
    // day) and in the agenda; overflow collapses into the usual "+N more".
    const wantsPlanetary = plannerFilterState.planetary !== false;
    const planetary = wantsPlanetary ? await buildPlanetaryEvents() : [];
    if (token !== loadToken) {
      return;
    }
    planetaryOccurrences = planetary.map(planetaryOccurrence).filter(Boolean);
    const calendarEvents = occurrences
      .flatMap(toCalendarEvents)
      .concat(overlays.flatMap(toCalendarEvents))
      .concat(planetaryOccurrences.flatMap(toCalendarEvents))
      .filter((event) => isCalendarVisible(event.calendarId));
    // Apply the view and date BEFORE adding events: createEvents commits into
    // the store for the calendar's current render range, so adding them while
    // the panel is still on an older range (month especially) drops them.
    // changeView() only takes a view name; the date is moved with setDate().
    // Read the calendar's real view so an external change (e.g. the home
    // calendar) can't leave us out of sync.
    const targetView = view === "agenda" ? "month" : view;
    calendar.setDate(focusDate);
    const actualView = typeof calendar.getViewName === "function" ? calendar.getViewName() : "";
    const viewChanged = actualView !== targetView;
    if (viewChanged) {
      calendar.changeView(targetView);
    }
    calendar.clear();
    calendar.createEvents(calendarEvents);
    if (viewChanged) {
      // Force the freshly added events into the new view (month in particular).
      requestAnimationFrame(() => {
        try {
          calendar.render();
        } catch (_error) {
          // Rendering is best-effort; the events are already in the store.
        }
      });
    }

    if (view === "day" || view === "week") {
      requestAnimationFrame(() => {
        try {
          calendar.scrollToNow?.("smooth");
        } catch (_error) {
          // Scrolling to now is a nicety; ignore if the panel is not ready.
        }
      });
    }

    requestAnimationFrame(() => markCalendarReady());
  }

  function occurrenceTimeText(occurrence) {
    if (occurrence.allDay) {
      return "All day";
    }
    const segments = occurrenceSegments(occurrence);
    const first = segments[0];
    const firstText = first.endTime ? `${first.startTime}–${first.endTime}` : first.startTime;
    return segments.length > 1 ? `${firstText} +${segments.length - 1}` : firstText;
  }

  function buildAgendaItem(occurrence, { showDate }) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "planner-agenda-item";
    item.dataset.source = occurrence.source || "user";
    if (occurrence.editable !== false) {
      item.addEventListener("click", () => openEditor(occurrence));
    } else {
      item.disabled = true;
    }
    const swatch = document.createElement("span");
    swatch.className = "planner-agenda-swatch";
    swatch.style.backgroundColor = occurrence.editable === false
      ? STATE_ICON[occurrence.source] || "#cbd5e1"
      : categoryColor(occurrence);
    item.appendChild(swatch);
    const body = document.createElement("span");
    body.className = "planner-agenda-body";
    const title = document.createElement("span");
    title.className = "planner-agenda-title";
    title.textContent = occurrence.title || "(untitled)";
    body.appendChild(title);
    const meta = document.createElement("span");
    meta.className = "planner-agenda-meta";
    const parts = [];
    if (showDate) {
      const date = parseIsoDate(occurrence.date);
      parts.push(date ? date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : occurrence.date);
    }
    parts.push(occurrenceTimeText(occurrence));
    if (Number(occurrence.attachmentCount) > 0) {
      const count = Number(occurrence.attachmentCount);
      parts.push(`${count} file${count === 1 ? "" : "s"}`);
    }
    meta.textContent = parts.join(" · ");
    body.appendChild(meta);
    item.appendChild(body);
    return item;
  }

  function renderAgenda() {
    const node = el("planner-agenda");
    const side = el("planner-side");
    const title = el("planner-side-title");
    if (!node) {
      return;
    }
    const isDayMode = view === "day" || Boolean(sideDate);
    const targetDate = sideDate || focusDate;
    const targetIso = isoDate(targetDate);
    // Merge the profile's own events with the subscription/planetary overlays so
    // the agenda reflects the same filters as the calendar grid.
    const combined = occurrences
      .concat(overlayOccurrences)
      .concat(planetaryOccurrences)
      .filter(isOccurrenceVisible)
      .sort((left, right) => {
        const byDate = String(left.date || "").localeCompare(String(right.date || ""));
        if (byDate !== 0) {
          return byDate;
        }
        const leftTime = left.time || left.startTime || "";
        const rightTime = right.time || right.startTime || "";
        return String(leftTime).localeCompare(String(rightTime));
      });
    const list = isDayMode
      ? combined.filter((entry) => entry.date === targetIso)
      : combined;

    if (side) {
      side.hidden = false;
    }
    if (title) {
      title.textContent = isDayMode
        ? targetDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        : "Upcoming";
    }

    node.textContent = "";
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "planner-empty";
      empty.textContent = isDayMode ? "Nothing scheduled for this day." : "No upcoming events. Use New event to add one.";
      node.appendChild(empty);
      return;
    }

    list.slice(0, 200).forEach((occurrence) => {
      node.appendChild(buildAgendaItem(occurrence, { showDate: !isDayMode }));
    });
  }

  function render() {
    if (!bound) {
      bind();
    }
    ensurePlannerFilters();
    syncPlannerFilterControls();
    window.TarotRefreshCalendarTheme?.();
    const rangeLabel = el("planner-range-label");
    if (rangeLabel) {
      rangeLabel.textContent = formatRangeLabel();
    }
    document.querySelectorAll("[data-planner-view]").forEach((button) => {
      const isCurrent = button.getAttribute("data-planner-view") === view;
      button.classList.toggle("is-active", isCurrent);
      button.setAttribute("aria-selected", isCurrent ? "true" : "false");
    });
    void loadEvents();
  }

  // Each render takes a token; a newer navigation invalidates older in-flight
  // loads so stepping the calendar always refreshes the events and overlays.
  async function loadEvents() {
    const token = ++loadToken;
    setStatus("Loading events…");
    try {
      const { from, to } = visibleRange();
      const payload = await window.TarotDataService?.fetchProfileEvents?.(isoDate(from), isoDate(to));
      if (token !== loadToken) {
        return;
      }
      occurrences = Array.isArray(payload?.events) ? payload.events : [];
      await renderCalendar(token);
      if (token !== loadToken) {
        return;
      }
      renderAgenda();
      setStatus("");
    } catch (error) {
      if (token === loadToken) {
        setStatus(error?.message || "Could not load events.");
      }
      // Never leave the calendar hidden if a render failed.
      markCalendarReady();
    }
  }

  function renderAttachments() {
    const container = el("planner-attachments");
    const addLabel = el("planner-attach-add");
    if (!container) {
      return;
    }
    const list = activeAttachmentList();
    container.textContent = "";
    if (!list.length) {
      const empty = document.createElement("span");
      empty.className = "planner-attach-empty";
      empty.textContent = attachmentTarget === "occurrence"
        ? "No files for this date yet."
        : "No files attached.";
      container.appendChild(empty);
    } else {
      list.forEach((att, index) => {
        const item = document.createElement("span");
        item.className = "planner-attach-item";
        if (String(att.type || "").startsWith("image/") && att.data) {
          const img = document.createElement("img");
          img.className = "planner-attach-thumb";
          img.alt = att.name || "attachment";
          img.src = att.data;
          item.appendChild(img);
        } else {
          const icon = document.createElement("span");
          icon.className = "planner-attach-icon";
          icon.textContent = "file";
          item.appendChild(icon);
        }
        const name = document.createElement("span");
        name.className = "planner-attach-name";
        name.textContent = att.name || "attachment";
        item.appendChild(name);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "planner-icon-btn planner-attach-remove";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove ${att.name || "attachment"}`);
        remove.addEventListener("click", () => {
          activeAttachmentList().splice(index, 1);
          renderAttachments();
        });
        item.appendChild(remove);
        container.appendChild(item);
      });
    }
    if (addLabel) {
      addLabel.hidden = list.length >= MAX_ATTACHMENTS_UI;
    }

    const scope = el("planner-attach-scope");
    if (scope) {
      scope.hidden = !(editingIsRecurring && editingOccurrenceDate);
    }
    const resetButton = el("planner-attach-reset");
    if (resetButton) {
      const hasOverride = Boolean(findOverrideForDate(editingOccurrenceOverrides, editingOccurrenceDate));
      resetButton.hidden = !(attachmentTarget === "occurrence" && hasOverride);
    }
  }

  function addAttachmentFiles(fileList) {
    Array.from(fileList || []).forEach((file) => {
      const list = activeAttachmentList();
      if (list.length >= MAX_ATTACHMENTS_UI) {
        return;
      }
      if (file.size > MAX_ATTACHMENT_BYTES_UI) {
        setModalStatus(`${file.name} is too large (max 5MB per file).`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        activeAttachmentList().push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          data: String(event?.target?.result || "")
        });
        renderAttachments();
      };
      reader.readAsDataURL(file);
    });
  }

  async function resetOccurrenceAttachments() {
    if (!editingEventId || !editingOccurrenceDate) {
      return;
    }
    setModalStatus("Resetting…");
    try {
      await window.TarotDataService.updateProfileEvent(editingEventId, {
        occurrenceOverrides: buildOccurrenceOverrides(editingOccurrenceOverrides, editingOccurrenceDate, [])
      });
      editingOccurrenceOverrides = editingOccurrenceOverrides.filter((entry) => entry.date !== editingOccurrenceDate);
      occurrenceAttachments = [];
      renderAttachments();
      setModalStatus("Reset to the series.");
    } catch (error) {
      setModalStatus(error?.message || "Could not reset this date.");
    }
  }

  function syncSegmentAddState() {
    const container = el("planner-segments");
    const addButton = el("planner-add-segment");
    if (addButton && container) {
      addButton.disabled = container.children.length >= MAX_SEGMENTS_UI;
    }
  }

  function addSegmentRow(startTime, endTime) {
    const container = el("planner-segments");
    if (!container || container.children.length >= MAX_SEGMENTS_UI) {
      return;
    }
    const row = document.createElement("div");
    row.className = "planner-segment-row";

    const start = document.createElement("input");
    start.type = "time";
    start.className = "planner-segment-input";
    start.value = startTime || "09:00";
    start.setAttribute("aria-label", "Time block start");

    const end = document.createElement("input");
    end.type = "time";
    end.className = "planner-segment-input";
    end.value = endTime || "";
    end.setAttribute("aria-label", "Time block end");

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "planner-icon-btn planner-segment-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Remove time block");
    remove.addEventListener("click", () => {
      row.remove();
      syncSegmentAddState();
      syncAllDayFields();
    });

    row.appendChild(start);
    row.appendChild(end);
    row.appendChild(remove);
    container.appendChild(row);
    syncSegmentAddState();
    syncAllDayFields();
  }

  function renderSegments(segments) {
    const container = el("planner-segments");
    if (!container) {
      return;
    }
    container.textContent = "";
    const rows = Array.isArray(segments) && segments.length
      ? segments
      : [{ startTime: "09:00", endTime: "10:00" }];
    rows.forEach((segment) => addSegmentRow(segment.startTime, segment.endTime));
    syncSegmentAddState();
    syncAllDayFields();
  }

  function readSegments() {
    const container = el("planner-segments");
    if (!container) {
      return [];
    }
    return Array.from(container.querySelectorAll(".planner-segment-row")).map((row) => {
      const inputs = row.querySelectorAll("input");
      return {
        startTime: String(inputs[0]?.value || ""),
        endTime: String(inputs[1]?.value || "")
      };
    });
  }

  function resetForm() {
    const set = (id, value) => {
      const node = el(id);
      if (node) {
        node.value = value;
      }
    };
    set("planner-field-title", "");
    set("planner-field-date", isoDate(focusDate));
    const allday = el("planner-field-allday");
    if (allday) {
      allday.checked = false;
    }
    set("planner-field-location", "");
    set("planner-field-category", "personal");
    set("planner-field-color", CATEGORY_COLORS.personal);
    set("planner-field-freq", "none");
    set("planner-field-interval", "1");
    set("planner-field-until", "");
    set("planner-field-notes", "");
    baseAttachments = [];
    occurrenceAttachments = [];
    attachmentTarget = "series";
    editingOccurrenceDate = "";
    editingOccurrenceOverrides = [];
    editingIsRecurring = false;
    const scopeBox = el("planner-attach-occurrence");
    if (scopeBox) {
      scopeBox.checked = false;
    }
    renderAttachments();
    renderSegments([{ startTime: "09:00", endTime: "10:00" }]);
  }

  function syncAllDayFields() {
    const allDay = el("planner-field-allday")?.checked === true;
    el("planner-segments")?.querySelectorAll("input").forEach((input) => {
      input.disabled = allDay;
    });
    const addButton = el("planner-add-segment");
    if (addButton) {
      addButton.disabled = allDay;
    }
  }

  function setModalStatus(message) {
    const node = el("planner-modal-status");
    if (node) {
      node.textContent = message || "";
    }
  }

  async function openEditor(occurrence) {
    if (occurrence && occurrence.editable === false) {
      return;
    }
    const modal = el("planner-modal");
    const heading = el("planner-modal-title");
    const deleteButton = el("planner-delete");
    if (!modal) {
      return;
    }
    resetForm();
    setModalStatus("");
    editingEventId = "";

    if (occurrence?.eventId) {
      // Range occurrences omit notes, so load the full record before editing.
      try {
        const full = await window.TarotDataService.fetchProfileEvent(occurrence.eventId);
        if (full && typeof full === "object") {
          occurrence = { ...occurrence, ...full };
        }
      } catch (_error) {
        // Fall back to the occurrence summary; notes may be blank.
      }
    }

    if (occurrence) {
      editingEventId = occurrence.eventId || "";
      const set = (id, value) => {
        const node = el(id);
        if (node) {
          node.value = value;
        }
      };
      set("planner-field-title", occurrence.title || "");
      set("planner-field-date", occurrence.date || isoDate(focusDate));
      const allday = el("planner-field-allday");
      if (allday) {
        allday.checked = occurrence.allDay === true;
      }
      renderSegments(occurrence.allDay === true ? [] : occurrenceSegments(occurrence));
      set("planner-field-location", occurrence.location || "");
      set("planner-field-category", occurrence.category || "personal");
      set("planner-field-color", occurrence.color || CATEGORY_COLORS[occurrence.category] || CATEGORY_COLORS.personal);
      const recurrence = occurrence.recurrence || {};
      set("planner-field-freq", recurrence.freq || "none");
      set("planner-field-interval", String(recurrence.interval || 1));
      set("planner-field-until", recurrence.until || "");
      set("planner-field-notes", occurrence.notes || "");
      editingIsRecurring = occurrence.isRecurring === true;
      editingOccurrenceDate = editingIsRecurring ? String(occurrence.date || "") : "";
      editingOccurrenceOverrides = Array.isArray(occurrence.occurrenceOverrides)
        ? occurrence.occurrenceOverrides.map((entry) => ({
            date: entry.date,
            attachments: Array.isArray(entry.attachments) ? entry.attachments.map((att) => ({ ...att })) : []
          }))
        : [];
      baseAttachments = Array.isArray(occurrence.attachments)
        ? occurrence.attachments.map((att) => ({ ...att }))
        : [];
      const existingOverride = findOverrideForDate(editingOccurrenceOverrides, editingOccurrenceDate);
      occurrenceAttachments = existingOverride
        ? existingOverride.attachments.map((att) => ({ ...att }))
        : [];
      attachmentTarget = "series";
      const scopeBox = el("planner-attach-occurrence");
      if (scopeBox) {
        scopeBox.checked = false;
      }
      renderAttachments();
    }
    if (heading) {
      heading.textContent = occurrence ? "Edit event" : "New event";
    }
    if (deleteButton) {
      deleteButton.hidden = !occurrence;
    }
    modal.hidden = false;
    el("planner-field-title")?.focus?.();
  }

  function closeEditor() {
    const modal = el("planner-modal");
    if (modal) {
      modal.hidden = true;
    }
    editingEventId = "";
  }

  function buildPayload() {
    const title = String(el("planner-field-title")?.value || "").trim();
    if (!title) {
      throw new Error("Give the event a title.");
    }
    const date = String(el("planner-field-date")?.value || "").trim();
    if (!date) {
      throw new Error("Pick a date.");
    }
    const allDay = el("planner-field-allday")?.checked === true;
    const freq = String(el("planner-field-freq")?.value || "none");
    const interval = Number(el("planner-field-interval")?.value || 1);
    const until = String(el("planner-field-until")?.value || "").trim();
    const recurrence = freq === "none"
      ? { freq: "none" }
      : { freq, interval: Number.isFinite(interval) && interval > 0 ? interval : 1, until };
    const segments = allDay ? [] : readSegments();
    if (!allDay) {
      const firstBlock = segments.find((segment) => segment.startTime);
      if (!firstBlock) {
        throw new Error("Add a start time to at least one time block.");
      }
    }
    return {
      title,
      date,
      allDay,
      // Mirrors segments[0] so an older API that predates split times still accepts it.
      startTime: allDay ? "" : (segments[0]?.startTime || ""),
      endTime: allDay ? "" : (segments[0]?.endTime || ""),
      segments,
      attachments: baseAttachments.map((att) => ({
        id: att.id,
        name: att.name,
        type: att.type,
        size: att.size,
        data: att.data
      })),
      location: String(el("planner-field-location")?.value || "").trim(),
      category: String(el("planner-field-category")?.value || "personal"),
      color: String(el("planner-field-color")?.value || ""),
      notes: String(el("planner-field-notes")?.value || ""),
      recurrence
    };
  }

  async function saveEditor() {
    // Editing a single date of a recurring event stores just an occurrence
    // override, leaving the series (and its other dates) untouched.
    if (attachmentTarget === "occurrence" && editingOccurrenceDate && editingEventId) {
      setModalStatus("Saving…");
      try {
        await window.TarotDataService.updateProfileEvent(editingEventId, {
          occurrenceOverrides: buildOccurrenceOverrides(editingOccurrenceOverrides, editingOccurrenceDate, occurrenceAttachments)
        });
        closeEditor();
        await loadEvents();
      } catch (error) {
        setModalStatus(error?.message || "Could not save this date.");
      }
      return;
    }

    let payload;
    try {
      payload = buildPayload();
    } catch (error) {
      setModalStatus(error.message);
      return;
    }
    setModalStatus("Saving…");
    try {
      if (editingEventId) {
        await window.TarotDataService.updateProfileEvent(editingEventId, payload);
      } else {
        await window.TarotDataService.createProfileEvent(payload);
      }
      closeEditor();
      await loadEvents();
    } catch (error) {
      setModalStatus(error?.message || "Could not save the event.");
    }
  }

  async function deleteEditor() {
    if (!editingEventId) {
      return;
    }
    setModalStatus("Deleting…");
    try {
      await window.TarotDataService.deleteProfileEvent(editingEventId);
      closeEditor();
      await loadEvents();
    } catch (error) {
      setModalStatus(error?.message || "Could not delete the event.");
    }
  }

  function ensureFeedLayers() {
    const wrap = el("planner-feed-layers");
    if (!wrap || wrap.childElementCount) {
      return;
    }
    FEED_LAYERS.forEach((entry) => {
      const label = document.createElement("label");
      label.className = "planner-check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = `planner-feed-layer-${entry.id}`;
      label.appendChild(input);
      label.appendChild(document.createTextNode(` ${entry.text}`));
      wrap.appendChild(label);
    });
  }

  function openFeed() {
    const modal = el("planner-feed");
    if (modal) {
      modal.hidden = false;
    }
    ensureFeedLayers();
    loadFeedPrefs();
    syncFeedPrefsToControls();
    void refreshFeed();
  }

  function closeFeed() {
    const modal = el("planner-feed");
    if (modal) {
      modal.hidden = true;
    }
  }

  function setFeedStatus(message) {
    const node = el("planner-feed-status");
    if (node) {
      node.textContent = message || "";
    }
  }

  function loadFeedPrefs() {
    try {
      const raw = window.localStorage.getItem(FEED_LAYERS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        Object.keys(FEED_LAYER_IDS).forEach((layer) => {
          feedLayerPrefs[layer] = parsed[layer] === true;
        });
        feedLayerPrefs.notesFormat = parsed.notesFormat === "journal" ? "journal" : "events";
      }
    } catch (_error) {
      // keep defaults
    }
  }

  function saveFeedPrefs() {
    try {
      window.localStorage.setItem(FEED_LAYERS_STORAGE_KEY, JSON.stringify(feedLayerPrefs));
    } catch (_error) {
      // persistence is best-effort
    }
  }

  function selectedFeedLayers() {
    return Object.keys(FEED_LAYER_IDS).filter((layer) => feedLayerPrefs[layer] === true);
  }

  function syncFeedPrefsFromState() {
    const layers = Array.isArray(feedState?.layers) ? feedState.layers : null;
    if (layers) {
      Object.keys(FEED_LAYER_IDS).forEach((layer) => {
        feedLayerPrefs[layer] = layers.includes(layer);
      });
    }
    if (feedState?.notesFormat) {
      feedLayerPrefs.notesFormat = feedState.notesFormat === "journal" ? "journal" : "events";
    }
    saveFeedPrefs();
  }

  function syncFeedPrefsToControls() {
    Object.keys(FEED_LAYER_IDS).forEach((layer) => {
      const input = el(FEED_LAYER_IDS[layer]);
      if (input) input.checked = feedLayerPrefs[layer] === true;
    });
    const format = el("planner-feed-notes-format");
    if (format) format.value = feedLayerPrefs.notesFormat;
    const formatWrap = el("planner-feed-notes-format-wrap");
    if (formatWrap) formatWrap.hidden = feedLayerPrefs.notes !== true;
  }

  // The URL carries only the token: subscription layers live on the profile, so
  // toggling them applies without the user re-adding the calendar.
  function buildFeedUrl() {
    if (!feedState?.enabled || !feedState?.token) {
      return "";
    }
    return window.TarotDataService.buildApiUrl("/api/v1/calendar/feed.ics", { token: feedState.token });
  }

  function setLayerStatus(message, isError = false) {
    const node = el("planner-feed-layer-status");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.tone = isError ? "error" : "";
  }

  function pushFeedPrefs(immediate = false) {
    window.clearTimeout(feedPrefsSaveTimer);
    setLayerStatus("Saving…");
    const run = async () => {
      if (!window.TarotDataService?.updateProfileCalendarFeed) {
        setLayerStatus("Could not save subscriptions.", true);
        return;
      }
      const requested = selectedFeedLayers();
      try {
        feedState = await window.TarotDataService.updateProfileCalendarFeed({
          layers: requested,
          notesFormat: feedLayerPrefs.notesFormat
        });
        syncFeedPrefsFromState();
        syncFeedPrefsToControls();
        const saved = Array.isArray(feedState?.layers) ? feedState.layers : [];
        const dropped = requested.filter((layer) => !saved.includes(layer));
        if (dropped.length) {
          setLayerStatus(`Server ignored: ${dropped.join(", ")}. Restart the API to load the latest subscription layers.`, true);
        } else {
          setLayerStatus("Saved. Your calendar app picks this up on its next refresh.");
        }
      } catch (error) {
        setLayerStatus(error?.message || "Could not save subscriptions.", true);
      }
    };
    if (immediate) {
      void run();
      return;
    }
    feedPrefsSaveTimer = window.setTimeout(run, 350);
  }

  function applyFeedState() {
    const urlInput = el("planner-feed-url");
    const enableButton = el("planner-feed-enable");
    const disableButton = el("planner-feed-disable");
    const rotateButton = el("planner-feed-rotate");
    const copyButton = el("planner-feed-copy");
    const enabled = feedState?.enabled === true && Boolean(feedState?.token);
    syncFeedPrefsFromState();
    syncFeedPrefsToControls();
    if (urlInput) {
      urlInput.value = enabled ? buildFeedUrl() : "";
      urlInput.placeholder = enabled ? "" : "Feed disabled";
    }
    if (enableButton) {
      enableButton.hidden = enabled;
    }
    if (disableButton) {
      disableButton.hidden = !enabled;
    }
    if (rotateButton) {
      rotateButton.hidden = !enabled;
    }
    if (copyButton) {
      copyButton.hidden = !enabled;
    }
  }

  async function refreshFeed() {
    setFeedStatus("Loading…");
    try {
      feedState = await window.TarotDataService.fetchProfileCalendarFeed();
      applyFeedState();
      setFeedStatus(feedState?.enabled ? "Feed is on. Changes appear after your calendar app refreshes." : "Feed is off.");
    } catch (error) {
      setFeedStatus(error?.message || "Could not load the feed.");
    }
  }

  async function changeFeed(action) {
    setFeedStatus("Updating…");
    try {
      const payload = action === "enable"
        ? { action, layers: selectedFeedLayers(), notesFormat: feedLayerPrefs.notesFormat }
        : { action };
      feedState = await window.TarotDataService.updateProfileCalendarFeed(payload);
      applyFeedState();
      setFeedStatus(feedState?.enabled ? "Feed is on. Changes appear after your calendar app refreshes." : "Feed is off.");
    } catch (error) {
      setFeedStatus(error?.message || "Could not update the feed.");
    }
  }

  function copyFeed() {
    const value = String(el("planner-feed-url")?.value || "");
    if (!value) {
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(
        () => setFeedStatus("Feed URL copied."),
        () => setFeedStatus("Could not copy. Select the URL and copy it manually.")
      );
      return;
    }
    el("planner-feed-url")?.select?.();
    setFeedStatus("Select the URL and copy it manually.");
  }

  function step(direction) {
    sideDate = null;
    if (view === "month") {
      focusDate = new Date(focusDate.getFullYear(), focusDate.getMonth() + direction, 1);
    } else if (view === "week") {
      focusDate = addDays(focusDate, 7 * direction);
    } else if (view === "day") {
      focusDate = addDays(focusDate, direction);
    } else {
      focusDate = addDays(focusDate, 28 * direction);
    }
    render();
  }

  function onCalendarClick(event) {
    const occurrence = event?.event?.raw;
    if (!occurrence) {
      return;
    }
    if (occurrence.editable === false) {
      sideDate = parseIsoDate(occurrence.date);
      renderAgenda();
      return;
    }
    openEditor(occurrence);
  }

  function onCalendarDateClick(event) {
    const dateIso = event?.date?.toDate?.();
    if (dateIso instanceof Date) {
      focusDate = startOfDay(dateIso);
      render();
    }
  }

  function bind() {
    if (bound) {
      return;
    }
    bound = true;

    el("planner-prev")?.addEventListener("click", () => step(-1));
    el("planner-next")?.addEventListener("click", () => step(1));
    el("planner-today")?.addEventListener("click", () => {
      focusDate = startOfDay(new Date());
      sideDate = null;
      render();
    });
    el("planner-new")?.addEventListener("click", () => openEditor(null));
    el("planner-feed-toggle")?.addEventListener("click", openFeed);

    document.querySelectorAll("[data-planner-view]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.getAttribute("data-planner-view");
        if (VIEWS.includes(next)) {
          view = next;
          sideDate = null;
          render();
        }
      });
    });

    ensurePlannerFilters();
    ensureFeedLayers();
    loadPlannerFilters();
    syncPlannerFilterControls();
    document.querySelectorAll("[data-planner-filter]").forEach((input) => {
      input.addEventListener("change", () => {
        const id = input.getAttribute("data-planner-filter");
        plannerFilterState[id] = input.checked;
        savePlannerFilters();
        render();
      });
    });

    el("planner-cancel")?.addEventListener("click", closeEditor);
    el("planner-save")?.addEventListener("click", saveEditor);
    el("planner-delete")?.addEventListener("click", deleteEditor);
    el("planner-field-allday")?.addEventListener("change", syncAllDayFields);
    el("planner-add-segment")?.addEventListener("click", () => addSegmentRow("09:00", "10:00"));
    el("planner-attach-input")?.addEventListener("change", (event) => {
      addAttachmentFiles(event.target?.files);
      if (event.target) {
        event.target.value = "";
      }
    });
    el("planner-attach-occurrence")?.addEventListener("change", (event) => {
      attachmentTarget = event.target?.checked ? "occurrence" : "series";
      renderAttachments();
    });
    el("planner-attach-reset")?.addEventListener("click", () => {
      void resetOccurrenceAttachments();
    });

    el("planner-feed-save")?.addEventListener("click", () => pushFeedPrefs(true));
    el("planner-feed-close")?.addEventListener("click", closeFeed);
    el("planner-feed-copy")?.addEventListener("click", copyFeed);
    el("planner-feed-enable")?.addEventListener("click", () => changeFeed("enable"));
    el("planner-feed-rotate")?.addEventListener("click", () => changeFeed("rotate"));
    el("planner-feed-disable")?.addEventListener("click", () => changeFeed("disable"));

    loadFeedPrefs();
    Object.keys(FEED_LAYER_IDS).forEach((layer) => {
      el(FEED_LAYER_IDS[layer])?.addEventListener("change", () => {
        feedLayerPrefs[layer] = el(FEED_LAYER_IDS[layer])?.checked === true;
        saveFeedPrefs();
        syncFeedPrefsToControls();
        pushFeedPrefs();
      });
    });
    el("planner-feed-notes-format")?.addEventListener("change", (event) => {
      feedLayerPrefs.notesFormat = event.target?.value === "journal" ? "journal" : "events";
      saveFeedPrefs();
      pushFeedPrefs();
    });

    const calendar = getCalendar();
    if (calendar?.on) {
      calendar.on("clickEvent", onCalendarClick);
      calendar.on("clickDayname", onCalendarDateClick);
    }
  }

  window.TarotPlannerUi = {
    init: bind,
    isActive,
    render,
    ensurePlannerSection: render
  };
})();
