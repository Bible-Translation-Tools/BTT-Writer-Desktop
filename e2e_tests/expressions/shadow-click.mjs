export function escapeForTemplate(str) {
  return JSON.stringify(str);
}

/**
 * Depth-first click: first visible element whose trimmed text equals `text`
 * (walks into open shadow roots). Matches original profile-setup behavior.
 */
export function clickByTextExprDeep(text) {
  const target = escapeForTemplate(text);
  return `
    (function () {
      function clickInRoot(root) {
        for (const el of root.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (visible && (el.textContent || "").trim() === ${target}) {
            el.click();
            return "CLICKED";
          }
        }
        for (const el of root.querySelectorAll("*")) {
          if (!el.shadowRoot) continue;
          const nested = clickInRoot(el.shadowRoot);
          if (nested !== "NOT_FOUND") return nested;
        }
        return "NOT_FOUND";
      }
      return clickInRoot(document);
    })()
  `;
}

/**
 * Collects all visible exact-text matches, clicks the first. Matches project-creation behavior.
 */
export function clickByTextExprCollectFirst(text) {
  const target = escapeForTemplate(text);
  return `
    (function () {
      function collect(root, out) {
        for (const el of root.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (visible && (el.textContent || "").trim() === ${target}) out.push(el);
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
      }
      const out = [];
      collect(document, out);
      if (!out.length) return "NOT_FOUND";
      out[0].click();
      return "CLICKED";
    })()
  `;
}

export function hasVisibleTextExpr(text) {
  const target = escapeForTemplate(text);
  return `
    (function () {
      function collect(root, out) {
        for (const el of root.querySelectorAll("*")) {
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;
          if (visible && (el.textContent || "").trim() === ${target}) out.push(el);
          if (el.shadowRoot) collect(el.shadowRoot, out);
        }
      }
      const out = [];
      collect(document, out);
      return out.length > 0 ? "FOUND" : "NOT_FOUND";
    })()
  `;
}
