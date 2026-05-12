/**
 * `#welcome` lives in `ts-home` shadow DOM (see src/elements/ts-home/ts-home.html).
 * Returns a short state string for polling from CDP.
 */
export function welcomeHomeVisibleExpr() {
  return `
    (function () {
      function findTsHomeWelcome(root) {
        for (const el of root.querySelectorAll("ts-home")) {
          if (!el.shadowRoot) continue;
          const w = el.shadowRoot.querySelector("#welcome");
          if (w) return { home: el, welcome: w };
        }
        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const found = findTsHomeWelcome(el.shadowRoot);
          if (found) return found;
        }
        return null;
      }

      const pair = findTsHomeWelcome(document);
      if (!pair) return "NOT_FOUND";

      const home = pair.home;
      const welcome = pair.welcome;

      const homeStyle = getComputedStyle(home);
      if (homeStyle.display === "none" || homeStyle.visibility === "hidden") {
        return "HOME_HIDDEN";
      }

      const ws = getComputedStyle(welcome);
      if (ws.display === "none" || ws.visibility === "hidden" || parseFloat(ws.opacity) === 0) {
        return "HIDDEN";
      }
      if (welcome.classList.contains("hide")) return "HIDDEN";

      const rect = welcome.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return "NO_LAYOUT";

      return "VISIBLE";
    })()
  `;
}
