(function () {
  "use strict";

  // Compact-toolbar dropdowns shared by the Cube of Space and Tree of Life.
  // Markup contract:
  //   <div data-popover-toolbar>
  //     <div data-popover>
  //       <button data-popover-toggle aria-haspopup="true" aria-expanded="false">…</button>
  //       <div data-popover-panel hidden>…</div>
  //     </div>
  //   </div>
  // Panels are fixed so a scrollable ancestor cannot clip them, which means they
  // have to be dismissed whenever the layout moves under them.
  function bind(toolbar) {
    if (!(toolbar instanceof HTMLElement) || toolbar.dataset.popoverBound === "true") {
      return;
    }
    toolbar.dataset.popoverBound = "true";

    const menus = Array.from(toolbar.querySelectorAll("[data-popover]"));

    const positionPanel = (toggle, panel) => {
      panel.style.top = "0px";
      panel.style.left = "0px";
      const anchor = toggle.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      const gutter = 8;
      const gap = 6;

      let top = anchor.bottom + gap;
      if (top + bounds.height > window.innerHeight - gutter) {
        const above = anchor.top - gap - bounds.height;
        top = above > gutter ? above : Math.max(gutter, window.innerHeight - gutter - bounds.height);
      }

      let left = anchor.left;
      const maxLeft = window.innerWidth - gutter - bounds.width;
      if (left > maxLeft) {
        left = Math.max(gutter, maxLeft);
      }

      panel.style.top = `${Math.round(top)}px`;
      panel.style.left = `${Math.round(left)}px`;
    };

    const closeMenu = (menu) => {
      const toggle = menu.querySelector("[data-popover-toggle]");
      const panel = menu.querySelector("[data-popover-panel]");
      if (panel instanceof HTMLElement) {
        panel.hidden = true;
      }
      if (toggle instanceof HTMLElement) {
        toggle.setAttribute("aria-expanded", "false");
      }
    };
    const closeAll = (except) => {
      menus.forEach((menu) => {
        if (menu !== except) {
          closeMenu(menu);
        }
      });
    };

    menus.forEach((menu) => {
      const toggle = menu.querySelector("[data-popover-toggle]");
      const panel = menu.querySelector("[data-popover-panel]");
      if (!(toggle instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) {
        return;
      }

      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = panel.hidden;
        closeAll(menu);
        if (!willOpen) {
          closeMenu(menu);
          return;
        }
        panel.hidden = false;
        positionPanel(toggle, panel);
        toggle.setAttribute("aria-expanded", "true");
      });

      panel.addEventListener("click", (event) => {
        event.stopPropagation();
        // Action buttons close the menu; checkboxes and controls marked
        // `data-popover-keep-open` (repeatable actions like zoom) keep it open.
        if (event.target instanceof HTMLButtonElement && !event.target.closest("[data-popover-keep-open]")) {
          closeMenu(menu);
        }
      });
    });

    const dismiss = () => closeAll(null);
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        dismiss();
      }
    });
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
  }

  window.UiPopoverMenu = { bind };
})();
