(function () {
  "use strict";

  // "Tree + Cube" puts the two Kabbalah views side by side. Each view keeps
  // living in its own section, so the sections are parked in the tandem panes
  // while the tandem section is open and put back where they came from on exit.
  const PAIRS = [
    { sectionId: "kabbalah-tree-section", paneId: "kab-tandem-pane-tree" },
    { sectionId: "cube-section", paneId: "kab-tandem-pane-cube" }
  ];

  let parked = [];

  function enter() {
    if (parked.length) {
      return;
    }

    parked = PAIRS.map(({ sectionId, paneId }) => {
      const section = document.getElementById(sectionId);
      const pane = document.getElementById(paneId);
      if (!section || !pane || pane.contains(section)) {
        return null;
      }

      const spot = {
        section,
        parent: section.parentElement,
        nextSibling: section.nextElementSibling
      };
      pane.appendChild(section);
      return spot;
    }).filter(Boolean);
  }

  function leave() {
    parked.forEach(({ section, parent, nextSibling }) => {
      // A skin swap can reparent the panes; fall back to the document so the
      // section never ends up stranded in a detached tree.
      const target = parent instanceof HTMLElement && parent.isConnected ? parent : document.body;
      if (nextSibling instanceof HTMLElement && nextSibling.parentElement === target) {
        target.insertBefore(section, nextSibling);
      } else {
        target.appendChild(section);
      }
    });
    parked = [];
  }

  window.UiTandem = { enter, leave };
})();
