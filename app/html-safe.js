/* html-safe.js — shared HTML escaping for template-built markup.
 * Must load before any UI module that assigns to innerHTML.
 *
 * Prefer the `html` tagged template over manual escaping: every ${...} is
 * escaped unless it is already SafeHtml, so new markup is safe by default.
 *
 *   el.innerHTML = html`<span title="${title}">${label}</span>`;
 *   el.innerHTML = html`<ul>${items.map((i) => html`<li>${i.name}</li>`)}</ul>`;
 *
 * Arrays are joined with no separator, so drop `.join("")` when the mapped
 * value is SafeHtml. Use `raw()` only for markup you already built safely.
 */
(() => {
  "use strict";

  const ENTITIES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  class SafeHtml {
    constructor(value) {
      this.value = String(value);
    }

    toString() {
      return this.value;
    }
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"']/g, (character) => ENTITIES[character]);
  }

  function raw(value) {
    if (value instanceof SafeHtml) return value;
    return new SafeHtml(value === null || value === undefined ? "" : value);
  }

  function serialize(value) {
    if (value instanceof SafeHtml) return value.value;
    if (Array.isArray(value)) return value.map(serialize).join("");
    return escapeHtml(value);
  }

  function html(strings, ...values) {
    let out = strings[0];
    for (let index = 0; index < values.length; index += 1) {
      out += serialize(values[index]) + strings[index + 1];
    }
    return new SafeHtml(out);
  }

  window.HtmlSafe = Object.freeze({ SafeHtml, escapeHtml, html, raw });
})();
