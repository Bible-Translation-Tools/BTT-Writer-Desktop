// Remove (clear) icons of the first on-screen ts-source-tab: one icon per source translation.
// See src/elements/ts-translate/ts-source/ts-source-tab.html.
const VISIBLE_REMOVE_ICONS = `
  function visibleRemoveIcons() {
    for (const tab of document.querySelectorAll("ts-source-tab")) {
      const icons = Array.from(tab.querySelectorAll("iron-icon[icon='clear']")).filter((icon) => {
        const rect = icon.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (icons.length) return icons;
    }
    return [];
  }
`;

/**
 * Clicks the remove icon of the only source tab and starts recording uncaught renderer errors
 * in `window.__e2eErrors` (the crash dialog is a separate window, invisible to this page target).
 * Returns "CLICKED", "NOT_FOUND" or "NOT_LAST_SOURCE".
 */
export function clickRemoveLastSourceExpr() {
  return `
    (function () {
      ${VISIBLE_REMOVE_ICONS}
      const icons = visibleRemoveIcons();
      if (!icons.length) return "NOT_FOUND";
      if (icons.length > 1) return "NOT_LAST_SOURCE";

      if (!window.__e2eErrors) {
        window.__e2eErrors = [];
        window.addEventListener("error", (event) => window.__e2eErrors.push(event.message));
      }
      icons[0].click();
      return "CLICKED";
    })()
  `;
}

/** Uncaught renderer errors recorded since clickRemoveLastSourceExpr, joined by newline. */
export function recordedErrorsExpr() {
  return `(window.__e2eErrors || []).join("\\n")`;
}

/** Returns "VISIBLE" when a source tab is on screen, else "NOT_FOUND". */
export function sourceTabVisibleExpr() {
  return `
    (function () {
      ${VISIBLE_REMOVE_ICONS}
      return visibleRemoveIcons().length ? "VISIBLE" : "NOT_FOUND";
    })()
  `;
}

/** Returns "VISIBLE" when the no-source screen (ts-nosource-mode) is shown, else "HIDDEN". */
export function noSourceModeVisibleExpr() {
  return `
    (function () {
      const mode = document.querySelector("ts-nosource-mode");
      if (!mode || mode.classList.contains("hide")) return "HIDDEN";
      const rect = mode.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? "VISIBLE" : "HIDDEN";
    })()
  `;
}
