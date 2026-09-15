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
  const PRINCIPAL_MOON_PHASES = new Set(["New Moon", "First Quarter", "Full Moon", "Last Quarter"]);
  const STATE_ICON = { holiday: "#fde68a", moon: "#c7d2fe" };
  const MAX_SEGMENTS_UI = 12;
  const MAX_ATTACHMENTS_UI = 6;
  const MAX_ATTACHMENT_BYTES_UI = 5 * 1024 * 1024;
  const FEED_LAYERS_STORAGE_KEY = "kabbak-feed-layers-v1";

  let bound = false;
  let view = "month";
  let focusDate = startOfDay(new Date());
  let sideDate = null;
  let occurrences = [];
  let editingEventId = "";
  let loading = false;
  let feedState = null;
  let feedLayerPrefs = { moon: true, holidays: true, notes: false, notesFormat: "events" };
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

  function categoryColor(occurrence) {
    if (occurrence.color) {
      return occurrence.color;
    }
    return CATEGORY_COLORS[occurrence.category] || CATEGORY_COLORS.personal;
  }

  function readGeo() {
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

  function buildOverlayOccurrences(from, to) {
    const result = [];
    if (!(el("planner-layer-holidays")?.checked)) {
      // holidays layer off
    } else {
      const referenceData = referenceCache || window.TarotAppRuntime?.getReferenceData?.() || null;
      const holidaysView = referenceData?.calendarHolidays;
      if (Array.isArray(holidaysView)) {
        const seen = new Set();
        for (let year = from.getFullYear(); year <= to.getFullYear(); year += 1) {
          holidaysView.forEach((holiday, index) => {
            const monthDay = String(holiday?.monthDayStart || "").trim();
            if (!/^\d{2}-\d{2}$/.test(monthDay)) {
              return;
            }
            const date = `${year}-${monthDay}`;
            if (date < isoDate(from) || date > isoDate(to)) {
              return;
            }
            const id = `holiday:${holiday.id || index}:${date}`;
            if (seen.has(id)) {
              return;
            }
            seen.add(id);
            result.push({
              id,
              eventId: "",
              title: holiday.name || "Holiday",
              date,
              allDay: true,
              category: "holiday",
              source: "holiday",
              editable: false
            });
          });
        }
      }
    }

    if (el("planner-layer-moon")?.checked && window.SunCalc && window.TarotCalc?.getMoonPhaseName) {
      let previous = "";
      for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
        const phase = window.TarotCalc.getMoonPhaseName(window.SunCalc.getMoonIllumination(cursor).phase);
        const date = isoDate(cursor);
        if (PRINCIPAL_MOON_PHASES.has(phase) && phase !== previous) {
          result.push({
            id: `moon:${date}`,
            eventId: "",
            title: `Moon: ${phase}`,
            date,
            allDay: true,
            category: "moon",
            source: "moon",
            editable: false
          });
        }
        previous = phase;
      }
    }
    return result;
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
    let calendarId = "user";
    if (source === "holiday") {
      calendarId = "holiday";
    } else if (source === "moon") {
      calendarId = "moon";
    }
    const color = occurrence.editable === false
      ? STATE_ICON[source] || "#cbd5e1"
      : categoryColor(occurrence);
    const textColor = source === "moon" || source === "holiday" ? "#1f2937" : "#ffffff";
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
        backgroundColor: color,
        borderColor: color,
        color: textColor,
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
      backgroundColor: color,
      borderColor: color,
      color: textColor,
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

  async function renderCalendar() {
    const calendar = getCalendar();
    if (!calendar) {
      return;
    }
    const range = visibleRange();
    const overlays = buildOverlayOccurrences(range.from, range.to);
    const planetary = el("planner-layer-planetary")?.checked && (view === "week" || view === "day")
      ? await buildPlanetaryEvents()
      : [];
    const calendarEvents = occurrences
      .flatMap(toCalendarEvents)
      .concat(overlays.flatMap(toCalendarEvents))
      .concat(planetary);
    calendar.clear();
    calendar.createEvents(calendarEvents);

    if (view === "agenda") {
      calendar.changeView("month", focusDate);
    } else {
      calendar.changeView(view, focusDate);
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
    const list = isDayMode
      ? occurrences.filter((entry) => entry.date === targetIso)
      : occurrences;

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

  async function loadEvents() {
    if (loading) {
      return;
    }
    loading = true;
    setStatus("Loading events…");
    try {
      if (el("planner-layer-holidays")?.checked && !referenceCache) {
        try {
          referenceCache = await window.TarotDataService?.loadReferenceData?.() || null;
        } catch (_error) {
          referenceCache = null;
        }
      }
      const { from, to } = visibleRange();
      const payload = await window.TarotDataService?.fetchProfileEvents?.(isoDate(from), isoDate(to));
      occurrences = Array.isArray(payload?.events) ? payload.events : [];
      await renderCalendar();
      renderAgenda();
      setStatus("");
    } catch (error) {
      setStatus(error?.message || "Could not load events.");
    } finally {
      loading = false;
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

  function openFeed() {
    const modal = el("planner-feed");
    if (modal) {
      modal.hidden = false;
    }
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
        feedLayerPrefs = {
          moon: parsed.moon !== false,
          holidays: parsed.holidays !== false,
          notes: parsed.notes === true,
          notesFormat: parsed.notesFormat === "journal" ? "journal" : "events"
        };
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

  function syncFeedPrefsToControls() {
    const moon = el("planner-feed-layer-moon");
    const holidays = el("planner-feed-layer-holidays");
    const notes = el("planner-feed-layer-notes");
    const format = el("planner-feed-notes-format");
    if (moon) moon.checked = feedLayerPrefs.moon;
    if (holidays) holidays.checked = feedLayerPrefs.holidays;
    if (notes) notes.checked = feedLayerPrefs.notes;
    if (format) format.value = feedLayerPrefs.notesFormat;
    const formatWrap = el("planner-feed-notes-format-wrap");
    if (formatWrap) formatWrap.hidden = !feedLayerPrefs.notes;
  }

  function buildFeedUrl() {
    if (!feedState?.enabled || !feedState?.token) {
      return "";
    }
    const layers = ["user"];
    if (feedLayerPrefs.moon) layers.push("moon");
    if (feedLayerPrefs.holidays) layers.push("holidays");
    if (feedLayerPrefs.notes) layers.push("notes");
    const params = { token: feedState.token, layers: layers.join(",") };
    if (feedLayerPrefs.notes && feedLayerPrefs.notesFormat === "journal") {
      params.notesFormat = "journal";
    }
    return window.TarotDataService.buildApiUrl("/api/v1/calendar/feed.ics", params);
  }

  function applyFeedState() {
    const urlInput = el("planner-feed-url");
    const enableButton = el("planner-feed-enable");
    const disableButton = el("planner-feed-disable");
    const rotateButton = el("planner-feed-rotate");
    const copyButton = el("planner-feed-copy");
    const enabled = feedState?.enabled === true && Boolean(feedState?.token);
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
      feedState = await window.TarotDataService.updateProfileCalendarFeed(action);
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

    ["planner-layer-moon", "planner-layer-holidays", "planner-layer-planetary"].forEach((id) => {
      el(id)?.addEventListener("change", () => {
        void renderCalendar();
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

    el("planner-feed-close")?.addEventListener("click", closeFeed);
    el("planner-feed-copy")?.addEventListener("click", copyFeed);
    el("planner-feed-enable")?.addEventListener("click", () => changeFeed("enable"));
    el("planner-feed-rotate")?.addEventListener("click", () => changeFeed("rotate"));
    el("planner-feed-disable")?.addEventListener("click", () => changeFeed("disable"));

    loadFeedPrefs();
    ["planner-feed-layer-moon", "planner-feed-layer-holidays", "planner-feed-layer-notes"].forEach((id) => {
      el(id)?.addEventListener("change", () => {
        feedLayerPrefs.moon = el("planner-feed-layer-moon")?.checked === true;
        feedLayerPrefs.holidays = el("planner-feed-layer-holidays")?.checked === true;
        feedLayerPrefs.notes = el("planner-feed-layer-notes")?.checked === true;
        saveFeedPrefs();
        applyFeedState();
      });
    });
    el("planner-feed-notes-format")?.addEventListener("change", (event) => {
      feedLayerPrefs.notesFormat = event.target?.value === "journal" ? "journal" : "events";
      saveFeedPrefs();
      applyFeedState();
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
