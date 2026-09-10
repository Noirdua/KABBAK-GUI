(function () {
  "use strict";

  const ROWS = 3;
  const COLUMNS = 3;
  const SLOT_COUNT = ROWS * COLUMNS;
  const MIN_INDEX = 1;
  const MAX_INDEX = SLOT_COUNT;

  const GRID = Object.freeze({
    id: "num-pad",
    rows: ROWS,
    columns: COLUMNS,
    slotCount: SLOT_COUNT,
    minIndex: MIN_INDEX,
    maxIndex: MAX_INDEX,
    origin: "top-left",
    indexBase: 1
  });

  function toInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.trunc(parsed);
  }

  function isSlotIndex(value) {
    const index = toInteger(value);
    return index !== null && index >= MIN_INDEX && index <= MAX_INDEX;
  }

  function isRow(value) {
    const row = toInteger(value);
    return row !== null && row >= 1 && row <= ROWS;
  }

  function isColumn(value) {
    const column = toInteger(value);
    return column !== null && column >= 1 && column <= COLUMNS;
  }

  function createSlot(index) {
    if (!isSlotIndex(index)) {
      return null;
    }

    const normalized = toInteger(index);
    const zeroIndex = normalized - 1;
    const row = Math.floor(zeroIndex / COLUMNS) + 1;
    const column = (zeroIndex % COLUMNS) + 1;

    return Object.freeze({
      index: normalized,
      zeroIndex,
      row,
      column,
      key: `slot-${normalized}`
    });
  }

  function slotAt(row, column) {
    if (!isRow(row) || !isColumn(column)) {
      return null;
    }
    return createSlot(((toInteger(row) - 1) * COLUMNS) + toInteger(column));
  }

  function listSlots() {
    return Array.from({ length: SLOT_COUNT }, (_, offset) => createSlot(offset + 1));
  }

  function neighbor(slotOrIndex, rowDelta, columnDelta) {
    const slot = typeof slotOrIndex === "object" && slotOrIndex
      ? createSlot(slotOrIndex.index)
      : createSlot(slotOrIndex);
    if (!slot) {
      return null;
    }

    return slotAt(slot.row + Number(rowDelta || 0), slot.column + Number(columnDelta || 0));
  }

  function mapSlots(mapper) {
    const mapFn = typeof mapper === "function" ? mapper : (slot) => slot;
    return listSlots().map((slot, offset) => mapFn(slot, offset));
  }

  window.NumPadGrid = {
    GRID,
    createSlot,
    slotAt,
    listSlots,
    mapSlots,
    neighbor,
    isSlotIndex,
    isRow,
    isColumn
  };
})();
