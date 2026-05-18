/**
 * Returns whether the home route/scene is active and showing home content.
 * With projects, ts-home shows #list (not #welcome, which is only for an empty project list).
 */
export function welcomeHomeVisibleExpr() {
  return `
    (function () {
      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (el.classList.contains("hide")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function homeContentVisible(home) {
        const root = home.shadowRoot || home;
        const contentSelectors = ["#list", "#welcome", "#main"];
        for (const selector of contentSelectors) {
          const el = root.querySelector(selector);
          if (isVisible(el)) return true;
        }
        return false;
      }

      const pages = document.querySelector("neon-animated-pages");
      const route = pages && pages.selected;
      if (route && route !== "home") {
        return "WRONG_ROUTE:" + route;
      }

      const home =
        document.querySelector("ts-home#home") ||
        document.querySelector('ts-home[data-route="home"]');
      if (!home) return "NOT_FOUND";

      if (!isVisible(home)) return "HOME_HIDDEN";

      if (homeContentVisible(home)) return "VISIBLE";

      const root = home.shadowRoot || home;
      if (root.querySelector("#list")) return "LIST_HIDDEN";
      if (root.querySelector("#welcome")) return "HIDDEN";
      return "NO_HOME_CONTENT";
    })()
  `;
}
